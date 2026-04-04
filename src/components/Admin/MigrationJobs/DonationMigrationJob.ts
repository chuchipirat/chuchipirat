/**
 * Migrationsjob für Spenden (Quittungen) von Firebase nach Postgres.
 *
 * Migriert alle Quittungen aus der Firestore-Subkollektion `receipt`
 * unter jedem Event-Dokument in `events`. Pro Quittung wird ein Eintrag
 * in der `donations`-Tabelle mit `status='migrated'` angelegt.
 *
 * FK-Auflösung:
 * - `eventUid` (Firebase Event UID) → `events.id` via `events`-Tabelle
 *   (Events haben nach der Migration eine Zuordnung über firebase_uid oder
 *   die ID selbst)
 * - `donorEmail` → `users.email` → `users.auth_uid` für `donor_uid`
 *
 * Voraussetzungen:
 * - Events und Benutzer müssen vor Spenden migriert sein
 *
 * @example
 * const job = new DonationMigrationJob();
 * const records = await job.fetchSourceRecords(firebase, database);
 */
import {collection, getDocs, doc, getDoc} from "firebase/firestore";
import Firebase from "../../Firebase/firebase.class";
import DatabaseService from "../../Database/DatabaseService";
import AuthUser from "../../Firebase/Authentication/authUser.class";
import {supabaseAdmin} from "../../Database/supabaseClient";
import {MigrationJob, SourceRecord} from "./MigrationJob.interface";

/* =====================================================================
// Firebase-Datenstrukturen
// ===================================================================== */

/**
 * Quittungsdaten aus einem Firebase-Event-Dokument.
 *
 * @param eventUid - Firebase Event-UID.
 * @param eventName - Name des Events.
 * @param payDate - Zahlungsdatum.
 * @param amount - Betrag in CHF (Dezimal).
 * @param donorName - Name des Spenders.
 * @param donorEmail - E-Mail des Spenders.
 */
interface FirebaseReceiptData {
  eventUid: string;
  eventName: string;
  payDate: {seconds?: number; toDate?: () => Date} | Date | string;
  amount: number;
  donorName: string;
  donorEmail: string;
  created?: {
    date?: {seconds?: number; toDate?: () => Date} | Date;
    fromUid?: string;
    fromDisplayName?: string;
  };
}

/* =====================================================================
// Hilfsfunktionen
// ===================================================================== */

/**
 * Konvertiert ein Firebase-Timestamp-Feld in ein Date-Objekt.
 *
 * @param value - Das Timestamp-Feld (Firestore Timestamp, Date oder String).
 * @returns Date-Objekt.
 */
function toDate(value: unknown): Date {
  if (!value) return new Date();
  if (value instanceof Date) return value;
  if (typeof value === "string") return new Date(value);
  const timestampLike = value as {seconds?: number; toDate?: () => Date};
  if (typeof timestampLike.toDate === "function") return timestampLike.toDate();
  if (timestampLike.seconds) return new Date(timestampLike.seconds * 1000);
  return new Date();
}

/* =====================================================================
// DonationMigrationJob
// ===================================================================== */

/**
 * Migrationsjob für Spenden von Firebase nach Postgres.
 */
export class DonationMigrationJob
  implements MigrationJob<FirebaseReceiptData>
{
  name = "Spenden (Quittungen)";
  description =
    "Migriert Quittungen aus Firebase-Event-Dokumenten in die donations-Tabelle.";

  /**
   * Liest alle Quittungen aus allen Events in Firebase.
   *
   * @param firebase - Firebase-Instanz.
   * @returns Array aller Quittungs-Quelldatensätze.
   */
  async fetchSourceRecords(
    firebase: Firebase,
  ): Promise<SourceRecord<FirebaseReceiptData>[]> {
    const records: SourceRecord<FirebaseReceiptData>[] = [];

    // Alle Events lesen
    const eventsCollection = collection(firebase.firestore, "events");
    const eventsSnapshot = await getDocs(eventsCollection);

    for (const eventDoc of eventsSnapshot.docs) {
      const eventUid = eventDoc.id;

      // Meta-Dokument überspringen
      if (eventUid === "000_allEvents") continue;

      // Quittungs-Subdokument lesen
      try {
        const receiptRef = doc(
          firebase.firestore,
          "events",
          eventUid,
          "docs",
          "receipt",
        );
        const receiptSnap = await getDoc(receiptRef);

        if (receiptSnap.exists()) {
          const data = receiptSnap.data() as FirebaseReceiptData;

          // Nur valide Quittungen mit Betrag > 0
          if (data.amount && data.amount > 0) {
            records.push({
              id: `${eventUid}_receipt`,
              label: `${data.eventName ?? eventUid} — CHF ${data.amount}`,
              data: {
                ...data,
                eventUid,
              },
            });
          }
        }
      } catch {
        // Quittung existiert nicht oder Fehler — überspringen
      }
    }

    return records;
  }

  /**
   * Prüft, ob eine Spende bereits in Postgres existiert.
   *
   * @param database - DatabaseService-Instanz.
   * @param record - Der zu prüfende Quelldatensatz.
   * @returns true, falls die Spende bereits migriert wurde.
   */
  async checkExists(
    database: DatabaseService,
    record: SourceRecord<FirebaseReceiptData>,
  ): Promise<boolean> {
    if (!supabaseAdmin) return false;

    // Prüfen ob bereits eine migrierte Spende für dieses Event existiert
    const {data} = await supabaseAdmin
      .from("donations")
      .select("id")
      .eq("status", "migrated")
      .eq("event_id", record.data.eventUid)
      .limit(1);

    return (data?.length ?? 0) > 0;
  }

  /**
   * Migriert eine einzelne Quittung nach Postgres.
   *
   * @param database - DatabaseService-Instanz.
   * @param record - Die zu migrierende Quittung.
   * @param authUser - Der angemeldete Admin-Benutzer.
   */
  async migrateRecord(
    database: DatabaseService,
    record: SourceRecord<FirebaseReceiptData>,
    authUser: AuthUser,
  ): Promise<void> {
    if (!supabaseAdmin) {
      throw new Error("Service Role Key nicht konfiguriert");
    }

    const receiptData = record.data;

    // Event-ID auflösen: prüfen ob das Event in Postgres existiert
    const {data: eventRow} = await supabaseAdmin
      .from("events")
      .select("id")
      .eq("id", receiptData.eventUid)
      .maybeSingle();

    const eventId = eventRow?.id ?? null;

    // Spender per E-Mail zuordnen
    let donorUid: string | null = null;
    if (receiptData.donorEmail) {
      const {data: userRow} = await supabaseAdmin
        .from("users")
        .select("id")
        .eq("email", receiptData.donorEmail.toLocaleLowerCase().trim())
        .maybeSingle();

      donorUid = userRow?.id ?? null;
    }

    // Falls kein Spender gefunden: Admin-User als Fallback
    if (!donorUid) {
      donorUid = authUser.uid;
    }

    // Betrag in Rappen umrechnen
    const amountInCents = Math.round(receiptData.amount * 100);

    // Zahlungsdatum
    const paidAt = toDate(receiptData.payDate);

    // Quittungsnummer generieren
    const {data: receiptNumber} = await supabaseAdmin.rpc(
      "generate_donation_receipt_number",
    );

    // In donations-Tabelle einfügen
    const {error} = await supabaseAdmin.from("donations").insert({
      event_id: eventId,
      amount_in_cents: amountInCents,
      currency: "CHF",
      status: "migrated",
      payment_method: "twint",
      paid_at: paidAt.toISOString(),
      donor_uid: donorUid,
      receipt_number: receiptNumber,
    });

    if (error) {
      throw new Error(`Fehler beim Einfügen der Spende: ${error.message}`);
    }
  }
}
