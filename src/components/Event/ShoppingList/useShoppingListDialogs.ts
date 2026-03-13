import React from "react";
import {AlertColor} from "@mui/material";
import {
  DialogSelectMenuesForRecipeDialogValues,
  decodeSelectedMeals,
} from "../Menuplan/dialogSelectMenues";
import {SelectedDepartmentsForShoppingList} from "./dialogSelectDepartments";
import {OperationType} from "../Event/eventSharedComponents";
import Product from "../../Product/product.class";
import Department from "../../Department/department.class";
import Unit from "../../Unit/unit.class";
import Material from "../../Material/material.class";
import Firebase from "../../Firebase/firebase.class";
import AuthUser from "../../Firebase/Authentication/authUser.class";
import Event from "../Event/event.class";
import {
  Menue,
  MenueCoordinates,
  MenuplanData,
} from "../Menuplan/menuplan.types";
import {getMealsOfMenues, getMenuesOfMeals, sortSelectedMenues} from "../Menuplan/menuplanService";
import ShoppingListCollection, {
  ShoppingListTrace,
} from "./shoppingListCollection.class";
import ShoppingList, {
  ItemType,
  ShoppingListItem,
} from "./shoppingList.class";
import {
  UnitConversionBasic,
  UnitConversionProducts,
} from "../../Unit/unitConversion.class";
import Recipe from "../../Recipe/recipe.class";
import Action from "../../../constants/actions";
import Utils from "../../Shared/utils.class";
import {
  DialogType,
  SingleTextInputResult,
  useCustomDialog,
} from "../../Shared/customDialogContext";
import {FetchMissingDataProps, FetchMissingDataType} from "../Event/event";
import {MaterialItem, ProductItem} from "./itemAutocomplete";
import {
  NEW_LIST as TEXT_NEW_LIST,
  GIVE_THE_NEW_SHOPPINGLIST_A_NAME,
  NAME as TEXT_NAME,
  DELETE as TEXT_DELETE,
  ERROR_NO_RECIPES_FOUND as TEXT_ERROR_NO_RECIPES_FOUND,
  ARTICLE_ALREADY_ADDED as TEXT_ARTICLE_ALREADY_ADDED,
  ARTICLE_ALREADY_IN_LIST as TEXT_ARTICLE_ALREADY_IN_LIST,
  REPLACE as TEXT_REPLACE,
  SUM as TEXT_SUM,
  ADD_OR_REPLACE_ARTICLE,
  KEEP_MANUALLY_ADDED_PRODUCTS as TEXT_KEEP_MANUALLY_ADDED_PRODUCTS,
  MANUALLY_ADDED_PRODUCTS as TEXT_MANUALLY_ADDED_PRODUCTS,
  KEEP_MANUALLY_EDITED_PRODUCTS as TEXT_KEEP_MANUALLY_EDITED_PRODUCTS,
  MANUALLY_EDITED_PRODUCTS as TEXT_MANUALLY_EDITED_PRODUCTS,
  CHECKED_ITEMS as TEXT_CHECKED_ITEMS,
  CHECKED_ITEMS_EXPLANATION as TEXT_CHECKED_ITEMS_EXPLANATION,
  KEEP as TEXT_KEEP,
  SHOPPING_LIST as TEXT_SHOPPING_LIST,
  ERROR_NO_PRODUCTS_FOUND as TEXT_ERROR_NO_PRODUCTS_FOUND,
} from "../../../constants/text";

/* ===================================================================
// ========================= Types & Constants =======================
// =================================================================== */
export interface ContextMenuSelectedItemProps {
  anchor: HTMLElement | null;
  departmentKey: Department["pos"];
  productUid: Product["uid"];
  itemType: ItemType;
  unit: Unit["key"];
}

export const CONTEXT_MENU_SELECTED_ITEM_INITIAL_STATE: ContextMenuSelectedItemProps =
  {
    anchor: null,
    departmentKey: 0,
    productUid: "",
    itemType: 0,
    unit: "",
  };

export enum DialogSelectDepartmentsCaller {
  CREATE = 1,
  ADD_DEPARTMENT,
}

export const DIALOG_SELECT_MENUE_DATA_INITIAL_DATA = {
  open: false,
  menues: {} as DialogSelectMenuesForRecipeDialogValues,
  selectedListUid: "",
  operationType: OperationType.none,
};

export const DIALOG_SELECT_DEPARTMENTS_INITIAL_DATA = {
  open: false,
  selectedDepartments: {} as SelectedDepartmentsForShoppingList,
  singleSelection: false,
  caller: DialogSelectDepartmentsCaller.CREATE,
};

export const ADD_ITEM_DIALOG_INITIAL_VALUES = {
  open: false,
  item: {} as ProductItem | MaterialItem,
  quantity: "",
  unit: "",
};

export const TRACE_ITEM_DIALOG_INITIAL_VALUES = {
  open: false,
  sortedMenues: [] as MenueCoordinates[],
};

export interface OnDialogAddItemOk {
  item: ProductItem | MaterialItem;
  quantity: number;
  unit: Unit["key"];
}

enum AddItemAction {
  REPLACE = 1,
  ADD,
}

/* ===================================================================
// ======================= Hook Props ================================
// =================================================================== */
interface UseShoppingListDialogsProps {
  firebase: Firebase;
  authUser: AuthUser;
  event: Event;
  menuplan: MenuplanData;
  products: Product[];
  materials: Material[];
  departments: Department[];
  units: Unit[];
  unitConversionBasic: UnitConversionBasic | null;
  unitConversionProducts: UnitConversionProducts | null;
  shoppingListCollection: ShoppingListCollection;
  shoppingList: ShoppingList | null;
  selectedListItem: string | null;
  fetchMissingData: (props: FetchMissingDataProps) => void;
  onShoppingListUpdate: (shoppingList: ShoppingList) => void;
  onShoppingCollectionUpdate: (
    shoppingListCollection: ShoppingListCollection,
  ) => void;
  onDispatchLoading: (isLoading: boolean) => void;
  onDispatchSetSelectedListItem: (uid: string) => void;
  onDispatchError: (error: Error) => void;
  onDispatchSnackbar: (severity: AlertColor, message: string) => void;
}

/**
 * Prüft, ob eine Einkaufsliste manuell bearbeitete Artikel enthält.
 *
 * @param shoppingList Die zu prüfende Einkaufsliste.
 * @returns `true`, wenn mindestens ein Artikel `manualEdit === true` hat.
 */
const hasManuallyEditedItems = (shoppingList: ShoppingList): boolean =>
  Object.values(shoppingList.list).some((dept) =>
    dept.items.some((item) => item.manualEdit === true),
  );

/* ===================================================================
// ================================ Hook =============================
// =================================================================== */
const useShoppingListDialogs = ({
  firebase,
  authUser,
  event,
  menuplan,
  products,
  materials,
  departments,
  units,
  unitConversionBasic,
  unitConversionProducts,
  shoppingListCollection,
  shoppingList,
  selectedListItem,
  fetchMissingData,
  onShoppingListUpdate,
  onShoppingCollectionUpdate,
  onDispatchLoading,
  onDispatchSetSelectedListItem,
  onDispatchError,
  onDispatchSnackbar,
}: UseShoppingListDialogsProps) => {
  const {customDialog} = useCustomDialog();

  const [dialogSelectMenueData, setDialogSelectMenueData] = React.useState(
    DIALOG_SELECT_MENUE_DATA_INITIAL_DATA,
  );
  const [dialogSelectDepartments, setDialogSelectDepartments] = React.useState(
    DIALOG_SELECT_DEPARTMENTS_INITIAL_DATA,
  );
  const [contextMenuSelectedItem, setContextMenuSelectedItem] = React.useState(
    CONTEXT_MENU_SELECTED_ITEM_INITIAL_STATE,
  );
  const [handleItemDialogValues, setHandleItemDialogValues] = React.useState(
    ADD_ITEM_DIALOG_INITIAL_VALUES,
  );
  const [traceItemDialogValues, setTraceItemDialogValues] = React.useState(
    TRACE_ITEM_DIALOG_INITIAL_VALUES,
  );

  /* ------------------------------------------
  // Select-Menues Dialog
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

  const onConfirmDialogSelectMenues = React.useCallback(
    async (selectedMenues: DialogSelectMenuesForRecipeDialogValues) => {
      setDialogSelectMenueData((prev) => ({
        ...prev,
        menues: selectedMenues,
        open: false,
      }));
      setDialogSelectDepartments((prev) => ({
        ...prev,
        open: true,
        caller: DialogSelectDepartmentsCaller.CREATE,
      }));
    },
    [],
  );

  /* ------------------------------------------
  // Select-Departments Dialog
  // ------------------------------------------ */
  const onCloseDialogSelectDepartments = React.useCallback(() => {
    setDialogSelectMenueData(DIALOG_SELECT_MENUE_DATA_INITIAL_DATA);
    setDialogSelectDepartments(DIALOG_SELECT_DEPARTMENTS_INITIAL_DATA);
  }, []);

  const onRefreshLists = React.useCallback(
    async (
      newName?: string,
      selectedMenues?: Menue["uid"][],
      selectedDepartmentsArg?: Department["uid"][],
    ) => {
      let keepManuallyAddedItems = false;
      let keepCheckedItems = false;
      const shoppingListCollectionToRefresh = {...shoppingListCollection};

      if (!shoppingList?.uid) {
        return;
      }

      const checkedItems = ShoppingList.getCheckedItemsByDepartment({
        shoppingList: shoppingList,
      });

      if (
        shoppingList &&
        shoppingListCollection.lists[shoppingList.uid].properties
          .hasManuallyAddedItems
      ) {
        const userInput = (await customDialog({
          dialogType: DialogType.selectOptions,
          title: TEXT_MANUALLY_ADDED_PRODUCTS,
          text: TEXT_KEEP_MANUALLY_ADDED_PRODUCTS(TEXT_SHOPPING_LIST),
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

      let keepManuallyEditedItems = false;

      if (shoppingList && hasManuallyEditedItems(shoppingList)) {
        const userInput = (await customDialog({
          dialogType: DialogType.selectOptions,
          title: TEXT_MANUALLY_EDITED_PRODUCTS,
          text: TEXT_KEEP_MANUALLY_EDITED_PRODUCTS(TEXT_SHOPPING_LIST),
          options: [
            {key: Action.DELETE, text: TEXT_DELETE},
            {key: Action.KEEP, text: TEXT_KEEP},
          ],
        })) as SingleTextInputResult;

        if (!userInput.valid) {
          return;
        }
        keepManuallyEditedItems = userInput.input == Action.KEEP ? true : false;
      }

      if (Object.values(checkedItems).length > 0) {
        const userInput = (await customDialog({
          dialogType: DialogType.selectOptions,
          title: TEXT_CHECKED_ITEMS,
          text: TEXT_CHECKED_ITEMS_EXPLANATION(TEXT_SHOPPING_LIST),
          options: [
            {key: Action.DELETE, text: TEXT_DELETE},
            {key: Action.KEEP, text: TEXT_KEEP, variant: "contained"},
          ],
        })) as SingleTextInputResult;

        if (!userInput.valid) {
          return;
        }
        keepCheckedItems = userInput.input == Action.KEEP ? true : false;
      }

      onDispatchLoading(true);

      if (dialogSelectMenueData.operationType === OperationType.Update) {
        shoppingListCollectionToRefresh.lists[
          dialogSelectMenueData.selectedListUid
        ].properties.name = newName!;

        shoppingListCollectionToRefresh.lists[
          dialogSelectMenueData.selectedListUid
        ].properties.selectedMenues = Object.keys(selectedMenues!);

        shoppingListCollectionToRefresh.lists[
          dialogSelectMenueData.selectedListUid
        ].properties.selectedDepartments = selectedDepartmentsArg!;

        shoppingListCollectionToRefresh.lists[
          dialogSelectMenueData.selectedListUid
        ].properties.selectedMeals = getMealsOfMenues({
          menuplan: menuplan,
          menues: selectedMenues!,
        });

        setDialogSelectMenueData(DIALOG_SELECT_MENUE_DATA_INITIAL_DATA);
      }

      ShoppingListCollection.refreshList({
        shoppingListCollection: shoppingListCollectionToRefresh,
        shoppingList: shoppingList!,
        keepManuallyAddedItems: keepManuallyAddedItems,
        keepManuallyEditedItems: keepManuallyEditedItems,
        menueplan: menuplan,
        eventUid: event.uid,
        products: products,
        materials: materials,
        units: units,
        unitConversionBasic: unitConversionBasic!,
        unitConversionProducts: unitConversionProducts!,
        departments: departments,
        firebase: firebase,
        authUser: authUser,
      })
        .then((result) => {
          if (keepCheckedItems) {
            result.shoppingList = ShoppingList.restoreCheckedItems({
              shoppingList: result.shoppingList,
              checkedItems: checkedItems,
            });
          }

          onShoppingCollectionUpdate(result.shoppingListCollection);
          onShoppingListUpdate(result.shoppingList);
          onDispatchLoading(false);
        })
        .catch((error) => {
          console.error(error);
          onDispatchError(error);
        });
    },
    [
      shoppingListCollection,
      shoppingList,
      menuplan,
      event.uid,
      products,
      materials,
      units,
      unitConversionBasic,
      unitConversionProducts,
      departments,
      firebase,
      authUser,
      customDialog,
      dialogSelectMenueData,
      onShoppingCollectionUpdate,
      onShoppingListUpdate,
      onDispatchLoading,
      onDispatchError,
    ],
  );

  const onConfirmDialogSelectDepartments = React.useCallback(
    async (selectedDepartmentsResult: SelectedDepartmentsForShoppingList) => {
      if (
        dialogSelectDepartments.caller ===
        DialogSelectDepartmentsCaller.ADD_DEPARTMENT
      ) {
        const updatedShoppingList = ShoppingList.addDepartmentToList({
          shoppingList: shoppingList!,
          departmentUid: Object.keys(selectedDepartmentsResult)![0]!,
          departments: departments,
        });
        onShoppingListUpdate(updatedShoppingList!);
        setDialogSelectDepartments(DIALOG_SELECT_DEPARTMENTS_INITIAL_DATA);
        return;
      }

      setDialogSelectDepartments((prev) => ({
        ...prev,
        open: false,
        selectedDepartments: selectedDepartmentsResult,
      }));

      const userInput = (await customDialog({
        dialogType: DialogType.SingleTextInput,
        title: TEXT_NEW_LIST,
        text: GIVE_THE_NEW_SHOPPINGLIST_A_NAME,
        singleTextInputProperties: {
          initialValue:
            dialogSelectMenueData.operationType === OperationType.Update
              ? shoppingListCollection.lists[
                  dialogSelectMenueData.selectedListUid
                ].properties.name
              : "",
          textInputLabel: TEXT_NAME,
        },
      })) as SingleTextInputResult;

      if (userInput.valid) {
        onDispatchLoading(true);

        if (dialogSelectMenueData.operationType === OperationType.Create) {
          ShoppingListCollection.createNewList({
            name: userInput.input,
            shoppingListCollection: shoppingListCollection,
            selectedMenues: Object.keys(dialogSelectMenueData.menues),
            selectedDepartments: Object.keys(selectedDepartmentsResult),
            menueplan: menuplan,
            eventUid: event.uid,
            products: products,
            materials: materials,
            departments: departments,
            units: units,
            unitConversionBasic: unitConversionBasic!,
            unitConversionProducts: unitConversionProducts!,
            firebase: firebase,
            authUser: authUser,
          })
            .then(async (result) => {
              await onShoppingCollectionUpdate(result.shoppingListCollection);
              fetchMissingData({
                type: FetchMissingDataType.SHOPPING_LIST,
                objectUid: result.shoppingListUid,
              });
              onDispatchSetSelectedListItem(result.shoppingListUid);
            })
            .catch((error) => {
              if (error.toString().includes(TEXT_ERROR_NO_RECIPES_FOUND)) {
                onDispatchSnackbar("info", TEXT_ERROR_NO_RECIPES_FOUND);
              } else {
                console.error(error);
                onDispatchError(error);
              }
            })
            .finally(() => {
              setDialogSelectMenueData(DIALOG_SELECT_MENUE_DATA_INITIAL_DATA);
              setDialogSelectDepartments(
                DIALOG_SELECT_DEPARTMENTS_INITIAL_DATA,
              );
            });
        } else if (
          dialogSelectMenueData.operationType === OperationType.Update
        ) {
          onRefreshLists(
            userInput.input,
            Object.keys(dialogSelectMenueData.menues),
            Object.keys(selectedDepartmentsResult),
          );
        }
      } else {
        setDialogSelectMenueData(DIALOG_SELECT_MENUE_DATA_INITIAL_DATA);
        setDialogSelectDepartments(DIALOG_SELECT_DEPARTMENTS_INITIAL_DATA);
      }
    },
    [
      dialogSelectDepartments.caller,
      dialogSelectMenueData,
      shoppingListCollection,
      shoppingList,
      menuplan,
      event.uid,
      products,
      materials,
      departments,
      units,
      unitConversionBasic,
      unitConversionProducts,
      firebase,
      authUser,
      customDialog,
      fetchMissingData,
      onShoppingListUpdate,
      onShoppingCollectionUpdate,
      onDispatchLoading,
      onDispatchSetSelectedListItem,
      onDispatchError,
      onDispatchSnackbar,
      onRefreshLists,
    ],
  );

  const onAddDepartmentClick = React.useCallback(() => {
    setDialogSelectDepartments((prev) => ({
      ...prev,
      open: true,
      singleSelection: true,
      caller: DialogSelectDepartmentsCaller.ADD_DEPARTMENT,
    }));
  }, []);

  /* ------------------------------------------
  // List Element Handlers
  // ------------------------------------------ */
  const onListElementSelect = React.useCallback(
    async (event: React.MouseEvent<HTMLElement, MouseEvent>) => {
      const pressedElementId = event.currentTarget.dataset.uid;

      if (!pressedElementId || selectedListItem == pressedElementId) {
        return;
      }

      fetchMissingData({
        type: FetchMissingDataType.SHOPPING_LIST,
        objectUid: pressedElementId,
      });

      onDispatchSetSelectedListItem(pressedElementId);
    },
    [selectedListItem, fetchMissingData, onDispatchSetSelectedListItem],
  );

  const onListElementDelete = React.useCallback(
    async (actionEvent: React.MouseEvent<HTMLElement>) => {
      const selectedList = actionEvent.currentTarget.dataset.uid;

      if (!selectedList) {
        return;
      }
      await ShoppingListCollection.deleteList({
        firebase: firebase,
        shoppingListColection: shoppingListCollection,
        listUidToDelete: selectedList,
        eventUid: event.uid,
        authUser: authUser,
      }).then(async () => {
        await ShoppingList.delete({
          firebase: firebase,
          eventUid: event.uid,
          listUidToDelete: selectedList,
        })
          .then(() => {
            onDispatchSetSelectedListItem("");
          })
          .catch((error) => {
            console.error(error);
            onDispatchError(error);
          });
      });
    },
    [
      firebase,
      shoppingListCollection,
      event.uid,
      authUser,
      onDispatchSetSelectedListItem,
      onDispatchError,
    ],
  );

  const onListElementEdit = React.useCallback(
    async (actionEvent: React.MouseEvent<HTMLElement>) => {
      const selectedListUid = actionEvent.currentTarget.dataset.uid;
      if (!selectedListUid) {
        return;
      }
      onListElementSelect(
        actionEvent as React.MouseEvent<HTMLElement, MouseEvent>,
      );

      const selectedMenuesForDialog: DialogSelectMenuesForRecipeDialogValues =
        {};
      const selectedDepartmentsForDialog: SelectedDepartmentsForShoppingList =
        {};

      let selectedMenuesArray =
        shoppingListCollection.lists[selectedListUid].properties.selectedMenues;
      const selectedDepartmentsArray =
        shoppingListCollection.lists[selectedListUid].properties
          .selectedDepartments;

      if (
        !Utils.areStringArraysEqual(
          shoppingListCollection.lists[selectedListUid].properties
            .selectedMeals,
          getMealsOfMenues({
            menuplan: menuplan,
            menues:
              shoppingListCollection.lists[selectedListUid].properties
                .selectedMenues,
          }),
        ) ||
        shoppingListCollection.lists[selectedListUid].properties.selectedMenues
          .length !==
          getMenuesOfMeals({
            menuplan: menuplan,
            meals:
              shoppingListCollection.lists[selectedListUid].properties
                .selectedMeals,
          }).length
      ) {
        selectedMenuesArray = getMenuesOfMeals({
          menuplan: menuplan,
          meals:
            shoppingListCollection.lists[selectedListUid].properties
              .selectedMeals,
        });
      }

      selectedMenuesArray.forEach(
        (menueUid) => (selectedMenuesForDialog[menueUid] = true),
      );
      selectedDepartmentsArray.forEach(
        (departmentUid) =>
          (selectedDepartmentsForDialog[departmentUid] = true),
      );

      setDialogSelectMenueData({
        menues: selectedMenuesForDialog,
        open: true,
        selectedListUid: selectedListUid,
        operationType: OperationType.Update,
      });
      setDialogSelectDepartments((prev) => ({
        ...prev,
        selectedDepartments: selectedDepartmentsForDialog,
      }));
    },
    [
      shoppingListCollection,
      menuplan,
      onListElementSelect,
    ],
  );

  /* ------------------------------------------
  // Context Menu Handlers
  // ------------------------------------------ */
  const onOpenContextMenu = React.useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      const pressedButton = event.currentTarget.id.split("_");
      const item = shoppingList?.list[parseInt(pressedButton[1])].items.find(
        (item) => item.item.uid == pressedButton[2],
      );

      setContextMenuSelectedItem({
        anchor: event.currentTarget,
        departmentKey: parseInt(pressedButton[1]),
        productUid: pressedButton[2],
        itemType: item!.type as ItemType,
        unit: pressedButton[3],
      });
    },
    [shoppingList],
  );

  const onCloseContextMenu = React.useCallback(() => {
    setContextMenuSelectedItem(CONTEXT_MENU_SELECTED_ITEM_INITIAL_STATE);
  }, []);

  const onContextMenuClick = React.useCallback(
    (event: React.MouseEvent<HTMLElement>) => {
      const action = event.currentTarget.dataset.action;
      let quantity: number | undefined;
      let item = {} as ProductItem | MaterialItem | undefined;
      let updatedShoppingList: ShoppingList;
      let updatedTrace: ShoppingListTrace;
      let updatedShoppingListCollection: ShoppingListCollection;

      switch (action) {
        case Action.EDIT:
          quantity = shoppingList?.list[
            contextMenuSelectedItem.departmentKey
          ].items.find(
            (item) => item.item.uid == contextMenuSelectedItem.productUid,
          )?.quantity;

          if (contextMenuSelectedItem.itemType == ItemType.food) {
            item = products.find(
              (product) => product.uid == contextMenuSelectedItem.productUid,
            ) as ProductItem;
          } else {
            item = materials.find(
              (material) => material.uid == contextMenuSelectedItem.productUid,
            ) as MaterialItem;
          }
          // Create a copy to avoid mutating the original (Phase 3.4)
          item = {...item, itemType: contextMenuSelectedItem.itemType};

          setHandleItemDialogValues({
            open: true,
            item: item!,
            quantity: quantity ? quantity.toString() : "",
            unit: contextMenuSelectedItem.unit,
          });
          break;

        case Action.DELETE:
          updatedShoppingList = ShoppingList.deleteItem({
            shoppingListReference: shoppingList!,
            departmentKey: contextMenuSelectedItem.departmentKey,
            unit: contextMenuSelectedItem.unit,
            itemUid: contextMenuSelectedItem.productUid,
          });

          updatedTrace = ShoppingListCollection.deleteTraceEntry({
            trace:
              shoppingListCollection.lists[selectedListItem!].trace,
            itemUid: contextMenuSelectedItem.productUid,
          });
          updatedShoppingListCollection = {
            ...shoppingListCollection,
            lists: {
              ...shoppingListCollection.lists,
              [selectedListItem!]: {
                ...shoppingListCollection.lists[selectedListItem!],
                trace: updatedTrace,
              },
            },
          };

          onShoppingListUpdate(updatedShoppingList!);
          onShoppingCollectionUpdate(updatedShoppingListCollection);
          break;

        case Action.TRACE:
          setTraceItemDialogValues({
            open: true,
            sortedMenues: sortSelectedMenues({
              menueList:
                shoppingListCollection.lists[selectedListItem!].properties
                  .selectedMenues,
              menuplan: menuplan,
            }),
          });
          break;
      }
      setContextMenuSelectedItem((prev) => ({...prev, anchor: null}));
    },
    [
      shoppingList,
      contextMenuSelectedItem,
      products,
      materials,
      shoppingListCollection,
      selectedListItem,
      menuplan,
      onShoppingListUpdate,
      onShoppingCollectionUpdate,
    ],
  );

  /* ------------------------------------------
  // Handle-Item Dialog (Add/Edit)
  // ------------------------------------------ */
  const onDialogHandleItemClose = React.useCallback(() => {
    setContextMenuSelectedItem(CONTEXT_MENU_SELECTED_ITEM_INITIAL_STATE);
    setHandleItemDialogValues(ADD_ITEM_DIALOG_INITIAL_VALUES);
  }, []);

  const onDialogHandleItemOk = React.useCallback(
    async ({item, quantity, unit}: OnDialogAddItemOk) => {
      let trace: ShoppingListTrace | undefined;
      let collectionNeedsUpdate = false;

      if (!handleItemDialogValues.item.uid) {
        let product: ProductItem;
        let department: Department | undefined;
        let userInput = {valid: false, input: ""} as SingleTextInputResult;
        let shoppingListItem: ShoppingListItem | undefined = undefined;

        collectionNeedsUpdate = true;

        if (item.itemType == ItemType.food) {
          product = item as ProductItem;
          department = departments.find(
            (department) => department.uid == product.department.uid,
          );
        } else {
          department = departments.find(
            (department) => department.name.toUpperCase() == "NON FOOD",
          );
        }

        if (!department) {
          return;
        }

        // Wenn eine Einheit angegeben ist, exakt nach UID + Einheit suchen;
        // ohne Einheit reicht die UID, um ein Duplikat zu erkennen.
        shoppingListItem = shoppingList?.list[department.pos]?.items.find(
          (shoppingListItem) =>
            shoppingListItem.item.uid == item.uid &&
            (unit === "" || shoppingListItem.unit == unit),
        );

        if (shoppingListItem && quantity > 0) {
          userInput = (await customDialog({
            dialogType: DialogType.selectOptions,
            title: TEXT_ARTICLE_ALREADY_ADDED,
            text: ADD_OR_REPLACE_ARTICLE(
              shoppingListItem.item.name,
              unit,
              quantity.toString(),
              shoppingListItem.quantity.toString(),
            ),
            options: [
              {key: AddItemAction.REPLACE, text: TEXT_REPLACE},
              {key: AddItemAction.ADD, text: TEXT_SUM},
            ],
          })) as SingleTextInputResult;

          if (!userInput.valid) {
            setContextMenuSelectedItem(
              CONTEXT_MENU_SELECTED_ITEM_INITIAL_STATE,
            );
            setHandleItemDialogValues(ADD_ITEM_DIALOG_INITIAL_VALUES);
            return;
          }

          switch (parseInt(userInput.input) as AddItemAction) {
            case AddItemAction.ADD:
              shoppingListItem.quantity += quantity;
              break;
            case AddItemAction.REPLACE:
              shoppingListItem.quantity = quantity;
              break;
            default:
              console.warn("ENUM unbekannt:", userInput.input);
              return;
          }
          shoppingListItem.manualEdit = true;
        } else if (shoppingListItem) {
          // Artikel existiert bereits, keine Menge eingegeben — Snackbar anzeigen und zum Artikel scrollen
          onDispatchSnackbar(
            "info",
            TEXT_ARTICLE_ALREADY_IN_LIST(shoppingListItem.item.name),
          );

          // Dialog schliessen und zum bestehenden Artikel scrollen
          setContextMenuSelectedItem(CONTEXT_MENU_SELECTED_ITEM_INITIAL_STATE);
          setHandleItemDialogValues(ADD_ITEM_DIALOG_INITIAL_VALUES);

          // Zum Artikel in der Liste scrollen (nutzt bestehendes MoreBtn-ID-Schema)
          const targetId = `MoreBtn_${department!.pos}_${item.uid}_${shoppingListItem.unit}`;
          setTimeout(() => {
            document
              .getElementById(targetId)
              ?.scrollIntoView({behavior: "smooth", block: "center"});
          }, 100);
          return;
        } else {
          ShoppingList.addItem({
            shoppingListReference: shoppingList!,
            item: item,
            quantity: quantity,
            unit: unit,
            department: department,
            addedManually: true,
            itemType: item.itemType,
          });
        }

        if (
          !shoppingListItem ||
          parseInt(userInput.input) == AddItemAction.ADD
        ) {
          trace = ShoppingListCollection.addTraceEntry({
            trace: shoppingListCollection.lists[selectedListItem!].trace,
            menueUid: "",
            recipe: {} as Recipe,
            item: item,
            quantity: quantity,
            unit: unit,
            addedManually: true,
            itemType: item.itemType,
          });
        }
      } else {
        const existingItem = shoppingList?.list[
          contextMenuSelectedItem.departmentKey
        ].items.find(
          (item) =>
            item.item.uid == contextMenuSelectedItem.productUid &&
            item.unit == contextMenuSelectedItem.unit,
        );

        if (existingItem) {
          if (existingItem.quantity !== quantity || existingItem.unit !== unit) {
            existingItem.manualEdit = true;
            collectionNeedsUpdate = true;
          }
          existingItem.quantity = quantity;
          existingItem.unit = unit;
        }
      }

      // Collection aktualisieren: hasManuallyAddedItems setzen und/oder Trace updaten
      if (collectionNeedsUpdate) {
        const currentEntry = shoppingListCollection.lists[selectedListItem!];
        const updatedCollection = {
          ...shoppingListCollection,
          lists: {
            ...shoppingListCollection.lists,
            [selectedListItem!]: {
              ...currentEntry,
              properties: {
                ...currentEntry.properties,
                hasManuallyAddedItems: true,
              },
              ...(trace && {trace}),
            },
          },
        };
        onShoppingCollectionUpdate(updatedCollection);
      }

      ShoppingList.save({
        firebase: firebase,
        eventUid: event.uid,
        shoppingList: shoppingList!,
        authUser: authUser,
      }).catch((error) => {
        console.error(error);
        onDispatchError(error);
      });

      setContextMenuSelectedItem(CONTEXT_MENU_SELECTED_ITEM_INITIAL_STATE);
      setHandleItemDialogValues(ADD_ITEM_DIALOG_INITIAL_VALUES);
    },
    [
      handleItemDialogValues.item.uid,
      shoppingListCollection,
      selectedListItem,
      shoppingList,
      contextMenuSelectedItem,
      departments,
      customDialog,
      firebase,
      event.uid,
      authUser,
      onShoppingCollectionUpdate,
      onDispatchError,
      onDispatchSnackbar,
    ],
  );

  /* ------------------------------------------
  // Trace Dialog
  // ------------------------------------------ */
  const onDialogTraceItemClose = React.useCallback(() => {
    setTraceItemDialogValues(TRACE_ITEM_DIALOG_INITIAL_VALUES);
    setContextMenuSelectedItem(CONTEXT_MENU_SELECTED_ITEM_INITIAL_STATE);
  }, []);

  /* ------------------------------------------
  // PDF Generation
  // ------------------------------------------ */
  const onGeneratePrintVersion = React.useCallback(() => {
    if (
      Object.keys(shoppingListCollection.lists[selectedListItem!].trace)
        .length === 0
    ) {
      onDispatchError(new Error(TEXT_ERROR_NO_PRODUCTS_FOUND));
      return;
    }

    // Return the data needed for PDF generation (JSX must be in component)
    return {
      shoppingListName:
        shoppingListCollection.lists[selectedListItem!].properties.name,
      shoppingListSelectedTimeSlice: decodeSelectedMeals({
        selectedMeals:
          shoppingListCollection.lists[selectedListItem!].properties
            .selectedMeals,
        menuplan: menuplan,
      }),
    };
  }, [shoppingListCollection, selectedListItem, menuplan, onDispatchError]);

  return {
    // Dialog states
    dialogSelectMenueData,
    dialogSelectDepartments,
    contextMenuSelectedItem,
    handleItemDialogValues,
    traceItemDialogValues,
    // Select-Menues handlers
    onCreateList,
    onCloseDialogSelectMenues,
    onConfirmDialogSelectMenues,
    // Select-Departments handlers
    onCloseDialogSelectDepartments,
    onConfirmDialogSelectDepartments,
    onAddDepartmentClick,
    // List element handlers
    onListElementSelect,
    onListElementDelete,
    onListElementEdit,
    onRefreshLists,
    // Context menu handlers
    onOpenContextMenu,
    onCloseContextMenu,
    onContextMenuClick,
    // Handle-Item dialog handlers
    onDialogHandleItemClose,
    onDialogHandleItemOk,
    // Trace dialog handlers
    onDialogTraceItemClose,
    // PDF
    onGeneratePrintVersion,
  };
};

export default useShoppingListDialogs;
