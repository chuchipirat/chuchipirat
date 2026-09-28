/**
 * Unit-Tests für die Sentry-Meldung beim Laden der Rezeptseite (RecipePage).
 *
 * Regression CHUCHIPIRAT-HR: Ein Netzaussetzer beim Laden (postgrest-js
 * verpackt den fehlgeschlagenen fetch() in `{code: "", details, hint,
 * message}`) wurde ungefiltert an Sentry gemeldet.
 */
// Polyfill für jsdom (react-router benötigt TextEncoder/TextDecoder)
import {TextEncoder, TextDecoder} from "util";
Object.assign(global, {TextEncoder, TextDecoder});

import React from "react";
import * as Sentry from "@sentry/react";
import {render, waitFor} from "@testing-library/react";
import {MemoryRouter} from "react-router";

import {RecipePage} from "../recipe";
import {DatabaseContext} from "../../Database/DatabaseContext";
import {DatabaseService} from "../../Database/DatabaseService";

jest.mock("@sentry/react", () => ({
  captureException: jest.fn(),
  captureMessage: jest.fn(),
}));

// RecipeView zieht @react-pdf/renderer (ESM-only) nach — für diese Tests irrelevant
jest.mock("../recipe.view", () => ({RecipeView: () => null}));

jest.mock("../../Session/authUserContext", () => ({
  useAuthUser: () => ({uid: "user-1", roles: ["basic"]}),
}));

jest.mock("../../Shared/customDialogContext", () => ({
  ...jest.requireActual("../../Shared/customDialogContext"),
  useCustomDialog: () => ({customDialog: jest.fn()}),
}));

const mockGetRecipe = jest.fn();
const mockDatabase = {
  recipes: {getRecipe: mockGetRecipe},
  recipeIngredients: {getIngredientsForRecipe: jest.fn().mockResolvedValue([])},
  recipePreparationSteps: {getStepsForRecipe: jest.fn().mockResolvedValue([])},
  recipeMaterials: {getMaterialsForRecipe: jest.fn().mockResolvedValue([])},
  recipeRatings: {getRatingForUser: jest.fn().mockResolvedValue(null)},
  users: {findDisplayNamesByIds: jest.fn().mockResolvedValue(new Map())},
} as unknown as DatabaseService;

/** Rendert die Rezeptseite für eine bestehende Rezept-UID. */
const renderPage = () =>
  render(
    <MemoryRouter initialEntries={["/recipe/recipe-1"]}>
      <DatabaseContext.Provider value={mockDatabase}>
        <RecipePage />
      </DatabaseContext.Provider>
    </MemoryRouter>,
  );

beforeEach(() => {
  jest.clearAllMocks();
});

describe("RecipePage — Rezept laden", () => {
  test("meldet einen Netzaussetzer nicht an Sentry", async () => {
    mockGetRecipe.mockRejectedValue({
      code: "",
      details: "TypeError: Failed to fetch",
      hint: "",
      message: "TypeError: Failed to fetch (api.chuchipirat.ch)",
    });

    renderPage();

    await waitFor(() => expect(mockGetRecipe).toHaveBeenCalledWith("recipe-1"));
    // Microtasks abarbeiten, damit der catch-Block sicher gelaufen ist
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(Sentry.captureException).not.toHaveBeenCalled();
  });

  test("meldet einen echten Fehler weiterhin an Sentry", async () => {
    mockGetRecipe.mockRejectedValue({
      code: "42P01",
      details: "",
      hint: "",
      message: "relation does not exist",
    });

    renderPage();

    await waitFor(() => expect(Sentry.captureException).toHaveBeenCalledTimes(1));
    const [reportedError] = (Sentry.captureException as jest.Mock).mock.calls[0];
    expect(reportedError).toBeInstanceOf(Error);
  });
});
