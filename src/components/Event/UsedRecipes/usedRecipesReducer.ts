import {MenueCoordinates} from "../Menuplan/menuplan.types";
import {Snackbar} from "../../Shared/customSnackbar";
import Recipe from "../../Recipe/recipe.class";
import {DialogSelectMenuesForRecipeDialogValues} from "../Menuplan/dialogSelectMenues";
import {OperationType} from "../Event/eventSharedComponents";


export enum ReducerActions {
  SHOW_LOADING,
  SET_SELECTED_LIST_ITEM,
  RECIPES_LOADED,
  GENERIC_ERROR,
  SNACKBAR_SHOW,
  SNACKBAR_CLOSE,
}

export type State = {
  selectedListItem: string | null;
  sortedMenueList: MenueCoordinates[];
  /** Geladene Rezepte der ausgewählten Liste (recipeUid → Recipe). */
  loadedRecipes: Record<string, Recipe>;
  isLoading: boolean;
  error: Error | null;
  snackbar: Snackbar;
};

export type DispatchAction =
  | {type: ReducerActions.SHOW_LOADING; payload: {isLoading: boolean}}
  | {
      type: ReducerActions.SET_SELECTED_LIST_ITEM;
      payload: {uid: string; sortedMenueList: MenueCoordinates[]};
    }
  | {
      type: ReducerActions.RECIPES_LOADED;
      payload: {recipes: Record<string, Recipe>};
    }
  | {type: ReducerActions.GENERIC_ERROR; payload: Error}
  | {
      type: ReducerActions.SNACKBAR_SHOW;
      payload: {severity: Snackbar["severity"]; message: string};
    }
  | {type: ReducerActions.SNACKBAR_CLOSE};

export const initialState: State = {
  selectedListItem: null,
  sortedMenueList: [],
  loadedRecipes: {},
  isLoading: false,
  error: null,
  snackbar: {open: false, severity: "success", message: ""},
};

export const usedRecipesReducer = (
  state: State,
  action: DispatchAction,
): State => {
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
        sortedMenueList: action.payload.sortedMenueList,
      };
    case ReducerActions.RECIPES_LOADED:
      return {
        ...state,
        loadedRecipes: action.payload.recipes,
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
    default:
      throw new Error();
  }
};

/**
 * Typ für den Dialog-State der Menü-Auswahl.
 */
export interface DialogSelectMenueDataType {
  open: boolean;
  menues: DialogSelectMenuesForRecipeDialogValues;
  selectedListUid: string;
  operationType: OperationType;
}

export const DIALOG_SELECT_MENUE_DATA_INITIAL_DATA: DialogSelectMenueDataType =
  {
    open: false,
    menues: {} as DialogSelectMenuesForRecipeDialogValues,
    selectedListUid: "",
    operationType: OperationType.none,
  };
