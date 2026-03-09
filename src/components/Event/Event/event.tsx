import React, {SyntheticEvent} from "react";

import {useNavigate, useLocation} from "react-router";
import _ from "lodash";

import {
  Container,
  Backdrop,
  CircularProgress,
  Tabs,
  Tab,
  useTheme,
  Stack,
  Button,
  Typography,
  Box,
  SnackbarCloseReason,
} from "@mui/material";

import useCustomStyles from "../../../constants/styles";

import Event, {EventRefDocuments} from "./event.class";
// Bridge-Importe eliminiert — Konvertierung erfolgt direkt in den Repositories
import {resizeImage} from "../../Shared/imageResize";
import PageTitle from "../../Shared/pageTitle";

import {
  MENUPLAN as TEXT_MENUPLAN,
  QUANTITY_CALCULATION as TEXT_QUANTITY_CALCULATION,
  PLANED_RECIPES as TEXT_PLANED_RECIPES,
  SHOPPING_LIST as TEXT_SHOPPING_LIST,
  MATERIAL_LIST as TEXT_MATERIAL_LIST,
  EVENT_INFO_SHORT as TEXT_EVENT_INFO_SHORT,
  MATERIAL_CREATED as TEXT_MATERIAL_CREATED,
  PRODUCT_CREATED as TEXT_PRODUCT_CREATED,
  DISCARD_CHANGES as TEXT_DISCARD_CHANGES,
  SAVE as TEXT_SAVE,
  DELETION_AFFECTS_PLANED_DAYS as TEXT_DELETION_AFFECTS_PLANED_DAYS,
  ATTENTION_ABOUT_TO_DELETE_PLANED_DAYS as TEXT_ATTENTION_ABOUT_TO_DELETE_PLANED_DAYS,
  PROCEED as TEXT_PROCEED,
  EVENT_SAVE_SUCCESS as TEXT_EVENT_SAVE_SUCCESS,
  IMAGE_IS_BEEING_UPLOADED as TEXT_IMAGE_IS_BEEING_UPLOADED,
  EVENT_IS_BEEING_SAVED as TEXT_EVENT_IS_BEEING_SAVED,
  DELETE_EVENT as TEXT_DELETE_EVENT,
  ALERT_TITLE_UUPS as TEXT_ALERT_TITLE_UUPS,
  DIALOG_TITLE_DELETION_CONFIRMATION as TEXT_DIALOG_TITLE_DELETION_CONFIRMATION,
  DIALOG_SUBTITLE_DELETION_CONFIRMATION as TEXT_DIALOG_SUBTITLE_DELETION_CONFIRMATION,
  DIALOG_TEXT_DELETION_CONFIRMATION as TEXT_DIALOG_TEXT_DELETION_CONFIRMATION,
  CANCEL as TEXT_CANCEL,
  DELETE as TEXT_DELETE,
  DB_DOCUMENT_DELETED as TEXT_DB_DOCUMENT_DELETED,
  CONSISTENCY_CHECK as TEXT_CONSISTENCY_CHECK,
  MENUPLAN_CONSISTENCY_CHECK_FIXES_APPLIED as TEXT_MENUPLAN_CONSISTENCY_CHECK_FIXES_APPLIED,
  MENUPLAN_CONSISTENCY_CHECK_NO_ISSUES as TEXT_MENUPLAN_CONSISTENCY_CHECK_NO_ISSUES,
} from "../../../constants/text";

import {HOME as ROUTE_HOME} from "../../../constants/routes";

import Recipe, {Recipes} from "../../Recipe/recipe.class";
import Unit from "../../Unit/unit.class";

import AuthUser from "../../Firebase/Authentication/authUser.class";
import EventGroupConfiguration from "../GroupConfiguration/groupConfiguration.class";
import MenuplanPage from "../Menuplan/menuplan";
import EventGroupConfigurationPage from "../GroupConfiguration/groupConfiguration";
import EventUsedRecipesPage from "../UsedRecipes/usedRecipes";
import Menuplan from "../Menuplan/menuplan.class";
import UsedRecipes from "../UsedRecipes/usedRecipes.class";
import Utils from "../../Shared/utils.class";
import RecipeShort from "../../Recipe/recipeShort.class";
import {RecipeType} from "../../Recipe/recipe.class";
import {RecipeShortDomain} from "../../Database/Repository/RecipeRepository";
import Material from "../../Material/material.class";
import Product from "../../Product/product.class";
import CustomSnackbar, {Snackbar} from "../../Shared/customSnackbar";
import Department from "../../Department/department.class";
import UnitConversion, {
  UnitConversionBasic,
  UnitConversionProducts,
} from "../../Unit/unitConversion.class";
import EventShoppingListPage from "../ShoppingList/shoppingList";
import ShoppingListCollection from "../ShoppingList/shoppingListCollection.class";
import ShoppingList from "../ShoppingList/shoppingList.class";
import EventMaterialListPage from "../MaterialList/materialList";
import MaterialList from "../MaterialList/materialList.class";
import EventInfoPage from "./eventInfo";
import {FormValidationFieldError} from "../../Shared/fieldValidation.error.class";
import {
  DialogType,
  SingleTextInputResult,
  useCustomDialog,
} from "../../Shared/customDialogContext";
import Action from "../../../constants/actions";
import {ValueObject} from "../../Firebase/Db/firebase.db.super.class";
import {useFirebase} from "../../Firebase/firebaseContext";
import {useDatabase} from "../../Database/DatabaseContext";
import {useAuthUser} from "../../Session/authUserContext";
import AlertMessage from "../../Shared/AlertMessage";
import Stats, {StatsField} from "../../Shared/stats.class";
import {logEvent} from "firebase/analytics";
import FirebaseAnalyticEvent from "../../../constants/firebaseEvent";
import User from "../../User/user.class";
import {EventDomain} from "../../Database/Repository/EventRepository";
import {HighlightedMenueContext} from "../Menuplan/highlightContext";

/* ===================================================================
// ============================== Global =============================
// =================================================================== */
enum EventTabs {
  menuplan,
  quantityCalculation,
  usedRecipes,
  shoppingList,
  materialList,
  eventInfo,
}
interface DeriveEventUid {
  event: Event | undefined;
  pathname: string;
}
const deriveEventUid = ({event, pathname}: DeriveEventUid) => {
  if (event?.uid) {
    return event.uid;
  } else {
    return pathname.split("/").slice(-1).toString();
  }
};
/**
 * Ermittelt die UIDs von Menüs, die sich zwischen zwei Menuplan-Zuständen
 * geändert haben. Vergleicht Name, Rezept-/Produkt-/Material-Reihenfolge
 * und erkennt neu hinzugekommene Menüs.
 *
 * @param oldMenuplan - Vorheriger Menuplan-Zustand
 * @param newMenuplan - Neuer Menuplan-Zustand (z.B. aus Realtime-Reload)
 * @returns Set mit den UIDs der geänderten Menüs
 */
function getChangedMenueUids(
  oldMenuplan: Menuplan,
  newMenuplan: Menuplan,
): Set<string> {
  const changed = new Set<string>();
  const allUids = new Set([
    ...Object.keys(oldMenuplan.menues),
    ...Object.keys(newMenuplan.menues),
  ]);

  for (const uid of allUids) {
    const oldM = oldMenuplan.menues[uid];
    const newM = newMenuplan.menues[uid];

    // Neues Menü hinzugefügt
    if (!oldM && newM) {
      changed.add(uid);
      continue;
    }
    // Menü entfernt — kein Highlight nötig (Element existiert nicht mehr)
    if (!newM) continue;

    // Inhalt vergleichen: Name und Reihenfolge der Kinder
    if (
      oldM.name !== newM.name ||
      oldM.mealRecipeOrder.join(",") !== newM.mealRecipeOrder.join(",") ||
      oldM.productOrder.join(",") !== newM.productOrder.join(",") ||
      oldM.materialOrder.join(",") !== newM.materialOrder.join(",")
    ) {
      changed.add(uid);
    }
  }
  return changed;
}

export interface OnMenuplanUpdate {
  field: string;
  value: ValueObject;
}
export interface FetchMissingDataProps {
  type: FetchMissingDataType;
  recipeShort?: RecipeShort;
  objectUid?: string;
}
export interface OnMasterdataCreateProps {
  type: MasterDataCreateType;
  value: Material | Product;
}
export enum FetchMissingDataType {
  RECIPE,
  RECIPES,
  UNITS,
  PRODUCTS,
  MATERIALS,
  DEPARTMENTS,
  UNIT_CONVERSION,
  SHOPPING_LIST,
}
export enum MasterDataCreateType {
  MATERIAL = "MATERIAL",
  PRODUCT = "PRODUCT",
}

function tabProps(index: number) {
  return {
    id: `scrollable-auto-tab-${index}`,
    "aria-controls": `scrollable-auto-tabpanel-${index}`,
  };
}
/* ===================================================================
// ============================ Dispatcher ===========================
// =================================================================== */
enum ReducerActions {
  EVENT_FETCH_INIT,
  EVENT_FETCH_SUCCESS,
  EVENT_SAVE_INIT,
  EVENT_SAVE_SUCCESS,
  EVENT_DELETE_START,
  GROUP_CONFIG_FETCH_INIT,
  GROUP_CONFIG_FETCH_SUCCESS,
  MENUPLAN_FETCH_INIT,
  MENUPLAN_FETCH_SUCCESS,
  USED_RECIPES_FETCH_INIT,
  USED_RECIPES_FETCH_SUCCESS,
  SHOPPINGLIST_COLLECTION_FETCH_INIT,
  SHOPPINGLIST_COLLECTION_FETCH_SUCCESS,
  SHOPPINGLIST_FETCH_INIT,
  SHOPPINGLIST_FETCH_SUCCESS_DATA,
  SHOPPINGLIST_FETCH_SUCCESS_LISTENER,
  MATERIALLIST_FETCH_INIT,
  MATERIALLIST_FETCH_SUCCESS,
  RECIPE_FETCH_INIT,
  RECIPE_FETCH_SUCCESS,
  RECIPES_FETCH_SUCCESS,
  RECIPE_LIST_FETCH_INIT,
  RECIPE_LIST_FETCH_SUCCESS,
  UNTIS_FETCH_INIT,
  UNITS_FETCH_SUCCESS,
  PRODUCTS_FETCH_INIT,
  PRODUCTS_FETCH_SUCCESS,
  MATERIALS_FETCH_INIT,
  MATERIALS_FETCH_SUCCESS,
  DEPARTMENTS_FETCH_INIT,
  DEPARTMENTS_FETCH_SUCCESS,
  UNIT_CONVERSION_FETCH_INIT,
  UNIT_CONVERSION_FETCH_SUCCES,
  ON_MASTERDATA_CREATE,
  ON_RECIPE_UPDATE,
  SNACKBAR_CLOSE,
  SNACKBAR_SHOW,
  GENERIC_ERROR,
}
type DispatchAction =
  | {
      type:
        | ReducerActions.EVENT_FETCH_INIT
        | ReducerActions.EVENT_SAVE_INIT
        | ReducerActions.EVENT_SAVE_SUCCESS
        | ReducerActions.EVENT_DELETE_START
        | ReducerActions.GROUP_CONFIG_FETCH_INIT
        | ReducerActions.MENUPLAN_FETCH_INIT
        | ReducerActions.USED_RECIPES_FETCH_INIT
        | ReducerActions.SHOPPINGLIST_COLLECTION_FETCH_INIT
        | ReducerActions.SHOPPINGLIST_FETCH_INIT
        | ReducerActions.MATERIALLIST_FETCH_INIT
        | ReducerActions.RECIPE_LIST_FETCH_INIT
        | ReducerActions.UNTIS_FETCH_INIT
        | ReducerActions.PRODUCTS_FETCH_INIT
        | ReducerActions.MATERIALS_FETCH_INIT
        | ReducerActions.DEPARTMENTS_FETCH_INIT
        | ReducerActions.UNIT_CONVERSION_FETCH_INIT
        | ReducerActions.SNACKBAR_CLOSE;
      payload: Record<string, never>;
    }
  | {type: ReducerActions.EVENT_FETCH_SUCCESS; payload: Event}
  | {
      type: ReducerActions.GROUP_CONFIG_FETCH_SUCCESS;
      payload: EventGroupConfiguration;
    }
  | {type: ReducerActions.MENUPLAN_FETCH_SUCCESS; payload: Menuplan}
  | {type: ReducerActions.USED_RECIPES_FETCH_SUCCESS; payload: UsedRecipes}
  | {
      type: ReducerActions.SHOPPINGLIST_COLLECTION_FETCH_SUCCESS;
      payload: ShoppingListCollection;
    }
  | {
      type: ReducerActions.SHOPPINGLIST_FETCH_SUCCESS_DATA;
      payload: ShoppingList;
    }
  | {
      type: ReducerActions.SHOPPINGLIST_FETCH_SUCCESS_LISTENER;
      payload: () => void;
    }
  | {type: ReducerActions.MATERIALLIST_FETCH_SUCCESS; payload: MaterialList}
  | {type: ReducerActions.RECIPE_FETCH_INIT; payload: RecipeShort}
  | {type: ReducerActions.RECIPE_FETCH_SUCCESS; payload: Recipe}
  | {type: ReducerActions.RECIPES_FETCH_SUCCESS; payload: Recipes}
  | {type: ReducerActions.ON_RECIPE_UPDATE; payload: Recipe}
  | {type: ReducerActions.RECIPE_LIST_FETCH_SUCCESS; payload: RecipeShort[]}
  | {type: ReducerActions.UNITS_FETCH_SUCCESS; payload: Unit[]}
  | {type: ReducerActions.PRODUCTS_FETCH_SUCCESS; payload: Product[]}
  | {type: ReducerActions.MATERIALS_FETCH_SUCCESS; payload: Material[]}
  | {type: ReducerActions.DEPARTMENTS_FETCH_SUCCESS; payload: Department[]}
  | {
      type: ReducerActions.UNIT_CONVERSION_FETCH_SUCCES;
      payload: {
        unitConversionBasic: UnitConversionBasic;
        unitConversionProducts: UnitConversionProducts;
      };
    }
  | {
      type: ReducerActions.ON_MASTERDATA_CREATE;
      payload: {type: MasterDataCreateType; value: Material | Product};
    }
  | {
      type: ReducerActions.SNACKBAR_SHOW;
      payload: {severity: Snackbar["severity"]; message: string};
    }
  | {type: ReducerActions.GENERIC_ERROR; payload: Error};

type State = {
  event: Event;
  menuplan: Menuplan;
  groupConfig: EventGroupConfiguration;
  usedRecipes: UsedRecipes;
  shoppingListCollection: ShoppingListCollection;
  shoppingList: {value: ShoppingList | null; unsubscribe: (() => void) | null};
  materialList: MaterialList;
  recipes: Recipes;
  // Rezept-Übersicht
  recipeList: RecipeShort[];
  units: Unit[];
  products: Product[];
  materials: Material[];
  departments: Department[];
  unitConversionBasic: UnitConversionBasic | null;
  unitConversionProducts: UnitConversionProducts | null;
  snackbar: Snackbar;
  isLoading: boolean;
  isSaving: boolean;
  loadingComponents: {
    event: boolean;
    groupConfig: boolean;
    menuplan: boolean;
    usedRecipes: boolean;
    shoppingListCollection: boolean;
    shoppingLists: boolean;
    materialList: boolean;
    recipe: boolean;
    recipes: boolean;
    units: boolean;
    products: boolean;
    materials: boolean;
    departments: boolean;
    unitCoversion: boolean;
  };
  error: Error | null;
};

const eventReducer = (state: State, action: DispatchAction): State => {
  let newRecipes = {} as Recipes;
  switch (action.type) {
    case ReducerActions.EVENT_FETCH_INIT: {
      return {
        ...state,
        isLoading: true,
        loadingComponents: {...state.loadingComponents, event: true},
      };
    }
    case ReducerActions.EVENT_SAVE_INIT:
      return {...state, isSaving: true};
    case ReducerActions.EVENT_SAVE_SUCCESS:
      return {...state, isSaving: false};
    case ReducerActions.EVENT_DELETE_START:
      return {...state, isLoading: true};
    case ReducerActions.GROUP_CONFIG_FETCH_INIT:
      return {
        ...state,
        isLoading: true,
        loadingComponents: {...state.loadingComponents, groupConfig: true},
      };
    case ReducerActions.MENUPLAN_FETCH_INIT:
      return {
        ...state,
        isLoading: true,
        loadingComponents: {...state.loadingComponents, menuplan: true},
      };
    case ReducerActions.EVENT_FETCH_SUCCESS:
      return {
        ...state,
        event: action.payload as Event,
        isLoading: Utils.deriveIsLoading({
          ...state.loadingComponents,
          event: false,
        }),
        loadingComponents: {...state.loadingComponents, event: false},
      };
    case ReducerActions.USED_RECIPES_FETCH_INIT:
      return {
        ...state,
        isLoading: true,
        loadingComponents: {...state.loadingComponents, usedRecipes: true},
      };
    case ReducerActions.USED_RECIPES_FETCH_SUCCESS:
      return {
        ...state,
        usedRecipes: action.payload as UsedRecipes,
        isLoading: Utils.deriveIsLoading({
          ...state.loadingComponents,
          usedRecipes: false,
        }),
        loadingComponents: {...state.loadingComponents, usedRecipes: false},
      };
    case ReducerActions.GROUP_CONFIG_FETCH_SUCCESS:
      return {
        ...state,
        groupConfig: action.payload as EventGroupConfiguration,
        isLoading: Utils.deriveIsLoading({
          ...state.loadingComponents,
          groupConfig: false,
        }),
        loadingComponents: {...state.loadingComponents, groupConfig: false},
      };
    case ReducerActions.MENUPLAN_FETCH_SUCCESS:
      return {
        ...state,
        menuplan: action.payload as Menuplan,
        isLoading: Utils.deriveIsLoading({
          ...state.loadingComponents,
          menuplan: false,
        }),
        loadingComponents: {...state.loadingComponents, menuplan: false},
      };
    case ReducerActions.SHOPPINGLIST_COLLECTION_FETCH_INIT:
      return {
        ...state,
        isLoading: true,
        loadingComponents: {
          ...state.loadingComponents,
          shoppingListCollection: true,
        },
      };
    case ReducerActions.SHOPPINGLIST_COLLECTION_FETCH_SUCCESS:
      return {
        ...state,
        shoppingListCollection: action.payload as ShoppingListCollection,
        isLoading: Utils.deriveIsLoading({
          ...state.loadingComponents,
          shoppingListCollection: false,
        }),
        loadingComponents: {
          ...state.loadingComponents,
          shoppingListCollection: false,
        },
      };
    case ReducerActions.SHOPPINGLIST_FETCH_INIT:
      return {
        ...state,
        isLoading: true,
        loadingComponents: {...state.loadingComponents, shoppingLists: true},
      };
    case ReducerActions.SHOPPINGLIST_FETCH_SUCCESS_DATA:
      return {
        ...state,
        shoppingList: {
          ...state.shoppingList,
          value: action.payload as ShoppingList,
        },
        isLoading: Utils.deriveIsLoading({
          ...state.loadingComponents,
          shoppingLists: false,
        }),
        loadingComponents: {
          ...state.loadingComponents,
          shoppingLists: false,
        },
      };
    case ReducerActions.SHOPPINGLIST_FETCH_SUCCESS_LISTENER:
      return {
        ...state,
        shoppingList: {
          ...state.shoppingList,
          unsubscribe: action.payload as () => void,
        },
      };
    case ReducerActions.MATERIALLIST_FETCH_INIT:
      return {
        ...state,
        isLoading: true,
        loadingComponents: {...state.loadingComponents, materialList: true},
      };
    case ReducerActions.MATERIALLIST_FETCH_SUCCESS:
      return {
        ...state,
        materialList: action.payload as MaterialList,
        isLoading: Utils.deriveIsLoading({
          ...state.loadingComponents,
          materialList: false,
        }),
        loadingComponents: {
          ...state.loadingComponents,
          materialList: false,
        },
      };
    case ReducerActions.RECIPE_FETCH_INIT: {
      newRecipes = {...state.recipes};
      // Werte der Recipe-Short zwinschenspeichern damit
      // schon mal was angezeigt wird
      const tempRecipe = {
        ...new Recipe(),
        uid: action.payload.uid,
        name: action.payload.name,
        pictureSrc: action.payload.pictureSrc,
      };
      newRecipes[tempRecipe.uid] = tempRecipe;
      return {
        ...state,
        recipes: newRecipes,
        isLoading: true,
        loadingComponents: {...state.loadingComponents, recipe: true},
      };
    }
    case ReducerActions.RECIPE_FETCH_SUCCESS: {
      // Einzelnes Rezept aus der DB
      newRecipes = {...state.recipes};
      const recipe = action.payload as Recipe;
      newRecipes[recipe.uid] = recipe;

      return {
        ...state,
        recipes: newRecipes,
        isLoading: Utils.deriveIsLoading({
          ...state.loadingComponents,
          recipe: false,
        }),
        loadingComponents: {...state.loadingComponents, recipe: false},
      };
    }
    case ReducerActions.RECIPES_FETCH_SUCCESS:
      return {
        ...state,
        recipes: action.payload as Recipes,
        isLoading: Utils.deriveIsLoading({
          ...state.loadingComponents,
          recipe: false,
        }),
        loadingComponents: {...state.loadingComponents, recipe: false},
      };
    case ReducerActions.RECIPE_LIST_FETCH_INIT:
      return {
        ...state,
        isLoading: true,
        loadingComponents: {...state.loadingComponents, recipes: true},
      };
    case ReducerActions.RECIPE_LIST_FETCH_SUCCESS:
      return {
        ...state,
        recipeList: action.payload as RecipeShort[],
        isLoading: Utils.deriveIsLoading({
          ...state.loadingComponents,
          recipes: false,
        }),
        loadingComponents: {...state.loadingComponents, recipes: false},
      };
    case ReducerActions.UNTIS_FETCH_INIT:
      return {
        ...state,
        isLoading: true,
        loadingComponents: {...state.loadingComponents, units: true},
      };
    case ReducerActions.UNITS_FETCH_SUCCESS:
      return {
        ...state,
        units: action.payload as Unit[],
        isLoading: Utils.deriveIsLoading({
          ...state.loadingComponents,
          units: false,
        }),
        loadingComponents: {...state.loadingComponents, units: false},
      };
    case ReducerActions.PRODUCTS_FETCH_INIT:
      return {
        ...state,
        isLoading: true,
        loadingComponents: {...state.loadingComponents, products: true},
      };
    case ReducerActions.PRODUCTS_FETCH_SUCCESS:
      return {
        ...state,
        products: action.payload as Product[],
        isLoading: Utils.deriveIsLoading({
          ...state.loadingComponents,
          products: false,
        }),
        loadingComponents: {...state.loadingComponents, products: false},
      };
    case ReducerActions.MATERIALS_FETCH_INIT:
      return {
        ...state,
        isLoading: true,
        loadingComponents: {...state.loadingComponents, materials: true},
      };
    case ReducerActions.MATERIALS_FETCH_SUCCESS:
      return {
        ...state,
        materials: action.payload as Material[],
        isLoading: Utils.deriveIsLoading({
          ...state.loadingComponents,
          materials: false,
        }),
        loadingComponents: {...state.loadingComponents, materials: false},
      };
    case ReducerActions.DEPARTMENTS_FETCH_INIT:
      return {
        ...state,
        isLoading: true,
        loadingComponents: {...state.loadingComponents, departments: true},
      };
    case ReducerActions.DEPARTMENTS_FETCH_SUCCESS:
      return {
        ...state,
        departments: action.payload as Department[],
        isLoading: Utils.deriveIsLoading({
          ...state.loadingComponents,
          departments: false,
        }),
        loadingComponents: {...state.loadingComponents, departments: false},
      };
    case ReducerActions.ON_MASTERDATA_CREATE: {
      if (action.payload.type === MasterDataCreateType.PRODUCT) {
        let newProducts = [...state.products];
        const existing = newProducts.find(
          (value) => value.uid == action.payload.value.uid,
        );
        if (!existing) {
          newProducts.push(action.payload.value as Product);
          newProducts = Utils.sortArray({
            array: newProducts,
            attributeName: "name",
          });
        }
        return {...state, products: newProducts};
      } else {
        let newMaterials = [...state.materials];
        const existing = newMaterials.find(
          (value) => value.uid == action.payload.value.uid,
        );
        if (!existing) {
          newMaterials.push(action.payload.value as Material);
          newMaterials = Utils.sortArray({
            array: newMaterials,
            attributeName: "name",
          });
        }
        return {...state, materials: newMaterials};
      }
    }
    case ReducerActions.ON_RECIPE_UPDATE: {
      const newRecipe = action.payload as Recipe;
      let updatedRecipeList = [...state.recipeList];
      const updatedRecipes = {...state.recipes};
      updatedRecipes[newRecipe.uid] = newRecipe;

      const arrayIndex = updatedRecipeList.findIndex(
        (recipeShort) => recipeShort.uid == newRecipe.uid,
      );

      if (arrayIndex !== -1) {
        updatedRecipeList[arrayIndex] =
          RecipeShort.createShortRecipeFromRecipe(newRecipe);
      } else {
        // Neues Rezept aufnehmen
        updatedRecipeList.push(
          RecipeShort.createShortRecipeFromRecipe(newRecipe),
        );
      }
      // Array sortieren
      updatedRecipeList = Utils.sortArray({
        array: updatedRecipeList,
        attributeName: "name",
      });

      return {
        ...state,
        recipeList: updatedRecipeList,
        recipes: updatedRecipes,
      };
    }
    case ReducerActions.UNIT_CONVERSION_FETCH_INIT:
      return {
        ...state,
        isLoading: true,
        loadingComponents: {...state.loadingComponents, unitCoversion: true},
      };
    case ReducerActions.UNIT_CONVERSION_FETCH_SUCCES:
      return {
        ...state,
        unitConversionBasic: action.payload
          .unitConversionBasic as UnitConversionBasic,
        unitConversionProducts: action.payload
          .unitConversionProducts as UnitConversionProducts,
        isLoading: Utils.deriveIsLoading({
          ...state.loadingComponents,
          unitCoversion: false,
        }),
        loadingComponents: {...state.loadingComponents, unitCoversion: false},
      };
    case ReducerActions.SNACKBAR_SHOW:
      return {
        ...state,
        snackbar: {
          severity: action.payload.severity,
          message: action.payload.message,
          open: true,
        },
      };
    case ReducerActions.SNACKBAR_CLOSE:
      return {
        ...state,
        snackbar: {
          severity: "success",
          message: "",
          open: false,
        },
      };
    case ReducerActions.GENERIC_ERROR:
      // Allgemeiner Fehler
      console.warn(action.payload);
      return {
        ...state,
        isLoading: false,
        error: action.payload as Error,
      };
    default: {
      const _exhaustiveCheck: never = action;
      console.error("Unbekannter ActionType: ", _exhaustiveCheck);
      throw new Error();
    }
  }
};

const INITITIAL_STATE: State = {
  event: new Event(),
  menuplan: new Menuplan(),
  groupConfig: new EventGroupConfiguration(),
  usedRecipes: new UsedRecipes(),
  shoppingListCollection: new ShoppingListCollection(),
  shoppingList: {value: null, unsubscribe: null},
  materialList: new MaterialList(),
  recipes: {} as Recipes,
  recipeList: [],
  units: [],
  products: [],
  materials: [],
  departments: [],
  snackbar: {} as Snackbar,
  unitConversionBasic: null,
  unitConversionProducts: null,
  isLoading: false,
  isSaving: false,
  loadingComponents: {
    event: false,
    groupConfig: false,
    menuplan: false,
    usedRecipes: false,
    shoppingListCollection: false,
    shoppingLists: false,
    materialList: false,
    recipe: false,
    recipes: false,
    units: false,
    products: false,
    materials: false,
    departments: false,
    unitCoversion: false,
  },
  error: null,
};

interface EventDraftState {
  event: Event;
  localPicture: File | null;
  formValidation: FormValidationFieldError[];
}
const INTITIAL_STATE_EVENT_DRAF: EventDraftState = {
  event: new Event(),
  localPicture: null,
  formValidation: [],
};
interface LocationState {
  event: Event;
}
/* ===================================================================
// =============================== Page ==============================
// =================================================================== */
// eslint-disable-next-line @typescript-eslint/no-explicit-any

/* ===================================================================
// =============================== Base ==============================
// =================================================================== */
const EventPage = () => {
  const firebase = useFirebase();
  const database = useDatabase();
  const authUser = useAuthUser();
  const theme = useTheme();
  const location = useLocation();
  const {customDialog} = useCustomDialog();
  const navigate = useNavigate();

  const classes = useCustomStyles();
  let eventUid = "";

  const [state, dispatch] = React.useReducer(eventReducer, INITITIAL_STATE);
  const [activeTab, setActiveTab] = React.useState(EventTabs.menuplan);
  const [eventDraft, setEventDraft] = React.useState(INTITIAL_STATE_EVENT_DRAF);
  // Flag: Während ein Menuplan-Save läuft, soll die Realtime-Subscription
  // keine Reloads auslösen — das delete-all + re-insert würde sonst einen
  // leeren Zwischenstand laden und das optimistische Update überschreiben.
  const menuplanSaveInProgress = React.useRef(false);

  // Menü-UIDs, die durch einen anderen Benutzer geändert wurden — kurzzeitig
  // hervorgehoben (Glow-Animation), dann automatisch geleert.
  const [highlightedMenueUids, setHighlightedMenueUids] = React.useState<
    Set<string>
  >(new Set());
  const highlightTimeoutRef = React.useRef<ReturnType<typeof setTimeout>>();
  // Ref für den aktuellen Menuplan, damit der Debounce-Callback (der in einem
  // useEffect mit [] lebt) immer Zugriff auf den neuesten Stand hat.
  const menuplanRef = React.useRef<Menuplan>(state.menuplan);
  React.useEffect(() => {
    menuplanRef.current = state.menuplan;
  }, [state.menuplan]);

  /* ------------------------------------------
  // Daten aus der DB lesen
  // ------------------------------------------ */
  if (!eventUid) {
    eventUid = deriveEventUid({
      event: location.state?.event,
      pathname: location.pathname,
    });
  }

  // Konvertiert EventDomain → Event-Klasse und reichert die Köche mit öffentlichen Profildaten an
  const enrichEventWithCookProfiles = async (
    domain: EventDomain,
  ): Promise<Event> => {
    const event = database.events.eventDomainToUi(domain);

    // Öffentliche Profile der Köche parallel laden
    const profilePromises = event.cooks.map(async (cook) => {
      try {
        const profile = await User.getPublicProfile({
          database,
          uid: cook.uid,
        });
        return {
          ...cook,
          displayName: profile.displayName,
          motto: profile.motto,
          pictureSrc: profile.pictureSrc,
        };
      } catch {
        // Profil nicht gefunden — Fallback auf leere Werte
        return cook;
      }
    });

    event.cooks = await Promise.all(profilePromises);
    return event;
  };

  React.useEffect(() => {
    // Event — Supabase Realtime Subscription
    if (!state.event.uid) {
      dispatch({type: ReducerActions.EVENT_FETCH_INIT, payload: {}});

      // Initialer Load
      database.events
        .getEvent(eventUid)
        .then(async (eventDomain) => {
          if (eventDomain) {
            const event = await enrichEventWithCookProfiles(eventDomain);
            dispatch({
              type: ReducerActions.EVENT_FETCH_SUCCESS,
              payload: event,
            });
          }
        })
        .catch((error) => {
          dispatch({type: ReducerActions.GENERIC_ERROR, payload: error});
        });
    }

    // Realtime-Subscription für laufende Änderungen
    // Fehler nur loggen — Realtime-Verbindungsfehler sind transient, Client reconnected automatisch
    const unsubscribe = database.events.subscribeToEvent(
      eventUid,
      (eventDomain) => {
        enrichEventWithCookProfiles(eventDomain).then((event) => {
          dispatch({
            type: ReducerActions.EVENT_FETCH_SUCCESS,
            payload: event,
          });
        });
      },
      (error) => {
        console.warn("Realtime event subscription error:", error.message);
      },
    );

    return function cleanup() {
      unsubscribe();
    };
  }, []);
  React.useEffect(() => {
    // Group-Config — Supabase Realtime Subscription
    dispatch({type: ReducerActions.GROUP_CONFIG_FETCH_INIT, payload: {}});

    // Initialer Load
    database.eventGroupConfig
      .getGroupConfig(eventUid)
      .then((gcDomain) => {
        dispatch({
          type: ReducerActions.GROUP_CONFIG_FETCH_SUCCESS,
          payload: database.eventGroupConfig.groupConfigDomainToUi(gcDomain, eventUid),
        });
      })
      .catch((error) => {
        dispatch({type: ReducerActions.GENERIC_ERROR, payload: error});
      });

    // Realtime-Subscription für laufende Änderungen
    // Fehler nur loggen — Realtime-Verbindungsfehler sind transient, Client reconnected automatisch
    const unsubscribe = database.eventGroupConfig.subscribeToGroupConfig(
      eventUid,
      (gcDomain) => {
        dispatch({
          type: ReducerActions.GROUP_CONFIG_FETCH_SUCCESS,
          payload: database.eventGroupConfig.groupConfigDomainToUi(gcDomain, eventUid),
        });
      },
      (error) => {
        console.warn("Realtime groupconfig subscription error:", error.message);
      },
    );

    return function cleanup() {
      unsubscribe();
    };
  }, []);
  React.useEffect(() => {
    // Menüplan — Supabase Realtime Subscription
    if (!state.menuplan.uid) {
      dispatch({type: ReducerActions.MENUPLAN_FETCH_INIT, payload: {}});

      // Initialer Load
      database.menuplan
        .getMenuplanForUi(eventUid)
        .then((menuplanData) => {
          dispatch({
            type: ReducerActions.MENUPLAN_FETCH_SUCCESS,
            payload: menuplanData,
          });
        })
        .catch((error) => {
          dispatch({type: ReducerActions.GENERIC_ERROR, payload: error});
        });
    }

    // Debounced Reload-Funktion — saveMenuplan() löst mehrere Realtime-Events
    // gleichzeitig aus (delete + insert über 8 Tabellen), daher zusammenfassen.
    // Während eines Saves wird der Reload übersprungen, damit der leere
    // Zwischenstand (nach DELETE, vor INSERT) nicht das optimistische Update überschreibt.
    const debouncedReload = _.debounce(() => {
      if (menuplanSaveInProgress.current) return;

      database.menuplan
        .getMenuplanForUi(eventUid)
        .then((newMenuplan) => {
          if (menuplanSaveInProgress.current) return;

          // Geänderte Menüs ermitteln und kurzzeitig hervorheben
          const changedUids = getChangedMenueUids(
            menuplanRef.current,
            newMenuplan,
          );
          if (changedUids.size > 0) {
            setHighlightedMenueUids(changedUids);
            if (highlightTimeoutRef.current)
              clearTimeout(highlightTimeoutRef.current);
            highlightTimeoutRef.current = setTimeout(
              () => setHighlightedMenueUids(new Set()),
              2000,
            );
          }

          dispatch({
            type: ReducerActions.MENUPLAN_FETCH_SUCCESS,
            payload: newMenuplan,
          });
        })
        .catch((error) => {
          dispatch({type: ReducerActions.GENERIC_ERROR, payload: error});
        });
    }, 200);

    // Realtime-Subscription für laufende Änderungen
    // Fehler nur loggen — Realtime-Verbindungsfehler sind transient, Client reconnected automatisch
    const unsubscribe = database.menuplan.subscribeToMenuplan(
      eventUid,
      debouncedReload,
      (error) => {
        console.warn("Realtime menuplan subscription error:", error.message);
      },
    );

    return function cleanup() {
      debouncedReload.cancel();
      unsubscribe();
      if (highlightTimeoutRef.current)
        clearTimeout(highlightTimeoutRef.current);
    };
  }, []);
  React.useEffect(() => {
    // ShoppingList-Collection (noch auf Firebase)
    if (activeTab == EventTabs.shoppingList) {
      let unsubscribe: (() => void) | undefined;
      dispatch({
        type: ReducerActions.SHOPPINGLIST_COLLECTION_FETCH_INIT,
        payload: {},
      });
      ShoppingListCollection.getShoppingListCollectionListener({
        firebase: firebase,
        eventUid: eventUid,
        callback: (shoppingListCollection) => {
          dispatch({
            type: ReducerActions.SHOPPINGLIST_COLLECTION_FETCH_SUCCESS,
            payload: shoppingListCollection,
          });
        },
      })
        .then((result) => {
          unsubscribe = result;
        })
        .catch((error) => {
          dispatch({type: ReducerActions.GENERIC_ERROR, payload: error});
        });
      return function cleanup() {
        unsubscribe && unsubscribe();
      };
    }
  }, [activeTab]);
  React.useEffect(() => {
    // Unit Conversion — aus Supabase laden
    if (
      (activeTab == EventTabs.quantityCalculation ||
        activeTab == EventTabs.shoppingList) &&
      (state.unitConversionBasic == null ||
        state.unitConversionProducts == null)
    ) {
      dispatch({type: ReducerActions.UNIT_CONVERSION_FETCH_INIT, payload: {}});

      Promise.all([
        database.unitConversionBasic.getAllConversions(),
        database.unitConversionProducts.getAllConversions(),
      ])
        .then(([basicDomains, productDomains]) => {
          // Domain-Arrays in die Map-Strukturen konvertieren
          const unitConversionBasic: UnitConversionBasic = {};
          for (const d of basicDomains) {
            unitConversionBasic[d.uid] = {
              fromUnit: d.fromUnit,
              toUnit: d.toUnit,
              numerator: d.numerator,
              denominator: d.denominator,
            };
          }
          const unitConversionProducts: UnitConversionProducts = {};
          for (const d of productDomains) {
            unitConversionProducts[d.uid] = {
              fromUnit: d.fromUnit,
              toUnit: d.toUnit,
              numerator: d.numerator,
              denominator: d.denominator,
              productUid: d.productUid,
              productName: d.productName,
            };
          }
          dispatch({
            type: ReducerActions.UNIT_CONVERSION_FETCH_SUCCES,
            payload: {unitConversionBasic, unitConversionProducts},
          });
        })
        .catch((error) => {
          dispatch({
            type: ReducerActions.GENERIC_ERROR,
            payload: error,
          });
        });
    }
  }, [activeTab]);
  React.useEffect(() => {
    // Produkte — aus Supabase laden
    if (
      (activeTab == EventTabs.quantityCalculation ||
        activeTab == EventTabs.shoppingList) &&
      state.products.length == 0
    ) {
      dispatch({type: ReducerActions.PRODUCTS_FETCH_INIT, payload: {}});
      database.products
        .getAllProducts({onlyUsable: true, withDepartmentName: false})
        .then((productDomains) => {
          const products: Product[] = productDomains.map((d) => {
            const p = new Product();
            p.uid = d.uid;
            p.name = d.name;
            p.department = d.department;
            p.shoppingUnit = d.shoppingUnit;
            p.dietProperties = d.dietProperties;
            p.usable = d.usable;
            return p;
          });
          dispatch({
            type: ReducerActions.PRODUCTS_FETCH_SUCCESS,
            payload: products,
          });
        })
        .catch((error) => {
          dispatch({
            type: ReducerActions.GENERIC_ERROR,
            payload: error,
          });
        });
    }
  }, [activeTab]);
  React.useEffect(() => {
    // Abteilungen — aus Supabase laden
    if (activeTab == EventTabs.shoppingList && state.departments.length == 0) {
      dispatch({type: ReducerActions.DEPARTMENTS_FETCH_INIT, payload: {}});
      database.departments
        .getAllDepartments()
        .then((deptDomains) => {
          const departments: Department[] = deptDomains.map((d) => {
            const dept = new Department();
            dept.uid = d.uid;
            dept.name = d.name;
            dept.pos = d.pos;
            return dept;
          });
          dispatch({
            type: ReducerActions.DEPARTMENTS_FETCH_SUCCESS,
            payload: departments,
          });
        })
        .catch((error) => {
          dispatch({
            type: ReducerActions.GENERIC_ERROR,
            payload: error,
          });
        });
    }
  }, [activeTab]);
  React.useEffect(() => {
    // Materiale — aus Supabase laden
    if (
      (activeTab == EventTabs.shoppingList ||
        activeTab == EventTabs.materialList) &&
      state.materials.length == 0
    ) {
      dispatch({type: ReducerActions.MATERIALS_FETCH_INIT, payload: {}});

      database.materials
        .getAllMaterials(true)
        .then((materialDomains) => {
          const materials: Material[] = materialDomains.map((d) => {
            const m = new Material();
            m.uid = d.uid;
            m.name = d.name;
            m.type = d.type;
            m.usable = d.usable;
            return m;
          });
          dispatch({
            type: ReducerActions.MATERIALS_FETCH_SUCCESS,
            payload: materials,
          });
        })
        .catch((error) => {
          dispatch({
            type: ReducerActions.GENERIC_ERROR,
            payload: error,
          });
        });
    }
  }, [activeTab]);
  React.useEffect(() => {
    // Einheiten — aus Supabase laden
    if (activeTab == EventTabs.shoppingList && state.units.length == 0) {
      dispatch({type: ReducerActions.UNTIS_FETCH_INIT, payload: {}});

      database.units
        .getAllUnits()
        .then((unitDomains) => {
          const units: Unit[] = unitDomains.map(
            (d) => {
              const u = new Unit({key: d.key, name: d.name});
              u.dimension = d.dimension as Unit["dimension"];
              return u;
            },
          );
          dispatch({
            type: ReducerActions.UNITS_FETCH_SUCCESS,
            payload: units,
          });
        })
        .catch((error) => {
          dispatch({
            type: ReducerActions.GENERIC_ERROR,
            payload: error,
          });
        });
    }
  }, [activeTab]);
  React.useEffect(() => {
    // Verwendete Rezepte (noch auf Firebase)
    if (activeTab == EventTabs.usedRecipes) {
      let unsubscribe: () => void;
      dispatch({type: ReducerActions.USED_RECIPES_FETCH_INIT, payload: {}});
      UsedRecipes.getUsedRecipesListener({
        firebase: firebase,
        uid: eventUid,
        callback: (usedRecipes) => {
          dispatch({
            type: ReducerActions.USED_RECIPES_FETCH_SUCCESS,
            payload: usedRecipes,
          });
        },
        errorCallback: (error) => {
          dispatch({type: ReducerActions.GENERIC_ERROR, payload: error});
        },
      })
        .then((result) => {
          unsubscribe = result;
        })
        .catch((error) => {
          dispatch({type: ReducerActions.GENERIC_ERROR, payload: error});
        });
      return function cleanup() {
        unsubscribe();
      };
    }
  }, [activeTab]);
  React.useEffect(() => {
    // Materialliste (noch auf Firebase)
    if (activeTab == EventTabs.materialList) {
      let unsubscribe: () => void;
      dispatch({type: ReducerActions.MATERIALLIST_FETCH_INIT, payload: {}});
      MaterialList.getMaterialListListener({
        firebase: firebase,
        uid: eventUid,
        callback: (materialList) => {
          dispatch({
            type: ReducerActions.MATERIALLIST_FETCH_SUCCESS,
            payload: materialList,
          });
        },
        errorCallback: (error) => {
          dispatch({type: ReducerActions.GENERIC_ERROR, payload: error});
        },
      })
        .then((result) => {
          unsubscribe = result;
        })
        .catch((error) => {
          dispatch({type: ReducerActions.GENERIC_ERROR, payload: error});
        });
      return function cleanup() {
        unsubscribe();
      };
    }
  }, [activeTab]);
  React.useEffect(() => {
    if (activeTab === EventTabs.eventInfo && !eventDraft.event.uid) {
      setEventDraft(_.cloneDeep({...eventDraft, event: state.event}));
    }
  }, [activeTab]);
  if (!authUser) {
    return null;
  }
  /* ------------------------------------------
  // Tab-Handling
  // ------------------------------------------ */
  const onTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };
  /* ------------------------------------------
  // Change-Handling
  // ------------------------------------------ */
  const onMenuplanUpdate = (menuplan: Menuplan) => {
    // Vorherigen Zustand sichern für Rollback bei Fehler
    const previousMenuplan = state.menuplan;

    // Optimistisches Update: State sofort aktualisieren, damit die UI
    // den neuen Zustand zeigt, ohne auf den Realtime-Roundtrip zu warten.
    // (saveMenuplan macht delete-all + re-insert, was mehrere Realtime-Events
    // auslöst, die durch den Debounce verloren gehen können.)
    dispatch({type: ReducerActions.MENUPLAN_FETCH_SUCCESS, payload: menuplan});

    // Save-Flag setzen, damit Realtime-Reloads den optimistischen State nicht
    // mit leerem Zwischenstand (nach DELETE, vor INSERT) überschreiben.
    menuplanSaveInProgress.current = true;

    database.menuplan
      .saveMenuplanFromUi(eventUid, menuplan, authUser as AuthUser)
      .then(() => {
        menuplanSaveInProgress.current = false;
      })
      .catch((error) => {
        menuplanSaveInProgress.current = false;
        console.error("Menuplan-Speichern fehlgeschlagen:", error);
        // Rollback: vorherigen Zustand wiederherstellen, damit keine Daten verloren gehen
        dispatch({
          type: ReducerActions.MENUPLAN_FETCH_SUCCESS,
          payload: previousMenuplan,
        });
        dispatch({type: ReducerActions.GENERIC_ERROR, payload: error});
      });
  };
  const onRecipeUpdate = (recipe: Recipe) => {
    // in den bestehenden Rezepten anpassen
    dispatch({
      type: ReducerActions.ON_RECIPE_UPDATE,
      payload: recipe,
    });
  };
  const onGroupConfigurationUpdate = (
    // Alle Portionen im Menüplan neu berechnen und update
    groupConfiguration: EventGroupConfiguration,
  ) => {
    const menuplan = Menuplan.recalculatePortions({
      menuplan: state.menuplan,
      groupConfig: groupConfiguration,
    });

    // neuer Menüplan speichern
    onMenuplanUpdate(menuplan);

    // Kein zurückschreiben in den State, da der Listener, das wieder erhält....
  };
  const onShoppingListUpdate = (shoppingList: ShoppingList) => {
    ShoppingList.save({
      firebase: firebase,
      eventUid: state.event.uid,
      shoppingList: shoppingList,
      authUser: authUser,
    });
    // Kein zurückschreiben in den State, da der Listener, das wieder erhält....
  };
  const onShoppingCollectionUpdate = (
    shoppingListCollection: ShoppingListCollection,
  ) => {
    ShoppingListCollection.save({
      firebase: firebase,
      eventUid: state.event.uid,
      shoppingListCollection: shoppingListCollection,
      authUser: authUser,
    });
  };
  const onUsedRecipesUpdate = (usedRecipes: UsedRecipes) => {
    UsedRecipes.save({
      firebase: firebase,
      usedRecipes: usedRecipes,
      authUser: authUser,
    });
  };
  const onMaterialListUpdate = (materialList: MaterialList) => {
    MaterialList.save({
      firebase: firebase,
      materialList: materialList,
      authUser: authUser,
    });
  };
  const onEventUpdate = (event: Event) => {
    // Der Event hat eine Schatteninstanz im React.State. Dies damit
    // die Änderungen erst beim Speichern in Kraft tretten.
    // Hintergrund. Im Schlimmsten Fall werden bei einer Anpassung der
    // Event-Eckpunkte Tage gelöscht. Dies muss bewusst stattfinden und
    // kann nicht mit Listener gleich umgesetzt werden. Darum muss die Person
    // bewusst auf speichern Klicken und der State-Wert des Events wird auf
    // die DB gespeichert und in den Globalen State übertragen
    setEventDraft({...eventDraft, event: event});
  };
  const onFormValidationUpdate = (errors: FormValidationFieldError[]) => {
    setEventDraft((prev) => ({...prev, formValidation: errors}));
  };
  const onEventSave = async (event: Event) => {
    dispatch({type: ReducerActions.EVENT_SAVE_INIT, payload: {}});
    try {
      // Bild hochladen, falls vorhanden
      if (eventDraft.localPicture) {
        const resized = await resizeImage(eventDraft.localPicture);
        const uploadResult = await database.storage.events.upload(
          event.uid + ".jpg",
          resized,
          "image/jpeg",
        );
        event.pictureSrc = uploadResult.publicUrl;
      }

      // Event-Kopfdaten speichern
      const eventDomain = database.events.eventUiToDomain(event);
      await database.events.updateEvent(eventDomain, authUser as AuthUser);

      // Zeitscheiben speichern
      const dateDomains = database.events.eventDatesToDateDomains(event.dates);
      await database.events.saveDates(event.uid, dateDomains, authUser as AuthUser);

      setEventDraft({...eventDraft, event: event, localPicture: null});
      dispatch({type: ReducerActions.EVENT_SAVE_SUCCESS, payload: {}});
    } catch (error) {
      console.error(error);
      dispatch({type: ReducerActions.GENERIC_ERROR, payload: error as Error});
    }
  };
  const onEventPictureUpdate = (picture: File | null) => {
    setEventDraft({
      ...eventDraft,
      localPicture: picture,
    });
  };
  /* ------------------------------------------
  // Handling Einstellungen Event
  // ------------------------------------------ */
  const onEventDiscardChanges = () => {
    setEventDraft(_.cloneDeep({...eventDraft, event: state.event}));
  };
  const onEventSaveChanges = async () => {
    // Prüfen ob die Anzahl Tage unterschiedlich sind,
    // wenn durch die Änderung Tage gelöscht wurden und
    // im Menüplan in diesen Tage in den Menüs etwas steht
    // Warnmeldung ausgeben, dass Daten allefalls gelöscht
    // werden.

    // TODO: Prüfen ob diese Warnung korrekt funktioniert, sobald der Menuplan
    // vollständig über Supabase läuft. Falls Zeitscheiben gelöscht werden, die
    // bereits geplante Mahlzeiten/Menüs enthalten, muss die Warnung erscheinen.
    if (
      Event.checkIfDeletedDayArePlanned({
        event: eventDraft.event,
        menuplan: state.menuplan,
      })
    ) {
      const userInput = (await customDialog({
        dialogType: DialogType.Confirm,
        title: TEXT_ATTENTION_ABOUT_TO_DELETE_PLANED_DAYS,
        text: TEXT_DELETION_AFFECTS_PLANED_DAYS,
        buttonTextConfirm: TEXT_PROCEED,
      })) as SingleTextInputResult;

      if (!userInput) {
        // Abbruch
        return;
      }
    }
    const updatedMenuplan = Menuplan.adjustMenuplanWithNewDays({
      menuplan: state.menuplan,
      newEvent: eventDraft.event,
      existingEvent: state.event,
    });

    // Statistik anpassen
    Stats.incrementStat({
      firebase: firebase,
      field: StatsField.noPlanedDays,
      value: eventDraft.event.numberOfDays - state.event.numberOfDays,
    });

    onMenuplanUpdate(updatedMenuplan);
    onEventSave(eventDraft.event);
    dispatch({
      type: ReducerActions.SNACKBAR_SHOW,
      payload: {
        severity: "success",
        message: TEXT_EVENT_SAVE_SUCCESS(state.event.name),
      },
    });
  };
  const onEventDelete = async () => {
    const isConfirmed = await customDialog({
      dialogType: DialogType.ConfirmSecure,
      deletionDialogProperties: {confirmationString: state.event.name},
      title: TEXT_DIALOG_TITLE_DELETION_CONFIRMATION,
      subtitle: TEXT_DIALOG_SUBTITLE_DELETION_CONFIRMATION,
      text: TEXT_DIALOG_TEXT_DELETION_CONFIRMATION,
      buttonTextCancel: TEXT_CANCEL,
      buttonTextConfirm: TEXT_DELETE,
    });
    if (!isConfirmed) {
      return;
    }
    dispatch({type: ReducerActions.EVENT_DELETE_START, payload: {}});
    try {
      // Bild löschen (Fehler ignorieren, falls kein Bild vorhanden)
      await database.storage.events
        .remove(state.event.uid + ".jpg")
        .catch(() => {});

      // Firebase-Kinder löschen (ShoppingList, UsedRecipes, MaterialList — noch auf Firebase)
      await Promise.all([
        ShoppingListCollection.delete({
          firebase: firebase,
          eventUid: state.event.uid,
        }).catch(() => {}),
        UsedRecipes.delete({
          firebase: firebase,
          eventUid: state.event.uid,
        }).catch(() => {}),
        MaterialList.delete({
          firebase: firebase,
          eventUid: state.event.uid,
        }).catch(() => {}),
      ]);

      // Event löschen — CASCADE entfernt alle Supabase-Kinder
      await database.events.deleteEvent(state.event.uid);

      // Kurzer Timeout, damit der Session-Storage nachmag
      setTimeout(function () {
        navigate(ROUTE_HOME, {
          state: {
            acion: Action.DELETE,
            object: state.event.uid,
            snackbar: {
              open: true,
              severity: "success",
              message: `Anlass «${state.event.name}» wurde gelöscht.`,
            },
          },
        });
      }, 500);
    } catch (error) {
      console.error(error);
      dispatch({type: ReducerActions.GENERIC_ERROR, payload: error as Error});
    }
  };
  const onEventConsistencyCheck = () => {
    console.debug("Starte Konsistenzprüfung für Event:");
    const fixedMenuplan = Menuplan.fixMenuplan(state.menuplan);

    if (!fixedMenuplan.isConsistent) {
      // Neuer Menüplan speichern
      onMenuplanUpdate(fixedMenuplan.menuplan);

      // Meldung ausgeben.
      dispatch({
        type: ReducerActions.SNACKBAR_SHOW,
        payload: {
          severity: "info",
          message: TEXT_MENUPLAN_CONSISTENCY_CHECK_FIXES_APPLIED,
        },
      });
      logEvent(
        firebase.analytics,
        FirebaseAnalyticEvent.menuplanConsistencyCheckErrorsFound,
      );
    } else {
      dispatch({
        type: ReducerActions.SNACKBAR_SHOW,
        payload: {
          severity: "success",
          message: TEXT_MENUPLAN_CONSISTENCY_CHECK_NO_ISSUES,
        },
      });
      logEvent(
        firebase.analytics,
        FirebaseAnalyticEvent.menuplanConsistencyCheckNoErrors,
      );
    }
    console.debug;
    ("Konsistenzprüfung abgeschlossen.");
  };
  /* ------------------------------------------
  // Fehlende Daten holen
  // ------------------------------------------ */
  const fetchMissingData = ({
    type,
    recipeShort,
    objectUid,
  }: FetchMissingDataProps) => {
    switch (type) {
      case FetchMissingDataType.RECIPES:
        dispatch({type: ReducerActions.RECIPE_LIST_FETCH_INIT, payload: {}});
        // Rezepte aus Supabase laden (öffentliche + private + Varianten dieses Events)
        Promise.all([
          database.recipes.getAllPublicRecipeShorts(),
          database.recipes.getPrivateRecipeShortsForUser(authUser.authUid),
          database.recipes.getVariantShortsForEvent(state.event.uid),
        ])
          .then(([publicRecipes, privateRecipes, variantRecipes]) => {
            // RecipeShortDomain → RecipeShort konvertieren
            const toRecipeShort = (d: RecipeShortDomain): RecipeShort => {
              const rs = new RecipeShort();
              rs.uid = d.uid;
              rs.name = d.name;
              rs.source = d.source;
              rs.pictureSrc = d.pictureSrc;
              rs.tags = d.tags;
              rs.menuTypes = d.menuTypes;
              rs.dietProperties = {
                allergens: d.dietProperties.allergens,
                diet: d.dietProperties.diet,
              };
              rs.outdoorKitchenSuitable = d.outdoorKitchenSuitable;
              rs.rating = {avgRating: d.avgRating, noRatings: d.noRatings};
              rs.noComments = d.noComments;
              rs.type = d.recipeType as RecipeType;
              rs.variantName = d.variantName ?? undefined;
              rs.created = {date: d.createdAt, fromUid: d.createdBy, fromDisplayName: ""};
              return rs;
            };
            const allRecipes = [
              ...publicRecipes.map(toRecipeShort),
              ...privateRecipes.map(toRecipeShort),
              ...variantRecipes.map(toRecipeShort),
            ];
            allRecipes.sort((a, b) => a.name.localeCompare(b.name));
            dispatch({
              type: ReducerActions.RECIPE_LIST_FETCH_SUCCESS,
              payload: allRecipes,
            });
          })
          .catch((error) => {
            console.error(error);
            dispatch({
              type: ReducerActions.GENERIC_ERROR,
              payload: error,
            });
          });

        break;
      case FetchMissingDataType.RECIPE:
        // Einzelnes Rezept lesen
        if (!recipeShort) {
          return;
        }

        dispatch({
          type: ReducerActions.RECIPE_FETCH_INIT,
          payload: recipeShort,
        });

        // Rezept aus Supabase laden (Header + Zutaten + Schritte + Material)
        Promise.all([
          database.recipes.getRecipe(recipeShort.uid),
          database.recipeIngredients.getIngredientsForRecipe(recipeShort.uid),
          database.recipePreparationSteps.getStepsForRecipe(recipeShort.uid),
          database.recipeMaterials.getMaterialsForRecipe(recipeShort.uid),
        ])
          .then(([header, ingredients, steps, materials]) => {
            if (!header) throw new Error("Rezept nicht gefunden");
            const result = Recipe.fromRepositoryData(
              header,
              ingredients,
              steps,
              materials,
            );

            dispatch({
              type: ReducerActions.RECIPE_FETCH_SUCCESS,
              payload: result,
            });
          })
          .catch((error) => {
            dispatch({
              type: ReducerActions.GENERIC_ERROR,
              payload: error,
            });
          });

        break;
      case FetchMissingDataType.UNITS:
        dispatch({
          type: ReducerActions.UNTIS_FETCH_INIT,
          payload: {},
        });

        database.units
          .getAllUnits()
          .then((unitDomains) => {
            const units: Unit[] = unitDomains.map((d) => {
              const u = new Unit({key: d.key, name: d.name});
              u.dimension = d.dimension as Unit["dimension"];
              return u;
            });
            dispatch({
              type: ReducerActions.UNITS_FETCH_SUCCESS,
              payload: units,
            });
          })
          .catch((error) => {
            dispatch({
              type: ReducerActions.GENERIC_ERROR,
              payload: error,
            });
          });

        break;
      case FetchMissingDataType.PRODUCTS:
        dispatch({
          type: ReducerActions.PRODUCTS_FETCH_INIT,
          payload: {},
        });

        database.products
          .getAllProducts({onlyUsable: true, withDepartmentName: false})
          .then((productDomains) => {
            const products: Product[] = productDomains.map((d) => {
              const p = new Product();
              p.uid = d.uid;
              p.name = d.name;
              p.department = d.department;
              p.shoppingUnit = d.shoppingUnit;
              p.dietProperties = d.dietProperties;
              p.usable = d.usable;
              return p;
            });
            dispatch({
              type: ReducerActions.PRODUCTS_FETCH_SUCCESS,
              payload: products,
            });
          })
          .catch((error) => {
            dispatch({
              type: ReducerActions.GENERIC_ERROR,
              payload: error,
            });
          });

        break;
      case FetchMissingDataType.MATERIALS:
        dispatch({
          type: ReducerActions.MATERIALS_FETCH_INIT,
          payload: {},
        });

        database.materials
          .getAllMaterials(true)
          .then((materialDomains) => {
            const materials: Material[] = materialDomains.map((d) => {
              const m = new Material();
              m.uid = d.uid;
              m.name = d.name;
              m.type = d.type;
              m.usable = d.usable;
              return m;
            });
            dispatch({
              type: ReducerActions.MATERIALS_FETCH_SUCCESS,
              payload: materials,
            });
          })
          .catch((error) => {
            dispatch({
              type: ReducerActions.GENERIC_ERROR,
              payload: error,
            });
          });

        break;
      case FetchMissingDataType.DEPARTMENTS:
        dispatch({
          type: ReducerActions.DEPARTMENTS_FETCH_INIT,
          payload: {},
        });

        database.departments
          .getAllDepartments()
          .then((deptDomains) => {
            const departments: Department[] = deptDomains.map((d) => {
              const dept = new Department();
              dept.uid = d.uid;
              dept.name = d.name;
              dept.pos = d.pos;
              return dept;
            });
            dispatch({
              type: ReducerActions.DEPARTMENTS_FETCH_SUCCESS,
              payload: departments,
            });
          })
          .catch((error) => {
            dispatch({
              type: ReducerActions.GENERIC_ERROR,
              payload: error,
            });
          });
        break;
      case FetchMissingDataType.UNIT_CONVERSION:
        dispatch({
          type: ReducerActions.UNIT_CONVERSION_FETCH_INIT,
          payload: {},
        });
        Promise.all([
          database.unitConversionBasic.getAllConversions(),
          database.unitConversionProducts.getAllConversions(),
        ])
          .then(([basicDomains, productDomains]) => {
            const unitConversionBasic: UnitConversionBasic = {};
            for (const d of basicDomains) {
              unitConversionBasic[d.uid] = {
                fromUnit: d.fromUnit,
                toUnit: d.toUnit,
                numerator: d.numerator,
                denominator: d.denominator,
              };
            }
            const unitConversionProducts: UnitConversionProducts = {};
            for (const d of productDomains) {
              unitConversionProducts[d.uid] = {
                fromUnit: d.fromUnit,
                toUnit: d.toUnit,
                numerator: d.numerator,
                denominator: d.denominator,
                productUid: d.productUid,
                productName: d.productName,
              };
            }
            dispatch({
              type: ReducerActions.UNIT_CONVERSION_FETCH_SUCCES,
              payload: {unitConversionBasic, unitConversionProducts},
            });
          })
          .catch((error) => {
            dispatch({
              type: ReducerActions.GENERIC_ERROR,
              payload: error,
            });
          });
        break;
      case FetchMissingDataType.SHOPPING_LIST:
        if (state.shoppingList.unsubscribe !== null) {
          // Vorheriger Listener beenden
          state.shoppingList.unsubscribe();
        }
        dispatch({type: ReducerActions.SHOPPINGLIST_FETCH_INIT, payload: {}});
        ShoppingList.getShoppingListListener({
          firebase: firebase,
          eventUid: eventUid,
          shoppingListUid: objectUid as string,
          callback: (shoppingList) => {
            dispatch({
              type: ReducerActions.SHOPPINGLIST_FETCH_SUCCESS_DATA,
              payload: shoppingList,
            });
          },
          errorCallback: (error) => {
            if (error.message !== TEXT_DB_DOCUMENT_DELETED) {
              dispatch({type: ReducerActions.GENERIC_ERROR, payload: error});
            }
          },
        })
          .then((result) => {
            dispatch({
              type: ReducerActions.SHOPPINGLIST_FETCH_SUCCESS_LISTENER,
              payload: result,
            });
          })
          .catch((error) => {
            console.error(error);
            dispatch({type: ReducerActions.GENERIC_ERROR, payload: error});
          });
    }
  };
  /* ------------------------------------------
  // Neue Stammdaten erstellt 
  // ------------------------------------------ */
  const onMasterdataCreate = ({type, value}: OnMasterdataCreateProps) => {
    // Neuer Wert in den State aufnehmen
    dispatch({
      type: ReducerActions.ON_MASTERDATA_CREATE,
      payload: {type: type, value: value},
    });

    dispatch({
      type: ReducerActions.SNACKBAR_SHOW,
      payload: {
        message:
          type == MasterDataCreateType.MATERIAL
            ? TEXT_MATERIAL_CREATED(value.name)
            : TEXT_PRODUCT_CREATED(value.name),
        severity: "success",
      },
    });
  };
  /* ------------------------------------------
  // Snackback 
  // ------------------------------------------ */
  const handleSnackbarClose = (
    event: globalThis.Event | SyntheticEvent<Element, globalThis.Event>,
    reason: SnackbarCloseReason,
  ) => {
    if (reason === "clickaway") {
      return;
    }
    dispatch({
      type: ReducerActions.SNACKBAR_CLOSE,
      payload: {},
    });
  };
  return (
    <React.Fragment>
      {/*===== HEADER ===== */}
      <PageTitle
        title={state.event.name}
        subTitle={state.event.motto}
        windowTitle={`${state.event.name} | ${
          activeTab === EventTabs.menuplan
            ? TEXT_MENUPLAN
            : activeTab === EventTabs.quantityCalculation
              ? TEXT_QUANTITY_CALCULATION
              : activeTab === EventTabs.usedRecipes
                ? TEXT_PLANED_RECIPES
                : activeTab === EventTabs.shoppingList
                  ? TEXT_SHOPPING_LIST
                  : activeTab === EventTabs.materialList
                    ? TEXT_MATERIAL_LIST
                    : activeTab === EventTabs.eventInfo
                      ? TEXT_EVENT_INFO_SHORT
                      : "xx"
        }`}
      />
      {/* ===== BODY ===== */}
      <Container
        sx={classes.container}
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          marginBottom: theme.spacing(2),
          width: "auto !important",
        }}
        component="main"
        maxWidth="xl"
      >
        <Backdrop
          sx={classes.backdrop}
          open={state.isLoading || state.isSaving}
        >
          <Stack spacing={2} sx={classes.centerCenter}>
            <CircularProgress color="inherit" />
            {state.isSaving && (
              <React.Fragment>
                <Typography>{TEXT_EVENT_IS_BEEING_SAVED}</Typography>
                {eventDraft.localPicture && (
                  <Typography>{TEXT_IMAGE_IS_BEEING_UPLOADED}</Typography>
                )}
              </React.Fragment>
            )}
          </Stack>
        </Backdrop>
        {state.error ? (
          <AlertMessage
            error={state.error}
            severity="error"
            messageTitle={TEXT_ALERT_TITLE_UUPS}
          />
        ) : (
          <React.Fragment>
            <Box component="div" sx={classes.menuplanTabsContainer}>
              <Tabs
                value={activeTab}
                sx={classes.menuplanTabs}
                style={{
                  marginBottom: "1rem",
                  display: "flex",
                  justifyContent: "center",
                }}
                onChange={onTabChange}
                variant="scrollable"
                scrollButtons="auto"
                aria-label="Menuplan Tabs"
              >
                <Tab label={TEXT_MENUPLAN} {...tabProps(0)} />
                <Tab label={TEXT_QUANTITY_CALCULATION} {...tabProps(1)} />
                <Tab label={TEXT_PLANED_RECIPES} {...tabProps(2)} />
                <Tab label={TEXT_SHOPPING_LIST} {...tabProps(3)} />
                <Tab label={TEXT_MATERIAL_LIST} {...tabProps(4)} />
                <Tab label={TEXT_EVENT_INFO_SHORT} {...tabProps(5)} />
              </Tabs>
            </Box>
          </React.Fragment>
        )}
      </Container>
      {!state.error && (
        <React.Fragment>
          {activeTab == EventTabs.menuplan ? (
            <HighlightedMenueContext.Provider value={highlightedMenueUids}>
              <MenuplanPage
                menuplan={state.menuplan}
                groupConfiguration={state.groupConfig}
                event={state.event}
                recipeList={state.recipeList}
                recipes={state.recipes}
                units={state.units}
                products={state.products}
                materials={state.materials}
                departments={state.departments}
                firebase={firebase}
                authUser={authUser}
                onMenuplanUpdate={onMenuplanUpdate}
                fetchMissingData={fetchMissingData}
                onMasterdataCreate={onMasterdataCreate}
                onRecipeUpdate={onRecipeUpdate}
              />
            </HighlightedMenueContext.Provider>
          ) : activeTab == EventTabs.quantityCalculation ? (
            <Container>
              <EventGroupConfigurationPage
                firebase={firebase}
                authUser={authUser}
                event={state.event}
                groupConfiguration={state.groupConfig}
                // onConfirm=(()=>())
                // onCancel=(()=>())
                onGroupConfigurationUpdate={onGroupConfigurationUpdate}
              />
            </Container>
          ) : activeTab == EventTabs.usedRecipes ? (
            <Container>
              <EventUsedRecipesPage
                firebase={firebase}
                authUser={authUser}
                event={state.event}
                groupConfiguration={state.groupConfig}
                menuplan={state.menuplan}
                usedRecipes={state.usedRecipes}
                products={state.products}
                units={state.units}
                unitConversionBasic={state.unitConversionBasic}
                unitConversionProducts={state.unitConversionProducts}
                fetchMissingData={fetchMissingData}
                onUsedRecipesUpdate={onUsedRecipesUpdate}
              />
            </Container>
          ) : activeTab == EventTabs.shoppingList ? (
            <Container>
              <EventShoppingListPage
                firebase={firebase}
                authUser={authUser}
                menuplan={state.menuplan}
                event={state.event}
                products={state.products}
                materials={state.materials}
                units={state.units}
                departments={state.departments}
                recipes={state.recipes}
                unitConversionBasic={state.unitConversionBasic}
                unitConversionProducts={state.unitConversionProducts}
                shoppingListCollection={state.shoppingListCollection}
                shoppingList={state.shoppingList.value}
                fetchMissingData={fetchMissingData}
                onShoppingListUpdate={onShoppingListUpdate}
                onShoppingCollectionUpdate={onShoppingCollectionUpdate}
                // onMasterdataCreate={onMasterdataCreate}
              />
            </Container>
          ) : activeTab == EventTabs.materialList ? (
            <Container>
              <EventMaterialListPage
                firebase={firebase}
                authUser={authUser}
                materialList={state.materialList}
                event={state.event}
                groupConfiguration={state.groupConfig}
                menuplan={state.menuplan}
                materials={state.materials}
                recipes={state.recipes}
                unitConversionBasic={state.unitConversionBasic}
                unitConversionProducts={state.unitConversionProducts}
                fetchMissingData={fetchMissingData}
                onMaterialListUpdate={onMaterialListUpdate}
                onMasterdataCreate={onMasterdataCreate}
              />
            </Container>
          ) : (
            <Container>
              <Stack spacing={2}>
                <EventInfoPage
                  event={eventDraft.event}
                  localPicture={eventDraft.localPicture}
                  formValidation={eventDraft.formValidation}
                  firebase={firebase}
                  database={database}
                  authUser={authUser}
                  onUpdateEvent={onEventUpdate}
                  onUpdatePicture={onEventPictureUpdate}
                  onFormValidationUpdate={onFormValidationUpdate}
                />
                {state.event != eventDraft.event && (
                  <Box
                    component="div"
                    sx={{
                      display: "flex",
                      justifyContent: {xs: "stretch", sm: "flex-end"},
                      flexDirection: {xs: "column", sm: "row"},
                      alignItems: {xs: "stretch", sm: "center"},
                      gap: 2,
                    }}
                  >
                    <Button
                      sx={classes.deleteButton}
                      variant="outlined"
                      onClick={onEventDelete}
                      fullWidth
                    >
                      {TEXT_DELETE_EVENT}
                    </Button>

                    <Button
                      variant="outlined"
                      color="primary"
                      fullWidth
                      onClick={onEventConsistencyCheck}
                    >
                      {TEXT_CONSISTENCY_CHECK}
                    </Button>

                    <Button
                      variant="outlined"
                      color="primary"
                      onClick={onEventDiscardChanges}
                      fullWidth
                    >
                      {TEXT_DISCARD_CHANGES}
                    </Button>

                    <Button
                      variant="contained"
                      color="primary"
                      onClick={onEventSaveChanges}
                      fullWidth
                    >
                      {TEXT_SAVE}
                    </Button>
                  </Box>
                )}
              </Stack>
            </Container>
          )}
        </React.Fragment>
      )}
      <CustomSnackbar
        message={state.snackbar.message}
        severity={state.snackbar.severity}
        snackbarOpen={state.snackbar.open}
        handleClose={handleSnackbarClose}
      />
    </React.Fragment>
  );
};

export default EventPage;
