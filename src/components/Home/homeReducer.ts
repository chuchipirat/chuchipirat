import {EventDomain} from "../Database/Repository/EventRepository";
import {FeedDomain} from "../Database/Repository/FeedRepository";
import {Kpi} from "../Database/Repository/StatsRepository";
import {SystemMessageDomain} from "../Database/Repository/SystemMessageRepository";
import {
  SnackbarState,
  SNACKBAR_INITIAL_STATE_VALUES,
} from "../Shared/customSnackbar";

/* ===================================================================
// ============================ Dispatcher ===========================
// =================================================================== */

/**
 * Aktionen für den Home-Reducer.
 * String-Enum für bessere Debugbarkeit in DevTools.
 */
export enum ReducerActions {
  EVENTS_FETCH_INIT = "EVENTS_FETCH_INIT",
  EVENTS_FETCH_SUCCESS = "EVENTS_FETCH_SUCCESS",
  EVENTS_FETCH_ERROR = "EVENTS_FETCH_ERROR",
  NEWEST_RECIPES_FETCH_INIT = "NEWEST_RECIPES_FETCH_INIT",
  NEWEST_RECIPES_FETCH_SUCCESS = "NEWEST_RECIPES_FETCH_SUCCESS",
  NEWEST_RECIPES_FETCH_ERROR = "NEWEST_RECIPES_FETCH_ERROR",
  FEED_FETCH_INIT = "FEED_FETCH_INIT",
  FEED_FETCH_SUCCESS = "FEED_FETCH_SUCCESS",
  FEED_FETCH_ERROR = "FEED_FETCH_ERROR",
  STATS_FETCH_INIT = "STATS_FETCH_INIT",
  STATS_FETCH_SUCCESS = "STATS_FETCH_SUCCESS",
  STATS_FETCH_ERROR = "STATS_FETCH_ERROR",
  SYSTEM_MESSAGE_FETCH_SUCCESS = "SYSTEM_MESSAGE_FETCH_SUCCESS",
  TOGGLE_PASSED_EVENTS = "TOGGLE_PASSED_EVENTS",
  SNACKBAR_SET = "SNACKBAR_SET",
  SNACKBAR_CLOSE = "SNACKBAR_CLOSE",
}

/**
 * Diskriminierte Union für alle Dispatcher-Aktionen.
 * Stellt sicher, dass jede Aktion nur mit dem richtigen Payload aufgerufen wird.
 */
export type DispatchAction =
  | {type: ReducerActions.EVENTS_FETCH_INIT}
  | {type: ReducerActions.EVENTS_FETCH_SUCCESS; payload: {actual: EventDomain[]; passed: EventDomain[]}}
  | {type: ReducerActions.EVENTS_FETCH_ERROR; payload: Error}
  | {type: ReducerActions.NEWEST_RECIPES_FETCH_INIT}
  | {type: ReducerActions.NEWEST_RECIPES_FETCH_SUCCESS; payload: FeedDomain[]}
  | {type: ReducerActions.NEWEST_RECIPES_FETCH_ERROR; payload: Error}
  | {type: ReducerActions.FEED_FETCH_INIT}
  | {type: ReducerActions.FEED_FETCH_SUCCESS; payload: FeedDomain[]}
  | {type: ReducerActions.FEED_FETCH_ERROR; payload: Error}
  | {type: ReducerActions.STATS_FETCH_INIT}
  | {type: ReducerActions.STATS_FETCH_SUCCESS; payload: Kpi[]}
  | {type: ReducerActions.STATS_FETCH_ERROR; payload: Error}
  | {type: ReducerActions.TOGGLE_PASSED_EVENTS}
  | {type: ReducerActions.SYSTEM_MESSAGE_FETCH_SUCCESS; payload: SystemMessageDomain[]}
  | {type: ReducerActions.SNACKBAR_SET; payload: SnackbarState}
  | {type: ReducerActions.SNACKBAR_CLOSE};

/**
 * State der Startseite mit per-Section-Fehlern.
 *
 * @param events - Aktuelle (zukünftige) Anlässe des Benutzers
 * @param passedEvents - Vergangene Anlässe (aus demselben Fetch, clientseitig gefiltert)
 * @param showPassedEvents - Ob vergangene Anlässe angezeigt werden sollen
 * @param recipes - Neueste publizierte Rezepte
 * @param feed - Feed-Einträge (Aktivitäten)
 * @param stats - Plattform-KPIs
 * @param systemMessages - Systemmeldungen
 * @param snackbar - Snackbar-State
 * @param isLoadingEvents - Ladeindikator Anlässe
 * @param isLoadingNewestRecipes - Ladeindikator Rezepte
 * @param isLoadingFeed - Ladeindikator Feed
 * @param isLoadingStats - Ladeindikator Statistik
 * @param eventsError - Fehler beim Laden der Anlässe
 * @param recipesError - Fehler beim Laden der Rezepte
 * @param feedError - Fehler beim Laden des Feeds
 * @param statsError - Fehler beim Laden der Statistik
 */
export type State = {
  events: EventDomain[];
  passedEvents: EventDomain[];
  showPassedEvents: boolean;
  recipes: FeedDomain[];
  feed: FeedDomain[];
  stats: Kpi[];
  systemMessages: SystemMessageDomain[];
  snackbar: SnackbarState;
  isLoadingEvents: boolean;
  isLoadingNewestRecipes: boolean;
  isLoadingFeed: boolean;
  isLoadingStats: boolean;
  eventsError: Error | null;
  recipesError: Error | null;
  feedError: Error | null;
  statsError: Error | null;
};

export const initialState: State = {
  events: [],
  passedEvents: [],
  showPassedEvents: false,
  recipes: [],
  feed: [],
  stats: [],
  systemMessages: [],
  snackbar: SNACKBAR_INITIAL_STATE_VALUES,
  isLoadingEvents: false,
  isLoadingNewestRecipes: false,
  isLoadingFeed: false,
  isLoadingStats: false,
  eventsError: null,
  recipesError: null,
  feedError: null,
  statsError: null,
};

/**
 * Reducer für die Startseite. Verwaltet Lade- und Fehlerzustände
 * für alle 5 Datenquellen (Events, Rezepte, Feed, Stats, Systemmeldungen).
 *
 * @param state - Aktueller State
 * @param action - Diskriminierte Aktion
 * @returns Neuer State
 */
export const homeReducer = (state: State, action: DispatchAction): State => {
  switch (action.type) {
    case ReducerActions.EVENTS_FETCH_INIT:
      return {...state, isLoadingEvents: true, eventsError: null};
    case ReducerActions.EVENTS_FETCH_SUCCESS:
      return {
        ...state,
        isLoadingEvents: false,
        events: action.payload.actual,
        passedEvents: action.payload.passed,
      };
    case ReducerActions.EVENTS_FETCH_ERROR:
      return {...state, isLoadingEvents: false, eventsError: action.payload};
    case ReducerActions.NEWEST_RECIPES_FETCH_INIT:
      return {...state, isLoadingNewestRecipes: true, recipesError: null};
    case ReducerActions.NEWEST_RECIPES_FETCH_SUCCESS:
      return {...state, isLoadingNewestRecipes: false, recipes: action.payload};
    case ReducerActions.NEWEST_RECIPES_FETCH_ERROR:
      return {...state, isLoadingNewestRecipes: false, recipesError: action.payload};
    case ReducerActions.FEED_FETCH_INIT:
      return {...state, isLoadingFeed: true, feedError: null};
    case ReducerActions.FEED_FETCH_SUCCESS:
      return {...state, isLoadingFeed: false, feed: action.payload};
    case ReducerActions.FEED_FETCH_ERROR:
      return {...state, isLoadingFeed: false, feedError: action.payload};
    case ReducerActions.STATS_FETCH_INIT:
      return {...state, isLoadingStats: true, statsError: null};
    case ReducerActions.STATS_FETCH_SUCCESS:
      return {...state, isLoadingStats: false, stats: action.payload};
    case ReducerActions.STATS_FETCH_ERROR:
      return {...state, isLoadingStats: false, statsError: action.payload};
    case ReducerActions.TOGGLE_PASSED_EVENTS:
      return {...state, showPassedEvents: !state.showPassedEvents};
    case ReducerActions.SYSTEM_MESSAGE_FETCH_SUCCESS:
      return {...state, systemMessages: action.payload};
    case ReducerActions.SNACKBAR_SET:
      return {...state, snackbar: action.payload};
    case ReducerActions.SNACKBAR_CLOSE:
      return {...state, snackbar: SNACKBAR_INITIAL_STATE_VALUES};
    default: {
      const exhaustiveCheck: never = action;
      throw new Error(`Unbekannter ActionType: ${exhaustiveCheck}`);
    }
  }
};
