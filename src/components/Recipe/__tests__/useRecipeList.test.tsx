/**
 * Unit-Tests für den Hook useRecipeList (seitenweise Rezeptliste).
 */
import React from "react";
import {renderHook, act} from "@testing-library/react";

import {useRecipeList} from "../useRecipeList";
import {DatabaseContext} from "../../Database/DatabaseContext";
import {DatabaseService} from "../../Database/DatabaseService";
import type {
  RecipeListPage,
  RecipeShortDomain,
} from "../../Database/Repository/RecipeRepository";
import {Diet} from "../../Product/product.types";
import {INITIAL_SEARCH_SETTINGS, SearchSettings} from "../recipeList.types";
import {RecipeListCacheEntry} from "../recipeListCache";
import {
  buildRecipeListQuery,
  getRecipeListQueryKey,
} from "../recipeListUtils";

jest.mock("@sentry/react", () => ({captureException: jest.fn()}));

/* ===================================================================
// ======================== Hilfsmittel ===============================
// =================================================================== */

const mockListRecipeShorts = jest.fn();
const mockDatabase = {
  recipes: {listRecipeShorts: mockListRecipeShorts},
} as unknown as DatabaseService;

const wrapper = ({children}: {children: React.ReactNode}) => (
  <DatabaseContext.Provider value={mockDatabase}>{children}</DatabaseContext.Provider>
);

/** Kurzrezept, wie es das Repository liefert. */
const createDomain = (index: number, name?: string): RecipeShortDomain => ({
  uid: `r${String(index).padStart(3, "0")}`,
  name: name ?? `Rezept ${String(index).padStart(3, "0")}`,
  source: "",
  pictureSrc: "",
  tags: [],
  menuTypes: [],
  dietProperties: {diet: Diet.Meat, allergens: []},
  outdoorKitchenSuitable: false,
  avgRating: 0,
  noRatings: 0,
  noComments: 0,
  recipeType: "public",
  variantName: null,
  createdAt: new Date("2026-01-01"),
  createdBy: "other",
});

/** Baut eine Seite der Datenbank aus Nummern. */
const createPage = (
  indices: number[],
  options: {hasMore?: boolean; total?: number | null; names?: Record<number, string>} = {},
): RecipeListPage => {
  const recipes = indices.map((index) => createDomain(index, options.names?.[index]));
  const last = recipes[recipes.length - 1];
  const hasMore = options.hasMore ?? false;
  return {
    recipes,
    hasMore,
    nextCursor: hasMore && last ? {name: last.name, uid: last.uid} : null,
    total: options.total ?? null,
  };
};

/** Von aussen steuerbares Versprechen. */
const createDeferred = <T,>() => {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return {promise, resolve, reject};
};

const settingsWith = (overrides: Partial<SearchSettings> = {}): SearchSettings => ({
  ...INITIAL_SEARCH_SETTINGS,
  ...overrides,
});

type HookProps = {
  searchSettings: SearchSettings;
  enabled?: boolean;
  useCache?: boolean;
  restoredCache?: RecipeListCacheEntry | null;
};

const renderList = (initial: HookProps = {searchSettings: settingsWith()}) =>
  renderHook(
    (props: HookProps) => useRecipeList({userId: "user-1", debounceMs: 300, ...props}),
    {wrapper, initialProps: initial},
  );

/** Lässt ausstehende Versprechen und Zustandswechsel durchlaufen. */
const flush = async () => {
  await act(async () => {
    await Promise.resolve();
  });
};

/** Simulierter IntersectionObserver (jsdom kennt keinen). */
let observers: {
  callback: IntersectionObserverCallback;
  observe: jest.Mock;
  disconnect: jest.Mock;
}[] = [];

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  sessionStorage.clear();
  observers = [];
  (global as unknown as {IntersectionObserver: unknown}).IntersectionObserver =
    class {
      observe = jest.fn();
      disconnect = jest.fn();
      constructor(callback: IntersectionObserverCallback) {
        observers.push({callback, observe: this.observe, disconnect: this.disconnect});
      }
    };
});

afterEach(() => {
  jest.useRealTimers();
  delete (global as unknown as {IntersectionObserver?: unknown}).IntersectionObserver;
});

/* ===================================================================
// ============================ Tests =================================
// =================================================================== */

describe("useRecipeList — erste Seite", () => {
  test("lädt beim Start die erste Seite und meldet Gesamtzahl und weitere Seiten", async () => {
    mockListRecipeShorts.mockResolvedValue(createPage([1, 2, 3], {hasMore: true, total: 57}));
    const {result} = renderList();

    expect(result.current.isProvisional).toBe(true);
    expect(result.current.recipes).toEqual([]);
    expect(result.current.total).toBeNull();

    await flush();

    expect(result.current.isProvisional).toBe(false);
    expect(result.current.recipes.map((recipe) => recipe.uid)).toEqual(["r001", "r002", "r003"]);
    expect(result.current.total).toBe(57);
    expect(result.current.hasMore).toBe(true);
    expect(mockListRecipeShorts).toHaveBeenCalledTimes(1);
    expect(mockListRecipeShorts.mock.calls[0][0]).toMatchObject({scope: "all", limit: 24});
    expect(mockListRecipeShorts.mock.calls[0][1]).toBeInstanceOf(AbortSignal);
  });

  test("bestätigt «keine Treffer» erst nach der Antwort", async () => {
    mockListRecipeShorts.mockResolvedValue(createPage([], {total: 0}));
    const {result} = renderList();
    expect(result.current.hasConfirmedNoResults).toBe(false);

    await flush();

    expect(result.current.hasConfirmedNoResults).toBe(true);
  });

  test("Fehler der ersten Seite wird gemeldet, reload() versucht es erneut", async () => {
    mockListRecipeShorts.mockRejectedValueOnce(new Error("Netz weg"));
    const {result} = renderList();
    await flush();
    expect(result.current.error?.message).toBe("Netz weg");
    expect(result.current.isProvisional).toBe(true);

    mockListRecipeShorts.mockResolvedValueOnce(createPage([1], {total: 1}));
    act(() => result.current.reload());
    await flush();

    expect(mockListRecipeShorts).toHaveBeenCalledTimes(2);
    expect(result.current.error).toBeNull();
    expect(result.current.recipes).toHaveLength(1);
  });
});

describe("useRecipeList — enabled", () => {
  test("lädt nichts, solange enabled=false (Schublade geschlossen), und startet beim Aktivieren", async () => {
    mockListRecipeShorts.mockResolvedValue(createPage([1, 2], {total: 2}));
    const {result, rerender} = renderList({searchSettings: settingsWith(), enabled: false});
    await flush();
    expect(mockListRecipeShorts).not.toHaveBeenCalled();
    expect(result.current.recipes).toEqual([]);

    rerender({searchSettings: settingsWith(), enabled: true});
    await flush();

    expect(mockListRecipeShorts).toHaveBeenCalledTimes(1);
    expect(result.current.recipes).toHaveLength(2);
  });

  test("schliessen und wieder öffnen lädt nicht erneut", async () => {
    mockListRecipeShorts.mockResolvedValue(createPage([1], {total: 1}));
    const {result, rerender} = renderList({searchSettings: settingsWith(), enabled: true});
    await flush();

    rerender({searchSettings: settingsWith(), enabled: false});
    rerender({searchSettings: settingsWith(), enabled: true});
    await flush();

    expect(mockListRecipeShorts).toHaveBeenCalledTimes(1);
    expect(result.current.recipes).toHaveLength(1);
  });
});

describe("useRecipeList — weitere Seiten", () => {
  test("loadMore hängt die nächste Seite an (mit Cursor) und ignoriert Duplikate", async () => {
    mockListRecipeShorts.mockResolvedValueOnce(createPage([1, 2], {hasMore: true, total: 4}));
    const {result} = renderList();
    await flush();

    mockListRecipeShorts.mockResolvedValueOnce(createPage([2, 3, 4], {hasMore: false}));
    act(() => result.current.loadMore());
    await flush();

    expect(mockListRecipeShorts.mock.calls[1][0]).toMatchObject({
      after: {name: "Rezept 002", uid: "r002"},
    });
    expect(result.current.recipes.map((recipe) => recipe.uid)).toEqual([
      "r001",
      "r002",
      "r003",
      "r004",
    ]);
    expect(result.current.hasMore).toBe(false);
    expect(result.current.total).toBe(4);
  });

  test("startet keine zweite Seite, solange eine läuft", async () => {
    mockListRecipeShorts.mockResolvedValueOnce(createPage([1], {hasMore: true}));
    const {result} = renderList();
    await flush();

    const deferred = createDeferred<RecipeListPage>();
    mockListRecipeShorts.mockReturnValueOnce(deferred.promise);
    act(() => result.current.loadMore());
    act(() => result.current.loadMore());

    expect(mockListRecipeShorts).toHaveBeenCalledTimes(2);
    expect(result.current.isLoadingMore).toBe(true);
    deferred.resolve(createPage([2]));
    await flush();
    expect(result.current.isLoadingMore).toBe(false);
  });

  test("nichts zu laden am Ende der Liste", async () => {
    mockListRecipeShorts.mockResolvedValueOnce(createPage([1], {hasMore: false}));
    const {result} = renderList();
    await flush();

    act(() => result.current.loadMore());

    expect(mockListRecipeShorts).toHaveBeenCalledTimes(1);
  });

  test("Fehler beim Nachladen wird gemeldet, ein erneutes loadMore versucht es wieder", async () => {
    mockListRecipeShorts.mockResolvedValueOnce(createPage([1], {hasMore: true}));
    const {result} = renderList();
    await flush();

    mockListRecipeShorts.mockRejectedValueOnce(new Error("Timeout"));
    act(() => result.current.loadMore());
    await flush();
    expect(result.current.loadMoreError?.message).toBe("Timeout");
    expect(result.current.recipes).toHaveLength(1);

    mockListRecipeShorts.mockResolvedValueOnce(createPage([2]));
    act(() => result.current.loadMore());
    await flush();
    expect(result.current.loadMoreError).toBeNull();
    expect(result.current.recipes).toHaveLength(2);
  });
});

describe("useRecipeList — Prefetch beim Scrollen", () => {
  test("ein sichtbares Listenende lädt die nächste Seite, ein unsichtbares nicht", async () => {
    mockListRecipeShorts.mockResolvedValueOnce(createPage([1, 2], {hasMore: true}));
    const {result} = renderList();
    await flush();

    act(() => result.current.sentinelRef(document.createElement("div")));
    const observer = observers[observers.length - 1];
    expect(observer.observe).toHaveBeenCalled();

    act(() => observer.callback([{isIntersecting: false}] as IntersectionObserverEntry[], {} as IntersectionObserver));
    expect(mockListRecipeShorts).toHaveBeenCalledTimes(1);

    mockListRecipeShorts.mockResolvedValueOnce(createPage([3]));
    act(() => observer.callback([{isIntersecting: true}] as IntersectionObserverEntry[], {} as IntersectionObserver));
    await flush();

    expect(mockListRecipeShorts).toHaveBeenCalledTimes(2);
    expect(result.current.recipes).toHaveLength(3);
  });

  test("beobachtet nach jeder Seite neu (Ende noch sichtbar → gleich weiter)", async () => {
    mockListRecipeShorts.mockResolvedValueOnce(createPage([1], {hasMore: true}));
    const {result} = renderList();
    await flush();
    act(() => result.current.sentinelRef(document.createElement("div")));
    const before = observers.length;

    mockListRecipeShorts.mockResolvedValueOnce(createPage([2], {hasMore: true}));
    act(() => result.current.loadMore());
    await flush();

    expect(observers.length).toBeGreaterThan(before);
  });

  test("beobachtet nichts mehr, wenn die Liste zu Ende ist", async () => {
    mockListRecipeShorts.mockResolvedValueOnce(createPage([1], {hasMore: false}));
    const {result} = renderList();
    await flush();

    act(() => result.current.sentinelRef(document.createElement("div")));

    expect(observers).toHaveLength(0);
  });
});

describe("useRecipeList — Suche und Filter", () => {
  const loadInitial = async () => {
    mockListRecipeShorts.mockResolvedValueOnce(
      createPage([1, 2, 3], {
        total: 3,
        names: {1: "Hörnli und Ghackets", 2: "Spaghetti", 3: "Gemüsecurry"},
      }),
    );
    const hook = renderList();
    await flush();
    return hook;
  };

  test("Tippen zeigt sofort die lokale Vorschau, die DB wird erst nach der Pause gefragt", async () => {
    const {result, rerender} = await loadInitial();

    rerender({searchSettings: settingsWith({searchString: "hornli"})});

    expect(result.current.isProvisional).toBe(true);
    expect(result.current.recipes.map((recipe) => recipe.name)).toEqual(["Hörnli und Ghackets"]);
    expect(result.current.total).toBeNull();
    expect(mockListRecipeShorts).toHaveBeenCalledTimes(1);

    mockListRecipeShorts.mockResolvedValueOnce(
      createPage([1, 9], {total: 2, names: {1: "Hörnli und Ghackets", 9: "Hörnli Auflauf"}}),
    );
    await act(async () => {
      jest.advanceTimersByTime(300);
    });
    await flush();

    expect(mockListRecipeShorts).toHaveBeenCalledTimes(2);
    expect(mockListRecipeShorts.mock.calls[1][0]).toMatchObject({searchText: "hornli"});
    expect(result.current.isProvisional).toBe(false);
    expect(result.current.recipes.map((recipe) => recipe.uid)).toEqual(["r001", "r009"]);
    expect(result.current.total).toBe(2);
  });

  test("eine überholte Suche wird abgebrochen und ihre späte Antwort ignoriert", async () => {
    const {result, rerender} = await loadInitial();
    const first = createDeferred<RecipeListPage>();
    const second = createDeferred<RecipeListPage>();
    mockListRecipeShorts
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);

    rerender({searchSettings: settingsWith({searchString: "sp"})});
    await act(async () => {
      jest.advanceTimersByTime(300);
    });
    const firstSignal = mockListRecipeShorts.mock.calls[1][1] as AbortSignal;

    rerender({searchSettings: settingsWith({searchString: "spa"})});
    await act(async () => {
      jest.advanceTimersByTime(300);
    });

    expect(firstSignal.aborted).toBe(true);
    first.resolve(createPage([7], {total: 1, names: {7: "Spätzli"}}));
    await flush();
    expect(result.current.recipes.map((recipe) => recipe.name)).not.toContain("Spätzli");

    second.resolve(createPage([2], {total: 1, names: {2: "Spaghetti"}}));
    await flush();
    expect(result.current.recipes.map((recipe) => recipe.name)).toEqual(["Spaghetti"]);
    expect(result.current.isProvisional).toBe(false);
  });

  test("ein Filter löst sofort eine Anfrage aus (ohne Pause)", async () => {
    const {rerender} = await loadInitial();
    mockListRecipeShorts.mockResolvedValueOnce(createPage([3], {total: 1}));

    rerender({searchSettings: settingsWith({diet: Diet.Vegan})});

    expect(mockListRecipeShorts).toHaveBeenCalledTimes(2);
    expect(mockListRecipeShorts.mock.calls[1][0]).toMatchObject({diet: Diet.Vegan});
  });

  test("Zurück zu einer früheren Abfrage: sofort da, keine neue Anfrage", async () => {
    const {result, rerender} = await loadInitial();
    mockListRecipeShorts.mockResolvedValueOnce(createPage([2], {total: 1, names: {2: "Spaghetti"}}));
    rerender({searchSettings: settingsWith({searchString: "spa"})});
    await act(async () => {
      jest.advanceTimersByTime(300);
    });
    await flush();
    expect(mockListRecipeShorts).toHaveBeenCalledTimes(2);

    rerender({searchSettings: settingsWith({searchString: ""})});
    await act(async () => {
      jest.advanceTimersByTime(300);
    });

    expect(mockListRecipeShorts).toHaveBeenCalledTimes(2);
    expect(result.current.isProvisional).toBe(false);
    expect(result.current.recipes).toHaveLength(3);
  });

  test("die lokale Vorschau wendet auch Filter an (vegan)", async () => {
    mockListRecipeShorts.mockResolvedValueOnce(createPage([1, 2]));
    const {result, rerender} = renderList();
    await flush();
    // Antwort auf den Filter steht noch aus
    mockListRecipeShorts.mockReturnValueOnce(new Promise(() => undefined));

    rerender({searchSettings: settingsWith({diet: Diet.Vegan})});

    expect(result.current.isProvisional).toBe(true);
    expect(result.current.recipes).toEqual([]);
  });
});

describe("useRecipeList — Zwischenspeicher", () => {
  const initialSettings = settingsWith();
  const initialKey = getRecipeListQueryKey(buildRecipeListQuery(initialSettings));

  const cacheEntry = (queryKey: string): RecipeListCacheEntry => ({
    userId: "user-1",
    queryKey,
    searchSettings: initialSettings,
    recipes: [
      {
        ...createEmptyDomainAsShort(),
      },
    ],
    cursor: {name: "Aus dem Cache", uid: "cached-1"},
    hasMore: true,
    total: 42,
    timestamp: Date.now(),
  });

  function createEmptyDomainAsShort() {
    // Über den Hook selbst erzeugte Karten kommen aus domainToRecipeShort; hier reicht ein Minimalobjekt
    return {
      uid: "cached-1",
      name: "Aus dem Cache",
      pictureSrc: "",
      tags: [],
      linkedRecipes: [],
      dietProperties: {diet: Diet.Meat, allergens: []},
      menuTypes: [],
      outdoorKitchenSuitable: false,
      created: {date: new Date(), fromUid: "x", fromDisplayName: ""},
      source: "",
      type: "public" as never,
      rating: {avgRating: 0, noRatings: 0},
    };
  }

  test("ein passender Cache ersetzt die erste Anfrage", async () => {
    const {result} = renderList({
      searchSettings: initialSettings,
      restoredCache: cacheEntry(initialKey),
    });
    await flush();

    expect(mockListRecipeShorts).not.toHaveBeenCalled();
    expect(result.current.restoredFromCache).toBe(true);
    expect(result.current.recipes[0].name).toBe("Aus dem Cache");
    expect(result.current.total).toBe(42);
    expect(result.current.hasMore).toBe(true);
  });

  test("ein Cache zu einer anderen Abfrage wird ignoriert", async () => {
    mockListRecipeShorts.mockResolvedValueOnce(createPage([1]));
    const {result} = renderList({
      searchSettings: initialSettings,
      restoredCache: cacheEntry("anderer-schluessel"),
    });
    await flush();

    expect(result.current.restoredFromCache).toBe(false);
    expect(mockListRecipeShorts).toHaveBeenCalledTimes(1);
  });

  test("mit useCache wird der geladene Stand im sessionStorage gemerkt", async () => {
    mockListRecipeShorts.mockResolvedValueOnce(createPage([1, 2], {hasMore: true, total: 9}));
    renderList({searchSettings: initialSettings, useCache: true});
    await flush();

    const stored = JSON.parse(sessionStorage.getItem("recipeListCacheV2") as string);
    expect(stored.queryKey).toBe(initialKey);
    expect(stored.recipes).toHaveLength(2);
    expect(stored.total).toBe(9);
    expect(stored.cursor).toEqual({name: "Rezept 002", uid: "r002"});
  });

  test("ohne useCache (Schublade) wird nichts gespeichert", async () => {
    mockListRecipeShorts.mockResolvedValueOnce(createPage([1]));
    renderList({searchSettings: initialSettings, useCache: false});
    await flush();

    expect(sessionStorage.getItem("recipeListCacheV2")).toBeNull();
  });
});
