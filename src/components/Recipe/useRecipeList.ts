/**
 * Hook für die seitenweise Rezeptliste (Rezeptseite und Rezept-Schublade).
 *
 * - Lädt die erste Seite (24 Karten) und wächst beim Scrollen: Ein
 *   `IntersectionObserver` startet die nächste Seite, bevor das Ende sichtbar ist.
 * - Suche und Filter laufen in der Datenbank und gelten für alle Rezepte.
 *   Der Suchtext geht nach kurzer Pause raus, veraltete Anfragen werden
 *   abgebrochen.
 * - Bis die Datenbank antwortet, zeigt die Liste eine sofortige Vorschau: die
 *   bereits geladenen Karten, lokal gefiltert. Trifft die Antwort ein, ersetzt
 *   sie die Vorschau.
 * - Bereits geladene Listen bleiben pro Abfrage erhalten (Zurück zur leeren
 *   Suche ist sofort da).
 */
import React from "react";
import * as Sentry from "@sentry/react";

import {useDatabase} from "../Database/DatabaseContext";
import {
  RECIPE_LIST_PAGE_SIZE,
  RecipeListCursor,
  RecipeListPage,
} from "../Database/Repository/RecipeRepository";
import {useDebouncedValue} from "../../hooks/useDebouncedValue";
import {SearchSettings} from "./recipeList.types";
import {RecipeShort} from "./recipe.types";
import {
  RecipeListCacheEntry,
  saveRecipeListCache,
} from "./recipeListCache";
import {
  RECIPE_LIST_SEARCH_DEBOUNCE_MS,
  buildRecipeListQuery,
  domainToRecipeShort,
  filterRecipes,
  getRecipeListQueryKey,
  sortRecipesByName,
} from "./recipeListUtils";

/** Wie viele verschiedene Abfragen gleichzeitig im Speicher bleiben. */
const MAX_KEPT_LISTS = 8;

/** Abstand unter dem Listenende, ab dem die nächste Seite geladen wird. */
const PREFETCH_ROOT_MARGIN = "0px 0px 800px 0px";

/**
 * Bestätigte (von der Datenbank gelieferte) Liste zu einer Abfrage.
 *
 * @param recipes Geladene Karten in Reihenfolge der Datenbank.
 * @param cursor Cursor zum Nachladen (`null` am Ende).
 * @param hasMore Ob weitere Seiten folgen.
 * @param total Gesamtzahl der Treffer (aus der ersten Seite).
 */
type ConfirmedList = {
  recipes: RecipeShort[];
  cursor: RecipeListCursor | null;
  hasMore: boolean;
  total: number | null;
};

type KeyedError = {key: string; error: Error};

type State = {
  lists: Record<string, ConfirmedList>;
  /** Schlüssel in Reihenfolge der letzten Verwendung (für die Begrenzung). */
  order: string[];
  pendingKey: string | null;
  loadingMoreKey: string | null;
  error: KeyedError | null;
  loadMoreError: KeyedError | null;
};

type Action =
  | {type: "FIRST_START"; key: string}
  | {type: "FIRST_SUCCESS"; key: string; list: ConfirmedList}
  | {type: "FIRST_ERROR"; key: string; error: Error}
  | {type: "MORE_START"; key: string}
  | {type: "MORE_SUCCESS"; key: string; page: RecipeListPage}
  | {type: "MORE_ERROR"; key: string; error: Error}
  | {type: "RESET"};

const EMPTY_STATE: State = {
  lists: {},
  order: [],
  pendingKey: null,
  loadingMoreKey: null,
  error: null,
  loadMoreError: null,
};

/**
 * Wandelt eine Seite der Datenbank in eine bestätigte Liste um.
 *
 * @param page Seite aus `RecipeRepository.listRecipeShorts`.
 * @returns Bestätigte Liste mit UI-Karten.
 */
const toConfirmedList = (page: RecipeListPage): ConfirmedList => ({
  recipes: page.recipes.map(domainToRecipeShort),
  cursor: page.nextCursor,
  hasMore: page.hasMore,
  total: page.total,
});

/**
 * Setzt eine Liste ein und begrenzt die Anzahl gehaltener Abfragen.
 *
 * @param state Aktueller Zustand.
 * @param key Abfrage-Schlüssel.
 * @param list Neue Liste.
 * @returns Zustand mit der Liste (älteste Abfragen sind entfernt).
 */
const putList = (state: State, key: string, list: ConfirmedList): State => {
  const order = [...state.order.filter((entry) => entry !== key), key];
  const lists = {...state.lists, [key]: list};
  while (order.length > MAX_KEPT_LISTS) {
    delete lists[order.shift() as string];
  }
  return {...state, lists, order};
};

/**
 * Reducer der Rezeptliste.
 *
 * @param state Aktueller Zustand.
 * @param action Aktion.
 * @returns Neuer Zustand.
 */
const listReducer = (state: State, action: Action): State => {
  switch (action.type) {
    case "FIRST_START":
      return {...state, pendingKey: action.key, error: null};
    case "FIRST_SUCCESS":
      return {
        ...putList(state, action.key, action.list),
        pendingKey: state.pendingKey === action.key ? null : state.pendingKey,
        error: null,
      };
    case "FIRST_ERROR":
      return {
        ...state,
        pendingKey: state.pendingKey === action.key ? null : state.pendingKey,
        error: {key: action.key, error: action.error},
      };
    case "MORE_START":
      return {...state, loadingMoreKey: action.key, loadMoreError: null};
    case "MORE_SUCCESS": {
      const current = state.lists[action.key];
      if (!current) return {...state, loadingMoreKey: null};
      const known = new Set(current.recipes.map((recipe) => recipe.uid));
      const added = action.page.recipes
        .map(domainToRecipeShort)
        .filter((recipe) => !known.has(recipe.uid));
      return {
        ...putList(state, action.key, {
          ...current,
          recipes: [...current.recipes, ...added],
          cursor: action.page.nextCursor,
          hasMore: action.page.hasMore,
        }),
        loadingMoreKey: null,
      };
    }
    case "MORE_ERROR":
      return {
        ...state,
        loadingMoreKey: null,
        loadMoreError: {key: action.key, error: action.error},
      };
    case "RESET":
      return EMPTY_STATE;
    default: {
      const _exhaustive: never = action;
      throw new Error(`Unbekannte Aktion: ${JSON.stringify(_exhaustive)}`);
    }
  }
};

/**
 * Parameter für {@link useRecipeList}.
 *
 * @param searchSettings Aktuelle Sucheinstellungen (inkl. noch nicht abgeschickter Eingabe).
 * @param userId Auth-UID der angemeldeten Person.
 * @param eventUid Anlass, dessen Varianten mitgeliefert werden (nur Rezept-Schublade).
 * @param enabled Ob geladen wird. Die Rezept-Schublade ist immer eingehängt, lädt aber erst beim ersten Öffnen.
 * @param useCache Ob der Stand im sessionStorage gemerkt wird (nur Rezeptseite).
 * @param restoredCache Aus dem sessionStorage wiederhergestellter Stand.
 * @param pageSize Karten pro Seite.
 * @param debounceMs Pause in Millisekunden, bevor der Suchtext an die Datenbank geht.
 */
type UseRecipeListParams = {
  searchSettings: SearchSettings;
  userId: string;
  eventUid?: string;
  enabled?: boolean;
  useCache?: boolean;
  restoredCache?: RecipeListCacheEntry | null;
  pageSize?: number;
  debounceMs?: number;
};

/**
 * Ergebnis von {@link useRecipeList}.
 *
 * @param recipes Anzuzeigende Karten (bestätigt oder vorläufig).
 * @param total Gesamtzahl der Treffer; `null`, solange die Liste nur vorläufig ist.
 * @param isProvisional `true`, solange die Datenbank noch nicht geantwortet hat.
 * @param hasMore Ob weitere Karten nachgeladen werden können.
 * @param isLoadingMore Ob gerade eine weitere Seite geladen wird.
 * @param hasConfirmedNoResults `true`, wenn die Datenbank bestätigt: keine Treffer.
 * @param error Fehler beim Laden der ersten Seite.
 * @param loadMoreError Fehler beim Nachladen (Knopf «Mehr laden» als Rückfall).
 * @param loadMore Lädt die nächste Seite (auch als erneuter Versuch).
 * @param reload Verwirft alle geladenen Listen und lädt neu.
 * @param sentinelRef Ref für das Element am Listenende (löst das Nachladen aus).
 * @param restoredFromCache Ob der Stand aus dem sessionStorage kam.
 */
export type UseRecipeListResult = {
  recipes: RecipeShort[];
  total: number | null;
  isProvisional: boolean;
  hasMore: boolean;
  isLoadingMore: boolean;
  hasConfirmedNoResults: boolean;
  error: Error | null;
  loadMoreError: Error | null;
  loadMore: () => void;
  reload: () => void;
  sentinelRef: (node: Element | null) => void;
  restoredFromCache: boolean;
};

/**
 * Erstellt den Anfangszustand, gegebenenfalls aus dem wiederhergestellten Cache.
 *
 * @param restoredCache Wiederhergestellter Stand oder `null`.
 * @param initialKey Schlüssel der Abfrage, mit der die Seite startet.
 * @returns Anfangszustand.
 */
const createInitialState = (
  restoredCache: RecipeListCacheEntry | null | undefined,
  initialKey: string,
): State => {
  if (!restoredCache || restoredCache.queryKey !== initialKey) {
    return EMPTY_STATE;
  }
  return {
    ...EMPTY_STATE,
    lists: {
      [initialKey]: {
        recipes: restoredCache.recipes,
        cursor: restoredCache.cursor,
        hasMore: restoredCache.hasMore,
        total: restoredCache.total,
      },
    },
    order: [initialKey],
  };
};

/**
 * Seitenweise Rezeptliste mit Suche und Filtern in der Datenbank.
 *
 * @param params Siehe {@link UseRecipeListParams}.
 * @returns Siehe {@link UseRecipeListResult}.
 * @example
 * const list = useRecipeList({searchSettings, userId: authUser.uid});
 * list.recipes.map(renderCard); // <div ref={list.sentinelRef} /> am Ende
 */
export const useRecipeList = ({
  searchSettings,
  userId,
  eventUid,
  enabled = true,
  useCache = false,
  restoredCache = null,
  pageSize = RECIPE_LIST_PAGE_SIZE,
  debounceMs = RECIPE_LIST_SEARCH_DEBOUNCE_MS,
}: UseRecipeListParams): UseRecipeListResult => {
  const database = useDatabase();
  const debouncedSearchString = useDebouncedValue(
    searchSettings.searchString,
    debounceMs,
  );

  // Abfrage zur sofortigen Anzeige (Eingabe) und zur Datenbank (nach Pause)
  const immediateQuery = React.useMemo(
    () => buildRecipeListQuery(searchSettings, eventUid),
    [searchSettings, eventUid],
  );
  const immediateKey = getRecipeListQueryKey(immediateQuery);
  const fetchQuery = React.useMemo(
    () =>
      buildRecipeListQuery(
        {...searchSettings, searchString: debouncedSearchString},
        eventUid,
      ),
    [searchSettings, debouncedSearchString, eventUid],
  );
  const fetchKey = getRecipeListQueryKey(fetchQuery);

  const [state, dispatch] = React.useReducer(
    listReducer,
    undefined,
    () => createInitialState(restoredCache, immediateKey),
  );
  const [reloadToken, setReloadToken] = React.useState(0);
  const [sentinelNode, setSentinelNode] = React.useState<Element | null>(null);
  const restoredFromCache = React.useRef(
    Boolean(restoredCache && restoredCache.queryKey === immediateKey),
  ).current;

  // Aktuelle Werte für Callbacks und Effekte, ohne sie neu zu erzeugen
  const stateRef = React.useRef(state);
  stateRef.current = state;
  const fetchQueryRef = React.useRef(fetchQuery);
  fetchQueryRef.current = fetchQuery;
  const immediateQueryRef = React.useRef(immediateQuery);
  immediateQueryRef.current = immediateQuery;
  const immediateKeyRef = React.useRef(immediateKey);
  immediateKeyRef.current = immediateKey;
  const settingsRef = React.useRef(searchSettings);
  settingsRef.current = searchSettings;

  /* ------------------------------------------
  // Erste Seite laden, sobald die Abfrage (nach Pause) feststeht
  // ------------------------------------------ */
  React.useEffect(() => {
    if (!enabled || stateRef.current.lists[fetchKey]) return;

    const controller = new AbortController();
    dispatch({type: "FIRST_START", key: fetchKey});
    database.recipes
      .listRecipeShorts({...fetchQueryRef.current, limit: pageSize}, controller.signal)
      .then((page) => {
        if (controller.signal.aborted) return;
        dispatch({type: "FIRST_SUCCESS", key: fetchKey, list: toConfirmedList(page)});
      })
      .catch((caughtError) => {
        // Abgebrochene (veraltete) Anfragen sind kein Fehler
        if (controller.signal.aborted) return;
        Sentry.captureException(caughtError);
        dispatch({
          type: "FIRST_ERROR",
          key: fetchKey,
          error: caughtError instanceof Error ? caughtError : new Error(String(caughtError)),
        });
      });
    return () => controller.abort();
  }, [fetchKey, reloadToken, enabled, database, pageSize]);

  /* ------------------------------------------
  // Weitere Seite laden
  // ------------------------------------------ */
  const loadMore = React.useCallback(() => {
    const key = immediateKeyRef.current;
    const list = stateRef.current.lists[key];
    if (!list || !list.hasMore || stateRef.current.loadingMoreKey === key) return;

    dispatch({type: "MORE_START", key});
    database.recipes
      .listRecipeShorts({
        ...immediateQueryRef.current,
        limit: pageSize,
        after: list.cursor,
      })
      .then((page) => dispatch({type: "MORE_SUCCESS", key, page}))
      .catch((caughtError) => {
        Sentry.captureException(caughtError);
        dispatch({
          type: "MORE_ERROR",
          key,
          error: caughtError instanceof Error ? caughtError : new Error(String(caughtError)),
        });
      });
  }, [database, pageSize]);

  const reload = React.useCallback(() => {
    dispatch({type: "RESET"});
    setReloadToken((token) => token + 1);
  }, []);

  /* ------------------------------------------
  // Anzeige: bestätigte Liste oder sofortige lokale Vorschau
  // ------------------------------------------ */
  const confirmed = state.lists[immediateKey];
  const pool = React.useMemo(() => {
    const byUid = new Map<string, RecipeShort>();
    Object.values(state.lists).forEach((list) =>
      list.recipes.forEach((recipe) => byUid.set(recipe.uid, recipe)),
    );
    return [...byUid.values()];
  }, [state.lists]);
  const preview = React.useMemo(
    () =>
      confirmed ? [] : sortRecipesByName(filterRecipes(pool, searchSettings, userId)),
    [confirmed, pool, searchSettings, userId],
  );

  /* ------------------------------------------
  // Prefetch: nächste Seite laden, bevor das Ende sichtbar ist
  // ------------------------------------------ */
  const canAutoLoad =
    Boolean(confirmed?.hasMore) &&
    state.loadingMoreKey !== immediateKey &&
    state.loadMoreError?.key !== immediateKey;
  const loadedCount = confirmed?.recipes.length ?? 0;
  React.useEffect(() => {
    if (!sentinelNode || !canAutoLoad || typeof IntersectionObserver === "undefined") {
      return;
    }
    // Nach jeder Seite neu beobachten: Ist das Ende noch sichtbar, geht es gleich weiter
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) loadMore();
      },
      {rootMargin: PREFETCH_ROOT_MARGIN},
    );
    observer.observe(sentinelNode);
    return () => observer.disconnect();
  }, [sentinelNode, canAutoLoad, loadedCount, loadMore]);

  /* ------------------------------------------
  // Stand für die Rückkehr aus einem Rezept merken
  // ------------------------------------------ */
  const confirmedForFetch = state.lists[fetchKey];
  React.useEffect(() => {
    if (!useCache || !confirmedForFetch) return;
    saveRecipeListCache({
      userId,
      queryKey: fetchKey,
      searchSettings: {...settingsRef.current, searchString: debouncedSearchString},
      recipes: confirmedForFetch.recipes,
      cursor: confirmedForFetch.cursor,
      hasMore: confirmedForFetch.hasMore,
      total: confirmedForFetch.total,
    });
    // debouncedSearchString gehört zu fetchKey und ändert sich nur gemeinsam mit ihm
  }, [confirmedForFetch, fetchKey, useCache, userId]);

  return {
    recipes: confirmed ? confirmed.recipes : preview,
    total: confirmed ? confirmed.total : null,
    isProvisional: !confirmed,
    hasMore: Boolean(confirmed?.hasMore),
    isLoadingMore: state.loadingMoreKey === immediateKey,
    hasConfirmedNoResults: Boolean(confirmed) && confirmed.recipes.length === 0,
    error: !confirmed && state.error?.key === fetchKey ? state.error.error : null,
    loadMoreError:
      state.loadMoreError?.key === immediateKey ? state.loadMoreError.error : null,
    loadMore,
    reload,
    sentinelRef: setSentinelNode,
    restoredFromCache,
  };
};
