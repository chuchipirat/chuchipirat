/**
 * Unit-Tests für RecipeDrawer.
 *
 * Prüft das Rendering in verschiedenen Zuständen (offen/geschlossen,
 * View/Edit-Modus, mit/ohne groupConfiguration).
 * RecipeView und RecipeEdit werden gemockt um die schweren Abhängigkeiten
 * (Firebase, Supabase, etc.) zu vermeiden.
 */
import {TextEncoder, TextDecoder} from "util";
Object.assign(global, {TextEncoder, TextDecoder});

import React from "react";
import {render, screen} from "@testing-library/react";
import "@testing-library/jest-dom";
import userEvent from "@testing-library/user-event";

import {RecipeDrawer} from "../RecipeDrawer";
import Recipe from "../recipe.class";
import AuthUser from "../../Firebase/Authentication/authUser.class";

/* ===================================================================
// ======================== Mocks =====================================
// =================================================================== */

jest.mock("../recipe.view", () => ({
  __esModule: true,
  default: () => <div data-testid="recipe-view" />,
}));

jest.mock("../recipe.edit", () => ({
  __esModule: true,
  default: () => <div data-testid="recipe-edit" />,
}));

/* ===================================================================
// ======================== Basis-Props ===============================
// =================================================================== */

const baseProps = {
  drawerSettings: {open: true, isLoadingData: false},
  recipe: new Recipe(),
  mealPlan: [],
  scaledPortions: 0,
  editMode: false,
  disableFunctionality: false,
  firebase: {} as any,
  authUser: {uid: "user-1"} as AuthUser,
  onClose: jest.fn(),
};

beforeEach(() => jest.clearAllMocks());

/* ===================================================================
// ======================== Tests =====================================
// =================================================================== */

describe("RecipeDrawer", () => {
  /* ------------------------------------------
  // 1. Drawer geschlossen wenn open=false
  // ------------------------------------------ */
  test("Drawer ist geschlossen wenn open=false (Modal hat aria-hidden)", () => {
    render(
      <RecipeDrawer
        {...baseProps}
        drawerSettings={{open: false, isLoadingData: false}}
      />,
    );

    // MUI Drawer mit keepMounted=true rendert Inhalte im DOM, markiert das Portal
    // jedoch mit aria-hidden="true", sodass der Drawer nicht zugänglich ist.
    const modal = document.querySelector('[role="presentation"]');
    if (modal) {
      expect(modal).toHaveAttribute("aria-hidden", "true");
    } else {
      // Ohne keepMounted würde das Portal komplett fehlen — auch ein gültiger Zustand
      expect(screen.queryByTestId("recipe-view")).not.toBeInTheDocument();
    }
  });

  /* ------------------------------------------
  // 2. Zeigt RecipeView im View-Modus
  // ------------------------------------------ */
  test("Zeigt RecipeView wenn editMode=false", () => {
    render(<RecipeDrawer {...baseProps} editMode={false} />);

    expect(screen.getByTestId("recipe-view")).toBeInTheDocument();
    expect(screen.queryByTestId("recipe-edit")).not.toBeInTheDocument();
  });

  /* ------------------------------------------
  // 3. Zeigt RecipeEdit im Edit-Modus
  // ------------------------------------------ */
  test("Zeigt RecipeEdit wenn editMode=true", () => {
    render(<RecipeDrawer {...baseProps} editMode={true} />);

    expect(screen.getByTestId("recipe-edit")).toBeInTheDocument();
    expect(screen.queryByTestId("recipe-view")).not.toBeInTheDocument();
  });

  /* ------------------------------------------
  // 4. Schliessen-Button ruft onClose auf
  // ------------------------------------------ */
  test("Schliessen-Button ruft onClose genau einmal auf", async () => {
    const onClose = jest.fn();
    render(<RecipeDrawer {...baseProps} onClose={onClose} />);

    const closeButton = screen.getByRole("button", {name: /close/i});
    await userEvent.click(closeButton);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  /* ------------------------------------------
  // 5. Ohne groupConfiguration (Admin-Kontext) — kein Absturz
  // ------------------------------------------ */
  test("Rendert ohne groupConfiguration (Admin-Kontext)", () => {
    const {groupConfiguration: _omitted, ...propsWithoutGroup} = baseProps as any;

    render(<RecipeDrawer {...propsWithoutGroup} />);

    // Kein Absturz, RecipeView wird gerendert
    expect(screen.getByTestId("recipe-view")).toBeInTheDocument();
  });
});
