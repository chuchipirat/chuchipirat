/**
 * Unit-Tests fuer den requestOverviewReducer.
 *
 * Reine Funktions-Tests ohne Rendering — prueft alle Reducer-Actions
 * auf korrekte State-Transitionen.
 */
import {TextEncoder, TextDecoder} from "util";
Object.assign(global, {TextEncoder, TextDecoder});

import {
  requestReducer,
  ReducerActions,
  RequestStateFilter,
  initialState,
} from "../requestOverviewReducer";
import type {State, DispatchAction} from "../requestOverviewReducer";
import type {RequestDomain} from "../../Database/Repository/RequestRepository";

/* ===================================================================
// ======================== Testdaten =================================
// =================================================================== */

/** Minimaler Mock fuer einen aktiven Antrag. */
const activeRequest = {
  uid: "req-active-1",
  status: "open",
  recipeName: "Spaghetti Bolognese",
} as unknown as RequestDomain;

/** Zweiter aktiver Antrag. */
const activeRequestTwo = {
  uid: "req-active-2",
  status: "open",
  recipeName: "Risotto",
} as unknown as RequestDomain;

/** Geschlossener Antrag. */
const closedRequest = {
  uid: "req-closed-1",
  status: "done",
  recipeName: "Gulasch",
} as unknown as RequestDomain;

/** State mit geladenen aktiven Antraegen. */
const stateWithActiveRequests: State = {
  ...initialState,
  requests: [activeRequest, activeRequestTwo],
  activeRequests: [activeRequest, activeRequestTwo],
};

/** State mit aktiven und geschlossenen Antraegen. */
const stateWithAllRequests: State = {
  ...stateWithActiveRequests,
  closedRequests: [closedRequest],
  closedRequestsFetched: true,
};

/* ===================================================================
// ======================== Tests =====================================
// =================================================================== */

describe("requestReducer", () => {
  // ---------------------------------------------------------------
  // 1. FETCH_INIT
  // ---------------------------------------------------------------
  test("FETCH_INIT setzt isLoading auf true", () => {
    const action: DispatchAction = {
      type: ReducerActions.FETCH_INIT,
      payload: {},
    };

    const next = requestReducer(initialState, action);

    expect(next.isLoading).toBe(true);
  });

  // ---------------------------------------------------------------
  // 2. FETCH_SUCCESS
  // ---------------------------------------------------------------
  test("FETCH_SUCCESS befuellt requests und activeRequests, setzt isLoading auf false", () => {
    const loadingState: State = {
      ...initialState,
      isLoading: true,
    };

    const action: DispatchAction = {
      type: ReducerActions.FETCH_SUCCESS,
      payload: [activeRequest, activeRequestTwo],
    };

    const next = requestReducer(loadingState, action);

    expect(next.requests).toEqual([activeRequest, activeRequestTwo]);
    expect(next.activeRequests).toEqual([activeRequest, activeRequestTwo]);
    expect(next.isLoading).toBe(false);
  });

  // ---------------------------------------------------------------
  // 3. FETCH_CLOSED_REQUESTS
  // ---------------------------------------------------------------
  test("FETCH_CLOSED_REQUESTS merged geschlossene mit aktiven, setzt closedRequestsFetched", () => {
    const action: DispatchAction = {
      type: ReducerActions.FETCH_CLOSED_REQUESTS,
      payload: [closedRequest],
    };

    const next = requestReducer(stateWithActiveRequests, action);

    // Requests enthaelt aktive + geschlossene
    expect(next.requests).toEqual([
      activeRequest,
      activeRequestTwo,
      closedRequest,
    ]);
    expect(next.closedRequests).toEqual([closedRequest]);
    expect(next.closedRequestsFetched).toBe(true);
    expect(next.isLoading).toBe(false);
  });

  // ---------------------------------------------------------------
  // 4. UPDATE_REQUEST_SELECTION — "all"
  // ---------------------------------------------------------------
  test("UPDATE_REQUEST_SELECTION mit 'all' kombiniert aktive und geschlossene Antraege", () => {
    const action: DispatchAction = {
      type: ReducerActions.UPDATE_REQUEST_SELECTION,
      payload: {newStateFilter: RequestStateFilter.All},
    };

    const next = requestReducer(stateWithAllRequests, action);

    expect(next.requests).toEqual([
      activeRequest,
      activeRequestTwo,
      closedRequest,
    ]);
  });

  // ---------------------------------------------------------------
  // 5. UPDATE_REQUEST_SELECTION — "active"
  // ---------------------------------------------------------------
  test("UPDATE_REQUEST_SELECTION mit 'active' zeigt nur aktive Antraege", () => {
    // Starte mit kombiniertem State
    const combinedState: State = {
      ...stateWithAllRequests,
      requests: [activeRequest, activeRequestTwo, closedRequest],
    };

    const action: DispatchAction = {
      type: ReducerActions.UPDATE_REQUEST_SELECTION,
      payload: {newStateFilter: RequestStateFilter.Active},
    };

    const next = requestReducer(combinedState, action);

    expect(next.requests).toEqual([activeRequest, activeRequestTwo]);
  });

  // ---------------------------------------------------------------
  // 6. UPDATE_SINGLE_REQUEST
  // ---------------------------------------------------------------
  test("UPDATE_SINGLE_REQUEST aktualisiert den richtigen Antrag anhand der UID", () => {
    const updatedRequest = {
      ...activeRequest,
      recipeName: "Spaghetti Carbonara",
    } as RequestDomain;

    const action: DispatchAction = {
      type: ReducerActions.UPDATE_SINGLE_REQUEST,
      payload: updatedRequest,
    };

    const next = requestReducer(stateWithActiveRequests, action);

    // Aktualisierter Antrag hat neuen Namen
    const found = next.requests.find(
      (request) => request.uid === "req-active-1",
    );
    expect(found?.recipeName).toBe("Spaghetti Carbonara");

    // Anderer Antrag bleibt unveraendert
    const unchanged = next.requests.find(
      (request) => request.uid === "req-active-2",
    );
    expect(unchanged?.recipeName).toBe("Risotto");
  });

  // ---------------------------------------------------------------
  // 7. SNACKBAR_SHOW / SNACKBAR_CLOSE
  // ---------------------------------------------------------------
  test("SNACKBAR_SHOW oeffnet die Snackbar mit Nachricht", () => {
    const action: DispatchAction = {
      type: ReducerActions.SNACKBAR_SHOW,
      payload: {message: "Antrag gespeichert"},
    };

    const next = requestReducer(initialState, action);

    expect(next.snackbar.open).toBe(true);
    expect(next.snackbar.severity).toBe("success");
    expect(next.snackbar.message).toBe("Antrag gespeichert");
  });

  test("SNACKBAR_CLOSE schliesst die Snackbar", () => {
    const openSnackbarState: State = {
      ...initialState,
      snackbar: {open: true, severity: "success", message: "Gespeichert!"},
    };

    const action: DispatchAction = {
      type: ReducerActions.SNACKBAR_CLOSE,
      payload: {},
    };

    const next = requestReducer(openSnackbarState, action);

    expect(next.snackbar.open).toBe(false);
    expect(next.snackbar.message).toBe("");
  });

  // ---------------------------------------------------------------
  // 8. GENERIC_ERROR
  // ---------------------------------------------------------------
  test("GENERIC_ERROR setzt error und stoppt Loading", () => {
    const loadingState: State = {
      ...initialState,
      isLoading: true,
    };

    const testError = new Error("Netzwerkfehler");
    const action: DispatchAction = {
      type: ReducerActions.GENERIC_ERROR,
      payload: testError,
    };

    const next = requestReducer(loadingState, action);

    expect(next.error).toBe(testError);
    expect(next.isLoading).toBe(false);
  });
});
