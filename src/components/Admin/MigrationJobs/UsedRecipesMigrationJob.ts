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
import {supabaseAdmin, supabase} from "../../Database/supabaseClient";
import {SupabaseClient} from "@supabase/supabase-js";
import {MigrationJob, SourceRecord} from "./MigrationJob.interface";

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
   *
   * @param database - DatabaseService-Instanz
   * @param record - Der zu prüfende Quelldatensatz
   * @returns true, falls bereits migriert
   */
  async checkExists(
    database: DatabaseService,
    record: SourceRecord<FirebaseUsedRecipesData>,
  ): Promise<boolean> {
    const eventId = this.eventIdByFirebaseUid.get(
      record.data.eventFirebaseUid,
    );
    if (!eventId) return false;

    const client: SupabaseClient = supabaseAdmin ?? supabase;
    const {data, error} = await client
      .from("event_used_recipe_lists")
      .select("id")
      .eq("event_id", eventId)
      .limit(1);

    if (error) throw error;
    return (data ?? []).length > 0;
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
    authUser: AuthUser,
  ): Promise<void> {
    const client: SupabaseClient = supabaseAdmin ?? supabase;

    const eventId = this.eventIdByFirebaseUid.get(
      record.data.eventFirebaseUid,
    );
    if (!eventId) {
      throw new Error(
        `UsedRecipesMigrationJob: Event ${record.data.eventFirebaseUid} nicht in Postgres gefunden.`,
      );
    }

    for (const [listKey, listEntry] of Object.entries(record.data.lists)) {
      const props = listEntry.properties;
      if (!props) {
        if (import.meta.env.DEV) console.warn(
          `UsedRecipesMigrationJob: Liste ${listKey} hat keine properties, wird übersprungen.`,
        );
        continue;
      }

      // Menü-IDs auflösen (Firebase-UID → Postgres-ID)
      const menueIds: string[] = [];
      for (const menueFirebaseUid of props.selectedMenues ?? []) {
        const menueId = this.menueIdByFirebaseUid.get(menueFirebaseUid);
        if (menueId) {
          menueIds.push(menueId);
        } else {
          if (import.meta.env.DEV) console.warn(
            `UsedRecipesMigrationJob: Menü ${menueFirebaseUid} nicht gefunden, ` +
              `wird aus Liste "${props.name}" (Event ${record.data.eventFirebaseUid}) übersprungen.`,
          );
        }
      }

      // Meal-IDs auflösen (Firebase-UID → Postgres-ID)
      const mealIds: string[] = [];
      for (const mealFirebaseUid of props.selectedMeals ?? []) {
        const mealId = this.mealIdByFirebaseUid.get(mealFirebaseUid);
        if (mealId) {
          mealIds.push(mealId);
        } else {
          if (import.meta.env.DEV) console.warn(
            `UsedRecipesMigrationJob: Meal ${mealFirebaseUid} nicht gefunden, ` +
              `wird aus Liste "${props.name}" (Event ${record.data.eventFirebaseUid}) übersprungen.`,
          );
        }
      }

      // Kopfzeile mit Arrays einfügen (ein einziger INSERT)
      const {error: listError} = await client
        .from("event_used_recipe_lists")
        .insert({
          event_id: eventId,
          name: props.name ?? "",
          firebase_uid: props.uid ?? listKey,
          selected_menue_ids: menueIds,
          selected_meal_ids: mealIds,
        });

      if (listError) throw listError;
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
    const client: SupabaseClient = supabaseAdmin ?? supabase;

    const [eventRows, menueRows, mealRows] = await Promise.all([
      client.from("events").select("id, firebase_uid"),
      client.from("event_menues").select("id, firebase_uid"),
      client.from("event_meals").select("id, firebase_uid"),
    ]);

    if (eventRows.error) throw eventRows.error;
    if (menueRows.error) throw menueRows.error;
    if (mealRows.error) throw mealRows.error;

    for (const row of eventRows.data ?? []) {
      if (row.firebase_uid)
        this.eventIdByFirebaseUid.set(
          row.firebase_uid as string,
          row.id as string,
        );
    }
    for (const row of menueRows.data ?? []) {
      if (row.firebase_uid)
        this.menueIdByFirebaseUid.set(
          row.firebase_uid as string,
          row.id as string,
        );
    }
    for (const row of mealRows.data ?? []) {
      if (row.firebase_uid)
        this.mealIdByFirebaseUid.set(
          row.firebase_uid as string,
          row.id as string,
        );
    }
  }
}
