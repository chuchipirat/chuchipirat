/**
 * Unit-Tests für DatabaseService.
 *
 * Testet die zentrale Service-Klasse, die alle Repository-Instanzen bündelt:
 * Konstruktion, Property-Initialisierung und bedingtes Admin-Client-Verhalten.
 */

/* ===================================================================
// ======================== Mock-Setup ================================
// =================================================================== */

/** Dummy-Klassen, um die echten Importe abzufangen */
const MockAuthService = jest.fn();
const MockUserRepository = jest.fn();
const MockGlobalSettingsRepository = jest.fn();
const MockSystemMessageRepository = jest.fn();
const MockUserStorageRepository = jest.fn();

jest.mock("../AuthService", () => ({
  AuthService: MockAuthService,
}));
jest.mock("../Repository/UserRepository", () => ({
  UserRepository: MockUserRepository,
}));
jest.mock("../Repository/GlobalSettingsRepository", () => ({
  GlobalSettingsRepository: MockGlobalSettingsRepository,
}));
jest.mock("../Repository/SystemMessageRepository", () => ({
  SystemMessageRepository: MockSystemMessageRepository,
}));
jest.mock("../Repository/UserStorageRepository", () => ({
  UserStorageRepository: MockUserStorageRepository,
}));

/** Wert für supabaseAdmin, der pro Test geändert werden kann */
let mockSupabaseAdmin: object | null = null;

jest.mock("../supabaseClient", () => ({
  get supabaseAdmin() {
    return mockSupabaseAdmin;
  },
}));

import {DatabaseService} from "../DatabaseService";

/* ===================================================================
// ======================== Tests =====================================
// =================================================================== */

beforeEach(() => {
  jest.clearAllMocks();
  mockSupabaseAdmin = null;
});

describe("DatabaseService", () => {
  describe("Konstruktor — Repositories initialisieren", () => {
    test("AuthService wird instanziiert", () => {
      const service = new DatabaseService();

      expect(MockAuthService).toHaveBeenCalledTimes(1);
      expect(service.auth).toBeDefined();
    });

    test("UserRepository wird instanziiert", () => {
      const service = new DatabaseService();

      expect(MockUserRepository).toHaveBeenCalledTimes(1);
      expect(service.users).toBeDefined();
    });

    test("GlobalSettingsRepository wird instanziiert", () => {
      const service = new DatabaseService();

      expect(MockGlobalSettingsRepository).toHaveBeenCalledTimes(1);
      expect(service.globalSettings).toBeDefined();
    });

    test("SystemMessageRepository wird instanziiert", () => {
      const service = new DatabaseService();

      expect(MockSystemMessageRepository).toHaveBeenCalledTimes(1);
      expect(service.systemMessages).toBeDefined();
    });

    test("UserStorageRepository wird für storage.users instanziiert", () => {
      const service = new DatabaseService();

      // Einmal für regulären Client
      expect(MockUserStorageRepository).toHaveBeenCalled();
      expect(service.storage).toBeDefined();
      expect(service.storage.users).toBeDefined();
    });
  });

  describe("Admin-Client — ohne Service Role Key", () => {
    test("admin ist null wenn supabaseAdmin nicht verfügbar ist", () => {
      mockSupabaseAdmin = null;

      const service = new DatabaseService();

      expect(service.admin).toBeNull();
    });

    test("Nur reguläre Repositories werden erstellt (kein doppelter Aufruf)", () => {
      mockSupabaseAdmin = null;

      new DatabaseService();

      // Jedes Repository wird genau 1× instanziiert (nur regulär, kein Admin)
      expect(MockUserRepository).toHaveBeenCalledTimes(1);
      expect(MockGlobalSettingsRepository).toHaveBeenCalledTimes(1);
      expect(MockSystemMessageRepository).toHaveBeenCalledTimes(1);
      expect(MockUserStorageRepository).toHaveBeenCalledTimes(1);
    });
  });

  describe("Admin-Client — mit Service Role Key", () => {
    const fakeAdminClient = {id: "admin-client"};

    beforeEach(() => {
      mockSupabaseAdmin = fakeAdminClient;
    });

    test("admin ist gesetzt wenn supabaseAdmin verfügbar ist", () => {
      const service = new DatabaseService();

      expect(service.admin).not.toBeNull();
    });

    test("Admin-Repositories werden mit Admin-Client erstellt", () => {
      const service = new DatabaseService();

      // Jedes Repository wird 2× instanziiert: regulär + Admin
      expect(MockUserRepository).toHaveBeenCalledTimes(2);
      expect(MockGlobalSettingsRepository).toHaveBeenCalledTimes(2);
      expect(MockSystemMessageRepository).toHaveBeenCalledTimes(2);
      expect(MockUserStorageRepository).toHaveBeenCalledTimes(2);

      // Admin-Aufrufe erhalten den Admin-Client
      expect(MockUserRepository).toHaveBeenCalledWith(fakeAdminClient);
      expect(MockGlobalSettingsRepository).toHaveBeenCalledWith(fakeAdminClient);
      expect(MockSystemMessageRepository).toHaveBeenCalledWith(fakeAdminClient);
      expect(MockUserStorageRepository).toHaveBeenCalledWith(fakeAdminClient);
    });

    test("admin enthält alle erwarteten Repositories", () => {
      const service = new DatabaseService();

      expect(service.admin!.users).toBeDefined();
      expect(service.admin!.globalSettings).toBeDefined();
      expect(service.admin!.systemMessages).toBeDefined();
      expect(service.admin!.storage).toBeDefined();
      expect(service.admin!.storage.users).toBeDefined();
    });
  });
});
