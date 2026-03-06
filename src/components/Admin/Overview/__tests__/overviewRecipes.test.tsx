/**
 * Unit-Tests für Admin/Overview/overviewRecipes.tsx.
 *
 * Testet die Suchfunktionalität in allen 4 Modi (Rezeptname, Rezept-ID,
 * Ersteller-ID, Ersteller-Name), Fehlerbehandlung und Empty States.
 *
 * Der Supabase-Client, Firebase und AuthUser werden vollständig gemockt.
 * RecipeDrawer wird gemockt um die schweren Abhängigkeiten zu vermeiden.
 */
import {TextEncoder, TextDecoder} from "util";
Object.assign(global, {TextEncoder, TextDecoder});

import React from "react";
import {render, screen, waitFor} from "@testing-library/react";
import "@testing-library/jest-dom";
import userEvent from "@testing-library/user-event";

import OverviewRecipePage from "../overviewRecipes";
import {DatabaseContext} from "../../../Database/DatabaseContext";
import {FirebaseContext} from "../../../Firebase/firebaseContext";

/* ===================================================================
// ======================== Mocks =====================================
// =================================================================== */

jest.mock("../../../Recipe/RecipeDrawer", () => ({
  __esModule: true,
  RecipeDrawer: () => null,
}));

jest.mock("../../../Session/authUserContext", () => ({
  useAuthUser: () => ({uid: "admin-user-1", email: "admin@test.ch"}),
}));

/* Mock-DB-Methoden */
const mockSearchByName = jest.fn();
const mockSearchByRecipeId = jest.fn();
const mockSearchByCreatorId = jest.fn();
const mockSearchByCreatorIds = jest.fn();
const mockFindAuthUids = jest.fn();
const mockFindDisplayNames = jest.fn().mockResolvedValue(new Map());

/** Hilfsdaten: öffentliches Kurzrezept */
const publicShortDomain = {
  uid: "recipe-uuid-001",
  name: "Gemüsesuppe",
  source: "",
  pictureSrc: "",
  tags: [],
  menuTypes: [1],
  dietProperties: {allergens: [], diet: 3},
  outdoorKitchenSuitable: false,
  avgRating: 0,
  noRatings: 0,
  recipeType: "public",
  variantName: null,
  createdAt: new Date("2026-01-01"),
  createdBy: "creator-uuid-111",
};

/** Hilfsdaten: privates Kurzrezept */
const privateShortDomain = {
  ...publicShortDomain,
  uid: "recipe-uuid-002",
  name: "Privates Rezept",
  recipeType: "private",
};

/**
 * Mock-DatabaseService.
 * Verwendet reguläre Repositories (kein admin-Bypass) — entspricht dem
 * nach der RLS-Korrektur (20260306000001_fix_recipes_rls.sql) erwarteten Verhalten.
 */
const mockDatabase: any = {
  recipes: {
    searchByName: mockSearchByName,
    searchByRecipeId: mockSearchByRecipeId,
    searchByCreatorId: mockSearchByCreatorId,
    searchByCreatorIds: mockSearchByCreatorIds,
    getRecipe: jest.fn(),
  },
  users: {
    findAuthUidsByDisplayName: mockFindAuthUids,
    findDisplayNamesByAuthUids: mockFindDisplayNames,
  },
  recipeIngredients: {
    getIngredientsForRecipe: jest.fn().mockResolvedValue([]),
  },
  recipePreparationSteps: {
    getStepsForRecipe: jest.fn().mockResolvedValue([]),
  },
  recipeMaterials: {
    getMaterialsForRecipe: jest.fn().mockResolvedValue([]),
  },
};

const mockFirebase = {} as any;

beforeEach(() => jest.clearAllMocks());

/* ===================================================================
// ======================== Render-Helper =============================
// =================================================================== */

const renderPage = () =>
  render(
    <FirebaseContext.Provider value={mockFirebase}>
      <DatabaseContext.Provider value={mockDatabase}>
        <OverviewRecipePage />
      </DatabaseContext.Provider>
    </FirebaseContext.Provider>,
  );

/* ===================================================================
// ======================== Tests =====================================
// =================================================================== */

describe("OverviewRecipePage (Admin)", () => {
  /* ------------------------------------------
  // 1. Leerer Zustand vor der Suche
  // ------------------------------------------ */
  test("Zeigt Hinweistext vor der ersten Suche, kein DB-Aufruf", () => {
    renderPage();

    expect(
      screen.getByText(/Suchbegriff eingeben/i),
    ).toBeInTheDocument();

    expect(mockSearchByName).not.toHaveBeenCalled();
  });

  /* ------------------------------------------
  // 2. Suche nach Rezeptname → Ergebnisse
  // ------------------------------------------ */
  test("Suche nach Rezeptname ruft searchByName auf und zeigt Karten", async () => {
    mockSearchByName.mockResolvedValue([publicShortDomain]);

    renderPage();

    const input = screen.getByLabelText(/Suchbegriff/i);
    await userEvent.type(input, "Gemüse");
    await userEvent.click(screen.getByRole("button", {name: /Suche/i}));

    await waitFor(() => {
      expect(mockSearchByName).toHaveBeenCalledWith("Gemüse", "all");
    });

    expect(await screen.findByText("Gemüsesuppe")).toBeInTheDocument();
  });

  /* ------------------------------------------
  // 3. Suche nach Rezept-ID
  // ------------------------------------------ */
  test("Suche nach Rezept-ID ruft searchByRecipeId auf", async () => {
    mockSearchByRecipeId.mockResolvedValue([publicShortDomain]);

    renderPage();

    // Suchmodus auf Rezept-ID umschalten
    await userEvent.click(screen.getByRole("radio", {name: /Rezept-ID/i}));

    const input = screen.getByLabelText(/Suchbegriff/i);
    await userEvent.type(input, "recipe-uuid-001");
    await userEvent.click(screen.getByRole("button", {name: /Suche/i}));

    await waitFor(() => {
      expect(mockSearchByRecipeId).toHaveBeenCalledWith("recipe-uuid-001");
    });
  });

  /* ------------------------------------------
  // 4. Private Rezepte zeigen Lock-Icon
  // ------------------------------------------ */
  test("Karte eines privaten Rezepts zeigt Lock-Icon", async () => {
    mockSearchByName.mockResolvedValue([privateShortDomain]);

    renderPage();

    const input = screen.getByLabelText(/Suchbegriff/i);
    await userEvent.type(input, "Privat");
    await userEvent.click(screen.getByRole("button", {name: /Suche/i}));

    await waitFor(() => {
      expect(screen.getByTitle("privat")).toBeInTheDocument();
    });
  });

  /* ------------------------------------------
  // 5. Suche nach Ersteller-ID
  // ------------------------------------------ */
  test("Suche nach Ersteller-ID ruft searchByCreatorId auf", async () => {
    mockSearchByCreatorId.mockResolvedValue([publicShortDomain]);

    renderPage();

    await userEvent.click(screen.getByRole("radio", {name: /Ersteller-ID/i}));

    const input = screen.getByLabelText(/Suchbegriff/i);
    await userEvent.type(input, "creator-uuid-111");
    await userEvent.click(screen.getByRole("button", {name: /Suche/i}));

    await waitFor(() => {
      expect(mockSearchByCreatorId).toHaveBeenCalledWith("creator-uuid-111", "all");
    });
  });

  /* ------------------------------------------
  // 6. Suche nach Ersteller-Name (zweistufig)
  // ------------------------------------------ */
  test("Suche nach Ersteller-Name führt zweistufige Suche durch", async () => {
    mockFindAuthUids.mockResolvedValue(["creator-uuid-111"]);
    mockSearchByCreatorIds.mockResolvedValue([publicShortDomain]);

    renderPage();

    await userEvent.click(screen.getByRole("radio", {name: /Ersteller-Name/i}));

    const input = screen.getByLabelText(/Suchbegriff/i);
    await userEvent.type(input, "Max");
    await userEvent.click(screen.getByRole("button", {name: /Suche/i}));

    await waitFor(() => {
      expect(mockFindAuthUids).toHaveBeenCalledWith("Max");
      expect(mockSearchByCreatorIds).toHaveBeenCalledWith(
        ["creator-uuid-111"],
        "all",
      );
    });
  });

  /* ------------------------------------------
  // 7. Keine Ergebnisse → Hinweistext
  // ------------------------------------------ */
  test("Zeigt Hinweistext wenn keine Rezepte gefunden", async () => {
    mockSearchByName.mockResolvedValue([]);

    renderPage();

    const input = screen.getByLabelText(/Suchbegriff/i);
    await userEvent.type(input, "Unbekannt");
    await userEvent.click(screen.getByRole("button", {name: /Suche/i}));

    await waitFor(() => {
      expect(screen.getByText(/Keine Rezepte gefunden/i)).toBeInTheDocument();
    });
  });

  /* ------------------------------------------
  // 8. Fehler → AlertMessage
  // ------------------------------------------ */
  test("Zeigt Fehlermeldung wenn searchByName fehlschlägt", async () => {
    mockSearchByName.mockRejectedValue(new Error("Datenbankfehler"));

    renderPage();

    const input = screen.getByLabelText(/Suchbegriff/i);
    await userEvent.type(input, "Irgendwas");
    await userEvent.click(screen.getByRole("button", {name: /Suche/i}));

    await waitFor(() => {
      expect(screen.getByText(/Datenbankfehler/i)).toBeInTheDocument();
    });
  });
});
