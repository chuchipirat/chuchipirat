/**
 * StatsRepository — Repository für Plattform-Statistiken.
 *
 * Ruft die SECURITY DEFINER Funktion `get_platform_stats()` auf,
 * die aggregierte KPIs über alle Tabellen berechnet. Die Funktion
 * umgeht RLS, gibt aber nur Zähler/Durchschnitte zurück.
 *
 * @example
 * const stats = await repo.getStats();
 * // stats = [{id: 'noUsers', value: 128, caption: 'User', group: 'platform'}, ...]
 */
import {SupabaseClient} from "@supabase/supabase-js";
import {supabase} from "../supabaseClient";
import {
  STATS_GROUP_PLATFORM as TEXT_STATS_GROUP_PLATFORM,
  STATS_GROUP_RECIPES as TEXT_STATS_GROUP_RECIPES,
  STATS_GROUP_EVENTS as TEXT_STATS_GROUP_EVENTS,
  STATS_GROUP_AVERAGES as TEXT_STATS_GROUP_AVERAGES,
} from "../../../constants/text";

/* =====================================================================
// Domain-Modell
// ===================================================================== */

/**
 * Einzelner KPI-Eintrag für die Statistik-Anzeige.
 *
 * @param id - Technischer Feldname (z.B. 'noUsers')
 * @param value - Numerischer Wert
 * @param caption - Anzeige-Text (Deutsch)
 * @param group - Gruppenzugehörigkeit für die Darstellung
 */
export interface Kpi {
  id: string;
  value: number;
  caption: string;
  group: string;
}

/**
 * KPI-Gruppe für die gruppierte Darstellung im Sidebar.
 *
 * @param title - Gruppenüberschrift
 * @param kpis - KPI-Einträge in dieser Gruppe
 */
export interface KpiGroup {
  title: string;
  kpis: Kpi[];
}

/* =====================================================================
// Mapping: Feldname → Caption + Gruppe
// ===================================================================== */

interface KpiMeta {
  caption: string;
  group: string;
}

/** Mapping von Datenbank-Feldnamen auf Anzeige-Text und Gruppe. */
const KPI_META: Record<string, KpiMeta> = {
  noUsers: {caption: "User", group: TEXT_STATS_GROUP_PLATFORM},
  noCooks: {caption: "Aktive Köche", group: TEXT_STATS_GROUP_PLATFORM},
  noRecipesPublic: {caption: "Öffentliche Rezepte", group: TEXT_STATS_GROUP_RECIPES},
  noRecipesPrivate: {caption: "Private Rezepte", group: TEXT_STATS_GROUP_RECIPES},
  noRecipesVariants: {caption: "Anlassvarianten", group: TEXT_STATS_GROUP_RECIPES},
  noRatings: {caption: "Bewertungen", group: TEXT_STATS_GROUP_RECIPES},
  noComments: {caption: "Kommentare", group: TEXT_STATS_GROUP_RECIPES},
  noEvents: {caption: "Anlässe", group: TEXT_STATS_GROUP_EVENTS},
  noParticipants: {caption: "Bekochte Personen", group: TEXT_STATS_GROUP_EVENTS},
  noPlanedDays: {caption: "Geplante Anlasstage", group: TEXT_STATS_GROUP_EVENTS},
  noPortions: {caption: "Geplante Portionen", group: TEXT_STATS_GROUP_EVENTS},
  noShoppingLists: {caption: "Einkaufslisten", group: TEXT_STATS_GROUP_EVENTS},
  noMaterialLists: {caption: "Materiallisten", group: TEXT_STATS_GROUP_EVENTS},
  avgEventDuration: {caption: "Dauer (Tage)", group: TEXT_STATS_GROUP_AVERAGES},
  avgCooksPerEvent: {caption: "Köche", group: TEXT_STATS_GROUP_AVERAGES},
  avgRecipesPerEvent: {caption: "Rezepte", group: TEXT_STATS_GROUP_AVERAGES},
  avgPortionsPerEvent: {caption: "Portionen", group: TEXT_STATS_GROUP_AVERAGES},
  avgShoppingListItems: {caption: "Einkaufsartikel", group: TEXT_STATS_GROUP_AVERAGES},
};

/** Reihenfolge der Gruppen für die Anzeige. */
const GROUP_ORDER = [
  TEXT_STATS_GROUP_PLATFORM,
  TEXT_STATS_GROUP_RECIPES,
  TEXT_STATS_GROUP_EVENTS,
  TEXT_STATS_GROUP_AVERAGES,
];

/* =====================================================================
// Repository
// ===================================================================== */

/**
 * Repository für Plattform-Statistiken.
 * Ruft die `get_platform_stats()` RPC-Funktion auf und mappt
 * die Ergebnisse auf KPI-Gruppen.
 */
export class StatsRepository {
  private client: SupabaseClient;

  constructor(client?: SupabaseClient) {
    this.client = client ?? supabase;
  }

  /**
   * Lädt alle Plattform-Statistiken und gibt sie als flaches KPI-Array zurück.
   * Die Reihenfolge entspricht der Feld-Reihenfolge aus der DB-Funktion.
   *
   * @returns Array aller KPIs mit Caption und Gruppenzugehörigkeit
   */
  async getStats(): Promise<Kpi[]> {
    const {data, error} = await this.client.rpc("get_platform_stats");

    if (error) throw error;

    return (data ?? [])
      .filter((row: {field: string; value: number}) => KPI_META[row.field])
      .map((row: {field: string; value: number}) => ({
        id: row.field,
        value: Number(row.value),
        caption: KPI_META[row.field].caption,
        group: KPI_META[row.field].group,
      }));
  }

  /**
   * Gruppiert ein flaches KPI-Array nach Gruppen für die Sidebar-Darstellung.
   *
   * @param kpis - Flaches KPI-Array (z.B. von getStats())
   * @returns Gruppierte KPIs in der definierten Reihenfolge
   */
  static groupKpis(kpis: Kpi[]): KpiGroup[] {
    return GROUP_ORDER.map((groupTitle) => ({
      title: groupTitle,
      kpis: kpis.filter((kpi) => kpi.group === groupTitle),
    })).filter((group) => group.kpis.length > 0);
  }
}
