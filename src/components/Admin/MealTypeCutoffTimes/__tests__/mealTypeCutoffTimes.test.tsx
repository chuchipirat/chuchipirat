/**
 * Unit-Tests für MealTypeCutoffTimesPage.
 *
 * Testet insbesondere das Chip-Verhalten des Namens-Felds: Leertaste und
 * Verlassen des Feldes müssen den getippten Freitext als Chip übernehmen
 * (nicht nur Enter), und "Speichern" muss alle committeten Namen persistieren.
 */
// Polyfill für jsdom (react-router benötigt TextEncoder/TextDecoder)
import {TextEncoder, TextDecoder} from "util";
Object.assign(global, {TextEncoder, TextDecoder});

import React from "react";
import {render, screen, waitFor, fireEvent} from "@testing-library/react";
import "@testing-library/jest-dom";
import userEvent from "@testing-library/user-event";
import {MemoryRouter} from "react-router";

import {MealTypeCutoffTimesPage} from "../mealTypeCutoffTimes";
import {DatabaseContext} from "../../../Database/DatabaseContext";

/* ===================================================================
// ======================== Mock-Setup ================================
// =================================================================== */

/** Mock: useAuthUser — gibt einen Admin-Benutzer zurück */
const mockAuthUser = {
  uid: "auth-uuid-123",
  email: "admin@chuchipirat.ch",
  roles: ["admin"],
};
jest.mock("../../../Session/authUserContext", () => ({
  useAuthUser: () => mockAuthUser,
}));

/** Mock: useCustomDialog */
const mockCustomDialog = jest.fn();
jest.mock("../../../Shared/customDialogContext", () => ({
  ...jest.requireActual("../../../Shared/customDialogContext"),
  useCustomDialog: () => ({customDialog: mockCustomDialog}),
}));

/** Mock: MenuplanRepository-Methoden (Cutoff-Zeiten-CRUD) */
const mockGetCutoffTimes = jest.fn();
const mockCreateCutoffTime = jest.fn();
const mockUpdateCutoffTime = jest.fn();
const mockDeleteCutoffTime = jest.fn();

/** Mock-DatabaseService */
const mockDatabase = {
  menuplan: {
    getCutoffTimes: mockGetCutoffTimes,
    createCutoffTime: mockCreateCutoffTime,
    updateCutoffTime: mockUpdateCutoffTime,
    deleteCutoffTime: mockDeleteCutoffTime,
  },
} as any;

/* ===================================================================
// ======================== Render-Helper =============================
// =================================================================== */

const renderPage = () => {
  return render(
    <MemoryRouter initialEntries={["/system/mealtypecutofftimes"]}>
      <DatabaseContext.Provider value={mockDatabase}>
        <MealTypeCutoffTimesPage />
      </DatabaseContext.Provider>
    </MemoryRouter>,
  );
};

beforeEach(() => {
  jest.clearAllMocks();
  mockGetCutoffTimes.mockResolvedValue([
    {id: "c1", names: ["Zmittag"], cutoffTime: "13:00", sortOrder: 1},
  ]);
  mockUpdateCutoffTime.mockResolvedValue(undefined);
  mockCreateCutoffTime.mockResolvedValue({
    id: "new-id",
    names: ["Zvieri"],
    cutoffTime: "16:00",
    sortOrder: 2,
  });
});

describe("MealTypeCutoffTimesPage", () => {
  test("laedt bestehende Cutoff-Zeiten mit Namens-Chips", async () => {
    renderPage();

    await waitFor(() => {
      // Erscheint zweimal: einmal im Karten-Titel, einmal als Chip-Label
      expect(screen.getAllByText("Zmittag")).toHaveLength(2);
    });
  });

  test("uebernimmt getippten Text als Chip bei Leertaste", async () => {
    const user = userEvent.setup();
    renderPage();

    await waitFor(() => {
      expect(screen.getByDisplayValue("13:00")).toBeInTheDocument();
    });

    const nameInput = screen.getByLabelText("Mahlzeit-Typ-Name");
    await user.type(nameInput, "Mittagessen ");

    expect(screen.getByText("Mittagessen")).toBeInTheDocument();
  });

  test("uebernimmt getippten Text als Chip beim Verlassen des Feldes", async () => {
    const user = userEvent.setup();
    renderPage();

    await waitFor(() => {
      expect(screen.getByDisplayValue("13:00")).toBeInTheDocument();
    });

    const nameInput = screen.getByLabelText("Mahlzeit-Typ-Name");
    await user.type(nameInput, "Frühstück");
    await user.tab();

    expect(screen.getByText("Frühstück")).toBeInTheDocument();
  });

  test("speichert alle committeten Namen (Enter, Leertaste, Blur) beim Klick auf Speichern", async () => {
    const user = userEvent.setup();
    renderPage();

    await waitFor(() => {
      expect(screen.getByDisplayValue("13:00")).toBeInTheDocument();
    });

    const nameInput = screen.getByLabelText("Mahlzeit-Typ-Name");
    // Zweiter Name per Leertaste committen
    await user.type(nameInput, "Mittagessen ");
    // Dritter Name per Blur committen (kein Leerzeichen/Enter)
    await user.type(nameInput, "Frühstück");
    await user.tab();

    const saveButton = screen.getByRole("button", {name: /speichern/i});
    await user.click(saveButton);

    await waitFor(() => {
      expect(mockUpdateCutoffTime).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "c1",
          names: ["Zmittag", "Mittagessen", "Frühstück"],
        }),
      );
    });
  });

  describe("Reihenfolge-Feld — Kappung ungültiger Werte", () => {
    test("kappt eine negativ eingegebene Reihenfolge auf 0", async () => {
      renderPage();

      await waitFor(() => {
        expect(screen.getByDisplayValue("1")).toBeInTheDocument();
      });

      const sortOrderInput = screen.getByLabelText(
        "Reihenfolge",
      ) as HTMLInputElement;
      fireEvent.change(sortOrderInput, {target: {value: "-3"}});

      expect(sortOrderInput.value).toBe("0");
    });

    test("kappt eine zu grosse Reihenfolge auf den Postgres-integer-Maximalwert", async () => {
      renderPage();

      await waitFor(() => {
        expect(screen.getByDisplayValue("1")).toBeInTheDocument();
      });

      const sortOrderInput = screen.getByLabelText(
        "Reihenfolge",
      ) as HTMLInputElement;
      fireEvent.change(sortOrderInput, {target: {value: "99999999999"}});

      expect(sortOrderInput.value).toBe("2147483647");
    });
  });
});
