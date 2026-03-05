/**
 * Unit-Tests für UnitConversionBasicRepository.
 *
 * Testet toRow/toDomain-Mapping (fromUnit/toUnit ↔ from_unit/to_unit) sowie
 * die Convenience-Methoden getAllConversions(), saveAllConversions()
 * (mit Löschung entfernter Einträge) und deleteConversion().
 */
import {
  UnitConversionBasicRepository,
  UnitConversionBasicDomain,
  UnitConversionBasicRow,
} from "../UnitConversionBasicRepository";
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
const testRow: UnitConversionBasicRow = {
  id: "conv-uuid-001",
  firebase_uid: "fb-conv-001",
  from_unit: "kg",
  to_unit: "g",
  numerator: 1000,
  denominator: 1,
  created_at: "2026-01-01T00:00:00Z",
  created_by: "45e3ab65-7c56-4f0d-8a39-6db543c43dd7",
  updated_at: "2026-01-01T00:00:00Z",
  updated_by: "45e3ab65-7c56-4f0d-8a39-6db543c43dd7",
};

const testRow2: UnitConversionBasicRow = {
  id: "conv-uuid-002",
  firebase_uid: "fb-conv-002",
  from_unit: "l",
  to_unit: "dl",
  numerator: 10,
  denominator: 1,
  created_at: "2026-02-01T00:00:00Z",
  created_by: "45e3ab65-7c56-4f0d-8a39-6db543c43dd7",
  updated_at: "2026-02-01T00:00:00Z",
  updated_by: "45e3ab65-7c56-4f0d-8a39-6db543c43dd7",
};

const testDomain: UnitConversionBasicDomain = {
  uid: "conv-uuid-001",
  fromUnit: "kg",
  toUnit: "g",
  numerator: 1000,
  denominator: 1,
};

const authUser = {uid: "user-123", authUid: "auth-uuid-123"} as AuthUser;

/* =====================================================================
// Tests
// ===================================================================== */
describe("UnitConversionBasicRepository", () => {
  let repo: UnitConversionBasicRepository;
  let supabaseMock: ReturnType<typeof createSupabaseMock>;

  beforeEach(() => {
    supabaseMock = createSupabaseMock();
    repo = new UnitConversionBasicRepository();
    (repo as any).client = supabaseMock.client;
  });

  /* ------------------------------------------
  // Grundlegende Properties
  // ------------------------------------------ */
  test("tableName ist 'unit_conversion_basic'", () => {
    expect(repo.tableName).toBe("unit_conversion_basic");
  });

  test("getCacheConfig() gibt UNIT_CONVERSION zurück", () => {
    expect(repo.getCacheConfig()).toBe(STORAGE_OBJECT_PROPERTY.UNIT_CONVERSION);
  });

  /* ------------------------------------------
  // toRow / toDomain
  // ------------------------------------------ */
  describe("toRow() / toDomain()", () => {
    test("toRow(): Domain → DB-Zeile — mappt fromUnit/toUnit auf from_unit/to_unit", () => {
      const row = repo.toRow(testDomain);
      expect(row.from_unit).toBe("kg");
      expect(row.to_unit).toBe("g");
      expect(row.numerator).toBe(1000);
      expect(row.denominator).toBe(1);
      // id darf nicht mitgesendet werden
      expect(row.id).toBeUndefined();
    });

    test("toDomain(): DB-Zeile → Domain — mappt from_unit/to_unit auf fromUnit/toUnit", () => {
      const domain = repo.toDomain(testRow);
      expect(domain.uid).toBe(testRow.id);
      expect(domain.fromUnit).toBe("kg");
      expect(domain.toUnit).toBe("g");
      expect(domain.numerator).toBe(1000);
      expect(domain.denominator).toBe(1);
    });

    test("Roundtrip: toRow → toDomain ergibt Ursprungswerte", () => {
      const row = repo.toRow(testDomain) as UnitConversionBasicRow;
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
  // getAllConversions()
  // ------------------------------------------ */
  describe("getAllConversions()", () => {
    test("Lädt alle Umrechnungen sortiert nach from_unit", async () => {
      const mockData = [testRow, testRow2];
      supabaseMock.queryMock.order = jest.fn().mockResolvedValue({
        data: mockData,
        error: null,
      });

      const result = await repo.getAllConversions();

      expect(supabaseMock.client.from).toHaveBeenCalledWith(
        "unit_conversion_basic"
      );
      expect(supabaseMock.queryMock.order).toHaveBeenCalledWith("from_unit", {
        ascending: true,
      });
      expect(result).toHaveLength(2);
      expect(result[0].fromUnit).toBe("kg");
      expect(result[1].fromUnit).toBe("l");
    });

    test("Gibt leeres Array zurück wenn keine Umrechnungen vorhanden", async () => {
      supabaseMock.queryMock.order = jest.fn().mockResolvedValue({
        data: [],
        error: null,
      });

      const result = await repo.getAllConversions();
      expect(result).toHaveLength(0);
    });
  });

  /* ------------------------------------------
  // saveAllConversions()
  // ------------------------------------------ */
  describe("saveAllConversions()", () => {
    test("Löscht entfernte Einträge und upserted neue", async () => {
      // getAllConversions() wird intern aufgerufen — liefert bestehende Einträge
      supabaseMock.queryMock.order = jest.fn().mockResolvedValue({
        data: [testRow, testRow2],
        error: null,
      });

      // delete().eq() für das Löschen des entfernten Eintrags
      supabaseMock.queryMock.eq = jest.fn().mockReturnValue(supabaseMock.queryMock);
      // Für eq-Aufrufe die thenable sind (delete-Kette)
      (supabaseMock.queryMock as any).then = undefined;

      // upsert().select().single() für den verbleibenden Eintrag
      supabaseMock.queryMock.single.mockResolvedValue({
        data: testRow,
        error: null,
      });

      // Nur testDomain übergeben — testRow2 (conv-uuid-002) soll gelöscht werden
      await repo.saveAllConversions([testDomain], authUser);

      // Delete wurde für den entfernten Eintrag aufgerufen
      expect(supabaseMock.queryMock.delete).toHaveBeenCalled();
      // Upsert wurde für den verbleibenden Eintrag aufgerufen
      expect(supabaseMock.queryMock.upsert).toHaveBeenCalled();
    });

    test("Upserted alle Einträge", async () => {
      // getAllConversions() liefert leeres Array — keine Einträge zum Löschen
      supabaseMock.queryMock.order = jest.fn().mockResolvedValue({
        data: [],
        error: null,
      });

      supabaseMock.queryMock.single.mockResolvedValue({
        data: testRow,
        error: null,
      });

      const conversions: UnitConversionBasicDomain[] = [
        testDomain,
        {uid: "conv-uuid-002", fromUnit: "l", toUnit: "dl", numerator: 10, denominator: 1},
      ];
      await repo.saveAllConversions(conversions, authUser);

      // Kein Delete, da keine bestehenden Einträge
      expect(supabaseMock.queryMock.delete).not.toHaveBeenCalled();
      // Zwei Upserts
      expect(supabaseMock.queryMock.upsert).toHaveBeenCalledTimes(2);
    });
  });

  /* ------------------------------------------
  // deleteConversion()
  // ------------------------------------------ */
  describe("deleteConversion()", () => {
    test("Löscht eine Umrechnung anhand der UID", async () => {
      supabaseMock.queryMock.eq = jest.fn().mockResolvedValue({
        data: null,
        error: null,
      });

      await repo.deleteConversion("conv-uuid-001");

      expect(supabaseMock.client.from).toHaveBeenCalledWith(
        "unit_conversion_basic"
      );
      expect(supabaseMock.queryMock.delete).toHaveBeenCalled();
      expect(supabaseMock.queryMock.eq).toHaveBeenCalledWith(
        "id",
        "conv-uuid-001"
      );
    });

    test("Fehler bei deleteConversion() werfen", async () => {
      supabaseMock.queryMock.eq = jest.fn().mockResolvedValue({
        data: null,
        error: {message: "Delete failed"},
      });

      await expect(repo.deleteConversion("conv-uuid-001")).rejects.toEqual({
        message: "Delete failed",
      });
    });
  });
});
