/**
 * Reducer und Typen für die Antrags-Übersicht.
 *
 * Enthält den State, die Dispatch-Actions und die Reducer-Logik
 * für die Request-Overview-Seite. Reine Logik ohne UI-Abhängigkeiten.
 */
import {RequestDomain} from "../Database/Repository/RequestRepository";
import {SnackbarState} from "../Shared/customSnackbar";

/* ===================================================================
// ========================== Enums ==================================
// =================================================================== */

/** Aktionen für den Request-Reducer. */
export enum ReducerActions {
  FETCH_INIT = "FETCH_INIT",
  FETCH_SUCCESS = "FETCH_SUCCESS",
  FETCH_CLOSED_REQUESTS = "FETCH_CLOSED_REQUESTS",
  UPDATE_REQUEST_SELECTION = "UPDATE_REQUEST_SELECTION",
  SNACKBAR_SHOW = "SNACKBAR_SHOW",
  SNACKBAR_CLOSE = "SNACKBAR_CLOSE",
  GENERIC_ERROR = "GENERIC_ERROR",
  UPDATE_SINGLE_REQUEST = "UPDATE_SINGLE_REQUEST",
}

/** Filter für aktive/alle Anträge. */
export enum RequestStateFilter {
  Active = "active",
  All = "all",
}

/* ===================================================================
// ========================== Typen ==================================
// =================================================================== */

/** Mögliche Dispatch-Aktionen mit typisiertem Payload. */
export type DispatchAction =
  | {type: ReducerActions.FETCH_INIT; payload: Record<string, never>}
  | {type: ReducerActions.FETCH_SUCCESS; payload: RequestDomain[]}
  | {type: ReducerActions.FETCH_CLOSED_REQUESTS; payload: RequestDomain[]}
  | {
      type: ReducerActions.UPDATE_REQUEST_SELECTION;
      payload: {newStateFilter: string};
    }
  | {type: ReducerActions.SNACKBAR_SHOW; payload: {message: string}}
  | {type: ReducerActions.SNACKBAR_CLOSE; payload: Record<string, never>}
  | {type: ReducerActions.UPDATE_SINGLE_REQUEST; payload: RequestDomain}
  | {type: ReducerActions.GENERIC_ERROR; payload: Error};

/** State der Antrags-Übersicht. */
export type State = {
  requests: RequestDomain[];
  activeRequests: RequestDomain[];
  closedRequests: RequestDomain[];
  isLoading: boolean;
  snackbar: SnackbarState;
  closedRequestsFetched: boolean;
  error: Error | null;
};

/** Initialzustand für den Reducer. */
export const initialState: State = {
  requests: [],
  activeRequests: [],
  closedRequests: [],
  isLoading: false,
  snackbar: {} as SnackbarState,
  closedRequestsFetched: false,
  error: null,
};

/* ===================================================================
// ========================== Reducer ================================
// =================================================================== */

/**
 * Reducer für die Antrags-Übersicht.
 *
 * Verwaltet Lade-Zustände, aktive/abgeschlossene Anträge,
 * Filter-Auswahl, Snackbar und Fehler.
 *
 * @param state - Aktueller Zustand
 * @param action - Dispatch-Aktion mit typisiertem Payload
 * @returns Neuer Zustand
 */
export const requestReducer = (state: State, action: DispatchAction): State => {
  let tmpRequests: RequestDomain[] = [];
  let index: number;
  switch (action.type) {
    case ReducerActions.FETCH_INIT:
      return {
        ...state,
        isLoading: true,
      };
    case ReducerActions.FETCH_SUCCESS:
      return {
        ...state,
        isLoading: false,
        requests: action.payload,
        activeRequests: action.payload,
      };
    case ReducerActions.FETCH_CLOSED_REQUESTS:
      return {
        ...state,
        isLoading: false,
        closedRequestsFetched: true,
        requests: [...state.activeRequests, ...action.payload],
        closedRequests: action.payload,
      };
    case ReducerActions.UPDATE_REQUEST_SELECTION:
      action.payload.newStateFilter == RequestStateFilter.All
        ? (tmpRequests = [...state.activeRequests, ...state.closedRequests])
        : (tmpRequests = state.activeRequests);
      return {
        ...state,
        requests: tmpRequests,
      };
    case ReducerActions.SNACKBAR_SHOW:
      return {
        ...state,
        snackbar: {
          severity: "success",
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
    case ReducerActions.UPDATE_SINGLE_REQUEST:
      tmpRequests = [...state.requests];
      index = tmpRequests.findIndex(
        (request) => request.uid === action.payload.uid,
      );
      if (index !== -1) {
        tmpRequests[index] = action.payload;
      }
      return {
        ...state,
        requests: tmpRequests,
      };
    case ReducerActions.GENERIC_ERROR:
      return {
        ...state,
        error: action.payload,
        isLoading: false,
      };
    default: {
      const _exhaustiveCheck: never = action;
      throw new Error(`Unbekannter ActionType: ${_exhaustiveCheck}`);
    }
  }
};
