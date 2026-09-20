/**
 * Unit-Tests für die Hilfsfunktionen der Rezeptliste.
 */
import {Allergen, Diet} from "../../Product/product.types";
import {MenuType, RecipeType} from "../recipe.class";
import {INITIAL_SEARCH_SETTINGS, SearchSettings} from "../recipeList.types";
import {RecipeShort, createEmptyRecipeShort} from "../recipe.types";
import type {RecipeShortDomain} from "../../Database/Repository/RecipeRepository";
import {
  buildRecipeListQuery,
  domainToRecipeShort,
  filterRecipes,
  getRecipeListQueryKey,
  normalizeSearchText,
  recipeMatchesSearchText,
  sortRecipesByName,
  splitSearchTokens,
} from "../recipeListUtils";

const USER_ID = "user-1";

/** Erstellt ein Kurzrezept mit sinnvollen Standardwerten. */
const createRecipe = (overrides: Partial<RecipeShort> = {}): RecipeShort => ({
  ...createEmptyRecipeShort(),
  uid: "recipe-1",
  name: "Rezept",
  type: RecipeType.public,
  created: {date: new Date("2026-01-01"), fromUid: "other", fromDisplayName: ""},
  dietProperties: {diet: Diet.Meat, allergens: []},
  ...overrides,
});

const settings = (overrides: Partial<SearchSettings> = {}): SearchSettings => ({
  ...INITIAL_SEARCH_SETTINGS,
  ...overrides,
});

describe("normalizeSearchText", () => {
  test.each([
    ["Hörnli", "hornli"],
    ["HÖRNLI", "hornli"],
    ["Straße", "strasse"],
    ["Gemüsecurry", "gemusecurry"],
    ["Œuf à la Neige", "oeuf a la neige"],
    ["Crème brûlée", "creme brulee"],
    ["  Leer  ", "  leer  "],
  ])("%s → %s", (input, expected) => {
    expect(normalizeSearchText(input)).toBe(expected);
  });
});

describe("splitSearchTokens", () => {
  test("teilt an Leerraum, normalisiert und ignoriert Leerraum am Rand", () => {
    expect(splitSearchTokens("  Hörnli   Ghackets ")).toEqual(["hornli", "ghackets"]);
  });

  test("höchstens 4 Wörter (wie die Datenbank)", () => {
    expect(splitSearchTokens("a b c d e f")).toEqual(["a", "b", "c", "d"]);
  });

  test("leerer Text ergibt keine Wörter", () => {
    expect(splitSearchTokens("   ")).toEqual([]);
  });
});

describe("recipeMatchesSearchText", () => {
  const recipe = createRecipe({
    name: "Hörnli und Ghackets",
    tags: ["Pasta", "Kinder"],
  });

  test("leerer Suchtext trifft immer", () => {
    expect(recipeMatchesSearchText(recipe, "")).toBe(true);
    expect(recipeMatchesSearchText(recipe, "   ")).toBe(true);
  });

  test.each(["hornli", "HÖRNLI", "ghack", "kinder", "PASTA"])(
    "findet über Name und Tags (auch ohne Akzent/Grossschreibung): %s",
    (term) => {
      expect(recipeMatchesSearchText(recipe, term)).toBe(true);
    },
  );

  test("alle Wörter müssen vorkommen, Reihenfolge egal", () => {
    expect(recipeMatchesSearchText(recipe, "ghackets hornli")).toBe(true);
    expect(recipeMatchesSearchText(recipe, "hornli pizza")).toBe(false);
  });

  test("Variantenname wird auch ohne Tags gefunden (früherer Fehler)", () => {
    const variant = createRecipe({
      name: "Lasagne",
      tags: [],
      variantName: "Extrascharf",
    });
    expect(recipeMatchesSearchText(variant, "extrascharf")).toBe(true);
  });

  test("kein Treffer", () => {
    expect(recipeMatchesSearchText(recipe, "sushi")).toBe(false);
  });
});

describe("filterRecipes", () => {
  const vegan = createRecipe({
    uid: "vegan",
    dietProperties: {diet: Diet.Vegan, allergens: []},
    menuTypes: [MenuType.MainCourse],
    outdoorKitchenSuitable: true,
  });
  const vegetarian = createRecipe({
    uid: "vegetarian",
    dietProperties: {diet: Diet.Vegetarian, allergens: [Allergen.Lactose]},
    menuTypes: [MenuType.Dessert],
  });
  const meat = createRecipe({
    uid: "meat",
    dietProperties: {diet: Diet.Meat, allergens: [Allergen.Gluten]},
    type: RecipeType.private,
    created: {date: new Date(), fromUid: USER_ID, fromDisplayName: ""},
  });
  const all = [vegan, vegetarian, meat];
  const uidsOf = (list: RecipeShort[]) => list.map((entry) => entry.uid);

  test("ohne Filter bleiben alle", () => {
    expect(filterRecipes(all, settings(), USER_ID)).toHaveLength(3);
  });

  test("Diät ist strikt: Vegetarisch schliesst Vegan aus", () => {
    expect(
      uidsOf(filterRecipes(all, settings({diet: Diet.Vegetarian}), USER_ID)),
    ).toEqual(["vegetarian"]);
    expect(
      uidsOf(filterRecipes(all, settings({diet: Diet.Vegan}), USER_ID)),
    ).toEqual(["vegan"]);
  });

  test("Allergene werden ausgeschlossen", () => {
    expect(
      uidsOf(filterRecipes(all, settings({allergens: [Allergen.Lactose]}), USER_ID)),
    ).toEqual(["vegan", "meat"]);
    expect(
      uidsOf(
        filterRecipes(all, settings({allergens: [Allergen.Lactose, Allergen.Gluten]}), USER_ID),
      ),
    ).toEqual(["vegan"]);
  });

  test("Menütypen überlappen", () => {
    expect(
      uidsOf(filterRecipes(all, settings({menuTypes: [MenuType.Dessert]}), USER_ID)),
    ).toEqual(["vegetarian"]);
  });

  test("Outdoor-Küche nur bei eingeschaltetem Schalter", () => {
    expect(
      uidsOf(filterRecipes(all, settings({outdoorKitchenSuitable: true}), USER_ID)),
    ).toEqual(["vegan"]);
  });

  test("Rezepttyp und «nur meine»", () => {
    expect(
      uidsOf(filterRecipes(all, settings({recipeType: RecipeType.private}), USER_ID)),
    ).toEqual(["meat"]);
    expect(
      uidsOf(filterRecipes(all, settings({showOnlyMyRecipes: true}), USER_ID)),
    ).toEqual(["meat"]);
  });
});

describe("buildRecipeListQuery", () => {
  test("Standard: «Fleisch» und «Allergen keine» bedeuten kein Filter", () => {
    const query = buildRecipeListQuery(INITIAL_SEARCH_SETTINGS);
    expect(query.diet).toBeUndefined();
    expect(query.excludedAllergens).toEqual([]);
    expect(query.scope).toBe("all");
    expect(query.onlyMine).toBe(false);
  });

  test("übersetzt Filter, Bereich und Anlass", () => {
    const query = buildRecipeListQuery(
      settings({
        searchString: "  hornli ",
        diet: Diet.Vegan,
        allergens: [Allergen.Lactose, Allergen.Gluten],
        menuTypes: [MenuType.Dessert],
        outdoorKitchenSuitable: true,
        recipeType: RecipeType.variant,
        showOnlyMyRecipes: true,
      }),
      "event-1",
    );
    expect(query).toEqual({
      searchText: "hornli",
      diet: Diet.Vegan,
      excludedAllergens: [Allergen.Lactose, Allergen.Gluten],
      menuTypes: [MenuType.Dessert],
      outdoorKitchen: true,
      scope: "variant",
      onlyMine: true,
      eventUid: "event-1",
    });
  });
});

describe("getRecipeListQueryKey", () => {
  test("gleiche Suche in anderer Schreibweise ergibt denselben Schlüssel", () => {
    const first = getRecipeListQueryKey(buildRecipeListQuery(settings({searchString: "Hörnli"})));
    const second = getRecipeListQueryKey(buildRecipeListQuery(settings({searchString: "  HORNLI "})));
    expect(first).toBe(second);
  });

  test("Reihenfolge von Allergenen/Menütypen spielt keine Rolle", () => {
    const first = getRecipeListQueryKey(
      buildRecipeListQuery(settings({allergens: [Allergen.Lactose, Allergen.Gluten]})),
    );
    const second = getRecipeListQueryKey(
      buildRecipeListQuery(settings({allergens: [Allergen.Gluten, Allergen.Lactose]})),
    );
    expect(first).toBe(second);
  });

  test.each([
    ["Suchtext", {searchString: "x"}],
    ["Diät", {diet: Diet.Vegan}],
    ["Menütyp", {menuTypes: [MenuType.Dessert]}],
    ["Outdoor", {outdoorKitchenSuitable: true}],
    ["Typ", {recipeType: RecipeType.public}],
    ["nur meine", {showOnlyMyRecipes: true}],
  ])("%s ändert den Schlüssel", (_label, override) => {
    const base = getRecipeListQueryKey(buildRecipeListQuery(INITIAL_SEARCH_SETTINGS));
    const changed = getRecipeListQueryKey(
      buildRecipeListQuery(settings(override as Partial<SearchSettings>)),
    );
    expect(changed).not.toBe(base);
  });

  test("Anlass ändert den Schlüssel, Seitenangaben nicht", () => {
    const query = buildRecipeListQuery(INITIAL_SEARCH_SETTINGS, "event-1");
    expect(getRecipeListQueryKey(query)).not.toBe(
      getRecipeListQueryKey(buildRecipeListQuery(INITIAL_SEARCH_SETTINGS)),
    );
    expect(
      getRecipeListQueryKey({...query, limit: 5, after: {name: "a", uid: "b"}}),
    ).toBe(getRecipeListQueryKey(query));
  });

  test("gleiche Wörter in anderer Reihenfolge sind eine andere Suche", () => {
    expect(
      getRecipeListQueryKey(buildRecipeListQuery(settings({searchString: "a b"}))),
    ).not.toBe(
      getRecipeListQueryKey(buildRecipeListQuery(settings({searchString: "b a"}))),
    );
  });
});

describe("sortRecipesByName", () => {
  test("nach Name, bei gleichem Namen nach UID (stabil), Original bleibt unverändert", () => {
    const input = [
      createRecipe({uid: "b", name: "Dup"}),
      createRecipe({uid: "a", name: "Dup"}),
      createRecipe({uid: "c", name: "Apfel"}),
    ];
    expect(sortRecipesByName(input).map((entry) => entry.uid)).toEqual(["c", "a", "b"]);
    expect(input.map((entry) => entry.uid)).toEqual(["b", "a", "c"]);
  });
});

describe("domainToRecipeShort", () => {
  const domain: RecipeShortDomain = {
    uid: "r1",
    name: "Spätzli",
    source: "https://example.ch/rezept",
    pictureSrc: "https://example.ch/bild.jpg",
    tags: ["Beilage"],
    menuTypes: [2],
    dietProperties: {diet: 2, allergens: [1]},
    outdoorKitchenSuitable: true,
    avgRating: 4.5,
    noRatings: 3,
    noComments: 2,
    recipeType: "variant",
    variantName: "Extrascharf",
    createdAt: new Date("2026-03-01"),
    createdBy: "user-9",
  };

  test("bildet alle Felder für die Karte ab", () => {
    expect(domainToRecipeShort(domain)).toMatchObject({
      uid: "r1",
      name: "Spätzli",
      type: "variant",
      variantName: "Extrascharf",
      rating: {avgRating: 4.5, noRatings: 3},
      noComments: 2,
      created: {fromUid: "user-9", fromDisplayName: ""},
      dietProperties: {diet: 2, allergens: [1]},
    });
  });

  test("ohne Variantenname bleibt das Feld ungesetzt", () => {
    expect(domainToRecipeShort({...domain, variantName: null}).variantName).toBeUndefined();
  });
});
