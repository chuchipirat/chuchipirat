/**
 * Unit-Tests für RecipeMigrationJob.
 *
 * Testet die Migrationsmethoden checkExists() und migrateRecord().
 *
 * checkExists() prüft rein in-memory gegen ein vorab geladenes Set
 * (existingFirebaseUids) — dieses Set wird normalerweise durch
 * fetchSourceRecords() befüllt, hier aber direkt gesetzt, da
 * fetchSourceRecords() selbst nicht getestet wird (ruft direkt Firestore auf).
 *
 * migrateRecord() verwendet einen fest verdrahteten Service-Role-Client
 * (supabaseAdmin) statt des injizierten DatabaseService — RecipeRepository.insert()
 * (für die Kopfdaten) wird per Prototype-Spy gemockt, der rohe Supabase-Client
 * (für Update/Insert der Kindtabellen) über einen Modul-Mock.
 */
import {RecipeMigrationJob} from "../RecipeMigrationJob";
import {SourceRecord} from "../MigrationJob.interface";
import AuthUser from "../../../Firebase/Authentication/authUser.class";
import {RecipeRepository} from "../../../Database/Repository/RecipeRepository";

// supabaseAdmin mocken (wird für Update der Kopfdaten und Insert der Kindtabellen verwendet)
jest.mock("../../../Database/supabaseClient", () => {
  const updateEq = jest.fn().mockResolvedValue({error: null});
  const update = jest.fn().mockReturnValue({eq: updateEq});
  const insert = jest.fn().mockResolvedValue({error: null});
  const from = jest.fn().mockReturnValue({update, insert});
  return {
    supabase: {
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockResolvedValue({data: [], error: null}),
      }),
    },
    supabaseAdmin: {from},
    // Test-only Handles, um die Mocks unten greifen zu können
    __adminMocks: {from, update, insert, updateEq},
  };
});

const {__adminMocks: adminMocks} = jest.requireMock(
  "../../../Database/supabaseClient",
) as {
  __adminMocks: {from: jest.Mock; update: jest.Mock; insert: jest.Mock; updateEq: jest.Mock};
};
const mockFrom = adminMocks.from;
const mockUpdate = adminMocks.update;
const mockInsert = adminMocks.insert;
const mockUpdateEq = adminMocks.updateEq;

/* =====================================================================
// Test-Daten
// ===================================================================== */
const authUser = {uid: "auth-uuid-123"} as AuthUser;

/** Minimaler Firebase-Rezept-Datensatz für die Migration */
const makeFirebaseRecord = (
  overrides: Partial<{recipeType: "public" | "private"; ingredients: any; steps: any; materials: any; preparationSteps: any}> = {},
): SourceRecord<any> => ({
  id: "fb-recipe-001",
  label: "Spaghetti Bolognese",
  data: {
    name: "Spaghetti Bolognese",
    portions: 4,
    source: "Oma's Kochbuch",
    times: {preparation: 20, rest: 0, cooking: 45},
    pictureSrc: "",
    note: "",
    tags: ["pasta"],
    ingredients: {entries: {}, order: []},
    preparationSteps: {entries: {}, order: []},
    materials: {entries: {}, order: []},
    dietProperties: {allergens: [], diet: 1},
    menuTypes: [1],
    outdoorKitchenSuitable: false,
    isInReview: false,
    rating: {avgRating: 0, noRatings: 0},
    created: {date: new Date("2026-01-01"), fromUid: "fb-user-001", fromDisplayName: "Max"},
    recipeType: "public" as const,
    firebaseCreatorUid: "fb-user-001",
    ...overrides,
  },
});

/* =====================================================================
// Tests
// ===================================================================== */
describe("RecipeMigrationJob", () => {
  let job: RecipeMigrationJob;
  let insertSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    mockUpdateEq.mockResolvedValue({error: null});
    mockInsert.mockResolvedValue({error: null});
    insertSpy = jest
      .spyOn(RecipeRepository.prototype, "insert")
      .mockResolvedValue({id: "pg-recipe-uuid-001", value: {} as any});
    job = new RecipeMigrationJob();
  });

  afterEach(() => {
    insertSpy.mockRestore();
  });

  /* ------------------------------------------
  // Grundlegende Properties
  // ------------------------------------------ */
  test("name und description sind gesetzt", () => {
    expect(job.name).toBe("Rezepte (öffentlich + privat)");
    expect(job.description).toContain("Firebase");
    expect(job.description).toContain("Postgres");
  });

  /* ------------------------------------------
  // checkExists()
  // ------------------------------------------ */
  describe("checkExists()", () => {
    test("Gibt false zurück wenn Rezept noch nicht migriert wurde", async () => {
      // In-Memory-Set direkt setzen (normalerweise durch fetchSourceRecords befüllt)
      (job as any).existingFirebaseUids = new Set<string>();
      const record = makeFirebaseRecord();

      const exists = await job.checkExists({} as any, record);

      expect(exists).toBe(false);
    });

    test("Gibt true zurück wenn Rezept bereits migriert wurde", async () => {
      (job as any).existingFirebaseUids = new Set(["fb-recipe-001"]);
      const record = makeFirebaseRecord();

      const exists = await job.checkExists({} as any, record);

      expect(exists).toBe(true);
    });

    test("Gibt false zurück wenn das Set noch nicht geladen wurde (null)", async () => {
      const record = makeFirebaseRecord();

      const exists = await job.checkExists({} as any, record);

      expect(exists).toBe(false);
    });
  });

  /* ------------------------------------------
  // migrateRecord() — Kopfdaten
  // ------------------------------------------ */
  describe("migrateRecord() — Rezept-Kopfdaten", () => {
    test("Fügt Rezept-Kopfdaten via RecipeRepository ein", async () => {
      const record = makeFirebaseRecord();

      await job.migrateRecord({} as any, record, authUser);

      expect(insertSpy).toHaveBeenCalledTimes(1);
      const insertArg = insertSpy.mock.calls[0][0].value;
      expect(insertArg.name).toBe("Spaghetti Bolognese");
      expect(insertArg.portions).toBe(4);
      expect(insertArg.recipeType).toBe("public");
    });

    test("Setzt firebase_uid via Update auf der recipes-Tabelle nach dem Insert", async () => {
      const record = makeFirebaseRecord();

      await job.migrateRecord({} as any, record, authUser);

      expect(mockFrom).toHaveBeenCalledWith("recipes");
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({firebase_uid: "fb-recipe-001"}),
      );
      expect(mockUpdateEq).toHaveBeenCalledWith("id", "pg-recipe-uuid-001");
    });

    test("Setzt created_by via Update wenn der Ersteller aufgelöst werden konnte", async () => {
      // Lookup-Map direkt setzen (normalerweise durch buildLookupMaps befüllt)
      (job as any).userAuthUidByFirebaseUid = new Map([
        ["fb-user-001", "auth-uuid-999"],
      ]);
      const record = makeFirebaseRecord();

      await job.migrateRecord({} as any, record, authUser);

      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({created_by: "auth-uuid-999"}),
      );
    });

    test("Lässt created_by weg wenn der Ersteller nicht aufgelöst werden konnte", async () => {
      const record = makeFirebaseRecord();

      await job.migrateRecord({} as any, record, authUser);

      const updateArg = mockUpdate.mock.calls[0][0];
      expect(updateArg.created_by).toBeUndefined();
    });
  });

  /* ------------------------------------------
  // migrateRecord() — Zutaten
  // ------------------------------------------ */
  describe("migrateRecord() — Zutaten", () => {
    test("Fügt Zutaten in recipe_ingredients ein", async () => {
      const record = makeFirebaseRecord({
        ingredients: {
          entries: {
            "ing-fb-001": {
              uid: "ing-fb-001",
              posType: 0,
              product: {uid: "prod-fb-001", name: "Spaghetti"},
              quantity: 500,
              unit: "g",
              detail: "",
              scalingFactor: 1,
            },
          },
          order: ["ing-fb-001"],
        },
      });

      await job.migrateRecord({} as any, record, authUser);

      expect(mockFrom).toHaveBeenCalledWith("recipe_ingredients");
      expect(mockInsert).toHaveBeenCalledTimes(1);
      const rows = mockInsert.mock.calls[0][0];
      expect(rows).toHaveLength(1);
      expect(rows[0].firebase_uid).toBe("ing-fb-001");
      expect(rows[0].recipe_id).toBe("pg-recipe-uuid-001");
      expect(rows[0].pos_type).toBe("ingredient");
      expect(rows[0].quantity).toBe(500);
      expect(rows[0].unit).toBe("g");
      expect(rows[0].sort_order).toBe(10);
    });

    test("Abschnitt-Einträge werden korrekt als 'section' migriert", async () => {
      const record = makeFirebaseRecord({
        ingredients: {
          entries: {
            "section-fb-001": {
              uid: "section-fb-001",
              posType: 2,
              name: "Für die Sosse",
            },
          },
          order: ["section-fb-001"],
        },
      });

      await job.migrateRecord({} as any, record, authUser);

      const rows = mockInsert.mock.calls[0][0];
      expect(rows[0].pos_type).toBe("section");
      expect(rows[0].section_name).toBe("Für die Sosse");
    });

    test("Mehrere Zutaten erhalten aufsteigende sort_order (10, 20, ...)", async () => {
      const record = makeFirebaseRecord({
        ingredients: {
          entries: {
            "ing-001": {uid: "ing-001", posType: 0, quantity: 100},
            "ing-002": {uid: "ing-002", posType: 0, quantity: 200},
            "ing-003": {uid: "ing-003", posType: 0, quantity: 300},
          },
          order: ["ing-001", "ing-002", "ing-003"],
        },
      });

      await job.migrateRecord({} as any, record, authUser);

      const rows = mockInsert.mock.calls[0][0];
      expect(rows.map((row: any) => row.sort_order)).toEqual([10, 20, 30]);
    });
  });

  /* ------------------------------------------
  // migrateRecord() — Zubereitungsschritte
  // ------------------------------------------ */
  describe("migrateRecord() — Zubereitungsschritte", () => {
    test("Fügt Zubereitungsschritte in recipe_preparation_steps ein", async () => {
      const record = makeFirebaseRecord({
        preparationSteps: {
          entries: {
            "step-fb-001": {
              uid: "step-fb-001",
              posType: 1,
              step: "Zwiebeln würfeln.",
            },
          },
          order: ["step-fb-001"],
        },
      });

      await job.migrateRecord({} as any, record, authUser);

      expect(mockFrom).toHaveBeenCalledWith("recipe_preparation_steps");
      const rows = mockInsert.mock.calls[0][0];
      expect(rows).toHaveLength(1);
      expect(rows[0].firebase_uid).toBe("step-fb-001");
      expect(rows[0].pos_type).toBe("preparation_step");
      expect(rows[0].step).toBe("Zwiebeln würfeln.");
    });
  });

  /* ------------------------------------------
  // migrateRecord() — Materialpositionen
  // ------------------------------------------ */
  describe("migrateRecord() — Materialpositionen", () => {
    test("Fügt Materialpositionen in recipe_materials ein", async () => {
      const record = makeFirebaseRecord({
        materials: {
          entries: {
            "mat-fb-001": {
              uid: "mat-fb-001",
              material: {uid: "material-fb-001", name: "Topf"},
              quantity: 1,
            },
          },
          order: ["mat-fb-001"],
        },
      });

      await job.migrateRecord({} as any, record, authUser);

      expect(mockFrom).toHaveBeenCalledWith("recipe_materials");
      const rows = mockInsert.mock.calls[0][0];
      expect(rows).toHaveLength(1);
      expect(rows[0].firebase_uid).toBe("mat-fb-001");
      expect(rows[0].recipe_id).toBe("pg-recipe-uuid-001");
      expect(rows[0].quantity).toBe(1);
      expect(rows[0].sort_order).toBe(10);
    });
  });

  /* ------------------------------------------
  // migrateRecord() — Keine Kind-Datensätze
  // ------------------------------------------ */
  test("Rezept ohne Zutaten/Schritte/Materialien migriert nur Kopfdaten", async () => {
    const record = makeFirebaseRecord(); // ingredients/steps/materials sind leer

    await job.migrateRecord({} as any, record, authUser);

    expect(insertSpy).toHaveBeenCalledTimes(1);
    expect(mockFrom).toHaveBeenCalledWith("recipes");
    expect(mockFrom).not.toHaveBeenCalledWith("recipe_ingredients");
    expect(mockFrom).not.toHaveBeenCalledWith("recipe_preparation_steps");
    expect(mockFrom).not.toHaveBeenCalledWith("recipe_materials");
  });
});
