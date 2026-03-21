/**
 * Typdefinitionen für den Menüplan.
 *
 * Enthält alle Interfaces, Enums und Konstanten, die von der Menüplan-Logik
 * und den UI-Komponenten verwendet werden. Decoupled von der Geschäftslogik
 * in menuplanService.ts.
 */
import Recipe from "../../Recipe/recipe.class";
import Product from "../../Product/product.class";
import Material from "../../Material/material.class";
import Unit from "../../Unit/unit.class";
import {ChangeRecord} from "../../Shared/global.interface";
import {Diet, Intolerance} from "../GroupConfiguration/groupConfiguration.class";

/* =====================================================================
// Generische Hilfstypen
// ===================================================================== */

/**
 * Generische Map-Struktur mit Einträgen und Reihenfolge-Array.
 * Ermöglicht O(1)-Zugriff per Key und definierte Sortierung.
 *
 * @param T - Typ der Einträge
 */
export interface MenuplanObjectStructure<T> {
  entries: {[key: string]: T};
  order: string[];
}

/* =====================================================================
// Mahlzeitentypen (MealType)
// ===================================================================== */

/**
 * Ein Mahlzeitentyp (z.B. Frühstück, Mittagessen, Abendessen).
 *
 * @param uid - Eindeutige ID
 * @param name - Anzeigename
 */
export interface MealType {
  uid: string;
  name: string;
}

/* =====================================================================
// Menüs (Menue)
// ===================================================================== */

/**
 * Order-Typen für die verschiedenen Listen innerhalb eines Menüs oder Menüplans.
 */
export enum MenueListOrderTypes {
  mealRecipeOrder = "mealRecipeOrder",
  materialOrder = "materialOrder",
  productOrder = "productOrder",
  mealTypeOrder = "order",
  menuOrder = "menuOrder",
}

/**
 * Ein Menü-Container innerhalb einer Mahlzeit.
 * Enthält Referenzen auf Rezepte, Materialien und Produkte in definierter Reihenfolge.
 *
 * @param uid - Eindeutige ID
 * @param name - Name des Menüs
 * @param mealRecipeOrder - Reihenfolge der Rezept-UIDs
 * @param materialOrder - Reihenfolge der Material-UIDs
 * @param productOrder - Reihenfolge der Produkt-UIDs
 */
export interface Menue {
  uid: string;
  name: string;
  mealRecipeOrder: Recipe["uid"][];
  materialOrder: Material["uid"][];
  productOrder: Product["uid"][];
}

/**
 * Map aller Menüs, indiziert nach Menü-UID.
 */
export interface Menues {
  [key: Menue["uid"]]: Menue;
}

/* =====================================================================
// Mahlzeiten (Meal)
// ===================================================================== */

/**
 * Eine Mahlzeit — Kombination aus Datum und Mahlzeitentyp.
 * Enthält ein Array von Menü-UIDs in der gewünschten Reihenfolge.
 *
 * @param uid - Eindeutige ID
 * @param date - Datum im Format YYYY-MM-DD
 * @param mealType - UID des Mahlzeitentyps
 * @param mealTypeName - Optionaler Anzeigename des Mahlzeitentyps
 * @param menuOrder - Reihenfolge der Menü-UIDs
 */
export interface Meal {
  uid: string;
  date: string; // YYYY-MM-DD
  mealType: MealType["uid"];
  mealTypeName?: MealType["name"];
  menuOrder: Menue["uid"][];
}

/**
 * Map aller Mahlzeiten, indiziert nach Meal-UID.
 */
export interface Meals {
  [key: Meal["uid"]]: Meal;
}

/* =====================================================================
// Notizen (Note)
// ===================================================================== */

/**
 * Eine Notiz im Menüplan, optional einem Menü zugeordnet.
 *
 * @param uid - Eindeutige ID
 * @param date - Datum im Format YYYY-MM-DD
 * @param menueUid - UID des zugehörigen Menüs (leer wenn keinem Menü zugeordnet)
 * @param text - Notiztext
 */
export interface Note {
  uid: string;
  date: string; // YYYY-MM-DD
  menueUid: Menue["uid"];
  text: string;
}

/**
 * Map aller Notizen, indiziert nach Note-UID.
 */
export interface Notes {
  [key: Note["uid"]]: Note;
}

/* =====================================================================
// Portionsplanung (Plan)
// ===================================================================== */

/**
 * Geplante Unverträglichkeit — Scope-Typ für die Portionsplanung.
 */
export enum PlanedIntolerances {
  ALL = "ALL",
  FIX = "FIX",
}

/**
 * Geplante Diät — Scope-Typ für die Portionsplanung.
 */
export enum PlanedDiet {
  ALL = "ALL",
  FIX = "FIX",
}

/**
 * Eine einzelne Portionsplan-Zeile.
 *
 * @param diet - Diät-Scope: PlanedDiet.ALL/FIX oder eine konkrete Diät-UID
 * @param intolerance - Intoleranz-Scope: PlanedIntolerances.ALL/FIX oder eine konkrete Intoleranz-UID
 * @param factor - Multiplikationsfaktor
 * @param totalPortions - Berechnete Gesamtportionen
 */
export interface PortionPlan {
  diet: PlanedDiet | Diet["uid"];
  intolerance: PlanedIntolerances | Intolerance["uid"];
  factor: number;
  totalPortions: number;
}

/* =====================================================================
// Menüplan-Rezepte (MealRecipe)
// ===================================================================== */

/**
 * Ein eingeplantes Rezept innerhalb eines Menüs.
 *
 * @param uid - Eindeutige ID
 * @param recipe - Rezeptdaten (UID, Name, Typ, Ersteller, optionaler Variantenname)
 * @param plan - Portionsplan-Zeilen
 * @param totalPortions - Summe aller Portionen
 */
export interface MealRecipe {
  uid: string;
  recipe: {
    recipeUid: Recipe["uid"];
    name: Recipe["name"];
    type: Recipe["type"];
    createdFromUid: Recipe["created"]["fromUid"];
    variantName?: string;
  };
  plan: PortionPlan[];
  totalPortions: number;
}

/**
 * Map aller eingeplanten Rezepte, indiziert nach MealRecipe-UID.
 */
export interface MealRecipes {
  [key: MealRecipe["uid"]]: MealRecipe;
}

/* =====================================================================
// Materialien & Produkte im Menüplan
// ===================================================================== */

/**
 * Gütertyp: Material, Produkt oder keines.
 */
export enum GoodsType {
  NONE,
  MATERIAL = "MATERIAL",
  PRODUCT = "PRODUCT",
}

/**
 * Planungsmodus für Materialien und Produkte.
 */
export enum GoodsPlanMode {
  TOTAL,
  PER_PORTION,
}

/**
 * Ein eingeplantes Material innerhalb eines Menüs.
 *
 * @param uid - Eindeutige ID
 * @param quantity - Basismenge
 * @param unit - Einheits-Key
 * @param materialUid - FK auf Material
 * @param materialName - Anzeigename des Materials
 * @param planMode - Planungsmodus (Total oder pro Portion)
 * @param plan - Portionsplan-Zeilen
 * @param totalQuantity - Summe aller Plan-Positionen
 */
export interface MenuplanMaterial {
  uid: string;
  quantity: number;
  unit: Unit["key"];
  materialUid: Material["uid"];
  materialName: Material["name"];
  planMode: GoodsPlanMode;
  plan: PortionPlan[];
  totalQuantity: number;
}

/**
 * Map aller eingeplanten Materialien, indiziert nach MenuplanMaterial-UID.
 */
export interface Materials {
  [key: MenuplanMaterial["uid"]]: MenuplanMaterial;
}

/**
 * Ein eingeplantes Produkt innerhalb eines Menüs.
 *
 * @param uid - Eindeutige ID
 * @param quantity - Basismenge
 * @param unit - Einheits-Key
 * @param productUid - FK auf Produkt
 * @param productName - Anzeigename des Produkts
 * @param planMode - Planungsmodus (Total oder pro Portion)
 * @param plan - Portionsplan-Zeilen
 * @param totalQuantity - Summe aller Plan-Positionen
 */
export interface MenuplanProduct {
  uid: string;
  quantity: number;
  unit: Unit["key"];
  productUid: Product["uid"];
  productName: Product["name"];
  planMode: GoodsPlanMode;
  plan: PortionPlan[];
  totalQuantity: number;
}

/**
 * Map aller eingeplanten Produkte, indiziert nach MenuplanProduct-UID.
 */
export interface Products {
  [key: MenuplanProduct["uid"]]: MenuplanProduct;
}

/* =====================================================================
// Koordinaten & Hilfstypen
// ===================================================================== */

/**
 * Koordinaten eines Menüs innerhalb des Menüplans.
 * Wird verwendet, um Menüs in der richtigen Reihenfolge zu sortieren.
 *
 * @param menueUid - UID des Menüs
 * @param date - Datum
 * @param menueName - Name des Menüs
 * @param mealUid - UID der Mahlzeit
 * @param mealType - Mahlzeitentyp
 */
export interface MenueCoordinates {
  menueUid: Menue["uid"];
  date: Date;
  menueName: Menue["name"];
  mealUid: Meal["uid"];
  mealType: MealType;
}

/**
 * Ein geplantes Rezept mit Kontext (Mahlzeit, Menü, Portionsplan).
 *
 * @param mealPlanRecipe - UID des MealRecipe
 * @param meal - Zugehörige Mahlzeit
 * @param menue - Zugehöriges Menü
 * @param mealPlan - Portionsplan-Zeilen
 */
export interface PlanedMealsRecipe {
  mealPlanRecipe: MealRecipe["uid"];
  meal: Meal;
  menue: Menue;
  mealPlan: PortionPlan[];
}

/* =====================================================================
// Konsistenz-Check
// ===================================================================== */

/**
 * Bericht über entfernte Elemente beim Konsistenz-Check.
 *
 * @param menues - Entfernte Menü-UIDs
 * @param mealRecipes - Entfernte MealRecipe-UIDs
 * @param materials - Entfernte Material-UIDs
 * @param products - Entfernte Produkt-UIDs
 */
export interface ConsistencyReport {
  menues: string[];
  mealRecipes: string[];
  materials: string[];
  products: string[];
}

/**
 * Ergebnis des Menüplan-Konsistenz-Checks.
 *
 * @param menuplan - Bereinigte Kopie des Menüplans
 * @param report - Details über entfernte Elemente
 * @param isConsistent - true, wenn keine Inkonsistenzen gefunden wurden
 */
export interface FixMenuplanResult {
  menuplan: MenuplanData;
  report: ConsistencyReport;
  isConsistent: boolean;
}

/* =====================================================================
// MenuplanData — Hauptinterface (ersetzt die Menuplan-Klasse)
// ===================================================================== */

/**
 * Vollständige Datenstruktur eines Menüplans.
 * Ersetzt die ehemalige Menuplan-Klasse als reines Datenobjekt.
 *
 * @param uid - Event-UID (identisch mit Event.uid)
 * @param dates - Sortierte Liste der Tage
 * @param mealTypes - Mahlzeitentypen mit Reihenfolge
 * @param meals - Mahlzeiten (Datum × MealType)
 * @param menues - Menü-Container
 * @param notes - Notizen
 * @param mealRecipes - Eingeplante Rezepte
 * @param materials - Eingeplante Materialien
 * @param products - Eingeplante Produkte
 * @param created - Erstellungs-Audit
 * @param lastChange - Letzte-Änderung-Audit
 * @param usedRecipes - UIDs der verwendeten Rezepte (optional, nur für bestimmte Views)
 * @param usedProducts - UIDs der verwendeten Produkte (optional)
 * @param usedMaterials - UIDs der verwendeten Materialien (optional)
 */
export interface MenuplanData {
  uid: string;
  dates: Date[];
  mealTypes: MenuplanObjectStructure<MealType>;
  meals: Meals;
  menues: Menues;
  notes: Notes;
  mealRecipes: MealRecipes;
  materials: Materials;
  products: Products;
  created: ChangeRecord;
  lastChange: ChangeRecord;
  usedRecipes?: Recipe["uid"][];
  usedProducts?: Product["uid"][];
  usedMaterials?: Material["uid"][];
}
