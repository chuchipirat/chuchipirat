/**
 * Migrationsjob für UsedRecipes (benannte Rezeptlisten) von Firebase nach Postgres.
 *
 * Migriert alle UsedRecipes-Dokumente aus `events/{uid}/docs/usedRecipes`.
 * Pro Liste wird ein `event_used_recipe_lists`-Eintrag angelegt, mit
 * `selected_menue_ids` und `selected_meal_ids` als TEXT[]-Spalten.
 *
 * FK-Auflösungen:
 * - Event-Firebase-UID → events.firebase_uid → events.id
 * - Menue-Firebase-UID → event_menues.firebase_uid → event_menues.id
 * - Meal-Firebase-UID → event_meals.firebase_uid → event_meals.id
 *
 * Voraussetzungen (müssen vor diesem Job ausgeführt worden sein):
 * - Events, Menupläne (für event_menues und event_meals)
 *
 * @example
 * const job = new UsedRecipesMigrationJob();
 * const records = await job.fetchSourceRecords(firebase, database);
 */
import {collection, doc, getDoc, getDocs} from "firebase/firestore";
import Firebase from "../../Firebase/firebase.class";
import DatabaseService from "../../Database/DatabaseService";
import AuthUser from "../../Firebase/Authentication/authUser.class";
import {supabaseAdmin} from "../../Database/supabaseClient";
import {MigrationJob, SourceRecord, fetchAllRows} from "./MigrationJob.interface";

/* =====================================================================
// Firebase-Datenstrukturen
// ===================================================================== */

/** Einzelner Listen-Eintrag aus dem Firebase-UsedRecipes-Dokument. */
interface FirebaseUsedRecipeListEntry {
  properties: {
    uid: string;
    name: string;
    selectedMeals: string[];
    selectedMenues: string[];
  };
  // recipes wird ignoriert — in Supabase per RPC abgeleitet
}

/** Vollständige Firebase-Datenstruktur des UsedRecipes-Dokuments eines Events. */
interface FirebaseUsedRecipesData {
  eventFirebaseUid: string;
  noOfLists: number;
  lists: {[key: string]: FirebaseUsedRecipeListEntry};
}

/* =====================================================================
// UsedRecipesMigrationJob
// ===================================================================== */

/**
 * Migrations-Job für UsedRecipes aller Events.
 *
 * Baut beim ersten Aufruf Lookup-Maps auf (Events, Menüs, Meals).
 */
export class UsedRecipesMigrationJob
  implements MigrationJob<FirebaseUsedRecipesData>
{
  name = "Verwendete Rezepte (benannte Listen)";
  description =
    "Migriert alle UsedRecipes-Listen von Firebase nach Postgres. " +
    "Schreibt Menü- und Meal-Auswahl als TEXT[]-Arrays auf die Kopfzeile. " +
    "Setzt voraus, dass Events und Menupläne bereits migriert sind.";

  /** firebase_uid → Postgres-ID für Events */
  private eventIdByFirebaseUid: Map<string, string> = new Map();
  /** firebase_uid → Postgres-ID für Menüs (event-übergreifend) */
  private menueIdByFirebaseUid: Map<string, string> = new Map();
  /** firebase_uid → Postgres-ID für Meals (event-übergreifend) */
  private mealIdByFirebaseUid: Map<string, string> = new Map();
  /** Bereits migrierte Event-IDs (Postgres) für schnelle Existenzprüfung */
  private existingEventIds: Set<string> | null = null;

  /* =====================================================================
  // Alle UsedRecipes aus Firebase lesen
  // ===================================================================== */
  /**
   * Liest alle UsedRecipes-Dokumente aus Firestore und baut Lookup-Maps auf.
   *
   * @param firebase - Firebase-Instanz
   * @param database - DatabaseService-Instanz (für FK-Lookup-Maps)
   * @returns Array aller UsedRecipes-Quelldatensätze
   */
  async fetchSourceRecords(
    firebase: Firebase,
    database?: DatabaseService,
  ): Promise<SourceRecord<FirebaseUsedRecipesData>[]> {
    if (database) {
      await this.buildLookupMaps();

      // Bereits migrierte Event-IDs vorladen für schnelle Existenzprüfung
      const existingRows = await fetchAllRows(supabaseAdmin!, "event_used_recipe_lists", "event_id");
      this.existingEventIds = new Set(existingRows.map((row) => row.event_id as string));
    }

    const eventsSnapshot = await getDocs(
      collection(firebase.firestore, "events"),
    );
    const records: SourceRecord<FirebaseUsedRecipesData>[] = [];

    for (const eventDoc of eventsSnapshot.docs) {
      const eventUid = eventDoc.id;
      if (eventUid === "000_allEvents") continue;

      const usedRecipesRef = doc(
        firebase.firestore,
        "events",
        eventUid,
        "docs",
        "usedRecipes",
      );
      const usedRecipesSnap = await getDoc(usedRecipesRef);

      if (!usedRecipesSnap.exists()) continue;

      const value = usedRecipesSnap.data();
      const lists = value.lists ?? {};

      // Leere Dokumente überspringen (keine Listen vorhanden)
      if (Object.keys(lists).length === 0) continue;

      records.push({
        id: eventUid,
        label: `UsedRecipes für Event ${eventUid}`,
        data: {
          eventFirebaseUid: eventUid,
          noOfLists: value.noOfLists ?? 0,
          lists,
        },
      });
    }

    return records;
  }

  /* =====================================================================
  // Prüfen ob UsedRecipes bereits migriert wurden
  // ===================================================================== */
  /**
   * Prüft ob für das Event bereits UsedRecipe-Listen in Postgres vorhanden sind.
   * Nutzt das vorab geladene Set für O(1)-Lookups statt einzelner DB-Abfragen.
   *
   * @param _database - DatabaseService-Instanz (nicht verwendet)
   * @param record - Der zu prüfende Quelldatensatz
   * @returns true, falls bereits migriert
   */
  async checkExists(
    _database: DatabaseService,
    record: SourceRecord<FirebaseUsedRecipesData>,
  ): Promise<boolean> {
    const eventId = this.eventIdByFirebaseUid.get(
      record.data.eventFirebaseUid,
    );
    if (!eventId) return false;
    return this.existingEventIds?.has(eventId) ?? false;
  }

  /* =====================================================================
  // Einzelnes UsedRecipes-Dokument nach Postgres migrieren
  // ===================================================================== */
  /**
   * Migriert alle Listen eines Events nach Postgres.
   *
   * Pro Liste:
   * 1. Firebase-UIDs der selectedMenues → Postgres-IDs auflösen
   * 2. Firebase-UIDs der selectedMeals → Postgres-IDs auflösen
   * 3. Kopfzeile mit TEXT[]-Arrays in event_used_recipe_lists einfügen
   *
   * @param database - DatabaseService-Instanz
   * @param record - Der zu migrierende Quelldatensatz
   * @param authUser - Der angemeldete Admin-Benutzer
   */
  async migrateRecord(
    database: DatabaseService,
    record: SourceRecord<FirebaseUsedRecipesData>,
    _authUser: AuthUser,
  ): Promise<void> {
    const client = supabaseAdmin!;

    const eventId = this.eventIdByFirebaseUid.get(
      record.data.eventFirebaseUid,
    );
    if (!eventId) {
      throw new Error(
        `UsedRecipesMigrationJob: Event ${record.data.eventFirebaseUid} nicht in Postgres gefunden.`,
      );
    }

    // Alle Listen sammeln und als Batch einfügen
    const listRows: Record<string, unknown>[] = [];

    for (const [listKey, listEntry] of Object.entries(record.data.lists)) {
      const props = listEntry.properties;
      if (!props) continue;

      const menueIds = (props.selectedMenues ?? [])
        .map((uid) => this.menueIdByFirebaseUid.get(uid))
        .filter((id): id is string => !!id);

      const mealIds = (props.selectedMeals ?? [])
        .map((uid) => this.mealIdByFirebaseUid.get(uid))
        .filter((id): id is string => !!id);

      listRows.push({
        event_id: eventId,
        name: props.name ?? "",
        firebase_uid: props.uid ?? listKey,
        selected_menue_ids: menueIds,
        selected_meal_ids: mealIds,
      });
    }

    if (listRows.length > 0) {
      const {error} = await client
        .from("event_used_recipe_lists")
        .insert(listRows);
      if (error) throw error;
    }
  }

  /* =====================================================================
  // Hilfsmethode: Lookup-Maps aufbauen
  // ===================================================================== */
  /**
   * Lädt Events, Menüs und Meals aus Postgres und befüllt die Lookup-Maps.
   *
   * @throws {PostgrestError} bei Datenbankfehler
   */
  private async buildLookupMaps(): Promise<void> {
    const client = supabaseAdmin!;

    const [eventRows, menueRows, mealRows] = await Promise.all([
      fetchAllRows(client, "events", "id, firebase_uid"),
      fetchAllRows(client, "event_menues", "id, firebase_uid"),
      fetchAllRows(client, "event_meals", "id, firebase_uid"),
    ]);

    for (const row of eventRows) {
      if (row.firebase_uid)
        this.eventIdByFirebaseUid.set(
          row.firebase_uid as string,
          row.id as string,
        );
    }
    for (const row of menueRows) {
      if (row.firebase_uid)
        this.menueIdByFirebaseUid.set(
          row.firebase_uid as string,
          row.id as string,
        );
    }
    for (const row of mealRows) {
      if (row.firebase_uid)
        this.mealIdByFirebaseUid.set(
          row.firebase_uid as string,
          row.id as string,
        );
    }
  }
}
