// Polyfill für jsdom (react-router benötigt TextEncoder/TextDecoder)
import {TextEncoder, TextDecoder} from "util";
Object.assign(global, {TextEncoder, TextDecoder});

import React from "react";
import {render, screen, waitFor} from "@testing-library/react";
import "@testing-library/jest-dom";
import userEvent from "@testing-library/user-event";
import {MemoryRouter} from "react-router";

import {DatabaseContext} from "../../Database/DatabaseContext";

/** Mock: Utils — Standardwerte für Testumgebung */
jest.mock("../../Shared/utils.class", () => ({
  Utils: {
    isTestEnvironment: jest.fn(() => false),
    isDevEnvironment: jest.fn(() => true),
    isProductionEnvironment: jest.fn(() => false),
    getEnvironment: jest.fn(() => "DEV"),
    isUrl: jest.fn(() => false),
    getDomain: jest.fn(() => ""),
    sortArray: jest.fn(({array}: {array: unknown[]}) => array),
    generateUid: jest.fn(() => "mock-uid"),
  },
}));

/**
 * Callback-Referenz für onAuthStateChange.
 * Wird in den Tests manuell aufgerufen, um Session-Events zu simulieren.
 */
let authChangeCallback: Function;

/** Mock für onAuthStateChange — speichert den Callback und gibt eine Unsubscribe-Funktion zurück */
const mockUnsubscribe = jest.fn();
const mockOnAuthStateChange = jest.fn((cb: Function) => {
  authChangeCallback = cb;
  return mockUnsubscribe;
});

/** Mock für updatePassword */
const mockUpdatePassword = jest.fn();

/** Mock-DatabaseService mit Auth-Methoden */
const mockDatabase = {
  auth: {
    signInWithPassword: jest.fn(),
    signUp: jest.fn(),
    signOut: jest.fn(),
    resetPassword: jest.fn(),
    updatePassword: mockUpdatePassword,
    onAuthStateChange: mockOnAuthStateChange,
    getUser: jest.fn(),
    getSession: jest.fn(),
  },
  users: {},
} as any;

/** Mock: useCustomStyles — gibt ein leeres Styles-Objekt zurueck. */
jest.mock("../../../constants/styles", () => ({
  useCustomStyles: jest.fn(() => ({})),
}));

/** Mock: SupabaseMessageHandler — gibt error.message direkt zurück */
jest.mock("../../Database/supabaseMessageHandler.class", () => ({
  __esModule: true,
  default: {
    translateMessage: (error: {message: string}) => error.message,
  },
}));

/** Mock: PasswordStrengthMeter — vereinfacht als einfaches div */
jest.mock("../../Shared/passwordStrengthMeter", () => ({
  PasswordStrengthMeter: ({password}: {password: string}) => (
    <div data-testid="password-strength">
      {password.length >= 6 ? "Stark" : "Schwach"}
    </div>
  ),
}));

/** Mock: @sentry/react — captureException wird als noop-Spy erfasst. */
jest.mock("@sentry/react", () => ({
  captureException: jest.fn(),
}));

import {ResetPasswordPage} from "../resetPassword";

/**
 * Rendert die ResetPasswordPage mit allen nötigen Context-Providern.
 */
const renderResetPasswordPage = () => {
  return render(
    <MemoryRouter initialEntries={["/reset-password"]}>
      <DatabaseContext.Provider value={mockDatabase}>
        <ResetPasswordPage />
      </DatabaseContext.Provider>
    </MemoryRouter>
  );
};

/**
 * Hilfsfunktion: Simuliert eine Session-Etablierung über onAuthStateChange.
 * Versetzt die Komponente in den "ready"-Zustand.
 */
const triggerSessionEstablished = () => {
  React.act(() => {
    authChangeCallback("SIGNED_IN", {user: {id: "test-user-id"}});
  });
};

/** Hilfsfunktion: Passwort-Feld via ID holen */
const getPasswordField = () => {
  const el = document.getElementById("password");
  if (!el) throw new Error("Passwort-Feld nicht gefunden");
  return el as HTMLInputElement;
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe("ResetPasswordPage", () => {
  describe("Initialer Zustand", () => {
    test("Zeigt Ladezustand 'Einen Moment...' initial", () => {
      renderResetPasswordPage();

      expect(screen.getByText(/Einen Moment/i)).toBeInTheDocument();
    });
  });

  describe("Session-Etablierung", () => {
    test("Zeigt Passwort-Formular nach Session-Etablierung", () => {
      renderResetPasswordPage();
      triggerSessionEstablished();

      expect(getPasswordField()).toBeInTheDocument();
      expect(
        screen.getByRole("button", {name: /Passwort ändern/i})
      ).toBeInTheDocument();
    });
  });

  describe("Button-Zustand", () => {
    test("Passwort-Button ist deaktiviert bei leerem Passwort", () => {
      renderResetPasswordPage();
      triggerSessionEstablished();

      const button = screen.getByRole("button", {name: /Passwort ändern/i});
      expect(button).toBeDisabled();
    });

    test("Passwort-Button ist deaktiviert bei zu kurzem Passwort", async () => {
      renderResetPasswordPage();
      triggerSessionEstablished();

      await userEvent.type(getPasswordField(), "12345");

      const button = screen.getByRole("button", {name: /Passwort ändern/i});
      expect(button).toBeDisabled();
    });

    test("Passwort-Button ist aktiviert bei ausreichend langem Passwort", async () => {
      renderResetPasswordPage();
      triggerSessionEstablished();

      await userEvent.type(getPasswordField(), "sicher123");

      const button = screen.getByRole("button", {name: /Passwort ändern/i});
      expect(button).toBeEnabled();
    });
  });

  describe("Passwort-Sichtbarkeit", () => {
    test("Passwort-Sichtbarkeit togglen", async () => {
      renderResetPasswordPage();
      triggerSessionEstablished();

      const passwordField = getPasswordField();
      // Initial: Passwort ist versteckt
      expect(passwordField).toHaveAttribute("type", "password");

      // Sichtbarkeits-Toggle klicken
      const toggleButton = screen.getByLabelText(/ein-\/ausblenden/i);
      await userEvent.click(toggleButton);

      // Passwort ist jetzt sichtbar
      expect(passwordField).toHaveAttribute("type", "text");

      // Nochmal klicken: Passwort wird wieder versteckt
      await userEvent.click(toggleButton);
      expect(passwordField).toHaveAttribute("type", "password");
    });
  });

  describe("Erfolgreiche Passwortänderung", () => {
    test("Erfolgsmeldung nach Passwortänderung", async () => {
      mockUpdatePassword.mockResolvedValueOnce(undefined);
      renderResetPasswordPage();
      triggerSessionEstablished();

      await userEvent.type(getPasswordField(), "neuesSicheresPasswort");
      await userEvent.click(
        screen.getByRole("button", {name: /Passwort ändern/i})
      );

      await waitFor(() => {
        expect(screen.getByText(/Passwort geändert/i)).toBeInTheDocument();
      });

      // Erfolgstexte prüfen
      expect(
        screen.getByText(/erfolgreich geändert/i)
      ).toBeInTheDocument();
    });
  });

  describe("Fehlerbehandlung", () => {
    test("Fehlermeldung wird inline angezeigt", async () => {
      mockUpdatePassword.mockRejectedValueOnce(
        new Error("New password should be different from the old password.")
      );
      renderResetPasswordPage();
      triggerSessionEstablished();

      await userEvent.type(getPasswordField(), "altesPasswort");
      await userEvent.click(
        screen.getByRole("button", {name: /Passwort ändern/i})
      );

      await waitFor(() => {
        expect(
          screen.getByText(
            /New password should be different from the old password/i
          )
        ).toBeInTheDocument();
      });

      // Uups-Titel ist sichtbar
      expect(screen.getByText(/Uups/i)).toBeInTheDocument();
    });

    test("Formular bleibt nach Fehler sichtbar", async () => {
      mockUpdatePassword.mockRejectedValueOnce(new Error("Network error"));
      renderResetPasswordPage();
      triggerSessionEstablished();

      await userEvent.type(getPasswordField(), "neuesPasswort");
      await userEvent.click(
        screen.getByRole("button", {name: /Passwort ändern/i})
      );

      // Auf den Fehler warten
      await waitFor(() => {
        expect(screen.getByText(/Network error/i)).toBeInTheDocument();
      });

      // Formular ist weiterhin sichtbar
      expect(getPasswordField()).toBeInTheDocument();
      expect(
        screen.getByRole("button", {name: /Passwort ändern/i})
      ).toBeInTheDocument();
    });
  });
});
