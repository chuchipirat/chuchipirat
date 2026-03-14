/**
 * UsedRecipeListRepository — Repository für benannte Rezeptlisten eines Events.
 *
 * Verwaltet die Tabellen `event_used_recipe_lists` (Kopfdaten) und
 * `event_used_recipe_list_menues` (Menü-Auswahl). Rezepte werden nicht
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
 */
export interface UsedRecipeListRow {
  [key: string]: unknown;
  id: string;
  event_id: string;
  name: string;
  firebase_uid: string | null;
  created_at: string;
  created_by: string | null;
  updated_at: string;
  updated_by: string | null;
}

/**
 * Datenbank-Zeilentyp für event_used_recipe_list_menues.
 * Audit-Spalten entfernt — Tracking erfolgt über event_menuplan_tracking.
 */
export interface UsedRecipeListMenueRow {
  [key: string]: unknown;
  id: string;
  list_id: string;
  menue_id: string;
}

/**
 * Datenbank-Zeilentyp für event_used_recipe_list_meals.
 * Audit-Spalten entfernt — Tracking erfolgt über event_menuplan_tracking.
 */
export interface UsedRecipeListMealRow {
  [key: string]: unknown;
  id: string;
  list_id: string;
  meal_id: string;
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
 * Dummy-Zeilentyp — UsedRecipeListRepository verwaltet zwei Tabellen,
 * daher ist der generische TRow-Parameter nicht direkt nutzbar.
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
 * Verwaltet `event_used_recipe_lists` und `event_used_recipe_list_menues`.
 * Die Rezepte werden per RPC-Funktion aus dem Menuplan abgeleitet und
 * nicht redundant gespeichert.
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
   * Lädt alle Rezeptlisten eines Events inklusive der Menü-Auswahl.
   *
   * @param eventId - Die ID des Events
   * @returns Array aller Listen mit ihren ausgewählten Menüs
   */
  async getListsForEvent(eventId: string): Promise<UsedRecipeListDomain[]> {
    // Listen laden
    const {data: listRows, error: listError} = await this.client
      .from("event_used_recipe_lists")
      .select("*")
      .eq("event_id", eventId)
      .order("created_at");

    if (listError) throw listError;
    if (!listRows || listRows.length === 0) return [];

    const listIds = (listRows as UsedRecipeListRow[]).map((row) => row.id);

    // Menü- und Meal-Zuordnungen parallel laden
    const [menueResult, mealResult] = await Promise.all([
      this.client
        .from("event_used_recipe_list_menues")
        .select("*")
        .in("list_id", listIds),
      this.client
        .from("event_used_recipe_list_meals")
        .select("*")
        .in("list_id", listIds),
    ]);

    if (menueResult.error) throw menueResult.error;
    if (mealResult.error) throw mealResult.error;

    // Menüs nach list_id gruppieren
    const menuesByListId = new Map<string, string[]>();
    for (const row of (menueResult.data ?? []) as UsedRecipeListMenueRow[]) {
      const existing = menuesByListId.get(row.list_id) ?? [];
      existing.push(row.menue_id);
      menuesByListId.set(row.list_id, existing);
    }

    // Meals nach list_id gruppieren
    const mealsByListId = new Map<string, string[]>();
    for (const row of (mealResult.data ?? []) as UsedRecipeListMealRow[]) {
      const existing = mealsByListId.get(row.list_id) ?? [];
      existing.push(row.meal_id);
      mealsByListId.set(row.list_id, existing);
    }

    return (listRows as UsedRecipeListRow[]).map((row) => ({
      id: row.id,
      eventId: row.event_id,
      name: row.name,
      selectedMenues: menuesByListId.get(row.id) ?? [],
      selectedMeals: mealsByListId.get(row.id) ?? [],
      updatedAt: new Date(row.updated_at),
    }));
  }

  /* =====================================================================
  // Neue Liste erstellen
  // ===================================================================== */
  /**
   * Erstellt eine neue Rezeptliste mit Menü- und Meal-Auswahl.
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
    // Kopfzeile einfügen
    const {data: listRow, error: listError} = await this.client
      .from("event_used_recipe_lists")
      .insert({event_id: eventId, name})
      .select("*")
      .single();

    if (listError) throw listError;
    const list = listRow as UsedRecipeListRow;

    // Menü-Zuordnungen einfügen
    if (menueIds.length > 0) {
      const menueRows = menueIds.map((menueId) => ({
        list_id: list.id,
        menue_id: menueId,
      }));
      const {error: menueError} = await this.client
        .from("event_used_recipe_list_menues")
        .insert(menueRows);

      if (menueError) throw menueError;
    }

    // Meal-Zuordnungen einfügen
    if (mealIds.length > 0) {
      const mealRows = mealIds.map((mealId) => ({
        list_id: list.id,
        meal_id: mealId,
      }));
      const {error: mealError} = await this.client
        .from("event_used_recipe_list_meals")
        .insert(mealRows);

      if (mealError) throw mealError;
    }

    return {
      id: list.id,
      eventId: list.event_id,
      name: list.name,
      selectedMenues: menueIds,
      selectedMeals: mealIds,
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
  // Menü-Auswahl aktualisieren (vollständiger Ersatz)
  // ===================================================================== */
  /**
   * Ersetzt die Menü-Auswahl einer Liste komplett (delete-all + re-insert).
   *
   * @param listId - Die ID der Liste
   * @param menueIds - Die neuen Menü-IDs
   */
  async updateListMenues(
    listId: string,
    menueIds: string[],
  ): Promise<void> {
    // Alle bestehenden Zuordnungen löschen
    const {error: deleteError} = await this.client
      .from("event_used_recipe_list_menues")
      .delete()
      .eq("list_id", listId);

    if (deleteError) throw deleteError;

    // Neue Zuordnungen einfügen
    if (menueIds.length > 0) {
      const menueRows = menueIds.map((menueId) => ({
        list_id: listId,
        menue_id: menueId,
      }));
      const {error: insertError} = await this.client
        .from("event_used_recipe_list_menues")
        .insert(menueRows);

      if (insertError) throw insertError;
    }
  }

  /* =====================================================================
  // Meal-Auswahl aktualisieren (vollständiger Ersatz)
  // ===================================================================== */
  /**
   * Ersetzt die Meal-Auswahl einer Liste komplett (delete-all + re-insert).
   *
   * @param listId - Die ID der Liste
   * @param mealIds - Die neuen Meal-IDs
   */
  async updateListMeals(
    listId: string,
    mealIds: string[],
  ): Promise<void> {
    const {error: deleteError} = await this.client
      .from("event_used_recipe_list_meals")
      .delete()
      .eq("list_id", listId);

    if (deleteError) throw deleteError;

    if (mealIds.length > 0) {
      const mealRows = mealIds.map((mealId) => ({
        list_id: listId,
        meal_id: mealId,
      }));
      const {error: insertError} = await this.client
        .from("event_used_recipe_list_meals")
        .insert(mealRows);

      if (insertError) throw insertError;
    }
  }

  /* =====================================================================
  // Menü- und Meal-Auswahl gleichzeitig aktualisieren (Drift-Auflösung)
  // ===================================================================== */
  /**
   * Aktualisiert Menü- und Meal-Auswahl einer Liste in einem Vorgang.
   * Wird bei der Drift-Auflösung verwendet, wenn beide Junction-Tabellen
   * konsistent aktualisiert werden müssen.
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
    await Promise.all([
      this.updateListMenues(listId, menueIds),
      this.updateListMeals(listId, mealIds),
    ]);

    // updated_at der Kopfzeile aktualisieren
    await this.touchListUpdatedAt(listId);
  }

  /* =====================================================================
  // updated_at der Kopfzeile aktualisieren (Touch)
  // ===================================================================== */
  /**
   * Setzt updated_at der Kopfzeile auf NOW(), damit generated.date beim
   * nächsten Laden aus der DB den aktuellen Wert widerspiegelt.
   * Der update_updated_at-Trigger übernimmt das Setzen.
   *
   * @param listId - Die ID der Liste
   */
  async touchListUpdatedAt(listId: string): Promise<void> {
    const {error} = await this.client
      .from("event_used_recipe_lists")
      .update({updated_at: new Date().toISOString()})
      .eq("id", listId);

    if (error) throw error;
  }

  /* =====================================================================
  // Liste löschen (CASCADE entfernt Menü-Zuordnungen)
  // ===================================================================== */
  /**
   * Löscht eine Rezeptliste. CASCADE entfernt automatisch alle Menü-Zuordnungen.
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

    // Einen Channel für die Kopftabelle — Menü-Änderungen lösen ebenfalls
    // ein Update auf der Kopftabelle aus (updated_at Trigger)
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
