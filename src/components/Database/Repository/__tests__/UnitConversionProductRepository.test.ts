/**
 * Unit-Tests für UnitConversionProductRepository.
 *
 * Testet toRow/toDomain-Mapping (mit products-JOIN für den Produktnamen) sowie
 * die Convenience-Methoden getAllConversions() (Custom-Query mit JOIN),
 * saveAllConversions() (mit Löschung entfernter Einträge) und deleteConversion().
 */
import {
  UnitConversionProductRepository,
  UnitConversionProductDomain,
  UnitConversionProductRow,
} from "../UnitConversionProductRepository";
import {STORAGE_OBJECT_PROPERTY} from "../../../Firebase/Db/sessionStorageHandler.class";
import {createSupabaseMock, createQueryMock} from "../__mocks__/supabaseMock";
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
const testRow: UnitConversionProductRow = {
  id: "pconv-uuid-001",
  firebase_uid: "fb-pconv-001",
  from_unit: "Stk",
  to_unit: "g",
  numerator: 150,
  denominator: 1,
  product_id: "prod-uuid-001",
  created_at: "2026-01-01T00:00:00Z",
  created_by: "45e3ab65-7c56-4f0d-8a39-6db543c43dd7",
  updated_at: "2026-01-01T00:00:00Z",
  updated_by: "45e3ab65-7c56-4f0d-8a39-6db543c43dd7",
};

/** Zeile mit products-JOIN-Daten */
const testRowWithProduct = {
  ...testRow,
  products: {name: "Tomate"},
};

const testRow2: UnitConversionProductRow = {
  id: "pconv-uuid-002",
  firebase_uid: "fb-pconv-002",
  from_unit: "Stk",
  to_unit: "ml",
  numerator: 200,
  denominator: 1,
  product_id: "prod-uuid-002",
  created_at: "2026-02-01T00:00:00Z",
  created_by: "45e3ab65-7c56-4f0d-8a39-6db543c43dd7",
  updated_at: "2026-02-01T00:00:00Z",
  updated_by: "45e3ab65-7c56-4f0d-8a39-6db543c43dd7",
};

const testRowWithProduct2 = {
  ...testRow2,
  products: {name: "Milch"},
};

const testDomain: UnitConversionProductDomain = {
  uid: "pconv-uuid-001",
  fromUnit: "Stk",
  toUnit: "g",
  numerator: 150,
  denominator: 1,
  productUid: "prod-uuid-001",
  productName: "Tomate",
};

const authUser = {uid: "user-123", authUid: "auth-uuid-123"} as AuthUser;

/* =====================================================================
// Tests
// ===================================================================== */
describe("UnitConversionProductRepository", () => {
  let repo: UnitConversionProductRepository;
  let supabaseMock: ReturnType<typeof createSupabaseMock>;

  beforeEach(() => {
    supabaseMock = createSupabaseMock();
    repo = new UnitConversionProductRepository();
    (repo as any).client = supabaseMock.client;
  });

  /* ------------------------------------------
  // Grundlegende Properties
  // ------------------------------------------ */
  test("tableName ist 'unit_conversion_products'", () => {
    expect(repo.tableName).toBe("unit_conversion_products");
  });

  test("getCacheConfig() gibt UNIT_CONVERSION zurück", () => {
    expect(repo.getCacheConfig()).toBe(STORAGE_OBJECT_PROPERTY.UNIT_CONVERSION);
  });

  /* ------------------------------------------
  // toRow / toDomain
  // ------------------------------------------ */
  describe("toRow() / toDomain()", () => {
    test("toRow(): Domain → DB-Zeile — mappt productUid auf product_id", () => {
      const row = repo.toRow(testDomain);
      expect(row.from_unit).toBe("Stk");
      expect(row.to_unit).toBe("g");
      expect(row.numerator).toBe(150);
      expect(row.denominator).toBe(1);
      expect(row.product_id).toBe("prod-uuid-001");
      // id darf nicht mitgesendet werden
      expect(row.id).toBeUndefined();
    });

    test("toDomain(): DB-Zeile ohne JOIN → Domain mit leerem productName", () => {
      const domain = repo.toDomain(testRow);
      expect(domain.uid).toBe(testRow.id);
      expect(domain.fromUnit).toBe("Stk");
      expect(domain.toUnit).toBe("g");
      expect(domain.numerator).toBe(150);
      expect(domain.denominator).toBe(1);
      expect(domain.productUid).toBe("prod-uuid-001");
      // Ohne JOIN ist productName leer
      expect(domain.productName).toBe("");
    });

    test("toDomain(): DB-Zeile mit products-JOIN → Domain mit productName", () => {
      const domain = repo.toDomain(testRowWithProduct as UnitConversionProductRow);
      expect(domain.productUid).toBe("prod-uuid-001");
      expect(domain.productName).toBe("Tomate");
    });

    test("Roundtrip: toRow → toDomain ergibt Ursprungswerte (mit JOIN-Daten)", () => {
      const row = repo.toRow(testDomain) as UnitConversionProductRow;
      row.id = testDomain.uid;
      row.firebase_uid = null;
      row.created_at = "2026-01-01T00:00:00Z";
      row.created_by = "";
      row.updated_at = "2026-01-01T00:00:00Z";
      row.updated_by = "";
      // JOIN-Daten simulieren, damit der Roundtrip den productName enthält
      (row as any).products = {name: "Tomate"};
      const domain = repo.toDomain(row);
      expect(domain).toEqual(testDomain);
    });
  });

  /* ------------------------------------------
  // getAllConversions()
  // ------------------------------------------ */
  describe("getAllConversions()", () => {
    test("Verwendet Custom-Query mit products-JOIN", async () => {
      const mockData = [testRowWithProduct, testRowWithProduct2];
      supabaseMock.queryMock.order = jest.fn().mockResolvedValue({
        data: mockData,
        error: null,
      });

      const result = await repo.getAllConversions();

      expect(supabaseMock.client.from).toHaveBeenCalledWith(
        "unit_conversion_products"
      );
      // Muss den SELECT mit products-JOIN verwenden
      expect(supabaseMock.queryMock.select).toHaveBeenCalledWith(
        "*, products(name)"
      );
      expect(supabaseMock.queryMock.order).toHaveBeenCalledWith("from_unit", {
        ascending: true,
      });
      expect(result).toHaveLength(2);
      expect(result[0].productName).toBe("Tomate");
      expect(result[1].productName).toBe("Milch");
    });

    test("Gibt leeres Array zurück wenn keine Umrechnungen vorhanden", async () => {
      supabaseMock.queryMock.order = jest.fn().mockResolvedValue({
        data: [],
        error: null,
      });

      const result = await repo.getAllConversions();
      expect(result).toHaveLength(0);
    });

    test("Fehler bei getAllConversions() werfen", async () => {
      supabaseMock.queryMock.order = jest.fn().mockResolvedValue({
        data: null,
        error: {message: "Query failed"},
      });

      await expect(repo.getAllConversions()).rejects.toEqual({
        message: "Query failed",
      });
    });
  });

  /* ------------------------------------------
  // saveAllConversions()
  // ------------------------------------------ */
  describe("saveAllConversions()", () => {
    test("Löscht entfernte Einträge per batchRemove und upserted neue per batchUpsert", async () => {
      // saveAllConversions ruft from() 3× auf:
      // 1. getAllConversions — select().order()
      // 2. batchRemove — delete().in()
      // 3. batchUpsert — upsert().select()
      const loadMock = createQueryMock();
      loadMock.order = jest.fn().mockResolvedValue({
        data: [testRowWithProduct, testRowWithProduct2],
        error: null,
      });

      const deleteMock = createQueryMock();
      deleteMock.in = jest.fn().mockResolvedValue({error: null});

      const upsertMock = createQueryMock();
      upsertMock.select = jest.fn().mockResolvedValue({
        data: [testRowWithProduct],
        error: null,
      });

      supabaseMock.client.from
        .mockReturnValueOnce(loadMock)    // 1. getAllConversions
        .mockReturnValueOnce(deleteMock)  // 2. batchRemove
        .mockReturnValueOnce(upsertMock); // 3. batchUpsert

      // Nur testDomain übergeben — testRow2 (pconv-uuid-002) soll gelöscht werden
      await repo.saveAllConversions([testDomain], authUser);

      // batchRemove: delete().in() für den entfernten Eintrag
      expect(deleteMock.delete).toHaveBeenCalled();
      expect(deleteMock.in).toHaveBeenCalledWith(
        "id",
        ["pconv-uuid-002"],
      );
      // batchUpsert: upsert(rows).select() für den verbleibenden Eintrag
      expect(upsertMock.upsert).toHaveBeenCalledTimes(1);
    });

    test("Upserted alle Einträge in einem Batch ohne Löschung", async () => {
      // saveAllConversions ruft from() 2× auf:
      // 1. getAllConversions — select().order()
      // 2. batchUpsert — upsert().select()
      const loadMock = createQueryMock();
      loadMock.order = jest.fn().mockResolvedValue({data: [], error: null});

      const upsertMock = createQueryMock();
      upsertMock.select = jest.fn().mockResolvedValue({
        data: [testRowWithProduct, testRowWithProduct2],
        error: null,
      });

      supabaseMock.client.from
        .mockReturnValueOnce(loadMock)    // 1. getAllConversions
        .mockReturnValueOnce(upsertMock); // 2. batchUpsert

      const conversions: UnitConversionProductDomain[] = [
        testDomain,
        {
          uid: "pconv-uuid-002",
          fromUnit: "Stk",
          toUnit: "ml",
          numerator: 200,
          denominator: 1,
          productUid: "prod-uuid-002",
          productName: "Milch",
        },
      ];
      await repo.saveAllConversions(conversions, authUser);

      // Kein Delete (batchRemove mit leerem Array aufgerufen)
      // Ein Batch-Upsert mit allen Einträgen
      expect(upsertMock.upsert).toHaveBeenCalledTimes(1);
      const upsertArg = upsertMock.upsert.mock.calls[0][0];
      expect(upsertArg).toHaveLength(2);
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

      await repo.deleteConversion("pconv-uuid-001");

      expect(supabaseMock.client.from).toHaveBeenCalledWith(
        "unit_conversion_products"
      );
      expect(supabaseMock.queryMock.delete).toHaveBeenCalled();
      expect(supabaseMock.queryMock.eq).toHaveBeenCalledWith(
        "id",
        "pconv-uuid-001"
      );
    });

    test("Fehler bei deleteConversion() werfen", async () => {
      supabaseMock.queryMock.eq = jest.fn().mockResolvedValue({
        data: null,
        error: {message: "Delete failed"},
      });

      await expect(repo.deleteConversion("pconv-uuid-001")).rejects.toEqual({
        message: "Delete failed",
      });
    });
  });
});
