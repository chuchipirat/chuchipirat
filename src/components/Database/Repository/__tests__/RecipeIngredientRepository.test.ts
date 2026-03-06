/**
 * Unit-Tests für RecipeIngredientRepository.
 *
 * Testet toRow/toDomain-Mapping für Zutaten ('ingredient') und
 * Abschnitts-Trennzeilen ('section') sowie die Convenience-Methoden
 * getIngredientsForRecipe() und saveAllForRecipe().
 */
import {
  RecipeIngredientRepository,
  RecipeIngredientDomain,
  RecipeIngredientRow,
} from "../RecipeIngredientRepository";
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
const testRow: RecipeIngredientRow = {
  id: "ing-uuid-001",
  firebase_uid: null,
  recipe_id: "recipe-uuid-001",
  sort_order: 0,
  pos_type: "ingredient",
  product_id: "prod-uuid-001",
  quantity: 500,
  unit: "g",
  detail: "fein gehackt",
  scaling_factor: 1,
  section_name: "",
  created_at: "2026-01-01T00:00:00Z",
  created_by: "45e3ab65-7c56-4f0d-8a39-6db543c43dd7",
  updated_at: "2026-01-01T00:00:00Z",
  updated_by: "45e3ab65-7c56-4f0d-8a39-6db543c43dd7",
};

const testSectionRow: RecipeIngredientRow = {
  ...testRow,
  id: "ing-uuid-002",
  pos_type: "section",
  product_id: null,
  quantity: 0,
  unit: null,
  section_name: "Für die Sosse",
};

const testDomain: RecipeIngredientDomain = {
  uid: "ing-uuid-001",
  recipeId: "recipe-uuid-001",
  sortOrder: 0,
  posType: "ingredient",
  productId: "prod-uuid-001",
  quantity: 500,
  unit: "g",
  detail: "fein gehackt",
  scalingFactor: 1,
  sectionName: "",
};

const testSectionDomain: RecipeIngredientDomain = {
  uid: "ing-uuid-002",
  recipeId: "recipe-uuid-001",
  sortOrder: 1,
  posType: "section",
  productId: null,
  quantity: 0,
  unit: null,
  detail: "",
  scalingFactor: 1,
  sectionName: "Für die Sosse",
};

const authUser = {uid: "user-123", authUid: "auth-uuid-123"} as AuthUser;

/* =====================================================================
// Tests
// ===================================================================== */
describe("RecipeIngredientRepository", () => {
  let repo: RecipeIngredientRepository;
  let supabaseMock: ReturnType<typeof createSupabaseMock>;

  beforeEach(() => {
    supabaseMock = createSupabaseMock();
    repo = new RecipeIngredientRepository();
    (repo as any).client = supabaseMock.client;
  });

  /* ------------------------------------------
  // Grundlegende Properties
  // ------------------------------------------ */
  test("tableName ist 'recipe_ingredients'", () => {
    expect(repo.tableName).toBe("recipe_ingredients");
  });

  test("getCacheConfig() gibt RECIPE_INGREDIENT zurück", () => {
    expect(repo.getCacheConfig()).toBe(STORAGE_OBJECT_PROPERTY.RECIPE_INGREDIENT);
  });

  /* ------------------------------------------
  // toRow / toDomain
  // ------------------------------------------ */
  describe("toRow() / toDomain()", () => {
    test("toRow(): Zutat → DB-Zeile (ingredient)", () => {
      const row = repo.toRow(testDomain);
      expect(row.recipe_id).toBe("recipe-uuid-001");
      expect(row.sort_order).toBe(0);
      expect(row.pos_type).toBe("ingredient");
      expect(row.product_id).toBe("prod-uuid-001");
      expect(row.quantity).toBe(500);
      expect(row.unit).toBe("g");
      expect(row.scaling_factor).toBe(1);
      // id darf nicht mitgesendet werden
      expect(row.id).toBeUndefined();
    });

    test("toRow(): Abschnitt → DB-Zeile (section)", () => {
      const row = repo.toRow(testSectionDomain);
      expect(row.pos_type).toBe("section");
      expect(row.section_name).toBe("Für die Sosse");
      expect(row.product_id).toBeNull();
    });

    test("toDomain(): DB-Zeile → Domain (ingredient)", () => {
      const domain = repo.toDomain(testRow);
      expect(domain.uid).toBe(testRow.id);
      expect(domain.recipeId).toBe("recipe-uuid-001");
      expect(domain.posType).toBe("ingredient");
      expect(domain.productId).toBe("prod-uuid-001");
      expect(domain.quantity).toBe(500);
      expect(domain.unit).toBe("g");
    });

    test("toDomain(): Abschnitts-Zeile → Domain (section)", () => {
      const domain = repo.toDomain(testSectionRow);
      expect(domain.uid).toBe(testSectionRow.id);
      expect(domain.posType).toBe("section");
      expect(domain.sectionName).toBe("Für die Sosse");
      expect(domain.productId).toBeNull();
    });
  });

  /* ------------------------------------------
  // getIngredientsForRecipe()
  // ------------------------------------------ */
  describe("getIngredientsForRecipe()", () => {
    test("Lädt Zutaten sortiert nach sort_order", async () => {
      supabaseMock.queryMock.order = jest.fn().mockResolvedValue({
        data: [testRow, testSectionRow],
        error: null,
      });

      const result = await repo.getIngredientsForRecipe("recipe-uuid-001");

      expect(supabaseMock.client.from).toHaveBeenCalledWith("recipe_ingredients");
      expect(supabaseMock.queryMock.eq).toHaveBeenCalledWith("recipe_id", "recipe-uuid-001");
      expect(supabaseMock.queryMock.order).toHaveBeenCalledWith("sort_order", {
        ascending: true,
      });
      expect(result).toHaveLength(2);
      expect(result[0].uid).toBe(testRow.id);
      expect(result[1].posType).toBe("section");
    });

    test("Gibt leeres Array zurück wenn keine Zutaten vorhanden", async () => {
      supabaseMock.queryMock.order = jest.fn().mockResolvedValue({
        data: [],
        error: null,
      });

      const result = await repo.getIngredientsForRecipe("recipe-uuid-001");
      expect(result).toHaveLength(0);
    });
  });

  /* ------------------------------------------
  // saveAllForRecipe()
  // ------------------------------------------ */
  describe("saveAllForRecipe()", () => {
    test("Ruft upsert für jede Zutat auf", async () => {
      // getIngredientsForRecipe (findMany → order) gibt leere Liste zurück
      // (keine bestehenden Zeilen → kein Löschen nötig)
      supabaseMock.queryMock.order = jest.fn().mockResolvedValue({
        data: [],
        error: null,
      });
      // upsert → select → single gibt die eingefügte Zeile zurück
      supabaseMock.queryMock.single.mockResolvedValue({
        data: testRow,
        error: null,
      });

      await repo.saveAllForRecipe("recipe-uuid-001", [testDomain], authUser);

      expect(supabaseMock.queryMock.upsert).toHaveBeenCalledTimes(1);
      const upsertArg = supabaseMock.queryMock.upsert.mock.calls[0][0];
      expect(upsertArg.recipe_id).toBe("recipe-uuid-001");
      expect(upsertArg.pos_type).toBe("ingredient");
    });

    test("Löscht entfernte Zutaten und upsert neue", async () => {
      // getIngredientsForRecipe (findMany → eq → order) liefert eine alte Zutat
      supabaseMock.queryMock.order = jest.fn().mockResolvedValue({
        data: [{...testRow, id: "ing-uuid-old"}],
        error: null,
      });
      // remove() → delete().eq() benötigt ein separates thenable Mock-Objekt,
      // da der delete-Pfad die Kette ohne single() beendet.
      // Durch mockReturnValueOnce auf client.from() wird für den zweiten Aufruf
      // (delete) ein eigenes Mock-Objekt zurückgegeben.
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

      // Die alte Zeile ("ing-uuid-old") wird gelöscht, die neue wird upserted
      expect(deleteMock.delete).toHaveBeenCalled();
      expect(supabaseMock.queryMock.upsert).toHaveBeenCalledTimes(1);
    });
  });
});
