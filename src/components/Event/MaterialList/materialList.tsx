import React from "react";

import {
  Stack,
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
  Button,
  Autocomplete,
} from "@mui/material";
import Grid from "@mui/material/Grid";

import {
  ALERT_TITLE_WAIT_A_MINUTE as TEXT_ALERT_TITLE_WAIT_A_MINUTE,
  WHICH_MENUES_FOR_MATERIAL_LIST_GENERATION as TEXT_WHICH_MENUES_FOR_MATERIAL_LIST_GENERATION,
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
  FIELD_QUANTITY as TEXT_FIELD_QUANTITY,
  FIELD_RESPONSIBLE as TEXT_FIELD_RESPONSIBLE,
} from "../../../constants/text";

import {MoreVert as MoreVertIcon} from "@mui/icons-material";

import useCustomStyles from "../../../constants/styles";

import AuthUser from "../../Firebase/Authentication/authUser.class";
import Event, {Cook} from "../Event/event.class";
import EventGroupConfiguration from "../GroupConfiguration/groupConfiguration.class";
import {Snackbar} from "../../Shared/customSnackbar";
import AlertMessage from "../../Shared/AlertMessage";
import {
  DialogSelectMenues,
  decodeSelectedMeals,
} from "../Menuplan/dialogSelectMenues";
import {MealRecipe, MenuplanData} from "../Menuplan/menuplan.types";
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
import {TextFieldSize} from "../../../constants/defaultValues";

import {useEventMasterData} from "../Event/eventMasterDataContext";
import {useMaterialListHandlers} from "./useMaterialListHandlers";
import {useDatabase} from "../../Database/DatabaseContext";
import {itemsDomainToMaterialListItems} from "./materialListAdapter";

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
  authUser: AuthUser;
  materialList: MaterialList;
  event: Event;
  groupConfiguration: EventGroupConfiguration;
  menuplan: MenuplanData;
  materials: Material[];
  recipes: Recipes;
  saveInProgressRef: React.MutableRefObject<boolean>;
  fetchMissingData: ({type}: FetchMissingDataProps) => void;
  onMaterialListUpdate: (materialList: MaterialList) => void;
  onMasterdataCreate: ({type, value}: OnMasterdataCreateProps) => void;
}

/**
 * Hauptkomponente der Materialliste eines Events.
 *
 * Verwendet den useMaterialListHandlers-Hook für alle Operationen
 * und persistiert via Supabase statt Firebase.
 */
const EventMaterialListPage = ({
  authUser,
  materialList,
  event,
  groupConfiguration,
  menuplan,
  materials,
  recipes,
  saveInProgressRef,
  fetchMissingData,
  onMaterialListUpdate,
  onMasterdataCreate,
}: EventMaterialListPageProps) => {
  const classes = useCustomStyles();

  const navigationValuesContext = React.useContext(NavigationValuesContext);

  const [state, dispatch] = React.useReducer(materialListReducer, initialState);
  const [highlightedItemUids, setHighlightedItemUids] = React.useState<Set<string>>(new Set());
  const highlightTimeoutRef = React.useRef<ReturnType<typeof setTimeout>>();

  const [recipeDrawerData, setRecipeDrawerData] =
    React.useState<RecipeDrawerData>(RECIPE_DRAWER_DATA_INITIAL_VALUES);

  // Handler-Hook initialisieren
  const handlers = useMaterialListHandlers({
    authUser,
    event,
    menuplan,
    materials,
    recipes,
    materialList,
    selectedListItem: state.selectedListItem,
    saveInProgressRef,
    fetchMissingData,
    onMaterialListUpdate,
    onSelectList: (listUid: string) =>
      dispatch({type: ReducerActions.SET_SELECTED_LIST_ITEM, payload: {uid: listUid}}),
    onDispatchLoading: (isLoading) =>
      dispatch({type: ReducerActions.SHOW_LOADING, payload: {isLoading}}),
    onDispatchError: (error) =>
      dispatch({type: ReducerActions.GENERIC_ERROR, payload: error}),
    onDispatchSnackbar: (severity, message) =>
      dispatch({type: ReducerActions.SNACKBAR_SHOW, payload: {severity, message}}),
  });

  /* ------------------------------------------
  // Initialisierung
  // ------------------------------------------ */
  React.useEffect(() => {
    if (!recipeDrawerData.isLoadingData) return;
    if (!Object.prototype.hasOwnProperty.call(recipes, recipeDrawerData.recipe.uid)) return;

    if (!recipeDrawerData.recipe.name) {
      setRecipeDrawerData((prev) => ({
        ...prev,
        isLoadingData: recipes[prev.recipe.uid].portions > 0 ? false : true,
        open: true,
        recipe: recipes[prev.recipe.uid],
      }));
    } else if (
      recipeDrawerData.recipe?.portions === 0 &&
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

  React.useEffect(() => {
    navigationValuesContext?.setNavigationValues({
      action: Action.NONE,
      object: NavigationObject.materialList,
    });
  }, []);

  React.useEffect(() => {
    if (materials.length === 0) {
      fetchMissingData({type: FetchMissingDataType.MATERIALS});
    }
  }, []);

  /* ------------------------------------------
  // Realtime-Subscription auf Items der ausgewählten Liste
  // ------------------------------------------ */
  const database = useDatabase();
  const materialListItemsRef = React.useRef<MaterialListMaterial[]>([]);

  // Ref synchron halten, damit der Realtime-Callback immer den aktuellen Stand hat
  React.useEffect(() => {
    if (state.selectedListItem && materialList.lists[state.selectedListItem]) {
      materialListItemsRef.current = materialList.lists[state.selectedListItem].items;
    }
  }, [materialList, state.selectedListItem]);

  React.useEffect(() => {
    if (!state.selectedListItem) return;

    const unsubscribe = database.materialLists.subscribeToListItems(
      state.selectedListItem,
      (items) => {
        // Während eines eigenen Saves ignorieren
        if (saveInProgressRef.current) return;

        // Leere Liste ignorieren (kurzzeitig bei delete-all + re-insert)
        if (items.length === 0 && materialListItemsRef.current.length > 0) {
          return;
        }

        const updatedItems = itemsDomainToMaterialListItems(items);

        // Geänderte Items ermitteln (für Highlight)
        const oldMap = new Map<string, {quantity: number; checked: boolean; cookName: string}>();
        materialListItemsRef.current.forEach((material) => {
          oldMap.set(material.uid, {quantity: material.quantity, checked: material.checked, cookName: material.resolvedCookName ?? material.assignedCookName ?? ""});
        });
        const changedUids = new Set<string>();
        updatedItems.forEach((material) => {
          const old = oldMap.get(material.uid);
          const currentCookName = material.resolvedCookName ?? material.assignedCookName ?? "";
          if (!old) {
            changedUids.add(material.uid);
          } else if (old.quantity !== material.quantity || old.checked !== material.checked || old.cookName !== currentCookName) {
            changedUids.add(material.uid);
          }
        });

        if (changedUids.size > 0) {
          setHighlightedItemUids(changedUids);
          if (highlightTimeoutRef.current) clearTimeout(highlightTimeoutRef.current);
          highlightTimeoutRef.current = setTimeout(
            () => setHighlightedItemUids(new Set()),
            2000,
          );
        }

        // Ref sofort aktualisieren
        materialListItemsRef.current = updatedItems;

        const updatedMaterialList = JSON.parse(JSON.stringify(materialList)) as MaterialList;
        updatedMaterialList.lists[state.selectedListItem!].items = updatedItems;
        onMaterialListUpdate(updatedMaterialList);
      },
      (error) => {
        console.warn("Realtime materiallistitems subscription error:", error.message);
      },
    );

    return () => unsubscribe();
  }, [state.selectedListItem]);

  /* ------------------------------------------
  // Listen-Element-Handler
  // ------------------------------------------ */
  const onListElementSelect = React.useCallback(
    async (event: React.MouseEvent<HTMLElement, MouseEvent>) => {
      const selectedListItem = event.currentTarget.dataset.uid;
      if (!selectedListItem || state.selectedListItem === selectedListItem) return;

      dispatch({
        type: ReducerActions.SET_SELECTED_LIST_ITEM,
        payload: {uid: selectedListItem},
      });
    },
    [state.selectedListItem],
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
  // Recipe-Drawer-Handler
  // ------------------------------------------ */
  const onOpenRecipeDrawer = (
    menueUid: string,
    recipeUid: string,
  ) => {
    let mealRecipe: MealRecipe | undefined;
    let recipe = new Recipe();
    recipe.uid = recipeUid;
    let loadingData = false;
    let openDrawer = false;

    menuplan.menues[menueUid]?.mealRecipeOrder.forEach((mealRecipeUid) => {
      if (menuplan.mealRecipes[mealRecipeUid].recipe.recipeUid === recipeUid) {
        mealRecipe = menuplan.mealRecipes[mealRecipeUid];
      }
    });

    if (!mealRecipe) return;

    if (Object.prototype.hasOwnProperty.call(recipes, recipeUid)) {
      recipe = recipes[recipeUid] as Recipe;
      openDrawer = true;
    } else {
      recipe.name = mealRecipe.recipe?.name ?? "";
      fetchMissingData({
        type: FetchMissingDataType.RECIPE,
        recipeShort: {
          uid: mealRecipe.recipe.recipeUid,
          name: mealRecipe.recipe.name,
          type: mealRecipe.recipe.type,
          created: {fromUid: mealRecipe.recipe.createdFromUid},
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
        outOfDateWarnMessage={TEXT_LIST_ENTRY_MAYBE_OUT_OF_DATE(TEXT_MATERIAL_LIST)}
        selectedListItem={state.selectedListItem}
        lists={materialList.lists}
        noOfLists={Object.keys(materialList.lists).length}
        menuplan={menuplan}
        onCreateList={handlers.onCreateList}
        onListElementSelect={onListElementSelect}
        onListElementDelete={handlers.onListElementDelete}
        onListElementEdit={handlers.onListElementEdit}
        onRefreshLists={handlers.onRefreshLists}
        onGeneratePrintVersion={handlers.onGeneratePrintVersion}
      />
      {state.selectedListItem && materialList.lists[state.selectedListItem] && (
        <Box component="div" sx={CENTER_BOX_SX}>
          <EventMaterialListList
            materialList={materialList.lists[state.selectedListItem]}
            materials={materials}
            cooks={event.cooks}
            highlightedItemUids={highlightedItemUids}
            onCheckboxClick={handlers.onCheckboxClick}
            onOpenContexMenu={handlers.onOpenContextMenu}
            onChangeItem={handlers.onChangeItem}
            onAssignedCookChange={handlers.onAssignedCookChange}
          />
        </Box>
      )}
      <DialogSelectMenues
        open={handlers.dialogSelectMenueData.open}
        title={TEXT_WHICH_MENUES_FOR_MATERIAL_LIST_GENERATION}
        dates={menuplan.dates}
        preSelectedMenue={handlers.dialogSelectMenueData.menues}
        mealTypes={menuplan.mealTypes}
        meals={menuplan.meals}
        menues={menuplan.menues}
        showSelectAll={true}
        onClose={handlers.onCloseDialogSelectMenues}
        onConfirm={handlers.onConfirmDialogSelectMenues}
      />
      <PositionContextMenu
        itemType={TEXT_MATERIAL}
        anchorEl={handlers.contextMenuSelectedItem.anchor}
        handleMenuClick={handlers.onContextMenuClick}
        handleMenuClose={handlers.onCloseContextMenu}
      />
      <DialogHandleMaterial
        dialogOpen={handlers.handleMaterialDialogValues.open}
        material={handlers.handleMaterialDialogValues.material}
        quantity={handlers.handleMaterialDialogValues.quantity}
        materials={materials}
        editMode={handlers.handleMaterialDialogValues.material.uid ? true : false}
        handleOk={handlers.onAddMaterialDialogAdd}
        handleClose={handlers.onAddMaterialDialogClose}
        onMaterialCreate={onMaterialCreate}
        authUser={authUser}
      />
      {handlers.traceItemDialogValues.open && (
        <DialogTraceItem
          itemType={TEXT_MATERIAL}
          dialogOpen={handlers.traceItemDialogValues.open}
          trace={handlers.traceItemDialogValues.trace}
          sortedMenues={handlers.traceItemDialogValues.sortedMenues}
          hasBeenManualyEdited={handlers.traceItemDialogValues.hasBeenManuallyEdited}
          handleClose={handlers.onDialogTraceItemClose}
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
          firebase={undefined as any}
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
  cooks: Cook[];
  highlightedItemUids: Set<string>;
  onCheckboxClick: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onOpenContexMenu: (event: React.MouseEvent<HTMLButtonElement>) => void;
  onChangeItem: (change: MaterialItemChange) => void;
  onAssignedCookChange: (itemUid: string, cookId: string | null, cookName: string | null) => void;
}
const EventMaterialListList = React.memo(
  ({
    materialList,
    materials,
    cooks,
    highlightedItemUids,
    onCheckboxClick,
    onOpenContexMenu,
    onChangeItem,
    onAssignedCookChange,
  }: EventMaterialListListProps) => {
    const classes = useCustomStyles();
    const shouldFocusNewRowRef = React.useRef(false);

    const prepareItemsForDisplay = React.useCallback(
      (items: MaterialListMaterial[]) => {
        const sortedList = [...items].sort((itemA, itemB) => {
          if (!itemA.name && !itemB.name) return 0;
          if (!itemA.name) return 1;
          if (!itemB.name) return -1;
          return itemA.name.localeCompare(itemB.name);
        });

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

    // Koch-Optionen für Autocomplete: Namen der Event-Köche
    const cookOptions = React.useMemo(
      () => cooks.map((cook) => cook.displayName).filter(Boolean),
      [cooks],
    );

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
                  sx={{
                    ...classes.eventListItem,
                    ...(highlightedItemUids.has(material.uid) && classes.remoteChangeGlow),
                  }}
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
                    <Grid size={{xs: 3, sm: 2}} key={"quantity_grid_" + material.uid}>
                      <QuantityField
                        materialUid={material.uid}
                        quantity={material.quantity}
                        onChangeItem={onChangeItem}
                      />
                    </Grid>
                    <Grid size={{xs: 5, sm: 5}} key={"material_grid_" + material.uid}>
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
                    <Grid size={{xs: 4, sm: 5}} key={"cook_grid_" + material.uid}>
                      <Autocomplete
                        freeSolo
                        options={cookOptions}
                        value={material.resolvedCookName || material.assignedCookName || ""}
                        onChange={(_event, newValue) => {
                          onAssignedCookChange(
                            material.uid,
                            null,
                            typeof newValue === "string" ? newValue : null,
                          );
                        }}
                        onBlur={(event) => {
                          const inputValue = (event.target as HTMLInputElement).value;
                          const currentValue = material.resolvedCookName || material.assignedCookName || "";
                          if (inputValue !== currentValue) {
                            onAssignedCookChange(
                              material.uid,
                              null,
                              inputValue || null,
                            );
                          }
                        }}
                        renderInput={(params) => (
                          <TextField
                            {...params}
                            label={TEXT_FIELD_RESPONSIBLE}
                            size="small"
                          />
                        )}
                        size="small"
                      />
                    </Grid>
                  </Grid>
                  <IconButton
                    key={"MoreBtn_" + material.uid}
                    id={"MoreBtn_" + material.uid}
                    aria-label="settings"
                    onClick={onOpenContexMenu}
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
  handleOk: ({material, quantity}: {material: Material; quantity: number}) => void;
  handleClose: () => void;
  onMaterialCreate: (material: Material) => void;
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
    if (!newValue) return;

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
      const materialName = newValue?.name.match('".*"')![0].slice(1, -1);
      setMaterialAddPopupValues({
        ...materialAddPopupValues,
        name: materialName,
        popUpOpen: true,
      });
    } else {
      setDialogValues({...dialogValues, material: newValue});
    }
  };
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
