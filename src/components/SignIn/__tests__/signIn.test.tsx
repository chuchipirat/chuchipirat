// Polyfill für jsdom (react-router benötigt TextEncoder/TextDecoder)
import {TextEncoder, TextDecoder} from "util";
Object.assign(global, {TextEncoder, TextDecoder});

import React from "react";
import {render, screen, waitFor} from "@testing-library/react";
import "@testing-library/jest-dom";
import userEvent from "@testing-library/user-event";
import {MemoryRouter, useLocation} from "react-router";

import {SignInPage, AlertMaintenanceMode} from "../signIn";
import {SignUpLink} from "../../SignUp/signUp";
import {DatabaseContext} from "../../Database/DatabaseContext";
import {AuthUserContext} from "../../Session/authUserContext";
import {AuthUser} from "../../Session/authUser.class";
import {
  SIGN_UP as ROUTE_SIGN_UP,
  HOME as ROUTE_HOME,
} from "../../../constants/routes";

/* ===================================================================
// ======================== Mock-Setup ================================
// =================================================================== */

/** Mock für den AuthService (database.auth) */
const mockSignInWithPassword = jest.fn();
const mockResendConfirmationEmail = jest.fn();

/** Mock für UserRepository */
const mockFindById = jest.fn();
const mockFindOwnProfile = jest.fn();
const mockRegisterSignIn = jest.fn();
const mockSignOut = jest.fn();

/** Mock: globalSettings.getSettings — pro Test überschreibbar für maintenanceMode */
const mockGetSettings = jest.fn().mockResolvedValue({
  allowSignUp: true,
  maintenanceMode: false,
});

/** Mock-DatabaseService mit typisierten Mocks */
const mockDatabase = {
  auth: {
    signInWithPassword: mockSignInWithPassword,
    resendConfirmationEmail: mockResendConfirmationEmail,
    signUp: jest.fn(),
    signOut: mockSignOut,
    resetPassword: jest.fn(),
    updatePassword: jest.fn(),
    onAuthStateChange: jest.fn(),
    getUser: jest.fn(),
    getSession: jest.fn(),
  },
  users: {
    findById: mockFindById,
    findOwnProfile: mockFindOwnProfile,
    registerSignIn: mockRegisterSignIn,
  },
  globalSettings: {
    getSettings: mockGetSettings,
  },
} as unknown as import("../../Database/DatabaseService").default;

/** Mock: User.registerSignIn (kein Seiteneffekt nötig) */
jest.mock("../../User/user.class", () => ({
  __esModule: true,
  default: {
    registerSignIn: jest.fn(),
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

/** Mock: Sentry */
jest.mock("@sentry/react", () => ({
  captureException: jest.fn(),
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
      <DatabaseContext.Provider value={mockDatabase}>
        <SignInPage />
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

  describe("Formular-Verhalten", () => {
    test("Passwort-Feld hat autoComplete='current-password'", () => {
      renderSignInPage();

      const passwordField = getPasswordField();
      expect(passwordField).toHaveAttribute("autocomplete", "current-password");
    });

    test("Enter-Taste löst den Login aus", async () => {
      mockSignInWithPassword.mockResolvedValueOnce({
        user: {id: "supabase-uuid"},
      });
      mockFindOwnProfile.mockResolvedValueOnce({uid: "user-123", roles: ["basic"]});
      renderSignInPage();

      await userEvent.type(
        screen.getByLabelText(/e-mail/i),
        "test@example.com",
      );
      await userEvent.type(getPasswordField(), "geheim123{enter}");

      await waitFor(() => {
        expect(mockSignInWithPassword).toHaveBeenCalledWith(
          "test@example.com",
          "geheim123",
        );
      });
    });
  });

  describe("Erfolgreicher Supabase-Login", () => {
    test("signInWithPassword wird mit E-Mail und Passwort aufgerufen", async () => {
      mockSignInWithPassword.mockResolvedValueOnce({
        user: {id: "supabase-uuid"},
      });
      mockFindOwnProfile.mockResolvedValueOnce({uid: "user-123", roles: ["basic"]});
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

  describe("Fehlgeschlagener Login", () => {
    test("Fehlermeldung wird bei fehlgeschlagenem Login angezeigt", async () => {
      const supabaseError = new Error("Invalid login credentials") as Error & {
        code: string;
      };
      supabaseError.code = "invalid_credentials";
      mockSignInWithPassword.mockRejectedValueOnce(supabaseError);
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

  describe("Wartungsmodus — Zugriff nur für Admins", () => {
    test("Nicht-Admin wird nach Login wieder ausgeloggt und bleibt auf der Sign-In-Seite", async () => {
      // Zweimal .mockResolvedValueOnce (nicht mockResolvedValue): onSignIn
      // liest den Wartungsmodus zusätzlich zum initialen Mount-Fetch
      // nochmals frisch ab, um die Race Condition mit dem asynchron
      // geladenen State zu vermeiden. mockResolvedValue würde die
      // Standardimplementierung dauerhaft überschreiben (jest.clearAllMocks
      // in beforeEach setzt nur Aufruf-Historie zurück, keine
      // Implementierungen) und so spätere Tests in dieser Datei verfälschen.
      mockGetSettings
        .mockResolvedValueOnce({allowSignUp: true, maintenanceMode: true})
        .mockResolvedValueOnce({allowSignUp: true, maintenanceMode: true});
      mockSignInWithPassword.mockResolvedValueOnce({
        user: {id: "supabase-uuid"},
      });
      mockFindOwnProfile.mockResolvedValueOnce({
        uid: "user-123",
        roles: ["basic"],
      });
      renderSignInPage();

      // Wartungswarnung ist sichtbar, Formular bleibt trotzdem bedienbar
      await waitFor(() => {
        expect(screen.getByText(/Wartungsmodus/i)).toBeInTheDocument();
      });

      await userEvent.type(
        screen.getByLabelText(/e-mail/i),
        "basic@example.com",
      );
      await userEvent.type(getPasswordField(), "geheim123");

      const button = screen.getByRole("button", {name: /anmelden/i});
      expect(button).toBeEnabled();
      await userEvent.click(button);

      await waitFor(() => {
        expect(mockSignOut).toHaveBeenCalled();
      });

      // Keine Navigation weg von der Sign-In-Seite
      expect(testLocation.pathname).toBe("/signin");
    });

    test("Admin wird trotz Wartungsmodus angemeldet und navigiert weiter", async () => {
      // Siehe Kommentar im vorherigen Test: zweimal .mockResolvedValueOnce
      // statt .mockResolvedValue, um andere Tests nicht zu verfälschen.
      mockGetSettings
        .mockResolvedValueOnce({allowSignUp: true, maintenanceMode: true})
        .mockResolvedValueOnce({allowSignUp: true, maintenanceMode: true});
      mockSignInWithPassword.mockResolvedValueOnce({
        user: {id: "supabase-uuid"},
      });
      mockFindOwnProfile.mockResolvedValueOnce({
        uid: "admin-123",
        roles: ["admin"],
      });

      // AuthUserContext simuliert, dass der AuthUserProvider bereits einen
      // (Admin-)User bereitstellt — Voraussetzung dafür, dass die
      // Navigations-useEffect in SignInPage überhaupt auslöst.
      const fakeAdmin = new AuthUser();
      fakeAdmin.uid = "admin-123";
      fakeAdmin.roles = ["admin"] as AuthUser["roles"];

      render(
        <MemoryRouter initialEntries={["/signin"]}>
          <DatabaseContext.Provider value={mockDatabase}>
            <AuthUserContext.Provider value={fakeAdmin}>
              <SignInPage />
            </AuthUserContext.Provider>
            <LocationDisplay />
          </DatabaseContext.Provider>
        </MemoryRouter>,
      );

      await waitFor(() => {
        expect(screen.getByText(/Wartungsmodus/i)).toBeInTheDocument();
      });

      await userEvent.type(
        screen.getByLabelText(/e-mail/i),
        "admin@example.com",
      );
      await userEvent.type(getPasswordField(), "geheim123");
      await userEvent.click(screen.getByRole("button", {name: /anmelden/i}));

      await waitFor(() => {
        expect(testLocation.pathname).toBe(ROUTE_HOME);
      });
      expect(mockSignOut).not.toHaveBeenCalled();
    });

    test("Nicht-Admin wird blockiert, obwohl der beim Mount geladene State noch 'false' war (Race Condition)", async () => {
      // Simuliert genau den Bug: der initiale (Mount-)Fetch liefert noch
      // `false` (z.B. weil der Wartungsmodus erst danach aktiviert wurde
      // oder der Fetch beim Kaltstart der App langsam war). onSignIn muss
      // den Status trotzdem frisch abfragen und darf sich nicht auf den
      // veralteten State verlassen.
      mockGetSettings
        .mockResolvedValueOnce({allowSignUp: true, maintenanceMode: false})
        .mockResolvedValueOnce({allowSignUp: true, maintenanceMode: true});
      mockSignInWithPassword.mockResolvedValueOnce({
        user: {id: "supabase-uuid"},
      });
      mockFindOwnProfile.mockResolvedValueOnce({
        uid: "user-123",
        roles: ["basic"],
      });
      renderSignInPage();

      // Wartungswarnung ist beim Mount NICHT sichtbar (State ist noch false)
      await userEvent.type(
        screen.getByLabelText(/e-mail/i),
        "basic@example.com",
      );
      await userEvent.type(getPasswordField(), "geheim123");
      await userEvent.click(screen.getByRole("button", {name: /anmelden/i}));

      await waitFor(() => {
        expect(mockSignOut).toHaveBeenCalled();
      });
      expect(testLocation.pathname).toBe("/signin");
    });

    test("Schlägt der frische Wartungsmodus-Read fehl, wird NICHT blockiert (fail-open)", async () => {
      // Ein Admin muss sich immer einloggen können, um den Wartungsmodus
      // wieder auszuschalten — ein fehlgeschlagener Read darf niemanden
      // aussperren.
      mockGetSettings
        .mockResolvedValueOnce({allowSignUp: true, maintenanceMode: true})
        .mockRejectedValueOnce(new Error("network error"));
      mockSignInWithPassword.mockResolvedValueOnce({
        user: {id: "supabase-uuid"},
      });
      mockFindOwnProfile.mockResolvedValueOnce({
        uid: "user-123",
        roles: ["basic"],
      });
      renderSignInPage();

      await waitFor(() => {
        expect(screen.getByText(/Wartungsmodus/i)).toBeInTheDocument();
      });

      await userEvent.type(
        screen.getByLabelText(/e-mail/i),
        "basic@example.com",
      );
      await userEvent.type(getPasswordField(), "geheim123");
      await userEvent.click(screen.getByRole("button", {name: /anmelden/i}));

      // Kein AuthUserContext simuliert hier einen bereits gesetzten User
      // (anders als im Admin-Testfall oben) — daher wird nicht navigiert.
      // Warten, bis der zweite (fehlschlagende) getSettings-Aufruf
      // tatsächlich passiert ist, um sicherzustellen, dass der Catch-Zweig
      // durchlaufen wurde, bevor geprüft wird, dass NICHT ausgeloggt wurde.
      await waitFor(() => {
        expect(mockGetSettings).toHaveBeenCalledTimes(2);
      });
      expect(mockSignOut).not.toHaveBeenCalled();
    });
  });
});

describe("AlertMaintenanceMode", () => {
  test("Wartungswarnung wird angezeigt", () => {
    render(<AlertMaintenanceMode />);

    expect(screen.getByText(/Wartungsmodus/i)).toBeInTheDocument();
  });
});

describe("Unbestätigte E-Mail-Adresse", () => {
  /** Hilfsfunktion: Login auslösen, der mit email_not_confirmed fehlschlägt */
  const triggerEmailNotConfirmedError = async () => {
    const supabaseError = new Error("Email not confirmed") as Error & {
      code: string;
    };
    supabaseError.code = "email_not_confirmed";
    mockSignInWithPassword.mockRejectedValueOnce(supabaseError);
    renderSignInPage();

    await userEvent.type(
      screen.getByLabelText(/e-mail/i),
      "unbestaetigt@example.com",
    );
    await userEvent.type(getPasswordField(), "passwort123");
    await userEvent.click(screen.getByRole("button", {name: /anmelden/i}));
  };

  test("Zeigt Warnmeldung bei email_not_confirmed Fehler", async () => {
    await triggerEmailNotConfirmedError();

    await waitFor(() => {
      expect(
        screen.getByText(/E-Mail-Adresse nicht bestätigt/i),
      ).toBeInTheDocument();
    });

    // Prüfen, dass der Hinweis auf Spam-Ordner vorhanden ist
    expect(screen.getByText(/Spam-Ordner/i)).toBeInTheDocument();
  });

  test("Zeigt Resend-Button bei email_not_confirmed", async () => {
    await triggerEmailNotConfirmedError();

    await waitFor(() => {
      expect(
        screen.getByRole("button", {
          name: /Bestätigungs-E-Mail erneut senden/i,
        }),
      ).toBeInTheDocument();
    });
  });

  test("Resend-Button sendet Bestätigungs-E-Mail", async () => {
    mockResendConfirmationEmail.mockResolvedValueOnce(undefined);
    await triggerEmailNotConfirmedError();

    await waitFor(() => {
      expect(
        screen.getByRole("button", {
          name: /Bestätigungs-E-Mail erneut senden/i,
        }),
      ).toBeInTheDocument();
    });

    await userEvent.click(
      screen.getByRole("button", {
        name: /Bestätigungs-E-Mail erneut senden/i,
      }),
    );

    await waitFor(() => {
      expect(mockResendConfirmationEmail).toHaveBeenCalledWith(
        "unbestaetigt@example.com",
      );
    });
  });

  test("Erfolgsmeldung nach erneutem Senden", async () => {
    mockResendConfirmationEmail.mockResolvedValueOnce(undefined);
    await triggerEmailNotConfirmedError();

    await waitFor(() => {
      expect(
        screen.getByRole("button", {
          name: /Bestätigungs-E-Mail erneut senden/i,
        }),
      ).toBeInTheDocument();
    });

    await userEvent.click(
      screen.getByRole("button", {
        name: /Bestätigungs-E-Mail erneut senden/i,
      }),
    );

    await waitFor(() => {
      expect(
        screen.getByText(/erneut gesendet/i),
      ).toBeInTheDocument();
    });

    // Resend-Button verschwindet nach Erfolg
    expect(
      screen.queryByRole("button", {
        name: /Bestätigungs-E-Mail erneut senden/i,
      }),
    ).not.toBeInTheDocument();
  });

  test("Generischer Fehler wird NICHT als email_not_confirmed angezeigt", async () => {
    const supabaseError = new Error("Invalid login credentials") as Error & {
      code: string;
    };
    supabaseError.code = "invalid_credentials";
    mockSignInWithPassword.mockRejectedValueOnce(supabaseError);
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

    // Kein Resend-Button bei generischem Fehler
    expect(
      screen.queryByRole("button", {
        name: /Bestätigungs-E-Mail erneut senden/i,
      }),
    ).not.toBeInTheDocument();
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
