/**
 * CronJobLogRepository — Repository für die Cron-Job-Ausführungshistorie.
 *
 * Liest die `cron_job_log`-Tabelle, die von geplanten Jobs (Phase 14)
 * befüllt wird. Dient dem Monitoring im Admin-Bereich.
 *
 * @example
 * const logs = await cronJobLog.getAll();
 */
import {SupabaseClient} from "@supabase/supabase-js";
import {supabase} from "../supabaseClient";

/* ===================================================================
// ======================== Domain-Typen =============================
// =================================================================== */

/**
 * Domain-Typ für einen Cron-Job-Log-Eintrag.
 *
 * @param id Eindeutige ID des Log-Eintrags.
 * @param jobName Name des Jobs (z.B. "dailySummary").
 * @param startedAt Startzeitpunkt.
 * @param finishedAt Endzeitpunkt (null wenn noch laufend).
 * @param status Status: 'running', 'success' oder 'error'.
 * @param durationMs Dauer in Millisekunden.
 * @param recordsProcessed Anzahl verarbeiteter Datensätze.
 * @param errorMessage Fehlermeldung bei Status 'error'.
 * @param details Zusätzliche Details als JSON.
 */
export type CronJobLogDomain = {
  id: string;
  jobName: string;
  startedAt: Date;
  finishedAt: Date | null;
  status: "running" | "success" | "error";
  durationMs: number | null;
  recordsProcessed: number;
  errorMessage: string | null;
  details: Record<string, unknown> | null;
};

/** Datenbank-Zeile (snake_case). */
type CronJobLogRow = {
  id: string;
  job_name: string;
  started_at: string;
  finished_at: string | null;
  status: string;
  duration_ms: number | null;
  records_processed: number;
  error_message: string | null;
  details: Record<string, unknown> | null;
};

/* ===================================================================
// ======================== Repository ===============================
// =================================================================== */

/**
 * Repository für Cron-Job-Log-Einträge.
 */
export class CronJobLogRepository {
  /** Explizite Spaltenliste — verhindert versehentliches Leaken neuer Spalten. */
  private static readonly COLUMNS = [
    "id", "job_name", "started_at", "finished_at", "status",
    "duration_ms", "records_processed", "error_message", "details",
  ].join(", ");

  private client: SupabaseClient;

  constructor(client: SupabaseClient = supabase) {
    this.client = client;
  }

  /**
   * Lädt alle Log-Einträge, sortiert nach Startzeit (neueste zuerst).
   *
   * @param limit Maximale Anzahl zurückgegebener Einträge.
   * @returns Array von CronJobLogDomain-Objekten.
   */
  async getAll(limit: number = 100): Promise<CronJobLogDomain[]> {
    const {data, error} = await this.client
      .from("cron_job_log")
      .select(CronJobLogRepository.COLUMNS)
      .order("started_at", {ascending: false})
      .limit(limit);

    if (error) throw new Error(error.message);
    return (data as unknown as CronJobLogRow[]).map(this.toDomain);
  }

  /**
   * Lädt Log-Einträge für einen bestimmten Job.
   *
   * @param jobName Name des Jobs.
   * @param limit Maximale Anzahl.
   * @returns Gefilterte Log-Einträge.
   */
  async getByJobName(jobName: string, limit: number = 50): Promise<CronJobLogDomain[]> {
    const {data, error} = await this.client
      .from("cron_job_log")
      .select(CronJobLogRepository.COLUMNS)
      .eq("job_name", jobName)
      .order("started_at", {ascending: false})
      .limit(limit);

    if (error) throw new Error(error.message);
    return (data as unknown as CronJobLogRow[]).map(this.toDomain);
  }

  /**
   * Konvertiert eine DB-Zeile in ein Domain-Objekt.
   *
   * @param row Datenbank-Zeile.
   * @returns Domain-Objekt.
   */
  private toDomain(row: CronJobLogRow): CronJobLogDomain {
    return {
      id: row.id,
      jobName: row.job_name,
      startedAt: new Date(row.started_at),
      finishedAt: row.finished_at ? new Date(row.finished_at) : null,
      status: row.status as CronJobLogDomain["status"],
      durationMs: row.duration_ms,
      recordsProcessed: row.records_processed,
      errorMessage: row.error_message,
      details: row.details,
    };
  }
}
