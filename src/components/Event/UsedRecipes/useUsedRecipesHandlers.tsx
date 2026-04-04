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

import {generateAndDownloadPdf} from "../../Shared/pdfUtils";

import {
  SUFFIX_PDF as TEXT_SUFFIX_PDF,
  QUANTITY_CALCULATION as TEXT_QUANTITY_CALCULATION,
  NAME as TEXT_NAME,
  NEW_LIST as TEXT_NEW_LIST,
  GIVE_THE_NEW_LIST_A_NAME as TEXT_GIVE_THE_NEW_LIST_A_NAME,
  ERROR_NO_RECIPES_FOUND as TEXT_ERROR_NO_RECIPES_FOUND,
  DRIFT_DETECTED_TITLE as TEXT_DRIFT_DETECTED_TITLE,
  DRIFT_DETECTED_DESCRIPTION as TEXT_DRIFT_DETECTED_DESCRIPTION,
  KEEP_ORIGINAL_DAYS as TEXT_KEEP_ORIGINAL_DAYS,
  FOLLOW_CURRENT_MENUES as TEXT_FOLLOW_CURRENT_MENUES,
} from "../../../constants/text";

import AuthUser from "../../Firebase/Authentication/authUser.class";
import {useDatabase} from "../../Database/DatabaseContext";
import {Event} from "../Event/event.class";
import {
  DialogSelectMenuesForRecipeDialogValues,
} from "../Menuplan/dialogSelectMenues";
import {Menue, MenuplanData} from "../Menuplan/menuplan.types";
import {getMealsOfMenues, getMenuesOfMeals, sortSelectedMenues} from "../Menuplan/menuplanService";
import {UsedRecipes} from "./usedRecipes.class";
import {
  DialogType,
  SingleTextInputResult,
  useCustomDialog,
} from "../../Shared/customDialogContext";
import Recipe from "../../Recipe/recipe.class";
import {UsedRecipesPdf} from "./usedRecipesPdf";
import {
  NavigationValuesContext,
  NavigationObject,
} from "../../Navigation/NavigationContext";
import {Action} from "../../../constants/actions";
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
import {trackEvent} from "../../Analytics/analyticsService";
import {AnalyticsEvent} from "../../Analytics/analyticsEvents";


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
            recipeRefs.map((ref) => ref.recipeId).filter((recipeId) => recipeId !== ""),
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
  // Drift-Erkennung
  // ------------------------------------------ */

  /**
   * Prüft ob die Menüs einer Liste im Menüplan verschoben wurden und
   * bietet dem Benutzer eine Auswahl an: ursprüngliche Tage beibehalten
   * oder aktuelle Menüpositionen übernehmen.
   *
   * @param listId - ID der zu prüfenden Liste
   */
  /**
   * Prüft ob die Menüs einer Liste im Menüplan verschoben wurden und
   * bietet dem Benutzer eine Auswahl an: ursprüngliche Tage beibehalten
   * oder aktuelle Menüpositionen übernehmen.
   *
   * @param listId - ID der zu prüfenden Liste
   * @returns Die aufgelösten Menü-IDs (oder undefined falls kein Drift)
   */
  const checkAndResolveDrift = useCallback(
    async (listId: string): Promise<string[] | undefined> => {
      const list = usedRecipes.lists[listId];
      if (!list) return undefined;

      const {selectedMeals, selectedMenues} = list.properties;

      // Kein Drift-Check für Pre-Migration-Listen (leere Meals = Backfill-Pfad)
      if (selectedMeals.length === 0) return undefined;

      const driftResult = UsedRecipes.detectDrift(
        selectedMeals,
        selectedMenues,
        menuplan,
      );

      if (!driftResult.hasDrift) return undefined;

      // Drift erkannt — Benutzer nach Auflösungsstrategie fragen
      const userInput = (await customDialog({
        dialogType: DialogType.SelectOptions,
        title: TEXT_DRIFT_DETECTED_TITLE,
        text: TEXT_DRIFT_DETECTED_DESCRIPTION,
        options: [
          {key: "keepMeals", text: TEXT_KEEP_ORIGINAL_DAYS},
          {key: "followMenues", text: TEXT_FOLLOW_CURRENT_MENUES},
        ],
      })) as SingleTextInputResult;

      if (!userInput.valid) return undefined; // Dialog geschlossen — keine Änderung

      let newMenues: string[];
      let newMeals: string[];

      if (userInput.input === "keepMeals") {
        // Menüs aus den ursprünglichen Meals ableiten
        newMenues = getMenuesOfMeals({menuplan, meals: selectedMeals});
        // Meals konsistent halten — leere Meals (ohne Menüs) entfernen,
        // damit kein ewiger Drift entsteht
        newMeals = getMealsOfMenues({menuplan, menues: newMenues});
      } else {
        // Meals aus den aktuellen Menüs ableiten
        newMenues = selectedMenues;
        newMeals = getMealsOfMenues({menuplan, menues: selectedMenues});
      }

      // Optimistisches UI-Update — Drift aufgelöst + «Veraltet»-Warnung entfernen
      const updatedUsedRecipes = {...usedRecipes};
      updatedUsedRecipes.lists = {...updatedUsedRecipes.lists};
      updatedUsedRecipes.lists[listId] = {
        ...updatedUsedRecipes.lists[listId],
        properties: {
          ...updatedUsedRecipes.lists[listId].properties,
          selectedMenues: newMenues,
          selectedMeals: newMeals,
          generated: {
            ...updatedUsedRecipes.lists[listId].properties.generated,
            date: new Date(),
          },
        },
      };
      onUsedRecipesUpdate(updatedUsedRecipes);

      // Persistieren
      await database.usedRecipeLists
        .updateListMenuesAndMeals(listId, newMenues, newMeals)
        .catch((error) => {
          dispatch({type: ReducerActions.GENERIC_ERROR, payload: error});
        });

      return newMenues;
    },
    [usedRecipes, menuplan, customDialog, onUsedRecipesUpdate, database],
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

      const newMeals = getMealsOfMenues({menuplan, menues: newSelectedMenues});
      Promise.all([
        database.usedRecipeLists.updateListName(listId, newName),
        database.usedRecipeLists.updateListMenuesAndMeals(
          listId,
          newSelectedMenues,
          newMeals,
        ),
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

          // Liste in Supabase erstellen (inkl. Meals für Drift-Erkennung)
          const mealIds = getMealsOfMenues({menuplan, menues: menueIds});
          database.usedRecipeLists
            .createList(event.uid, userInput.input, menueIds, mealIds)
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

              // Neue Liste automatisch auswählen und Rezepte laden
              dispatch({
                type: ReducerActions.SET_SELECTED_LIST_ITEM,
                payload: {
                  uid: createdList.id,
                  sortedMenueList: sortSelectedMenues({
                    menueList: createdList.selectedMenues,
                    menuplan: menuplan,
                  }),
                },
              });

              loadRecipesForList(createdList.id);
              trackEvent(AnalyticsEvent.USED_RECIPES_GENERATED, {eventUid: event.uid});
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
      loadRecipesForList,
    ],
  );

  /* ------------------------------------------
  // List-Element-Handler
  // ------------------------------------------ */

  const onRefreshLists = useCallback(() => {
    if (!state.selectedListItem) return;

    // generated.date aktualisieren, damit die «Veraltet»-Warnung verschwindet
    const updatedUsedRecipes = {...usedRecipes};
    updatedUsedRecipes.lists = {...updatedUsedRecipes.lists};
    updatedUsedRecipes.lists[state.selectedListItem] = {
      ...updatedUsedRecipes.lists[state.selectedListItem],
      properties: {
        ...updatedUsedRecipes.lists[state.selectedListItem].properties,
        generated: {
          ...updatedUsedRecipes.lists[state.selectedListItem].properties
            .generated,
          date: new Date(),
        },
      },
    };
    onUsedRecipesUpdate(updatedUsedRecipes);

    // updated_at in DB aktualisieren — ein leerer Update auf die Kopfzeile
    // triggert update_updated_at und hält den Zeitstempel konsistent.
    database.usedRecipeLists
      .updateListMenues(
        state.selectedListItem,
        usedRecipes.lists[state.selectedListItem].properties.selectedMenues,
      )
      .catch((error) => {
        dispatch({type: ReducerActions.GENERIC_ERROR, payload: error});
      });

    loadRecipesForList(state.selectedListItem);
    trackEvent(AnalyticsEvent.USED_RECIPES_REFRESHED, {eventUid: event.uid});
  }, [state.selectedListItem, usedRecipes, onUsedRecipesUpdate, database, loadRecipesForList]);

  const onListElementSelect = useCallback(
    async (clickEvent: React.MouseEvent<HTMLElement, MouseEvent>) => {
      const selectedListItem = clickEvent.currentTarget.dataset.uid;
      if (!selectedListItem) return;

      // Drift-Erkennung vor dem Laden — kann Menüs/Meals aktualisieren.
      // Gibt die aufgelösten Menüs zurück, da usedRecipes im Closure
      // nach der Drift-Auflösung noch den alten Wert hat (stale closure).
      const resolvedMenues = await checkAndResolveDrift(selectedListItem);

      const currentMenues = resolvedMenues
        ?? usedRecipes.lists[selectedListItem].properties.selectedMenues;

      dispatch({
        type: ReducerActions.SET_SELECTED_LIST_ITEM,
        payload: {
          uid: selectedListItem,
          sortedMenueList: sortSelectedMenues({
            menueList: currentMenues,
            menuplan: menuplan,
          }),
        },
      });

      // Rezepte für die ausgewählte Liste laden
      loadRecipesForList(selectedListItem);
    },
    [usedRecipes, menuplan, checkAndResolveDrift, loadRecipesForList],
  );

  const onListElementDelete = useCallback(
    (clickEvent: React.MouseEvent<HTMLElement>) => {
      // Propagation stoppen, damit der Klick auf den Delete-Button nicht
      // zum übergeordneten ListItemButton durchblubbered und onListElementSelect auslöst.
      clickEvent.stopPropagation();

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
      trackEvent(AnalyticsEvent.USED_RECIPES_DELETED, {eventUid: event.uid});
    },
    [usedRecipes, authUser, onUsedRecipesUpdate, database],
  );

  const onListElementEdit = useCallback(
    (clickEvent: React.MouseEvent<HTMLElement>) => {
      // Propagation stoppen (gleicher Grund wie bei onListElementDelete).
      clickEvent.stopPropagation();

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

    generateAndDownloadPdf(
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
      event.name + " " + TEXT_QUANTITY_CALCULATION + TEXT_SUFFIX_PDF,
      (error) =>
        dispatch({type: ReducerActions.GENERIC_ERROR, payload: error}),
      {eventUid: event.uid},
    );
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
