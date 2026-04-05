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

jest.mock("../supabaseClient", () => ({}));

import {DatabaseService} from "../DatabaseService";

/* ===================================================================
// ======================== Tests =====================================
// =================================================================== */

beforeEach(() => {
  jest.clearAllMocks();
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

});
