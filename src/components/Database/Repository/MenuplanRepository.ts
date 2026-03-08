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
        .select("*")
        .eq("event_id", eventId)
        .order("sort_order"),
      this.client
        .from("event_menue_products")
        .select("*")
        .eq("event_id", eventId)
        .order("sort_order"),
      this.client
        .from("event_menue_materials")
        .select("*")
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
      (menueRecipesResult.data ?? []) as MenueRecipeRow[]
    ).map((row) => ({
      uid: row.id,
      menueId: row.menue_id,
      recipeId: row.recipe_id,
      deletedRecipeName: row.deleted_recipe_name,
      variantName: row.variant_name,
      totalPortions: row.total_portions,
      sortOrder: row.sort_order,
      plans: plansByRecipeId.get(row.id) ?? [],
    }));

    // Produkte mit eingebetteten Plan-Zeilen
    const menueProducts: MenueProductDomain[] = (
      (menueProductsResult.data ?? []) as MenueProductRow[]
    ).map((row) => ({
      uid: row.id,
      menueId: row.menue_id,
      productId: row.product_id,
      quantity: Number(row.quantity),
      unit: row.unit,
      planMode: row.plan_mode as PlanModeType,
      totalQuantity: Number(row.total_quantity),
      sortOrder: row.sort_order,
      plans: plansByProductId.get(row.id) ?? [],
    }));

    // Materialien mit eingebetteten Plan-Zeilen
    const menueMaterials: MenueMaterialDomain[] = (
      (menueMaterialsResult.data ?? []) as MenueMaterialRow[]
    ).map((row) => ({
      uid: row.id,
      menueId: row.menue_id,
      materialId: row.material_id,
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

    const tables = [
      "event_meal_types",
      "event_meals",
      "event_menues",
      "event_menue_recipes",
      "event_menue_products",
      "event_menue_materials",
      "event_notes",
      "event_menuplan_item_plans",
    ];

    const channels = tables.map((tableName) =>
      clientRef
        .channel(`menuplan:${tableName}:${eventId}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: tableName,
            filter: `event_id=eq.${eventId}`,
          },
          () => {
            try {
              onAnyChange();
            } catch (err) {
              onError(err instanceof Error ? err : new Error(String(err)));
            }
          },
        )
        .subscribe((status) => {
          if (status === "CHANNEL_ERROR") {
            onError(new Error(`Realtime-Fehler für ${tableName}:${eventId}`));
          }
        }),
    );

    return () => {
      for (const channel of channels) {
        clientRef.removeChannel(channel);
      }
    };
  }

  /* =====================================================================
  // Menuplan initialisieren (Standard-Mahlzeitentypen anlegen)
  // ===================================================================== */
  /**
   * Initialisiert den Menuplan eines neuen Events mit Standard-Mahlzeitentypen.
   * Wird beim Erstellen eines neuen Events aufgerufen.
   *
   * @param eventId - Die ID des Events
   * @param authUser - Der angemeldete Benutzer (für Audit-Zwecke)
   * @returns Die IDs der erstellten Mahlzeitentypen
   */
  async initializeMenuplan(
    eventId: string,
    authUser: AuthUser,
  ): Promise<string[]> {
    const defaultMealTypes = [
      {name: "Zmorge", sort_order: 10},
      {name: "Zmittag", sort_order: 20},
      {name: "Znacht", sort_order: 30},
    ];

    const rows = defaultMealTypes.map((mealType) => ({
      event_id: eventId,
      name: mealType.name,
      sort_order: mealType.sort_order,
    }));

    const {data, error} = await this.client
      .from("event_meal_types")
      .insert(rows)
      .select("id");

    if (error) throw error;
    return (data ?? []).map((row) => row.id as string);
  }
}
