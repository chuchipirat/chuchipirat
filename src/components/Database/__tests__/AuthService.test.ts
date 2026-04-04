/**
 * Unit-Tests für AuthService.
 *
 * Testet alle Supabase-Auth-Methoden (signIn, signUp, signOut, etc.).
 * Der Supabase-Client wird vollständig gemockt.
 */

/* ===================================================================
// ======================== Mock-Setup ================================
// =================================================================== */

/** Mock-Auth-Objekt für supabase.auth */
const mockAuth = {
  signInWithPassword: jest.fn(),
  signUp: jest.fn(),
  resend: jest.fn(),
  signOut: jest.fn(),
  resetPasswordForEmail: jest.fn(),
  updateUser: jest.fn(),
  onAuthStateChange: jest.fn(),
  getUser: jest.fn(),
  getSession: jest.fn(),
};

/** Mock-Admin-Auth-Objekt für supabaseAdmin.auth.admin */
const mockAdminAuth = {
  createUser: jest.fn(),
  updateUserById: jest.fn(),
};

/** Referenz auf supabaseAdmin — kann pro Test auf null gesetzt werden */
let mockSupabaseAdmin: any = {
  auth: {admin: mockAdminAuth},
};

jest.mock("../supabaseClient", () => ({
  get supabase() {
    return {auth: mockAuth};
  },
  get supabaseAdmin() {
    return mockSupabaseAdmin;
  },
}));

/* ===================================================================
// ======================== Import nach Mocks =========================
// =================================================================== */
import {AuthService} from "../AuthService";

/* ===================================================================
// ======================== Tests =====================================
// =================================================================== */

let authService: AuthService;

/** Origin-Basis für redirectTo-URLs (jsdom liefert "http://localhost") */
const ORIGIN = window.location.origin;

beforeEach(() => {
  jest.clearAllMocks();
  mockSupabaseAdmin = {auth: {admin: mockAdminAuth}};
  authService = new AuthService();
});

describe("AuthService", () => {
  /* ------------------------------------------
  // signInWithPassword()
  // ------------------------------------------ */
  describe("signInWithPassword()", () => {
    test("Gibt Session bei erfolgreicher Anmeldung zurück", async () => {
      const mockSession = {access_token: "token-123", user: {id: "u1"}};
      mockAuth.signInWithPassword.mockResolvedValue({
        data: {session: mockSession},
        error: null,
      });

      const result = await authService.signInWithPassword(
        "test@example.com",
        "password123"
      );

      expect(mockAuth.signInWithPassword).toHaveBeenCalledWith({
        email: "test@example.com",
        password: "password123",
      });
      expect(result).toBe(mockSession);
    });

    test("Wirft AuthError bei ungültigen Anmeldedaten", async () => {
      const authError = {message: "Invalid login credentials", status: 400};
      mockAuth.signInWithPassword.mockResolvedValue({
        data: {session: null},
        error: authError,
      });

      await expect(
        authService.signInWithPassword("bad@example.com", "wrong")
      ).rejects.toBe(authError);
    });

    test("Wirft Error wenn keine Session zurückgegeben wird", async () => {
      mockAuth.signInWithPassword.mockResolvedValue({
        data: {session: null},
        error: null,
      });

      await expect(
        authService.signInWithPassword("test@example.com", "password123")
      ).rejects.toThrow("No session returned after sign-in");
    });
  });

  /* ------------------------------------------
  // signUp()
  // ------------------------------------------ */
  describe("signUp()", () => {
    test("Gibt User bei erfolgreicher Registrierung zurück", async () => {
      const mockUser = {id: "new-user-id", email: "new@example.com"};
      mockAuth.signUp.mockResolvedValue({
        data: {user: mockUser},
        error: null,
      });

      const result = await authService.signUp("new@example.com", "password123");

      expect(mockAuth.signUp).toHaveBeenCalledWith({
        email: "new@example.com",
        password: "password123",
        options: {
          emailRedirectTo: `${ORIGIN}/authservicehandler`,
        },
      });
      expect(result).toBe(mockUser);
    });

    test("Übergibt displayName als user_metadata", async () => {
      const mockUser = {id: "new-user-id"};
      mockAuth.signUp.mockResolvedValue({
        data: {user: mockUser},
        error: null,
      });

      await authService.signUp("new@example.com", "password123", {
        displayName: "Max Muster",
      });

      expect(mockAuth.signUp).toHaveBeenCalledWith({
        email: "new@example.com",
        password: "password123",
        options: {
          data: {display_name: "Max Muster"},
          emailRedirectTo: `${ORIGIN}/authservicehandler`,
        },
      });
    });

    test("Wirft AuthError bei bereits existierender E-Mail", async () => {
      const authError = {message: "User already registered", status: 422};
      mockAuth.signUp.mockResolvedValue({
        data: {user: null},
        error: authError,
      });

      await expect(
        authService.signUp("existing@example.com", "password123")
      ).rejects.toBe(authError);
    });

    test("Wirft Error wenn kein User zurückgegeben wird", async () => {
      mockAuth.signUp.mockResolvedValue({
        data: {user: null},
        error: null,
      });

      await expect(
        authService.signUp("test@example.com", "password123")
      ).rejects.toThrow("No user returned after sign-up");
    });
  });

  /* ------------------------------------------
  // resendConfirmationEmail()
  // ------------------------------------------ */
  describe("resendConfirmationEmail()", () => {
    test("Sendet Bestätigungs-E-Mail mit korrekten Parametern", async () => {
      mockAuth.resend.mockResolvedValue({error: null});

      await authService.resendConfirmationEmail("test@example.com");

      expect(mockAuth.resend).toHaveBeenCalledWith({
        type: "signup",
        email: "test@example.com",
        options: {
          emailRedirectTo: `${ORIGIN}/authservicehandler`,
        },
      });
    });

    test("Wirft AuthError bei Fehler", async () => {
      const authError = {message: "Rate limit exceeded", status: 429};
      mockAuth.resend.mockResolvedValue({error: authError});

      await expect(
        authService.resendConfirmationEmail("test@example.com")
      ).rejects.toBe(authError);
    });
  });

  /* ------------------------------------------
  // createConfirmedUser()
  // ------------------------------------------ */
  describe("createConfirmedUser()", () => {
    test("Erstellt bestätigten User via Admin-Client", async () => {
      const mockUser = {id: "admin-created-id", email: "migrated@example.com"};
      mockAdminAuth.createUser.mockResolvedValue({
        data: {user: mockUser},
        error: null,
      });

      const result = await authService.createConfirmedUser(
        "migrated@example.com",
        "password123"
      );

      expect(mockAdminAuth.createUser).toHaveBeenCalledWith({
        email: "migrated@example.com",
        password: "password123",
        email_confirm: true,
        user_metadata: undefined,
      });
      expect(result).toBe(mockUser);
    });

    test("Übergibt displayName als user_metadata", async () => {
      const mockUser = {id: "admin-created-id"};
      mockAdminAuth.createUser.mockResolvedValue({
        data: {user: mockUser},
        error: null,
      });

      await authService.createConfirmedUser(
        "migrated@example.com",
        "password123",
        {displayName: "Migrated User"}
      );

      expect(mockAdminAuth.createUser).toHaveBeenCalledWith({
        email: "migrated@example.com",
        password: "password123",
        email_confirm: true,
        user_metadata: {display_name: "Migrated User"},
      });
    });

    test("Wirft Error wenn Admin-Client nicht verfügbar", async () => {
      mockSupabaseAdmin = null;

      // Neue Instanz erstellen, damit der null-Wert greift
      const service = new AuthService();

      await expect(
        service.createConfirmedUser("test@example.com", "pw")
      ).rejects.toThrow("Admin client not available");
    });

    test("Wirft AuthError bei Fehler", async () => {
      const authError = {message: "User already exists", status: 422};
      mockAdminAuth.createUser.mockResolvedValue({
        data: {user: null},
        error: authError,
      });

      await expect(
        authService.createConfirmedUser("existing@example.com", "pw")
      ).rejects.toBe(authError);
    });
  });

  /* ------------------------------------------
  // signOut()
  // ------------------------------------------ */
  describe("signOut()", () => {
    test("Meldet Benutzer erfolgreich ab", async () => {
      mockAuth.signOut.mockResolvedValue({error: null});

      await authService.signOut();

      expect(mockAuth.signOut).toHaveBeenCalled();
    });

    test("Wirft AuthError bei Fehler", async () => {
      const authError = {message: "Network error", status: 500};
      mockAuth.signOut.mockResolvedValue({error: authError});

      await expect(authService.signOut()).rejects.toBe(authError);
    });
  });

  /* ------------------------------------------
  // resetPassword()
  // ------------------------------------------ */
  describe("resetPassword()", () => {
    test("Sendet Passwort-Zurücksetzen-E-Mail", async () => {
      mockAuth.resetPasswordForEmail.mockResolvedValue({error: null});

      await authService.resetPassword("test@example.com");

      expect(mockAuth.resetPasswordForEmail).toHaveBeenCalledWith(
        "test@example.com",
        {redirectTo: `${ORIGIN}/authservicehandler`}
      );
    });

    test("Wirft AuthError bei Fehler", async () => {
      const authError = {message: "Rate limit exceeded", status: 429};
      mockAuth.resetPasswordForEmail.mockResolvedValue({error: authError});

      await expect(
        authService.resetPassword("test@example.com")
      ).rejects.toBe(authError);
    });
  });

  /* ------------------------------------------
  // updatePassword()
  // ------------------------------------------ */
  describe("updatePassword()", () => {
    test("Aktualisiert Passwort des angemeldeten Benutzers", async () => {
      mockAuth.updateUser.mockResolvedValue({
        data: {user: {id: "u1"}},
        error: null,
      });

      await authService.updatePassword("neuesPasswort123");

      expect(mockAuth.updateUser).toHaveBeenCalledWith({
        password: "neuesPasswort123",
      });
    });

    test("Wirft AuthError bei gleichem Passwort", async () => {
      const authError = {
        message: "New password should be different from the old password.",
        status: 422,
      };
      mockAuth.updateUser.mockResolvedValue({
        data: {user: null},
        error: authError,
      });

      await expect(
        authService.updatePassword("altesPasswort")
      ).rejects.toBe(authError);
    });
  });

  /* ------------------------------------------
  // updateEmail()
  // ------------------------------------------ */
  describe("updateEmail()", () => {
    test("Aktualisiert E-Mail-Adresse mit redirectTo", async () => {
      mockAuth.updateUser.mockResolvedValue({
        data: {user: {id: "u1"}},
        error: null,
      });

      await authService.updateEmail("new@example.com");

      expect(mockAuth.updateUser).toHaveBeenCalledWith(
        {email: "new@example.com"},
        {emailRedirectTo: `${ORIGIN}/authservicehandler`}
      );
    });

    test("Wirft AuthError bei Fehler", async () => {
      const authError = {message: "Email already in use", status: 422};
      mockAuth.updateUser.mockResolvedValue({
        data: {user: null},
        error: authError,
      });

      await expect(
        authService.updateEmail("taken@example.com")
      ).rejects.toBe(authError);
    });
  });

  /* ------------------------------------------
  // onAuthStateChange()
  // ------------------------------------------ */
  describe("onAuthStateChange()", () => {
    test("Registriert Callback und gibt Unsubscribe-Funktion zurück", () => {
      const mockUnsubscribe = jest.fn();
      mockAuth.onAuthStateChange.mockReturnValue({
        data: {subscription: {unsubscribe: mockUnsubscribe}},
      });

      const callback = jest.fn();
      const unsubscribe = authService.onAuthStateChange(callback);

      expect(mockAuth.onAuthStateChange).toHaveBeenCalledWith(callback);
      expect(typeof unsubscribe).toBe("function");

      // Unsubscribe aufrufen
      unsubscribe();
      expect(mockUnsubscribe).toHaveBeenCalled();
    });
  });

  /* ------------------------------------------
  // getUser()
  // ------------------------------------------ */
  describe("getUser()", () => {
    test("Gibt aktuellen User zurück", async () => {
      const mockUser = {id: "current-user", email: "current@example.com"};
      mockAuth.getUser.mockResolvedValue({
        data: {user: mockUser},
      });

      const result = await authService.getUser();

      expect(mockAuth.getUser).toHaveBeenCalled();
      expect(result).toBe(mockUser);
    });

    test("Gibt null zurück wenn nicht angemeldet", async () => {
      mockAuth.getUser.mockResolvedValue({
        data: {user: null},
      });

      const result = await authService.getUser();

      expect(result).toBeNull();
    });
  });

  /* ------------------------------------------
  // getSession()
  // ------------------------------------------ */
  describe("getSession()", () => {
    test("Gibt aktive Session zurück", async () => {
      const mockSession = {access_token: "token-abc", user: {id: "u1"}};
      mockAuth.getSession.mockResolvedValue({
        data: {session: mockSession},
      });

      const result = await authService.getSession();

      expect(mockAuth.getSession).toHaveBeenCalled();
      expect(result).toBe(mockSession);
    });

    test("Gibt null zurück wenn keine Session aktiv", async () => {
      mockAuth.getSession.mockResolvedValue({
        data: {session: null},
      });

      const result = await authService.getSession();

      expect(result).toBeNull();
    });
  });
});
