/**
 * Konsolidierter Hook für alle Materiallisten-Operationen.
 *
 * Verwendet Supabase (via `useDatabase()`) statt Firebase für Persistenz.
 * Gibt alle Handler-Funktionen zurück, die von materialList.tsx benötigt
 * werden (Create, Refresh, Checkbox, Inline-Edit, Context-Menu, Trace, PDF, CRUD).
 *
 * @example
 * const {dialogSelectMenueData, onCreateList, onCheckboxClick, ...} =
 *   useMaterialListHandlers({...});
 */
import React from "react";
import {AlertColor} from "@mui/material";
import * as Sentry from "@sentry/react";
import {generateAndDownloadPdf} from "../../Shared/pdfUtils";
import {
  DialogSelectMenuesForRecipeDialogValues,
  decodeSelectedMeals,
} from "../Menuplan/dialogSelectMenues";
import {OperationType} from "../Event/eventSharedComponents";
import Material, {MaterialType} from "../../Material/material.class";
import AuthUser from "../../Firebase/Authentication/authUser.class";
import Event, {Cook} from "../Event/event.class";
import {
  Menue,
  MenueCoordinates,
  MenuplanData,
} from "../Menuplan/menuplan.types";
import {getMealsOfMenues, getMenuesOfMeals, sortSelectedMenues} from "../Menuplan/menuplanService";
import {MaterialList,
  MaterialListEntry,
  MaterialListMaterial,
} from "./materialList.class";
import {
  materialListItemsToInsertRows,
  headersDomainToMaterialList,
  itemsDomainToMaterialListItems,
} from "./materialListAdapter";
import Recipe, {Recipes} from "../../Recipe/recipe.class";
import Action from "../../../constants/actions";
import Utils from "../../Shared/utils.class";
import {
  DialogType,
  SingleTextInputResult,
  useCustomDialog,
} from "../../Shared/customDialogContext";
import {FetchMissingDataProps, FetchMissingDataType} from "../Event/event";
import {
  NEW_LIST as TEXT_NEW_LIST,
  GIVE_THE_NEW_LIST_A_NAME as TEXT_GIVE_THE_NEW_LIST_A_NAME,
  NAME as TEXT_NAME,
  DELETE as TEXT_DELETE,
  KEEP_MANUALLY_ADDED_PRODUCTS as TEXT_KEEP_MANUALLY_ADDED_PRODUCTS,
  MANUALLY_ADDED_PRODUCTS as TEXT_MANUALLY_ADDED_PRODUCTS,
  KEEP as TEXT_KEEP,
  MATERIAL_LIST as TEXT_MATERIAL_LIST,
  SUFFIX_PDF as TEXT_SUFFIX_PDF,
  ERROR_NO_MATERIALS_FOUND as TEXT_ERROR_NO_MATERIALS_FOUND,
  ERROR_NO_RECIPES_FOUND as TEXT_ERROR_NO_RECIPES_FOUND,
} from "../../../constants/text";
import {useDatabase} from "../../Database/DatabaseContext";
import {MaterialListEditSource} from "../../Database/Repository/MaterialListRepository";
import {UsedRecipes} from "../UsedRecipes/usedRecipes.class";
import {ProductTrace} from "../ShoppingList/shoppingListCollection.class";
import {ItemType} from "../ShoppingList/shoppingList.class";
import {MaterialListPdf} from "./materialListPdf";


export interface ContextMenuSelectedItemProps {
  anchor: HTMLElement | null;
  materialUid: Material["uid"];
}

export const CONTEXT_MENU_SELECTED_ITEM_INITIAL_STATE: ContextMenuSelectedItemProps = {
  anchor: null,
  materialUid: "",
};

export const DIALOG_SELECT_MENUE_DATA_INITIAL_DATA = {
  open: false,
  menues: {} as DialogSelectMenuesForRecipeDialogValues,
  selectedListUid: "",
  operationType: OperationType.none,
};

export const ADD_MATERIAL_DIALOG_INITIAL_VALUES = {
  open: false,
  material: {} as Material,
  quantity: "",
};

export const TRACE_ITEM_DIALOG_INITIAL_VALUES = {
  open: false,
  sortedMenues: [] as MenueCoordinates[],
  trace: [] as ProductTrace[],
  hasBeenManuallyEdited: false,
};


interface UseMaterialListHandlersProps {
  authUser: AuthUser;
  event: Event;
  menuplan: MenuplanData;
  materials: Material[];
  recipes: Recipes;
  materialList: MaterialList;
  selectedListItem: string | null;
  saveInProgressRef: React.MutableRefObject<boolean>;
  fetchMissingData: ({type}: FetchMissingDataProps) => void;
  onMaterialListUpdate: (materialList: MaterialList) => void;
  onSelectList: (listUid: string) => void;
  onDispatchLoading: (isLoading: boolean) => void;
  onDispatchError: (error: Error) => void;
  onDispatchSnackbar: (severity: AlertColor, message: string) => void;
}


/**
 * Hook für alle Materiallisten-Operationen.
 *
 * Kapselt Dialog-States, Handler für Create/Refresh/Delete/Edit/Checkbox/
 * Inline-Edit/Trace/PDF und persistiert via Supabase Repository.
 */
export function useMaterialListHandlers({
  authUser,
  event,
  menuplan,
  materials,
  recipes,
  materialList,
  selectedListItem,
  saveInProgressRef,
  fetchMissingData,
  onMaterialListUpdate,
  onSelectList,
  onDispatchLoading,
  onDispatchError,
  onDispatchSnackbar,
}: UseMaterialListHandlersProps) {
  const database = useDatabase();
  const {customDialog} = useCustomDialog();

  // Dialog-States
  const [dialogSelectMenueData, setDialogSelectMenueData] = React.useState(
    DIALOG_SELECT_MENUE_DATA_INITIAL_DATA,
  );
  const [contextMenuSelectedItem, setContextMenuSelectedItem] = React.useState(
    CONTEXT_MENU_SELECTED_ITEM_INITIAL_STATE,
  );
  const [handleMaterialDialogValues, setHandleMaterialDialogValues] =
    React.useState(ADD_MATERIAL_DIALOG_INITIAL_VALUES);
  const [traceItemDialogValues, setTraceItemDialogValues] = React.useState(
    TRACE_ITEM_DIALOG_INITIAL_VALUES,
  );

  /* ------------------------------------------
  // Rezepte für Menüs laden (Supabase)
  // ------------------------------------------ */
  const loadRecipesForMenues = React.useCallback(
    async (selectedMenues: Menue["uid"][]): Promise<{[key: string]: Recipe}> => {
      const recipeList = UsedRecipes.defineSelectedRecipes({
        selectedMenues,
        menueplan: menuplan,
      });

      if (recipeList.length === 0) return {};

      const uniqueRecipeIds = [...new Set(recipeList.map((recipeEntry) => recipeEntry.uid))];
      const recipeMap: {[key: string]: Recipe} = {};

      await Promise.all(
        uniqueRecipeIds.map(async (recipeId) => {
          // Bereits geladenes Rezept wiederverwenden
          if (recipes[recipeId]?.portions > 0) {
            recipeMap[recipeId] = recipes[recipeId] as Recipe;
            return;
          }

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
    [menuplan, recipes, database],
  );

  /* ------------------------------------------
  // Persistenz: Items speichern
  // ------------------------------------------ */
  const persistListItems = React.useCallback(
    async (listId: string, items: MaterialListMaterial[]) => {
      saveInProgressRef.current = true;
      try {
        const insertRows = materialListItemsToInsertRows(items, listId, materials);
        await database.materialLists.saveListItems(listId, insertRows);
      } catch (error) {
        Sentry.captureException(error);
        onDispatchError(error instanceof Error ? error : new Error(String(error)));
      } finally {
        saveInProgressRef.current = false;
      }
    },
    [database, saveInProgressRef, onDispatchError],
  );

  const persistCollectionHeader = React.useCallback(
    async (
      listId: string,
      updates: Partial<{
        name: string;
        selected_menues: string[];
        selected_meals: string[];
        has_manually_added_items: boolean;
      }>,
    ) => {
      try {
        await database.materialLists.updateListHeader(listId, updates);
      } catch (error) {
        Sentry.captureException(error);
        onDispatchError(error instanceof Error ? error : new Error(String(error)));
      }
    },
    [database, onDispatchError],
  );

  /* ------------------------------------------
  // Dialog: Menü-Auswahl öffnen
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

  /* ------------------------------------------
  // Dialog: Menü-Auswahl bestätigen
  // ------------------------------------------ */
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
                ?.properties.name ?? ""
            : "",
        textInputLabel: TEXT_NAME,
      },
    })) as SingleTextInputResult;

    if (userInput.valid) {
      onDispatchLoading(true);

      if (dialogSelectMenueData.operationType === OperationType.Create) {
        try {
          const menueKeys = Object.keys(selectedMenues);
          const loadedRecipes = await loadRecipesForMenues(menueKeys);

          const listEntry = MaterialList.createNewList({
            name: userInput.input,
            selectedMenues: menueKeys,
            menueplan: menuplan,
            materials: materials,
            recipes: loadedRecipes,
          });

          // In Supabase persistieren
          const insertRows = materialListItemsToInsertRows(
            listEntry.items,
            "__pending__",
            materials,
          );
          const header = await database.materialLists.createList(
            event.uid,
            {
              name: listEntry.properties.name,
              selectedMenues: listEntry.properties.selectedMenues,
              selectedMeals: listEntry.properties.selectedMeals,
              hasManuallyAddedItems: false,
            },
            insertRows,
          );

          // Optimistisch: lokalen State aktualisieren
          listEntry.properties.uid = header.id;
          const updatedMaterialList = {...materialList};
          updatedMaterialList.lists[header.id] = listEntry;
          updatedMaterialList.uid = event.uid;
          onMaterialListUpdate(updatedMaterialList);
          // Neu erstellte Liste direkt auswählen
          onSelectList(header.id);
          onDispatchLoading(false);
        } catch (error) {
          Sentry.captureException(error);
          onDispatchError(error instanceof Error ? error : new Error(String(error)));
        }
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
  // Listen aktualisieren (Refresh)
  // ------------------------------------------ */
  const onRefreshLists = async (
    newName?: string,
    selectedMenues?: Menue["uid"][],
  ) => {
    if (!selectedListItem) return;

    let keepManuallyAddedItems = false;

    // Prüfen ob manuell hinzugefügte Items vorhanden sind
    if (
      materialList.lists[selectedListItem]?.items.some(
        (material) => material.manualAdd === true,
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

      if (!userInput.valid) return;
      keepManuallyAddedItems = userInput.input === Action.KEEP;
    }

    onDispatchLoading(true);

    try {
      const materialListToRefresh = JSON.parse(JSON.stringify(materialList)) as MaterialList;

      if (dialogSelectMenueData.operationType === OperationType.Update) {
        materialListToRefresh.lists[
          dialogSelectMenueData.selectedListUid
        ].properties.name = newName!;
        materialListToRefresh.lists[
          dialogSelectMenueData.selectedListUid
        ].properties.selectedMenues = selectedMenues!;
        materialListToRefresh.lists[
          dialogSelectMenueData.selectedListUid
        ].properties.selectedMeals = getMealsOfMenues({
          menuplan: menuplan,
          menues: selectedMenues!,
        });
        setDialogSelectMenueData(DIALOG_SELECT_MENUE_DATA_INITIAL_DATA);
      }

      const listProps = materialListToRefresh.lists[selectedListItem].properties;
      const allMenuesForMeals = getMenuesOfMeals({
        menuplan: menuplan,
        meals: listProps.selectedMeals,
      });
      const loadedRecipes = await loadRecipesForMenues(allMenuesForMeals);

      const result = MaterialList.refreshList({
        listUidToRefresh: selectedListItem,
        materialList: materialListToRefresh,
        keepManuallyAddedItems,
        menueplan: menuplan,
        materials: materials,
        recipes: loadedRecipes,
      });

      // In Supabase persistieren
      const refreshedList = result.lists[selectedListItem];
      await persistListItems(selectedListItem, refreshedList.items);
      await persistCollectionHeader(selectedListItem, {
        name: refreshedList.properties.name,
        selected_menues: refreshedList.properties.selectedMenues,
        selected_meals: refreshedList.properties.selectedMeals,
        has_manually_added_items: refreshedList.items.some(
          (item) => item.manualAdd === true,
        ),
      });

      onMaterialListUpdate(result);
      onDispatchLoading(false);
    } catch (error) {
      Sentry.captureException(error);
      onDispatchError(error instanceof Error ? error : new Error(String(error)));
    }
  };

  /* ------------------------------------------
  // Checkbox umschalten
  // ------------------------------------------ */
  const onCheckboxClick = React.useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      if (!selectedListItem) return;

      const pressedCheckbox = event.target.name.split("_");
      const materialUid = pressedCheckbox[1];
      const items = materialList.lists[selectedListItem]?.items;
      if (!items) return;

      const material = items.find((candidate) => candidate.uid === materialUid);
      if (!material) return;

      material.checked = !material.checked;
      onMaterialListUpdate(JSON.parse(JSON.stringify(materialList)) as MaterialList);

      // Granulares Update in Supabase
      if (material.supabaseId) {
        database.materialLists
          .updateItemChecked(material.supabaseId, material.checked)
          .catch((err) => {
            Sentry.captureException(err);
          });
      }
    },
    [materialList, selectedListItem, onMaterialListUpdate, database],
  );

  /* ------------------------------------------
  // Kontext-Menü
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
    setContextMenuSelectedItem(CONTEXT_MENU_SELECTED_ITEM_INITIAL_STATE);
  }, []);

  const onContextMenuClick = React.useCallback(
    (event: React.MouseEvent<HTMLElement>) => {
      if (!selectedListItem) return;

      const action = event.currentTarget.dataset.action;
      let material: Material | undefined;
      let quantity: number | undefined;

      switch (action) {
        case Action.EDIT:
          material = materials.find(
            (candidate) => candidate.uid === contextMenuSelectedItem.materialUid,
          );

          if (!material) {
            // Freitext-Eintrag: Material aus der Liste rekonstruieren
            const listItem = materialList.lists[selectedListItem]?.items.find(
              (item) => item.uid === contextMenuSelectedItem.materialUid,
            );
            if (!listItem) return;
            material = {
              uid: listItem.uid,
              name: listItem.name,
              type: listItem.type,
              usable: true,
            } as Material;
          }

          quantity = materialList.lists[selectedListItem]?.items.find(
            (candidate) => candidate.uid === contextMenuSelectedItem.materialUid,
          )?.quantity;

          setHandleMaterialDialogValues({
            open: true,
            material: material,
            quantity: quantity ? quantity.toString() : "",
          });
          break;

        case Action.DELETE: {
          const items = materialList.lists[selectedListItem]?.items;
          if (!items) break;

          const itemToDelete = items.find(
            (candidate) => candidate.uid === contextMenuSelectedItem.materialUid,
          );

          materialList.lists[selectedListItem].items =
            MaterialList.deleteMaterialFromList({
              list: items,
              materialUid: contextMenuSelectedItem.materialUid,
            });
          onMaterialListUpdate(JSON.parse(JSON.stringify(materialList)) as MaterialList);

          // Persistieren
          persistListItems(
            selectedListItem,
            materialList.lists[selectedListItem].items,
          );
          break;
        }
        case Action.TRACE: {
          // Trace on-demand berechnen
          const listProps = materialList.lists[selectedListItem]?.properties;
          const item = materialList.lists[selectedListItem]?.items.find(
            (candidate) => candidate.uid === contextMenuSelectedItem.materialUid,
          );

          // In-memory Trace vorhanden? (nach createNewList/refresh)
          let traceData = item?.trace ?? [];

          // Synthetischen Trace für manuell hinzugefügte Items erzeugen
          const manualTrace: ProductTrace[] = item?.manualAdd
            ? [{
                menueUid: "",
                recipe: {uid: "", name: ""},
                planedPortions: 0,
                quantity: item.quantity,
                unit: "",
                manualAdd: true,
                itemType: ItemType.material,
              }]
            : [];

          if (traceData.length === 0 && !item?.manualAdd && listProps) {
            // On-demand berechnen: Rezepte laden und Trace erstellen
            const capturedMaterialUid = contextMenuSelectedItem.materialUid;
            loadRecipesForMenues(listProps.selectedMenues).then((loadedRecipes) => {
              const computed = MaterialList.computeTrace({
                materialUid: capturedMaterialUid,
                selectedMenues: listProps.selectedMenues,
                menueplan: menuplan,
                materials: materials,
                recipes: loadedRecipes,
              });
              setTraceItemDialogValues({
                open: true,
                sortedMenues: sortSelectedMenues({
                  menueList: listProps.selectedMenues,
                  menuplan: menuplan,
                }),
                trace: computed,
                hasBeenManuallyEdited: Boolean(item?.manualEdit),
              });
            });
          } else {
            setTraceItemDialogValues({
              open: true,
              sortedMenues: sortSelectedMenues({
                menueList: listProps?.selectedMenues ?? [],
                menuplan: menuplan,
              }),
              trace: traceData.length > 0 ? traceData : manualTrace,
              hasBeenManuallyEdited: Boolean(item?.manualEdit),
            });
          }

          setContextMenuSelectedItem({
            ...contextMenuSelectedItem,
            anchor: null,
          });
          return;
        }
      }
      setContextMenuSelectedItem(CONTEXT_MENU_SELECTED_ITEM_INITIAL_STATE);
    },
    [
      materials,
      materialList,
      selectedListItem,
      contextMenuSelectedItem,
      menuplan,
      onMaterialListUpdate,
      persistListItems,
    ],
  );

  /* ------------------------------------------
  // Inline-Change-Handler
  // ------------------------------------------ */
  const onChangeItem = React.useCallback(
    (change: import("./materialList").MaterialItemChange) => {
      if (!selectedListItem) return;

      const field = change.event.target.id.split("_");
      const materialUid = field[1];
      const items = materialList.lists[selectedListItem]?.items;
      if (!items) return;

      let item = items.find((existingItem) => existingItem.uid === materialUid);
      let isNewItem = false;

      if (!item) {
        item = {
          checked: false,
          name: "",
          uid: materialUid,
          type: MaterialType.usage,
          quantity: 0,
          trace: [],
          manualAdd: true,
        };
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
            if (item.uid.length === 20) {
              item.uid = Utils.generateUid(10);
            }
            item.name = change.value.trim();
            item.type = MaterialType.usage;
          } else if (change.value.name.endsWith("hinzufügen»")) {
            return;
          } else {
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

      // Tiefe Kopie für React State-Update (memo-safe)
      const updatedList = JSON.parse(JSON.stringify(materialList)) as MaterialList;
      onMaterialListUpdate(updatedList);

      // Persistieren: Für neue Items ein INSERT, für bestehende ein granulares UPDATE.
      if (isNewItem && change.source === "autocompleteMaterial" && item.name) {
        // Neues Item erst persistieren wenn ein Material ausgewählt wurde
        const rows = materialListItemsToInsertRows([item], selectedListItem, materials);
        if (rows.length > 0) {
          saveInProgressRef.current = true;
          database.materialLists
            .insertItem(selectedListItem, rows[0])
            .catch((err) => Sentry.captureException(err))
            .finally(() => { saveInProgressRef.current = false; });
        }
      } else if (!isNewItem && item.supabaseId) {
        // Granulares Update für bestehendes Item
        const updates: Partial<{
          quantity: number;
          edit_source: MaterialListEditSource;
          material_id: string | null;
          free_text_name: string | null;
        }> = {};
        if (change.source === "textfield") {
          updates.quantity = item.quantity;
          updates.edit_source = "manual_edit";
        } else {
          // Material-Wechsel: material_id oder free_text_name updaten
          const knownMaterial = materials.find((candidate) => candidate.uid === item!.uid);
          if (knownMaterial) {
            updates.material_id = item.uid;
            updates.free_text_name = null;
          } else {
            updates.material_id = null;
            updates.free_text_name = item.name;
          }
          updates.edit_source = "manual_edit";
        }
        database.materialLists
          .updateItem(item.supabaseId, updates)
          .catch((err) => Sentry.captureException(err));
      }
    },
    [materialList, selectedListItem, onMaterialListUpdate, materials, database, saveInProgressRef],
  );

  /* ------------------------------------------
  // Listen-Element: Auswahl / Löschen / Bearbeiten
  // ------------------------------------------ */
  const onListElementDelete = React.useCallback(
    async (event: React.MouseEvent<HTMLElement>) => {
      event.stopPropagation();
      const listUid = event.currentTarget.dataset.uid;
      if (!listUid) return;

      try {
        await database.materialLists.deleteList(listUid);
        const updatedMaterialList = MaterialList.deleteList({
          materialList: materialList,
          listUidToDelete: listUid,
        });
        onMaterialListUpdate(updatedMaterialList);
      } catch (error) {
        Sentry.captureException(error);
        onDispatchError(error instanceof Error ? error : new Error(String(error)));
      }
    },
    [materialList, onMaterialListUpdate, database, onDispatchError],
  );

  const onListElementEdit = React.useCallback(
    async (event: React.MouseEvent<HTMLElement>) => {
      event.stopPropagation();
      const selectedListUid = event.currentTarget.dataset.uid;
      if (!selectedListUid) return;

      const selectedMenuesForDialog: DialogSelectMenuesForRecipeDialogValues = {};

      let selectedMenues =
        materialList.lists[selectedListUid]?.properties.selectedMenues ?? [];

      // Drift-Erkennung
      if (
        !Utils.areStringArraysEqual(
          materialList.lists[selectedListUid]?.properties.selectedMeals ?? [],
          getMealsOfMenues({
            menuplan: menuplan,
            menues: selectedMenues,
          }),
        ) ||
        selectedMenues.length !==
          getMenuesOfMeals({
            menuplan: menuplan,
            meals: materialList.lists[selectedListUid]?.properties.selectedMeals ?? [],
          }).length
      ) {
        selectedMenues = getMenuesOfMeals({
          menuplan: menuplan,
          meals: materialList.lists[selectedListUid]?.properties.selectedMeals ?? [],
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
  // Artikel-Dialog (Kontext-Menü EDIT + ADD)
  // ------------------------------------------ */
  const onAddMaterialDialogClose = React.useCallback(() => {
    setHandleMaterialDialogValues(ADD_MATERIAL_DIALOG_INITIAL_VALUES);
  }, []);

  const onAddMaterialDialogAdd = React.useCallback(
    ({material, quantity}: {material: Material; quantity: number}) => {
      if (!selectedListItem) return;

      if (!handleMaterialDialogValues.material.uid) {
        // Neues Material hinzufügen
        materialList.lists[selectedListItem].items =
          MaterialList.addMaterialToList({
            material: material,
            list: materialList.lists[selectedListItem].items,
            quantity: quantity,
            planedPortions: 0,
            manualAdd: true,
          });
      } else {
        // Bestehendes Material bearbeiten
        const materialInList = materialList.lists[selectedListItem].items.find(
          (candidate) => candidate.uid === material.uid,
        );
        if (!materialInList) return;
        materialInList.quantity = quantity;
        materialInList.manualEdit = true;
      }

      onMaterialListUpdate(JSON.parse(JSON.stringify(materialList)) as MaterialList);
      persistListItems(
        selectedListItem,
        materialList.lists[selectedListItem].items,
      );
      setHandleMaterialDialogValues(ADD_MATERIAL_DIALOG_INITIAL_VALUES);
    },
    [
      handleMaterialDialogValues.material.uid,
      materialList,
      selectedListItem,
      onMaterialListUpdate,
      persistListItems,
    ],
  );

  /* ------------------------------------------
  // Trace Dialog
  // ------------------------------------------ */
  const onDialogTraceItemClose = React.useCallback(() => {
    setTraceItemDialogValues((prev) => ({...prev, open: false}));
  }, []);

  /**
   * Berechnet den Trace on-demand für das aktuell ausgewählte Material.
   */
  const computeTraceOnDemand = React.useCallback(async (): Promise<ProductTrace[]> => {
    if (!selectedListItem || !contextMenuSelectedItem.materialUid) return [];

    const listProps = materialList.lists[selectedListItem]?.properties;
    if (!listProps) return [];

    try {
      const loadedRecipes = await loadRecipesForMenues(listProps.selectedMenues);

      return MaterialList.computeTrace({
        materialUid: contextMenuSelectedItem.materialUid,
        selectedMenues: listProps.selectedMenues,
        menueplan: menuplan,
        materials: materials,
        recipes: loadedRecipes,
      });
    } catch (error) {
      Sentry.captureException(error);
      return [];
    }
  }, [
    selectedListItem,
    contextMenuSelectedItem.materialUid,
    materialList,
    menuplan,
    materials,
    loadRecipesForMenues,
  ]);

  /* ------------------------------------------
  // PDF erzeugen
  // ------------------------------------------ */
  const onGeneratePrintVersion = React.useCallback(() => {
    if (!selectedListItem) return;

    const items = materialList.lists[selectedListItem]?.items;
    if (!items || items.length === 0) {
      onDispatchError(new Error(TEXT_ERROR_NO_MATERIALS_FOUND));
      return;
    }

    generateAndDownloadPdf(
      <MaterialListPdf
        materialList={materialList.lists[selectedListItem]}
        materialListSelectedTimeSlice={decodeSelectedMeals({
          selectedMeals:
            materialList.lists[selectedListItem].properties.selectedMenues,
          menuplan: menuplan,
        })}
        eventName={event.name}
        authUser={authUser}
      />,
      event.name + " " + TEXT_MATERIAL_LIST + TEXT_SUFFIX_PDF,
      (error) => onDispatchError(error),
      {eventUid: event.uid},
    );
  }, [materialList, selectedListItem, menuplan, event.name, authUser, onDispatchError]);

  /* ------------------------------------------
  // Cook-Zuordnung ändern
  // ------------------------------------------ */
  const onAssignedCookChange = React.useCallback(
    (itemUid: string, cookId: string | null, cookName: string | null) => {
      if (!selectedListItem) return;

      const items = materialList.lists[selectedListItem]?.items;
      if (!items) return;

      const item = items.find((material) => material.uid === itemUid);
      if (!item) return;

      item.assignedCookId = cookId;
      item.assignedCookName = cookName;
      item.resolvedCookName = cookName;
      onMaterialListUpdate(JSON.parse(JSON.stringify(materialList)) as MaterialList);

      // Granulares Update in Supabase
      if (item.supabaseId) {
        database.materialLists
          .updateItem(item.supabaseId, {
            assigned_cook_id: cookId,
            assigned_cook_name: cookId ? null : cookName,
          })
          .catch((err) => {
            Sentry.captureException(err);
          });
      }
    },
    [materialList, selectedListItem, onMaterialListUpdate, database],
  );

  return {
    // Dialog-States
    dialogSelectMenueData,
    contextMenuSelectedItem,
    handleMaterialDialogValues,
    traceItemDialogValues,
    // Dialog-Handler
    onCreateList,
    onCloseDialogSelectMenues,
    onConfirmDialogSelectMenues,
    // Kontext-Menü
    onOpenContextMenu,
    onCloseContextMenu,
    onContextMenuClick,
    // List-Operationen
    onRefreshLists,
    onListElementDelete,
    onListElementEdit,
    // Item-Operationen
    onCheckboxClick,
    onChangeItem,
    // Artikel-Dialog
    onAddMaterialDialogClose,
    onAddMaterialDialogAdd,
    // Trace
    onDialogTraceItemClose,
    computeTraceOnDemand,
    // PDF
    onGeneratePrintVersion,
    // Koch-Zuordnung
    onAssignedCookChange,
  };
}
