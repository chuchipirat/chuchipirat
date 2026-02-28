// Polyfill für jsdom (react-router benötigt TextEncoder/TextDecoder)
import {TextEncoder, TextDecoder} from "util";
Object.assign(global, {TextEncoder, TextDecoder});

import React from "react";
import {render, screen, waitFor} from "@testing-library/react";
import "@testing-library/jest-dom";
import userEvent from "@testing-library/user-event";
import {MemoryRouter, useLocation} from "react-router";

import SignUpPage, {
  SignUpLink,
  DialogTermOfUse,
  DialogPrivacyPolicy,
} from "../signUp";
import {DatabaseContext} from "../../Database/DatabaseContext";
import {FirebaseContext} from "../../Firebase/firebaseContext";
import {SIGN_UP as ROUTE_SIGN_UP} from "../../../constants/routes";

/* ===================================================================
// ======================== Mock-Setup ================================
// =================================================================== */

/** Mock für den AuthService (database.auth) */
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
} as any;

/** Mock-Firebase-Instanz */
const mockFirebase = {
  configuration: {
    globalSettings: {
      read: jest.fn(),
    },
  },
} as any;

/** Mock: GlobalSettings — Standard: signUp erlaubt, kein Maintenance-Modus */
const mockGetGlobalSettings = jest.fn().mockResolvedValue({
  maintenanceMode: false,
  allowSignUp: true,
  allowUserCreatePassword: "",
});

jest.mock("../../Admin/globalSettings.class", () => ({
  __esModule: true,
  default: {
    getGlobalSettings: (...args: unknown[]) => mockGetGlobalSettings(...args),
  },
}));

/** Mock: User.createUser */
const mockCreateUser = jest.fn().mockResolvedValue(undefined);
jest.mock("../../User/user.class", () => ({
  __esModule: true,
  default: {
    createUser: (...args: unknown[]) => mockCreateUser(...args),
  },
}));

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
  __esModule: true,
  default: ({password}: {password: string}) => (
    <div data-testid="password-strength">Stärke: {password.length}</div>
  ),
}));

/** Mock: customDialogContext (für Test-Umgebung Code-Dialog) */
jest.mock("../../Shared/customDialogContext", () => ({
  ...jest.requireActual("../../Shared/customDialogContext"),
  useCustomDialog: () => ({customDialog: jest.fn()}),
}));

/** Mock: PrivacyPolicyText und TermOfUseText */
jest.mock("../../App/privacyPolicy", () => ({
  PrivacyPolicyText: () => <div>Datenschutztext</div>,
}));
jest.mock("../../App/termOfUse", () => ({
  TermOfUseText: () => <div>Nutzungsbedingungstext</div>,
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
 * Rendert die SignUpPage mit allen nötigen Context-Providern.
 */
const renderSignUpPage = () => {
  return render(
    <MemoryRouter initialEntries={["/signup"]}>
      <FirebaseContext.Provider value={mockFirebase}>
        <DatabaseContext.Provider value={mockDatabase}>
          <SignUpPage />
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
  mockGetGlobalSettings.mockResolvedValue({
    maintenanceMode: false,
    allowSignUp: true,
    allowUserCreatePassword: "",
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

    test("Passwort-Stärke-Anzeige wird angezeigt", () => {
      renderSignUpPage();

      expect(screen.getByTestId("password-strength")).toBeInTheDocument();
    });
  });

  describe("Formular-Eingabe", () => {
    test("Felder können befüllt werden", async () => {
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

    test("Account-erstellen-Button wird bei gültiger Eingabe aktiviert", async () => {
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

  describe("Erfolgreiche Registrierung", () => {
    test("Supabase signUp und User.createUser werden aufgerufen", async () => {
      mockAuthSignUp.mockResolvedValueOnce({id: "new-supabase-uuid"});
      renderSignUpPage();

      await userEvent.type(screen.getByLabelText(/vorname/i), "Max");
      await userEvent.type(screen.getByLabelText(/nachname/i), "Muster");
      await userEvent.type(screen.getByLabelText(/e-mail/i), "max@example.com");
      await userEvent.type(getPasswordField(), "geheim123");
      await userEvent.click(
        screen.getByRole("button", {name: /account erstellen/i}),
      );

      await waitFor(() => {
        expect(mockAuthSignUp).toHaveBeenCalledWith(
          "max@example.com",
          "geheim123",
        );
      });

      await waitFor(() => {
        expect(mockCreateUser).toHaveBeenCalledWith(
          expect.objectContaining({
            uid: "new-supabase-uuid",
            authUid: "new-supabase-uuid",
            firstName: "Max",
            lastName: "Muster",
            email: "max@example.com",
          }),
        );
      });
    });
  });

  describe("Fehlgeschlagene Registrierung", () => {
    test("Fehlermeldung wird bei API-Fehler angezeigt", async () => {
      const error = new Error("Email already registered") as Error & {
        code: string;
      };
      error.code = "auth/email-already-in-use";
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
      mockGetGlobalSettings.mockResolvedValue({
        maintenanceMode: false,
        allowSignUp: false,
        allowUserCreatePassword: "",
      });
      renderSignUpPage();

      await waitFor(() => {
        expect(screen.getByText(/Beta-Phase/i)).toBeInTheDocument();
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

    test("Link zu Datenschutzbestimmungen wird angezeigt", () => {
      renderSignUpPage();

      expect(
        screen.getByRole("button", {name: /Datenschutzbestimmungen/i}),
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
  test("Dialog zeigt Nutzungsbedingungstext an wenn geöffnet", () => {
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
  test("Dialog zeigt Datenschutztext an wenn geöffnet", () => {
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
