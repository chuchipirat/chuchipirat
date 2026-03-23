// Polyfill fuer jsdom (react-router benoetigt TextEncoder/TextDecoder)
import {TextEncoder, TextDecoder} from "util";
Object.assign(global, {TextEncoder, TextDecoder});

import React from "react";
import {render, screen, waitFor} from "@testing-library/react";
import "@testing-library/jest-dom";
import {MemoryRouter} from "react-router";

import {DatabaseContext} from "../../Database/DatabaseContext";
import {DatabaseService} from "../../Database/DatabaseService";

/* ===================================================================
// ======================== Mock-Setup ================================
// =================================================================== */

/** Mock-Funktion fuer useNavigate — wird in AuthorizationGuard-Tests verwendet */
const mockNavigate = jest.fn();
jest.mock("react-router", () => {
  const actual = jest.requireActual("react-router");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

/** Mock: Sentry — wird fuer die Fehlerbehandlung verwendet */
jest.mock("@sentry/react", () => ({
  captureException: jest.fn(),
}));

/** Mock: ImageRepository — wird von diversen Komponenten indirekt benoetigt */
jest.mock("../../../constants/imageRepository", () => ({
  ImageRepository: {
    getEnvironmentRelatedPicture: () => ({
      SIGN_IN_HEADER: "test-image.png",
    }),
  },
}));

/** Mock: Firebase-Context — wird von authUserContext indirekt importiert */
jest.mock("../../Firebase/firebaseContext", () => ({
  useFirebase: jest.fn(),
}));

/** Mock-DatabaseService mit minimaler Auth-API */
const mockGetSession = jest.fn();
const mockDatabase = {
  auth: {
    getSession: mockGetSession,
    onAuthStateChange: jest.fn(),
    signInWithPassword: jest.fn(),
    signUp: jest.fn(),
    signOut: jest.fn(),
    resetPassword: jest.fn(),
    updatePassword: jest.fn(),
    getUser: jest.fn(),
    resendConfirmationEmail: jest.fn(),
  },
  users: {},
} as unknown as DatabaseService;

/* ===================================================================
// ======================== Import nach Mocks =========================
// =================================================================== */
import {AuthUserContext, useAuthUser, AuthorizationGuard} from "../authUserContext";
import AuthUser from "../../Firebase/Authentication/authUser.class";

/* ===================================================================
// ======================== Hilfs-Funktionen ==========================
// =================================================================== */

/**
 * Erstellt ein AuthUser-Objekt mit anpassbaren Eigenschaften.
 *
 * @param overrides - Partielle AuthUser-Werte zum Ueberschreiben.
 * @returns Ein vollstaendiges AuthUser-Objekt.
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

/**
 * Hilfskomponente zum Testen von useAuthUser.
 * Gibt den Rueckgabewert als Text aus.
 */
const AuthUserConsumer: React.FC = () => {
  const authUser = useAuthUser();
  return <div data-testid="auth-user-value">{authUser ? authUser.uid : "null"}</div>;
};

/**
 * Rendert den AuthorizationGuard mit allen noetigen Context-Providern.
 *
 * @param authUser - Der simulierte AuthUser (oder null).
 * @param condition - Die Bedingungs-Funktion fuer den Guard.
 * @param children - Optionaler Kindinhalt (Standard: "Geschuetzter Inhalt").
 */
const renderGuard = (
  authUser: AuthUser | null,
  condition: (user: AuthUser | null) => boolean,
  children: React.ReactNode = <div>Geschuetzter Inhalt</div>,
) => {
  return render(
    <MemoryRouter>
      <DatabaseContext.Provider value={mockDatabase}>
        <AuthUserContext.Provider value={authUser}>
          <AuthorizationGuard condition={condition}>{children}</AuthorizationGuard>
        </AuthUserContext.Provider>
      </DatabaseContext.Provider>
    </MemoryRouter>,
  );
};

/* ===================================================================
// ======================== Tests =====================================
// =================================================================== */

beforeEach(() => {
  jest.clearAllMocks();
});

describe("AuthorizationGuard", () => {
  /**
   * Wenn die Bedingung erfuellt ist, sollen die Kinder gerendert werden.
   */
  test("Rendert Kinder wenn die Bedingung erfuellt ist", () => {
    const authUser = createAuthUser();
    const alwaysTrueCondition = () => true;

    renderGuard(authUser, alwaysTrueCondition);

    expect(screen.getByText("Geschuetzter Inhalt")).toBeInTheDocument();
  });

  /**
   * Wenn authUser null ist, aber eine aktive Session existiert,
   * befindet sich der Guard im Ladezustand und rendert nichts.
   * Es wird nicht navigiert, da der AuthUserProvider den User noch laden koennte.
   */
  test("Gibt null zurueck wenn authUser null und Session vorhanden (Ladezustand)", async () => {
    // getSession liefert eine gueltige Session → kein Redirect
    mockGetSession.mockResolvedValueOnce({user: {id: "session-uid"}});
    const conditionRequiresUser = (user: AuthUser | null) => user !== null;

    renderGuard(null, conditionRequiresUser);

    // Guard rendert nichts, da die Bedingung mit null fehlschlaegt
    expect(screen.queryByText("Geschuetzter Inhalt")).not.toBeInTheDocument();

    await waitFor(() => {
      expect(mockGetSession).toHaveBeenCalled();
    });

    // Kein Navigate-Aufruf, da eine Session vorhanden ist
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  /**
   * Wenn authUser null ist und keine Session existiert (Benutzer abgemeldet),
   * soll der Guard zur Anmeldeseite navigieren.
   */
  test("Navigiert zu SIGN_IN wenn keine Session vorhanden (abgemeldet)", async () => {
    // getSession liefert null → Benutzer ist nicht angemeldet
    mockGetSession.mockResolvedValueOnce(null);
    const conditionRequiresUser = (user: AuthUser | null) => user !== null;

    renderGuard(null, conditionRequiresUser);

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/signin");
    });
  });

  /**
   * Wenn authUser vorhanden ist, aber die Bedingung fehlschlaegt,
   * soll der Guard zur NO_AUTH-Seite navigieren.
   */
  test("Navigiert zu NO_AUTH wenn die Bedingung fehlschlaegt", async () => {
    const authUser = createAuthUser();
    const alwaysFalseCondition = () => false;

    renderGuard(authUser, alwaysFalseCondition);

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/noauth");
    });
  });
});

describe("useAuthUser", () => {
  /**
   * Ohne Provider liefert useAuthUser den Standardwert null.
   */
  test("Gibt null zurueck wenn ausserhalb des Providers verwendet", () => {
    render(<AuthUserConsumer />);

    expect(screen.getByTestId("auth-user-value")).toHaveTextContent("null");
  });

  /**
   * Mit AuthUserContext.Provider gibt useAuthUser den bereitgestellten Wert zurueck.
   */
  test("Gibt den AuthUser-Wert aus dem Context zurueck", () => {
    const authUser = createAuthUser({uid: "context-uid-456"});

    render(
      <AuthUserContext.Provider value={authUser}>
        <AuthUserConsumer />
      </AuthUserContext.Provider>,
    );

    expect(screen.getByTestId("auth-user-value")).toHaveTextContent("context-uid-456");
  });
});
