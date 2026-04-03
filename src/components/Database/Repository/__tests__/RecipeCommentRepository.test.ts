/**
 * Unit-Tests für RecipeCommentRepository.
 *
 * Testet toRow/toDomain-Mapping sowie die Convenience-Methoden
 * getCommentsForRecipe(), insertComment(), updateComment() und deleteComment().
 *
 * Anzeigename und Profilbild werden NICHT in recipe_comments gespeichert.
 * getCommentsForRecipe() lädt sie separat aus der user_profiles-View
 * (zweiter Query, kein PostgREST-Join).
 */
import {
  RecipeCommentRepository,
  RecipeCommentDomain,
  RecipeCommentRow,
} from "../RecipeCommentRepository";
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
const testRow: RecipeCommentRow = {
  id: "comment-uuid-001",
  firebase_uid: null,
  recipe_id: "recipe-uuid-001",
  comment: "Wunderbares Rezept! Habe es gestern ausprobiert.",
  created_at: "2026-01-15T10:30:00Z",
  created_by: "45e3ab65-7c56-4f0d-8a39-6db543c43dd7",
  updated_at: "2026-01-15T10:30:00Z",
  updated_by: "45e3ab65-7c56-4f0d-8a39-6db543c43dd7",
};

const testDomain: RecipeCommentDomain = {
  uid: "comment-uuid-001",
  recipeId: "recipe-uuid-001",
  comment: "Wunderbares Rezept! Habe es gestern ausprobiert.",
  createdAt: new Date("2026-01-15T10:30:00Z"),
  createdBy: "45e3ab65-7c56-4f0d-8a39-6db543c43dd7",
  displayName: "Müller, Anna",
  pictureSrc: "https://example.com/avatar.jpg",
};

const authUser = {
  uid: "auth-uuid-123",
  publicProfile: {displayName: "Müller, Anna", pictureSrc: "https://example.com/avatar.jpg", motto: ""},
} as unknown as AuthUser;

/* =====================================================================
// Tests
// ===================================================================== */
describe("RecipeCommentRepository", () => {
  let repo: RecipeCommentRepository;
  let supabaseMock: ReturnType<typeof createSupabaseMock>;

  beforeEach(() => {
    supabaseMock = createSupabaseMock();
    repo = new RecipeCommentRepository();
    (repo as any).client = supabaseMock.client;
  });

  /* ------------------------------------------
  // Grundlegende Properties
  // ------------------------------------------ */
  test("tableName ist 'recipe_comments'", () => {
    expect(repo.tableName).toBe("recipe_comments");
  });

  test("getCacheConfig() gibt RECIPE_COMMENT zurück", () => {
    expect(repo.getCacheConfig()).toBe(STORAGE_OBJECT_PROPERTY.RECIPE_COMMENT);
  });

  /* ------------------------------------------
  // toRow / toDomain
  // ------------------------------------------ */
  describe("toRow() / toDomain()", () => {
    test("toRow(): Domain → DB-Zeile (nur recipe_id und comment)", () => {
      const row = repo.toRow(testDomain);
      expect(row.recipe_id).toBe("recipe-uuid-001");
      expect(row.comment).toBe("Wunderbares Rezept! Habe es gestern ausprobiert.");
      // display_name und picture_src werden NICHT in der DB gespeichert
      expect((row as any).display_name).toBeUndefined();
      expect((row as any).picture_src).toBeUndefined();
      // id darf nicht mitgesendet werden
      expect(row.id).toBeUndefined();
    });

    test("toDomain(): DB-Zeile → Domain (displayName/pictureSrc leer — werden separat angereichert)", () => {
      const domain = repo.toDomain(testRow);
      expect(domain.uid).toBe(testRow.id);
      expect(domain.recipeId).toBe("recipe-uuid-001");
      expect(domain.comment).toBe("Wunderbares Rezept! Habe es gestern ausprobiert.");
      expect(domain.createdBy).toBe("45e3ab65-7c56-4f0d-8a39-6db543c43dd7");
      // Profilfelder sind leer — werden in getCommentsForRecipe() aus user_profiles ergänzt
      expect(domain.displayName).toBe("");
      expect(domain.pictureSrc).toBe("");
      expect(domain.createdAt).toEqual(new Date("2026-01-15T10:30:00Z"));
    });

    test("toDomain(): null created_by → leerer String", () => {
      const rowWithNullCreator: RecipeCommentRow = {...testRow, created_by: null};
      const domain = repo.toDomain(rowWithNullCreator);
      expect(domain.createdBy).toBe("");
    });
  });

  /* ------------------------------------------
  // getCommentsForRecipe()
  // ------------------------------------------ */
  describe("getCommentsForRecipe()", () => {
    beforeEach(() => {
      // RPC-Mock zurücksetzen
      supabaseMock.client.rpc = jest.fn().mockResolvedValue({data: null, error: null});
    });

    test("Lädt Kommentare und reichert sie mit Profildaten via RPC an", async () => {
      supabaseMock.queryMock.range = jest.fn().mockResolvedValue({
        data: [testRow],
        error: null,
      });
      supabaseMock.client.rpc = jest.fn().mockResolvedValue({
        data: [
          {
            id: testRow.created_by,
            display_name: "Müller, Anna",
            picture_src: "https://example.com/avatar.jpg",
          },
        ],
        error: null,
      });

      const result = await repo.getCommentsForRecipe("recipe-uuid-001");

      expect(supabaseMock.client.from).toHaveBeenCalledWith("recipe_comments");
      expect(supabaseMock.queryMock.eq).toHaveBeenCalledWith("recipe_id", "recipe-uuid-001");
      expect(supabaseMock.queryMock.select).toHaveBeenCalledWith("*");
      expect(supabaseMock.client.rpc).toHaveBeenCalledWith(
        "get_comment_author_profiles",
        {uids: [testRow.created_by]},
      );
      expect(result).toHaveLength(1);
      expect(result[0].uid).toBe("comment-uuid-001");
      // Profilfelder via SECURITY DEFINER RPC angereichert
      expect(result[0].displayName).toBe("Müller, Anna");
      expect(result[0].pictureSrc).toBe("https://example.com/avatar.jpg");
    });

    test("Gibt leeres Array zurück und ruft RPC nicht auf wenn keine Kommentare vorhanden", async () => {
      supabaseMock.queryMock.range = jest.fn().mockResolvedValue({
        data: [],
        error: null,
      });

      const result = await repo.getCommentsForRecipe("recipe-uuid-001");
      expect(result).toHaveLength(0);
      expect(supabaseMock.client.rpc).not.toHaveBeenCalled();
    });

    test("Respektiert limit und offset Parameter", async () => {
      supabaseMock.queryMock.range = jest.fn().mockResolvedValue({
        data: [],
        error: null,
      });

      await repo.getCommentsForRecipe("recipe-uuid-001", 10, 20);

      // range(offset, offset + limit - 1) → range(20, 29)
      expect(supabaseMock.queryMock.range).toHaveBeenCalledWith(20, 29);
    });

    test("Befüllt displayName/pictureSrc leer wenn RPC keinen Eintrag liefert", async () => {
      supabaseMock.queryMock.range = jest.fn().mockResolvedValue({
        data: [testRow],
        error: null,
      });
      supabaseMock.client.rpc = jest.fn().mockResolvedValue({data: [], error: null});

      const result = await repo.getCommentsForRecipe("recipe-uuid-001");
      expect(result[0].displayName).toBe("");
      expect(result[0].pictureSrc).toBe("");
    });
  });

  /* ------------------------------------------
  // insertComment()
  // ------------------------------------------ */
  describe("insertComment()", () => {
    beforeEach(() => {
      // functions.invoke für die Fire-and-forget-Benachrichtigung mocken
      (repo as any).client.functions = {
        invoke: jest.fn().mockResolvedValue({data: null, error: null}),
      };
    });

    test("Fügt einen neuen Kommentar ein ohne Profilfelder in der DB zu speichern", async () => {
      supabaseMock.queryMock.single.mockResolvedValue({
        data: testRow,
        error: null,
      });

      const _result = await repo.insertComment(
        {recipeId: "recipe-uuid-001", comment: "Wunderbares Rezept!"},
        authUser,
      );

      expect(supabaseMock.queryMock.insert).toHaveBeenCalled();
      const insertArg = supabaseMock.queryMock.insert.mock.calls[0][0];
      expect(insertArg.recipe_id).toBe("recipe-uuid-001");
      expect(insertArg.comment).toBe("Wunderbares Rezept!");
      // display_name und picture_src dürfen NICHT in die DB geschrieben werden
      expect(insertArg.display_name).toBeUndefined();
      expect(insertArg.picture_src).toBeUndefined();
    });

    test("Reichert das zurückgegebene Domain-Objekt mit Profilfeldern aus authUser an", async () => {
      supabaseMock.queryMock.single.mockResolvedValue({
        data: testRow,
        error: null,
      });

      const result = await repo.insertComment(
        {recipeId: "recipe-uuid-001", comment: "Wunderbares Rezept!"},
        authUser,
      );

      // Profilfelder aus authUser.publicProfile — kein zweiter DB-Query nötig
      expect(result.displayName).toBe("Müller, Anna");
      expect(result.pictureSrc).toBe("https://example.com/avatar.jpg");
      expect(result.uid).toBe("comment-uuid-001");
    });

    test("Löst notify-recipe-comment Edge Function als Fire-and-Forget aus", async () => {
      supabaseMock.queryMock.single.mockResolvedValue({
        data: testRow,
        error: null,
      });

      await repo.insertComment(
        {recipeId: "recipe-uuid-001", comment: "Toller Kommentar"},
        authUser,
      );

      expect((repo as any).client.functions.invoke).toHaveBeenCalledWith(
        "notify-recipe-comment",
        expect.objectContaining({
          body: expect.objectContaining({
            commentId: "comment-uuid-001",
            recipeId: "recipe-uuid-001",
          }),
        }),
      );
    });

    test("Fehler bei der Edge Function verhindert die Rückgabe nicht", async () => {
      supabaseMock.queryMock.single.mockResolvedValue({
        data: testRow,
        error: null,
      });
      (repo as any).client.functions.invoke = jest
        .fn()
        .mockRejectedValue(new Error("Network error"));

      await expect(
        repo.insertComment({recipeId: "recipe-uuid-001", comment: "Test"}, authUser),
      ).resolves.toBeDefined();
    });
  });

  /* ------------------------------------------
  // updateComment()
  // ------------------------------------------ */
  describe("updateComment()", () => {
    test("Aktualisiert nur das comment-Feld (recipe_id bleibt unverändert)", async () => {
      supabaseMock.queryMock.eq = jest
        .fn()
        .mockResolvedValue({data: null, error: null});

      await repo.updateComment(
        "comment-uuid-001",
        "Aktualisierter Kommentar",
        authUser,
      );

      expect(supabaseMock.queryMock.update).toHaveBeenCalled();
      const updateArg = supabaseMock.queryMock.update.mock.calls[0][0];
      expect(updateArg.comment).toBe("Aktualisierter Kommentar");
      // recipe_id darf NICHT überschrieben werden
      expect(updateArg.recipe_id).toBeUndefined();
      expect(supabaseMock.queryMock.eq).toHaveBeenCalledWith(
        "id",
        "comment-uuid-001",
      );
    });

    test("Wirft Fehler wenn DB-Fehler auftritt", async () => {
      supabaseMock.queryMock.eq = jest
        .fn()
        .mockResolvedValue({data: null, error: {message: "RLS policy violation", code: "42501"}});

      await expect(
        repo.updateComment("comment-uuid-001", "Test", authUser),
      ).rejects.toMatchObject({message: "RLS policy violation"});
    });
  });

  /* ------------------------------------------
  // deleteComment()
  // ------------------------------------------ */
  describe("deleteComment()", () => {
    test("Löscht einen Kommentar anhand der ID", async () => {
      supabaseMock.queryMock.eq = jest
        .fn()
        .mockResolvedValue({data: null, error: null});

      await repo.deleteComment("comment-uuid-001");

      expect(supabaseMock.queryMock.delete).toHaveBeenCalled();
      expect(supabaseMock.queryMock.eq).toHaveBeenCalledWith(
        "id",
        "comment-uuid-001",
      );
    });
  });
});
