// Polyfill fuer jsdom (react-router benoetigt TextEncoder/TextDecoder)
import {TextEncoder, TextDecoder} from "util";
Object.assign(global, {TextEncoder, TextDecoder});

import React from "react";
import {render, screen, waitFor} from "@testing-library/react";
import "@testing-library/jest-dom";
import userEvent from "@testing-library/user-event";
import {MemoryRouter, useLocation} from "react-router";

import {
  SignUpPage,
  SignUpLink,
  DialogTermOfUse,
  DialogPrivacyPolicy,
} from "../signUp";
import {DatabaseContext} from "../../Database/DatabaseContext";
import {DatabaseService} from "../../Database/DatabaseService";
import {
  SIGN_UP as ROUTE_SIGN_UP,
  SIGN_IN as ROUTE_SIGN_IN,
  HOME as ROUTE_HOME,
} from "../../../constants/routes";

/* ===================================================================
// ======================== Mock-Setup ================================
// =================================================================== */

/** Mock: Utils — Standardwerte für Testumgebung */
jest.mock("../../Shared/utils.class", () => ({
  Utils: {
    isTestEnvironment: jest.fn(() => false),
    isDevEnvironment: jest.fn(() => true),
    isProductionEnvironment: jest.fn(() => false),
    getEnvironment: jest.fn(() => "DEV"),
    isUrl: jest.fn(() => false),
    isEmail: jest.fn((email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)),
    getDomain: jest.fn(() => ""),
    sortArray: jest.fn(({array}: {array: unknown[]}) => array),
    generateUid: jest.fn(() => "mock-uid"),
  },
}));

/** Mock: useCustomStyles — gibt ein leeres Styles-Objekt zurueck. */
jest.mock("../../../constants/styles", () => ({
  useCustomStyles: jest.fn(() => ({})),
}));

/** Mock fuer AuthUser-Context — standardmaessig nicht eingeloggt */
let mockAuthUser: {uid: string; email: string} | null = null;
jest.mock("../../Session/authUserContext", () => ({
  useAuthUser: () => mockAuthUser,
}));

/** Mock fuer Sentry */
jest.mock("@sentry/react", () => ({
  captureException: jest.fn(),
}));

/** Mock fuer den AuthService (database.auth) */
const mockAuthSignUp = jest.fn();

/** Mock-DatabaseService */
const mockDatabase = {
  auth: {
    signInWithPassword: jest.fn(),
    signUp: mockAuthSignUp,
    signOut: jest.fn(),
    resetPassword: jest.fn(),
    updatePassword: jest.fn(),
    onAuthStateChange: jest.fn(),
    getUser: jest.fn(),
    getSession: jest.fn(),
  },
  users: {},
  globalSettings: {
    getSettings: (...args: unknown[]) => mockGetSettings(...args),
  },
} as unknown as DatabaseService;

/**
 * Mock: signUp.tsx ruft database.globalSettings.getSettings() auf.
 * Der Mock wird ueber mockDatabase.globalSettings bereitgestellt.
 */
const mockGetSettings = jest.fn().mockResolvedValue({
  maintenanceMode: false,
  allowSignUp: true,
});

/** Mock: ImageRepository */
jest.mock("../../../constants/imageRepository", () => ({
  ImageRepository: {
    getEnvironmentRelatedPicture: () => ({
      SIGN_IN_HEADER: "test-image.png",
    }),
  },
}));

/** Mock: PasswordStrengthMeter (vereinfacht) */
jest.mock("../../Shared/passwordStrengthMeter", () => ({
  PasswordStrengthMeter: ({password}: {password: string}) => (
    <div data-testid="password-strength">Staerke: {password.length}</div>
  ),
}));

/** Mock: PrivacyPolicyText und TermOfUseText */
jest.mock("../../App/privacyPolicy", () => ({
  PrivacyPolicyText: () => <div>Datenschutztext</div>,
}));
jest.mock("../../App/termOfUse", () => ({
  TermOfUseText: () => <div>Nutzungsbedingungstext</div>,
}));

/** Location-Helfer fuer Navigations-Assertions */
let testLocation: ReturnType<typeof useLocation>;
const LocationDisplay = () => {
  testLocation = useLocation();
  return null;
};

/* ===================================================================
// ======================== Render-Helper =============================
// =================================================================== */

/**
 * Rendert die SignUpPage mit allen noetigen Context-Providern.
 */
const renderSignUpPage = () => {
  return render(
    <MemoryRouter initialEntries={["/signup"]}>
      <DatabaseContext.Provider value={mockDatabase}>
        <SignUpPage />
        <LocationDisplay />
      </DatabaseContext.Provider>
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

/**
 * Hilfsfunktion: Fuellt das Formular mit gueltigen Daten aus und klickt auf Registrieren.
 */
const fillFormAndSubmit = async () => {
  await userEvent.type(screen.getByLabelText(/vorname/i), "Max");
  await userEvent.type(screen.getByLabelText(/nachname/i), "Muster");
  await userEvent.type(screen.getByLabelText(/e-mail/i), "max@example.com");
  await userEvent.type(getPasswordField(), "geheim123");
  await userEvent.click(
    screen.getByRole("button", {name: /account erstellen/i}),
  );
};

/* ===================================================================
// ======================== Tests =====================================
// =================================================================== */

beforeEach(() => {
  jest.clearAllMocks();
  mockAuthUser = null;
  mockGetSettings.mockResolvedValue({
    maintenanceMode: false,
    allowSignUp: true,
  });
});

describe("SignUpPage", () => {
  describe("Initialer Zustand", () => {
    test("Vorname-Feld wird angezeigt und ist leer", () => {
      renderSignUpPage();

      const field = screen.getByLabelText(/vorname/i);
      expect(field).toBeInTheDocument();
      expect(field).toHaveValue("");
    });

    test("Nachname-Feld wird angezeigt und ist leer", () => {
      renderSignUpPage();

      const field = screen.getByLabelText(/nachname/i);
      expect(field).toBeInTheDocument();
      expect(field).toHaveValue("");
    });

    test("E-Mail-Feld wird angezeigt und ist leer", () => {
      renderSignUpPage();

      const field = screen.getByLabelText(/e-mail/i);
      expect(field).toBeInTheDocument();
      expect(field).toHaveValue("");
    });

    test("Passwort-Feld wird angezeigt und ist leer", () => {
      renderSignUpPage();

      const field = getPasswordField();
      expect(field).toBeInTheDocument();
      expect(field).toHaveValue("");
    });

    test("Account-erstellen-Button ist initial deaktiviert", () => {
      renderSignUpPage();

      const button = screen.getByRole("button", {name: /account erstellen/i});
      expect(button).toBeDisabled();
    });

    test("Kein Fehler beim Laden angezeigt", () => {
      renderSignUpPage();

      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });

    test("Passwort-Staerke-Anzeige wird angezeigt", () => {
      renderSignUpPage();

      expect(screen.getByTestId("password-strength")).toBeInTheDocument();
    });

    test("Ueberschrift zeigt 'Account erstellen'", () => {
      renderSignUpPage();

      expect(
        screen.getByRole("heading", {name: /account erstellen/i}),
      ).toBeInTheDocument();
    });
  });

  describe("Formular-Eingabe", () => {
    test("Felder koennen befuellt werden", async () => {
      renderSignUpPage();

      await userEvent.type(screen.getByLabelText(/vorname/i), "Max");
      await userEvent.type(screen.getByLabelText(/nachname/i), "Muster");
      await userEvent.type(screen.getByLabelText(/e-mail/i), "max@example.com");
      await userEvent.type(getPasswordField(), "geheim123");

      expect(screen.getByLabelText(/vorname/i)).toHaveValue("Max");
      expect(screen.getByLabelText(/nachname/i)).toHaveValue("Muster");
      expect(screen.getByLabelText(/e-mail/i)).toHaveValue("max@example.com");
      expect(getPasswordField()).toHaveValue("geheim123");
    });

    test("Account-erstellen-Button wird bei gueltiger Eingabe aktiviert", async () => {
      renderSignUpPage();

      await userEvent.type(screen.getByLabelText(/vorname/i), "Max");
      await userEvent.type(screen.getByLabelText(/e-mail/i), "max@example.com");
      await userEvent.type(getPasswordField(), "geheim123");

      const button = screen.getByRole("button", {name: /account erstellen/i});
      expect(button).toBeEnabled();
    });

    test("Button bleibt deaktiviert ohne Vorname", async () => {
      renderSignUpPage();

      await userEvent.type(screen.getByLabelText(/e-mail/i), "max@example.com");
      await userEvent.type(getPasswordField(), "geheim123");

      const button = screen.getByRole("button", {name: /account erstellen/i});
      expect(button).toBeDisabled();
    });

    test("Button bleibt deaktiviert ohne Passwort", async () => {
      renderSignUpPage();

      await userEvent.type(screen.getByLabelText(/vorname/i), "Max");
      await userEvent.type(screen.getByLabelText(/e-mail/i), "max@example.com");

      const button = screen.getByRole("button", {name: /account erstellen/i});
      expect(button).toBeDisabled();
    });

    test("Passwort-Sichtbarkeit kann umgeschaltet werden", async () => {
      renderSignUpPage();

      const passwordField = getPasswordField();
      expect(passwordField).toHaveAttribute("type", "password");

      const toggleButton = screen.getByLabelText(/ein-\/ausblenden/i);
      await userEvent.click(toggleButton);

      expect(passwordField).toHaveAttribute("type", "text");
    });
  });

  describe("E-Mail-Validierung", () => {
    test("Validierungsfehler wird nicht vor Blur angezeigt", async () => {
      renderSignUpPage();

      await userEvent.type(screen.getByLabelText(/e-mail/i), "ungueltig");

      expect(
        screen.queryByText(/gültige E-Mail/i),
      ).not.toBeInTheDocument();
    });

    test("Validierungsfehler wird nach Blur bei ungueltiger E-Mail angezeigt", async () => {
      renderSignUpPage();

      const emailField = screen.getByLabelText(/e-mail/i);
      await userEvent.type(emailField, "ungueltig");
      await userEvent.tab(); // Blur ausloesen

      expect(screen.getByText(/gültige E-Mail/i)).toBeInTheDocument();
    });
  });

  describe("Erfolgreiche Registrierung", () => {
    test("Supabase signUp wird mit firstName/lastName aufgerufen", async () => {
      mockAuthSignUp.mockResolvedValueOnce({id: "new-supabase-uuid"});
      renderSignUpPage();

      await fillFormAndSubmit();

      await waitFor(() => {
        expect(mockAuthSignUp).toHaveBeenCalledWith(
          "max@example.com",
          "geheim123",
          {firstName: "Max", lastName: "Muster"},
        );
      });
    });

    test("Erfolgsscreen zeigt Anmelden-Button", async () => {
      mockAuthSignUp.mockResolvedValueOnce({id: "new-supabase-uuid"});
      renderSignUpPage();

      await fillFormAndSubmit();

      await waitFor(() => {
        expect(screen.getByRole("alert")).toBeInTheDocument();
      });

      // "Anmelden"-Button zum Navigieren zur Sign-In-Seite
      const signInButton = screen.getByRole("button", {name: /anmelden/i});
      expect(signInButton).toBeInTheDocument();

      await userEvent.click(signInButton);
      expect(testLocation.pathname).toBe(ROUTE_SIGN_IN);
    });
  });

  describe("Fehlgeschlagene Registrierung", () => {
    test("Fehlermeldung wird bei API-Fehler angezeigt", async () => {
      const error = new Error("User already exists") as Error & {
        code: string;
      };
      error.code = "user_already_exists";
      mockAuthSignUp.mockRejectedValueOnce(error);
      renderSignUpPage();

      await userEvent.type(screen.getByLabelText(/vorname/i), "Max");
      await userEvent.type(screen.getByLabelText(/e-mail/i), "max@example.com");
      await userEvent.type(getPasswordField(), "geheim123");
      await userEvent.click(
        screen.getByRole("button", {name: /account erstellen/i}),
      );

      await waitFor(() => {
        expect(screen.getByRole("alert")).toBeInTheDocument();
      });
    });
  });

  describe("SignUp nicht erlaubt", () => {
    test("Info-Meldung wird angezeigt wenn signUp nicht erlaubt ist", async () => {
      mockGetSettings.mockResolvedValue({
        maintenanceMode: false,
        allowSignUp: false,
      });
      renderSignUpPage();

      await waitFor(() => {
        expect(
          screen.getByText(/keine Neuanmeldungen möglich/i),
        ).toBeInTheDocument();
      });
    });
  });

  describe("Redirect bei eingeloggtem Benutzer", () => {
    test("Eingeloggter Benutzer wird zur Startseite weitergeleitet", async () => {
      mockAuthUser = {uid: "user-123", email: "test@example.com"};
      renderSignUpPage();

      await waitFor(() => {
        expect(testLocation.pathname).toBe(ROUTE_HOME);
      });
    });
  });

  describe("Nutzungsbedingungen und Datenschutz", () => {
    test("Link zu Nutzungsbedingungen wird angezeigt", () => {
      renderSignUpPage();

      expect(
        screen.getByRole("button", {name: /Nutzungsbedingungen/i}),
      ).toBeInTheDocument();
    });

    test("Link zu Datenschutzerklaerung wird angezeigt", () => {
      renderSignUpPage();

      expect(
        screen.getByRole("button", {name: /Datenschutzerklärung/i}),
      ).toBeInTheDocument();
    });
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

describe("DialogTermOfUse", () => {
  test("Dialog zeigt Nutzungsbedingungstext an wenn geoeffnet", () => {
    render(<DialogTermOfUse open={true} onClose={jest.fn()} />);

    expect(screen.getByText(/Nutzungsbedingungstext/i)).toBeInTheDocument();
  });

  test("Dialog ist nicht sichtbar wenn geschlossen", () => {
    render(<DialogTermOfUse open={false} onClose={jest.fn()} />);

    expect(
      screen.queryByText(/Nutzungsbedingungstext/i),
    ).not.toBeInTheDocument();
  });

  test("Schliessen-Button ruft onClose auf", async () => {
    const onClose = jest.fn();
    render(<DialogTermOfUse open={true} onClose={onClose} />);

    await userEvent.click(screen.getByRole("button", {name: /schliessen/i}));
    expect(onClose).toHaveBeenCalled();
  });
});

describe("DialogPrivacyPolicy", () => {
  test("Dialog zeigt Datenschutztext an wenn geoeffnet", () => {
    render(<DialogPrivacyPolicy open={true} onClose={jest.fn()} />);

    expect(screen.getByText(/Datenschutztext/i)).toBeInTheDocument();
  });

  test("Dialog ist nicht sichtbar wenn geschlossen", () => {
    render(<DialogPrivacyPolicy open={false} onClose={jest.fn()} />);

    expect(screen.queryByText(/Datenschutztext/i)).not.toBeInTheDocument();
  });

  test("Schliessen-Button ruft onClose auf", async () => {
    const onClose = jest.fn();
    render(<DialogPrivacyPolicy open={true} onClose={onClose} />);

    await userEvent.click(screen.getByRole("button", {name: /schliessen/i}));
    expect(onClose).toHaveBeenCalled();
  });
});
