/**
 * UsedRecipeListRepository — Repository für benannte Rezeptlisten eines Events.
 *
 * Verwaltet die Tabelle `event_used_recipe_lists` mit TEXT[]-Spalten für
 * Menü- und Meal-Auswahl (keine Junction-Tabellen). Rezepte werden nicht
 * gespeichert, sondern per RPC-Funktion `get_used_recipe_list_recipes`
 * aus dem Menuplan abgeleitet.
 *
 * @example
 * const lists = await repo.getListsForEvent(eventId);
 * const recipes = await repo.getRecipesForList(listId);
 */
import {SupabaseClient} from "@supabase/supabase-js";
import {BaseRepository} from "./BaseRepository";
import {
  STORAGE_OBJECT_PROPERTY,
  StorageObjectProperty,
} from "../../Firebase/Db/sessionStorageHandler.class";

/* =====================================================================
// DB-Zeilenstrukturen
// ===================================================================== */

/**
 * Datenbank-Zeilentyp für event_used_recipe_lists.
 *
 * @param id - Primärschlüssel
 * @param event_id - FK auf events
 * @param name - Anzeigename der Liste
 * @param selected_menue_ids - Ausgewählte Menü-IDs als TEXT[]
 * @param selected_meal_ids - Ausgewählte Meal-IDs als TEXT[] (Drift-Erkennung)
 * @param firebase_uid - Firebase-UID (nur für Migration)
 * @param created_at - Erstellungszeitpunkt
 * @param created_by - Ersteller (UUID)
 * @param updated_at - Letzter Änderungszeitpunkt
 * @param updated_by - Letzter Änderer (UUID)
 */
export interface UsedRecipeListRow {
  [key: string]: unknown;
  id: string;
  event_id: string;
  name: string;
  selected_menue_ids: string[];
  selected_meal_ids: string[];
  firebase_uid: string | null;
  created_at: string;
  created_by: string | null;
  updated_at: string;
  updated_by: string | null;
}

/**
 * RPC-Rückgabezeilentyp für get_used_recipe_list_recipes.
 */
export interface UsedRecipeListRecipeRow {
  recipe_id: string;
  recipe_name: string;
  menue_id: string;
  meal_id: string;
  meal_date: string;
  meal_type_name: string;
}

/* =====================================================================
// Domain-Modelle
// ===================================================================== */

/**
 * Domain-Modell einer benannten Rezeptliste.
 *
 * @param id - Eindeutige ID der Liste
 * @param eventId - ID des zugehörigen Events
 * @param name - Anzeigename der Liste (z.B. "Samstagsrezepte")
 * @param selectedMenues - Array der ausgewählten Menü-IDs
 * @param selectedMeals - Array der ausgewählten Meal-IDs (für Drift-Erkennung)
 * @param updatedAt - Zeitstempel der letzten Aktualisierung
 */
export interface UsedRecipeListDomain {
  id: string;
  eventId: string;
  name: string;
  selectedMenues: string[];
  /** Ausgewählte Meal-IDs — persistiert für Drift-Erkennung bei verschobenen Menüs. */
  selectedMeals: string[];
  /** Zeitstempel der letzten Aktualisierung — für die «Veraltet»-Warnung im UI. */
  updatedAt: Date;
}

/**
 * Domain-Modell eines abgeleiteten Rezepts aus einer Liste.
 *
 * @param recipeId - ID des Rezepts (leer wenn gelöscht)
 * @param recipeName - Name des Rezepts (oder gelöschter Platzhalter)
 * @param menueId - ID des Menüs, aus dem das Rezept stammt
 * @param mealId - ID der Mahlzeit
 * @param mealDate - Datum der Mahlzeit
 * @param mealTypeName - Name des Mahlzeitentyps (z.B. "Frühstück")
 */
export interface UsedRecipeListRecipe {
  recipeId: string;
  recipeName: string;
  menueId: string;
  mealId: string;
  mealDate: Date;
  mealTypeName: string;
}

/* =====================================================================
// Dummy-Row-Typ für BaseRepository
// ===================================================================== */

/**
 * Dummy-Zeilentyp — UsedRecipeListRepository verwendet eigene Query-Methoden.
 */
interface UsedRecipeListDummyRow {
  [key: string]: unknown;
  id: string;
}

/* =====================================================================
// UsedRecipeListRepository
// ===================================================================== */

/**
 * Repository für benannte Rezeptlisten eines Events.
 *
 * Verwaltet `event_used_recipe_lists` mit TEXT[]-Arrays für die Menü-
 * und Meal-Auswahl. Die Rezepte werden per RPC-Funktion aus dem
 * Menuplan abgeleitet und nicht redundant gespeichert.
 */
export class UsedRecipeListRepository extends BaseRepository<
  UsedRecipeListDomain,
  UsedRecipeListDummyRow
> {
  tableName = "event_used_recipe_lists";

  constructor(client?: SupabaseClient) {
    super(client);
  }

  getCacheConfig(): StorageObjectProperty {
    return STORAGE_OBJECT_PROPERTY.USED_RECIPES;
  }

  /**
   * Nicht verwendet — Listen werden via getListsForEvent() geladen.
   * @param _domain - Nicht verwendet
   * @returns Leere partielle Zeile
   */
  toRow(_domain: UsedRecipeListDomain): Partial<UsedRecipeListDummyRow> {
    return {};
  }

  /**
   * Nicht verwendet — Listen werden via getListsForEvent() geladen.
   * @param _row - Nicht verwendet
   * @returns Leeres UsedRecipeListDomain
   */
  toDomain(_row: UsedRecipeListDummyRow): UsedRecipeListDomain {
    return {id: "", eventId: "", name: "", selectedMenues: [], selectedMeals: [], updatedAt: new Date(0)};
  }

  /* =====================================================================
  // Listen für ein Event laden
  // ===================================================================== */
  /**
   * Lädt alle Rezeptlisten eines Events inklusive Menü- und Meal-Auswahl.
   * Menüs und Meals werden direkt aus den TEXT[]-Spalten gelesen.
   *
   * @param eventId - Die ID des Events
   * @returns Array aller Listen mit ihren ausgewählten Menüs und Meals
   */
  async getListsForEvent(eventId: string): Promise<UsedRecipeListDomain[]> {
    const {data: listRows, error} = await this.client
      .from("event_used_recipe_lists")
      .select("*")
      .eq("event_id", eventId)
      .order("created_at");

    if (error) throw error;
    if (!listRows || listRows.length === 0) return [];

    return (listRows as UsedRecipeListRow[]).map((row) => ({
      id: row.id,
      eventId: row.event_id,
      name: row.name,
      selectedMenues: row.selected_menue_ids ?? [],
      selectedMeals: row.selected_meal_ids ?? [],
      updatedAt: new Date(row.updated_at),
    }));
  }

  /* =====================================================================
  // Neue Liste erstellen
  // ===================================================================== */
  /**
   * Erstellt eine neue Rezeptliste mit Menü- und Meal-Auswahl als TEXT[].
   *
   * @param eventId - Die ID des Events
   * @param name - Anzeigename der Liste
   * @param menueIds - Array der ausgewählten Menü-IDs
   * @param mealIds - Array der ausgewählten Meal-IDs (für Drift-Erkennung)
   * @returns Die erstellte Liste mit generierter ID
   */
  async createList(
    eventId: string,
    name: string,
    menueIds: string[],
    mealIds: string[] = [],
  ): Promise<UsedRecipeListDomain> {
    const {data: listRow, error} = await this.client
      .from("event_used_recipe_lists")
      .insert({
        event_id: eventId,
        name,
        selected_menue_ids: menueIds,
        selected_meal_ids: mealIds,
      })
      .select("*")
      .single();

    if (error) throw error;
    const list = listRow as UsedRecipeListRow;

    return {
      id: list.id,
      eventId: list.event_id,
      name: list.name,
      selectedMenues: list.selected_menue_ids ?? [],
      selectedMeals: list.selected_meal_ids ?? [],
      updatedAt: new Date(list.updated_at),
    };
  }

  /* =====================================================================
  // Listenname aktualisieren
  // ===================================================================== */
  /**
   * Aktualisiert den Namen einer bestehenden Liste.
   *
   * @param listId - Die ID der zu aktualisierenden Liste
   * @param name - Der neue Name
   */
  async updateListName(listId: string, name: string): Promise<void> {
    const {error} = await this.client
      .from("event_used_recipe_lists")
      .update({name})
      .eq("id", listId);

    if (error) throw error;
  }

  /* =====================================================================
  // Menü-Auswahl aktualisieren
  // ===================================================================== */
  /**
   * Aktualisiert die Menü-Auswahl einer Liste (einfacher Array-Update).
   *
   * @param listId - Die ID der Liste
   * @param menueIds - Die neuen Menü-IDs
   */
  async updateListMenues(
    listId: string,
    menueIds: string[],
  ): Promise<void> {
    const {error} = await this.client
      .from("event_used_recipe_lists")
      .update({selected_menue_ids: menueIds})
      .eq("id", listId);

    if (error) throw error;
  }

  /* =====================================================================
  // Meal-Auswahl aktualisieren
  // ===================================================================== */
  /**
   * Aktualisiert die Meal-Auswahl einer Liste (einfacher Array-Update).
   *
   * @param listId - Die ID der Liste
   * @param mealIds - Die neuen Meal-IDs
   */
  async updateListMeals(
    listId: string,
    mealIds: string[],
  ): Promise<void> {
    const {error} = await this.client
      .from("event_used_recipe_lists")
      .update({selected_meal_ids: mealIds})
      .eq("id", listId);

    if (error) throw error;
  }

  /* =====================================================================
  // Menü- und Meal-Auswahl gleichzeitig aktualisieren (Drift-Auflösung)
  // ===================================================================== */
  /**
   * Aktualisiert Menü- und Meal-Auswahl einer Liste in einem einzigen
   * UPDATE-Statement. Wird bei der Drift-Auflösung verwendet.
   * Der update_updated_at-Trigger aktualisiert updated_at automatisch.
   *
   * @param listId - Die ID der Liste
   * @param menueIds - Die neuen Menü-IDs
   * @param mealIds - Die neuen Meal-IDs
   */
  async updateListMenuesAndMeals(
    listId: string,
    menueIds: string[],
    mealIds: string[],
  ): Promise<void> {
    const {error} = await this.client
      .from("event_used_recipe_lists")
      .update({
        selected_menue_ids: menueIds,
        selected_meal_ids: mealIds,
      })
      .eq("id", listId);

    if (error) throw error;
  }

  /* =====================================================================
  // Liste löschen (CASCADE entfernt zugehörige Daten)
  // ===================================================================== */
  /**
   * Löscht eine Rezeptliste.
   *
   * @param listId - Die ID der zu löschenden Liste
   */
  async deleteList(listId: string): Promise<void> {
    const {error} = await this.client
      .from("event_used_recipe_lists")
      .delete()
      .eq("id", listId);

    if (error) throw error;
  }

  /* =====================================================================
  // Rezepte für eine Liste ableiten (RPC)
  // ===================================================================== */
  /**
   * Leitet die Rezepte einer Liste per RPC-Funktion aus dem Menuplan ab.
   * Ein einziger Datenbankaufruf statt 3+ Queries.
   *
   * @param listId - Die ID der Liste
   * @returns Array der abgeleiteten Rezepte
   */
  async getRecipesForList(listId: string): Promise<UsedRecipeListRecipe[]> {
    const {data, error} = await this.client.rpc(
      "get_used_recipe_list_recipes",
      {p_list_id: listId},
    );

    if (error) throw error;

    return ((data ?? []) as UsedRecipeListRecipeRow[]).map((row) => ({
      recipeId: row.recipe_id,
      recipeName: row.recipe_name,
      menueId: row.menue_id,
      mealId: row.meal_id,
      mealDate: new Date(row.meal_date),
      mealTypeName: row.meal_type_name,
    }));
  }

  /* =====================================================================
  // Echtzeit-Subscription für Listen eines Events
  // ===================================================================== */
  /**
   * Abonniert Echtzeit-Änderungen der Rezeptlisten eines Events.
   *
   * Überwacht die Tabelle `event_used_recipe_lists`. Bei jeder Änderung
   * werden alle Listen via getListsForEvent() neu geladen und an den
   * onData-Callback übergeben.
   *
   * @param eventId - Die ID des Events
   * @param onData - Callback, der bei jeder Änderung die aktuellen Listen erhält
   * @param onError - Callback bei Fehler
   * @returns Unsubscribe-Funktion
   *
   * @example
   * const unsubscribe = repo.subscribeToLists(
   *   eventId,
   *   (lists) => setLists(lists),
   *   (error) => console.error(error),
   * );
   */
  subscribeToLists(
    eventId: string,
    onData: (lists: UsedRecipeListDomain[]) => void,
    onError: (error: Error) => void,
  ): () => void {
    const clientRef = this.client;

    const reloadLists = () => {
      this.getListsForEvent(eventId)
        .then((lists) => onData(lists))
        .catch((err) =>
          onError(err instanceof Error ? err : new Error(String(err))),
        );
    };

    const channel = clientRef
      .channel(`usedrecipelists:${eventId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "event_used_recipe_lists",
          filter: `event_id=eq.${eventId}`,
        },
        reloadLists,
      )
      .subscribe((status, err) => {
        console.debug(
          `Realtime usedrecipelists:${eventId} status: ${status}`,
          err ?? "",
        );
        if (status === "CHANNEL_ERROR") {
          onError(
            new Error(`Realtime-Fehler für usedrecipelists:${eventId}`),
          );
        }
      });

    return () => {
      clientRef.removeChannel(channel);
    };
  }
}
