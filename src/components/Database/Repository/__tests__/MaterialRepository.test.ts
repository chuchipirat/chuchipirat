/**
 * Unit-Tests für MaterialRepository.
 *
 * Testet toRow/toDomain-Mapping sowie die Convenience-Methoden
 * getAllMaterials() (mit und ohne onlyUsable-Filter) und saveAllMaterials().
 */
import {
  MaterialRepository,
  MaterialDomain,
  MaterialRow,
} from "../MaterialRepository";
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
const testRow: MaterialRow = {
  id: "mat-uuid-001",
  firebase_uid: "fb-mat-001",
  name: "Pfanne",
  type: "usage",
  usable: true,
  created_at: "2026-01-01T00:00:00Z",
  created_by: "45e3ab65-7c56-4f0d-8a39-6db543c43dd7",
  updated_at: "2026-01-01T00:00:00Z",
  updated_by: "45e3ab65-7c56-4f0d-8a39-6db543c43dd7",
  qa_checked: false,
  qa_checked_at: null,
};

const testRow2: MaterialRow = {
  id: "mat-uuid-002",
  firebase_uid: "fb-mat-002",
  name: "Müllsack",
  type: "consumable",
  usable: false,
  created_at: "2026-02-01T00:00:00Z",
  created_by: "45e3ab65-7c56-4f0d-8a39-6db543c43dd7",
  updated_at: "2026-02-01T00:00:00Z",
  updated_by: "45e3ab65-7c56-4f0d-8a39-6db543c43dd7",
  qa_checked: false,
  qa_checked_at: null,
};

const testDomain: MaterialDomain = {
  uid: "mat-uuid-001",
  name: "Pfanne",
  type: 2,
  usable: true,
  qaChecked: false,
  qaCheckedAt: null,
};

const authUser = {uid: "auth-uuid-123"} as AuthUser;

/* =====================================================================
// Tests
// ===================================================================== */
describe("MaterialRepository", () => {
  let repo: MaterialRepository;
  let supabaseMock: ReturnType<typeof createSupabaseMock>;

  beforeEach(() => {
    supabaseMock = createSupabaseMock();
    repo = new MaterialRepository();
    (repo as any).client = supabaseMock.client;
  });

  /* ------------------------------------------
  // Grundlegende Properties
  // ------------------------------------------ */
  test("tableName ist 'materials'", () => {
    expect(repo.tableName).toBe("materials");
  });

  test("getCacheConfig() gibt MATERIALS zurück", () => {
    expect(repo.getCacheConfig()).toBe(STORAGE_OBJECT_PROPERTY.MATERIALS);
  });

  /* ------------------------------------------
  // toRow / toDomain
  // ------------------------------------------ */
  describe("toRow() / toDomain()", () => {
    test("toRow(): Domain → DB-Zeile (ohne id)", () => {
      const row = repo.toRow(testDomain);
      expect(row.name).toBe("Pfanne");
      // toRow() übersetzt den numerischen Typ in den DB-ENUM-String
      expect(row.type).toBe("usage");
      expect(row.usable).toBe(true);
      // id darf nicht mitgesendet werden
      expect(row.id).toBeUndefined();
    });

    test("toDomain(): DB-Zeile → Domain (mit uid)", () => {
      const domain = repo.toDomain(testRow);
      expect(domain.uid).toBe(testRow.id);
      expect(domain.name).toBe("Pfanne");
      expect(domain.type).toBe(2);
      expect(domain.usable).toBe(true);
    });

    test("Roundtrip: toRow → toDomain ergibt Ursprungswerte", () => {
      const row = repo.toRow(testDomain) as MaterialRow;
      row.id = testDomain.uid;
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
  // getAllMaterials()
  // ------------------------------------------ */
  describe("getAllMaterials()", () => {
    test("Lädt alle Materialien ohne Filter (Standard)", async () => {
      const mockData = [testRow, testRow2];
      supabaseMock.queryMock.order = jest.fn().mockResolvedValue({
        data: mockData,
        error: null,
      });

      const result = await repo.getAllMaterials();

      expect(supabaseMock.client.from).toHaveBeenCalledWith("materials");
      expect(supabaseMock.queryMock.order).toHaveBeenCalledWith("name", {
        ascending: true,
      });
      // Ohne onlyUsable darf kein eq-Filter gesetzt werden
      expect(supabaseMock.queryMock.eq).not.toHaveBeenCalled();
      expect(result).toHaveLength(2);
      expect(result[0].uid).toBe(testRow.id);
    });

    test("Lädt nur aktive Materialien wenn onlyUsable=true", async () => {
      const mockData = [testRow];
      supabaseMock.queryMock.order = jest.fn().mockResolvedValue({
        data: mockData,
        error: null,
      });

      const result = await repo.getAllMaterials(true);

      expect(supabaseMock.queryMock.eq).toHaveBeenCalledWith("usable", true);
      expect(result).toHaveLength(1);
      expect(result[0].usable).toBe(true);
    });

    test("Gibt leeres Array zurück wenn keine Materialien vorhanden", async () => {
      supabaseMock.queryMock.order = jest.fn().mockResolvedValue({
        data: [],
        error: null,
      });

      const result = await repo.getAllMaterials();
      expect(result).toHaveLength(0);
    });
  });

  /* ------------------------------------------
  // saveAllMaterials()
  // ------------------------------------------ */
  describe("saveAllMaterials()", () => {
    test("Speichert alle Materialien per Batch-Upsert", async () => {
      // batchUpsert ruft upsert(rows).select() auf — select muss resolven
      supabaseMock.queryMock.select.mockResolvedValue({
        data: [testRow],
        error: null,
      });

      const materials: MaterialDomain[] = [testDomain];
      await repo.saveAllMaterials(materials, authUser);

      expect(supabaseMock.queryMock.upsert).toHaveBeenCalledTimes(1);
      const upsertArg = supabaseMock.queryMock.upsert.mock.calls[0][0];
      // batchUpsert sendet ein Array aller Zeilen
      expect(upsertArg).toHaveLength(1);
      expect(upsertArg[0].name).toBe("Pfanne");
      expect(upsertArg[0].id).toBe(testDomain.uid);
    });

    test("Sendet alle Materialien in einem einzelnen Batch-Upsert", async () => {
      supabaseMock.queryMock.select.mockResolvedValue({
        data: [testRow, testRow2],
        error: null,
      });

      const materials: MaterialDomain[] = [
        testDomain,
        {uid: "mat-uuid-002", name: "Müllsack", type: 1, usable: false, qaChecked: false, qaCheckedAt: null},
      ];
      await repo.saveAllMaterials(materials, authUser);

      // Nur ein Aufruf mit allen Zeilen
      expect(supabaseMock.queryMock.upsert).toHaveBeenCalledTimes(1);
      const upsertArg = supabaseMock.queryMock.upsert.mock.calls[0][0];
      expect(upsertArg).toHaveLength(2);
    });
  });
});
