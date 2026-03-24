// Polyfill für jsdom (react-router benötigt TextEncoder/TextDecoder)
import {TextEncoder, TextDecoder} from "util";
Object.assign(global, {TextEncoder, TextDecoder});

import React from "react";
import {render, screen, waitFor} from "@testing-library/react";
import "@testing-library/jest-dom";
import userEvent from "@testing-library/user-event";
import {MemoryRouter} from "react-router";

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

/** Mock für den AuthService (database.auth) */
const mockUpdatePassword = jest.fn();
const mockUpdateEmail = jest.fn();
const mockSignInWithPassword = jest.fn();
const mockGetUser = jest.fn();

/** Mock-DatabaseService */
const mockDatabase = {
  auth: {
    signInWithPassword: mockSignInWithPassword,
    signUp: jest.fn(),
    signOut: jest.fn(),
    resetPassword: jest.fn(),
    updatePassword: mockUpdatePassword,
    updateEmail: mockUpdateEmail,
    onAuthStateChange: jest.fn(),
    getUser: mockGetUser,
    getSession: jest.fn(),
  },
  users: {},
} as any;

/** Mock-Firebase-Instanz */
const mockFirebase = {
  emailChange: jest.fn(),
  sendEmailVerification: jest.fn(),
} as any;

/** Mock: User.registerSignIn & User.updateEmail */
jest.mock("../../User/user.class", () => ({
  User: {
    registerSignIn: jest.fn(),
    updateEmail: jest.fn().mockResolvedValue(undefined),
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

/** Mock: PasswordStrengthMeter — vereinfacht */
jest.mock("../../Shared/passwordStrengthMeter", () => ({
  PasswordStrengthMeter: ({password}: {password: string}) => (
    <div data-testid="password-strength">
      {password.length >= 6 ? "Stark" : "Schwach"}
    </div>
  ),
}));

/** Mock: AuthServiceHandler passwordReset */
jest.mock("../../AuthServiceHandler/passwordReset", () => ({
  ForgotPasswordLink: () => <span>Passwort vergessen?</span>,
}));

/* ===================================================================
// ======================== Imports nach Mocks =========================
// =================================================================== */
import {PasswordChangePage} from "../passwordChange";
import {FirebaseContext} from "../../Firebase/firebaseContext";
import {DatabaseContext} from "../../Database/DatabaseContext";
import {AuthUserContext} from "../../Session/authUserContext";
import authUserMock from "../../Firebase/Authentication/__mocks__/authuser.mock";

/* ===================================================================
// ======================== Render-Helper =============================
// =================================================================== */

/**
 * Rendert die PasswordChangePage mit allen nötigen Context-Providern.
 *
 * @param oobCode - Optionaler Reset-Code (simuliert Passwort-Reset-Link)
 * @param authUser - Optionaler AuthUser (Default: authUserMock)
 */
const renderPasswordChangePage = ({
  oobCode,
  authUser = authUserMock,
}: {
  oobCode?: string;
  authUser?: typeof authUserMock | null;
} = {}) => {
  return render(
    <MemoryRouter initialEntries={["/pw-change"]}>
      <FirebaseContext.Provider value={mockFirebase}>
        <DatabaseContext.Provider value={mockDatabase}>
          <AuthUserContext.Provider value={authUser}>
            <PasswordChangePage oobCode={oobCode} />
          </AuthUserContext.Provider>
        </DatabaseContext.Provider>
      </FirebaseContext.Provider>
    </MemoryRouter>,
  );
};

/** Hilfsfunktion: Passwort-Feld via ID holen */
const getPasswordField = () => {
  const el = document.getElementById("password");
  if (!el) throw new Error("Passwort-Feld nicht gefunden");
  return el as HTMLInputElement;
};

/** Hilfsfunktion: Passwort-Bestätigungs-Feld via ID holen */
const getPasswordConfirmField = () => {
  const el = document.getElementById("passwordConfirm");
  if (!el) throw new Error("Passwort-Bestätigungs-Feld nicht gefunden");
  return el as HTMLInputElement;
};

/**
 * Hilfsfunktion: Passwort und Bestätigung eingeben.
 * Füllt beide Felder mit demselben Wert.
 */
const typePasswordWithConfirm = async (password: string) => {
  await userEvent.type(getPasswordField(), password);
  await userEvent.type(getPasswordConfirmField(), password);
};

/**
 * Hilfsfunktion: Reauthentifizierung durchführen.
 * Bei Rendering ohne oobCode erscheint der ReauthDialog zuerst.
 */
const completeReauthentication = async () => {
  // Supabase-Reauthentifizierung erfolgreich
  mockSignInWithPassword.mockResolvedValueOnce({user: {id: "uuid"}});

  // Passwort im Reauthentifizierungs-Dialog eingeben und absenden
  const dialogPasswordField = document.getElementById("reauth-password");
  if (!dialogPasswordField)
    throw new Error("Dialog-Passwort-Feld nicht gefunden");

  await userEvent.type(dialogPasswordField, "altesPasswort");
  // Im Dialog gibt es einen "Anmelden"-Button
  const signInButton = screen.getByRole("button", {name: /anmelden/i});
  await userEvent.click(signInButton);

  // Warten bis der Dialog schliesst und die Success-Snackbar erscheint
  await waitFor(() => {
    expect(mockSignInWithPassword).toHaveBeenCalled();
  });
};

/* ===================================================================
// ======================== Tests =====================================
// =================================================================== */

beforeEach(() => {
  jest.clearAllMocks();
});

describe("PasswordChangePage", () => {
  describe("Mit Reset-Code (oobCode)", () => {
    test("Zeigt Titel 'Passwort ändern' an", () => {
      mockGetUser.mockResolvedValue({email: "test@example.com"});
      renderPasswordChangePage({oobCode: "reset-code-123"});

      expect(
        screen.getByRole("heading", {name: /Passwort ändern/i}),
      ).toBeInTheDocument();
    });

    test("Kein E-Mail-Feld und kein 'E-Mail ändern'-Button im Reset-Flow", () => {
      mockGetUser.mockResolvedValue({email: "test@example.com"});
      renderPasswordChangePage({oobCode: "reset-code-123"});

      expect(screen.queryByLabelText(/e-mail/i)).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", {name: /e-mail ändern/i}),
      ).not.toBeInTheDocument();
    });

    test("Kein Reauthentifizierungs-Dialog wird angezeigt", () => {
      mockGetUser.mockResolvedValue({email: "test@example.com"});
      renderPasswordChangePage({oobCode: "reset-code-123"});

      expect(screen.queryByText(/Ausweis bitte/i)).not.toBeInTheDocument();
    });
  });

  describe("Ohne Reset-Code (eingeloggter Benutzer)", () => {
    test("Zeigt Titel 'Login ändern' an", () => {
      renderPasswordChangePage();

      expect(screen.getByText(/Login ändern/i)).toBeInTheDocument();
    });

    test("Reauthentifizierungs-Dialog wird angezeigt", () => {
      renderPasswordChangePage();

      expect(screen.getByText(/Ausweis bitte/i)).toBeInTheDocument();
    });

    test("E-Mail ist mit authUser-E-Mail vorausgefüllt nach Reauthentifizierung", async () => {
      renderPasswordChangePage();
      await completeReauthentication();

      await waitFor(() => {
        const emailField = screen.getByLabelText(/e-mail/i);
        expect(emailField).toHaveValue(authUserMock.email);
      });
    });
  });

  describe("Passwort ändern", () => {
    test("Passwort-ändern-Button ist deaktiviert bei leerem Passwort", () => {
      mockGetUser.mockResolvedValue({email: "test@example.com"});
      renderPasswordChangePage({oobCode: "reset-code-123"});

      const changeButton = screen.getByRole("button", {
        name: /passwort ändern/i,
      });
      expect(changeButton).toBeDisabled();
    });

    test("Passwort-ändern-Button ist deaktiviert bei zu kurzem Passwort", async () => {
      mockGetUser.mockResolvedValue({email: "test@example.com"});
      renderPasswordChangePage({oobCode: "reset-code-123"});

      await userEvent.type(getPasswordField(), "12345");

      const changeButton = screen.getByRole("button", {
        name: /passwort ändern/i,
      });
      expect(changeButton).toBeDisabled();
    });

    test("Passwort-ändern-Button ist deaktiviert wenn Bestätigung nicht übereinstimmt", async () => {
      mockGetUser.mockResolvedValue({email: "test@example.com"});
      renderPasswordChangePage({oobCode: "reset-code-123"});

      await userEvent.type(getPasswordField(), "neuesPasswort123");
      await userEvent.type(getPasswordConfirmField(), "anderes");

      const changeButton = screen.getByRole("button", {
        name: /passwort ändern/i,
      });
      expect(changeButton).toBeDisabled();
      expect(screen.getByText(/stimmen nicht überein/i)).toBeInTheDocument();
    });

    test("Passwort-ändern-Button ist aktiviert bei übereinstimmenden Passwörtern", async () => {
      mockGetUser.mockResolvedValue({email: "test@example.com"});
      renderPasswordChangePage({oobCode: "reset-code-123"});

      await typePasswordWithConfirm("neuesPasswort123");

      const changeButton = screen.getByRole("button", {
        name: /passwort ändern/i,
      });
      expect(changeButton).toBeEnabled();
    });

    test("Erfolgsmeldung wird nach Passwortänderung angezeigt", async () => {
      mockGetUser.mockResolvedValue({email: "test@example.com"});
      mockUpdatePassword.mockResolvedValueOnce(undefined);
      renderPasswordChangePage({oobCode: "reset-code-123"});

      await typePasswordWithConfirm("neuesPasswort123");
      await userEvent.click(
        screen.getByRole("button", {name: /passwort ändern/i}),
      );

      await waitFor(() => {
        expect(
          screen.getByText(/Passwort wurde geändert/i),
        ).toBeInTheDocument();
      });
    });

    test("updatePassword wird mit neuem Passwort aufgerufen", async () => {
      mockGetUser.mockResolvedValue({email: "test@example.com"});
      mockUpdatePassword.mockResolvedValueOnce(undefined);
      renderPasswordChangePage({oobCode: "reset-code-123"});

      await typePasswordWithConfirm("neuesPasswort123");
      await userEvent.click(
        screen.getByRole("button", {name: /passwort ändern/i}),
      );

      await waitFor(() => {
        expect(mockUpdatePassword).toHaveBeenCalledWith("neuesPasswort123");
      });
    });

    test("'Zur Anmeldung'-Button erscheint nach erfolgreichem Reset", async () => {
      mockGetUser.mockResolvedValue({email: "test@example.com"});
      mockUpdatePassword.mockResolvedValueOnce(undefined);
      renderPasswordChangePage({oobCode: "reset-code-123"});

      await typePasswordWithConfirm("neuesPasswort123");
      await userEvent.click(
        screen.getByRole("button", {name: /passwort ändern/i}),
      );

      await waitFor(() => {
        expect(
          screen.getByRole("button", {name: /anmeldung/i}),
        ).toBeInTheDocument();
      });
    });
  });

  describe("Fehlermeldung bei Passwortänderung", () => {
    test("Fehlermeldung wird bei gleichem Passwort angezeigt", async () => {
      mockGetUser.mockResolvedValue({email: "test@example.com"});
      mockUpdatePassword.mockRejectedValueOnce(
        new Error("New password should be different from the old password."),
      );
      renderPasswordChangePage({oobCode: "reset-code-123"});

      await typePasswordWithConfirm("altesPasswort");
      await userEvent.click(
        screen.getByRole("button", {name: /passwort ändern/i}),
      );

      await waitFor(() => {
        expect(
          screen.getByText(
            /New password should be different from the old password/i,
          ),
        ).toBeInTheDocument();
      });
    });

    test("Fehlermeldung verschwindet nach erfolgreicher Passwortänderung", async () => {
      mockGetUser.mockResolvedValue({email: "test@example.com"});

      // Erster Versuch: Fehler (gleiches Passwort)
      mockUpdatePassword.mockRejectedValueOnce(
        new Error("New password should be different from the old password."),
      );
      renderPasswordChangePage({oobCode: "reset-code-123"});

      await typePasswordWithConfirm("altesPasswort");
      await userEvent.click(
        screen.getByRole("button", {name: /passwort ändern/i}),
      );

      // Fehler sichtbar
      await waitFor(() => {
        expect(
          screen.getByText(
            /New password should be different from the old password/i,
          ),
        ).toBeInTheDocument();
      });

      // Zweiter Versuch: Erfolg (neues Passwort)
      mockUpdatePassword.mockResolvedValueOnce(undefined);
      const passwordField = getPasswordField();
      const confirmField = getPasswordConfirmField();
      await userEvent.clear(passwordField);
      await userEvent.clear(confirmField);
      await userEvent.type(passwordField, "neuesPasswort456");
      await userEvent.type(confirmField, "neuesPasswort456");
      await userEvent.click(
        screen.getByRole("button", {name: /passwort ändern/i}),
      );

      // Erfolgsmeldung sichtbar, Fehler weg
      await waitFor(() => {
        expect(
          screen.getByText(/Passwort wurde geändert/i),
        ).toBeInTheDocument();
        expect(
          screen.queryByText(
            /New password should be different from the old password/i,
          ),
        ).not.toBeInTheDocument();
      });
    });

    test("Allgemeiner Fehler wird angezeigt", async () => {
      mockGetUser.mockResolvedValue({email: "test@example.com"});
      mockUpdatePassword.mockRejectedValueOnce(new Error("Network error"));
      renderPasswordChangePage({oobCode: "reset-code-123"});

      await typePasswordWithConfirm("neuesPasswort123");
      await userEvent.click(
        screen.getByRole("button", {name: /passwort ändern/i}),
      );

      await waitFor(() => {
        expect(screen.getByText(/Network error/i)).toBeInTheDocument();
      });
    });
  });

  describe("Passwort-Stärkemeter", () => {
    test("PasswordStrengthMeter wird angezeigt", () => {
      mockGetUser.mockResolvedValue({email: "test@example.com"});
      renderPasswordChangePage({oobCode: "reset-code-123"});

      expect(screen.getByTestId("password-strength")).toBeInTheDocument();
    });
  });

  describe("E-Mail ändern", () => {
    test("updateEmail wird mit neuer E-Mail aufgerufen", async () => {
      mockUpdateEmail.mockResolvedValueOnce(undefined);
      renderPasswordChangePage();
      await completeReauthentication();

      const emailField = await waitFor(() => screen.getByLabelText(/e-mail/i));
      await userEvent.clear(emailField);
      await userEvent.type(emailField, "neu@example.com");
      await userEvent.click(
        screen.getByRole("button", {name: /e-mail.*ändern/i}),
      );

      await waitFor(() => {
        expect(mockUpdateEmail).toHaveBeenCalledWith("neu@example.com");
      });
    });

    test("Erfolgsmeldung wird nach E-Mail-Änderung angezeigt", async () => {
      mockUpdateEmail.mockResolvedValueOnce(undefined);
      renderPasswordChangePage();
      await completeReauthentication();

      const emailField = await waitFor(() => screen.getByLabelText(/e-mail/i));
      await userEvent.clear(emailField);
      await userEvent.type(emailField, "neu@example.com");
      await userEvent.click(
        screen.getByRole("button", {name: /e-mail.*ändern/i}),
      );

      await waitFor(() => {
        expect(
          screen.getByText(/Bestätigung/i),
        ).toBeInTheDocument();
      });
    });

    test("Fehlermeldung bei identischer E-Mail", async () => {
      renderPasswordChangePage();
      await completeReauthentication();

      // E-Mail ist bereits mit authUser-E-Mail vorausgefüllt — direkt absenden
      await waitFor(() => {
        expect(screen.getByLabelText(/e-mail/i)).toHaveValue(authUserMock.email);
      });
      await userEvent.click(
        screen.getByRole("button", {name: /e-mail.*ändern/i}),
      );

      await waitFor(() => {
        expect(
          screen.getByText(/identisch/i),
        ).toBeInTheDocument();
      });
    });

    test("Fehlermeldung bei API-Fehler", async () => {
      mockUpdateEmail.mockRejectedValueOnce(new Error("Rate limit exceeded"));
      renderPasswordChangePage();
      await completeReauthentication();

      const emailField = await waitFor(() => screen.getByLabelText(/e-mail/i));
      await userEvent.clear(emailField);
      await userEvent.type(emailField, "neu@example.com");
      await userEvent.click(
        screen.getByRole("button", {name: /e-mail.*ändern/i}),
      );

      await waitFor(() => {
        expect(screen.getByText(/Rate limit exceeded/i)).toBeInTheDocument();
      });
    });
  });

  describe("Passwort-Hinweis", () => {
    test("Passwort-Anforderungshinweis wird angezeigt", () => {
      mockGetUser.mockResolvedValue({email: "test@example.com"});
      renderPasswordChangePage({oobCode: "reset-code-123"});

      expect(screen.getByText(/Mindestens 6 Zeichen/i)).toBeInTheDocument();
    });
  });
});
