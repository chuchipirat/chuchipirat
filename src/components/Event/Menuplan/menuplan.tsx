import React, {
  useState,
  useEffect,
  useContext,
  createContext,
  useMemo,
  useCallback,
  useRef,
} from "react";
import {pdf} from "@react-pdf/renderer";
import {saveAs} from "file-saver";

//FIXME: Kommentare und nicht benötige imports löschen
// TODO: Syntax Error beheben.
import {
  Box,
  Container,
  Switch,
  Button,
  ToggleButton,
  ToggleButtonGroup,
  Card,
  FormGroup,
  FormControlLabel,
  Checkbox,
  CardHeader,
  IconButton,
  Menu,
  MenuItem,
  ListItemIcon,
  Typography,
  CardContent,
  TextField,
  InputAdornment,
  List,
  ListItem,
  ListItemSecondaryAction,
  ListSubheader,
  Drawer,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  useTheme,
  Tooltip,
  Divider,
  ListItemText,
  useMediaQuery,
} from "@mui/material";
import Grid from "@mui/material/Grid";

import {alpha} from "@mui/system/colorManipulator";

import {
  MoreVert as MoreVertIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Add as AddIcon,
  // ShoppingCart as ShoppingCartIcon,
  // Build as BuildIcon,
  Close as CloseIcon,
  Info as InfoIcon,
  // Notes as NotesIcon,
  Edit,
  // DeleteSweep as DeleteSweepIcon,
  ArrowDownward as ArrowDownwardIcon,
  ArrowUpward as ArrowUpwardIcon,
} from "@mui/icons-material";

import useCustomStyles from "../../../constants/styles";

import Menuplan, {
  MealType,
  Menue,
  Note,
  Meal,
  PlanedDiet,
  PlanedIntolerances,
  PortionPlan,
  PlanedMealsRecipe,
  MealRecipe,
  GoodsType,
  GoodsPlanMode,
  MenuplanMaterial,
  MenuplanProduct,
  MealRecipes,
  // MealRecipeDeletedPrefix,
  MenueListOrderTypes,
} from "./menuplan.class";
import {
  isMenueCardData,
  isDraggingAMenueCard,
  MenueListOfMeal,
  isMenueCardDropTargetData,
  isMenueCardContainerDropTargetData,
} from "./menuplan.menucard";
import {AutocompleteChangeReason} from "@mui/material/Autocomplete";

import {OnRecipeCardClickProps} from "../../Recipe/recipes";
import {
  SHOW_DETAILS as TEXT_SHOW_DETAILS,
  ENABLE_DRAG_AND_DROP as TEXT_ENABLE_DRAG_AND_DROP,
  ADD_MEAL as TEXT_ADD_MEAL,
  RENAME as TEXT_RENAME,
  DELETE as TEXT_DELETE,
  MEAL as TEXT_MEAL,
  NOTE as TEXT_NOTE,
  EDIT as TEXT_EDIT,
  ADD as TEXT_ADD,
  CLOSE as TEXT_CLOSE,
  CANCEL as TEXT_CANCEL,
  APPLY as TEXT_APPLY,
  NEW_MENU as TEXT_NEW_MENU,
  // ADD_RECIPE as TEXT_ADD_RECIPE,
  // EDIT_MENUE as TEXT_EDIT_MENUE,
  // ADD_PRODUCT as TEXT_ADD_PRODUCT,
  // ADD_MATERIAL as TEXT_ADD_MATERIAL,
  PRODUCTS as TEXT_PRODUCTS,
  MATERIAL as TEXT_MATERIAL,
  RECIPES as TEXT_RECIPES,
  RECIPES_DRAWER_TITLE as TEXT_RECIPES_DRAWER_TITLE,
  // MENUE as TEXT_MENUE,
  DIALOG_PLAN_RECIPE_PORTIONS_TITLE as TEXT_DIALOG_PLAN_RECIPE_PORTIONS_TITLE,
  DIALOG_PLAN_GOODS_PORTIONS_TITLE as TEXT_DIALOG_PLAN_GOODS_PORTIONS_TITLE,
  ALL as TEXT_ALL,
  FIX_PORTIONS as TEXT_FIX_PORTIONS,
  ON_DATE as TEXT_ON_DATE,
  KEEP_PLANED_PORTIONS_IN_SYNC as TEXT_KEEP_PLANED_PORTIONS_IN_SYNC,
  FACTOR as TEXT_FACTOR,
  TOTAL_PORTIONS as TEXT_TOTAL_PORTIONS,
  FACTOR_TOOLTIP as TEXT_FACTOR_TOOLTIP,
  PORTIONS as TEXT_PORTIONS,
  PORTION as TEXT_PORTION,
  YOUR_SELECTION_MAKES_X_SERVINGS as TEXT_YOUR_SELECTION_MAKES_X_SERVINGS,
  BACK as TEXT_BACK,
  NO_OF_SERVINGS as TEXT_NO_OF_SERVINGS,
  PLEASE_PROVIDE_VALID_FACTOR as TEXT_PLEASE_PROVIDE_VALID_FACTOR,
  MISSING_FACTOR as TEXT_MISSING_FACTOR,
  NO_GROUP_SELECTED as TEXT_NO_GROUP_SELECTED,
  NO_PORTIONS_GIVEN as TEXT_NO_PORTIONS_GIVEN,
  // DELETE_MENUE as TEXT_DELETE_MENUE,
  TOTAL as TEXT_TOTAL,
  PER_PORTION as TEXT_PER_PORTION,
  EXPLANATION_DIALOG_GOODS_TYPE_PRODUCT as TEXT_EXPLANATION_DIALOG_GOODS_TYPE_PRODUCT,
  EXPLANATION_DIALOG_GOODS_TYPE_MATERIAL as TEXT_EXPLANATION_DIALOG_GOODS_TYPE_MATERIAL,
  EXPLANATION_DIALOG_GOODS_OPTION_TOTAL as TEXT_EXPLANATION_DIALOG_GOODS_OPTION_TOTAL,
  EXPLANATION_DIALOG_GOODS_OPTION_PER_PORTION as TEXT_EXPLANATION_DIALOG_GOODS_OPTION_PER_PORTION,
  QUANTITY as TEXT_QUANTITY,
  OK as TEXT_OK,
  PRINTVERSION as TEXT_PRINTVERSION,
  SUFFIX_PDF as TEXT_SUFFIX_PDF,
  ALL_MEAL_AND_VALUES_WILL_BE_DELETED as TEXT_ALL_MEAL_AND_VALUES_WILL_BE_DELETED,
  ATTENTION as TEXT_ATTENTION,
  ALL_RECIPES_AND_VALUES_WILL_BE_DELETED as TEXT_ALL_RECIPES_AND_VALUES_WILL_BE_DELETED,
  VARIANT as TEXT_VARIANT,
  // RECIPE_WIHOUT_PORTIONPLAN as TEXT_RECIPE_WIHOUT_PORTIONPLAN,
  DIALOG_CHOOSE_MENUES_TITLE as TEXT_DIALOG_CHOOSE_MENUES_TITLE,
  DIALOG_CHOOSE_MEALS_TITLE as TEXT_DIALOG_CHOOSE_MEALS_TITLE,
  PRODUCT as TEXT_PRODUCT,
  TOOLTIP_MOVE_UP as TEXT_TOOLTIP_MOVE_UP,
  TOOLTIP_MOVE_DOWN as TEXT_TOOLTIP_MOVE_DOWN,
  CONFIRM_DIET_SWITCH as TEXT_CONFIRM_DIET_SWITCH,
  PROCEED as TEXT_PROCEED,
} from "../../../constants/text";
import {
  FetchMissingDataType,
  FetchMissingDataProps,
  OnMasterdataCreateProps,
  MasterDataCreateType,
} from "../Event/event";
import {
  DraggableState,
  idleState,
  draggingState,
  ListContextValue,
  ItemEntry,
  LastCardMoved,
} from "../../../constants/dragAndDrop";
import invariant from "tiny-invariant";
import {
  draggable,
  dropTargetForElements,
  monitorForElements,
} from "@atlaskit/pragmatic-drag-and-drop/element/adapter";
import {
  attachClosestEdge,
  type Edge,
  extractClosestEdge,
} from "@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge";
import {reorder} from "@atlaskit/pragmatic-drag-and-drop/reorder";
import {combine} from "@atlaskit/pragmatic-drag-and-drop/combine";
import {reorderWithEdge} from "@atlaskit/pragmatic-drag-and-drop-hitbox/util/reorder-with-edge";

import {triggerPostMoveFlash} from "@atlaskit/pragmatic-drag-and-drop-flourish/trigger-post-move-flash";
import {getReorderDestinationIndex} from "@atlaskit/pragmatic-drag-and-drop-hitbox/util/get-reorder-destination-index";
import {autoScrollForElements} from "@atlaskit/pragmatic-drag-and-drop-auto-scroll/element";
import {unsafeOverflowAutoScrollForElements} from "@atlaskit/pragmatic-drag-and-drop-auto-scroll/unsafe-overflow/element";

import {DropIndicator} from "@atlaskit/pragmatic-drag-and-drop-react-drop-indicator/box";
import mergeRefs from "@atlaskit/ds-lib/merge-refs";
import {bindAll} from "bind-event-listener";
import type {CleanupFn} from "@atlaskit/pragmatic-drag-and-drop/types";

import MenuplanPdf from "./menuplanPdf";
import Utils from "../../Shared/utils.class";
import Firebase from "../../Firebase/firebase.class";
import AuthUser from "../../Firebase/Authentication/authUser.class";
import Action from "../../../constants/actions";

import {RecipeSearch} from "../../Recipe/recipes";
import RecipeShort from "../../Recipe/recipeShort.class";
import type {OnAddToEvent} from "../../Recipe/recipe.view";
import Recipe, {RecipeType, Recipes} from "../../Recipe/recipe.class";
import EventGroupConfiguration, {
  Intolerance,
  Diet,
} from "../GroupConfiguration/groupConfiguration.class";
import {FormValidationFieldError} from "../../Shared/fieldValidation.error.class";
import UnitAutocomplete from "../../Unit/unitAutocomplete";
import Unit from "../../Unit/unit.class";
import Product from "../../Product/product.class";
import ProductAutocomplete from "../../Product/productAutocomplete";
import MaterialAutocomplete from "../../Material/materialAutocomplete";
import Material from "../../Material/material.class";
import DialogMaterial, {
  MATERIAL_POP_UP_VALUES_INITIAL_STATE,
  MaterialDialog,
} from "../../Material/dialogMaterial";
import DialogProduct, {
  PRODUCT_POP_UP_VALUES_INITIAL_STATE,
  ProductDialog,
} from "../../Product/dialogProduct";
import Department from "../../Department/department.class";
import Event, {EventRefDocuments} from "../Event/event.class";
import {
  DialogType,
  SingleTextInputResult,
  useCustomDialog,
} from "../../Shared/customDialogContext";
import {
  DialogSelectMenues,
  DialogSelectMenuesForRecipeDialogValues,
} from "./dialogSelectMenues";
import {
  NavigationValuesContext,
  NavigationObject,
} from "../../Navigation/navigationContext";
import {
  isCardListData,
  isCardListDropTargetData,
  isListContainerDropTargetData,
  isDraggingACardListItem,
} from "./menuplan.menucard.list";
import {
  EmptyMealContainer,
  isEmptyContainerData,
} from "./menuplan.emptycontainer";
import {DialogSelectMeals} from "./dialogSelectMeals";

/* ===================================================================
// ============================== Global =============================
// =================================================================== */
export interface MenuplanSettings {
  showDetails: boolean;
  enableDragAndDrop: boolean;
}

interface onMenuplanUpdate {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}
export enum MenuplanDragDropTypes {
  MEALTYPE = "MEALTYPE",
  MENU = "MENU",
  MEALRECIPE = "RECIPE",
  PRODUCT = "PRODUCT",
  MATERIAL = "MATERIAL",
}

const getOrderListNameFromDragAndDropTypes = (
  dragAndDropType: MenuplanDragDropTypes,
) => {
  switch (dragAndDropType) {
    case MenuplanDragDropTypes.MEALRECIPE:
      return MenueListOrderTypes.mealRecipeOrder;
    case MenuplanDragDropTypes.MATERIAL:
      return MenueListOrderTypes.materialOrder;
    case MenuplanDragDropTypes.PRODUCT:
      return MenueListOrderTypes.productOrder;
    case MenuplanDragDropTypes.MEALTYPE:
      return MenueListOrderTypes.mealTypeOrder;
    case MenuplanDragDropTypes.MENU:
      return MenueListOrderTypes.menuOrder;
  }
};

enum MenueEditTypes {
  NOTE = "NOTE",
  MEALRECIPE = "MEALRECIPE",
  PRODUCT = "PRODUCT",
  MATERIAL = "MATERIAL",
}
import {
  RecipeDrawer,
  RecipeDrawerData,
  DrawerSettings,
  RECIPE_DRAWER_DATA_INITIAL_VALUES,
} from "../../Recipe/RecipeDrawer";
interface RecipeSearchDrawerData extends DrawerSettings {
  menue: Menue | null;
}
interface OnRecipeSelection {
  // event: React.MouseEvent<HTMLButtonElement>;
  recipe: RecipeShort;
}
interface GeneratePlanedPortionsTextProps {
  uid: string;
  portionPlan: PortionPlan[];
  groupConfiguration: EventGroupConfiguration;
}

export const generatePlanedPortionsText = ({
  uid,
  portionPlan,
  groupConfiguration,
}: GeneratePlanedPortionsTextProps) => {
  return portionPlan.map((plan, index) => (
    <React.Fragment key={"listItem" + uid + "_" + index}>
      {`${plan.factor != 1 ? `${plan.factor} × ` : ``} ${
        plan.diet == PlanedDiet.ALL
          ? TEXT_ALL
          : plan.diet == PlanedDiet.FIX
            ? ""
            : groupConfiguration.diets.entries[plan.diet].name
      }${
        plan.intolerance == PlanedIntolerances.ALL
          ? ""
          : plan.intolerance == PlanedIntolerances.FIX
            ? ""
            : `, ${
                groupConfiguration.intolerances.entries[plan.intolerance].name
              }`
      } (${plan.totalPortions.toFixed(1)} ${
        plan.totalPortions == 1 ? TEXT_PORTION : TEXT_PORTIONS
      })`}

      {index !== portionPlan.length - 1 && <br />}
      {/* Zeilenumbruch, außer beim letzten Element */}
    </React.Fragment>
  ));
};

/* ===================================================================
// ================= Drag & Drop Context für Meal Row ================
// =================================================================== */
const MealTypesRowContext = createContext<ListContextValue | null>(null);

function useMealTypeRowContext() {
  const rowContext = useContext(MealTypesRowContext);
  invariant(rowContext !== null);
  return rowContext;
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
export const blockBoardPanningAttr = "data-block-board-panning" as const;

export type DragAndDropDirections = "up" | "down" | "inOtherMenu";
export interface DragAndDropMoveCommand {
  kind: MenuplanDragDropTypes;
  direction: DragAndDropDirections;
  menueUid?: Menue["uid"];
  mealUid?: Meal["uid"];
  itemUid: string;
}
export type OnMoveDragAndDropElementFx = (cmd: DragAndDropMoveCommand) => void;
/* ===================================================================
// ============================= Menüplan ============================
// =================================================================== */
interface MenuplanPageProps {
  menuplan: Menuplan;
  recipes: Recipes;
  recipeList: RecipeShort[];
  groupConfiguration: EventGroupConfiguration;
  event: Event;
  units: Unit[];
  products: Product[];
  materials: Material[];
  departments: Department[];
  firebase: Firebase;
  authUser: AuthUser;
  onMenuplanUpdate: (menuplan: Menuplan) => void;
  fetchMissingData: ({type, recipeShort}: FetchMissingDataProps) => void;
  onMasterdataCreate: ({type, value}: OnMasterdataCreateProps) => void;
  onRecipeUpdate: (recipe: Recipe) => void;
}
interface DialogSelectMenueData {
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
interface DialogSelectMealData {
  open: boolean;
  dragAndDropHandler: {
    menuUid: Menue["uid"];
    mealUid: Meal["uid"];
  };
}
interface DialogPlanPortionsData {
  open: boolean;
  menues: DialogSelectMenuesForRecipeDialogValues | null;
  mealRecipeUid: MealRecipe["uid"];
  portionPlan: PortionPlan[];
  planedMaterial: MenuplanMaterial | null;
  planedProduct: MenuplanProduct | null;
  planedObject: PlanedObject;
}
interface DialotEditMenue {
  open: boolean;
  menueUid: Menue["uid"];
}
interface DialogGoods {
  open: boolean;
  menueUid: Menue["uid"];
  goodsType: GoodsType;
  product: MenuplanProduct | null;
  material: MenuplanMaterial | null;
}
const MenuplanPage = ({
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
  onMenuplanUpdate: onMenuplanUpdateSuper,
  onRecipeUpdate: onRecipeUpdateSuper,
  fetchMissingData,
  onMasterdataCreate,
}: MenuplanPageProps) => {
  const theme = useTheme();
  const {customDialog} = useCustomDialog();
  const navigationValuesContext = useContext(NavigationValuesContext);

  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const userDidChangeDnD = useRef(false);

  const [menuplanSettings, setMenuPlanSettings] = useState<MenuplanSettings>({
    showDetails: false,
    enableDragAndDrop: false,
  });
  const [recipeSearchDrawerData, setRecipeSearchDrawerData] =
    useState<RecipeSearchDrawerData>({
      open: false,
      isLoadingData: false,
      menue: null,
    });
  // Zähler zum Zurücksetzen der Suche im Rezept-Drawer nach dem Hinzufügen
  const [recipeSearchResetKey, setRecipeSearchResetKey] = useState(0);

  const [recipeDrawerData, setRecipeDrawerData] = useState<RecipeDrawerData>(
    RECIPE_DRAWER_DATA_INITIAL_VALUES,
  );
  const [dialogSelectMenueData, setDialogSelectMenueData] =
    useState<DialogSelectMenueData>({
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
    });
  const [dialogSelectMealData, setDialogSelectMealData] =
    useState<DialogSelectMealData>({
      open: false,
      dragAndDropHandler: {menuUid: "", mealUid: ""},
    });

  const [dialogPlanPortionsData, setDialogPlanPortionsData] =
    useState<DialogPlanPortionsData>({
      open: false,
      menues: null,
      mealRecipeUid: "",
      portionPlan: [],
      planedMaterial: null,
      planedProduct: null,
      planedObject: PlanedObject.RECIPE,
    });
  const [dialogEditMenue, setDialogEditMenue] = useState<DialotEditMenue>({
    open: false,
    menueUid: "",
  });
  const GOODS_DATA_DIALOG_INITIAL_DATA: DialogGoods = {
    open: false,
    menueUid: "",
    goodsType: GoodsType.NONE,
    product: null,
    material: null,
  };
  // Dialog für Produkte und Material ==> Goods
  const [dialogGoodsData, setDialogGoodsData] = useState<DialogGoods>(
    GOODS_DATA_DIALOG_INITIAL_DATA,
  );
  const scrollableRef = useRef<HTMLDivElement | null>(null);
  const headerScrollRef = useRef<HTMLDivElement | null>(null);

  /* ------------------------------------------
  // Navigation-Handler
  // ------------------------------------------ */
  useEffect(() => {
    navigationValuesContext?.setNavigationValues({
      action: Action.NONE,
      object: NavigationObject.menueplan,
    });
  }, []);
  /* ------------------------------------------
  // Auto-Scroll zum heutigen Tag
  // ------------------------------------------ */
  useEffect(() => {
    if (!headerScrollRef.current || !scrollableRef.current || menuplan.dates.length === 0) return;

    const today = Utils.dateAsString(new Date());
    const todayColumn = headerScrollRef.current.querySelector(
      `[data-date="${today}"]`
    );

    if (todayColumn) {
      requestAnimationFrame(() => {
        const columnEl = todayColumn as HTMLElement;
        const scrollTarget = columnEl.offsetLeft - parseInt(theme.spacing(4));
        scrollableRef.current!.scrollTo({
          left: scrollTarget,
          behavior: "smooth",
        });
        headerScrollRef.current!.scrollTo({
          left: scrollTarget,
          behavior: "smooth",
        });
      });
    }
  }, [menuplan.dates]);
  /* ------------------------------------------
  // Initiale-Einstellungen vornehmen
  // ------------------------------------------ */
  if (recipeSearchDrawerData.isLoadingData && recipeList.length > 0) {
    // Loading-Anzeige der Rezepte wieder abstellen
    setRecipeSearchDrawerData({
      ...recipeSearchDrawerData,
      isLoadingData: false,
    });
  }
  if (recipeDrawerData.isLoadingData) {
    if (!recipeDrawerData.recipe.name) {
      // Aktualisierte Werte setzen // es wurden erst die Infos aus der
      // RecipeShort gesetzt. Diese mal anzeigen
      setRecipeDrawerData({
        ...recipeDrawerData,
        isLoadingData:
          recipes[recipeDrawerData.recipe.uid].portions > 0 ? false : true,
        recipe: recipes[recipeDrawerData.recipe.uid],
      });
    } else if (
      recipeDrawerData.recipe?.portions == 0 &&
      recipes[recipeDrawerData.recipe.uid]?.portions > 0
    ) {
      // Nun ist alles da. Loading-Kreis ausblenden
      setRecipeDrawerData({
        ...recipeDrawerData,
        isLoadingData: false,
        recipe: recipes[recipeDrawerData.recipe.uid],
      });
    }
  }

  useEffect(() => {
    if (userDidChangeDnD.current) {
      // Wenn der User üebrsteuert hat, machen wir nichts mehr
      return;
    }
    setMenuPlanSettings({
      ...menuplanSettings,
      enableDragAndDrop: !isMobile,
    });
  }, [isMobile]);

  /* ------------------------------------------
  // Drag & Drop Handling
  // ------------------------------------------ */
  useEffect(() => {
    const element = scrollableRef.current;

    invariant(element);
    return combine(
      monitorForElements({
        canMonitor: isDraggingACardListItem,
        onDrop({source, location}) {
          const dragging = source.data;
          if (!isCardListData(dragging)) {
            return;
          }
          const innerMost = location.current.dropTargets[0];

          if (!innerMost) {
            return;
          }

          // Herausfinden wo zu Hause
          const homeMenue: Menue | undefined =
            menuplan.menues[dragging.menueUid];
          if (!homeMenue) {
            return;
          }

          // In welcher Liste befindet sich das Objekt?
          const homeOrderList = (() => {
            switch (dragging.itemType) {
              case MenuplanDragDropTypes.MEALRECIPE:
                return homeMenue.mealRecipeOrder;
              case MenuplanDragDropTypes.MATERIAL:
                return homeMenue.materialOrder;
              case MenuplanDragDropTypes.PRODUCT:
                return homeMenue.productOrder;
            }
          })();

          const orderListName = getOrderListNameFromDragAndDropTypes(
            dragging.itemType,
          );

          if (
            orderListName !== "mealRecipeOrder" &&
            orderListName !== "materialOrder" &&
            orderListName !== "productOrder"
          ) {
            return;
          }

          if (!homeOrderList || !orderListName) {
            return;
          }
          const homeListItemIndex = homeOrderList.findIndex(
            (listItemUid) => listItemUid == dragging.listItem.id,
          );

          // Drop auf eine Liste
          const dropTargetData = innerMost.data;
          if (isCardListDropTargetData(dropTargetData)) {
            const destinationMenue: Menue | undefined =
              menuplan.menues[dropTargetData.menueUid];
            if (!destinationMenue) {
              return;
            }
            // unable to find destination
            if (!destinationMenue) {
              console.warn("Drag & Drop kein Ziel gefunden");
              return;
            }

            // reordering in home column
            if (homeMenue === destinationMenue) {
              const destinationListItemIndex = homeOrderList.findIndex(
                (listItemUid) => listItemUid === dropTargetData.listItem.id,
              );
              // could not find cards needed
              if (homeListItemIndex === -1 || destinationListItemIndex === -1) {
                return;
              }
              // no change needed
              if (homeListItemIndex === destinationListItemIndex) {
                return;
              }
              const closestEdge = extractClosestEdge(dropTargetData);
              const reorderedList = reorderWithEdge({
                axis: "vertical",
                list: homeOrderList,
                startIndex: homeListItemIndex,
                indexOfTarget: destinationListItemIndex,
                closestEdgeOfTarget: closestEdge,
              });
              onMenuplanUpdateSuper({
                ...menuplan,
                menues: {
                  ...menuplan.menues,
                  [dragging.menueUid]: {
                    ...homeMenue,
                    [orderListName]: reorderedList,
                  },
                },
              });
              return;
            }
            // In welcher Liste befindet sich das Objekt?
            const destinationOrderList = (() => {
              switch (dragging.itemType) {
                case MenuplanDragDropTypes.MEALRECIPE:
                  return destinationMenue.mealRecipeOrder;
                case MenuplanDragDropTypes.MATERIAL:
                  return destinationMenue.materialOrder;
                case MenuplanDragDropTypes.PRODUCT:
                  return destinationMenue.productOrder;
              }
            })();

            if (!destinationOrderList) {
              return;
            }

            const destinationListItemIndex = destinationOrderList.findIndex(
              (listItemUid) => listItemUid == dropTargetData.listItem.id,
            );

            const closestEdge = extractClosestEdge(dropTargetData);
            const finalIndex =
              closestEdge === "bottom"
                ? destinationListItemIndex + 1
                : destinationListItemIndex;

            // remove card from home list
            const homeReorderedList = [...homeOrderList];
            homeReorderedList.splice(homeListItemIndex, 1);
            // insert into destination list
            const destinationReorderedList = [...destinationOrderList];
            destinationReorderedList.splice(
              finalIndex,
              0,
              dragging.listItem.id,
            );

            onMenuplanUpdateSuper({
              ...menuplan,
              menues: {
                ...menuplan.menues,
                [dragging.menueUid]: {
                  ...homeMenue,
                  [orderListName]: homeReorderedList,
                },
                [destinationMenue.uid]: {
                  ...destinationMenue,
                  [orderListName]: destinationReorderedList,
                },
              },
            });
            return;
          }

          // Drop auf eine Karte (aber nicht Liste)
          if (isMenueCardData(dropTargetData)) {
            const destinationMenue =
              menuplan.menues[dropTargetData.listItem.menue.uid];
            if (!destinationMenue) {
              return;
            }

            // Drop auf gleiches Menü
            if (homeMenue === destinationMenue) {
              // an letzte Stelle verschieben
              const reorderedList = reorder({
                list: homeMenue[orderListName],
                startIndex: homeListItemIndex,
                finishIndex: homeMenue[orderListName].length - 1,
              });

              onMenuplanUpdateSuper({
                ...menuplan,
                menues: {
                  ...menuplan.menues,
                  [dragging.menueUid]: {
                    ...homeMenue,
                    [orderListName]: reorderedList,
                  },
                },
              });
              return;
            }

            // Aus Homeliste entfernen
            const homeReorderedList = homeOrderList;
            homeReorderedList.splice(homeListItemIndex, 1);

            // In Zielliste einfügen
            const destinationReorderedList = destinationMenue[orderListName];
            destinationReorderedList.splice(
              destinationReorderedList.length,
              0,
              dragging.listItem.id,
            );

            onMenuplanUpdateSuper({
              ...menuplan,
              menues: {
                ...menuplan.menues,
                [dragging.menueUid]: {
                  ...homeMenue,
                  [orderListName]: homeReorderedList,
                },
                [destinationMenue.uid]: {
                  ...destinationMenue,
                  [orderListName]: destinationReorderedList,
                },
              },
            });
            return;
          }
          // Drop auf leere Liste
          if (isListContainerDropTargetData(dropTargetData)) {
            const destinationMenue = menuplan.menues[dropTargetData.menueUid];

            if (!destinationMenue || !dropTargetData.isEmpty) {
              return;
            }

            // Element aus Home-Liste entfernen
            const homeReorderedList = homeOrderList;
            homeReorderedList.splice(homeListItemIndex, 1);

            // Element in leere Ziel-Liste einfügen
            const destinationReorderedList = [dragging.listItem.id];
            onMenuplanUpdateSuper({
              ...menuplan,
              menues: {
                ...menuplan.menues,
                [dragging.menueUid]: {
                  ...homeMenue,
                  [orderListName]: homeReorderedList,
                },
                [destinationMenue.uid]: {
                  ...destinationMenue,
                  [orderListName]: destinationReorderedList,
                },
              },
            });
            return;
          }
        },
      }),
      monitorForElements({
        canMonitor: isDraggingAMenueCard,
        onDrop({source, location}) {
          //  Menü-Card wurd verschoben

          const dragging = source.data;
          if (!isMenueCardData(dragging)) {
            return;
          }

          const innerMost = location.current.dropTargets[0];

          if (!innerMost) {
            return;
          }
          const dropTargetData = innerMost.data;

          // Drop auf leeren Container
          if (isEmptyContainerData(dropTargetData)) {
            const homeMeal = menuplan.meals[dragging.mealUid];
            const destinationMeal = menuplan.meals[dropTargetData.mealUid];

            if (!homeMeal || !destinationMeal) {
              return;
            }

            if (homeMeal.uid === destinationMeal.uid) {
              // Gleiche Mahlzeit - keine Änderung nötig
              return;
            }

            const homeMenuIndex = homeMeal.menuOrder.findIndex(
              (menuUid) => menuUid == dragging.listItem.menue.uid,
            );

            if (homeMenuIndex === -1) {
              return;
            }

            // Menü aus Home-Mahlzeit entfernen
            const homeReorderedList = [...homeMeal.menuOrder];
            homeReorderedList.splice(homeMenuIndex, 1);

            // In leere Ziel-Mahlzeit einfügen
            const destinationReorderedList = [dragging.listItem.menue.uid];

            onMenuplanUpdateSuper({
              ...menuplan,
              meals: {
                ...menuplan.meals,
                [homeMeal.uid]: {
                  ...homeMeal,
                  menuOrder: homeReorderedList,
                },
                [destinationMeal.uid]: {
                  ...destinationMeal,
                  menuOrder: destinationReorderedList,
                },
              },
            });
            return;
          }

          if (
            !isMenueCardData(dropTargetData) &&
            !isMenueCardDropTargetData(dropTargetData) &&
            !isMenueCardContainerDropTargetData(dropTargetData)
          ) {
            return;
          }

          const homeMeal = menuplan.meals[dragging.mealUid];
          const destinationMeal = menuplan.meals[dropTargetData.mealUid];

          if (!homeMeal || !destinationMeal) {
            return;
          }

          const homeMenuIndex = homeMeal.menuOrder.findIndex(
            (menuUid) => menuUid == dragging.listItem.menue.uid,
          );
          let destinationMenuIndex = -1;
          if (!isMenueCardContainerDropTargetData(dropTargetData)) {
            destinationMenuIndex = destinationMeal.menuOrder.findIndex(
              (menuUid) => menuUid === dropTargetData.listItem.menue.uid,
            );
          } else {
            destinationMenuIndex = destinationMeal.menuOrder.length;
          }

          // could not find cards needed
          if (homeMenuIndex === -1 || destinationMenuIndex === -1) {
            return;
          }

          if (homeMeal.uid === destinationMeal.uid) {
            // Wird nur in der Position verschoben im gleich Meal
            const closestEdge = extractClosestEdge(dropTargetData);
            const reorderedList = reorderWithEdge({
              axis: "vertical",
              list: homeMeal.menuOrder,
              startIndex: homeMenuIndex,
              indexOfTarget: destinationMenuIndex,
              closestEdgeOfTarget: closestEdge,
            });

            onMenuplanUpdateSuper({
              ...menuplan,
              meals: {
                ...menuplan.meals,
                [dragging.mealUid]: {
                  ...homeMeal,
                  menuOrder: reorderedList,
                },
              },
            });
            return;
          }

          const closestEdge = extractClosestEdge(dropTargetData);
          const finalIndex =
            closestEdge === "bottom"
              ? destinationMenuIndex + 1
              : destinationMenuIndex;

          // Menü aus Home-Mahlzeit entfernen
          const homeReorderedList = [...homeMeal.menuOrder];
          homeReorderedList.splice(homeMenuIndex, 1);
          // In Ziel Mahlzeit einfügen
          const destinationReorderedList = [...destinationMeal.menuOrder];
          destinationReorderedList.splice(
            finalIndex,
            0,
            dragging.listItem.menue.uid,
          );

          onMenuplanUpdateSuper({
            ...menuplan,
            meals: {
              ...menuplan.meals,
              [homeMeal.uid]: {
                ...homeMeal,
                menuOrder: homeReorderedList,
              },
              [destinationMeal.uid]: {
                ...destinationMeal,
                menuOrder: destinationReorderedList,
              },
            },
          });
        },
      }),
      autoScrollForElements({
        canScroll({source}) {
          return (
            isDraggingACardListItem({source}) || isDraggingAMenueCard({source})
          );
        },
        element,
      }),
      unsafeOverflowAutoScrollForElements({
        element,
        canScroll({source}) {
          return (
            isDraggingACardListItem({source}) || isDraggingAMenueCard({source})
          );
        },
        getOverflow() {
          return {
            forLeftEdge: {top: 1000, left: 1000, bottom: 1000},
            forRightEdge: {top: 1000, right: 1000, bottom: 1000},
          };
        },
      }),
    );
  }, [menuplan.menues]);

  // Panning the board
  useEffect(() => {
    let cleanupActive: CleanupFn | null = null;
    const scrollable = scrollableRef.current;
    invariant(scrollable);

    function begin({startX}: {startX: number}) {
      let lastX = startX;

      const cleanupEvents = bindAll(
        window,
        [
          {
            type: "pointermove",
            listener(event) {
              const currentX = event.clientX;
              const diffX = lastX - currentX;

              lastX = currentX;
              scrollable?.scrollBy({left: diffX});
            },
          },
          // stop panning if we see any of these events
          ...(
            [
              "pointercancel",
              "pointerup",
              "pointerdown",
              "keydown",
              "resize",
              "click",
              "visibilitychange",
            ] as const
          ).map((eventName) => ({
            type: eventName,
            listener: () => cleanupEvents(),
          })),
        ],
        // need to make sure we are not after the "pointerdown" on the scrollable
        // Also this is helpful to make sure we always hear about events from this point
        {capture: true},
      );

      cleanupActive = cleanupEvents;
    }

    const cleanupStart = bindAll(scrollable, [
      {
        type: "pointerdown",
        listener(event) {
          if (!(event.target instanceof HTMLElement)) {
            return;
          }
          // ignore interactive elements
          if (event.target.closest(`[${blockBoardPanningAttr}]`)) {
            return;
          }

          begin({startX: event.clientX});
        },
      },
    ]);

    return function cleanupAll() {
      cleanupStart();
      cleanupActive?.();
    };
  }, []);
  /* ------------------------------------------
  // Setting-Handling
  // ------------------------------------------ */
  const onSwitchShowDetails = () =>
    setMenuPlanSettings({
      ...menuplanSettings,
      showDetails: !menuplanSettings.showDetails,
    });
  const onSwitchEnableDragAndDrop = () => {
    userDidChangeDnD.current = true;
    setMenuPlanSettings({
      ...menuplanSettings,
      enableDragAndDrop: !menuplanSettings.enableDragAndDrop,
    });
  };
  /* ------------------------------------------
  // Change-Handler
  // ------------------------------------------ */
  const onMealTypeUpdate = async ({action, mealType}: OnMealTypeUpdate) => {
    const tempMealTypes = {...menuplan.mealTypes};
    let mealTypes = {} as Menuplan["mealTypes"];
    let meals = {} as Menuplan["meals"];
    let menues = {} as Menuplan["menues"];
    let mealRecipes = {} as Menuplan["mealRecipes"];
    let products = {} as Menuplan["products"];
    let materials = {} as Menuplan["materials"];
    let isConfirmed: boolean;
    switch (action) {
      case Action.DELETE:
        isConfirmed = (await customDialog({
          dialogType: DialogType.Confirm,
          text: TEXT_ALL_MEAL_AND_VALUES_WILL_BE_DELETED,
          title: `⚠️  ${TEXT_ATTENTION}`,
          buttonTextConfirm: TEXT_DELETE,
        })) as boolean;
        if (!isConfirmed) {
          return;
        }

        ({mealTypes, meals, menues, mealRecipes, products, materials} =
          Menuplan.deleteMealType({
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
        ({mealTypes, meals, menues} = Menuplan.addMealType({
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
  };
  const onMenuplanUpdate = (valuesToUpdate: onMenuplanUpdate) => {
    // die geänderten Daten mit den aktuellen Menüplan mergen
    onMenuplanUpdateSuper({...menuplan, ...valuesToUpdate});
  };
  const onNoteUpdate = ({action, note}: OnNoteUpdate) => {
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
  };
  /* ------------------------------------------
  // PDF generieren
  // ------------------------------------------ */
  const onPrint = () => {
    pdf(<MenuplanPdf event={event} menuplan={menuplan} authUser={authUser} />)
      .toBlob()
      .then((result) => {
        saveAs(result, "Menueplan " + event.name + TEXT_SUFFIX_PDF);
      });
  };
  /* ------------------------------------------
  // Drag & Drop Handler
  // ------------------------------------------ */
  const onDragAndDropUpdate = (
    newOrder: string[],
    dragAndDropListType: MenuplanDragDropTypes,
  ) => {
    switch (dragAndDropListType) {
      case MenuplanDragDropTypes.MEALTYPE:
        onMenuplanUpdateSuper({
          ...menuplan,
          mealTypes: {
            entries: menuplan.mealTypes.entries,
            order: newOrder,
          },
        });
        break;
    }
  };
  // Element mittels Kontextmenü ändern
  const onMoveDragAndDropElement = ({
    kind,
    direction,
    menueUid,
    mealUid,
    itemUid,
  }: DragAndDropMoveCommand) => {
    if (direction === "inOtherMenu") {
      switch (kind) {
        case MenuplanDragDropTypes.MEALRECIPE:
        case MenuplanDragDropTypes.PRODUCT:
        case MenuplanDragDropTypes.MATERIAL:
          // Dialog anzeigen um das Element zu verschieben.
          if (!menueUid) {
            return;
          }
          setDialogSelectMenueData({
            open: true,
            menues: {
              [menueUid]: true,
            } as DialogSelectMenuesForRecipeDialogValues,
            selectedRecipe: {} as RecipeShort,
            singleSelection: true,
            caller: onMoveDragAndDropElement.name,
            dragAndDropHandler: {
              listElementUid: itemUid,
              menuUid: menueUid,
              dragAndDropListType: kind,
            },
          });
          break;
        case MenuplanDragDropTypes.MENU:
          if (!mealUid) {
            return;
          }

          setDialogSelectMealData({
            open: true,
            dragAndDropHandler: {menuUid: itemUid, mealUid: mealUid},
          });
      }
      return;
    }

    // In welcher Liste befindet sich das Objekt?
    const orderListName = getOrderListNameFromDragAndDropTypes(kind);
    if (!orderListName) {
      return;
    }

    if (
      (kind === MenuplanDragDropTypes.MEALRECIPE ||
        kind === MenuplanDragDropTypes.PRODUCT ||
        kind === MenuplanDragDropTypes.MATERIAL) &&
      !menueUid
    ) {
      return;
    } else if (kind === MenuplanDragDropTypes.MENU && !mealUid) {
      return;
    }

    const orderList = (() => {
      switch (kind) {
        case MenuplanDragDropTypes.MEALRECIPE:
          return menuplan.menues[menueUid!].mealRecipeOrder;
        case MenuplanDragDropTypes.PRODUCT:
          return menuplan.menues[menueUid!].productOrder;
        case MenuplanDragDropTypes.MATERIAL:
          return menuplan.menues[menueUid!].materialOrder;
        case MenuplanDragDropTypes.MEALTYPE:
          return menuplan.mealTypes.order;
        case MenuplanDragDropTypes.MENU:
          return menuplan.meals[mealUid!].menuOrder;
      }
    })();

    if (!orderList) {
      return;
    }

    const index = orderList.findIndex((item) => item === itemUid);
    if (index === -1) {
      return;
    }

    const targetIndex = direction === "up" ? index - 1 : index + 1;

    const reorderedList = [...orderList];
    [reorderedList[index], reorderedList[targetIndex]] = [
      reorderedList[targetIndex],
      reorderedList[index],
    ];

    switch (kind) {
      case MenuplanDragDropTypes.MEALRECIPE:
      case MenuplanDragDropTypes.PRODUCT:
      case MenuplanDragDropTypes.MATERIAL:
        onMenuplanUpdateSuper({
          ...menuplan,
          menues: {
            ...menuplan.menues,
            [menueUid!]: {
              ...menuplan.menues[menueUid!],
              [orderListName]: reorderedList,
            },
          },
        });
        break;
      case MenuplanDragDropTypes.MEALTYPE:
        onMenuplanUpdateSuper({
          ...menuplan,
          mealTypes: {
            entries: menuplan.mealTypes.entries,
            order: reorderedList,
          },
        });
        break;
      case MenuplanDragDropTypes.MENU:
        onMenuplanUpdateSuper({
          ...menuplan,
          meals: {
            ...menuplan.meals,
            [mealUid!]: {
              ...menuplan.meals[mealUid!],
              menuOrder: reorderedList,
            },
          },
        });
        break;
    }
  };
  /* ------------------------------------------
  // Drawer-Handling
  // ------------------------------------------ */
  const onAddRecipe = (menue: Menue) => {
    setRecipeSearchDrawerData({
      ...recipeSearchDrawerData,
      open: true,
      isLoadingData: recipeList.length == 0 ? true : false,
      menue: menue,
    });
    if (recipeList.length == 0) {
      fetchMissingData({type: FetchMissingDataType.RECIPES});
    }
  };
  const onRecipeSearchDrawerClose = () => {
    setRecipeSearchDrawerData({
      ...recipeSearchDrawerData,
      open: false,
    });
  };
  const onRecipeDrawerClose = () => {
    setRecipeDrawerData(RECIPE_DRAWER_DATA_INITIAL_VALUES);
  };
  const onRecipeCardClick = ({recipe: recipeShort}: OnRecipeCardClickProps) => {
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
  };
  const onRecipeSelection = ({recipe: recipeShort}: OnRecipeSelection) => {
    setDialogSelectMenueData({
      ...dialogSelectMenueData,
      open: true,
      menues: {
        [recipeSearchDrawerData?.menue?.uid as Menuplan["uid"]]: true,
      },
      selectedRecipe: recipeShort,
      singleSelection: false,
      caller: onRecipeSelection.name,
    });
  };
  const onRecipeUpdate = (recipe: Recipe) => {
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
        if (!event.refDocuments?.includes(EventRefDocuments.recipeVariants)) {
          // sichern das es auch Rezept-Varianten gibt
          Event.save({
            event: {
              ...event,
              refDocuments: Event.addRefDocument({
                refDocuments: event.refDocuments,
                newDocumentType: EventRefDocuments.recipeVariants,
              }),
            },
            firebase: firebase,
            authUser: authUser,
          });
        }
        // Variante wurde erstellt. jetzt wurde gespeichert
        if (recipeDrawerData.mealPlan.length > 0) {
          // Aus Rezept eine Variante erstellt . Bestehendes in MealRecipe austauschen
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
          caller: onRecipeUpdate.name,
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
              updatedMealRecipes[mealPlan.mealPlanRecipe].recipe.variantName !=
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
  };
  const onNewRecipe = () => {
    // Neues Rezept anlegen
    setRecipeDrawerData({
      ...RECIPE_DRAWER_DATA_INITIAL_VALUES,
      open: true,
      editMode: true,
    });
  };
  const onRecipeSwitchEditMode = () => {
    setRecipeDrawerData({
      ...recipeDrawerData,
      editMode: !recipeDrawerData.editMode,
    });
  };
  const onRecipeDelete = () => {
    // Rezepte auch aus dem Menüplan entfernen
    const updatedMealRecipes = {...menuplan.mealRecipes};

    delete updatedMealRecipes[recipeDrawerData.mealPlan[0].mealPlanRecipe];

    onMenuplanUpdate({mealRecipes: updatedMealRecipes});

    setRecipeDrawerData(RECIPE_DRAWER_DATA_INITIAL_VALUES);
  };
  /* ------------------------------------------
  // Material-Handling
  // ------------------------------------------ */
  const onAddMaterial = (menueUid: Menue["uid"]) => {
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
  };
  const onAddProduct = (menueUid: Menue["uid"]) => {
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
  };
  const onDialogGoodsCancel = () => {
    setDialogGoodsData(GOODS_DATA_DIALOG_INITIAL_DATA);
  };
  const onDialogGoodsOk = ({
    planMode,
    quantity,
    unit,
    product,
    material,
  }: OnAddGoodToMenuProps) => {
    const newMenues = {...menuplan.menues};

    let newMaterial: MenuplanMaterial | null = null;
    let newProduct: MenuplanProduct | null = null;

    if (dialogGoodsData.goodsType === GoodsType.MATERIAL && material) {
      dialogGoodsData.material
        ? (newMaterial = dialogGoodsData.material)
        : (newMaterial = Menuplan.createMaterial());

      newMaterial.quantity = quantity;
      newMaterial.unit = unit;
      newMaterial.materialName = material.name;
      newMaterial.materialUid = material.uid;
      newMaterial.planMode = planMode;
      newMaterial.plan = [];
    } else if (dialogGoodsData.goodsType === GoodsType.PRODUCT && product) {
      dialogGoodsData.product
        ? (newProduct = dialogGoodsData.product)
        : (newProduct = Menuplan.createProduct());

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
          newMenues[dialogGoodsData.menueUid].productOrder.push(newProduct.uid);

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
  };
  /* ------------------------------------------
  // Dialog Menü-Einträge ändern
  // ------------------------------------------ */
  const onEditMenue = (menueUid: Menue["uid"]) => {
    // Dialog öffnen mit Stift / Deletebutton
    setDialogEditMenue({open: true, menueUid: menueUid});
  };
  const onCloseDialogEditMenue = () => {
    setDialogEditMenue({open: false, menueUid: ""});
  };
  const onEditMenueEditObject = ({
    objectType,
    uid,
  }: EditMenueObjectManipulation) => {
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
  };
  const onEditMenueDeleteObject = ({
    objectType,
    uid,
  }: EditMenueObjectManipulation) => {
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
        menue = Menuplan.findMenueOfMealRecipe({
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
        menue = Menuplan.findMenueOfMealProduct({
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
        menue = Menuplan.findMenueOfMealMaterial({
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
  };
  const onMaterialCreate = (material: Material) => {
    onMasterdataCreate({
      type: MasterDataCreateType.MATERIAL,
      value: material,
    });
  };
  const onProductCreate = (product: Product) => {
    onMasterdataCreate({
      type: MasterDataCreateType.PRODUCT,
      value: product,
    });
  };
  /* ------------------------------------------
  // Dialog Menü-Auswahl Handling
  // ------------------------------------------ */
  const onDialogSelectMenueClose = () => {
    setDialogSelectMenueData({
      ...dialogSelectMenueData,
      open: false,
      caller: "",
      singleSelection: false,
      // menues: {} as DialogSelectMenuesForRecipeDialogValues,
      // selectedRecipe: {} as RecipeShort,
    });
  };
  const onDialogSelectMenueContinue = (
    selectedMenues: DialogSelectMenuesForRecipeDialogValues,
  ) => {
    if (dialogSelectMenueData.caller !== onMoveDragAndDropElement.name) {
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
        destinationMenueUid !== dialogSelectMenueData.dragAndDropHandler.menuUid
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
            menuplan.menues[dialogSelectMenueData.dragAndDropHandler.menuUid];
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
  };
  /* ------------------------------------------
  // Dialog Mahlzeit-Auswahl Handling
  // ------------------------------------------ */
  const onDialogSelectMealClose = () => {
    setDialogSelectMealData({
      open: false,
      dragAndDropHandler: {menuUid: "", mealUid: ""},
    });
  };
  const onDialogSelectMealConfirm = (mealUid: Meal["uid"]) => {
    if (mealUid !== dialogSelectMealData.dragAndDropHandler.mealUid) {
      // Element aus Home entfernen
      const reorderedHomeList = menuplan.meals[
        dialogSelectMealData.dragAndDropHandler.mealUid
      ].menuOrder.filter(
        (menuUid) => menuUid != dialogSelectMealData.dragAndDropHandler.menuUid,
      );

      const reorderedDestinationList = menuplan.meals[mealUid].menuOrder.concat(
        dialogSelectMealData.dragAndDropHandler.menuUid,
      );

      onMenuplanUpdateSuper({
        ...menuplan,
        meals: {
          ...menuplan.meals,
          [dialogSelectMealData.dragAndDropHandler.mealUid]: {
            ...menuplan.meals[dialogSelectMealData.dragAndDropHandler.mealUid],
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
  };
  /* ------------------------------------------
  // Dialog Zuordnung der Gruppen-Konfig Handling
  // ------------------------------------------ */
  const onDialogPlanPortionsBack = () => {
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
      caller: onDialogPlanPortionsBack.name,
      singleSelection: false,
    });
  };
  const onDialogPlanPortionsClose = () => {
    setDialogPlanPortionsData({
      open: false,
      menues: {} as DialogSelectMenuesForRecipeDialogValues,
      mealRecipeUid: "",
      portionPlan: [],
      planedMaterial: null,
      planedProduct: null,
      planedObject: PlanedObject.RECIPE,
    });
  };
  const onDialogPlanPortionsAdd = (plan: {
    [key: Menue["uid"]]: DialogPlanPortionsMealPlanning;
  }) => {
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
          const mealRecipe = Menuplan.createMealRecipe({
            recipe: dialogSelectMenueData.selectedRecipe,
            plan: plan[menuUid],
          });
          updatedMealRecipes[mealRecipe.uid] = mealRecipe;
          updatedMenues[menuUid].mealRecipeOrder.push(mealRecipe.uid);
        });
        // Suche im Rezept-Drawer zurücksetzen
        setRecipeSearchResetKey((prev) => prev + 1);
      } else {
        // Eintrag wird geändert
        Object.values(plan).forEach((planOfMealRecipe) => {
          updatedMealRecipes[dialogPlanPortionsData.mealRecipeUid].plan =
            Object.keys(planOfMealRecipe).map((key) => {
              return {
                diet: planOfMealRecipe[key].diet,
                intolerance: key,
                factor: parseFloat(planOfMealRecipe[key].factor),
                totalPortions: planOfMealRecipe[key].total,
              };
            });
          updatedMealRecipes[
            dialogPlanPortionsData.mealRecipeUid
          ].totalPortions = updatedMealRecipes[
            dialogPlanPortionsData.mealRecipeUid
          ].plan.reduce((runningSum, intolerance) => {
            runningSum = runningSum + intolerance.totalPortions;
            return runningSum;
          }, 0);
        });
      }
    } else if (
      dialogPlanPortionsData.planedObject == PlanedObject.GOOD &&
      dialogPlanPortionsData.planedProduct !== null
    ) {
      // Plan umbiegen
      Object.keys(plan).forEach((menueUid) => {
        const newProduct = Menuplan.addPlanToGood<MenuplanProduct>({
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
        const newMaterial = Menuplan.addPlanToGood<MenuplanMaterial>({
          good: {...dialogPlanPortionsData.planedMaterial!, plan: []},
          plan: plan[menueUid],
        });
        // Neue Totalmenge berechnen
        newMaterial.totalQuantity =
          newMaterial.quantity * newMaterial.totalQuantity;
        updatedMaterials[newMaterial.uid] = newMaterial;
        if (!updatedMenues[menueUid].materialOrder.includes(newMaterial.uid)) {
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
      caller: onDialogPlanPortionsAdd.name,
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
  };
  /* ------------------------------------------
  // MenuCard-Handling
  // ------------------------------------------ */
  const onMealRecipeOpen = (mealRecipeUid: MealRecipe["uid"]) => {
    console.log("onMealRecipeOpen", mealRecipeUid);

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
  };
  /* ------------------------------------------
  // Handling Einplanung
  // ------------------------------------------ */
  const onEditRecipeMealPlan = (mealRecipeUid: MealRecipe["uid"]) => {
    const menue = Menuplan.findMenueOfMealRecipe({
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
    //   // Falls keine Einplanung vorhanden ist (bspw. durch Löschung einer Diät/Intoleran),
    //   // wird gleich vorgegangen, wie wenn ein Rezept neu eingeplannt wird (wobei) die Tage
    //   // bereits bestimmt sind.
    //   setDialogSelectMenueData({
    //     ...dialogSelectMenueData,
    //     selectedRecipe: {
    //       uid: menuplan.mealRecipes[mealRecipeUid].recipe.recipeUid,
    //       name: menuplan.mealRecipes[mealRecipeUid].recipe.name,
    //       type: menuplan.mealRecipes[mealRecipeUid].recipe.type,
    //       created: {
    //         date: new Date(),
    //         fromUid: menuplan.mealRecipes[mealRecipeUid].recipe.createdFromUid,
    //         fromDisplayName: "",
    //       },
    //     } as RecipeShort,
    //   });
  };
  const onEditProductPlan = (productUid: MenuplanProduct["uid"]) => {
    const menue = Menuplan.findMenueOfMealProduct({
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
  };
  const onEditMaterialPlan = (materialUid: MenuplanProduct["uid"]) => {
    const menue = Menuplan.findMenueOfMealMaterial({
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
  };

  if (
    new Set(menuplan.mealTypes.order).size !== menuplan.mealTypes.order.length
  ) {
    console.warn("Doppelte MealTypes: ", menuplan.mealTypes.order);
  }
  return (
    <React.Fragment key={"test"}>
      {/* Sticky header — scrolls horizontally via JS sync */}
      <Box
        ref={headerScrollRef}
        sx={{
          position: "sticky",
          top: "64px",
          zIndex: 1000,
          background: theme.palette.background.default,
          overflowX: "hidden",
          paddingX: theme.spacing(4),
        }}
      >
        <MenuplanHeaderRow
          dates={menuplan.dates}
          notes={menuplan.notes}
          menuplanSettings={menuplanSettings}
          onSwitchShowDetails={onSwitchShowDetails}
          onSwitchEnableDragAndDrop={onSwitchEnableDragAndDrop}
          onMealTypeUpdate={onMealTypeUpdate}
          onNoteUpdate={onNoteUpdate}
          onPrint={onPrint}
        />
      </Box>
      {/* Horizontally scrollable content */}
      <Box
        component={"div"}
        key={"container_menuplan_rows"}
        style={{
          display: "flex",
          flexDirection: "column",
          flexWrap: "nowrap",
          overflowX: "auto",
          paddingLeft: theme.spacing(4),
          paddingRight: theme.spacing(4),
        }}
        ref={scrollableRef}
        onScroll={() => {
          if (headerScrollRef.current && scrollableRef.current) {
            headerScrollRef.current.scrollLeft =
              scrollableRef.current.scrollLeft;
          }
        }}
      >
        <MealTypeRows
          mealTypes={menuplan.mealTypes}
          dates={menuplan.dates}
          meals={menuplan.meals}
          menues={menuplan.menues}
          notes={menuplan.notes}
          products={menuplan.products}
          materials={menuplan.materials}
          mealRecipes={menuplan.mealRecipes}
          menuplanSettings={menuplanSettings}
          groupConfiguration={groupConfiguration}
          onMealTypeUpdate={onMealTypeUpdate}
          onMenuplanUpdate={onMenuplanUpdate}
          onAddRecipe={onAddRecipe}
          onAddProduct={onAddProduct}
          onAddMaterial={onAddMaterial}
          onEditMenue={onEditMenue}
          onMealRecipeOpen={onMealRecipeOpen}
          onEditMaterialPlan={onEditMaterialPlan}
          onEditProductPlan={onEditProductPlan}
          onNoteUpdate={onNoteUpdate}
          onDragAndDropUpdate={onDragAndDropUpdate}
          onMoveDragAndDropElement={onMoveDragAndDropElement}
        />
      </Box>
      {/* Rezept-Übersicht Drawer */}
      <RecipeSearchDrawer
        drawerSettings={recipeSearchDrawerData}
        recipes={recipeList}
        onClose={onRecipeSearchDrawerClose}
        onRecipeCardClick={onRecipeCardClick}
        onRecipeSelection={onRecipeSelection}
        onNewRecipe={onNewRecipe}
        authUser={authUser}
        searchResetKey={recipeSearchResetKey}
      />
      {/* Rezept-Drawer */}
      <RecipeDrawer
        drawerSettings={recipeDrawerData}
        recipe={recipeDrawerData.recipe}
        mealPlan={recipeDrawerData.mealPlan}
        groupConfiguration={groupConfiguration}
        scaledPortions={recipeDrawerData.scaledPortions}
        editMode={recipeDrawerData.editMode}
        firebase={firebase}
        authUser={authUser}
        onClose={onRecipeDrawerClose}
        onAddToEvent={onRecipeSelection}
        onEditRecipeMealPlan={onEditRecipeMealPlan}
        onRecipeUpdate={onRecipeUpdate}
        onSwitchEditMode={onRecipeSwitchEditMode}
        onRecipeDelete={onRecipeDelete}
      />
      {/* Dialog Menüwahl */}
      <DialogSelectMenues
        open={dialogSelectMenueData.open}
        title={TEXT_DIALOG_CHOOSE_MENUES_TITLE}
        dates={menuplan.dates}
        mealTypes={menuplan.mealTypes}
        meals={menuplan.meals}
        menues={menuplan.menues}
        preSelectedMenue={dialogSelectMenueData.menues}
        onClose={onDialogSelectMenueClose}
        onConfirm={onDialogSelectMenueContinue}
        singleSelection={dialogSelectMenueData.singleSelection}
      />
      {/* Dialog Mahlzeit-Auswahl */}
      <DialogSelectMeals
        open={dialogSelectMealData.open}
        title={TEXT_DIALOG_CHOOSE_MEALS_TITLE}
        dates={menuplan.dates}
        mealTypes={menuplan.mealTypes}
        meals={menuplan.meals}
        onClose={onDialogSelectMealClose}
        onConfirm={onDialogSelectMealConfirm}
      />
      {/* Dialog Portionenauswahl */}
      <DialogPlanPortions
        open={dialogPlanPortionsData.open}
        selectedMenues={dialogPlanPortionsData.menues}
        meals={menuplan.meals}
        menues={menuplan.menues}
        mealTypes={menuplan.mealTypes}
        groupConfiguration={groupConfiguration}
        planedMealRecipe={dialogPlanPortionsData.portionPlan}
        planedObject={dialogPlanPortionsData.planedObject}
        onBackClick={onDialogPlanPortionsBack}
        onCancelClick={onDialogPlanPortionsClose}
        onAddClick={onDialogPlanPortionsAdd}
      />
      {/* Dialog Menüeinträge ändern */}
      <DialogEditMenue
        open={dialogEditMenue.open}
        menue={menuplan.menues[dialogEditMenue.menueUid]}
        note={Object.values(menuplan.notes).find(
          (note) => note.menueUid == dialogEditMenue.menueUid,
        )}
        mealRecipes={menuplan.mealRecipes}
        products={menuplan.products}
        materials={menuplan.materials}
        groupConfiguration={groupConfiguration}
        onCloseDialog={onCloseDialogEditMenue}
        onEditObject={onEditMenueEditObject}
        onDeleteObject={onEditMenueDeleteObject}
      />
      <DialogGoods
        open={dialogGoodsData.open}
        goodsType={dialogGoodsData.goodsType}
        units={units}
        products={products}
        materials={materials}
        departments={departments}
        productToUpdate={dialogGoodsData.product}
        materialToUpdate={dialogGoodsData.material}
        firebase={firebase}
        authUser={authUser}
        onCancel={onDialogGoodsCancel}
        onOk={onDialogGoodsOk}
        onMaterialCreate={onMaterialCreate}
        onProductCreate={onProductCreate}
      />
    </React.Fragment>
  );
};
/* ===================================================================
// ========================= Tag-Überschriften =======================
// =================================================================== */
interface MenuplanHeaderRowProps {
  dates: Menuplan["dates"];
  notes: Menuplan["notes"];
  menuplanSettings: MenuplanSettings;
  onSwitchShowDetails: () => void;
  onSwitchEnableDragAndDrop: () => void;
  onMealTypeUpdate: ({action, mealType}: OnMealTypeUpdate) => void;
  onNoteUpdate: ({action, note}: OnNoteUpdate) => void;
  onPrint: () => void;
}

interface DaysRowContextMenuState {
  date: string;
  note: Note | undefined;
}
const CONTEXT_MENU_INITIAL_STATE: DaysRowContextMenuState = {
  date: "",
  note: undefined,
};
const MenuplanHeaderRow = ({
  dates,
  notes,
  menuplanSettings,
  onSwitchShowDetails,
  onSwitchEnableDragAndDrop,
  onMealTypeUpdate,
  onNoteUpdate,
  onPrint,
}: MenuplanHeaderRowProps) => {
  const classes = useCustomStyles();
  const theme = useTheme();
  const {customDialog} = useCustomDialog();
  const [contextMenuAnchorElement, setContextMenuAnchorElement] =
    useState<HTMLElement | null>(null);

  const [contextMenuState, setContextMenuState] =
    useState<DaysRowContextMenuState>(CONTEXT_MENU_INITIAL_STATE);
  const [scrolled, setScrolled] = useState(false);

  /* ------------------------------------------
  // Button-Handling
  // ------------------------------------------ */
  const onAddMeal = async () => {
    let userInput = {valid: false, input: ""} as SingleTextInputResult;

    userInput = (await customDialog({
      dialogType: DialogType.SingleTextInput,
      title: `${TEXT_MEAL} ${TEXT_ADD} `,
      singleTextInputProperties: {
        initialValue: "",
        textInputLabel: TEXT_MEAL,
      },
    })) as SingleTextInputResult;

    if (userInput?.valid && userInput.input != "") {
      const newMealType = Menuplan.createMealType({
        newMealName: userInput.input,
      });
      onMealTypeUpdate({action: Action.ADD, mealType: newMealType});
    }
  };
  /* ------------------------------------------
  // Scroll-Listener für Sticky Header
  // ------------------------------------------ */
  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 64);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  /* ------------------------------------------
  // Kontext-Menü
  // ------------------------------------------ */
  const onContextMenuClick = (event: React.MouseEvent<HTMLElement>) => {
    const selectedDate = Utils.dateAsString(
      new Date(event.currentTarget.id.split("_")[1]),
    );

    setContextMenuAnchorElement(event.currentTarget);
    setContextMenuState({
      date: selectedDate,
      note: Object.values(notes).find((note) => note.date == selectedDate),
    });
  };
  const closeContextMenu = () => {
    setContextMenuAnchorElement(null);
    setContextMenuState(CONTEXT_MENU_INITIAL_STATE);
  };
  const onDeleteNote = () => {
    if (!contextMenuState.note) {
      return;
    }
    onNoteUpdate({
      action: Action.DELETE,
      note: contextMenuState.note,
    });
    setContextMenuState(CONTEXT_MENU_INITIAL_STATE);
    setContextMenuAnchorElement(null);
  };
  const onModifyNote = async () => {
    // Input holen
    const userInput = (await customDialog({
      dialogType: DialogType.SingleTextInput,
      title: `${TEXT_NOTE} ${
        contextMenuState.note?.text ? TEXT_EDIT : TEXT_ADD
      }`,
      text: "",
      singleTextInputProperties: {
        initialValue: contextMenuState.note?.text
          ? contextMenuState.note.text
          : "",
        textInputLabel: TEXT_NOTE,
      },
    })) as SingleTextInputResult;

    if (userInput?.valid && userInput.input != "") {
      // Notiz anlegen resp. ändern
      let note: Note;
      if (!contextMenuState.note?.uid) {
        note = Menuplan.createEmptyNote();
        note.date = contextMenuState.date as string;
      } else {
        note = contextMenuState.note;
      }
      note.text = userInput.input;

      onNoteUpdate({
        action: contextMenuState.note?.uid ? Action.EDIT : Action.ADD,
        note: note,
      });
    }
    setContextMenuState(CONTEXT_MENU_INITIAL_STATE);
    setContextMenuAnchorElement(null);
  };
  return (
    <Box
      component="div"
      sx={{
        display: "flex",
        flexDirection: "row",
        flexWrap: "nowrap",
        "&::after": scrolled
          ? {
              content: '""',
              position: "absolute",
              left: 0,
              bottom: 0,
              width: "100%",
              height: "10px",
              background:
                "linear-gradient(to bottom, rgba(0, 0, 0, 0.1), rgba(0, 0, 0, 0))",
              pointerEvents: "none",
            }
          : {},
      }}
    >
      <Container
        sx={classes.menuplanItem}
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          flexWrap: "nowrap",
          justifyContent: "center",
          padding: theme.spacing(1),
          paddingBottom: theme.spacing(2),
        }}
      >
        <FormGroup style={{marginBottom: "1em"}}>
          <FormControlLabel
            control={
              <Switch
                checked={menuplanSettings.showDetails}
                onChange={onSwitchShowDetails}
              />
            }
            label={TEXT_SHOW_DETAILS}
          />
          <FormControlLabel
            control={
              <Switch
                checked={menuplanSettings.enableDragAndDrop}
                onChange={onSwitchEnableDragAndDrop}
              />
            }
            label={TEXT_ENABLE_DRAG_AND_DROP}
          />
        </FormGroup>
        <Button
          color="primary"
          onClick={onAddMeal}
          variant="outlined"
          size="small"
          style={{marginBottom: "1em"}}
        >
          {TEXT_ADD_MEAL}
        </Button>
        <Button
          color="primary"
          onClick={onPrint}
          size="small"
          variant="outlined"
        >
          {TEXT_PRINTVERSION}
        </Button>
      </Container>

      {dates.map((date) => {
        const note = Object.values(notes).find(
          (note) =>
            note.date == Utils.dateAsString(date) && note.menueUid == "",
        );
        return (
          <Container
            sx={classes.menuplanItem}
            key={"dayCardContainer_" + date}
            data-date={Utils.dateAsString(date)}
            style={{
              display: "flex",
              padding: theme.spacing(1),
              paddingBottom: theme.spacing(2),
            }}
          >
            <Card
              key={"date_card_" + date}
              sx={classes.cardDate}
              style={{width: "100%"}}
              variant="outlined"
            >
              <CardHeader
                key={"date_cardHeader_" + date}
                align="center"
                action={
                  <IconButton
                    id={"MoreBtn_" + date}
                    aria-label="settings"
                    onClick={onContextMenuClick}
                    size="large"
                  >
                    <MoreVertIcon />
                  </IconButton>
                }
                title={date.toLocaleString("default", {weekday: "long"})}
                titleTypographyProps={{variant: "h6"}}
                subheader={date.toLocaleString("de-CH", {
                  year: "numeric",
                  month: "2-digit",
                  day: "2-digit",
                })}
              />
              {note && (
                <CardContent>
                  <Typography
                    variant="body2"
                    color="textSecondary"
                    align="center"
                  >
                    <em>{note.text}</em>
                  </Typography>
                </CardContent>
              )}
            </Card>
          </Container>
        );
      })}

      <Menu
        open={Boolean(contextMenuAnchorElement)}
        keepMounted
        anchorEl={contextMenuAnchorElement}
        onClose={closeContextMenu}
      >
        {/* Entweder ist es leer --> dann nur hinzufügen --> sonst ändern und löschen*/}
        <MenuItem onClick={onModifyNote}>
          <ListItemIcon>
            <EditIcon />
          </ListItemIcon>
          <Typography variant="inherit" noWrap>
            {`${TEXT_NOTE} ${contextMenuState.note ? TEXT_EDIT : TEXT_ADD}`}
          </Typography>
        </MenuItem>

        {contextMenuState.note && (
          <MenuItem onClick={onDeleteNote}>
            <ListItemIcon>
              <DeleteIcon />
            </ListItemIcon>
            <Typography variant="inherit" noWrap>
              {`${TEXT_NOTE} ${TEXT_DELETE}`}
            </Typography>
          </MenuItem>
        )}
      </Menu>
    </Box>
  );
};
/* ===================================================================
// ========================= Mahlzeit-Reihen =========================
// =================================================================== */
interface MealTypeRowsProps {
  mealTypes: Menuplan["mealTypes"];
  dates: Menuplan["dates"];
  meals: Menuplan["meals"];
  menues: Menuplan["menues"];
  notes: Menuplan["notes"];
  products: Menuplan["products"];
  materials: Menuplan["materials"];
  mealRecipes: Menuplan["mealRecipes"];
  menuplanSettings: MenuplanSettings;
  groupConfiguration: EventGroupConfiguration;
  onMealTypeUpdate: ({action, mealType}: OnMealTypeUpdate) => void;
  onMenuplanUpdate: (updatedValues: onMenuplanUpdate) => void;
  onAddRecipe: (menue: Menue) => void;
  onEditMenue: (menueUid: Menue["uid"]) => void;
  onAddProduct: (menueUid: Menue["uid"]) => void;
  onAddMaterial: (menueUid: Menue["uid"]) => void;
  onMealRecipeOpen: (uid: MealRecipe["uid"]) => void;
  onEditProductPlan: (uid: MenuplanProduct["uid"]) => void;
  onEditMaterialPlan: (uid: MenuplanMaterial["uid"]) => void;
  onNoteUpdate: ({action, note}: OnNoteUpdate) => void;
  onDragAndDropUpdate: (
    newOrder: string[],
    dragAndDropList: MenuplanDragDropTypes,
  ) => void;
  onMoveDragAndDropElement: OnMoveDragAndDropElementFx;
}
const MealTypeRows = ({
  mealTypes,
  dates,
  meals,
  menues,
  notes,
  products,
  materials,
  mealRecipes,
  menuplanSettings,
  groupConfiguration,
  onMealTypeUpdate,
  onMenuplanUpdate,
  onAddRecipe,
  onAddProduct,
  onAddMaterial,
  onEditMenue,
  onMealRecipeOpen,
  onEditProductPlan,
  onEditMaterialPlan,
  onNoteUpdate,
  onDragAndDropUpdate,
  onMoveDragAndDropElement,
}: MealTypeRowsProps) => {
  /* ------------------------------------------
  // Drag & Drop Handling
  // ------------------------------------------ */
  const [registry] = useState(getItemRegistry);
  const [lastCardMoved, setLasCardMoved] =
    useState<LastCardMoved<MealType>>(null);

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

      const itemKey = mealTypes.order[startIndex];
      const item = mealTypes.entries[itemKey];

      onDragAndDropUpdate(
        reorder({
          list: mealTypes.order,
          startIndex,
          finishIndex,
        }),
        MenuplanDragDropTypes.MEALTYPE,
      );
      setLasCardMoved({
        item,
        previousIndex: startIndex,
        currentIndex: finishIndex,
        numberOfItems: mealTypes.order.length,
      });
    },
    [mealTypes],
  );

  useEffect(() => {
    if (!menuplanSettings.enableDragAndDrop) {
      // Kein DnD
      return;
    }
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

        const indexOfTarget = mealTypes.order.findIndex(
          (itemUiId) => itemUiId === (targetData.item as MealType).uid,
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
  }, [instanceId, mealTypes.order, reorderItem]);

  // Drag beendet, Abschlussarbeiten
  useEffect(() => {
    if (!menuplanSettings.enableDragAndDrop) {
      // Kein DnD
      return;
    }

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
    () => mealTypes.order.length,
    [mealTypes.order.length],
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
    <MealTypesRowContext.Provider value={contextValue}>
      {mealTypes.order.map((mealTypeUid, index) => (
        <MealTypeRow
          key={"mealTypeRow_" + mealTypeUid}
          index={index}
          isLastElement={index === mealTypes.order.length - 1}
          mealType={mealTypes.entries[mealTypeUid]}
          dates={dates}
          meals={meals}
          menues={menues}
          notes={notes}
          products={products}
          materials={materials}
          mealRecipes={mealRecipes}
          menuplanSettings={menuplanSettings}
          groupConfiguration={groupConfiguration}
          mealTypes={mealTypes}
          onMealTypeUpdate={onMealTypeUpdate}
          onMenuplanUpdate={onMenuplanUpdate}
          onAddRecipe={onAddRecipe}
          onAddProduct={onAddProduct}
          onAddMaterial={onAddMaterial}
          onEditMenue={onEditMenue}
          onMealRecipeOpen={onMealRecipeOpen}
          onMealProductOpen={onEditProductPlan}
          onMealMaterialOpen={onEditMaterialPlan}
          onNoteUpdate={onNoteUpdate}
          onMoveDragAndDropElement={onMoveDragAndDropElement}
        />
      ))}
    </MealTypesRowContext.Provider>
  );
};

/* ===================================================================
// ========================== Mahlzeit-Reihe =========================
// =================================================================== */
interface MealTypeRowProps {
  index: number;
  isLastElement: boolean;
  mealType: MealType;
  dates: Menuplan["dates"];
  meals: Menuplan["meals"];
  menues: Menuplan["menues"];
  notes: Menuplan["notes"];
  products: Menuplan["products"];
  materials: Menuplan["materials"];
  mealRecipes: Menuplan["mealRecipes"];
  menuplanSettings: MenuplanSettings;
  groupConfiguration: EventGroupConfiguration;
  mealTypes: Menuplan["mealTypes"];
  onMealTypeUpdate: ({action, mealType}: OnMealTypeUpdate) => void;
  onMenuplanUpdate: (updatedValues: onMenuplanUpdate) => void;
  onAddRecipe: (menue: Menue) => void;
  onEditMenue: (menueUid: Menue["uid"]) => void;
  onAddProduct: (menueUid: Menue["uid"]) => void;
  onAddMaterial: (menueUid: Menue["uid"]) => void;
  onMealRecipeOpen: (uid: MealRecipe["uid"]) => void;
  onMealProductOpen: (uid: MenuplanProduct["uid"]) => void;
  onMealMaterialOpen: (uid: MenuplanMaterial["uid"]) => void;
  onNoteUpdate: ({action, note}: OnNoteUpdate) => void;
  onMoveDragAndDropElement: OnMoveDragAndDropElementFx;
}
const MealTypeRow = ({
  index,
  isLastElement,
  mealType,
  dates,
  meals,
  menues,
  notes,
  products,
  materials,
  mealRecipes,
  menuplanSettings,
  groupConfiguration,
  mealTypes,
  onMealTypeUpdate,
  onMenuplanUpdate,
  onAddRecipe,
  onAddProduct,
  onAddMaterial,
  onEditMenue,
  onMealRecipeOpen,
  onMealProductOpen,
  onMealMaterialOpen,
  onNoteUpdate,
  onMoveDragAndDropElement,
}: MealTypeRowProps) => {
  const classes = useCustomStyles();
  const theme = useTheme();
  const {customDialog} = useCustomDialog();
  /* ------------------------------------------
  // Drag & Drop
  // ------------------------------------------ */
  const {registerItem, instanceId} = useMealTypeRowContext();

  const mealRowRef = useRef<HTMLDivElement>(null);
  const [closestEdge, setClosestEdge] = useState<Edge | null>(null);
  const dragHandleRef = useRef<HTMLButtonElement>(null);
  // **const scrollableRef = useRef<HTMLDivElement | null>(null);
  const [draggableState, setDraggableState] =
    useState<DraggableState>(idleState);

  useEffect(() => {
    if (!menuplanSettings.enableDragAndDrop) {
      // Kein DnD
      return;
    }

    const element = mealRowRef.current;
    const dragHandle = dragHandleRef.current;
    invariant(element);
    invariant(dragHandle);

    // Instance-ID (Liste in dem das Drag & drop Stattfindet)
    const data = getItemData({item: mealType, index, instanceId});

    return combine(
      registerItem({itemUiId: mealType.uid, element}),
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
            isItemData<MealType>(source.data) &&
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
          setDraggableState(draggingState);
        },
        onDragLeave() {
          setClosestEdge(null);
          setDraggableState(idleState);
        },
        onDrop() {
          setClosestEdge(null);
          setDraggableState(idleState);
        },
      }),
    );
  }, [
    instanceId,
    mealType,
    index,
    registerItem,
    menuplanSettings.enableDragAndDrop,
  ]);
  /* ------------------------------------------
  // Menü-Handling
  // ------------------------------------------ */
  const onCreateMenu = (event: React.MouseEvent<HTMLButtonElement>) => {
    const newMenu = Menuplan.createMenu();
    const mealsToUpdate = {...meals};
    const mealToUpdate = Object.values(mealsToUpdate).find(
      (meal) => meal.uid == event.currentTarget.id.split("_")[1],
    );
    const menuesToUpdate = {...menues};

    if (!mealToUpdate || !menuesToUpdate) {
      return;
    }
    mealToUpdate.menuOrder.push(newMenu.uid);
    menuesToUpdate[newMenu.uid] = newMenu;

    onMenuplanUpdate({
      meals: {...meals, [mealToUpdate.uid]: mealToUpdate},
      menues: menuesToUpdate,
    });
  };
  const onUpdateMenue = (menue: Menue) => {
    onMenuplanUpdate({
      menues: {...menues, [menue.uid]: menue},
    });
  };
  const onDeleteMenue = async (menueUid: Menue["uid"]) => {
    // Alle Rezepte, Produkte, Materialien entfernen,
    // die in diesem Menü sind

    // Falls das Menue leer ist, braucht es keine Bestätigung
    if (
      menues[menueUid].mealRecipeOrder.length != 0 ||
      menues[menueUid].productOrder.length != 0 ||
      menues[menueUid].materialOrder.length != 0
    ) {
      const isConfirmed = await customDialog({
        dialogType: DialogType.Confirm,
        text: TEXT_ALL_RECIPES_AND_VALUES_WILL_BE_DELETED,
        title: `⚠️  ${TEXT_ATTENTION}`,
        buttonTextConfirm: TEXT_DELETE,
      });
      if (!isConfirmed) {
        return;
      }
    }

    const updatedMealRecipes = {...mealRecipes};
    const updatedMenues = {...menues};
    const updatedMeals = {...meals};
    const updateProducts = {...products};
    const updateMaterials = {...materials};
    //
    menues[menueUid].mealRecipeOrder.forEach(
      (recipeUid) => delete updatedMealRecipes[recipeUid],
    );
    menues[menueUid].productOrder.forEach(
      (productUid) => delete updateProducts[productUid],
    );
    menues[menueUid].materialOrder.forEach(
      (materialUid) => delete updateMaterials[materialUid],
    );
    delete updatedMenues[menueUid];

    Object.values(updatedMeals).forEach((meal) => {
      if (meal.menuOrder.includes(menueUid)) {
        meal.menuOrder = meal.menuOrder.filter(
          (mealMenuUid) => mealMenuUid != menueUid,
        );
      }
    });

    onMenuplanUpdate({
      menues: updatedMenues,
      mealRecipes: updatedMealRecipes,
      meals: updatedMeals,
      products: updateProducts,
      materials: updateMaterials,
    });
  };
  return (
    <React.Fragment>
      {draggableState.type == "dragging" && closestEdge == "top" && (
        <Box
          component="div"
          className="custom-drop-indicator"
          style={{position: "relative", margin: theme.spacing(1)}}
        >
          <DropIndicator edge={closestEdge} />
        </Box>
      )}
      <Box
        component={"div"}
        ref={mergeRefs([mealRowRef, dragHandleRef])}
        style={{
          display: "flex",
          flexDirection: "row",
          flexWrap: "nowrap",
          alignItems: "stretch",
        }}
      >
        <Container
          sx={classes.menuplanItem}
          style={{
            display: "flex",
            padding: theme.spacing(1),
            paddingBottom: theme.spacing(2),
          }}
        >
          <MealTypeCard
            mealType={mealType}
            index={index}
            isLastElement={isLastElement}
            onMealTypeUpdate={onMealTypeUpdate}
            onMoveDragAndDropElement={onMoveDragAndDropElement}
          />
        </Container>
        {dates.map((date) => {
          let actualMeal = {} as Meal;
          Object.values(meals).forEach((meal) => {
            if (
              meal.mealType == mealType.uid &&
              meal.date == Utils.dateAsString(date)
            ) {
              actualMeal = meal;
            }
          });
          return (
            <Container
              sx={classes.menuplanItem}
              style={{
                display: "flex",
                padding: theme.spacing(1),
                paddingBottom: theme.spacing(2),
                // height: "100%",
                flexDirection: "column",
              }}
              key={
                "mealCardContainer_" +
                Utils.dateAsString(date) +
                "_" +
                mealType.uid
              }
            >
              {actualMeal.menuOrder?.length > 0 ? (
                <MenueListOfMeal
                  meal={actualMeal}
                  menues={menues}
                  mealRecipes={mealRecipes}
                  products={products}
                  materials={materials}
                  notes={notes}
                  mealTypes={mealTypes}
                  menuplanSettings={menuplanSettings}
                  groupConfiguration={groupConfiguration}
                  onUpdateMenue={onUpdateMenue}
                  onAddRecipe={onAddRecipe}
                  onAddProduct={onAddProduct}
                  onAddMaterial={onAddMaterial}
                  onEditMenue={onEditMenue}
                  onDeleteMenue={onDeleteMenue}
                  onNoteUpdate={onNoteUpdate}
                  onMealRecipeOpen={onMealRecipeOpen}
                  onMealProductOpen={onMealProductOpen}
                  onMealMaterialOpen={onMealMaterialOpen}
                  onMoveDragAndDropElement={onMoveDragAndDropElement}
                />
              ) : (
                // Kein Menü vorhanden - MenuCard erstellen.....
                <EmptyMealContainer
                  mealUid={actualMeal.uid}
                  buttonText={TEXT_NEW_MENU}
                  onCreateMenu={(mealUid) => {
                    const event = {
                      currentTarget: {id: "onCreateMenu_" + mealUid},
                    } as React.MouseEvent<HTMLButtonElement>;
                    onCreateMenu(event);
                  }}
                />
              )}
              {/* {closestEdge && (
                <Box component="div" className="custom-drop-indicator">
                  <p>Hier bin ich</p>
                  <DropIndicator edge={closestEdge} gap="272px" />
                </Box>
              )} */}
            </Container>
          );
        })}
      </Box>
      {draggableState.type == "dragging" && closestEdge == "bottom" && (
        <Box
          component="div"
          className="custom-drop-indicator"
          style={{position: "relative", margin: theme.spacing(1)}}
        >
          <DropIndicator edge={closestEdge} />
        </Box>
      )}
    </React.Fragment>
  );
};
/* ===================================================================
// ======================== Mahlzeit-Typ-Karte =======================
// =================================================================== */
interface OnMealTypeUpdate {
  action: Action;
  mealType: MealType;
}
export interface OnNoteUpdate {
  action: Action;
  note: Note;
}
interface MealTypeCardProps {
  mealType: MealType;
  index: number;
  isLastElement: boolean;
  onMealTypeUpdate: ({action, mealType}: OnMealTypeUpdate) => void;
  onMoveDragAndDropElement: OnMoveDragAndDropElementFx;
}
const MealTypeCard = ({
  mealType,
  index,
  isLastElement,
  onMealTypeUpdate,
  onMoveDragAndDropElement,
}: MealTypeCardProps) => {
  const classes = useCustomStyles();
  const {customDialog} = useCustomDialog();
  const [contextMenuAnchorElement, setContextMenuAnchorElement] =
    useState<HTMLElement | null>(null);
  /* ------------------------------------------
  // Kontexmenü
  // ------------------------------------------ */
  const onContextMenuClick = (event: React.MouseEvent<HTMLElement>) => {
    setContextMenuAnchorElement(event.currentTarget);
  };
  const closeContextMenu = () => {
    setContextMenuAnchorElement(null);
  };
  /* ------------------------------------------
  // Kontexmenü-Handler
  // ------------------------------------------ */
  const onRenameItem = async () => {
    let userInput = {valid: false, input: ""} as SingleTextInputResult;

    userInput = (await customDialog({
      dialogType: DialogType.SingleTextInput,
      title: `${TEXT_MEAL} ${TEXT_EDIT} `,
      text: "",
      singleTextInputProperties: {
        initialValue: mealType.name,
        textInputLabel: TEXT_MEAL,
      },
    })) as SingleTextInputResult;

    if (userInput?.valid && userInput.input != "") {
      onMealTypeUpdate({
        action: Action.EDIT,
        mealType: {...mealType, name: userInput.input},
      });
    }
    setContextMenuAnchorElement(null);
  };
  const onDeleteItem = () => {
    onMealTypeUpdate({
      action: Action.DELETE,
      mealType: mealType,
    });
    setContextMenuAnchorElement(null);
    // setContextMenuState(MEAL_TYPE_CONTEXT_MENU_INITIAL_STATE);
  };
  const onMoveElement = (direction: DragAndDropDirections) => {
    onMoveDragAndDropElement({
      direction: direction,
      kind: MenuplanDragDropTypes.MEALTYPE,
      itemUid: mealType.uid,
    });
    setContextMenuAnchorElement(null);
  };
  return (
    <React.Fragment>
      <Card
        key={"mealtype_card_" + mealType.uid}
        sx={classes.cardMealType}
        variant="outlined"
      >
        <CardHeader
          key={"mealtype_cardHeader_" + mealType.uid}
          action={
            <IconButton
              id={"MoreBtn_" + mealType.uid}
              aria-label="settings"
              onClick={onContextMenuClick}
              size="large"
            >
              <MoreVertIcon />
            </IconButton>
          }
          title={mealType.name}
          titleTypographyProps={{variant: "h6"}}
        />
      </Card>
      <Menu
        open={Boolean(contextMenuAnchorElement)}
        keepMounted
        anchorEl={contextMenuAnchorElement}
        onClose={closeContextMenu}
      >
        <MenuItem onClick={onRenameItem}>
          <ListItemIcon>
            <EditIcon />
          </ListItemIcon>
          <Typography variant="inherit" noWrap>
            {TEXT_RENAME}
          </Typography>
        </MenuItem>
        <MenuItem onClick={onDeleteItem}>
          <ListItemIcon>
            <DeleteIcon />
          </ListItemIcon>
          <Typography variant="inherit" noWrap>
            {TEXT_DELETE}
          </Typography>
        </MenuItem>
        <MenuItem onClick={() => onMoveElement("up")} disabled={index === 0}>
          <ListItemIcon>
            <ArrowUpwardIcon fontSize="small"></ArrowUpwardIcon>
          </ListItemIcon>
          <Typography>{TEXT_TOOLTIP_MOVE_UP}</Typography>
        </MenuItem>
        <MenuItem
          onClick={() => onMoveElement("down")}
          disabled={isLastElement}
        >
          <ListItemIcon>
            <ArrowDownwardIcon fontSize="small"></ArrowDownwardIcon>
          </ListItemIcon>
          <Typography>{TEXT_TOOLTIP_MOVE_DOWN}</Typography>
        </MenuItem>
      </Menu>
    </React.Fragment>
  );
};
/* ===================================================================
// ====================== Rezepte-Suchen-Drawer ======================
// =================================================================== */
interface RecipeSearchDrawerProps {
  drawerSettings: DrawerSettings;
  recipes: RecipeShort[];
  authUser: AuthUser;
  onClose: () => void;
  onRecipeCardClick: ({event, recipe}: OnRecipeCardClickProps) => void;
  onRecipeSelection: ({recipe}: OnRecipeSelection) => void;
  onNewRecipe: () => void;
  searchResetKey?: number;
}
const RecipeSearchDrawer = ({
  drawerSettings,
  recipes,
  onClose,
  onRecipeCardClick,
  onRecipeSelection,
  onNewRecipe,
  authUser,
  searchResetKey = 0,
}: RecipeSearchDrawerProps) => {
  const classes = useCustomStyles();

  return (
    <Drawer
      anchor="bottom"
      open={drawerSettings.open}
      onClose={onClose}
      sx={classes.recipeDrawerBackground}
      ModalProps={{
        keepMounted: true,
      }}
    >
      <IconButton
        color="inherit"
        aria-label="close"
        sx={classes.closeDrawerIconButton}
        onClick={onClose}
        size="large"
      >
        <CloseIcon fontSize="small" />
      </IconButton>
      <Container
        style={{marginTop: "2rem", width: "100%", height: "100vh"}}
        maxWidth={false}
      >
        <Typography variant="h2" align="center" style={{marginBottom: "2rem"}}>
          {TEXT_RECIPES_DRAWER_TITLE}{" "}
        </Typography>
        <RecipeSearch
          key={searchResetKey}
          recipes={recipes}
          embeddedMode={true}
          fabButtonIcon={<AddIcon />}
          onFabButtonClick={onRecipeSelection}
          onNewClick={onNewRecipe}
          onCardClick={onRecipeCardClick}
          isLoading={drawerSettings.isLoadingData}
          authUser={authUser}
        />
      </Container>
    </Drawer>
  );
};
/* ===================================================================
// ==================== Einplanung der Portionen =====================
// =================================================================== */
interface DialogPlanPortionsProps {
  open: boolean;
  selectedMenues: DialogSelectMenuesForRecipeDialogValues | null;
  meals: Menuplan["meals"];
  menues: Menuplan["menues"];
  mealTypes: Menuplan["mealTypes"];
  groupConfiguration: EventGroupConfiguration;
  planedMealRecipe: PortionPlan[];
  planedObject: PlanedObject;
  onCancelClick: () => void;
  onBackClick: () => void;
  onAddClick: (plan: {
    [key: Menue["uid"]]: DialogPlanPortionsMealPlanning;
  }) => void;
}
const KEEP_IN_SYNC_KEY = "SYNC";

export interface DialogPlanPortionsPlanningInfo {
  active: boolean;
  factor: string;
  portions: number;
  total: number;
  diet: Diet["uid"];
}
interface DialogPlanPortionsMealPlanning {
  [key: Intolerance["uid"]]: DialogPlanPortionsPlanningInfo;
}
enum PlanedObject {
  RECIPE,
  GOOD,
}
interface DialogPlanPortionsMealPlan {
  [key: Menue["uid"]]: DialogPlanPortionsMealPlanning | null;
}

interface DialogPlanPortionsDialogValues {
  keepMenuPortionsInSync: boolean;
  selectedDiets: {[key: Menue["uid"]]: PortionPlan["diet"]} | null;
  menueList: string[] | null;
  plan: DialogPlanPortionsMealPlan | null;
}
const DialogPlanPortions = ({
  open,
  selectedMenues,
  meals,
  mealTypes,
  groupConfiguration,
  planedMealRecipe,
  planedObject,
  onCancelClick: onCancelClickSuper,
  onBackClick: onBackClickSuper,
  onAddClick: onAddClickSuper,
}: DialogPlanPortionsProps) => {
  const classes = useCustomStyles();
  const theme = useTheme();

  const DIALOG_VALUES_INITIAL_VALUES = {
    keepMenuPortionsInSync: true,
    selectedDiets: null,
    menueList: null,
    plan: null,
  };

  const {customDialog} = useCustomDialog();
  const [dialogValues, setDialogValues] =
    useState<DialogPlanPortionsDialogValues>(DIALOG_VALUES_INITIAL_VALUES);
  const [dialogValidation, setDialogValidation] = useState<
    Array<FormValidationFieldError>
  >([]);
  /* ------------------------------------------
  // Initialisierung
  // ------------------------------------------ */
  if (
    (!dialogValues.plan || Object.values(dialogValues.plan).includes(null)) &&
    selectedMenues &&
    Object.keys(selectedMenues).length > 0
  ) {
    let dietButtons = {} as {[key: Menue["uid"]]: PortionPlan["diet"]};
    let menueList: string[] = [];

    if (!dialogValues.menueList) {
      if (
        Object.keys(selectedMenues).length > 1 &&
        dialogValues.keepMenuPortionsInSync
      ) {
        menueList[0] = KEEP_IN_SYNC_KEY;
      } else {
        Object.keys(selectedMenues).forEach((menueUid) =>
          menueList.push(menueUid),
        );
      }
    } else {
      menueList = dialogValues.menueList;
    }

    if (!dialogValues.selectedDiets && planedMealRecipe.length === 0) {
      menueList.forEach((menueUid) => {
        dietButtons[menueUid] = PlanedDiet.ALL;
      });
    } else if (
      dialogValues.selectedDiets == null &&
      planedMealRecipe.length > 0
    ) {
      dietButtons[menueList[0]] = planedMealRecipe[0].diet;
    } else {
      dietButtons = dialogValues.selectedDiets as {
        [key: Menue["uid"]]: PortionPlan["diet"];
      };
    }

    let plan = {} as DialogPlanPortionsMealPlan;
    if (!dialogValues.plan) {
      menueList.forEach((menueUid) => (plan[menueUid] = null));
    } else {
      plan = dialogValues.plan;
    }

    // Zuerst die Alle und Fix Portionen
    Object.keys(plan).forEach((menuUid) => {
      if (plan[menuUid] == null) {
        const mealPlan = {} as DialogPlanPortionsMealPlanning;
        if (dietButtons[menuUid] == PlanedDiet.FIX) {
          // Fixe-Portionen
          mealPlan[PlanedDiet.FIX] = {
            active: true,
            portions: 0,
            factor: "1.0",
            total: 0,
            diet: dietButtons[menuUid],
          };
        } else {
          groupConfiguration.intolerances.order.forEach((intoleranceUid) => {
            mealPlan[intoleranceUid] = {
              active: false,
              portions:
                dietButtons[menuUid] == PlanedDiet.ALL
                  ? groupConfiguration.intolerances.entries[intoleranceUid]
                      .totalPortions
                  : groupConfiguration.portions[dietButtons[menuUid]][
                      intoleranceUid
                    ],
              factor: "1.0",
              total: 0,
              diet: dietButtons[menuUid],
            };
          });
          // Totalsumme einfügen
          mealPlan[PlanedDiet.ALL] = {
            active: false,
            portions:
              dietButtons[menuUid] == PlanedDiet.ALL
                ? groupConfiguration.totalPortions
                : groupConfiguration.diets.entries[dietButtons[menuUid]]
                    .totalPortions,
            factor: "1.0",
            total: 0,
            diet: dietButtons[menuUid],
          };
        }

        plan[menuUid] = mealPlan;
      }
    });

    if (dialogValues.selectedDiets == null && planedMealRecipe.length > 0) {
      // Vorauswahl setzen
      dietButtons[menueList[0]] = planedMealRecipe[0].diet;
    }

    if (
      planedMealRecipe.length > 0 &&
      plan &&
      dietButtons[menueList[0]] == planedMealRecipe[0].diet
    ) {
      // Werte übernehmen --> im Change Modus
      Object.values(plan as DialogPlanPortionsMealPlan).forEach(
        (planOfMenu) =>
          planOfMenu &&
          planedMealRecipe.forEach(
            (mealPlan) =>
              (planOfMenu[mealPlan.intolerance] = {
                ...planOfMenu[mealPlan.intolerance],
                active: true,
                diet: mealPlan.diet,
                factor: mealPlan.factor.toFixed(1),
                total: mealPlan.totalPortions,
                portions:
                  mealPlan.intolerance == PlanedDiet.FIX
                    ? mealPlan.totalPortions
                    : planOfMenu[mealPlan.intolerance].portions,
              }),
          ),
      );
    }
    setDialogValues({
      ...dialogValues,
      plan: plan,
      selectedDiets: dietButtons,
      menueList: menueList,
    });
  }
  /* ------------------------------------------
  // Feld-Änderungen
  // ------------------------------------------ */
  const onFieldUpdate = (event: React.ChangeEvent<HTMLInputElement>) => {
    const updatedField = event.target.id.split("_");
    let factor = "";
    let active = false;
    let portions = 0;
    const [, changedField, menueUid, intoleranceUid] = updatedField;

    if (
      !dialogValues.plan ||
      !dialogValues.plan[menueUid] ||
      dialogValues.plan[menueUid] === null
    ) {
      return;
    }
    const mealPlanning = dialogValues.plan[menueUid];
    if (!mealPlanning || mealPlanning[intoleranceUid] === null) {
      return;
    }
    if (changedField == "active") {
      active = event.target.checked;
      factor = mealPlanning[intoleranceUid]?.factor;
      portions = mealPlanning[intoleranceUid].portions;
    } else if (changedField == "factor") {
      active = mealPlanning[intoleranceUid].active;
      factor = event.target.value.replace(",", ".");
      portions = mealPlanning[intoleranceUid].portions;
    } else if (changedField == "total") {
      active = true;
      factor = "1.0";
      portions = parseInt(event.target.value);
    }

    let total = active ? Math.round(portions * parseFloat(factor)) : 0;

    if (isNaN(total)) {
      total = 0;
    }

    if (changedField == "active") {
      const menuePlan = dialogValues.plan[menueUid];
      if (menuePlan === null) {
        return;
      }
      // Gesetzte Werte übernehmen
      menuePlan[intoleranceUid].active = active;
      menuePlan[intoleranceUid].factor = factor;
      menuePlan[intoleranceUid].total = total;

      if (intoleranceUid == PlanedIntolerances.ALL) {
        // Wenn die 'Alle' Checkbox markiert ist, die anderen demarkieren.
        Object.keys(menuePlan).forEach((menueKey) => {
          if (menueKey !== PlanedIntolerances.ALL) {
            menuePlan![menueKey].active = false;
            menuePlan![menueKey].factor = "1.0";
            menuePlan![menueKey].total = 0;
          }
        });
      } else if (intoleranceUid != PlanedIntolerances.ALL) {
        // Die 'Alle' Checkbox demarkieren
        menuePlan[PlanedIntolerances.ALL].active = false;
        menuePlan[PlanedIntolerances.ALL].factor = "1.0";
        menuePlan[PlanedIntolerances.ALL].total = 0;
      }
      setDialogValues({
        ...dialogValues,
        plan: {
          ...dialogValues.plan,
          [menueUid]: menuePlan,
        },
      });
    } else {
      setDialogValues({
        ...dialogValues,
        plan: {
          ...dialogValues.plan,
          [menueUid]: {
            ...dialogValues.plan[menueUid],
            [intoleranceUid]: {
              ...mealPlanning[intoleranceUid],
              portions: portions,
              active: active,
              factor: factor,
              total: total,
            },
          },
        },
      });
    }
  };
  const onSwitchSyncAllMenues = () => {
    setDialogValues({
      ...dialogValues,
      selectedDiets: null,
      keepMenuPortionsInSync: !dialogValues.keepMenuPortionsInSync,
      plan: null,
      menueList: null, // diese muss neu aufgebaut werden
    });
  };
  /* ------------------------------------------
  // ToggleButton-Handling
  // ------------------------------------------ */
  /**
   * Prüft ob der Benutzer im aktuellen Plan für ein Menü bereits
   * Werte eingegeben hat (Checkbox aktiviert, Faktor geändert, etc.).
   *
   * @param menuUid UID des Menüs, dessen Plan geprüft wird.
   * @returns `true` wenn Änderungen vorliegen.
   */
  const hasUserModifiedPlan = (menuUid: string): boolean => {
    const mealPlan = dialogValues.plan?.[menuUid];
    if (!mealPlan) {
      return false;
    }
    const currentDiet = dialogValues.selectedDiets?.[menuUid];
    if (currentDiet === PlanedDiet.FIX) {
      // Bei Fix-Portionen: geändert, sobald Portionen eingegeben wurden
      const fixEntry = mealPlan[PlanedDiet.FIX];
      return fixEntry != null && fixEntry.portions > 0;
    }
    // Bei Diät-Modus: geändert, sobald eine Checkbox aktiviert oder
    // ein Faktor angepasst wurde
    return Object.values(mealPlan).some(
      (entry) => entry.active || entry.factor !== "1.0",
    );
  };

  const onToggleButtonClick = async (
    event: React.MouseEvent<HTMLElement>,
    activeButton: string | null,
  ) => {
    if (activeButton == null) {
      // Etwas muss markiert sein.
      return;
    }
    const [, menuUid] = event.currentTarget.id.split("_");

    // Prüfen ob Benutzer bereits Werte geändert hat
    if (hasUserModifiedPlan(menuUid)) {
      const isConfirmed = (await customDialog({
        dialogType: DialogType.Confirm,
        title: `⚠️  ${TEXT_ATTENTION}`,
        text: TEXT_CONFIRM_DIET_SWITCH,
        buttonTextConfirm: TEXT_PROCEED,
      })) as boolean;

      if (!isConfirmed) {
        return;
      }
    }

    setDialogValues({
      ...dialogValues,
      selectedDiets: {
        ...dialogValues.selectedDiets,
        [menuUid]: activeButton,
      },
      //  Darf nur für das Menü neu aufgebaut werden, für das eine neue Diät-Gruppe gewählt wurde
      plan: {...dialogValues.plan, [menuUid]: null},
    });
  };
  /* ------------------------------------------
  // Dialog-Schliessen-Handling
  // ------------------------------------------ */
  const onAddClick = () => {
    // Prüfen ob Checkboxen markiert sind ohne Faktor!
    if (!dialogValues.plan) {
      return;
    }

    const dialogValidationMessages: FormValidationFieldError[] = [];
    //Prüfen ob es aktivierte Checkboxen ohne Faktor gibt, dass kann nicht gerechnet werden
    Object.keys(dialogValues.plan).forEach((menueUid) => {
      if (
        Object.values(dialogValues.plan![menueUid]!).reduce(
          (innerRunningCounter, intolerance) => {
            if (intolerance.active == true && !intolerance.factor) {
              innerRunningCounter++;
            }
            return innerRunningCounter;
          },
          0,
        ) > 0
      ) {
        dialogValidationMessages.push({
          priority: 1,
          fieldName: menueUid,
          errorMessage: TEXT_MISSING_FACTOR,
        });
      }
    });

    // Prüfen ob pro Menü überhaupt eine Checkbox aktiviert wurde
    Object.keys(dialogValues.plan).forEach((menueUid) => {
      if (
        Object.values(dialogValues.plan![menueUid]!).reduce(
          (innerRunningCounter, intolerance) => {
            if (intolerance.active == true) {
              innerRunningCounter++;
            }
            return innerRunningCounter;
          },
          0,
        ) == 0
      ) {
        dialogValidationMessages.push({
          priority: 1,
          fieldName: menueUid,
          errorMessage: TEXT_NO_GROUP_SELECTED,
        });
      }
    });

    // Prüfen ob fixe Portionen eingegeben wurden
    Object.keys(dialogValues.plan).forEach((menueUid) => {
      if (
        Object.keys(dialogValues.plan![menueUid]!).includes(PlanedDiet.FIX) &&
        (dialogValues.plan![menueUid]![PlanedDiet.FIX].portions == 0 ||
          !dialogValues.plan![menueUid]![PlanedDiet.FIX].portions)
      ) {
        dialogValidationMessages.push({
          priority: 1,
          fieldName: menueUid,
          errorMessage: TEXT_NO_PORTIONS_GIVEN,
        });
      }
    });

    if (dialogValidationMessages.length == 0) {
      // Zurückmelden, was alles aktiv ist.
      setDialogValidation([]);
      const selectedPlans = {} as {
        [key: Menue["uid"]]: DialogPlanPortionsMealPlanning;
      };

      Object.keys(dialogValues.plan).forEach((menuUid) => {
        const intolerances = {} as DialogPlanPortionsMealPlanning;
        Object.keys(dialogValues.plan![menuUid]!).forEach((intoleraceUid) => {
          if (dialogValues.plan![menuUid]![intoleraceUid].active === true) {
            intolerances[intoleraceUid] =
              dialogValues.plan![menuUid]![intoleraceUid];
          }
        });
        selectedPlans[menuUid] = intolerances;
      });

      if (
        Object.keys(selectedMenues!).length > 1 &&
        dialogValues.keepMenuPortionsInSync
      ) {
        Object.keys(selectedMenues!).forEach((menueUid) => {
          selectedPlans[menueUid] = selectedPlans[KEEP_IN_SYNC_KEY];
        });
        delete selectedPlans?.[KEEP_IN_SYNC_KEY];
      }

      // Wenn SYNC --> auf alles Menüs umbiegen
      // Objekt erzeugen --> menueUid: {intolerance {factore}}
      onAddClickSuper(selectedPlans);
      setDialogValues(DIALOG_VALUES_INITIAL_VALUES);
    } else {
      setDialogValidation(dialogValidationMessages);
    }
  };
  const onBackClick = () => {
    setDialogValues(DIALOG_VALUES_INITIAL_VALUES);
    setDialogValidation([]);
    onBackClickSuper();
  };
  const onCancelClick = () => {
    setDialogValues(DIALOG_VALUES_INITIAL_VALUES);
    setDialogValidation([]);
    onCancelClickSuper();
  };

  return (
    <React.Fragment>
      {selectedMenues ? (
        <Dialog open={open} maxWidth="md">
          <DialogTitle>
            {planedObject == PlanedObject.RECIPE
              ? TEXT_DIALOG_PLAN_RECIPE_PORTIONS_TITLE
              : TEXT_DIALOG_PLAN_GOODS_PORTIONS_TITLE}
          </DialogTitle>
          <DialogContent>
            {Object.keys(selectedMenues).length > 1 && (
              <FormGroup style={{marginBottom: "1em"}}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={dialogValues.keepMenuPortionsInSync}
                      onChange={onSwitchSyncAllMenues}
                    />
                  }
                  label={TEXT_KEEP_PLANED_PORTIONS_IN_SYNC}
                />
              </FormGroup>
            )}
            {dialogValues.menueList &&
              // Für alle gewählten Menü, den Block aufbauen
              dialogValues.menueList.map((menueUid, counter) => {
                let meal: Meal = {
                  uid: "",
                  date: "",
                  mealType: "",
                  mealTypeName: "",
                  menuOrder: [],
                };
                if (menueUid !== KEEP_IN_SYNC_KEY) {
                  meal = Menuplan.findMealOfMenu({
                    menueUid: menueUid,
                    meals: meals,
                  });
                }
                return (
                  <React.Fragment
                    key={"dialogPlanPortionsDetailBlock_" + menueUid}
                  >
                    {counter > 0 && (
                      <Divider
                        key={"dialogPortion_Divider_" + menueUid}
                        variant="fullWidth"
                        style={{
                          marginTop: theme.spacing(4),
                          marginBottom: theme.spacing(4),
                          marginRight: theme.spacing(-2),
                          marginLeft: theme.spacing(-2),
                          backgroundColor: theme.palette.primary.main,
                          height: "2px",
                        }}
                      />
                    )}
                    {menueUid == KEEP_IN_SYNC_KEY ? (
                      <React.Fragment>
                        <Typography variant="subtitle1">
                          {`${TEXT_ON_DATE}: `}
                        </Typography>
                        {Object.keys(selectedMenues).map((menueUid) => {
                          meal = Menuplan.findMealOfMenu({
                            menueUid: menueUid,
                            meals: meals,
                          });

                          return (
                            <Typography
                              variant="subtitle1"
                              key={"date_" + menueUid + counter}
                            >
                              <strong>
                                {`${new Date(meal.date).toLocaleString(
                                  "default",
                                  {
                                    weekday: "long",
                                  },
                                )}`}
                              </strong>
                              {` ${new Date(meal.date).toLocaleString("de-CH", {
                                year: "numeric",
                                month: "2-digit",
                                day: "2-digit",
                              })} - ${mealTypes.entries[meal.mealType].name}`}
                            </Typography>
                          );
                        })}
                      </React.Fragment>
                    ) : (
                      <Typography variant="subtitle1">
                        {`${TEXT_ON_DATE}: `}
                        <strong>
                          {`${new Date(meal.date).toLocaleString("default", {
                            weekday: "long",
                          })}`}
                        </strong>
                        {` ${new Date(meal.date).toLocaleString("de-CH", {
                          year: "numeric",
                          month: "2-digit",
                          day: "2-digit",
                        })} - ${mealTypes.entries[meal.mealType].name}`}
                      </Typography>
                    )}
                    <ToggleButtonGroup
                      key={"dialogPortion_ToggleButtonGroup_" + menueUid}
                      id={"dialogPortion_ToggleButtonGroup_" + menueUid}
                      exclusive
                      value={dialogValues.selectedDiets}
                      onChange={onToggleButtonClick}
                      aria-label="Mögliche-Gruppen"
                      style={{
                        display: "flex",
                      }}
                      sx={classes.toggleButtonGroup}
                      color="primary"
                    >
                      <ToggleButton
                        key={
                          "dialogPlanPortionsMealBlockDietButton_" +
                          menueUid +
                          "_" +
                          PlanedDiet.ALL
                        }
                        id={
                          "dialogPlanPortionsMealBlockDietButton_" +
                          menueUid +
                          "_" +
                          PlanedDiet.ALL
                        }
                        value={PlanedDiet.ALL}
                        aria-label={TEXT_ALL}
                        sx={classes.toggleButton}
                        style={{
                          ...(dialogValues.selectedDiets &&
                            dialogValues.selectedDiets[menueUid] ===
                              PlanedDiet.ALL && {
                              color: theme.palette.primary.main,
                              backgroundColor: alpha(
                                theme.palette.primary.main,
                                0.1,
                              ),
                            }),
                        }}
                      >
                        {TEXT_ALL}
                      </ToggleButton>
                      {groupConfiguration?.diets.order.map((dietUid) => (
                        <ToggleButton
                          key={
                            "dialogPlanPortionsMealBlockDietButton_" +
                            menueUid +
                            "_" +
                            dietUid
                          }
                          id={
                            "dialogPlanPortionsMealBlockDietButton_" +
                            menueUid +
                            "_" +
                            dietUid
                          }
                          value={dietUid}
                          aria-label={
                            groupConfiguration.diets.entries[dietUid].name
                          }
                          sx={classes.toggleButton}
                          style={{
                            ...(dialogValues.selectedDiets &&
                              dialogValues.selectedDiets[menueUid] ===
                                dietUid && {
                                color: theme.palette.primary.main,
                                backgroundColor: alpha(
                                  theme.palette.primary.main,
                                  0.1,
                                ),
                              }),
                          }}
                        >
                          {groupConfiguration.diets.entries[dietUid].name}
                        </ToggleButton>
                      ))}
                      <ToggleButton
                        id={
                          "dialogPlanPortionsMealBlockDietButton_" +
                          menueUid +
                          "_" +
                          PlanedDiet.FIX
                        }
                        value={PlanedDiet.FIX}
                        aria-label={TEXT_FIX_PORTIONS}
                        sx={classes.toggleButton}
                        style={{
                          ...(dialogValues.selectedDiets &&
                            dialogValues.selectedDiets[menueUid] ===
                              PlanedDiet.FIX && {
                              color: theme.palette.primary.main,
                              backgroundColor: alpha(
                                theme.palette.primary.main,
                                0.1,
                              ),
                            }),
                        }}
                      >
                        {TEXT_FIX_PORTIONS}
                      </ToggleButton>
                    </ToggleButtonGroup>

                    {dialogValues.selectedDiets && (
                      <DialogPlanPortionsMealBlock
                        key={"dialogPlanPortionsMealBlock_" + menueUid}
                        selectedDietUid={dialogValues.selectedDiets[menueUid]}
                        plan={dialogValues.plan}
                        menueUid={menueUid}
                        groupConfiguration={groupConfiguration}
                        onFieldUpdate={onFieldUpdate}
                      />
                    )}
                    {/* Fehlermeldung anzeigen falls notwendig */}
                    {dialogValidation.length > 0 &&
                      dialogValidation.some(
                        (errorMessage) => errorMessage.fieldName === menueUid,
                      ) && (
                        <Container
                          style={{
                            marginTop: theme.spacing(4),
                            paddingLeft: 0,
                            paddingRight: 0,
                          }}
                        >
                          {dialogValidation
                            .filter((message) => message.fieldName == menueUid)
                            .map((errorMessage) => (
                              <Typography color="error" key="errormessage">
                                {errorMessage.errorMessage}
                              </Typography>
                            ))}
                        </Container>
                      )}
                  </React.Fragment>
                );
              })}
          </DialogContent>
          <DialogActions style={{marginTop: theme.spacing(2)}}>
            {/* Abbrechen, Bestägigen, Zurück */}
            <Button onClick={onCancelClick} color="primary" variant="outlined">
              {TEXT_CANCEL}
            </Button>
            {planedObject == PlanedObject.RECIPE &&
              planedMealRecipe.length == 0 && (
                // Nur anzeigen, wenn neues Rezept hinzugeüfgt wird.
                <Button
                  onClick={onBackClick}
                  color="primary"
                  variant="outlined"
                >
                  {TEXT_BACK}
                </Button>
              )}
            <Button onClick={onAddClick} color="primary" variant="contained">
              {planedMealRecipe.length == 0 ? TEXT_ADD : TEXT_APPLY}
            </Button>
          </DialogActions>
        </Dialog>
      ) : (
        <React.Fragment />
      )}
    </React.Fragment>
  );
};
/* ===================================================================
// ========== Einplanung der Portionen - Block pro Mahlzeit===========
// =================================================================== */
interface DialogPlanPortionsMealBlockProps {
  menueUid: Menue["uid"];
  selectedDietUid: PortionPlan["diet"];
  groupConfiguration: EventGroupConfiguration;
  plan: DialogPlanPortionsDialogValues["plan"];
  onFieldUpdate: (event: React.ChangeEvent<HTMLInputElement>) => void;
}
const DialogPlanPortionsMealBlock = ({
  menueUid,
  plan,
  selectedDietUid,
  groupConfiguration,
  onFieldUpdate,
}: DialogPlanPortionsMealBlockProps) => {
  return (
    plan &&
    (selectedDietUid == PlanedDiet.FIX ? (
      <Grid container spacing={2}>
        <Grid size={12}>
          <TextField
            id={
              "dialogPlanPortionsMealBlockIntolerance_total_" +
              menueUid +
              "_" +
              PlanedDiet.FIX
            }
            key={
              "dialogPlanPortionsMealBlockIntolerance_total_" +
              menueUid +
              "_" +
              PlanedDiet.FIX
            }
            label={TEXT_NO_OF_SERVINGS}
            type="outlined"
            onChange={onFieldUpdate}
            value={plan[Object.keys(plan)[0]]!.FIX.total}
            fullWidth
          />
        </Grid>
      </Grid>
    ) : (
      <Grid container spacing={2}>
        <Grid size={8} />
        <Grid size={2}>
          <Typography>
            <strong>{TEXT_FACTOR} </strong>
            <Tooltip title={TEXT_FACTOR_TOOLTIP} placement="bottom" arrow>
              <InfoIcon fontSize="small" style={{marginLeft: "0.5em"}} />
            </Tooltip>
          </Typography>
        </Grid>
        <Grid size={2}>
          <strong>{TEXT_TOTAL_PORTIONS}</strong>
        </Grid>
        {/* Zuerst eine Zeile mit für das Total der gewählten Diät-Gruppe */}
        <DialogPlanPortionsMealBlockRow
          key={
            "dialogPlanPortionsMealBlockRow_" +
            menueUid +
            "_" +
            PlanedIntolerances.ALL
          }
          intoleranceUid={PlanedIntolerances.ALL}
          menueUid={menueUid}
          intoleranceName={TEXT_ALL}
          portionsOfIntolerance={
            selectedDietUid == PlanedDiet.ALL
              ? groupConfiguration.totalPortions
              : groupConfiguration.diets.entries[selectedDietUid].totalPortions
          }
          active={plan[menueUid]?.[PlanedIntolerances.ALL]?.active}
          factor={plan[menueUid]?.[PlanedIntolerances.ALL]?.factor}
          totalPortions={plan[menueUid]?.[PlanedIntolerances.ALL]?.total}
          onFieldUpdate={onFieldUpdate}
        />
        {groupConfiguration.intolerances.order.map((intoleranceUid) => (
          <DialogPlanPortionsMealBlockRow
            key={
              "dialogPlanPortionsMealBlockRow_" +
              menueUid +
              "_" +
              intoleranceUid
            }
            intoleranceUid={intoleranceUid}
            menueUid={menueUid}
            intoleranceName={
              groupConfiguration.intolerances.entries[intoleranceUid].name
            }
            portionsOfIntolerance={
              selectedDietUid == PlanedDiet.ALL
                ? groupConfiguration.intolerances.entries[intoleranceUid]
                    .totalPortions
                : groupConfiguration.portions[selectedDietUid][intoleranceUid]
            }
            active={plan[menueUid]?.[intoleranceUid]?.active}
            factor={plan[menueUid]?.[intoleranceUid]?.factor}
            totalPortions={plan[menueUid]?.[intoleranceUid]?.total}
            onFieldUpdate={onFieldUpdate}
          />
        ))}
        <Grid size={12}>
          <Divider />
        </Grid>
        <Grid size={8}>
          <Typography>
            <strong>{TEXT_YOUR_SELECTION_MAKES_X_SERVINGS}</strong>
          </Typography>
        </Grid>
        <Grid size={2} />
        <Grid size={2}>
          <TextField
            fullWidth
            disabled
            value={
              plan && plan[menueUid]
                ? Object.values(plan[menueUid]!)
                    .filter((portion) => portion !== null && portion.active)
                    .reduce(
                      (runningSum, portion) => runningSum + portion.total,
                      0,
                    )
                : ""
            }
            label={TEXT_TOTAL_PORTIONS}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <strong>=</strong>
                </InputAdornment>
              ),
            }}
          />
        </Grid>
      </Grid>
    ))
  );
};
/* ===================================================================
// ================ Einplanung der Portionen - Reihe =================
// =================================================================== */
interface DialogPlanPortionsMealBlockRowProps {
  active: boolean | undefined;
  menueUid: Menue["uid"];
  intoleranceUid: PortionPlan["intolerance"];
  intoleranceName: Intolerance["name"];
  portionsOfIntolerance: number;
  factor: string | undefined;
  totalPortions: PortionPlan["totalPortions"] | undefined;
  onFieldUpdate: (event: React.ChangeEvent<HTMLInputElement>) => void;
}
export const DialogPlanPortionsMealBlockRow = ({
  active,
  menueUid,
  intoleranceUid,
  intoleranceName,
  portionsOfIntolerance,
  factor,
  totalPortions,
  onFieldUpdate,
}: DialogPlanPortionsMealBlockRowProps) => {
  const theme = useTheme();

  return (
    <React.Fragment
      key={
        "dialogPlanPortionsMealBlockIntoleranceRow_" +
        menueUid +
        "_" +
        intoleranceUid
      }
    >
      <Grid size={8}>
        <FormControlLabel
          key={
            "dialogPlanPortionsMealBlockIntoleranceFormcontroll_" +
            menueUid +
            intoleranceUid
          }
          style={{width: "100%"}}
          control={
            <Checkbox
              id={
                "dialogPlanPortionsMealBlockIntolerance_active_" +
                menueUid +
                "_" +
                intoleranceUid
              }
              checked={active}
              onChange={onFieldUpdate}
            />
          }
          label={
            <Typography variant="body1">
              {intoleranceName}
              <span
                style={{
                  color: theme.palette.text.secondary,
                  marginLeft: theme.spacing(1),
                }}
              >
                {`(${portionsOfIntolerance} ${
                  portionsOfIntolerance == 1 ? TEXT_PORTION : TEXT_PORTIONS
                })`}
              </span>
            </Typography>
          }
        />
      </Grid>
      <Grid size={2}>
        <TextField
          id={
            "dialogPlanPortionsMealBlockIntolerance_factor_" +
            menueUid +
            "_" +
            intoleranceUid
          }
          fullWidth
          value={active ? factor : ""}
          error={
            !factor
              ? false
              : factor != "" &&
                !/^(\d+|\d+\.\d*|\d*\.\d+|1\.|\.|,)?$/.test(factor)
          }
          helperText={
            factor && !/^(\d+|\d+\.\d*|\d*\.\d+|1\.|\.|,)?$/.test(factor)
              ? TEXT_PLEASE_PROVIDE_VALID_FACTOR
              : ""
          }
          disabled={!active}
          onChange={onFieldUpdate}
          label={TEXT_FACTOR}
        />
      </Grid>
      <Grid size={2}>
        <TextField
          id={
            "dialogPlanPortionsMealBlockIntolerance_totalPortions_" +
            menueUid +
            "_" +
            intoleranceUid
          }
          fullWidth
          disabled
          value={totalPortions == 0 ? "" : totalPortions}
          // onChange={onChangeMenueName}
          label={TEXT_TOTAL_PORTIONS}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <strong>=</strong>
              </InputAdornment>
            ),
          }}
        />
      </Grid>
    </React.Fragment>
  );
};
/* ===================================================================
// ====================== Dialog Menü ändern =========================
// =================================================================== */
interface DialogEditMenueProps {
  open: boolean;
  menue: Menue;
  note: Note | undefined;
  mealRecipes: Menuplan["mealRecipes"];
  products: Menuplan["products"];
  materials: Menuplan["materials"];
  groupConfiguration: EventGroupConfiguration;
  onCloseDialog: () => void;
  onEditObject: ({objectType, uid}: EditMenueObjectManipulation) => void;
  onDeleteObject: ({objectType, uid}: EditMenueObjectManipulation) => void;
}
interface EditMenueObjectManipulation {
  objectType: MenueEditTypes;
  uid: string;
}

export const DialogEditMenue = ({
  open,
  menue,
  note,
  mealRecipes,
  products,
  materials,
  groupConfiguration,
  onCloseDialog,
  onEditObject,
  onDeleteObject,
}: DialogEditMenueProps) => {
  const theme = useTheme();

  return (
    <React.Fragment>
      <Dialog open={open} maxWidth="sm" onClose={onCloseDialog} fullWidth>
        {menue?.name && <DialogTitle>{menue.name}</DialogTitle>}
        <DialogContent>
          {/* Notiz  */}
          {note && (
            <List dense>
              <ListItem>
                <ListItemText primary={note.text} />
                <ListItemSecondaryAction>
                  <IconButton
                    edge="end"
                    aria-label="delete"
                    onClick={() =>
                      onDeleteObject({
                        objectType: MenueEditTypes.NOTE,
                        uid: note.uid,
                      })
                    }
                    size="large"
                  >
                    <DeleteIcon />
                  </IconButton>
                </ListItemSecondaryAction>
              </ListItem>
            </List>
          )}
          {menue?.mealRecipeOrder.length > 0 && (
            <List
              dense
              subheader={
                <ListSubheader disableGutters>{TEXT_RECIPES}</ListSubheader>
              }
            >
              {menue.mealRecipeOrder.map((mealRecipeUid) => (
                <ListItem key={"listItemMealRecipe_" + mealRecipeUid}>
                  <ListItemText
                    primary={
                      <span>
                        {mealRecipes[mealRecipeUid]?.recipe.name}
                        <span
                          style={{
                            color: theme.palette.text.secondary,
                          }}
                        >
                          {mealRecipes[mealRecipeUid]?.recipe.type ===
                          RecipeType.variant
                            ? ` [${TEXT_VARIANT}: ${mealRecipes[mealRecipeUid]?.recipe.variantName}]`
                            : ``}
                        </span>
                      </span>
                    }
                    secondary={generatePlanedPortionsText({
                      uid: mealRecipeUid,
                      portionPlan: mealRecipes[mealRecipeUid].plan,
                      groupConfiguration: groupConfiguration,
                    })}
                  />
                  <ListItemSecondaryAction>
                    <IconButton
                      edge="end"
                      aria-label="edit"
                      onClick={() =>
                        onEditObject({
                          objectType: MenueEditTypes.MEALRECIPE,
                          uid: mealRecipeUid,
                        })
                      }
                      size="large"
                    >
                      <Edit />
                    </IconButton>
                    <IconButton
                      edge="end"
                      aria-label="delete"
                      onClick={() =>
                        onDeleteObject({
                          objectType: MenueEditTypes.MEALRECIPE,
                          uid: mealRecipeUid,
                        })
                      }
                      size="large"
                    >
                      <DeleteIcon />
                    </IconButton>
                  </ListItemSecondaryAction>
                </ListItem>
              ))}
            </List>
          )}
          {/* Produkte und Material */}
          {menue?.productOrder.length > 0 && (
            <List
              dense
              subheader={
                <ListSubheader disableGutters>{TEXT_PRODUCTS}</ListSubheader>
              }
            >
              {menue.productOrder.map((productUid) => (
                <ListItem key={"listItemProducts_" + productUid}>
                  <ListItemText
                    primary={`${
                      products[productUid]?.totalQuantity > 0
                        ? `${products[productUid]?.totalQuantity} ${
                            products[productUid].unit
                              ? products[productUid].unit
                              : " ×"
                          }`
                        : ``
                    } ${products[productUid]?.productName}
                      ${
                        products[productUid]?.planMode ==
                        GoodsPlanMode.PER_PORTION
                          ? `(${products[productUid].quantity} ${products[productUid].unit} ${TEXT_PER_PORTION})`
                          : ``
                      }`}
                    secondary={
                      products[productUid]?.planMode ==
                      GoodsPlanMode.PER_PORTION
                        ? generatePlanedPortionsText({
                            uid: productUid,
                            portionPlan: products[productUid].plan,
                            groupConfiguration: groupConfiguration,
                          })
                        : ``
                    }
                  />
                  <ListItemSecondaryAction>
                    <IconButton
                      edge="end"
                      aria-label="edit"
                      onClick={() =>
                        onEditObject({
                          objectType: MenueEditTypes.PRODUCT,
                          uid: productUid,
                        })
                      }
                      size="large"
                    >
                      <Edit />
                    </IconButton>
                    <IconButton
                      edge="end"
                      aria-label="delete"
                      onClick={() =>
                        onDeleteObject({
                          objectType: MenueEditTypes.PRODUCT,
                          uid: productUid,
                        })
                      }
                      size="large"
                    >
                      <DeleteIcon />
                    </IconButton>
                  </ListItemSecondaryAction>
                </ListItem>
              ))}
            </List>
          )}

          {menue?.materialOrder.length > 0 && (
            <List
              dense
              subheader={
                <ListSubheader disableGutters>{TEXT_MATERIAL}</ListSubheader>
              }
            >
              {menue.materialOrder.map((materialUid) => (
                <ListItem key={"listItemMaterials_" + materialUid}>
                  <ListItemText
                    primary={`${
                      materials[materialUid]?.totalQuantity > 0
                        ? `${materials[materialUid]?.totalQuantity} ${
                            materials[materialUid].unit
                              ? materials[materialUid].unit
                              : " ×"
                          }`
                        : ``
                    } ${materials[materialUid]?.materialName}
                      ${
                        materials[materialUid]?.planMode ==
                        GoodsPlanMode.PER_PORTION
                          ? `(${materials[materialUid].quantity} ${materials[materialUid].unit} ${TEXT_PER_PORTION})`
                          : ``
                      }`}
                    secondary={
                      materials[materialUid]?.planMode ==
                      GoodsPlanMode.PER_PORTION
                        ? generatePlanedPortionsText({
                            uid: materialUid,
                            portionPlan: materials[materialUid].plan,
                            groupConfiguration: groupConfiguration,
                          })
                        : ``
                    }
                  />
                  <ListItemSecondaryAction>
                    <IconButton
                      edge="end"
                      aria-label="edit"
                      onClick={() =>
                        onEditObject({
                          objectType: MenueEditTypes.MATERIAL,
                          uid: materialUid,
                        })
                      }
                      size="large"
                    >
                      <Edit />
                    </IconButton>
                    <IconButton
                      edge="end"
                      aria-label="delete"
                      onClick={() =>
                        onDeleteObject({
                          objectType: MenueEditTypes.MATERIAL,
                          uid: materialUid,
                        })
                      }
                      size="large"
                    >
                      <DeleteIcon />
                    </IconButton>
                  </ListItemSecondaryAction>
                </ListItem>
              ))}
            </List>
          )}
        </DialogContent>
        <DialogActions style={{marginTop: theme.spacing(2)}}>
          {/* schliessen */}
          <Button onClick={onCloseDialog} color="primary" variant="contained">
            {TEXT_CLOSE}
          </Button>
        </DialogActions>
      </Dialog>
    </React.Fragment>
  );
};
/* ===================================================================
// ================== Dialog Produkte/Material =======================
// =================================================================== */
interface DialogGoodsProps {
  open: boolean;
  goodsType: GoodsType;
  units: Unit[];
  products: Product[];
  materials: Material[];
  productToUpdate: MenuplanProduct | null;
  materialToUpdate: MenuplanMaterial | null;
  departments: Department[];
  authUser: AuthUser;
  onCancel: () => void;
  onOk: ({
    planMode,
    quantity,
    unit,
    product,
    material,
  }: OnAddGoodToMenuProps) => void;
  onMaterialCreate: (material: Material) => void;
  onProductCreate: (product: Product) => void;
  firebase: Firebase;
}
interface DialogGoodsValues {
  planMode: GoodsPlanMode;
  quantity: number;
  unit: Unit["key"];
  product: Product | null;
  material: Material | null;
  dialogOpen: boolean;
}
interface OnAddGoodToMenuProps {
  planMode: GoodsPlanMode;
  quantity: number;
  unit: Unit["key"];
  product: Product | null;
  material: Material | null;
}

const DIALOG_VALUES_INITIAL_STATE = {
  planMode: GoodsPlanMode.TOTAL,
  quantity: 0,
  unit: "",
  product: null,
  material: null,
  // Die Werte werden erst mit dem useState gesetzt. Dann darf der Dialog nicht
  // bereits geöffnet seind, darum wird der Zustand auch über den useState gesteuert
  // ansonsten wäre der Autocomplete jeweils leer
  dialogOpen: false,
};

export const DialogGoods = ({
  open,
  goodsType,
  units,
  products,
  materials,
  productToUpdate,
  materialToUpdate,
  departments,
  firebase,
  authUser,
  onCancel: onCancelSuper,
  onOk: onOkSuper,
  onMaterialCreate: onMaterialCreateSuper,
  onProductCreate: onProductCreateSuper,
}: DialogGoodsProps) => {
  const theme = useTheme();
  const [dialogValues, setDialogValues] = useState<DialogGoodsValues>(
    DIALOG_VALUES_INITIAL_STATE,
  );
  const [materialAddPopupValues, setMaterialAddPopupValues] = useState({
    ...MATERIAL_POP_UP_VALUES_INITIAL_STATE,
    ...{popUpOpen: false},
  });
  const [productAddPopupValues, setProductAddPopupValues] = useState({
    ...PRODUCT_POP_UP_VALUES_INITIAL_STATE,
    ...{popUpOpen: false},
  });
  // Falls initialer Wert kommt diesen übernehmen

  if (
    goodsType == GoodsType.PRODUCT &&
    productToUpdate !== null &&
    !dialogValues.product
  ) {
    const product = products.find(
      (product) => product.uid == productToUpdate.productUid,
    );

    if (product) {
      setDialogValues({
        ...dialogValues,
        planMode: productToUpdate.planMode,
        quantity: productToUpdate.quantity,
        unit: productToUpdate.unit,
        product: product,
        dialogOpen: open,
      });
    }
  } else if (
    goodsType == GoodsType.MATERIAL &&
    materialToUpdate !== null &&
    !dialogValues.material
  ) {
    const material = materials.find(
      (material) => material.uid == materialToUpdate.materialUid,
    );
    if (material) {
      setDialogValues({
        ...dialogValues,
        planMode: materialToUpdate.planMode,
        quantity: materialToUpdate.quantity,
        unit: materialToUpdate.unit,
        material: material,
        dialogOpen: open,
      });
    }
  } else if (open === true && dialogValues.dialogOpen === false) {
    // Item wird neu hinzugefügt, einfach den Dialog öffnen
    setDialogValues({...dialogValues, dialogOpen: true});
  }
  /* ------------------------------------------
  // Typ der Einplanung
  // ------------------------------------------ */
  const onTypeChange = (
    event: React.MouseEvent<HTMLElement>,
    newValue: string | null,
  ) => {
    if (newValue === null) {
      // Ein Button muss immer aktiv sein
      return;
    }

    setDialogValues({
      ...dialogValues,
      planMode: newValue as unknown as GoodsPlanMode,
    });
  };
  /* ------------------------------------------
  // Feld-Änderung
  // ------------------------------------------ */
  const onChangeField = (
    event: React.ChangeEvent<HTMLInputElement>,
    newValue?: string | Unit | Product | Material | null,
    action?: AutocompleteChangeReason,
    objectId?: string,
  ) => {
    let material: Material;
    let product: Product;

    if (
      (action === "selectOption" || action === "blur") &&
      objectId?.startsWith("material")
    ) {
      // Prüfen ob neues Material angelegt wird
      material = newValue as Material;
      if (typeof material === "object" && material?.name.endsWith(TEXT_ADD)) {
        // Begriff Hinzufügen und Anführzungszeichen entfernen
        const materialName = material.name.match('".*"')![0].slice(1, -1);

        // Neues Produkt. PopUp Anzeigen und nicht weiter
        setMaterialAddPopupValues({
          ...materialAddPopupValues,
          name: materialName,
          popUpOpen: true,
        });
        return;
      } else {
        if (typeof newValue === "string") {
          material = materials.find((mat) => mat.name == newValue)!;
        }
        if (material) {
          setDialogValues({
            ...dialogValues,
            material: material ? material : null,
          });
        }
        return;
      }
    } else if (
      (action === "selectOption" || action === "blur") &&
      objectId?.startsWith("product")
    ) {
      // Prüfen ob neues Produkt angelegt wird
      product = newValue as Product;
      if (typeof product === "object" && product.name.endsWith(TEXT_ADD)) {
        // Begriff Hinzufügen und Anführzungszeichen entfernen
        const productName = product.name.match('".*"')![0].slice(1, -1);

        // Neues Produkt. PopUp Anzeigen und nicht weiter
        setProductAddPopupValues({
          ...productAddPopupValues,
          name: productName,
          popUpOpen: true,
        });
        return;
      } else {
        if (typeof newValue === "string") {
          product = products.find((prd) => prd.name == newValue)!;
        }
        if (product) {
          setDialogValues({
            ...dialogValues,
            product: product ? product : null,
          });
        }
        return;
      }
    } else if (action === "clear" && objectId?.startsWith("material")) {
      setDialogValues({
        ...dialogValues,
        material: null,
      });
      return;
    } else if (action === "clear" && objectId?.startsWith("product")) {
      setDialogValues({
        ...dialogValues,
        product: null,
      });
      return;
    }

    if (objectId == "product_" || objectId == "material_") {
      setDialogValues({
        ...dialogValues,
        [objectId.slice(0, -1)]: newValue,
      });
    } else if (objectId == "unit_" || objectId == "unit") {
      const newUnit = newValue as Unit;

      setDialogValues({
        ...dialogValues,
        unit: newUnit?.key ? newUnit.key : "",
      });
    } else {
      if (isNaN(parseFloat(event.target.value))) {
        setDialogValues({
          ...dialogValues,
          [event.target.id]: event.target.value,
        });
      } else {
        setDialogValues({
          ...dialogValues,
          [event.target.id]: parseFloat(event.target.value),
        });
      }
    }
  };
  /* ------------------------------------------
  // Pop-Up Handler Material/Produkt
  // ------------------------------------------ */
  const onMaterialCreate = (material: Material) => {
    setDialogValues({...dialogValues, material: material});
    setMaterialAddPopupValues({
      ...MATERIAL_POP_UP_VALUES_INITIAL_STATE,
      popUpOpen: false,
    });

    onMaterialCreateSuper(material);
  };
  const onProductCreate = (product: Product) => {
    setDialogValues({...dialogValues, product: product});
    setProductAddPopupValues({
      ...PRODUCT_POP_UP_VALUES_INITIAL_STATE,
      popUpOpen: false,
    });
    onProductCreateSuper(product);
  };
  const onProductChooseExisting = (product: Product) => {
    setDialogValues({...dialogValues, product: product});
    setProductAddPopupValues({
      ...PRODUCT_POP_UP_VALUES_INITIAL_STATE,
      popUpOpen: false,
    });
  };
  const onCloseDialogMaterial = () => {
    setMaterialAddPopupValues({
      ...MATERIAL_POP_UP_VALUES_INITIAL_STATE,
      popUpOpen: false,
    });
  };
  const onCloseDialogProduct = () => {
    setProductAddPopupValues({
      ...PRODUCT_POP_UP_VALUES_INITIAL_STATE,
      popUpOpen: false,
    });
  };
  const onOk = () => {
    onOkSuper({
      planMode: dialogValues.planMode,
      quantity: dialogValues.quantity,
      unit: dialogValues.unit,
      product: dialogValues.product,
      material: dialogValues.material,
    });
    setMaterialAddPopupValues({
      ...MATERIAL_POP_UP_VALUES_INITIAL_STATE,
      ...{popUpOpen: false},
    });
    setProductAddPopupValues({
      ...PRODUCT_POP_UP_VALUES_INITIAL_STATE,
      ...{popUpOpen: false},
    });

    setDialogValues(DIALOG_VALUES_INITIAL_STATE);
  };
  const onCancel = () => {
    setMaterialAddPopupValues({
      ...MATERIAL_POP_UP_VALUES_INITIAL_STATE,
      ...{popUpOpen: false},
    });
    setProductAddPopupValues({
      ...PRODUCT_POP_UP_VALUES_INITIAL_STATE,
      ...{popUpOpen: false},
    });

    setDialogValues(DIALOG_VALUES_INITIAL_STATE);
    onCancelSuper();
  };
  return (
    <React.Fragment>
      <Dialog
        aria-labelledby="Dialog Goods"
        open={dialogValues.dialogOpen}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>
          {goodsType === GoodsType.MATERIAL ? TEXT_MATERIAL : TEXT_PRODUCTS}
        </DialogTitle>
        <DialogContent>
          <Typography>
            {goodsType == GoodsType.MATERIAL
              ? TEXT_EXPLANATION_DIALOG_GOODS_TYPE_MATERIAL
              : TEXT_EXPLANATION_DIALOG_GOODS_TYPE_PRODUCT}
          </Typography>
          <br />
          <ToggleButtonGroup
            value={dialogValues.planMode}
            color="primary"
            exclusive
            onChange={onTypeChange}
            style={{marginBottom: theme.spacing(2), width: "100%"}}
          >
            <ToggleButton
              value={GoodsPlanMode.TOTAL}
              aria-label={TEXT_TOTAL}
              style={{width: "100%"}}
            >
              {TEXT_TOTAL}
            </ToggleButton>
            <ToggleButton
              value={GoodsPlanMode.PER_PORTION}
              aria-label={TEXT_PER_PORTION}
              style={{width: "100%"}}
            >
              {TEXT_PER_PORTION}
            </ToggleButton>
          </ToggleButtonGroup>
          <Typography variant="body2" color="textSecondary">
            {dialogValues.planMode == GoodsPlanMode.TOTAL
              ? TEXT_EXPLANATION_DIALOG_GOODS_OPTION_TOTAL(
                  goodsType == GoodsType.MATERIAL
                    ? TEXT_MATERIAL
                    : TEXT_PRODUCTS,
                )
              : TEXT_EXPLANATION_DIALOG_GOODS_OPTION_PER_PORTION}
          </Typography>
          <br />
          <Grid container spacing={2}>
            <Grid size={12}>
              {goodsType === GoodsType.PRODUCT ? (
                <ProductAutocomplete
                  componentKey={""}
                  product={
                    dialogValues.product ? dialogValues.product : new Product()
                  }
                  products={products}
                  onChange={onChangeField}
                  label={TEXT_PRODUCT}
                />
              ) : (
                <MaterialAutocomplete
                  componentKey={""}
                  disabled={false}
                  material={
                    dialogValues.material
                      ? dialogValues.material
                      : ({} as Material)
                  }
                  materials={materials}
                  onChange={onChangeField}
                />
              )}
            </Grid>

            <Grid size={goodsType === GoodsType.PRODUCT ? 6 : 12}>
              <TextField
                key={"quantity"}
                id={"quantity"}
                value={
                  Number.isNaN(dialogValues.quantity) ||
                  dialogValues.quantity === 0
                    ? ""
                    : dialogValues.quantity
                }
                label={TEXT_QUANTITY}
                type="number"
                inputProps={{min: 0}}
                onChange={onChangeField}
                fullWidth
              />
            </Grid>
            {goodsType === GoodsType.PRODUCT && (
              <Grid size={6}>
                <UnitAutocomplete
                  componentKey={""}
                  unitKey={dialogValues.unit}
                  units={units}
                  onChange={onChangeField}
                />
              </Grid>
            )}
          </Grid>
        </DialogContent>
        <DialogActions>
          {/* schliessen */}
          <Button onClick={onCancel} color="primary" variant="outlined">
            {TEXT_CANCEL}
          </Button>
          <Button
            onClick={onOk}
            disabled={!dialogValues.material?.uid && !dialogValues.product?.uid}
            //   Object.keys(dialogValues.material).length == 0 &&
            //   Object.keys(dialogValues.product).length == 0
            // }
            color="primary"
            variant="contained"
          >
            {TEXT_OK}
          </Button>
        </DialogActions>
      </Dialog>
      {/* Dialog um neues Material anzulegen */}
      <DialogMaterial
        materialName={materialAddPopupValues.name}
        materialUid={materialAddPopupValues.uid}
        materialType={materialAddPopupValues.type}
        materialUsable={materialAddPopupValues.usable}
        materials={materials}
        dialogType={MaterialDialog.CREATE}
        dialogOpen={materialAddPopupValues.popUpOpen}
        handleOk={onMaterialCreate}
        handleClose={onCloseDialogMaterial}
        authUser={authUser}
        firebase={firebase}
      />
      <DialogProduct
        firebase={firebase}
        productName={productAddPopupValues.name}
        productUid={productAddPopupValues.uid}
        productDietProperties={productAddPopupValues.dietProperties}
        usable={productAddPopupValues.usable}
        dialogType={ProductDialog.CREATE}
        dialogOpen={productAddPopupValues.popUpOpen}
        handleOk={onProductCreate}
        handleClose={onCloseDialogProduct}
        handleChooseExisting={onProductChooseExisting}
        products={products}
        units={units}
        departments={departments}
        authUser={authUser}
      />
    </React.Fragment>
  );
};
export default MenuplanPage;
