import React, {
  useState,
  useRef,
  useEffect,
  useContext,
  useReducer,
  createContext,
  useCallback,
  useMemo,
} from "react";

import {useNavigate} from "react-router";
import * as Sentry from "@sentry/react";
import {trackEvent} from "../Analytics/analyticsService";
import {AnalyticsEvent} from "../Analytics/analyticsEvents";
import {useTheme} from "@mui/material/styles";
import useMediaQuery from "@mui/material/useMediaQuery";

import Recipe, {
  Ingredient,
  IngredientProduct,
  PreparationStep,
  RecipeMaterialPosition,
  RecipeProduct,
  // Section,
  MenuType,
  RecipeType,
  PositionType,
  Section,
  RecipeObjectStructure,
} from "./recipe.class";
import {OnUpdateRecipeProps, RecipeDivider, SwitchEditMode} from "./recipe";

import {
  Backdrop,
  CircularProgress,
  Container,
  TextField,
  Typography,
  Tooltip,
  GridSize,
  Card,
  CardContent,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemSecondaryAction,
  InputAdornment,
  Chip,
  IconButton,
  Switch,
  Menu,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
  Checkbox,
  Link,
  Box,
  SelectChangeEvent,
  OutlinedInput,
  Divider,
  SnackbarCloseReason,
  Alert,
  AlertColor,
} from "@mui/material";
import Grid from "@mui/material/Grid";

import {AutocompleteChangeReason} from "@mui/material/Autocomplete";

import AddIcon from "@mui/icons-material/Add";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import ViewDayIcon from "@mui/icons-material/ViewDay";
import DeleteIcon from "@mui/icons-material/Delete";
import {
  ArrowUpward as ArrowUpwardIcon,
  ArrowDownward as ArrowDownwardIcon,
} from "@mui/icons-material";
import {CustomSnackbar, SnackbarState} from "../Shared/customSnackbar";
import {ButtonRow} from "../Shared/buttonRow";
import {FormListItem} from "../Shared/formListItem";
import {ProductAutocomplete} from "../Product/productAutocomplete";
import {
  DialogProduct,
  PRODUCT_POP_UP_VALUES_INITIAL_STATE,
  ProductDialog,
} from "../Product/dialogProduct";
import {
  MATERIAL_POP_UP_VALUES_INITIAL_STATE,
  MaterialDialog,
} from "../Material/dialogMaterial";
import {UnitAutocomplete} from "../Unit/unitAutocomplete";
import {MaterialAutocomplete} from "../Material/materialAutocomplete";

import {useCustomStyles} from "../../constants/styles";
import {Action} from "../../constants/actions";

import {Product} from "../Product/product.types";
import {Unit, UnitDimension} from "../Unit/unit.class";
import {Utils} from "../Shared/utils.class";
import Department from "../Department/department.class";
import {AlertMessage} from "../Shared/AlertMessage";

import {ImageRepository} from "../../constants/imageRepository";
import * as TEXT from "../../constants/text";
import * as ROUTES from "../../constants/routes";

import AuthUser from "../Firebase/Authentication/authUser.class";
import {useDatabase} from "../Database/DatabaseContext";
import type {RecipeDomain, RecipeShortDomain} from "../Database/Repository/RecipeRepository";
import {DialogTagAdd} from "./recipe.view";
import {Material} from "../Material/material.types";
import {DialogMaterial} from "../Material/dialogMaterial";
import {
  RecipeInfoPanel as RecipeInfoPanelView,
  MealPlanPanel as MealPlanPanelView,
} from "./recipe.view";
import {EventGroupConfiguration} from "../Event/GroupConfiguration/groupConfiguration.class";
import {PlanedMealsRecipe} from "../Event/Menuplan/menuplan.types";
import {DialogType, useCustomDialog} from "../Shared/customDialogContext";
import {
  attachClosestEdge,
  type Edge,
  extractClosestEdge,
} from "@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge";
import {DropIndicator} from "@atlaskit/pragmatic-drag-and-drop-react-drop-indicator/box";
import invariant from "tiny-invariant";
import {combine} from "@atlaskit/pragmatic-drag-and-drop/combine";
import {
  draggable,
  dropTargetForElements,
  monitorForElements,
} from "@atlaskit/pragmatic-drag-and-drop/element/adapter";
import {reorder} from "@atlaskit/pragmatic-drag-and-drop/reorder";
import {triggerPostMoveFlash} from "@atlaskit/pragmatic-drag-and-drop-flourish/trigger-post-move-flash";
import {getReorderDestinationIndex} from "@atlaskit/pragmatic-drag-and-drop-hitbox/util/get-reorder-destination-index";
import mergeRefs from "@atlaskit/ds-lib/merge-refs";

import {
  DraggableState,
  idleState,
  draggingState,
  ListContextValue,
  ItemEntry,
  LastCardMoved,
} from "../../constants/dragAndDrop";
import Fuse, {FuseResult} from "fuse.js";

import {
  NavigationValuesContext,
  NavigationObject,
} from "../Navigation/NavigationContext";
import {HELPCENTER_URL} from "../../constants/defaultValues";
/* ===================================================================
// ======================== globale Funktionen =======================
// =================================================================== */
enum ReducerActions {
  SET_RECIPE = "SET_RECIPE",
  UNITS_FETCH_INIT = "UNITS_FETCH_INIT",
  UNITS_FETCH_SUCCESS = "UNITS_FETCH_SUCCESS",
  PRODUCTS_FETCH_INIT = "PRODUCTS_FETCH_INIT",
  PRODUCTS_FETCH_SUCCESS = "PRODUCTS_FETCH_SUCCESS",
  DEPARTMENTS_FETCH_INIT = "DEPARTMENTS_FETCH_INIT",
  DEPARTMENTS_FETCH_SUCCESS = "DEPARTMENTS_FETCH_SUCCESS",
  MATERIALS_FETCH_INIT = "MATERIALS_FETCH_INIT",
  MATERIALS_FETCH_SUCCESS = "MATERIALS_FETCH_SUCCESS",
  PUBLIC_RECIPES_FETCH_INIT = "PUBLIC_RECIPES_FETCH_INIT",
  PUBLIC_RECIPES_FETCH_SUCCESS = "PUBLIC_RECIPES_FETCH_SUCCESS",
  DRAG_AND_DROP_UDPATE = "DRAG_AND_DROP_UDPATE",
  ON_FIELD_CHANGE = "ON_FIELD_CHANGE",
  ON_INGREDIENT_CHANGE = "ON_INGREDIENT_CHANGE",
  ON_INGREDIENT_ADD_NEW_PRODUCT = "ON_INGREDIENT_ADD_NEW_PRODUCT",
  ON_INGREDIENT_DELETE_NAME = "ON_INGREDIENT_DELETE_NAME",
  ON_MATERIAL_CHANGE = "ON_MATERIAL_CHANGE",
  ON_MATERIAL_DELETE_NAME = "ON_MATERIAL_DELETE_NAME",
  ON_MATERIAL_ADD_NEW_PRODUCT = "ON_MATERIAL_ADD_NEW_PRODUCT",
  ON_PREPARATIONSTEP_CHANGE = "ON_PREPARATIONSTEP_CHANGE",
  ON_UPDATE_LIST = "ON_UPDATE_LIST",
  GENERIC_ERROR = "GENERIC_ERROR",
  SNACKBAR_CLOSE = "SNACKBAR_CLOSE",
  SNACKBAR_SHOW = "SNACKBAR_SHOW",
  CLEAR_STATE = "CLEAR_STATE",
}

type DispatchAction =
  | {type: ReducerActions.SET_RECIPE; payload: {recipe: Recipe}}
  | {
      type: ReducerActions.ON_FIELD_CHANGE;
      payload: {
        field: string;
        value: string | number | boolean | string[] | MenuType[];
      };
    }
  | {
      type: ReducerActions.ON_INGREDIENT_CHANGE;
      payload: {
        uid: string;
        field: string;
        value: string | number | IngredientProduct;
      };
    }
  | {type: ReducerActions.ON_INGREDIENT_DELETE_NAME; payload: {uid: string}}
  | {type: ReducerActions.ON_INGREDIENT_ADD_NEW_PRODUCT; payload: Product}
  | {
      type: ReducerActions.ON_MATERIAL_CHANGE;
      payload: {
        uid: string;
        field: string;
        value: string | number | RecipeProduct;
      };
    }
  | {type: ReducerActions.ON_MATERIAL_DELETE_NAME; payload: {uid: string}}
  | {type: ReducerActions.ON_MATERIAL_ADD_NEW_PRODUCT; payload: Material}
  | {
      type: ReducerActions.ON_PREPARATIONSTEP_CHANGE;
      payload: {uid: string; fieldName: string; value: string};
    }
  | {
      type: ReducerActions.ON_UPDATE_LIST;
      payload: {
        fieldName: string;
        value:
          | RecipeObjectStructure<Ingredient | Section>
          | RecipeObjectStructure<PreparationStep | Section>
          | RecipeObjectStructure<RecipeMaterialPosition | Section>;
      };
    }
  | {
      type: ReducerActions.DRAG_AND_DROP_UDPATE;
      payload: {field: DragDropTypes; value: string[]};
    }
  | {type: ReducerActions.UNITS_FETCH_INIT}
  | {type: ReducerActions.UNITS_FETCH_SUCCESS; payload: Unit[]}
  | {type: ReducerActions.PRODUCTS_FETCH_INIT}
  | {type: ReducerActions.PRODUCTS_FETCH_SUCCESS; payload: Product[]}
  | {type: ReducerActions.DEPARTMENTS_FETCH_INIT}
  | {type: ReducerActions.DEPARTMENTS_FETCH_SUCCESS; payload: Department[]}
  | {type: ReducerActions.MATERIALS_FETCH_INIT}
  | {type: ReducerActions.MATERIALS_FETCH_SUCCESS; payload: Material[]}
  | {type: ReducerActions.PUBLIC_RECIPES_FETCH_INIT}
  | {type: ReducerActions.PUBLIC_RECIPES_FETCH_SUCCESS; payload: RecipeShortDomain[]}
  | {
      type: ReducerActions.SNACKBAR_SHOW;
      payload: {severity: AlertColor; message: string};
    }
  | {type: ReducerActions.SNACKBAR_CLOSE}
  | {type: ReducerActions.GENERIC_ERROR; payload: Error}
  | {type: ReducerActions.CLEAR_STATE; payload: State};
type State = {
  recipe: Recipe;
  units: Unit[];
  products: Product[];
  departments: Department[];
  materials: Material[];
  publicRecipes: RecipeShortDomain[];
  error: Error | null;
  snackbar: SnackbarState;
  loadCollector: {
    units: boolean;
    products: boolean;
    departments: boolean;
    materials: boolean;
    publicRecipes: boolean;
  };
};

const inititialState: State = {
  recipe: new Recipe(),
  units: [],
  products: [],
  departments: [],
  materials: [],
  publicRecipes: [],
  error: null,
  snackbar: {open: false, severity: "success", message: ""},
  loadCollector: {
    units: false,
    products: false,
    departments: false,
    materials: false,
    publicRecipes: false,
  },
};
enum DragDropTypes {
  INGREDIENT = "ingredients",
  PREPARATIONSTEP = "preparationSteps",
  MATERIAL = "materials",
}

enum RecipeBlock {
  none = "none",
  ingredients = "ingredients",
  prepartionSteps = "preparationSteps",
  materials = "materials",
}
type RecipeBlockNotNone = Exclude<RecipeBlock, RecipeBlock.none>;

const recipesReducer = (state: State, action: DispatchAction): State => {
  let updatedMaterials: Recipe["materials"];
  let tmpIngredients: Recipe["ingredients"];
  let tempProducts: Product[];
  let tempProduct: Product | undefined;
  let preparationStepsToUpdate: Recipe["preparationSteps"];
  let tmpMaterials: Recipe["materials"];
  let materials: Material[];
  let material: Material | undefined;
  switch (action.type) {
    case ReducerActions.SET_RECIPE:
      return {...state, recipe: action.payload.recipe};
    case ReducerActions.ON_FIELD_CHANGE: {
      let field: string;
      let value:
        | string
        | number
        | boolean
        | string[]
        | MenuType[]
        | Record<string, unknown>;
      if (action.payload.field.includes(".")) {
        //ATTENTION:
        // Verschachtelter Wert --> Attribut holen
        // --> Name vor dem Punkt und Wert setzen
        // 💥 Achtung! Funktioniert nur mit einer Verschachtelungs-
        //             tiefe von 1.
        field = action.payload.field.split(".")[0];
        const nested = Object.assign(
          {},
          state.recipe[field as keyof Recipe],
        ) as Record<string, unknown>;
        nested[action.payload.field.split(".")[1]] = action.payload.value;
        value = nested;
      } else {
        field = action.payload.field;
        value = action.payload.value;
      }
      return {
        ...state,
        recipe: {
          ...state.recipe,
          [field]: value,
        },
      };
    }
    case ReducerActions.ON_INGREDIENT_CHANGE:
      tmpIngredients = {...state.recipe.ingredients};
      (
        tmpIngredients.entries[action.payload.uid] as unknown as Record<
          string,
          string | number | IngredientProduct
        >
      )[action.payload.field] = action.payload.value;

      // Prüfen ob es das Produkt in der Liste gibt. Sonst hizufügen
      // Wenn das die letzte Zutat (also kein Abschnitt) ist, automatisch eine neue einfügen
      if (
        action.payload.uid ==
        tmpIngredients.order.reduce((result, ingredientUid) => {
          // Über Reduce die letzte Zutat holen
          if (
            state.recipe.ingredients.entries[ingredientUid].posType ==
            PositionType.ingredient
          ) {
            // UID zurückggeben
            return ingredientUid;
          }
          return result;
        }, "")
      ) {
        const newObject = Recipe.createEmptyIngredient();
        tmpIngredients.entries[newObject.uid] = newObject;
        tmpIngredients.order.push(newObject.uid);
      }

      return {
        ...state,
        recipe: {
          ...state.recipe,
          ingredients: tmpIngredients,
        },
      };
    case ReducerActions.ON_INGREDIENT_DELETE_NAME:
      tmpIngredients = state.recipe.ingredients;

      Object.values(tmpIngredients.entries).forEach((ingredient) => {
        ingredient = ingredient as Ingredient;
        if (ingredient.uid === action.payload.uid) {
          ingredient.product.name = "";
          ingredient.product.uid = "";
        }
      });

      return {
        ...state,
        recipe: {
          ...state.recipe,
          ingredients: tmpIngredients,
        },
      };
    case ReducerActions.ON_INGREDIENT_ADD_NEW_PRODUCT:
      // Das neue Produkt in Produkte speichern (für Dropdown)
      tempProducts = state.products;
      tempProduct = tempProducts.find(
        (product) => product.uid === action.payload.uid,
      );
      // Wenn es das schon gibt, nichts tun
      if (!tempProduct) {
        tempProducts.push(action.payload);
      }
      return {
        ...state,
        products: tempProducts,
      };
    case ReducerActions.ON_UPDATE_LIST:
      // Zutaten, Zubereitungsschritte oder Material updaten
      return {
        ...state,
        recipe: {
          ...state.recipe,
          [action.payload.fieldName]: action.payload.value,
        },
      };
    case ReducerActions.ON_PREPARATIONSTEP_CHANGE:
      preparationStepsToUpdate = {...state.recipe.preparationSteps};

      (
        preparationStepsToUpdate.entries[
          action.payload.uid
        ] as unknown as Record<string, string>
      )[action.payload.fieldName] = action.payload.value;
      // Wenn das die letzte Zeile ist, automatisch eine neue einfügen
      // Wenn das die letzte Zutat (also kein Abschnitt) ist, automatisch eine neue einfügen
      if (
        action.payload.uid ==
        preparationStepsToUpdate.order.reduce((result, preparationStepUid) => {
          // Über Reduce die letzte Zutat holen
          if (
            state.recipe.preparationSteps.entries[preparationStepUid].posType ==
            PositionType.preparationStep
          ) {
            // UID zurückggeben
            return preparationStepUid;
          }
          return result;
        }, "")
      ) {
        const newObject = Recipe.createEmptyPreparationStep();

        preparationStepsToUpdate.entries[newObject.uid] = newObject;
        preparationStepsToUpdate.order.push(newObject.uid);
      }
      return {
        ...state,
        recipe: {
          ...state.recipe,
          preparationSteps: preparationStepsToUpdate,
        },
      };
    case ReducerActions.ON_MATERIAL_CHANGE:
      tmpMaterials = {...state.recipe.materials};

      (
        tmpMaterials.entries[action.payload.uid] as unknown as Record<
          string,
          string | number | RecipeProduct
        >
      )[action.payload.field] = action.payload.value;

      // Wenn das die letzte Zeile ist, automatisch eine neue einfügen
      if (
        action.payload.uid ===
        state.recipe.materials.order[state.recipe.materials.order.length - 1]
      ) {
        const newObject = Recipe.createEmptyMaterial();
        tmpMaterials.entries[newObject.uid] = newObject;
        tmpMaterials.order.push(newObject.uid);
      }

      return {
        ...state,
        recipe: {
          ...state.recipe,
          materials: tmpMaterials,
        },
      };
    case ReducerActions.ON_MATERIAL_DELETE_NAME:
      updatedMaterials = {...state.recipe.materials};

      Object.values(updatedMaterials.entries).forEach((material) => {
        if (material.uid === action.payload.uid) {
          material.material.name = "";
          material.material.uid = "";
        }
      });

      return {
        ...state,
        recipe: {
          ...state.recipe,
          materials: updatedMaterials,
        },
      };
    case ReducerActions.ON_MATERIAL_ADD_NEW_PRODUCT:
      // Das neue Material in Produkte speichern (für Dropdown)
      materials = state.materials;
      material = materials.find(
        (material) => material.uid === action.payload.uid,
      );
      // Wenn es das schon gibt, nichts tun
      if (!material) {
        materials.push(action.payload);
      }
      return {
        ...state,
        materials: materials,
      };
    case ReducerActions.UNITS_FETCH_INIT:
      return {
        ...state,
        loadCollector: {
          ...state.loadCollector,
          units: true,
        },
      };
    case ReducerActions.UNITS_FETCH_SUCCESS:
      return {
        ...state,
        units: action.payload,
        loadCollector: {
          ...state.loadCollector,
          units: false,
        },
      };
    case ReducerActions.PRODUCTS_FETCH_INIT:
      return {
        ...state,
        loadCollector: {
          ...state.loadCollector,
          products: true,
        },
      };
    case ReducerActions.PRODUCTS_FETCH_SUCCESS: {
      const loadedProducts = action.payload;
      return {
        ...state,
        products: loadedProducts,
        loadCollector: {
          ...state.loadCollector,
          products: false,
        },
      };
    }
    case ReducerActions.DEPARTMENTS_FETCH_INIT:
      return {
        ...state,
        loadCollector: {
          ...state.loadCollector,
          departments: true,
        },
      };
    case ReducerActions.DEPARTMENTS_FETCH_SUCCESS:
      return {
        ...state,
        departments: action.payload,
        loadCollector: {
          ...state.loadCollector,
          departments: false,
        },
      };
    case ReducerActions.MATERIALS_FETCH_INIT:
      return {
        ...state,
        loadCollector: {
          ...state.loadCollector,
          materials: true,
        },
      };
    case ReducerActions.MATERIALS_FETCH_SUCCESS:
      return {
        ...state,
        materials: action.payload,
        loadCollector: {
          ...state.loadCollector,
          materials: false,
        },
      };
    case ReducerActions.PUBLIC_RECIPES_FETCH_INIT:
      return {
        ...state,
        loadCollector: {
          ...state.loadCollector,
          publicRecipes: true,
        },
      };
    case ReducerActions.PUBLIC_RECIPES_FETCH_SUCCESS:
      return {
        ...state,
        publicRecipes: action.payload,
        loadCollector: {
          ...state.loadCollector,
          publicRecipes: false,
        },
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
    case ReducerActions.DRAG_AND_DROP_UDPATE:
      return {
        ...state,
        recipe: {
          ...state.recipe,
          [action.payload.field]: {
            ...state.recipe[action.payload.field],
            order: action.payload.value,
          },
        },
      };
    case ReducerActions.GENERIC_ERROR:
      return {
        ...state,
        loadCollector: {
          units: false,
          products: false,
          departments: false,
          materials: false,
          publicRecipes: false,
        },
        error: action.payload,
      };
    case ReducerActions.CLEAR_STATE:
      // Hiermiet wird alles gelöscht!
      return action.payload;
    default: {
      const _exhaustiveCheck: never = action;
      throw new Error(`Unbekannter ActionType: ${_exhaustiveCheck}`);
    }
  }
};
const PreparationListContext = createContext<ListContextValue | null>(null);
const IngredientListContext = createContext<ListContextValue | null>(null);
const MaterialListContext = createContext<ListContextValue | null>(null);

function usePreparationListContext() {
  const listContext = useContext(PreparationListContext);
  invariant(listContext !== null);
  return listContext;
}
function useIngredientListContext() {
  const listContext = useContext(IngredientListContext);
  invariant(listContext !== null);
  return listContext;
}

function useMaterialListContext() {
  const listContext = useContext(MaterialListContext);
  invariant(listContext !== null);
  return listContext;
}
const itemKey = Symbol("item");
type ItemData<Item> = {
  [itemKey]: true;
  item: Item;
  index: number;
  instanceId: symbol;
};

function getItemData<Item>({
  item,
  index,
  instanceId,
}: {
  item: Item;
  index: number;
  instanceId: symbol;
}): ItemData<Item> {
  return {
    [itemKey]: true,
    item,
    index,
    instanceId,
  };
}

function isItemData<T>(
  data: Record<string | symbol, unknown>,
): data is ItemData<T> {
  return data[itemKey] === true;
}
function getItemRegistry() {
  const registry = new Map<string, HTMLElement>();

  function register({itemUiId, element}: ItemEntry) {
    registry.set(itemUiId, element);

    return function unregister() {
      registry.delete(itemUiId);
    };
  }

  function getElement(itemId: string): HTMLElement | null {
    return registry.get(itemId) ?? null;
  }

  return {register, getElement};
}

interface ColumnSizeTypes {
  xs: GridSize;
  sm: GridSize;
}
interface GridSizeColums {
  pos: ColumnSizeTypes;
  quantity: ColumnSizeTypes;
  unit: ColumnSizeTypes;
  scalingFactor: ColumnSizeTypes;
  product: ColumnSizeTypes;
  detail: ColumnSizeTypes;
}
interface ColumnSizes {
  ScaleFactorOff: GridSizeColums;
  ScaleFactorOn: GridSizeColums;
}
const GRIDSIZE_COLUMNS: ColumnSizes = {
  ScaleFactorOff: {
    pos: {xs: 0, sm: 1},
    quantity: {xs: 7, sm: 2},
    unit: {xs: 5, sm: 2},
    scalingFactor: {xs: 0, sm: 0},
    product: {xs: 7, sm: 4},
    detail: {xs: 5, sm: 3},
  },
  ScaleFactorOn: {
    pos: {xs: 0, sm: 1},
    quantity: {xs: 5, sm: 2},
    unit: {xs: 5, sm: 1},
    scalingFactor: {xs: 2, sm: 1},
    product: {xs: 7, sm: 4},
    detail: {xs: 5, sm: 3},
  },
};
/* ===================================================================
// ========================== Ändern-Sicht ===========================
// =================================================================== */
interface RecipeEditProps {
  dbRecipe: Recipe;
  mealPlan: Array<PlanedMealsRecipe>;
  groupConfiguration?: EventGroupConfiguration;
  isLoading: boolean;
  isEmbedded: boolean; // in einer Drawer eingebetettet, oder so...
  switchEditMode?: ({ignoreState}: SwitchEditMode) => void;
  onUpdateRecipe: ({recipe, snackbar}: OnUpdateRecipeProps) => void;
  authUser: AuthUser;
}
interface PositionMenuSelectedItem {
  type: RecipeBlock; // In welchem Abschnitt wurde das Menü geöffnet
  uid: string; // UID des Eintrages
  firstElement: boolean;
  lastElement: boolean;
}
/**
 * Bearbeitungsansicht für ein Rezept. Ermöglicht das Erstellen und Bearbeiten
 * von Rezepten inkl. Zutaten, Zubereitungsschritte, Materialien und Varianten.
 * Wird sowohl als eigenständige Seite als auch eingebettet in einem Drawer verwendet.
 *
 * @param dbRecipe Das Rezept-Objekt aus der Datenbank.
 * @param mealPlan Array der geplanten Mahlzeiten, in denen das Rezept vorkommt.
 * @param groupConfiguration Optionale Gruppenkonfiguration des Events.
 * @param isLoading Ob die Daten noch geladen werden.
 * @param isEmbedded Ob die Komponente in einem Drawer eingebettet ist.
 * @param switchEditMode Callback zum Wechseln zwischen Ansichts- und Bearbeitungsmodus.
 * @param onUpdateRecipe Callback zum Aktualisieren des Rezepts im übergeordneten State.
 * @param authUser Der aktuell angemeldete Benutzer.
 */
const RecipeEdit = ({
  dbRecipe,
  mealPlan,
  groupConfiguration,
  isLoading,
  isEmbedded,
  switchEditMode,
  onUpdateRecipe,
  authUser,
}: RecipeEditProps) => {
  const classes = useCustomStyles();
  const database = useDatabase();
  const navigate = useNavigate();

  const navigationValuesContext = useContext(NavigationValuesContext);

  const [state, dispatch] = useReducer(recipesReducer, inititialState);
  const [tagAddDialogOpen, setTagAddDialogOpen] = useState(false);
  const [triggeredIngredientUid, setTriggeredIngredientUid] = useState("");
  const [positionMenuSelectedItem, setPositionMenuSelectedItem] =
    useState<PositionMenuSelectedItem>({
      type: RecipeBlock.none,
      uid: "",
      firstElement: false,
      lastElement: false,
    });
  const [positionMenuAnchorElement, setPositionMenuAnchorElement] =
    useState<HTMLElement | null>(null);
  const [productAddPopupValues, setProductAddPopupValues] = useState({
    ...PRODUCT_POP_UP_VALUES_INITIAL_STATE,
    ...{popUpOpen: false},
  });
  const [triggeredMaterialUid, setTriggeredMaterialUid] = useState("");
  const [materialAddPopupValues, setMaterialAddPopupValues] = useState({
    ...MATERIAL_POP_UP_VALUES_INITIAL_STATE,
    ...{popUpOpen: false},
  });
  const [possibleDuplicateRecipes, setPossibleDuplicateRecipes] = useState<
    FuseResult<RecipeShortDomain>[]
  >([]);

  const {customDialog} = useCustomDialog();
  if (!state.recipe.name && dbRecipe.name && !isEmbedded) {
    document.title = dbRecipe.name;
  } else if (!isEmbedded) {
    document.title = state.recipe.name;
  }

  /* ------------------------------------------
  // Navigation-Handler
  // ------------------------------------------ */
  useEffect(() => {
    navigationValuesContext?.setNavigationValues({
      action: Action.EDIT,
      object: NavigationObject.usedRecipes,
    });
  }, []);
  /* ------------------------------------------
  // Rezept, dass übergeben wurde in eigenen State speichern
  // ------------------------------------------ */
  useEffect(() => {
    dispatch({
      type: ReducerActions.SET_RECIPE,
      payload: {
        recipe: dbRecipe,
      },
    });
  }, []);
  /* ------------------------------------------
  // Daten aus der DB lesen
  // ------------------------------------------ */
  useEffect(() => {
    if (state.units.length === 0) {
      dispatch({
        type: ReducerActions.UNITS_FETCH_INIT,
      });

      database.units
        .getAllUnits()
        .then((result) => {
          // leeres Feld gehört auch dazu
          result.push({
            key: "",
            name: "",
            dimension: UnitDimension.dimensionless,
          });

          dispatch({
            type: ReducerActions.UNITS_FETCH_SUCCESS,
            payload: result as unknown as Unit[],
          });
        })
        .catch((error) => {
          Sentry.captureException(error, {extra: {context: "RecipeEdit – Einheiten laden"}});
          dispatch({
            type: ReducerActions.GENERIC_ERROR,
            payload: error,
          });
        });
    }
    if (state.products.length === 0) {
      dispatch({
        type: ReducerActions.PRODUCTS_FETCH_INIT,
      });
      // Produkte aus Supabase laden (enthält Postgres-UUIDs, passend zu recipe_ingredients.product_id)
      database.products
        .getAllProducts({onlyUsable: true})
        .then((result) => {
          dispatch({
            type: ReducerActions.PRODUCTS_FETCH_SUCCESS,
            payload: result as unknown as Product[],
          });
        })
        .catch((error) => {
          Sentry.captureException(error, {extra: {context: "RecipeEdit – Produkte laden"}});
          dispatch({
            type: ReducerActions.GENERIC_ERROR,
            payload: error,
          });
        });
    }
    if (state.departments.length === 0) {
      dispatch({
        type: ReducerActions.DEPARTMENTS_FETCH_INIT,
      });
      // Abteilungen aus Supabase laden (Postgres-UUIDs, passend zu products.department_id)
      database.departments
        .getAllDepartments()
        .then((result) => {
          dispatch({
            type: ReducerActions.DEPARTMENTS_FETCH_SUCCESS,
            payload: result as unknown as Department[],
          });
        })
        .catch((error) => {
          Sentry.captureException(error, {extra: {context: "RecipeEdit – Abteilungen laden"}});
          dispatch({
            type: ReducerActions.GENERIC_ERROR,
            payload: error,
          });
        });
    }
    if (state.materials.length === 0) {
      dispatch({
        type: ReducerActions.MATERIALS_FETCH_INIT,
      });
      // Materialien aus Supabase laden (Postgres-UUIDs, passend zu recipe_materials.material_id)
      database.materials
        .getAllMaterials(true)
        .then((result) => {
          dispatch({
            type: ReducerActions.MATERIALS_FETCH_SUCCESS,
            payload: result as unknown as Material[],
          });
        })
        .catch((error) => {
          Sentry.captureException(error, {extra: {context: "RecipeEdit – Materialien laden"}});
          dispatch({
            type: ReducerActions.GENERIC_ERROR,
            payload: error,
          });
        });
    }
    if (state.publicRecipes.length === 0) {
      dispatch({
        type: ReducerActions.PUBLIC_RECIPES_FETCH_INIT,
      });
      database.recipes
        .getAllPublicRecipeShorts()
        .then((result) => {
          dispatch({
            type: ReducerActions.PUBLIC_RECIPES_FETCH_SUCCESS,
            payload: result,
          });
        })
        .catch((error) => {
          Sentry.captureException(error, {extra: {context: "RecipeEdit – Öffentliche Rezepte laden"}});
          dispatch({
            type: ReducerActions.GENERIC_ERROR,
            payload: error,
          });
        });
    }
  }, []);
  /* ------------------------------------------
  // Feldwert ändern - onChange
  // ------------------------------------------ */
  const onChangeField = (
    event: SelectChangeEvent<MenuType[]> | React.ChangeEvent<HTMLInputElement>,
  ) => {
    let value: string | boolean | MenuType[];

    if (
      event.target instanceof HTMLInputElement &&
      event.target.name === "outdoorKitchenSuitable"
    ) {
      value = event.target.checked;
    } else if (
      Array.isArray(event.target.value) &&
      event.target.name === "menuTypes"
    ) {
      let selectedMenuTypes: MenuType[] = (
        event.target.value as unknown as string[]
      ).map((value: string) => parseInt(value));

      let newValue: MenuType;
      // Der Wert wird als String zurückgegeben, wir speichern ihn aber als Number
      // Wenn das Array nun zwei mal den gleichen Wert hat (als String und als Number)
      // müssen beide Werte entfernt werden --> Checkbox deselektiert.
      // der Neuste Wert ist immer der letzte im Array. Nach diesem kann gesucht werden
      if (selectedMenuTypes.length > 0) {
        newValue = selectedMenuTypes.slice(-1)[0];
      }

      if (selectedMenuTypes.filter((value) => value == newValue).length > 1) {
        // Mehrere Einträge... alles löschen was dem neuen Wert entspricht
        selectedMenuTypes = selectedMenuTypes.filter(
          (value) => value != newValue,
        );
      }

      value = selectedMenuTypes;
      value.sort();
    } else {
      value = event.target.value as string;
    }
    dispatch({
      type: ReducerActions.ON_FIELD_CHANGE,
      payload: {
        field: event.target.name,
        value: value,
      },
    });
  };
  // Prüfen ob es das Rezept bereits gibt
  const onBlurRecipeName = (event: React.FocusEvent<HTMLInputElement>) => {
    // Die Prüfung macht nur Sinn, wenn es sich um ein neues Rezept handelt
    if (state.recipe.uid) {
      return;
    }

    const newRecipeName = event.target.value;

    const fuseOptions = {
      // isCaseSensitive: false,
      // includeScore: false,
      // ignoreDiacritics: false,
      // shouldSort: true,
      // includeMatches: false,
      // findAllMatches: false,
      // minMatchCharLength: 1,
      // location: 0,
      threshold: 0.5,
      // distance: 100,
      // useExtendedSearch: false,
      // ignoreLocation: false,
      // ignoreFieldNorm: false,
      // fieldNormWeight: 1,
      keys: ["name"],
    };

    const fuse = new Fuse(state.publicRecipes, fuseOptions);
    setPossibleDuplicateRecipes(fuse.search(newRecipeName));
  };
  const onChangeIngredient = (
    event?: React.ChangeEvent<HTMLInputElement>,
    newValue?: string | Unit | Product | null,
    action?: AutocompleteChangeReason,
    objectId?: string,
  ) => {
    let ingredientPos: string[];
    let product: Product;

    // objectId bevorzugen: Autocomplete-Components setzen es explizit auf
    // "<field>_<UUID>". event.target.id enthält bei Autocompletes die
    // Option-Listen-ID (z.B. "product_<UUID>-option-0") — unzuverlässig.
    const sourceId = objectId ?? event?.target.id;
    if (!sourceId && action !== "clear") {
      return;
    }
    if (!sourceId) {
      return;
    }
    ingredientPos = sourceId.split("_");

    const fieldName = ingredientPos[0];
    const ingredientUid = ingredientPos[1];

    let value: string | IngredientProduct;
    if (
      (action === "selectOption" || action === "blur") &&
      objectId?.startsWith("product_") &&
      typeof newValue == "object"
    ) {
      // Prüfen ob neues Produkt angelegt wird
      product = newValue as Product;
      if (product.name.endsWith(TEXT.ADD)) {
        // Begriff Hinzufügen und Anführzungszeichen entfernen
        const productName = product.name.match('".*"')![0].slice(1, -1);

        // Neues Produkt. PopUp Anzeigen und nicht weiter
        setProductAddPopupValues({
          ...productAddPopupValues,
          name: productName,
          popUpOpen: true,
        });

        // ID der Position speichern, die das Ereignis
        // auslöst (im Falle eines Abbruchs)
        setTriggeredIngredientUid(ingredientUid);
        return;
      }
    }
    if (fieldName === "unit") {
      // Die Autocomplete Komponente liefert den Event anders zurück
      // hier wird die gewählte Option als -Option# zurückgegeben
      // diese Info muss umgeschlüsselt werden
      if (action !== "clear") {
        value = (newValue as Unit).key;
      } else {
        value = "";
      }
    } else if (fieldName === "product") {
      product = newValue as Product;
      // Nur Produkte, die wir kennen (und somit eine UID haben)
      if (action !== "clear" && (!product || !product.uid)) {
        return;
      }
      if (!newValue) {
        value = {uid: "", name: ""};
      } else {
        value = {uid: product.uid, name: product.name};
      }
    } else {
      value = event?.target.value as string;
    }
    dispatch({
      type: ReducerActions.ON_INGREDIENT_CHANGE,
      payload: {field: fieldName, value: value, uid: ingredientUid},
    });
  };
  const onChangePreparationStep = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const prepparationStepPos = event.target.id.split("_");

    dispatch({
      type: ReducerActions.ON_PREPARATIONSTEP_CHANGE,
      payload: {
        fieldName: prepparationStepPos[0],
        uid: prepparationStepPos[1],
        value: event.target.value,
      },
    });
  };
  const onChangeMaterial = (
    event?: React.ChangeEvent<HTMLInputElement>,
    newValue?: string | Material,
    action?: AutocompleteChangeReason,
    objectId?: string,
  ) => {
    let materialPos: string[];
    let material: Material;

    // objectId bevorzugen: Autocomplete-Components setzen es explizit auf
    // "<field>_<UUID>". event.target.id enthält bei Autocompletes die
    // Option-Listen-ID (z.B. "material_<UUID>-option-0") — unzuverlässig.
    const sourceId = objectId ?? event?.target.id;
    if (!sourceId && action !== "clear") {
      return;
    }
    if (!sourceId) {
      return;
    }
    materialPos = sourceId.split("_");

    const fieldName = materialPos[0];
    const materialUid = materialPos[1];
    let value: string | RecipeProduct;

    if (
      (action === "selectOption" || action === "blur") &&
      objectId?.startsWith("material_")
    ) {
      // Prüfen ob neues Material angelegt wird
      material = newValue as Material;
      if (typeof material === "object" && material?.name.endsWith(TEXT.ADD)) {
        // Begriff Hinzufügen und Anführzungszeichen entfernen
        const materialName = material.name.match('".*"')![0].slice(1, -1);

        // Neues Produkt. PopUp Anzeigen und nicht weiter
        setMaterialAddPopupValues({
          ...materialAddPopupValues,
          name: materialName,
          popUpOpen: true,
        });
        // ID der Position speichern, die das Ereignis
        // auslöst (im Falle eines Abbruchs)
        setTriggeredMaterialUid(materialUid);
        return;
      }
    }
    if (fieldName === "material") {
      material = newValue as Material;
      // Nur Produkte, die wir kennen (und somit eine UID haben)
      if (action !== "clear" && (!material || !material.uid)) {
        return;
      }
      if (!newValue) {
        value = {
          uid: "",
          name: "",
        };
      } else {
        value = {uid: material.uid, name: material.name};
      }
    } else {
      value = event?.target.value as string;
    }
    dispatch({
      type: ReducerActions.ON_MATERIAL_CHANGE,
      payload: {field: fieldName, value: value, uid: materialUid},
    });
  };
  /* ------------------------------------------
  // Snackback 
  // ------------------------------------------ */
  const handleSnackbarClose = (
    _event: Event | React.SyntheticEvent<Element, Event>,
    reason: SnackbarCloseReason,
  ) => {
    if (reason === "clickaway") {
      return;
    }
    dispatch({
      type: ReducerActions.SNACKBAR_CLOSE,
    });
  };
  /* ------------------------------------------
  // Save // Cancel
  // ------------------------------------------ */
  const onSave = async () => {
    if (state.recipe.uid === "") {
      // Wenn nur eine Zutat Hinweis auf Doku
      if (
        Object.values(state.recipe.ingredients.entries).filter(
          (entry) =>
            entry.posType == PositionType.ingredient &&
            (entry as Ingredient).product?.uid !== "",
        ).length == 1
      ) {
        const doSave = await customDialog({
          dialogType: DialogType.Confirm,
          title: TEXT.PRO_TIP,
          text: (
            <Typography>
              {TEXT.PRO_TIP_ADD_ITEM_TO_MENUPLAN}
              <Link
                href={`${HELPCENTER_URL}/docs/event/menueplan/#produkte-und-materialien`}
                target="_blank"
              >
                Anleitung
              </Link>
            </Typography>
          ),
          buttonTextConfirm: "Speichern",
          buttonTextCancel: "Abbrechen",
        });
        // Pro-Tipp:
        if (!doSave) {
          return;
        }
      }
    }

    try {
      Recipe.checkRecipeData(state.recipe);
    } catch (error) {
      Sentry.captureException(error, {extra: {context: "RecipeEdit – Rezeptdaten validieren"}});
      dispatch({
        type: ReducerActions.GENERIC_ERROR,
        payload: error as Error,
      });
      return;
    }
    try {
      const isNew = state.recipe.uid === "";

      // Rezept für das Speichern vorbereiten (Diät-Properties, Bereinigung)
      const preparedRecipe = Recipe.prepareSave({
        recipe: state.recipe,
        products: state.products,
      });

      // In RecipeDomain konvertieren und in der DB speichern
      const domain: RecipeDomain = Recipe.toDomain(preparedRecipe);
      const savedHeader = isNew
        ? await database.recipes.insertRecipe(domain, authUser)
        : await database.recipes.updateRecipe(domain, authUser);

      // Kind-Datensätze (Zutaten, Schritte, Materialien) parallel speichern
      const ingredientRows = Recipe.toIngredientRows(
        preparedRecipe,
        savedHeader.uid,
      );
      const stepRows = Recipe.toPreparationStepRows(
        preparedRecipe,
        savedHeader.uid,
      );
      const materialRows = Recipe.toMaterialRows(
        preparedRecipe,
        savedHeader.uid,
      );
      // saveAllForRecipe gibt die gespeicherten Daten mit aufgelösten
      // Produkt-/Materialnamen zurück — kein separater Reload nötig.
      const [savedIngredients, savedSteps, savedMaterials] = await Promise.all([
        database.recipeIngredients.saveAllForRecipe(
          savedHeader.uid,
          ingredientRows,
          authUser,
        ),
        database.recipePreparationSteps.saveAllForRecipe(
          savedHeader.uid,
          stepRows,
          authUser,
        ),
        database.recipeMaterials.saveAllForRecipe(
          savedHeader.uid,
          materialRows,
          authUser,
        ),
      ]);

      const result = Recipe.fromRepositoryData(
        savedHeader,
        savedIngredients,
        savedSteps,
        savedMaterials,
      );
      if (isNew) {
        const eventName = result.type === RecipeType.variant
          ? AnalyticsEvent.RECIPE_VARIANT_CREATED
          : AnalyticsEvent.RECIPE_CREATED;
        trackEvent(eventName);
      }
      if (isNew && result.type !== RecipeType.variant && !isEmbedded) {
        // ignoreState: true umgeht die Abbruch-Logik in switchEditMode,
        // die bei leerer UID zur Rezeptübersicht navigieren würde.
        if (switchEditMode) {
          switchEditMode({ignoreState: true});
        }
        navigate(`${ROUTES.RECIPE}/${result.uid}`, {
          replace: true,
          state: {action: Action.VIEW, recipe: result},
        });
      } else {
        if (switchEditMode) {
          switchEditMode({});
        }
        // Angepasstes Rezept hochgeben und in den Read-Modus wechseln
        onUpdateRecipe({
          recipe: result,
          snackbar: {
            message: TEXT.RECIPE_SAVE_SUCCESS,
            severity: "success",
            open: true,
          },
        });
        // Meldung auf gleicher Seite anzeigen
        dispatch({
          type: ReducerActions.SNACKBAR_SHOW,
          payload: {severity: "success", message: TEXT.RECIPE_SAVE_SUCCESS},
        });
      }
    } catch (error) {
      Sentry.captureException(error, {extra: {context: "RecipeEdit – Rezept speichern"}});
      dispatch({type: ReducerActions.GENERIC_ERROR, payload: error as Error});
    }
  };
  const onCancel = async () => {
    const isConfirmed = await customDialog({
      dialogType: DialogType.Confirm,
      text: TEXT.CONFIRM_CHANGES_ARE_LOST,
      title: TEXT.UNSAVED_CHANGES,
      buttonTextConfirm: TEXT.DISCARD_CHANGES,
    });
    if (!isConfirmed) {
      return;
    }

    // Clear State!
    dispatch({
      type: ReducerActions.CLEAR_STATE,
      payload: inititialState,
    });
    switchEditMode && switchEditMode({});
  };
  /* ------------------------------------------
  // Tags
  // ------------------------------------------ */
  const onTagAdd = () => {
    setTagAddDialogOpen(true);
  };
  const handleTagAddDialogClose = () => {
    setTagAddDialogOpen(false);
  };
  const handleTagAddDialogAdd = (tags: string[]) => {
    const listOfTags = state.recipe.tags.concat(tags);

    dispatch({
      type: ReducerActions.ON_FIELD_CHANGE,
      payload: {
        field: "tags",
        value: listOfTags,
      },
    });

    setTagAddDialogOpen(false);
  };
  const onTagDelete = (tagToDelete: string) => {
    const listOfTags = Recipe.deleteTag({
      tags: state.recipe.tags,
      tagToDelete: tagToDelete,
    });
    dispatch({
      type: ReducerActions.ON_FIELD_CHANGE,
      payload: {
        field: "tags",
        value: listOfTags,
      },
    });
  };
  /* ------------------------------------------
  // ContextMenü für Postionen
  // ------------------------------------------ */
  const onPositionMoreClick = (event: React.MouseEvent<HTMLElement>) => {
    // Zwischenspeichern bei welchem Element das Menü auf-
    // gerufen wurde
    const pressedButton = event.currentTarget.id.split("_");
    // Button-ID-Aufbau
    // 0 = Name des Buttons (moreClick)
    // 1 = Abschnitt in dem er geklickt wurde (ingredients)
    // 2 = UID der Position

    setPositionMenuSelectedItem({
      type: pressedButton[1] as RecipeBlock,
      uid: pressedButton[2],
      firstElement:
        state.recipe[pressedButton[1] as RecipeBlockNotNone].order[0] ===
        pressedButton[2],
      lastElement:
        state.recipe[pressedButton[1] as RecipeBlockNotNone].order[
          state.recipe[pressedButton[1] as RecipeBlockNotNone].order.length - 1
        ] === pressedButton[2],
    });
    setPositionMenuAnchorElement(event.currentTarget);
  };
  const onPostionMoreContextMenuClick = (
    event: React.MouseEvent<HTMLElement>,
  ) => {
    let indexToInsert = 0;
    let indexToRemove = 0;
    const pressedButton = event.currentTarget.id.split("_");
    // // 0 = in Welchem Block (Ingredient/PreparationStep/Materials )
    // // 1 = Aktion (Add, Delete)
    // // 2 = UID des Elements

    const entriesToUpdate = {
      ...state.recipe[pressedButton[0] as RecipeBlockNotNone],
    } as
      | RecipeObjectStructure<Ingredient | Section>
      | RecipeObjectStructure<PreparationStep | Section>
      | RecipeObjectStructure<RecipeMaterialPosition | Section>;
    let newObject:
      | Ingredient
      | PreparationStep
      | RecipeMaterialPosition
      | Section;
    if (positionMenuSelectedItem.type === RecipeBlock.none) {
      return;
    }
    switch (pressedButton[1]) {
      case Action.ADD:
        switch (pressedButton[0]) {
          case RecipeBlock.ingredients:
            newObject = Recipe.createEmptyIngredient();
            break;
          case RecipeBlock.prepartionSteps:
            newObject = Recipe.createEmptyPreparationStep();
            break;
          case RecipeBlock.materials:
            newObject = Recipe.createEmptyMaterial();
            break;
          default:
            throw Error("Block unbekannt");
        }
        entriesToUpdate.entries[newObject.uid] = newObject;

        indexToInsert = entriesToUpdate.order.findIndex(
          (objectUid) => objectUid == pressedButton[2],
        );
        entriesToUpdate.order.splice(indexToInsert + 1, 0, newObject.uid);

        break;
      case Action.NEWSECTION:
        newObject = Recipe.createEmptySection();
        entriesToUpdate.entries[newObject.uid] = newObject;

        indexToInsert = entriesToUpdate.order.findIndex(
          (objectUid) => objectUid == pressedButton[2],
        );
        entriesToUpdate.order.splice(indexToInsert + 1, 0, newObject.uid);
        break;
      case Action.DELETE:
        delete entriesToUpdate.entries[pressedButton[2]];
        entriesToUpdate.order = entriesToUpdate.order.filter(
          (uid) => uid !== pressedButton[2],
        );
        break;
      case Action.MOVEUP:
      case Action.MOVEDOWN:
        indexToRemove = entriesToUpdate.order.indexOf(
          pressedButton[2] as RecipeBlockNotNone,
        );

        if (indexToRemove === -1) return;
        if (pressedButton[1] === Action.MOVEUP && indexToRemove === 0) return; // schon oben
        if (
          pressedButton[1] === Action.MOVEDOWN &&
          indexToRemove === entriesToUpdate.order.length - 1
        )
          return; // schon unten
        indexToInsert = indexToRemove - 1;
        indexToInsert =
          pressedButton[1] === Action.MOVEUP
            ? indexToRemove - 1
            : indexToRemove + 1;

        [
          entriesToUpdate.order[indexToRemove],
          entriesToUpdate.order[indexToInsert],
        ] = [
          entriesToUpdate.order[indexToInsert],
          entriesToUpdate.order[indexToRemove],
        ];

        break;
      default:
        Sentry.captureMessage(`Aktion unbekannt: ${pressedButton[1]}`, {level: "error", extra: {context: "RecipeEdit – onPositionMoreClick"}});
    }

    dispatch({
      type: ReducerActions.ON_UPDATE_LIST,
      payload: {
        fieldName: pressedButton[0],
        value: entriesToUpdate,
      },
    });
    setPositionMenuAnchorElement(null);
  };
  const onPositionMoreContextMenuClose = () => {
    setPositionMenuAnchorElement(null);
  };
  /* ------------------------------------------
  // PopUp Produkt Hinzufügen
  // ------------------------------------------ */
  const onCloseProductToAdd = () => {
    // Wert löschen.... der das ausgelöst hat.
    dispatch({
      type: ReducerActions.ON_INGREDIENT_DELETE_NAME,
      payload: {uid: triggeredIngredientUid},
    });

    setTriggeredIngredientUid("");
    setProductAddPopupValues({
      ...PRODUCT_POP_UP_VALUES_INITIAL_STATE,
      popUpOpen: false,
    });
  };
  const onCreateProductToAdd = (product: Product) => {
    dispatch({
      type: ReducerActions.ON_INGREDIENT_CHANGE,
      payload: {
        field: "product",
        value: {uid: product.uid, name: product.name},
        uid: triggeredIngredientUid,
      },
    });

    dispatch({
      type: ReducerActions.ON_INGREDIENT_ADD_NEW_PRODUCT,
      payload: product,
    });

    dispatch({
      type: ReducerActions.SNACKBAR_SHOW,
      payload: {
        message: TEXT.PRODUCT_CREATED(product.name),
        severity: "success",
      },
    });
    setTriggeredIngredientUid("");
    setProductAddPopupValues({
      ...PRODUCT_POP_UP_VALUES_INITIAL_STATE,
      popUpOpen: false,
    });
  };
  const onChooseExistingProductToAdd = (product: Product) => {
    dispatch({
      type: ReducerActions.ON_INGREDIENT_CHANGE,
      payload: {
        field: "product",
        value: {uid: product.uid, name: product.name},
        uid: triggeredIngredientUid,
      },
    });

    setTriggeredIngredientUid("");
    setProductAddPopupValues({
      ...PRODUCT_POP_UP_VALUES_INITIAL_STATE,
      popUpOpen: false,
    });
  };
  /* ------------------------------------------
  // PopUp Material Hinzufügen - 
  // ------------------------------------------ */
  const onCreateMaterialToAdd = (material: Material) => {
    dispatch({
      type: ReducerActions.ON_MATERIAL_CHANGE,
      payload: {
        field: "material",
        value: {uid: material.uid, name: material.name},
        uid: triggeredMaterialUid,
      },
    });

    dispatch({
      type: ReducerActions.ON_MATERIAL_ADD_NEW_PRODUCT,
      payload: material,
    });

    dispatch({
      type: ReducerActions.SNACKBAR_SHOW,
      payload: {
        message: TEXT.MATERIAL_CREATED(material.name),
        severity: "success",
      },
    });
    setTriggeredMaterialUid("");
    setMaterialAddPopupValues({
      ...MATERIAL_POP_UP_VALUES_INITIAL_STATE,
      popUpOpen: false,
    });
  };
  const onCloseMaterialToAdd = () => {
    // Wert löschen.... der das ausgelöst hat.
    dispatch({
      type: ReducerActions.ON_MATERIAL_DELETE_NAME,
      payload: {uid: triggeredMaterialUid},
    });

    setTriggeredMaterialUid("");
    setMaterialAddPopupValues({
      ...MATERIAL_POP_UP_VALUES_INITIAL_STATE,
      popUpOpen: false,
    });
  };
  /* ------------------------------------------
  // Drag & Drop Handler
  // ------------------------------------------ */
  const onDragAndDropUpdate = (
    newOrder: string[],
    dragAndDropListType: DragDropTypes,
  ) => {
    dispatch({
      type: ReducerActions.DRAG_AND_DROP_UDPATE,
      payload: {field: dragAndDropListType, value: newOrder},
    });
  };

  return (
    // <DragDropContext onDragEnd={onDragEnd}>
    // </DragDropContext>
    <React.Fragment>
      {/* wenn Variante auch Komponenten aus dem View holen!*/}
      {state.recipe.type == RecipeType.variant ? (
        <RecipeHeaderVariant recipe={state.recipe} onChange={onChangeField} />
      ) : (
        <RecipeHeader
          recipe={state.recipe}
          possibleDuplicateRecipes={possibleDuplicateRecipes}
          onChange={onChangeField}
          onBlur={onBlurRecipeName}
        />
      )}
      <RecipeButtonRow onSave={onSave} onCancel={onCancel} />
      <RecipeDivider />
      <Container sx={classes.container} component="main" maxWidth="lg">
        <Backdrop sx={classes.backdrop} open={isLoading}>
          <CircularProgress color="inherit" />
        </Backdrop>

        <Grid container spacing={4} justifyContent="center">
          {state.error && (
            <Grid size={12} key={"error"}>
              <AlertMessage
                error={state.error}
                messageTitle={TEXT.ALERT_TITLE_WAIT_A_MINUTE}
              />
            </Grid>
          )}
          {mealPlan.length > 0 && groupConfiguration && (
            <Grid size={{xs: 12, md: 6}}>
              <MealPlanPanelView
                mealPlan={mealPlan}
                groupConfiguration={groupConfiguration}
              />
            </Grid>
          )}
          <Grid size={{xs: 12, md: 6}}>
            {state.recipe.type == RecipeType.variant ? (
              // Die Variante darf die generellen Infos nicht anpassen
              <RecipeInfoPanelView
                recipe={state.recipe}
                onTagDelete={onTagDelete}
                onTagAdd={onTagAdd}
                authUser={authUser}
              />
            ) : (
              <RecipeInfoPanel
                recipe={state.recipe}
                onTagDelete={onTagDelete}
                onTagAdd={onTagAdd}
                onChange={onChangeField}
              />
            )}
          </Grid>
          <RecipeDivider style={{marginTop: "1em", marginBottom: "1em"}} />
          <Grid size={12}>
            <RecipeIngredients
              recipe={state.recipe}
              units={state.units}
              products={state.products}
              onChangeField={onChangeField}
              onChangeIngredient={onChangeIngredient}
              onDragAndDropUpdate={onDragAndDropUpdate}
              onPositionMoreClick={onPositionMoreClick}
            />
          </Grid>
          <RecipeDivider style={{marginTop: "1em", marginBottom: "1em"}} />
          <Grid size={12}>
            <RecipePreparationSteps
              recipe={state.recipe}
              onChange={onChangePreparationStep}
              onDragAndDropUpdate={onDragAndDropUpdate}
              onPositionMoreClick={onPositionMoreClick}
            />
          </Grid>
          <RecipeDivider style={{marginTop: "1em", marginBottom: "1em"}} />
          <Grid size={12}>
            <RecipeMaterials
              recipe={state.recipe}
              materials={state.materials}
              onChange={onChangeMaterial}
              onDragAndDropUpdate={onDragAndDropUpdate}
              onPositionMoreClick={onPositionMoreClick}
            />
          </Grid>
          {state.recipe.type == RecipeType.variant && (
            <Grid size={12}>
              <RecipeVariantNote
                recipe={state.recipe}
                onChange={onChangeField}
              />
            </Grid>
          )}
        </Grid>
        <RecipeButtonRow onSave={onSave} onCancel={onCancel} />
      </Container>
      <PositionMoreClickContextMenu
        anchorEl={positionMenuAnchorElement}
        handleMenuClick={onPostionMoreContextMenuClick}
        handleMenuClose={onPositionMoreContextMenuClose}
        recipeBlock={positionMenuSelectedItem.type}
        uid={positionMenuSelectedItem.uid}
        firstElement={positionMenuSelectedItem.firstElement}
        lastElement={positionMenuSelectedItem.lastElement}
        // positionType={positionMenuSelectedItem.positionType}
        // noListEntries={positionMenuSelectedItem.noOfPostitions}
      />
      <DialogProduct
        productName={productAddPopupValues.name}
        productUid={productAddPopupValues.uid}
        productDietProperties={productAddPopupValues.dietProperties}
        productUsable={productAddPopupValues.usable}
        dialogType={ProductDialog.CREATE}
        dialogOpen={productAddPopupValues.popUpOpen}
        handleOk={onCreateProductToAdd}
        handleClose={onCloseProductToAdd}
        handleChooseExisting={onChooseExistingProductToAdd}
        products={state.products}
        units={state.units}
        departments={state.departments}
        authUser={authUser}
      />
      <DialogMaterial
        materialName={materialAddPopupValues.name}
        materialUid={materialAddPopupValues.uid}
        materialType={materialAddPopupValues.type}
        materialUsable={materialAddPopupValues.usable}
        materials={state.materials}
        dialogType={MaterialDialog.CREATE}
        dialogOpen={materialAddPopupValues.popUpOpen}
        handleOk={onCreateMaterialToAdd}
        handleClose={onCloseMaterialToAdd}
        authUser={authUser}
      />
      <DialogTagAdd
        dialogOpen={tagAddDialogOpen}
        handleClose={handleTagAddDialogClose}
        handleAddTags={handleTagAddDialogAdd}
      />
      <CustomSnackbar
        message={state.snackbar.message}
        severity={state.snackbar.severity}
        snackbarOpen={state.snackbar.open}
        handleClose={handleSnackbarClose}
      />
    </React.Fragment>
  );
};
/* ===================================================================
// ============================= Header ==============================
// =================================================================== */
interface RecipeHeaderProps {
  recipe: Recipe;
  possibleDuplicateRecipes: FuseResult<RecipeShortDomain>[];
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onBlur: (event: React.FocusEvent<HTMLInputElement>) => void;
}
const RecipeHeader = ({
  recipe,
  possibleDuplicateRecipes,
  onChange,
  onBlur,
}: RecipeHeaderProps) => {
  const classes = useCustomStyles();
  // document.title = recipe.name ? recipe.name : TEXT.NEW_RECIPE;

  return (
    <React.Fragment>
      <Container
        maxWidth="md"
        sx={{
          ...classes.recipeHeader,
          display: "flex",
          position: "relative",
          backgroundImage: `url(${
            recipe.pictureSrc
              ? recipe.pictureSrc
              : ImageRepository.getEnvironmentRelatedPicture()
                  .CARD_PLACEHOLDER_MEDIA
          })`,
          backgroundPosition: "center",
          backgroundSize: "cover",
          backgroundRepeat: "no-repeat",
        }}
      >
        <Box component="div" sx={classes.recipeHeaderTitle}>
          <TextField
            id="name"
            key="name"
            name="name"
            required
            fullWidth
            label={TEXT.FIELD_NAME}
            value={recipe.name}
            onChange={onChange}
            onBlur={onBlur}
            autoFocus
            sx={{marginBottom: "1ex"}}
            slotProps={{htmlInput: {maxLength: 200}}}
          />
          {!recipe.uid && possibleDuplicateRecipes.length > 0 && (
            <Alert severity="warning" sx={{marginBottom: "1ex"}}>
              {TEXT.POSSIBLE_DUPLICATE_FOUND}
              {/* <br /> */}
              <ul>
                {possibleDuplicateRecipes.map((duplicate) => (
                  <li key={duplicate.item.uid} style={{textAlign: "left"}}>
                    <Link
                      key={duplicate.item.uid}
                      href={`../recipe/${duplicate.item.uid}`}
                    >
                      {duplicate.item.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </Alert>
          )}
          <Tooltip title={TEXT.TOOLTIP_RECIPE_IMAGE_SOURCE} arrow>
            <TextField
              id="pictureSrc"
              key="pictureSrc"
              name="pictureSrc"
              fullWidth
              label={TEXT.FIELD_IMAGE_SOURCE}
              value={recipe.pictureSrc}
              onChange={onChange}
              helperText={TEXT.HELPERTEXT_RECIPE_IMAGE_SOURCE}
              sx={{marginTop: "1ex"}}
            />
          </Tooltip>
        </Box>
      </Container>
    </React.Fragment>
  );
};
/* ===================================================================
// ============================= Header ==============================
// =================================================================== */
interface RecipeHeaderVariantProps {
  recipe: Recipe;
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
}
const RecipeHeaderVariant = ({recipe, onChange}: RecipeHeaderVariantProps) => {
  const classes = useCustomStyles();

  return (
    <React.Fragment>
      <Container
        maxWidth="md"
        sx={{
          ...classes.recipeHeader,
          display: "flex",
          position: "relative",
          backgroundImage: `url(${
            recipe.pictureSrc
              ? recipe.pictureSrc
              : ImageRepository.getEnvironmentRelatedPicture()
                  .CARD_PLACEHOLDER_MEDIA
          })`,
          backgroundPosition: "center",
          backgroundSize: "cover",
          backgroundRepeat: "no-repeat",
        }}
      >
        <Box component="div" sx={classes.recipeHeaderTitle}>
          <Typography
            component="h1"
            variant="h2"
            align="center"
            color="textPrimary"
            sx={{display: "block"}}
            gutterBottom
          >
            {recipe.name}
          </Typography>
          <TextField
            id="variantProperties.variantName"
            key="variantProperties.variantName"
            name="variantProperties.variantName"
            required
            fullWidth
            label={TEXT.FIELD_VARIANT_NAME}
            value={recipe.variantProperties?.variantName}
            placeholder={TEXT.DESCRIBE_YOUR_VARIANT}
            onChange={onChange}
            autoFocus
            sx={{marginBottom: "2ex"}}
          />
        </Box>
        {recipe.pictureSrc && (
          <Box component="div" sx={classes.recipeHeaderPictureSource}>
            <Tooltip title={TEXT.IMAGE_MAY_BE_SUBJECT_OF_COPYRIGHT} arrow>
              <Typography variant="body2">
                {TEXT.IMAGE_SOURCE}
                <Link href={recipe.pictureSrc} target="_blank">
                  {Utils.getDomain(recipe.pictureSrc)}
                </Link>
              </Typography>
            </Tooltip>
          </Box>
        )}
      </Container>
    </React.Fragment>
  );
};

/* ===================================================================
// ============================ Buttons ==============================
// =================================================================== */
interface RecipeButtonRowProps {
  onSave: () => void;
  onCancel: () => void;
}
const RecipeButtonRow = ({onSave, onCancel}: RecipeButtonRowProps) => {
  return (
    <React.Fragment>
      <ButtonRow
        key="action_buttons"
        buttons={[
          {
            id: "save",
            hero: true,
            visible: true,
            label: TEXT.BUTTON_SAVE,
            variant: "contained",
            color: "primary",
            onClick: onSave,
          },
          {
            id: "cancel",
            hero: true,
            visible: true,
            label: TEXT.BUTTON_CANCEL,
            variant: "outlined",
            color: "primary",
            onClick: onCancel,
          },
        ]}
      />
    </React.Fragment>
  );
};
/* ===================================================================
// =========================== Info Panel ============================
// =================================================================== */
interface RecipeInfoPanelProps {
  recipe: Recipe;
  onTagDelete: (tagToDelete: string) => void;
  onTagAdd: () => void;
  onChange: (event: SelectChangeEvent<MenuType[]>) => void;
}
const RecipeInfoPanel = ({
  recipe,
  onTagDelete,
  onTagAdd,
  onChange,
}: RecipeInfoPanelProps) => {
  const classes = useCustomStyles();

  const ITEM_HEIGHT = 48;
  const ITEM_PADDING_TOP = 8;
  const MenuProps = {
    PaperProps: {
      style: {
        maxHeight: ITEM_HEIGHT * 4.5 + ITEM_PADDING_TOP,
        width: 250,
      },
    },
  };

  return (
    <Card sx={classes.card}>
      <CardContent sx={classes.cardContent}>
        <List dense>
          {/* Quelle */}
          <FormListItem
            key={"source"}
            id={"source"}
            value={recipe.source}
            label={TEXT.SOURCE}
            editMode={true}
            helperText={TEXT.HELPTER_TEXT_RECIPE_SOURCE}
            onChange={onChange}
            maxLength={500}
          />
          {/* Zubereitungszeit */}
          <FormListItem
            key={"times.preparation"}
            id={"times.preparation"}
            value={recipe.times.preparation}
            label={TEXT.FIELD_PREPARATION_TIME}
            editMode={true}
            onChange={onChange}
            endAdornment={
              <InputAdornment position="end">{TEXT.UNIT_MIN}</InputAdornment>
            }
          />
          {/* Ruhezeit */}
          <FormListItem
            key={"times.rest"}
            id={"times.rest"}
            value={recipe.times.rest}
            label={TEXT.FIELD_REST_TIME}
            editMode={true}
            onChange={onChange}
            endAdornment={
              <InputAdornment position="end">{TEXT.UNIT_MIN}</InputAdornment>
            }
          />
          {/* Kochzeit */}
          <FormListItem
            key={"times.cooking"}
            id={"times.cooking"}
            value={recipe.times.cooking}
            label={TEXT.FIELD_COOK_TIME}
            editMode={true}
            onChange={onChange}
            endAdornment={
              <InputAdornment position="end">{TEXT.UNIT_MIN}</InputAdornment>
            }
          />
          {/* Menüarten */}
          <ListItem key={"listitem_menuTypes"}>
            <FormControl sx={classes.formControl} fullWidth>
              <InputLabel id="menuTypesLabel">{TEXT.MENU_TYPE}</InputLabel>
              <Select
                labelId="menuTypesLabel"
                id="menuTypes"
                key="menuTypes"
                name="menuTypes"
                multiple
                value={recipe.menuTypes}
                onChange={onChange}
                input={<OutlinedInput label={TEXT.MENU_TYPE} />}
                renderValue={(selected) => {
                  const selectedValues = selected as unknown as string[];
                  const textArray = selectedValues.map(
                    (value) => TEXT.MENU_TYPES[value],
                  ) as string[];
                  return (textArray as string[]).join(", ");
                }}
                MenuProps={MenuProps}
                fullWidth
              >
                {Object.keys(MenuType).map(
                  (menuType) =>
                    parseInt(menuType) > 0 && (
                      <MenuItem key={menuType} value={menuType}>
                        <Checkbox
                          checked={
                            recipe.menuTypes.indexOf(parseInt(menuType)) > -1
                          }
                        />
                        <ListItemText primary={TEXT.MENU_TYPES[menuType]} />
                      </MenuItem>
                    ),
                )}
              </Select>
            </FormControl>
          </ListItem>
          {/* Geeignet für Outdoorküche */}
          <ListItem>
            <ListItemText>{TEXT.OUTDOOR_KITCHEN_SUITABLE}</ListItemText>
            <ListItemSecondaryAction>
              <Switch
                checked={recipe.outdoorKitchenSuitable}
                onChange={onChange}
                name={"outdoorKitchenSuitable"}
                key={"outdoorKitchenSuitable"}
                id={"outdoorKitchenSuitable"}
              />
            </ListItemSecondaryAction>
          </ListItem>
          {/*Hinweis */}
          <FormListItem
            key={"note"}
            id={"note"}
            value={recipe.note}
            label={TEXT.FIELD_HINT}
            editMode={true}
            onChange={onChange}
            multiLine={true}
            maxLength={2000}
          />
          {/* Tags */}
          <FormListItem
            key={"tags"}
            id={"tags"}
            value={
              <React.Fragment>
                {recipe.tags.map((tag) => (
                  <Chip
                    key={tag}
                    label={tag}
                    onDelete={() => onTagDelete(tag)}
                    sx={classes.chip}
                    size="small"
                  />
                ))}
              </React.Fragment>
            }
            secondaryAction={
              <IconButton
                edge="end"
                aria-label="Tag hinzufügen"
                onClick={onTagAdd}
                size="large"
              >
                <AddIcon />
              </IconButton>
            }
            label={TEXT.FIELD_TAGS}
          />
        </List>
      </CardContent>
    </Card>
  );
};
/* ===================================================================
// ============================= Zutaten  ============================
// =================================================================== */
interface RecipeIngredientsProps {
  recipe: Recipe;
  units: Unit[];
  products: Product[];
  onChangeField: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onChangeIngredient: (
    event: React.ChangeEvent<HTMLInputElement>,
    newValue?: string | Unit | Product | null,
    action?: AutocompleteChangeReason,
    objectId?: string,
  ) => void;
  onDragAndDropUpdate: (
    newOrder: string[],
    dragAndDropList: DragDropTypes,
  ) => void;

  onPositionMoreClick: (event: React.MouseEvent<HTMLElement>) => void;
}
const RecipeIngredients = ({
  recipe,
  units,
  products,
  onChangeField,
  onChangeIngredient,
  onDragAndDropUpdate,
  onPositionMoreClick,
}: RecipeIngredientsProps) => {
  const classes = useCustomStyles();
  const theme = useTheme();
  const breakpointIsXs = useMediaQuery(theme.breakpoints.down("sm"));

  const [gridSize, setGridSize] = useState(GRIDSIZE_COLUMNS.ScaleFactorOff);
  const [showScaleFactors, setShowScaleFactors] = useState(false);

  const [registry] = useState(getItemRegistry);
  const [lastCardMoved, setLasCardMoved] =
    useState<LastCardMoved<Ingredient | Section>>(null);

  // Isolated instances of this component from one another
  const [instanceId] = useState(() => Symbol("instance-id"));
  const reorderItem = useCallback(
    ({
      startIndex,
      indexOfTarget,
      closestEdgeOfTarget,
    }: {
      startIndex: number;
      indexOfTarget: number;
      closestEdgeOfTarget: Edge | null;
    }) => {
      const finishIndex = getReorderDestinationIndex({
        startIndex,
        closestEdgeOfTarget,
        indexOfTarget,
        axis: "vertical",
      });

      if (finishIndex === startIndex) {
        // Keine Änderung, Kein Update
        return;
      }

      const itemKey = recipe.ingredients.order[startIndex];
      const item = recipe.ingredients.entries[itemKey];

      onDragAndDropUpdate(
        reorder({
          list: recipe.ingredients.order,
          startIndex,
          finishIndex,
        }),
        DragDropTypes.INGREDIENT,
      );
      setLasCardMoved({
        item,
        previousIndex: startIndex,
        currentIndex: finishIndex,
        numberOfItems: recipe.ingredients.order.length,
      });
    },
    [recipe.ingredients],
  );

  useEffect(() => {
    return monitorForElements({
      canMonitor({source}) {
        return isItemData(source.data) && source.data.instanceId === instanceId;
      },
      onDrop({location, source}) {
        const target = location.current.dropTargets[0];
        if (!target) {
          return;
        }

        const sourceData = source.data;
        const targetData = target.data;
        if (!isItemData(sourceData) || !isItemData(targetData)) {
          return;
        }

        const indexOfTarget = recipe.ingredients.order.findIndex(
          (itemUiId) =>
            itemUiId === (targetData.item as Ingredient | Section).uid,
        );
        if (indexOfTarget < 0) {
          return;
        }

        const closestEdgeOfTarget = extractClosestEdge(targetData);
        reorderItem({
          startIndex: sourceData.index,
          indexOfTarget,
          closestEdgeOfTarget,
        });
      },
    });
  }, [instanceId, recipe.ingredients.order, reorderItem]);

  // Drag beendet, Abschlussarbeiten
  useEffect(() => {
    if (lastCardMoved === null) {
      return;
    }
    const {item} = lastCardMoved;
    const element = registry.getElement(item.uid);
    if (element) {
      triggerPostMoveFlash(element);
    }
  }, [lastCardMoved, registry]);

  const getListLength = useCallback(
    () => recipe.ingredients.order.length,
    [recipe.ingredients.order.length],
  );

  const contextValue: ListContextValue = useMemo(() => {
    return {
      registerItem: registry.register,
      reorderItem,
      instanceId,
      getListLength,
    };
  }, [registry.register, reorderItem, instanceId, getListLength]);

  const onToggleScaleFactors = () => {
    showScaleFactors
      ? setGridSize(GRIDSIZE_COLUMNS.ScaleFactorOff)
      : setGridSize(GRIDSIZE_COLUMNS.ScaleFactorOn);
    setShowScaleFactors(!showScaleFactors);
  };
  return (
    <React.Fragment>
      <Typography
        component="h2"
        variant="h4"
        align="center"
        sx={{display: "block"}}
        gutterBottom
      >
        {TEXT.INGREDIENTS}
      </Typography>
      <Grid container spacing={2} alignItems="center">
        <Grid size={6} sx={classes.centerCenter}>
          <TextField
            id={"portions"}
            key={"portions"}
            name={"portions"}
            label={TEXT.FIELD_PORTIONS}
            required
            value={recipe.portions}
            onChange={onChangeField}
            disabled={recipe.type == RecipeType.variant}
          />
        </Grid>
        <Grid size={6} sx={classes.centerCenter}>
          <Typography variant="body2">
            {TEXT.FIELD_SHOW_SCALE_FACTORS}
          </Typography>
          <Switch
            checked={showScaleFactors}
            onChange={onToggleScaleFactors}
            name="checkedShowScaleFactors"
          />
        </Grid>

        <Grid size={12} sx={classes.centerCenter}>
          <IngredientListContext.Provider value={contextValue}>
            <List key={"listIngredients"} sx={{flexGrow: 1}}>
              {recipe.ingredients.order.map((ingredientUid, index) => (
                <React.Fragment key={"ingredient_" + ingredientUid}>
                  <IngredientListEntry
                    key={"ingredientStep_" + ingredientUid}
                    ingredient={recipe.ingredients.entries[ingredientUid]}
                    index={index}
                    recipe={recipe}
                    units={units}
                    products={products}
                    gridSize={gridSize}
                    showScaleFactors={showScaleFactors}
                    onChangeIngredient={onChangeIngredient}
                    onPositionMoreClick={onPositionMoreClick}
                  />
                  {breakpointIsXs && <Divider variant="middle" />}
                </React.Fragment>
              ))}
            </List>
          </IngredientListContext.Provider>
        </Grid>
      </Grid>
    </React.Fragment>
  );
};
/* ===================================================================
// ========================= Zutaten Position ========================
// =================================================================== */
interface IngredientListEntryProps {
  ingredient: Ingredient | Section;
  index: number;
  recipe: Recipe;
  units: Unit[];
  products: Product[];
  gridSize: GridSizeColums;
  showScaleFactors: boolean;
  onChangeIngredient: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onPositionMoreClick: (event: React.MouseEvent<HTMLElement>) => void;
}
const IngredientListEntry = ({
  ingredient,
  index,
  recipe,
  units,
  products,
  gridSize,
  showScaleFactors,
  onChangeIngredient,
  onPositionMoreClick,
}: IngredientListEntryProps) => {
  const {registerItem, instanceId} = useIngredientListContext();

  const ref = useRef<HTMLDivElement>(null);
  const [closestEdge, setClosestEdge] = useState<Edge | null>(null);

  const dragHandleRef = useRef<HTMLButtonElement>(null);

  const [draggableState, setDraggableState] =
    useState<DraggableState>(idleState);

  useEffect(() => {
    const element = ref.current;
    const dragHandle = dragHandleRef.current;
    invariant(element);
    invariant(dragHandle);

    // Instance-ID (Liste in dem das Drag & drop Stattfindet)
    const data = getItemData({item: ingredient, index, instanceId});

    return combine(
      registerItem({itemUiId: ingredient.uid, element}),
      draggable({
        element: dragHandle,
        getInitialData: () => data,

        onDragStart() {
          setDraggableState(draggingState);
        },
        onDrop() {
          setDraggableState(idleState);
        },
      }),
      dropTargetForElements({
        element,
        canDrop({source}) {
          return (
            isItemData<Ingredient | Section>(source.data) &&
            source.data.instanceId === instanceId
          );
        },
        getData({input}) {
          return attachClosestEdge(data, {
            element,
            input,
            allowedEdges: ["top", "bottom"],
          });
        },
        onDrag({self, source}) {
          const isSource = source.element === element;
          if (isSource) {
            setClosestEdge(null);
            return;
          }

          const closestEdge = extractClosestEdge(self.data);

          const sourceIndex = source.data.index;
          invariant(typeof sourceIndex === "number");

          const isItemBeforeSource = index === sourceIndex - 1;
          const isItemAfterSource = index === sourceIndex + 1;

          const isDropIndicatorHidden =
            (isItemBeforeSource && closestEdge === "bottom") ||
            (isItemAfterSource && closestEdge === "top");

          if (isDropIndicatorHidden) {
            setClosestEdge(null);
            return;
          }

          setClosestEdge(closestEdge);
        },
        onDragLeave() {
          setClosestEdge(null);
        },
        onDrop() {
          setClosestEdge(null);
        },
      }),
    );
  }, [instanceId, ingredient, index, registerItem]);

  return (
    <ListItem
      key={"listitem_ingredient" + ingredient.uid}
      id={"listitem_ingredient" + ingredient.uid}
      sx={[draggableState === draggingState && {opacity: 0.4}]}
      ref={mergeRefs([ref, dragHandleRef])}
      secondaryAction={
        <IconButton
          id={"MoreBtn_" + RecipeBlock.ingredients + "_" + ingredient.uid}
          aria-label="position-options"
          onClick={onPositionMoreClick}
          size="small"
        >
          <MoreVertIcon />
        </IconButton>
      }
      className="custom-drop-trigger-post-move-flash"
    >
      {ingredient.posType == PositionType.section ? (
        <SectionPosition
          key={ingredient.uid}
          index={index}
          section={ingredient as Section}
          // recipeBlock={RecipeBlock.ingredients}
          onChangeSection={onChangeIngredient}
        />
      ) : (
        <IngredientPosition
          position={Recipe.definePositionSectionAdjusted({
            uid: ingredient.uid,
            entries: recipe.ingredients.entries,
            order: recipe.ingredients.order,
          })}
          key={ingredient.uid}
          ingredient={ingredient as Ingredient}
          units={units}
          products={products}
          gridSize={gridSize}
          showScaleFactors={showScaleFactors}
          onChangeIngredient={onChangeIngredient}
        />
      )}
      {closestEdge && (
        <Box component="div" className="custom-drop-indicator">
          <DropIndicator edge={closestEdge} gap="1px" />
        </Box>
      )}
    </ListItem>
  );
};

/* ===================================================================
// ========================= Zutaten Position ========================
// =================================================================== */
interface IngredientPositionProps {
  position: number;
  ingredient: Ingredient;
  units: Unit[];
  products: Product[];
  showScaleFactors: boolean;
  gridSize: GridSizeColums;
  onChangeIngredient: (
    event: React.ChangeEvent<HTMLInputElement>,
    newValue?: string | Unit | Product | null,
    action?: AutocompleteChangeReason,
    objectId?: string,
  ) => void;
}
const IngredientPosition = ({
  position,
  ingredient,
  units,
  products,
  showScaleFactors,
  gridSize,
  onChangeIngredient,
}: IngredientPositionProps) => {
  const classes = useCustomStyles();

  const theme = useTheme();
  const breakpointIsXs = useMediaQuery(theme.breakpoints.down("sm"));

  return (
    <ListItemText>
      <Grid container spacing={2} alignItems="center">
        {!breakpointIsXs && (
          <Grid
            size={{xs: gridSize.pos.xs, sm: gridSize.pos.sm}}
            key={"ingredient_pos_grid_" + ingredient.uid}
            sx={classes.centerCenter}
          >
            <Typography
              key={"ingredient_pos_" + ingredient.uid}
              color="primary"
            >
              {position}
            </Typography>
          </Grid>
        )}
        <Grid
          size={{xs: gridSize.quantity.xs, sm: gridSize.quantity.sm}}
          key={"ingredient_quantity_grid_" + ingredient.uid}
        >
          <TextField
            key={"quantity_" + ingredient.uid}
            id={"quantity_" + ingredient.uid}
            value={
              Number.isNaN(ingredient.quantity) || ingredient.quantity === 0
                ? ""
                : ingredient.quantity
            }
            label={TEXT.FIELD_QUANTITY}
            type="number"
            inputProps={{min: 0}}
            onChange={onChangeIngredient}
            fullWidth
          />
        </Grid>

        {/* Einheit */}
        <Grid
          size={{xs: gridSize.unit.xs, sm: gridSize.unit.sm}}
          key={"ingredient_unit_grid_" + ingredient.uid}
          sx={[!showScaleFactors && {paddingRight: theme.spacing(2)}]}
        >
          <UnitAutocomplete
            componentKey={ingredient.uid}
            unitKey={ingredient.unit}
            units={units}
            onChange={onChangeIngredient}
          />
        </Grid>
        {/* Skalierungsfaktor */}
        {showScaleFactors && (
          <Grid
            size={{
              xs: gridSize.scalingFactor.xs,
              sm: gridSize.scalingFactor.sm,
            }}
            key={"ingredient_scalingFractor_grid_" + ingredient.uid}
            sx={{paddingRight: theme.spacing(2)}}
          >
            <TextField
              value={ingredient.scalingFactor}
              id={"scalingFactor_" + ingredient.uid}
              key={"scalingFactor_" + ingredient.uid}
              label={TEXT.FIELD_SCALING_FACTOR}
              type="number"
              onChange={onChangeIngredient}
              fullWidth
              inputProps={{
                min: "0.1",
                max: "1",
                step: "0.1",
              }}
            />
          </Grid>
        )}

        <Grid
          size={{xs: gridSize.product.xs, sm: gridSize.product.sm}}
          key={"ingredient_product_grid_" + ingredient.uid}
        >
          <ProductAutocomplete
            componentKey={ingredient.uid}
            product={ingredient.product}
            products={products}
            onChange={onChangeIngredient}
          />
        </Grid>
        <Grid
          size={{xs: gridSize.detail.xs, sm: gridSize.detail.sm}}
          key={"ingredient_detail_grid_" + ingredient.uid}
          // Sonst crasht das Feld in den Secondary-Action-Button
          sx={{paddingRight: theme.spacing(2)}}
        >
          <TextField
            value={ingredient.detail}
            key={"detail_" + ingredient.uid}
            id={"detail_" + ingredient.uid}
            label={TEXT.FIELD_DETAILS}
            onChange={onChangeIngredient}
            fullWidth
          />
        </Grid>
      </Grid>
    </ListItemText>
  );
};
/* ===================================================================
// =========================== Zubereitung  ==========================
// =================================================================== */
interface RecipePreparationStepsProps {
  recipe: Recipe;
  onChange: (
    event: React.ChangeEvent<HTMLInputElement>,
    newValue?: string | Unit | Product,
    action?: AutocompleteChangeReason,
    objectId?: string,
  ) => void;
  onDragAndDropUpdate: (
    newOrder: string[],
    dragAndDropList: DragDropTypes,
  ) => void;
  onPositionMoreClick: (event: React.MouseEvent<HTMLElement>) => void;
}

const RecipePreparationSteps = ({
  recipe,
  onChange,
  onDragAndDropUpdate,
  onPositionMoreClick,
}: RecipePreparationStepsProps) => {
  const classes = useCustomStyles();

  const [registry] = useState(getItemRegistry);
  const [lastCardMoved, setLasCardMoved] =
    useState<LastCardMoved<PreparationStep | Section>>(null);

  // Isolated instances of this component from one another
  const [instanceId] = useState(() => Symbol("instance-id"));
  const reorderItem = useCallback(
    ({
      startIndex,
      indexOfTarget,
      closestEdgeOfTarget,
    }: {
      startIndex: number;
      indexOfTarget: number;
      closestEdgeOfTarget: Edge | null;
    }) => {
      const finishIndex = getReorderDestinationIndex({
        startIndex,
        closestEdgeOfTarget,
        indexOfTarget,
        axis: "vertical",
      });

      if (finishIndex === startIndex) {
        // Keine Änderung, Kein Update
        return;
      }

      const itemKey = recipe.preparationSteps.order[startIndex];
      const item = recipe.preparationSteps.entries[itemKey];

      onDragAndDropUpdate(
        reorder({
          list: recipe.preparationSteps.order,
          startIndex,
          finishIndex,
        }),
        DragDropTypes.PREPARATIONSTEP,
      );
      setLasCardMoved({
        item,
        previousIndex: startIndex,
        currentIndex: finishIndex,
        numberOfItems: recipe.preparationSteps.order.length,
      });
    },
    [recipe.preparationSteps],
  );

  useEffect(() => {
    return monitorForElements({
      canMonitor({source}) {
        return isItemData(source.data) && source.data.instanceId === instanceId;
      },
      onDrop({location, source}) {
        const target = location.current.dropTargets[0];
        if (!target) {
          return;
        }

        const sourceData = source.data;
        const targetData = target.data;
        if (!isItemData(sourceData) || !isItemData(targetData)) {
          return;
        }

        const indexOfTarget = recipe.preparationSteps.order.findIndex(
          (itemUiId) =>
            itemUiId === (targetData.item as PreparationStep | Section).uid,
        );
        if (indexOfTarget < 0) {
          return;
        }

        const closestEdgeOfTarget = extractClosestEdge(targetData);
        reorderItem({
          startIndex: sourceData.index,
          indexOfTarget,
          closestEdgeOfTarget,
        });
      },
    });
  }, [instanceId, recipe.preparationSteps.order, reorderItem]);

  // Drag beendet, Abschlussarbeiten
  useEffect(() => {
    if (lastCardMoved === null) {
      return;
    }
    const {item} = lastCardMoved;
    const element = registry.getElement(item.uid);
    if (element) {
      triggerPostMoveFlash(element);
    }
  }, [lastCardMoved, registry]);

  const getListLength = useCallback(
    () => recipe.preparationSteps.order.length,
    [recipe.preparationSteps.order.length],
  );

  const contextValue: ListContextValue = useMemo(() => {
    return {
      registerItem: registry.register,
      reorderItem,
      instanceId,
      getListLength,
    };
  }, [registry.register, reorderItem, instanceId, getListLength]);

  return (
    <React.Fragment>
      <Typography
        component="h2"
        variant="h4"
        align="center"
        sx={{display: "block"}}
        gutterBottom
      >
        {TEXT.PREPARATION}
      </Typography>
      <Grid container spacing={2} alignItems="center">
        <Grid size={12} sx={classes.centerCenter}>
          <PreparationListContext.Provider value={contextValue}>
            <List key={"listPreparationSteps"} sx={{flexGrow: 1}}>
              {/* Zutaten auflsiten */}
              {recipe.preparationSteps.order.map(
                (preparationStepUid, index) => (
                  <PreparationStepListEntry
                    key={"preparationStep_" + preparationStepUid}
                    preparationStep={
                      recipe.preparationSteps.entries[preparationStepUid]
                    }
                    index={index}
                    recipe={recipe}
                    onChange={onChange}
                    onPositionMoreClick={onPositionMoreClick}
                  />
                ),
              )}
            </List>
          </PreparationListContext.Provider>
        </Grid>
      </Grid>
    </React.Fragment>
  );
};
/* ===================================================================
// ======================= Zubereitung Position ======================
// =================================================================== */
interface PreparationStepListEntryProps {
  preparationStep: PreparationStep | Section;
  index: number;
  recipe: Recipe;
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onPositionMoreClick: (event: React.MouseEvent<HTMLElement>) => void;
}
const PreparationStepListEntry = ({
  preparationStep,
  index,
  recipe,
  onChange,
  onPositionMoreClick,
}: PreparationStepListEntryProps) => {
  const {registerItem, instanceId} = usePreparationListContext();

  const ref = useRef<HTMLDivElement>(null);
  const [closestEdge, setClosestEdge] = useState<Edge | null>(null);

  const dragHandleRef = useRef<HTMLButtonElement>(null);

  const [draggableState, setDraggableState] =
    useState<DraggableState>(idleState);

  useEffect(() => {
    const element = ref.current;
    const dragHandle = dragHandleRef.current;
    invariant(element);
    invariant(dragHandle);

    // Instance-ID (Liste in dem das Drag & drop Stattfindet)
    const data = getItemData({item: preparationStep, index, instanceId});

    return combine(
      registerItem({itemUiId: preparationStep.uid, element}),
      draggable({
        element: dragHandle,
        getInitialData: () => data,

        onDragStart() {
          setDraggableState(draggingState);
        },
        onDrop() {
          setDraggableState(idleState);
        },
      }),
      dropTargetForElements({
        element,
        canDrop({source}) {
          return (
            isItemData<PreparationStep | Section>(source.data) &&
            source.data.instanceId === instanceId
          );
        },
        getData({input}) {
          return attachClosestEdge(data, {
            element,
            input,
            allowedEdges: ["top", "bottom"],
          });
        },
        onDrag({self, source}) {
          const isSource = source.element === element;
          if (isSource) {
            setClosestEdge(null);
            return;
          }

          const closestEdge = extractClosestEdge(self.data);

          const sourceIndex = source.data.index;
          invariant(typeof sourceIndex === "number");

          const isItemBeforeSource = index === sourceIndex - 1;
          const isItemAfterSource = index === sourceIndex + 1;

          const isDropIndicatorHidden =
            (isItemBeforeSource && closestEdge === "bottom") ||
            (isItemAfterSource && closestEdge === "top");

          if (isDropIndicatorHidden) {
            setClosestEdge(null);
            return;
          }

          setClosestEdge(closestEdge);
        },
        onDragLeave() {
          setClosestEdge(null);
        },
        onDrop() {
          setClosestEdge(null);
        },
      }),
    );
  }, [instanceId, preparationStep, index, registerItem]);

  return (
    <ListItem
      key={"listitem_preparationStep" + preparationStep.uid}
      id={"listitem_preparationStep" + preparationStep.uid}
      secondaryAction={
        <IconButton
          id={
            "MoreBtn_" + RecipeBlock.prepartionSteps + "_" + preparationStep.uid
          }
          aria-label="position-options"
          onClick={onPositionMoreClick}
          size="small"
        >
          <MoreVertIcon />
        </IconButton>
      }
      sx={[draggableState === draggingState && {opacity: 0.4}]}
      ref={mergeRefs([ref, dragHandleRef])}
      className="custom-drop-trigger-post-move-flash"
    >
      {preparationStep.posType == PositionType.section ? (
        <SectionPosition
          key={preparationStep.uid}
          index={index}
          section={preparationStep as Section}
          onChangeSection={onChange}
        />
      ) : (
        <PreparationStepPosition
          key={preparationStep.uid}
          position={Recipe.definePositionSectionAdjusted({
            uid: preparationStep.uid,
            entries: recipe.preparationSteps.entries,
            order: recipe.preparationSteps.order,
          })}
          preparationStep={preparationStep as PreparationStep}
          onChange={onChange}
        />
      )}
      {closestEdge && (
        <Box component="div" className="custom-drop-indicator">
          <DropIndicator edge={closestEdge} gap="1px" />
        </Box>
      )}
    </ListItem>
  );
};

/* ===================================================================
// ================== Zubereitungsschritt Position ===================
// =================================================================== */
interface PreparationStepPositionProps {
  position: number;
  preparationStep: PreparationStep;
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
}
const PreparationStepPosition = ({
  position,
  preparationStep,
  onChange,
}: PreparationStepPositionProps) => {
  const classes = useCustomStyles();
  const theme = useTheme();

  return (
    <React.Fragment>
      <ListItemText>
        <Grid container spacing={2} alignItems="center">
          <Grid
            size={1}
            key={"preparationstep_pos_grid_" + preparationStep.uid}
            sx={classes.centerCenter}
          >
            <Typography
              key={"preparationstep_pos_" + preparationStep.uid}
              color="primary"
            >
              {position}
            </Typography>
          </Grid>

          <Grid
            size={11}
            key={"preparationstep_step_grid_" + preparationStep.uid}
            // Sonst crasht das Feld in den Secondary-Action-Button
            sx={{paddingRight: theme.spacing(2)}}
          >
            {"step" in preparationStep ? (
              <TextField
                id={"step_" + preparationStep.uid}
                key={"step_" + preparationStep.uid}
                label={TEXT.FIELD_STEP + " " + position}
                name={"step_" + preparationStep.uid}
                autoComplete={"preparationStep"}
                value={preparationStep.step}
                multiline
                fullWidth
                onChange={onChange}
              />
            ) : null}
          </Grid>
        </Grid>
      </ListItemText>
    </React.Fragment>
  );
};
/* ===================================================================
// ============================= Material  ===========================
// =================================================================== */
interface RecipeMaterialsProps {
  recipe: Recipe;
  materials: Material[];
  onChange: (
    event: React.ChangeEvent<HTMLInputElement>,
    newValue?: string | Material,
    action?: AutocompleteChangeReason,
    objectId?: string,
  ) => void;
  onDragAndDropUpdate: (
    newOrder: string[],
    dragAndDropList: DragDropTypes,
  ) => void;
  onPositionMoreClick: (event: React.MouseEvent<HTMLElement>) => void;
}

const RecipeMaterials = ({
  recipe,
  materials,
  onChange,
  onDragAndDropUpdate,
  onPositionMoreClick,
}: RecipeMaterialsProps) => {
  const classes = useCustomStyles();

  const [registry] = useState(getItemRegistry);
  const [lastCardMoved, setLasCardMoved] =
    useState<LastCardMoved<RecipeMaterialPosition>>(null);

  // Isolated instances of this component from one another
  const [instanceId] = useState(() => Symbol("instance-id"));
  const reorderItem = useCallback(
    ({
      startIndex,
      indexOfTarget,
      closestEdgeOfTarget,
    }: {
      startIndex: number;
      indexOfTarget: number;
      closestEdgeOfTarget: Edge | null;
    }) => {
      const finishIndex = getReorderDestinationIndex({
        startIndex,
        closestEdgeOfTarget,
        indexOfTarget,
        axis: "vertical",
      });

      if (finishIndex === startIndex) {
        // Keine Änderung, Kein Update
        return;
      }

      const itemKey = recipe.materials.order[startIndex];
      const item = recipe.materials.entries[itemKey];

      onDragAndDropUpdate(
        reorder({
          list: recipe.materials.order,
          startIndex,
          finishIndex,
        }),
        DragDropTypes.MATERIAL,
      );
      setLasCardMoved({
        item,
        previousIndex: startIndex,
        currentIndex: finishIndex,
        numberOfItems: recipe.materials.order.length,
      });
    },
    [recipe.materials],
  );

  useEffect(() => {
    return monitorForElements({
      canMonitor({source}) {
        return isItemData(source.data) && source.data.instanceId === instanceId;
      },
      onDrop({location, source}) {
        const target = location.current.dropTargets[0];
        if (!target) {
          return;
        }

        const sourceData = source.data;
        const targetData = target.data;
        if (!isItemData(sourceData) || !isItemData(targetData)) {
          return;
        }

        const indexOfTarget = recipe.materials.order.findIndex(
          (itemUiId) =>
            itemUiId === (targetData.item as RecipeMaterialPosition).uid,
        );
        if (indexOfTarget < 0) {
          return;
        }

        const closestEdgeOfTarget = extractClosestEdge(targetData);
        reorderItem({
          startIndex: sourceData.index,
          indexOfTarget,
          closestEdgeOfTarget,
        });
      },
    });
  }, [instanceId, recipe.materials.order, reorderItem]);

  // Drag beendet, Abschlussarbeiten
  useEffect(() => {
    if (lastCardMoved === null) {
      return;
    }
    const {item} = lastCardMoved;
    const element = registry.getElement(item.uid);
    if (element) {
      triggerPostMoveFlash(element);
    }
  }, [lastCardMoved, registry]);

  const getListLength = useCallback(
    () => recipe.materials.order.length,
    [recipe.materials.order.length],
  );

  const contextValue: ListContextValue = useMemo(() => {
    return {
      registerItem: registry.register,
      reorderItem,
      instanceId,
      getListLength,
    };
  }, [registry.register, reorderItem, instanceId, getListLength]);

  return (
    <React.Fragment>
      <Typography
        component="h2"
        variant="h4"
        align="center"
        sx={{display: "block"}}
        gutterBottom
      >
        {TEXT.MATERIAL}
      </Typography>
      <Grid container spacing={2} alignItems="center">
        <Grid size={12} sx={classes.centerCenter}>
          <MaterialListContext.Provider value={contextValue}>
            <List key={"listMaterials"} sx={{flexGrow: 1}}>
              {recipe.materials.order.map((materialUid, index) => (
                <MaterialListEntry
                  key={"material_" + materialUid}
                  material={recipe.materials.entries[materialUid]}
                  materials={materials}
                  index={index}
                  onChange={onChange}
                  onPositionMoreClick={onPositionMoreClick}
                />
              ))}
            </List>
          </MaterialListContext.Provider>
        </Grid>
      </Grid>
    </React.Fragment>
  );
};
/* ===================================================================
// ===================== Materiallisteneintrag =======================
// =================================================================== */
interface MaterialListEntryProps {
  material: RecipeMaterialPosition;
  materials: Material[];
  index: number;
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onPositionMoreClick: (event: React.MouseEvent<HTMLElement>) => void;
}
const MaterialListEntry = ({
  material,
  materials,
  index,
  onChange,
  onPositionMoreClick,
}: MaterialListEntryProps) => {
  const {registerItem, instanceId} = useMaterialListContext();

  const ref = useRef<HTMLDivElement>(null);
  const [closestEdge, setClosestEdge] = useState<Edge | null>(null);

  const dragHandleRef = useRef<HTMLButtonElement>(null);

  const [draggableState, setDraggableState] =
    useState<DraggableState>(idleState);

  useEffect(() => {
    const element = ref.current;
    const dragHandle = dragHandleRef.current;
    invariant(element);
    invariant(dragHandle);

    // Instance-ID (Liste in dem das Drag & drop Stattfindet)
    const data = getItemData({item: material, index, instanceId});

    return combine(
      registerItem({itemUiId: material.uid, element}),
      draggable({
        element: dragHandle,
        getInitialData: () => data,

        onDragStart() {
          setDraggableState(draggingState);
        },
        onDrop() {
          setDraggableState(idleState);
        },
      }),
      dropTargetForElements({
        element,
        canDrop({source}) {
          return (
            isItemData<RecipeMaterialPosition>(source.data) &&
            source.data.instanceId === instanceId
          );
        },
        getData({input}) {
          return attachClosestEdge(data, {
            element,
            input,
            allowedEdges: ["top", "bottom"],
          });
        },
        onDrag({self, source}) {
          const isSource = source.element === element;
          if (isSource) {
            setClosestEdge(null);
            return;
          }

          const closestEdge = extractClosestEdge(self.data);

          const sourceIndex = source.data.index;
          invariant(typeof sourceIndex === "number");

          const isItemBeforeSource = index === sourceIndex - 1;
          const isItemAfterSource = index === sourceIndex + 1;

          const isDropIndicatorHidden =
            (isItemBeforeSource && closestEdge === "bottom") ||
            (isItemAfterSource && closestEdge === "top");

          if (isDropIndicatorHidden) {
            setClosestEdge(null);
            return;
          }

          setClosestEdge(closestEdge);
        },
        onDragLeave() {
          setClosestEdge(null);
        },
        onDrop() {
          setClosestEdge(null);
        },
      }),
    );
  }, [instanceId, material, index, registerItem]);

  return (
    <ListItem
      key={"listitem_materials_" + material.uid}
      id={"listitem_materials_" + material.uid}
      secondaryAction={
        <IconButton
          id={"MoreBtn_" + RecipeBlock.materials + "_" + material.uid}
          aria-label="position-options"
          onClick={onPositionMoreClick}
          size="small"
        >
          <MoreVertIcon />
        </IconButton>
      }
      sx={[draggableState === draggingState && {opacity: 0.4}]}
      ref={mergeRefs([ref, dragHandleRef])}
      className="custom-drop-trigger-post-move-flash"
    >
      <MaterialPosition
        position={index + 1}
        key={material.uid}
        material={material}
        materials={materials}
        onChangeMaterial={onChange}
      />
      {closestEdge && (
        <Box component="div" className="custom-drop-indicator">
          <DropIndicator edge={closestEdge} gap="1px" />
        </Box>
      )}
    </ListItem>
  );
};
/* ===================================================================
// ======================= Material Position =========================
// =================================================================== */
interface MaterialPositionProps {
  position: number;
  material: RecipeMaterialPosition;
  materials: Material[];
  onChangeMaterial: (event: React.ChangeEvent<HTMLInputElement>) => void;
}
const MaterialPosition = ({
  position,
  material,
  materials,
  onChangeMaterial,
}: MaterialPositionProps) => {
  const classes = useCustomStyles();
  const theme = useTheme();

  return (
    <React.Fragment>
      <ListItemText>
        <Grid container spacing={2} alignItems="center">
          <Grid
            size={1}
            key={"material_pos_grid_" + material.uid}
            sx={classes.centerCenter}
          >
            <Typography key={"material_pos_" + material.uid} color="primary">
              {position}
            </Typography>
          </Grid>

          <Grid size={2} key={"material_quantity_grid_" + material.uid}>
            <TextField
              key={"quantity_" + material.uid}
              id={"quantity_" + material.uid}
              value={
                Number.isNaN(material.quantity) || material.quantity === 0
                  ? ""
                  : material.quantity
              }
              label={TEXT.FIELD_QUANTITY}
              type="number"
              inputProps={{min: 0}}
              onChange={onChangeMaterial}
              fullWidth
            />
          </Grid>
          <Grid
            size={9}
            key={"material_name_grid_" + material.uid}
            // Sonst crasht das Feld in den Secondary-Action-Button
            sx={{paddingRight: theme.spacing(2)}}
          >
            <MaterialAutocomplete
              componentKey={material.uid}
              material={material.material}
              materials={materials}
              disabled={false}
              onChange={onChangeMaterial}
            />
          </Grid>
        </Grid>
      </ListItemText>
    </React.Fragment>
  );
};

/* ===================================================================
// ================ Abschnitt für Zutaten/Zubereitung ================
// =================================================================== */
interface SectionPositionProps {
  index: number;
  section: Section;
  onChangeSection: (event: React.ChangeEvent<HTMLInputElement>) => void;
}
const SectionPosition = ({
  index,
  section,
  onChangeSection,
}: SectionPositionProps) => {
  const classes = useCustomStyles();
  const theme = useTheme();
  const breakpointIsXs = useMediaQuery(theme.breakpoints.down("sm"));
  return (
    <React.Fragment>
      <ListItemText>
        <Grid container spacing={2} alignItems="center">
          {index !== 1 && <Grid size={12} sx={{marginTop: "0.5em"}} />}
          {!breakpointIsXs && (
            <Grid
              size={{xs: 1, sm: 1}}
              key={"section_pos_grid_" + section.uid}
              sx={classes.centerCenter}
            />
          )}

          <Grid
            size={{xs: breakpointIsXs ? 12 : 11, sm: breakpointIsXs ? 12 : 11}}
            key={"section_name_grid_" + section.uid}
            // Sonst crasht das Feld in den Secondary-Action-Button
            sx={{paddingRight: theme.spacing(2)}}
          >
            <TextField
              key={"name" + section.uid}
              id={"name_" + section.uid}
              value={section.name}
              label={TEXT.FIELD_SECTION_NAME}
              onChange={onChangeSection}
              fullWidth
            />
          </Grid>
        </Grid>
      </ListItemText>
    </React.Fragment>
  );
};
/* ===================================================================
// ==================== Kontextmenü für Positionen ===================
// =================================================================== */
interface PositionMoreClickContextMenuProps {
  anchorEl: HTMLElement | null;
  handleMenuClick: (event: React.MouseEvent<HTMLElement>) => void;
  handleMenuClose: () => void;
  recipeBlock: RecipeBlock;
  uid: string;
  firstElement?: boolean;
  lastElement?: boolean;
}
const PositionMoreClickContextMenu = ({
  anchorEl,
  handleMenuClick,
  handleMenuClose,
  recipeBlock,
  uid,
  firstElement,
  lastElement,
}: PositionMoreClickContextMenuProps) => {
  return (
    <Menu
      keepMounted
      id={"positionMenu"}
      anchorEl={anchorEl}
      open={Boolean(anchorEl)}
      onClose={handleMenuClose}
    >
      <MenuItem
        id={recipeBlock + "_" + Action.ADD + "_" + uid}
        onClick={handleMenuClick}
      >
        <ListItemIcon>
          <AddIcon fontSize="small" />
        </ListItemIcon>
        <Typography variant="inherit">{TEXT.TOOLTIP_ADD_POS}</Typography>
      </MenuItem>
      {recipeBlock !== RecipeBlock.materials && (
        <MenuItem
          id={recipeBlock + "_" + Action.NEWSECTION + "_" + uid}
          onClick={handleMenuClick}
        >
          <ListItemIcon>
            <ViewDayIcon fontSize="small" />
          </ListItemIcon>
          <Typography variant="inherit">{TEXT.TOOLTIP_ADD_SECTION}</Typography>
        </MenuItem>
      )}
      <MenuItem
        id={recipeBlock + "_" + Action.DELETE + "_" + uid}
        onClick={handleMenuClick}
      >
        <ListItemIcon>
          <DeleteIcon fontSize="small" />
        </ListItemIcon>
        <Typography variant="inherit" noWrap>
          {TEXT.BUTTON_DELETE}
        </Typography>
      </MenuItem>
      <MenuItem
        id={recipeBlock + "_" + Action.MOVEUP + "_" + uid}
        onClick={handleMenuClick}
        disabled={firstElement}
      >
        <ListItemIcon>
          <ArrowUpwardIcon fontSize="small" />
        </ListItemIcon>
        <Typography variant="inherit" noWrap>
          {TEXT.TOOLTIP_MOVE_UP}
        </Typography>
      </MenuItem>
      <MenuItem
        id={recipeBlock + "_" + Action.MOVEDOWN + "_" + uid}
        onClick={handleMenuClick}
        disabled={lastElement}
      >
        <ListItemIcon>
          <ArrowDownwardIcon fontSize="small" />
        </ListItemIcon>
        <Typography variant="inherit" noWrap>
          {TEXT.TOOLTIP_MOVE_DOWN}
        </Typography>
      </MenuItem>
    </Menu>
  );
};
/* ===================================================================
// ========================= Varianten-Notiz =========================
// =================================================================== */
interface RecipeVariantNoteProps {
  recipe: Recipe;
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
}
const RecipeVariantNote = ({recipe, onChange}: RecipeVariantNoteProps) => {
  return (
    <React.Fragment>
      <Typography
        component="h2"
        variant="h4"
        align="center"
        sx={{display: "block"}}
        gutterBottom
      >
        {TEXT.VARIANT_NOTE}
      </Typography>
      <Grid container spacing={2} alignItems="center">
        <Grid size={1} key={"grid_pos_note"} />
        <Grid size={11} key={"grid_note_note"}>
          <TextField
            id="variantProperties.note"
            key="variantProperties.note"
            name="variantProperties.note"
            multiline
            maxRows={4}
            fullWidth
            label={TEXT.NOTE}
            value={recipe.variantProperties?.note}
            onChange={onChange}
            sx={{marginBottom: "2ex"}}
          />
        </Grid>
      </Grid>
    </React.Fragment>
  );
};
export {RecipeEdit};
