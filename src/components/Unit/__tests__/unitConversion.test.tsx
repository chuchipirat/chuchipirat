/**
 * Unit-Tests für UnitConversionPage.
 *
 * Testet die Einheitenumrechnungs-Seite: Seitentitel, initiales Laden der
 * Umrechnungen, Anzeige von Basis- und Produktumrechnungen, Tab-Navigation,
 * Bearbeitungsmodus, Abbrechen und selektives Speichern.
 */
// Polyfill für jsdom (react-router benötigt TextEncoder/TextDecoder)
import {TextEncoder, TextDecoder} from "util";
Object.assign(global, {TextEncoder, TextDecoder});

import React from "react";
import {render, screen, waitFor} from "@testing-library/react";
import "@testing-library/jest-dom";
import userEvent from "@testing-library/user-event";
import {MemoryRouter} from "react-router";

import UnitConversionPage from "../unitConversion";
import {DatabaseContext} from "../../Database/DatabaseContext";

/* ===================================================================
// ======================== Mock-Setup ================================
// =================================================================== */

/** Mock: useAuthUser — gibt einen CommunityLeader-Benutzer zurück */
const mockAuthUser = {
  uid: "auth-uuid-123",
  email: "leader@chuchipirat.ch",
  roles: ["communityLeader"],
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

/** Mock: UnitConversion-Repository-Methoden */
const mockGetAllBasicConversions = jest.fn();
const mockGetAllProductConversions = jest.fn();
const mockUpsertBasicConversion = jest.fn().mockResolvedValue(undefined);
const mockUpsertProductConversion = jest.fn().mockResolvedValue(undefined);
const mockDeleteBasicConversion = jest.fn().mockResolvedValue(undefined);
const mockDeleteProductConversion = jest.fn().mockResolvedValue(undefined);
const mockGetAllProducts = jest.fn();
const mockGetAllUnits = jest.fn();

/** Mock-DatabaseService */
const mockDatabase = {
  unitConversionBasic: {
    getAllConversions: mockGetAllBasicConversions,
    upsertConversion: mockUpsertBasicConversion,
    deleteConversion: mockDeleteBasicConversion,
  },
  unitConversionProducts: {
    getAllConversions: mockGetAllProductConversions,
    upsertConversion: mockUpsertProductConversion,
    deleteConversion: mockDeleteProductConversion,
  },
  products: {
    getAllProducts: mockGetAllProducts,
  },
  units: {
    getAllUnits: mockGetAllUnits,
  },
} as any;

/** Mock-Daten: Basis-Umrechnungen */
const mockBasicConversions = [
  {
    uid: "conv-1",
    fromUnit: "kg",
    toUnit: "g",
    numerator: 1000,
    denominator: 1,
  },
];

/** Mock-Daten: Produktspezifische Umrechnungen */
const mockProductConversions = [
  {
    uid: "conv-p1",
    fromUnit: "stk",
    toUnit: "g",
    numerator: 250,
    denominator: 1,
    productUid: "prod-1",
    productName: "Butter",
  },
];

/* ===================================================================
// ======================== Render-Helper =============================
// =================================================================== */

/**
 * Rendert die UnitConversionPage mit allen nötigen Providern.
 */
const renderUnitConversionPage = () => {
  return render(
    <MemoryRouter initialEntries={["/unitConversion"]}>
      <DatabaseContext.Provider value={mockDatabase}>
        <UnitConversionPage />
      </DatabaseContext.Provider>
    </MemoryRouter>
  );
};

/* ===================================================================
// ======================== Tests =====================================
// =================================================================== */

beforeEach(() => {
  jest.clearAllMocks();
  mockGetAllBasicConversions.mockResolvedValue(mockBasicConversions);
  mockGetAllProductConversions.mockResolvedValue(mockProductConversions);
  mockUpsertBasicConversion.mockResolvedValue(undefined);
  mockUpsertProductConversion.mockResolvedValue(undefined);
  mockDeleteBasicConversion.mockResolvedValue(undefined);
  mockDeleteProductConversion.mockResolvedValue(undefined);
  mockGetAllProducts.mockResolvedValue([]);
  mockGetAllUnits.mockResolvedValue([]);
});

describe("UnitConversionPage", () => {
  describe("Initialer Zustand", () => {
    test("Seitentitel wird angezeigt", async () => {
      renderUnitConversionPage();

      await waitFor(() => {
        expect(
          screen.getByText("Umrechnung Einheiten")
        ).toBeInTheDocument();
      });
    });

    test("Umrechnungen werden geladen", async () => {
      renderUnitConversionPage();

      await waitFor(() => {
        expect(mockGetAllBasicConversions).toHaveBeenCalled();
        expect(mockGetAllProductConversions).toHaveBeenCalled();
      });
    });

    test("Basis-Umrechnungen werden angezeigt", async () => {
      renderUnitConversionPage();

      // Werte aus der Tabelle prüfen (EnhancedTable rendert die Zellenwerte)
      await waitFor(() => {
        expect(screen.getByText("kg")).toBeInTheDocument();
        expect(screen.getByText("g")).toBeInTheDocument();
      });
    });

    test("Tabs werden angezeigt", async () => {
      renderUnitConversionPage();

      // "Basic" erscheint sowohl als Tab als auch als Card-Überschrift,
      // daher wird hier gezielt der Tab via role selektiert
      await waitFor(() => {
        expect(
          screen.getByRole("tab", {name: "Basic"})
        ).toBeInTheDocument();
        expect(
          screen.getByRole("tab", {name: "Produktspezifisch"})
        ).toBeInTheDocument();
      });
    });
  });

  describe("Bearbeitungsmodus", () => {
    test("'anpassen'-Button wird angezeigt", async () => {
      renderUnitConversionPage();

      await waitFor(() => {
        expect(
          screen.getByRole("button", {name: /anpassen/i})
        ).toBeInTheDocument();
      });
    });

    test("Speichern ohne Änderungen schliesst den Bearbeitungsmodus ohne DB-Aufruf", async () => {
      renderUnitConversionPage();

      // Warten bis Daten geladen
      await waitFor(() => expect(mockGetAllBasicConversions).toHaveBeenCalled());

      // Bearbeitungsmodus aktivieren
      await userEvent.click(screen.getByRole("button", {name: /anpassen/i}));

      // Speichern-Button ist jetzt sichtbar
      await waitFor(() => {
        expect(
          screen.getByRole("button", {name: /Speichern/i})
        ).toBeInTheDocument();
      });

      // Speichern ohne Änderungen klicken
      await userEvent.click(screen.getByRole("button", {name: /Speichern/i}));

      // Keine DB-Aufrufe erwartet, da keine Änderungen vorhanden
      expect(mockUpsertBasicConversion).not.toHaveBeenCalled();
      expect(mockUpsertProductConversion).not.toHaveBeenCalled();
      expect(mockDeleteBasicConversion).not.toHaveBeenCalled();
    });

    test("Abbrechen schliesst den Bearbeitungsmodus ohne DB-Aufruf", async () => {
      renderUnitConversionPage();

      // Warten bis Daten geladen
      await waitFor(() => expect(mockGetAllBasicConversions).toHaveBeenCalled());

      // Bearbeitungsmodus aktivieren
      await userEvent.click(screen.getByRole("button", {name: /anpassen/i}));

      // Abbrechen-Button ist jetzt sichtbar
      await waitFor(() => {
        expect(
          screen.getByRole("button", {name: /abbrechen/i})
        ).toBeInTheDocument();
      });

      // Abbrechen klicken
      await userEvent.click(screen.getByRole("button", {name: /abbrechen/i}));

      // Bearbeitungsmodus geschlossen → "Anpassen"-Button wieder sichtbar
      expect(
        screen.getByRole("button", {name: /anpassen/i})
      ).toBeInTheDocument();
      expect(mockUpsertBasicConversion).not.toHaveBeenCalled();
      expect(mockUpsertProductConversion).not.toHaveBeenCalled();
    });
  });
});
