import React from "react";
import {pdf} from "@react-pdf/renderer";
import fileSaver from "file-saver";

import {
  Stack,
  Button,
  Backdrop,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  List,
  ListItem,
  ListItemIcon,
  IconButton,
  Container,
  Checkbox,
  useTheme,
  Box,
  AlertColor,
} from "@mui/material";
import Grid from "@mui/material/Grid";

import {
  ALERT_TITLE_WAIT_A_MINUTE as TEXT_ALERT_TITLE_WAIT_A_MINUTE,
  WHICH_MENUES_FOR_MATERIAL_LIST_GENERATION as TEXT_WHICH_MENUES_FOR_MATERIAL_LIST_GENERATION,
  SUFFIX_PDF as TEXT_SUFFIX_PDF,
  NAME as TEXT_NAME,
  NEW_LIST as TEXT_NEW_LIST,
  GIVE_THE_NEW_LIST_A_NAME as TEXT_GIVE_THE_NEW_LIST_A_NAME,
  MATERIAL_LIST as TEXT_MATERIAL_LIST,
  MATERIAL_LIST_MENUE_SELECTION_DESCRIPTION as TEXT_MATERIAL_LIST_MENUE_SELECTION_DESCRIPTION,
  ADD_ITEM as TEXT_ADD_ITEM,
  QUANTITY as TEXT_QUANTITY,
  CANCEL as TEXT_CANCEL,
  ADD as TEXT_ADD,
  MATERIAL as TEXT_MATERIAL,
  PLEASE_GIVE_VALUE_FOR_FIELD as TEXT_PLEASE_GIVE_VALUE_FOR_FIELD,
  CHANGE as TEXT_CHANGE,
  LIST_ENTRY_MAYBE_OUT_OF_DATE as TEXT_LIST_ENTRY_MAYBE_OUT_OF_DATE,
  KEEP_MANUALLY_ADDED_PRODUCTS as TEXT_KEEP_MANUALLY_ADDED_PRODUCTS,
  MANUALLY_ADDED_PRODUCTS as TEXT_MANUALLY_ADDED_PRODUCTS,
  KEEP as TEXT_KEEP,
  DELETE as TEXT_DELETE,
  ERROR_NO_MATERIALS_FOUND as TEXT_ERROR_NO_MATERIALS_FOUND,
  FIELD_QUANTITY as TEXT_FIELD_QUANTITY,
} from "../../../constants/text";

import {MoreVert as MoreVertIcon} from "@mui/icons-material";

import useCustomStyles from "../../../constants/styles";

import Firebase from "../../Firebase/firebase.class";
import AuthUser from "../../Firebase/Authentication/authUser.class";
import Event from "../Event/event.class";
import EventGroupConfiguration from "../GroupConfiguration/groupConfiguration.class";
import {Snackbar} from "../../Shared/customSnackbar";
import AlertMessage from "../../Shared/AlertMessage";
import {
  DialogSelectMenues,
  DialogSelectMenuesForRecipeDialogValues,
  decodeSelectedMeals,
} from "../Menuplan/dialogSelectMenues";
import {
  MealRecipe,
  Menue,
  MenueCoordinates,
  MenuplanData,
} from "../Menuplan/menuplan.types";
import {getMealsOfMenues, getMenuesOfMeals, sortSelectedMenues} from "../Menuplan/menuplanService";
import {
  DialogType,
  SingleTextInputResult,
  useCustomDialog,
} from "../../Shared/customDialogContext";
import Utils from "../../Shared/utils.class";
import {
  NavigationValuesContext,
  NavigationObject,
} from "../../Navigation/navigationContext";
import Action from "../../../constants/actions";
import {
  FetchMissingDataProps,
  FetchMissingDataType,
  MasterDataCreateType,
  OnMasterdataCreateProps,
} from "../Event/event";
import MaterialList, {
  MaterialListEntry,
  MaterialListMaterial,
} from "./materialList.class";
import Material, {MaterialType} from "../../Material/material.class";
import {
  DialogTraceItem,
  EventListCard,
  OperationType,
  PositionContextMenu,
} from "../Event/eventSharedComponents";
import DialogMaterial, {
  MATERIAL_POP_UP_VALUES_INITIAL_STATE,
  MaterialDialog,
} from "../../Material/dialogMaterial";
import MaterialAutocomplete from "../../Material/materialAutocomplete";
import {
  RECIPE_DRAWER_DATA_INITIAL_VALUES,
  RecipeDrawer,
  RecipeDrawerData,
} from "../../Recipe/RecipeDrawer";
import Recipe, {Recipes} from "../../Recipe/recipe.class";
import RecipeShort from "../../Recipe/recipeShort.class";
import MaterialListPdf from "./materialListPdf";
import FirebaseAnalyticEvent from "../../../constants/firebaseEvent";
import {logEvent} from "firebase/analytics";
import {TextFieldSize} from "../../../constants/defaultValues";
import {ItemType} from "../ShoppingList/shoppingList.class";
import {useEventMasterData} from "../Event/eventMasterDataContext";

/* ===================================================================
// ============================ Dispatcher ===========================
// =================================================================== */
enum ReducerActions {
  SHOW_LOADING,
  SET_SELECTED_LIST_ITEM,
  GENERIC_ERROR,
  SNACKBAR_SHOW,
  SNACKBAR_CLOSE,
}
type State = {
  selectedListItem: string | null;
  isError: boolean;
  isLoading: boolean;
  error: Error | null;
  snackbar: Snackbar;
};
type DispatchAction =
  | {type: ReducerActions.SHOW_LOADING; payload: {isLoading: boolean}}
  | {type: ReducerActions.SET_SELECTED_LIST_ITEM; payload: {uid: string}}
  | {type: ReducerActions.GENERIC_ERROR; payload: Error}
  | {
      type: ReducerActions.SNACKBAR_SHOW;
      payload: {severity: AlertColor; message: string};
    }
  | {type: ReducerActions.SNACKBAR_CLOSE};

const initialState: State = {
  selectedListItem: null,
  isError: false,
  isLoading: false,
  error: null,
  snackbar: {open: false, severity: "success", message: ""},
};
interface ContextMenuSeletedItemsProps {
  anchor: HTMLElement | null;
  materialUid: Material["uid"];
}

const CONTEXT_MENU_SELECTE_ITEM_INITIAL_STATE: ContextMenuSeletedItemsProps = {
  anchor: null,
  materialUid: "",
};
const ADD_MATERIAL_DIALOG_INITIAL_VALUES = {
  open: false,
  material: {} as Material,
  quantity: "",
};
const TRACE_ITEM_DIALOG_INITIAL_VALUES = {
  open: false,
  sortedMenues: [] as MenueCoordinates[],
};

const materialListReducer = (state: State, action: DispatchAction): State => {
  switch (action.type) {
    case ReducerActions.SHOW_LOADING:
      return {
        ...state,
        error: null,
        isLoading: action.payload.isLoading,
      };
    case ReducerActions.SET_SELECTED_LIST_ITEM:
      return {
        ...state,
        selectedListItem: action.payload.uid,
      };
    case ReducerActions.GENERIC_ERROR:
      return {
        ...state,
        isError: true,
        isLoading: false,
        error: action.payload as Error,
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
    default: {
      const _exhaustiveCheck: never = action;
      throw new Error(`Unknown action: ${_exhaustiveCheck}`);
    }
  }
};

const DIALOG_SELECT_MENUE_DATA_INITIAL_DATA = {
  open: false,
  menues: {} as DialogSelectMenuesForRecipeDialogValues,
  selectedListUid: "",
  operationType: OperationType.none,
};

const CENTER_BOX_SX = {justifyContent: "center", display: "flex"};

/* ===================================================================
// ========================= Inline Change Types =====================
// =================================================================== */
export type MaterialItemChange =
  | {
      source: "textfield";
      event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>;
      value: string;
    }
  | {
      source: "autocompleteMaterial";
      event: React.ChangeEvent<HTMLInputElement>;
      value: string | Material | null;
    };

const createEmptyMaterialListItem = (): MaterialListMaterial => ({
  checked: false,
  name: "",
  uid: Utils.generateUid(10),
  type: MaterialType.usage,
  quantity: 0,
  trace: [],
  manualAdd: true,
});

/* ===================================================================
// =============================== Base ==============================
// =================================================================== */
interface EventMaterialListPageProps {
  firebase: Firebase;
  authUser: AuthUser;
  materialList: MaterialList;
  event: Event;
  groupConfiguration: EventGroupConfiguration;
  menuplan: MenuplanData;
  materials: Material[];
  recipes: Recipes;
  fetchMissingData: ({type, recipeShort}: FetchMissingDataProps) => void;
  onMaterialListUpdate: (materialList: MaterialList) => void;
  onMasterdataCreate: ({type, value}: OnMasterdataCreateProps) => void;
}
const EventMaterialListPage = ({
  firebase,
  authUser,
  materialList,
  event,
  groupConfiguration,
  menuplan,
  materials,
  recipes,
  fetchMissingData,
  onMaterialListUpdate,
  onMasterdataCreate,
}: EventMaterialListPageProps) => {
  const classes = useCustomStyles();
  const {unitConversionBasic, unitConversionProducts} = useEventMasterData();

  const navigationValuesContext = React.useContext(NavigationValuesContext);
  const {customDialog} = useCustomDialog();

  const [state, dispatch] = React.useReducer(materialListReducer, initialState);
  const [dialogSelectMenueData, setDialogSelectMenueData] = React.useState(
    DIALOG_SELECT_MENUE_DATA_INITIAL_DATA,
  );
  const [contextMenuSelectedItem, setContextMenuSelectedItem] = React.useState(
    CONTEXT_MENU_SELECTE_ITEM_INITIAL_STATE,
  );
  const [handleMaterialDialogValues, setHandleMaterialDialogValues] =
    React.useState(ADD_MATERIAL_DIALOG_INITIAL_VALUES);
  const [traceItemDialogValues, setTraceItemDialogValues] = React.useState(
    TRACE_ITEM_DIALOG_INITIAL_VALUES,
  );
  const [recipeDrawerData, setRecipeDrawerData] =
    React.useState<RecipeDrawerData>(RECIPE_DRAWER_DATA_INITIAL_VALUES);
  /* ------------------------------------------
  // Initialisierung
  // ------------------------------------------ */
  React.useEffect(() => {
    if (!recipeDrawerData.isLoadingData) {
      return;
    }
    if (
      !Object.prototype.hasOwnProperty.call(
        recipes,
        recipeDrawerData.recipe.uid,
      )
    ) {
      return;
    }

    if (!recipeDrawerData.recipe.name) {
      setRecipeDrawerData((prev) => ({
        ...prev,
        isLoadingData: recipes[prev.recipe.uid].portions > 0 ? false : true,
        open: true,
        recipe: recipes[prev.recipe.uid],
      }));
    } else if (
      recipeDrawerData.recipe?.portions == 0 &&
      recipes[recipeDrawerData.recipe.uid]?.portions > 0
    ) {
      setRecipeDrawerData((prev) => ({
        ...prev,
        isLoadingData: false,
        open: true,
        recipe: recipes[prev.recipe.uid],
      }));
    }
  }, [
    recipeDrawerData.isLoadingData,
    recipeDrawerData.recipe.uid,
    recipeDrawerData.recipe.name,
    recipeDrawerData.recipe.portions,
    recipes,
  ]);

  /* ------------------------------------------
  // Navigation-Handler
  // ------------------------------------------ */
  React.useEffect(() => {
    navigationValuesContext?.setNavigationValues({
      action: Action.NONE,
      object: NavigationObject.materialList,
    });
  }, []);

  React.useEffect(() => {
    if (materials.length == 0) {
      fetchMissingData({type: FetchMissingDataType.MATERIALS});
    }
  }, []);

  /* ------------------------------------------
  // Dialog-Handling
  // ------------------------------------------ */
  const onCreateList = React.useCallback(() => {
    setDialogSelectMenueData((prev) => ({
      ...prev,
      open: true,
      operationType: OperationType.Create,
    }));
  }, []);

  const onCloseDialogSelectMenues = React.useCallback(() => {
    setDialogSelectMenueData(DIALOG_SELECT_MENUE_DATA_INITIAL_DATA);
  }, []);

  const onConfirmDialogSelectMenues = async (
    selectedMenues: DialogSelectMenuesForRecipeDialogValues,
  ) => {
    setDialogSelectMenueData({...dialogSelectMenueData, open: false});

    const userInput = (await customDialog({
      dialogType: DialogType.SingleTextInput,
      title: TEXT_NEW_LIST,
      text: TEXT_GIVE_THE_NEW_LIST_A_NAME,
      singleTextInputProperties: {
        initialValue:
          dialogSelectMenueData.operationType === OperationType.Update
            ? materialList.lists[dialogSelectMenueData.selectedListUid]
                .properties.name
            : "",
        textInputLabel: TEXT_NAME,
      },
    })) as SingleTextInputResult;

    if (userInput.valid) {
      dispatch({
        type: ReducerActions.SHOW_LOADING,
        payload: {isLoading: true},
      });

      if (dialogSelectMenueData.operationType === OperationType.Create) {
        MaterialList.createNewList({
          name: userInput.input,
          selectedMenues: Object.keys(selectedMenues),
          menueplan: menuplan,
          materials: materials,
          firebase: firebase,
          authUser: authUser,
        })
          .then(async (result) => {
            const updatedMaterialList = {...materialList};
            updatedMaterialList.lists[result.properties.uid] = result;
            updatedMaterialList.noOfLists++;
            updatedMaterialList.uid = event.uid;

            onMaterialListUpdate(updatedMaterialList);
            dispatch({
              type: ReducerActions.SHOW_LOADING,
              payload: {isLoading: false},
            });
          })
          .catch((error) => {
            dispatch({
              type: ReducerActions.GENERIC_ERROR,
              payload: error,
            });
          });
      } else if (dialogSelectMenueData.operationType === OperationType.Update) {
        onRefreshLists(userInput.input, Object.keys(selectedMenues));
      }
    } else {
      setDialogSelectMenueData({
        ...dialogSelectMenueData,
        menues: selectedMenues,
        open: true,
      });
    }
  };
  /* ------------------------------------------
  // Kontext-Menü-Handler
  // ------------------------------------------ */
  const onOpenContextMenu = React.useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      const pressedButton = event.currentTarget.id.split("_");

      setContextMenuSelectedItem({
        anchor: event.currentTarget,
        materialUid: pressedButton[1],
      });
    },
    [],
  );

  const onCloseContextMenu = React.useCallback(() => {
    setContextMenuSelectedItem(CONTEXT_MENU_SELECTE_ITEM_INITIAL_STATE);
  }, []);

  const onContextMenuClick = React.useCallback(
    (event: React.MouseEvent<HTMLElement>) => {
      const action = event.currentTarget.dataset.action;
      let material: Material | undefined;
      let quantity: number | undefined;
      switch (action) {
        case Action.EDIT:
          material = materials.find(
            (material) => material.uid == contextMenuSelectedItem.materialUid,
          );

          if (!material) {
            // Freitext-Eintrag: Material aus der Liste rekonstruieren
            const listItem = materialList?.lists[
              state.selectedListItem!
            ].items.find(
              (item) => item.uid == contextMenuSelectedItem.materialUid,
            );
            if (!listItem) {
              return;
            }
            material = {
              uid: listItem.uid,
              name: listItem.name,
              type: listItem.type,
              usable: true,
            } as Material;
          }

          quantity = materialList?.lists[state.selectedListItem!].items.find(
            (material) => material.uid == contextMenuSelectedItem.materialUid,
          )?.quantity;
          setHandleMaterialDialogValues({
            open: true,
            material: material,
            quantity: quantity ? quantity.toString() : "",
          });
          break;
        case Action.DELETE:
          materialList.lists[state.selectedListItem!].items =
            MaterialList.deleteMaterialFromList({
              list: materialList.lists[state.selectedListItem!].items,
              materialUid: contextMenuSelectedItem.materialUid,
            });
          logEvent(
            firebase.analytics,
            FirebaseAnalyticEvent.materialListDeleted,
          );
          onMaterialListUpdate(materialList);
          break;
        case Action.TRACE:
          setTraceItemDialogValues({
            open: true,
            sortedMenues: sortSelectedMenues({
              menueList:
                materialList.lists[state.selectedListItem!].properties
                  .selectedMenues,
              menuplan: menuplan,
            }),
          });
          setContextMenuSelectedItem({
            ...contextMenuSelectedItem,
            anchor: null,
          });
          return;
      }
      setContextMenuSelectedItem(CONTEXT_MENU_SELECTE_ITEM_INITIAL_STATE);
    },
    [
      materials,
      materialList,
      state.selectedListItem,
      contextMenuSelectedItem,
      menuplan,
      firebase,
      onMaterialListUpdate,
    ],
  );
  /* ------------------------------------------
  // List-Einträge-Handling
  // ------------------------------------------ */
  const onCheckboxClick = React.useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const pressedCheckbox = event.target.name.split("_");
      const material = materialList.lists[state.selectedListItem!].items.find(
        (material) => material.uid == pressedCheckbox[1],
      );
      if (!material) {
        return;
      }
      material.checked = !material.checked;
      onMaterialListUpdate(materialList);
    },
    [materialList, state.selectedListItem, onMaterialListUpdate],
  );

  /* ------------------------------------------
  // Inline-Change-Handler
  // ------------------------------------------ */
  const onChangeItem = React.useCallback(
    (change: MaterialItemChange) => {
      const field = change.event.target.id.split("_");
      // field[0] = "quantity" oder "material", field[1] = materialUid
      const materialUid = field[1];
      const items = materialList.lists[state.selectedListItem!].items;

      let item = items.find((item) => item.uid == materialUid);
      let isNewItem = false;

      if (!item) {
        item = createEmptyMaterialListItem();
        item.uid = materialUid;
        isNewItem = true;
      }

      switch (change.source) {
        case "textfield": {
          item.quantity = parseFloat(change.value);
          if (isNewItem) {
            items.push(item);
          } else {
            item.manualEdit = true;
          }
          break;
        }
        case "autocompleteMaterial": {
          if (!change.value) {
            item.name = "";
            break;
          }

          if (typeof change.value === "string") {
            // Freitext-Eintrag
            if (item.uid.length == 20) {
              item.uid = Utils.generateUid(10);
            }
            item.name = change.value.trim();
            item.type = MaterialType.usage;
          } else if (change.value.name.endsWith(TEXT_ADD)) {
            // "Hinzufügen" Eintrag – ignorieren, wird über MaterialAutocomplete
            // als neues Material angelegt
            return;
          } else {
            // Bestehendes Material ausgewählt
            item.name = change.value.name;
            item.uid = change.value.uid;
            item.type = change.value.type;
          }

          if (isNewItem) {
            item.manualAdd = true;
            item.trace = [
              {
                menueUid: "",
                recipe: {uid: "", name: ""},
                planedPortions: 0,
                quantity: item.quantity,
                unit: "",
                manualAdd: true,
                itemType: ItemType.material,
              },
            ];
            items.push(item);
          } else {
            item.manualEdit = true;
          }
          break;
        }
      }

      onMaterialListUpdate(materialList);
    },
    [materialList, state.selectedListItem, onMaterialListUpdate],
  );

  /* ------------------------------------------
  // List-Handling
  // ------------------------------------------ */
  const onRefreshLists = async (
    newName?: string,
    selectedMenues?: Menue["uid"][],
  ) => {
    let keepManuallyAddedItems = false;

    if (
      materialList.lists[state.selectedListItem!].items.some((material) =>
        material.trace.some((trace) => trace.manualAdd == true),
      )
    ) {
      const userInput = (await customDialog({
        dialogType: DialogType.selectOptions,
        title: TEXT_MANUALLY_ADDED_PRODUCTS,
        text: TEXT_KEEP_MANUALLY_ADDED_PRODUCTS(TEXT_MATERIAL_LIST),
        options: [
          {key: Action.DELETE, text: TEXT_DELETE},
          {key: Action.KEEP, text: TEXT_KEEP},
        ],
      })) as SingleTextInputResult;

      if (!userInput.valid) {
        return;
      }
      keepManuallyAddedItems = userInput.input == Action.KEEP ? true : false;
    }
    dispatch({type: ReducerActions.SHOW_LOADING, payload: {isLoading: true}});

    const materialListToReferesh = {...materialList};

    if (dialogSelectMenueData.operationType === OperationType.Update) {
      materialListToReferesh.lists[
        dialogSelectMenueData.selectedListUid
      ].properties.name = newName!;

      materialListToReferesh.lists[
        dialogSelectMenueData.selectedListUid
      ].properties.selectedMenues = Object.keys(selectedMenues!);

      materialListToReferesh.lists[
        dialogSelectMenueData.selectedListUid
      ].properties.selectedMeals = getMealsOfMenues({
        menuplan: menuplan,
        menues: selectedMenues!,
      });

      setDialogSelectMenueData(DIALOG_SELECT_MENUE_DATA_INITIAL_DATA);
    }

    MaterialList.refreshList({
      listUidToRefresh: state.selectedListItem!,
      keepManuallyAddedItems: keepManuallyAddedItems,
      materialList: materialListToReferesh,
      materials: materials,
      menueplan: menuplan,
      firebase: firebase,
      authUser: authUser,
    })
      .then((result) => {
        onMaterialListUpdate(result);

        dispatch({
          type: ReducerActions.SHOW_LOADING,
          payload: {isLoading: false},
        });
      })
      .catch((error) => {
        console.error(error);
        dispatch({type: ReducerActions.GENERIC_ERROR, payload: error});
      });
  };
  const onListElementSelect = React.useCallback(
    async (event: React.MouseEvent<HTMLElement, MouseEvent>) => {
      const selectedListItem = event.currentTarget.dataset.uid;
      if (!selectedListItem || state.selectedListItem == selectedListItem) {
        return;
      }

      dispatch({
        type: ReducerActions.SET_SELECTED_LIST_ITEM,
        payload: {
          uid: selectedListItem,
        },
      });
    },
    [state.selectedListItem],
  );

  const onListElementDelete = React.useCallback(
    (event: React.MouseEvent<HTMLElement>) => {
      const selectedList = event.currentTarget.dataset.uid;
      if (!selectedList) {
        return;
      }

      const updatedMaterialList = MaterialList.deleteList({
        materialList: materialList,
        listUidToDelete: selectedList,
        authUser: authUser,
      });
      onMaterialListUpdate(updatedMaterialList);

      dispatch({
        type: ReducerActions.SET_SELECTED_LIST_ITEM,
        payload: {
          uid: "",
        },
      });
    },
    [materialList, authUser, onMaterialListUpdate],
  );

  const onListElementEdit = React.useCallback(
    async (event: React.MouseEvent<HTMLElement>) => {
      const selectedListUid = event.currentTarget.dataset.uid;
      if (!selectedListUid) {
        return;
      }
      const selectedMenuesForDialog: DialogSelectMenuesForRecipeDialogValues =
        {};

      let selectedMenues =
        materialList.lists[selectedListUid].properties.selectedMenues;

      if (
        !Utils.areStringArraysEqual(
          materialList.lists[selectedListUid].properties.selectedMeals,
          getMealsOfMenues({
            menuplan: menuplan,
            menues:
              materialList.lists[selectedListUid].properties.selectedMenues,
          }),
        ) ||
        materialList.lists[selectedListUid].properties.selectedMenues.length !==
          getMenuesOfMeals({
            menuplan: menuplan,
            meals: materialList.lists[selectedListUid].properties.selectedMeals,
          }).length
      ) {
        selectedMenues = getMenuesOfMeals({
          menuplan: menuplan,
          meals: materialList.lists[selectedListUid].properties.selectedMeals,
        });
      }

      selectedMenues.forEach(
        (menueUid) => (selectedMenuesForDialog[menueUid] = true),
      );

      setDialogSelectMenueData({
        menues: selectedMenuesForDialog,
        open: true,
        selectedListUid: selectedListUid,
        operationType: OperationType.Update,
      });
    },
    [materialList, menuplan],
  );
  /* ------------------------------------------
  // Artikel-Dialog (nur für Kontext-Menü EDIT)
  // ------------------------------------------ */
  const onAddMaterialDialogClose = React.useCallback(() => {
    setHandleMaterialDialogValues(ADD_MATERIAL_DIALOG_INITIAL_VALUES);
  }, []);

  const onAddMaterialDialogAdd = React.useCallback(
    ({material, quantity}: OnDialogAddItemOk) => {
      if (!handleMaterialDialogValues.material.uid) {
        materialList.lists[state.selectedListItem!].items =
          MaterialList.addMaterialToList({
            material: material,
            list: materialList.lists[state.selectedListItem!].items,
            quantity: quantity,
            planedPortions: 0,
            manuelAdd: true,
          });
      } else {
        const materialInList = materialList.lists[
          state.selectedListItem!
        ].items.find((materialInList) => materialInList.uid == material.uid);

        if (!materialInList) {
          return;
        }

        materialInList.quantity = quantity;
        materialInList.manualEdit = true;
      }
      onMaterialListUpdate(materialList);
      setHandleMaterialDialogValues(ADD_MATERIAL_DIALOG_INITIAL_VALUES);
    },
    [
      handleMaterialDialogValues.material.uid,
      materialList,
      state.selectedListItem,
      onMaterialListUpdate,
    ],
  );

  const onMaterialCreate = React.useCallback(
    (material: Material) => {
      onMasterdataCreate({
        type: MasterDataCreateType.MATERIAL,
        value: material,
      });
    },
    [onMasterdataCreate],
  );
  /* ------------------------------------------
  // Artikel Trace Dialog
  // ------------------------------------------ */
  const onDialogTraceItemClose = React.useCallback(() => {
    setTraceItemDialogValues((prev) => ({...prev, open: false}));
  }, []);
  /* ------------------------------------------
  // Recipe-Drawer-Handler
  // ------------------------------------------ */
  const onOpenRecipeDrawer = (
    menueUid: Menue["uid"],
    recipeUid: Recipe["uid"],
  ) => {
    let mealRecipe = {} as MealRecipe;
    let recipe = new Recipe();
    recipe.uid = recipeUid;

    let loadingData = false;
    let openDrawer = false;

    menuplan.menues[menueUid].mealRecipeOrder.forEach((mealRecipeUid) => {
      if (menuplan.mealRecipes[mealRecipeUid].recipe.recipeUid == recipeUid) {
        mealRecipe = menuplan.mealRecipes[mealRecipeUid];
      }
    });

    if (!mealRecipe) {
      return;
    }

    if (Object.prototype.hasOwnProperty.call(recipes, recipeUid)) {
      recipe = recipes[recipeUid] as Recipe;
      openDrawer = true;
    } else {
      recipe.name = mealRecipe.recipe.name;

      fetchMissingData({
        type: FetchMissingDataType.RECIPE,
        recipeShort: {
          uid: mealRecipe.recipe.recipeUid,
          name: mealRecipe.recipe.name,
          type: mealRecipe.recipe.type,
          created: {
            fromUid: mealRecipe.recipe.createdFromUid,
          },
        } as RecipeShort,
      });
      loadingData = true;
    }
    setRecipeDrawerData({
      ...recipeDrawerData,
      open: openDrawer,
      isLoadingData: loadingData,
      recipe: recipe,
      scaledPortions: mealRecipe.totalPortions,
    });
  };
  const onRecipeDrawerClose = React.useCallback(() => {
    setRecipeDrawerData((prev) => ({...prev, open: false}));
  }, []);
  /* ------------------------------------------
  // PDF erzeugen
  // ------------------------------------------ */
  const onGeneratePrintVersion = React.useCallback(() => {
    if (materialList.lists[state.selectedListItem!].items.length === 0) {
      dispatch({
        type: ReducerActions.GENERIC_ERROR,
        payload: new Error(TEXT_ERROR_NO_MATERIALS_FOUND),
      });
      return;
    }

    pdf(
      <MaterialListPdf
        materialList={materialList.lists[state.selectedListItem!]}
        materialListSelectedTimeSlice={decodeSelectedMeals({
          selectedMeals:
            materialList.lists[state.selectedListItem!].properties
              .selectedMenues,
          menuplan: menuplan,
        })}
        eventName={event.name}
        authUser={authUser}
      />,
    )
      .toBlob()
      .then((result) => {
        fileSaver.saveAs(
          result,
          event.name + " " + TEXT_MATERIAL_LIST + TEXT_SUFFIX_PDF,
        );
      });
  }, [materialList, state.selectedListItem, menuplan, event.name, authUser]);

  return (
    <Stack spacing={2}>
      {state.isError && (
        <AlertMessage
          error={state.error!}
          messageTitle={TEXT_ALERT_TITLE_WAIT_A_MINUTE}
        />
      )}
      <Backdrop sx={classes.backdrop} open={state.isLoading}>
        <CircularProgress color="inherit" />
      </Backdrop>
      <EventListCard
        cardTitle={TEXT_MATERIAL_LIST}
        cardDescription={TEXT_MATERIAL_LIST_MENUE_SELECTION_DESCRIPTION}
        outOfDateWarnMessage={TEXT_LIST_ENTRY_MAYBE_OUT_OF_DATE(
          TEXT_MATERIAL_LIST,
        )}
        selectedListItem={state.selectedListItem}
        lists={materialList.lists}
        noOfLists={materialList.noOfLists}
        menuplan={menuplan}
        onCreateList={onCreateList}
        onListElementSelect={onListElementSelect}
        onListElementDelete={onListElementDelete}
        onListElementEdit={onListElementEdit}
        onRefreshLists={onRefreshLists}
        onGeneratePrintVersion={onGeneratePrintVersion}
      />
      {state.selectedListItem && materialList && (
        <Box component="div" sx={CENTER_BOX_SX}>
          <EventMaterialListList
            materialList={materialList.lists[state.selectedListItem]}
            materials={materials}
            onCheckboxClick={onCheckboxClick}
            onOpenContexMenü={onOpenContextMenu}
            onChangeItem={onChangeItem}
          />
        </Box>
      )}
      <DialogSelectMenues
        open={dialogSelectMenueData.open}
        title={TEXT_WHICH_MENUES_FOR_MATERIAL_LIST_GENERATION}
        dates={menuplan.dates}
        preSelectedMenue={dialogSelectMenueData.menues}
        mealTypes={menuplan.mealTypes}
        meals={menuplan.meals}
        menues={menuplan.menues}
        showSelectAll={true}
        onClose={onCloseDialogSelectMenues}
        onConfirm={onConfirmDialogSelectMenues}
      />
      <PositionContextMenu
        itemType={TEXT_MATERIAL}
        anchorEl={contextMenuSelectedItem.anchor}
        handleMenuClick={onContextMenuClick}
        handleMenuClose={onCloseContextMenu}
      />
      <DialogHandleMaterial
        dialogOpen={handleMaterialDialogValues.open}
        material={handleMaterialDialogValues.material}
        quantity={handleMaterialDialogValues.quantity}
        materials={materials}
        editMode={handleMaterialDialogValues.material.uid ? true : false}
        handleOk={onAddMaterialDialogAdd}
        handleClose={onAddMaterialDialogClose}
        onMaterialCreate={onMaterialCreate}
        authUser={authUser}
        firebase={firebase}
      />
      {state.selectedListItem && contextMenuSelectedItem.materialUid && (
        <DialogTraceItem
          itemType={TEXT_MATERIAL}
          dialogOpen={traceItemDialogValues.open}
          trace={
            materialList.lists[state.selectedListItem!]!.items.find(
              (material) => material.uid == contextMenuSelectedItem.materialUid,
            )!.trace!
          }
          sortedMenues={traceItemDialogValues.sortedMenues}
          hasBeenManualyEdited={Boolean(
            materialList.lists[state.selectedListItem!]?.items.find(
              (material) => material.uid == contextMenuSelectedItem.materialUid,
            )?.manualEdit,
          )}
          handleClose={onDialogTraceItemClose}
          onShowRecipe={onOpenRecipeDrawer}
        />
      )}
      {recipeDrawerData.open && (
        <RecipeDrawer
          drawerSettings={recipeDrawerData}
          recipe={recipeDrawerData.recipe}
          mealPlan={recipeDrawerData.mealPlan}
          groupConfiguration={{} as EventGroupConfiguration}
          scaledPortions={recipeDrawerData.scaledPortions}
          editMode={false}
          disableFunctionality={true}
          firebase={firebase}
          authUser={authUser}
          onClose={onRecipeDrawerClose}
        />
      )}
    </Stack>
  );
};

/* ===================================================================
// ==================== Quantity Field with local state ==============
// =================================================================== */
interface QuantityFieldProps {
  materialUid: string;
  quantity: number;
  onChangeItem: (change: MaterialItemChange) => void;
}
const QuantityField = React.memo(
  ({materialUid, quantity, onChangeItem}: QuantityFieldProps) => {
    const displayValue =
      Number.isNaN(quantity) || quantity === 0 ? "" : String(quantity);
    const [localValue, setLocalValue] = React.useState(displayValue);

    React.useEffect(() => {
      setLocalValue(displayValue);
    }, [displayValue]);

    const handleBlur = React.useCallback(
      (event: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        if (localValue !== displayValue) {
          onChangeItem({
            source: "textfield",
            event: event,
            value: localValue,
          });
        }
      },
      [localValue, displayValue, onChangeItem],
    );

    return (
      <TextField
        id={"quantity_" + materialUid}
        value={localValue}
        label={TEXT_FIELD_QUANTITY}
        type="number"
        inputProps={{min: 0, inputMode: "decimal"}}
        onChange={(event) => setLocalValue(event.target.value)}
        onBlur={handleBlur}
        fullWidth
        size="small"
      />
    );
  },
);
QuantityField.displayName = "QuantityField";

/* ===================================================================
// ======================= Liste der Materialien =====================
// =================================================================== */
interface EventMaterialListListProps {
  materialList: MaterialListEntry;
  materials: Material[];
  onCheckboxClick: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onOpenContexMenü: (event: React.MouseEvent<HTMLButtonElement>) => void;
  onChangeItem: (change: MaterialItemChange) => void;
}
const EventMaterialListList = React.memo(
  ({
    materialList,
    materials,
    onCheckboxClick,
    onOpenContexMenü,
    onChangeItem,
  }: EventMaterialListListProps) => {
    const classes = useCustomStyles();
    const shouldFocusNewRowRef = React.useRef(false);

    const prepareItemsForDisplay = React.useCallback(
      (items: MaterialListMaterial[]) => {
        // Nach Name sortieren, Einträge ohne Name ans Ende
        const sortedList = [...items].sort((a, b) => {
          if (!a.name && !b.name) return 0;
          if (!a.name) return 1;
          if (!b.name) return -1;
          return a.name.localeCompare(b.name);
        });

        // Leere Vorlage-Zeile zum Hinzufügen am Ende
        const templateRow = createEmptyMaterialListItem();

        if (
          sortedList.length === 0 ||
          sortedList[sortedList.length - 1].name !== ""
        ) {
          sortedList.push(templateRow);
        }

        return {
          items: sortedList,
          templateRowUid: templateRow.uid,
        };
      },
      [],
    );

    const displayData = React.useMemo(
      () => prepareItemsForDisplay(materialList.items),
      [materialList.items, prepareItemsForDisplay],
    );

    React.useEffect(() => {
      if (shouldFocusNewRowRef.current) {
        shouldFocusNewRowRef.current = false;
        const el = document.getElementById(
          "quantity_" + displayData.templateRowUid,
        );
        if (el) {
          el.focus();
        }
      }
    }, [displayData.templateRowUid]);

    const containerSx = React.useMemo(
      () => ({...classes.container, width: "100%"}),
      [classes.container],
    );

    return (
      <Container
        component="main"
        maxWidth="sm"
        key={"MaterialListContainer"}
        sx={containerSx}
      >
        <Stack spacing={2}>
          <List sx={[classes.eventList]} key={"materialList"}>
            {displayData.items.map((material) => {
              return (
                <ListItem
                  key={"materialListItem_" + material.uid}
                  sx={classes.eventListItem}
                >
                  <ListItemIcon>
                    <Checkbox
                      key={"checkbox_" + material.uid}
                      name={"checkbox_" + material.uid}
                      onChange={onCheckboxClick}
                      checked={material.checked}
                      disableRipple
                    />
                  </ListItemIcon>
                  <Grid
                    container
                    spacing={2}
                    alignItems="center"
                    sx={{flex: 1, minWidth: 0}}
                  >
                    <Grid size={{ xs: 4, sm: 3 }} key={"quantity_grid_" + material.uid}>
                      <QuantityField
                        materialUid={material.uid}
                        quantity={material.quantity}
                        onChangeItem={onChangeItem}
                      />
                    </Grid>
                    <Grid size={{ xs: 8, sm: 9 }} key={"material_grid_" + material.uid}>
                      <MaterialAutocomplete
                        componentKey={material.uid}
                        material={
                          material.name
                            ? ({
                                uid: material.uid,
                                name: material.name,
                                type: material.type,
                                usable: true,
                              } as Material)
                            : null
                        }
                        materials={materials}
                        disabled={false}
                        allowCreateNewMaterial={false}
                        size={TextFieldSize.small}
                        onChange={(_event, newValue, _reason, objectId) => {
                          if (
                            material.uid === displayData.templateRowUid &&
                            newValue
                          ) {
                            shouldFocusNewRowRef.current = true;
                          }
                          onChangeItem({
                            source: "autocompleteMaterial",
                            event: {
                              target: {id: objectId},
                            } as React.ChangeEvent<HTMLInputElement>,
                            value: newValue,
                          });
                        }}
                      />
                    </Grid>
                  </Grid>
                  <IconButton
                    key={"MoreBtn_" + material.uid}
                    id={"MoreBtn_" + material.uid}
                    aria-label="settings"
                    onClick={onOpenContexMenü}
                    size="large"
                    sx={{flexShrink: 0}}
                  >
                    <MoreVertIcon />
                  </IconButton>
                </ListItem>
              );
            })}
          </List>
        </Stack>
      </Container>
    );
  },
);
EventMaterialListList.displayName = "EventMaterialListList";
/* ===================================================================
// ==================== Dialog Material hinzufügen ===================
// =================================================================== */
interface DialogHandleMaterialProps {
  dialogOpen: boolean;
  material: Material | null;
  quantity: string;
  materials: Material[];
  editMode: boolean;
  authUser: AuthUser;
  firebase: Firebase;
  handleOk: ({material, quantity}: OnDialogAddItemOk) => void;
  handleClose: () => void;
  onMaterialCreate: (material: Material) => void;
}
interface OnDialogAddItemOk {
  material: Material;
  quantity: number;
}
const DIALOG_VALUES_INITIAL_STATE = {
  quantity: "",
  material: {} as Material | null,
};
const DIALOG_VALUES_VALIDATION_INITIAL_STATE = {
  isError: false,
  errorText: "",
};
const DialogHandleMaterial = ({
  dialogOpen,
  material,
  quantity,
  materials,
  editMode,
  authUser,
  firebase,
  handleOk: handleOkSuper,
  handleClose: handleCloseSuper,
  onMaterialCreate: onMaterialCreateSuper,
}: DialogHandleMaterialProps) => {
  const theme = useTheme();

  const [dialogValues, setDialogValues] = React.useState(
    DIALOG_VALUES_INITIAL_STATE,
  );
  const [dialogValidation, setDialogValidation] = React.useState(
    DIALOG_VALUES_VALIDATION_INITIAL_STATE,
  );
  const [materialAddPopupValues, setMaterialAddPopupValues] = React.useState({
    ...MATERIAL_POP_UP_VALUES_INITIAL_STATE,
    ...{popUpOpen: false},
  });

  React.useEffect(() => {
    if (material?.uid) {
      setDialogValues({
        quantity: quantity,
        material: material,
      });
    } else {
      setDialogValues(DIALOG_VALUES_INITIAL_STATE);
    }
  }, [material, quantity]);

  /* ------------------------------------------
  // Button-Handler Dialog
  // ------------------------------------------ */
  const handleClose = () => {
    setDialogValues(DIALOG_VALUES_INITIAL_STATE);
    setDialogValidation(DIALOG_VALUES_VALIDATION_INITIAL_STATE);
    handleCloseSuper();
  };
  const handleOk = () => {
    if (!dialogValues.material || !dialogValues.material.uid) {
      setDialogValidation({
        isError: true,
        errorText: TEXT_PLEASE_GIVE_VALUE_FOR_FIELD(TEXT_MATERIAL),
      });
      return;
    }
    handleOkSuper({
      material: dialogValues.material,
      quantity: parseFloat(dialogValues.quantity),
    });
    setDialogValues(DIALOG_VALUES_INITIAL_STATE);
    setDialogValidation(DIALOG_VALUES_VALIDATION_INITIAL_STATE);
  };
  /* ------------------------------------------
  // Change-Handler Dialog
  // ------------------------------------------ */
  const onQuantityChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setDialogValues({
      ...dialogValues,
      quantity: event.target.value,
    });
  };
  const onChangeMaterial = async (
    _event: React.ChangeEvent<HTMLInputElement>,
    newValue: string | Material | null,
  ) => {
    if (!newValue) {
      return;
    }

    if (typeof newValue === "string") {
      const freetextMaterial = new Material();
      freetextMaterial.uid = Utils.generateUid(10);
      freetextMaterial.name = newValue.trim();
      freetextMaterial.type = MaterialType.usage;
      freetextMaterial.usable = true;
      setDialogValues({...dialogValues, material: freetextMaterial});
      return;
    }

    if (newValue.name.endsWith(TEXT_ADD)) {
      const materiaName = newValue?.name.match('".*"')![0].slice(1, -1);

      setMaterialAddPopupValues({
        ...materialAddPopupValues,
        name: materiaName,
        popUpOpen: true,
      });
    } else {
      setDialogValues({...dialogValues, material: newValue});
    }
  };
  /* ------------------------------------------
  // Pop-Up Handler Material-Create
  // ------------------------------------------ */
  const onMaterialCreate = (material: Material) => {
    setDialogValues({...dialogValues, material: material});

    setMaterialAddPopupValues({
      ...MATERIAL_POP_UP_VALUES_INITIAL_STATE,
      popUpOpen: false,
    });
    onMaterialCreateSuper(material);
  };
  const onCloseDialogMaterial = () => {
    setMaterialAddPopupValues({
      ...MATERIAL_POP_UP_VALUES_INITIAL_STATE,
      popUpOpen: false,
    });
  };

  return (
    <React.Fragment>
      <Dialog open={dialogOpen} onClose={handleClose} maxWidth="xs" fullWidth>
        <DialogTitle>{TEXT_ADD_ITEM}</DialogTitle>
        <DialogContent>
          <Stack spacing={2}>
            {/* Material */}
            <Box component={"div"} sx={{paddingTop: theme.spacing(1)}}>
              <MaterialAutocomplete
                componentKey=""
                material={dialogValues.material}
                materials={materials}
                disabled={editMode}
                onChange={onChangeMaterial}
                error={dialogValidation}
              />
            </Box>
            {/* Menge */}
            <TextField
              margin="normal"
              id={"quantity"}
              key={"quantity"}
              type="number"
              label={TEXT_QUANTITY}
              name={"quantity"}
              value={dialogValues.quantity}
              fullWidth
              onChange={onQuantityChange}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button color="primary" variant="outlined" onClick={handleClose}>
            {TEXT_CANCEL}
          </Button>
          <Button color="primary" variant="contained" onClick={handleOk}>
            {material?.uid ? TEXT_CHANGE : TEXT_ADD}
          </Button>
        </DialogActions>
      </Dialog>
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
      />
    </React.Fragment>
  );
};

export default EventMaterialListPage;
