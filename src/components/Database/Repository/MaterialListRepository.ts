/**
 * MaterialListRepository — Repository für Materiallisten eines Events.
 *
 * Verwaltet die Tabellen `event_material_lists` (Kopfdaten) und
 * `event_material_list_items` (Positionen). Lese-Operationen auf Items
 * verwenden die VIEW `event_material_list_items_view` für aufgelöste
 * Namen und Koch-Zuordnungen.
 *
 * @example
 * const headers = await repo.getListsForEvent(eventId);
 * const items = await repo.getListItems(listId);
 */
import {SupabaseClient} from "@supabase/supabase-js";
import * as Sentry from "@sentry/react";
import {BaseRepository} from "./BaseRepository";
import {
  STORAGE_OBJECT_PROPERTY,
  StorageObjectProperty,
} from "../../Firebase/Db/sessionStorageHandler.class";

/* =====================================================================
// DB-Zeilenstrukturen
// ===================================================================== */

/**
 * Datenbank-Zeilentyp für event_material_lists.
 */
export interface MaterialListHeaderRow {
  [key: string]: unknown;
  id: string;
  event_id: string;
  name: string;
  selected_menues: string[];
  selected_meals: string[];
  has_manually_added_items: boolean;
  firebase_uid: string | null;
  created_at: string;
  created_by: string | null;
  updated_at: string;
  updated_by: string | null;
}

/**
 * Datenbank-Zeilentyp für event_material_list_items_view.
 */
export interface MaterialListItemViewRow {
  [key: string]: unknown;
  id: string;
  list_id: string;
  material_id: string | null;
  free_text_name: string | null;
  quantity: number;
  checked: boolean;
  edit_source: "generated" | "manual_add" | "manual_edit";
  sort_order: number;
  assigned_cook_id: string | null;
  assigned_cook_name: string | null;
  created_at: string;
  updated_at: string;
  item_name: string;
  resolved_cook_name: string | null;
  assigned_cook_user_id: string | null;
}

/**
 * Datenbank-Zeilentyp für Schreib-Operationen auf event_material_list_items.
 */
export interface MaterialListItemInsertRow {
  id?: string;
  list_id: string;
  material_id?: string | null;
  free_text_name?: string | null;
  quantity: number;
  checked?: boolean;
  edit_source: "generated" | "manual_add" | "manual_edit";
  sort_order?: number;
  assigned_cook_id?: string | null;
  assigned_cook_name?: string | null;
}

/* =====================================================================
// Domain-Modelle
// ===================================================================== */

/** Herkunft einer Materiallistenposition. */
export type MaterialListEditSource = "generated" | "manual_add" | "manual_edit";

/**
 * Domain-Modell einer Materiallisten-Kopfzeile.
 *
 * @param id - Eindeutige ID der Liste
 * @param eventId - ID des zugehörigen Events
 * @param name - Anzeigename der Liste
 * @param selectedMenues - Ausgewählte Menü-IDs
 * @param selectedMeals - Ausgewählte Meal-IDs (für Drift-Erkennung)
 * @param hasManuallyAddedItems - Hat manuell hinzugefügte Positionen
 * @param updatedAt - Zeitstempel der letzten Aktualisierung
 */
export interface MaterialListHeaderDomain {
  id: string;
  eventId: string;
  name: string;
  selectedMenues: string[];
  selectedMeals: string[];
  hasManuallyAddedItems: boolean;
  updatedAt: Date;
}

/**
 * Domain-Modell einer Materiallistenposition (aufgelöst via VIEW).
 *
 * @param id - Eindeutige ID des Items
 * @param listId - Zugehörige Listen-ID
 * @param materialId - Material-ID (oder null)
 * @param freeTextName - Freitext-Name (oder null)
 * @param quantity - Menge
 * @param checked - Abgehakt-Status
 * @param editSource - Herkunft (generated, manual_add, manual_edit)
 * @param sortOrder - Sortierreihenfolge
 * @param itemName - Aufgelöster Anzeigename
 * @param assignedCookId - ID des zugewiesenen Kochs (event_cooks.id)
 * @param assignedCookName - Freitext-Kochname (Fallback)
 * @param resolvedCookName - Aufgelöster Koch-Anzeigename
 * @param assignedCookUserId - Auth-User-ID des Kochs (nullable)
 */
export interface MaterialListItemDomain {
  id: string;
  listId: string;
  materialId: string | null;
  freeTextName: string | null;
  quantity: number;
  checked: boolean;
  editSource: MaterialListEditSource;
  sortOrder: number;
  itemName: string;
  assignedCookId: string | null;
  assignedCookName: string | null;
  resolvedCookName: string | null;
  assignedCookUserId: string | null;
}

/* =====================================================================
// Dummy-Row-Typ für BaseRepository
// ===================================================================== */

interface MaterialListDummyRow {
  [key: string]: unknown;
  id: string;
}

/* =====================================================================
// MaterialListRepository
// ===================================================================== */

/**
 * Repository für Materiallisten eines Events.
 *
 * Verwaltet `event_material_lists` und `event_material_list_items`.
 * Lese-Operationen auf Items verwenden die VIEW für aufgelöste Daten.
 */
export class MaterialListRepository extends BaseRepository<
  MaterialListHeaderDomain,
  MaterialListDummyRow
> {
  tableName = "event_material_lists";

  constructor(client?: SupabaseClient) {
    super(client);
  }

  getCacheConfig(): StorageObjectProperty {
    return STORAGE_OBJECT_PROPERTY.MATERIAL_LISTS;
  }

  /**
   * Nicht verwendet — Listen werden via getListsForEvent() geladen.
   */
  toRow(_domain: MaterialListHeaderDomain): Partial<MaterialListDummyRow> {
    return {};
  }

  /**
   * Nicht verwendet — Listen werden via getListsForEvent() geladen.
   */
  toDomain(_row: MaterialListDummyRow): MaterialListHeaderDomain {
    return {
      id: "",
      eventId: "",
      name: "",
      selectedMenues: [],
      selectedMeals: [],
      hasManuallyAddedItems: false,
      updatedAt: new Date(0),
    };
  }

  /* =====================================================================
  // Kopfzeilen laden
  // ===================================================================== */

  /**
   * Lädt alle Materiallisten-Header eines Events.
   *
   * @param eventId - Die ID des Events
   * @returns Array aller Listen-Header, sortiert nach Erstellungszeitpunkt
   */
  async getListsForEvent(eventId: string): Promise<MaterialListHeaderDomain[]> {
    const {data, error} = await this.client
      .from("event_material_lists")
      .select("*")
      .eq("event_id", eventId)
      .order("created_at");

    if (error) {
      Sentry.captureException(error);
      throw error;
    }
    if (!data || data.length === 0) return [];

    return (data as MaterialListHeaderRow[]).map(this.headerRowToDomain);
  }

  /* =====================================================================
  // Items einer Liste laden (aus VIEW)
  // ===================================================================== */

  /**
   * Lädt alle Positionen einer Liste aus der VIEW mit aufgelösten
   * Material-Namen und Koch-Zuordnungen. Sortiert nach Sort-Order.
   *
   * @param listId - Die ID der Materialliste
   * @returns Array der aufgelösten Positionen
   */
  async getListItems(listId: string): Promise<MaterialListItemDomain[]> {
    const {data, error} = await this.client
      .from("event_material_list_items_view")
      .select("*")
      .eq("list_id", listId)
      .order("sort_order", {ascending: true});

    if (error) {
      Sentry.captureException(error);
      throw error;
    }
    if (!data || data.length === 0) return [];

    return (data as MaterialListItemViewRow[]).map(this.itemViewRowToDomain);
  }

  /* =====================================================================
  // Neue Liste erstellen
  // ===================================================================== */

  /**
   * Erstellt eine neue Materialliste mit Header und Items.
   *
   * @param eventId - Die ID des Events
   * @param header - Kopfdaten (Name, Auswahlen, Flags)
   * @param items - Array der Positionen zum Einfügen
   * @returns Der erstellte Header mit generierter ID
   */
  async createList(
    eventId: string,
    header: Omit<MaterialListHeaderDomain, "id" | "eventId" | "updatedAt">,
    items: MaterialListItemInsertRow[],
  ): Promise<MaterialListHeaderDomain> {
    // Kopfzeile einfügen
    const {data: headerRow, error: headerError} = await this.client
      .from("event_material_lists")
      .insert({
        event_id: eventId,
        name: header.name,
        selected_menues: header.selectedMenues,
        selected_meals: header.selectedMeals,
        has_manually_added_items: header.hasManuallyAddedItems,
      })
      .select("*")
      .single();

    if (headerError) {
      Sentry.captureException(headerError);
      throw headerError;
    }
    const created = headerRow as MaterialListHeaderRow;

    // Items einfügen (falls vorhanden)
    if (items.length > 0) {
      const itemRows = items.map((item) => ({
        ...item,
        list_id: created.id,
      }));
      const {error: itemsError} = await this.client
        .from("event_material_list_items")
        .insert(itemRows);

      if (itemsError) {
        Sentry.captureException(itemsError);
        throw itemsError;
      }
    }

    return this.headerRowToDomain(created);
  }

  /* =====================================================================
  // Items einer Liste speichern (delete-all + re-insert)
  // ===================================================================== */

  /**
   * Ersetzt alle Items einer Liste komplett (delete-all + re-insert).
   * Wird beim Neuberechnen oder nach Änderungen verwendet.
   *
   * @param listId - Die ID der Liste
   * @param items - Die neuen Items
   */
  async saveListItems(
    listId: string,
    items: MaterialListItemInsertRow[],
  ): Promise<void> {
    // Bestehende Items löschen
    const {error: deleteError} = await this.client
      .from("event_material_list_items")
      .delete()
      .eq("list_id", listId);

    if (deleteError) {
      Sentry.captureException(deleteError);
      throw deleteError;
    }

    // Neue Items einfügen
    if (items.length > 0) {
      const itemRows = items.map((item) => ({
        ...item,
        list_id: listId,
      }));
      const {error: insertError} = await this.client
        .from("event_material_list_items")
        .insert(itemRows);

      if (insertError) {
        Sentry.captureException(insertError);
        throw insertError;
      }
    }
  }

  /* =====================================================================
  // Einzelnes Item einfügen
  // ===================================================================== */

  /**
   * Fügt ein einzelnes neues Item in eine bestehende Liste ein.
   * Leichtgewichtiger als saveListItems (kein delete-all + re-insert).
   *
   * @param listId - Die ID der Liste
   * @param item - Das einzufügende Item
   */
  async insertItem(
    listId: string,
    item: MaterialListItemInsertRow,
  ): Promise<void> {
    const {error} = await this.client
      .from("event_material_list_items")
      .insert({...item, list_id: listId});

    if (error) {
      Sentry.captureException(error);
      throw error;
    }
  }

  /* =====================================================================
  // Header aktualisieren
  // ===================================================================== */

  /**
   * Aktualisiert ausgewählte Felder der Kopfzeile.
   * Der update_updated_at-Trigger setzt updated_at automatisch.
   *
   * @param listId - Die ID der Liste
   * @param updates - Partielle Header-Felder zum Aktualisieren
   */
  async updateListHeader(
    listId: string,
    updates: Partial<{
      name: string;
      selected_menues: string[];
      selected_meals: string[];
      has_manually_added_items: boolean;
    }>,
  ): Promise<void> {
    const {error} = await this.client
      .from("event_material_lists")
      .update(updates)
      .eq("id", listId);

    if (error) {
      Sentry.captureException(error);
      throw error;
    }
  }

  /* =====================================================================
  // Einzelnes Item: Checkbox umschalten
  // ===================================================================== */

  /**
   * Schaltet den Checked-Status eines einzelnen Items um.
   * Granularer als saveListItems für bessere Performance.
   *
   * @param itemId - Die ID des Items
   * @param checked - Der neue Checked-Status
   */
  async updateItemChecked(itemId: string, checked: boolean): Promise<void> {
    const {error} = await this.client
      .from("event_material_list_items")
      .update({checked})
      .eq("id", itemId);

    if (error) {
      Sentry.captureException(error);
      throw error;
    }
  }

  /* =====================================================================
  // Einzelnes Item aktualisieren
  // ===================================================================== */

  /**
   * Aktualisiert einzelne Felder eines Items.
   *
   * @param itemId - Die ID des Items
   * @param updates - Partielle Item-Felder zum Aktualisieren
   */
  async updateItem(
    itemId: string,
    updates: Partial<{
      material_id: string | null;
      free_text_name: string | null;
      quantity: number;
      checked: boolean;
      edit_source: MaterialListEditSource;
      sort_order: number;
      assigned_cook_id: string | null;
      assigned_cook_name: string | null;
    }>,
  ): Promise<void> {
    const {error} = await this.client
      .from("event_material_list_items")
      .update(updates)
      .eq("id", itemId);

    if (error) {
      Sentry.captureException(error);
      throw error;
    }
  }

  /* =====================================================================
  // Liste löschen (CASCADE entfernt Items)
  // ===================================================================== */

  /**
   * Löscht eine Materialliste. CASCADE entfernt automatisch alle Items.
   *
   * @param listId - Die ID der zu löschenden Liste
   */
  async deleteList(listId: string): Promise<void> {
    const {error} = await this.client
      .from("event_material_lists")
      .delete()
      .eq("id", listId);

    if (error) {
      Sentry.captureException(error);
      throw error;
    }
  }

  /* =====================================================================
  // Echtzeit-Subscription: Kopfzeilen
  // ===================================================================== */

  /**
   * Abonniert Echtzeit-Änderungen der Listen-Header eines Events.
   * Bei jeder Änderung werden alle Header via getListsForEvent() neu
   * geladen und an den Callback übergeben.
   *
   * @param eventId - Die ID des Events
   * @param onData - Callback mit aktuellen Headers
   * @param onError - Callback bei Fehler
   * @returns Unsubscribe-Funktion
   */
  subscribeToLists(
    eventId: string,
    onData: (headers: MaterialListHeaderDomain[]) => void,
    onError: (error: Error) => void,
  ): () => void {
    const clientRef = this.client;
    let retryCount = 0;
    const MAX_RETRIES = 5;
    let retryTimeoutId: ReturnType<typeof setTimeout> | null = null;

    const reloadHeaders = () => {
      this.getListsForEvent(eventId)
        .then((headers) => onData(headers))
        .catch((err) =>
          onError(err instanceof Error ? err : new Error(String(err))),
        );
    };

    const channel = clientRef
      .channel(`materiallists:${eventId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "event_material_lists",
          filter: `event_id=eq.${eventId}`,
        },
        reloadHeaders,
      )
      .subscribe((status, err) => {
        if (status === "SUBSCRIBED") {
          retryCount = 0;
        } else if (status === "CHANNEL_ERROR") {
          Sentry.addBreadcrumb({
            category: "realtime",
            message: `materiallists:${eventId} error`,
            level: "error",
            data: {error: err?.message},
          });

          if (retryCount < MAX_RETRIES) {
            // Exponential Backoff: 1s → 2s → 4s → 8s → 16s (max 30s)
            const delay = Math.min(1000 * Math.pow(2, retryCount), 30000);
            retryCount++;
            retryTimeoutId = setTimeout(() => {
              clientRef.removeChannel(channel);
              onError(
                new Error(
                  `Realtime-Fehler für materiallists:${eventId}, Retry ${retryCount}/${MAX_RETRIES}`,
                ),
              );
            }, delay);
          } else {
            Sentry.captureException(
              new Error(
                `Realtime materiallists:${eventId}: max retries reached`,
              ),
            );
            onError(
              new Error(
                `Realtime-Fehler für materiallists:${eventId}: max Retries erreicht`,
              ),
            );
          }
        }
      });

    return () => {
      if (retryTimeoutId) clearTimeout(retryTimeoutId);
      clientRef.removeChannel(channel);
    };
  }

  /* =====================================================================
  // Echtzeit-Subscription: Items einer Liste
  // ===================================================================== */

  /**
   * Abonniert Echtzeit-Änderungen der Items einer bestimmten Liste.
   * Bei jeder Änderung werden alle Items via getListItems() neu geladen.
   *
   * @param listId - Die ID der Liste
   * @param onData - Callback mit aktuellen Items
   * @param onError - Callback bei Fehler
   * @returns Unsubscribe-Funktion
   */
  subscribeToListItems(
    listId: string,
    onData: (items: MaterialListItemDomain[]) => void,
    onError: (error: Error) => void,
  ): () => void {
    const clientRef = this.client;

    const reloadItems = () => {
      this.getListItems(listId)
        .then((items) => onData(items))
        .catch((err) =>
          onError(err instanceof Error ? err : new Error(String(err))),
        );
    };

    const channel = clientRef
      .channel(`materiallistitems:${listId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "event_material_list_items",
          filter: `list_id=eq.${listId}`,
        },
        reloadItems,
      )
      .subscribe((status, err) => {
        if (status === "CHANNEL_ERROR") {
          Sentry.captureException(
            new Error(
              `Realtime materiallistitems:${listId} error: ${err?.message}`,
            ),
          );
          onError(
            new Error(
              `Realtime-Fehler für materiallistitems:${listId}`,
            ),
          );
        }
      });

    return () => {
      clientRef.removeChannel(channel);
    };
  }

  /* =====================================================================
  // Private Mapper
  // ===================================================================== */

  /**
   * Mappt eine Kopfzeilen-DB-Zeile auf das Domain-Modell.
   */
  private headerRowToDomain(row: MaterialListHeaderRow): MaterialListHeaderDomain {
    return {
      id: row.id,
      eventId: row.event_id,
      name: row.name,
      selectedMenues: row.selected_menues ?? [],
      selectedMeals: row.selected_meals ?? [],
      hasManuallyAddedItems: row.has_manually_added_items ?? false,
      updatedAt: new Date(row.updated_at),
    };
  }

  /**
   * Mappt eine VIEW-Zeile auf das Item-Domain-Modell.
   */
  private itemViewRowToDomain(row: MaterialListItemViewRow): MaterialListItemDomain {
    return {
      id: row.id,
      listId: row.list_id,
      materialId: row.material_id,
      freeTextName: row.free_text_name,
      quantity: Number(row.quantity),
      checked: row.checked,
      editSource: row.edit_source,
      sortOrder: row.sort_order,
      itemName: row.item_name ?? "",
      assignedCookId: row.assigned_cook_id,
      assignedCookName: row.assigned_cook_name,
      resolvedCookName: row.resolved_cook_name,
      assignedCookUserId: row.assigned_cook_user_id,
    };
  }
}
