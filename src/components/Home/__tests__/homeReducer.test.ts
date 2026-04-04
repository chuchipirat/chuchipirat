/**
 * Unit-Tests fuer den homeReducer.
 *
 * Testet alle 16 Aktionstypen, den Initialzustand und die
 * Exhaustive-Check-Absicherung bei unbekannten Aktionen.
 */
import {
  homeReducer,
  initialState,
  ReducerActions,
  DispatchAction,
  State,
} from "../homeReducer";
import {SNACKBAR_INITIAL_STATE_VALUES} from "../../Shared/customSnackbar";

/* ===================================================================
// ======================== Hilfsfunktionen ==========================
// =================================================================== */

/**
 * Erzeugt einen State mit optionalen Overrides.
 */
function stateWith(overrides: Partial<State>): State {
  return {...initialState, ...overrides};
}

/* ===================================================================
// ======================== Tests =====================================
// =================================================================== */

describe("homeReducer", () => {
  describe("initialState", () => {
    test("hat korrekte Standardwerte", () => {
      expect(initialState.events).toEqual([]);
      expect(initialState.passedEvents).toEqual([]);
      expect(initialState.showPassedEvents).toBe(false);
      expect(initialState.recipes).toEqual([]);
      expect(initialState.feed).toEqual([]);
      expect(initialState.stats).toEqual([]);
      expect(initialState.systemMessages).toEqual([]);
      expect(initialState.snackbar).toEqual(SNACKBAR_INITIAL_STATE_VALUES);
      expect(initialState.isLoadingEvents).toBe(false);
      expect(initialState.isLoadingNewestRecipes).toBe(false);
      expect(initialState.isLoadingFeed).toBe(false);
      expect(initialState.isLoadingStats).toBe(false);
      expect(initialState.eventsError).toBeNull();
      expect(initialState.recipesError).toBeNull();
      expect(initialState.feedError).toBeNull();
      expect(initialState.statsError).toBeNull();
    });
  });

  /* ------------------------------------------
  // Events
  // ------------------------------------------ */
  describe("Events", () => {
    test("EVENTS_FETCH_INIT setzt isLoadingEvents und loescht Fehler", () => {
      const state = stateWith({eventsError: new Error("alt")});
      const result = homeReducer(state, {type: ReducerActions.EVENTS_FETCH_INIT});

      expect(result.isLoadingEvents).toBe(true);
      expect(result.eventsError).toBeNull();
    });

    test("EVENTS_FETCH_SUCCESS teilt in actual und passed auf", () => {
      const actual = [{uid: "a1"} as any];
      const passed = [{uid: "p1"} as any];
      const state = stateWith({isLoadingEvents: true});

      const result = homeReducer(state, {
        type: ReducerActions.EVENTS_FETCH_SUCCESS,
        payload: {actual, passed},
      });

      expect(result.isLoadingEvents).toBe(false);
      expect(result.events).toBe(actual);
      expect(result.passedEvents).toBe(passed);
    });

    test("EVENTS_FETCH_ERROR setzt Fehler und beendet Laden", () => {
      const error = new Error("Events fehlgeschlagen");
      const state = stateWith({isLoadingEvents: true});

      const result = homeReducer(state, {
        type: ReducerActions.EVENTS_FETCH_ERROR,
        payload: error,
      });

      expect(result.isLoadingEvents).toBe(false);
      expect(result.eventsError).toBe(error);
    });
  });

  /* ------------------------------------------
  // Neueste Rezepte
  // ------------------------------------------ */
  describe("Neueste Rezepte", () => {
    test("NEWEST_RECIPES_FETCH_INIT setzt isLoadingNewestRecipes", () => {
      const state = stateWith({recipesError: new Error("alt")});
      const result = homeReducer(state, {type: ReducerActions.NEWEST_RECIPES_FETCH_INIT});

      expect(result.isLoadingNewestRecipes).toBe(true);
      expect(result.recipesError).toBeNull();
    });

    test("NEWEST_RECIPES_FETCH_SUCCESS setzt Rezepte", () => {
      const recipes = [{uid: "r1"} as any];
      const state = stateWith({isLoadingNewestRecipes: true});

      const result = homeReducer(state, {
        type: ReducerActions.NEWEST_RECIPES_FETCH_SUCCESS,
        payload: recipes,
      });

      expect(result.isLoadingNewestRecipes).toBe(false);
      expect(result.recipes).toBe(recipes);
    });

    test("NEWEST_RECIPES_FETCH_ERROR setzt Fehler", () => {
      const error = new Error("Rezepte fehlgeschlagen");
      const state = stateWith({isLoadingNewestRecipes: true});

      const result = homeReducer(state, {
        type: ReducerActions.NEWEST_RECIPES_FETCH_ERROR,
        payload: error,
      });

      expect(result.isLoadingNewestRecipes).toBe(false);
      expect(result.recipesError).toBe(error);
    });
  });

  /* ------------------------------------------
  // Feed
  // ------------------------------------------ */
  describe("Feed", () => {
    test("FEED_FETCH_INIT setzt isLoadingFeed", () => {
      const state = stateWith({feedError: new Error("alt")});
      const result = homeReducer(state, {type: ReducerActions.FEED_FETCH_INIT});

      expect(result.isLoadingFeed).toBe(true);
      expect(result.feedError).toBeNull();
    });

    test("FEED_FETCH_SUCCESS setzt Feed-Daten", () => {
      const feed = [{uid: "f1"} as any];
      const state = stateWith({isLoadingFeed: true});

      const result = homeReducer(state, {
        type: ReducerActions.FEED_FETCH_SUCCESS,
        payload: feed,
      });

      expect(result.isLoadingFeed).toBe(false);
      expect(result.feed).toBe(feed);
    });

    test("FEED_FETCH_ERROR setzt Fehler", () => {
      const error = new Error("Feed fehlgeschlagen");
      const state = stateWith({isLoadingFeed: true});

      const result = homeReducer(state, {
        type: ReducerActions.FEED_FETCH_ERROR,
        payload: error,
      });

      expect(result.isLoadingFeed).toBe(false);
      expect(result.feedError).toBe(error);
    });
  });

  /* ------------------------------------------
  // Stats
  // ------------------------------------------ */
  describe("Stats", () => {
    test("STATS_FETCH_INIT setzt isLoadingStats", () => {
      const state = stateWith({statsError: new Error("alt")});
      const result = homeReducer(state, {type: ReducerActions.STATS_FETCH_INIT});

      expect(result.isLoadingStats).toBe(true);
      expect(result.statsError).toBeNull();
    });

    test("STATS_FETCH_SUCCESS setzt Stats-Daten", () => {
      const stats = [{id: "s1", value: 42, caption: "Test", group: "G"}];
      const state = stateWith({isLoadingStats: true});

      const result = homeReducer(state, {
        type: ReducerActions.STATS_FETCH_SUCCESS,
        payload: stats,
      });

      expect(result.isLoadingStats).toBe(false);
      expect(result.stats).toBe(stats);
    });

    test("STATS_FETCH_ERROR setzt Fehler", () => {
      const error = new Error("Stats fehlgeschlagen");
      const state = stateWith({isLoadingStats: true});

      const result = homeReducer(state, {
        type: ReducerActions.STATS_FETCH_ERROR,
        payload: error,
      });

      expect(result.isLoadingStats).toBe(false);
      expect(result.statsError).toBe(error);
    });
  });

  /* ------------------------------------------
  // Toggle / System Messages / Snackbar
  // ------------------------------------------ */
  describe("TOGGLE_PASSED_EVENTS", () => {
    test("toggelt showPassedEvents von false auf true", () => {
      const result = homeReducer(initialState, {type: ReducerActions.TOGGLE_PASSED_EVENTS});
      expect(result.showPassedEvents).toBe(true);
    });

    test("toggelt showPassedEvents von true auf false", () => {
      const state = stateWith({showPassedEvents: true});
      const result = homeReducer(state, {type: ReducerActions.TOGGLE_PASSED_EVENTS});
      expect(result.showPassedEvents).toBe(false);
    });
  });

  describe("SYSTEM_MESSAGE_FETCH_SUCCESS", () => {
    test("setzt Systemmeldungen", () => {
      const messages = [{uid: "m1", text: "Test"} as any];
      const result = homeReducer(initialState, {
        type: ReducerActions.SYSTEM_MESSAGE_FETCH_SUCCESS,
        payload: messages,
      });
      expect(result.systemMessages).toBe(messages);
    });
  });

  describe("Snackbar", () => {
    test("SNACKBAR_SET setzt Snackbar-Daten", () => {
      const snackbar = {open: true, message: "Gespeichert", severity: "success" as const};
      const result = homeReducer(initialState, {
        type: ReducerActions.SNACKBAR_SET,
        payload: snackbar,
      });
      expect(result.snackbar).toBe(snackbar);
    });

    test("SNACKBAR_CLOSE setzt auf Initialwerte zurueck", () => {
      const state = stateWith({
        snackbar: {open: true, message: "Test", severity: "error" as const},
      });
      const result = homeReducer(state, {type: ReducerActions.SNACKBAR_CLOSE});
      expect(result.snackbar).toEqual(SNACKBAR_INITIAL_STATE_VALUES);
    });
  });

  /* ------------------------------------------
  // Exhaustive Check
  // ------------------------------------------ */
  describe("Exhaustive Check", () => {
    test("wirft bei unbekanntem ActionType", () => {
      const unknownAction = {type: "UNKNOWN_ACTION"} as unknown as DispatchAction;
      expect(() => homeReducer(initialState, unknownAction)).toThrow(
        /Unbekannter ActionType/,
      );
    });
  });

  /* ------------------------------------------
  // String Enum
  // ------------------------------------------ */
  describe("ReducerActions Enum", () => {
    test("verwendet String-Werte (nicht numerisch)", () => {
      expect(ReducerActions.EVENTS_FETCH_INIT).toBe("EVENTS_FETCH_INIT");
      expect(ReducerActions.SNACKBAR_CLOSE).toBe("SNACKBAR_CLOSE");
      expect(ReducerActions.TOGGLE_PASSED_EVENTS).toBe("TOGGLE_PASSED_EVENTS");
    });
  });
});
