/**
 * Migrationsjob für Einkaufslisten von Firebase nach Postgres.
 *
 * Migriert pro Event:
 * 1. ShoppingListCollection aus `events/{uid}/docs/shoppingListCollection`
 *    → Header-Zeilen in `event_shopping_lists`
 * 2. ShoppingList-Docs aus `events/{uid}/shoppingLists/{listUid}`
 *    → Item-Zeilen in `event_shopping_list_items`
 *
 * Keine Trace-Migration nötig — Traces werden on-the-fly aus dem Menüplan berechnet.
 *
 * FK-Auflösungen:
 * - Event-Firebase-UID → events.firebase_uid → events.id
 * - Product-Name → products.name → products.id
 * - Material-Name → materials.name → materials.id
 * - Department-Name → departments.name → departments.id + departments.pos
 * - Unit-Key → units.key (direkt)
 *
 * Voraussetzungen:
 * - Events, Products, Materials, Departments, Units
 *
 * @example
 * const job = new ShoppingListMigrationJob();
 * const records = await job.fetchSourceRecords(firebase, database);
 */
import {collection, doc, getDoc, getDocs} from "firebase/firestore";
import Firebase from "../../Firebase/firebase.class";
import DatabaseService from "../../Database/DatabaseService";
import AuthUser from "../../Firebase/Authentication/authUser.class";
import {supabaseAdmin, supabase} from "../../Database/supabaseClient";
import {SupabaseClient} from "@supabase/supabase-js";
import {MigrationJob, SourceRecord} from "./MigrationJob.interface";
import {ShoppingListEditSource} from "../../Database/Repository/ShoppingListRepository";

/* =====================================================================
// Firebase-Datenstrukturen
// ===================================================================== */

/** Item in einer Einkaufsliste (Firebase-Format). */
interface FirebaseShoppingListItem {
  checked: boolean;
  quantity: number;
  unit: string;
  item: {uid: string; name: string};
  type: number; // 0=none, 1=food, 2=material, 3=custom
  manualEdit?: boolean;
  manualAdd?: boolean;
}

/** Abteilung in einer Einkaufsliste (Firebase-Format). */
interface FirebaseShoppingListDepartment {
  departmentUid: string;
  departmentName: string;
  items: FirebaseShoppingListItem[];
}

/** Einzelne Einkaufsliste (Firebase-Dokument). */
interface FirebaseShoppingList {
  uid: string;
  list: {[departmentPos: string]: FirebaseShoppingListDepartment};
}

/** Properties einer Liste in der Collection. */
interface FirebaseShoppingListProperties {
  uid: string;
  name: string;
  selectedMeals: string[];
  selectedMenues: string[];
  selectedDepartments: string[];
  generated: {date: unknown; fromUid: string; fromDisplayName: string};
  hasManuallyAddedItems: boolean;
}

/** Eintrag in der ShoppingListCollection. */
interface FirebaseShoppingListEntry {
  properties: FirebaseShoppingListProperties;
  trace: unknown; // Nicht migriert — on-the-fly berechnet
}

/** Vollständige Firebase-Daten für ein Event. */
interface FirebaseShoppingListData {
  eventFirebaseUid: string;
  collectionDoc: {
    noOfLists: number;
    lists: {[key: string]: FirebaseShoppingListEntry};
  };
  shoppingLists: {[uid: string]: FirebaseShoppingList};
}

/* =====================================================================
// ShoppingListMigrationJob
// ===================================================================== */

/**
 * Migrations-Job für Einkaufslisten aller Events.
 */
export class ShoppingListMigrationJob
  implements MigrationJob<FirebaseShoppingListData>
{
  name = "Einkaufslisten";
  description =
    "Migriert alle Einkaufslisten von Firebase nach Postgres. " +
    "Legt Header und Items an. Traces werden nicht migriert (on-the-fly Berechnung). " +
    "Setzt voraus, dass Events, Products, Materials, Departments und Units migriert sind.";

  /** firebase_uid → Postgres-ID für Events */
  private eventIdByFirebaseUid: Map<string, string> = new Map();
  /** Product UID (Firebase) → Postgres Product ID */
  private productIdByUid: Map<string, string> = new Map();
  /** Material UID (Firebase) → Postgres Material ID */
  private materialIdByUid: Map<string, string> = new Map();
  /** Department UID (Firebase) → Postgres Department ID */
  private departmentIdByUid: Map<string, string> = new Map();
  /** Department pos (Firebase) → Postgres Department ID */
  private departmentIdByPos: Map<number, string> = new Map();
  /** Menü firebase_uid → Postgres ID */
  private menueIdByFirebaseUid: Map<string, string> = new Map();
  /** Meal firebase_uid → Postgres ID */
  private mealIdByFirebaseUid: Map<string, string> = new Map();

  /* =====================================================================
  // Quelldaten lesen
  // ===================================================================== */

  /**
   * Liest alle Einkaufslisten aus Firestore.
   *
   * @param firebase - Firebase-Instanz
   * @param database - DatabaseService-Instanz (für FK-Lookup-Maps)
   * @returns Array der Quelldatensätze
   */
  async fetchSourceRecords(
    firebase: Firebase,
    database?: DatabaseService,
  ): Promise<SourceRecord<FirebaseShoppingListData>[]> {
    if (database) {
      await this.buildLookupMaps();
    }

    const eventsSnapshot = await getDocs(
      collection(firebase.firestore, "events"),
    );
    const records: SourceRecord<FirebaseShoppingListData>[] = [];

    for (const eventDoc of eventsSnapshot.docs) {
      const eventUid = eventDoc.id;
      if (eventUid === "000_allEvents") continue;

      // ShoppingListCollection lesen
      const collectionRef = doc(
        firebase.firestore,
        "events", eventUid, "docs", "shoppingListCollection",
      );
      const collectionSnap = await getDoc(collectionRef);
      if (!collectionSnap.exists()) continue;

      const collectionData = collectionSnap.data();
      const lists = collectionData.lists ?? {};
      if (Object.keys(lists).length === 0) continue;

      // Einzelne ShoppingLists lesen
      const shoppingLists: {[uid: string]: FirebaseShoppingList} = {};
      const listsSnapshot = await getDocs(
        collection(firebase.firestore, "events", eventUid, "shoppingLists"),
      );

      for (const listDoc of listsSnapshot.docs) {
        const data = listDoc.data();
        shoppingLists[listDoc.id] = {
          uid: listDoc.id,
          list: data.list ?? {},
        };
      }

      records.push({
        id: eventUid,
        label: `Einkaufslisten für Event ${eventUid}`,
        data: {
          eventFirebaseUid: eventUid,
          collectionDoc: {
            noOfLists: collectionData.noOfLists ?? 0,
            lists,
          },
          shoppingLists,
        },
      });
    }

    return records;
  }

  /* =====================================================================
  // Bereits migriert?
  // ===================================================================== */

  /**
   * Prüft ob für das Event bereits Einkaufslisten in Postgres vorhanden sind.
   */
  async checkExists(
    database: DatabaseService,
    record: SourceRecord<FirebaseShoppingListData>,
  ): Promise<boolean> {
    const eventId = this.eventIdByFirebaseUid.get(record.data.eventFirebaseUid);
    if (!eventId) return false;

    const client: SupabaseClient = supabaseAdmin ?? supabase;
    const {data, error} = await client
      .from("event_shopping_lists")
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
   * Migriert alle Einkaufslisten eines Events nach Postgres.
   */
  async migrateRecord(
    database: DatabaseService,
    record: SourceRecord<FirebaseShoppingListData>,
    authUser: AuthUser,
  ): Promise<void> {
    const client: SupabaseClient = supabaseAdmin ?? supabase;
    const eventId = this.eventIdByFirebaseUid.get(record.data.eventFirebaseUid);
    if (!eventId) {
      throw new Error(
        `ShoppingListMigrationJob: Event ${record.data.eventFirebaseUid} nicht in Postgres gefunden.`,
      );
    }

    for (const [listKey, listEntry] of Object.entries(record.data.collectionDoc.lists)) {
      const props = listEntry.properties;
      if (!props) {
        if (import.meta.env.DEV) console.warn(`ShoppingListMigrationJob: Liste ${listKey} hat keine properties, übersprungen.`);
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

      // Department-IDs auflösen
      const selectedDepartments = (props.selectedDepartments ?? [])
        .map((uid) => this.departmentIdByUid.get(uid))
        .filter((id): id is string => !!id);

      // Header einfügen
      const {data: headerRow, error: headerError} = await client
        .from("event_shopping_lists")
        .insert({
          event_id: eventId,
          name: props.name ?? "",
          selected_menues: selectedMenues,
          selected_meals: selectedMeals,
          selected_departments: selectedDepartments,
          has_manually_added_items: props.hasManuallyAddedItems ?? false,
          firebase_uid: props.uid ?? listKey,
        })
        .select("id")
        .single();

      if (headerError) throw headerError;
      const listId = (headerRow as {id: string}).id;

      // Items der Firebase-ShoppingList migrieren
      const firebaseList = record.data.shoppingLists[props.uid ?? listKey];
      if (!firebaseList?.list) continue;

      const itemRows: Array<Record<string, unknown>> = [];

      for (const [departmentPosStr, department] of Object.entries(firebaseList.list)) {
        const departmentPos = Number(departmentPosStr);
        const departmentId = this.departmentIdByPos.get(departmentPos)
          ?? this.departmentIdByUid.get(department.departmentUid)
          ?? null;

        for (const [itemIdx, item] of department.items.entries()) {
          // Typ bestimmen und FK auflösen
          let productId: string | null = null;
          let materialId: string | null = null;
          let freeTextName: string | null = null;

          if (item.type === 1) {
            // Food → Produkt
            productId = this.productIdByUid.get(item.item.uid) ?? null;
            if (!productId) freeTextName = item.item.name || "Unbekanntes Produkt";
          } else if (item.type === 2) {
            // Material
            materialId = this.materialIdByUid.get(item.item.uid) ?? null;
            if (!materialId) freeTextName = item.item.name || "Unbekanntes Material";
          } else {
            // Custom oder none
            freeTextName = item.item.name || "Unbekannt";
          }

          // edit_source bestimmen
          let editSource: ShoppingListEditSource = "generated";
          if (item.manualAdd) editSource = "manual_add";
          else if (item.manualEdit) editSource = "manual_edit";

          itemRows.push({
            list_id: listId,
            product_id: productId,
            material_id: materialId,
            department_id: departmentId,
            free_text_name: freeTextName,
            quantity: Number.isFinite(item.quantity) ? item.quantity : 0,
            unit: item.unit || null,
            checked: item.checked ?? false,
            edit_source: editSource,
            sort_order: itemIdx,
          });
        }
      }

      if (itemRows.length > 0) {
        const {error: itemsError} = await client
          .from("event_shopping_list_items")
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
    const client: SupabaseClient = supabaseAdmin ?? supabase;

    const [eventRows, productRows, materialRows, departmentRows, menueRows, mealRows] = await Promise.all([
      client.from("events").select("id, firebase_uid"),
      client.from("products").select("id, firebase_uid"),
      client.from("materials").select("id, firebase_uid"),
      client.from("departments").select("id, firebase_uid, pos"),
      client.from("event_menues").select("id, firebase_uid"),
      client.from("event_meals").select("id, firebase_uid"),
    ]);

    if (eventRows.error) throw eventRows.error;
    if (productRows.error) throw productRows.error;
    if (materialRows.error) throw materialRows.error;
    if (departmentRows.error) throw departmentRows.error;
    if (menueRows.error) throw menueRows.error;
    if (mealRows.error) throw mealRows.error;

    for (const row of eventRows.data ?? []) {
      if (row.firebase_uid) this.eventIdByFirebaseUid.set(row.firebase_uid as string, row.id as string);
    }
    for (const row of productRows.data ?? []) {
      if (row.firebase_uid) this.productIdByUid.set(row.firebase_uid as string, row.id as string);
    }
    for (const row of materialRows.data ?? []) {
      if (row.firebase_uid) this.materialIdByUid.set(row.firebase_uid as string, row.id as string);
    }
    for (const row of departmentRows.data ?? []) {
      if (row.firebase_uid) this.departmentIdByUid.set(row.firebase_uid as string, row.id as string);
      if (row.pos != null) this.departmentIdByPos.set(row.pos as number, row.id as string);
    }
    for (const row of menueRows.data ?? []) {
      if (row.firebase_uid) this.menueIdByFirebaseUid.set(row.firebase_uid as string, row.id as string);
    }
    for (const row of mealRows.data ?? []) {
      if (row.firebase_uid) this.mealIdByFirebaseUid.set(row.firebase_uid as string, row.id as string);
    }
  }
}
