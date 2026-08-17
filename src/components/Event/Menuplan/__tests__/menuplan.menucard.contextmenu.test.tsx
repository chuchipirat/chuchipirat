/**
 * Unit-Tests für das Kontextmenü der Menü-Karte in menuplan.menucard.tsx.
 *
 * Prüft, dass das Kontextmenü sofort beim Klick auf einen Eintrag schliesst,
 * unabhängig davon, ob dieser Eintrag einen asynchronen Dialog-Roundtrip
 * auslöst (z.B. "Notiz hinzufügen") oder nicht (z.B. "Menü löschen").
 */
import {TextEncoder, TextDecoder} from "util";
Object.assign(global, {TextEncoder, TextDecoder});

// @react-pdf/renderer ist ESM-only und wird von Jest nicht transformiert —
// menuplan.menucard.tsx importiert transitiv davon (via menuplanService.ts
// → menuplan.tsx → RecipeDrawer.tsx → recipe.view.tsx → pdfUtils.ts).
jest.mock("@react-pdf/renderer", () => ({
  Document: () => null,
  Page: () => null,
  View: () => null,
  Text: () => null,
  Link: () => null,
  Svg: () => null,
  Path: () => null,
  Font: {register: jest.fn(), registerEmojiSource: jest.fn()},
  StyleSheet: {create: (styles: unknown) => styles},
  pdf: jest.fn(),
}));
jest.mock("@react-pdf/types", () => ({}));
jest.mock("../../../Shared/pdfFontRegistration", () => ({}));

import React from "react";
import {render, screen, fireEvent} from "@testing-library/react";
import "@testing-library/jest-dom";

import {MenueListOfMeal} from "../menuplan.menucard";
import {HighlightedMenueContext} from "../highlightContext";
import {EventGroupConfiguration} from "../../GroupConfiguration/groupConfiguration.class";
import type {Meal, Menue, MenuplanData} from "../menuplan.types";
import {
  NOTE as TEXT_NOTE,
  ADD as TEXT_ADD,
  DELETE_MENUE as TEXT_DELETE_MENUE,
} from "../../../../constants/text";

/**
 * Auto-mockender Proxy für useCustomStyles: jeder Property-Zugriff
 * (`classes.x.y`) und jeder Funktionsaufruf (`classes.x.y(...)`) liefert
 * wieder einen Proxy zurück, statt einen konkreten Style-Wert zu benötigen.
 */
function createStyleProxy(): unknown {
  const handler: ProxyHandler<object> = {
    get: () => createStyleProxy(),
    apply: () => createStyleProxy(),
  };
  return new Proxy(() => {}, handler);
}

jest.mock("../../../../constants/styles", () => ({
  useCustomStyles: jest.fn(() => createStyleProxy()),
}));

const mockCustomDialog = jest.fn().mockResolvedValue({valid: false, input: ""});
jest.mock("../../../Shared/customDialogContext", () => ({
  ...jest.requireActual("../../../Shared/customDialogContext"),
  useCustomDialog: () => ({customDialog: mockCustomDialog}),
}));

const MENUE_UID = "menue-1";
const MEAL_UID = "meal-1";
const MEALTYPE_UID = "mealtype-1";

function buildMenue(): Menue {
  return {
    uid: MENUE_UID,
    name: "Testmenü",
    mealRecipeOrder: [],
    materialOrder: [],
    productOrder: [],
  };
}

function buildMeal(): Meal {
  return {
    uid: MEAL_UID,
    date: "2026-03-10",
    mealType: MEALTYPE_UID,
    menuOrder: [MENUE_UID],
  };
}

const defaultProps = {
  meal: buildMeal(),
  menues: {[MENUE_UID]: buildMenue()} as MenuplanData["menues"],
  mealRecipes: {} as MenuplanData["mealRecipes"],
  products: {} as MenuplanData["products"],
  materials: {} as MenuplanData["materials"],
  notes: {} as MenuplanData["notes"],
  menuplanSettings: {showDetails: false, enableDragAndDrop: false},
  groupConfiguration: new EventGroupConfiguration(),
  mealTypes: {
    entries: {[MEALTYPE_UID]: {uid: MEALTYPE_UID, name: "Zmittag"}},
    order: [MEALTYPE_UID],
  } as MenuplanData["mealTypes"],
  onUpdateMenue: jest.fn(),
  onAddRecipe: jest.fn(),
  onAddProduct: jest.fn(),
  onAddMaterial: jest.fn(),
  onEditMenue: jest.fn(),
  onDeleteMenue: jest.fn(),
  onNoteUpdate: jest.fn(),
  onMealRecipeOpen: jest.fn(),
  onMealProductOpen: jest.fn(),
  onMealMaterialOpen: jest.fn(),
  onMoveDragAndDropElement: jest.fn(),
};

const renderMenueCard = () =>
  render(
    <HighlightedMenueContext.Provider value={new Set()}>
      <MenueListOfMeal {...defaultProps} />
    </HighlightedMenueContext.Provider>,
  );

describe("MenueCard — Kontextmenü schliesst sofort bei Klick", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  test("schliesst das Kontextmenü synchron beim Klick auf 'Notiz hinzufügen', bevor der Dialog aufgelöst ist", () => {
    let resolveDialog: (value: unknown) => void = () => {};
    mockCustomDialog.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveDialog = resolve;
      }),
    );

    renderMenueCard();

    fireEvent.click(screen.getByLabelText("settings"));
    expect(screen.getByRole("menu")).toBeInTheDocument();

    fireEvent.click(screen.getByText(`${TEXT_NOTE} ${TEXT_ADD}`));

    // Menü muss sofort geschlossen sein — der Dialog wurde absichtlich
    // noch nicht aufgelöst.
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();

    resolveDialog({valid: false, input: ""});
  });

  test("schliesst das Kontextmenü beim Klick auf 'Menü löschen'", () => {
    renderMenueCard();

    fireEvent.click(screen.getByLabelText("settings"));
    expect(screen.getByRole("menu")).toBeInTheDocument();

    fireEvent.click(screen.getByText(TEXT_DELETE_MENUE));

    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(defaultProps.onDeleteMenue).toHaveBeenCalledWith(MENUE_UID);
  });
});
