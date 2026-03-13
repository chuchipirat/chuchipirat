/**
 * Unit-Tests für usedRecipesPdf.tsx.
 *
 * Getestet werden:
 * - Dokumenten-Metadaten (Titel, Betreff, Keywords mit "Mengenberechnung")
 * - Filter-Logik: fehlende Menüs, fehlende Rezepte, fehlende Recipe-Referenz
 * - Scaling-Aufrufe: scaleIngredients und scaleMaterials
 * - Bedingte Darstellung: Material, Notizen, Varianten-Notiz
 * - Guard gegen stale menueCoordinate (null-Check)
 *
 * @react-pdf/renderer wird gemockt (wie menuplanPdf.test.tsx).
 */

/* =====================================================================
// Mocks
// ===================================================================== */

jest.mock("@react-pdf/renderer", () => {
  const React = require("react");
  const createComponent = (name: string) =>
    React.forwardRef((props: any, _ref: any) =>
      React.createElement(name, props, props.children),
    );
  return {
    Document: createComponent("Document"),
    Page: createComponent("Page"),
    View: createComponent("View"),
    Text: createComponent("Text"),
    Font: {
      register: jest.fn(),
      registerEmojiSource: jest.fn(),
    },
    StyleSheet: {
      create: <T extends Record<string, any>>(styles: T): T => styles,
    },
  };
});

jest.mock("@react-pdf/types", () => ({}));
jest.mock("../../../Shared/pdfFontRegistration", () => {});

// pdfComponents — minimale Stubs
jest.mock("../../../Shared/pdfComponents", () => {
  const React = require("react");
  return {
    Header: (props: any) =>
      React.createElement("Header", {"data-testid": "header", "data-text": props.text}),
    Footer: (props: any) =>
      React.createElement("Footer", {"data-testid": "footer"}),
  };
});

// recipePdf — minimale Stubs mit testbaren data-Attributen
jest.mock("../../../Recipe/recipePdf", () => {
  const React = require("react");
  return {
    RecipeHeader: (props: any) =>
      React.createElement("RecipeHeader", {
        "data-testid": `recipe-header-${props.recipe.uid}`,
        "data-portions": props.scaledPortions,
      }),
    RecipeIngredients: (props: any) =>
      React.createElement("RecipeIngredients", {
        "data-testid": "recipe-ingredients",
      }),
    RecipeMaterial: (props: any) =>
      React.createElement("RecipeMaterial", {
        "data-testid": "recipe-material",
      }),
    RecipePreparation: (props: any) =>
      React.createElement("RecipePreparation", {
        "data-testid": "recipe-preparation",
      }),
    RecipeNote: (props: any) =>
      React.createElement("RecipeNote", {
        "data-testid": "recipe-note",
      }),
    RecipeVariantNote: (props: any) =>
      React.createElement("RecipeVariantNote", {
        "data-testid": "recipe-variant-note",
      }),
  };
});

// Recipe.scaleIngredients und scaleMaterials mocken
const mockScaleIngredients = jest.fn().mockReturnValue({entries: {}, order: []});
const mockScaleMaterials = jest.fn().mockReturnValue({entries: {}, order: []});

jest.mock("../../../Recipe/recipe.class", () => {
  const actual = jest.requireActual("../../../Recipe/recipe.class");
  // Klasse mit gemockten statischen Methoden
  class MockRecipe extends actual.default {}
  MockRecipe.scaleIngredients = (...args: any[]) =>
    mockScaleIngredients(...args);
  MockRecipe.scaleMaterials = (...args: any[]) =>
    mockScaleMaterials(...args);
  return {
    __esModule: true,
    ...actual,
    default: MockRecipe,
  };
});

import React from "react";
import {render, screen} from "@testing-library/react";
import UsedRecipesPdf from "../usedRecipesPdf";
import {RecipeType} from "../../../Recipe/recipe.class";
import type Recipe from "../../../Recipe/recipe.class";
import type {
  MealRecipe,
  MenueCoordinates,
  MenuplanData,
} from "../../Menuplan/menuplan.types";
import type AuthUser from "../../../Firebase/Authentication/authUser.class";
import type {UsedRecipeListEntry} from "../usedRecipes.class";

/* =====================================================================
// Test-Hilfsfunktionen
// ===================================================================== */

const buildAuthUser = (): AuthUser =>
  ({
    uid: "user-1",
    publicProfile: {displayName: "Test Koch", motto: "", pictureSrc: ""},
  }) as unknown as AuthUser;

const buildMealRecipe = (overrides: Partial<MealRecipe> = {}): MealRecipe => ({
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

const buildRecipe = (uid: string, overrides: Partial<Recipe> = {}): Recipe =>
  ({
    uid,
    name: `Rezept ${uid}`,
    portions: 4,
    note: "",
    type: RecipeType.public,
    ingredients: {entries: {}, order: []},
    preparationSteps: {entries: {}, order: []},
    materials: {entries: {}, order: []},
    ...overrides,
  }) as unknown as Recipe;

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

const buildDefaultProps = () => {
  const mr1 = buildMealRecipe({uid: "mr-1", recipe: {recipeUid: "r-1", name: "Pasta", type: RecipeType.public, createdFromUid: ""}, totalPortions: 20});

  return {
    list: {
      properties: {uid: "list-1", name: "Testliste", selectedMeals: [], selectedMenues: ["menue-1"], generated: {date: new Date(), fromUid: "", fromDisplayName: ""}},
      recipes: {"r-1": buildRecipe("r-1", {name: "Pasta"})},
    } as UsedRecipeListEntry,
    sortedMenueList: [buildMenueCoordinate({menueUid: "menue-1"})],
    menueplan: buildMenuplanData({
      menues: {
        "menue-1": {uid: "menue-1", name: "Menü 1", mealRecipeOrder: ["mr-1"], materialOrder: [], productOrder: []},
      },
      mealRecipes: {"mr-1": mr1},
    }),
    eventName: "Sommerlager 2026",
    products: [],
    units: null,
    unitConversionBasic: null,
    unitConversionProducts: null,
    authUser: buildAuthUser(),
  };
};

/* =====================================================================
// Tests
// ===================================================================== */

describe("UsedRecipesPdf", () => {
  beforeEach(() => {
    mockScaleIngredients.mockClear();
    mockScaleMaterials.mockClear();
  });

  /* =====================================================================
  // Dokumenten-Metadaten
  // ===================================================================== */
  describe("Dokumenten-Metadaten", () => {
    it("should set correct title, subject and keywords with 'Mengenberechnung'", () => {
      const props = buildDefaultProps();

      const {container} = render(<UsedRecipesPdf {...props} />);

      const doc = container.querySelector("Document");
      expect(doc).not.toBeNull();
      expect(doc!.getAttribute("title")).toContain("Mengenberechnung");
      expect(doc!.getAttribute("subject")).toContain("Mengenberechnung");
      expect(doc!.getAttribute("keywords")).toContain("Mengenberechnung");
    });

    it("should include event name in metadata", () => {
      const props = buildDefaultProps();

      const {container} = render(<UsedRecipesPdf {...props} />);

      const doc = container.querySelector("Document");
      expect(doc!.getAttribute("title")).toContain("Sommerlager 2026");
      expect(doc!.getAttribute("keywords")).toContain("Sommerlager 2026");
    });

    it("should set author to current user display name", () => {
      const props = buildDefaultProps();

      const {container} = render(<UsedRecipesPdf {...props} />);

      const doc = container.querySelector("Document");
      expect(doc!.getAttribute("author")).toBe("Test Koch");
    });
  });

  /* =====================================================================
  // Filter-Logik
  // ===================================================================== */
  describe("Filter-Logik", () => {
    it("should render a RecipePage for each valid meal recipe", () => {
      const props = buildDefaultProps();

      render(<UsedRecipesPdf {...props} />);

      expect(screen.getByTestId("recipe-header-r-1")).toBeDefined();
    });

    it("should skip menu coordinates with missing menue (stale coordinate)", () => {
      const props = buildDefaultProps();
      // menueUid zeigt auf nicht existierendes Menü
      props.sortedMenueList = [buildMenueCoordinate({menueUid: "non-existent"})];

      expect(() => render(<UsedRecipesPdf {...props} />)).not.toThrow();
      expect(screen.queryByTestId(/recipe-header/)).toBeNull();
    });

    it("should skip meal recipes without recipe reference", () => {
      const mrNoRecipe = {
        uid: "mr-broken",
        recipe: null,
        plan: [],
        totalPortions: 0,
      } as unknown as MealRecipe;

      const props = buildDefaultProps();
      props.menueplan = buildMenuplanData({
        menues: {
          "menue-1": {uid: "menue-1", name: "Menü 1", mealRecipeOrder: ["mr-broken"], materialOrder: [], productOrder: []},
        },
        mealRecipes: {"mr-broken": mrNoRecipe},
      });

      expect(() => render(<UsedRecipesPdf {...props} />)).not.toThrow();
      expect(screen.queryByTestId(/recipe-header/)).toBeNull();
    });

    it("should skip recipes not present in list.recipes", () => {
      const mr = buildMealRecipe({uid: "mr-1", recipe: {recipeUid: "r-unloaded", name: "Unbekannt", type: RecipeType.public, createdFromUid: ""}});

      const props = buildDefaultProps();
      props.menueplan = buildMenuplanData({
        menues: {
          "menue-1": {uid: "menue-1", name: "Menü 1", mealRecipeOrder: ["mr-1"], materialOrder: [], productOrder: []},
        },
        mealRecipes: {"mr-1": mr},
      });
      // list.recipes enthält r-unloaded NICHT
      props.list.recipes = {};

      render(<UsedRecipesPdf {...props} />);

      expect(screen.queryByTestId(/recipe-header/)).toBeNull();
    });

    it("should render recipes from multiple menus", () => {
      const mr1 = buildMealRecipe({uid: "mr-1", recipe: {recipeUid: "r-1", name: "Pasta", type: RecipeType.public, createdFromUid: ""}});
      const mr2 = buildMealRecipe({uid: "mr-2", recipe: {recipeUid: "r-2", name: "Risotto", type: RecipeType.public, createdFromUid: ""}});

      const props = buildDefaultProps();
      props.sortedMenueList = [
        buildMenueCoordinate({menueUid: "menue-1"}),
        buildMenueCoordinate({menueUid: "menue-2", menueName: "Menü 2"}),
      ];
      props.menueplan = buildMenuplanData({
        menues: {
          "menue-1": {uid: "menue-1", name: "Menü 1", mealRecipeOrder: ["mr-1"], materialOrder: [], productOrder: []},
          "menue-2": {uid: "menue-2", name: "Menü 2", mealRecipeOrder: ["mr-2"], materialOrder: [], productOrder: []},
        },
        mealRecipes: {"mr-1": mr1, "mr-2": mr2},
      });
      props.list.recipes = {
        "r-1": buildRecipe("r-1", {name: "Pasta"}),
        "r-2": buildRecipe("r-2", {name: "Risotto"}),
      };

      render(<UsedRecipesPdf {...props} />);

      expect(screen.getByTestId("recipe-header-r-1")).toBeDefined();
      expect(screen.getByTestId("recipe-header-r-2")).toBeDefined();
    });
  });

  /* =====================================================================
  // Scaling-Aufrufe
  // ===================================================================== */
  describe("Scaling", () => {
    it("should call scaleIngredients with correct portions", () => {
      const props = buildDefaultProps();

      render(<UsedRecipesPdf {...props} />);

      expect(mockScaleIngredients).toHaveBeenCalledTimes(1);
      expect(mockScaleIngredients).toHaveBeenCalledWith(
        expect.objectContaining({
          portionsToScale: 20,
          scalingOptions: {convertUnits: true},
        }),
      );
    });

    it("should call scaleMaterials with correct portions", () => {
      const props = buildDefaultProps();

      render(<UsedRecipesPdf {...props} />);

      expect(mockScaleMaterials).toHaveBeenCalledTimes(1);
      expect(mockScaleMaterials).toHaveBeenCalledWith(
        expect.objectContaining({
          portionsToScale: 20,
        }),
      );
    });
  });

  /* =====================================================================
  // Bedingte Darstellung
  // ===================================================================== */
  describe("Bedingte Darstellung", () => {
    it("should render RecipeNote when recipe has note", () => {
      const props = buildDefaultProps();
      props.list.recipes["r-1"] = buildRecipe("r-1", {
        name: "Pasta",
        note: "Gut salzen!",
      });

      render(<UsedRecipesPdf {...props} />);

      expect(screen.getByTestId("recipe-note")).toBeDefined();
    });

    it("should not render RecipeNote when note is empty", () => {
      const props = buildDefaultProps();
      props.list.recipes["r-1"] = buildRecipe("r-1", {name: "Pasta", note: ""});

      render(<UsedRecipesPdf {...props} />);

      expect(screen.queryByTestId("recipe-note")).toBeNull();
    });

    it("should render RecipeVariantNote for variant recipe with note", () => {
      const props = buildDefaultProps();
      props.list.recipes["r-1"] = buildRecipe("r-1", {
        name: "Pasta glutenfrei",
        type: RecipeType.variant,
        variantProperties: {
          note: "Ohne Weizen",
          variantName: "Glutenfrei",
          originalRecipeUid: "r-base",
        },
      });

      render(<UsedRecipesPdf {...props} />);

      expect(screen.getByTestId("recipe-variant-note")).toBeDefined();
    });

    it("should not render RecipeVariantNote for variant with empty note", () => {
      const props = buildDefaultProps();
      props.list.recipes["r-1"] = buildRecipe("r-1", {
        name: "Pasta glutenfrei",
        type: RecipeType.variant,
        variantProperties: {
          note: "",
          variantName: "Glutenfrei",
          originalRecipeUid: "r-base",
        },
      });

      render(<UsedRecipesPdf {...props} />);

      expect(screen.queryByTestId("recipe-variant-note")).toBeNull();
    });

    it("should not render RecipeVariantNote for non-variant recipe", () => {
      const props = buildDefaultProps();
      props.list.recipes["r-1"] = buildRecipe("r-1", {
        name: "Pasta",
        type: RecipeType.public,
        note: "",
      });

      render(<UsedRecipesPdf {...props} />);

      expect(screen.queryByTestId("recipe-variant-note")).toBeNull();
    });

    it("should render RecipeMaterial when materials have valid entries", () => {
      const props = buildDefaultProps();
      props.list.recipes["r-1"] = buildRecipe("r-1", {
        name: "Pasta",
        materials: {
          entries: {"mat-1": {uid: "mat-1", name: "Topf", quantity: 1, unit: "Stk"}},
          order: ["mat-1"],
        },
      });

      render(<UsedRecipesPdf {...props} />);

      expect(screen.getByTestId("recipe-material")).toBeDefined();
    });

    it("should not render RecipeMaterial when materials order is empty", () => {
      const props = buildDefaultProps();
      props.list.recipes["r-1"] = buildRecipe("r-1", {
        name: "Pasta",
        materials: {entries: {}, order: []},
      });

      render(<UsedRecipesPdf {...props} />);

      expect(screen.queryByTestId("recipe-material")).toBeNull();
    });

    it("should not render RecipeMaterial when first entry has empty uid", () => {
      const props = buildDefaultProps();
      props.list.recipes["r-1"] = buildRecipe("r-1", {
        name: "Pasta",
        materials: {
          entries: {"mat-placeholder": {uid: "", name: "", quantity: 0, unit: ""}},
          order: ["mat-placeholder"],
        },
      });

      render(<UsedRecipesPdf {...props} />);

      expect(screen.queryByTestId("recipe-material")).toBeNull();
    });
  });

  /* =====================================================================
  // Smoke-Tests
  // ===================================================================== */
  describe("Smoke-Tests", () => {
    it("should render without error with empty sortedMenueList", () => {
      const props = buildDefaultProps();
      props.sortedMenueList = [];

      expect(() => render(<UsedRecipesPdf {...props} />)).not.toThrow();
    });

    it("should render without error with empty list.recipes", () => {
      const props = buildDefaultProps();
      props.list.recipes = {};

      expect(() => render(<UsedRecipesPdf {...props} />)).not.toThrow();
    });
  });
});
