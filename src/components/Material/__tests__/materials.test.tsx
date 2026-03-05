/**
 * Unit-Tests fuer MaterialPage.
 *
 * Testet die Materialverwaltungsseite: initiales Laden, Anzeige der
 * Materialien, Fehlerbehandlung, Sichtbarkeit der Bearbeitungsbuttons
 * und die Speicherfunktion.
 */
// Polyfill fuer jsdom (react-router benoetigt TextEncoder/TextDecoder)
import {TextEncoder, TextDecoder} from "util";
Object.assign(global, {TextEncoder, TextDecoder});

import React from "react";
import {render, screen, waitFor} from "@testing-library/react";
import "@testing-library/jest-dom";
import userEvent from "@testing-library/user-event";
import {MemoryRouter} from "react-router";

import MaterialPage from "../materials";
import {DatabaseContext} from "../../Database/DatabaseContext";

/* ===================================================================
// ======================== Mock-Setup ================================
// =================================================================== */

/** Mock: useAuthUser — gibt einen CommunityLeader-Benutzer zurueck */
const mockAuthUser = {
  uid: "user-123",
  authUid: "auth-uuid-123",
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
  {uid: "mat-1", name: "Teller", type: 2, usable: true},
  {uid: "mat-2", name: "Servietten", type: 1, usable: true},
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

      // Erste Checkbox anklicken — schaltet usable von mat-1 von true auf false
      const checkboxes = await screen.findAllByRole("checkbox");
      await userEvent.click(checkboxes[0]);

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
