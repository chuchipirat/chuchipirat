/**
 * Unit-Tests fuer DialogDepartment.
 *
 * Testet den Dialog zum Erstellen einer neuen Abteilung:
 * Rendering, Validierung (Pflichtfeld und Duplikat),
 * erfolgreiche Erstellung, Fehlerbehandlung und Formular-Reset.
 */
// Polyfill fuer jsdom (react-router benoetigt TextEncoder/TextDecoder)
import {TextEncoder, TextDecoder} from "util";
Object.assign(global, {TextEncoder, TextDecoder});

import React from "react";
import {render, screen, waitFor} from "@testing-library/react";
import "@testing-library/jest-dom";
import userEvent from "@testing-library/user-event";

import {DialogDepartment} from "../dialogDepartment";
import {DatabaseContext} from "../../Database/DatabaseContext";
import AuthUser from "../../Firebase/Authentication/authUser.class";

/* ===================================================================
// ======================== Mock-Setup ================================
// =================================================================== */

/** Mock: AuthUser fuer Tests */
const mockAuthUser = {
  uid: "auth-uuid-123",
  email: "leader@chuchipirat.ch",
  roles: ["communityLeader"],
} as AuthUser;

/** Mock: createDepartment-Methode der Datenbank */
const mockCreateDepartment = jest.fn();

/** Mock-DatabaseService (nur departments wird benoetigt) */
const mockDatabase = {
  departments: {
    createDepartment: mockCreateDepartment,
  },
} as any;

/* ===================================================================
// ======================== Standard-Props ============================
// =================================================================== */

const defaultProps = {
  authUser: mockAuthUser,
  dialogOpen: true,
  existingNames: ["Gemuese", "Fruechte"],
  handleCreate: jest.fn(),
  handleClose: jest.fn(),
  handleError: jest.fn(),
  nextHigherPos: 3,
};

/* ===================================================================
// ======================== Render-Helper =============================
// =================================================================== */

/**
 * Rendert den DialogDepartment mit DatabaseContext-Provider.
 *
 * @param overrides - Optionale Prop-Ueberschreibungen
 */
const renderDialog = (overrides: Partial<typeof defaultProps> = {}) => {
  const props = {
    ...defaultProps,
    handleCreate: jest.fn(),
    handleClose: jest.fn(),
    handleError: jest.fn(),
    ...overrides,
  };

  render(
    <DatabaseContext.Provider value={mockDatabase}>
      <DialogDepartment {...props} />
    </DatabaseContext.Provider>
  );

  return props;
};

/* ===================================================================
// ======================== Tests =====================================
// =================================================================== */

beforeEach(() => {
  jest.clearAllMocks();
  mockCreateDepartment.mockResolvedValue({
    id: "new-uid",
    value: {name: "Backwaren", pos: 3, usable: true},
  });
});

describe("DialogDepartment", () => {
  describe("Rendering", () => {
    test("Dialog wird geoeffnet mit Titel und Eingabefeld", () => {
      renderDialog();

      expect(screen.getByText("Abteilung anlegen")).toBeInTheDocument();
      expect(screen.getByRole("textbox")).toBeInTheDocument();
    });

    test("Dialog wird nicht gerendert wenn geschlossen", () => {
      renderDialog({dialogOpen: false});

      expect(screen.queryByText("Abteilung anlegen")).not.toBeInTheDocument();
    });
  });

  describe("Validierung", () => {
    test("Leerer Name zeigt Fehlermeldung", async () => {
      renderDialog();

      await userEvent.click(
        screen.getByRole("button", {name: /erstellen/i})
      );

      expect(
        screen.getByText("Bitte Abteilungsname angeben.")
      ).toBeInTheDocument();
    });

    test("Doppelter Name wird abgelehnt", async () => {
      renderDialog();

      await userEvent.type(screen.getByRole("textbox"), "Gemuese");
      await userEvent.click(
        screen.getByRole("button", {name: /erstellen/i})
      );

      expect(
        screen.getByText(
          "Eine Abteilung mit diesem Namen existiert bereits."
        )
      ).toBeInTheDocument();
    });

    test("Validierungsfehler wird beim erneuten Oeffnen zurueckgesetzt", async () => {
      const {unmount} = render(
        <DatabaseContext.Provider value={mockDatabase}>
          <DialogDepartment {...defaultProps} dialogOpen={true} />
        </DatabaseContext.Provider>
      );

      // Leeren Namen abschicken → Fehler anzeigen
      await userEvent.click(
        screen.getByRole("button", {name: /erstellen/i})
      );
      expect(
        screen.getByText("Bitte Abteilungsname angeben.")
      ).toBeInTheDocument();

      unmount();

      // Dialog erneut oeffnen — Validierungsfehler sollte zurueckgesetzt sein
      render(
        <DatabaseContext.Provider value={mockDatabase}>
          <DialogDepartment {...defaultProps} dialogOpen={true} />
        </DatabaseContext.Provider>
      );

      expect(
        screen.queryByText("Bitte Abteilungsname angeben.")
      ).not.toBeInTheDocument();
    });
  });

  describe("Erstellen", () => {
    test("Erfolgreiche Erstellung ruft handleCreate mit korrektem Objekt auf", async () => {
      const props = renderDialog();

      await userEvent.type(screen.getByRole("textbox"), "Backwaren");
      await userEvent.click(
        screen.getByRole("button", {name: /erstellen/i})
      );

      await waitFor(() => {
        expect(mockCreateDepartment).toHaveBeenCalledWith(
          "Backwaren",
          3,
          mockAuthUser
        );
      });

      await waitFor(() => {
        expect(props.handleCreate).toHaveBeenCalledWith({
          uid: "new-uid",
          name: "Backwaren",
          pos: 3,
          usable: true,
        });
      });
    });

    test("Fehler bei Erstellung ruft handleError auf", async () => {
      const dbError = new Error("DB-Fehler");
      mockCreateDepartment.mockRejectedValueOnce(dbError);

      const props = renderDialog();

      await userEvent.type(screen.getByRole("textbox"), "Backwaren");
      await userEvent.click(
        screen.getByRole("button", {name: /erstellen/i})
      );

      await waitFor(() => {
        expect(props.handleError).toHaveBeenCalledWith(dbError);
      });
    });
  });

  describe("Abbrechen", () => {
    test("Abbrechen ruft handleClose auf", async () => {
      const props = renderDialog();

      await userEvent.click(
        screen.getByRole("button", {name: /abbrechen/i})
      );

      expect(props.handleClose).toHaveBeenCalledTimes(1);
    });
  });

  describe("Formular-Reset", () => {
    test("Eingabefeld ist beim erneuten Oeffnen leer", async () => {
      const {unmount} = render(
        <DatabaseContext.Provider value={mockDatabase}>
          <DialogDepartment {...defaultProps} dialogOpen={true} />
        </DatabaseContext.Provider>
      );

      // Text eingeben
      await userEvent.type(screen.getByRole("textbox"), "Backwaren");
      expect(screen.getByDisplayValue("Backwaren")).toBeInTheDocument();

      unmount();

      // Dialog erneut oeffnen — Feld sollte leer sein
      render(
        <DatabaseContext.Provider value={mockDatabase}>
          <DialogDepartment {...defaultProps} dialogOpen={true} />
        </DatabaseContext.Provider>
      );

      expect(screen.getByRole("textbox")).toHaveValue("");
    });
  });
});
