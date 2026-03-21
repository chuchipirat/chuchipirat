/**
 * Unit-Tests für DepartmentRepository.
 *
 * Testet toRow/toDomain-Mapping sowie die Convenience-Methoden
 * getAllDepartments(), createDepartment() und saveAllDepartments().
 */
import {
  DepartmentRepository,
  DepartmentDomain,
  DepartmentRow,
} from "../DepartmentRepository";
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
const testRow: DepartmentRow = {
  id: "dept-uuid-001",
  firebase_uid: "fb-dept-001",
  name: "Gemüse",
  pos: 1,
  usable: true,
  created_at: "2026-01-01T00:00:00Z",
  created_by: "45e3ab65-7c56-4f0d-8a39-6db543c43dd7",
  updated_at: "2026-01-01T00:00:00Z",
  updated_by: "45e3ab65-7c56-4f0d-8a39-6db543c43dd7",
};

const testRow2: DepartmentRow = {
  id: "dept-uuid-002",
  firebase_uid: "fb-dept-002",
  name: "Früchte",
  pos: 2,
  usable: true,
  created_at: "2026-02-01T00:00:00Z",
  created_by: "45e3ab65-7c56-4f0d-8a39-6db543c43dd7",
  updated_at: "2026-02-01T00:00:00Z",
  updated_by: "45e3ab65-7c56-4f0d-8a39-6db543c43dd7",
};

const testDomain: DepartmentDomain = {
  uid: "dept-uuid-001",
  name: "Gemüse",
  pos: 1,
  usable: true,
};

const authUser = {uid: "auth-uuid-123"} as AuthUser;

/* =====================================================================
// Tests
// ===================================================================== */
describe("DepartmentRepository", () => {
  let repo: DepartmentRepository;
  let supabaseMock: ReturnType<typeof createSupabaseMock>;

  beforeEach(() => {
    supabaseMock = createSupabaseMock();
    repo = new DepartmentRepository();
    (repo as any).client = supabaseMock.client;
  });

  /* ------------------------------------------
  // Grundlegende Properties
  // ------------------------------------------ */
  test("tableName ist 'departments'", () => {
    expect(repo.tableName).toBe("departments");
  });

  test("getCacheConfig() gibt DEPARTMENTS zurück", () => {
    expect(repo.getCacheConfig()).toBe(STORAGE_OBJECT_PROPERTY.DEPARTMENTS);
  });

  /* ------------------------------------------
  // toRow / toDomain
  // ------------------------------------------ */
  describe("toRow() / toDomain()", () => {
    test("toRow(): Domain → DB-Zeile (ohne id)", () => {
      const row = repo.toRow(testDomain);
      expect(row.name).toBe("Gemüse");
      expect(row.pos).toBe(1);
      expect(row.usable).toBe(true);
      // id darf nicht mitgesendet werden
      expect(row.id).toBeUndefined();
    });

    test("toDomain(): DB-Zeile → Domain (mit uid)", () => {
      const domain = repo.toDomain(testRow);
      expect(domain.uid).toBe(testRow.id);
      expect(domain.name).toBe("Gemüse");
      expect(domain.pos).toBe(1);
      expect(domain.usable).toBe(true);
    });

    test("Roundtrip: toRow → toDomain ergibt Ursprungswerte", () => {
      const row = repo.toRow(testDomain) as DepartmentRow;
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
  // getAllDepartments()
  // ------------------------------------------ */
  describe("getAllDepartments()", () => {
    test("Lädt alle Abteilungen sortiert nach Name", async () => {
      const mockData = [testRow, testRow2];
      // findMany endet mit order() — order() muss thenable sein
      supabaseMock.queryMock.order = jest.fn().mockResolvedValue({
        data: mockData,
        error: null,
      });

      const result = await repo.getAllDepartments();

      expect(supabaseMock.client.from).toHaveBeenCalledWith("departments");
      expect(supabaseMock.queryMock.order).toHaveBeenCalledWith("name", {
        ascending: true,
      });
      expect(result).toHaveLength(2);
      expect(result[0].uid).toBe(testRow.id);
      expect(result[0].name).toBe("Gemüse");
    });

    test("Gibt leeres Array zurück wenn keine Abteilungen vorhanden", async () => {
      supabaseMock.queryMock.order = jest.fn().mockResolvedValue({
        data: [],
        error: null,
      });

      const result = await repo.getAllDepartments();
      expect(result).toHaveLength(0);
    });
  });

  /* ------------------------------------------
  // createDepartment()
  // ------------------------------------------ */
  describe("createDepartment()", () => {
    test("Erstellt eine neue Abteilung", async () => {
      const insertedRow: DepartmentRow = {
        ...testRow,
        id: "new-dept-uuid",
      };
      supabaseMock.queryMock.single.mockResolvedValue({
        data: insertedRow,
        error: null,
      });

      const result = await repo.createDepartment("Gemüse", 1, authUser);

      expect(supabaseMock.queryMock.insert).toHaveBeenCalled();
      const insertArg = supabaseMock.queryMock.insert.mock.calls[0][0];
      expect(insertArg.name).toBe("Gemüse");
      expect(insertArg.pos).toBe(1);
      expect(insertArg.usable).toBe(true);
      expect(result.id).toBe("new-dept-uuid");
    });

    test("Fehler bei createDepartment() werfen", async () => {
      supabaseMock.queryMock.single.mockResolvedValue({
        data: null,
        error: {message: "Insert failed"},
      });

      await expect(
        repo.createDepartment("Test", 1, authUser)
      ).rejects.toEqual({message: "Insert failed"});
    });
  });

  /* ------------------------------------------
  // saveAllDepartments()
  // ------------------------------------------ */
  describe("saveAllDepartments()", () => {
    test("Speichert alle Abteilungen per Batch-Upsert", async () => {
      // batchUpsert ruft upsert(rows).select() auf — select muss resolven
      supabaseMock.queryMock.select.mockResolvedValue({
        data: [testRow],
        error: null,
      });

      const departments: DepartmentDomain[] = [testDomain];
      await repo.saveAllDepartments(departments, authUser);

      expect(supabaseMock.queryMock.upsert).toHaveBeenCalledTimes(1);
      const upsertArg = supabaseMock.queryMock.upsert.mock.calls[0][0];
      // batchUpsert sendet ein Array aller Zeilen
      expect(upsertArg).toHaveLength(1);
      expect(upsertArg[0].name).toBe("Gemüse");
      expect(upsertArg[0].id).toBe(testDomain.uid);
    });

    test("Sendet alle Abteilungen in einem einzelnen Batch-Upsert", async () => {
      supabaseMock.queryMock.select.mockResolvedValue({
        data: [testRow, testRow2],
        error: null,
      });

      const departments: DepartmentDomain[] = [
        testDomain,
        {uid: "dept-uuid-002", name: "Früchte", pos: 2, usable: true},
      ];
      await repo.saveAllDepartments(departments, authUser);

      // Nur ein Aufruf mit allen Zeilen
      expect(supabaseMock.queryMock.upsert).toHaveBeenCalledTimes(1);
      const upsertArg = supabaseMock.queryMock.upsert.mock.calls[0][0];
      expect(upsertArg).toHaveLength(2);
    });
  });
});
