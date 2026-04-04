/**
 * Reducer und Typen für die UnitConversionPage.
 *
 * Verwaltet den Zustand der Einheitenumrechnungs-Seite: Lade-Status,
 * Basis- und Produktumrechnungen, Bearbeitungsmodus und Snackbar.
 */
import {
  SAVE_SUCCESS as TEXT_SAVE_SUCCESS,
} from "../../constants/text";

import {SnackbarState} from "../Shared/customSnackbar";
import {Unit} from "./unit.class";
import {UnitConversion} from "./unitConversion.class";
import {Product} from "../Product/product.types";

/* ===================================================================
// ======================== Reducer-Typen ============================
// =================================================================== */

/**
 * Alle möglichen Aktionen des UnitConversion-Reducers.
 */
export enum ReducerActions {
  FETCH_INIT,
  UNIT_CONVERSION_BASIC_FETCH_SUCCESS,
  UNIT_CONVERSION_PRODUCTS_FETCH_SUCCESS,
  SNACKBAR_CLOSE,
  PRODUCTS_FETCH_SUCCESS,
  UNITS_FETCH_SUCCESS,
  NEW_UNIT_CONVERSION_BASIC,
  NEW_UNIT_CONVERSION_PRODUCT,
  UNIT_CONVERSION_BASIC_ON_CHANGE,
  UNIT_CONVERSION_PRODUCT_ON_CHANGE,
  UNIT_CONVERSIONS_SAVED,
  UNIT_CONVERSIONS_EDIT_CANCELLED,
  DELETE_BASIC_UNIT_CONVERSION,
  DELETE_PRODUCT_UNIT_CONVERSION,
  GENERIC_ERROR,
}

/**
 * Lade-Status für die verschiedenen Datenquellen.
 */
export type IsLoading = {
  overall: boolean;
  products: boolean;
  units: boolean;
  unitConversionBasic: boolean;
  unitConversionProduct: boolean;
};

/**
 * Zustand der UnitConversionPage.
 */
export type State = {
  unitConversionBasic: UnitConversion[];
  unitConversionProduct: UnitConversion[];
  products: Product[];
  units: Unit[];
  error: Error | null;
  isLoading: IsLoading;
  snackbar: SnackbarState;
};

/** Diskriminierte Union für Reducer-Actions — typsichere Payloads. */
export type ReducerAction =
  | {type: ReducerActions.FETCH_INIT; payload: {field: string}}
  | {
      type: ReducerActions.UNIT_CONVERSION_BASIC_FETCH_SUCCESS;
      payload: UnitConversion[];
    }
  | {
      type: ReducerActions.UNIT_CONVERSION_PRODUCTS_FETCH_SUCCESS;
      payload: UnitConversion[];
    }
  | {type: ReducerActions.PRODUCTS_FETCH_SUCCESS; payload: Product[]}
  | {type: ReducerActions.UNITS_FETCH_SUCCESS; payload: Unit[]}
  | {type: ReducerActions.NEW_UNIT_CONVERSION_BASIC; payload: UnitConversion}
  | {type: ReducerActions.NEW_UNIT_CONVERSION_PRODUCT; payload: UnitConversion}
  | {
      type: ReducerActions.UNIT_CONVERSION_BASIC_ON_CHANGE;
      payload: {uid: string; field: string; value: string};
    }
  | {
      type: ReducerActions.UNIT_CONVERSION_PRODUCT_ON_CHANGE;
      payload: {uid: string; field: string; value: string};
    }
  | {type: ReducerActions.UNIT_CONVERSIONS_SAVED; payload: Record<string, never>}
  | {
      type: ReducerActions.UNIT_CONVERSIONS_EDIT_CANCELLED;
      payload: {basic: UnitConversion[]; product: UnitConversion[]};
    }
  | {type: ReducerActions.DELETE_BASIC_UNIT_CONVERSION; payload: {uid: string}}
  | {
      type: ReducerActions.DELETE_PRODUCT_UNIT_CONVERSION;
      payload: {uid: string};
    }
  | {type: ReducerActions.SNACKBAR_CLOSE; payload: Record<string, never>}
  | {type: ReducerActions.GENERIC_ERROR; payload: Error};

export const initialState: State = {
  unitConversionBasic: [],
  unitConversionProduct: [],
  products: [],
  units: [],
  error: null,
  isLoading: {
    overall: false,
    products: false,
    units: false,
    unitConversionBasic: false,
    unitConversionProduct: false,
  },
  snackbar: {open: false, severity: "success", message: ""},
};

/* ===================================================================
// ======================== Hilfsfunktionen ==========================
// =================================================================== */

/**
 * Berechnet den Gesamtlade-Status ohne den Zustand zu mutieren.
 *
 * @param current - Aktueller isLoading-Zustand.
 * @param changedField - Das Feld, dessen Wert sich ändert.
 * @param newValue - Neuer Wert für das geänderte Feld.
 * @returns true wenn mindestens ein Nicht-overall-Feld true ist.
 */
const computeOverallLoading = (
  current: IsLoading,
  changedField: keyof Omit<IsLoading, "overall">,
  newValue: boolean
): boolean => {
  const updated = {...current, [changedField]: newValue};
  return Object.keys(updated).some(
    (key) => key !== "overall" && updated[key as keyof IsLoading] === true
  );
};

/* ===================================================================
// ======================== Reducer ==================================
// =================================================================== */

/**
 * Reducer für die UnitConversionPage.
 *
 * Verwaltet Lade-, Bearbeitungs- und Fehlerzustände der
 * Einheitenumrechnungsliste (Basis und Produktspezifisch).
 *
 * @param state - Aktueller Zustand.
 * @param action - Diskriminierte Union-Action.
 * @returns Neuer Zustand.
 */
export const unitConversionReducer = (
  state: State,
  action: ReducerAction
): State => {
  switch (action.type) {
    case ReducerActions.FETCH_INIT:
      return {
        ...state,
        isLoading: {
          ...state.isLoading,
          overall: true,
          [action.payload.field]: true,
        },
      };
    case ReducerActions.UNIT_CONVERSION_BASIC_FETCH_SUCCESS:
      return {
        ...state,
        unitConversionBasic: action.payload,
        isLoading: {
          ...state.isLoading,
          unitConversionBasic: false,
          overall: computeOverallLoading(
            state.isLoading,
            "unitConversionBasic",
            false
          ),
        },
      };
    case ReducerActions.UNIT_CONVERSION_PRODUCTS_FETCH_SUCCESS:
      return {
        ...state,
        unitConversionProduct: action.payload,
        isLoading: {
          ...state.isLoading,
          unitConversionProduct: false,
          overall: computeOverallLoading(
            state.isLoading,
            "unitConversionProduct",
            false
          ),
        },
      };
    case ReducerActions.PRODUCTS_FETCH_SUCCESS:
      return {
        ...state,
        products: action.payload,
        isLoading: {
          ...state.isLoading,
          products: false,
          overall: computeOverallLoading(state.isLoading, "products", false),
        },
      };
    case ReducerActions.UNITS_FETCH_SUCCESS:
      return {
        ...state,
        units: action.payload,
        isLoading: {
          ...state.isLoading,
          overall: computeOverallLoading(state.isLoading, "units", false),
          units: false,
        },
      };
    case ReducerActions.UNIT_CONVERSION_BASIC_ON_CHANGE:
      return {
        ...state,
        unitConversionBasic: state.unitConversionBasic.map(
          (unitConversion) => {
            if (unitConversion.uid === action.payload.uid) {
              return {
                ...unitConversion,
                [action.payload.field]: action.payload.value,
              };
            }
            return unitConversion;
          }
        ) as UnitConversion[],
      };
    case ReducerActions.UNIT_CONVERSION_PRODUCT_ON_CHANGE:
      return {
        ...state,
        unitConversionProduct: state.unitConversionProduct.map(
          (unitConversion) => {
            if (unitConversion.uid === action.payload.uid) {
              return {
                ...unitConversion,
                [action.payload.field]: action.payload.value,
              };
            }
            return unitConversion;
          }
        ) as UnitConversion[],
      };
    case ReducerActions.NEW_UNIT_CONVERSION_BASIC:
      return {
        ...state,
        unitConversionBasic: [...state.unitConversionBasic, action.payload],
      };
    case ReducerActions.NEW_UNIT_CONVERSION_PRODUCT:
      return {
        ...state,
        unitConversionProduct: [
          ...state.unitConversionProduct,
          action.payload,
        ],
      };
    case ReducerActions.DELETE_BASIC_UNIT_CONVERSION:
      return {
        ...state,
        unitConversionBasic: UnitConversion.deleteUnitConversion({
          unitConversion: state.unitConversionBasic,
          unitConversionUidToDelete: action.payload.uid,
        }),
      };
    case ReducerActions.DELETE_PRODUCT_UNIT_CONVERSION:
      return {
        ...state,
        unitConversionProduct: UnitConversion.deleteUnitConversion({
          unitConversion: state.unitConversionProduct,
          unitConversionUidToDelete: action.payload.uid,
        }),
      };
    case ReducerActions.UNIT_CONVERSIONS_SAVED:
      return {
        ...state,
        snackbar: {
          severity: "success",
          message: TEXT_SAVE_SUCCESS,
          open: true,
        } as SnackbarState,
      };
    case ReducerActions.UNIT_CONVERSIONS_EDIT_CANCELLED:
      return {
        ...state,
        unitConversionBasic: action.payload.basic,
        unitConversionProduct: action.payload.product,
      };
    case ReducerActions.SNACKBAR_CLOSE:
      return {
        ...state,
        snackbar: {
          severity: "success",
          message: "",
          open: false,
        } as SnackbarState,
      };
    case ReducerActions.GENERIC_ERROR:
      return {
        ...state,
        error: action.payload,
      };
    default: {
      const _exhaustive: never = action;
      throw new Error(
        `Unbekannter ActionType: ${(_exhaustive as ReducerAction).type}`
      );
    }
  }
};
