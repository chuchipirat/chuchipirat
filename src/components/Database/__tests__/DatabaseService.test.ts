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
const MockDepartmentRepository = jest.fn();
const MockUnitRepository = jest.fn();
const MockMaterialRepository = jest.fn();
const MockProductRepository = jest.fn();
const MockUnitConversionBasicRepository = jest.fn();
const MockUnitConversionProductRepository = jest.fn();
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
jest.mock("../Repository/DepartmentRepository", () => ({
  DepartmentRepository: MockDepartmentRepository,
}));
jest.mock("../Repository/UnitRepository", () => ({
  UnitRepository: MockUnitRepository,
}));
jest.mock("../Repository/MaterialRepository", () => ({
  MaterialRepository: MockMaterialRepository,
}));
jest.mock("../Repository/ProductRepository", () => ({
  ProductRepository: MockProductRepository,
}));
jest.mock("../Repository/UnitConversionBasicRepository", () => ({
  UnitConversionBasicRepository: MockUnitConversionBasicRepository,
}));
jest.mock("../Repository/UnitConversionProductRepository", () => ({
  UnitConversionProductRepository: MockUnitConversionProductRepository,
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

    test("DepartmentRepository wird instanziiert", () => {
      const service = new DatabaseService();

      expect(MockDepartmentRepository).toHaveBeenCalledTimes(1);
      expect(service.departments).toBeDefined();
    });

    test("UnitRepository wird instanziiert", () => {
      const service = new DatabaseService();

      expect(MockUnitRepository).toHaveBeenCalledTimes(1);
      expect(service.units).toBeDefined();
    });

    test("MaterialRepository wird instanziiert", () => {
      const service = new DatabaseService();

      expect(MockMaterialRepository).toHaveBeenCalledTimes(1);
      expect(service.materials).toBeDefined();
    });

    test("ProductRepository wird instanziiert", () => {
      const service = new DatabaseService();

      expect(MockProductRepository).toHaveBeenCalledTimes(1);
      expect(service.products).toBeDefined();
    });

    test("UnitConversionBasicRepository wird instanziiert", () => {
      const service = new DatabaseService();

      expect(MockUnitConversionBasicRepository).toHaveBeenCalledTimes(1);
      expect(service.unitConversionBasic).toBeDefined();
    });

    test("UnitConversionProductRepository wird instanziiert", () => {
      const service = new DatabaseService();

      expect(MockUnitConversionProductRepository).toHaveBeenCalledTimes(1);
      expect(service.unitConversionProducts).toBeDefined();
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

      // Jedes Repository wird genau 1x instanziiert (nur regulär, kein Admin)
      expect(MockUserRepository).toHaveBeenCalledTimes(1);
      expect(MockGlobalSettingsRepository).toHaveBeenCalledTimes(1);
      expect(MockSystemMessageRepository).toHaveBeenCalledTimes(1);
      expect(MockDepartmentRepository).toHaveBeenCalledTimes(1);
      expect(MockUnitRepository).toHaveBeenCalledTimes(1);
      expect(MockMaterialRepository).toHaveBeenCalledTimes(1);
      expect(MockProductRepository).toHaveBeenCalledTimes(1);
      expect(MockUnitConversionBasicRepository).toHaveBeenCalledTimes(1);
      expect(MockUnitConversionProductRepository).toHaveBeenCalledTimes(1);
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
      const _service = new DatabaseService();

      // Jedes Repository wird 2x instanziiert: regulär + Admin
      expect(MockUserRepository).toHaveBeenCalledTimes(2);
      expect(MockGlobalSettingsRepository).toHaveBeenCalledTimes(2);
      expect(MockSystemMessageRepository).toHaveBeenCalledTimes(2);
      expect(MockDepartmentRepository).toHaveBeenCalledTimes(2);
      expect(MockUnitRepository).toHaveBeenCalledTimes(2);
      expect(MockMaterialRepository).toHaveBeenCalledTimes(2);
      expect(MockProductRepository).toHaveBeenCalledTimes(2);
      expect(MockUnitConversionBasicRepository).toHaveBeenCalledTimes(2);
      expect(MockUnitConversionProductRepository).toHaveBeenCalledTimes(2);
      expect(MockUserStorageRepository).toHaveBeenCalledTimes(2);

      // Admin-Aufrufe erhalten den Admin-Client
      expect(MockUserRepository).toHaveBeenCalledWith(fakeAdminClient);
      expect(MockGlobalSettingsRepository).toHaveBeenCalledWith(fakeAdminClient);
      expect(MockSystemMessageRepository).toHaveBeenCalledWith(fakeAdminClient);
      expect(MockDepartmentRepository).toHaveBeenCalledWith(fakeAdminClient);
      expect(MockUnitRepository).toHaveBeenCalledWith(fakeAdminClient);
      expect(MockMaterialRepository).toHaveBeenCalledWith(fakeAdminClient);
      expect(MockProductRepository).toHaveBeenCalledWith(fakeAdminClient);
      expect(MockUnitConversionBasicRepository).toHaveBeenCalledWith(fakeAdminClient);
      expect(MockUnitConversionProductRepository).toHaveBeenCalledWith(fakeAdminClient);
      expect(MockUserStorageRepository).toHaveBeenCalledWith(fakeAdminClient);
    });

    test("admin enthält alle erwarteten Repositories", () => {
      const service = new DatabaseService();

      expect(service.admin!.users).toBeDefined();
      expect(service.admin!.globalSettings).toBeDefined();
      expect(service.admin!.systemMessages).toBeDefined();
      expect(service.admin!.departments).toBeDefined();
      expect(service.admin!.units).toBeDefined();
      expect(service.admin!.materials).toBeDefined();
      expect(service.admin!.products).toBeDefined();
      expect(service.admin!.unitConversionBasic).toBeDefined();
      expect(service.admin!.unitConversionProducts).toBeDefined();
      expect(service.admin!.storage).toBeDefined();
      expect(service.admin!.storage.users).toBeDefined();
    });
  });
});
