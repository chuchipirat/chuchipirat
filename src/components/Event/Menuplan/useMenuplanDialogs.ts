/**
 * Custom Hook, der alle Dialog-bezogenen Zustände der Menüplan-Seite bündelt.
 *
 * Fasst die 7 useState-Hooks für die verschiedenen Dialoge (Rezeptsuche,
 * Rezept-Drawer, Menü-Auswahl, Mahlzeit-Auswahl, Portionenplanung,
 * Menü-Bearbeitung, Produkt/Material) in einem einzigen Hook zusammen.
 *
 * @returns Objekt mit allen Dialog-Zuständen und deren Setter-Funktionen.
 *
 * @example
 * const {
 *   recipeSearchDrawerData,
 *   setRecipeSearchDrawerData,
 *   dialogGoodsData,
 *   setDialogGoodsData,
 *   GOODS_DATA_DIALOG_INITIAL_DATA,
 *   // ...
 * } = useMenuplanDialogs();
 */
import {useState} from "react";

import type {
  RecipeSearchDrawerData,
  DialogSelectMenueData,
  DialogSelectMealData,
  DialogPlanPortionsData,
  DialogEditMenueData,
  DialogGoodsData,
} from "./menuplan.page.types";
import {GoodsType} from "./menuplan.types";
import type {MenuplanPdfOptions} from "./dialogMenuplanPdfOptions";
import {PlanedObject} from "./menuplan.constants";
import {
  RecipeDrawerData,
  RECIPE_DRAWER_DATA_INITIAL_VALUES,
} from "../../Recipe/RecipeDrawer";
import {DialogSelectMenuesForRecipeDialogValues} from "./dialogSelectMenues";
import RecipeShort from "../../Recipe/recipeShort.class";

/* ===================================================================
// ===================== Initiale Dialog-Werte =======================
// =================================================================== */

/** Initialwerte für den Rezeptsuche-Drawer. */
const RECIPE_SEARCH_DRAWER_INITIAL_DATA: RecipeSearchDrawerData = {
  open: false,
  isLoadingData: false,
  menue: null,
};

/** Initialwerte für den Menü-Auswahl-Dialog. */
const DIALOG_SELECT_MENUE_INITIAL_DATA: DialogSelectMenueData = {
  open: false,
  menues: {} as DialogSelectMenuesForRecipeDialogValues,
  selectedRecipe: {} as RecipeShort,
  singleSelection: false,
  caller: "",
  dragAndDropHandler: {
    listElementUid: "",
    menuUid: "",
    dragAndDropListType: "",
  },
};

/** Initialwerte für den Mahlzeit-Auswahl-Dialog. */
const DIALOG_SELECT_MEAL_INITIAL_DATA: DialogSelectMealData = {
  open: false,
  dragAndDropHandler: {menuUid: "", mealUid: ""},
};

/** Initialwerte für den Portionenplan-Dialog. */
const DIALOG_PLAN_PORTIONS_INITIAL_DATA: DialogPlanPortionsData = {
  open: false,
  menues: null,
  mealRecipeUid: "",
  portionPlan: [],
  planedMaterial: null,
  planedProduct: null,
  planedObject: PlanedObject.RECIPE,
};

/** Initialwerte für den Menü-Bearbeitungs-Dialog. */
const DIALOG_EDIT_MENUE_INITIAL_DATA: DialogEditMenueData = {
  open: false,
  menueUid: "",
};

/** Initialwerte für den Produkt/Material-Dialog (Goods). */
const GOODS_DATA_DIALOG_INITIAL_DATA: DialogGoodsData = {
  open: false,
  menueUid: "",
  goodsType: GoodsType.NONE,
  product: null,
  material: null,
};

/** Initialwerte für den PDF-Optionen-Dialog. */
const DIALOG_PDF_OPTIONS_INITIAL_DATA: DialogPdfOptionsData = {
  open: false,
};

/**
 * Zustand des PDF-Optionen-Dialogs.
 *
 * @param open - Ob der Dialog geöffnet ist
 */
export interface DialogPdfOptionsData {
  open: boolean;
}

/* ===================================================================
// ======================== Return-Typ ===============================
// =================================================================== */

/**
 * Rückgabetyp des useMenuplanDialogs-Hooks.
 *
 * Enthält alle Dialog-Zustände, deren Setter sowie die Initialwerte-Konstante
 * für den Goods-Dialog (wird beim Schliessen benötigt).
 */
export interface UseMenuplanDialogsReturn {
  /** Zustand des Rezeptsuche-Drawers. */
  recipeSearchDrawerData: RecipeSearchDrawerData;
  /** Setter für den Rezeptsuche-Drawer. */
  setRecipeSearchDrawerData: React.Dispatch<
    React.SetStateAction<RecipeSearchDrawerData>
  >;

  /** Zähler zum Zurücksetzen der Suche im Rezept-Drawer nach dem Hinzufügen. */
  recipeSearchResetKey: number;
  /** Setter für den Reset-Zähler. */
  setRecipeSearchResetKey: React.Dispatch<React.SetStateAction<number>>;

  /** Zustand des Rezept-Detail-Drawers. */
  recipeDrawerData: RecipeDrawerData;
  /** Setter für den Rezept-Detail-Drawer. */
  setRecipeDrawerData: React.Dispatch<React.SetStateAction<RecipeDrawerData>>;

  /** Zustand des Menü-Auswahl-Dialogs. */
  dialogSelectMenueData: DialogSelectMenueData;
  /** Setter für den Menü-Auswahl-Dialog. */
  setDialogSelectMenueData: React.Dispatch<
    React.SetStateAction<DialogSelectMenueData>
  >;

  /** Zustand des Mahlzeit-Auswahl-Dialogs. */
  dialogSelectMealData: DialogSelectMealData;
  /** Setter für den Mahlzeit-Auswahl-Dialog. */
  setDialogSelectMealData: React.Dispatch<
    React.SetStateAction<DialogSelectMealData>
  >;

  /** Zustand des Portionenplan-Dialogs. */
  dialogPlanPortionsData: DialogPlanPortionsData;
  /** Setter für den Portionenplan-Dialog. */
  setDialogPlanPortionsData: React.Dispatch<
    React.SetStateAction<DialogPlanPortionsData>
  >;

  /** Zustand des Menü-Bearbeitungs-Dialogs. */
  dialogEditMenue: DialogEditMenueData;
  /** Setter für den Menü-Bearbeitungs-Dialog. */
  setDialogEditMenue: React.Dispatch<
    React.SetStateAction<DialogEditMenueData>
  >;

  /** Zustand des Produkt/Material-Dialogs (Goods). */
  dialogGoodsData: DialogGoodsData;
  /** Setter für den Produkt/Material-Dialog. */
  setDialogGoodsData: React.Dispatch<React.SetStateAction<DialogGoodsData>>;

  /** Initialwerte für den Goods-Dialog (zum Zurücksetzen beim Schliessen). */
  GOODS_DATA_DIALOG_INITIAL_DATA: DialogGoodsData;

  /** Zustand des PDF-Optionen-Dialogs. */
  dialogPdfOptionsData: DialogPdfOptionsData;
  /** Setter für den PDF-Optionen-Dialog. */
  setDialogPdfOptionsData: React.Dispatch<
    React.SetStateAction<DialogPdfOptionsData>
  >;
}

/* ===================================================================
// =========================== Hook ==================================
// =================================================================== */

/**
 * Bündelt alle Dialog-bezogenen useState-Hooks der Menüplan-Seite.
 *
 * Vereinfacht die MenuplanPage-Komponente, indem die 7 Dialog-States
 * in einem einzigen Custom Hook zusammengefasst werden.
 *
 * @returns Alle Dialog-Zustände, Setter und die GOODS_DATA_DIALOG_INITIAL_DATA-Konstante.
 */
export function useMenuplanDialogs(): UseMenuplanDialogsReturn {
  const [recipeSearchDrawerData, setRecipeSearchDrawerData] =
    useState<RecipeSearchDrawerData>(RECIPE_SEARCH_DRAWER_INITIAL_DATA);

  // Zähler zum Zurücksetzen der Suche im Rezept-Drawer nach dem Hinzufügen
  const [recipeSearchResetKey, setRecipeSearchResetKey] = useState(0);

  const [recipeDrawerData, setRecipeDrawerData] = useState<RecipeDrawerData>(
    RECIPE_DRAWER_DATA_INITIAL_VALUES
  );

  const [dialogSelectMenueData, setDialogSelectMenueData] =
    useState<DialogSelectMenueData>(DIALOG_SELECT_MENUE_INITIAL_DATA);

  const [dialogSelectMealData, setDialogSelectMealData] =
    useState<DialogSelectMealData>(DIALOG_SELECT_MEAL_INITIAL_DATA);

  const [dialogPlanPortionsData, setDialogPlanPortionsData] =
    useState<DialogPlanPortionsData>(DIALOG_PLAN_PORTIONS_INITIAL_DATA);

  const [dialogEditMenue, setDialogEditMenue] =
    useState<DialogEditMenueData>(DIALOG_EDIT_MENUE_INITIAL_DATA);

  const [dialogGoodsData, setDialogGoodsData] = useState<DialogGoodsData>(
    GOODS_DATA_DIALOG_INITIAL_DATA
  );

  const [dialogPdfOptionsData, setDialogPdfOptionsData] =
    useState<DialogPdfOptionsData>(DIALOG_PDF_OPTIONS_INITIAL_DATA);

  return {
    recipeSearchDrawerData,
    setRecipeSearchDrawerData,
    recipeSearchResetKey,
    setRecipeSearchResetKey,
    recipeDrawerData,
    setRecipeDrawerData,
    dialogSelectMenueData,
    setDialogSelectMenueData,
    dialogSelectMealData,
    setDialogSelectMealData,
    dialogPlanPortionsData,
    setDialogPlanPortionsData,
    dialogEditMenue,
    setDialogEditMenue,
    dialogGoodsData,
    setDialogGoodsData,
    GOODS_DATA_DIALOG_INITIAL_DATA,
    dialogPdfOptionsData,
    setDialogPdfOptionsData,
  };
}
