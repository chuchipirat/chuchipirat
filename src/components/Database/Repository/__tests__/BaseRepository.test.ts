/**
 * Unit-Tests für BaseRepository.
 *
 * Testet alle CRUD-Operationen der abstrakten Basisklasse anhand einer
 * konkreten Test-Implementierung (TestRepository). Der Supabase-Client
 * wird vollständig gemockt.
 */
import {BaseRepository} from "../BaseRepository";
import {
  STORAGE_OBJECT_PROPERTY,
  StorageObjectProperty,
} from "../../../Firebase/Db/sessionStorageHandler.class";
import {createSupabaseMock} from "../__mocks__/supabaseMock";

/* =====================================================================
// Test-Implementierung der abstrakten Klasse
// ===================================================================== */
interface TestDomain {
  uid: string;
  name: string;
  active: boolean;
}

interface TestRow {
  [key: string]: unknown;
  id: string;
  name: string;
  is_active: boolean;
}

class TestRepository extends BaseRepository<TestDomain, TestRow> {
  tableName = "test_table";

  toRow(domain: TestDomain): Partial<TestRow> {
    return {
      id: domain.uid,
      name: domain.name,
      is_active: domain.active,
    };
  }

  toDomain(row: TestRow): TestDomain {
    return {
      uid: row.id,
      name: row.name,
      active: row.is_active,
    };
  }

  getCacheConfig(): StorageObjectProperty {
    return STORAGE_OBJECT_PROPERTY.NONE;
  }
}

/* =====================================================================
// Test-Daten
// ===================================================================== */
const testRow: TestRow = {
  id: "test-id-123",
  name: "Test Item",
  is_active: true,
};

const testDomain: TestDomain = {
  uid: "test-id-123",
  name: "Test Item",
  active: true,
};

const authUser = {uid: "user-123"} as any;

/* =====================================================================
// Tests
// ===================================================================== */
describe("BaseRepository", () => {
  let repo: TestRepository;
  let supabaseMock: ReturnType<typeof createSupabaseMock>;

  beforeEach(() => {
    supabaseMock = createSupabaseMock();
    repo = new TestRepository();
    // Inject mocked client
    (repo as any).client = supabaseMock.client;
  });

  /* ------------------------------------------
  // toRow / toDomain
  // ------------------------------------------ */
  describe("toRow() / toDomain()", () => {
    test("toRow(): Domain-Objekt in DB-Zeile umwandeln", () => {
      const row = repo.toRow(testDomain);
      expect(row.id).toBe("test-id-123");
      expect(row.name).toBe("Test Item");
      expect(row.is_active).toBe(true);
    });

    test("toDomain(): DB-Zeile in Domain-Objekt umwandeln", () => {
      const domain = repo.toDomain(testRow);
      expect(domain.uid).toBe("test-id-123");
      expect(domain.name).toBe("Test Item");
      expect(domain.active).toBe(true);
    });
  });

  /* ------------------------------------------
  // insert()
  // ------------------------------------------ */
  describe("insert()", () => {
    test("Datensatz einfügen und zurückgeben", async () => {
      supabaseMock.queryMock.single.mockResolvedValue({
        data: testRow,
        error: null,
      });

      const result = await repo.insert({value: testDomain, authUser});

      expect(supabaseMock.client.from).toHaveBeenCalledWith("test_table");
      expect(supabaseMock.queryMock.insert).toHaveBeenCalled();
      expect(supabaseMock.queryMock.select).toHaveBeenCalled();
      expect(result.id).toBe("test-id-123");
      expect(result.value.name).toBe("Test Item");
    });

    test("Datensatz mit expliziter ID einfügen", async () => {
      supabaseMock.queryMock.single.mockResolvedValue({
        data: testRow,
        error: null,
      });

      const result = await repo.insert({
        value: testDomain,
        authUser,
        id: "custom-id",
      });

      expect(result.id).toBe("test-id-123");
    });

    test("Fehler bei insert() werfen", async () => {
      supabaseMock.queryMock.single.mockResolvedValue({
        data: null,
        error: {message: "Insert failed", code: "23505"},
      });

      await expect(repo.insert({value: testDomain, authUser})).rejects.toEqual(
        {message: "Insert failed", code: "23505"}
      );
    });
  });

  /* ------------------------------------------
  // findById()
  // ------------------------------------------ */
  describe("findById()", () => {
    test("Datensatz anhand ID finden", async () => {
      supabaseMock.queryMock.single.mockResolvedValue({
        data: testRow,
        error: null,
      });

      const result = await repo.findById("test-id-123");

      expect(supabaseMock.client.from).toHaveBeenCalledWith("test_table");
      expect(supabaseMock.queryMock.select).toHaveBeenCalledWith("*");
      expect(supabaseMock.queryMock.eq).toHaveBeenCalledWith("id", "test-id-123");
      expect(result).not.toBeNull();
      expect(result!.uid).toBe("test-id-123");
      expect(result!.name).toBe("Test Item");
    });

    test("null zurückgeben wenn Datensatz nicht existiert", async () => {
      supabaseMock.queryMock.single.mockResolvedValue({
        data: null,
        error: {code: "PGRST116", message: "No rows found"},
      });

      const result = await repo.findById("nonexistent");
      expect(result).toBeNull();
    });

    test("Fehler werfen bei unbekanntem DB-Fehler", async () => {
      supabaseMock.queryMock.single.mockResolvedValue({
        data: null,
        error: {code: "42P01", message: "Table not found"},
      });

      await expect(repo.findById("test-id")).rejects.toEqual({
        code: "42P01",
        message: "Table not found",
      });
    });
  });

  /* ------------------------------------------
  // findMany()
  // ------------------------------------------ */
  describe("findMany()", () => {
    test("Alle Datensätze ohne Filter laden", async () => {
      // findMany() endet nicht mit single(), sondern direkt auf der Query
      // Wir müssen das Promise-Verhalten auf dem queryMock selbst simulieren
      const mockData = [testRow, {...testRow, id: "id-2", name: "Second"}];
      // Override: limit() gibt das Ergebnis zurück wenn es das letzte in der Kette ist
      supabaseMock.queryMock.limit.mockResolvedValue({
        data: mockData,
        error: null,
      });
      // Auch ohne limit: select() sollte auflösen
      supabaseMock.queryMock.select.mockReturnValue({
        ...supabaseMock.queryMock,
        then: (resolve: any) =>
          resolve({data: mockData, error: null}),
      });

      const result = await repo.findMany();

      expect(supabaseMock.client.from).toHaveBeenCalledWith("test_table");
      expect(result).toHaveLength(2);
      expect(result[0].uid).toBe("test-id-123");
      expect(result[1].uid).toBe("id-2");
    });

    test("Mit Sortierung und Limit laden", async () => {
      const mockData = [testRow];
      supabaseMock.queryMock.limit.mockResolvedValue({
        data: mockData,
        error: null,
      });

      const result = await repo.findMany({
        orderBy: {field: "name", direction: "asc"},
        limit: 10,
      });

      expect(supabaseMock.queryMock.order).toHaveBeenCalledWith("name", {
        ascending: true,
      });
      expect(supabaseMock.queryMock.limit).toHaveBeenCalledWith(10);
      expect(result).toHaveLength(1);
    });

    test("Mit Filter laden", async () => {
      const mockData = [testRow];
      supabaseMock.queryMock.eq.mockReturnValue({
        ...supabaseMock.queryMock,
        then: (resolve: any) =>
          resolve({data: mockData, error: null}),
      });

      const result = await repo.findMany({
        filters: [{field: "is_active", operator: "eq", value: true}],
      });

      expect(supabaseMock.queryMock.eq).toHaveBeenCalledWith("is_active", true);
      expect(result).toHaveLength(1);
    });
  });

  /* ------------------------------------------
  // update()
  // ------------------------------------------ */
  describe("update()", () => {
    test("Datensatz vollständig aktualisieren", async () => {
      supabaseMock.queryMock.single.mockResolvedValue({
        data: testRow,
        error: null,
      });

      const result = await repo.update({
        id: "test-id-123",
        value: testDomain,
        authUser,
      });

      expect(supabaseMock.queryMock.update).toHaveBeenCalled();
      expect(supabaseMock.queryMock.eq).toHaveBeenCalledWith("id", "test-id-123");
      expect(result.uid).toBe("test-id-123");
    });

    test("Fehler bei update() werfen", async () => {
      supabaseMock.queryMock.single.mockResolvedValue({
        data: null,
        error: {message: "Update failed"},
      });

      await expect(
        repo.update({id: "test-id", value: testDomain, authUser})
      ).rejects.toEqual({message: "Update failed"});
    });
  });

  /* ------------------------------------------
  // patch()
  // ------------------------------------------ */
  describe("patch()", () => {
    test("Einzelne Felder aktualisieren", async () => {
      supabaseMock.queryMock.eq.mockResolvedValue({
        data: null,
        error: null,
      });

      await repo.patch({
        id: "test-id-123",
        fields: {name: "Updated Name"},
      });

      expect(supabaseMock.queryMock.update).toHaveBeenCalledWith({
        name: "Updated Name",
      });
      expect(supabaseMock.queryMock.eq).toHaveBeenCalledWith("id", "test-id-123");
    });

    test("Fehler bei patch() werfen", async () => {
      supabaseMock.queryMock.eq.mockResolvedValue({
        data: null,
        error: {message: "Patch failed"},
      });

      await expect(
        repo.patch({id: "test-id", fields: {name: "fail"}})
      ).rejects.toEqual({message: "Patch failed"});
    });
  });

  /* ------------------------------------------
  // upsert()
  // ------------------------------------------ */
  describe("upsert()", () => {
    test("Datensatz einfügen oder überschreiben", async () => {
      supabaseMock.queryMock.single.mockResolvedValue({
        data: testRow,
        error: null,
      });

      const result = await repo.upsert({
        id: "test-id-123",
        value: testDomain,
        authUser,
      });

      expect(supabaseMock.queryMock.upsert).toHaveBeenCalled();
      expect(result.uid).toBe("test-id-123");
    });

    test("Fehler bei upsert() werfen", async () => {
      supabaseMock.queryMock.single.mockResolvedValue({
        data: null,
        error: {message: "Upsert failed"},
      });

      await expect(
        repo.upsert({id: "test-id", value: testDomain, authUser})
      ).rejects.toEqual({message: "Upsert failed"});
    });
  });

  /* ------------------------------------------
  // increment()
  // ------------------------------------------ */
  describe("increment()", () => {
    test("Feld atomar inkrementieren", async () => {
      supabaseMock.client.rpc.mockResolvedValue({data: null, error: null});

      await repo.increment({
        id: "test-id-123",
        field: "counter",
        amount: 1,
      });

      expect(supabaseMock.client.rpc).toHaveBeenCalledWith("increment_field", {
        table_name: "test_table",
        row_id: "test-id-123",
        field_name: "counter",
        amount: 1,
      });
    });

    test("Fehler bei increment() werfen", async () => {
      supabaseMock.client.rpc.mockResolvedValue({
        data: null,
        error: {message: "RPC failed"},
      });

      await expect(
        repo.increment({id: "test-id", field: "counter", amount: 1})
      ).rejects.toEqual({message: "RPC failed"});
    });
  });

  /* ------------------------------------------
  // remove()
  // ------------------------------------------ */
  describe("remove()", () => {
    test("Datensatz löschen", async () => {
      supabaseMock.queryMock.eq.mockResolvedValue({
        data: null,
        error: null,
      });

      await repo.remove("test-id-123");

      expect(supabaseMock.queryMock.delete).toHaveBeenCalled();
      expect(supabaseMock.queryMock.eq).toHaveBeenCalledWith("id", "test-id-123");
    });

    test("Fehler bei remove() werfen", async () => {
      supabaseMock.queryMock.eq.mockResolvedValue({
        data: null,
        error: {message: "Delete failed"},
      });

      await expect(repo.remove("test-id")).rejects.toEqual({
        message: "Delete failed",
      });
    });
  });

  /* ------------------------------------------
  // subscribe()
  // ------------------------------------------ */
  describe("subscribe()", () => {
    test("Unsubscribe-Funktion zurückgeben", () => {
      const onData = jest.fn();
      const onError = jest.fn();

      const unsubscribe = repo.subscribe({
        id: "test-id-123",
        onData,
        onError,
      });

      expect(supabaseMock.client.channel).toHaveBeenCalledWith(
        "test_table:test-id-123"
      );
      expect(typeof unsubscribe).toBe("function");
    });

    test("removeChannel bei Unsubscribe aufrufen", () => {
      const unsubscribe = repo.subscribe({
        id: "test-id",
        onData: jest.fn(),
        onError: jest.fn(),
      });

      unsubscribe();
      expect(supabaseMock.client.removeChannel).toHaveBeenCalled();
    });
  });
});
