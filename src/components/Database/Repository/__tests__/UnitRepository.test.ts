/**
 * Unit-Tests für UnitRepository.
 *
 * Testet toRow/toDomain-Mapping sowie die Convenience-Methoden
 * getAllUnits(), createUnit() und saveAllUnits().
 */
import {
  UnitRepository,
  UnitDomain,
  UnitRow,
} from "../UnitRepository";
import {STORAGE_OBJECT_PROPERTY} from "../../../Firebase/Db/sessionStorageHandler.class";
import {createSupabaseMock} from "../__mocks__/supabaseMock";
import {AuthUser} from "../../../Firebase/Authentication/authUser.class";

// SessionStorageHandler mocken, damit Caching die Tests nicht beeinflusst
jest.mock("../../../Firebase/Db/sessionStorageHandler.class", () => {
  const actual = jest.requireActual("../../../Firebase/Db/sessionStorageHandler.class");
  return {
    ...actual,
    SessionStorageHandler: {
      getDocument: jest.fn().mockReturnValue(null),
      upsertDocument: jest.fn(),
      deleteDocument: jest.fn(),
      updateDocumentField: jest.fn(),
      incrementFieldValue: jest.fn(),
    },
  };
});

/* =====================================================================
// Test-Daten
// ===================================================================== */
const testRow: UnitRow = {
  key: "kg",
  firebase_uid: "fb-unit-001",
  name: "Kilogramm",
  dimension: "MAS",
  created_at: "2026-01-01T00:00:00Z",
  created_by: "45e3ab65-7c56-4f0d-8a39-6db543c43dd7",
  updated_at: "2026-01-01T00:00:00Z",
  updated_by: "45e3ab65-7c56-4f0d-8a39-6db543c43dd7",
};

const testRow2: UnitRow = {
  key: "l",
  firebase_uid: "fb-unit-002",
  name: "Liter",
  dimension: "VOL",
  created_at: "2026-02-01T00:00:00Z",
  created_by: "45e3ab65-7c56-4f0d-8a39-6db543c43dd7",
  updated_at: "2026-02-01T00:00:00Z",
  updated_by: "45e3ab65-7c56-4f0d-8a39-6db543c43dd7",
};

const testDomain: UnitDomain = {
  key: "kg",
  name: "Kilogramm",
  dimension: "MAS",
};

const authUser = {uid: "auth-uuid-123"} as AuthUser;

/* =====================================================================
// Tests
// ===================================================================== */
describe("UnitRepository", () => {
  let repo: UnitRepository;
  let supabaseMock: ReturnType<typeof createSupabaseMock>;

  beforeEach(() => {
    supabaseMock = createSupabaseMock();
    repo = new UnitRepository();
    (repo as any).client = supabaseMock.client;
  });

  /* ------------------------------------------
  // Grundlegende Properties
  // ------------------------------------------ */
  test("tableName ist 'units'", () => {
    expect(repo.tableName).toBe("units");
  });

  test("primaryKeyColumn ist 'key'", () => {
    expect((repo as any).primaryKeyColumn).toBe("key");
  });

  test("getCacheConfig() gibt UNITS zurück", () => {
    expect(repo.getCacheConfig()).toBe(STORAGE_OBJECT_PROPERTY.UNITS);
  });

  /* ------------------------------------------
  // toRow / toDomain
  // ------------------------------------------ */
  describe("toRow() / toDomain()", () => {
    test("toRow(): Domain → DB-Zeile", () => {
      const row = repo.toRow(testDomain);
      expect(row.key).toBe("kg");
      expect(row.name).toBe("Kilogramm");
      expect(row.dimension).toBe("MAS");
    });

    test("toDomain(): DB-Zeile → Domain", () => {
      const domain = repo.toDomain(testRow);
      expect(domain.key).toBe("kg");
      expect(domain.name).toBe("Kilogramm");
      expect(domain.dimension).toBe("MAS");
    });

    test("Roundtrip: toRow → toDomain ergibt Ursprungswerte", () => {
      const row = repo.toRow(testDomain) as UnitRow;
      row.firebase_uid = null;
      row.created_at = "2026-01-01T00:00:00Z";
      row.created_by = "";
      row.updated_at = "2026-01-01T00:00:00Z";
      row.updated_by = "";
      const domain = repo.toDomain(row);
      expect(domain).toEqual(testDomain);
    });
  });

  /* ------------------------------------------
  // getAllUnits()
  // ------------------------------------------ */
  describe("getAllUnits()", () => {
    test("Lädt alle Einheiten sortiert nach Name", async () => {
      const mockData = [testRow, testRow2];
      supabaseMock.queryMock.order = jest.fn().mockResolvedValue({
        data: mockData,
        error: null,
      });

      const result = await repo.getAllUnits();

      expect(supabaseMock.client.from).toHaveBeenCalledWith("units");
      expect(supabaseMock.queryMock.order).toHaveBeenCalledWith("name", {
        ascending: true,
      });
      expect(result).toHaveLength(2);
      expect(result[0].key).toBe("kg");
    });

    test("Gibt leeres Array zurück wenn keine Einheiten vorhanden", async () => {
      supabaseMock.queryMock.order = jest.fn().mockResolvedValue({
        data: [],
        error: null,
      });

      const result = await repo.getAllUnits();
      expect(result).toHaveLength(0);
    });
  });

  /* ------------------------------------------
  // createUnit()
  // ------------------------------------------ */
  describe("createUnit()", () => {
    test("Erstellt eine neue Einheit", async () => {
      supabaseMock.queryMock.single.mockResolvedValue({
        data: testRow,
        error: null,
      });

      const unitToCreate: UnitDomain = {
        key: "kg",
        name: "Kilogramm",
        dimension: "MAS",
      };

      const result = await repo.createUnit(unitToCreate, authUser);

      expect(supabaseMock.queryMock.insert).toHaveBeenCalled();
      const insertArg = supabaseMock.queryMock.insert.mock.calls[0][0];
      expect(insertArg.key).toBe("kg");
      expect(insertArg.name).toBe("Kilogramm");
      expect(insertArg.dimension).toBe("MAS");
      // id entspricht dem key (natürlicher PK)
      expect(result.id).toBe("kg");
    });

    test("Fehler bei createUnit() werfen", async () => {
      supabaseMock.queryMock.single.mockResolvedValue({
        data: null,
        error: {message: "Insert failed"},
      });

      const unitToCreate: UnitDomain = {
        key: "x",
        name: "Test",
        dimension: "DLS",
      };

      await expect(
        repo.createUnit(unitToCreate, authUser)
      ).rejects.toEqual({message: "Insert failed"});
    });
  });

  /* ------------------------------------------
  // saveAllUnits()
  // ------------------------------------------ */
  describe("saveAllUnits()", () => {
    test("Speichert alle Einheiten per Upsert", async () => {
      supabaseMock.queryMock.single.mockResolvedValue({
        data: testRow,
        error: null,
      });

      const units: UnitDomain[] = [testDomain];
      await repo.saveAllUnits(units, authUser);

      expect(supabaseMock.queryMock.upsert).toHaveBeenCalledTimes(1);
      const upsertArg = supabaseMock.queryMock.upsert.mock.calls[0][0];
      expect(upsertArg.key).toBe("kg");
    });

    test("Ruft upsert für jede Einheit einzeln auf", async () => {
      supabaseMock.queryMock.single.mockResolvedValue({
        data: testRow,
        error: null,
      });

      const units: UnitDomain[] = [
        testDomain,
        {key: "l", name: "Liter", dimension: "VOL"},
      ];
      await repo.saveAllUnits(units, authUser);

      expect(supabaseMock.queryMock.upsert).toHaveBeenCalledTimes(2);
    });
  });
});
