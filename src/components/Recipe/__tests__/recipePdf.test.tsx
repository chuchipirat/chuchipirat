/**
 * Unit-Tests für recipePdf.tsx.
 *
 * Getestet werden:
 * - React-PDF-Komponentenbaum — Smoke-Tests via render
 * - Korrektes Rendering von Zutaten, Zubereitung, Notizen
 * - Varianten-Unterstützung
 * - Skalierte Portionen
 *
 * @react-pdf/renderer wird gemockt, da die ESM-Module nicht von Jest
 * transformiert werden.
 */

jest.mock("@react-pdf/renderer", () => {
  const React = require("react");
  const createComponent = (name: string) =>
    React.forwardRef((props: any, _ref: any) =>
      React.createElement(name, null, props.children)
    );
  return {
    Document: createComponent("Document"),
    Page: createComponent("Page"),
    View: createComponent("View"),
    Text: createComponent("Text"),
    Link: createComponent("Link"),
    Svg: createComponent("Svg"),
    Path: createComponent("Path"),
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

// pdfFontRegistration wird durch den Font-Mock bereits abgedeckt
jest.mock("../../Shared/pdfFontRegistration", () => {});

// pdfComponents — minimale Stubs
jest.mock("../../Shared/pdfComponents", () => {
  const React = require("react");
  return {
    Header: () => React.createElement("Header"),
    Footer: () => React.createElement("Footer"),
  };
});

import React from "react";
import {render} from "@testing-library/react";

import {RecipePdf} from "../recipePdf";
import Recipe, {
  Ingredient,
  PositionType,
  PreparationStep,
  RecipeMaterialPosition,
  RecipeObjectStructure,
  RecipeType,
  Section,
} from "../recipe.class";
import AuthUser from "../../Firebase/Authentication/authUser.class";

/* ── Hilfsfunktionen ─────────────────────────────────────────────── */

/** Erzeugt einen minimalen AuthUser. */
function buildAuthUser(): AuthUser {
  const user = new AuthUser();
  user.uid = "user-1";
  user.publicProfile = {
    displayName: "Test User",
    motto: "",
    pictureSrc: "",
  };
  return user;
}

/** Erzeugt eine minimale Zutat. */
function buildIngredient(overrides: Partial<Ingredient> = {}): Ingredient {
  return {
    uid: "ing-1",
    posType: PositionType.ingredient,
    quantity: 500,
    unit: "g",
    product: {uid: "prod-1", name: "Mehl"},
    detail: "",
    ...overrides,
  } as Ingredient;
}

/** Erzeugt einen minimalen Zubereitungsschritt. */
function buildStep(overrides: Partial<PreparationStep> = {}): PreparationStep {
  return {
    uid: "step-1",
    posType: PositionType.preparationStep,
    step: "Alles gut verrühren.",
    ...overrides,
  } as PreparationStep;
}

/** Erzeugt eine minimale Materialposition. */
function buildMaterialPosition(
  overrides: Partial<RecipeMaterialPosition> = {}
): RecipeMaterialPosition {
  return {
    uid: "mat-1",
    posType: PositionType.ingredient,
    quantity: 2,
    unit: "Stk",
    material: {uid: "m-1", name: "Backpapier"},
    ...overrides,
  } as RecipeMaterialPosition;
}

/** Erzeugt eine minimale Section. */
function buildSection(overrides: Partial<Section> = {}): Section {
  return {
    uid: "sec-1",
    posType: PositionType.section,
    name: "Teig",
    ...overrides,
  } as Section;
}

/** Erzeugt ein minimales Recipe. */
function buildRecipe(overrides: Partial<Recipe> = {}): Recipe {
  const ingredient = buildIngredient();
  const step = buildStep();

  const recipe = new Recipe();
  recipe.uid = "recipe-1";
  recipe.name = "Testrezept";
  recipe.source = "Kochbuch S. 42";
  recipe.portions = 4;
  recipe.times = {preparation: 15, cooking: 30, rest: 10};
  recipe.type = RecipeType.public;
  recipe.note = "";
  recipe.ingredients = {
    entries: {[ingredient.uid]: ingredient},
    order: [ingredient.uid],
  };
  recipe.preparationSteps = {
    entries: {[step.uid]: step},
    order: [step.uid],
  };
  recipe.materials = {
    entries: {"": {uid: "", posType: PositionType.ingredient} as any},
    order: [""],
  };

  Object.assign(recipe, overrides);
  return recipe;
}

/* ── Tests ────────────────────────────────────────────────────────── */

describe("RecipePdf Komponente", () => {
  const authUser = buildAuthUser();

  it("rendert ohne Fehler mit minimalen Daten", () => {
    const recipe = buildRecipe();
    expect(() =>
      render(
        <RecipePdf
          recipe={recipe}
          scaledPortions={null}
          scaledIngredients={{}}
          scaledMaterials={{}}
          authUser={authUser}
        />
      )
    ).not.toThrow();
  });

  it("zeigt Rezeptname an", () => {
    const recipe = buildRecipe({name: "Schokoladekuchen"} as any);
    const {queryByText} = render(
      <RecipePdf
        recipe={recipe}
        scaledPortions={null}
        scaledIngredients={{}}
        scaledMaterials={{}}
        authUser={authUser}
      />
    );
    expect(queryByText("Schokoladekuchen")).not.toBeNull();
  });

  it("zeigt Zutaten an", () => {
    const recipe = buildRecipe();
    const {queryByText} = render(
      <RecipePdf
        recipe={recipe}
        scaledPortions={null}
        scaledIngredients={{}}
        scaledMaterials={{}}
        authUser={authUser}
      />
    );
    expect(queryByText("Mehl")).not.toBeNull();
  });

  it("zeigt Zubereitungsschritte an", () => {
    const recipe = buildRecipe();
    const {queryByText} = render(
      <RecipePdf
        recipe={recipe}
        scaledPortions={null}
        scaledIngredients={{}}
        scaledMaterials={{}}
        authUser={authUser}
      />
    );
    expect(queryByText("Alles gut verrühren.")).not.toBeNull();
  });

  it("rendert mit Notiz", () => {
    const recipe = buildRecipe({note: "Am besten lauwarm servieren."} as any);
    const {queryByText} = render(
      <RecipePdf
        recipe={recipe}
        scaledPortions={null}
        scaledIngredients={{}}
        scaledMaterials={{}}
        authUser={authUser}
      />
    );
    expect(queryByText("Am besten lauwarm servieren.")).not.toBeNull();
  });

  it("rendert mit Variante", () => {
    const recipe = buildRecipe({
      type: RecipeType.variant,
      variantProperties: {
        variantName: "Glutenfrei",
        note: "Glutenfreies Mehl verwenden.",
      },
    } as any);
    const {queryByText} = render(
      <RecipePdf
        recipe={recipe}
        scaledPortions={null}
        scaledIngredients={{}}
        scaledMaterials={{}}
        authUser={authUser}
      />
    );
    expect(queryByText(/Variante Glutenfrei/)).not.toBeNull();
    expect(queryByText("Glutenfreies Mehl verwenden.")).not.toBeNull();
  });

  it("rendert mit skalierten Portionen", () => {
    const ingredient = buildIngredient({
      uid: "ing-1",
      quantity: 500,
      unit: "g",
    });
    const recipe = buildRecipe({
      ingredients: {
        entries: {[ingredient.uid]: ingredient},
        order: [ingredient.uid],
      },
    } as any);

    const scaledIngredients: RecipeObjectStructure<Ingredient> = {
      "ing-1": {...ingredient, quantity: 1000} as Ingredient,
    };

    expect(() =>
      render(
        <RecipePdf
          recipe={recipe}
          scaledPortions={8}
          scaledIngredients={scaledIngredients}
          scaledMaterials={{}}
          authUser={authUser}
        />
      )
    ).not.toThrow();
  });

  it("rendert mit Material", () => {
    const materialPos = buildMaterialPosition();
    const recipe = buildRecipe({
      materials: {
        entries: {[materialPos.uid]: materialPos},
        order: [materialPos.uid],
      },
    } as any);

    const {queryByText} = render(
      <RecipePdf
        recipe={recipe}
        scaledPortions={null}
        scaledIngredients={{}}
        scaledMaterials={{}}
        authUser={authUser}
      />
    );
    expect(queryByText("Backpapier")).not.toBeNull();
  });

  it("rendert mit Abschnitten (Sections) in Zutaten", () => {
    const section = buildSection({uid: "sec-1", name: "Teig"});
    const ingredient = buildIngredient({uid: "ing-1"});

    const recipe = buildRecipe({
      ingredients: {
        entries: {
          [section.uid]: section as any,
          [ingredient.uid]: ingredient,
        },
        order: [section.uid, ingredient.uid],
      },
    } as any);

    const {queryByText} = render(
      <RecipePdf
        recipe={recipe}
        scaledPortions={null}
        scaledIngredients={{}}
        scaledMaterials={{}}
        authUser={authUser}
      />
    );
    expect(queryByText("Teig:")).not.toBeNull();
  });

  it("rendert mit URL als Quelle", () => {
    const recipe = buildRecipe({
      source: "https://www.example.com/rezept/123",
    } as any);
    expect(() =>
      render(
        <RecipePdf
          recipe={recipe}
          scaledPortions={null}
          scaledIngredients={{}}
          scaledMaterials={{}}
          authUser={authUser}
        />
      )
    ).not.toThrow();
  });
});
