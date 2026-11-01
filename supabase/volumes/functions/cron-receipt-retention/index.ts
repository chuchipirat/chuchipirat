/**
 * Edge Function: cron-receipt-retention
 *
 * Löscht Belege ein Jahr nach Anlassende: die Datei im Storage und danach
 * die Belegspalten der Ausgabe. Die Ausgabe selbst bleibt. Ein verpasster
 * Lauf wird beim nächsten nachgeholt. Was fällig ist, entscheiden die
 * getesteten Funktionen in `_shared/receiptRetention.ts`.
 *
 * Zeitplan: Täglich um 01:30 UTC (02:30/03:30 Zürich)
 *
 * Erfordert die Umgebungsvariablen:
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *   SENTRY_DSN (optional, für Sentry Crons Monitoring)
 */
import {serve} from "https://deno.land/std@0.177.1/http/server.ts";
import {
  createClient,
  SupabaseClient,
} from "https://esm.sh/@supabase/supabase-js@2";
import {
  CORS_HEADERS,
  errorResponse,
  successResponse,
} from "../_shared/emailService.ts";
import {
  authenticateCronRequest,
  startCronJob,
  completeCronJob,
  failCronJob,
  sentryCheckIn,
} from "../_shared/cronJobHelper.ts";
import {sentryCaptureError} from "../_shared/sentryHelper.ts";
import {
  EventDateRow,
  getEventEndDates,
  ReceiptPathRow,
  selectDueReceipts,
  toStoragePath,
  toZurichDate,
} from "../_shared/receiptRetention.ts";
import {fetchAllRows} from "../_shared/fetchAllRows.ts";
import {chunkArray} from "../_shared/chunkArray.ts";

/* =====================================================================
// Konstanten
// ===================================================================== */

/** Name in `cron_job_log`, Sentry und der Admin-Seite «Cron-Jobs». */
const JOB_NAME = "cron-receipt-retention";

/**
 * Höchstens so viele IDs bzw. Pfade pro Anfrage. `.in(…)` landet in der
 * URL, eine zu lange URL lehnt der Server ab.
 */
const BLOCK_SIZE = 100;

/**
 * Ergebnis des Löschlaufs, landet in `cron_job_log`.
 *
 * @param requested - Fällige Belege, die gelöscht werden sollten.
 * @param removed - Dateien, die Storage tatsächlich gelöscht hat.
 * @param clearedExpenses - Ausgaben, deren Belegspalten geleert wurden.
 * @param errors - Fehler pro Block; der Lauf geht trotzdem weiter.
 */
type DeletionResult = {
  requested: number;
  removed: number;
  clearedExpenses: number;
  errors: string[];
};

/* =====================================================================
// Edge Function Handler
// ===================================================================== */
serve(async (req: Request) => {
  // CORS-Preflight
  if (req.method === "OPTIONS") {
    return new Response(null, {status: 204, headers: CORS_HEADERS});
  }

  // Authentifizierung: service_role oder Admin-Benutzer
  const authError = await authenticateCronRequest(req, JOB_NAME);
  if (authError) return authError;

  // Umgebungsvariablen
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    return errorResponse(JOB_NAME, "Missing Supabase config", 500);
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: {persistSession: false, autoRefreshToken: false},
  });

  // Cron-Job-Logging und Sentry starten
  let logId: string | undefined;
  let checkInId: string | null = null;

  try {
    logId = await startCronJob(supabaseAdmin, JOB_NAME);
    checkInId = await sentryCheckIn(JOB_NAME, "in_progress");
    const today = toZurichDate(new Date());

    const result = await deleteDueReceipts(supabaseAdmin, today);

    // Fehler einzelner Blöcke brechen den Lauf nicht ab; Sentry meldet sie,
    // sonst stünden sie nur im Log, wo niemand nachschaut
    if (result.errors.length > 0) {
      await sentryCaptureError(
        new Error(
          `${result.errors.length} Block-Fehler: ${result.errors.join("; ")}`,
        ),
        JOB_NAME,
      );
    }

    await completeCronJob(supabaseAdmin, logId, result.clearedExpenses, result);
    await sentryCheckIn(JOB_NAME, "ok", checkInId);

    console.log(
      `${JOB_NAME}: ${result.clearedExpenses} Belege gelöscht ` +
        `(fällig ${result.requested}, Dateien ${result.removed})`,
    );

    return successResponse(result);
  } catch (err) {
    console.error(`${JOB_NAME} error:`, err);
    await sentryCaptureError(err, JOB_NAME);

    if (logId) {
      await failCronJob(supabaseAdmin, logId, String(err));
    }
    await sentryCheckIn(JOB_NAME, "error", checkInId);

    return new Response(
      JSON.stringify({error: "Ein interner Fehler ist aufgetreten."}),
      {
        status: 500,
        headers: {...CORS_HEADERS, "Content-Type": "application/json"},
      },
    );
  }
});

/* =====================================================================
// Belege löschen
// ===================================================================== */
/**
 * Löscht alle fälligen Belege: lädt die Ausgaben mit Beleg und das
 * Anlassende, filtert mit `selectDueReceipts` und löscht blockweise
 * nacheinander, damit Storage und Datenbank nicht hunderte Anfragen
 * gleichzeitig bekommen.
 *
 * @param client - Admin-Client (Service Role).
 * @param today - Heutiges Datum in Zürich als `YYYY-MM-DD`.
 * @returns Zähler und Fehler der Blöcke.
 * @throws Error, wenn Ausgaben oder Anlassdaten nicht geladen werden können;
 *   dann wird nichts gelöscht.
 */
async function deleteDueReceipts(
  client: SupabaseClient,
  today: string,
): Promise<DeletionResult> {
  const receipts = await loadReceipts(client);
  const eventIds = [...new Set(receipts.map((receipt) => receipt.event_id))];
  const eventEndDates = await loadEventEndDates(client, eventIds);
  const dueReceipts = selectDueReceipts(receipts, eventEndDates, today);

  const result: DeletionResult = {
    requested: dueReceipts.length,
    removed: 0,
    clearedExpenses: 0,
    errors: [],
  };
  for (const block of chunkArray(dueReceipts, BLOCK_SIZE)) {
    await deleteReceiptBlock(client, block, result);
  }
  return result;
}

/**
 * Lädt alle Ausgaben mit Beleg, über alle Anlässe.
 *
 * @param client - Admin-Client (Service Role), sieht alle Anlässe.
 * @returns Ausgaben mit ID, Anlass und Belegpfad.
 * @throws Error, wenn die Abfrage fehlschlägt (aus `fetchAllRows`).
 */
async function loadReceipts(client: SupabaseClient): Promise<ReceiptPathRow[]> {
  return await fetchAllRows<ReceiptPathRow>(
    client,
    "event_expenses",
    "id, event_id, attachment_path",
    // stabile Reihenfolge, sonst kann PostgREST beim Blättern Zeilen
    // doppelt liefern oder überspringen
    (query) => query.not("attachment_path", "is", null).order("id"),
  );
}

/**
 * Lädt das Anlassende der angegebenen Anlässe.
 *
 * @param client - Admin-Client (Service Role).
 * @param eventIds - IDs der Anlässe mit Beleg, ohne Doppelte.
 * @returns Map von Anlass-ID auf Anlassende als `YYYY-MM-DD`. Anlässe ohne
 *   `event_dates` fehlen darin.
 * @throws Error, wenn eine Abfrage fehlschlägt.
 */
async function loadEventEndDates(
  client: SupabaseClient,
  eventIds: string[],
): Promise<Map<string, string>> {
  const eventDates: EventDateRow[] = [];

  for (const eventIdBlock of chunkArray(eventIds, BLOCK_SIZE)) {
    const {data, error} = await client
      .from("event_dates")
      .select("event_id, date_to")
      .in("event_id", eventIdBlock);
    if (error) {
      throw new Error(`event_dates laden fehlgeschlagen: ${error.message}`);
    }
    eventDates.push(...((data ?? []) as EventDateRow[]));
  }

  return getEventEndDates(eventDates);
}

/**
 * Löscht einen Block fälliger Belege: zuerst die Dateien im Storage, nur
 * bei Erfolg danach die Belegspalten der Ausgaben. Schlägt ein Schritt
 * fehl, steht der Fehler in `result.errors`, und der nächste Lauf versucht
 * den Block wieder.
 *
 * @param client - Admin-Client (Service Role).
 * @param block - Höchstens `BLOCK_SIZE` fällige Belege.
 * @param result - Gesamtergebnis des Laufs, wird ergänzt.
 */
async function deleteReceiptBlock(
  client: SupabaseClient,
  block: ReceiptPathRow[],
  result: DeletionResult,
): Promise<void> {
  const {data: removedFiles, error: removeError} = await client.storage
    .from("media")
    .remove(block.map((receipt) => toStoragePath(receipt.attachment_path)));

  if (removeError) {
    result.errors.push(`Storage: ${removeError.message}`);
    return;
  }
  result.removed += removedFiles?.length ?? 0;

  const {error: updateError} = await client
    .from("event_expenses")
    .update({attachment_path: null, attachment_original_filename: null})
    .in(
      "id",
      block.map((receipt) => receipt.id),
    );
  if (updateError) {
    result.errors.push(`event_expenses: ${updateError.message}`);
    return;
  }
  result.clearedExpenses += block.length;
}
