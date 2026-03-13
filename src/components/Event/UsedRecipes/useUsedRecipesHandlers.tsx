/**
 * Custom Hook, der alle Handler und State-Management-Logik der
 * UsedRecipes-Seite bündelt.
 *
 * Extrahiert Reducer, Dialog-State, Navigation-Effekte, Datenladen und
 * sämtliche Event-Handler aus EventUsedRecipesPage, damit die Komponente
 * nur noch für Rendering zuständig ist.
 *
 * @param params - Konfiguration mit Event-Daten, Menüplan und Callbacks
 * @returns State, Dialog-Daten und alle Handler-Funktionen
 *
 * @example
 * const {state, dialogSelectMenueData, handlers} = useUsedRecipesHandlers({...});
 * <EventListCard onCreateList={handlers.onCreateList} ... />
 */
import React, {useCallback} from "react";
import {pdf} from "@react-pdf/renderer";
import fileSaver from "file-saver";

import {
  SUFFIX_PDF as TEXT_SUFFIX_PDF,
  QUANTITY_CALCULATION as TEXT_QUANTITY_CALCULATION,
  NAME as TEXT_NAME,
  NEW_LIST as TEXT_NEW_LIST,
  GIVE_THE_NEW_LIST_A_NAME as TEXT_GIVE_THE_NEW_LIST_A_NAME,
  ERROR_NO_RECIPES_FOUND as TEXT_ERROR_NO_RECIPES_FOUND,
} from "../../../constants/text";

import AuthUser from "../../Firebase/Authentication/authUser.class";
import {useDatabase} from "../../Database/DatabaseContext";
import Event from "../Event/event.class";
import {
  DialogSelectMenuesForRecipeDialogValues,
} from "../Menuplan/dialogSelectMenues";
import {Menue, MenuplanData} from "../Menuplan/menuplan.types";
import {getMealsOfMenues, sortSelectedMenues} from "../Menuplan/menuplanService";
import UsedRecipes from "./usedRecipes.class";
import {
  DialogType,
  SingleTextInputResult,
  useCustomDialog,
} from "../../Shared/customDialogContext";
import Recipe from "../../Recipe/recipe.class";
import UsedRecipesPdf from "./usedRecipesPdf";
import {
  NavigationValuesContext,
  NavigationObject,
} from "../../Navigation/navigationContext";
import Action from "../../../constants/actions";
import {FetchMissingDataProps, FetchMissingDataType} from "../Event/event";
import {OperationType} from "../Event/eventSharedComponents";
import {useEventMasterData} from "../Event/eventMasterDataContext";
import {
  ReducerActions,
  State,
  initialState,
  usedRecipesReducer,
  DialogSelectMenueDataType,
  DIALOG_SELECT_MENUE_DATA_INITIAL_DATA,
} from "./usedRecipesReducer";

/* ===================================================================
// ========================== Interfaces =============================
// =================================================================== */

export interface UseUsedRecipesHandlersParams {
  authUser: AuthUser;
  event: Event;
  menuplan: MenuplanData;
  usedRecipes: UsedRecipes;
  fetchMissingData: (props: FetchMissingDataProps) => void;
  onUsedRecipesUpdate: (usedRecipes: UsedRecipes) => void;
}

export interface UseUsedRecipesHandlersReturn {
  state: State;
  dialogSelectMenueData: DialogSelectMenueDataType;
  handlers: {
    onCreateList: () => void;
    onCloseDialogSelectMenues: () => void;
    onConfirmDialogSelectMenues: (
      menues: DialogSelectMenuesForRecipeDialogValues,
    ) => Promise<void>;
    onRefreshLists: () => void;
    onListElementSelect: (
      event: React.MouseEvent<HTMLElement, MouseEvent>,
    ) => void;
    onListElementDelete: (event: React.MouseEvent<HTMLElement>) => void;
    onListElementEdit: (event: React.MouseEvent<HTMLElement>) => void;
    onGeneratePrintVersion: () => void;
  };
}

/* ===================================================================
// ============================== Hook ===============================
// =================================================================== */

export const useUsedRecipesHandlers = ({
  authUser,
  event,
  menuplan,
  usedRecipes,
  fetchMissingData,
  onUsedRecipesUpdate,
}: UseUsedRecipesHandlersParams): UseUsedRecipesHandlersReturn => {
  const database = useDatabase();
  const {products, units, unitConversionBasic, unitConversionProducts} =
    useEventMasterData();
  const navigationValuesContext = React.useContext(NavigationValuesContext);
  const {customDialog} = useCustomDialog();

  const [state, dispatch] = React.useReducer(usedRecipesReducer, initialState);
  const [dialogSelectMenueData, setDialogSelectMenueData] =
    React.useState<DialogSelectMenueDataType>(
      DIALOG_SELECT_MENUE_DATA_INITIAL_DATA,
    );

  /* ------------------------------------------
  // Navigation-Handler
  // ------------------------------------------ */
  React.useEffect(() => {
    navigationValuesContext?.setNavigationValues({
      action: Action.NONE,
      object: NavigationObject.usedRecipes,
    });
  }, []);

  // Fehlende Stammdaten nachladen
  React.useEffect(() => {
    if (products.length == 0) {
      fetchMissingData({type: FetchMissingDataType.PRODUCTS});
    }
    if (!unitConversionBasic || !unitConversionProducts) {
      fetchMissingData({type: FetchMissingDataType.UNIT_CONVERSION});
    }
    if (!units || units.length == 0) {
      fetchMissingData({type: FetchMissingDataType.UNITS});
    }
  }, []);

  /* ------------------------------------------
  // Rezepte laden
  // ------------------------------------------ */

  /**
   * Lädt die vollständigen Rezept-Objekte für eine Liste (RPC + Repository).
   */
  const loadRecipesForList = useCallback(
    async (listId: string) => {
      dispatch({
        type: ReducerActions.SHOW_LOADING,
        payload: {isLoading: true},
      });

      try {
        // Rezept-IDs aus dem Menüplan ableiten (RPC)
        const recipeRefs =
          await database.usedRecipeLists.getRecipesForList(listId);
        const uniqueRecipeIds = [
          ...new Set(
            recipeRefs.map((r) => r.recipeId).filter((id) => id !== ""),
          ),
        ];

        if (uniqueRecipeIds.length === 0) {
          dispatch({
            type: ReducerActions.RECIPES_LOADED,
            payload: {recipes: {}},
          });
          return;
        }

        // Vollständige Rezepte parallel laden (Header + Zutaten + Schritte + Material)
        const recipeMap: Record<string, Recipe> = {};
        await Promise.all(
          uniqueRecipeIds.map(async (recipeId) => {
            const [header, ingredients, steps, materials] = await Promise.all([
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
                materials,
              );
            }
          }),
        );

        dispatch({
          type: ReducerActions.RECIPES_LOADED,
          payload: {recipes: recipeMap},
        });
      } catch (error) {
        dispatch({
          type: ReducerActions.GENERIC_ERROR,
          payload: error as Error,
        });
      }
    },
    [database],
  );

  /* ------------------------------------------
  // Listen-Update
  // ------------------------------------------ */

  /**
   * Aktualisiert Name und Menü-Auswahl einer bestehenden Liste.
   */
  const onUpdateList = useCallback(
    (newName: string, newSelectedMenues: Menue["uid"][]) => {
      const listId = dialogSelectMenueData.selectedListUid;
      dispatch({
        type: ReducerActions.SHOW_LOADING,
        payload: {isLoading: true},
      });
      setDialogSelectMenueData(DIALOG_SELECT_MENUE_DATA_INITIAL_DATA);

      // Optimistisches UI-Update
      const updatedUsedRecipes = {...usedRecipes};
      updatedUsedRecipes.lists = {...updatedUsedRecipes.lists};
      updatedUsedRecipes.lists[listId] = {
        ...updatedUsedRecipes.lists[listId],
        properties: {
          ...updatedUsedRecipes.lists[listId].properties,
          name: newName,
          selectedMenues: newSelectedMenues,
          selectedMeals: getMealsOfMenues({
            menuplan: menuplan,
            menues: newSelectedMenues,
          }),
        },
      };
      onUsedRecipesUpdate(updatedUsedRecipes);

      Promise.all([
        database.usedRecipeLists.updateListName(listId, newName),
        database.usedRecipeLists.updateListMenues(listId, newSelectedMenues),
      ])
        .then(() => {
          dispatch({
            type: ReducerActions.SHOW_LOADING,
            payload: {isLoading: false},
          });
        })
        .catch((error) => {
          dispatch({type: ReducerActions.GENERIC_ERROR, payload: error});
        });
    },
    [
      dialogSelectMenueData.selectedListUid,
      usedRecipes,
      menuplan,
      onUsedRecipesUpdate,
      database,
    ],
  );

  /* ------------------------------------------
  // Dialog-Handling
  // ------------------------------------------ */

  const onCreateList = useCallback(() => {
    setDialogSelectMenueData((prev) => ({
      ...prev,
      open: true,
      operationType: OperationType.Create,
    }));
  }, []);

  const onCloseDialogSelectMenues = useCallback(() => {
    setDialogSelectMenueData(DIALOG_SELECT_MENUE_DATA_INITIAL_DATA);
  }, []);

  const onConfirmDialogSelectMenues = useCallback(
    async (selectedMenues: DialogSelectMenuesForRecipeDialogValues) => {
      setDialogSelectMenueData((prev) => ({...prev, open: false}));

      const userInput = (await customDialog({
        dialogType: DialogType.SingleTextInput,
        title: TEXT_NEW_LIST,
        text: TEXT_GIVE_THE_NEW_LIST_A_NAME,
        singleTextInputProperties: {
          initialValue:
            dialogSelectMenueData.operationType === OperationType.Update
              ? usedRecipes.lists[dialogSelectMenueData.selectedListUid]
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

        const menueIds = Object.keys(selectedMenues);

        if (dialogSelectMenueData.operationType === OperationType.Create) {
          // Validierung: gibt es Rezepte in den ausgewählten Menüs?
          try {
            UsedRecipes.createNewListProperties({
              name: userInput.input,
              selectedMenues: menueIds,
              menueplan: menuplan,
            });
          } catch (error) {
            dispatch({
              type: ReducerActions.GENERIC_ERROR,
              payload: error as Error,
            });
            return;
          }

          // Liste in Supabase erstellen
          database.usedRecipeLists
            .createList(event.uid, userInput.input, menueIds)
            .then((createdList) => {
              // Optimistisches UI-Update — neue Liste sofort anzeigen
              const newUsedRecipes = {...usedRecipes};
              newUsedRecipes.lists[createdList.id] = {
                properties: {
                  uid: createdList.id,
                  name: createdList.name,
                  selectedMeals: getMealsOfMenues({
                    menuplan: menuplan,
                    menues: createdList.selectedMenues,
                  }),
                  selectedMenues: createdList.selectedMenues,
                  generated: {
                    date: createdList.updatedAt,
                    fromUid: "",
                    fromDisplayName: "",
                  },
                },
                recipes: {},
              };
              newUsedRecipes.noOfLists++;
              newUsedRecipes.uid = event.uid;
              onUsedRecipesUpdate(newUsedRecipes);

              dispatch({
                type: ReducerActions.SHOW_LOADING,
                payload: {isLoading: false},
              });
            })
            .catch((error) => {
              dispatch({type: ReducerActions.GENERIC_ERROR, payload: error});
            });
        } else if (
          dialogSelectMenueData.operationType === OperationType.Update
        ) {
          onUpdateList(userInput.input, menueIds);
        }
      } else {
        // Abbruch — Dialog wieder öffnen
        setDialogSelectMenueData((prev) => ({
          ...prev,
          menues: selectedMenues,
          open: true,
        }));
      }
    },
    [
      dialogSelectMenueData,
      usedRecipes,
      menuplan,
      event.uid,
      onUsedRecipesUpdate,
      onUpdateList,
      customDialog,
      database,
    ],
  );

  /* ------------------------------------------
  // List-Element-Handler
  // ------------------------------------------ */

  const onRefreshLists = useCallback(() => {
    if (!state.selectedListItem) return;
    loadRecipesForList(state.selectedListItem);
  }, [state.selectedListItem, loadRecipesForList]);

  const onListElementSelect = useCallback(
    (clickEvent: React.MouseEvent<HTMLElement, MouseEvent>) => {
      const selectedListItem = clickEvent.currentTarget.dataset.uid;
      if (!selectedListItem) return;
      dispatch({
        type: ReducerActions.SET_SELECTED_LIST_ITEM,
        payload: {
          uid: selectedListItem,
          sortedMenueList: sortSelectedMenues({
            menueList:
              usedRecipes.lists[selectedListItem].properties.selectedMenues,
            menuplan: menuplan,
          }),
        },
      });

      // Rezepte für die ausgewählte Liste laden
      loadRecipesForList(selectedListItem);
    },
    [usedRecipes, menuplan, loadRecipesForList],
  );

  const onListElementDelete = useCallback(
    (clickEvent: React.MouseEvent<HTMLElement>) => {
      const selectedList = clickEvent.currentTarget.dataset.uid;
      if (!selectedList) return;

      // Optimistisches UI-Update
      const updatedUsedRecipes = UsedRecipes.deleteList({
        usedRecipes: usedRecipes,
        listUidToDelete: selectedList,
        authUser: authUser,
      });
      onUsedRecipesUpdate(updatedUsedRecipes);

      dispatch({
        type: ReducerActions.SET_SELECTED_LIST_ITEM,
        payload: {uid: "", sortedMenueList: []},
      });

      // In Supabase löschen
      database.usedRecipeLists.deleteList(selectedList).catch((error) => {
        dispatch({type: ReducerActions.GENERIC_ERROR, payload: error});
      });
    },
    [usedRecipes, authUser, onUsedRecipesUpdate, database],
  );

  const onListElementEdit = useCallback(
    (clickEvent: React.MouseEvent<HTMLElement>) => {
      const selectedListUid = clickEvent.currentTarget.dataset.uid;
      if (!selectedListUid) return;

      // Gespeicherte Menü-Auswahl in Dialog-Format umwandeln
      const selectedMenuesForDialog: DialogSelectMenuesForRecipeDialogValues =
        {};
      const selectedMenues =
        usedRecipes.lists[selectedListUid].properties.selectedMenues;

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
    [usedRecipes],
  );

  /* ------------------------------------------
  // PDF erzeugen
  // ------------------------------------------ */

  const onGeneratePrintVersion = useCallback(() => {
    if (Object.keys(state.loadedRecipes).length === 0) {
      dispatch({
        type: ReducerActions.GENERIC_ERROR,
        payload: new Error(TEXT_ERROR_NO_RECIPES_FOUND),
      });
      return;
    }

    pdf(
      <UsedRecipesPdf
        list={{
          properties: usedRecipes.lists[state.selectedListItem!].properties,
          recipes: state.loadedRecipes,
        }}
        sortedMenueList={state.sortedMenueList}
        menueplan={menuplan}
        eventName={event.name}
        products={products}
        units={units}
        unitConversionBasic={unitConversionBasic}
        unitConversionProducts={unitConversionProducts}
        authUser={authUser}
      />,
    )
      .toBlob()
      .then((result) => {
        fileSaver.saveAs(
          result,
          event.name + " " + TEXT_QUANTITY_CALCULATION + TEXT_SUFFIX_PDF,
        );
      })
      .catch((error) => {
        dispatch({type: ReducerActions.GENERIC_ERROR, payload: error as Error});
      });
  }, [
    state.loadedRecipes,
    state.selectedListItem,
    state.sortedMenueList,
    usedRecipes,
    menuplan,
    event.name,
    products,
    units,
    unitConversionBasic,
    unitConversionProducts,
    authUser,
  ]);

  return {
    state,
    dialogSelectMenueData,
    handlers: {
      onCreateList,
      onCloseDialogSelectMenues,
      onConfirmDialogSelectMenues,
      onRefreshLists,
      onListElementSelect,
      onListElementDelete,
      onListElementEdit,
      onGeneratePrintVersion,
    },
  };
};
