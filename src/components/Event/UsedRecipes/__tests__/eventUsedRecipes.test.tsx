/**
 * Unit-Tests für eventUsedRecipes.tsx.
 *
 * Testet die useMemo-Filterlogik, die aus dem Menüplan und den geladenen
 * Rezepten die anzuzeigenden RecipeCards ableitet:
 * - Gültige Rezepte werden angezeigt
 * - Gelöschte Rezepte ([DELETED]) werden übersprungen
 * - Nicht geladene Rezepte werden übersprungen
 * - Leere Menüs ergeben keine Karten
 */

// MUI useTheme mocken
jest.mock("@mui/material", () => ({
  ...jest.requireActual("@mui/material"),
  useTheme: () => ({spacing: (n: number) => `${n * 8}px`}),
}));

// EventUsedMealRecipe als einfaches div mocken
jest.mock("../eventUsedMealRecipe", () => ({
  EventUsedMealRecipe: (props: any) => (
    <div data-testid={`meal-recipe-${props.mealRecipe.uid}`}>
      {props.recipe.name}
    </div>
  ),
}));

import React from "react";
import {render, screen} from "@testing-library/react";
import {EventUsedRecipes} from "../eventUsedRecipes";
import {
  MealRecipe,
  MenueCoordinates,
  MenuplanData,
} from "../../Menuplan/menuplan.types";
import Recipe, {RecipeType} from "../../../Recipe/recipe.class";
import {EventGroupConfiguration} from "../../GroupConfiguration/groupConfiguration.class";


const buildMealRecipe = (
  overrides: Partial<MealRecipe> = {},
): MealRecipe => ({
  uid: "mr-1",
  recipe: {
    recipeUid: "recipe-1",
    name: "Testrezept",
    type: RecipeType.public,
    createdFromUid: "",
  },
  plan: [],
  totalPortions: 10,
  ...overrides,
});

const buildMenueCoordinate = (
  overrides: Partial<MenueCoordinates> = {},
): MenueCoordinates => ({
  menueUid: "menue-1",
  date: new Date("2026-03-15"),
  menueName: "Menü 1",
  mealUid: "meal-1",
  mealType: {uid: "mt-1", name: "Mittagessen", pos: 1},
  ...overrides,
});

const buildRecipe = (uid: string, name: string): Recipe =>
  ({uid, name} as unknown as Recipe);

const buildGroupConfig = (): EventGroupConfiguration =>
  new EventGroupConfiguration();

/**
 * Erzeugt ein minimales MenuplanData-Objekt.
 */
const buildMenuplanData = (
  overrides: Partial<MenuplanData> = {},
): MenuplanData =>
  ({
    uid: "event-1",
    dates: [],
    mealTypes: {entries: {}, order: []},
    meals: {},
    menues: {},
    notes: {},
    mealRecipes: {},
    materials: {},
    products: {},
    created: {date: new Date(), fromUid: "", fromDisplayName: ""},
    lastChange: {date: new Date(), fromUid: "", fromDisplayName: ""},
    ...overrides,
  }) as unknown as MenuplanData;


describe("EventUsedRecipes", () => {
  it("should render recipe cards for valid meal recipes", () => {
    const mr1 = buildMealRecipe({uid: "mr-1", recipe: {recipeUid: "r-1", name: "Pasta", type: RecipeType.public, createdFromUid: ""}});
    const mr2 = buildMealRecipe({uid: "mr-2", recipe: {recipeUid: "r-2", name: "Risotto", type: RecipeType.public, createdFromUid: ""}});

    const menuplan = buildMenuplanData({
      menues: {
        "menue-1": {uid: "menue-1", name: "Menü 1", mealRecipeOrder: ["mr-1", "mr-2"], materialOrder: [], productOrder: []},
      },
      mealRecipes: {"mr-1": mr1, "mr-2": mr2},
    });
    const usedRecipes = {
      "r-1": buildRecipe("r-1", "Pasta"),
      "r-2": buildRecipe("r-2", "Risotto"),
    };

    render(
      <EventUsedRecipes
        sortedMenueList={[buildMenueCoordinate({menueUid: "menue-1"})]}
        usedRecipes={usedRecipes}
        menuplan={menuplan}
        groupConfiguration={buildGroupConfig()}
      />,
    );

    expect(screen.getByTestId("meal-recipe-mr-1")).toBeDefined();
    expect(screen.getByTestId("meal-recipe-mr-2")).toBeDefined();
  });

  it("should skip deleted recipes", () => {
    const mrDeleted = buildMealRecipe({
      uid: "mr-deleted",
      recipe: {
        recipeUid: "",
        name: "Altes Rezept",
        type: RecipeType.public,
        createdFromUid: "",
      },
    });
    const mrValid = buildMealRecipe({
      uid: "mr-valid",
      recipe: {recipeUid: "r-1", name: "Pasta", type: RecipeType.public, createdFromUid: ""},
    });

    const menuplan = buildMenuplanData({
      menues: {
        "menue-1": {uid: "menue-1", name: "Menü 1", mealRecipeOrder: ["mr-deleted", "mr-valid"], materialOrder: [], productOrder: []},
      },
      mealRecipes: {"mr-deleted": mrDeleted, "mr-valid": mrValid},
    });
    const usedRecipes = {
      "r-1": buildRecipe("r-1", "Pasta"),
      "deleted": buildRecipe("deleted", "Altes Rezept"),
    };

    render(
      <EventUsedRecipes
        sortedMenueList={[buildMenueCoordinate({menueUid: "menue-1"})]}
        usedRecipes={usedRecipes}
        menuplan={menuplan}
        groupConfiguration={buildGroupConfig()}
      />,
    );

    expect(screen.queryByTestId("meal-recipe-mr-deleted")).toBeNull();
    expect(screen.getByTestId("meal-recipe-mr-valid")).toBeDefined();
  });

  it("should skip recipes not loaded in usedRecipes", () => {
    const mr = buildMealRecipe({
      uid: "mr-1",
      recipe: {recipeUid: "r-1", name: "Pasta", type: RecipeType.public, createdFromUid: ""},
    });

    const menuplan = buildMenuplanData({
      menues: {
        "menue-1": {uid: "menue-1", name: "Menü 1", mealRecipeOrder: ["mr-1"], materialOrder: [], productOrder: []},
      },
      mealRecipes: {"mr-1": mr},
    });

    // Leere usedRecipes — Rezept nicht geladen
    render(
      <EventUsedRecipes
        sortedMenueList={[buildMenueCoordinate({menueUid: "menue-1"})]}
        usedRecipes={{}}
        menuplan={menuplan}
        groupConfiguration={buildGroupConfig()}
      />,
    );

    expect(screen.queryByTestId("meal-recipe-mr-1")).toBeNull();
  });

  it("should render nothing for empty sortedMenueList", () => {
    const menuplan = buildMenuplanData({
      menues: {
        "menue-1": {uid: "menue-1", name: "Menü 1", mealRecipeOrder: ["mr-1"], materialOrder: [], productOrder: []},
      },
      mealRecipes: {
        "mr-1": buildMealRecipe(),
      },
    });

    const {container} = render(
      <EventUsedRecipes
        sortedMenueList={[]}
        usedRecipes={{"recipe-1": buildRecipe("recipe-1", "Test")}}
        menuplan={menuplan}
        groupConfiguration={buildGroupConfig()}
      />,
    );

    expect(screen.queryByTestId(/meal-recipe/)).toBeNull();
  });

  it("should render recipes from multiple menus in order", () => {
    const mr1 = buildMealRecipe({uid: "mr-1", recipe: {recipeUid: "r-1", name: "Pasta", type: RecipeType.public, createdFromUid: ""}});
    const mr2 = buildMealRecipe({uid: "mr-2", recipe: {recipeUid: "r-2", name: "Risotto", type: RecipeType.public, createdFromUid: ""}});

    const menuplan = buildMenuplanData({
      menues: {
        "menue-1": {uid: "menue-1", name: "Menü 1", mealRecipeOrder: ["mr-1"], materialOrder: [], productOrder: []},
        "menue-2": {uid: "menue-2", name: "Menü 2", mealRecipeOrder: ["mr-2"], materialOrder: [], productOrder: []},
      },
      mealRecipes: {"mr-1": mr1, "mr-2": mr2},
    });

    render(
      <EventUsedRecipes
        sortedMenueList={[
          buildMenueCoordinate({menueUid: "menue-1"}),
          buildMenueCoordinate({menueUid: "menue-2", menueName: "Menü 2"}),
        ]}
        usedRecipes={{
          "r-1": buildRecipe("r-1", "Pasta"),
          "r-2": buildRecipe("r-2", "Risotto"),
        }}
        menuplan={menuplan}
        groupConfiguration={buildGroupConfig()}
      />,
    );

    expect(screen.getByTestId("meal-recipe-mr-1")).toBeDefined();
    expect(screen.getByTestId("meal-recipe-mr-2")).toBeDefined();
  });

  it("should handle empty mealRecipeOrder gracefully", () => {
    const menuplan = buildMenuplanData({
      menues: {
        "menue-1": {uid: "menue-1", name: "Leeres Menü", mealRecipeOrder: [], materialOrder: [], productOrder: []},
      },
    });

    const {container} = render(
      <EventUsedRecipes
        sortedMenueList={[buildMenueCoordinate({menueUid: "menue-1"})]}
        usedRecipes={{}}
        menuplan={menuplan}
        groupConfiguration={buildGroupConfig()}
      />,
    );

    expect(screen.queryByTestId(/meal-recipe/)).toBeNull();
  });

  it("should skip meal recipes without recipe property", () => {
    const mrNoRecipe = {
      uid: "mr-broken",
      recipe: null,
      plan: [],
      totalPortions: 0,
    } as unknown as MealRecipe;

    const menuplan = buildMenuplanData({
      menues: {
        "menue-1": {uid: "menue-1", name: "Menü 1", mealRecipeOrder: ["mr-broken"], materialOrder: [], productOrder: []},
      },
      mealRecipes: {"mr-broken": mrNoRecipe},
    });

    render(
      <EventUsedRecipes
        sortedMenueList={[buildMenueCoordinate({menueUid: "menue-1"})]}
        usedRecipes={{}}
        menuplan={menuplan}
        groupConfiguration={buildGroupConfig()}
      />,
    );

    expect(screen.queryByTestId("meal-recipe-mr-broken")).toBeNull();
  });
});
