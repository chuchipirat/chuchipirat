/**
 * DonationRepository — Repository für Spenden.
 *
 * Liest über die View `donations_view` (JOINt Spender- und Event-Daten),
 * schreibt in die Tabelle `donations`.
 *
 * @example
 * const donations = await repo.getMyDonations(authUser);
 * const stats = await repo.getDonationGoalStats();
 */
import {SupabaseClient} from "@supabase/supabase-js";
import * as Sentry from "@sentry/browser";
import {BaseRepository} from "./BaseRepository";
import {
  STORAGE_OBJECT_PROPERTY,
  StorageObjectProperty,
} from "../../Firebase/Db/sessionStorageHandler.class";
import {AuthUser} from "../../Firebase/Authentication/authUser.class";
import {
  DonationDomain,
  DonationRow,
  DonationStatus,
  DonationGoalSection,
  DonationGoalSectionRow,
  DonationGoalStats,
} from "../../Donate/donation.types";

/* =====================================================================
// DonationRepository
// ===================================================================== */

/**
 * Repository für Spenden — liest via View, schreibt auf Tabelle.
 *
 * Bietet Methoden für eigene Spenden, Event-Spenden, Admin-Übersicht,
 * Spendenstatistik und Spendenziel-Abschnitte.
 */
export class DonationRepository extends BaseRepository<DonationDomain, DonationRow> {
  tableName = "donations";

  /** View-Name für Leseoperationen (JOINt Spender- und Event-Daten). */
  private readonly viewName = "donations_view";

  constructor(client?: SupabaseClient) {
    super(client);
  }

  /* =====================================================================
  // Domain → DB-Zeile Mapping
  // ===================================================================== */
  /**
   * Konvertiert ein DonationDomain-Objekt in eine Postgres-Zeile.
   * View-Felder werden nicht geschrieben.
   *
   * @param domain - Das Domain-Objekt (camelCase).
   * @returns Partielle DB-Zeile (snake_case).
   */
  toRow(domain: DonationDomain): Partial<DonationRow> {
    return {
      event_id: domain.eventId,
      payrexx_gateway_id: domain.payrexxGatewayId,
      payrexx_reference_id: domain.payrexxReferenceId,
      payrexx_transaction_id: domain.payrexxTransactionId,
      amount_in_cents: domain.amountInCents,
      currency: domain.currency,
      status: domain.status,
      payment_method: domain.paymentMethod,
      paid_at: domain.paidAt?.toISOString() ?? null,
      donor_uid: domain.donorUid,
      donor_message: domain.donorMessage,
      receipt_number: domain.receiptNumber,
      receipt_sent_at: domain.receiptSentAt?.toISOString() ?? null,
    };
  }

  /* =====================================================================
  // DB-Zeile → Domain Mapping
  // ===================================================================== */
  /**
   * Konvertiert eine Postgres-Zeile (aus der View) in ein DonationDomain-Objekt.
   *
   * @param row - Die DB-Zeile (snake_case).
   * @returns Domain-Objekt (camelCase).
   */
  toDomain(row: DonationRow): DonationDomain {
    return {
      id: row.id,
      eventId: row.event_id,
      payrexxGatewayId: row.payrexx_gateway_id,
      payrexxReferenceId: row.payrexx_reference_id,
      payrexxTransactionId: row.payrexx_transaction_id,
      amountInCents: row.amount_in_cents,
      currency: row.currency,
      status: row.status as DonationStatus,
      paymentMethod: row.payment_method,
      paidAt: row.paid_at ? new Date(row.paid_at) : null,
      donorUid: row.donor_uid,
      donorMessage: row.donor_message,
      receiptNumber: row.receipt_number,
      receiptSentAt: row.receipt_sent_at ? new Date(row.receipt_sent_at) : null,
      createdAt: row.created_at ? new Date(row.created_at) : new Date(0),
      donorDisplayName: row.donor_display_name ?? "",
      donorEmail: row.donor_email ?? "",
      eventName: row.event_name ?? "",
    };
  }

  /* =====================================================================
  // Cache-Konfiguration
  // ===================================================================== */
  /**
   * Gibt die Cache-Konfiguration zurück.
   * Spenden werden nicht gecacht (ändern sich durch Webhooks).
   */
  getCacheConfig(): StorageObjectProperty {
    return STORAGE_OBJECT_PROPERTY.DONATIONS;
  }

  /* =====================================================================
  // Leseoperationen (über View)
  // ===================================================================== */

  /**
   * Lädt alle eigenen Spenden des angemeldeten Benutzers.
   *
   * @param authUser - Der angemeldete Benutzer.
   * @returns Eigene Spenden, sortiert nach Erstellungsdatum (neueste zuerst).
   */
  async getMyDonations(authUser: AuthUser): Promise<DonationDomain[]> {
    try {
      const {data, error} = await this.client
        .from(this.viewName)
        .select("*")
        .eq("donor_uid", authUser.uid)
        .order("created_at", {ascending: false});

      if (error) throw error;
      return (data ?? []).map((row) => this.toDomain(row as unknown as DonationRow));
    } catch (error) {
      Sentry.captureException(error);
      throw error;
    }
  }

  /**
   * Lädt alle bestätigten Spenden für ein bestimmtes Event.
   *
   * @param eventId - Die Event-ID.
   * @returns Bestätigte Event-Spenden, sortiert nach Zahldatum.
   */
  async getEventDonations(eventId: string): Promise<DonationDomain[]> {
    try {
      const {data, error} = await this.client
        .from(this.viewName)
        .select("*")
        .eq("event_id", eventId)
        .eq("status", DonationStatus.confirmed)
        .order("paid_at", {ascending: false});

      if (error) throw error;
      return (data ?? []).map((row) => this.toDomain(row as unknown as DonationRow));
    } catch (error) {
      Sentry.captureException(error);
      throw error;
    }
  }

  /**
   * Lädt alle Spenden (Admin-Übersicht).
   *
   * @returns Alle Spenden, sortiert nach Erstellungsdatum (neueste zuerst).
   */
  async getAllDonations(): Promise<DonationDomain[]> {
    try {
      const {data, error} = await this.client
        .from(this.viewName)
        .select("*")
        .order("created_at", {ascending: false});

      if (error) throw error;
      return (data ?? []).map((row) => this.toDomain(row as unknown as DonationRow));
    } catch (error) {
      Sentry.captureException(error);
      throw error;
    }
  }

  /* =====================================================================
  // Spendenstatistik (RPC)
  // ===================================================================== */

  /**
   * Ruft die aggregierte Spendenstatistik für das aktuelle Jahr ab.
   *
   * @returns Statistik mit Gesamtbetrag, Spenderanzahl und Spendenanzahl.
   */
  async getDonationGoalStats(): Promise<DonationGoalStats> {
    try {
      const {data, error} = await this.client.rpc("get_donation_goal_stats");

      if (error) throw error;

      const row = data?.[0] ?? data;
      return {
        totalCents: Number(row?.total_cents ?? 0),
        donorCount: Number(row?.donor_count ?? 0),
        donationCount: Number(row?.donation_count ?? 0),
      };
    } catch (error) {
      Sentry.captureException(error);
      throw error;
    }
  }

  /* =====================================================================
  // Spendenziel-Abschnitte
  // ===================================================================== */

  /**
   * Lädt die Spendenziel-Abschnitte für ein bestimmtes Jahr.
   *
   * @param year - Das Jahr (Standard: aktuelles Jahr).
   * @returns Sortierte Liste der Ziel-Abschnitte.
   */
  async getGoalSections(year?: number): Promise<DonationGoalSection[]> {
    try {
      const targetYear = year ?? new Date().getFullYear();

      const {data, error} = await this.client
        .from("donation_goal_sections")
        .select("*")
        .eq("year", targetYear)
        .order("sort_order", {ascending: true});

      if (error) throw error;

      return (data ?? []).map((row: DonationGoalSectionRow) => ({
        id: row.id,
        label: row.label,
        targetCents: row.target_cents,
        sortOrder: row.sort_order,
        year: row.year,
      }));
    } catch (error) {
      Sentry.captureException(error);
      throw error;
    }
  }

  /**
   * Erstellt einen neuen Spendenziel-Abschnitt.
   *
   * @param section - Der neue Abschnitt (ohne ID).
   * @returns Der erstellte Abschnitt mit generierter ID.
   */
  async createGoalSection(
    section: Omit<DonationGoalSection, "id">,
  ): Promise<DonationGoalSection> {
    try {
      const {data, error} = await this.client
        .from("donation_goal_sections")
        .insert({
          label: section.label,
          target_cents: section.targetCents,
          sort_order: section.sortOrder,
          year: section.year,
        })
        .select()
        .single();

      if (error) throw error;

      const row = data as DonationGoalSectionRow;
      return {
        id: row.id,
        label: row.label,
        targetCents: row.target_cents,
        sortOrder: row.sort_order,
        year: row.year,
      };
    } catch (error) {
      Sentry.captureException(error);
      throw error;
    }
  }

  /**
   * Aktualisiert einen bestehenden Spendenziel-Abschnitt.
   *
   * @param section - Der aktualisierte Abschnitt (mit ID).
   */
  async updateGoalSection(section: DonationGoalSection): Promise<void> {
    try {
      const {error} = await this.client
        .from("donation_goal_sections")
        .update({
          label: section.label,
          target_cents: section.targetCents,
          sort_order: section.sortOrder,
          year: section.year,
        })
        .eq("id", section.id);

      if (error) throw error;
    } catch (error) {
      Sentry.captureException(error);
      throw error;
    }
  }

  /**
   * Löscht einen Spendenziel-Abschnitt.
   *
   * @param sectionId - Die ID des zu löschenden Abschnitts.
   */
  async deleteGoalSection(sectionId: string): Promise<void> {
    try {
      const {error} = await this.client
        .from("donation_goal_sections")
        .delete()
        .eq("id", sectionId);

      if (error) throw error;
    } catch (error) {
      Sentry.captureException(error);
      throw error;
    }
  }
}
