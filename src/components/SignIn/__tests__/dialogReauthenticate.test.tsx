// Polyfill für jsdom (react-router benötigt TextEncoder/TextDecoder)
import {TextEncoder, TextDecoder} from "util";
Object.assign(global, {TextEncoder, TextDecoder});

import React from "react";
import {render, screen, waitFor} from "@testing-library/react";
import "@testing-library/jest-dom";
import userEvent from "@testing-library/user-event";

/* ===================================================================
// ======================== Mock-Setup ================================
// =================================================================== */

/** Mock für den AuthService (database.auth) */
const mockSignInWithPassword = jest.fn();

/** Mock-DatabaseService */
const mockDatabase = {
  auth: {
    signInWithPassword: mockSignInWithPassword,
    signUp: jest.fn(),
    signOut: jest.fn(),
    resetPassword: jest.fn(),
    updatePassword: jest.fn(),
    onAuthStateChange: jest.fn(),
    getUser: jest.fn(),
    getSession: jest.fn(),
  },
  users: {},
} as unknown as import("../../Database/DatabaseService").default;

/** Mock: User.registerSignIn (kein Seiteneffekt nötig) */
jest.mock("../../User/user.class", () => ({
  __esModule: true,
  User: {
    registerSignIn: jest.fn(),
  },
}));

/** Mock: FirebaseMessageHandler — gibt null zurück (kein Firebase-Match) */
jest.mock("../../Firebase/firebaseMessageHandler.class", () => ({
  __esModule: true,
  default: {
    translateMessage: () => null,
  },
}));

/** Mock: SupabaseMessageHandler — gibt error.message direkt zurück */
jest.mock("../../Database/supabaseMessageHandler.class", () => ({
  __esModule: true,
  default: {
    translateMessage: (error: {message: string}) => error.message,
  },
}));

/* ===================================================================
// ======================== Imports nach Mocks =========================
// =================================================================== */
import {DialogReauthenticate} from "../dialogReauthenticate";
import {User} from "../../User/user.class";
import authUserMock from "../../Firebase/Authentication/__mocks__/authuser.mock";

// Typisierte Referenz auf Mock-Funktion
const mockRegisterSignIn = User.registerSignIn as jest.Mock;

/* ===================================================================
// ======================== Render-Helper =============================
// =================================================================== */

const defaultProps = {
  database: mockDatabase,
  dialogOpen: true,
  handleOk: jest.fn(),
  handleClose: jest.fn(),
  authUser: authUserMock,
};

/**
 * Rendert den DialogReauthenticate mit Standard-Props.
 * Einzelne Props können überschrieben werden.
 */
const renderDialog = (overrides: Partial<typeof defaultProps> = {}) => {
  const props = {...defaultProps, ...overrides};
  return render(<DialogReauthenticate {...props} />);
};

/** Hilfsfunktion: Passwort-Feld via ID holen */
const getPasswordField = () => {
  const el = document.getElementById("reauth-password");
  if (!el) throw new Error("Passwort-Feld nicht gefunden");
  return el as HTMLInputElement;
};

/* ===================================================================
// ======================== Tests =====================================
// =================================================================== */

beforeEach(() => {
  jest.clearAllMocks();
});

describe("DialogReauthenticate", () => {
  describe("Initialer Zustand", () => {
    test("Dialog wird gerendert wenn dialogOpen=true", () => {
      renderDialog();

      expect(
        screen.getByText(/Ausweis bitte/i)
      ).toBeInTheDocument();
    });

    test("Dialog wird nicht gerendert wenn dialogOpen=false", () => {
      renderDialog({dialogOpen: false});

      expect(
        screen.queryByText(/Ausweis bitte/i)
      ).not.toBeInTheDocument();
    });

    test("Info-Meldung wird angezeigt", () => {
      renderDialog();

      expect(
        screen.getByText(/authentifiziere dich erneut/i)
      ).toBeInTheDocument();
    });

    test("E-Mail-Feld ist mit authUser.email vorausgefüllt", () => {
      renderDialog();

      const emailField = screen.getByLabelText(/e-mail/i);
      expect(emailField).toHaveValue(authUserMock.email);
    });

    test("E-Mail-Feld ist deaktiviert wenn authUser vorhanden", () => {
      renderDialog();

      const emailField = screen.getByLabelText(/e-mail/i);
      expect(emailField).toBeDisabled();
    });

    test("Passwort-Feld ist leer", () => {
      renderDialog();

      const passwordField = getPasswordField();
      expect(passwordField).toHaveValue("");
    });

    test("Kein Fehler beim Laden angezeigt", () => {
      renderDialog();

      // Es gibt ein info-Alert, aber kein error-Alert
      const alerts = screen.getAllByRole("alert");
      alerts.forEach((alert) => {
        expect(alert).not.toHaveClass("MuiAlert-standardError");
      });
    });
  });

  describe("Passwort-Eingabe", () => {
    test("Passwort-Feld kann befüllt werden", async () => {
      renderDialog();

      const passwordField = getPasswordField();
      await userEvent.type(passwordField, "geheim123");

      expect(passwordField).toHaveValue("geheim123");
    });

    test("Passwort-Sichtbarkeit kann umgeschaltet werden", async () => {
      renderDialog();

      const passwordField = getPasswordField();
      expect(passwordField).toHaveAttribute("type", "password");

      const toggleButton = screen.getByLabelText(/ein-\/ausblenden/i);
      await userEvent.click(toggleButton);

      expect(passwordField).toHaveAttribute("type", "text");
    });
  });

  describe("Erfolgreiche Reauthentifizierung", () => {
    test("signInWithPassword wird mit E-Mail und Passwort aufgerufen", async () => {
      mockSignInWithPassword.mockResolvedValueOnce({user: {id: "uuid"}});
      renderDialog();

      await userEvent.type(getPasswordField(), "geheim123");
      await userEvent.click(screen.getByRole("button", {name: /anmelden/i}));

      await waitFor(() => {
        expect(mockSignInWithPassword).toHaveBeenCalledWith(
          authUserMock.email,
          "geheim123"
        );
      });
    });

    test("handleOk wird nach erfolgreicher Anmeldung aufgerufen", async () => {
      mockSignInWithPassword.mockResolvedValueOnce({user: {id: "uuid"}});
      const handleOk = jest.fn();
      renderDialog({handleOk});

      await userEvent.type(getPasswordField(), "geheim123");
      await userEvent.click(screen.getByRole("button", {name: /anmelden/i}));

      await waitFor(() => {
        expect(handleOk).toHaveBeenCalledTimes(1);
      });
    });

    test("registerSignIn wird nach erfolgreicher Anmeldung aufgerufen", async () => {
      mockSignInWithPassword.mockResolvedValueOnce({user: {id: "uuid"}});
      renderDialog();

      await userEvent.type(getPasswordField(), "geheim123");
      await userEvent.click(screen.getByRole("button", {name: /anmelden/i}));

      await waitFor(() => {
        expect(mockRegisterSignIn).toHaveBeenCalledWith({
          database: mockDatabase,
          authUser: authUserMock,
        });
      });
    });
  });

  describe("Fehlgeschlagene Reauthentifizierung", () => {
    test("Fehlermeldung wird bei falschen Anmeldedaten angezeigt", async () => {
      mockSignInWithPassword.mockRejectedValueOnce(
        new Error("Invalid login credentials")
      );
      renderDialog();

      await userEvent.type(getPasswordField(), "falsch");
      await userEvent.click(screen.getByRole("button", {name: /anmelden/i}));

      await waitFor(() => {
        expect(
          screen.getByText(/Invalid login credentials/i)
        ).toBeInTheDocument();
      });
    });

    test("handleOk wird bei Fehler nicht aufgerufen", async () => {
      mockSignInWithPassword.mockRejectedValueOnce(
        new Error("Invalid login credentials")
      );
      const handleOk = jest.fn();
      renderDialog({handleOk});

      await userEvent.type(getPasswordField(), "falsch");
      await userEvent.click(screen.getByRole("button", {name: /anmelden/i}));

      await waitFor(() => {
        expect(screen.getByText(/Invalid login credentials/i)).toBeInTheDocument();
      });
      expect(handleOk).not.toHaveBeenCalled();
    });

    test("Info-Meldung verschwindet wenn Fehler angezeigt wird", async () => {
      mockSignInWithPassword.mockRejectedValueOnce(
        new Error("Invalid login credentials")
      );
      renderDialog();

      // Initial: Info-Meldung sichtbar
      expect(
        screen.getByText(/authentifiziere dich erneut/i)
      ).toBeInTheDocument();

      await userEvent.type(getPasswordField(), "falsch");
      await userEvent.click(screen.getByRole("button", {name: /anmelden/i}));

      await waitFor(() => {
        expect(
          screen.queryByText(/authentifiziere dich erneut/i)
        ).not.toBeInTheDocument();
      });
    });
  });

  describe("Dialog schliessen", () => {
    test("Abbrechen-Button ruft handleClose auf", async () => {
      const handleClose = jest.fn();
      renderDialog({handleClose});

      await userEvent.click(
        screen.getByRole("button", {name: /abbrechen/i})
      );

      expect(handleClose).toHaveBeenCalledTimes(1);
    });
  });
});
