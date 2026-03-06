/**
 * Unit-Tests für RecipePreparationStepRepository.
 *
 * Testet toRow/toDomain-Mapping für Zubereitungsschritte ('preparation_step')
 * und Abschnitts-Trennzeilen ('section') sowie die Convenience-Methoden
 * getStepsForRecipe() und saveAllForRecipe().
 */
import {
  RecipePreparationStepRepository,
  RecipePreparationStepDomain,
  RecipePreparationStepRow,
} from "../RecipePreparationStepRepository";
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
const testRow: RecipePreparationStepRow = {
  id: "step-uuid-001",
  firebase_uid: null,
  recipe_id: "recipe-uuid-001",
  sort_order: 0,
  pos_type: "preparation_step",
  step: "Zwiebeln schälen und würfeln.",
  section_name: "",
  created_at: "2026-01-01T00:00:00Z",
  created_by: "45e3ab65-7c56-4f0d-8a39-6db543c43dd7",
  updated_at: "2026-01-01T00:00:00Z",
  updated_by: "45e3ab65-7c56-4f0d-8a39-6db543c43dd7",
};

const testSectionRow: RecipePreparationStepRow = {
  ...testRow,
  id: "step-uuid-002",
  pos_type: "section",
  step: "",
  section_name: "Sosse zubereiten",
};

const testDomain: RecipePreparationStepDomain = {
  uid: "step-uuid-001",
  recipeId: "recipe-uuid-001",
  sortOrder: 0,
  posType: "preparation_step",
  step: "Zwiebeln schälen und würfeln.",
  sectionName: "",
};

const testSectionDomain: RecipePreparationStepDomain = {
  uid: "step-uuid-002",
  recipeId: "recipe-uuid-001",
  sortOrder: 1,
  posType: "section",
  step: "",
  sectionName: "Sosse zubereiten",
};

const authUser = {uid: "user-123", authUid: "auth-uuid-123"} as AuthUser;

/* =====================================================================
// Tests
// ===================================================================== */
describe("RecipePreparationStepRepository", () => {
  let repo: RecipePreparationStepRepository;
  let supabaseMock: ReturnType<typeof createSupabaseMock>;

  beforeEach(() => {
    supabaseMock = createSupabaseMock();
    repo = new RecipePreparationStepRepository();
    (repo as any).client = supabaseMock.client;
  });

  /* ------------------------------------------
  // Grundlegende Properties
  // ------------------------------------------ */
  test("tableName ist 'recipe_preparation_steps'", () => {
    expect(repo.tableName).toBe("recipe_preparation_steps");
  });

  test("getCacheConfig() gibt RECIPE_PREPARATION_STEP zurück", () => {
    expect(repo.getCacheConfig()).toBe(STORAGE_OBJECT_PROPERTY.RECIPE_PREPARATION_STEP);
  });

  /* ------------------------------------------
  // toRow / toDomain
  // ------------------------------------------ */
  describe("toRow() / toDomain()", () => {
    test("toRow(): Zubereitungsschritt → DB-Zeile", () => {
      const row = repo.toRow(testDomain);
      expect(row.step).toBe("Zwiebeln schälen und würfeln.");
      expect(row.pos_type).toBe("preparation_step");
      expect(row.recipe_id).toBe("recipe-uuid-001");
      expect(row.sort_order).toBe(0);
      // id darf nicht mitgesendet werden
      expect(row.id).toBeUndefined();
    });

    test("toRow(): Abschnitt → DB-Zeile (section)", () => {
      const row = repo.toRow(testSectionDomain);
      expect(row.pos_type).toBe("section");
      expect(row.section_name).toBe("Sosse zubereiten");
      expect(row.step).toBe("");
    });

    test("toDomain(): DB-Zeile → Domain (preparation_step)", () => {
      const domain = repo.toDomain(testRow);
      expect(domain.uid).toBe(testRow.id);
      expect(domain.step).toBe("Zwiebeln schälen und würfeln.");
      expect(domain.posType).toBe("preparation_step");
      expect(domain.recipeId).toBe("recipe-uuid-001");
    });

    test("toDomain(): Abschnitts-Zeile → Domain (section)", () => {
      const domain = repo.toDomain(testSectionRow);
      expect(domain.uid).toBe(testSectionRow.id);
      expect(domain.posType).toBe("section");
      expect(domain.sectionName).toBe("Sosse zubereiten");
      expect(domain.step).toBe("");
    });
  });

  /* ------------------------------------------
  // getStepsForRecipe()
  // ------------------------------------------ */
  describe("getStepsForRecipe()", () => {
    test("Lädt Zubereitungsschritte sortiert nach sort_order", async () => {
      supabaseMock.queryMock.order = jest.fn().mockResolvedValue({
        data: [testRow, testSectionRow],
        error: null,
      });

      const result = await repo.getStepsForRecipe("recipe-uuid-001");

      expect(supabaseMock.client.from).toHaveBeenCalledWith("recipe_preparation_steps");
      expect(supabaseMock.queryMock.eq).toHaveBeenCalledWith("recipe_id", "recipe-uuid-001");
      expect(supabaseMock.queryMock.order).toHaveBeenCalledWith("sort_order", {
        ascending: true,
      });
      expect(result).toHaveLength(2);
      expect(result[0].posType).toBe("preparation_step");
      expect(result[1].posType).toBe("section");
    });

    test("Gibt leeres Array zurück wenn keine Schritte vorhanden", async () => {
      supabaseMock.queryMock.order = jest.fn().mockResolvedValue({
        data: [],
        error: null,
      });

      const result = await repo.getStepsForRecipe("recipe-uuid-001");
      expect(result).toHaveLength(0);
    });
  });

  /* ------------------------------------------
  // saveAllForRecipe()
  // ------------------------------------------ */
  describe("saveAllForRecipe()", () => {
    test("Ruft upsert für jeden Schritt auf", async () => {
      // getStepsForRecipe (findMany → order) gibt leere Liste zurück
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
      expect(upsertArg.pos_type).toBe("preparation_step");
    });

    test("Löscht entfernte Schritte und upsert neue", async () => {
      // getStepsForRecipe (findMany → eq → order) liefert einen alten Schritt
      supabaseMock.queryMock.order = jest.fn().mockResolvedValue({
        data: [{...testRow, id: "step-uuid-old"}],
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
