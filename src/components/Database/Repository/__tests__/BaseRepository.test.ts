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
  SessionStorageHandler,
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

/**
 * Repository mit aktivem Caching für Cache-spezifische Tests.
 */
class CacheableTestRepository extends BaseRepository<TestDomain, TestRow> {
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
    return STORAGE_OBJECT_PROPERTY.EVENT;
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

const authUser = {uid: "auth-uuid-456"} as any;

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

    test("onData wird bei UPDATE-Payload aufgerufen", () => {
      const onData = jest.fn();
      const onError = jest.fn();

      // Callback des .on()-Aufrufs abfangen
      let postgresCallback: (payload: any) => void = () => {};
      const mockOn = jest.fn().mockImplementation((_event, _filter, cb) => {
        postgresCallback = cb;
        return {subscribe: jest.fn()};
      });
      supabaseMock.client.channel.mockReturnValue({
        on: mockOn,
        subscribe: jest.fn(),
      });

      repo.subscribe({id: "test-id-123", onData, onError});

      // Simuliere ein UPDATE-Event
      postgresCallback({eventType: "UPDATE", new: testRow});

      expect(onData).toHaveBeenCalledWith(testDomain);
      expect(onError).not.toHaveBeenCalled();
    });

    test("onError wird bei DELETE-Payload aufgerufen", () => {
      const onData = jest.fn();
      const onError = jest.fn();

      let postgresCallback: (payload: any) => void = () => {};
      const mockOn = jest.fn().mockImplementation((_event, _filter, cb) => {
        postgresCallback = cb;
        return {subscribe: jest.fn()};
      });
      supabaseMock.client.channel.mockReturnValue({
        on: mockOn,
        subscribe: jest.fn(),
      });

      repo.subscribe({id: "test-id-123", onData, onError});

      // Simuliere ein DELETE-Event
      postgresCallback({eventType: "DELETE"});

      expect(onError).toHaveBeenCalledWith(new Error("Record deleted"));
      expect(onData).not.toHaveBeenCalled();
    });

    test("onError wird bei CHANNEL_ERROR aufgerufen", () => {
      const onData = jest.fn();
      const onError = jest.fn();

      let statusCallback: (status: string) => void = () => {};
      const mockSubscribe = jest.fn().mockImplementation((cb) => {
        statusCallback = cb;
        return {};
      });
      supabaseMock.client.channel.mockReturnValue({
        on: jest.fn().mockReturnValue({subscribe: mockSubscribe}),
      });

      repo.subscribe({id: "test-id-123", onData, onError});

      statusCallback("CHANNEL_ERROR");

      expect(onError).toHaveBeenCalledWith(
        new Error("Realtime subscription error for test_table:test-id-123")
      );
    });

    test("onError wird bei Fehler im toDomain-Callback aufgerufen", () => {
      const onData = jest.fn();
      const onError = jest.fn();

      let postgresCallback: (payload: any) => void = () => {};
      const mockOn = jest.fn().mockImplementation((_event, _filter, cb) => {
        postgresCallback = cb;
        return {subscribe: jest.fn()};
      });
      supabaseMock.client.channel.mockReturnValue({
        on: mockOn,
        subscribe: jest.fn(),
      });

      repo.subscribe({id: "test-id-123", onData, onError});

      // Ungültige Daten, die einen Fehler in toDomain verursachen
      postgresCallback({eventType: "UPDATE", new: null});

      expect(onError).toHaveBeenCalled();
      expect(onData).not.toHaveBeenCalled();
    });
  });

  /* ------------------------------------------
  // incrementMany()
  // ------------------------------------------ */
  describe("incrementMany()", () => {
    test("Mehrere Felder sequenziell inkrementieren", async () => {
      supabaseMock.client.rpc.mockResolvedValue({data: null, error: null});

      await repo.incrementMany({
        id: "test-id-123",
        increments: [
          {field: "counter_a", amount: 1},
          {field: "counter_b", amount: -2},
        ],
      });

      expect(supabaseMock.client.rpc).toHaveBeenCalledTimes(2);
      expect(supabaseMock.client.rpc).toHaveBeenCalledWith("increment_field", {
        table_name: "test_table",
        row_id: "test-id-123",
        field_name: "counter_a",
        amount: 1,
      });
      expect(supabaseMock.client.rpc).toHaveBeenCalledWith("increment_field", {
        table_name: "test_table",
        row_id: "test-id-123",
        field_name: "counter_b",
        amount: -2,
      });
    });

    test("Leeres Array verursacht keinen RPC-Aufruf", async () => {
      await repo.incrementMany({id: "test-id", increments: []});

      expect(supabaseMock.client.rpc).not.toHaveBeenCalled();
    });

    test("Fehler beim zweiten Increment bricht ab", async () => {
      supabaseMock.client.rpc
        .mockResolvedValueOnce({data: null, error: null})
        .mockResolvedValueOnce({data: null, error: {message: "RPC failed"}});

      await expect(
        repo.incrementMany({
          id: "test-id",
          increments: [
            {field: "a", amount: 1},
            {field: "b", amount: 1},
          ],
        })
      ).rejects.toEqual({message: "RPC failed"});
    });
  });

  /* ------------------------------------------
  // findMany() — zusätzliche Tests
  // ------------------------------------------ */
  describe("findMany() — erweitert", () => {
    test("Fehler bei findMany() werfen", async () => {
      supabaseMock.queryMock.select.mockReturnValue({
        ...supabaseMock.queryMock,
        then: (resolve: any, reject: any) =>
          reject
            ? resolve({data: null, error: {message: "Query failed"}})
            : resolve({data: null, error: {message: "Query failed"}}),
      });

      // Die Methode prüft error und wirft
      await expect(repo.findMany()).rejects.toEqual({message: "Query failed"});
    });

    test("Mit absteigender Sortierung laden", async () => {
      const mockData = [testRow];
      supabaseMock.queryMock.limit.mockResolvedValue({
        data: mockData,
        error: null,
      });

      await repo.findMany({
        orderBy: {field: "name", direction: "desc"},
        limit: 5,
      });

      expect(supabaseMock.queryMock.order).toHaveBeenCalledWith("name", {
        ascending: false,
      });
    });
  });

  /* ------------------------------------------
  // applyFilter() — alle Operatoren
  // ------------------------------------------ */
  describe("applyFilter() — alle Operatoren", () => {
    // Hilfsfunktion: führt findMany mit einem Filter aus
    const runWithFilter = async (
      operator: string,
      value: unknown,
      expectedMethod: string
    ) => {
      supabaseMock = createSupabaseMock();
      repo = new TestRepository();
      (repo as any).client = supabaseMock.client;

      const mockData = [testRow];
      // Jeder Operator-Mock gibt ein thenable Objekt zurück
      supabaseMock.queryMock[expectedMethod].mockReturnValue({
        ...supabaseMock.queryMock,
        then: (resolve: any) => resolve({data: mockData, error: null}),
      });

      await repo.findMany({
        filters: [{field: "name", operator: operator as any, value}],
      });

      expect(supabaseMock.queryMock[expectedMethod]).toHaveBeenCalledWith(
        "name",
        value
      );
    };

    test("neq-Operator", async () => {
      await runWithFilter("neq", "test", "neq");
    });

    test("gt-Operator", async () => {
      await runWithFilter("gt", 10, "gt");
    });

    test("gte-Operator", async () => {
      await runWithFilter("gte", 10, "gte");
    });

    test("lt-Operator", async () => {
      await runWithFilter("lt", 5, "lt");
    });

    test("lte-Operator", async () => {
      await runWithFilter("lte", 5, "lte");
    });

    test("like-Operator", async () => {
      await runWithFilter("like", "%test%", "like");
    });

    test("ilike-Operator", async () => {
      await runWithFilter("ilike", "%TEST%", "ilike");
    });

    test("in-Operator", async () => {
      const values = ["a", "b", "c"];
      supabaseMock.queryMock.in.mockReturnValue({
        ...supabaseMock.queryMock,
        then: (resolve: any) => resolve({data: [testRow], error: null}),
      });

      await repo.findMany({
        filters: [{field: "name", operator: "in", value: values}],
      });

      expect(supabaseMock.queryMock.in).toHaveBeenCalledWith("name", values);
    });
  });

  /* ------------------------------------------
  // findById() — zusätzliche Tests
  // ------------------------------------------ */
  describe("findById() — erweitert", () => {
    test("ignoreCache=true überspringt den Cache", async () => {
      supabaseMock.queryMock.single.mockResolvedValue({
        data: testRow,
        error: null,
      });

      const result = await repo.findById("test-id-123", true);

      // Sollte trotzdem die DB abfragen
      expect(supabaseMock.client.from).toHaveBeenCalledWith("test_table");
      expect(result).not.toBeNull();
      expect(result!.uid).toBe("test-id-123");
    });
  });

  /* ------------------------------------------
  // Cache-Verhalten mit aktivem Caching
  // ------------------------------------------ */
  describe("Cache-Verhalten (excludeFromCaching=false)", () => {
    let cacheRepo: CacheableTestRepository;

    beforeEach(() => {
      cacheRepo = new CacheableTestRepository();
      (cacheRepo as any).client = supabaseMock.client;
    });

    test("findById schreibt Ergebnis in den Cache", async () => {
      const spy = jest.spyOn(SessionStorageHandler, "upsertDocument");
      supabaseMock.queryMock.single.mockResolvedValue({
        data: testRow,
        error: null,
      });

      await cacheRepo.findById("test-id-123");

      expect(spy).toHaveBeenCalledWith(
        expect.objectContaining({
          documentUid: "test-id-123",
          value: testDomain,
        })
      );
      spy.mockRestore();
    });

    test("findById liest aus dem Cache wenn vorhanden", async () => {
      const getSpy = jest
        .spyOn(SessionStorageHandler, "getDocument")
        .mockReturnValue(testDomain as any);

      const result = await cacheRepo.findById("test-id-123");

      // Kein DB-Aufruf, da Cache-Hit
      expect(supabaseMock.client.from).not.toHaveBeenCalled();
      expect(result).toEqual(testDomain);

      getSpy.mockRestore();
    });

    test("findById mit ignoreCache=true überspringt Cache-Lookup", async () => {
      const getSpy = jest
        .spyOn(SessionStorageHandler, "getDocument")
        .mockReturnValue(testDomain as any);
      supabaseMock.queryMock.single.mockResolvedValue({
        data: testRow,
        error: null,
      });

      await cacheRepo.findById("test-id-123", true);

      // Cache-Lookup wird nicht aufgerufen
      expect(getSpy).not.toHaveBeenCalled();
      // DB wird abgefragt
      expect(supabaseMock.client.from).toHaveBeenCalled();

      getSpy.mockRestore();
    });

    test("insert schreibt Ergebnis in den Cache", async () => {
      const spy = jest.spyOn(SessionStorageHandler, "upsertDocument");
      supabaseMock.queryMock.single.mockResolvedValue({
        data: testRow,
        error: null,
      });

      await cacheRepo.insert({value: testDomain, authUser});

      expect(spy).toHaveBeenCalledWith(
        expect.objectContaining({
          documentUid: "test-id-123",
          value: testDomain,
        })
      );
      spy.mockRestore();
    });

    test("update schreibt Ergebnis in den Cache", async () => {
      const spy = jest.spyOn(SessionStorageHandler, "upsertDocument");
      supabaseMock.queryMock.single.mockResolvedValue({
        data: testRow,
        error: null,
      });

      await cacheRepo.update({id: "test-id-123", value: testDomain, authUser});

      expect(spy).toHaveBeenCalledWith(
        expect.objectContaining({
          documentUid: "test-id-123",
          value: testDomain,
        })
      );
      spy.mockRestore();
    });

    test("patch aktualisiert Cache-Felder", async () => {
      const spy = jest.spyOn(SessionStorageHandler, "updateDocumentField");
      supabaseMock.queryMock.eq.mockResolvedValue({data: null, error: null});

      await cacheRepo.patch({
        id: "test-id-123",
        fields: {name: "New Name"},
      });

      expect(spy).toHaveBeenCalledWith(
        expect.objectContaining({
          documentUid: "test-id-123",
          value: {name: "New Name"},
        })
      );
      spy.mockRestore();
    });

    test("upsert schreibt Ergebnis in den Cache", async () => {
      const spy = jest.spyOn(SessionStorageHandler, "upsertDocument");
      supabaseMock.queryMock.single.mockResolvedValue({
        data: testRow,
        error: null,
      });

      await cacheRepo.upsert({id: "test-id-123", value: testDomain, authUser});

      expect(spy).toHaveBeenCalledWith(
        expect.objectContaining({
          documentUid: "test-id-123",
          value: testDomain,
        })
      );
      spy.mockRestore();
    });

    test("remove löscht Eintrag aus dem Cache", async () => {
      const spy = jest.spyOn(SessionStorageHandler, "deleteDocument");
      supabaseMock.queryMock.eq.mockResolvedValue({data: null, error: null});

      await cacheRepo.remove("test-id-123");

      expect(spy).toHaveBeenCalledWith(
        expect.objectContaining({
          documentUid: "test-id-123",
        })
      );
      spy.mockRestore();
    });
  });
});
