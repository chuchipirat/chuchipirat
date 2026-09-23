import {SnackbarState} from "../../Shared/customSnackbar";
import {BudgetDomain} from "./budget.types";
import {
  BUDGET_SAVED as TEXT_BUDGET_SAVED,
  BUDGET_UPDATED as TEXT_BUDGET_UPDATED,
  BUDGET_DELETED as TEXT_BUDGET_DELETED,
} from "../../../constants/text/expenseTracking";
import {ExpenseDomain} from "./expense.types";

/** Aktionen, die der Reducer der Abrechnungsseite verarbeitet. */
export enum ReducerActions {
  BUDGETS_FETCH_SUCCESS,
  BUDGET_CREATED,
  BUDGET_UPDATED,
  BUDGET_DELETED,
  GENERIC_ERROR,
  SNACKBAR_CLOSE,
}

/**
 * Alle Aktionen des Reducers mit ihrem jeweiligen Payload.
 * `BUDGET_DELETED` trägt das ganze Budget (statt nur der ID), damit der
 * Reducer bei Bedarf auf dessen Felder zugreifen kann.
 */
export type DispatchAction =
  | {
      type: ReducerActions.BUDGETS_FETCH_SUCCESS;
      payload: {budgets: BudgetDomain[]; expenses: ExpenseDomain[]};
    }
  | {type: ReducerActions.BUDGET_CREATED; payload: BudgetDomain}
  | {type: ReducerActions.BUDGET_UPDATED; payload: BudgetDomain}
  | {type: ReducerActions.BUDGET_DELETED; payload: BudgetDomain}
  | {type: ReducerActions.GENERIC_ERROR; payload: Error}
  | {type: ReducerActions.SNACKBAR_CLOSE};

/**
 * State der Abrechnungsseite.
 *
 * @param isError - `true`, solange ein Fehler oder Validierungshinweis angezeigt wird.
 * @param error - Anzuzeigender Fehler (nur gesetzt, wenn `isError` `true` ist).
 * @param budgets - Budgets des Events; `null`, solange noch nicht geladen.
 * @param expenses - Ausgaben des Events; `null`, solange noch nicht geladen.
 * @param snackbar - Zustand der Rückmeldung nach erfolgreichem Speichern/Löschen.
 */
export type State = {
  isError: boolean;
  error: Error | null;
  budgets: BudgetDomain[] | null;
  expenses: ExpenseDomain[] | null;
  snackbar: SnackbarState;
};

/** Ausgangszustand: noch nichts geladen, kein Fehler, Snackbar geschlossen. */
export const initialState: State = {
  budgets: null,
  expenses: null,
  isError: false,
  error: null,
  snackbar: {open: false, severity: "success", message: ""},
};

/**
 * Reducer der Abrechnungsseite. Jede erfolgreiche Aktion setzt `isError`
 * zurück, damit ein vorübergehender Fehler (z.B. Netzwerk) nicht stehen
 * bleibt, sobald die Daten wieder erfolgreich geladen oder gespeichert wurden.
 *
 * @param state - Bisheriger State.
 * @param action - Auszuführende Aktion.
 * @returns Neuer State.
 * @throws {Error} Bei einer unbekannten Aktion (Exhaustive-Check).
 */
export const expenseTrackingReducer = (
  state: State,
  action: DispatchAction,
): State => {
  switch (action.type) {
    case ReducerActions.BUDGETS_FETCH_SUCCESS:
      return {
        ...state,
        budgets: action.payload.budgets,
        expenses: action.payload.expenses,
        isError: false,
        error: null,
      };
    case ReducerActions.BUDGET_CREATED:
      return {
        ...state,
        budgets:
          state.budgets?.length == 0 || state.budgets == null
            ? [action.payload]
            : state.budgets?.concat(action.payload),
        snackbar: {open: true, severity: "success", message: TEXT_BUDGET_SAVED},
        isError: false,
        error: null,
      };
    case ReducerActions.BUDGET_UPDATED: {
      const updatedBudgets = (state.budgets ?? []).map((budget) =>
        budget.id === action.payload.id ? action.payload : budget,
      );
      return {
        ...state,
        budgets: updatedBudgets,
        snackbar: {
          open: true,
          severity: "success",
          message: TEXT_BUDGET_UPDATED,
        },
        isError: false,
        error: null,
      };
    }
    case ReducerActions.BUDGET_DELETED: {
      const updatedBudgets = (state.budgets ?? []).filter(
        (budget) => budget.id !== action.payload.id,
      );
      return {
        ...state,
        budgets: updatedBudgets,
        snackbar: {
          open: true,
          severity: "success",
          message: TEXT_BUDGET_DELETED,
        },
        isError: false,
        error: null,
      };
    }
    case ReducerActions.GENERIC_ERROR:
      return {
        ...state,
        isError: true,
        error: action.payload as Error,
      };
    case ReducerActions.SNACKBAR_CLOSE:
      return {
        ...state,
        snackbar: {
          severity: "success",
          message: "",
          open: false,
        },
        isError: false,
        error: null,
      };
    default: {
      const _exhaustiveCheck: never = action;
      throw new Error(`Unknown action: ${_exhaustiveCheck}`);
    }
  }
};
