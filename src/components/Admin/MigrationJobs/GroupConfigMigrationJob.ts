/**
 * Migrationsjob für die Gruppenconfig von Firebase nach Postgres.
 *
 * Migriert alle Gruppenconfig-Dokumente aus `events/{uid}/docs/groupConfiguration`.
 * Legt pro Event Diätgruppen, Unverträglichkeiten und die Portionenmatrix an.
 *
 * FK-Auflösung:
 * - Event-Firebase-UID → `events.firebase_uid` → `events.id`
 *
 * Voraussetzungen (müssen vor diesem Job ausgeführt worden sein):
 * - Events (EventMigrationJob)
 *
 * @example
 * const job = new GroupConfigMigrationJob();
 * const records = await job.fetchSourceRecords(firebase, database);
 */
import {collection, doc, getDoc, getDocs} from "firebase/firestore";
import Firebase from "../../Firebase/firebase.class";
import DatabaseService from "../../Database/DatabaseService";
import AuthUser from "../../Firebase/Authentication/authUser.class";
import {supabase} from "../../Database/supabaseClient";
import {SupabaseClient} from "@supabase/supabase-js";
import {MigrationJob, SourceRecord} from "./MigrationJob.interface";

/* =====================================================================
// Firebase-Datenstrukturen
// ===================================================================== */

/**
 * Diät- oder Unverträglichkeitseintrag in der Firebase-Gruppenconfig.
 */
interface FirebaseGroupConfigItem {
  uid: string;
  name: string;
  totalPortions?: number;
}

/**
 * Gruppenstruktur mit Einträgen und Reihenfolge-Array.
 */
interface FirebaseGroupConfigObjectStructure<T> {
  entries: {[key: string]: T};
  order: string[];
}

/**
 * Portionenmatrix: diet_uid → intolerance_uid → Anzahl
 */
interface FirebasePortions {
  [dietUid: string]: {[intoleranceUid: string]: number};
}

/**
 * Vollständige Firebase-Datenstruktur der Gruppenconfig.
 */
interface FirebaseGroupConfigData {
  /** Firebase UID des Events */
  eventFirebaseUid: string;
  diets: FirebaseGroupConfigObjectStructure<FirebaseGroupConfigItem>;
  intolerances: FirebaseGroupConfigObjectStructure<FirebaseGroupConfigItem>;
  portions: FirebasePortions;
}

/* =====================================================================
// GroupConfigMigrationJob
// ===================================================================== */

/**
 * Migrations-Job für Gruppenconfigs (Diäten, Intolerances, Portionen).
 *
 * Baut die Lookup-Map `eventIdByFirebaseUid` auf, um Firebase-Event-UIDs
 * auf Postgres-Event-IDs abzubilden.
 */
export class GroupConfigMigrationJob implements MigrationJob<FirebaseGroupConfigData> {
  name = "Gruppenconfig (Diäten, Unverträglichkeiten, Portionen)";
  description =
    "Migriert die Gruppenconfig aller Events von Firebase nach Postgres. " +
    "Legt Diätgruppen, Unverträglichkeiten und die Portionenmatrix an. " +
    "Setzt voraus, dass Events bereits migriert sind.";

  /** firebase_uid → Postgres-ID für Events */
  private eventIdByFirebaseUid: Map<string, string> = new Map();

  /* =====================================================================
  // Alle Gruppenconfigs aus Firebase lesen
  // ===================================================================== */
  /**
   * Liest alle Gruppenconfig-Dokumente aus Firestore.
   * Iteriert über alle Events und liest jeweils das groupConfiguration-Subdokument.
   *
   * @param firebase - Firebase-Instanz
   * @param database - DatabaseService-Instanz (für FK-Lookup-Maps)
   * @returns Array aller Gruppenconfig-Quelldatensätze
   */
  async fetchSourceRecords(
    firebase: Firebase,
    database?: DatabaseService,
  ): Promise<SourceRecord<FirebaseGroupConfigData>[]> {
    if (database) {
      await this.buildLookupMaps();
    }

    const eventsSnapshot = await getDocs(collection(firebase.firestore, "events"));
    const records: SourceRecord<FirebaseGroupConfigData>[] = [];

    for (const eventDoc of eventsSnapshot.docs) {
      const eventUid = eventDoc.id;
      if (eventUid === "000_allEvents") continue;

      const groupConfigRef = doc(firebase.firestore, "events", eventUid, "docs", "groupConfiguration");
      const groupConfigSnap = await getDoc(groupConfigRef);

      if (!groupConfigSnap.exists()) continue;

      const value = groupConfigSnap.data();

      records.push({
        id: eventUid,
        label: `GroupConfig für Event ${eventUid}`,
        data: {
          eventFirebaseUid: eventUid,
          diets: value.diets ?? {entries: {}, order: []},
          intolerances: value.intolerances ?? {entries: {}, order: []},
          portions: value.portions ?? {},
        },
      });
    }

    return records;
  }

  /* =====================================================================
  // Prüfen ob Gruppenconfig bereits migriert wurde
  // ===================================================================== */
  /**
   * Prüft ob für das Event bereits Diäten in Postgres vorhanden sind.
   *
   * @param database - DatabaseService-Instanz
   * @param record - Der zu prüfende Quelldatensatz
   * @returns true, falls bereits Diäten für das Event vorhanden sind
   */
  async checkExists(
    database: DatabaseService,
    record: SourceRecord<FirebaseGroupConfigData>,
  ): Promise<boolean> {
    const eventId = this.eventIdByFirebaseUid.get(record.data.eventFirebaseUid);
    if (!eventId) return false;

    const client: SupabaseClient = supabase;
    const {data, error} = await client
      .from("event_groupconfiguration_diets")
      .select("id")
      .eq("event_id", eventId)
      .limit(1);

    if (error) throw error;
    return (data ?? []).length > 0;
  }

  /* =====================================================================
  // Einzelne Gruppenconfig nach Postgres migrieren
  // ===================================================================== */
  /**
   * Fügt die Gruppenconfig eines Events in Postgres ein.
   *
   * Reihenfolge:
   * 1. Diäten (event_groupconfiguration_diets), sort_order = index * 10
   * 2. Unverträglichkeiten (event_groupconfiguration_intolerances), sort_order = index * 10
   * 3. Portionenmatrix (event_groupconfiguration_portions): iteriert portions[dietUid][intoleranceUid]
   *
   * @param database - DatabaseService-Instanz
   * @param record - Der zu migrierende Quelldatensatz
   * @param authUser - Der angemeldete Admin-Benutzer
   */
  async migrateRecord(
    database: DatabaseService,
    record: SourceRecord<FirebaseGroupConfigData>,
    _authUser: AuthUser,
  ): Promise<void> {
    const data = record.data;
    const client: SupabaseClient = supabase;

    const eventId = this.eventIdByFirebaseUid.get(data.eventFirebaseUid);
    if (!eventId) {
      throw new Error(
        `GroupConfigMigrationJob: Event ${data.eventFirebaseUid} nicht in Postgres gefunden.`,
      );
    }

    // Lookup-Maps für Diet/Intolerance Firebase-UIDs → Postgres-IDs (werden in diesem Job befüllt)
    const dietIdByFirebaseUid = new Map<string, string>();
    const intoleranceIdByFirebaseUid = new Map<string, string>();

    // 1. Diäten einfügen
    const dietOrder: string[] = data.diets.order ?? [];
    for (let index = 0; index < dietOrder.length; index++) {
      const dietFirebaseUid = dietOrder[index];
      const diet = data.diets.entries[dietFirebaseUid];
      if (!diet) continue;

      const {data: dietRow, error: dietError} = await client
        .from("event_groupconfiguration_diets")
        .insert({
          event_id: eventId,
          name: diet.name ?? "",
          sort_order: index * 10,
          firebase_uid: dietFirebaseUid,
        })
        .select("id")
        .single();

      if (dietError) throw dietError;
      dietIdByFirebaseUid.set(dietFirebaseUid, (dietRow as {id: string}).id);
    }

    // 2. Unverträglichkeiten einfügen
    const intoleranceOrder: string[] = data.intolerances.order ?? [];
    for (let index = 0; index < intoleranceOrder.length; index++) {
      const intoleranceFirebaseUid = intoleranceOrder[index];
      const intolerance = data.intolerances.entries[intoleranceFirebaseUid];
      if (!intolerance) continue;

      const {data: intoleranceRow, error: intoleranceError} = await client
        .from("event_groupconfiguration_intolerances")
        .insert({
          event_id: eventId,
          name: intolerance.name ?? "",
          sort_order: index * 10,
          firebase_uid: intoleranceFirebaseUid,
        })
        .select("id")
        .single();

      if (intoleranceError) throw intoleranceError;
      intoleranceIdByFirebaseUid.set(
        intoleranceFirebaseUid,
        (intoleranceRow as {id: string}).id,
      );
    }

    // 3. Portionenmatrix einfügen
    for (const dietFirebaseUid of Object.keys(data.portions)) {
      const dietId = dietIdByFirebaseUid.get(dietFirebaseUid);
      if (!dietId) continue;

      const intolerancePortions = data.portions[dietFirebaseUid];
      for (const intoleranceFirebaseUid of Object.keys(intolerancePortions)) {
        const intoleranceId = intoleranceIdByFirebaseUid.get(intoleranceFirebaseUid);
        if (!intoleranceId) continue;

        const servings = intolerancePortions[intoleranceFirebaseUid] ?? 0;

        const {error: portionError} = await client
          .from("event_groupconfiguration_portions")
          .insert({
            event_id: eventId,
            diet_id: dietId,
            intolerance_id: intoleranceId,
            servings,
          });

        if (portionError) {
          // Duplikat tolerieren
          if (portionError.code !== "23505") throw portionError;
        }
      }
    }
  }

  /* =====================================================================
  // Hilfsmethode: Event-Lookup-Map aufbauen
  // ===================================================================== */
  /**
   * Lädt alle Events aus Postgres und befüllt die Lookup-Map
   * firebase_uid → Postgres-ID.
   *
   * @throws {PostgrestError} bei Datenbankfehler
   */
  private async buildLookupMaps(): Promise<void> {
    const client: SupabaseClient = supabase;

    const {data: eventRows, error: eventError} = await client
      .from("events")
      .select("id, firebase_uid");

    if (eventError) throw eventError;

    for (const row of eventRows ?? []) {
      if (row.firebase_uid) {
        this.eventIdByFirebaseUid.set(row.firebase_uid as string, row.id as string);
      }
    }
  }
}
