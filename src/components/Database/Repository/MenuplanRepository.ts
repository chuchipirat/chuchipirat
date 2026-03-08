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
    ]);

    if (mealTypesResult.error) throw mealTypesResult.error;
    if (mealsResult.error) throw mealsResult.error;
    if (menuesResult.error) throw menuesResult.error;
    if (menueRecipesResult.error) throw menueRecipesResult.error;
    if (menueProductsResult.error) throw menueProductsResult.error;
    if (menueMaterialsResult.error) throw menueMaterialsResult.error;
    if (notesResult.error) throw notesResult.error;
    if (plansResult.error) throw plansResult.error;

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

    return {
      eventId,
      mealTypes: ((mealTypesResult.data ?? []) as MealTypeRow[]).map((row) => ({
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

    const handleChange = () => {
      try {
        onAnyChange();
      } catch (err) {
        onError(err instanceof Error ? err : new Error(String(err)));
      }
    };

    // Ein einziger Channel für alle 8 Menuplan-Tabellen — spart Realtime-Connections
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
      .subscribe((status, err) => {
        console.debug(`Realtime menuplan:${eventId} status: ${status}`, err ?? "");
        if (status === "CHANNEL_ERROR") {
          onError(new Error(`Realtime-Fehler für menuplan:${eventId}`));
        }
      });

    return () => {
      clientRef.removeChannel(channel);
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
    authUser: AuthUser,
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
    authUser: AuthUser,
  ): Promise<void> {
    // Schritt 0: FK-Referenzen in-memory validieren, BEVOR gelöscht wird.
    // Verhindert Datenverlust durch delete-then-fail-insert.
    this.validateMenuplanDomain(menuplan);

    // Schritt 1: Alle bestehenden Daten löschen — CASCADE räumt Kindtabellen auf
    const {error: deleteError} = await this.client
      .from("event_meal_types")
      .delete()
      .eq("event_id", eventId);

    if (deleteError) throw deleteError;

    // Schritt 2: Elterntabellen zuerst einfügen, dann Kindtabellen

    // event_meal_types
    if (menuplan.mealTypes.length > 0) {
      const mealTypeRows = menuplan.mealTypes.map((mt) =>
        this.mealTypeDomainToRow(eventId, mt),
      );
      const {error} = await this.client
        .from("event_meal_types")
        .insert(mealTypeRows);
      if (error) throw error;
    }

    // event_meals
    if (menuplan.meals.length > 0) {
      const mealRows = menuplan.meals.map((m) =>
        this.mealDomainToRow(eventId, m),
      );
      const {error} = await this.client.from("event_meals").insert(mealRows);
      if (error) throw error;
    }

    // event_menues
    if (menuplan.menues.length > 0) {
      const menueRows = menuplan.menues.map((m) =>
        this.menueDomainToRow(eventId, m),
      );
      const {error} = await this.client.from("event_menues").insert(menueRows);
      if (error) throw error;
    }

    // event_menue_recipes (ohne Plans)
    if (menuplan.menueRecipes.length > 0) {
      const recipeRows = menuplan.menueRecipes.map((r) =>
        this.menueRecipeDomainToRow(eventId, r),
      );
      const {error} = await this.client
        .from("event_menue_recipes")
        .insert(recipeRows);
      if (error) throw error;
    }

    // event_menue_products (ohne Plans)
    if (menuplan.menueProducts.length > 0) {
      const productRows = menuplan.menueProducts.map((p) =>
        this.menueProductDomainToRow(eventId, p),
      );
      const {error} = await this.client
        .from("event_menue_products")
        .insert(productRows);
      if (error) throw error;
    }

    // event_menue_materials (ohne Plans)
    if (menuplan.menueMaterials.length > 0) {
      const materialRows = menuplan.menueMaterials.map((m) =>
        this.menueMaterialDomainToRow(eventId, m),
      );
      const {error} = await this.client
        .from("event_menue_materials")
        .insert(materialRows);
      if (error) throw error;
    }

    // event_notes
    if (menuplan.notes.length > 0) {
      const noteRows = menuplan.notes.map((n) =>
        this.noteDomainToRow(eventId, n),
      );
      const {error} = await this.client.from("event_notes").insert(noteRows);
      if (error) throw error;
    }

    // event_menuplan_item_plans — aus allen Rezepten, Produkten und Materialien sammeln
    const planRows = this.collectItemPlanRows(eventId, menuplan);
    if (planRows.length > 0) {
      const {error} = await this.client
        .from("event_menuplan_item_plans")
        .insert(planRows);
      if (error) throw error;
    }
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

  /**
   * Sammelt alle ItemPlan-Zeilen aus Rezepten, Produkten und Materialien
   * und gibt sie als flaches Array von INSERT-Rows zurück.
   *
   * @param eventId - Die Event-ID
   * @param menuplan - Das vollständige MenuplanDomain
   * @returns Array von partiellen ItemPlanRow-Objekten
   */
  private collectItemPlanRows(
    eventId: string,
    menuplan: MenuplanDomain,
  ): Partial<ItemPlanRow>[] {
    const rows: Partial<ItemPlanRow>[] = [];

    // Plans aus Rezepten
    for (const recipe of menuplan.menueRecipes) {
      for (const plan of recipe.plans) {
        rows.push({
          ...(plan.uid ? {id: plan.uid} : {}),
          event_id: eventId,
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
        rows.push({
          ...(plan.uid ? {id: plan.uid} : {}),
          event_id: eventId,
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
        rows.push({
          ...(plan.uid ? {id: plan.uid} : {}),
          event_id: eventId,
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

    return rows;
  }
}
