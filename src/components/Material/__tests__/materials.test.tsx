/**
 * Unit-Tests fuer MaterialPage.
 *
 * Testet die Materialverwaltungsseite: initiales Laden, Anzeige der
 * Materialien, Fehlerbehandlung, Sichtbarkeit der Bearbeitungsbuttons
 * und die Speicherfunktion.
 */
// Polyfill fuer jsdom (react-router benoetigt TextEncoder/TextDecoder)
import {TextEncoder, TextDecoder} from "util";
Object.assign(globalThis, {TextEncoder, TextDecoder});

import React from "react";
import {render, screen, waitFor, within} from "@testing-library/react";
import "@testing-library/jest-dom";
import userEvent from "@testing-library/user-event";
import {MemoryRouter} from "react-router";

import {MaterialPage} from "../materials";
import {DatabaseContext} from "../../Database/DatabaseContext";

/* ===================================================================
// ======================== Mock-Setup ================================
// =================================================================== */

/** Mock: useAuthUser — gibt einen CommunityLeader-Benutzer zurueck */
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

/** Mock: MaterialRepository-Methoden */
const mockGetAllMaterials = jest.fn();
const mockUpdateMaterial = jest.fn();

/** Mock-DatabaseService */
const mockDatabase = {
  materials: {
    getAllMaterials: mockGetAllMaterials,
    updateMaterial: mockUpdateMaterial,
  },
} as any;

/** Testdaten: Materialien */
const mockMaterials = [
  {uid: "mat-1", name: "Teller", type: 2, usable: true, qaChecked: false, qaCheckedAt: null},
  {uid: "mat-2", name: "Servietten", type: 1, usable: true, qaChecked: false, qaCheckedAt: null},
];

/* ===================================================================
// ======================== Render-Helper =============================
// =================================================================== */

/**
 * Rendert die MaterialPage mit allen noetigen Providern.
 */
const renderMaterialPage = () => {
  return render(
    <MemoryRouter initialEntries={["/materials"]}>
      <DatabaseContext.Provider value={mockDatabase}>
        <MaterialPage />
      </DatabaseContext.Provider>
    </MemoryRouter>
  );
};

/* ===================================================================
// ======================== Tests =====================================
// =================================================================== */

beforeEach(() => {
  jest.clearAllMocks();
  mockGetAllMaterials.mockResolvedValue(mockMaterials);
  mockUpdateMaterial.mockResolvedValue(undefined);
});

describe("MaterialPage", () => {
  describe("Initialer Zustand", () => {
    test("Seitentitel wird angezeigt", async () => {
      renderMaterialPage();

      await waitFor(() => {
        expect(screen.getByText("Materialien")).toBeInTheDocument();
      });
    });

    test("getAllMaterials() wird beim Laden aufgerufen", async () => {
      renderMaterialPage();

      await waitFor(() => {
        expect(mockGetAllMaterials).toHaveBeenCalledWith(false);
      });
    });

    test("Materialien werden angezeigt", async () => {
      renderMaterialPage();

      await waitFor(() => {
        expect(screen.getByText("Teller")).toBeInTheDocument();
        expect(screen.getByText("Servietten")).toBeInTheDocument();
      });
    });
  });

  describe("Fehlerbehandlung beim Laden", () => {
    test("Fehler beim Laden wird als Alert angezeigt", async () => {
      mockGetAllMaterials.mockRejectedValue(new Error("DB Fehler"));
      renderMaterialPage();

      await waitFor(() => {
        expect(screen.getByRole("alert")).toBeInTheDocument();
      });
    });
  });

  describe("Buttons und Bearbeitungsmodus", () => {
    test("'Bearbeiten'-Button wird angezeigt", async () => {
      renderMaterialPage();

      await waitFor(() => {
        expect(
          screen.getByRole("button", {name: /Bearbeiten/i})
        ).toBeInTheDocument();
      });
    });

    test("Speichern ohne Änderungen schreibt nichts in die DB", async () => {
      renderMaterialPage();

      await waitFor(() => expect(mockGetAllMaterials).toHaveBeenCalled());

      // Bearbeitungsmodus aktivieren, dann direkt speichern ohne Änderung
      await userEvent.click(screen.getByRole("button", {name: /Bearbeiten/i}));
      await waitFor(() =>
        expect(screen.getByRole("button", {name: /Speichern/i})).toBeInTheDocument()
      );
      await userEvent.click(screen.getByRole("button", {name: /Speichern/i}));

      // Da kein Material geändert wurde, darf updateMaterial nicht aufgerufen werden
      expect(mockUpdateMaterial).not.toHaveBeenCalled();
    });

    test("Speichern ruft updateMaterial nur für geänderte Materialien auf", async () => {
      renderMaterialPage();

      await waitFor(() => expect(mockGetAllMaterials).toHaveBeenCalled());

      // Bearbeitungsmodus aktivieren
      await userEvent.click(screen.getByRole("button", {name: /Bearbeiten/i}));

      // Zeile mit "Teller" finden und darin die «Nutzbar»-Checkbox anklicken.
      // Im Edit-Modus enthält jede DataGrid-Zeile: 1 Selection-Checkbox (unchecked),
      // 1 Usable-Checkbox (checked) und 1 QA-Checkbox (unchecked).
      // Wir suchen die einzige bereits aktivierte Checkbox in der Zeile.
      const tellerRow = screen.getByRole("row", {name: /Teller/i});
      const checkboxesInRow = within(tellerRow).getAllByRole("checkbox");
      const usableCheckbox = checkboxesInRow.find(
        (checkbox) => (checkbox as HTMLInputElement).checked
      );
      expect(usableCheckbox).toBeDefined();
      await userEvent.click(usableCheckbox!);

      // Speichern
      await userEvent.click(screen.getByRole("button", {name: /Speichern/i}));

      // Nur mat-1 wurde geändert → genau ein updateMaterial-Aufruf
      await waitFor(() => {
        expect(mockUpdateMaterial).toHaveBeenCalledTimes(1);
        expect(mockUpdateMaterial).toHaveBeenCalledWith(
          expect.objectContaining({uid: "mat-1", usable: false}),
          mockAuthUser
        );
      });
    });
  });
});
