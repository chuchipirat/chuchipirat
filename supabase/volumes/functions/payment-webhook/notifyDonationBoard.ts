/**
 * Zeigt eine bestätigte Spende auf dem Vestaboard: Dank mit Vorname, Betrag,
 * Anlass, Jahrestotal und Balken zum Jahresziel.
 *
 * Nur der Webhook ruft das auf. Von Hand erfasste Spenden laufen über
 * `create_manual_donation` und erscheinen darum nicht auf dem Board.
 */
import {SupabaseClient} from "https://esm.sh/@supabase/supabase-js@2";
import {
  buildDonationBoard,
  DonationBoardData,
} from "../_shared/donationBoard.ts";
import {sentryCaptureError} from "../_shared/sentryHelper.ts";
import {sendToVestaboard} from "../_shared/vestaboardClient.ts";

/** Supabase-Client mit Service Role. */
type AdminClient = SupabaseClient;

/**
 * Die Felder der Spende, die das Board braucht.
 *
 * @property amount_in_cents - Betrag in Rappen.
 * @property donor_uid - ID der spendenden Person.
 * @property event_id - Anlass der Spende, `null` ohne Anlass.
 */
export type BoardDonation = {
  amount_in_cents: number;
  donor_uid: string;
  event_id: string | null;
};

/**
 * Wirft den Fehler einer Supabase-Abfrage weiter, damit ein unvollständiges
 * Board nicht still gesendet wird.
 *
 * @param error - Fehler der Abfrage oder `null`.
 * @param context - Was geladen werden sollte.
 * @throws Error, wenn die Abfrage fehlgeschlagen ist.
 */
function throwOnError(error: {message: string} | null, context: string): void {
  if (error)
    throw new Error(`${context} laden fehlgeschlagen: ${error.message}`);
}

/** Zeile aus `get_donation_goal_stats`. */
type StatsRow = {
  total_cents?: number | string;
  donation_count?: number | string;
};

/**
 * Lädt Jahrestotal und Anzahl Spenden (gleiche Zahlen wie das Spendenziel
 * auf der Website, inkl. von Hand erfasster Spenden).
 *
 * @param adminClient - Supabase-Client mit Service Role.
 * @returns Summe in Rappen und Anzahl Spenden des laufenden Jahres.
 */
async function loadYearStats(
  adminClient: AdminClient,
): Promise<{totalCents: number; donationCount: number}> {
  const {data, error} = await adminClient.rpc("get_donation_goal_stats");
  throwOnError(error, "Spendenstatistik");
  // Die RPC liefert eine Tabelle mit genau einer Zeile.
  const rows = (Array.isArray(data)
    ? data
    : [data]) as unknown as (StatsRow | null)[];
  const stats = rows[0] ?? {};
  return {
    totalCents: Number(stats.total_cents ?? 0),
    donationCount: Number(stats.donation_count ?? 0),
  };
}

/**
 * Lädt die Abschnitte des Spendenziels eines Jahres in ihrer Reihenfolge.
 *
 * @param adminClient - Supabase-Client mit Service Role.
 * @param year - Das Jahr.
 * @returns Zielbeträge der Abschnitte in Rappen.
 */
async function loadGoalSections(
  adminClient: AdminClient,
  year: number,
): Promise<{targetCents: number}[]> {
  const {data, error} = await adminClient
    .from("donation_goal_sections")
    .select("target_cents")
    .eq("year", year)
    .order("sort_order");
  throwOnError(error, "Spendenziel");
  return (data ?? []).map((section: {target_cents: number}) => ({
    targetCents: section.target_cents,
  }));
}

/**
 * Lädt einen einzelnen Namen (Vorname oder Anlassname).
 *
 * @param adminClient - Supabase-Client mit Service Role.
 * @param table - `users` oder `events`.
 * @param column - Die Spalte mit dem Namen.
 * @param id - ID des Datensatzes.
 * @returns Der Name, leer wenn nicht vorhanden.
 */
async function loadName(
  adminClient: AdminClient,
  table: "users" | "events",
  column: "first_name" | "name",
  id: string,
): Promise<string> {
  const {data, error} = await adminClient
    .from(table)
    .select(column)
    .eq("id", id)
    .maybeSingle();
  throwOnError(error, table);
  return String((data as Record<string, unknown> | null)?.[column] ?? "");
}

/**
 * Sammelt alle Angaben für das Board.
 *
 * @param adminClient - Supabase-Client mit Service Role.
 * @param donation - Die bestätigte Spende.
 * @returns Die Angaben für {@link buildDonationBoard}.
 */
async function loadDonationBoardData(
  adminClient: AdminClient,
  donation: BoardDonation,
): Promise<DonationBoardData> {
  // Gleiches Jahr wie get_donation_goal_stats (NOW() in UTC).
  const year = new Date().getUTCFullYear();
  const [stats, goalSections, firstName, eventName] = await Promise.all([
    loadYearStats(adminClient),
    loadGoalSections(adminClient, year),
    loadName(adminClient, "users", "first_name", donation.donor_uid),
    donation.event_id
      ? loadName(adminClient, "events", "name", donation.event_id)
      : Promise.resolve(""),
  ]);
  return {
    amountCents: donation.amount_in_cents,
    firstName,
    eventName: eventName || null,
    year,
    yearTotalCents: stats.totalCents,
    donationCount: stats.donationCount,
    goalSections,
  };
}

/**
 * Zeigt die Spende auf dem Vestaboard. Wirft nie: Ein Fehler geht nur an
 * Sentry, denn ein 500 des Webhooks liesse den Zahlungsanbieter die schon
 * bestätigte Spende erneut zustellen.
 *
 * @param adminClient - Supabase-Client mit Service Role.
 * @param donation - Die bestätigte Spende.
 * @example
 * await notifyDonationBoard(adminClient, donation);
 */
export async function notifyDonationBoard(
  adminClient: AdminClient,
  donation: BoardDonation,
): Promise<void> {
  try {
    const data = await loadDonationBoardData(adminClient, donation);
    await sendToVestaboard(buildDonationBoard(data));
  } catch (error) {
    console.error("payment-webhook: Vestaboard update failed:", error);
    await sentryCaptureError(error, "payment-webhook/notifyDonationBoard");
  }
}
