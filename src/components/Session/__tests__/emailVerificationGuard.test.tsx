// Polyfill fuer jsdom (react-router benoetigt TextEncoder/TextDecoder)
import {TextEncoder, TextDecoder} from "util";
Object.assign(global, {TextEncoder, TextDecoder});

import React from "react";
import {render, screen, waitFor} from "@testing-library/react";
import "@testing-library/jest-dom";
import userEvent from "@testing-library/user-event";
import {MemoryRouter} from "react-router";

import {DatabaseContext} from "../../Database/DatabaseContext";
import {AuthUserContext} from "../authUserContext";
import LocalStorageKey from "../../../constants/localStorage";

/* ===================================================================
// ======================== Mock-Setup ================================
// =================================================================== */

/** Mock fuer die resendConfirmationEmail-Methode des AuthService */
const mockResendConfirmationEmail = jest.fn();

/** Mock-DatabaseService mit AuthService */
const mockDatabase = {
  auth: {
    resendConfirmationEmail: mockResendConfirmationEmail,
    signInWithPassword: jest.fn(),
    signUp: jest.fn(),
    signOut: jest.fn(),
    resetPassword: jest.fn(),
    updatePassword: jest.fn(),
    onAuthStateChange: jest.fn(),
    getUser: jest.fn(),
    getSession: jest.fn(),
  },
  users: {},
} as any;

/** Mock: ImageRepository — wird von pageTitle und buttonRow indirekt benoetigt */
jest.mock("../../../constants/imageRepository", () => ({
  ImageRepository: {
    getEnvironmentRelatedPicture: () => ({
      SIGN_IN_HEADER: "test-image.png",
    }),
  },
}));

/* ===================================================================
// ======================== Import nach Mocks =========================
// =================================================================== */
import EmailVerificationGuard from "../emailVerificationGuard";
import AuthUser from "../../Firebase/Authentication/authUser.class";

/* ===================================================================
// ======================== Render-Helper =============================
// =================================================================== */

/**
 * Rendert den EmailVerificationGuard mit allen noetigen Context-Providern.
 *
 * @param authUser - Der simulierte AuthUser (oder null)
 * @param children - Optionaler Kindinhalt (Standard: "Geschuetzter Inhalt")
 */
const renderGuard = (
  authUser: AuthUser | null,
  children: React.ReactNode = <div>Geschuetzter Inhalt</div>,
) => {
  return render(
    <MemoryRouter>
      <DatabaseContext.Provider value={mockDatabase}>
        <AuthUserContext.Provider value={authUser}>
          <EmailVerificationGuard>{children}</EmailVerificationGuard>
        </AuthUserContext.Provider>
      </DatabaseContext.Provider>
    </MemoryRouter>,
  );
};

/**
 * Erstellt ein AuthUser-Objekt mit anpassbaren Eigenschaften.
 *
 * @param overrides - Partielle AuthUser-Werte zum Ueberschreiben
 * @returns Ein vollstaendiges AuthUser-Objekt
 */
const createAuthUser = (overrides: Partial<AuthUser> = {}): AuthUser => ({
  uid: "test-uid-123",
  email: "test@chuchipirat.ch",
  emailVerified: true,
  firstName: "Test",
  lastName: "User",
  roles: [],
  publicProfile: {
    displayName: "Test User",
    motto: "",
    pictureSrc: "",
  },
  ...overrides,
});

/* ===================================================================
// ======================== Tests =====================================
// =================================================================== */

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.clear();
});

describe("EmailVerificationGuard", () => {
  describe("Kinder-Rendering (Guard laesst durch)", () => {
    /**
     * Wenn die E-Mail verifiziert ist, soll der Guard die Kinder rendern
     * und keine Verifizierungsmeldung anzeigen.
     */
    test("Zeigt Kinder wenn E-Mail verifiziert", () => {
      const authUser = createAuthUser({emailVerified: true});

      renderGuard(authUser);

      expect(screen.getByText("Geschuetzter Inhalt")).toBeInTheDocument();
      expect(
        screen.queryByText(/Bestaetigungs-E-Mail erneut senden/i),
      ).not.toBeInTheDocument();
    });

    /**
     * Wenn kein AuthUser vorhanden ist (null), soll der Guard die Kinder
     * rendern — die Authentifizierung wird an anderer Stelle geprueft.
     */
    test("Zeigt Kinder wenn authUser null", () => {
      renderGuard(null);

      expect(screen.getByText("Geschuetzter Inhalt")).toBeInTheDocument();
    });

    /**
     * Wenn authUser.emailVerified=false ist, aber der localStorage-Eintrag
     * emailVerified=true hat, ueberschreibt der LocalStorage-Wert.
     * Dies tritt auf, wenn die Verifizierung in einem anderen Tab erfolgt.
     */
    test("Zeigt Kinder wenn localStorage emailVerified=true", () => {
      const authUser = createAuthUser({emailVerified: false});
      localStorage.setItem(
        LocalStorageKey.AUTH_USER,
        JSON.stringify({emailVerified: true}),
      );

      renderGuard(authUser);

      expect(screen.getByText("Geschuetzter Inhalt")).toBeInTheDocument();
    });

    /**
     * Wenn authUser.emailVerified=false ist, aber kein localStorage-Eintrag
     * existiert, soll der Guard die Kinder rendern (Sicherheits-Fallback).
     * Ohne localStorage-Eintrag kann der Guard nicht sicher bestimmen, ob
     * die Verifizierung noetig ist.
     */
    test("Zeigt Kinder wenn kein localStorage-Eintrag", () => {
      const authUser = createAuthUser({emailVerified: false});
      // Kein localStorage-Eintrag gesetzt

      renderGuard(authUser);

      expect(screen.getByText("Geschuetzter Inhalt")).toBeInTheDocument();
    });
  });

  describe("Verifizierungsmeldung (Guard blockiert)", () => {
    /**
     * Wenn die E-Mail nicht verifiziert ist und der localStorage-Eintrag
     * ebenfalls emailVerified=false hat, soll der Guard die
     * Verifizierungsmeldung anzeigen und die Kinder blockieren.
     */
    test("Zeigt Verifizierungsmeldung wenn E-Mail nicht verifiziert", () => {
      const authUser = createAuthUser({emailVerified: false});
      localStorage.setItem(
        LocalStorageKey.AUTH_USER,
        JSON.stringify({emailVerified: false}),
      );

      renderGuard(authUser);

      // Kinder duerfen nicht gerendert werden
      expect(screen.queryByText("Geschuetzter Inhalt")).not.toBeInTheDocument();

      // Die Info-Meldung zur E-Mail-Verifizierung wird angezeigt
      expect(screen.getByRole("alert")).toBeInTheDocument();
      expect(
        screen.getByText(/Kontrolliere bitte deine E-Mail/i),
      ).toBeInTheDocument();

      // Der Resend-Button wird angezeigt
      expect(
        screen.getByRole("button", {
          name: /Bestätigungs-E-Mail erneut senden/i,
        }),
      ).toBeInTheDocument();
    });
  });

  describe("Resend-Button Interaktion", () => {
    /**
     * Beim Klick auf den Resend-Button soll resendConfirmationEmail
     * mit der E-Mail-Adresse des AuthUsers aufgerufen werden.
     */
    test("Resend-Button sendet Bestätigungs-E-Mail", async () => {
      mockResendConfirmationEmail.mockResolvedValueOnce(undefined);
      const authUser = createAuthUser({
        emailVerified: false,
        email: "verify@chuchipirat.ch",
      });
      localStorage.setItem(
        LocalStorageKey.AUTH_USER,
        JSON.stringify({emailVerified: false}),
      );

      renderGuard(authUser);

      const resendButton = screen.getByRole("button", {
        name: /Bestätigungs-E-Mail erneut senden/i,
      });
      await userEvent.click(resendButton);

      await waitFor(() => {
        expect(mockResendConfirmationEmail).toHaveBeenCalledWith(
          "verify@chuchipirat.ch",
        );
      });
    });

    /**
     * Nach erfolgreichem Senden der Bestätigungs-E-Mail soll die
     * Erfolgsmeldung angezeigt und der Button deaktiviert werden.
     */
    test("Erfolgsmeldung nach erneutem Senden", async () => {
      mockResendConfirmationEmail.mockResolvedValueOnce(undefined);
      const authUser = createAuthUser({emailVerified: false});
      localStorage.setItem(
        LocalStorageKey.AUTH_USER,
        JSON.stringify({emailVerified: false}),
      );

      renderGuard(authUser);

      // Vor dem Klick: Info-Alert sichtbar
      expect(
        screen.getByText(/Kontrolliere bitte deine E-Mail/i),
      ).toBeInTheDocument();

      const resendButton = screen.getByRole("button", {
        name: /Bestätigungs-E-Mail erneut senden/i,
      });
      expect(resendButton).toBeEnabled();

      await userEvent.click(resendButton);

      // Nach dem Klick: Erfolgs-Alert sichtbar, Button deaktiviert
      await waitFor(() => {
        expect(
          screen.getByText(/Bestätigung wurde verschickt/i),
        ).toBeInTheDocument();
      });

      expect(
        screen.queryByText(/Kontrolliere bitte deine E-Mail/i),
      ).not.toBeInTheDocument();

      expect(
        screen.getByRole("button", {
          name: /Bestätigungs-E-Mail erneut senden/i,
        }),
      ).toBeDisabled();
    });
  });
});
