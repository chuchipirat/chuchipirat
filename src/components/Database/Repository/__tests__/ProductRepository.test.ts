/**
 * Unit-Tests für ProductRepository.
 *
 * Testet toRow/toDomain-Mapping (mit Flattening/Assembling von department
 * und dietProperties) sowie die Convenience-Methoden getAllProducts()
 * (mit Custom-Query und departments-JOIN) und saveAllProducts().
 */
import {
  ProductRepository,
  ProductDomain,
  ProductRow,
} from "../ProductRepository";
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
const testRow: ProductRow = {
  id: "prod-uuid-001",
  firebase_uid: "fb-prod-001",
  name: "Tomaten",
  name_singular: "Tomate",
  department_id: "dept-uuid-001",
  shopping_unit: "kg",
  allergens: [],
  diet: "vegan",
  usable: true,
  qa_checked: false,
  qa_checked_at: null,
  created_at: "2026-01-01T00:00:00Z",
  created_by: "45e3ab65-7c56-4f0d-8a39-6db543c43dd7",
  updated_at: "2026-01-01T00:00:00Z",
  updated_by: "45e3ab65-7c56-4f0d-8a39-6db543c43dd7",
};

/** Zeile mit departments-JOIN-Daten */
const testRowWithDept = {
  ...testRow,
  departments: {name: "Gemüse"},
};

const testRow2: ProductRow = {
  id: "prod-uuid-002",
  firebase_uid: "fb-prod-002",
  name: "Milch",
  name_singular: "Milch",
  department_id: "dept-uuid-002",
  shopping_unit: "l",
  allergens: ["lactose"],
  diet: "vegetarian",
  usable: false,
  qa_checked: false,
  qa_checked_at: null,
  created_at: "2026-02-01T00:00:00Z",
  created_by: "45e3ab65-7c56-4f0d-8a39-6db543c43dd7",
  updated_at: "2026-02-01T00:00:00Z",
  updated_by: "45e3ab65-7c56-4f0d-8a39-6db543c43dd7",
};

const testDomain: ProductDomain = {
  uid: "prod-uuid-001",
  name: "Tomaten",
  nameSingular: "Tomate",
  department: {uid: "dept-uuid-001", name: "Gemüse"},
  shoppingUnit: "kg",
  dietProperties: {allergens: [], diet: 3},
  usable: true,
  qaChecked: false,
  qaCheckedAt: null,
};

const authUser = {uid: "auth-uuid-123"} as AuthUser;

/* =====================================================================
// Tests
// ===================================================================== */
describe("ProductRepository", () => {
  let repo: ProductRepository;
  let supabaseMock: ReturnType<typeof createSupabaseMock>;

  beforeEach(() => {
    supabaseMock = createSupabaseMock();
    repo = new ProductRepository();
    (repo as any).client = supabaseMock.client;
  });

  /* ------------------------------------------
  // Grundlegende Properties
  // ------------------------------------------ */
  test("tableName ist 'products'", () => {
    expect(repo.tableName).toBe("products");
  });

  test("getCacheConfig() gibt PRODUCTS zurück", () => {
    expect(repo.getCacheConfig()).toBe(STORAGE_OBJECT_PROPERTY.PRODUCTS);
  });

  /* ------------------------------------------
  // toRow / toDomain
  // ------------------------------------------ */
  describe("toRow() / toDomain()", () => {
    test("toRow(): Domain → DB-Zeile — flacht department und dietProperties ab", () => {
      const row = repo.toRow(testDomain);
      expect(row.name).toBe("Tomaten");
      expect(row.name_singular).toBe("Tomate");
      expect(row.department_id).toBe("dept-uuid-001");
      expect(row.shopping_unit).toBe("kg");
      expect(row.allergens).toEqual([]);
      // toRow() übersetzt den numerischen Diet-Wert in den DB-ENUM-String
      expect(row.diet).toBe("vegan");
      expect(row.usable).toBe(true);
      // id darf nicht mitgesendet werden
      expect(row.id).toBeUndefined();
    });

    test("toRow(): Leere department.uid ergibt null", () => {
      const domain: ProductDomain = {
        ...testDomain,
        department: {uid: "", name: ""},
      };
      const row = repo.toRow(domain);
      expect(row.department_id).toBeNull();
    });

    test("toRow(): Leere shoppingUnit ergibt null", () => {
      const domain: ProductDomain = {
        ...testDomain,
        shoppingUnit: "",
      };
      const row = repo.toRow(domain);
      expect(row.shopping_unit).toBeNull();
    });

    test("toDomain(): DB-Zeile ohne JOIN → Domain mit leerem department.name", () => {
      const domain = repo.toDomain(testRow);
      expect(domain.uid).toBe(testRow.id);
      expect(domain.name).toBe("Tomaten");
      expect(domain.nameSingular).toBe("Tomate");
      expect(domain.department.uid).toBe("dept-uuid-001");
      // Ohne JOIN ist der department.name leer
      expect(domain.department.name).toBe("");
      expect(domain.shoppingUnit).toBe("kg");
      expect(domain.dietProperties.allergens).toEqual([]);
      expect(domain.dietProperties.diet).toBe(3);
      expect(domain.usable).toBe(true);
    });

    test("toDomain(): DB-Zeile mit departments-JOIN → Domain mit department.name", () => {
      const domain = repo.toDomain(testRowWithDept as ProductRow);
      expect(domain.department.uid).toBe("dept-uuid-001");
      expect(domain.department.name).toBe("Gemüse");
    });

    test("Roundtrip: toRow → toDomain ergibt Ursprungswerte (mit JOIN-Daten)", () => {
      const row = repo.toRow(testDomain) as ProductRow;
      row.id = testDomain.uid;
      row.firebase_uid = null;
      row.created_at = "2026-01-01T00:00:00Z";
      row.created_by = "";
      row.updated_at = "2026-01-01T00:00:00Z";
      row.updated_by = "";
      // JOIN-Daten simulieren, damit der Roundtrip den department.name enthält
      (row as any).departments = {name: "Gemüse"};
      const domain = repo.toDomain(row);
      expect(domain).toEqual(testDomain);
    });
  });

  /* ------------------------------------------
  // getAllProducts()
  // ------------------------------------------ */
  describe("getAllProducts()", () => {
    test("Lädt alle Produkte ohne Filter und ohne JOIN", async () => {
      const mockData = [testRow, testRow2];
      supabaseMock.queryMock.order = jest.fn().mockResolvedValue({
        data: mockData,
        error: null,
      });

      const result = await repo.getAllProducts();

      expect(supabaseMock.client.from).toHaveBeenCalledWith("products");
      // Ohne withDepartmentName nur "*" im Select
      expect(supabaseMock.queryMock.select).toHaveBeenCalledWith("*");
      expect(supabaseMock.queryMock.order).toHaveBeenCalledWith("name", {
        ascending: true,
      });
      // Ohne onlyUsable kein eq-Filter
      expect(supabaseMock.queryMock.eq).not.toHaveBeenCalled();
      expect(result).toHaveLength(2);
    });

    test("Verwendet departments-JOIN wenn withDepartmentName=true", async () => {
      const mockData = [testRowWithDept];
      supabaseMock.queryMock.order = jest.fn().mockResolvedValue({
        data: mockData,
        error: null,
      });

      const result = await repo.getAllProducts({withDepartmentName: true});

      expect(supabaseMock.queryMock.select).toHaveBeenCalledWith(
        "*, departments(name)"
      );
      expect(result[0].department.name).toBe("Gemüse");
    });

    test("Filtert auf usable=true wenn onlyUsable=true", async () => {
      const mockData = [testRow];
      supabaseMock.queryMock.order = jest.fn().mockResolvedValue({
        data: mockData,
        error: null,
      });

      const result = await repo.getAllProducts({onlyUsable: true});

      expect(supabaseMock.queryMock.eq).toHaveBeenCalledWith("usable", true);
      expect(result).toHaveLength(1);
    });

    test("Kombiniert onlyUsable und withDepartmentName", async () => {
      const mockData = [testRowWithDept];
      supabaseMock.queryMock.order = jest.fn().mockResolvedValue({
        data: mockData,
        error: null,
      });

      await repo.getAllProducts({
        onlyUsable: true,
        withDepartmentName: true,
      });

      expect(supabaseMock.queryMock.select).toHaveBeenCalledWith(
        "*, departments(name)"
      );
      expect(supabaseMock.queryMock.eq).toHaveBeenCalledWith("usable", true);
    });

    test("Fehler bei getAllProducts() werfen", async () => {
      supabaseMock.queryMock.order = jest.fn().mockResolvedValue({
        data: null,
        error: {message: "Query failed"},
      });

      await expect(repo.getAllProducts()).rejects.toEqual({
        message: "Query failed",
      });
    });
  });

  /* ------------------------------------------
  // insertProduct()
  // ------------------------------------------ */
  describe("insertProduct()", () => {
    test("Fügt ein neues Produkt ein und gibt das Domain-Objekt zurück", async () => {
      supabaseMock.queryMock.single.mockResolvedValue({
        data: testRow,
        error: null,
      });

      const result = await repo.insertProduct(
        {
          name: "Tomaten",
          nameSingular: "Tomate",
          department: {uid: "dept-uuid-001", name: "Gemüse"},
          shoppingUnit: "kg",
          dietProperties: {allergens: [], diet: 3},
          usable: true,
          qaChecked: false,
          qaCheckedAt: null,
        },
        authUser,
      );

      expect(supabaseMock.queryMock.insert).toHaveBeenCalledTimes(1);
      expect(result.uid).toBe(testRow.id);
      expect(result.name).toBe("Tomaten");
    });

    test("Fehler bei insertProduct() werfen", async () => {
      supabaseMock.queryMock.single.mockResolvedValue({
        data: null,
        error: {message: "Insert failed"},
      });

      await expect(
        repo.insertProduct(
          {
            name: "Tomaten",
            nameSingular: "Tomate",
            department: {uid: "dept-uuid-001", name: "Gemüse"},
            shoppingUnit: "kg",
            dietProperties: {allergens: [], diet: 3},
            usable: true,
            qaChecked: false,
            qaCheckedAt: null,
          },
          authUser,
        ),
      ).rejects.toEqual({message: "Insert failed"});
    });
  });

  /* ------------------------------------------
  // getRecentProductUids()
  // ------------------------------------------ */
  describe("getRecentProductUids()", () => {
    test("Gibt UIDs der neuesten Produkte zurück", async () => {
      supabaseMock.queryMock.gte = jest.fn().mockResolvedValue({
        data: [{id: "prod-uuid-001"}, {id: "prod-uuid-002"}],
        error: null,
      });

      const result = await repo.getRecentProductUids(10);

      expect(supabaseMock.queryMock.select).toHaveBeenCalledWith("id");
      expect(supabaseMock.queryMock.gte).toHaveBeenCalledWith(
        "created_at",
        expect.any(String),
      );
      expect(result).toEqual(["prod-uuid-001", "prod-uuid-002"]);
    });

    test("Gibt leeres Array zurück wenn keine neuesten Produkte", async () => {
      supabaseMock.queryMock.gte = jest.fn().mockResolvedValue({
        data: [],
        error: null,
      });

      const result = await repo.getRecentProductUids(10);

      expect(result).toEqual([]);
    });

    test("Fehler bei getRecentProductUids() werfen", async () => {
      supabaseMock.queryMock.gte = jest.fn().mockResolvedValue({
        data: null,
        error: {message: "Query failed"},
      });

      await expect(repo.getRecentProductUids(10)).rejects.toEqual({
        message: "Query failed",
      });
    });
  });

  /* ------------------------------------------
  // updateProduct()
  // ------------------------------------------ */
  describe("updateProduct()", () => {
    test("Aktualisiert ein einzelnes Produkt per update()", async () => {
      supabaseMock.queryMock.single.mockResolvedValue({
        data: testRow,
        error: null,
      });

      const result = await repo.updateProduct(testDomain, authUser);

      expect(supabaseMock.queryMock.eq).toHaveBeenCalledWith(
        "id",
        testDomain.uid,
      );
      expect(result.uid).toBe(testDomain.uid);
      expect(result.name).toBe("Tomaten");
    });
  });

  /* ------------------------------------------
  // saveAllProducts()
  // ------------------------------------------ */
  describe("saveAllProducts()", () => {
    test("Speichert alle Produkte per Batch-Upsert", async () => {
      // batchUpsert ruft upsert(rows).select() auf — select muss resolven
      supabaseMock.queryMock.select.mockResolvedValue({
        data: [testRow],
        error: null,
      });

      const products: ProductDomain[] = [testDomain];
      await repo.saveAllProducts(products, authUser);

      expect(supabaseMock.queryMock.upsert).toHaveBeenCalledTimes(1);
      const upsertArg = supabaseMock.queryMock.upsert.mock.calls[0][0];
      // batchUpsert sendet ein Array aller Zeilen
      expect(upsertArg).toHaveLength(1);
      expect(upsertArg[0].name).toBe("Tomaten");
      expect(upsertArg[0].id).toBe(testDomain.uid);
    });

    test("Sendet alle Produkte in einem einzelnen Batch-Upsert", async () => {
      supabaseMock.queryMock.select.mockResolvedValue({
        data: [testRow, testRow2],
        error: null,
      });

      const products: ProductDomain[] = [
        testDomain,
        {
          uid: "prod-uuid-002",
          name: "Milch",
          nameSingular: "Milch",
          department: {uid: "dept-uuid-002", name: "Milchprodukte"},
          shoppingUnit: "l",
          dietProperties: {allergens: [1], diet: 2},
          usable: false,
          qaChecked: false,
          qaCheckedAt: null,
        },
      ];
      await repo.saveAllProducts(products, authUser);

      // Nur ein Aufruf mit allen Zeilen
      expect(supabaseMock.queryMock.upsert).toHaveBeenCalledTimes(1);
      const upsertArg = supabaseMock.queryMock.upsert.mock.calls[0][0];
      expect(upsertArg).toHaveLength(2);
    });
  });
});
