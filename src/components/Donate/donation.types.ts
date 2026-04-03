/**
 * Typen und Enums für das Spenden-Modul.
 *
 * Definiert den Spenden-Status, Domain-Modelle und DB-Zeilentypen
 * für Spenden, Spendenziel-Abschnitte und Spendenstatistik.
 */

/* =====================================================================
// Status-Enum (entspricht public.donation_status in Postgres)
// ===================================================================== */

/**
 * Status einer Spende — String-Werte entsprechen dem PostgreSQL-ENUM.
 */
export enum DonationStatus {
  pending = "pending",
  confirmed = "confirmed",
  failed = "failed",
  cancelled = "cancelled",
  refunded = "refunded",
  migrated = "migrated",
}

/* =====================================================================
// Domain-Modelle (camelCase, werden in der App verwendet)
// ===================================================================== */

/**
 * Domain-Modell einer Spende (camelCase).
 *
 * Spender-Name und -E-Mail werden via View aus der users-Tabelle geJOINt
 * und sind daher nur im Lese-Modell vorhanden (nicht beim Schreiben).
 *
 * @param id - Eindeutige ID der Spende.
 * @param eventId - Optionale Event-ID für Event-gebundene Spenden.
 * @param payrexxGatewayId - Payrexx-Gateway-ID.
 * @param payrexxReferenceId - Payrexx-Referenz-ID (= Spenden-ID).
 * @param payrexxTransactionId - Payrexx-Transaktions-ID.
 * @param amountInCents - Spendenbetrag in Rappen (min. 500).
 * @param currency - Währung (Standard: CHF).
 * @param status - Aktueller Spenden-Status.
 * @param paymentMethod - Zahlungsmethode (z.B. twint, visa).
 * @param paidAt - Zeitpunkt der Zahlung.
 * @param donorUid - Auth-UUID des Spenders.
 * @param donorMessage - Optionale Nachricht (max. 200 Zeichen).
 * @param receiptNumber - Quittungsnummer (z.B. 2026-0001).
 * @param receiptSentAt - Zeitpunkt des Quittungs-Versands.
 * @param createdAt - Erstellungszeitpunkt.
 * @param donorDisplayName - Anzeigename (aus View, nur bei Lesen).
 * @param donorEmail - E-Mail-Adresse (aus View, nur bei Lesen).
 * @param eventName - Event-Name (aus View, nur bei Lesen).
 */
export type DonationDomain = {
  id: string;
  eventId: string | null;
  payrexxGatewayId: string | null;
  payrexxReferenceId: string | null;
  payrexxTransactionId: string | null;
  amountInCents: number;
  currency: string;
  status: DonationStatus;
  paymentMethod: string | null;
  paidAt: Date | null;
  donorUid: string;
  donorMessage: string | null;
  receiptNumber: string | null;
  receiptSentAt: Date | null;
  createdAt: Date;
  // View-Felder (nur bei Lesen via donations_view)
  donorDisplayName: string;
  donorEmail?: string;
  eventName: string;
};

/* =====================================================================
// DB-Zeilentyp (snake_case, entspricht Postgres-Spalten)
// ===================================================================== */

/**
 * Datenbank-Zeilentyp für die donations / donations_view.
 */
export type DonationRow = {
  [key: string]: unknown;
  id: string;
  event_id: string | null;
  payrexx_gateway_id: string | null;
  payrexx_reference_id: string | null;
  payrexx_transaction_id: string | null;
  amount_in_cents: number;
  currency: string;
  status: string;
  payment_method: string | null;
  paid_at: string | null;
  donor_uid: string;
  donor_message: string | null;
  receipt_number: string | null;
  receipt_sent_at: string | null;
  created_at: string;
  updated_at: string;
  // View-Felder
  donor_display_name?: string | null;
  donor_email?: string | null;
  event_name?: string | null;
};

/* =====================================================================
// Spendenziel-Abschnitte
// ===================================================================== */

/**
 * Ein Abschnitt des Spendenziels (z.B. «Infrastruktur», «Verein»).
 *
 * @param id - Eindeutige ID.
 * @param label - Beschriftung des Abschnitts.
 * @param targetCents - Zielbetrag in Rappen.
 * @param sortOrder - Sortierreihenfolge.
 * @param year - Jahreszugehörigkeit.
 */
export type DonationGoalSection = {
  id: string;
  label: string;
  targetCents: number;
  sortOrder: number;
  year: number;
};

/**
 * DB-Zeilentyp für donation_goal_sections.
 */
export type DonationGoalSectionRow = {
  [key: string]: unknown;
  id: string;
  label: string;
  target_cents: number;
  sort_order: number;
  year: number;
};

/* =====================================================================
// Spendenstatistik (RPC-Ergebnis)
// ===================================================================== */

/**
 * Aggregierte Spendenstatistik für das aktuelle Jahr.
 *
 * @param totalCents - Gesamtbetrag bestätigter Spenden in Rappen.
 * @param donorCount - Anzahl eindeutiger Spender.
 * @param donationCount - Anzahl bestätigter Spenden.
 */
export type DonationGoalStats = {
  totalCents: number;
  donorCount: number;
  donationCount: number;
};
