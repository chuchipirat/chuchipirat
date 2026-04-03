/**
 * MenuplanRepository — Repository für den Menuplan eines Events.
 *
 * Verwaltet die Tabellen:
 * - event_meal_types        — Mahlzeitentypen
 * - event_meals             — Mahlzeit-Slots (Datum × MealType)
 * - event_menues            — Menü-Container
 * - event_menue_recipes     — Rezepte im Menü
 * - event_menue_products    — Produkte im Menü
 * - event_menue_materials   — Materialien im Menü
 * - event_notes             — Notizen
 * - event_menuplan_item_plans — Plan-Zeilen
 *
 * @example
 * const menuplan = await repo.getMenuplan(eventId);
 */
import {SupabaseClient} from "@supabase/supabase-js";
import * as Sentry from "@sentry/react";
import {BaseRepository} from "./BaseRepository";
import {
  STORAGE_OBJECT_PROPERTY,
  StorageObjectProperty,
} from "../../Firebase/Db/sessionStorageHandler.class";
import {AuthUser} from "../../Firebase/Authentication/authUser.class";
import type {MenuplanData} from "../../Event/Menuplan/menuplan.types";
import {
  PlanedDiet,
  PlanedIntolerances,
  GoodsPlanMode,
} from "../../Event/Menuplan/menuplan.types";
import type {
  Meal,
  MealRecipe,
  Menue,
  MenuplanMaterial,
  MenuplanProduct,
  Note,
  PortionPlan,
} from "../../Event/Menuplan/menuplan.types";
import {createEmptyMenuplan} from "../../Event/Menuplan/menuplanService";
import {RecipeType} from "../../Recipe/recipe.class";

/* =====================================================================
// DB-Zeilenstrukturen
// ===================================================================== */

/**
 * Datenbank-Zeilentyp für event_meal_types.
 */
export interface MealTypeRow {
  [key: string]: unknown;
  id: string;
  firebase_uid: string | null;
  event_id: string;
  name: string;
  sort_order: number;
}

/**
 * Datenbank-Zeilentyp für event_meals.
 */
export interface MealRow {
  [key: string]: unknown;
  id: string;
  firebase_uid: string | null;
  event_id: string;
  meal_date: string;
  meal_type_id: string;
}

/**
 * Datenbank-Zeilentyp für event_menues.
 */
export interface MenueRow {
  [key: string]: unknown;
  id: string;
  firebase_uid: string | null;
  event_id: string;
  meal_id: string;
  name: string;
  sort_order: number;
}

/**
 * Datenbank-Zeilentyp für event_menue_recipes.
 */
export interface MenueRecipeRow {
  [key: string]: unknown;
  id: string;
  firebase_uid: string | null;
  event_id: string;
  menue_id: string;
  recipe_id: string | null;
  deleted_recipe_name: string | null;
  variant_name: string | null;
  total_portions: number;
  sort_order: number;
}

/**
 * Datenbank-Zeilentyp für event_menue_products.
 */
export interface MenueProductRow {
  [key: string]: unknown;
  id: string;
  firebase_uid: string | null;
  event_id: string;
  menue_id: string;
  product_id: string;
  quantity: number;
  unit: string | null;
  plan_mode: string;
  total_quantity: number;
  sort_order: number;
}

/**
 * Datenbank-Zeilentyp für event_menue_materials.
 */
export interface MenueMaterialRow {
  [key: string]: unknown;
  id: string;
  firebase_uid: string | null;
  event_id: string;
  menue_id: string;
  material_id: string;
  quantity: number;
  unit: string | null;
  plan_mode: string;
  total_quantity: number;
  sort_order: number;
}

/**
 * Datenbank-Zeilentyp für event_notes.
 */
export interface NoteRow {
  [key: string]: unknown;
  id: string;
  firebase_uid: string | null;
  event_id: string;
  menue_id: string | null;
  note_date: string;
  text: string;
}

/**
 * Datenbank-Zeilentyp für event_menuplan_item_plans.
 */
export interface ItemPlanRow {
  [key: string]: unknown;
  id: string;
  event_id: string;
  menue_recipe_id: string | null;
  menue_product_id: string | null;
  menue_material_id: string | null;
  diet_scope: string;
  diet_id: string | null;
  intolerance_scope: string;
  intolerance_id: string | null;
  factor: number;
  servings: number;
}

/* =====================================================================
// Domain-Modelle
// ===================================================================== */

/**
 * Plan-Scope-Typen entsprechend dem PostgreSQL ENUM plan_scope_type.
 */
export type PlanScopeType = "ALL" | "FIX" | "group";

/**
 * Plan-Modus-Typen entsprechend dem PostgreSQL ENUM plan_mode_type.
 */
export type PlanModeType = "total" | "per_portion";

/**
 * Domain-Modell für eine Plan-Zeile (ein Item einer Portion).
 *
 * @param uid - Eindeutige ID der Plan-Zeile
 * @param dietScope - Bereich der Diät-Zuordnung
 * @param dietId - FK auf event_groupconfiguration_diets (nur bei scope='group')
 * @param intoleranceScope - Bereich der Unverträglichkeits-Zuordnung
 * @param intoleranceId - FK auf event_groupconfiguration_intolerances (nur bei scope='group')
 * @param factor - Multiplikationsfaktor
 * @param servings - Anzahl Portionen
 */
export interface ItemPlanDomain {
  uid: string;
  dietScope: PlanScopeType;
  dietId: string | null;
  intoleranceScope: PlanScopeType;
  intoleranceId: string | null;
  factor: number;
  servings: number;
}

/**
 * Domain-Modell für einen Mahlzeitentyp.
 *
 * @param uid - Eindeutige ID
 * @param name - Name des Mahlzeitentyps (z.B. "Frühstück")
 * @param sortOrder - Sortierreihenfolge
 */
export interface MealTypeDomain {
  uid: string;
  name: string;
  sortOrder: number;
}

/**
 * Domain-Modell für eine Mahlzeit (Datum × MealType).
 *
 * @param uid - Eindeutige ID
 * @param mealDate - Datum der Mahlzeit (YYYY-MM-DD)
 * @param mealTypeId - FK auf event_meal_types.id
 */
export interface MealDomain {
  uid: string;
  mealDate: string;
  mealTypeId: string;
}

/**
 * Domain-Modell für einen Menü-Container innerhalb einer Mahlzeit.
 *
 * @param uid - Eindeutige ID
 * @param mealId - FK auf event_meals.id
 * @param name - Name des Menüs
 * @param sortOrder - Sortierreihenfolge
 */
export interface MenueDomain {
  uid: string;
  mealId: string;
  name: string;
  sortOrder: number;
}

/**
 * Domain-Modell für ein Rezept innerhalb eines Menüs.
 *
 * @param uid - Eindeutige ID
 * @param menueId - FK auf event_menues.id
 * @param recipeId - FK auf recipes.id (null, wenn Rezept gelöscht)
 * @param deletedRecipeName - Name des gelöschten Rezepts (nur gesetzt wenn recipeId null)
 * @param variantName - Varianten-Name (optional)
 * @param totalPortions - Gecachte Summe der Portionen
 * @param sortOrder - Sortierreihenfolge
 * @param plans - Plan-Zeilen für dieses Rezept
 */
export interface MenueRecipeDomain {
  uid: string;
  menueId: string;
  recipeId: string | null;
  /** Rezeptname aus der recipes-Tabelle (via JOIN). */
  recipeName: string;
  deletedRecipeName: string | null;
  variantName: string | null;
  totalPortions: number;
  sortOrder: number;
  plans: ItemPlanDomain[];
}

/**
 * Domain-Modell für ein Produkt innerhalb eines Menüs.
 *
 * @param uid - Eindeutige ID
 * @param menueId - FK auf event_menues.id
 * @param productId - FK auf products.id
 * @param quantity - Basismengenangabe
 * @param unit - Einheit (units.key oder null)
 * @param planMode - Planierungsmodus (total oder per_portion)
 * @param totalQuantity - Gecachte Gesamtmenge
 * @param sortOrder - Sortierreihenfolge
 * @param plans - Plan-Zeilen für dieses Produkt
 */
export interface MenueProductDomain {
  uid: string;
  menueId: string;
  productId: string;
  /** Produktname aus der products-Tabelle (via JOIN). */
  productName: string;
  quantity: number;
  unit: string | null;
  planMode: PlanModeType;
  totalQuantity: number;
  sortOrder: number;
  plans: ItemPlanDomain[];
}

/**
 * Domain-Modell für ein Material innerhalb eines Menüs.
 *
 * @param uid - Eindeutige ID
 * @param menueId - FK auf event_menues.id
 * @param materialId - FK auf materials.id
 * @param quantity - Basismengenangabe
 * @param unit - Einheit (units.key oder null)
 * @param planMode - Planierungsmodus (total oder per_portion)
 * @param totalQuantity - Gecachte Gesamtmenge
 * @param sortOrder - Sortierreihenfolge
 * @param plans - Plan-Zeilen für dieses Material
 */
export interface MenueMaterialDomain {
  uid: string;
  menueId: string;
  materialId: string;
  /** Materialname aus der materials-Tabelle (via JOIN). */
  materialName: string;
  quantity: number;
  unit: string | null;
  planMode: PlanModeType;
  totalQuantity: number;
  sortOrder: number;
  plans: ItemPlanDomain[];
}

/**
 * Domain-Modell für eine Notiz.
 *
 * @param uid - Eindeutige ID
 * @param menueId - FK auf event_menues.id (nullable)
 * @param noteDate - Datum der Notiz (YYYY-MM-DD)
 * @param text - Notiztext
 */
export interface NoteDomain {
  uid: string;
  menueId: string | null;
  noteDate: string;
  text: string;
}

/**
 * Vollständiges Domain-Modell für einen Menuplan.
 *
 * @param eventId - ID des Events
 * @param mealTypes - Mahlzeitentypen
 * @param meals - Mahlzeit-Slots
 * @param menues - Menü-Container
 * @param menueRecipes - Rezepte (mit eingebetteten Plan-Zeilen)
 * @param menueProducts - Produkte (mit eingebetteten Plan-Zeilen)
 * @param menueMaterials - Materialien (mit eingebetteten Plan-Zeilen)
 * @param notes - Notizen
 */
export interface MenuplanDomain {
  eventId: string;
  mealTypes: MealTypeDomain[];
  meals: MealDomain[];
  menues: MenueDomain[];
  menueRecipes: MenueRecipeDomain[];
  menueProducts: MenueProductDomain[];
  menueMaterials: MenueMaterialDomain[];
  notes: NoteDomain[];
  /** Zeitpunkt der letzten Menuplan-Speicherung (MAX created_at aus event_meal_types). */
  lastSavedAt: Date;
}

/* =====================================================================
// Dummy-Row-Typ (MenuplanRepository verwaltet 8 Tabellen)
// ===================================================================== */

/** Dummy-Zeile für die BaseRepository-Generics. */
interface MenuplanDummyRow {
  [key: string]: unknown;
  id: string;
}

/* =====================================================================
// MenuplanRepository
// ===================================================================== */

/**
 * Repository für den Menuplan eines Events.
 *
 * Lädt alle 8 Tabellen parallel und baut das MenuplanDomain zusammen.
 * Für Echtzeit-Updates steht subscribeToMenuplan() zur Verfügung.
 */
export class MenuplanRepository extends BaseRepository<
  MenuplanDomain,
  MenuplanDummyRow
> {
  tableName = "event_meal_types";

  constructor(client?: SupabaseClient) {
    super(client);
  }

  getCacheConfig(): StorageObjectProperty {
    return STORAGE_OBJECT_PROPERTY.MENUPLAN;
  }

  /** Nicht verwendet — Menuplan wird via getMenuplan() geladen. */
  toRow(_domain: MenuplanDomain): Partial<MenuplanDummyRow> {
    return {};
  }

  /** Nicht verwendet — Menuplan wird via getMenuplan() geladen. */
  toDomain(_row: MenuplanDummyRow): MenuplanDomain {
    return {
      eventId: "",
      mealTypes: [],
      meals: [],
      menues: [],
      menueRecipes: [],
      menueProducts: [],
      menueMaterials: [],
      notes: [],
      lastSavedAt: new Date(0),
    };
  }

  /* =====================================================================
  // Hilfs-Konverter
  // ===================================================================== */

  /**
   * Konvertiert eine ItemPlanRow in ein ItemPlanDomain-Objekt.
   *
   * @param row - Die DB-Zeile
   * @returns ItemPlanDomain
   */
  private planRowToDomain(row: ItemPlanRow): ItemPlanDomain {
    return {
      uid: row.id,
      dietScope: row.diet_scope as PlanScopeType,
      dietId: row.diet_id,
      intoleranceScope: row.intolerance_scope as PlanScopeType,
      intoleranceId: row.intolerance_id,
      factor: Number(row.factor),
      servings: row.servings,
    };
  }

  /* =====================================================================
  // Vollständigen Menuplan laden
  // ===================================================================== */
  /**
   * Lädt den vollständigen Menuplan eines Events (alle 8 Tabellen parallel).
   * Plan-Zeilen werden nach dem Laden in die jeweiligen Items eingebettet.
   *
   * @param eventId - Die ID des Events
   * @returns Das vollständige MenuplanDomain
   */
  async getMenuplan(eventId: string): Promise<MenuplanDomain> {
    // Alle Tabellen parallel laden für optimale Performance
    const [
      mealTypesResult,
      mealsResult,
      menuesResult,
      menueRecipesResult,
      menueProductsResult,
      menueMaterialsResult,
      notesResult,
      plansResult,
      trackingResult,
    ] = await Promise.all([
      this.client
        .from("event_meal_types")
        .select("*")
        .eq("event_id", eventId)
        .order("sort_order"),
      this.client.from("event_meals").select("*").eq("event_id", eventId),
      this.client
        .from("event_menues")
        .select("*")
        .eq("event_id", eventId)
        .order("sort_order"),
      this.client
        .from("event_menue_recipes")
        .select("*, recipes:recipe_id(name)")
        .eq("event_id", eventId)
        .order("sort_order"),
      this.client
        .from("event_menue_products")
        .select("*, products:product_id(name)")
        .eq("event_id", eventId)
        .order("sort_order"),
      this.client
        .from("event_menue_materials")
        .select("*, materials:material_id(name)")
        .eq("event_id", eventId)
        .order("sort_order"),
      this.client
        .from("event_notes")
        .select("*")
        .eq("event_id", eventId)
        .order("note_date"),
      this.client
        .from("event_menuplan_item_plans")
        .select("*")
        .eq("event_id", eventId),
      this.client
        .from("event_menuplan_tracking")
        .select("updated_at")
        .eq("event_id", eventId)
        .maybeSingle(),
    ]);

    if (mealTypesResult.error) throw mealTypesResult.error;
    if (mealsResult.error) throw mealsResult.error;
    if (menuesResult.error) throw menuesResult.error;
    if (menueRecipesResult.error) throw menueRecipesResult.error;
    if (menueProductsResult.error) throw menueProductsResult.error;
    if (menueMaterialsResult.error) throw menueMaterialsResult.error;
    if (notesResult.error) throw notesResult.error;
    if (plansResult.error) throw plansResult.error;
    if (trackingResult.error) throw trackingResult.error;

    // Plan-Zeilen nach Item-Typ gruppieren für effizientes Lookup
    const allPlanRows = (plansResult.data ?? []) as ItemPlanRow[];
    const plansByRecipeId = new Map<string, ItemPlanDomain[]>();
    const plansByProductId = new Map<string, ItemPlanDomain[]>();
    const plansByMaterialId = new Map<string, ItemPlanDomain[]>();

    for (const planRow of allPlanRows) {
      const planDomain = this.planRowToDomain(planRow);
      if (planRow.menue_recipe_id) {
        const existing = plansByRecipeId.get(planRow.menue_recipe_id) ?? [];
        existing.push(planDomain);
        plansByRecipeId.set(planRow.menue_recipe_id, existing);
      } else if (planRow.menue_product_id) {
        const existing = plansByProductId.get(planRow.menue_product_id) ?? [];
        existing.push(planDomain);
        plansByProductId.set(planRow.menue_product_id, existing);
      } else if (planRow.menue_material_id) {
        const existing = plansByMaterialId.get(planRow.menue_material_id) ?? [];
        existing.push(planDomain);
        plansByMaterialId.set(planRow.menue_material_id, existing);
      }
    }

    // Rezepte mit eingebetteten Plan-Zeilen zusammenbauen
    const menueRecipes: MenueRecipeDomain[] = (
      (menueRecipesResult.data ?? []) as (MenueRecipeRow & {recipes: {name: string} | null})[]
    ).map((row) => ({
      uid: row.id,
      menueId: row.menue_id,
      recipeId: row.recipe_id,
      recipeName: row.recipes?.name ?? "",
      deletedRecipeName: row.deleted_recipe_name,
      variantName: row.variant_name,
      totalPortions: row.total_portions,
      sortOrder: row.sort_order,
      plans: plansByRecipeId.get(row.id) ?? [],
    }));

    // Produkte mit eingebetteten Plan-Zeilen
    const menueProducts: MenueProductDomain[] = (
      (menueProductsResult.data ?? []) as (MenueProductRow & {products: {name: string} | null})[]
    ).map((row) => ({
      uid: row.id,
      menueId: row.menue_id,
      productId: row.product_id,
      productName: row.products?.name ?? "",
      quantity: Number(row.quantity),
      unit: row.unit,
      planMode: row.plan_mode as PlanModeType,
      totalQuantity: Number(row.total_quantity),
      sortOrder: row.sort_order,
      plans: plansByProductId.get(row.id) ?? [],
    }));

    // Materialien mit eingebetteten Plan-Zeilen
    const menueMaterials: MenueMaterialDomain[] = (
      (menueMaterialsResult.data ?? []) as (MenueMaterialRow & {materials: {name: string} | null})[]
    ).map((row) => ({
      uid: row.id,
      menueId: row.menue_id,
      materialId: row.material_id,
      materialName: row.materials?.name ?? "",
      quantity: Number(row.quantity),
      unit: row.unit,
      planMode: row.plan_mode as PlanModeType,
      totalQuantity: Number(row.total_quantity),
      sortOrder: row.sort_order,
      plans: plansByMaterialId.get(row.id) ?? [],
    }));

    // lastSavedAt aus der event_menuplan_tracking-Tabelle lesen.
    const trackingRow = trackingResult.data as {updated_at: string} | null;
    const lastSavedAt = trackingRow
      ? new Date(trackingRow.updated_at)
      : new Date(0);
    const mealTypeRows = (mealTypesResult.data ?? []) as MealTypeRow[];

    return {
      eventId,
      mealTypes: mealTypeRows.map((row) => ({
        uid: row.id,
        name: row.name,
        sortOrder: row.sort_order,
      })),
      meals: ((mealsResult.data ?? []) as MealRow[]).map((row) => ({
        uid: row.id,
        mealDate: row.meal_date,
        mealTypeId: row.meal_type_id,
      })),
      menues: ((menuesResult.data ?? []) as MenueRow[]).map((row) => ({
        uid: row.id,
        mealId: row.meal_id,
        name: row.name,
        sortOrder: row.sort_order,
      })),
      menueRecipes,
      menueProducts,
      menueMaterials,
      notes: ((notesResult.data ?? []) as NoteRow[]).map((row) => ({
        uid: row.id,
        menueId: row.menue_id,
        noteDate: row.note_date,
        text: row.text,
      })),
      lastSavedAt,
    };
  }

  /* =====================================================================
  // Echtzeit-Abonnement für den Menuplan
  // ===================================================================== */
  /**
   * Abonniert Echtzeit-Änderungen an allen Menuplan-Tabellen eines Events.
   * Bei jeder Änderung an einer der Tabellen wird onAnyChange() aufgerufen —
   * der Aufrufer lädt daraufhin den vollständigen Menuplan via getMenuplan() neu.
   *
   * @param eventId - Die ID des Events
   * @param onAnyChange - Callback bei jeder Datenänderung
   * @param onError - Callback bei Fehler
   * @returns Unsubscribe-Funktion
   */
  subscribeToMenuplan(
    eventId: string,
    onAnyChange: () => void,
    onError: (error: Error) => void,
  ): () => void {
    const clientRef = this.client;
    const MAX_RETRIES = 5;
    const BASE_DELAY_MS = 1000;
    const MAX_DELAY_MS = 30_000;

    let retryCount = 0;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let activeChannel: ReturnType<typeof clientRef.channel> | null = null;
    let cancelled = false;

    const handleChange = () => {
      try {
        onAnyChange();
      } catch (err) {
        onError(err instanceof Error ? err : new Error(String(err)));
      }
    };

    /**
     * Erstellt und abonniert einen Realtime-Channel.
     * Bei CHANNEL_ERROR oder TIMED_OUT wird automatisch mit
     * exponentiellem Backoff (1s, 2s, 4s, …, max 30s) erneut versucht.
     * Nach MAX_RETRIES wird onError mit einem permanenten Fehler aufgerufen.
     */
    const subscribe = () => {
      if (cancelled) return;

      const channel = clientRef
        .channel(`menuplan:${eventId}`)
        .on("postgres_changes", {event: "*", schema: "public", table: "event_meal_types", filter: `event_id=eq.${eventId}`}, handleChange)
        .on("postgres_changes", {event: "*", schema: "public", table: "event_meals", filter: `event_id=eq.${eventId}`}, handleChange)
        .on("postgres_changes", {event: "*", schema: "public", table: "event_menues", filter: `event_id=eq.${eventId}`}, handleChange)
        .on("postgres_changes", {event: "*", schema: "public", table: "event_menue_recipes", filter: `event_id=eq.${eventId}`}, handleChange)
        .on("postgres_changes", {event: "*", schema: "public", table: "event_menue_products", filter: `event_id=eq.${eventId}`}, handleChange)
        .on("postgres_changes", {event: "*", schema: "public", table: "event_menue_materials", filter: `event_id=eq.${eventId}`}, handleChange)
        .on("postgres_changes", {event: "*", schema: "public", table: "event_notes", filter: `event_id=eq.${eventId}`}, handleChange)
        .on("postgres_changes", {event: "*", schema: "public", table: "event_menuplan_item_plans", filter: `event_id=eq.${eventId}`}, handleChange)
        .subscribe((status, _err) => {
          if (cancelled) return;

          if (status === "SUBSCRIBED") {
            // Erfolgreich verbunden — Retry-Zähler zurücksetzen
            retryCount = 0;
            return;
          }

          if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
            Sentry.addBreadcrumb({
              category: "realtime",
              message: `Menuplan channel ${status} (attempt ${retryCount + 1}/${MAX_RETRIES})`,
              level: "warning",
              data: {eventId, status, retryCount},
            });

            // Alten Channel aufräumen
            clientRef.removeChannel(channel);
            activeChannel = null;

            if (retryCount >= MAX_RETRIES) {
              const permanentError = new Error(
                `Realtime-Verbindung für menuplan:${eventId} nach ${MAX_RETRIES} Versuchen fehlgeschlagen`,
              );
              Sentry.captureException(permanentError, {extra: {eventId, retryCount}});
              onError(permanentError);
              return;
            }

            // Exponentieller Backoff: 1s, 2s, 4s, 8s, 16s (gedeckelt bei 30s)
            const delay = Math.min(BASE_DELAY_MS * Math.pow(2, retryCount), MAX_DELAY_MS);
            retryCount++;
            retryTimer = setTimeout(subscribe, delay);
          }
        });

      activeChannel = channel;
    };

    // Erste Verbindung aufbauen
    subscribe();

    // Unsubscribe-Funktion: räumt Channel UND ausstehende Retries auf
    return () => {
      cancelled = true;
      if (retryTimer !== null) {
        clearTimeout(retryTimer);
        retryTimer = null;
      }
      if (activeChannel) {
        clientRef.removeChannel(activeChannel);
        activeChannel = null;
      }
    };
  }

  /* =====================================================================
  // Menuplan initialisieren (Standard-Mahlzeitentypen anlegen)
  // ===================================================================== */
  /**
   * Initialisiert den Menuplan eines neuen Events mit Standard-Mahlzeitentypen,
   * Mahlzeiten (je Datum × Mahlzeittyp) und einem leeren Menü pro Mahlzeit.
   *
   * Entspricht dem Verhalten von `Menuplan.factory()`: Für jedes Datum aus den
   * Zeitscheiben und jeden Mahlzeittyp wird eine Mahlzeit (meal) mit einem
   * leeren Menü (menue) erstellt.
   *
   * @param eventId - Die ID des Events
   * @param dates - Die Zeitscheiben des Events (dateFrom/dateTo)
   * @param authUser - Der angemeldete Benutzer (für Audit-Zwecke)
   * @returns Die IDs der erstellten Mahlzeitentypen
   */
  async initializeMenuplan(
    eventId: string,
    dates: {dateFrom: Date; dateTo: Date}[],
    _authUser: AuthUser,
  ): Promise<string[]> {
    // 1. Mahlzeittypen erstellen
    const defaultMealTypes = [
      {name: "Zmorge", sort_order: 10},
      {name: "Zmittag", sort_order: 20},
      {name: "Znacht", sort_order: 30},
    ];

    const mealTypeRows = defaultMealTypes.map((mealType) => ({
      event_id: eventId,
      name: mealType.name,
      sort_order: mealType.sort_order,
    }));

    const {data: mealTypeData, error: mealTypeError} = await this.client
      .from("event_meal_types")
      .insert(mealTypeRows)
      .select("id");

    if (mealTypeError) throw mealTypeError;
    const mealTypeIds = (mealTypeData ?? []).map((row) => row.id as string);

    // 2. Datumsliste aus Zeitscheiben aufbauen (jeder Tag einzeln)
    const allDates: Date[] = [];
    for (const dateRange of dates) {
      const current = new Date(dateRange.dateFrom);
      current.setHours(0, 0, 0, 0);
      const end = new Date(dateRange.dateTo);
      end.setHours(0, 0, 0, 0);
      while (current <= end) {
        allDates.push(new Date(current));
        current.setDate(current.getDate() + 1);
      }
    }

    if (allDates.length === 0 || mealTypeIds.length === 0) {
      return mealTypeIds;
    }

    // 3. Mahlzeiten erstellen (je Datum × Mahlzeittyp)
    const mealRows = allDates.flatMap((date) =>
      mealTypeIds.map((mealTypeId) => ({
        event_id: eventId,
        meal_date: date.toISOString().split("T")[0],
        meal_type_id: mealTypeId,
      })),
    );

    const {data: mealData, error: mealError} = await this.client
      .from("event_meals")
      .insert(mealRows)
      .select("id");

    if (mealError) throw mealError;
    const mealIds = (mealData ?? []).map((row) => row.id as string);

    // 4. Ein leeres Menü pro Mahlzeit erstellen
    const menueRows = mealIds.map((mealId) => ({
      event_id: eventId,
      meal_id: mealId,
      name: "",
      sort_order: 0,
    }));

    const {error: menueError} = await this.client
      .from("event_menues")
      .insert(menueRows);

    if (menueError) throw menueError;

    // Tracking-Zeile für den Menuplan erstellen
    const {error: trackingError} = await this.client
      .from("event_menuplan_tracking")
      .insert({event_id: eventId});

    if (trackingError) throw trackingError;

    return mealTypeIds;
  }

  /* =====================================================================
  // Menuplan speichern (Full-Replace)
  // ===================================================================== */

  /**
   * Speichert den vollständigen Menuplan eines Events mittels Full-Replace-Strategie.
   * Alle bestehenden Zeilen werden gelöscht (CASCADE via event_meal_types) und
   * anschliessend aus dem MenuplanDomain neu eingefügt.
   *
   * @param eventId - Die ID des Events
   * @param menuplan - Das vollständige MenuplanDomain-Objekt
   * @param authUser - Der angemeldete Benutzer (für Audit-Zwecke via DB-Trigger)
   * @throws {Error} Bei Datenbankfehlern
   * @example
   * await repo.saveMenuplan(eventId, menuplan, authUser);
   */
  async saveMenuplan(
    eventId: string,
    menuplan: MenuplanDomain,
    _authUser: AuthUser,
  ): Promise<void> {
    // FK-Referenzen in-memory validieren, BEVOR die RPC-Funktion aufgerufen wird.
    // Fängt logische Fehler früh ab, ohne einen DB-Roundtrip zu verschwenden.
    this.validateMenuplanDomain(menuplan);

    // JSONB-Payload für die atomare RPC-Funktion zusammenbauen.
    // Jedes Array enthält die Zeilen ohne event_id — die Funktion setzt sie selbst.
    const payload = {
      mealTypes: menuplan.mealTypes.map((mt) => ({
        id: mt.uid,
        name: mt.name,
        sort_order: mt.sortOrder,
      })),
      meals: menuplan.meals.map((m) => ({
        id: m.uid,
        meal_date: m.mealDate,
        meal_type_id: m.mealTypeId,
      })),
      menues: menuplan.menues.map((m) => ({
        id: m.uid,
        meal_id: m.mealId,
        name: m.name,
        sort_order: m.sortOrder,
      })),
      menueRecipes: menuplan.menueRecipes.map((r) => ({
        id: r.uid,
        menue_id: r.menueId,
        recipe_id: r.recipeId,
        deleted_recipe_name: r.deletedRecipeName,
        variant_name: r.variantName,
        total_portions: r.totalPortions,
        sort_order: r.sortOrder,
      })),
      menueProducts: menuplan.menueProducts.map((p) => ({
        id: p.uid,
        menue_id: p.menueId,
        product_id: p.productId,
        quantity: p.quantity,
        unit: p.unit,
        plan_mode: p.planMode,
        total_quantity: p.totalQuantity,
        sort_order: p.sortOrder,
      })),
      menueMaterials: menuplan.menueMaterials.map((m) => ({
        id: m.uid,
        menue_id: m.menueId,
        material_id: m.materialId,
        quantity: m.quantity,
        unit: m.unit,
        plan_mode: m.planMode,
        total_quantity: m.totalQuantity,
        sort_order: m.sortOrder,
      })),
      notes: menuplan.notes.map((n) => ({
        id: n.uid,
        menue_id: n.menueId,
        text: n.text,
        note_date: n.noteDate,
      })),
      itemPlans: this.collectItemPlanPayload(menuplan),
    };

    // Atomarer Save via Postgres-Funktion — alles in einer Transaktion.
    const {error} = await this.client.rpc("save_menuplan", {
      p_event_id: eventId,
      p_payload: payload,
    });

    if (error) {
      Sentry.captureException(error, {extra: {eventId}});
      throw error;
    }
  }

  /**
   * Sammelt alle ItemPlan-Einträge aus Rezepten, Produkten und Materialien
   * als flaches Array für den RPC-Payload (ohne event_id).
   *
   * @param menuplan - Das vollständige MenuplanDomain
   * @returns Array von Plan-Objekten für den JSONB-Payload
   */
  private collectItemPlanPayload(
    menuplan: MenuplanDomain,
  ): Record<string, unknown>[] {
    const plans: Record<string, unknown>[] = [];

    // Plans aus Rezepten
    for (const recipe of menuplan.menueRecipes) {
      for (const plan of recipe.plans) {
        plans.push({
          id: plan.uid || crypto.randomUUID(),
          menue_recipe_id: recipe.uid,
          menue_product_id: null,
          menue_material_id: null,
          diet_scope: plan.dietScope,
          diet_id: plan.dietId,
          intolerance_scope: plan.intoleranceScope,
          intolerance_id: plan.intoleranceId,
          factor: plan.factor,
          servings: plan.servings,
        });
      }
    }

    // Plans aus Produkten
    for (const product of menuplan.menueProducts) {
      for (const plan of product.plans) {
        plans.push({
          id: plan.uid || crypto.randomUUID(),
          menue_recipe_id: null,
          menue_product_id: product.uid,
          menue_material_id: null,
          diet_scope: plan.dietScope,
          diet_id: plan.dietId,
          intolerance_scope: plan.intoleranceScope,
          intolerance_id: plan.intoleranceId,
          factor: plan.factor,
          servings: plan.servings,
        });
      }
    }

    // Plans aus Materialien
    for (const material of menuplan.menueMaterials) {
      for (const plan of material.plans) {
        plans.push({
          id: plan.uid || crypto.randomUUID(),
          menue_recipe_id: null,
          menue_product_id: null,
          menue_material_id: material.uid,
          diet_scope: plan.dietScope,
          diet_id: plan.dietId,
          intolerance_scope: plan.intoleranceScope,
          intolerance_id: plan.intoleranceId,
          factor: plan.factor,
          servings: plan.servings,
        });
      }
    }

    return plans;
  }

  /* =====================================================================
  // Menuplan löschen
  // ===================================================================== */

  /**
   * Löscht den gesamten Menuplan eines Events.
   * Durch CASCADE auf event_meal_types werden alle Kindtabellen automatisch bereinigt.
   *
   * @param eventId - Die ID des Events
   * @throws {Error} Bei Datenbankfehlern
   * @example
   * await repo.deleteMenuplan(eventId);
   */
  async deleteMenuplan(eventId: string): Promise<void> {
    const {error} = await this.client
      .from("event_meal_types")
      .delete()
      .eq("event_id", eventId);

    if (error) throw error;
  }

  /* =====================================================================
  // FK-Validierung vor dem Speichern
  // ===================================================================== */

  /**
   * Prüft alle FK-Referenzen im MenuplanDomain in-memory, bevor Daten gelöscht werden.
   * Verhindert, dass bei einem FK-Fehler der Menuplan bereits gelöscht wurde (Datenverlust).
   *
   * @param menuplan - Das zu validierende Domain-Objekt
   * @throws {Error} Bei ungültigen FK-Referenzen
   */
  private validateMenuplanDomain(menuplan: MenuplanDomain): void {
    const mealTypeIds = new Set(menuplan.mealTypes.map((mt) => mt.uid));
    const mealIds = new Set(menuplan.meals.map((m) => m.uid));
    const menueIds = new Set(menuplan.menues.map((m) => m.uid));

    // Meals → MealTypes
    for (const meal of menuplan.meals) {
      if (!mealTypeIds.has(meal.mealTypeId)) {
        throw new Error(
          `Menuplan-Validierung: Meal ${meal.uid} referenziert ungültigen MealType ${meal.mealTypeId}`,
        );
      }
    }

    // Menues → Meals
    for (const menue of menuplan.menues) {
      if (!mealIds.has(menue.mealId)) {
        throw new Error(
          `Menuplan-Validierung: Menue ${menue.uid} referenziert ungültige Meal ${menue.mealId}`,
        );
      }
    }

    // Recipes → Menues
    for (const recipe of menuplan.menueRecipes) {
      if (!menueIds.has(recipe.menueId)) {
        throw new Error(
          `Menuplan-Validierung: Recipe ${recipe.uid} referenziert ungültiges Menue ${recipe.menueId}`,
        );
      }
    }

    // Products → Menues
    for (const product of menuplan.menueProducts) {
      if (!menueIds.has(product.menueId)) {
        throw new Error(
          `Menuplan-Validierung: Product ${product.uid} referenziert ungültiges Menue ${product.menueId}`,
        );
      }
    }

    // Materials → Menues
    for (const material of menuplan.menueMaterials) {
      if (!menueIds.has(material.menueId)) {
        throw new Error(
          `Menuplan-Validierung: Material ${material.uid} referenziert ungültiges Menue ${material.menueId}`,
        );
      }
    }

    // Notes → Menues (wenn menueId gesetzt)
    for (const note of menuplan.notes) {
      if (note.menueId && !menueIds.has(note.menueId)) {
        throw new Error(
          `Menuplan-Validierung: Note ${note.uid} referenziert ungültiges Menue ${note.menueId}`,
        );
      }
    }

    // Notes: noteDate darf nicht leer sein (DB-Spalte ist DATE NOT NULL)
    for (const note of menuplan.notes) {
      if (!note.noteDate || note.noteDate.trim() === "") {
        throw new Error(
          `Menuplan-Validierung: Note ${note.uid} hat kein gültiges Datum (noteDate ist leer)`,
        );
      }
    }

    // Meals: mealDate darf nicht leer sein
    for (const meal of menuplan.meals) {
      if (!meal.mealDate || meal.mealDate.trim() === "") {
        throw new Error(
          `Menuplan-Validierung: Meal ${meal.uid} hat kein gültiges Datum (mealDate ist leer)`,
        );
      }
    }
  }

  /* =====================================================================
  // Private Hilfs-Konverter: Domain → Row
  // ===================================================================== */

  /**
   * Konvertiert ein MealTypeDomain in eine Datenbank-Zeile.
   *
   * @param eventId - Die Event-ID
   * @param domain - Das Domain-Objekt
   * @returns Partielle MealTypeRow für INSERT
   */
  private mealTypeDomainToRow(
    eventId: string,
    domain: MealTypeDomain,
  ): Partial<MealTypeRow> {
    return {
      id: domain.uid,
      event_id: eventId,
      name: domain.name,
      sort_order: domain.sortOrder,
    };
  }

  /**
   * Konvertiert ein MealDomain in eine Datenbank-Zeile.
   *
   * @param eventId - Die Event-ID
   * @param domain - Das Domain-Objekt
   * @returns Partielle MealRow für INSERT
   */
  private mealDomainToRow(
    eventId: string,
    domain: MealDomain,
  ): Partial<MealRow> {
    return {
      id: domain.uid,
      event_id: eventId,
      meal_date: domain.mealDate,
      meal_type_id: domain.mealTypeId,
    };
  }

  /**
   * Konvertiert ein MenueDomain in eine Datenbank-Zeile.
   *
   * @param eventId - Die Event-ID
   * @param domain - Das Domain-Objekt
   * @returns Partielle MenueRow für INSERT
   */
  private menueDomainToRow(
    eventId: string,
    domain: MenueDomain,
  ): Partial<MenueRow> {
    return {
      id: domain.uid,
      event_id: eventId,
      meal_id: domain.mealId,
      name: domain.name,
      sort_order: domain.sortOrder,
    };
  }

  /**
   * Konvertiert ein MenueRecipeDomain in eine Datenbank-Zeile (ohne Plans).
   *
   * @param eventId - Die Event-ID
   * @param domain - Das Domain-Objekt
   * @returns Partielle MenueRecipeRow für INSERT
   */
  private menueRecipeDomainToRow(
    eventId: string,
    domain: MenueRecipeDomain,
  ): Partial<MenueRecipeRow> {
    return {
      id: domain.uid,
      event_id: eventId,
      menue_id: domain.menueId,
      recipe_id: domain.recipeId,
      deleted_recipe_name: domain.deletedRecipeName,
      variant_name: domain.variantName,
      total_portions: domain.totalPortions,
      sort_order: domain.sortOrder,
    };
  }

  /**
   * Konvertiert ein MenueProductDomain in eine Datenbank-Zeile (ohne Plans).
   *
   * @param eventId - Die Event-ID
   * @param domain - Das Domain-Objekt
   * @returns Partielle MenueProductRow für INSERT
   */
  private menueProductDomainToRow(
    eventId: string,
    domain: MenueProductDomain,
  ): Partial<MenueProductRow> {
    return {
      id: domain.uid,
      event_id: eventId,
      menue_id: domain.menueId,
      product_id: domain.productId,
      quantity: domain.quantity,
      unit: domain.unit,
      plan_mode: domain.planMode,
      total_quantity: domain.totalQuantity,
      sort_order: domain.sortOrder,
    };
  }

  /**
   * Konvertiert ein MenueMaterialDomain in eine Datenbank-Zeile (ohne Plans).
   *
   * @param eventId - Die Event-ID
   * @param domain - Das Domain-Objekt
   * @returns Partielle MenueMaterialRow für INSERT
   */
  private menueMaterialDomainToRow(
    eventId: string,
    domain: MenueMaterialDomain,
  ): Partial<MenueMaterialRow> {
    return {
      id: domain.uid,
      event_id: eventId,
      menue_id: domain.menueId,
      material_id: domain.materialId,
      quantity: domain.quantity,
      unit: domain.unit,
      plan_mode: domain.planMode,
      total_quantity: domain.totalQuantity,
      sort_order: domain.sortOrder,
    };
  }

  /**
   * Konvertiert ein NoteDomain in eine Datenbank-Zeile.
   *
   * @param eventId - Die Event-ID
   * @param domain - Das Domain-Objekt
   * @returns Partielle NoteRow für INSERT
   */
  private noteDomainToRow(
    eventId: string,
    domain: NoteDomain,
  ): Partial<NoteRow> {
    return {
      id: domain.uid,
      event_id: eventId,
      menue_id: domain.menueId,
      note_date: domain.noteDate,
      text: domain.text,
    };
  }

  /* =====================================================================
  // UI-ready Methoden — konvertieren Domain ↔ MenuplanData direkt
  // ===================================================================== */

  /**
   * Konvertiert ein ItemPlanDomain in ein PortionPlan (UI-Format).
   *
   * Der dietScope/intoleranceScope wird in die entsprechenden Enum-Werte
   * (PlanedDiet / PlanedIntolerances) oder in die Gruppen-UID aufgelöst.
   *
   * @param plan - Das Domain-Plan-Objekt
   * @returns Das konvertierte PortionPlan-Objekt
   */
  private itemPlanDomainToPortionPlan(plan: ItemPlanDomain): PortionPlan {
    let diet: PlanedDiet | string;
    if (plan.dietScope === "ALL") {
      diet = PlanedDiet.ALL;
    } else if (plan.dietScope === "FIX") {
      diet = PlanedDiet.FIX;
    } else {
      // scope === "group" → die konkrete Diät-UID verwenden
      diet = plan.dietId || "";
    }

    let intolerance: PlanedIntolerances | string;
    if (plan.intoleranceScope === "ALL") {
      intolerance = PlanedIntolerances.ALL;
    } else if (plan.intoleranceScope === "FIX") {
      intolerance = PlanedIntolerances.FIX;
    } else {
      // scope === "group" → die konkrete Intoleranz-UID verwenden
      intolerance = plan.intoleranceId || "";
    }

    return {diet, intolerance, factor: plan.factor, totalPortions: plan.servings};
  }

  /**
   * Konvertiert ein PortionPlan (UI-Format) in ein ItemPlanDomain.
   *
   * @param plan - Das UI-Plan-Objekt
   * @returns Das konvertierte ItemPlanDomain-Objekt
   */
  private portionPlanToItemPlanDomain(plan: PortionPlan): ItemPlanDomain {
    let dietScope: PlanScopeType;
    let dietId: string | null;

    if (plan.diet === PlanedDiet.ALL) {
      dietScope = "ALL";
      dietId = null;
    } else if (plan.diet === PlanedDiet.FIX) {
      dietScope = "FIX";
      dietId = null;
    } else {
      dietScope = "group";
      dietId = plan.diet;
    }

    let intoleranceScope: PlanScopeType;
    let intoleranceId: string | null;

    if (plan.intolerance === PlanedIntolerances.ALL) {
      intoleranceScope = "ALL";
      intoleranceId = null;
    } else if (plan.intolerance === PlanedIntolerances.FIX) {
      intoleranceScope = "FIX";
      intoleranceId = null;
    } else {
      intoleranceScope = "group";
      intoleranceId = plan.intolerance;
    }

    return {
      uid: "",
      dietScope,
      dietId,
      intoleranceScope,
      intoleranceId,
      factor: plan.factor,
      servings: plan.totalPortions,
    };
  }

  /**
   * Lädt den Menuplan eines Events und gibt ihn direkt im UI-Format (MenuplanData) zurück.
   *
   * Konvertiert intern die flachen Domain-Arrays in die verschachtelten Map-Strukturen,
   * die von den UI-Komponenten erwartet werden.
   *
   * @param eventId - Die ID des Events
   * @returns MenuplanData im UI-Format
   *
   * @example
   * const menuplan = await repo.getMenuplanForUi(eventId);
   */
  async getMenuplanForUi(eventId: string): Promise<MenuplanData> {
    const domain = await this.getMenuplan(eventId);
    return this.menuplanDomainToUi(domain, eventId);
  }

  /**
   * Speichert einen Menuplan im UI-Format (MenuplanData) auf die Datenbank.
   *
   * Konvertiert intern die verschachtelten Map-Strukturen in die flachen Domain-Arrays.
   *
   * @param eventId - Die ID des Events
   * @param menuplan - Der Menuplan im UI-Format
   * @param authUser - Der speichernde Benutzer
   *
   * @example
   * await repo.saveMenuplanFromUi(eventId, menuplan, authUser);
   */
  async saveMenuplanFromUi(
    eventId: string,
    menuplan: MenuplanData,
    authUser: AuthUser,
  ): Promise<void> {
    const domain = this.menuplanUiToDomain(menuplan, eventId);
    await this.saveMenuplan(eventId, domain, authUser);
  }

  /**
   * Konvertiert ein MenuplanDomain in ein MenuplanData (UI-Format).
   *
   * Die flachen Arrays des Domain-Modells werden in die verschachtelten
   * Map-Strukturen ({entries, order} bzw. {[uid]: ...}) überführt.
   * Sortierreihenfolgen werden aus den sortOrder-Feldern abgeleitet.
   *
   * @param domain - Das Domain-Objekt
   * @param eventUid - Die Event-UID, wird als Menuplan-UID verwendet
   * @returns MenuplanData im UI-Format
   */
  menuplanDomainToUi(domain: MenuplanDomain, eventUid: string): MenuplanData {
    const menuplan = createEmptyMenuplan();
    menuplan.uid = eventUid;
    menuplan.lastChange = {
      date: domain.lastSavedAt,
      fromUid: "",
      fromDisplayName: "",
    };

    // MealTypes: sortiert nach sortOrder in entries-Map und order-Array
    const sortedMealTypes = [...domain.mealTypes].sort(
      (a, b) => a.sortOrder - b.sortOrder,
    );
    for (const mt of sortedMealTypes) {
      menuplan.mealTypes.entries[mt.uid] = {uid: mt.uid, name: mt.name};
      menuplan.mealTypes.order.push(mt.uid);
    }

    // Menues pro Meal gruppieren (nach sortOrder sortiert)
    const menuesByMealId = new Map<string, MenueDomain[]>();
    for (const menue of domain.menues) {
      const list = menuesByMealId.get(menue.mealId) || [];
      list.push(menue);
      menuesByMealId.set(menue.mealId, list);
    }

    // Meals: MealDomain → Meal-Map
    for (const mealDomain of domain.meals) {
      const menuesForMeal = menuesByMealId.get(mealDomain.uid) || [];
      menuesForMeal.sort((a, b) => a.sortOrder - b.sortOrder);

      const meal: Meal = {
        uid: mealDomain.uid,
        date: mealDomain.mealDate,
        mealType: mealDomain.mealTypeId,
        menuOrder: menuesForMeal.map((m) => m.uid),
      };
      menuplan.meals[meal.uid] = meal;
    }

    // Hilfs-Maps: Welche Recipes/Products/Materials gehören zu welchem Menü?
    const recipesByMenueId = new Map<string, MenueRecipeDomain[]>();
    for (const r of domain.menueRecipes) {
      const list = recipesByMenueId.get(r.menueId) || [];
      list.push(r);
      recipesByMenueId.set(r.menueId, list);
    }

    const productsByMenueId = new Map<string, MenueProductDomain[]>();
    for (const p of domain.menueProducts) {
      const list = productsByMenueId.get(p.menueId) || [];
      list.push(p);
      productsByMenueId.set(p.menueId, list);
    }

    const materialsByMenueId = new Map<string, MenueMaterialDomain[]>();
    for (const m of domain.menueMaterials) {
      const list = materialsByMenueId.get(m.menueId) || [];
      list.push(m);
      materialsByMenueId.set(m.menueId, list);
    }

    // Menues: MenueDomain → Menue-Map (mit Order-Arrays)
    for (const menueDomain of domain.menues) {
      const recipesForMenue = recipesByMenueId.get(menueDomain.uid) || [];
      recipesForMenue.sort((a, b) => a.sortOrder - b.sortOrder);

      const productsForMenue = productsByMenueId.get(menueDomain.uid) || [];
      productsForMenue.sort((a, b) => a.sortOrder - b.sortOrder);

      const materialsForMenue = materialsByMenueId.get(menueDomain.uid) || [];
      materialsForMenue.sort((a, b) => a.sortOrder - b.sortOrder);

      const menue: Menue = {
        uid: menueDomain.uid,
        name: menueDomain.name,
        mealRecipeOrder: recipesForMenue.map((r) => r.uid),
        productOrder: productsForMenue.map((p) => p.uid),
        materialOrder: materialsForMenue.map((m) => m.uid),
      };
      menuplan.menues[menue.uid] = menue;
    }

    // MealRecipes: MenueRecipeDomain → MealRecipe-Map
    for (const recipeDomain of domain.menueRecipes) {
      const mealRecipe: MealRecipe = {
        uid: recipeDomain.uid,
        recipe: {
          recipeUid: recipeDomain.recipeId || "",
          name:
            recipeDomain.recipeId === null
              ? recipeDomain.deletedRecipeName || ""
              : recipeDomain.recipeName,
          type: recipeDomain.variantName ? RecipeType.variant : RecipeType.public,
          createdFromUid: "",
          variantName: recipeDomain.variantName || undefined,
        },
        plan: recipeDomain.plans.map((p) => this.itemPlanDomainToPortionPlan(p)),
        totalPortions: recipeDomain.totalPortions,
      };
      menuplan.mealRecipes[mealRecipe.uid] = mealRecipe;
    }

    // Products: MenueProductDomain → MenuplanProduct-Map
    for (const productDomain of domain.menueProducts) {
      const product: MenuplanProduct = {
        uid: productDomain.uid,
        quantity: productDomain.quantity,
        unit: productDomain.unit || "",
        productUid: productDomain.productId,
        productName: productDomain.productName,
        planMode:
          productDomain.planMode === "total"
            ? GoodsPlanMode.TOTAL
            : GoodsPlanMode.PER_PORTION,
        plan: productDomain.plans.map((p) => this.itemPlanDomainToPortionPlan(p)),
        totalQuantity: productDomain.totalQuantity,
      };
      menuplan.products[product.uid] = product;
    }

    // Materials: MenueMaterialDomain → MenuplanMaterial-Map
    for (const materialDomain of domain.menueMaterials) {
      const material: MenuplanMaterial = {
        uid: materialDomain.uid,
        quantity: materialDomain.quantity,
        unit: materialDomain.unit || "",
        materialUid: materialDomain.materialId,
        materialName: materialDomain.materialName,
        planMode:
          materialDomain.planMode === "total"
            ? GoodsPlanMode.TOTAL
            : GoodsPlanMode.PER_PORTION,
        plan: materialDomain.plans.map((p) => this.itemPlanDomainToPortionPlan(p)),
        totalQuantity: materialDomain.totalQuantity,
      };
      menuplan.materials[material.uid] = material;
    }

    // Notes: NoteDomain → Note-Map
    for (const noteDomain of domain.notes) {
      const note: Note = {
        uid: noteDomain.uid,
        date: noteDomain.noteDate,
        menueUid: noteDomain.menueId || "",
        text: noteDomain.text,
      };
      menuplan.notes[note.uid] = note;
    }

    // Dates: Eindeutige Datumswerte aus den Meals ableiten und sortieren
    const uniqueDateStrings = new Set<string>();
    for (const mealDomain of domain.meals) {
      uniqueDateStrings.add(mealDomain.mealDate);
    }
    menuplan.dates = Array.from(uniqueDateStrings)
      .sort()
      .map((dateStr) => new Date(new Date(dateStr).setUTCHours(0, 0, 0, 0)));

    return menuplan;
  }

  /**
   * Konvertiert ein MenuplanData (UI-Format) in ein MenuplanDomain.
   *
   * Die verschachtelten Map-Strukturen werden in die flachen Array-Strukturen
   * des Domain-Modells überführt. Sortierreihenfolgen werden aus den Positionen
   * in den Order-Arrays abgeleitet (Index × 10).
   *
   * @param menuplan - Der Menuplan im UI-Format
   * @param eventId - Die Event-ID
   * @returns Das konvertierte MenuplanDomain
   */
  menuplanUiToDomain(menuplan: MenuplanData, eventId: string): MenuplanDomain {
    // MealTypes: order-Array mit Index als sortOrder
    const mealTypes: MealTypeDomain[] = menuplan.mealTypes.order.map(
      (uid, index) => ({
        uid,
        name: menuplan.mealTypes.entries[uid].name,
        sortOrder: index * 10,
      }),
    );

    // Meals
    const meals: MealDomain[] = Object.values(menuplan.meals).map((meal) => ({
      uid: meal.uid,
      mealDate: meal.date,
      mealTypeId: meal.mealType,
    }));

    // Hilfs-Map: Menü-UID → zugehörige Meal-UID und Position
    const menueToMealMap = new Map<string, {mealId: string; sortOrder: number}>();
    for (const meal of Object.values(menuplan.meals)) {
      meal.menuOrder.forEach((menueUid, index) => {
        menueToMealMap.set(menueUid, {mealId: meal.uid, sortOrder: index * 10});
      });
    }

    // Menues: Nur Menüs aufnehmen, die einer Meal zugeordnet sind
    const menues: MenueDomain[] = [];
    for (const menue of Object.values(menuplan.menues)) {
      const mapping = menueToMealMap.get(menue.uid);
      if (!mapping) {
        console.warn(
          `menuplanUiToDomain: Menue ${menue.uid} ist keiner Meal zugeordnet — wird übersprungen.`,
        );
        continue;
      }
      menues.push({
        uid: menue.uid,
        mealId: mapping.mealId,
        name: menue.name,
        sortOrder: mapping.sortOrder,
      });
    }

    // Set der gültigen Menü-UIDs
    const validMenueIds = new Set(menues.map((m) => m.uid));

    // MenueRecipes
    const menueRecipes: MenueRecipeDomain[] = [];
    for (const menue of Object.values(menuplan.menues)) {
      if (!validMenueIds.has(menue.uid)) continue;

      menue.mealRecipeOrder.forEach((mealRecipeUid, index) => {
        const mealRecipe = menuplan.mealRecipes[mealRecipeUid];
        if (!mealRecipe) return;

        const isDeleted = !mealRecipe.recipe.recipeUid;

        menueRecipes.push({
          uid: mealRecipe.uid,
          menueId: menue.uid,
          recipeId: isDeleted ? null : mealRecipe.recipe.recipeUid,
          recipeName: isDeleted ? "" : mealRecipe.recipe.name,
          deletedRecipeName: isDeleted ? mealRecipe.recipe.name : null,
          variantName: mealRecipe.recipe.variantName || null,
          totalPortions: mealRecipe.totalPortions,
          sortOrder: index * 10,
          plans: mealRecipe.plan.map((p) => this.portionPlanToItemPlanDomain(p)),
        });
      });
    }

    // MenueProducts
    const menueProducts: MenueProductDomain[] = [];
    for (const menue of Object.values(menuplan.menues)) {
      if (!validMenueIds.has(menue.uid)) continue;

      menue.productOrder.forEach((productUid, index) => {
        const product = menuplan.products[productUid];
        if (!product) return;

        menueProducts.push({
          uid: product.uid,
          menueId: menue.uid,
          productId: product.productUid,
          productName: product.productName,
          quantity: product.quantity,
          unit: product.unit || null,
          planMode:
            product.planMode === GoodsPlanMode.TOTAL ? "total" : "per_portion",
          totalQuantity: product.totalQuantity,
          sortOrder: index * 10,
          plans: product.plan.map((p) => this.portionPlanToItemPlanDomain(p)),
        });
      });
    }

    // MenueMaterials
    const menueMaterials: MenueMaterialDomain[] = [];
    for (const menue of Object.values(menuplan.menues)) {
      if (!validMenueIds.has(menue.uid)) continue;

      menue.materialOrder.forEach((materialUid, index) => {
        const material = menuplan.materials[materialUid];
        if (!material) return;

        menueMaterials.push({
          uid: material.uid,
          menueId: menue.uid,
          materialId: material.materialUid,
          materialName: material.materialName,
          quantity: material.quantity,
          unit: material.unit || null,
          planMode:
            material.planMode === GoodsPlanMode.TOTAL ? "total" : "per_portion",
          totalQuantity: material.totalQuantity,
          sortOrder: index * 10,
          plans: material.plan.map((p) => this.portionPlanToItemPlanDomain(p)),
        });
      });
    }

    // Notes
    const notes: NoteDomain[] = Object.values(menuplan.notes).map((note) => ({
      uid: note.uid,
      menueId: note.menueUid || null,
      noteDate: note.date,
      text: note.text,
    }));

    return {
      eventId,
      mealTypes,
      meals,
      menues,
      menueRecipes,
      menueProducts,
      menueMaterials,
      notes,
      lastSavedAt: menuplan.lastChange.date,
    };
  }
}
