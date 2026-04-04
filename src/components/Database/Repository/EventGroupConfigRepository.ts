/**
 * EventGroupConfigRepository — Repository für die Gruppenconfig eines Events.
 *
 * Verwaltet die Tabellen `event_groupconfiguration_diets`,
 * `event_groupconfiguration_intolerances` und `event_groupconfiguration_portions`.
 * Diäten, Unverträglichkeiten und Portionen werden immer als Einheit geladen
 * und gespeichert.
 *
 * @example
 * const config = await repo.getGroupConfig(eventId);
 */
import {SupabaseClient} from "@supabase/supabase-js";
import {BaseRepository} from "./BaseRepository";
import {
  STORAGE_OBJECT_PROPERTY,
  StorageObjectProperty,
} from "../../Firebase/Db/sessionStorageHandler.class";
import {AuthUser} from "../../Firebase/Authentication/authUser.class";
import {EventGroupConfiguration,
  Diet,
  Intolerance,
} from "../../Event/GroupConfiguration/groupConfiguration.class";

/* =====================================================================
// DB-Zeilenstrukturen
// ===================================================================== */

/**
 * Datenbank-Zeilentyp für event_groupconfiguration_diets.
 */
export interface GroupConfigDietRow {
  [key: string]: unknown;
  id: string;
  firebase_uid: string | null;
  event_id: string;
  name: string;
  sort_order: number;
  created_at: string;
  created_by: string | null;
  updated_at: string;
  updated_by: string | null;
}

/**
 * Datenbank-Zeilentyp für event_groupconfiguration_intolerances.
 */
export interface GroupConfigIntoleranceRow {
  [key: string]: unknown;
  id: string;
  firebase_uid: string | null;
  event_id: string;
  name: string;
  sort_order: number;
  created_at: string;
  created_by: string | null;
  updated_at: string;
  updated_by: string | null;
}

/**
 * Datenbank-Zeilentyp für event_groupconfiguration_portions.
 */
export interface GroupConfigPortionRow {
  [key: string]: unknown;
  id: string;
  firebase_uid: string | null;
  event_id: string;
  diet_id: string;
  intolerance_id: string;
  servings: number;
  created_at: string;
  created_by: string | null;
  updated_at: string;
  updated_by: string | null;
}

/* =====================================================================
// Domain-Modelle
// ===================================================================== */

/**
 * Domain-Modell für einen Diät- oder Unverträglichkeitseintrag.
 *
 * @param uid - Eindeutige ID
 * @param name - Name der Diät/Unverträglichkeit
 * @param sortOrder - Sortierreihenfolge
 */
export interface GroupConfigItemDomain {
  uid: string;
  name: string;
  sortOrder: number;
}

/**
 * Domain-Modell für einen Portionseintrag (Diät × Unverträglichkeit).
 *
 * @param uid - Eindeutige ID des Portions-Eintrags
 * @param dietId - FK auf event_groupconfiguration_diets.id
 * @param intoleranceId - FK auf event_groupconfiguration_intolerances.id
 * @param servings - Anzahl Portionen für diese Kombination
 */
export interface PortionEntryDomain {
  uid: string;
  dietId: string;
  intoleranceId: string;
  servings: number;
}

/**
 * Domain-Modell für die vollständige Gruppenconfig eines Events.
 *
 * @param eventId - ID des zugehörigen Events
 * @param diets - Liste der Diätgruppen
 * @param intolerances - Liste der Unverträglichkeiten
 * @param portions - Portionenmatrix (Diet × Intolerance)
 */
export interface GroupConfigDomain {
  eventId: string;
  diets: GroupConfigItemDomain[];
  intolerances: GroupConfigItemDomain[];
  portions: PortionEntryDomain[];
}

/* =====================================================================
// Dummy-Row-Typ für BaseRepository (GroupConfig hat keine einzige Tabelle)
// ===================================================================== */

/**
 * Dummy-Zeilentyp — GroupConfigRepository verwaltet drei Tabellen,
 * daher ist der generische TRow-Parameter nicht direkt nutzbar.
 * toRow() und toDomain() werden nicht für den regulären CRUD-Pfad verwendet.
 */
interface GroupConfigDummyRow {
  [key: string]: unknown;
  id: string;
}

/* =====================================================================
// EventGroupConfigRepository
// ===================================================================== */

/**
 * Repository für die Gruppenconfig (Diäten, Unverträglichkeiten, Portionen) eines Events.
 *
 * Achtung: toRow() und toDomain() der Basisklasse sind hier nicht direkt nutzbar,
 * da die Gruppenconfig auf drei Tabellen verteilt ist. Die öffentlichen Methoden
 * getGroupConfig() und saveGroupConfig() werden stattdessen verwendet.
 */
export class EventGroupConfigRepository extends BaseRepository<GroupConfigDomain, GroupConfigDummyRow> {
  tableName = "event_groupconfiguration_diets";

  constructor(client?: SupabaseClient) {
    super(client);
  }

  getCacheConfig(): StorageObjectProperty {
    return STORAGE_OBJECT_PROPERTY.EVENT_GROUP_CONFIGRUATION;
  }

  /**
   * Nicht verwendet — GroupConfig ist auf drei Tabellen verteilt.
   * @param domain - Nicht verwendet
   * @returns Leere partielle Zeile
   */
  toRow(_domain: GroupConfigDomain): Partial<GroupConfigDummyRow> {
    return {};
  }

  /**
   * Nicht verwendet — GroupConfig wird via getGroupConfig() geladen.
   * @param row - Nicht verwendet
   * @returns Leeres GroupConfigDomain
   */
  toDomain(_row: GroupConfigDummyRow): GroupConfigDomain {
    return {eventId: "", diets: [], intolerances: [], portions: []};
  }

  /* =====================================================================
  // Gruppenconfig laden
  // ===================================================================== */
  /**
   * Lädt die vollständige Gruppenconfig eines Events (Diäten, Unverträglichkeiten, Portionen).
   *
   * @param eventId - Die ID des Events
   * @returns Die vollständige GroupConfigDomain
   */
  async getGroupConfig(eventId: string): Promise<GroupConfigDomain> {
    const [dietsResult, intolerancesResult, portionsResult] = await Promise.all([
      this.client
        .from("event_groupconfiguration_diets")
        .select("*")
        .eq("event_id", eventId)
        .order("sort_order"),
      this.client
        .from("event_groupconfiguration_intolerances")
        .select("*")
        .eq("event_id", eventId)
        .order("sort_order"),
      this.client
        .from("event_groupconfiguration_portions")
        .select("*")
        .eq("event_id", eventId),
    ]);

    if (dietsResult.error) throw dietsResult.error;
    if (intolerancesResult.error) throw intolerancesResult.error;
    if (portionsResult.error) throw portionsResult.error;

    return {
      eventId,
      diets: ((dietsResult.data ?? []) as GroupConfigDietRow[]).map((row) => ({
        uid: row.id,
        name: row.name,
        sortOrder: row.sort_order,
      })),
      intolerances: ((intolerancesResult.data ?? []) as GroupConfigIntoleranceRow[]).map((row) => ({
        uid: row.id,
        name: row.name,
        sortOrder: row.sort_order,
      })),
      portions: ((portionsResult.data ?? []) as GroupConfigPortionRow[]).map((row) => ({
        uid: row.id,
        dietId: row.diet_id,
        intoleranceId: row.intolerance_id,
        servings: row.servings,
      })),
    };
  }

  /* =====================================================================
  // Gruppenconfig speichern (vollständige Replace-Strategie)
  // ===================================================================== */
  /**
   * Speichert die vollständige Gruppenconfig eines Events.
   *
   * Strategie:
   * 1. Diäten upserten (nach firebase_uid oder bestehender ID)
   * 2. Intolerances upserten
   * 3. Nicht mehr vorhandene Diäten/Intolerances löschen (CASCADE entfernt Portionen automatisch)
   * 4. Portionenmatrix upserten
   *
   * @param config - Die zu speichernde Gruppenconfig
   * @param authUser - Der angemeldete Benutzer (für Audit-Zwecke)
   * @returns Die gespeicherte Gruppenconfig (mit generierten IDs)
   */
  async saveGroupConfig(
    config: GroupConfigDomain,
    _authUser: AuthUser,
  ): Promise<GroupConfigDomain> {
    const eventId = config.eventId;

    // Bestehende Diät/Intolerance-IDs laden (für Diff-Berechnung)
    const [existingDietsResult, existingIntolerancesResult] = await Promise.all([
      this.client.from("event_groupconfiguration_diets").select("id").eq("event_id", eventId),
      this.client.from("event_groupconfiguration_intolerances").select("id").eq("event_id", eventId),
    ]);

    if (existingDietsResult.error) throw existingDietsResult.error;
    if (existingIntolerancesResult.error) throw existingIntolerancesResult.error;

    const existingDietIds = new Set((existingDietsResult.data ?? []).map((row) => row.id as string));
    const existingIntoleranceIds = new Set((existingIntolerancesResult.data ?? []).map((row) => row.id as string));
    const newDietIds = new Set(config.diets.filter((d) => d.uid).map((d) => d.uid));
    const newIntoleranceIds = new Set(config.intolerances.filter((i) => i.uid).map((i) => i.uid));

    // Nicht mehr vorhandene Diäten/Intolerances ermitteln
    const dietIdsToDelete = [...existingDietIds].filter((id) => !newDietIds.has(id));
    const intoleranceIdsToDelete = [...existingIntoleranceIds].filter((id) => !newIntoleranceIds.has(id));

    // Diäten upserten — .select() liefert die DB-generierten IDs zurück
    // (wichtig für neue Einträge ohne bestehende uid)
    const dietIdMap = new Map<number, string>();
    if (config.diets.length > 0) {
      const dietRows = config.diets.map((diet, index) => ({
        ...(diet.uid ? {id: diet.uid} : {}),
        event_id: eventId,
        name: diet.name,
        sort_order: index * 10,
      }));
      const {data: insertedDiets, error} = await this.client
        .from("event_groupconfiguration_diets")
        .upsert(dietRows, {onConflict: "id"})
        .select("id, sort_order");
      if (error) throw error;
      (insertedDiets ?? []).forEach((row) =>
        dietIdMap.set(row.sort_order as number, row.id as string),
      );
    }

    // Intolerances upserten — .select() liefert die DB-generierten IDs zurück
    const intIdMap = new Map<number, string>();
    if (config.intolerances.length > 0) {
      const intoleranceRows = config.intolerances.map((intolerance, index) => ({
        ...(intolerance.uid ? {id: intolerance.uid} : {}),
        event_id: eventId,
        name: intolerance.name,
        sort_order: index * 10,
      }));
      const {data: insertedIntolerances, error} = await this.client
        .from("event_groupconfiguration_intolerances")
        .upsert(intoleranceRows, {onConflict: "id"})
        .select("id, sort_order");
      if (error) throw error;
      (insertedIntolerances ?? []).forEach((row) =>
        intIdMap.set(row.sort_order as number, row.id as string),
      );
    }

    // Nicht mehr vorhandene Diäten löschen (CASCADE entfernt Portionen)
    if (dietIdsToDelete.length > 0) {
      const {error} = await this.client
        .from("event_groupconfiguration_diets")
        .delete()
        .in("id", dietIdsToDelete);
      if (error) throw error;
    }

    // Nicht mehr vorhandene Intolerances löschen
    if (intoleranceIdsToDelete.length > 0) {
      const {error} = await this.client
        .from("event_groupconfiguration_intolerances")
        .delete()
        .in("id", intoleranceIdsToDelete);
      if (error) throw error;
    }

    // Portionenmatrix upserten — IDs für neue Diäten/Intoleranzen über
    // sort_order aus den dietIdMap/intIdMap auflösen
    if (config.portions.length > 0) {
      const portionRows = config.portions.map((portion) => {
        // sort_order der referenzierten Diät/Intoleranz ermitteln
        const dietSortOrder =
          config.diets.findIndex((d) => d.uid === portion.dietId) * 10;
        const intSortOrder =
          config.intolerances.findIndex((i) => i.uid === portion.intoleranceId) * 10;

        return {
          ...(portion.uid ? {id: portion.uid} : {}),
          event_id: eventId,
          diet_id: dietIdMap.get(dietSortOrder) ?? portion.dietId,
          intolerance_id: intIdMap.get(intSortOrder) ?? portion.intoleranceId,
          servings: portion.servings,
        };
      });
      const {error} = await this.client
        .from("event_groupconfiguration_portions")
        .upsert(portionRows, {onConflict: "event_id,diet_id,intolerance_id"});
      if (error) throw error;
    }

    // Aktualisierten Zustand zurückgeben
    return this.getGroupConfig(eventId);
  }

  /* =====================================================================
  // Echtzeit-Subscription für Gruppenconfig
  // ===================================================================== */
  /**
   * Abonniert Echtzeit-Änderungen der Gruppenconfig eines Events.
   *
   * Überwacht die drei Tabellen `event_groupconfiguration_diets`,
   * `event_groupconfiguration_intolerances` und `event_groupconfiguration_portions`.
   * Bei jeder Änderung wird die vollständige Gruppenconfig via getGroupConfig()
   * neu geladen und an den onData-Callback übergeben.
   *
   * @param eventId - Die ID des Events
   * @param onData - Callback, der bei jeder Änderung die aktuelle GroupConfigDomain erhält
   * @param onError - Callback bei Fehler (z.B. Realtime-Verbindungsfehler)
   * @returns Unsubscribe-Funktion, die alle drei Channels entfernt
   *
   * @example
   * const unsubscribe = repo.subscribeToGroupConfig(
   *   eventId,
   *   (config) => setGroupConfig(config),
   *   (error) => console.error(error),
   * );
   * // Später: unsubscribe();
   */
  subscribeToGroupConfig(
    eventId: string,
    onData: (config: GroupConfigDomain) => void,
    onError: (error: Error) => void,
  ): () => void {
    const clientRef = this.client;

    const reloadConfig = () => {
      this.getGroupConfig(eventId)
        .then((config) => onData(config))
        .catch((err) =>
          onError(err instanceof Error ? err : new Error(String(err))),
        );
    };

    // Ein einziger Channel für alle 3 GroupConfig-Tabellen — spart Realtime-Connections
    const channel = clientRef
      .channel(`groupconfig:${eventId}`)
      .on("postgres_changes", {event: "*", schema: "public", table: "event_groupconfiguration_diets", filter: `event_id=eq.${eventId}`}, reloadConfig)
      .on("postgres_changes", {event: "*", schema: "public", table: "event_groupconfiguration_intolerances", filter: `event_id=eq.${eventId}`}, reloadConfig)
      .on("postgres_changes", {event: "*", schema: "public", table: "event_groupconfiguration_portions", filter: `event_id=eq.${eventId}`}, reloadConfig)
      .subscribe((status, err) => {
        console.debug(`Realtime groupconfig:${eventId} status: ${status}`, err ?? "");
        if (status === "CHANNEL_ERROR") {
          onError(new Error(`Realtime-Fehler für groupconfig:${eventId}`));
        }
      });

    return () => {
      clientRef.removeChannel(channel);
    };
  }

  /* =====================================================================
  // UI-ready Methoden — konvertieren Domain ↔ EventGroupConfiguration direkt
  // ===================================================================== */

  /**
   * Konvertiert ein GroupConfigDomain in eine EventGroupConfiguration-Instanz (UI-Format).
   *
   * Diäten und Unverträglichkeiten werden nach sortOrder sortiert. Die verschachtelte
   * Portionenmatrix wird aus der flachen portions-Liste aufgebaut. Abschliessend
   * werden die Totale via calculateTotals() berechnet.
   *
   * @param domain - Das GroupConfigDomain-Objekt
   * @param eventUid - Die UID des zugehörigen Events
   * @returns Eine vollständig befüllte EventGroupConfiguration-Instanz
   */
  groupConfigDomainToUi(
    domain: GroupConfigDomain,
    eventUid: string,
  ): EventGroupConfiguration {
    const groupConfig = new EventGroupConfiguration();
    groupConfig.uid = eventUid;

    // Diäten nach sortOrder sortieren und in die entries/order-Struktur überführen
    const sortedDiets = [...domain.diets].sort(
      (a, b) => a.sortOrder - b.sortOrder,
    );
    for (const diet of sortedDiets) {
      const dietEntry: Diet = {
        uid: diet.uid,
        name: diet.name,
        totalPortions: 0, // Wird durch calculateTotals() berechnet
      };
      groupConfig.diets.entries[diet.uid] = dietEntry;
      groupConfig.diets.order.push(diet.uid);
    }

    // Unverträglichkeiten nach sortOrder sortieren
    const sortedIntolerances = [...domain.intolerances].sort(
      (a, b) => a.sortOrder - b.sortOrder,
    );
    for (const intolerance of sortedIntolerances) {
      const intoleranceEntry: Intolerance = {
        uid: intolerance.uid,
        name: intolerance.name,
        totalPortions: 0,
      };
      groupConfig.intolerances.entries[intolerance.uid] = intoleranceEntry;
      groupConfig.intolerances.order.push(intolerance.uid);
    }

    // Verschachtelte Portionenmatrix: portions[dietId][intoleranceId] = servings
    for (const dietUid of groupConfig.diets.order) {
      const intolerancePortions: {[key: string]: number} = {};
      for (const intUid of groupConfig.intolerances.order) {
        intolerancePortions[intUid] = 0;
      }
      groupConfig.portions[dietUid] = intolerancePortions;
    }

    // Tatsächliche Werte einfüllen
    for (const portion of domain.portions) {
      if (
        groupConfig.portions[portion.dietId] !== undefined &&
        groupConfig.portions[portion.dietId][portion.intoleranceId] !== undefined
      ) {
        groupConfig.portions[portion.dietId][portion.intoleranceId] =
          portion.servings;
      }
    }

    // Totale berechnen
    EventGroupConfiguration.calculateTotals({groupConfig});

    return groupConfig;
  }

  /**
   * Konvertiert eine EventGroupConfiguration-Instanz in ein GroupConfigDomain für die DB.
   *
   * Die order-Arrays bestimmen die Sortierreihenfolge (Index × 10 als sortOrder).
   * Die verschachtelte Portionenmatrix wird in eine flache Liste überführt.
   *
   * @param gc - Die EventGroupConfiguration-Instanz
   * @param eventId - Die ID des zugehörigen Events
   * @returns Ein GroupConfigDomain für saveGroupConfig()
   */
  groupConfigUiToDomain(
    gc: EventGroupConfiguration,
    eventId: string,
  ): GroupConfigDomain {
    const diets: GroupConfigItemDomain[] = gc.diets.order.map(
      (dietUid, index) => ({
        uid: dietUid,
        name: gc.diets.entries[dietUid].name,
        sortOrder: index * 10,
      }),
    );

    const intolerances: GroupConfigItemDomain[] = gc.intolerances.order.map(
      (intUid, index) => ({
        uid: gc.intolerances.entries[intUid].uid,
        name: gc.intolerances.entries[intUid].name,
        sortOrder: index * 10,
      }),
    );

    const portions: PortionEntryDomain[] = [];
    for (const dietUid of gc.diets.order) {
      for (const intUid of gc.intolerances.order) {
        portions.push({
          uid: "",
          dietId: dietUid,
          intoleranceId: intUid,
          servings: gc.portions[dietUid]?.[intUid] ?? 0,
        });
      }
    }

    return {eventId, diets, intolerances, portions};
  }
}
