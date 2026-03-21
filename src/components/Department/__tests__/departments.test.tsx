/**
 * Unit-Tests fuer DepartmentsPage.
 *
 * Testet die Uebersichtsseite fuer Abteilungen: initiales Laden,
 * Anzeige in der Tabelle, Bearbeitungsmodus mit Speichern,
 * Positionsnormalisierung und Fehlerbehandlung.
 */
// Polyfill fuer jsdom (react-router benoetigt TextEncoder/TextDecoder)
import {TextEncoder, TextDecoder} from "util";
Object.assign(global, {TextEncoder, TextDecoder});

import React from "react";
import {render, screen, waitFor} from "@testing-library/react";
import "@testing-library/jest-dom";
import userEvent from "@testing-library/user-event";
import {MemoryRouter} from "react-router";

import DepartmentsPage from "../departments";
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

/** Mock: useCustomDialog — simuliert den Bestaetigungsdialog */
const mockCustomDialog = jest.fn();
jest.mock("../../Shared/customDialogContext", () => ({
  ...jest.requireActual("../../Shared/customDialogContext"),
  useCustomDialog: () => ({customDialog: mockCustomDialog}),
}));

/** Mock: ImageRepository */
jest.mock("../../../constants/imageRepository", () => ({
  ImageRepository: {
    getEnvironmentRelatedPicture: () => ({SIGN_IN_HEADER: "test-image.png"}),
  },
}));

/** Mock-Abteilungen mit nicht-zusammenhaengenden Positionen */
const mockDepartments = [
  {uid: "dept-1", name: "Gemuese", pos: 5, usable: true},
  {uid: "dept-2", name: "Fruechte", pos: 10, usable: true},
];

/** Mock: DepartmentRepository-Methoden */
const mockGetAllDepartments = jest.fn();
const mockSaveAllDepartments = jest.fn();

/** Mock-DatabaseService (nur departments wird benoetigt) */
const mockDatabase = {
  departments: {
    getAllDepartments: mockGetAllDepartments,
    saveAllDepartments: mockSaveAllDepartments,
  },
} as any;

/* ===================================================================
// ======================== Render-Helper =============================
// =================================================================== */

/**
 * Rendert die DepartmentsPage mit allen noetigen Providern.
 */
const renderDepartmentsPage = () => {
  return render(
    <MemoryRouter initialEntries={["/departments"]}>
      <DatabaseContext.Provider value={mockDatabase}>
        <DepartmentsPage />
      </DatabaseContext.Provider>
    </MemoryRouter>
  );
};

/* ===================================================================
// ======================== Tests =====================================
// =================================================================== */

beforeEach(() => {
  jest.clearAllMocks();
  mockGetAllDepartments.mockResolvedValue(mockDepartments);
  mockSaveAllDepartments.mockResolvedValue(undefined);
});

describe("DepartmentsPage", () => {
  describe("Initialer Zustand", () => {
    test("Seitentitel wird angezeigt", async () => {
      renderDepartmentsPage();

      await waitFor(() => {
        expect(screen.getByText("Abteilungen")).toBeInTheDocument();
      });
    });

    test("Untertitel wird angezeigt", async () => {
      renderDepartmentsPage();

      await waitFor(() => {
        expect(
          screen.getByText(
            "Damit du im Laden nicht kreuz und quer umherirrst."
          )
        ).toBeInTheDocument();
      });
    });
  });

  describe("Daten laden", () => {
    test("getAllDepartments() wird beim Laden aufgerufen", async () => {
      renderDepartmentsPage();

      await waitFor(() => {
        expect(mockGetAllDepartments).toHaveBeenCalled();
      });
    });

    test("Abteilungen werden in der Tabelle angezeigt", async () => {
      renderDepartmentsPage();

      await waitFor(() => {
        expect(screen.getByText("Gemuese")).toBeInTheDocument();
        expect(screen.getByText("Fruechte")).toBeInTheDocument();
      });
    });

    test("Fehler beim Laden wird als Alert angezeigt", async () => {
      mockGetAllDepartments.mockRejectedValue(new Error("DB Fehler"));
      renderDepartmentsPage();

      await waitFor(() => {
        expect(screen.getByRole("alert")).toBeInTheDocument();
      });
    });

    test("Nicht-zusammenhaengende Positionen werden auf 1..N normalisiert", async () => {
      renderDepartmentsPage();

      // Warten bis Daten geladen sind
      await waitFor(() => {
        expect(mockGetAllDepartments).toHaveBeenCalled();
      });

      // Bearbeitungsmodus aktivieren, damit die Position-Dropdowns sichtbar werden
      await userEvent.click(
        screen.getByRole("button", {name: /anpassen/i})
      );

      // Speichern klicken — gespeicherte Daten müssen normalisierte Positionen haben
      await userEvent.click(
        screen.getByRole("button", {name: /Speichern/i})
      );

      await waitFor(() => {
        expect(mockSaveAllDepartments).toHaveBeenCalledWith(
          expect.arrayContaining([
            expect.objectContaining({uid: "dept-1", pos: 1}),
            expect.objectContaining({uid: "dept-2", pos: 2}),
          ]),
          mockAuthUser
        );
      });
    });
  });

  describe("Bearbeitungsmodus", () => {
    test("'anpassen'-Button wird angezeigt", async () => {
      renderDepartmentsPage();

      await waitFor(() => {
        expect(
          screen.getByRole("button", {name: /anpassen/i})
        ).toBeInTheDocument();
      });
    });

    test("Speichern ruft saveAllDepartments auf", async () => {
      renderDepartmentsPage();

      // Warten bis Daten geladen sind
      await waitFor(() => {
        expect(mockGetAllDepartments).toHaveBeenCalled();
      });

      // Bearbeitungsmodus aktivieren
      await userEvent.click(
        screen.getByRole("button", {name: /anpassen/i})
      );

      // Speichern klicken
      await userEvent.click(
        screen.getByRole("button", {name: /Speichern/i})
      );

      await waitFor(() => {
        expect(mockSaveAllDepartments).toHaveBeenCalledWith(
          expect.arrayContaining([
            expect.objectContaining({uid: "dept-1", name: "Gemuese"}),
            expect.objectContaining({uid: "dept-2", name: "Fruechte"}),
          ]),
          mockAuthUser
        );
      });
    });

    test("Fehler beim Speichern zeigt AlertMessage an", async () => {
      mockSaveAllDepartments.mockRejectedValue(new Error("Save Fehler"));
      renderDepartmentsPage();

      await waitFor(() => {
        expect(mockGetAllDepartments).toHaveBeenCalled();
      });

      // Bearbeitungsmodus aktivieren
      await userEvent.click(
        screen.getByRole("button", {name: /anpassen/i})
      );

      // Speichern klicken
      await userEvent.click(
        screen.getByRole("button", {name: /Speichern/i})
      );

      await waitFor(() => {
        expect(screen.getByRole("alert")).toBeInTheDocument();
      });
    });
  });

  describe("Leerer Zustand", () => {
    test("Leere Liste wird ohne Fehler angezeigt", async () => {
      mockGetAllDepartments.mockResolvedValue([]);
      renderDepartmentsPage();

      await waitFor(() => {
        expect(mockGetAllDepartments).toHaveBeenCalled();
      });

      // Kein Fehler-Alert
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });
  });
});
