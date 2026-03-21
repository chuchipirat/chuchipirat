/**
 * MailLogRepository — Repository für die Mail-Versand-Historie.
 *
 * Liest die `mail_log`-Tabelle, die von der send-mail Edge Function
 * befüllt wird. Dient der Anzeige im Admin-Bereich (overviewMailbox).
 *
 * @example
 * const logs = await mailLog.getAll();
 */
import {SupabaseClient} from "@supabase/supabase-js";
import {supabase} from "../supabaseClient";

/* ===================================================================
// ======================== Domain-Typen =============================
// =================================================================== */

/**
 * Domain-Typ für einen Mail-Log-Eintrag.
 *
 * @param id Eindeutige ID des Log-Eintrags.
 * @param recipients Empfänger als JSON-Array.
 * @param recipientType Art der Empfänger: 'email', 'uid' oder 'role'.
 * @param subject Betreff der E-Mail.
 * @param body HTML-Body der E-Mail.
 * @param templateName Verwendete Vorlage.
 * @param sentAt Versandzeitpunkt.
 * @param sentBy UUID des Absenders.
 * @param deliveryStatus Status: 'pending', 'success' oder 'error'.
 * @param errorMessage Fehlermeldung bei Status 'error'.
 * @param details Zusätzliche Details als JSON.
 */
export type MailLogDomain = {
  id: string;
  recipients: string[];
  recipientType: string;
  subject: string;
  body: string;
  templateName: string | null;
  sentAt: Date;
  sentBy: string | null;
  deliveryStatus: "pending" | "success" | "error";
  errorMessage: string | null;
  details: Record<string, unknown> | null;
};

/** Datenbank-Zeile (snake_case). */
type MailLogRow = {
  id: string;
  recipients: string[];
  recipient_type: string;
  subject: string;
  body: string;
  template_name: string | null;
  sent_at: string;
  sent_by: string | null;
  delivery_status: string;
  error_message: string | null;
  details: Record<string, unknown> | null;
};

/* ===================================================================
// ======================== Repository ===============================
// =================================================================== */

/**
 * Repository für Mail-Log-Einträge.
 */
export class MailLogRepository {
  private client: SupabaseClient;

  constructor(client: SupabaseClient = supabase) {
    this.client = client;
  }

  /**
   * Lädt alle Log-Einträge, sortiert nach Versandzeitpunkt (neueste zuerst).
   *
   * @param limit Maximale Anzahl zurückgegebener Einträge.
   * @returns Array von MailLogDomain-Objekten.
   */
  async getAll(limit: number = 200): Promise<MailLogDomain[]> {
    const {data, error} = await this.client
      .from("mail_log")
      .select("*")
      .order("sent_at", {ascending: false})
      .limit(limit);

    if (error) throw new Error(error.message);
    return (data as MailLogRow[]).map(this.toDomain);
  }

  /**
   * Löscht Mail-Log-Einträge, die älter als das angegebene Datum sind.
   *
   * @param olderThan Datum, vor dem gelöscht wird.
   * @returns Anzahl gelöschter Einträge.
   */
  async deleteOlderThan(olderThan: Date): Promise<number> {
    const {data, error} = await this.client
      .from("mail_log")
      .delete()
      .lt("sent_at", olderThan.toISOString())
      .select("id");

    if (error) throw new Error(error.message);
    return data?.length ?? 0;
  }

  /**
   * Erstellt einen neuen Mail-Log-Eintrag.
   *
   * @param entry Zu speichernder Eintrag (ohne id und sentAt).
   * @returns Erstellter Eintrag.
   */
  async create(entry: Omit<MailLogDomain, "id" | "sentAt" | "sentBy">): Promise<MailLogDomain> {
    const {data, error} = await this.client
      .from("mail_log")
      .insert({
        recipients: entry.recipients,
        recipient_type: entry.recipientType,
        subject: entry.subject,
        body: entry.body,
        template_name: entry.templateName,
        delivery_status: entry.deliveryStatus,
        error_message: entry.errorMessage,
        details: entry.details,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return this.toDomain(data as MailLogRow);
  }

  /**
   * Konvertiert eine DB-Zeile in ein Domain-Objekt.
   *
   * @param row Datenbank-Zeile.
   * @returns Domain-Objekt.
   */
  private toDomain(row: MailLogRow): MailLogDomain {
    return {
      id: row.id,
      recipients: row.recipients ?? [],
      recipientType: row.recipient_type,
      subject: row.subject,
      body: row.body,
      templateName: row.template_name,
      sentAt: new Date(row.sent_at),
      sentBy: row.sent_by,
      deliveryStatus: row.delivery_status as MailLogDomain["deliveryStatus"],
      errorMessage: row.error_message,
      details: row.details,
    };
  }
}
