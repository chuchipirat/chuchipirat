/**
 * Edge Function: cron-housekeeping
 *
 * Bereinigt alte Daten aus verschiedenen Tabellen, um die Datenbankgrösse
 * und Performance langfristig stabil zu halten.
 *
 * Zeitplan: Wöchentlich, Sonntag um 03:00 UTC (04:00/05:00 Zürich)
 *
 * Aufräumarbeiten:
 *   - Feeds älter als 12 Monate
 *   - Cron-Job-Logs älter als 90 Tage
 *   - Mail-Logs älter als 90 Tage
 *   - pg_cron Ausführungshistorie älter als 90 Tage
 *   - Abgebrochene/fehlgeschlagene Spenden älter als 90 Tage
 *   - Ausstehende Spenden älter als 7 Tage (nie abgeschlossen)
 *   - Abgelaufene Systemmeldungen älter als 30 Tage
 *
 * Erfordert die Umgebungsvariablen:
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *   SENTRY_DSN (optional, für Sentry Crons Monitoring)
 */
import {serve} from "https://deno.land/std@0.177.1/http/server.ts";
import {createClient, SupabaseClient} from "https://esm.sh/@supabase/supabase-js@2";
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

/* =====================================================================
// Konstanten
// ===================================================================== */

const JOB_NAME = "cron-housekeeping";

/* =====================================================================
// Aufräumfunktionen
// ===================================================================== */

/**
 * Ergebnis einer einzelnen Aufräumaktion.
 */
interface CleanupResult {
  task: string;
  deleted: number;
  error?: string;
}

/**
 * Löscht Zeilen aus einer Tabelle, die älter sind als der angegebene Zeitraum.
 *
 * @param client Supabase-Admin-Client
 * @param table Tabellenname
 * @param column Datumsspalte (z.B. "created_at")
 * @param cutoffDate ISO-Datums-String (alles davor wird gelöscht)
 * @param extraFilter Optionale zusätzliche Filter (z.B. Status)
 * @returns Anzahl gelöschter Zeilen
 */
async function cleanupTable(
  client: SupabaseClient,
  table: string,
  column: string,
  cutoffDate: string,
  extraFilter?: (query: ReturnType<SupabaseClient["from"]>) => unknown,
): Promise<number> {
  let query = client.from(table).delete().lt(column, cutoffDate);
  if (extraFilter) {
    query = extraFilter(query) as typeof query;
  }

  // count: "exact" gibt die Anzahl gelöschter Zeilen zurück
  const {count, error} = await query.select("id", {count: "exact", head: true});

  // Nochmal ohne select — tatsächlich löschen
  let deleteQuery = client.from(table).delete().lt(column, cutoffDate);
  if (extraFilter) {
    deleteQuery = extraFilter(deleteQuery) as typeof deleteQuery;
  }
  const {error: deleteError} = await deleteQuery;

  if (error || deleteError) {
    throw new Error(`${table}: ${(error ?? deleteError)!.message}`);
  }

  return count ?? 0;
}

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

    // Cutoff-Daten berechnen
    const now = new Date();
    const days7Ago = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const days90Ago = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString();
    const days30Ago = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const months12Ago = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000).toISOString();

    const results: CleanupResult[] = [];

    // 1. Alte Feeds löschen (> 12 Monate)
    try {
      const deleted = await cleanupTable(supabaseAdmin, "feeds", "created_at", months12Ago);
      results.push({task: "feeds (> 12 Monate)", deleted});
    } catch (err) {
      results.push({task: "feeds", deleted: 0, error: String(err)});
    }

    // 2. Alte Cron-Job-Logs löschen (> 90 Tage)
    try {
      const deleted = await cleanupTable(supabaseAdmin, "cron_job_log", "started_at", days90Ago);
      results.push({task: "cron_job_log (> 90 Tage)", deleted});
    } catch (err) {
      results.push({task: "cron_job_log", deleted: 0, error: String(err)});
    }

    // 3. Alte Mail-Logs löschen (> 90 Tage)
    try {
      const deleted = await cleanupTable(supabaseAdmin, "mail_log", "created_at", days90Ago);
      results.push({task: "mail_log (> 90 Tage)", deleted});
    } catch (err) {
      results.push({task: "mail_log", deleted: 0, error: String(err)});
    }

    // 4. pg_cron Ausführungshistorie löschen (> 90 Tage)
    try {
      const {error} = await supabaseAdmin.rpc("cleanup_cron_job_run_details", {
        cutoff: days90Ago,
      });
      if (error) {
        // RPC existiert möglicherweise nicht — via SQL direkt
        const {count} = await supabaseAdmin
          .from("cron.job_run_details" as string)
          .delete()
          .lt("start_time", days90Ago)
          .select("*", {count: "exact", head: true});
        results.push({task: "cron.job_run_details (> 90 Tage)", deleted: count ?? 0});
      } else {
        results.push({task: "cron.job_run_details (> 90 Tage)", deleted: -1});
      }
    } catch (err) {
      // pg_cron interne Tabelle — nicht über PostgREST erreichbar, überspringen
      results.push({task: "cron.job_run_details", deleted: 0, error: "Nicht via PostgREST erreichbar — manuell bereinigen"});
    }

    // 5. Ausstehende Spenden löschen (pending > 7 Tage — nie abgeschlossen)
    try {
      const deleted = await cleanupTable(
        supabaseAdmin, "donations", "created_at", days7Ago,
        (query) => query.eq("status", "pending"),
      );
      results.push({task: "donations pending (> 7 Tage)", deleted});
    } catch (err) {
      results.push({task: "donations pending", deleted: 0, error: String(err)});
    }

    // 6. Fehlgeschlagene/abgebrochene Spenden löschen (> 90 Tage)
    try {
      const deleted = await cleanupTable(
        supabaseAdmin, "donations", "created_at", days90Ago,
        (query) => query.in("status", ["failed", "cancelled"]),
      );
      results.push({task: "donations failed/cancelled (> 90 Tage)", deleted});
    } catch (err) {
      results.push({task: "donations failed/cancelled", deleted: 0, error: String(err)});
    }

    // 7. Abgelaufene Systemmeldungen löschen (valid_to > 30 Tage her)
    try {
      const deleted = await cleanupTable(supabaseAdmin, "system_messages", "valid_to", days30Ago);
      results.push({task: "system_messages abgelaufen (> 30 Tage)", deleted});
    } catch (err) {
      results.push({task: "system_messages", deleted: 0, error: String(err)});
    }

    // Zusammenfassung
    const totalDeleted = results.reduce((sum, result) => sum + Math.max(0, result.deleted), 0);
    const errors = results.filter((result) => result.error);

    await completeCronJob(supabaseAdmin, logId, totalDeleted, {
      results,
      totalDeleted,
      errors: errors.length > 0 ? errors : undefined,
    });
    await sentryCheckIn(JOB_NAME, "ok", checkInId);

    console.log(
      `${JOB_NAME}: ${totalDeleted} Einträge bereinigt — ` +
      results.map((result) => `${result.task}: ${result.deleted}`).join(", "),
    );

    return successResponse({totalDeleted, results});
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
