/**
 * Konsolidierter Hook für alle Einkaufslisten-Operationen.
 *
 * Ersetzt `useShoppingListDialogs` + `useShoppingListOperations` und
 * verwendet Supabase (via `useDatabase()`) statt Firebase für Persistenz.
 *
 * Gibt exakt die gleichen Handler-Namen zurück wie die kombinierten
 * alten Hooks, damit die JSX-Verdrahtung in `shoppingList.tsx` unverändert
 * bleibt.
 *
 * @example
 * const {dialogSelectMenueData, onCreateList, onCheckboxClick, ...} =
 *   useShoppingListHandlers({...});
 */
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
import {ItemAutocompleteProps, MaterialItem, ProductItem} from "./itemAutocomplete";
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
  SHOPPINTLIST_ITEM_MOVED_TO_RIGHT_DEPARTMENT as TEXT_SHOPPINTLIST_ITEM_MOVED_TO_RIGHT_DEPARTMENT,
} from "../../../constants/text";
import {useDatabase} from "../../Database/DatabaseContext";
import {
  shoppingListToInsertRows,
} from "./shoppingListAdapter";
import UsedRecipes from "../UsedRecipes/usedRecipes.class";
import {AutocompleteChangeReason} from "@mui/material";

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

export type ItemChange =
  | {
      source: "textfield";
      event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>;
      value: string;
    }
  | {
      source: "autocompleteItem";
      event: React.ChangeEvent<HTMLInputElement>;
      value: ItemAutocompleteProps["item"];
      reason: AutocompleteChangeReason;
      objectId: string;
    }
  | {
      source: "autocompleteUnit";
      event: React.ChangeEvent<HTMLInputElement>;
      value: Unit | null;
      reason: AutocompleteChangeReason;
      objectId: string;
    };

enum AddItemAction {
  REPLACE = 1,
  ADD,
}

/* ===================================================================
// ======================= Hook Props ================================
// =================================================================== */

interface UseShoppingListHandlersProps {
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
  saveInProgressRef: React.MutableRefObject<boolean>;
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

/* ===================================================================
// ========================= Helper Functions ========================
// =================================================================== */

/**
 * Prüft, ob eine Einkaufsliste manuell bearbeitete Artikel enthält.
 */
const hasManuallyEditedItems = (shoppingList: ShoppingList): boolean =>
  Object.values(shoppingList.list).some((dept) =>
    dept.items.some((item) => item.manualEdit === true),
  );

/**
 * Bestimmt die Abteilung eines Items basierend auf dessen Typ.
 */
const determineItemDepartment = ({
  itemType,
  itemValue,
  currentDepartmentPos,
  departments,
}: {
  itemType: ItemType;
  itemValue: ItemAutocompleteProps["item"];
  currentDepartmentPos: number;
  departments: Department[];
}): Department | undefined => {
  switch (itemType) {
    case ItemType.food:
      return departments.find(
        (department) =>
          department.uid == (itemValue as ProductItem).department.uid,
      );
    case ItemType.material:
      return departments.find(
        (department) => department.name.toUpperCase() == "NON FOOD",
      );
    case ItemType.custom:
    case ItemType.none:
      return departments.find(
        (department) => department.pos == currentDepartmentPos,
      );
    default:
      return departments.find(
        (department) => department.pos == currentDepartmentPos,
      );
  }
};

/**
 * Verschiebt ein Item von einer Abteilung in eine andere.
 */
const moveItemToDepartment = ({
  shoppingList,
  item,
  fromDepartmentPos,
  toDepartment,
  isNewItem,
}: {
  shoppingList: ShoppingList;
  item: ShoppingListItem;
  fromDepartmentPos: number;
  toDepartment: Department;
  isNewItem: boolean;
}): boolean => {
  if (toDepartment.pos != fromDepartmentPos && !isNewItem) {
    shoppingList.list[Number(fromDepartmentPos) as Department["pos"]].items =
      shoppingList.list[fromDepartmentPos].items.filter(
        (listItem) => listItem.item.uid != item.item.uid,
      );
    shoppingList.list[toDepartment.pos].items.push(item);
    return true;
  } else if (isNewItem) {
    if (!Object.hasOwn(shoppingList.list, toDepartment.pos)) {
      shoppingList.list[toDepartment.pos] = {
        departmentUid: toDepartment.uid,
        departmentName: toDepartment.name,
        items: [],
      };
    }
    shoppingList.list[toDepartment.pos].items.push(item);
    return toDepartment.pos != fromDepartmentPos;
  }
  return false;
};

/**
 * Erstellt einen Trace-Eintrag für ein ShoppingList-Item.
 */
const createTraceEntry = ({
  shoppingListCollection,
  selectedListItem,
  item,
}: {
  shoppingListCollection: ShoppingListCollection;
  selectedListItem: string;
  item: ShoppingListItem;
}): ShoppingListTrace => {
  return ShoppingList.addTraceEntry({
    trace: shoppingListCollection.lists[selectedListItem].trace,
    menueUid: "",
    recipe: {} as {uid: string; name: string},
    item: item.item as Product,
    quantity: item.quantity,
    unit: item.unit,
    addedManually: true,
    itemType: item.type,
  });
};

/**
 * Duplikat-Dialog: Benutzer wählt ADD oder REPLACE.
 */
const handleDuplicateItem = async ({
  existingItem,
  newItem,
  customDialog,
}: {
  existingItem: ShoppingListItem;
  newItem: ShoppingListItem;
  customDialog: ReturnType<typeof useCustomDialog>["customDialog"];
}): Promise<SingleTextInputResult> => {
  return (await customDialog({
    dialogType: DialogType.selectOptions,
    title: TEXT_ARTICLE_ALREADY_ADDED,
    text: ADD_OR_REPLACE_ARTICLE(
      newItem.item.name,
      newItem.unit,
      newItem.quantity.toString(),
      existingItem.quantity.toString(),
    ),
    options: [
      {key: AddItemAction.REPLACE, text: TEXT_REPLACE},
      {key: AddItemAction.ADD, text: TEXT_SUM},
    ],
  })) as SingleTextInputResult;
};

/* ===================================================================
// ================================ Hook =============================
// =================================================================== */

/**
 * Konsolidierter Hook für alle Einkaufslisten-Handler.
 *
 * Verwendet Supabase für Persistenz (via `useDatabase()`). Gibt exakt
 * dieselben Handler-Namen zurück wie die kombinierten alten Hooks.
 */
const useShoppingListHandlers = ({
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
  saveInProgressRef,
  fetchMissingData,
  onShoppingListUpdate,
  onShoppingCollectionUpdate,
  onDispatchLoading,
  onDispatchSetSelectedListItem,
  onDispatchError,
  onDispatchSnackbar,
}: UseShoppingListHandlersProps) => {
  const {customDialog} = useCustomDialog();
  const database = useDatabase();

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
  // Rezepte aus Supabase laden (für Listengenerierung)
  // ------------------------------------------ */

  /**
   * Lädt die vollständigen Rezepte für die angegebenen Menüs.
   */
  const loadRecipesForMenues = React.useCallback(
    async (selectedMenues: Menue["uid"][]): Promise<{[key: string]: Recipe}> => {
      const recipeList = UsedRecipes.defineSelectedRecipes({
        selectedMenues,
        menueplan: menuplan,
      });

      if (recipeList.length === 0) return {};

      const uniqueRecipeIds = [...new Set(recipeList.map((r) => r.uid))];
      const recipeMap: {[key: string]: Recipe} = {};

      await Promise.all(
        uniqueRecipeIds.map(async (recipeId) => {
          const [header, ingredients, steps, recipeMaterials] = await Promise.all([
            database.recipes.getRecipe(recipeId),
            database.recipeIngredients.getIngredientsForRecipe(recipeId),
            database.recipePreparationSteps.getStepsForRecipe(recipeId),
            database.recipeMaterials.getMaterialsForRecipe(recipeId),
          ]);

          if (header) {
            recipeMap[recipeId] = Recipe.fromRepositoryData(
              header,
              ingredients,
              steps,
              recipeMaterials,
            );
          }
        }),
      );

      return recipeMap;
    },
    [menuplan, database],
  );

  /* ------------------------------------------
  // Persistenz-Helfer
  // ------------------------------------------ */

  /**
   * Speichert die Items einer Liste in Supabase (delete-all + re-insert).
   */
  const persistListItems = React.useCallback(
    async (listId: string, list: ShoppingList) => {
      saveInProgressRef.current = true;
      try {
        const rows = shoppingListToInsertRows(list, listId, departments);
        await database.shoppingLists.saveListItems(listId, rows);
      } finally {
        // Kurz warten, damit die Realtime-Callbacks noch das Flag sehen —
        // die WAL-Events treffen asynchron ein.
        setTimeout(() => {
          saveInProgressRef.current = false;
        }, 500);
      }
    },
    [database, departments, saveInProgressRef],
  );

  /**
   * Speichert den Header einer Liste in Supabase.
   */
  const persistCollectionHeader = React.useCallback(
    async (listId: string, props: ShoppingListCollection["lists"][string]["properties"]) => {
      await database.shoppingLists.updateListHeader(listId, {
        name: props.name,
        selected_menues: props.selectedMenues,
        selected_meals: props.selectedMeals,
        selected_departments: props.selectedDepartments,
        has_manually_added_items: props.hasManuallyAddedItems,
      });
    },
    [database],
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

      try {
        // Rezepte laden — basierend auf allen Menüs der gewählten Meals,
        // nicht nur den gespeicherten selectedMenues. So werden auch neue
        // Menüs berücksichtigt, die seit der letzten Generierung hinzukamen
        // (Drift-Erkennung in refreshList passt selectedMenues dann an).
        const listProps = shoppingListCollectionToRefresh.lists[shoppingList.uid].properties;
        const allMenuesForMeals = getMenuesOfMeals({
          menuplan: menuplan,
          meals: listProps.selectedMeals,
        });
        const recipes = await loadRecipesForMenues(allMenuesForMeals);

        const result = ShoppingListCollection.refreshList({
          shoppingListCollection: shoppingListCollectionToRefresh,
          shoppingList: shoppingList,
          keepManuallyAddedItems,
          keepManuallyEditedItems,
          menueplan: menuplan,
          recipes,
          products,
          materials,
          departments,
          units,
          unitConversionBasic: unitConversionBasic!,
          unitConversionProducts: unitConversionProducts!,
          authUser,
        });

        if (keepCheckedItems) {
          result.shoppingList = ShoppingList.restoreCheckedItems({
            shoppingList: result.shoppingList,
            checkedItems: checkedItems,
          });
        }

        // Optimistisches UI-Update
        onShoppingCollectionUpdate(result.shoppingListCollection);
        onShoppingListUpdate(result.shoppingList);
        onDispatchLoading(false);

        // Supabase persistieren
        await persistListItems(shoppingList.uid, result.shoppingList);
        await persistCollectionHeader(
          shoppingList.uid,
          result.shoppingListCollection.lists[shoppingList.uid].properties,
        );
      } catch (error) {
        console.error(error);
        onDispatchError(error as Error);
      }
    },
    [
      shoppingListCollection,
      shoppingList,
      menuplan,
      products,
      materials,
      units,
      unitConversionBasic,
      unitConversionProducts,
      departments,
      authUser,
      customDialog,
      dialogSelectMenueData,
      onShoppingCollectionUpdate,
      onShoppingListUpdate,
      onDispatchLoading,
      onDispatchError,
      loadRecipesForMenues,
      persistListItems,
      persistCollectionHeader,
    ],
  );

  const onConfirmDialogSelectDepartments = React.useCallback(
    async (selectedDepartmentsResult: SelectedDepartmentsForShoppingList) => {
      if (
        dialogSelectDepartments.caller ===
        DialogSelectDepartmentsCaller.ADD_DEPARTMENT
      ) {
        const departmentUid = Object.keys(selectedDepartmentsResult)![0]!;
        ShoppingList.addDepartmentToList({
          shoppingList: shoppingList!,
          departmentUid,
          departments: departments,
        });
        // Neue Referenz, damit React.memo das Update erkennt
        onShoppingListUpdate({
          ...shoppingList!,
          list: {...shoppingList!.list},
        } as ShoppingList);
        setDialogSelectDepartments(DIALOG_SELECT_DEPARTMENTS_INITIAL_DATA);

        // Zur neuen Abteilung scrollen
        const dept = departments.find((d) => d.uid === departmentUid);
        if (dept) {
          setTimeout(() => {
            document
              .getElementById("department_heading_" + dept.pos)
              ?.scrollIntoView({behavior: "smooth", block: "center"});
          }, 100);
        }
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
          try {
            const menueIds = Object.keys(dialogSelectMenueData.menues);
            const departmentIds = Object.keys(selectedDepartmentsResult);

            // Rezepte aus Supabase laden
            const recipes = await loadRecipesForMenues(menueIds);

            // Liste generieren (reine Geschäftslogik)
            const {shoppingList: newList, trace, shoppingListCollection: updatedCollection} =
              ShoppingListCollection.createNewList({
                name: userInput.input,
                selectedMenues: menueIds,
                selectedDepartments: departmentIds,
                shoppingListCollection,
                menueplan: menuplan,
                recipes,
                products,
                materials,
                departments,
                units,
                unitConversionBasic: unitConversionBasic!,
                unitConversionProducts: unitConversionProducts!,
                authUser,
              });

            // In Supabase speichern
            const rows = shoppingListToInsertRows(newList, "", departments);
            const mealIds = getMealsOfMenues({menuplan, menues: menueIds});

            const createdHeader = await database.shoppingLists.createList(
              event.uid,
              {
                name: userInput.input,
                selectedMenues: menueIds,
                selectedMeals: mealIds,
                selectedDepartments: departmentIds,
                hasManuallyAddedItems: false,
              },
              rows,
            );

            // Optimistisches UI-Update mit der echten ID
            const finalCollection = {...updatedCollection};
            // __pending__ durch echte ID ersetzen
            if (finalCollection.lists["__pending__"]) {
              const pendingEntry = finalCollection.lists["__pending__"];
              pendingEntry.properties.uid = createdHeader.id;
              pendingEntry.trace = trace;
              finalCollection.lists[createdHeader.id] = pendingEntry;
              delete finalCollection.lists["__pending__"];
            }

            onShoppingCollectionUpdate(finalCollection);

            // Liste laden und anzeigen
            fetchMissingData({
              type: FetchMissingDataType.SHOPPING_LIST,
              objectUid: createdHeader.id,
            });
            onDispatchSetSelectedListItem(createdHeader.id);
          } catch (error) {
            if ((error as Error).toString().includes(TEXT_ERROR_NO_RECIPES_FOUND)) {
              onDispatchSnackbar("info", TEXT_ERROR_NO_RECIPES_FOUND);
            } else {
              console.error(error);
              onDispatchError(error as Error);
            }
          } finally {
            setDialogSelectMenueData(DIALOG_SELECT_MENUE_DATA_INITIAL_DATA);
            setDialogSelectDepartments(DIALOG_SELECT_DEPARTMENTS_INITIAL_DATA);
          }
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
      authUser,
      customDialog,
      database,
      fetchMissingData,
      onShoppingListUpdate,
      onShoppingCollectionUpdate,
      onDispatchLoading,
      onDispatchSetSelectedListItem,
      onDispatchError,
      onDispatchSnackbar,
      onRefreshLists,
      loadRecipesForMenues,
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
      actionEvent.stopPropagation();

      const selectedList = actionEvent.currentTarget.dataset.uid;

      if (!selectedList) {
        return;
      }

      // Optimistisches UI-Update
      const updatedCollection = ShoppingListCollection.deleteList({
        shoppingListCollection,
        listUidToDelete: selectedList,
        authUser,
      });
      onShoppingCollectionUpdate(updatedCollection);
      onDispatchSetSelectedListItem("");

      // In Supabase löschen (CASCADE entfernt Items)
      database.shoppingLists.deleteList(selectedList).catch((error) => {
        console.error(error);
        onDispatchError(error);
      });
    },
    [
      shoppingListCollection,
      authUser,
      database,
      onShoppingCollectionUpdate,
      onDispatchSetSelectedListItem,
      onDispatchError,
    ],
  );

  const onListElementEdit = React.useCallback(
    async (actionEvent: React.MouseEvent<HTMLElement>) => {
      actionEvent.stopPropagation();

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

  /* ------------------------------------------
  // Trace on-demand berechnen
  // ------------------------------------------ */

  /**
   * Berechnet den Trace on-demand für eine Liste. Verwendet den Cache,
   * falls der Trace bereits berechnet wurde.
   *
   * @param listId - ID der Einkaufsliste
   */
  const computeTraceOnDemand = React.useCallback(
    async (listId: string) => {
      const currentList = shoppingListCollection.lists[listId];
      if (!currentList) return;

      // Cache-Hit: Trace hat bereits Einträge
      if (Object.keys(currentList.trace).length > 0) return;

      const recipes = await loadRecipesForMenues(
        currentList.properties.selectedMenues,
      );

      if (!unitConversionBasic || !unitConversionProducts) return;

      const trace = ShoppingList.computeTrace({
        selectedMenues: currentList.properties.selectedMenues,
        selectedDepartments: currentList.properties.selectedDepartments,
        menueplan: menuplan,
        recipes,
        products,
        materials,
        departments,
        units,
        unitConversionBasic,
        unitConversionProducts,
        existingList: shoppingList!,
      });

      // In-Memory im Collection speichern (nicht persistiert)
      const updatedCollection: ShoppingListCollection = {
        ...shoppingListCollection,
        lists: {
          ...shoppingListCollection.lists,
          [listId]: {
            ...shoppingListCollection.lists[listId],
            trace,
          },
        },
      };
      onShoppingCollectionUpdate(updatedCollection);
    },
    [
      shoppingListCollection,
      shoppingList,
      menuplan,
      products,
      materials,
      departments,
      units,
      unitConversionBasic,
      unitConversionProducts,
      loadRecipesForMenues,
      onShoppingCollectionUpdate,
    ],
  );

  const onContextMenuClick = React.useCallback(
    async (event: React.MouseEvent<HTMLElement>) => {
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

          updatedTrace = ShoppingList.deleteTraceEntry(
            shoppingListCollection.lists[selectedListItem!].trace,
            contextMenuSelectedItem.productUid,
          );
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
          // Trace on-demand berechnen, bevor der Dialog geöffnet wird
          await computeTraceOnDemand(selectedListItem!);
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
      computeTraceOnDemand,
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
          onDispatchSnackbar(
            "info",
            TEXT_ARTICLE_ALREADY_IN_LIST(shoppingListItem.item.name),
          );

          setContextMenuSelectedItem(CONTEXT_MENU_SELECTED_ITEM_INITIAL_STATE);
          setHandleItemDialogValues(ADD_ITEM_DIALOG_INITIAL_VALUES);

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
          trace = ShoppingList.addTraceEntry({
            trace: shoppingListCollection.lists[selectedListItem!].trace,
            menueUid: "",
            recipe: {} as {uid: string; name: string},
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

      // In Supabase persistieren
      persistListItems(selectedListItem!, shoppingList!).catch((error) => {
        console.error(error);
        onDispatchError(error);
      });

      // Header aktualisieren falls nötig (hasManuallyAddedItems)
      if (collectionNeedsUpdate) {
        database.shoppingLists.updateListHeader(selectedListItem!, {
          has_manually_added_items: true,
        }).catch((error) => {
          console.error(error);
        });
      }

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
      database,
      authUser,
      onShoppingCollectionUpdate,
      onDispatchError,
      onDispatchSnackbar,
      persistListItems,
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
      !selectedListItem ||
      !shoppingListCollection.lists[selectedListItem]
    ) {
      onDispatchError(new Error(TEXT_ERROR_NO_PRODUCTS_FOUND));
      return;
    }

    return {
      shoppingListName:
        shoppingListCollection.lists[selectedListItem].properties.name,
      shoppingListSelectedTimeSlice: decodeSelectedMeals({
        selectedMeals:
          shoppingListCollection.lists[selectedListItem].properties
            .selectedMeals,
        menuplan: menuplan,
      }),
    };
  }, [shoppingListCollection, selectedListItem, menuplan, onDispatchError]);

  /* ------------------------------------------
  // Checkbox Click (granulares Update via Supabase)
  // ------------------------------------------ */
  const onCheckboxClick = React.useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const pressedCheckbox = event.target.name.split("_");
      const departmentIndex = parseInt(pressedCheckbox[1], 10);

      if (isNaN(departmentIndex) || !shoppingList?.list[departmentIndex]) {
        return;
      }

      const item = shoppingList.list[departmentIndex].items.find(
        (item: ShoppingListItem) =>
          item.item.uid == pressedCheckbox[2] &&
          item.unit == pressedCheckbox[3],
      ) as ShoppingListItem | undefined;

      if (!item) {
        return;
      }

      item.checked = !item.checked;
      onShoppingListUpdate(shoppingList);

      // Granulares Update in Supabase
      saveInProgressRef.current = true;
      if (item.supabaseId) {
        database.shoppingLists
          .updateItemChecked(item.supabaseId, item.checked)
          .then(() => {
            setTimeout(() => { saveInProgressRef.current = false; }, 500);
          })
          .catch((error) => {
            saveInProgressRef.current = false;
            console.error(error);
          });
      } else {
        // Fallback: alle Items neu speichern
        persistListItems(shoppingList.uid, shoppingList).catch((error) => {
          console.error(error);
        });
      }
    },
    [shoppingList, onShoppingListUpdate, database, persistListItems],
  );

  /* ------------------------------------------
  // Edit-Mode Item Change
  // ------------------------------------------ */
  const onChangeItem = React.useCallback(
    async (change: ItemChange) => {
      const field = change.event.target.id.split("_");
      let newItem = false;
      let itemMovedToRightDepartment = false;
      let item = shoppingList?.list[parseInt(field[1])].items.find(
        (item) => item.item.uid == field[2],
      );
      let department: Department | undefined;
      let userInput = {valid: false, input: ""} as SingleTextInputResult;

      if (!shoppingList) {
        return;
      }
      if (!item) {
        item = ShoppingList.createEmptyListItem();
        item.item.uid = field[2];
        newItem = true;
      }

      if (!newItem) {
        item.manualEdit = true;
      }

      switch (change.source) {
        case "textfield":
          item.quantity = parseFloat(change.value);
          if (newItem) {
            shoppingList.list[parseInt(field[1])].items.push(item);
          }
          break;

        case "autocompleteItem":
          if (change.reason === "clear") {
            item.item.name = "";
            break;
          }
          if (!change.value) {
            break;
          }

          if (
            typeof change.value == "object" &&
            Object.hasOwn(change.value, "uid")
          ) {
            item.item = {uid: change.value.uid, name: change.value.name};
            item.type = change.value.itemType;
          }

          if (typeof change.value === "string") {
            if (item.item.uid.length == 20) {
              item.item.uid = Utils.generateUid(10);
            }
            item.item.name = change.value;
            item.type = ItemType.custom;
          }

          department = determineItemDepartment({
            itemType: item.type,
            itemValue: change.value,
            currentDepartmentPos: parseInt(field[1]),
            departments,
          });

          if (!department) {
            department = departments.find(
              (department) => department.pos == parseInt(field[1]),
            )!;
          }
          if (!department) {
            console.error("Abteilung für Artikel nicht gefunden!");
            return;
          }

          itemMovedToRightDepartment = moveItemToDepartment({
            shoppingList,
            item,
            fromDepartmentPos: parseInt(field[1]),
            toDepartment: department,
            isNewItem: newItem,
          });

          // Duplikat-Erkennung
          if (item.item.uid.length == 20) {
            const currentItem = item;
            const existingShoppingListItem = shoppingList.list[
              department.pos
            ]?.items.find(
              (shoppingListItem) =>
                shoppingListItem !== currentItem &&
                shoppingListItem.item.uid == currentItem.item.uid &&
                shoppingListItem.unit == currentItem.unit,
            );

            if (
              existingShoppingListItem?.quantity == 0 &&
              item.quantity == 0
            ) {
              shoppingList.list[department.pos].items = shoppingList.list[
                department.pos
              ].items.filter((listItem) => listItem !== item);

              shoppingList.list = {...shoppingList.list};

              onShoppingListUpdate(shoppingList);

              onDispatchSnackbar(
                "info",
                TEXT_ARTICLE_ALREADY_IN_LIST(
                  existingShoppingListItem.item.name,
                ),
              );

              const targetId = `MoreBtn_${department.pos}_${existingShoppingListItem.item.uid}_${existingShoppingListItem.unit}`;
              setTimeout(() => {
                document
                  .getElementById(targetId)
                  ?.scrollIntoView({behavior: "smooth", block: "center"});
              }, 100);
              return;
            }

            if (existingShoppingListItem && item.quantity != 0) {
              userInput = await handleDuplicateItem({
                existingItem: existingShoppingListItem,
                newItem: item,
                customDialog,
              });

              if (!userInput.valid) {
                shoppingList.list[department.pos].items = shoppingList.list[
                  department.pos
                ].items.filter((listItem) => listItem !== item);
                return;
              }

              switch (parseInt(userInput.input) as AddItemAction) {
                case AddItemAction.ADD: {
                  const addedQuantity = item.quantity;
                  existingShoppingListItem.quantity += addedQuantity;

                  const trace = createTraceEntry({
                    shoppingListCollection,
                    selectedListItem: selectedListItem!,
                    item,
                  });
                  const tempShoppingListCollection = {
                    ...shoppingListCollection,
                  };
                  tempShoppingListCollection.lists[selectedListItem!].trace =
                    trace;
                  onShoppingCollectionUpdate(tempShoppingListCollection);
                  break;
                }
                case AddItemAction.REPLACE:
                  existingShoppingListItem.quantity = item.quantity;
                  break;
                default:
                  console.warn("ENUM unbekannt:", userInput.input);
                  return;
              }

              shoppingList.list[department.pos].items = shoppingList.list[
                department.pos
              ].items.filter((listItem) => listItem !== item);
              existingShoppingListItem.manualEdit = true;
              itemMovedToRightDepartment = false;
            }
          }
          break;

        case "autocompleteUnit":
          if (!change.value) {
            item.unit = "";
          } else {
            item.unit = change.value.key;
          }
          break;
      }

      // Collection aktualisieren
      const needsTraceUpdate = newItem && item.item.name;
      const needsManualFlag =
        selectedListItem &&
        !shoppingListCollection.lists[selectedListItem]?.properties
          .hasManuallyAddedItems &&
        (!newItem || needsTraceUpdate);

      if (needsTraceUpdate || needsManualFlag) {
        const currentEntry = shoppingListCollection.lists[selectedListItem!];
        const updatedTrace = needsTraceUpdate
          ? createTraceEntry({
              shoppingListCollection,
              selectedListItem: selectedListItem!,
              item,
            })
          : currentEntry.trace;

        const updatedCollection = {
          ...shoppingListCollection,
          lists: {
            ...shoppingListCollection.lists,
            [selectedListItem!]: {
              ...currentEntry,
              trace: updatedTrace,
              properties: {
                ...currentEntry.properties,
                hasManuallyAddedItems: true,
              },
            },
          },
        };
        onShoppingCollectionUpdate(updatedCollection);
      }

      // Neue Referenz erzeugen, damit React.memo den State-Change erkennt
      // (in-place Mutation allein löst kein Re-Render aus).
      const updatedShoppingList = {
        ...shoppingList,
        list: {...shoppingList.list},
      } as ShoppingList;
      onShoppingListUpdate(updatedShoppingList);

      if (itemMovedToRightDepartment) {
        onDispatchSnackbar(
          "info",
          TEXT_SHOPPINTLIST_ITEM_MOVED_TO_RIGHT_DEPARTMENT(
            item.item.name,
            department?.name as string,
          ),
        );
      }

      // Änderungen in Supabase persistieren
      persistListItems(updatedShoppingList.uid, updatedShoppingList).catch(
        (error) => {
          console.error(error);
        },
      );

      // Header aktualisieren falls nötig (hasManuallyAddedItems)
      if (
        needsManualFlag &&
        selectedListItem &&
        !shoppingListCollection.lists[selectedListItem]?.properties
          .hasManuallyAddedItems
      ) {
        database.shoppingLists
          .updateListHeader(selectedListItem, {
            has_manually_added_items: true,
          })
          .catch((error) => {
            console.error(error);
          });
      }
    },
    [
      shoppingList,
      shoppingListCollection,
      selectedListItem,
      departments,
      customDialog,
      database,
      onShoppingListUpdate,
      onShoppingCollectionUpdate,
      onDispatchSnackbar,
      persistListItems,
    ],
  );

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
    // Operations (from old useShoppingListOperations)
    onCheckboxClick,
    onChangeItem,
  };
};

export default useShoppingListHandlers;
