/**
 * Unit-Tests für ItemCreationLogRepository.ts.
 *
 * Schwerpunkt: Das Protokoll wird eingefügt, OHNE die Zeile zurückzulesen.
 * Nur Admins dürfen die Tabelle lesen; ein `insert().select()` würde für
 * alle anderen an der RLS scheitern.
 */
import {ItemCreationLogRepository} from "../ItemCreationLogRepository";
import {
  CreationDecision,
  CreationItemType,
  CreationLogEntry,
  CreationOrigin,
  LEGACY_RULES_VERSION,
  ItemCreationLogRow,
} from "../../../Product/CreationLog/creationLog.types";
import {NameHintKind} from "../../../Product/Matching/nameHint.types";
import {STORAGE_OBJECT_PROPERTY} from "../../../Shared/sessionStorageHandler.class";
import {createSupabaseMock} from "../__mocks__/supabaseMock";

// SessionStorageHandler mocken, damit Caching die Tests nicht beeinflusst
jest.mock("../../../Shared/sessionStorageHandler.class", () => {
  const actual = jest.requireActual(
    "../../../Shared/sessionStorageHandler.class",
  );
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
const createdEntry: CreationLogEntry = {
  itemType: CreationItemType.PRODUCT,
  origin: CreationOrigin.RECIPE,
  enteredName: "Tomatem",
  finalName: "Tomaten, gehackt",
  decision: CreationDecision.CREATED,
  hints: [
    {
      kind: NameHintKind.SIMILAR_PRODUCT,
      rule: null,
      score: null,
      word: null,
      suggestions: [{id: "product-1", name: "Tomaten", source: "product"}],
    },
  ],
  rulesVersion: LEGACY_RULES_VERSION,
  resultProductId: "product-2",
  resultMaterialId: null,
  resultName: "Tomaten, gehackt",
};

const cancelledMaterialEntry: CreationLogEntry = {
  itemType: CreationItemType.MATERIAL,
  origin: CreationOrigin.MATERIAL_LIST,
  enteredName: "Alufolie",
  finalName: null,
  decision: CreationDecision.CANCELLED,
  hints: [],
  rulesVersion: LEGACY_RULES_VERSION,
  resultProductId: null,
  resultMaterialId: null,
  resultName: null,
};

const storedRow: ItemCreationLogRow = {
  id: "log-1",
  item_type: CreationItemType.PRODUCT,
  origin: CreationOrigin.RECIPE,
  entered_name: "Tomatem",
  final_name: "Tomaten, gehackt",
  decision: CreationDecision.CREATED,
  hints: createdEntry.hints,
  rules_version: 0,
  result_product_id: "product-2",
  result_material_id: null,
  result_name: "Tomaten, gehackt",
  created_at: "2026-11-07T10:00:00Z",
  created_by: "user-1",
};

/* =====================================================================
// Tests
// ===================================================================== */
describe("ItemCreationLogRepository", () => {
  let repo: ItemCreationLogRepository;
  let supabaseMock: ReturnType<typeof createSupabaseMock>;

  beforeEach(() => {
    supabaseMock = createSupabaseMock();
    repo = new ItemCreationLogRepository();
    (repo as any).client = supabaseMock.client;
  });

  /* ------------------------------------------
  // Grundlegende Properties
  // ------------------------------------------ */
  test("tableName ist 'item_creation_logs'", () => {
    expect(repo.tableName).toBe("item_creation_logs");
  });

  test("Protokollzeilen werden nie gecacht", () => {
    expect(repo.getCacheConfig()).toBe(STORAGE_OBJECT_PROPERTY.NONE);
  });

  /* ------------------------------------------
  // toRow / toDomain
  // ------------------------------------------ */
  describe("toRow()", () => {
    test("mappt jedes Feld auf die snake_case-Spalte", () => {
      expect(repo.toRow(createdEntry)).toEqual({
        item_type: "product",
        origin: "recipe",
        entered_name: "Tomatem",
        final_name: "Tomaten, gehackt",
        decision: "created",
        hints: createdEntry.hints,
        rules_version: 0,
        result_product_id: "product-2",
        result_material_id: null,
        result_name: "Tomaten, gehackt",
      });
    });

    test("schickt null-Werte explizit mit statt sie wegzulassen", () => {
      const row = repo.toRow(cancelledMaterialEntry);
      expect(row.final_name).toBeNull();
      expect(row.result_product_id).toBeNull();
      expect(row.result_material_id).toBeNull();
      expect(row.result_name).toBeNull();
      expect(row.hints).toEqual([]);
    });

    test("setzt weder id noch Audit-Spalten (macht die Datenbank)", () => {
      const row = repo.toRow(createdEntry);
      expect("id" in row).toBe(false);
      expect("created_at" in row).toBe(false);
      expect("created_by" in row).toBe(false);
    });
  });

  describe("toDomain()", () => {
    test("liefert den Eintrag ohne id und Audit-Spalten", () => {
      expect(repo.toDomain(storedRow)).toEqual(createdEntry);
    });
  });

  /* ------------------------------------------
  // logCreation()
  // ------------------------------------------ */
  describe("logCreation()", () => {
    test("fügt genau eine Zeile in item_creation_logs ein", async () => {
      supabaseMock.queryMock.insert = jest
        .fn()
        .mockResolvedValue({data: null, error: null});

      await repo.logCreation(createdEntry);

      expect(supabaseMock.client.from).toHaveBeenCalledWith(
        "item_creation_logs",
      );
      expect(supabaseMock.queryMock.insert).toHaveBeenCalledTimes(1);
      expect(supabaseMock.queryMock.insert).toHaveBeenCalledWith(
        repo.toRow(createdEntry),
      );
    });

    test("liest die eingefügte Zeile nicht zurück (RLS: lesen nur Admins)", async () => {
      supabaseMock.queryMock.insert = jest
        .fn()
        .mockResolvedValue({data: null, error: null});

      await repo.logCreation(createdEntry);

      expect(supabaseMock.queryMock.select).not.toHaveBeenCalled();
      expect(supabaseMock.queryMock.single).not.toHaveBeenCalled();
    });

    test("gibt nichts zurück", async () => {
      supabaseMock.queryMock.insert = jest
        .fn()
        .mockResolvedValue({data: null, error: null});

      await expect(repo.logCreation(createdEntry)).resolves.toBeUndefined();
    });

    test("wirft den Fehler der Datenbank weiter", async () => {
      const databaseError = {code: "23514", message: "violates check constraint"};
      supabaseMock.queryMock.insert = jest
        .fn()
        .mockResolvedValue({data: null, error: databaseError});

      await expect(repo.logCreation(createdEntry)).rejects.toEqual(
        databaseError,
      );
    });
  });
});
