/**
 * Unit-Tests für RecipeRepository.
 *
 * Testet toRow/toDomain-Mapping (inklusive Enum-Übersetzungen für diet,
 * allergens und menuTypes) sowie die Convenience-Methoden getRecipe(),
 * getAllPublicRecipes(), insertRecipe(), deleteRecipe() und die
 * Admin-Suchmethoden searchByName(), searchByRecipeId(), searchByCreatorId(),
 * searchByCreatorIds().
 */
import {
  RecipeRepository,
  RecipeDomain,
  RecipeRow,
} from "../RecipeRepository";
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
const testRow: RecipeRow = {
  id: "recipe-uuid-001",
  firebase_uid: "fb-recipe-001",
  name: "Spaghetti Bolognese",
  portions: 4,
  source: "Oma's Kochbuch",
  time_preparation: 20,
  time_rest: 0,
  time_cooking: 45,
  picture_src: "https://example.com/img.jpg",
  note: "Mit viel Liebe",
  tags: ["pasta", "italian"],
  menu_types: ["main_course"],
  diet: "meat",
  allergens: ["gluten"],
  outdoor_kitchen_suitable: false,
  is_in_review: false,
  usable: true,
  avg_rating: 4.5,
  no_ratings: 10,
  no_comments: 3,
  recipe_type: "public",
  variant_note: null,
  variant_name: null,
  variant_event_uid: null,
  original_recipe_uid: null,
  original_recipe_type: null,
  original_recipe_creator_uid: null,
  created_at: "2026-01-01T00:00:00Z",
  created_by: "45e3ab65-7c56-4f0d-8a39-6db543c43dd7",
  updated_at: "2026-01-01T00:00:00Z",
  updated_by: "45e3ab65-7c56-4f0d-8a39-6db543c43dd7",
};

const testDomain: RecipeDomain = {
  uid: "recipe-uuid-001",
  name: "Spaghetti Bolognese",
  portions: 4,
  source: "Oma's Kochbuch",
  times: {preparation: 20, rest: 0, cooking: 45},
  pictureSrc: "https://example.com/img.jpg",
  note: "Mit viel Liebe",
  tags: ["pasta", "italian"],
  menuTypes: [1], // main_course → 1
  dietProperties: {
    diet: 1, // meat → 1
    allergens: [2], // gluten → 2
  },
  outdoorKitchenSuitable: false,
  isInReview: false,
  usable: true,
  avgRating: 4.5,
  noRatings: 10,
  recipeType: "public",
  createdAt: new Date("2026-01-01T00:00:00Z"),
  createdBy: "45e3ab65-7c56-4f0d-8a39-6db543c43dd7",
};

const authUser = {uid: "user-123", authUid: "auth-uuid-123"} as AuthUser;

/* =====================================================================
// Tests
// ===================================================================== */
describe("RecipeRepository", () => {
  let repo: RecipeRepository;
  let supabaseMock: ReturnType<typeof createSupabaseMock>;

  beforeEach(() => {
    supabaseMock = createSupabaseMock();
    repo = new RecipeRepository();
    (repo as any).client = supabaseMock.client;
  });

  /* ------------------------------------------
  // Grundlegende Properties
  // ------------------------------------------ */
  test("tableName ist 'recipes'", () => {
    expect(repo.tableName).toBe("recipes");
  });

  test("getCacheConfig() gibt RECIPE zurück", () => {
    expect(repo.getCacheConfig()).toBe(STORAGE_OBJECT_PROPERTY.RECIPE);
  });

  /* ------------------------------------------
  // toRow / toDomain
  // ------------------------------------------ */
  describe("toRow() / toDomain()", () => {
    test("toRow(): Domain → DB-Zeile mit korrekten Enum-Übersetzungen", () => {
      const row = repo.toRow(testDomain);
      expect(row.name).toBe("Spaghetti Bolognese");
      expect(row.portions).toBe(4);
      expect(row.tags).toEqual(["pasta", "italian"]);
      // diet-Enum: 1 (meat) → 'meat'
      expect(row.diet).toBe("meat");
      // allergens-Enum: [2] (gluten) → ['gluten']
      expect(row.allergens).toEqual(["gluten"]);
      // menu_types-Enum: [1] (main_course) → ['main_course']
      expect(row.menu_types).toEqual(["main_course"]);
      expect(row.recipe_type).toBe("public");
      expect(row.outdoor_kitchen_suitable).toBe(false);
      expect(row.is_in_review).toBe(false);
      // no_comments wird nicht im toRow() gesetzt — wird vom DB-Trigger gepflegt
      expect((row as any).no_comments).toBeUndefined();
      // id darf nicht mitgesendet werden
      expect(row.id).toBeUndefined();
    });

    test("toDomain(): DB-Zeile → Domain mit korrekten numerischen Enum-Werten", () => {
      const domain = repo.toDomain(testRow);
      expect(domain.uid).toBe(testRow.id);
      expect(domain.name).toBe("Spaghetti Bolognese");
      expect(domain.tags).toEqual(["pasta", "italian"]);
      // diet: 'meat' → 1
      expect(domain.dietProperties.diet).toBe(1);
      // allergens: ['gluten'] → [2]
      expect(domain.dietProperties.allergens).toEqual([2]);
      // menuTypes: ['main_course'] → [1]
      expect(domain.menuTypes).toEqual([1]);
      expect(domain.recipeType).toBe("public");
      expect(domain.times.preparation).toBe(20);
      expect(domain.avgRating).toBe(4.5);
      expect(domain.noComments).toBe(3);
    });
  });

  /* ------------------------------------------
  // getRecipe()
  // ------------------------------------------ */
  describe("getRecipe()", () => {
    test("Lädt ein einzelnes Rezept anhand der ID", async () => {
      supabaseMock.queryMock.single.mockResolvedValue({
        data: testRow,
        error: null,
      });

      const result = await repo.getRecipe("recipe-uuid-001");

      expect(supabaseMock.client.from).toHaveBeenCalledWith("recipes");
      expect(supabaseMock.queryMock.eq).toHaveBeenCalledWith("id", "recipe-uuid-001");
      expect(result).not.toBeNull();
      expect(result!.name).toBe("Spaghetti Bolognese");
    });

    test("Gibt null zurück wenn Rezept nicht gefunden", async () => {
      supabaseMock.queryMock.single.mockResolvedValue({
        data: null,
        error: {code: "PGRST116", message: "No rows found"},
      });

      const result = await repo.getRecipe("nonexistent-uuid");

      expect(result).toBeNull();
    });
  });

  /* ------------------------------------------
  // getAllPublicRecipes()
  // ------------------------------------------ */
  describe("getAllPublicRecipes()", () => {
    test("Lädt alle öffentlichen Rezepte sortiert nach Name", async () => {
      supabaseMock.queryMock.order = jest.fn().mockResolvedValue({
        data: [testRow],
        error: null,
      });

      const result = await repo.getAllPublicRecipes();

      expect(supabaseMock.client.from).toHaveBeenCalledWith("recipes");
      expect(supabaseMock.queryMock.eq).toHaveBeenCalledWith("recipe_type", "public");
      expect(supabaseMock.queryMock.order).toHaveBeenCalledWith("name", {
        ascending: true,
      });
      expect(result).toHaveLength(1);
      expect(result[0].recipeType).toBe("public");
    });

    test("Gibt leeres Array zurück wenn keine öffentlichen Rezepte vorhanden", async () => {
      supabaseMock.queryMock.order = jest.fn().mockResolvedValue({
        data: [],
        error: null,
      });

      const result = await repo.getAllPublicRecipes();
      expect(result).toHaveLength(0);
    });
  });

  /* ------------------------------------------
  // insertRecipe()
  // ------------------------------------------ */
  describe("insertRecipe()", () => {
    test("Fügt ein neues Rezept ein und gibt das Domain-Objekt zurück", async () => {
      supabaseMock.queryMock.single.mockResolvedValue({
        data: testRow,
        error: null,
      });

      // uid wird beim Insert weggelassen (von Postgres vergeben)
      const {uid: _uid, ...recipeWithoutUid} = testDomain;
      const result = await repo.insertRecipe(recipeWithoutUid, authUser);

      expect(supabaseMock.queryMock.insert).toHaveBeenCalled();
      expect(result.uid).toBe(testRow.id);
      expect(result.name).toBe("Spaghetti Bolognese");
    });
  });

  /* ------------------------------------------
  // deleteRecipe()
  // ------------------------------------------ */
  describe("deleteRecipe()", () => {
    test("Löscht ein Rezept anhand der ID", async () => {
      supabaseMock.queryMock.eq = jest.fn().mockResolvedValue({
        data: null,
        error: null,
      });

      await repo.deleteRecipe("recipe-uuid-001");

      expect(supabaseMock.queryMock.delete).toHaveBeenCalled();
      expect(supabaseMock.queryMock.eq).toHaveBeenCalledWith("id", "recipe-uuid-001");
    });
  });

  /* ------------------------------------------
  // searchByName() — Admin-Suchmethode
  // ------------------------------------------ */

  /** Kurze Hilfsdaten für Short-Domain-Tests */
  const shortRow = {
    id: "short-uuid-001",
    name: "Gemüsesuppe",
    source: "",
    picture_src: "",
    tags: [],
    menu_types: ["main_course"],
    diet: "vegan",
    allergens: [],
    outdoor_kitchen_suitable: false,
    avg_rating: 0,
    no_ratings: 0,
    no_comments: 5,
    recipe_type: "public",
    variant_name: null,
    created_at: "2026-01-01T00:00:00Z",
    created_by: "creator-uuid-111",
  };

  describe("searchByName()", () => {
    test("Ruft ilike mit eingebettetem Suchbegriff auf und gibt Array zurück", async () => {
      supabaseMock.queryMock.order = jest.fn().mockResolvedValue({
        data: [shortRow],
        error: null,
      });

      const results = await repo.searchByName("Gemüse");

      expect(supabaseMock.queryMock.ilike).toHaveBeenCalledWith("name", "%Gemüse%");
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe("Gemüsesuppe");
      expect(results[0].noComments).toBe(5);
    });

    test("Wendet typeFilter=public an (eq recipe_type=public)", async () => {
      supabaseMock.queryMock.order = jest.fn().mockResolvedValue({
        data: [shortRow],
        error: null,
      });

      await repo.searchByName("Gemüse", "public");

      expect(supabaseMock.queryMock.eq).toHaveBeenCalledWith("recipe_type", "public");
    });

    test("Gibt leeres Array zurück wenn keine Treffer", async () => {
      supabaseMock.queryMock.order = jest.fn().mockResolvedValue({
        data: [],
        error: null,
      });

      const results = await repo.searchByName("XYZ_NICHT_VORHANDEN");
      expect(results).toHaveLength(0);
    });
  });

  /* ------------------------------------------
  // searchByRecipeId() — Admin-Suchmethode
  // ------------------------------------------ */
  describe("searchByRecipeId()", () => {
    test("Ruft eq('id', id) auf und gibt Array zurück", async () => {
      supabaseMock.queryMock.order = jest.fn().mockResolvedValue({
        data: [shortRow],
        error: null,
      });

      const results = await repo.searchByRecipeId("short-uuid-001");

      expect(supabaseMock.queryMock.eq).toHaveBeenCalledWith("id", "short-uuid-001");
      expect(results).toHaveLength(1);
    });

    test("Gibt leeres Array zurück wenn Rezept nicht gefunden", async () => {
      supabaseMock.queryMock.order = jest.fn().mockResolvedValue({
        data: [],
        error: null,
      });

      const results = await repo.searchByRecipeId("nonexistent-uuid");
      expect(results).toHaveLength(0);
    });
  });

  /* ------------------------------------------
  // searchByCreatorId() — Admin-Suchmethode
  // ------------------------------------------ */
  describe("searchByCreatorId()", () => {
    test("Ruft eq('created_by', authUid) auf und gibt Array zurück", async () => {
      supabaseMock.queryMock.order = jest.fn().mockResolvedValue({
        data: [shortRow],
        error: null,
      });

      const results = await repo.searchByCreatorId("creator-uuid-111");

      expect(supabaseMock.queryMock.eq).toHaveBeenCalledWith(
        "created_by",
        "creator-uuid-111",
      );
      expect(results).toHaveLength(1);
    });

    test("Wendet typeFilter=private an (eq recipe_type=private)", async () => {
      supabaseMock.queryMock.order = jest.fn().mockResolvedValue({
        data: [],
        error: null,
      });

      await repo.searchByCreatorId("creator-uuid-111", "private");

      expect(supabaseMock.queryMock.eq).toHaveBeenCalledWith("recipe_type", "private");
    });
  });

  /* ------------------------------------------
  // searchByCreatorIds() — Admin-Suchmethode
  // ------------------------------------------ */
  describe("searchByCreatorIds()", () => {
    test("Ruft in('created_by', uids) auf und gibt Array zurück", async () => {
      supabaseMock.queryMock.order = jest.fn().mockResolvedValue({
        data: [shortRow],
        error: null,
      });

      const results = await repo.searchByCreatorIds([
        "creator-uuid-111",
        "creator-uuid-222",
      ]);

      expect(supabaseMock.queryMock.in).toHaveBeenCalledWith("created_by", [
        "creator-uuid-111",
        "creator-uuid-222",
      ]);
      expect(results).toHaveLength(1);
    });

    test("Gibt leeres Array zurück ohne Suche wenn uids leer", async () => {
      const results = await repo.searchByCreatorIds([]);

      expect(results).toHaveLength(0);
      // Kein DB-Aufruf
      expect(supabaseMock.client.from).not.toHaveBeenCalled();
    });
  });

  /* ------------------------------------------
  // findRecipeCountsByCreator()
  // ------------------------------------------ */
  describe("findRecipeCountsByCreator()", () => {
    test("Zählt öffentliche und private Rezepte korrekt", async () => {
      supabaseMock.queryMock.eq = jest.fn().mockResolvedValue({
        data: [
          {recipe_type: "public"},
          {recipe_type: "private"},
          {recipe_type: "public"},
        ],
        error: null,
      });

      const result = await repo.findRecipeCountsByCreator("auth-uuid-1");

      expect(supabaseMock.queryMock.select).toHaveBeenCalledWith("recipe_type");
      expect(supabaseMock.queryMock.eq).toHaveBeenCalledWith(
        "created_by",
        "auth-uuid-1",
      );
      expect(result.noRecipesPublic).toBe(2);
      expect(result.noRecipesPrivate).toBe(1);
    });

    test("Gibt {0, 0} zurück wenn keine Rezepte vorhanden", async () => {
      supabaseMock.queryMock.eq = jest.fn().mockResolvedValue({
        data: [],
        error: null,
      });

      const result = await repo.findRecipeCountsByCreator("auth-uuid-no-recipes");

      expect(result.noRecipesPublic).toBe(0);
      expect(result.noRecipesPrivate).toBe(0);
    });

    test("Wirft Fehler bei DB-Error", async () => {
      const dbError = {message: "Query failed", code: "42000"};
      supabaseMock.queryMock.eq = jest.fn().mockResolvedValue({
        data: null,
        error: dbError,
      });

      await expect(
        repo.findRecipeCountsByCreator("auth-uuid-1"),
      ).rejects.toEqual(dbError);
    });
  });
});
