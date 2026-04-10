/**
 * Migrationsjob für Materiallisten von Firebase nach Postgres.
 *
 * Migriert pro Event:
 * 1. MaterialList-Daten aus `events/{uid}/docs/materialList`
 *    → Header-Zeilen in `event_material_lists`
 *    → Item-Zeilen in `event_material_list_items`
 *
 * Keine Trace-Migration nötig — Traces werden on-the-fly aus dem Menüplan berechnet.
 *
 * FK-Auflösungen:
 * - Event-Firebase-UID → events.firebase_uid → events.id
 * - Material-UID → materials.firebase_uid → materials.id
 * - Menü-Firebase-UID → event_menues.firebase_uid → event_menues.id
 * - Meal-Firebase-UID → event_meals.firebase_uid → event_meals.id
 *
 * Voraussetzungen:
 * - Events, Materials müssen bereits migriert sein
 *
 * @example
 * const job = new MaterialListMigrationJob();
 * const records = await job.fetchSourceRecords(firebase, database);
 */
import {collection, doc, getDoc, getDocs} from "firebase/firestore";
import Firebase from "../../Firebase/firebase.class";
import DatabaseService from "../../Database/DatabaseService";
import AuthUser from "../../Firebase/Authentication/authUser.class";
import {supabaseAdmin} from "../../Database/supabaseClient";
import {MigrationJob, SourceRecord, fetchAllRows} from "./MigrationJob.interface";
import {MaterialListEditSource} from "../../Database/Repository/MaterialListRepository";

/* =====================================================================
// Firebase-Datenstrukturen
// ===================================================================== */

/** Materialposition in einer Materialliste (Firebase-Format). */
interface FirebaseMaterialListItem {
  checked: boolean;
  name: string;
  uid: string;
  type: number;
  quantity: number;
  trace: unknown[]; // Nicht migriert
  manualEdit?: boolean;
  manualAdd?: boolean;
}

/** Properties einer Liste (Firebase-Format). */
interface FirebaseMaterialListProperties {
  uid: string;
  name: string;
  selectedMeals: string[];
  selectedMenues: string[];
  generated: {date: unknown; fromUid: string; fromDisplayName: string};
}

/** Eintrag in der MaterialList (Firebase-Format). */
interface FirebaseMaterialListEntry {
  properties: FirebaseMaterialListProperties;
  items: FirebaseMaterialListItem[];
}

/** Vollständige Firebase-Daten für ein Event. */
interface FirebaseMaterialListData {
  eventFirebaseUid: string;
  materialListDoc: {
    lists: {[key: string]: FirebaseMaterialListEntry};
  };
}

/* =====================================================================
// MaterialListMigrationJob
// ===================================================================== */

/**
 * Migrations-Job für Materiallisten aller Events.
 */
export class MaterialListMigrationJob
  implements MigrationJob<FirebaseMaterialListData>
{
  name = "Materiallisten";
  description =
    "Migriert alle Materiallisten von Firebase nach Postgres. " +
    "Legt Header und Items an. Traces werden nicht migriert (on-the-fly Berechnung). " +
    "Setzt voraus, dass Events und Materials migriert sind.";

  /** firebase_uid → Postgres-ID für Events */
  private eventIdByFirebaseUid: Map<string, string> = new Map();
  /** Material UID (Firebase) → Postgres Material ID */
  private materialIdByUid: Map<string, string> = new Map();
  /** Menü firebase_uid → Postgres ID */
  private menueIdByFirebaseUid: Map<string, string> = new Map();
  /** Meal firebase_uid → Postgres ID */
  private mealIdByFirebaseUid: Map<string, string> = new Map();
  /** Bereits migrierte Event-IDs (Postgres) für schnelle Existenzprüfung */
  private existingEventIds: Set<string> | null = null;

  /* =====================================================================
  // Quelldaten lesen
  // ===================================================================== */

  /**
   * Liest alle Materiallisten aus Firestore.
   *
   * @param firebase - Firebase-Instanz
   * @param database - DatabaseService-Instanz (für FK-Lookup-Maps)
   * @returns Array der Quelldatensätze
   */
  async fetchSourceRecords(
    firebase: Firebase,
    database?: DatabaseService,
  ): Promise<SourceRecord<FirebaseMaterialListData>[]> {
    if (database) {
      await this.buildLookupMaps();

      // Bereits migrierte Event-IDs vorladen für schnelle Existenzprüfung
      const existingRows = await fetchAllRows(supabaseAdmin!, "event_material_lists", "event_id");
      this.existingEventIds = new Set(existingRows.map((row) => row.event_id as string));
    }

    const eventsSnapshot = await getDocs(
      collection(firebase.firestore, "events"),
    );
    const records: SourceRecord<FirebaseMaterialListData>[] = [];

    for (const eventDoc of eventsSnapshot.docs) {
      const eventUid = eventDoc.id;
      if (eventUid === "000_allEvents") continue;

      // MaterialList-Dokument lesen
      const materialListRef = doc(
        firebase.firestore,
        "events", eventUid, "docs", "materialList",
      );
      const materialListSnap = await getDoc(materialListRef);
      if (!materialListSnap.exists()) continue;

      const data = materialListSnap.data();
      const lists = data.lists ?? {};
      if (Object.keys(lists).length === 0) continue;

      records.push({
        id: eventUid,
        label: `Materiallisten für Event ${eventUid}`,
        data: {
          eventFirebaseUid: eventUid,
          materialListDoc: {lists},
        },
      });
    }

    return records;
  }

  /* =====================================================================
  // Bereits migriert?
  // ===================================================================== */

  /**
   * Prüft ob für das Event bereits Materiallisten in Postgres vorhanden sind.
   * Nutzt das vorab geladene Set für O(1)-Lookups statt einzelner DB-Abfragen.
   */
  async checkExists(
    _database: DatabaseService,
    record: SourceRecord<FirebaseMaterialListData>,
  ): Promise<boolean> {
    const eventId = this.eventIdByFirebaseUid.get(record.data.eventFirebaseUid);
    if (!eventId) return false;
    return this.existingEventIds?.has(eventId) ?? false;
  }

  /* =====================================================================
  // Einzelnes Event migrieren
  // ===================================================================== */

  /**
   * Migriert alle Materiallisten eines Events nach Postgres.
   */
  async migrateRecord(
    database: DatabaseService,
    record: SourceRecord<FirebaseMaterialListData>,
    _authUser: AuthUser,
  ): Promise<void> {
    const client = supabaseAdmin!;
    const eventId = this.eventIdByFirebaseUid.get(record.data.eventFirebaseUid);
    if (!eventId) {
      throw new Error(
        `MaterialListMigrationJob: Event ${record.data.eventFirebaseUid} nicht in Postgres gefunden.`,
      );
    }

    // Alle Header und Items sammeln, dann als 2 Batch-INSERTs einfügen
    const headerRows: Record<string, unknown>[] = [];
    const allItemRows: Record<string, unknown>[] = [];

    for (const [listKey, listEntry] of Object.entries(record.data.materialListDoc.lists)) {
      const props = listEntry.properties;
      if (!props) continue;

      const listId = crypto.randomUUID();

      // Menü-IDs auflösen
      const selectedMenues = (props.selectedMenues ?? [])
        .map((uid) => this.menueIdByFirebaseUid.get(uid))
        .filter((id): id is string => !!id);

      // Meal-IDs auflösen
      const selectedMeals = (props.selectedMeals ?? [])
        .map((uid) => this.mealIdByFirebaseUid.get(uid))
        .filter((id): id is string => !!id);

      // Prüfen ob manuelle Items vorhanden
      const hasManuallyAddedItems = (listEntry.items ?? []).some(
        (item) => item.manualAdd === true,
      );

      headerRows.push({
        id: listId,
        event_id: eventId,
        name: props.name ?? "",
        selected_menues: selectedMenues,
        selected_meals: selectedMeals,
        has_manually_added_items: hasManuallyAddedItems,
        firebase_uid: props.uid ?? listKey,
      });

      // Items sammeln
      const items = listEntry.items ?? [];
      for (const [itemIdx, item] of items.entries()) {
        let materialId: string | null = null;
        let freeTextName: string | null = null;

        if (item.uid) {
          materialId = this.materialIdByUid.get(item.uid) ?? null;
        }
        if (!materialId) {
          freeTextName = item.name || "Unbekanntes Material";
        }

        let editSource: MaterialListEditSource = "generated";
        if (item.manualAdd) editSource = "manual_add";
        else if (item.manualEdit) editSource = "manual_edit";

        allItemRows.push({
          list_id: listId,
          material_id: materialId,
          free_text_name: freeTextName,
          quantity: Number.isFinite(item.quantity) ? item.quantity : 0,
          checked: item.checked ?? false,
          edit_source: editSource,
          sort_order: Number(itemIdx),
        });
      }
    }

    if (headerRows.length > 0) {
      const {error} = await client.from("event_material_lists").insert(headerRows);
      if (error) throw error;
    }

    if (allItemRows.length > 0) {
      const {error} = await client.from("event_material_list_items")
        .insert(allItemRows);
      if (error) throw error;
    }
  }

  /* =====================================================================
  // Lookup-Maps aufbauen
  // ===================================================================== */

  /**
   * Lädt Stammdaten aus Postgres und befüllt die Lookup-Maps.
   */
  private async buildLookupMaps(): Promise<void> {
    const client = supabaseAdmin!;

    const [eventRows, materialRows, menueRows, mealRows] = await Promise.all([
      fetchAllRows(client, "events", "id, firebase_uid"),
      fetchAllRows(client, "materials", "id, firebase_uid"),
      fetchAllRows(client, "event_menues", "id, firebase_uid"),
      fetchAllRows(client, "event_meals", "id, firebase_uid"),
    ]);

    for (const row of eventRows) {
      if (row.firebase_uid) this.eventIdByFirebaseUid.set(row.firebase_uid as string, row.id as string);
    }
    for (const row of materialRows) {
      if (row.firebase_uid) this.materialIdByUid.set(row.firebase_uid as string, row.id as string);
    }
    for (const row of menueRows) {
      if (row.firebase_uid) this.menueIdByFirebaseUid.set(row.firebase_uid as string, row.id as string);
    }
    for (const row of mealRows) {
      if (row.firebase_uid) this.mealIdByFirebaseUid.set(row.firebase_uid as string, row.id as string);
    }
  }
}
