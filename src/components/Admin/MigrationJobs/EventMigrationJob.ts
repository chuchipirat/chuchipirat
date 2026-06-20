/**
 * Migrationsjob für Events von Firebase nach Postgres.
 *
 * Migriert alle Events aus der Firestore-Kollektion `events`.
 * Das Dokument `000_allEvents` wird dabei übersprungen (Meta-Dokument).
 *
 * Pro Event werden folgende Datensätze in Postgres angelegt:
 * - Kopfdaten in `events`
 * - Koch-Mitglieder in `event_cooks` (FK auf auth.users via userAuthUidByFirebaseUid)
 * - Zeitscheiben in `event_dates`
 *
 * FK-Auflösung:
 * - `cook.uid` (Firebase UID) → `users.legacy_firebase_uid` → `users.id` (Supabase UUID)
 *
 * Voraussetzungen:
 * - Benutzer müssen vor Events migriert sein (FK event_cooks → auth.users)
 *
 * @example
 * const job = new EventMigrationJob();
 * const records = await job.fetchSourceRecords(firebase, database);
 */
import {collection, getDocs} from "firebase/firestore";
import Firebase from "../../Firebase/firebase.class";
import DatabaseService from "../../Database/DatabaseService";
import AuthUser from "../../Firebase/Authentication/authUser.class";
import {supabaseAdmin} from "../../Database/supabaseClient";
import {fetchAllRows} from "./MigrationJob.interface";

import {MigrationJob, SourceRecord} from "./MigrationJob.interface";

/* =====================================================================
// Firebase-Datenstrukturen
// ===================================================================== */

/**
 * Koch-Eintrag in einem Firebase-Event-Dokument.
 */
interface FirebaseCook {
  uid: string;
  displayName?: string;
  email?: string;
  pictureSrc?: string;
}

/**
 * Datumsscheibe in einem Firebase-Event-Dokument.
 */
interface FirebaseEventDate {
  uid: string;
  pos: number;
  /** Firestore Timestamp oder Date */
  from: {toDate: () => Date} | Date | string;
  /** Firestore Timestamp oder Date */
  to: {toDate: () => Date} | Date | string;
}

/**
 * Vollständige Firebase-Datenstruktur eines Events.
 */
interface FirebaseEventData {
  name: string;
  motto: string;
  location: string;
  pictureSrc: string;
  cooks: FirebaseCook[];
  dates: FirebaseEventDate[];
  authUsers?: string[];
  created?: {
    date?: {toDate: () => Date} | Date | string;
    fromUid?: string;
  };
}

/* =====================================================================
// Hilfsfunktionen
// ===================================================================== */

/**
 * Konvertiert einen Firestore-Timestamp oder Date-String in ein JavaScript Date-Objekt.
 *
 * @param value - Firestore Timestamp, Date-Objekt oder ISO-String
 * @returns JavaScript Date
 */
const toDate = (value: {toDate: () => Date} | Date | string | undefined): Date => {
  if (!value) return new Date(0);
  if (typeof value === "string") return new Date(value);
  if (value instanceof Date) return value;
  if (typeof (value as {toDate?: () => Date}).toDate === "function") {
    return (value as {toDate: () => Date}).toDate();
  }
  return new Date(0);
};

/**
 * Konvertiert ein JavaScript Date-Objekt in einen ISO-Datums-String (YYYY-MM-DD).
 *
 * @param date - Zu konvertierendes Datum
 * @returns ISO-Datums-String
 */
const toDateString = (date: Date): string => {
  // Lokales Datum verwenden, nicht UTC (.toISOString() gibt UTC zurück,
  // was in CET/CEST zum Vortag werden kann).
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

/* =====================================================================
// EventMigrationJob
// ===================================================================== */

/**
 * Migrations-Job für Events (Kopfdaten, Köche, Zeitscheiben).
 *
 * Baut beim ersten `fetchSourceRecords`-Aufruf die Lookup-Map
 * `userAuthUidByFirebaseUid` auf, um Firebase-Benutzer-UIDs auf
 * Supabase Auth-UUIDs abzubilden.
 */
export class EventMigrationJob implements MigrationJob<FirebaseEventData> {
  name = "Events (Kopfdaten, Köche, Zeitscheiben)";
  description =
    "Migriert alle Events aus Firebase nach Postgres. " +
    "Pro Event werden Kopfdaten, Koch-Mitglieder und Zeitscheiben gespeichert. " +
    "Setzt voraus, dass Benutzer bereits migriert sind.";

  /** firebase_uid → Supabase Auth UUID für Benutzer */
  private userAuthUidByFirebaseUid: Map<string, string> = new Map();
  /** Bereits migrierte Events (firebase_uid) — für schnelle checkExists-Prüfung */
  private existingFirebaseUids: Set<string> | null = null;

  /* =====================================================================
  // Alle Events aus Firebase lesen
  // ===================================================================== */
  /**
   * Liest alle Event-Dokumente aus der Firestore-Kollektion `events`.
   * Überspringt das Meta-Dokument `000_allEvents`.
   *
   * @param firebase - Firebase-Instanz
   * @param database - DatabaseService-Instanz (für FK-Lookup-Maps)
   * @returns Array aller Event-Quelldatensätze
   */
  async fetchSourceRecords(
    firebase: Firebase,
    database?: DatabaseService,
  ): Promise<SourceRecord<FirebaseEventData>[]> {
    if (database) {
      await this.buildLookupMaps();
    }

    // Bereits migrierte Events laden (für In-Memory checkExists)
    const existingRows = await fetchAllRows(
      supabaseAdmin!, "events", "firebase_uid",
      (query) => query.not("firebase_uid", "is", null),
    );
    this.existingFirebaseUids = new Set(
      existingRows.map((row) => row.firebase_uid as string),
    );

    const snapshot = await getDocs(collection(firebase.firestore, "events"));
    const records: SourceRecord<FirebaseEventData>[] = [];

    for (const document of snapshot.docs) {
      const uid = document.id;

      // Meta-Dokument überspringen
      if (uid === "000_allEvents") continue;

      const value = document.data();

      records.push({
        id: uid,
        label: value.name ?? uid,
        data: {
          name: value.name ?? "",
          motto: value.motto ?? "",
          location: value.location ?? "",
          pictureSrc: value.pictureSrc ?? "",
          cooks: (value.cooks ?? []) as FirebaseCook[],
          dates: (value.dates ?? []) as FirebaseEventDate[],
          authUsers: value.authUsers ?? [],
          created: value.created ?? {},
        },
      });
    }

    return records;
  }

  /* =====================================================================
  // Prüfen ob Event bereits migriert wurde
  // ===================================================================== */
  /**
   * Prüft anhand der `firebase_uid`, ob das Event bereits migriert wurde.
   *
   * @param database - DatabaseService-Instanz
   * @param record - Der zu prüfende Quelldatensatz
   * @returns true, falls das Event bereits vorhanden ist
   */
  async checkExists(
    _database: DatabaseService,
    record: SourceRecord<FirebaseEventData>,
  ): Promise<boolean> {
    // In-Memory-Prüfung gegen vorab geladene Set (kein DB-Roundtrip)
    return this.existingFirebaseUids?.has(record.id) ?? false;
  }

  /* =====================================================================
  // Einzelnes Event nach Postgres migrieren
  // ===================================================================== */
  /**
   * Fügt ein Event inklusive Köche und Zeitscheiben in Postgres ein.
   *
   * Reihenfolge:
   * 1. Event-Kopfdaten (events)
   * 2. firebase_uid nachträglich setzen (via patch)
   * 3. Koch-Mitglieder (event_cooks)
   * 4. Zeitscheiben (event_dates)
   *
   * @param database - DatabaseService-Instanz
   * @param record - Der zu migrierende Quelldatensatz
   * @param authUser - Der angemeldete Admin-Benutzer
   */
  async migrateRecord(
    _database: DatabaseService,
    record: SourceRecord<FirebaseEventData>,
    _authUser: AuthUser,
  ): Promise<void> {
    const data = record.data;
    const client = supabaseAdmin!;

    // 1. Event-Kopfdaten einfügen
    const {data: eventRow, error: eventError} = await client
      .from("events")
      .insert({
        name: data.name,
        motto: data.motto,
        location: data.location,
        picture_src: data.pictureSrc,
        firebase_uid: record.id,
      })
      .select("id")
      .single();

    if (eventError) throw eventError;
    const eventId = (eventRow as {id: string}).id;

    // 2. Koch-Mitglieder als Batch einfügen
    const cookRows: Record<string, unknown>[] = [];
    for (const cook of data.cooks) {
      const authUid = this.userAuthUidByFirebaseUid.get(cook.uid);
      if (!authUid) continue;

      cookRows.push({
        event_id: eventId,
        user_id: authUid,
        firebase_uid: cook.uid,
      });
    }

    if (cookRows.length > 0) {
      const {error: cookError} = await client
        .from("event_cooks")
        .upsert(cookRows, {onConflict: "event_id,user_id", ignoreDuplicates: true});
      if (cookError) throw cookError;
    }

    // 3. Zeitscheiben als Batch einfügen
    const sortedDates = [...data.dates].sort((dateA, dateB) => (dateA.pos ?? 0) - (dateB.pos ?? 0));
    const dateRows: Record<string, unknown>[] = [];
    for (let index = 0; index < sortedDates.length; index++) {
      const dateEntry = sortedDates[index];
      const dateFrom = toDate(dateEntry.from);
      const dateTo = toDate(dateEntry.to);

      // Epoch-Daten (ungültig) überspringen
      if (dateFrom.getTime() === 0 && dateTo.getTime() === 0) continue;

      dateRows.push({
        event_id: eventId,
        sort_order: index * 10,
        date_from: toDateString(dateFrom),
        date_to: toDateString(dateTo),
        firebase_uid: dateEntry.uid,
      });
    }

    if (dateRows.length > 0) {
      const {error: dateError} = await client
        .from("event_dates")
        .insert(dateRows);
      if (dateError) throw dateError;
    }
  }

  /* =====================================================================
  // Hilfsmethode: Lookup-Maps aufbauen
  // ===================================================================== */
  /**
   * Lädt alle Benutzer aus Postgres und befüllt die Lookup-Map
   * für die Auflösung von Firebase-UIDs auf Supabase Auth-UUIDs.
   *
   * @throws {PostgrestError} bei Datenbankfehler
   */
  private async buildLookupMaps(): Promise<void> {
    const client = supabaseAdmin!;

    // Benutzer: legacy_firebase_uid → id (UUID, identisch mit auth.users.id)
    // Nach der id-Vereinheitlichung (Phase 3) ist users.id die Supabase-UUID,
    // die alten Firebase-UIDs stehen in legacy_firebase_uid.
    const userRows = await fetchAllRows(client, "users", "id, legacy_firebase_uid",
      (query) => query.not("legacy_firebase_uid", "is", null));

    for (const row of userRows) {
      if (row.legacy_firebase_uid && row.id) {
        this.userAuthUidByFirebaseUid.set(
          row.legacy_firebase_uid as string,
          row.id as string,
        );
      }
    }
  }
}
