/**
 * Unit-Tests für die Erkennung veralteter Listen (Einkaufsliste,
 * Materialliste, geplante Rezepte).
 */
import {
  getLatestRecipeChange,
  getRecipeUidsOfMenues,
  isListOutOfDate,
} from "../listOutOfDate";
import {createEmptyMenuplan} from "../../Menuplan/menuplanService";
import {MenuplanData} from "../../Menuplan/menuplan.types";
import {RecipeType} from "../../../Recipe/recipe.class";

/* ===================================================================
// ======================== Testdaten =================================
// =================================================================== */

/**
 * Erzeugt einen Menüplan mit zwei Menüs: Menü 1 enthält Glühwein und
 * Zopf, Menü 2 enthält Zopf und Risotto.
 *
 * @returns Menüplan für die Tests.
 */
const buildMenuplan = (): MenuplanData => {
  const menuplan = createEmptyMenuplan();
  menuplan.uid = "event-1";
  const addMealRecipe = (mealRecipeUid: string, recipeUid: string) => {
    menuplan.mealRecipes[mealRecipeUid] = {
      uid: mealRecipeUid,
      recipe: {
        recipeUid,
        name: recipeUid,
        type: RecipeType.public,
        createdFromUid: "user-1",
      },
      plan: [],
      totalPortions: 0,
    };
  };
  addMealRecipe("meal-recipe-1", "recipe-gluehwein");
  addMealRecipe("meal-recipe-2", "recipe-zopf");
  addMealRecipe("meal-recipe-3", "recipe-zopf");
  addMealRecipe("meal-recipe-4", "recipe-risotto");
  menuplan.menues = {
    "menue-1": {
      uid: "menue-1",
      name: "",
      mealRecipeOrder: ["meal-recipe-1", "meal-recipe-2"],
      materialOrder: [],
      productOrder: [],
    },
    "menue-2": {
      uid: "menue-2",
      name: "",
      mealRecipeOrder: ["meal-recipe-3", "meal-recipe-4"],
      materialOrder: [],
      productOrder: [],
    },
  };
  return menuplan;
};

/* ===================================================================
// ======================== Tests =====================================
// =================================================================== */

describe("getRecipeUidsOfMenues", () => {
  test("liefert die Rezepte der gewählten Menüs ohne Duplikate", () => {
    const recipeUids = getRecipeUidsOfMenues(buildMenuplan(), [
      "menue-1",
      "menue-2",
    ]);

    expect(recipeUids).toEqual([
      "recipe-gluehwein",
      "recipe-zopf",
      "recipe-risotto",
    ]);
  });

  test("berücksichtigt nur die gewählten Menüs", () => {
    expect(getRecipeUidsOfMenues(buildMenuplan(), ["menue-2"])).toEqual([
      "recipe-zopf",
      "recipe-risotto",
    ]);
  });

  test("überspringt Menüs, die nicht mehr im Menüplan stehen, statt abzustürzen", () => {
    // Eine Liste kann auf ein inzwischen gelöschtes Menü verweisen
    expect(
      getRecipeUidsOfMenues(buildMenuplan(), ["menue-geloescht", "menue-1"]),
    ).toEqual(["recipe-gluehwein", "recipe-zopf"]);
  });

  test("überspringt Einträge ohne Rezept-UID", () => {
    const menuplan = buildMenuplan();
    menuplan.mealRecipes["meal-recipe-1"].recipe.recipeUid = "";

    expect(getRecipeUidsOfMenues(menuplan, ["menue-1"])).toEqual([
      "recipe-zopf",
    ]);
  });
});

describe("getLatestRecipeChange", () => {
  const changeDates = new Map([
    ["recipe-gluehwein", new Date("2026-11-09T17:20:00Z")],
    ["recipe-zopf", new Date("2026-11-01T08:00:00Z")],
  ]);

  test("liefert die jüngste Änderung der angegebenen Rezepte", () => {
    expect(
      getLatestRecipeChange(["recipe-zopf", "recipe-gluehwein"], changeDates),
    ).toEqual(new Date("2026-11-09T17:20:00Z"));
  });

  test("ignoriert Rezepte ohne bekannten Änderungszeitpunkt", () => {
    expect(
      getLatestRecipeChange(["recipe-zopf", "recipe-risotto"], changeDates),
    ).toEqual(new Date("2026-11-01T08:00:00Z"));
  });

  test("liefert null, wenn kein Zeitpunkt bekannt ist", () => {
    expect(getLatestRecipeChange(["recipe-risotto"], changeDates)).toBeNull();
    expect(getLatestRecipeChange([], changeDates)).toBeNull();
  });
});

describe("isListOutOfDate", () => {
  const listGeneratedAt = new Date("2026-11-09T12:00:00Z");
  const before = new Date("2026-11-09T11:00:00Z");
  const after = new Date("2026-11-09T17:20:00Z");

  test("veraltet, wenn der Menüplan nach der Liste geändert wurde", () => {
    expect(
      isListOutOfDate({
        listGeneratedAt,
        menuplanChangedAt: after,
        recipesChangedAt: null,
      }),
    ).toBe(true);
  });

  test("veraltet, wenn nur ein Rezept nach der Liste geändert wurde (CHUCHIPIRAT-JE)", () => {
    expect(
      isListOutOfDate({
        listGeneratedAt,
        menuplanChangedAt: before,
        recipesChangedAt: after,
      }),
    ).toBe(true);
  });

  test("aktuell, wenn Menüplan und Rezepte älter sind als die Liste", () => {
    expect(
      isListOutOfDate({
        listGeneratedAt,
        menuplanChangedAt: before,
        recipesChangedAt: before,
      }),
    ).toBe(false);
  });

  test("aktuell, wenn keine Rezeptänderung bekannt ist und der Menüplan älter ist", () => {
    expect(
      isListOutOfDate({
        listGeneratedAt,
        menuplanChangedAt: before,
        recipesChangedAt: null,
      }),
    ).toBe(false);
  });

  test("aktuell bei gleichem Zeitpunkt", () => {
    expect(
      isListOutOfDate({
        listGeneratedAt,
        menuplanChangedAt: listGeneratedAt,
        recipesChangedAt: listGeneratedAt,
      }),
    ).toBe(false);
  });
});
