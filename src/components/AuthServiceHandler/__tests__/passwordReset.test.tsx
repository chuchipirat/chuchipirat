// Polyfill für jsdom (react-router benötigt TextEncoder/TextDecoder)
import {TextEncoder, TextDecoder} from "util";
Object.assign(global, {TextEncoder, TextDecoder});

import React from "react";
import {render, screen, waitFor} from "@testing-library/react";
import "@testing-library/jest-dom";
import userEvent from "@testing-library/user-event";
import {MemoryRouter, useLocation} from "react-router";

import {PasswordResetPage, ForgotPasswordLink} from "../passwordReset";
import {DatabaseContext} from "../../Database/DatabaseContext";
import {PASSWORD_RESET as ROUTES_PASSWORD_RESET} from "../../../constants/routes";

/** Mock: @sentry/react — captureException wird als noop-Spy erfasst. */
jest.mock("@sentry/react", () => ({
  captureException: jest.fn(),
}));

/** Mock für den AuthService (database.auth) */
const mockResetPassword = jest.fn();

/** Mock-DatabaseService mit Auth-Methoden */
const mockDatabase = {
  auth: {
    resetPassword: mockResetPassword,
    signInWithPassword: jest.fn(),
    signUp: jest.fn(),
    signOut: jest.fn(),
    updatePassword: jest.fn(),
    onAuthStateChange: jest.fn(),
    getUser: jest.fn(),
    getSession: jest.fn(),
  },
  users: {},
} as any;

/** Location-Helfer für Navigations-Assertions */
let testLocation: ReturnType<typeof useLocation>;
const LocationDisplay = () => {
  testLocation = useLocation();
  return null;
};

/**
 * Rendert die PasswordResetPage mit allen nötigen Context-Providern.
 */
const renderPasswordResetPage = () => {
  return render(
    <MemoryRouter initialEntries={["/pw-reset"]}>
      <DatabaseContext.Provider value={mockDatabase}>
        <PasswordResetPage />
        <LocationDisplay />
      </DatabaseContext.Provider>
    </MemoryRouter>
  );
};

/**
 * Rendert die ForgotPasswordLink-Komponente mit Router.
 */
const renderForgotPasswordLink = () => {
  return render(
    <MemoryRouter initialEntries={["/signin"]}>
      <ForgotPasswordLink />
      <LocationDisplay />
    </MemoryRouter>
  );
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe("PasswordResetPage", () => {
  describe("Initialer Zustand", () => {
    test("E-Mail-Feld wird angezeigt und ist leer", () => {
      renderPasswordResetPage();

      const emailField = screen.getByLabelText(/e-mail/i);
      expect(emailField).toBeInTheDocument();
      expect(emailField).toHaveValue("");
    });

    test("Reset-Button ist initial deaktiviert", () => {
      renderPasswordResetPage();

      const button = screen.getByRole("button", {name: /zurücksetzen/i});
      expect(button).toBeDisabled();
    });

    test("Keine Erfolgsmeldung beim Laden angezeigt", () => {
      renderPasswordResetPage();

      expect(
        screen.queryByText(/magischen Link/i)
      ).not.toBeInTheDocument();
    });

    test("Kein Fehler beim Laden angezeigt", () => {
      renderPasswordResetPage();

      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });
  });

  describe("E-Mail-Eingabe", () => {
    test("E-Mail-Feld kann befüllt werden", async () => {
      renderPasswordResetPage();

      const emailField = screen.getByLabelText(/e-mail/i);
      await userEvent.type(emailField, "test@example.com");

      expect(emailField).toHaveValue("test@example.com");
    });

    test("Reset-Button wird aktiviert bei gültiger E-Mail", async () => {
      renderPasswordResetPage();

      const emailField = screen.getByLabelText(/e-mail/i);
      await userEvent.type(emailField, "test@example.com");

      const button = screen.getByRole("button", {name: /zurücksetzen/i});
      expect(button).toBeEnabled();
    });

    test("Reset-Button bleibt deaktiviert bei ungültiger E-Mail", async () => {
      renderPasswordResetPage();

      const emailField = screen.getByLabelText(/e-mail/i);
      await userEvent.type(emailField, "keine-email");

      const button = screen.getByRole("button", {name: /zurücksetzen/i});
      expect(button).toBeDisabled();
    });

    test("Reset-Button bleibt deaktiviert bei E-Mail ohne Domain", async () => {
      renderPasswordResetPage();

      const emailField = screen.getByLabelText(/e-mail/i);
      await userEvent.type(emailField, "test@");

      const button = screen.getByRole("button", {name: /zurücksetzen/i});
      expect(button).toBeDisabled();
    });
  });

  describe("Erfolgreicher Reset", () => {
    test("resetPassword wird mit E-Mail aufgerufen", async () => {
      mockResetPassword.mockResolvedValueOnce(undefined);
      renderPasswordResetPage();

      const emailField = screen.getByLabelText(/e-mail/i);
      await userEvent.type(emailField, "test@example.com");

      const button = screen.getByRole("button", {name: /zurücksetzen/i});
      await userEvent.click(button);

      expect(mockResetPassword).toHaveBeenCalledWith("test@example.com");
    });

    test("Erfolgsmeldung wird nach Versand angezeigt", async () => {
      mockResetPassword.mockResolvedValueOnce(undefined);
      renderPasswordResetPage();

      const emailField = screen.getByLabelText(/e-mail/i);
      await userEvent.type(emailField, "test@example.com");

      const button = screen.getByRole("button", {name: /zurücksetzen/i});
      await userEvent.click(button);

      await waitFor(() => {
        expect(screen.getByText(/Erledigt/i)).toBeInTheDocument();
      });
    });

    test("Info-Text über E-Mail-Postfach wird nach Versand angezeigt", async () => {
      mockResetPassword.mockResolvedValueOnce(undefined);
      renderPasswordResetPage();

      const emailField = screen.getByLabelText(/e-mail/i);
      await userEvent.type(emailField, "test@example.com");

      const button = screen.getByRole("button", {name: /zurücksetzen/i});
      await userEvent.click(button);

      await waitFor(() => {
        // Heading und Success-Alert enthalten beide E-Mail-Postfach-Text
        const matches = screen.getAllByText(/E-Mail-Postfach/i);
        expect(matches.length).toBeGreaterThanOrEqual(1);
      });
    });
  });

  describe("Fehlgeschlagener Reset", () => {
    test("Fehlermeldung wird bei API-Fehler angezeigt", async () => {
      mockResetPassword.mockRejectedValueOnce(
        new Error("User not found")
      );
      renderPasswordResetPage();

      const emailField = screen.getByLabelText(/e-mail/i);
      await userEvent.type(emailField, "unknown@example.com");

      const button = screen.getByRole("button", {name: /zurücksetzen/i});
      await userEvent.click(button);

      await waitFor(() => {
        expect(screen.getByText(/User not found/i)).toBeInTheDocument();
      });
    });

    test("Keine Erfolgsmeldung bei Fehler angezeigt", async () => {
      mockResetPassword.mockRejectedValueOnce(
        new Error("Network error")
      );
      renderPasswordResetPage();

      const emailField = screen.getByLabelText(/e-mail/i);
      await userEvent.type(emailField, "test@example.com");

      const button = screen.getByRole("button", {name: /zurücksetzen/i});
      await userEvent.click(button);

      await waitFor(() => {
        expect(screen.getByText(/Network error/i)).toBeInTheDocument();
      });

      // Kein Erfolgs-Alert
      expect(screen.queryByText(/Erledigt/i)).not.toBeInTheDocument();
    });
  });
});

describe("ForgotPasswordLink", () => {
  test("Link-Text wird angezeigt", () => {
    renderForgotPasswordLink();

    expect(
      screen.getByText(/Hast du möglicherweise dein Passwort vergessen/i)
    ).toBeInTheDocument();
  });

  test("Link zum Passwort-Zurücksetzen wird angezeigt", () => {
    renderForgotPasswordLink();

    expect(
      screen.getByRole("button", {name: /zurücksetzen/i})
    ).toBeInTheDocument();
  });

  test("Navigation zur Passwort-Reset-Seite bei Klick", async () => {
    renderForgotPasswordLink();

    const link = screen.getByRole("button", {name: /zurücksetzen/i});
    await userEvent.click(link);

    expect(testLocation.pathname).toBe(ROUTES_PASSWORD_RESET);
  });
});
