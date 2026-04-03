import React, {SyntheticEvent} from "react";

import {generateAndDownloadPdf} from "../../Shared/pdfUtils";

import {
  Stack,
  Button,
  Backdrop,
  CircularProgress,
  Typography,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  IconButton,
  Container,
  Checkbox,
  Dialog,
  DialogTitle,
  DialogActions,
  DialogContent,
  TextField,
  FormControl,
  SnackbarCloseReason,
  useTheme,
  Box,
  ToggleButtonGroup,
  ToggleButton,
  AlertColor,
} from "@mui/material";
import Grid from "@mui/material/Grid";

import {
  ALERT_TITLE_WAIT_A_MINUTE as TEXT_ALERT_TITLE_WAIT_A_MINUTE,
  SHOPPING_LIST_MENUE_SELECTION_DESCRIPTION as TEXT_SHOPPING_LIST_MENUE_SELECTION_DESCRIPTION,
  WHICH_MENUES_FOR_SHOPPING_LIST_GENERATION as TEXT_WHICH_MENUES_FOR_SHOPPING_LIST_GENERATION,
  NAME as TEXT_NAME,
  ADD_ITEM as TEXT_ADD_ITEM,
  CANCEL as TEXT_CANCEL,
  ADD as TEXT_ADD,
  QUANTITY as TEXT_QUANTITY,
  NEW_ITEM as TEXT_NEW_ITEM,
  WHAT_KIND_OF_ITEM_ARE_YOU_CREATING as TEXT_WHAT_KIND_OF_ITEM_ARE_YOU_CREATING,
  FOOD as TEXT_FOOD,
  MATERIAL as TEXT_MATERIAL,
  SHOPPING_LIST as TEXT_SHOPPING_LIST,
  SUFFIX_PDF as TEXT_SUFFIX_PDF,
  PLEASE_GIVE_VALUE_FOR_FIELD as TEXT_PLEASE_GIVE_VALUE_FOR_FIELD,
  ITEM as TEXT_ITEM,
  CHANGE as TEXT_CHANGE,
  USED_RECIPES_OF_SHOPPINGLIST_POSSIBLE_OUT_OF_DATE as TEXT_USED_RECIPES_OF_SHOPPINGLIST_POSSIBLE_OUT_OF_DATE,
  ADD_DEPARTMENT as TEXT_ADD_DEPARTMENT,
  FIELD_QUANTITY as TEXT_FIELD_QUANTITY,
  SHOPPING_MODE as TEXT_SHOPPING_MODE,
  EDIT_MODE as TEXT_EDIT_MODE,
} from "../../../constants/text";
import {MoreVert as MoreVertIcon} from "@mui/icons-material";

import {useCustomStyles} from "../../../constants/styles";

import Firebase from "../../Firebase/firebase.class";
import AuthUser from "../../Firebase/Authentication/authUser.class";
import {MenuplanData} from "../Menuplan/menuplan.types";
import {CustomSnackbar, SnackbarState} from "../../Shared/customSnackbar";
import {
  DialogType,
  SingleTextInputResult,
  useCustomDialog,
} from "../../Shared/customDialogContext";
import {
  NavigationObject,
  NavigationValuesContext,
} from "../../Navigation/NavigationContext";
import {Action} from "../../../constants/actions";
import {AlertMessage} from "../../Shared/AlertMessage";
import {ShoppingListCollection} from "./shoppingListCollection.class";
import {ShoppingList,ItemType, ShoppingListItem} from "./shoppingList.class";

import {DialogSelectMenues} from "../Menuplan/dialogSelectMenues";
import {Event} from "../Event/event.class";
import {UnitAutocomplete} from "../../Unit/unitAutocomplete";
import {ItemAutocomplete,MaterialItem, ProductItem} from "./itemAutocomplete";
import {Unit} from "../../Unit/unit.class";
import {Product, createEmptyProduct} from "../../Product/product.types";
import Department from "../../Department/department.class";
import {Recipes} from "../../Recipe/recipe.class";
import {DialogMaterial,
  MATERIAL_POP_UP_VALUES_INITIAL_STATE,
  MaterialDialog,
} from "../../Material/dialogMaterial";
import {FetchMissingDataProps, FetchMissingDataType} from "../Event/event";
import {
  DialogProduct,
  PRODUCT_POP_UP_VALUES_INITIAL_STATE,
  ProductDialog,
} from "../../Product/dialogProduct";
import {RecipeDrawer} from "../../Recipe/RecipeDrawer";
import {EventGroupConfiguration} from "../GroupConfiguration/groupConfiguration.class";
import {ShoppingListPdf} from "./shoppingListPdf";
import {
  DialogTraceItem,
  EventListCard,
  PositionContextMenu,
  ListMode,
} from "../Event/eventSharedComponents";
import {Material} from "../../Material/material.types";
import {TextFieldSize} from "../../../constants/defaultValues";
import {DialogSelectDepartments} from "./dialogSelectDepartments";

import {useEventMasterData} from "../Event/eventMasterDataContext";
import {useFirebase} from "../../Firebase/firebaseContext";
import {HighlightedShoppingListItemContext} from "./shoppingListHighlightContext";

// Custom hooks
import {useRecipeDrawer} from "./useRecipeDrawer";
import {useShoppingListHandlers,
  DialogSelectDepartmentsCaller,
  OnDialogAddItemOk,
  ItemChange,
} from "./useShoppingListHandlers";
// import * as Sentry from "@sentry/react";

enum ReducerActions {
  SHOW_LOADING,
  SET_SELECTED_LIST_ITEM,
  GENERIC_ERROR,
  SNACKBAR_SHOW,
  SNACKBAR_CLOSE,
}
interface State {
  selectedListItem: string | null;
  isLoading: boolean;
  error: Error | null;
  snackbar: SnackbarState;
}
type DispatchAction =
  | {type: ReducerActions.SHOW_LOADING; payload: {isLoading: boolean}}
  | {type: ReducerActions.SET_SELECTED_LIST_ITEM; payload: {uid: string}}
  | {type: ReducerActions.GENERIC_ERROR; payload: Error}
  | {
      type: ReducerActions.SNACKBAR_SHOW;
      payload: {severity: AlertColor; message: string};
    }
  | {type: ReducerActions.SNACKBAR_CLOSE; payload: Record<string, never>};

const initialState: State = {
  selectedListItem: null,
  isLoading: false,
  error: null,
  snackbar: {open: false, severity: "success", message: ""},
};

const shoppingListReducer = (state: State, action: DispatchAction): State => {
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
        isLoading: false,
      };
    case ReducerActions.GENERIC_ERROR:
      return {
        ...state,
        isLoading: false,
        error: action.payload,
      };
    case ReducerActions.SNACKBAR_SHOW:
      return {
        ...state,
        isLoading: false,
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
      throw new Error(`Unbekannter ActionType: ${_exhaustiveCheck}`);
    }
  }
};

interface EventShoppingListPageProps {
  authUser: AuthUser;
  menuplan: MenuplanData;
  event: Event;
  materials: Material[];
  recipes: Recipes;
  shoppingListCollection: ShoppingListCollection;
  shoppingList: ShoppingList | null;
  saveInProgressRef: React.MutableRefObject<boolean>;
  fetchMissingData: (props: FetchMissingDataProps) => void;
  onShoppingListUpdate: (shoppingList: ShoppingList) => void;
  onShoppingCollectionUpdate: (
    shoppingListCollection: ShoppingListCollection,
  ) => void;
  /** Optionale Listen-ID für Deep-Link-Navigation (z.B. aus Verwendungsnachweis). */
  initialListId?: string;
}

const EventShoppingListPage = ({
  authUser,
  menuplan,
  event,
  saveInProgressRef,
  materials,
  recipes,
  shoppingListCollection,
  shoppingList,
  fetchMissingData,
  onShoppingListUpdate,
  onShoppingCollectionUpdate,
  initialListId,
}: EventShoppingListPageProps) => {
  const classes = useCustomStyles();
  const theme = useTheme();
  // Firebase wird nur noch für RecipeDrawer benötigt (TODO: nach Recipe-Migration entfernen)
  const firebase = useFirebase();
  const {
    products,
    units,
    departments,
    unitConversionBasic,
    unitConversionProducts,
  } = useEventMasterData();

  const navigationValuesContext = React.useContext(NavigationValuesContext);

  const [state, dispatch] = React.useReducer(shoppingListReducer, initialState);
  const [shoppingListModus, setShoppingListModus] = React.useState<ListMode>(
    ListMode.VIEW,
  );

  // Dispatch helper callbacks (stable references for hooks)
  const onDispatchLoading = React.useCallback((isLoading: boolean) => {
    dispatch({type: ReducerActions.SHOW_LOADING, payload: {isLoading}});
  }, []);
  const onDispatchSetSelectedListItem = React.useCallback((uid: string) => {
    dispatch({
      type: ReducerActions.SET_SELECTED_LIST_ITEM,
      payload: {uid},
    });
    setShoppingListModus(ListMode.EDIT);
  }, []);
  const onDispatchError = React.useCallback((error: Error) => {
    dispatch({type: ReducerActions.GENERIC_ERROR, payload: error});
  }, []);
  const onDispatchSnackbar = React.useCallback(
    (severity: AlertColor, message: string) => {
      dispatch({
        type: ReducerActions.SNACKBAR_SHOW,
        payload: {severity, message},
      });
    },
    [],
  );

  // Custom hooks
  const {recipeDrawerData, onOpenRecipeDrawer, onRecipeDrawerClose} =
    useRecipeDrawer({recipes, menuplan, fetchMissingData});

  const {
    dialogSelectMenueData,
    dialogSelectDepartments,
    contextMenuSelectedItem,
    handleItemDialogValues,
    traceItemDialogValues,
    onCreateList,
    onCloseDialogSelectMenues,
    onConfirmDialogSelectMenues,
    onCloseDialogSelectDepartments,
    onConfirmDialogSelectDepartments,
    onAddDepartmentClick,
    onListElementSelect,
    onListElementDelete,
    onListElementEdit,
    onRefreshLists,
    onOpenContextMenu,
    onCloseContextMenu,
    onContextMenuClick,
    onDialogHandleItemClose,
    onDialogHandleItemOk,
    onDialogTraceItemClose,
    onGeneratePrintVersion,
    onCheckboxClick,
    onChangeItem,
  } = useShoppingListHandlers({
    authUser,
    event,
    menuplan,
    products,
    materials,
    departments,
    units: units ?? [],
    unitConversionBasic,
    unitConversionProducts,
    shoppingListCollection,
    shoppingList,
    selectedListItem: state.selectedListItem,
    saveInProgressRef,
    fetchMissingData,
    onShoppingListUpdate,
    onShoppingCollectionUpdate,
    onDispatchLoading,
    onDispatchSetSelectedListItem,
    onDispatchError,
    onDispatchSnackbar,
  });

  /* ------------------------------------------
  // Deep-Link: Einkaufsliste automatisch auswählen
  // ------------------------------------------ */
  React.useEffect(() => {
    if (
      initialListId &&
      !state.selectedListItem &&
      shoppingListCollection.noOfLists > 0 &&
      initialListId in shoppingListCollection.lists
    ) {
      fetchMissingData({
        type: FetchMissingDataType.SHOPPING_LIST,
        objectUid: initialListId,
      });
      onDispatchSetSelectedListItem(initialListId);
    }
  }, [initialListId, shoppingListCollection.noOfLists]);

  /* ------------------------------------------
  // Navigation-Handler
  // ------------------------------------------ */
  React.useEffect(() => {
    // Sentry.logger.info("User triggered test log", {log_source: "sentry_test"});

    navigationValuesContext?.setNavigationValues({
      action: Action.NONE,
      object: NavigationObject.shoppingList,
    });
  }, []);

  /* ------------------------------------------
  // PDF generieren (wrapper that creates JSX)
  // ------------------------------------------ */
  const handleGeneratePrintVersion = React.useCallback(() => {
    const pdfData = onGeneratePrintVersion();
    if (!pdfData) return;

    generateAndDownloadPdf(
      <ShoppingListPdf
        shoppingList={shoppingList!}
        shoppingListName={pdfData.shoppingListName}
        shoppingListSelectedTimeSlice={pdfData.shoppingListSelectedTimeSlice}
        eventName={event.name}
        authUser={authUser}
      />,
      event.name + " " + TEXT_SHOPPING_LIST + TEXT_SUFFIX_PDF,
      (error) =>
        dispatch({type: ReducerActions.GENERIC_ERROR, payload: error}),
      {eventUid: event.uid},
    );
  }, [onGeneratePrintVersion, shoppingList, event.name, authUser]);

  /* ------------------------------------------
  // Snackbar-Handling
  // ------------------------------------------ */
  const handleSnackbarClose = React.useCallback(
    (
      _event: globalThis.Event | SyntheticEvent<Element, globalThis.Event>,
      reason: SnackbarCloseReason,
    ) => {
      if (reason === "clickaway") {
        return;
      }
      dispatch({
        type: ReducerActions.SNACKBAR_CLOSE,
        payload: {},
      });
    },
    [],
  );

  /* ------------------------------------------
  // Toggle Handler
  // ------------------------------------------ */
  const handleModusChange = React.useCallback(
    (_event: React.MouseEvent<HTMLElement>, newValue: ListMode) => {
      setShoppingListModus(newValue);
    },
    [],
  );

  // Memoize toolbar styles
  const toolbarContainerSx = React.useMemo(
    () => ({
      ...classes.container,
      display: "flex",
      justifyContent: "center",
      flexDirection: "column" as const,
      alignItems: "center",
      width: "100%",
      mx: "auto",
    }),
    [classes.container],
  );

  const listContainerSx = React.useMemo(
    () => ({justifyContent: "center", display: "flex"}),
    [],
  );

  const buttonStackSx = React.useMemo(
    () => ({marginTop: theme.spacing(2)}),
    [theme],
  );

  const addDepartmentButtonSx = React.useMemo(
    () => ({marginTop: theme.spacing(2)}),
    [theme],
  );

  return (
    <Stack spacing={2}>
      {state.error && (
        <AlertMessage
          error={state.error}
          messageTitle={TEXT_ALERT_TITLE_WAIT_A_MINUTE}
        />
      )}
      <Backdrop
        sx={classes.backdrop}
        open={state.isLoading || recipeDrawerData.isLoadingData}
      >
        <CircularProgress color="inherit" />
      </Backdrop>
      <EventListCard
        cardTitle={TEXT_SHOPPING_LIST}
        cardDescription={TEXT_SHOPPING_LIST_MENUE_SELECTION_DESCRIPTION}
        outOfDateWarnMessage={
          TEXT_USED_RECIPES_OF_SHOPPINGLIST_POSSIBLE_OUT_OF_DATE
        }
        selectedListItem={state.selectedListItem}
        lists={shoppingListCollection.lists}
        noOfLists={shoppingListCollection.noOfLists}
        menuplan={menuplan}
        onCreateList={onCreateList}
        onListElementSelect={onListElementSelect}
        onListElementDelete={onListElementDelete}
        onListElementEdit={onListElementEdit}
        onRefreshLists={onRefreshLists}
        onGeneratePrintVersion={handleGeneratePrintVersion}
      />
      {state.selectedListItem && shoppingList && (
        <React.Fragment>
          <Box component="div" sx={toolbarContainerSx}>
            <ToggleButtonGroup
              exclusive
              value={shoppingListModus}
              onChange={handleModusChange}
              color="primary"
            >
              <ToggleButton
                value={ListMode.VIEW}
                aria-label={TEXT_SHOPPING_MODE}
              >
                {TEXT_SHOPPING_MODE}
              </ToggleButton>
              <ToggleButton value={ListMode.EDIT} aria-label={TEXT_EDIT_MODE}>
                {TEXT_EDIT_MODE}
              </ToggleButton>
            </ToggleButtonGroup>
            <Stack direction="row" spacing={2} sx={buttonStackSx}>
              <Button
                color="primary"
                size="small"
                onClick={onAddDepartmentClick}
                variant="outlined"
                sx={addDepartmentButtonSx}
              >
                {TEXT_ADD_DEPARTMENT}
              </Button>
            </Stack>
          </Box>
          <Box component="div" sx={listContainerSx}>
            <EventShoppingListList
              shoppingList={shoppingList}
              products={products}
              materials={materials}
              units={units ?? []}
              shoppingListModus={shoppingListModus}
              onCheckboxClick={onCheckboxClick}
              onChangeItem={onChangeItem}
              onOpenContexMenü={onOpenContextMenu}
            />
          </Box>
        </React.Fragment>
      )}
      <DialogSelectMenues
        open={dialogSelectMenueData.open}
        title={TEXT_WHICH_MENUES_FOR_SHOPPING_LIST_GENERATION}
        dates={menuplan.dates}
        preSelectedMenue={dialogSelectMenueData.menues}
        mealTypes={menuplan.mealTypes}
        meals={menuplan.meals}
        menues={menuplan.menues}
        showSelectAll={true}
        onClose={onCloseDialogSelectMenues}
        onConfirm={onConfirmDialogSelectMenues}
      />
      <DialogSelectDepartments
        open={dialogSelectDepartments.open}
        departments={
          dialogSelectDepartments.caller ===
          DialogSelectDepartmentsCaller.ADD_DEPARTMENT
            ? departments.filter(
                (department) =>
                  !Object.values(shoppingList?.list ?? {}).some(
                    (entry) => entry.departmentUid === department.uid,
                  ),
              )
            : departments
        }
        preSelecteDepartments={dialogSelectDepartments.selectedDepartments}
        singleSelection={dialogSelectDepartments.singleSelection}
        onClose={onCloseDialogSelectDepartments}
        onConfirm={onConfirmDialogSelectDepartments}
      />
      <DialogHandleItem
        dialogOpen={handleItemDialogValues.open}
        item={handleItemDialogValues.item}
        unit={handleItemDialogValues.unit}
        quantity={handleItemDialogValues.quantity}
        products={products}
        materials={materials}
        units={units ?? []}
        departments={departments}
        editMode={handleItemDialogValues.item.uid ? true : false}
        firebase={firebase}
        authUser={authUser}
        handleOk={onDialogHandleItemOk}
        handleClose={onDialogHandleItemClose}
      />
      <PositionContextMenu
        itemType={TEXT_ITEM}
        listMode={shoppingListModus}
        anchorEl={contextMenuSelectedItem.anchor}
        handleMenuClick={onContextMenuClick}
        handleMenuClose={onCloseContextMenu}
      />
      <CustomSnackbar
        message={state.snackbar.message}
        severity={state.snackbar.severity}
        snackbarOpen={state.snackbar.open}
        handleClose={handleSnackbarClose}
      />
      {state.selectedListItem && contextMenuSelectedItem.productUid && (
        <DialogTraceItem
          itemType={TEXT_ITEM}
          dialogOpen={traceItemDialogValues.open}
          trace={
            shoppingListCollection.lists[state.selectedListItem!]?.trace[
              contextMenuSelectedItem.productUid
            ] ?? []
          }
          sortedMenues={traceItemDialogValues.sortedMenues}
          hasBeenManualyEdited={Boolean(
            shoppingList!.list[
              contextMenuSelectedItem.departmentKey
            ]?.items.find(
              (item) => item.item.uid == contextMenuSelectedItem.productUid,
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
interface EventShoppingListListProps {
  shoppingList: ShoppingList;
  units: Unit[];
  products: Product[];
  materials: Material[];
  shoppingListModus: ListMode;
  onCheckboxClick: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onOpenContexMenü: (event: React.MouseEvent<HTMLButtonElement>) => void;
  onChangeItem: (change: ItemChange) => void;
}

interface QuantityFieldProps {
  departmentKey: string;
  itemUid: string;
  quantity: number;
  onChangeItem: (change: ItemChange) => void;
}
const QuantityField = React.memo(
  ({departmentKey, itemUid, quantity, onChangeItem}: QuantityFieldProps) => {
    const displayValue =
      Number.isNaN(quantity) || quantity === 0 ? "" : String(quantity);
    const [localValue, setLocalValue] = React.useState(displayValue);

    // Sync local state when the prop changes from outside (e.g. after save)
    React.useEffect(() => {
      setLocalValue(displayValue);
    }, [displayValue]);

    const handleBlur = React.useCallback(
      (event: React.FocusEvent<HTMLInputElement>) => {
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
        id={"quantity_" + departmentKey + "_" + itemUid}
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

const EventShoppingListList = React.memo(
  ({
    shoppingList,
    products,
    materials,
    units,
    shoppingListModus,
    onCheckboxClick,
    onOpenContexMenü,
    onChangeItem,
  }: EventShoppingListListProps) => {
    const classes = useCustomStyles();
    const theme = useTheme();
    const shouldFocusDepartmentRef = React.useRef<string | null>(null);
    const highlightedItemKeys = React.useContext(
      HighlightedShoppingListItemContext,
    );

    const toAutocompleteItem = React.useCallback(
      (shoppingListItem: ShoppingListItem) => {
        switch (shoppingListItem.type) {
          case ItemType.food:
            return {
              uid: shoppingListItem.item.uid,
              name: shoppingListItem.item.name,
              itemType: ItemType.food,
            } as ProductItem;
          case ItemType.material:
            return {
              uid: shoppingListItem.item.uid,
              name: shoppingListItem.item.name,
              itemType: ItemType.material,
            } as MaterialItem;
          case ItemType.custom:
            return shoppingListItem.item.name;
          default:
            return null;
        }
      },
      [],
    );

    const prepareDepartmentItemsForDisplay = React.useCallback(
      (items: ShoppingListItem[]) => {
        const sortedList = [...items].sort((a, b) => {
          if (!a.item.name && !b.item.name) return 0;
          if (!a.item.name) return 1;
          if (!b.item.name) return -1;
          return a.item.name.localeCompare(b.item.name);
        });

        let templateRowUid = "";

        if (shoppingListModus === ListMode.VIEW) {
          return {items: sortedList, templateRowUid};
        }

        const newItem = ShoppingList.createEmptyListItem();
        newItem.manualAdd = true;
        templateRowUid = newItem.item.uid;

        if (
          sortedList.length === 0 ||
          sortedList[sortedList.length - 1].item.name !== ""
        ) {
          sortedList.push(newItem);
        }

        return {items: sortedList, templateRowUid};
      },
      [shoppingListModus],
    );

    // Memoize style objects
    const viewModeItemSx = React.useMemo(() => ({margin: 0, padding: 0}), []);
    const viewModeIconSx = React.useMemo(() => ({minWidth: 36}), []);
    const containerSx = React.useMemo(
      () => ({...classes.container, width: "100%"}),
      [classes.container],
    );

    // Memoize display data per department (sorted items + template row UIDs)
    const displayDataByDepartment = React.useMemo(() => {
      const result: Record<
        string,
        {items: ShoppingListItem[]; templateRowUid: string}
      > = {};
      Object.entries(shoppingList.list).forEach(
        ([departmentKey, department]) => {
          result[departmentKey] = prepareDepartmentItemsForDisplay(
            department.items,
          );
        },
      );
      return result;
    }, [shoppingList.list, prepareDepartmentItemsForDisplay]);

    // Focus the quantity field of the new template row after re-render
    React.useEffect(() => {
      if (shouldFocusDepartmentRef.current) {
        const departmentKey = shouldFocusDepartmentRef.current;
        shouldFocusDepartmentRef.current = null;
        const templateRowUid =
          displayDataByDepartment[departmentKey]?.templateRowUid;
        if (templateRowUid) {
          const el = document.getElementById(
            "quantity_" + departmentKey + "_" + templateRowUid,
          );
          if (el) {
            el.focus();
          }
        }
      }
    });

    return (
      <Container
        sx={containerSx}
        component="main"
        maxWidth="sm"
        key={"ShoppingListContainer"}
      >
        {Object.entries(shoppingList.list).map(
          ([departmentKey, department]) => {
            const departmentDisplayData =
              displayDataByDepartment[departmentKey];
            if (!departmentDisplayData) return null;
            return (
              <React.Fragment key={"GridItemDepartment_" + departmentKey}>
                <Typography
                  id={"department_heading_" + departmentKey}
                  component={"h2"}
                  variant={"h5"}
                  align="center"
                  gutterBottom
                  sx={{marginTop: theme.spacing(4)}}
                >
                  {department.departmentName}
                </Typography>
                <List
                  sx={classes.eventList}
                  key={"shoppingListList_" + department.departmentUid}
                >
                  {departmentDisplayData.items.map((item) => (
                    <ListItem
                      key={
                        "shoppingListItem_" + item.item.uid + "_" + item.unit
                      }
                      sx={{
                        ...(shoppingListModus === ListMode.VIEW
                          ? viewModeItemSx
                          : classes.eventListItem),
                        ...(highlightedItemKeys.has(
                          item.item.name + "_" + item.unit,
                        ) && classes.remoteChangeGlow),
                      }}
                    >
                      <ListItemIcon
                        sx={
                          shoppingListModus === ListMode.VIEW
                            ? viewModeIconSx
                            : undefined
                        }
                      >
                        <Checkbox
                          key={"checkbox_" + item.item.uid + "_" + item.unit}
                          name={
                            "checkbox_" +
                            departmentKey +
                            "_" +
                            item.item.uid +
                            "_" +
                            item.unit
                          }
                          onChange={onCheckboxClick}
                          checked={item.checked}
                          disableRipple
                          size={
                            shoppingListModus === ListMode.VIEW
                              ? "small"
                              : "medium"
                          }
                        />
                      </ListItemIcon>
                      {shoppingListModus === ListMode.VIEW ? (
                        <>
                          <ListItemText
                            sx={classes.eventListItemTextQuantity}
                            primaryTypographyProps={
                              item.checked
                                ? {color: "textSecondary"}
                                : {color: "textPrimary"}
                            }
                            key={"quantity" + item.item.uid + "_" + item.unit}
                            primary={
                              item.checked ? (
                                <del>
                                  {Number.isNaN(item.quantity) ||
                                  item.quantity == 0
                                    ? ""
                                    : new Intl.NumberFormat("de-CH", {
                                        maximumSignificantDigits: 3,
                                      }).format(item.quantity)}
                                </del>
                              ) : Number.isNaN(item.quantity) ||
                                item.quantity == 0 ? (
                                ""
                              ) : (
                                new Intl.NumberFormat("de-CH", {
                                  maximumSignificantDigits: 2,
                                }).format(item.quantity)
                              )
                            }
                          />
                          <ListItemText
                            sx={classes.eventListItemTextUnit}
                            primaryTypographyProps={
                              item.checked
                                ? {color: "textSecondary"}
                                : {color: "textPrimary"}
                            }
                            key={"unit_" + item.item.uid + "_" + item.unit}
                            primary={
                              item.checked ? <del>{item.unit}</del> : item.unit
                            }
                          />
                          <ListItemText
                            sx={classes.eventListItemTextProduct}
                            primaryTypographyProps={
                              item.checked
                                ? {color: "textSecondary"}
                                : {color: "textPrimary"}
                            }
                            key={"itemName_" + item.item.uid + "_" + item.unit}
                            primary={
                              item.checked ? (
                                <del>{item.item.name}</del>
                              ) : (
                                item.item.name
                              )
                            }
                          />
                        </>
                      ) : (
                        <Grid
                          container
                          spacing={2}
                          alignItems="center"
                          sx={{flex: 1, minWidth: 0}}
                        >
                          <Grid
                            size={{xs: 5, sm: 3}}
                            key={"quantity_grid_" + item.item.uid}
                          >
                            <QuantityField
                              departmentKey={departmentKey}
                              itemUid={item.item.uid}
                              quantity={item.quantity}
                              onChangeItem={onChangeItem}
                            />
                          </Grid>
                          <Grid
                            size={{xs: 4, sm: 3}}
                            key={"unit_grid_" + item.item.uid}
                          >
                            <UnitAutocomplete
                              componentKey={departmentKey + "_" + item.item.uid}
                              unitKey={item.unit}
                              units={units}
                              size={TextFieldSize.small}
                              onChange={(event, newValue, reason, objectId) =>
                                onChangeItem({
                                  source: "autocompleteUnit",
                                  event,
                                  value: newValue,
                                  reason,
                                  objectId,
                                })
                              }
                            />
                          </Grid>
                          <Grid
                            size={{xs: 12, sm: 6}}
                            key={"item_grid_" + item.item.uid}
                          >
                            <ItemAutocomplete
                              componentKey={departmentKey + "_" + item.item.uid}
                              item={toAutocompleteItem(item)}
                              materials={materials}
                              products={products}
                              disabled={false}
                              allowCreateNewItem={false}
                              allowFreeText={true}
                              error={{isError: false, errorText: ""}}
                              size={TextFieldSize.small}
                              onChange={(event, newValue, reason, objectId) => {
                                if (
                                  item.item.uid ===
                                    departmentDisplayData.templateRowUid &&
                                  newValue
                                ) {
                                  shouldFocusDepartmentRef.current =
                                    departmentKey;
                                }
                                onChangeItem({
                                  source: "autocompleteItem",
                                  event,
                                  value: newValue,
                                  reason,
                                  objectId,
                                });
                              }}
                            />
                          </Grid>
                        </Grid>
                      )}
                      <IconButton
                        key={
                          "MoreBtn_" +
                          departmentKey +
                          "_" +
                          item.item.uid +
                          "_" +
                          item.unit
                        }
                        id={
                          "MoreBtn_" +
                          departmentKey +
                          "_" +
                          item.item.uid +
                          "_" +
                          item.unit
                        }
                        aria-label="settings"
                        onClick={onOpenContexMenü}
                        size={
                          shoppingListModus === ListMode.VIEW
                            ? "small"
                            : "large"
                        }
                        sx={{flexShrink: 0}}
                      >
                        <MoreVertIcon />
                      </IconButton>
                    </ListItem>
                  ))}
                </List>
              </React.Fragment>
            );
          },
        )}
      </Container>
    );
  },
);
EventShoppingListList.displayName = "EventShoppingListList";

interface DialogHandleItemProps {
  dialogOpen: boolean;
  item: null | ProductItem | MaterialItem;
  quantity: string;
  unit: Unit["key"];
  products: Product[];
  materials: Material[];
  units: Unit[];
  departments: Department[];
  editMode: boolean;
  firebase: Firebase;
  authUser: AuthUser;
  handleOk: (props: OnDialogAddItemOk) => void;
  handleClose: () => void;
}
interface DialogValues {
  quantity: string;
  unit: Unit["key"];
  item: ProductItem | MaterialItem | null;
}
const DIALOG_VALUES_INITIAL_STATE: DialogValues = {
  quantity: "",
  unit: "",
  item: {...createEmptyProduct(), itemType: ItemType.none},
};
const DIALOG_VALUES_VALIDATION_INITIAL_STATE = {
  isError: false,
  errorText: "",
};
const DialogHandleItem = ({
  dialogOpen,
  item,
  quantity,
  unit,
  products,
  materials,
  units,
  departments,
  editMode,
  firebase: _firebase,
  authUser,
  handleOk: handleOkSuper,
  handleClose: handleCloseSuper,
}: DialogHandleItemProps) => {
  const {customDialog} = useCustomDialog();

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
  const [productAddPopupValues, setProductAddPopupValues] = React.useState({
    ...PRODUCT_POP_UP_VALUES_INITIAL_STATE,
    ...{popUpOpen: false},
  });

  if (dialogValues == DIALOG_VALUES_INITIAL_STATE && item?.uid) {
    setDialogValues({
      quantity: quantity,
      unit: unit,
      item: item,
    });
  }
  /* ------------------------------------------
  // Change-Handler Dialog
  // ------------------------------------------ */
  const onChangeItem = async (
    _event: React.ChangeEvent<HTMLInputElement>,
    newValue: string | MaterialItem | ProductItem | null,
  ) => {
    if (typeof newValue === "string" || !newValue) {
      return;
    }
    if (newValue.name.endsWith(TEXT_ADD)) {
      const userInput = (await customDialog({
        dialogType: DialogType.SelectOptions,
        title: TEXT_NEW_ITEM,
        text: TEXT_WHAT_KIND_OF_ITEM_ARE_YOU_CREATING,
        singleTextInputProperties: {
          initialValue: "",
          textInputLabel: TEXT_NAME,
        },
        options: [
          {key: ItemType.food, text: TEXT_FOOD},
          {key: ItemType.material, text: TEXT_MATERIAL},
        ],
      })) as SingleTextInputResult;
      if (userInput.valid) {
        const itemName = newValue?.name.match('".*"')![0].slice(1, -1);
        const selectedItemType = parseInt(userInput.input) as ItemType;
        if (selectedItemType == ItemType.material) {
          setMaterialAddPopupValues({
            ...materialAddPopupValues,
            name: itemName,
            popUpOpen: true,
          });
        } else {
          setProductAddPopupValues({
            ...productAddPopupValues,
            name: itemName,
            popUpOpen: true,
          });
        }
      }
    } else {
      setDialogValues({...dialogValues, item: newValue});
    }
  };
  const onQuantityChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setDialogValues({
      ...dialogValues,
      quantity: event.target.value,
    });
  };
  const onUnitChange = (
    _event: React.ChangeEvent<HTMLInputElement>,
    newValue: Unit | null,
  ) => {
    if (newValue) {
      setDialogValues({...dialogValues, unit: newValue.key});
    } else {
      setDialogValues({...dialogValues, unit: ""});
    }
  };
  /* ------------------------------------------
  // Button-Handler Dialog
  // ------------------------------------------ */
  const handleOk = () => {
    if (!dialogValues.item || !dialogValues.item.uid) {
      setDialogValidation({
        isError: true,
        errorText: TEXT_PLEASE_GIVE_VALUE_FOR_FIELD(TEXT_ITEM),
      });
      return;
    }
    handleOkSuper({
      item: dialogValues.item,
      quantity: parseFloat(dialogValues.quantity),
      unit: dialogValues.unit,
    });
    setDialogValues(DIALOG_VALUES_INITIAL_STATE);
    setDialogValidation(DIALOG_VALUES_VALIDATION_INITIAL_STATE);
  };
  const handleClose = () => {
    setDialogValues(DIALOG_VALUES_INITIAL_STATE);
    setDialogValidation(DIALOG_VALUES_VALIDATION_INITIAL_STATE);
    handleCloseSuper();
  };
  /* ------------------------------------------
  // Pop-Up Handler Material/Produkt
  // ------------------------------------------ */
  const onMaterialCreate = (material: Material) => {
    const item: MaterialItem = {...material, itemType: ItemType.material};
    setDialogValues({...dialogValues, item: item});
    setMaterialAddPopupValues({
      ...MATERIAL_POP_UP_VALUES_INITIAL_STATE,
      popUpOpen: false,
    });
  };
  const onCloseDialogMaterial = () => {
    setMaterialAddPopupValues({
      ...MATERIAL_POP_UP_VALUES_INITIAL_STATE,
      popUpOpen: false,
    });
  };
  const onProductCreate = (product: Product) => {
    const item: ProductItem = {...product, itemType: ItemType.food};
    setDialogValues({...dialogValues, item: item});
    setProductAddPopupValues({
      ...PRODUCT_POP_UP_VALUES_INITIAL_STATE,
      popUpOpen: false,
    });
  };

  const onProductChooseExisting = (product: Product) => {
    const item: ProductItem = {...product, itemType: ItemType.food};
    setDialogValues({...dialogValues, item: item});
    setProductAddPopupValues({
      ...PRODUCT_POP_UP_VALUES_INITIAL_STATE,
      popUpOpen: false,
    });
  };

  const onCloseDialogProduct = () => {
    setProductAddPopupValues({
      ...PRODUCT_POP_UP_VALUES_INITIAL_STATE,
      popUpOpen: false,
    });
  };
  return (
    <React.Fragment>
      <Dialog open={dialogOpen} onClose={handleClose} maxWidth="xs" fullWidth>
        <DialogTitle>{TEXT_ADD_ITEM}</DialogTitle>
        <DialogContent>
          <Grid container spacing={2}>
            <Grid size={12}>
              <ItemAutocomplete
                componentKey={"x"}
                item={dialogValues.item}
                materials={materials}
                products={products}
                disabled={editMode}
                size={TextFieldSize.medium}
                onChange={onChangeItem}
                error={dialogValidation}
              />
            </Grid>
            <Grid size={6}>
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
            </Grid>
            <Grid size={6}>
              <FormControl fullWidth margin="normal">
                <UnitAutocomplete
                  componentKey="unit_"
                  unitKey={dialogValues.unit}
                  units={units}
                  onChange={onUnitChange}
                />
              </FormControl>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button color="primary" variant="outlined" onClick={handleClose}>
            {TEXT_CANCEL}
          </Button>
          <Button color="primary" variant="contained" onClick={handleOk}>
            {item?.uid ? TEXT_CHANGE : TEXT_ADD}
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
      <DialogProduct
        productName={productAddPopupValues.name}
        productUid={productAddPopupValues.uid}
        productUsable={productAddPopupValues.usable}
        productDietProperties={productAddPopupValues.dietProperties}
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

export {EventShoppingListPage};
