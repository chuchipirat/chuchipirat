/**
 * Seitenebene-Typen für die Menüplan-Seite (MenuplanPage).
 *
 * Enthält Interfaces für Dialog-Zustände, Props und lokale State-Typen,
 * die nur innerhalb der Menüplan-Seite und deren Dialogen verwendet werden.
 */
import {
  Menue,
  Meal,
  MealRecipe,
  PortionPlan,
  MenuplanMaterial,
  MenuplanProduct,
  MenuplanData,
} from "./menuplan.types";
import {GoodsType} from "./menuplan.types";
import {PlanedObject} from "./menuplan.constants";
import {DrawerSettings} from "../../Recipe/RecipeDrawer";
import {DialogSelectMenuesForRecipeDialogValues} from "./dialogSelectMenues";
import RecipeShort from "../../Recipe/recipeShort.class";
import {MenuplanDragDropTypes} from "./menuplan.constants";
import {Recipes} from "../../Recipe/recipe.class";
import Recipe from "../../Recipe/recipe.class";
import EventGroupConfiguration, {
  Diet,
  Intolerance,
} from "../GroupConfiguration/groupConfiguration.class";
import Unit from "../../Unit/unit.class";
import Product from "../../Product/product.class";
import Material from "../../Material/material.class";
import Department from "../../Department/department.class";
import Firebase from "../../Firebase/firebase.class";
import AuthUser from "../../Firebase/Authentication/authUser.class";
import {
  FetchMissingDataProps,
  OnMasterdataCreateProps,
} from "../Event/event";
import EventClass from "../Event/event.class";
import {PlanedDiet} from "./menuplan.types";

/* ===================================================================
// ========================= Menuplan-Callback =======================
// =================================================================== */

/**
 * Typisiertes Update-Objekt für den Menüplan.
 * Erlaubt nur gültige Felder des Menüplans zu aktualisieren.
 */
export type OnMenuplanUpdate = Partial<MenuplanData>;

/* ===================================================================
// ========================= Page Props ==============================
// =================================================================== */

/**
 * Props für die MenuplanPage-Komponente.
 *
 * @param menuplan - Aktueller Menüplan
 * @param recipes - Geladene Rezepte (Key-Value)
 * @param recipeList - Liste kurzer Rezepteinträge für die Suche
 * @param groupConfiguration - Gruppen-Konfiguration des Events
 * @param event - Event-Objekt
 * @param units - Verfügbare Einheiten
 * @param products - Verfügbare Produkte
 * @param materials - Verfügbare Materialien
 * @param departments - Verfügbare Abteilungen
 * @param firebase - Firebase-Instanz
 * @param authUser - Authentifizierter Benutzer
 * @param onMenuplanUpdate - Callback bei Menüplan-Änderung
 * @param fetchMissingData - Callback zum Nachladen von Daten
 * @param onMasterdataCreate - Callback bei Stammdaten-Erstellung
 * @param onRecipeUpdate - Callback bei Rezept-Änderung
 */
export interface MenuplanPageProps {
  menuplan: MenuplanData;
  recipes: Recipes;
  recipeList: RecipeShort[];
  groupConfiguration: EventGroupConfiguration;
  event: EventClass;
  units: Unit[];
  products: Product[];
  materials: Material[];
  departments: Department[];
  firebase: Firebase;
  authUser: AuthUser;
  onMenuplanUpdate: (menuplan: MenuplanData) => void;
  fetchMissingData: ({type, recipeShort}: FetchMissingDataProps) => void;
  onMasterdataCreate: ({type, value}: OnMasterdataCreateProps) => void;
  onRecipeUpdate: (recipe: Recipe) => void;
}

/* ===================================================================
// ========================= Drawer-State ============================
// =================================================================== */

/**
 * Daten für den Rezept-Suchen-Drawer.
 *
 * @param open - Ob der Drawer geöffnet ist
 * @param isLoadingData - Ob Daten geladen werden
 * @param menue - Das Menü, zu dem ein Rezept hinzugefügt werden soll
 */
export interface RecipeSearchDrawerData extends DrawerSettings {
  menue: Menue | null;
}

/**
 * Callback-Interface für die Auswahl eines Rezepts.
 *
 * @param recipe - Das ausgewählte Rezept
 */
export interface OnRecipeSelection {
  recipe: RecipeShort;
}

/* ===================================================================
// ========================= Dialog States ===========================
// =================================================================== */

/**
 * State für den Menü-Auswahl-Dialog.
 *
 * @param open - Ob der Dialog geöffnet ist
 * @param menues - Vorausgewählte Menüs
 * @param selectedRecipe - Das ausgewählte Rezept
 * @param singleSelection - Ob nur ein Menü gewählt werden kann
 * @param caller - Name der aufrufenden Funktion
 * @param dragAndDropHandler - DnD-spezifische Daten
 */
export interface DialogSelectMenueData {
  open: boolean;
  menues: DialogSelectMenuesForRecipeDialogValues;
  selectedRecipe: RecipeShort;
  singleSelection: boolean;
  caller: string;
  dragAndDropHandler: {
    listElementUid: string;
    menuUid: Menue["uid"];
    dragAndDropListType: MenuplanDragDropTypes | "";
  };
}

/**
 * State für den Mahlzeit-Auswahl-Dialog.
 *
 * @param open - Ob der Dialog geöffnet ist
 * @param dragAndDropHandler - DnD-spezifische Daten (Quell-Menü und -Mahlzeit)
 */
export interface DialogSelectMealData {
  open: boolean;
  dragAndDropHandler: {
    menuUid: Menue["uid"];
    mealUid: Meal["uid"];
  };
}

/**
 * State für den Portionenplan-Dialog.
 *
 * @param open - Ob der Dialog geöffnet ist
 * @param menues - Gewählte Menüs
 * @param mealRecipeUid - UID des MealRecipe (bei Bearbeitung)
 * @param portionPlan - Aktueller Portionsplan
 * @param planedMaterial - Geplantes Material (bei Goods)
 * @param planedProduct - Geplantes Produkt (bei Goods)
 * @param planedObject - Typ des geplanten Objekts
 */
export interface DialogPlanPortionsData {
  open: boolean;
  menues: DialogSelectMenuesForRecipeDialogValues | null;
  mealRecipeUid: MealRecipe["uid"];
  portionPlan: PortionPlan[];
  planedMaterial: MenuplanMaterial | null;
  planedProduct: MenuplanProduct | null;
  planedObject: PlanedObject;
}

/**
 * State für den Menü-Bearbeitungs-Dialog.
 *
 * @param open - Ob der Dialog geöffnet ist
 * @param menueUid - UID des zu bearbeitenden Menüs
 */
export interface DialogEditMenueData {
  open: boolean;
  menueUid: Menue["uid"];
}

/**
 * State für den Produkt/Material-Dialog.
 *
 * @param open - Ob der Dialog geöffnet ist
 * @param menueUid - UID des Menüs
 * @param goodsType - Typ des Guts (Material oder Produkt)
 * @param product - Zu bearbeitendes Produkt (oder null bei Neuanlage)
 * @param material - Zu bearbeitendes Material (oder null bei Neuanlage)
 */
export interface DialogGoodsData {
  open: boolean;
  menueUid: Menue["uid"];
  goodsType: GoodsType;
  product: MenuplanProduct | null;
  material: MenuplanMaterial | null;
}

/* ===================================================================
// ============= Dialog-interne Typen (Portionenplanung) =============
// =================================================================== */

/**
 * Planungsinfo für eine einzelne Intoleranz/Gruppe innerhalb des Portionenplans.
 *
 * @param active - Ob die Checkbox aktiviert ist
 * @param factor - Multiplikationsfaktor als String (wegen Eingabe-Validierung)
 * @param portions - Basis-Portionen
 * @param total - Berechnete Gesamtportionen
 * @param diet - UID der gewählten Diät
 */
export interface DialogPlanPortionsPlanningInfo {
  active: boolean;
  factor: string;
  portions: number;
  total: number;
  diet: Diet["uid"];
}

/**
 * Planungseinträge pro Diät — Map von Intoleranz-UID zu Planungsinfo.
 * Bildet die Einträge innerhalb eines Diät-Tabs ab.
 */
export interface DialogPlanPortionsDietPlanning {
  [key: Intolerance["uid"]]: DialogPlanPortionsPlanningInfo;
}

/**
 * Planung für ein Menü — Map von Diät-UID zu Intoleranz-Planung.
 * Ermöglicht Multi-Diät-Planung: jede Diät hat eigene Intoleranz-Checkboxen.
 */
export interface DialogPlanPortionsMealPlanning {
  [dietUid: Diet["uid"]]: DialogPlanPortionsDietPlanning;
}

/**
 * Plan über alle Menüs — Map von Menü-UID zu Planung (oder null wenn noch nicht initialisiert).
 */
export interface DialogPlanPortionsMealPlan {
  [key: Menue["uid"]]: DialogPlanPortionsMealPlanning | null;
}

/**
 * Interner State des Portionenplan-Dialogs.
 *
 * @param keepMenuPortionsInSync - Ob Portionen über Menüs synchronisiert werden
 * @param activeTabs - Aktiver Tab (Diät) pro Menü — rein visuell, beeinflusst nicht den Plan
 * @param menueList - Liste der Menü-UIDs (oder SYNC-Key)
 * @param plan - Der eigentliche Portionsplan (mehrstufig: Menü → Diät → Intoleranz)
 */
export interface DialogPlanPortionsDialogValues {
  keepMenuPortionsInSync: boolean;
  activeTabs: {[key: Menue["uid"]]: string} | null;
  menueList: string[] | null;
  plan: DialogPlanPortionsMealPlan | null;
}

/* ===================================================================
// ==================== Dialog Goods Typen ===========================
// =================================================================== */

/**
 * Interner State des Produkt/Material-Dialogs.
 *
 * @param planMode - Planungsmodus (Total oder pro Portion)
 * @param quantity - Menge
 * @param unit - Einheits-Key
 * @param product - Gewähltes Produkt
 * @param material - Gewähltes Material
 * @param dialogOpen - Ob der Dialog tatsächlich geöffnet ist (gesteuert über State)
 */
export interface DialogGoodsValues {
  planMode: number;
  quantity: number;
  unit: Unit["key"];
  product: Product | null;
  material: Material | null;
  dialogOpen: boolean;
}

/**
 * Props für das Hinzufügen eines Guts (Material/Produkt) zum Menü.
 *
 * @param planMode - Planungsmodus
 * @param quantity - Menge
 * @param unit - Einheits-Key
 * @param product - Gewähltes Produkt (oder null)
 * @param material - Gewähltes Material (oder null)
 */
export interface OnAddGoodToMenuProps {
  planMode: number;
  quantity: number;
  unit: Unit["key"];
  product: Product | null;
  material: Material | null;
}
