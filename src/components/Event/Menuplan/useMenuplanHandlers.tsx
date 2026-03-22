/**
 * Custom Hook, der alle nicht-DnD Event-Handler der Menüplan-Seite bündelt.
 *
 * Extrahiert sämtliche Handler-Funktionen aus MenuplanPage (Settings, Change,
 * Print, Recipe/Drawer, Goods, Edit-Menü, Dialog-Flow, MenuCard, Plan-Edit),
 * damit die Komponente schlanker bleibt und die Logik isoliert testbar ist.
 *
 * @returns Objekt mit allen Handler-Funktionen, die MenuplanPage und deren
 *          Kind-Komponenten benötigen.
 *
 * @example
 * const handlers = useMenuplanHandlers({menuplan, event, ...});
 * <MenuplanHeaderRow onPrint={handlers.onPrint} ... />
 */
import React, {useCallback, useRef} from "react";
import {pdf} from "@react-pdf/renderer";
import {saveAs} from "file-saver";
import * as Sentry from "@sentry/react";

import {
  Menue,
  Note,
  Meal,
  PortionPlan,
  PlanedMealsRecipe,
  MealRecipe,
  GoodsType,
  GoodsPlanMode,
  MenuplanMaterial,
  MenuplanProduct,
  MealRecipes,
  MenuplanData,
} from "./menuplan.types";
import {
  deleteMealType,
  addMealType,
  createMaterial,
  createProduct,
  createMealRecipe,
  addPlanToGood,
  findMenueOfMealRecipe,
  findMenueOfMealProduct,
  findMenueOfMealMaterial,
} from "./menuplanService";
import {OnRecipeCardClickProps} from "../../Recipe/recipes";
import {
  DELETE as TEXT_DELETE,
  SUFFIX_PDF as TEXT_SUFFIX_PDF,
  ALL_MEAL_AND_VALUES_WILL_BE_DELETED as TEXT_ALL_MEAL_AND_VALUES_WILL_BE_DELETED,
  ATTENTION as TEXT_ATTENTION,
} from "../../../constants/text";
import {
  FetchMissingDataType,
  FetchMissingDataProps,
  MasterDataCreateType,
  OnMasterdataCreateProps,
} from "../Event/event";

import {MenuplanPdf} from "./menuplanPdf";
import type {MenuplanPdfOptions} from "./dialogMenuplanPdfOptions";
import Action from "../../../constants/actions";

import RecipeShort from "../../Recipe/recipeShort.class";
import Recipe, {RecipeType, Recipes} from "../../Recipe/recipe.class";
import Product from "../../Product/product.class";
import Material from "../../Material/material.class";
import {DialogType} from "../../Shared/customDialogContext";
import {DialogSelectMenuesForRecipeDialogValues} from "./dialogSelectMenues";
import {RECIPE_DRAWER_DATA_INITIAL_VALUES} from "../../Recipe/RecipeDrawer";

import {
  MenuplanSettings,
  MenueEditTypes,
  OnMealTypeUpdate,
  OnNoteUpdate,
  EditMenueObjectManipulation,
  PlanedObject,
  getOrderListNameFromDragAndDropTypes,
} from "./menuplan.constants";
import type {
  OnMenuplanUpdate,
  OnRecipeSelection,
  DialogPlanPortionsMealPlanning,
  OnAddGoodToMenuProps,
} from "./menuplan.page.types";
import type {UseMenuplanDialogsReturn} from "./useMenuplanDialogs";
import {EventGroupConfiguration} from "../GroupConfiguration/groupConfiguration.class";
import EventClass from "../Event/event.class";
import Unit from "../../Unit/unit.class";
import Department from "../../Department/department.class";
import Firebase from "../../Firebase/firebase.class";
import AuthUser from "../../Firebase/Authentication/authUser.class";


/**
 * Eingangsparameter für den useMenuplanHandlers-Hook.
 *
 * @param menuplan - Aktueller Menüplan-Zustand.
 * @param groupConfiguration - Gruppen-Konfiguration des Events.
 * @param event - Event-Objekt.
 * @param recipes - Geladene Rezepte (Key-Value-Map).
 * @param recipeList - Liste kurzer Rezepteinträge für die Suche.
 * @param firebase - Firebase-Instanz.
 * @param authUser - Authentifizierter Benutzer.
 * @param units - Verfügbare Einheiten.
 * @param products - Verfügbare Produkte.
 * @param materials - Verfügbare Materialien.
 * @param departments - Verfügbare Abteilungen.
 * @param menuplanSettings - Aktuelle Menüplan-Einstellungen (Details, DnD).
 * @param setMenuPlanSettings - Setter für die Menüplan-Einstellungen.
 * @param onMenuplanUpdateSuper - Callback, um den Menüplan an den Eltern-State zu übergeben.
 * @param onRecipeUpdateSuper - Callback, um ein Rezept an den Eltern-State zu übergeben.
 * @param fetchMissingData - Callback zum Nachladen fehlender Daten.
 * @param onMasterdataCreate - Callback bei Stammdaten-Erstellung.
 * @param customDialog - Dialog-Funktion aus dem customDialogContext.
 * @param dialogs - Alle Dialog-Zustände und Setter aus useMenuplanDialogs.
 * @param userDidChangeDnD - Ref, ob der User DnD manuell umgeschaltet hat.
 */
export interface UseMenuplanHandlersParams {
  menuplan: MenuplanData;
  groupConfiguration: EventGroupConfiguration;
  event: EventClass;
  recipes: Recipes;
  recipeList: RecipeShort[];
  firebase: Firebase;
  authUser: AuthUser;
  units: Unit[];
  products: Product[];
  materials: Material[];
  departments: Department[];
  menuplanSettings: MenuplanSettings;
  setMenuPlanSettings: React.Dispatch<React.SetStateAction<MenuplanSettings>>;
  onMenuplanUpdateSuper: (menuplan: MenuplanData) => void;
  onRecipeUpdateSuper: (recipe: Recipe) => void;
  fetchMissingData: ({type, recipeShort}: FetchMissingDataProps) => void;
  onMasterdataCreate: ({type, value}: OnMasterdataCreateProps) => void;
  customDialog: (options: {
    dialogType: DialogType;
    text: string;
    title: string;
    buttonTextConfirm?: string;
  }) => Promise<unknown>;
  dialogs: UseMenuplanDialogsReturn;
  userDidChangeDnD: React.MutableRefObject<boolean>;
}


/**
 * Rückgabetyp des useMenuplanHandlers-Hooks.
 *
 * Enthält alle Handler-Funktionen, die in der MenuplanPage-JSX und deren
 * Kind-Komponenten aufgerufen werden.
 */
export interface UseMenuplanHandlersReturn {
  /** Details ein-/ausblenden. */
  onSwitchShowDetails: () => void;
  /** Drag & Drop ein-/ausschalten. */
  onSwitchEnableDragAndDrop: () => void;
  /** Mahlzeittyp hinzufügen, bearbeiten oder löschen. */
  onMealTypeUpdate: (params: OnMealTypeUpdate) => Promise<void>;
  /** Notiz hinzufügen, bearbeiten oder löschen. */
  onNoteUpdate: (params: OnNoteUpdate) => void;
  /** PDF-Optionen-Dialog öffnen. */
  onPrint: () => void;
  /** PDF mit gewählten Optionen generieren. */
  onPrintConfirm: (options: MenuplanPdfOptions) => void;
  /** PDF-Optionen-Dialog schliessen. */
  onPrintCancel: () => void;
  /** Rezept-Suche-Drawer öffnen für ein bestimmtes Menü. */
  onAddRecipe: (menue: Menue) => void;
  /** Rezept-Suche-Drawer schliessen. */
  onRecipeSearchDrawerClose: () => void;
  /** Rezept-Detail-Drawer schliessen. */
  onRecipeDrawerClose: () => void;
  /** Rezeptkarte angeklickt — Drawer öffnen. */
  onRecipeCardClick: (params: OnRecipeCardClickProps) => void;
  /** Rezept aus Suche ausgewählt — Menü-Auswahl-Dialog öffnen. */
  onRecipeSelection: (params: OnRecipeSelection) => void;
  /** Rezept wurde aktualisiert (Name, Variante etc.). */
  onRecipeUpdate: (recipe: Recipe) => void;
  /** Neues Rezept anlegen (leerer Drawer). */
  onNewRecipe: () => void;
  /** Bearbeitungsmodus des Rezept-Drawers umschalten. */
  onRecipeSwitchEditMode: () => void;
  /** Rezept aus dem Menüplan entfernen. */
  onRecipeDelete: () => void;
  /** Material-Dialog öffnen. */
  onAddMaterial: (menueUid: Menue["uid"]) => void;
  /** Produkt-Dialog öffnen. */
  onAddProduct: (menueUid: Menue["uid"]) => void;
  /** Produkt/Material-Dialog abbrechen. */
  onDialogGoodsCancel: () => void;
  /** Produkt/Material-Dialog bestätigen. */
  onDialogGoodsOk: (params: OnAddGoodToMenuProps) => void;
  /** Menü-Bearbeitungs-Dialog öffnen. */
  onEditMenue: (menueUid: Menue["uid"]) => void;
  /** Menü-Bearbeitungs-Dialog schliessen. */
  onCloseDialogEditMenue: () => void;
  /** Objekt im Menü bearbeiten (Portionen anpassen). */
  onEditMenueEditObject: (params: EditMenueObjectManipulation) => void;
  /** Objekt aus dem Menü löschen. */
  onEditMenueDeleteObject: (params: EditMenueObjectManipulation) => void;
  /** Material-Stammdaten erstellen (Callback nach oben). */
  onMaterialCreate: (material: Material) => void;
  /** Produkt-Stammdaten erstellen (Callback nach oben). */
  onProductCreate: (product: Product) => void;
  /** Menü-Auswahl-Dialog schliessen. */
  onDialogSelectMenueClose: () => void;
  /** Menü-Auswahl-Dialog bestätigen — weiter zum Portionenplan oder DnD-Move. */
  onDialogSelectMenueContinue: (
    selectedMenues: DialogSelectMenuesForRecipeDialogValues,
  ) => void;
  /** Mahlzeit-Auswahl-Dialog schliessen. */
  onDialogSelectMealClose: () => void;
  /** Mahlzeit-Auswahl-Dialog bestätigen (DnD-Move). */
  onDialogSelectMealConfirm: (mealUid: Meal["uid"]) => void;
  /** Portionenplan-Dialog: zurück zur Menü-Auswahl. */
  onDialogPlanPortionsBack: () => void;
  /** Portionenplan-Dialog schliessen. */
  onDialogPlanPortionsClose: () => void;
  /** Portionenplan-Dialog bestätigen. */
  onDialogPlanPortionsAdd: (plan: {
    [key: string]: DialogPlanPortionsMealPlanning;
  }) => void;
  /** MealRecipe-Karte angeklickt — Rezept-Drawer öffnen. */
  onMealRecipeOpen: (mealRecipeUid: MealRecipe["uid"]) => void;
  /** Portionen eines Rezepts im Menüplan bearbeiten. */
  onEditRecipeMealPlan: (mealRecipeUid: MealRecipe["uid"]) => void;
  /** Produkt im Menüplan bearbeiten (Goods-Dialog öffnen). */
  onEditProductPlan: (productUid: MenuplanProduct["uid"]) => void;
  /** Material im Menüplan bearbeiten (Goods-Dialog öffnen). */
  onEditMaterialPlan: (materialUid: MenuplanProduct["uid"]) => void;
  /** Partielle Aktualisierung des Menüplans (Merge). */
  onMenuplanUpdate: (valuesToUpdate: OnMenuplanUpdate) => void;
}


/**
 * Bündelt alle nicht-DnD Event-Handler der Menüplan-Seite.
 *
 * Die Handler werden 1:1 aus MenuplanPage extrahiert und benötigen
 * sämtliche Dialog-State-Setter aus useMenuplanDialogs sowie die
 * übergeordneten Callbacks (onMenuplanUpdateSuper, onRecipeUpdateSuper usw.).
 *
 * @param params - Alle benötigten Abhängigkeiten (State, Setter, Callbacks).
 * @returns Alle Handler-Funktionen für MenuplanPage.
 */
export function useMenuplanHandlers({
  menuplan,
  groupConfiguration,
  event,
  recipes,
  recipeList,
  firebase,
  authUser,
  units,
  products,
  materials,
  departments,
  menuplanSettings,
  setMenuPlanSettings,
  onMenuplanUpdateSuper,
  onRecipeUpdateSuper,
  fetchMissingData,
  onMasterdataCreate,
  customDialog,
  dialogs,
  userDidChangeDnD,
}: UseMenuplanHandlersParams): UseMenuplanHandlersReturn {
  const {
    recipeSearchDrawerData,
    setRecipeSearchDrawerData,
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
    setDialogPdfOptionsData,
  } = dialogs;

  // Ref-Snapshot aller reaktiven Werte — ermöglicht stabile useCallback-Referenzen.
  // Die Setter-Funktionen (setMenuPlanSettings, setRecipeSearchDrawerData etc.)
  // sind von React bereits stabil und brauchen keine Refs.
  const ctx = useRef({
    menuplan,
    menuplanSettings,
    recipes,
    recipeList,
    units,
    products,
    materials,
    departments,
    event,
    authUser,
    onMenuplanUpdateSuper,
    onRecipeUpdateSuper,
    fetchMissingData,
    onMasterdataCreate,
    customDialog,
    recipeSearchDrawerData,
    recipeDrawerData,
    dialogSelectMenueData,
    dialogSelectMealData,
    dialogPlanPortionsData,
    dialogEditMenue,
    dialogGoodsData,
    GOODS_DATA_DIALOG_INITIAL_DATA,
  });
  ctx.current = {
    menuplan,
    menuplanSettings,
    recipes,
    recipeList,
    units,
    products,
    materials,
    departments,
    event,
    authUser,
    onMenuplanUpdateSuper,
    onRecipeUpdateSuper,
    fetchMissingData,
    onMasterdataCreate,
    customDialog,
    recipeSearchDrawerData,
    recipeDrawerData,
    dialogSelectMenueData,
    dialogSelectMealData,
    dialogPlanPortionsData,
    dialogEditMenue,
    dialogGoodsData,
    GOODS_DATA_DIALOG_INITIAL_DATA,
  };

  /* ------------------------------------------
  // Interner Helper: Menüplan partiell aktualisieren
  // ------------------------------------------ */
  const onMenuplanUpdate = useCallback((valuesToUpdate: OnMenuplanUpdate) => {
    const {menuplan, onMenuplanUpdateSuper} = ctx.current;
    // die geänderten Daten mit den aktuellen Menüplan mergen
    onMenuplanUpdateSuper({...menuplan, ...valuesToUpdate});
  }, []);

  /* ------------------------------------------
  // Setting-Handling
  // ------------------------------------------ */
  const onSwitchShowDetails = useCallback(() => {
    const {menuplanSettings} = ctx.current;
    setMenuPlanSettings({
      ...menuplanSettings,
      showDetails: !menuplanSettings.showDetails,
    });
  }, []);
  const onSwitchEnableDragAndDrop = useCallback(() => {
    const {menuplanSettings} = ctx.current;
    userDidChangeDnD.current = true;
    setMenuPlanSettings({
      ...menuplanSettings,
      enableDragAndDrop: !menuplanSettings.enableDragAndDrop,
    });
  }, []);

  /* ------------------------------------------
  // Change-Handler
  // ------------------------------------------ */
  const onMealTypeUpdate = useCallback(
    async ({action, mealType}: OnMealTypeUpdate) => {
      const {menuplan, customDialog, onMenuplanUpdateSuper} = ctx.current;
      const tempMealTypes = {...menuplan.mealTypes};
      let mealTypes = {} as MenuplanData["mealTypes"];
      let meals = {} as MenuplanData["meals"];
      let menues = {} as MenuplanData["menues"];
      let mealRecipes = {} as MenuplanData["mealRecipes"];
      let products = {} as MenuplanData["products"];
      let materials = {} as MenuplanData["materials"];
      let isConfirmed: boolean;
      switch (action) {
        case Action.DELETE:
          isConfirmed = (await customDialog({
            dialogType: DialogType.Confirm,
            text: TEXT_ALL_MEAL_AND_VALUES_WILL_BE_DELETED,
            title: `\u26a0\ufe0f  ${TEXT_ATTENTION}`,
            buttonTextConfirm: TEXT_DELETE,
          })) as boolean;
          if (!isConfirmed) {
            return;
          }

          ({mealTypes, meals, menues, mealRecipes, products, materials} =
            deleteMealType({
              mealTypeToDelete: mealType,
              mealTypes: menuplan.mealTypes,
              meals: menuplan.meals,
              menues: menuplan.menues,
              mealRecipes: menuplan.mealRecipes,
              products: menuplan.products,
              materials: menuplan.materials,
            }));
          onMenuplanUpdateSuper({
            ...menuplan,
            mealTypes: mealTypes,
            meals: meals,
            menues: menues,
            mealRecipes: mealRecipes,
            products: products,
            materials: materials,
          });

          break;
        case Action.ADD:
          ({mealTypes, meals, menues} = addMealType({
            mealType: mealType,
            mealTypes: menuplan.mealTypes,
            meals: menuplan.meals,
            menues: menuplan.menues,
            dates: menuplan.dates,
          }));
          onMenuplanUpdateSuper({
            ...menuplan,
            mealTypes: mealTypes,
            meals: meals,
            menues: menues,
          });
          break;
        case Action.EDIT:
          tempMealTypes.entries[mealType.uid] = {...mealType};
          onMenuplanUpdateSuper({...menuplan, mealTypes: tempMealTypes});
          break;
      }
    },
    [],
  );

  const onNoteUpdate = useCallback(({action, note}: OnNoteUpdate) => {
    const {menuplan} = ctx.current;
    const updatedNotes = {...menuplan.notes};
    let updatedNote: Note;
    switch (action) {
      case Action.ADD:
        updatedNotes[note.uid] = note;
        break;
      case Action.EDIT:
        updatedNote = {...updatedNotes[note.uid]};
        updatedNote.text = note.text;
        updatedNotes[note.uid] = updatedNote;
        break;
      case Action.DELETE:
        delete updatedNotes[note.uid];
        break;
    }
    onMenuplanUpdate({...menuplan, notes: updatedNotes});
  }, []);

  /* ------------------------------------------
  // PDF generieren
  // ------------------------------------------ */
  const onPrint = useCallback(() => {
    setDialogPdfOptionsData({open: true});
  }, []);

  const onPrintConfirm = useCallback((options: MenuplanPdfOptions) => {
    setDialogPdfOptionsData({open: false});
    const {event, menuplan, authUser} = ctx.current;
    pdf(
      <MenuplanPdf
        event={event}
        menuplan={menuplan}
        authUser={authUser}
        pdfOptions={options}
      />
    )
      .toBlob()
      .then((result) => {
        saveAs(result, "Menueplan " + event.name + TEXT_SUFFIX_PDF);
      })
      .catch((error) => {
        Sentry.captureException(error, {extra: {eventUid: event.uid}});
      });
  }, []);

  const onPrintCancel = useCallback(() => {
    setDialogPdfOptionsData({open: false});
  }, []);

  /* ------------------------------------------
  // Drawer-Handling
  // ------------------------------------------ */
  const onAddRecipe = useCallback((menue: Menue) => {
    const {recipeSearchDrawerData, recipeList, fetchMissingData} = ctx.current;
    setRecipeSearchDrawerData({
      ...recipeSearchDrawerData,
      open: true,
      isLoadingData: recipeList.length == 0 ? true : false,
      menue: menue,
    });
    if (recipeList.length == 0) {
      fetchMissingData({type: FetchMissingDataType.RECIPES});
    }
  }, []);
  const onRecipeSearchDrawerClose = useCallback(() => {
    const {recipeSearchDrawerData} = ctx.current;
    setRecipeSearchDrawerData({
      ...recipeSearchDrawerData,
      open: false,
    });
  }, []);
  const onRecipeDrawerClose = useCallback(() => {
    setRecipeDrawerData(RECIPE_DRAWER_DATA_INITIAL_VALUES);
  }, []);
  const onRecipeCardClick = useCallback(
    ({recipe: recipeShort}: OnRecipeCardClickProps) => {
      const {recipes, recipeDrawerData, fetchMissingData} = ctx.current;
      let recipe = new Recipe();
      recipe.uid = recipeShort.uid;

      if (Object.prototype.hasOwnProperty.call(recipes, recipeShort.uid)) {
        recipe = recipes[recipeShort.uid] as Recipe;
      } else {
        // Rezept noch nicht vorhanden --> holen
        fetchMissingData({
          type: FetchMissingDataType.RECIPE,
          recipeShort: recipeShort,
        });
      }
      setRecipeDrawerData({
        ...recipeDrawerData,
        open: true,
        isLoadingData: !Object.prototype.hasOwnProperty.call(
          recipes,
          recipeShort.uid,
        ),
        recipe: recipe,
        scaledPortions: 0,
      });
    },
    [],
  );
  const onRecipeSelection = useCallback(
    ({recipe: recipeShort}: OnRecipeSelection) => {
      const {dialogSelectMenueData, recipeSearchDrawerData} = ctx.current;
      setDialogSelectMenueData({
        ...dialogSelectMenueData,
        open: true,
        menues: {
          [recipeSearchDrawerData?.menue?.uid as MenuplanData["uid"]]: true,
        },
        selectedRecipe: recipeShort,
        singleSelection: false,
        caller: "onRecipeSelection",
      });
    },
    [],
  );
  const onRecipeUpdate = useCallback((recipe: Recipe) => {
    const {
      menuplan,
      recipeDrawerData,
      dialogSelectMenueData,
      onRecipeUpdateSuper,
    } = ctx.current;
    if (recipe.type == RecipeType.variant) {
      if (recipe.uid == "") {
        // Variante wird gerade neu erstellt. Noch nicht hochgeben
        // Erst wenn die Variante angelegt wurde.
        recipe = Recipe.createEmptyListEntries({recipe: recipe});

        setRecipeDrawerData({
          ...recipeDrawerData,
          recipe: recipe,
          editMode: true,
        });
        // Noch nicht weiter hochgeben. Rezept wurde noch nicht gespeichert
        return;
      } else if (recipe.uid !== "" && recipeDrawerData.recipe.uid == "") {
        // Variante wurde erstellt und gespeichert
        if (recipeDrawerData.mealPlan.length > 0) {
          // Aus Rezept eine Variante erstellt. Bestehendes in MealRecipe austauschen
          const updatedMealRecipes = {...menuplan.mealRecipes};
          updatedMealRecipes[
            recipeDrawerData.mealPlan[0].mealPlanRecipe
          ].recipe = {
            ...updatedMealRecipes[recipeDrawerData.mealPlan[0].mealPlanRecipe]
              .recipe,
            name: recipe.name,
            variantName: recipe.variantProperties?.variantName,
            recipeUid: recipe.uid,
            type: recipe.type,
          };
          onMenuplanUpdate({
            mealRecipes: updatedMealRecipes,
          });
        }
        setDialogSelectMenueData({
          ...dialogSelectMenueData,
          selectedRecipe: RecipeShort.createShortRecipeFromRecipe(recipe),
          singleSelection: false,
          caller: "onRecipeUpdate",
        });
        setRecipeDrawerData({
          ...recipeDrawerData,
          recipe: recipe,
          editMode: false,
        });
      } else {
        if (recipeDrawerData.mealPlan.length > 0) {
          const updatedMealRecipes = {} as MealRecipes;
          recipeDrawerData.mealPlan.forEach((mealPlan) => {
            if (
              menuplan.mealRecipes[mealPlan.mealPlanRecipe]?.recipe.variantName !=
              recipe.variantProperties?.variantName
            ) {
              updatedMealRecipes[mealPlan.mealPlanRecipe] =
                menuplan.mealRecipes[mealPlan.mealPlanRecipe];

              // Falls der Variantenname angepasst wurde, dies im Menüplan
              // entsprechen anpassen.
              updatedMealRecipes[mealPlan.mealPlanRecipe].recipe.variantName =
                recipe.variantProperties?.variantName;
            }
          });
          if (Object.keys(updatedMealRecipes).length > 0) {
            // Menüplan anpassen
            onMenuplanUpdate({
              ...menuplan,
              mealRecipes: {...menuplan.mealRecipes, ...updatedMealRecipes},
            });
          }
        }
      }
    } else {
      if (
        recipe.type == RecipeType.private &&
        recipeDrawerData.mealPlan.length > 0
      ) {
        // Fall beim privaten Rezept über den Menüplan der Namen
        // angepasst wurde, muss das hier übernommen werden.
        const updatedMealRecipes = {} as MealRecipes;
        recipeDrawerData.mealPlan.forEach((mealPlan) => {
          if (
            menuplan.mealRecipes[mealPlan.mealPlanRecipe].recipe.name !=
            recipe.name
          ) {
            updatedMealRecipes[mealPlan.mealPlanRecipe] =
              menuplan.mealRecipes[mealPlan.mealPlanRecipe];

            // Falls der Variantenname angepasst wurde, dies im Menüplan
            // entsprechen anpassen.
            updatedMealRecipes[mealPlan.mealPlanRecipe].recipe.name =
              recipe.name;
          }
        });
        if (Object.keys(updatedMealRecipes).length > 0) {
          // Menüplan anpassen
          onMenuplanUpdate({
            ...menuplan,
            mealRecipes: {...menuplan.mealRecipes, ...updatedMealRecipes},
          });
        }
      }
      // Privates Rezept
      // Anzeige umschiessen, falls gerade gespeichert wurde
      const editMode =
        !recipeDrawerData.recipe.uid && recipe.uid != ""
          ? false
          : recipeDrawerData.editMode;

      // angepasstes Rezept auch so anzeigen
      setRecipeDrawerData({
        ...recipeDrawerData,
        recipe: recipe,
        editMode: editMode,
      });
    }
    onRecipeUpdateSuper(recipe);
  }, []);
  const onNewRecipe = useCallback(() => {
    // Neues Rezept anlegen
    setRecipeDrawerData({
      ...RECIPE_DRAWER_DATA_INITIAL_VALUES,
      open: true,
      editMode: true,
    });
  }, []);
  const onRecipeSwitchEditMode = useCallback(() => {
    const {recipeDrawerData} = ctx.current;
    // Beim Wechsel in den Edit-Modus sicherstellen, dass leere Zeilen
    // für Zutaten, Zubereitungsschritte und Material vorhanden sind.
    const enteringEditMode = !recipeDrawerData.editMode;
    const recipe = enteringEditMode
      ? Recipe.createEmptyListEntries({recipe: recipeDrawerData.recipe})
      : recipeDrawerData.recipe;

    setRecipeDrawerData({
      ...recipeDrawerData,
      recipe: recipe,
      editMode: enteringEditMode,
    });
  }, []);
  const onRecipeDelete = useCallback(() => {
    const {menuplan, recipeDrawerData} = ctx.current;
    // Rezepte auch aus dem Menüplan entfernen
    const updatedMealRecipes = {...menuplan.mealRecipes};

    delete updatedMealRecipes[recipeDrawerData.mealPlan[0].mealPlanRecipe];

    onMenuplanUpdate({mealRecipes: updatedMealRecipes});

    setRecipeDrawerData(RECIPE_DRAWER_DATA_INITIAL_VALUES);
  }, []);

  /* ------------------------------------------
  // Material-Handling
  // ------------------------------------------ */
  const onAddMaterial = useCallback((menueUid: Menue["uid"]) => {
    const {units, materials, fetchMissingData} = ctx.current;
    setDialogGoodsData({
      open: true,
      menueUid: menueUid,
      goodsType: GoodsType.MATERIAL,
      product: null,
      material: null,
    });

    if (units.length == 0) {
      fetchMissingData({type: FetchMissingDataType.UNITS});
    }
    if (materials.length == 0) {
      fetchMissingData({type: FetchMissingDataType.MATERIALS});
    }
  }, []);
  const onAddProduct = useCallback((menueUid: Menue["uid"]) => {
    const {units, products, departments, fetchMissingData} = ctx.current;
    setDialogGoodsData({
      open: true,
      menueUid: menueUid,
      goodsType: GoodsType.PRODUCT,
      product: null,
      material: null,
    });
    if (units.length == 0) {
      fetchMissingData({type: FetchMissingDataType.UNITS});
    }
    if (products.length == 0) {
      fetchMissingData({type: FetchMissingDataType.PRODUCTS});
    }
    if (departments.length == 0) {
      fetchMissingData({type: FetchMissingDataType.DEPARTMENTS});
    }
  }, []);
  const onDialogGoodsCancel = useCallback(() => {
    const {GOODS_DATA_DIALOG_INITIAL_DATA} = ctx.current;
    setDialogGoodsData(GOODS_DATA_DIALOG_INITIAL_DATA);
  }, []);
  const onDialogGoodsOk = useCallback(
    ({
      planMode,
      quantity,
      unit,
      product,
      material,
    }: OnAddGoodToMenuProps) => {
      const {
        menuplan,
        dialogGoodsData,
        onMenuplanUpdateSuper,
        GOODS_DATA_DIALOG_INITIAL_DATA,
      } = ctx.current;
      const newMenues = {...menuplan.menues};

      let newMaterial: MenuplanMaterial | null = null;
      let newProduct: MenuplanProduct | null = null;

      if (dialogGoodsData.goodsType === GoodsType.MATERIAL && material) {
        dialogGoodsData.material
          ? (newMaterial = dialogGoodsData.material)
          : (newMaterial = createMaterial());

        newMaterial.quantity = quantity;
        newMaterial.unit = unit;
        newMaterial.materialName = material.name;
        newMaterial.materialUid = material.uid;
        newMaterial.planMode = planMode;
        newMaterial.plan = [];
      } else if (
        dialogGoodsData.goodsType === GoodsType.PRODUCT &&
        product
      ) {
        dialogGoodsData.product
          ? (newProduct = dialogGoodsData.product)
          : (newProduct = createProduct());

        newProduct.quantity = quantity;
        newProduct.unit = unit;
        newProduct.productName = product.name;
        newProduct.productUid = product.uid;
        newProduct.planMode = planMode;
      }

      if (planMode === GoodsPlanMode.TOTAL) {
        // Fixe Zuordnung der Menge
        if (
          dialogGoodsData.goodsType === GoodsType.MATERIAL &&
          newMaterial !== null
        ) {
          const newMaterials = {...menuplan.materials};
          newMaterial.planMode = GoodsPlanMode.TOTAL;
          newMaterial.totalQuantity = newMaterial.quantity;
          newMaterials[newMaterial.uid] = newMaterial;
          newMaterial.plan = [];
          !dialogGoodsData.material &&
            newMenues[dialogGoodsData.menueUid].materialOrder.push(
              newMaterial.uid,
            );

          onMenuplanUpdateSuper({
            ...menuplan,
            menues: newMenues,
            materials: newMaterials,
          });
        } else if (
          dialogGoodsData.goodsType === GoodsType.PRODUCT &&
          newProduct !== null
        ) {
          const newProducts = {...menuplan.products};

          newProduct.planMode = GoodsPlanMode.TOTAL;
          newProduct.totalQuantity = newProduct.quantity;
          newProducts[newProduct.uid] = newProduct;
          newProduct.plan = [];
          !dialogGoodsData.product &&
            newMenues[dialogGoodsData.menueUid].productOrder.push(
              newProduct.uid,
            );

          onMenuplanUpdateSuper({
            ...menuplan,
            menues: newMenues,
            products: newProducts,
          });
        }
      } else if (planMode === GoodsPlanMode.PER_PORTION) {
        let portionPlan: PortionPlan[] = [];

        if (dialogGoodsData.goodsType == GoodsType.PRODUCT) {
          dialogGoodsData.product?.plan
            ? (portionPlan = dialogGoodsData.product.plan)
            : (portionPlan = []);
        } else if (dialogGoodsData.goodsType == GoodsType.MATERIAL) {
          dialogGoodsData.material?.plan
            ? (portionPlan = dialogGoodsData.material.plan)
            : (portionPlan = []);
        }

        setDialogPlanPortionsData({
          open: true,
          menues: {[dialogGoodsData.menueUid]: true},
          mealRecipeUid: "",
          portionPlan: portionPlan,
          planedMaterial: newMaterial,
          planedProduct: newProduct,
          planedObject: PlanedObject.GOOD,
        });
      }
      setDialogGoodsData(GOODS_DATA_DIALOG_INITIAL_DATA);
    },
    [],
  );

  /* ------------------------------------------
  // Dialog Menü-Einträge ändern
  // ------------------------------------------ */
  const onEditMenue = useCallback((menueUid: Menue["uid"]) => {
    // Dialog öffnen mit Stift / Deletebutton
    setDialogEditMenue({open: true, menueUid: menueUid});
  }, []);
  const onCloseDialogEditMenue = useCallback(() => {
    setDialogEditMenue({open: false, menueUid: ""});
  }, []);
  const onEditMenueEditObject = useCallback(
    ({objectType, uid}: EditMenueObjectManipulation) => {
      switch (objectType) {
        case MenueEditTypes.NOTE:
          // Gibt es nicht....
          break;
        case MenueEditTypes.MEALRECIPE:
          // Portionen-Dialog hervorrufen
          onEditRecipeMealPlan(uid);
          break;
        case MenueEditTypes.PRODUCT:
          onEditProductPlan(uid);
          break;
        case MenueEditTypes.MATERIAL:
          onEditMaterialPlan(uid);

          break;
      }
    },
    [],
  );
  const onEditMenueDeleteObject = useCallback(
    ({objectType, uid}: EditMenueObjectManipulation) => {
      const {menuplan, dialogEditMenue} = ctx.current;
      const updatedNotes = {...menuplan.notes};
      const updatedMealRecipes = {...menuplan.mealRecipes};
      const updateProducts = {...menuplan.products};
      const updatedMaterials = {...menuplan.materials};
      const updatedMenues = {...menuplan.menues};
      let menue: Menue | undefined;
      switch (objectType) {
        case MenueEditTypes.NOTE:
          delete updatedNotes[uid];
          break;
        case MenueEditTypes.MEALRECIPE:
          menue = findMenueOfMealRecipe({
            mealRecipeUid: uid,
            menues: menuplan.menues,
          });
          if (menue) {
            delete updatedMealRecipes[uid];
            updatedMenues[menue?.uid].mealRecipeOrder = updatedMenues[
              menue?.uid
            ].mealRecipeOrder.filter((mealRecipe) => mealRecipe !== uid);
          }
          break;
        case MenueEditTypes.PRODUCT:
          menue = findMenueOfMealProduct({
            productUid: uid,
            menues: menuplan.menues,
          });
          if (menue) {
            delete updateProducts[uid];
            updatedMenues[menue?.uid].productOrder = updatedMenues[
              menue?.uid
            ].productOrder.filter((productUid) => productUid !== uid);
          }
          break;
        case MenueEditTypes.MATERIAL:
          menue = findMenueOfMealMaterial({
            materialUid: uid,
            menues: menuplan.menues,
          });
          if (menue) {
            delete updatedMaterials[uid];
            updatedMenues[menue?.uid].materialOrder = updatedMenues[
              menue?.uid
            ].materialOrder.filter((materialUid) => materialUid !== uid);
          }
          break;
      }
      onMenuplanUpdate({
        ...menuplan,
        notes: updatedNotes,
        menues: updatedMenues,
        mealRecipes: updatedMealRecipes,
        products: updateProducts,
        materials: updatedMaterials,
      });

      // Wenn alle Objekte in diesem Menü leer, Dialog gleich schliessen
      if (
        updatedMenues[dialogEditMenue.menueUid].materialOrder.length == 0 &&
        updatedMenues[dialogEditMenue.menueUid].mealRecipeOrder.length == 0 &&
        updatedMenues[dialogEditMenue.menueUid].productOrder.length == 0
      ) {
        setDialogEditMenue({open: false, menueUid: ""});
      }
    },
    [],
  );
  const onMaterialCreate = useCallback((material: Material) => {
    const {onMasterdataCreate} = ctx.current;
    onMasterdataCreate({
      type: MasterDataCreateType.MATERIAL,
      value: material,
    });
  }, []);
  const onProductCreate = useCallback((product: Product) => {
    const {onMasterdataCreate} = ctx.current;
    onMasterdataCreate({
      type: MasterDataCreateType.PRODUCT,
      value: product,
    });
  }, []);

  /* ------------------------------------------
  // Dialog Menü-Auswahl Handling
  // ------------------------------------------ */
  const onDialogSelectMenueClose = useCallback(() => {
    const {dialogSelectMenueData} = ctx.current;
    setDialogSelectMenueData({
      ...dialogSelectMenueData,
      open: false,
      caller: "",
      singleSelection: false,
    });
  }, []);
  const onDialogSelectMenueContinue = useCallback(
    (selectedMenues: DialogSelectMenuesForRecipeDialogValues) => {
      const {menuplan, dialogSelectMenueData, onMenuplanUpdateSuper} =
        ctx.current;
      if (dialogSelectMenueData.caller !== "onMoveDragAndDropElement") {
        // Portionen Dialog anzeigen.
        setDialogPlanPortionsData({
          open: true,
          menues: selectedMenues,
          mealRecipeUid: "",
          portionPlan: [],
          planedMaterial: null,
          planedProduct: null,
          planedObject: PlanedObject.RECIPE,
        });
      } else {
        // UID des neuen Ziel-Menüs
        const destinationMenueUid = Object.keys(selectedMenues)[0];

        // Element verschieben aus der Drag & Drop Liste
        if (
          dialogSelectMenueData.dragAndDropHandler.dragAndDropListType !== "" &&
          destinationMenueUid !==
            dialogSelectMenueData.dragAndDropHandler.menuUid
        ) {
          const orderListName = getOrderListNameFromDragAndDropTypes(
            dialogSelectMenueData.dragAndDropHandler.dragAndDropListType,
          );

          if (
            orderListName !== "mealRecipeOrder" &&
            orderListName !== "materialOrder" &&
            orderListName !== "productOrder"
          ) {
            return;
          }

          if (orderListName) {
            // Eintrag aus Home entfernen
            const homeMenue =
              menuplan.menues[
                dialogSelectMenueData.dragAndDropHandler.menuUid
              ];
            const homeReorderedList = homeMenue[orderListName].filter(
              (listElementUid) =>
                listElementUid !==
                dialogSelectMenueData.dragAndDropHandler.listElementUid,
            );
            // Eintrag in Destination anhängen
            const destinationMenue = menuplan.menues[destinationMenueUid];
            const destinationReorderedList = destinationMenue[
              orderListName
            ].concat(dialogSelectMenueData.dragAndDropHandler.listElementUid);

            onMenuplanUpdateSuper({
              ...menuplan,
              menues: {
                ...menuplan.menues,
                [dialogSelectMenueData.dragAndDropHandler.menuUid]: {
                  ...homeMenue,
                  [orderListName]: homeReorderedList,
                },
                [destinationMenueUid]: {
                  ...destinationMenue,
                  [orderListName]: destinationReorderedList,
                },
              },
            });
          }
        }
      }

      setDialogSelectMenueData({
        ...dialogSelectMenueData,
        open: false,
        menues: {} as DialogSelectMenuesForRecipeDialogValues,
        caller: "",
        singleSelection: false,
        dragAndDropHandler: {
          listElementUid: "",
          menuUid: "",
          dragAndDropListType: "",
        },
      });
    },
    [],
  );

  /* ------------------------------------------
  // Dialog Mahlzeit-Auswahl Handling
  // ------------------------------------------ */
  const onDialogSelectMealClose = useCallback(() => {
    setDialogSelectMealData({
      open: false,
      dragAndDropHandler: {menuUid: "", mealUid: ""},
    });
  }, []);
  const onDialogSelectMealConfirm = useCallback((mealUid: Meal["uid"]) => {
    const {menuplan, dialogSelectMealData, onMenuplanUpdateSuper} = ctx.current;
    if (mealUid !== dialogSelectMealData.dragAndDropHandler.mealUid) {
      // Element aus Home entfernen
      const reorderedHomeList = menuplan.meals[
        dialogSelectMealData.dragAndDropHandler.mealUid
      ].menuOrder.filter(
        (menuUid) =>
          menuUid != dialogSelectMealData.dragAndDropHandler.menuUid,
      );

      const reorderedDestinationList = menuplan.meals[
        mealUid
      ].menuOrder.concat(
        dialogSelectMealData.dragAndDropHandler.menuUid,
      );

      onMenuplanUpdateSuper({
        ...menuplan,
        meals: {
          ...menuplan.meals,
          [dialogSelectMealData.dragAndDropHandler.mealUid]: {
            ...menuplan.meals[
              dialogSelectMealData.dragAndDropHandler.mealUid
            ],
            menuOrder: reorderedHomeList,
          },
          [mealUid]: {
            ...menuplan.meals[mealUid],
            menuOrder: reorderedDestinationList,
          },
        },
      });
    }
    setDialogSelectMealData({
      open: false,
      dragAndDropHandler: {menuUid: "", mealUid: ""},
    });
  }, []);

  /* ------------------------------------------
  // Dialog Zuordnung der Gruppen-Konfig Handling
  // ------------------------------------------ */
  const onDialogPlanPortionsBack = useCallback(() => {
    const {dialogPlanPortionsData, dialogSelectMenueData} = ctx.current;
    setDialogPlanPortionsData({
      ...dialogPlanPortionsData,
      open: false,
      menues: null,
    });
    setDialogSelectMenueData({
      ...dialogSelectMenueData,
      open: true,
      menues:
        dialogPlanPortionsData.menues as DialogSelectMenuesForRecipeDialogValues,
      caller: "onDialogPlanPortionsBack",
      singleSelection: false,
    });
  }, []);
  const onDialogPlanPortionsClose = useCallback(() => {
    setDialogPlanPortionsData({
      open: false,
      menues: {} as DialogSelectMenuesForRecipeDialogValues,
      mealRecipeUid: "",
      portionPlan: [],
      planedMaterial: null,
      planedProduct: null,
      planedObject: PlanedObject.RECIPE,
    });
  }, []);
  const onDialogPlanPortionsAdd = useCallback(
    (plan: {[key: Menue["uid"]]: DialogPlanPortionsMealPlanning}) => {
      const {menuplan, dialogPlanPortionsData, dialogSelectMenueData} =
        ctx.current;
      const updatedMenues = {...menuplan.menues};
      const updatedMealRecipes = {...menuplan.mealRecipes};
      const updatedMaterials = {...menuplan.materials};
      const updatedProducts = {...menuplan.products};

      if (dialogPlanPortionsData.planedObject == PlanedObject.RECIPE) {
        // Rezept
        if (
          dialogPlanPortionsData.portionPlan.length == 0 &&
          dialogPlanPortionsData.mealRecipeUid == ""
        ) {
          // Neuer Eintrag
          Object.keys(plan).forEach((menuUid) => {
            const mealRecipe = createMealRecipe({
              recipe: dialogSelectMenueData.selectedRecipe,
              plan: plan[menuUid],
            });
            updatedMealRecipes[mealRecipe.uid] = mealRecipe;
            updatedMenues[menuUid].mealRecipeOrder.push(mealRecipe.uid);
          });
          // Suche im Rezept-Drawer zurücksetzen
          setRecipeSearchResetKey((prev) => prev + 1);
        } else {
          // Eintrag wird geändert — Multi-Diät-Struktur flach auflösen
          Object.values(plan).forEach((planOfMealRecipe) => {
            const portionPlans: PortionPlan[] = [];
            Object.keys(planOfMealRecipe).forEach((dietUid) => {
              Object.keys(planOfMealRecipe[dietUid]).forEach(
                (intoleranceUid) => {
                  portionPlans.push({
                    diet: planOfMealRecipe[dietUid][intoleranceUid].diet,
                    intolerance: intoleranceUid,
                    factor: parseFloat(
                      planOfMealRecipe[dietUid][intoleranceUid].factor,
                    ),
                    totalPortions:
                      planOfMealRecipe[dietUid][intoleranceUid].total,
                  });
                },
              );
            });
            updatedMealRecipes[dialogPlanPortionsData.mealRecipeUid].plan =
              portionPlans;
            updatedMealRecipes[
              dialogPlanPortionsData.mealRecipeUid
            ].totalPortions = portionPlans.reduce(
              (runningSum, entry) => runningSum + entry.totalPortions,
              0,
            );
          });
        }
      } else if (
        dialogPlanPortionsData.planedObject == PlanedObject.GOOD &&
        dialogPlanPortionsData.planedProduct !== null
      ) {
        // Plan umbiegen
        Object.keys(plan).forEach((menueUid) => {
          const newProduct = addPlanToGood<MenuplanProduct>({
            // plan muss rausgelöscht werden, sonst wird dieser verdoppelt
            good: {...dialogPlanPortionsData.planedProduct!, plan: []},
            plan: plan[menueUid],
          });
          // Neue Totalmenge berechnen
          newProduct.totalQuantity =
            newProduct.quantity * newProduct.totalQuantity;
          updatedProducts[newProduct.uid] = newProduct;
          if (!updatedMenues[menueUid].productOrder.includes(newProduct.uid)) {
            // Nur hinzufügen, wenn nicht bereits drin. Sonst reicht ein Update
            updatedMenues[menueUid].productOrder.push(newProduct.uid);
          }
        });
      } else if (
        dialogPlanPortionsData.planedObject == PlanedObject.GOOD &&
        dialogPlanPortionsData.planedMaterial !== null
      ) {
        // Plan umbiegen
        Object.keys(plan).forEach((menueUid) => {
          const newMaterial = addPlanToGood<MenuplanMaterial>({
            good: {...dialogPlanPortionsData.planedMaterial!, plan: []},
            plan: plan[menueUid],
          });
          // Neue Totalmenge berechnen
          newMaterial.totalQuantity =
            newMaterial.quantity * newMaterial.totalQuantity;
          updatedMaterials[newMaterial.uid] = newMaterial;
          if (
            !updatedMenues[menueUid].materialOrder.includes(newMaterial.uid)
          ) {
            updatedMenues[menueUid].materialOrder.push(newMaterial.uid);
          }
        });
      }

      onMenuplanUpdate({
        menues: updatedMenues,
        mealRecipes: updatedMealRecipes,
        products: updatedProducts,
        materials: updatedMaterials,
      });
      setDialogPlanPortionsData({
        open: false,
        menues: null,
        mealRecipeUid: "",
        portionPlan: [],
        planedMaterial: null,
        planedProduct: null,
        planedObject: PlanedObject.RECIPE,
      });
      setDialogSelectMenueData({
        open: false,
        menues: {} as DialogSelectMenuesForRecipeDialogValues,
        selectedRecipe: {} as RecipeShort,
        caller: "onDialogPlanPortionsAdd",
        singleSelection: false,
        dragAndDropHandler: {
          listElementUid: "",
          menuUid: "",
          dragAndDropListType: "",
        },
      });

      setRecipeDrawerData(RECIPE_DRAWER_DATA_INITIAL_VALUES);
      setRecipeSearchDrawerData({
        open: false,
        isLoadingData: false,
        menue: null,
      });
    },
    [],
  );

  /* ------------------------------------------
  // MenuCard-Handling
  // ------------------------------------------ */
  const onMealRecipeOpen = useCallback((mealRecipeUid: MealRecipe["uid"]) => {
    const {menuplan, recipes, recipeDrawerData, fetchMissingData} = ctx.current;

    // Gelöschtes Rezept — Drawer nicht öffnen
    if (!menuplan.mealRecipes[mealRecipeUid]?.recipe.recipeUid) {
      return;
    }

    let loadingData = false;
    const mealPlan: Array<PlanedMealsRecipe> = [];

    let recipe = new Recipe();
    recipe.uid = menuplan.mealRecipes[mealRecipeUid].recipe.recipeUid;
    recipe.name = menuplan.mealRecipes[mealRecipeUid].recipe.name;

    Object.values(menuplan.mealRecipes).forEach((mealRecipe) => {
      let meal: Meal | undefined;
      let menue: Menue | undefined;
      if (mealRecipe.recipe.recipeUid == recipe.uid) {
        // Menü suchen, in dem das Rezept eingefügt wurde
        menue = Object.values(menuplan.menues).find((menue) =>
          menue.mealRecipeOrder.includes(mealRecipe.uid),
        );
        if (menue != undefined) {
          // Die Mahlzeit suchen, in der das Menü ist
          meal = Object.values(menuplan.meals).find((meal) =>
            meal.menuOrder.includes(menue!.uid!),
          );
        }
        if (meal != undefined && menue != undefined) {
          mealPlan.push({
            mealPlanRecipe: mealRecipe.uid,
            menue: {...menue},
            meal: {
              ...meal,
              mealType: menuplan.mealTypes.entries[meal.mealType].uid,
              mealTypeName: menuplan.mealTypes.entries[meal.mealType].name,
            },
            mealPlan: mealRecipe.plan,
          });
        }
      }
    });

    // Sortiere das Array nach dem Datum (aufsteigend) und dann nach der Zahl (absteigend)
    mealPlan.sort((a, b) => {
      if (a.meal.date < b.meal.date) {
        return -1;
      } else if (a.meal.date > b.meal.date) {
        return 1;
      } else {
        // Anhand des Index der Mahlzeit bestimmen
        return (
          menuplan.mealTypes.order.indexOf(a.meal.mealType) -
          menuplan.mealTypes.order.indexOf(b.meal.mealType)
        );
      }
    });

    if (Object.prototype.hasOwnProperty.call(recipes, recipe.uid)) {
      recipe = recipes[recipe.uid] as Recipe;
    } else {
      // Rezept noch nicht vorhanden --> holen
      fetchMissingData({
        type: FetchMissingDataType.RECIPE,
        recipeShort: {
          uid: recipe.uid,
          name: recipe.name,
          type: menuplan.mealRecipes[mealRecipeUid].recipe.type,
          created: {
            fromUid: menuplan.mealRecipes[mealRecipeUid].recipe.createdFromUid,
          },
        } as RecipeShort,
      });
      loadingData = true;
    }
    // Drawer mit dem Rezept öffnen
    setRecipeDrawerData({
      ...recipeDrawerData,
      open: true,
      isLoadingData: loadingData,
      recipe: recipe,
      mealPlan: mealPlan,
      scaledPortions: menuplan.mealRecipes[mealRecipeUid].plan.reduce(
        (runningSum, portion) => runningSum + portion.totalPortions,
        0,
      ),
    });
  }, []);

  /* ------------------------------------------
  // Handling Einplanung
  // ------------------------------------------ */
  const onEditRecipeMealPlan = useCallback(
    (mealRecipeUid: MealRecipe["uid"]) => {
      const {menuplan} = ctx.current;
      const menue = findMenueOfMealRecipe({
        mealRecipeUid: mealRecipeUid,
        menues: menuplan.menues,
      });
      if (!menue) {
        return;
      }
      // Dialog für Portionen aufrufen
      setDialogPlanPortionsData({
        open: true,
        menues: {[menue.uid]: true},
        mealRecipeUid: mealRecipeUid,
        portionPlan: menuplan.mealRecipes[mealRecipeUid].plan,
        planedMaterial: null,
        planedProduct: null,
        planedObject: PlanedObject.RECIPE,
      });
    },
    [],
  );
  const onEditProductPlan = useCallback(
    (productUid: MenuplanProduct["uid"]) => {
      const {menuplan, units, products, departments, fetchMissingData} =
        ctx.current;
      const menue = findMenueOfMealProduct({
        productUid: productUid,
        menues: menuplan.menues,
      });
      if (!menue) {
        return;
      }
      if (units.length == 0) {
        fetchMissingData({type: FetchMissingDataType.UNITS});
      }
      if (products.length == 0) {
        fetchMissingData({type: FetchMissingDataType.PRODUCTS});
      }
      if (departments.length == 0) {
        fetchMissingData({type: FetchMissingDataType.DEPARTMENTS});
      }
      // Dialog für fixe Menge öffnen
      setDialogGoodsData({
        open: true,
        menueUid: menue.uid,
        goodsType: GoodsType.PRODUCT,
        product: menuplan.products[productUid],
        material: null,
      });
    },
    [],
  );
  const onEditMaterialPlan = useCallback(
    (materialUid: MenuplanProduct["uid"]) => {
      const {menuplan, units, materials, fetchMissingData} = ctx.current;
      const menue = findMenueOfMealMaterial({
        materialUid: materialUid,
        menues: menuplan.menues,
      });
      if (!menue) {
        return;
      }
      if (units.length == 0) {
        fetchMissingData({type: FetchMissingDataType.UNITS});
      }
      if (materials.length == 0) {
        fetchMissingData({type: FetchMissingDataType.MATERIALS});
      }
      // Dialog für fixe Menge öffnen
      setDialogGoodsData({
        open: true,
        menueUid: menue.uid,
        goodsType: GoodsType.MATERIAL,
        product: null,
        material: menuplan.materials[materialUid],
      });
    },
    [],
  );

  return {
    onSwitchShowDetails,
    onSwitchEnableDragAndDrop,
    onMealTypeUpdate,
    onMenuplanUpdate,
    onNoteUpdate,
    onPrint,
    onPrintConfirm,
    onPrintCancel,
    onAddRecipe,
    onRecipeSearchDrawerClose,
    onRecipeDrawerClose,
    onRecipeCardClick,
    onRecipeSelection,
    onRecipeUpdate,
    onNewRecipe,
    onRecipeSwitchEditMode,
    onRecipeDelete,
    onAddMaterial,
    onAddProduct,
    onDialogGoodsCancel,
    onDialogGoodsOk,
    onEditMenue,
    onCloseDialogEditMenue,
    onEditMenueEditObject,
    onEditMenueDeleteObject,
    onMaterialCreate,
    onProductCreate,
    onDialogSelectMenueClose,
    onDialogSelectMenueContinue,
    onDialogSelectMealClose,
    onDialogSelectMealConfirm,
    onDialogPlanPortionsBack,
    onDialogPlanPortionsClose,
    onDialogPlanPortionsAdd,
    onMealRecipeOpen,
    onEditRecipeMealPlan,
    onEditProductPlan,
    onEditMaterialPlan,
  };
}
