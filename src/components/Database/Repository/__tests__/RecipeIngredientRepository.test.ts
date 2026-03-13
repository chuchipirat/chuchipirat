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
  product_name: "Zwiebeln",
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
  productName: "Zwiebeln",
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
      expect(domain.productName).toBe("Zwiebeln");
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

      // Liest von der View statt der Basistabelle
      expect(supabaseMock.client.from).toHaveBeenCalledWith("recipe_ingredients_with_names");
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
    test("Ruft batchUpsert auf und gibt neu geladene Daten zurück", async () => {
      // saveAllForRecipe ruft from() 3× auf:
      // 1. getIngredientsForRecipe (View) — Bestehende laden
      // 2. batchUpsert (Tabelle) — upsert().select()
      // 3. getIngredientsForRecipe (View) — Reload
      const loadMock1 = createQueryMock();
      loadMock1.order = jest.fn().mockResolvedValue({data: [], error: null});

      const upsertMock = createQueryMock();
      upsertMock.select = jest.fn().mockResolvedValue({
        data: [testRow],
        error: null,
      });

      const loadMock2 = createQueryMock();
      loadMock2.order = jest.fn().mockResolvedValue({data: [testRow], error: null});

      supabaseMock.client.from
        .mockReturnValueOnce(loadMock1)   // 1. getIngredientsForRecipe
        .mockReturnValueOnce(upsertMock)  // 2. batchUpsert
        .mockReturnValueOnce(loadMock2);  // 3. getIngredientsForRecipe (Reload)

      const result = await repo.saveAllForRecipe("recipe-uuid-001", [testDomain], authUser);

      expect(upsertMock.upsert).toHaveBeenCalledTimes(1);
      const upsertArg = upsertMock.upsert.mock.calls[0][0];
      expect(upsertArg).toHaveLength(1);
      expect(upsertArg[0].recipe_id).toBe("recipe-uuid-001");
      expect(upsertArg[0].pos_type).toBe("ingredient");
      // Gibt die neu geladenen Domain-Objekte zurück
      expect(result).toHaveLength(1);
      expect(result[0].uid).toBe(testRow.id);
    });

    test("Löscht entfernte Zutaten per batchRemove und upserted neue", async () => {
      // saveAllForRecipe ruft from() 4× auf:
      // 1. getIngredientsForRecipe (View) — Bestehende laden
      // 2. batchRemove (Tabelle) — delete().in()
      // 3. batchUpsert (Tabelle) — upsert().select()
      // 4. getIngredientsForRecipe (View) — Reload
      const loadMock1 = createQueryMock();
      loadMock1.order = jest.fn().mockResolvedValue({
        data: [{...testRow, id: "ing-uuid-old"}],
        error: null,
      });

      const deleteMock = createQueryMock();
      deleteMock.in = jest.fn().mockResolvedValue({error: null});

      const upsertMock = createQueryMock();
      upsertMock.select = jest.fn().mockResolvedValue({
        data: [testRow],
        error: null,
      });

      const loadMock2 = createQueryMock();
      loadMock2.order = jest.fn().mockResolvedValue({data: [testRow], error: null});

      supabaseMock.client.from
        .mockReturnValueOnce(loadMock1)   // 1. getIngredientsForRecipe
        .mockReturnValueOnce(deleteMock)  // 2. batchRemove
        .mockReturnValueOnce(upsertMock)  // 3. batchUpsert
        .mockReturnValueOnce(loadMock2);  // 4. getIngredientsForRecipe (Reload)

      const result = await repo.saveAllForRecipe("recipe-uuid-001", [testDomain], authUser);

      // batchRemove: delete().in() für die entfernte Zeile
      expect(deleteMock.delete).toHaveBeenCalled();
      expect(deleteMock.in).toHaveBeenCalledWith(
        "id",
        ["ing-uuid-old"],
      );
      // batchUpsert: ein Aufruf mit allen Zeilen
      expect(upsertMock.upsert).toHaveBeenCalledTimes(1);
      expect(result).toHaveLength(1);
    });
  });
});
