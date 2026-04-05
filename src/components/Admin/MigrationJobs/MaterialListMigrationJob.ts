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
import {supabase} from "../../Database/supabaseClient";
import {SupabaseClient} from "@supabase/supabase-js";
import {MigrationJob, SourceRecord} from "./MigrationJob.interface";
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
   */
  async checkExists(
    database: DatabaseService,
    record: SourceRecord<FirebaseMaterialListData>,
  ): Promise<boolean> {
    const eventId = this.eventIdByFirebaseUid.get(record.data.eventFirebaseUid);
    if (!eventId) return false;

    const client: SupabaseClient = supabase;
    const {data, error} = await client
      .from("event_material_lists")
      .select("id")
      .eq("event_id", eventId)
      .limit(1);

    if (error) throw error;
    return (data ?? []).length > 0;
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
    const client: SupabaseClient = supabase;
    const eventId = this.eventIdByFirebaseUid.get(record.data.eventFirebaseUid);
    if (!eventId) {
      throw new Error(
        `MaterialListMigrationJob: Event ${record.data.eventFirebaseUid} nicht in Postgres gefunden.`,
      );
    }

    for (const [listKey, listEntry] of Object.entries(record.data.materialListDoc.lists)) {
      const props = listEntry.properties;
      if (!props) {
        if (import.meta.env.DEV) console.warn(`MaterialListMigrationJob: Liste ${listKey} hat keine properties, übersprungen.`);
        continue;
      }

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

      // Header einfügen
      const {data: headerRow, error: headerError} = await client
        .from("event_material_lists")
        .insert({
          event_id: eventId,
          name: props.name ?? "",
          selected_menues: selectedMenues,
          selected_meals: selectedMeals,
          has_manually_added_items: hasManuallyAddedItems,
          firebase_uid: props.uid ?? listKey,
        })
        .select("id")
        .single();

      if (headerError) throw headerError;
      const listId = (headerRow as {id: string}).id;

      // Items migrieren
      const items = listEntry.items ?? [];
      if (items.length === 0) continue;

      const itemRows: Array<Record<string, unknown>> = [];

      for (const [itemIdx, item] of items.entries()) {
        let materialId: string | null = null;
        let freeTextName: string | null = null;

        // Material-ID auflösen
        if (item.uid) {
          materialId = this.materialIdByUid.get(item.uid) ?? null;
        }

        // Fallback auf Freitext
        if (!materialId) {
          freeTextName = item.name || "Unbekanntes Material";
        }

        // edit_source bestimmen
        let editSource: MaterialListEditSource = "generated";
        if (item.manualAdd) editSource = "manual_add";
        else if (item.manualEdit) editSource = "manual_edit";

        itemRows.push({
          list_id: listId,
          material_id: materialId,
          free_text_name: freeTextName,
          quantity: Number.isFinite(item.quantity) ? item.quantity : 0,
          checked: item.checked ?? false,
          edit_source: editSource,
          sort_order: Number(itemIdx),
        });
      }

      if (itemRows.length > 0) {
        const {error: itemsError} = await client
          .from("event_material_list_items")
          .insert(itemRows);

        if (itemsError) throw itemsError;
      }
    }
  }

  /* =====================================================================
  // Lookup-Maps aufbauen
  // ===================================================================== */

  /**
   * Lädt Stammdaten aus Postgres und befüllt die Lookup-Maps.
   */
  private async buildLookupMaps(): Promise<void> {
    const client: SupabaseClient = supabase;

    const [eventRows, materialRows, menueRows, mealRows] = await Promise.all([
      client.from("events").select("id, firebase_uid"),
      client.from("materials").select("id, firebase_uid"),
      client.from("event_menues").select("id, firebase_uid"),
      client.from("event_meals").select("id, firebase_uid"),
    ]);

    if (eventRows.error) throw eventRows.error;
    if (materialRows.error) throw materialRows.error;
    if (menueRows.error) throw menueRows.error;
    if (mealRows.error) throw mealRows.error;

    for (const row of eventRows.data ?? []) {
      if (row.firebase_uid) this.eventIdByFirebaseUid.set(row.firebase_uid as string, row.id as string);
    }
    for (const row of materialRows.data ?? []) {
      if (row.firebase_uid) this.materialIdByUid.set(row.firebase_uid as string, row.id as string);
    }
    for (const row of menueRows.data ?? []) {
      if (row.firebase_uid) this.menueIdByFirebaseUid.set(row.firebase_uid as string, row.id as string);
    }
    for (const row of mealRows.data ?? []) {
      if (row.firebase_uid) this.mealIdByFirebaseUid.set(row.firebase_uid as string, row.id as string);
    }
  }
}
