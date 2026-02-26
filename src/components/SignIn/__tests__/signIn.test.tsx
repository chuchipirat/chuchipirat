// Polyfill für jsdom (react-router benötigt TextEncoder/TextDecoder)
import {TextEncoder, TextDecoder} from "util";
Object.assign(global, {TextEncoder, TextDecoder});

import React from "react";
import {render, screen, waitFor} from "@testing-library/react";
import "@testing-library/jest-dom";
import userEvent from "@testing-library/user-event";
import {MemoryRouter, useLocation} from "react-router";

import SignInPage, {AlertMaintenanceMode} from "../signIn";
import {SignUpLink} from "../../SignUp/signUp";
import {DatabaseContext} from "../../Database/DatabaseContext";
import {FirebaseContext} from "../../Firebase/firebaseContext";
import {SIGN_UP as ROUTE_SIGN_UP} from "../../../constants/routes";

/* ===================================================================
// ======================== Mock-Setup ================================
// =================================================================== */

/** Mock für den AuthService (database.auth) */
const mockSignInWithPassword = jest.fn();

/** Mock für Firebase Auth (Fallback-Login) */
const mockFirebaseSignIn = jest.fn();
const mockFirebaseSignOut = jest.fn();

/** Mock für UserRepository */
const mockFindByAuthUid = jest.fn();

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
  users: {
    findByAuthUid: mockFindByAuthUid,
  },
} as any;

/** Mock-Firebase-Instanz */
const mockFirebase = {
  signInWithEmailAndPassword: mockFirebaseSignIn,
  signOut: mockFirebaseSignOut,
  configuration: {
    globalSettings: {
      read: jest.fn(),
    },
  },
} as any;

/** Mock: GlobalSettings.getGlobalSettings gibt Standard-Werte zurück */
jest.mock("../../Admin/globalSettings.class", () => ({
  __esModule: true,
  default: {
    getGlobalSettings: jest.fn().mockResolvedValue({
      maintenanceMode: false,
      allowSignUp: true,
      allowUserCreatePassword: "",
    }),
  },
}));

/** Mock: User.registerSignIn (kein Seiteneffekt nötig) */
jest.mock("../../User/user.class", () => ({
  __esModule: true,
  default: {
    registerSignIn: jest.fn(),
  },
}));

/** Mock: PasswordMigrationDialog (vereinfacht, zeigt nur open/close) */
jest.mock("../passwordMigrationDialog", () => ({
  __esModule: true,
  default: ({
    open,
    onClose,
    onSuccess,
  }: {
    open: boolean;
    onClose: () => void;
    onSuccess: () => void;
  }) =>
    open ? (
      <div data-testid="migration-dialog">
        <button onClick={onSuccess}>Migration OK</button>
        <button onClick={onClose}>Migration Abbrechen</button>
      </div>
    ) : null,
}));

/** Mock: ImageRepository */
jest.mock("../../../constants/imageRepository", () => ({
  ImageRepository: {
    getEnvironmentRelatedPicture: () => ({
      SIGN_IN_HEADER: "test-image.png",
    }),
  },
}));

/** Location-Helfer für Navigations-Assertions */
let testLocation: ReturnType<typeof useLocation>;
const LocationDisplay = () => {
  testLocation = useLocation();
  return null;
};

/* ===================================================================
// ======================== Render-Helper =============================
// =================================================================== */

/**
 * Rendert die SignInPage mit allen nötigen Context-Providern.
 */
const renderSignInPage = () => {
  return render(
    <MemoryRouter initialEntries={["/signin"]}>
      <FirebaseContext.Provider value={mockFirebase}>
        <DatabaseContext.Provider value={mockDatabase}>
          <SignInPage />
          <LocationDisplay />
        </DatabaseContext.Provider>
      </FirebaseContext.Provider>
    </MemoryRouter>,
  );
};

/**
 * Rendert die SignUpLink-Komponente mit Router.
 */
const renderSignUpLink = () => {
  return render(
    <MemoryRouter initialEntries={["/signin"]}>
      <SignUpLink />
      <LocationDisplay />
    </MemoryRouter>,
  );
};

/** Hilfsfunktion: Passwort-Feld via ID holen (umgeht Label-Konflikte mit aria-label) */
const getPasswordField = () => {
  const el = document.getElementById("password");
  if (!el) throw new Error("Passwort-Feld nicht gefunden");
  return el as HTMLInputElement;
};

/* ===================================================================
// ======================== Tests =====================================
// =================================================================== */

beforeEach(() => {
  jest.clearAllMocks();
});

describe("SignInPage", () => {
  describe("Initialer Zustand", () => {
    test("E-Mail-Feld wird angezeigt und ist leer", () => {
      renderSignInPage();

      const emailField = screen.getByLabelText(/e-mail/i);
      expect(emailField).toBeInTheDocument();
      expect(emailField).toHaveValue("");
    });

    test("Passwort-Feld wird angezeigt und ist leer", () => {
      renderSignInPage();

      const passwordField = getPasswordField();
      expect(passwordField).toBeInTheDocument();
      expect(passwordField).toHaveValue("");
    });

    test("Anmelden-Button ist initial deaktiviert", () => {
      renderSignInPage();

      const button = screen.getByRole("button", {name: /anmelden/i});
      expect(button).toBeDisabled();
    });

    test("Kein Fehler beim Laden angezeigt", () => {
      renderSignInPage();

      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });

    test("Kein Migrations-Dialog beim Laden angezeigt", () => {
      renderSignInPage();

      expect(screen.queryByTestId("migration-dialog")).not.toBeInTheDocument();
    });
  });

  describe("Formular-Eingabe", () => {
    test("E-Mail-Feld kann befüllt werden", async () => {
      renderSignInPage();

      const emailField = screen.getByLabelText(/e-mail/i);
      await userEvent.type(emailField, "test@example.com");

      expect(emailField).toHaveValue("test@example.com");
    });

    test("Passwort-Feld kann befüllt werden", async () => {
      renderSignInPage();

      const passwordField = getPasswordField();
      await userEvent.type(passwordField, "geheim123");

      expect(passwordField).toHaveValue("geheim123");
    });

    test("Anmelden-Button wird aktiviert bei gültiger E-Mail und Passwort", async () => {
      renderSignInPage();

      await userEvent.type(
        screen.getByLabelText(/e-mail/i),
        "test@example.com",
      );
      await userEvent.type(getPasswordField(), "geheim123");

      const button = screen.getByRole("button", {name: /anmelden/i});
      expect(button).toBeEnabled();
    });

    test("Anmelden-Button bleibt deaktiviert bei ungültiger E-Mail", async () => {
      renderSignInPage();

      await userEvent.type(screen.getByLabelText(/e-mail/i), "keine-email");
      await userEvent.type(getPasswordField(), "geheim123");

      const button = screen.getByRole("button", {name: /anmelden/i});
      expect(button).toBeDisabled();
    });

    test("Anmelden-Button bleibt deaktiviert ohne Passwort", async () => {
      renderSignInPage();

      await userEvent.type(
        screen.getByLabelText(/e-mail/i),
        "test@example.com",
      );

      const button = screen.getByRole("button", {name: /anmelden/i});
      expect(button).toBeDisabled();
    });

    test("Passwort-Sichtbarkeit kann umgeschaltet werden", async () => {
      renderSignInPage();

      const passwordField = getPasswordField();
      expect(passwordField).toHaveAttribute("type", "password");

      const toggleButton = screen.getByLabelText(/ein-\/ausblenden/i);
      await userEvent.click(toggleButton);

      expect(passwordField).toHaveAttribute("type", "text");
    });
  });

  describe("Erfolgreicher Supabase-Login", () => {
    test("signInWithPassword wird mit E-Mail und Passwort aufgerufen", async () => {
      mockSignInWithPassword.mockResolvedValueOnce({
        user: {id: "supabase-uuid"},
      });
      mockFindByAuthUid.mockResolvedValueOnce({uid: "user-123"});
      renderSignInPage();

      await userEvent.type(
        screen.getByLabelText(/e-mail/i),
        "test@example.com",
      );
      await userEvent.type(getPasswordField(), "geheim123");
      await userEvent.click(screen.getByRole("button", {name: /anmelden/i}));

      await waitFor(() => {
        expect(mockSignInWithPassword).toHaveBeenCalledWith(
          "test@example.com",
          "geheim123",
        );
      });
    });
  });

  describe("Firebase-Fallback mit Migration", () => {
    test("Migrations-Dialog wird bei Firebase-Fallback angezeigt", async () => {
      // Supabase schlägt fehl
      mockSignInWithPassword.mockRejectedValueOnce(new Error("Invalid login"));
      // Firebase-Fallback erfolgreich
      mockFirebaseSignIn.mockResolvedValueOnce({
        user: {uid: "firebase-uid-123"},
      });
      renderSignInPage();

      await userEvent.type(
        screen.getByLabelText(/e-mail/i),
        "test@example.com",
      );
      await userEvent.type(getPasswordField(), "geheim123");
      await userEvent.click(screen.getByRole("button", {name: /anmelden/i}));

      await waitFor(() => {
        expect(screen.getByTestId("migration-dialog")).toBeInTheDocument();
      });
    });
  });

  describe("Fehlgeschlagener Login", () => {
    test("Fehlermeldung wird bei beiden fehlgeschlagenen Logins angezeigt", async () => {
      // Supabase schlägt fehl
      mockSignInWithPassword.mockRejectedValueOnce(new Error("Invalid login"));
      // Firebase schlägt auch fehl
      const firebaseError = new Error("auth/wrong-password") as Error & {
        code: string;
      };
      firebaseError.code = "auth/wrong-password";
      mockFirebaseSignIn.mockRejectedValueOnce(firebaseError);
      renderSignInPage();

      await userEvent.type(
        screen.getByLabelText(/e-mail/i),
        "test@example.com",
      );
      await userEvent.type(getPasswordField(), "falsch");
      await userEvent.click(screen.getByRole("button", {name: /anmelden/i}));

      await waitFor(() => {
        expect(screen.getByRole("alert")).toBeInTheDocument();
      });
    });
  });
});

describe("AlertMaintenanceMode", () => {
  test("Wartungswarnung wird angezeigt", () => {
    render(<AlertMaintenanceMode />);

    expect(screen.getByText(/Wartungsmodus/i)).toBeInTheDocument();
  });
});

describe("SignUpLink", () => {
  test("Link-Text wird angezeigt", () => {
    renderSignUpLink();

    expect(screen.getByText(/Noch keinen Account/i)).toBeInTheDocument();
  });

  test("Navigation zur Registrierungsseite bei Klick", async () => {
    renderSignUpLink();

    const link = screen.getByRole("button", {name: /Noch keinen Account/i});
    await userEvent.click(link);

    expect(testLocation.pathname).toBe(ROUTE_SIGN_UP);
  });
});
