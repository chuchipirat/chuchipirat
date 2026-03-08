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
    authUser: AuthUser,
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
}
