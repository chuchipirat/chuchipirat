/**
 * Unit-Tests für den sessionStorage-Cache der Rezeptliste.
 */
import {INITIAL_SEARCH_SETTINGS} from "../recipeList.types";
import {RecipeShort, createEmptyRecipeShort} from "../recipe.types";
import {
  MAX_CACHED_RECIPES,
  RECIPE_LIST_CACHE_TTL_MS,
  clearRecipeListCache,
  consumeRecipeListScrollY,
  loadRecipeListCache,
  saveRecipeListCache,
  saveRecipeListScrollY,
  skipScrollToTopIfRestorable,
} from "../recipeListCache";

const createRecipe = (index: number): RecipeShort => ({
  ...createEmptyRecipeShort(),
  uid: `recipe-${String(index).padStart(4, "0")}`,
  name: `Rezept ${String(index).padStart(4, "0")}`,
  created: {date: new Date("2026-03-01T12:00:00Z"), fromUid: "u", fromDisplayName: ""},
});

const baseEntry = (recipes: RecipeShort[]) => ({
  userId: "user-1",
  queryKey: "key-1",
  searchSettings: {...INITIAL_SEARCH_SETTINGS, searchString: "hornli"},
  recipes,
  cursor: {name: "Rezept 0002", uid: "recipe-0002"},
  hasMore: true,
  total: 57,
});

beforeEach(() => {
  sessionStorage.clear();
});

describe("saveRecipeListCache / loadRecipeListCache", () => {
  test("Rundlauf: Karten (mit Datum), Einstellungen, Cursor und Gesamtzahl", () => {
    saveRecipeListCache(baseEntry([createRecipe(1), createRecipe(2)]));

    const loaded = loadRecipeListCache("user-1");

    expect(loaded).not.toBeNull();
    expect(loaded!.queryKey).toBe("key-1");
    expect(loaded!.searchSettings.searchString).toBe("hornli");
    expect(loaded!.recipes).toHaveLength(2);
    expect(loaded!.recipes[0].created.date).toBeInstanceOf(Date);
    expect(loaded!.recipes[0].created.date.toISOString()).toBe("2026-03-01T12:00:00.000Z");
    expect(loaded!.cursor).toEqual({name: "Rezept 0002", uid: "recipe-0002"});
    expect(loaded!.hasMore).toBe(true);
    expect(loaded!.total).toBe(57);
  });

  test("gilt nur für dieselbe Person", () => {
    saveRecipeListCache(baseEntry([createRecipe(1)]));
    expect(loadRecipeListCache("user-2")).toBeNull();
  });

  test("abgelaufener Stand wird nicht geliefert und entfernt", () => {
    saveRecipeListCache(baseEntry([createRecipe(1)]));
    const later = Date.now() + RECIPE_LIST_CACHE_TTL_MS + 1000;

    expect(loadRecipeListCache("user-1", later)).toBeNull();
    expect(loadRecipeListCache("user-1")).toBeNull();
  });

  test("beschädigter Inhalt führt zu null, nicht zu einem Fehler", () => {
    sessionStorage.setItem("recipeListCacheV2", "{kaputt");
    expect(loadRecipeListCache("user-1")).toBeNull();
  });

  test("ohne Eintrag null", () => {
    expect(loadRecipeListCache("user-1")).toBeNull();
  });

  test("mehr als das Maximum wird abgeschnitten, der Cursor schliesst nahtlos an", () => {
    const recipes = Array.from({length: MAX_CACHED_RECIPES + 20}, (_, index) =>
      createRecipe(index),
    );
    saveRecipeListCache({...baseEntry(recipes), hasMore: false, cursor: null});

    const loaded = loadRecipeListCache("user-1")!;

    expect(loaded.recipes).toHaveLength(MAX_CACHED_RECIPES);
    expect(loaded.hasMore).toBe(true);
    const lastKept = loaded.recipes[MAX_CACHED_RECIPES - 1];
    expect(loaded.cursor).toEqual({name: lastKept.name, uid: lastKept.uid});
  });

  test("ein voller sessionStorage wirft keinen Fehler", () => {
    const spy = jest.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });
    expect(() => saveRecipeListCache(baseEntry([createRecipe(1)]))).not.toThrow();
    spy.mockRestore();
  });
});

describe("clearRecipeListCache", () => {
  test("entfernt Cache, alte Version und Scroll-Position", () => {
    saveRecipeListCache(baseEntry([createRecipe(1)]));
    sessionStorage.setItem("recipeListCache", "alt");
    saveRecipeListScrollY(120);

    clearRecipeListCache();

    expect(loadRecipeListCache("user-1")).toBeNull();
    expect(sessionStorage.getItem("recipeListCache")).toBeNull();
    expect(consumeRecipeListScrollY()).toBeNull();
  });
});

describe("Scroll-Position", () => {
  test("wird nur einmal geliefert", () => {
    saveRecipeListScrollY(340);
    expect(consumeRecipeListScrollY()).toBe(340);
    expect(consumeRecipeListScrollY()).toBeNull();
  });

  test("ungültiger Wert ergibt null", () => {
    sessionStorage.setItem("recipeListScrollY", "abc");
    expect(consumeRecipeListScrollY()).toBeNull();
  });
});

describe("skipScrollToTopIfRestorable", () => {
  test("nur mit Cache UND Scroll-Position", () => {
    skipScrollToTopIfRestorable();
    expect(sessionStorage.getItem("skipScrollToTop")).toBeNull();

    saveRecipeListScrollY(100);
    skipScrollToTopIfRestorable();
    expect(sessionStorage.getItem("skipScrollToTop")).toBeNull();

    saveRecipeListCache(baseEntry([createRecipe(1)]));
    skipScrollToTopIfRestorable();
    expect(sessionStorage.getItem("skipScrollToTop")).toBe("true");
  });
});
