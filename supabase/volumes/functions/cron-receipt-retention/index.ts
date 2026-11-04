/**
 * Edge Function: cron-receipt-retention
 *
 * Erinnert 30 Tage vor dem Löschen per Mail an die Belege und löscht sie ein
 * Jahr nach Anlassende: die Datei im Storage und danach die Belegspalten der
 * Ausgabe. Die Ausgabe selbst bleibt. Ein verpasster Lauf holt das Löschen
 * beim nächsten nach, die Erinnerung nicht. Was fällig ist und wer die Mail
 * bekommt, entscheiden die getesteten Funktionen in
 * `_shared/receiptRetention.ts`.
 *
 * Zeitplan: Täglich um 01:30 UTC (02:30/03:30 Zürich)
 *
 * Erfordert die Umgebungsvariablen:
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *   SITE_URL (z.B. "https://chuchipirat.ch")
 *   BREVO_API_KEY (Produktion) oder SMTP_HOST/SMTP_PORT (lokal)
 *   SENTRY_DSN (optional, für Sentry Crons Monitoring)
 */
import {serve} from "https://deno.land/std@0.177.1/http/server.ts";
import {
  createClient,
  SupabaseClient,
} from "https://esm.sh/@supabase/supabase-js@2";
import {
  CORS_HEADERS,
  EmailEnv,
  errorResponse,
  isEmailConfigured,
  readEmailEnv,
  sendEmail,
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
  buildReminderGreeting,
  buildReminderSubject,
  buildReminderText,
  EventDateRow,
  formatReceiptCount,
  formatSwissDate,
  getDeletionDate,
  getEventEndDates,
  getExpenseTrackingUrl,
  ReceiptPathRow,
  RECEIPT_BUCKET,
  ReceiptRow,
  isValidReceiptPath,
  removeEmailAddresses,
  selectDueReceipts,
  selectReminderEventIds,
  selectReminderRecipients,
  toStoragePath,
  toZurichDate,
} from "../_shared/receiptRetention.ts";
import {fetchAllRows} from "../_shared/fetchAllRows.ts";
import {chunkArray} from "../_shared/chunkArray.ts";
import {renderEmailTemplate} from "../_shared/templateRenderer.ts";

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

/**
 * Empfänger:in einer Erinnerungsmail.
 *
 * @param id - User-ID.
 * @param email - Adresse, an die die Mail geht.
 * @param display_name - Name für die Anrede.
 */
type ReminderUser = {
  id: string;
  email: string;
  display_name: string;
};

/**
 * Ergebnis des Erinnerungsversands, landet in `cron_job_log`.
 *
 * @param remindedEvents - IDs der Anlässe, deren Versand durchgelaufen ist;
 *   einzelne Mails können trotzdem fehlgeschlagen sein.
 * @param emailsSent - Tatsächlich versendete Mails.
 * @param errors - Fehler pro Anlass oder Mail; ohne Mailadressen, weil sie
 *   in Sentry und `cron_job_log` landen.
 */
type ReminderResult = {
  remindedEvents: string[];
  emailsSent: number;
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
  const appUrl = Deno.env.get("SITE_URL") ?? "https://chuchipirat.ch";
  const emailEnv = readEmailEnv();

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

    const receipts = await loadReceipts(supabaseAdmin);
    const eventIds = [...new Set(receipts.map((receipt) => receipt.event_id))];
    const eventEndDates = await loadEventEndDates(supabaseAdmin, eventIds);

    // Erinnern und Löschen sind unabhängig: Ein kaputter Mailversand darf
    // das Löschen nicht verhindern
    const reminders: ReminderResult = isEmailConfigured(emailEnv)
      ? await sendReminders(
          supabaseAdmin,
          emailEnv,
          receipts,
          eventEndDates,
          today,
          appUrl,
        )
      : {
          remindedEvents: [],
          emailsSent: 0,
          errors: ["Kein Mailversand eingerichtet"],
        };

    const result = await deleteDueReceipts(
      supabaseAdmin,
      receipts,
      eventEndDates,
      today,
    );

    // Einzelne Fehler brechen den Lauf nicht ab; Sentry meldet sie, sonst
    // stünden sie nur im Log, wo niemand nachschaut
    const errors = [...reminders.errors, ...result.errors];
    if (errors.length > 0) {
      await sentryCaptureError(
        new Error(`${errors.length} Fehler: ${errors.join("; ")}`),
        JOB_NAME,
      );
    }

    const summary = {
      ...result,
      remindedEvents: reminders.remindedEvents,
      emailsSent: reminders.emailsSent,
      errors,
    };
    await completeCronJob(
      supabaseAdmin,
      logId,
      result.clearedExpenses,
      summary,
    );
    await sentryCheckIn(JOB_NAME, "ok", checkInId);

    console.log(
      `${JOB_NAME}: ${result.clearedExpenses} Belege gelöscht ` +
        `(fällig ${result.requested}, Dateien ${result.removed}), ` +
        `${reminders.emailsSent} Erinnerungen`,
    );

    return successResponse(summary);
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
 * Löscht alle fälligen Belege: filtert mit `selectDueReceipts` und löscht
 * blockweise nacheinander, damit Storage und Datenbank nicht hunderte
 * Anfragen gleichzeitig bekommen. Belege mit fremdem Pfad bleiben unangetastet
 * und stehen ohne den Pfad in `errors`: Die Service Role umgeht die
 * Storage-Regeln, ein manipulierter Pfad könnte sonst fremde Dateien löschen.
 *
 * @param client - Admin-Client (Service Role).
 * @param receipts - Alle Ausgaben mit Beleg.
 * @param eventEndDates - Map von Anlass-ID auf Anlassende als `YYYY-MM-DD`.
 * @param today - Heutiges Datum in Zürich als `YYYY-MM-DD`.
 * @returns Zähler und Fehler der Blöcke.
 */
async function deleteDueReceipts(
  client: SupabaseClient,
  receipts: ReceiptRow[],
  eventEndDates: Map<string, string>,
  today: string,
): Promise<DeletionResult> {
  const dueReceipts = selectDueReceipts(receipts, eventEndDates, today);
  const validReceipts = dueReceipts.filter(isValidReceiptPath);

  const result: DeletionResult = {
    requested: dueReceipts.length,
    removed: 0,
    clearedExpenses: 0,
    errors: dueReceipts
      .filter((receipt) => !isValidReceiptPath(receipt))
      .map((receipt) => `Ungültiger Belegpfad bei Ausgabe ${receipt.id}`),
  };
  for (const block of chunkArray(validReceipts, BLOCK_SIZE)) {
    await deleteReceiptBlock(client, block, result);
  }
  return result;
}

/**
 * Lädt alle Ausgaben mit Beleg, über alle Anlässe.
 *
 * @param client - Admin-Client (Service Role), sieht alle Anlässe.
 * @returns Ausgaben mit ID, Anlass, Belegpfad und zahlender Person.
 * @throws Error, wenn die Abfrage fehlschlägt (aus `fetchAllRows`).
 */
async function loadReceipts(client: SupabaseClient): Promise<ReceiptRow[]> {
  return await fetchAllRows<ReceiptRow>(
    client,
    "event_expenses",
    "id, event_id, attachment_path, payee_type, payee_user_id",
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
 * Lädt die aktuellen Köch:innen eines Anlasses. Ehemalige stehen nicht mehr
 * in `event_cooks`. Ohne Blättern, weil ein Anlass nie an die 1000 Zeilen
 * von PostgREST herankommt.
 *
 * @param client - Admin-Client (Service Role).
 * @param eventId - ID des Anlasses.
 * @returns User-IDs der Köch:innen.
 * @throws Error, wenn die Abfrage fehlschlägt.
 */
async function loadCookIds(
  client: SupabaseClient,
  eventId: string,
): Promise<string[]> {
  const {data, error} = await client
    .from("event_cooks")
    .select("user_id")
    .eq("event_id", eventId);

  if (error) {
    throw new Error(`event_cooks laden fehlgeschlagen: ${error.message}`);
  }
  return (data ?? []).map((cook: {user_id: string}) => cook.user_id);
}

/**
 * Lädt Adresse und Namen der angegebenen Personen. Zwei Abfragen statt
 * eines Joins, weil `event_cooks.user_id` auf `auth.users` verweist und
 * PostgREST sonst die falsche Tabelle verbinden würde.
 *
 * @param client - Admin-Client (Service Role).
 * @param userIds - IDs der Empfänger:innen eines Anlasses.
 * @returns Gefundene Personen; IDs ohne Eintrag in `users` fehlen darin.
 * @throws Error, wenn die Abfrage fehlschlägt.
 */
async function loadUsers(
  client: SupabaseClient,
  userIds: string[],
): Promise<ReminderUser[]> {
  const {data, error} = await client
    .from("users")
    .select("id, email, display_name")
    .in("id", userIds);

  if (error) {
    throw new Error(`users laden fehlgeschlagen: ${error.message}`);
  }
  return (data ?? []) as ReminderUser[];
}

/**
 * Baut die Erinnerungsmail für eine Person (Betreff, HTML und Text),
 * verschickt sie und schreibt sie ins `mail_log`. Einen Fehlversand wirft sie
 * nach dem Logeintrag weiter: Die aufrufende Schleife sammelt ihn, damit die
 * übrigen Mails trotzdem rausgehen.
 *
 * @param client - Admin-Client (Service Role).
 * @param emailEnv - E-Mail-Umgebungsvariablen.
 * @param recipient - Empfänger:in der Mail.
 * @param eventId - ID des Anlasses, für das Log.
 * @param eventName - Name des Anlasses.
 * @param deletionDate - Löschdatum als `YYYY-MM-DD`.
 * @param receiptCount - Anzahl gespeicherter Belege des Anlasses.
 * @param url - Link auf den Tab «Abrechnung» des Anlasses.
 * @throws Error, wenn der Versand oder der Logeintrag fehlschlägt.
 */
async function sendReminderMail(
  client: SupabaseClient,
  emailEnv: EmailEnv,
  recipient: ReminderUser,
  eventId: string,
  eventName: string,
  deletionDate: string,
  receiptCount: number,
  url: string,
): Promise<void> {
  const recipientName = recipient.display_name;
  const subject = buildReminderSubject(eventName, deletionDate);
  const deletionDateText = formatSwissDate(deletionDate);
  const greetingLine = buildReminderGreeting(recipient.display_name);

  const html = renderEmailTemplate("receipt-retention-reminder", {
    subject,
    greetingLine,
    eventName,
    receiptCountText: formatReceiptCount(receiptCount),
    deletionDateText,
    url,
    preheaderText: `Am ${deletionDateText} werden die Belege gelöscht.`,
  });
  const text = buildReminderText({
    recipientName,
    eventName,
    deletionDate,
    receiptCount,
    url,
  });

  // Auch ein Fehlversand gehört ins Log, darum erst danach weiterwerfen
  let errorMessage: string | null = null;
  try {
    await sendEmail(emailEnv, recipient.email, subject, html, text);
  } catch (error) {
    errorMessage = removeEmailAddresses(String(error));
  }

  await logReminderMail(
    client,
    recipient,
    subject,
    html,
    {eventId, eventName, deletionDate, receiptCount},
    errorMessage,
  );

  if (errorMessage) {
    throw new Error(errorMessage);
  }
}

/**
 * Lädt den Namen eines Anlasses für Betreff und Mailtext.
 *
 * @param client - Admin-Client (Service Role).
 * @param eventId - ID des Anlasses.
 * @returns Name des Anlasses.
 * @throws Error, wenn die Abfrage fehlschlägt oder der Anlass fehlt.
 */
async function loadEventName(
  client: SupabaseClient,
  eventId: string,
): Promise<string> {
  const {data, error} = await client
    .from("events")
    .select("name")
    .eq("id", eventId)
    .single();

  if (error) {
    throw new Error(`events laden fehlgeschlagen: ${error.message}`);
  }
  return data.name as string;
}

/**
 * Erinnert die Empfänger:innen eines Anlasses. Jede Mail hat ein eigenes
 * `try/catch`, damit eine ungültige Adresse die übrigen Mails nicht stoppt.
 *
 * @param client - Admin-Client (Service Role).
 * @param emailEnv - E-Mail-Umgebungsvariablen.
 * @param eventId - ID des Anlasses.
 * @param eventReceipts - Alle Ausgaben mit Beleg dieses Anlasses.
 * @param eventEnd - Anlassende als `YYYY-MM-DD`.
 * @param appUrl - Basis-URL der App.
 * @param result - Gesamtergebnis des Laufs, wird ergänzt.
 * @throws Error, wenn Anlass, Köch:innen oder Personen nicht geladen werden
 *   können.
 */
async function remindEvent(
  client: SupabaseClient,
  emailEnv: EmailEnv,
  eventId: string,
  eventReceipts: ReceiptRow[],
  eventEnd: string,
  appUrl: string,
  result: ReminderResult,
): Promise<void> {
  const eventName = await loadEventName(client, eventId);
  const cookIds = await loadCookIds(client, eventId);
  const recipientIds = selectReminderRecipients(eventReceipts, cookIds);
  const recipients = await loadUsers(client, recipientIds);
  const url = getExpenseTrackingUrl(appUrl, eventId);

  for (const recipient of recipients) {
    try {
      await sendReminderMail(
        client,
        emailEnv,
        recipient,
        eventId,
        eventName,
        getDeletionDate(eventEnd),
        eventReceipts.length,
        url,
      );
      result.emailsSent++;
    } catch (error) {
      result.errors.push(`Mail ${eventId}: ${String(error)}`);
    }
  }
  result.remindedEvents.push(eventId);
}

/**
 * Verschickt die Erinnerungen für alle Anlässe, deren Erinnerungsdatum heute
 * ist. Wirft nicht: Fehler stehen pro Anlass im Ergebnis, damit die übrigen
 * Anlässe und das Löschen trotzdem laufen.
 *
 * @param client - Admin-Client (Service Role).
 * @param emailEnv - E-Mail-Umgebungsvariablen.
 * @param receipts - Alle Ausgaben mit Beleg.
 * @param eventEndDates - Map von Anlass-ID auf Anlassende als `YYYY-MM-DD`.
 * @param today - Heutiges Datum in Zürich als `YYYY-MM-DD`.
 * @param appUrl - Basis-URL der App.
 * @returns Erinnerte Anlässe, Anzahl Mails und Fehler.
 */
async function sendReminders(
  client: SupabaseClient,
  emailEnv: EmailEnv,
  receipts: ReceiptRow[],
  eventEndDates: Map<string, string>,
  today: string,
  appUrl: string,
): Promise<ReminderResult> {
  const result: ReminderResult = {
    remindedEvents: [],
    emailsSent: 0,
    errors: [],
  };

  for (const eventId of selectReminderEventIds(eventEndDates, today)) {
    const eventReceipts = receipts.filter(
      (receipt) => receipt.event_id === eventId,
    );
    try {
      await remindEvent(
        client,
        emailEnv,
        eventId,
        eventReceipts,
        eventEndDates.get(eventId) as string,
        appUrl,
        result,
      );
    } catch (error) {
      result.errors.push(`Anlass ${eventId}: ${String(error)}`);
    }
  }
  return result;
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
    .from(RECEIPT_BUCKET)
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

/**
 * Schreibt eine Mail ins `mail_log`, auch eine fehlgeschlagene, damit die
 * Admin-Seite zeigt, wer welche Mail zu welchem Anlass bekommen hat.
 *
 * @param client - Admin-Client (Service Role).
 * @param recipient - Empfänger:in der Mail.
 * @param subject - Betreff der Mail.
 * @param body - HTML-Inhalt der Mail.
 * @param details - Anlass, Löschdatum und Anzahl Belege.
 * @param errorMessage - Fehler beim Versand, `null` bei Erfolg.
 * @throws Error, wenn der Eintrag nicht geschrieben werden kann.
 */
async function logReminderMail(
  client: SupabaseClient,
  recipient: ReminderUser,
  subject: string,
  body: string,
  details: Record<string, unknown>,
  errorMessage: string | null,
): Promise<void> {
  const {error} = await client.from("mail_log").insert({
    recipients: [recipient.email],
    recipient_type: "email",
    subject,
    body,
    template_name: "receipt-retention-reminder",
    delivery_status: errorMessage ? "error" : "success",
    error_message: errorMessage,
    details,
  });

  if (error) {
    throw new Error(`mail_log schreiben fehlgeschlagen: ${error.message}`);
  }
}
