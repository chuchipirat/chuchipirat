/**
 * Unit-Tests für UnitsPage.
 *
 * Testet die Einheiten-Verwaltungsseite: initiales Laden, Datenanzeige,
 * Bearbeitungsmodus, Speichern und Fehlerbehandlung.
 */
// Polyfill für jsdom (react-router benötigt TextEncoder/TextDecoder)
import {TextEncoder, TextDecoder} from "util";
Object.assign(global, {TextEncoder, TextDecoder});

import React from "react";
import {render, screen, waitFor} from "@testing-library/react";
import "@testing-library/jest-dom";
import userEvent from "@testing-library/user-event";
import {MemoryRouter} from "react-router";

import {UnitsPage} from "../units";
import {DatabaseContext} from "../../Database/DatabaseContext";

/* ===================================================================
// ======================== Mock-Setup ================================
// =================================================================== */

/** Mock: useAuthUser — gibt einen Admin-Benutzer zurück */
const mockAuthUser = {
  uid: "auth-uuid-123",
  email: "admin@chuchipirat.ch",
  roles: ["admin"],
};
jest.mock("../../Session/authUserContext", () => ({
  useAuthUser: () => mockAuthUser,
}));

/** Mock: ImageRepository */
jest.mock("../../../constants/imageRepository", () => ({
  ImageRepository: {
    getEnvironmentRelatedPicture: () => ({SIGN_IN_HEADER: "test-image.png"}),
  },
}));

/** Mock: UnitRepository-Methoden */
const mockGetAllUnits = jest.fn();
const mockCreateUnit = jest.fn();
const mockUpdateUnit = jest.fn();

/** Mock-DatabaseService */
const mockDatabase = {
  units: {
    getAllUnits: mockGetAllUnits,
    createUnit: mockCreateUnit,
    updateUnit: mockUpdateUnit,
  },
} as unknown as ReturnType<typeof import("../../Database/DatabaseContext").useDatabase>;

/** Testdaten: zwei Beispiel-Einheiten */
const mockUnits = [
  {uid: "unit-1", key: "kg", name: "Kilogramm", dimension: "MAS"},
  {uid: "unit-2", key: "l", name: "Liter", dimension: "VOL"},
];

/* ===================================================================
// ======================== Render-Helper =============================
// =================================================================== */

/**
 * Rendert die UnitsPage mit allen nötigen Providern.
 */
const renderUnitsPage = () => {
  return render(
    <MemoryRouter initialEntries={["/units"]}>
      <DatabaseContext.Provider value={mockDatabase}>
        <UnitsPage />
      </DatabaseContext.Provider>
    </MemoryRouter>
  );
};

/* ===================================================================
// ======================== Tests =====================================
// =================================================================== */

beforeEach(() => {
  jest.clearAllMocks();
  mockGetAllUnits.mockResolvedValue(mockUnits);
  mockUpdateUnit.mockResolvedValue(undefined);
  mockCreateUnit.mockResolvedValue(undefined);
});

describe("UnitsPage", () => {
  describe("Initialer Zustand", () => {
    test("Seitentitel wird angezeigt", async () => {
      renderUnitsPage();

      await waitFor(() => {
        expect(screen.getByText("Einheiten")).toBeInTheDocument();
      });
    });

    test("getAllUnits() wird beim Laden aufgerufen", async () => {
      renderUnitsPage();

      await waitFor(() => {
        expect(mockGetAllUnits).toHaveBeenCalled();
      });
    });

    test("Einheiten werden angezeigt", async () => {
      renderUnitsPage();

      await waitFor(() => {
        expect(screen.getByText("kg")).toBeInTheDocument();
        expect(screen.getByText("Kilogramm")).toBeInTheDocument();
        expect(screen.getByText("l")).toBeInTheDocument();
        expect(screen.getByText("Liter")).toBeInTheDocument();
      });
    });
  });

  describe("Fehlerbehandlung beim Laden", () => {
    test("Fehler beim Laden wird als Alert angezeigt", async () => {
      mockGetAllUnits.mockRejectedValue(new Error("DB Fehler"));
      renderUnitsPage();

      await waitFor(() => {
        expect(screen.getByRole("alert")).toBeInTheDocument();
      });
    });
  });

  describe("Bearbeitungsmodus", () => {
    test("'anpassen'-Button wird angezeigt", async () => {
      renderUnitsPage();

      await waitFor(() => {
        expect(
          screen.getByRole("button", {name: /anpassen/i})
        ).toBeInTheDocument();
      });
    });

    test("Speichern ohne Änderungen schreibt nichts in die DB", async () => {
      renderUnitsPage();

      await waitFor(() => expect(mockGetAllUnits).toHaveBeenCalled());

      // Bearbeitungsmodus aktivieren, dann direkt speichern ohne Änderung
      await userEvent.click(screen.getByRole("button", {name: /anpassen/i}));
      await waitFor(() =>
        expect(screen.getByRole("button", {name: /Speichern/i})).toBeInTheDocument()
      );
      await userEvent.click(screen.getByRole("button", {name: /Speichern/i}));

      // Da keine Einheit geändert wurde, darf updateUnit nicht aufgerufen werden
      expect(mockUpdateUnit).not.toHaveBeenCalled();
    });

    test("Speichern ruft updateUnit nur für geänderte Einheiten auf", async () => {
      renderUnitsPage();

      await waitFor(() => expect(mockGetAllUnits).toHaveBeenCalled());

      // Bearbeitungsmodus aktivieren
      await userEvent.click(screen.getByRole("button", {name: /anpassen/i}));

      // Name-Feld der ersten Einheit (kg / Kilogramm) ändern
      const nameInput = await screen.findByDisplayValue("Kilogramm");
      await userEvent.clear(nameInput);
      await userEvent.type(nameInput, "Kilogramm (geändert)");

      // Speichern
      await userEvent.click(screen.getByRole("button", {name: /Speichern/i}));

      // Nur "kg" wurde geändert → genau ein updateUnit-Aufruf
      await waitFor(() => {
        expect(mockUpdateUnit).toHaveBeenCalledTimes(1);
        expect(mockUpdateUnit).toHaveBeenCalledWith(
          expect.objectContaining({key: "kg", name: "Kilogramm (geändert)"}),
          mockAuthUser
        );
      });
    });
  });
});
