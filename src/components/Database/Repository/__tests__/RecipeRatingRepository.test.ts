/**
 * Unit-Tests für RecipeRatingRepository.
 *
 * Testet toRow/toDomain-Mapping sowie die Convenience-Methoden
 * getRatingForUser() und upsertRating(). Die Aggregatwerte (avg_rating,
 * no_ratings) werden via DB-Trigger aktuell gehalten und sind kein Teil
 * des Repository-Contracts.
 */
import {
  RecipeRatingRepository,
  RecipeRatingDomain,
  RecipeRatingRow,
} from "../RecipeRatingRepository";
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
const testRow: RecipeRatingRow = {
  id: "rating-uuid-001",
  recipe_id: "recipe-uuid-001",
  user_id: "user-auth-uuid-001",
  rating: 4,
  created_at: "2026-01-01T00:00:00Z",
  created_by: "45e3ab65-7c56-4f0d-8a39-6db543c43dd7",
  updated_at: "2026-01-01T00:00:00Z",
  updated_by: "45e3ab65-7c56-4f0d-8a39-6db543c43dd7",
};

const testDomain: RecipeRatingDomain = {
  uid: "rating-uuid-001",
  recipeId: "recipe-uuid-001",
  userId: "user-auth-uuid-001",
  rating: 4,
};

const authUser = {uid: "user-123", authUid: "auth-uuid-123"} as AuthUser;

/* =====================================================================
// Tests
// ===================================================================== */
describe("RecipeRatingRepository", () => {
  let repo: RecipeRatingRepository;
  let supabaseMock: ReturnType<typeof createSupabaseMock>;

  beforeEach(() => {
    supabaseMock = createSupabaseMock();
    repo = new RecipeRatingRepository();
    (repo as any).client = supabaseMock.client;
  });

  /* ------------------------------------------
  // Grundlegende Properties
  // ------------------------------------------ */
  test("tableName ist 'recipe_ratings'", () => {
    expect(repo.tableName).toBe("recipe_ratings");
  });

  test("getCacheConfig() gibt RECIPE_RATING zurück", () => {
    expect(repo.getCacheConfig()).toBe(STORAGE_OBJECT_PROPERTY.RECIPE_RATING);
  });

  /* ------------------------------------------
  // toRow / toDomain
  // ------------------------------------------ */
  describe("toRow() / toDomain()", () => {
    test("toRow(): Domain → DB-Zeile", () => {
      const row = repo.toRow(testDomain);
      expect(row.recipe_id).toBe("recipe-uuid-001");
      expect(row.user_id).toBe("user-auth-uuid-001");
      expect(row.rating).toBe(4);
      // id darf nicht mitgesendet werden
      expect(row.id).toBeUndefined();
    });

    test("toDomain(): DB-Zeile → Domain", () => {
      const domain = repo.toDomain(testRow);
      expect(domain.uid).toBe(testRow.id);
      expect(domain.recipeId).toBe("recipe-uuid-001");
      expect(domain.userId).toBe("user-auth-uuid-001");
      expect(domain.rating).toBe(4);
    });
  });

  /* ------------------------------------------
  // getRatingForUser()
  // ------------------------------------------ */
  describe("getRatingForUser()", () => {
    test("Lädt die Bewertung eines Benutzers für ein Rezept", async () => {
      // getRatingForUser verwendet maybeSingle() statt single()
      supabaseMock.queryMock.maybeSingle = jest
        .fn()
        .mockResolvedValue({data: testRow, error: null});

      const result = await repo.getRatingForUser("recipe-uuid-001", "user-auth-uuid-001");

      expect(supabaseMock.client.from).toHaveBeenCalledWith("recipe_ratings");
      expect(supabaseMock.queryMock.eq).toHaveBeenCalledWith("recipe_id", "recipe-uuid-001");
      expect(supabaseMock.queryMock.eq).toHaveBeenCalledWith("user_id", "user-auth-uuid-001");
      expect(result).not.toBeNull();
      expect(result!.rating).toBe(4);
    });

    test("Gibt null zurück wenn keine Bewertung vorhanden", async () => {
      supabaseMock.queryMock.maybeSingle = jest
        .fn()
        .mockResolvedValue({data: null, error: null});

      const result = await repo.getRatingForUser("recipe-uuid-001", "user-auth-uuid-001");

      expect(result).toBeNull();
    });
  });

  /* ------------------------------------------
  // upsertRating()
  // ------------------------------------------ */
  describe("upsertRating()", () => {
    test("Fügt eine Bewertung ein oder aktualisiert sie per Upsert", async () => {
      supabaseMock.queryMock.single.mockResolvedValue({
        data: testRow,
        error: null,
      });

      const result = await repo.upsertRating(testDomain, authUser);

      expect(supabaseMock.queryMock.upsert).toHaveBeenCalledTimes(1);
      // Upsert soll auf den Unique-Constraint recipe_id + user_id erfolgen
      const upsertArgs = supabaseMock.queryMock.upsert.mock.calls[0];
      expect(upsertArgs[1]).toEqual({onConflict: "recipe_id,user_id"});
      expect(result.rating).toBe(4);
      expect(result.recipeId).toBe("recipe-uuid-001");
    });

    test("Fehler bei upsertRating() werfen", async () => {
      supabaseMock.queryMock.single.mockResolvedValue({
        data: null,
        error: {message: "Upsert failed"},
      });

      await expect(repo.upsertRating(testDomain, authUser)).rejects.toEqual({
        message: "Upsert failed",
      });
    });
  });
});
