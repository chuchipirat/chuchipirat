/**
 * Unit-Tests für RecipeMigrationJob.
 *
 * Testet die Migrationsmethoden checkExists() und migrateRecord()
 * mit gemockten Firebase- und Database-Abhängigkeiten.
 * fetchSourceRecords() wird nicht getestet, da er direkt Firestore aufruft.
 */
import {RecipeMigrationJob} from "../RecipeMigrationJob";
import {SourceRecord} from "../MigrationJob.interface";
import AuthUser from "../../../Firebase/Authentication/authUser.class";

// Supabase-Clients mocken (werden in buildLookupMaps verwendet)
jest.mock("../../../Database/supabaseClient", () => ({
  supabase: {
    from: jest.fn().mockReturnValue({
      select: jest.fn().mockResolvedValue({data: [], error: null}),
    }),
  },
  supabaseAdmin: null,
}));

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

/** Erstellt einen gemockten DatabaseService mit allen benötigten Repositories */
const createDatabaseMock = () => {
  const insertedRecipeId = "pg-recipe-uuid-001";

  const recipesMock = {
    findMany: jest.fn().mockResolvedValue([]),
    insert: jest.fn().mockResolvedValue({id: insertedRecipeId}),
    patch: jest.fn().mockResolvedValue(undefined),
  };

  const ingredientsMock = {
    insert: jest.fn().mockResolvedValue({id: "pg-ingredient-uuid-001"}),
    patch: jest.fn().mockResolvedValue(undefined),
  };

  const stepsMock = {
    insert: jest.fn().mockResolvedValue({id: "pg-step-uuid-001"}),
    patch: jest.fn().mockResolvedValue(undefined),
  };

  const materialsMock = {
    insert: jest.fn().mockResolvedValue({id: "pg-material-uuid-001"}),
    patch: jest.fn().mockResolvedValue(undefined),
  };

  return {
    recipes: recipesMock,
    recipeIngredients: ingredientsMock,
    recipePreparationSteps: stepsMock,
    recipeMaterials: materialsMock,
    // admin ist undefined → Fallback auf reguläre Repositories
    admin: undefined,
  } as unknown as any;
};

/* =====================================================================
// Tests
// ===================================================================== */
describe("RecipeMigrationJob", () => {
  let job: RecipeMigrationJob;
  let database: ReturnType<typeof createDatabaseMock>;

  beforeEach(() => {
    job = new RecipeMigrationJob();
    database = createDatabaseMock();
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
      database.recipes.findMany.mockResolvedValue([]);
      const record = makeFirebaseRecord();

      const exists = await job.checkExists(database, record);

      expect(exists).toBe(false);
      expect(database.recipes.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          filters: expect.arrayContaining([
            expect.objectContaining({field: "firebase_uid", value: "fb-recipe-001"}),
          ]),
        }),
      );
    });

    test("Gibt true zurück wenn Rezept bereits migriert wurde", async () => {
      database.recipes.findMany.mockResolvedValue([{id: "pg-recipe-uuid-001"}]);
      const record = makeFirebaseRecord();

      const exists = await job.checkExists(database, record);

      expect(exists).toBe(true);
    });
  });

  /* ------------------------------------------
  // migrateRecord() — Kopfdaten
  // ------------------------------------------ */
  describe("migrateRecord() — Rezept-Kopfdaten", () => {
    test("Fügt Rezept-Kopfdaten in die recipes-Tabelle ein", async () => {
      const record = makeFirebaseRecord();

      await job.migrateRecord(database, record, authUser);

      expect(database.recipes.insert).toHaveBeenCalledTimes(1);
      const insertArg = database.recipes.insert.mock.calls[0][0].value;
      expect(insertArg.name).toBe("Spaghetti Bolognese");
      expect(insertArg.portions).toBe(4);
      expect(insertArg.recipeType).toBe("public");
    });

    test("Setzt firebase_uid und created_by via patch nach dem Insert", async () => {
      const record = makeFirebaseRecord();

      await job.migrateRecord(database, record, authUser);

      expect(database.recipes.patch).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "pg-recipe-uuid-001",
          fields: expect.objectContaining({firebase_uid: "fb-recipe-001"}),
        }),
      );
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

      await job.migrateRecord(database, record, authUser);

      expect(database.recipeIngredients.insert).toHaveBeenCalledTimes(1);
      const insertArg = database.recipeIngredients.insert.mock.calls[0][0].value;
      expect(insertArg.recipeId).toBe("pg-recipe-uuid-001");
      expect(insertArg.posType).toBe("ingredient");
      expect(insertArg.quantity).toBe(500);
      expect(insertArg.unit).toBe("g");
      expect(insertArg.sortOrder).toBe(10);
    });

    test("Setzt firebase_uid für jede Zutat via patch", async () => {
      const record = makeFirebaseRecord({
        ingredients: {
          entries: {
            "ing-fb-001": {uid: "ing-fb-001", posType: 0, quantity: 1},
          },
          order: ["ing-fb-001"],
        },
      });

      await job.migrateRecord(database, record, authUser);

      expect(database.recipeIngredients.patch).toHaveBeenCalledWith(
        expect.objectContaining({
          fields: expect.objectContaining({firebase_uid: "ing-fb-001"}),
        }),
      );
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

      await job.migrateRecord(database, record, authUser);

      const insertArg = database.recipeIngredients.insert.mock.calls[0][0].value;
      expect(insertArg.posType).toBe("section");
      expect(insertArg.sectionName).toBe("Für die Sosse");
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

      await job.migrateRecord(database, record, authUser);

      const insertArgs = database.recipeIngredients.insert.mock.calls.map(
        (call: any) => call[0].value.sortOrder,
      );
      expect(insertArgs).toEqual([10, 20, 30]);
    });
  });

  /* ------------------------------------------
  // migrateRecord() — Zubereitungsschritte
  // ------------------------------------------ */
  describe("migrateRecord() — Zubereitungsschritte", () => {
    test("Fügt Zubereitungsschritte in recipe_preparation_steps ein", async () => {
      const record = makeFirebaseRecord({
        steps: undefined,
        preparationSteps: {
          entries: {
            "step-fb-001": {
              uid: "step-fb-001",
              posType: 1,
              step: "Zwiebeln würfeln.",
            },
          },
          order: ["step-fb-001"],
        } as any,
      });
      // Direktes Setzen der preparationSteps im data-Objekt
      record.data.preparationSteps = {
        entries: {
          "step-fb-001": {uid: "step-fb-001", posType: 1, step: "Zwiebeln würfeln."},
        },
        order: ["step-fb-001"],
      };

      await job.migrateRecord(database, record, authUser);

      expect(database.recipePreparationSteps.insert).toHaveBeenCalledTimes(1);
      const insertArg = database.recipePreparationSteps.insert.mock.calls[0][0].value;
      expect(insertArg.posType).toBe("preparation_step");
      expect(insertArg.step).toBe("Zwiebeln würfeln.");
    });
  });

  /* ------------------------------------------
  // migrateRecord() — Materialpositionen
  // ------------------------------------------ */
  describe("migrateRecord() — Materialpositionen", () => {
    test("Fügt Materialpositionen in recipe_materials ein", async () => {
      const record = makeFirebaseRecord();
      record.data.materials = {
        entries: {
          "mat-fb-001": {
            uid: "mat-fb-001",
            material: {uid: "material-fb-001", name: "Topf"},
            quantity: 1,
          },
        },
        order: ["mat-fb-001"],
      };

      await job.migrateRecord(database, record, authUser);

      expect(database.recipeMaterials.insert).toHaveBeenCalledTimes(1);
      const insertArg = database.recipeMaterials.insert.mock.calls[0][0].value;
      expect(insertArg.recipeId).toBe("pg-recipe-uuid-001");
      expect(insertArg.quantity).toBe(1);
      expect(insertArg.sortOrder).toBe(10);
    });
  });

  /* ------------------------------------------
  // migrateRecord() — Keine Kind-Datensätze
  // ------------------------------------------ */
  test("Rezept ohne Zutaten/Schritte/Materialien migriert nur Kopfdaten", async () => {
    const record = makeFirebaseRecord(); // ingredients/steps/materials sind leer

    await job.migrateRecord(database, record, authUser);

    expect(database.recipes.insert).toHaveBeenCalledTimes(1);
    expect(database.recipeIngredients.insert).not.toHaveBeenCalled();
    expect(database.recipePreparationSteps.insert).not.toHaveBeenCalled();
    expect(database.recipeMaterials.insert).not.toHaveBeenCalled();
  });
});
