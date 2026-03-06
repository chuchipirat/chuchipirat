/**
 * Unit-Tests für RecipeMaterialRepository.
 *
 * Testet toRow/toDomain-Mapping für Materialpositionen sowie die
 * Convenience-Methoden getMaterialsForRecipe() und saveAllForRecipe().
 */
import {
  RecipeMaterialRepository,
  RecipeMaterialDomain,
  RecipeMaterialRow,
} from "../RecipeMaterialRepository";
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
const testRow: RecipeMaterialRow = {
  id: "mat-uuid-001",
  firebase_uid: null,
  recipe_id: "recipe-uuid-001",
  sort_order: 0,
  material_id: "material-uuid-001",
  quantity: 2,
  created_at: "2026-01-01T00:00:00Z",
  created_by: "45e3ab65-7c56-4f0d-8a39-6db543c43dd7",
  updated_at: "2026-01-01T00:00:00Z",
  updated_by: "45e3ab65-7c56-4f0d-8a39-6db543c43dd7",
};

const testRow2: RecipeMaterialRow = {
  ...testRow,
  id: "mat-uuid-002",
  sort_order: 1,
  material_id: "material-uuid-002",
  quantity: 5,
};

const testDomain: RecipeMaterialDomain = {
  uid: "mat-uuid-001",
  recipeId: "recipe-uuid-001",
  sortOrder: 0,
  materialId: "material-uuid-001",
  quantity: 2,
};

const authUser = {uid: "user-123", authUid: "auth-uuid-123"} as AuthUser;

/* =====================================================================
// Tests
// ===================================================================== */
describe("RecipeMaterialRepository", () => {
  let repo: RecipeMaterialRepository;
  let supabaseMock: ReturnType<typeof createSupabaseMock>;

  beforeEach(() => {
    supabaseMock = createSupabaseMock();
    repo = new RecipeMaterialRepository();
    (repo as any).client = supabaseMock.client;
  });

  /* ------------------------------------------
  // Grundlegende Properties
  // ------------------------------------------ */
  test("tableName ist 'recipe_materials'", () => {
    expect(repo.tableName).toBe("recipe_materials");
  });

  test("getCacheConfig() gibt RECIPE_MATERIAL zurück", () => {
    expect(repo.getCacheConfig()).toBe(STORAGE_OBJECT_PROPERTY.RECIPE_MATERIAL);
  });

  /* ------------------------------------------
  // toRow / toDomain
  // ------------------------------------------ */
  describe("toRow() / toDomain()", () => {
    test("toRow(): Domain → DB-Zeile", () => {
      const row = repo.toRow(testDomain);
      expect(row.recipe_id).toBe("recipe-uuid-001");
      expect(row.sort_order).toBe(0);
      expect(row.material_id).toBe("material-uuid-001");
      expect(row.quantity).toBe(2);
      // id darf nicht mitgesendet werden
      expect(row.id).toBeUndefined();
    });

    test("toRow(): materialId null ergibt null in DB-Zeile", () => {
      const domain: RecipeMaterialDomain = {
        ...testDomain,
        materialId: null,
      };
      const row = repo.toRow(domain);
      expect(row.material_id).toBeNull();
    });

    test("toDomain(): DB-Zeile → Domain", () => {
      const domain = repo.toDomain(testRow);
      expect(domain.uid).toBe(testRow.id);
      expect(domain.recipeId).toBe("recipe-uuid-001");
      expect(domain.materialId).toBe("material-uuid-001");
      expect(domain.sortOrder).toBe(0);
      expect(domain.quantity).toBe(2);
    });
  });

  /* ------------------------------------------
  // getMaterialsForRecipe()
  // ------------------------------------------ */
  describe("getMaterialsForRecipe()", () => {
    test("Lädt Materialpositionen sortiert nach sort_order", async () => {
      supabaseMock.queryMock.order = jest.fn().mockResolvedValue({
        data: [testRow, testRow2],
        error: null,
      });

      const result = await repo.getMaterialsForRecipe("recipe-uuid-001");

      expect(supabaseMock.client.from).toHaveBeenCalledWith("recipe_materials");
      expect(supabaseMock.queryMock.eq).toHaveBeenCalledWith("recipe_id", "recipe-uuid-001");
      expect(supabaseMock.queryMock.order).toHaveBeenCalledWith("sort_order", {
        ascending: true,
      });
      expect(result).toHaveLength(2);
      expect(result[0].uid).toBe(testRow.id);
      expect(result[1].quantity).toBe(5);
    });

    test("Gibt leeres Array zurück wenn keine Materialpositionen vorhanden", async () => {
      supabaseMock.queryMock.order = jest.fn().mockResolvedValue({
        data: [],
        error: null,
      });

      const result = await repo.getMaterialsForRecipe("recipe-uuid-001");
      expect(result).toHaveLength(0);
    });
  });

  /* ------------------------------------------
  // saveAllForRecipe()
  // ------------------------------------------ */
  describe("saveAllForRecipe()", () => {
    test("Ruft upsert für jede Materialposition auf", async () => {
      // getMaterialsForRecipe (findMany → order) gibt leere Liste zurück
      supabaseMock.queryMock.order = jest.fn().mockResolvedValue({
        data: [],
        error: null,
      });
      // upsert → select → single
      supabaseMock.queryMock.single.mockResolvedValue({
        data: testRow,
        error: null,
      });

      await repo.saveAllForRecipe("recipe-uuid-001", [testDomain], authUser);

      expect(supabaseMock.queryMock.upsert).toHaveBeenCalledTimes(1);
      const upsertArg = supabaseMock.queryMock.upsert.mock.calls[0][0];
      expect(upsertArg.recipe_id).toBe("recipe-uuid-001");
      expect(upsertArg.material_id).toBe("material-uuid-001");
      expect(upsertArg.id).toBe(testDomain.uid);
    });

    test("Löscht entfernte Materialpositionen und upsert neue", async () => {
      // getMaterialsForRecipe (findMany → eq → order) liefert eine alte Position
      supabaseMock.queryMock.order = jest.fn().mockResolvedValue({
        data: [{...testRow, id: "mat-uuid-old"}],
        error: null,
      });
      // remove() → delete().eq() benötigt ein separates thenable Mock-Objekt,
      // da der delete-Pfad die Kette ohne single() beendet.
      const {createQueryMock} = require("../__mocks__/supabaseMock");
      const deleteMock = createQueryMock();
      deleteMock.eq = jest.fn().mockResolvedValue({data: null, error: null});
      supabaseMock.client.from.mockReturnValueOnce(supabaseMock.queryMock) // findMany
        .mockReturnValueOnce(deleteMock); // remove
      // upsert → select → single
      supabaseMock.queryMock.single.mockResolvedValue({
        data: testRow,
        error: null,
      });

      await repo.saveAllForRecipe("recipe-uuid-001", [testDomain], authUser);

      expect(deleteMock.delete).toHaveBeenCalled();
      expect(supabaseMock.queryMock.upsert).toHaveBeenCalledTimes(1);
    });
  });
});
