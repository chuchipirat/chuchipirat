/**
 * Unit-Tests für SystemMessageRepository.
 *
 * Testet toRow/toDomain-Mapping sowie die Multi-Row-Methoden
 * getMessages(), getValidMessages(), createMessage(), updateMessage() und deleteMessage().
 */
import {
  SystemMessageRepository,
  SystemMessageDomain,
  SystemMessageRow,
} from "../SystemMessageRepository";
import {createSupabaseMock} from "../__mocks__/supabaseMock";
import {AuthUser} from "../../../Firebase/Authentication/authUser.class";
import {
  systemMessageRow,
  systemMessageRow2,
  systemMessageDomain,
} from "../__mocks__/systemMessage.mock";

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
const authUser = {uid: "auth-uuid-123"} as AuthUser;

/* =====================================================================
// Tests
// ===================================================================== */
describe("SystemMessageRepository", () => {
  let repo: SystemMessageRepository;
  let supabaseMock: ReturnType<typeof createSupabaseMock>;

  beforeEach(() => {
    supabaseMock = createSupabaseMock();
    repo = new SystemMessageRepository();
    (repo as any).client = supabaseMock.client;
  });

  /* ------------------------------------------
  // Grundlegende Properties
  // ------------------------------------------ */
  test("tableName ist 'system_messages'", () => {
    expect(repo.tableName).toBe("system_messages");
  });

  test("getCacheConfig() hat excludeFromCaching=true", () => {
    const config = repo.getCacheConfig();
    expect(config.excludeFromCaching).toBe(true);
  });

  /* ------------------------------------------
  // toRow / toDomain
  // ------------------------------------------ */
  describe("toRow() / toDomain()", () => {
    test("toRow(): Domain → DB-Zeile (ohne id)", () => {
      const row = repo.toRow(systemMessageDomain);
      expect(row.title).toBe("Wartung");
      expect(row.text).toBe("<p>Geplante Wartung am Samstag.</p>");
      expect(row.type).toBe("warning");
      expect(row.valid_to).toBe(systemMessageDomain.validTo.toISOString());
      // id darf nicht mitgesendet werden
      expect(row.id).toBeUndefined();
    });

    test("toDomain(): DB-Zeile → Domain (mit uid)", () => {
      const domain = repo.toDomain(systemMessageRow);
      expect(domain.uid).toBe(systemMessageRow.id);
      expect(domain.title).toBe("Wartung");
      expect(domain.text).toBe("<p>Geplante Wartung am Samstag.</p>");
      expect(domain.type).toBe("warning");
      expect(domain.validTo).toEqual(new Date(systemMessageRow.valid_to));
    });

    test("Roundtrip: toRow → toDomain ergibt Ursprungswerte", () => {
      const row = repo.toRow(systemMessageDomain) as SystemMessageRow;
      row.id = systemMessageDomain.uid;
      row.created_at = "2026-01-01T00:00:00Z";
      row.created_by = "";
      row.updated_at = "2026-01-01T00:00:00Z";
      row.updated_by = "";
      const domain = repo.toDomain(row);
      expect(domain.uid).toBe(systemMessageDomain.uid);
      expect(domain.title).toBe(systemMessageDomain.title);
      expect(domain.text).toBe(systemMessageDomain.text);
      expect(domain.type).toBe(systemMessageDomain.type);
      expect(domain.validTo.getTime()).toBe(systemMessageDomain.validTo.getTime());
    });
  });

  /* ------------------------------------------
  // getMessages()
  // ------------------------------------------ */
  describe("getMessages()", () => {
    test("Lädt alle gültigen Meldungen (Standard: includeExpired=false)", async () => {
      const mockData = [systemMessageRow, systemMessageRow2];
      // findMany endet mit order() (kein limit, kein single) — order() muss thenable sein
      supabaseMock.queryMock.order = jest.fn().mockResolvedValue({
        data: mockData,
        error: null,
      });

      const result = await repo.getMessages();

      expect(supabaseMock.client.from).toHaveBeenCalledWith("system_messages");
      expect(supabaseMock.queryMock.gte).toHaveBeenCalledWith(
        "valid_to",
        expect.any(String)
      );
      expect(supabaseMock.queryMock.order).toHaveBeenCalledWith("valid_to", {
        ascending: true,
      });
      expect(result).toHaveLength(2);
      expect(result[0].uid).toBe(systemMessageRow.id);
    });

    test("Lädt alle Meldungen inklusive abgelaufener", async () => {
      const mockData = [systemMessageRow];
      supabaseMock.queryMock.order = jest.fn().mockResolvedValue({
        data: mockData,
        error: null,
      });

      const result = await repo.getMessages(true);

      expect(result).toHaveLength(1);
      // Bei includeExpired=true darf kein gte-Filter gesetzt worden sein
      expect(supabaseMock.queryMock.gte).not.toHaveBeenCalled();
    });
  });

  /* ------------------------------------------
  // getValidMessages()
  // ------------------------------------------ */
  describe("getValidMessages()", () => {
    test("Ruft getMessages(false) auf", async () => {
      const mockData = [systemMessageRow];
      supabaseMock.queryMock.order = jest.fn().mockResolvedValue({
        data: mockData,
        error: null,
      });

      const result = await repo.getValidMessages();

      expect(result).toHaveLength(1);
      expect(supabaseMock.queryMock.gte).toHaveBeenCalledWith(
        "valid_to",
        expect.any(String)
      );
    });
  });

  /* ------------------------------------------
  // createMessage()
  // ------------------------------------------ */
  describe("createMessage()", () => {
    test("Erstellt eine neue Meldung mit normalisiertem validTo", async () => {
      const insertedRow: SystemMessageRow = {
        ...systemMessageRow,
        id: "new-uuid-123",
      };
      supabaseMock.queryMock.single.mockResolvedValue({
        data: insertedRow,
        error: null,
      });

      const messageToCreate: SystemMessageDomain = {
        uid: "",
        title: "Neue Meldung",
        text: "<p>Text</p>",
        type: "info",
        validTo: new Date("2026-06-15T10:30:00Z"),
      };

      const result = await repo.createMessage(messageToCreate, authUser);

      expect(supabaseMock.queryMock.insert).toHaveBeenCalled();
      // validTo muss auf 23:59:59 normalisiert sein
      const insertArg = supabaseMock.queryMock.insert.mock.calls[0][0];
      const validToDate = new Date(insertArg.valid_to);
      expect(validToDate.getHours()).toBe(23);
      expect(validToDate.getMinutes()).toBe(59);
      expect(validToDate.getSeconds()).toBe(59);
      expect(result.id).toBe("new-uuid-123");
    });
  });

  /* ------------------------------------------
  // updateMessage()
  // ------------------------------------------ */
  describe("updateMessage()", () => {
    test("Aktualisiert eine Meldung mit normalisiertem validTo", async () => {
      const updatedRow: SystemMessageRow = {
        ...systemMessageRow,
        title: "Aktualisierter Titel",
      };
      supabaseMock.queryMock.single.mockResolvedValue({
        data: updatedRow,
        error: null,
      });

      const messageToUpdate: SystemMessageDomain = {
        uid: systemMessageRow.id,
        title: "Aktualisierter Titel",
        text: "<p>Text</p>",
        type: "info",
        validTo: new Date("2026-06-15T10:30:00Z"),
      };

      const result = await repo.updateMessage(
        messageToUpdate.uid,
        messageToUpdate,
        authUser
      );

      expect(supabaseMock.queryMock.update).toHaveBeenCalled();
      const updateArg = supabaseMock.queryMock.update.mock.calls[0][0];
      const validToDate = new Date(updateArg.valid_to);
      expect(validToDate.getHours()).toBe(23);
      expect(validToDate.getMinutes()).toBe(59);
      expect(validToDate.getSeconds()).toBe(59);
      expect(result.title).toBe("Aktualisierter Titel");
    });

    test("Fehler bei updateMessage() werfen", async () => {
      supabaseMock.queryMock.single.mockResolvedValue({
        data: null,
        error: {message: "Update failed"},
      });

      await expect(
        repo.updateMessage(systemMessageDomain.uid, systemMessageDomain, authUser)
      ).rejects.toEqual({message: "Update failed"});
    });
  });

  /* ------------------------------------------
  // deleteMessage()
  // ------------------------------------------ */
  describe("deleteMessage()", () => {
    test("Löscht eine Meldung anhand der UID", async () => {
      // delete().eq() gibt kein .single() zurück, daher muss die Kette thenable sein
      supabaseMock.queryMock.eq = jest.fn().mockResolvedValue({
        data: null,
        error: null,
      });

      await repo.deleteMessage("test-uid-123");

      expect(supabaseMock.client.from).toHaveBeenCalledWith("system_messages");
      expect(supabaseMock.queryMock.delete).toHaveBeenCalled();
      expect(supabaseMock.queryMock.eq).toHaveBeenCalledWith("id", "test-uid-123");
    });

    test("Fehler bei deleteMessage() werfen", async () => {
      supabaseMock.queryMock.eq = jest.fn().mockResolvedValue({
        data: null,
        error: {message: "Delete failed"},
      });

      await expect(repo.deleteMessage("test-uid-123")).rejects.toEqual({
        message: "Delete failed",
      });
    });
  });
});
