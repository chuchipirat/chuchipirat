/**
 * Tests für die Warnung "Liste möglicherweise veraltet" in EventListCard.
 *
 * Regression CHUCHIPIRAT-JE: Eine Zutat im Glühwein-Rezept wurde nach dem
 * Erstellen der Einkaufsliste ergänzt, die Liste warnte aber nicht, weil nur
 * der Menüplan geprüft wurde.
 */
import React from "react";
import {act, render, screen, waitFor} from "@testing-library/react";
import "@testing-library/jest-dom";

import {EventListCard} from "../eventSharedComponents";
import {DatabaseContext} from "../../../Database/DatabaseContext";
import {createEmptyMenuplan} from "../../Menuplan/menuplanService";
import {MenuplanData} from "../../Menuplan/menuplan.types";
import {RecipeType} from "../../../Recipe/recipe.class";
import DatabaseService from "../../../Database/DatabaseService";

/* ===================================================================
// ======================== Mock-Setup ================================
// =================================================================== */

jest.mock("@sentry/react", () => ({captureException: jest.fn()}));

const getContentChangeDates = jest.fn();
const mockDatabase = {
  recipes: {getContentChangeDates},
} as unknown as DatabaseService;

/* ===================================================================
// ======================== Testdaten =================================
// =================================================================== */

const WARNING = "Liste veraltet";
const LIST_GENERATED_AT = new Date("2026-11-09T12:00:00Z");
const BEFORE_LIST = new Date("2026-11-09T11:00:00Z");
const AFTER_LIST = new Date("2026-11-09T17:20:00Z");

/**
 * Menüplan mit einem Menü, in dem der Glühwein steht.
 *
 * @param lastChangeDate - Letzte Änderung des Menüplans.
 * @returns Menüplan für die Tests.
 */
const buildMenuplan = (lastChangeDate: Date): MenuplanData => {
  const menuplan = createEmptyMenuplan();
  menuplan.uid = "event-1";
  menuplan.lastChange = {
    date: lastChangeDate,
    fromUid: "",
    fromDisplayName: "",
  };
  menuplan.mealRecipes["meal-recipe-1"] = {
    uid: "meal-recipe-1",
    recipe: {
      recipeUid: "recipe-gluehwein",
      name: "Glühwein",
      type: RecipeType.public,
      createdFromUid: "user-1",
    },
    plan: [],
    totalPortions: 0,
  };
  menuplan.menues["menue-1"] = {
    uid: "menue-1",
    name: "",
    mealRecipeOrder: ["meal-recipe-1"],
    materialOrder: [],
    productOrder: [],
  };
  return menuplan;
};

/** Einkaufsliste, die vor dem Menüplan und Rezept generiert wurde. */
const lists = {
  "list-1": {
    properties: {
      uid: "list-1",
      name: "Einkauf Samstag",
      selectedMeals: [],
      selectedMenues: ["menue-1"],
      generated: {date: LIST_GENERATED_AT, fromUid: "", fromDisplayName: ""},
    },
  },
} as unknown as React.ComponentProps<typeof EventListCard>["lists"];

/**
 * Rendert die Karte mit ausgewählter Liste.
 *
 * @param menuplan - Menüplan für die Karte.
 */
const renderCard = (menuplan: MenuplanData) =>
  render(
    <DatabaseContext.Provider value={mockDatabase}>
      <EventListCard
        cardTitle="Einkaufsliste"
        cardDescription=""
        outOfDateWarnMessage={WARNING}
        selectedListItem="list-1"
        lists={lists}
        noOfLists={1}
        menuplan={menuplan}
        onCreateList={jest.fn()}
        onListElementSelect={jest.fn()}
        onListElementDelete={jest.fn()}
        onListElementEdit={jest.fn()}
        onRefreshLists={jest.fn()}
        onGeneratePrintVersion={jest.fn()}
      />
    </DatabaseContext.Provider>,
  );

/* ===================================================================
// ======================== Tests =====================================
// =================================================================== */

describe("EventListCard — Warnung bei veralteter Liste", () => {
  beforeEach(() => getContentChangeDates.mockReset());

  test("warnt, wenn nur ein Rezept der Liste nach dem Erstellen geändert wurde", async () => {
    getContentChangeDates.mockResolvedValue(
      new Map([["recipe-gluehwein", AFTER_LIST]]),
    );

    renderCard(buildMenuplan(BEFORE_LIST));

    expect(await screen.findByText(WARNING)).toBeInTheDocument();
    expect(getContentChangeDates).toHaveBeenCalledWith(["recipe-gluehwein"]);
  });

  test("warnt nicht, wenn Menüplan und Rezepte älter sind als die Liste", async () => {
    getContentChangeDates.mockResolvedValue(
      new Map([["recipe-gluehwein", BEFORE_LIST]]),
    );

    renderCard(buildMenuplan(BEFORE_LIST));

    await waitFor(() => expect(getContentChangeDates).toHaveBeenCalled());
    expect(screen.queryByText(WARNING)).not.toBeInTheDocument();
  });

  test("warnt weiterhin bei geändertem Menüplan, auch wenn das Laden scheitert", async () => {
    getContentChangeDates.mockRejectedValue(new Error("Netzwerk"));

    renderCard(buildMenuplan(AFTER_LIST));

    expect(await screen.findByText(WARNING)).toBeInTheDocument();
  });

  test("lädt neu, wenn der Browser-Tab wieder sichtbar wird", async () => {
    // Rezept in einem anderen Tab bearbeitet, danach zurück zur Liste
    getContentChangeDates
      .mockResolvedValueOnce(new Map([["recipe-gluehwein", BEFORE_LIST]]))
      .mockResolvedValueOnce(new Map([["recipe-gluehwein", AFTER_LIST]]));
    renderCard(buildMenuplan(BEFORE_LIST));
    await waitFor(() => expect(getContentChangeDates).toHaveBeenCalledTimes(1));

    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"));
    });

    expect(await screen.findByText(WARNING)).toBeInTheDocument();
    expect(getContentChangeDates).toHaveBeenCalledTimes(2);
  });
});
