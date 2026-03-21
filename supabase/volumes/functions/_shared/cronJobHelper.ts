/**
 * Gemeinsamer Hilfsmodul für alle Cron-Job Edge Functions.
 *
 * Stellt Funktionen zum Loggen von Cron-Job-Ausführungen in die
 * `cron_job_log`-Tabelle bereit sowie Sentry Crons-Integration
 * für externes Monitoring.
 *
 * @example
 * import { startCronJob, completeCronJob, failCronJob, sentryCheckIn } from "../_shared/cronJobHelper.ts";
 * const logId = await startCronJob(supabaseAdmin, "cron-daily-digest");
 * const checkInId = await sentryCheckIn("cron-daily-digest", "in_progress");
 */

/* =====================================================================
// Typen
// ===================================================================== */

/**
 * Supabase-Admin-Client-Interface (minimale Abstraktion für Testbarkeit).
 *
 * @param from Gibt einen Query-Builder für die angegebene Tabelle zurück.
 */
interface SupabaseAdminClient {
  from(table: string): {
    insert(values: Record<string, unknown>): {
      select(columns: string): {
        single(): Promise<{
          data: Record<string, unknown> | null;
          error: {message: string} | null;
        }>;
      };
    };
    update(values: Record<string, unknown>): {
      eq(
        column: string,
        value: string
      ): Promise<{error: {message: string} | null}>;
    };
  };
}

/**
 * Sentry-Crons-Status-Werte.
 *
 * @param in_progress Job läuft gerade.
 * @param ok Job erfolgreich beendet.
 * @param error Job mit Fehler beendet.
 */
type SentryCheckInStatus = "in_progress" | "ok" | "error";

/* =====================================================================
// Cron-Job-Logging (cron_job_log Tabelle)
// ===================================================================== */

/**
 * Startet einen neuen Cron-Job-Log-Eintrag mit Status 'running'.
 *
 * @param supabaseAdmin Admin-Client (Service Role, umgeht RLS).
 * @param jobName Name des Jobs (z.B. "cron-daily-digest").
 * @returns ID des erstellten Log-Eintrags.
 * @throws Error wenn das INSERT fehlschlägt.
 */
export async function startCronJob(
  supabaseAdmin: SupabaseAdminClient,
  jobName: string
): Promise<string> {
  const {data, error} = await supabaseAdmin
    .from("cron_job_log")
    .insert({job_name: jobName, status: "running"})
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(
      `Cron-Job-Log konnte nicht erstellt werden: ${error?.message ?? "Keine Daten"}`
    );
  }

  return data.id as string;
}

/**
 * Markiert einen Cron-Job-Log-Eintrag als erfolgreich abgeschlossen.
 *
 * @param supabaseAdmin Admin-Client (Service Role).
 * @param logId ID des Log-Eintrags.
 * @param recordsProcessed Anzahl verarbeiteter Datensätze.
 * @param details Optionale JSONB-Details.
 */
export async function completeCronJob(
  supabaseAdmin: SupabaseAdminClient,
  logId: string,
  recordsProcessed: number,
  details?: Record<string, unknown>
): Promise<void> {
  const now = new Date().toISOString();
  const {error} = await supabaseAdmin
    .from("cron_job_log")
    .update({
      status: "success",
      finished_at: now,
      duration_ms: null, // Wird unten separat berechnet
      records_processed: recordsProcessed,
      ...(details ? {details} : {}),
    })
    .eq("id", logId);

  if (error) {
    console.error(`Cron-Job-Log (complete) Fehler: ${error.message}`);
  }

  // Dauer via SQL berechnen (started_at ist Server-seitig gesetzt)
  await updateDuration(supabaseAdmin, logId, now);
}

/**
 * Markiert einen Cron-Job-Log-Eintrag als fehlgeschlagen.
 *
 * @param supabaseAdmin Admin-Client (Service Role).
 * @param logId ID des Log-Eintrags.
 * @param errorMessage Fehlermeldung.
 * @param details Optionale JSONB-Details.
 */
export async function failCronJob(
  supabaseAdmin: SupabaseAdminClient,
  logId: string,
  errorMessage: string,
  details?: Record<string, unknown>
): Promise<void> {
  const now = new Date().toISOString();
  const {error} = await supabaseAdmin
    .from("cron_job_log")
    .update({
      status: "error",
      finished_at: now,
      error_message: errorMessage,
      ...(details ? {details} : {}),
    })
    .eq("id", logId);

  if (error) {
    console.error(`Cron-Job-Log (fail) Fehler: ${error.message}`);
  }

  await updateDuration(supabaseAdmin, logId, now);
}

/**
 * Berechnet und speichert die Dauer in Millisekunden.
 * Liest `started_at` und berechnet die Differenz zu `finishedAt`.
 *
 * @param supabaseAdmin Admin-Client.
 * @param logId ID des Log-Eintrags.
 * @param finishedAt ISO-Timestamp des Endzeitpunkts.
 */
async function updateDuration(
  supabaseAdmin: SupabaseAdminClient,
  logId: string,
  finishedAt: string
): Promise<void> {
  // Da wir keinen direkten SQL-Zugriff haben, berechnen wir die Dauer
  // basierend auf started_at (beim INSERT gesetzt) und finished_at
  const {data} = await (supabaseAdmin as unknown as {
    from(table: string): {
      select(columns: string): {
        eq(column: string, value: string): {
          single(): Promise<{data: {started_at: string} | null; error: unknown}>;
        };
      };
    };
  })
    .from("cron_job_log")
    .select("started_at")
    .eq("id", logId)
    .single();

  if (data?.started_at) {
    const durationMs = new Date(finishedAt).getTime() - new Date(data.started_at).getTime();
    await supabaseAdmin
      .from("cron_job_log")
      .update({duration_ms: durationMs})
      .eq("id", logId);
  }
}

/* =====================================================================
// Sentry Crons Integration
// ===================================================================== */

/**
 * Sendet einen Check-In an Sentry Crons via HTTP API.
 *
 * Verwendet die Sentry DSN, um Projekt-ID und Public Key zu extrahieren,
 * und sendet an den Sentry Crons-Endpoint. Deno-kompatibel (kein SDK nötig).
 *
 * @param monitorSlug Slug des Cron-Monitors in Sentry (z.B. "cron-daily-digest").
 * @param status Status des Check-Ins: "in_progress", "ok" oder "error".
 * @param checkInId Optionale Check-In-ID für Updates (von einem vorherigen in_progress).
 * @returns Check-In-ID (für spätere Updates) oder null bei Fehler.
 *
 * @example
 * const checkInId = await sentryCheckIn("cron-daily-digest", "in_progress");
 * // ... Job-Logik ...
 * await sentryCheckIn("cron-daily-digest", "ok", checkInId);
 */
export async function sentryCheckIn(
  monitorSlug: string,
  status: SentryCheckInStatus,
  checkInId?: string | null
): Promise<string | null> {
  const sentryDsn = Deno.env.get("SENTRY_DSN");
  if (!sentryDsn) {
    console.warn("SENTRY_DSN nicht gesetzt — Sentry Crons Check-In übersprungen");
    return null;
  }

  try {
    const dsnUrl = new URL(sentryDsn);
    const publicKey = dsnUrl.username;
    const projectId = dsnUrl.pathname.replace("/", "");
    const host = dsnUrl.hostname;

    // Sentry Crons HTTP API
    const url = `https://${host}/api/${projectId}/cron/${monitorSlug}/${checkInId ?? ""}`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `DSN ${sentryDsn}`,
        "X-Sentry-Auth": `Sentry sentry_key=${publicKey}, sentry_version=7`,
      },
      body: JSON.stringify({status}),
    });

    if (!response.ok) {
      const body = await response.text();
      console.error(`Sentry Crons Check-In fehlgeschlagen (${response.status}): ${body}`);
      return null;
    }

    const result = await response.json();
    return result.id ?? checkInId ?? null;
  } catch (err) {
    console.error("Sentry Crons Check-In Fehler:", err);
    return null;
  }
}
