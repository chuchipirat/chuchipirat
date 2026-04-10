/**
 * Migrationsjob für Varianten-Rezepte von Firebase nach Postgres.
 *
 * Migriert alle Varianten-Rezepte aus den Firestore-Kollektionen:
 * - `recipes/variants/events/{firebaseEventUid}/recipes/{recipeUid}`
 *
 * Pro Varianten-Rezept werden folgende Datensätze in Postgres angelegt:
 * - Kopfdaten in `recipes` (mit `recipe_type = 'variant'`)
 * - Zutaten und Abschnitt-Trennzeilen in `recipe_ingredients`
 * - Zubereitungsschritte und Abschnitt-Trennzeilen in `recipe_preparation_steps`
 * - Materialpositionen in `recipe_materials`
 *
 * FK-Auflösung über `firebase_uid`-Spalten:
 * - `variantProperties.eventUid`            → `events.firebase_uid`   → `events.id`
 * - `variantProperties.originalRecipeUid`   → `recipes.firebase_uid`  → `recipes.id`
 * - `variantProperties.originalRecipeCreator`→ `users.legacy_firebase_uid` → `users.id`
 * - `ingredient.product.uid`                → `products.firebase_uid` → `products.id`
 * - `material.material.uid`                 → `materials.firebase_uid`→ `materials.id`
 * - `created.fromUid`                       → `users.legacy_firebase_uid` → `users.id`
 *
 * Voraussetzungen (müssen vor dieser Migration ausgeführt worden sein):
 * - Benutzer, Produkte, Materialien, Rezepte (öffentlich/privat), Events
 *
 * @example
 * const job = new RecipeVariantMigrationJob();
 * const records = await job.fetchSourceRecords(firebase, database);
 */
import {getDocs, collection} from "firebase/firestore";
import Firebase from "../../Firebase/firebase.class";
import DatabaseService from "../../Database/DatabaseService";
import AuthUser from "../../Firebase/Authentication/authUser.class";
import {supabaseAdmin} from "../../Database/supabaseClient";
import {MigrationJob, SourceRecord, fetchAllRows} from "./MigrationJob.interface";

/* =====================================================================
// Firebase-Datenstrukturen (spiegeln die Firestore-Dokumente)
// ===================================================================== */

/**
 * Firebase-Datenstruktur eines Zutaten- oder Abschnitt-Eintrags.
 */
interface FirebaseIngredientEntry {
  uid: string;
  /** 0=ingredient, 2=section (PositionType-Enum) */
  posType: number;
  product?: {uid: string; name: string};
  quantity?: number;
  unit?: string;
  detail?: string;
  scalingFactor?: number;
  /** Name des Abschnitts (nur bei posType=2) */
  name?: string;
}

/**
 * Firebase-Datenstruktur eines Zubereitungsschritt- oder Abschnitt-Eintrags.
 */
interface FirebaseStepEntry {
  uid: string;
  /** 1=preparationStep, 2=section (PositionType-Enum) */
  posType: number;
  step?: string;
  /** Name des Abschnitts (nur bei posType=2) */
  name?: string;
}

/**
 * Firebase-Datenstruktur einer Materialposition.
 */
interface FirebaseMaterialEntry {
  uid: string;
  material?: {uid: string; name: string};
  quantity?: number;
}

/**
 * Vollständige Firebase-Datenstruktur eines Varianten-Rezepts.
 */
interface FirebaseVariantRecipeData {
  name: string;
  portions: number;
  source: string;
  times: {preparation: number; rest: number; cooking: number};
  pictureSrc: string;
  note: string;
  tags: string[];
  ingredients: {
    entries: {[uid: string]: FirebaseIngredientEntry};
    order: string[];
  };
  preparationSteps: {
    entries: {[uid: string]: FirebaseStepEntry};
    order: string[];
  };
  materials: {
    entries: {[uid: string]: FirebaseMaterialEntry};
    order: string[];
  };
  dietProperties: {allergens: number[]; diet: number};
  menuTypes: number[];
  outdoorKitchenSuitable: boolean;
  isInReview: boolean;
  rating: {avgRating: number; noRatings: number};
  created: {
    date: {toDate: () => Date} | Date | string;
    fromUid: string;
    fromDisplayName: string;
  };
  variantProperties: {
    note: string;
    variantName: string;
    eventUid: string;
    originalRecipeUid: string;
    originalRecipeType: string;
    originalRecipeCreator: string;
    originalRecipeName: string;
  };
  /** Firebase-Event-UID aus dem Dokumentpfad */
  firebaseEventUid: string;
  /** Firebase-UID des Rezept-Erstellers */
  firebaseCreatorUid: string;
}

/* =====================================================================
// Hilfsfunktionen
// ===================================================================== */

/**
 * Ordnet den numerischen PositionType-Enum-Wert dem DB-Enum-String
 * für `recipe_ingredients` zu.
 *
 * @param posType - Numerischer PositionType-Wert (0=ingredient, 2=section)
 * @returns DB-ENUM-String
 */
const ingredientPosTypeToDb = (posType: number): string => {
  return posType === 2 ? "section" : "ingredient";
};

/**
 * Ordnet den numerischen PositionType-Enum-Wert dem DB-Enum-String
 * für `recipe_preparation_steps` zu.
 *
 * @param posType - Numerischer PositionType-Wert (1=preparation_step, 2=section)
 * @returns DB-ENUM-String
 */
const stepPosTypeToDb = (posType: number): string => {
  return posType === 2 ? "section" : "preparation_step";
};

/* =====================================================================
// RecipeVariantMigrationJob — Migriert Varianten-Rezepte
// ===================================================================== */

/**
 * Migrations-Job für Varianten-Rezepte.
 *
 * Baut beim ersten `fetchSourceRecords`-Aufruf Lookup-Maps für Events, Rezepte,
 * Produkte, Materialien und Benutzer auf, um FK-Auflösungen in `migrateRecord`
 * effizient durchzuführen (einmalige DB-Abfrage statt N+1).
 */
export class RecipeVariantMigrationJob
  implements MigrationJob<FirebaseVariantRecipeData>
{
  name = "Rezepte (Varianten)";
  description =
    "Migriert alle Varianten-Rezepte von Firebase nach Postgres. " +
    "Setzt voraus, dass Benutzer, Produkte, Materialien, Rezepte und Events bereits migriert sind.";

  /** firebase_uid → Postgres-UUID für Events */
  private eventIdByFirebaseUid: Map<string, string> = new Map();
  /** firebase_uid → Postgres-UUID für Rezepte */
  private recipeIdByFirebaseUid: Map<string, string> = new Map();
  /** firebase_uid → Postgres-UUID für Produkte */
  private productIdByFirebaseUid: Map<string, string> = new Map();
  /** firebase_uid → Postgres-UUID für Materialien */
  private materialIdByFirebaseUid: Map<string, string> = new Map();
  /** firebase_uid → Supabase-Auth-UUID für Benutzer */
  private userAuthUidByFirebaseUid: Map<string, string> = new Map();
  /** Bereits migrierte Rezepte (firebase_uid) — für schnelle checkExists-Prüfung */
  private existingFirebaseUids: Set<string> | null = null;

  /* =====================================================================
  // Alle Varianten-Rezepte aus Firebase lesen
  // ===================================================================== */
  /**
   * Liest alle Varianten-Rezepte aus Firestore.
   * Iteriert über `recipes/variants/events/` und liest die Subcollection `recipes/`
   * jedes Events.
   *
   * Baut ausserdem Lookup-Maps für FK-Auflösungen auf.
   *
   * @param firebase - Firebase-Instanz
   * @param database - DatabaseService-Instanz (für FK-Maps)
   * @returns Array aller Varianten-Rezept-Quelldatensätze
   */
  async fetchSourceRecords(
    firebase: Firebase,
    database?: DatabaseService,
  ): Promise<SourceRecord<FirebaseVariantRecipeData>[]> {
    if (database) {
      await this.buildLookupMaps(database);
    }

    // Bereits migrierte Rezepte laden (für schnelle checkExists-Prüfung)
    const existingRows = await fetchAllRows(
      supabaseAdmin!, "recipes", "firebase_uid",
      (query) => query.not("firebase_uid", "is", null),
    );
    this.existingFirebaseUids = new Set(
      existingRows.map((row) => row.firebase_uid as string),
    );

    const records: SourceRecord<FirebaseVariantRecipeData>[] = [];

    // Alle Event-Dokumente unter recipes/variants/events/ lesen
    const eventsSnapshot = await getDocs(
      collection(firebase.firestore, "recipes/variants/events"),
    );

    for (const eventDoc of eventsSnapshot.docs) {
      const firebaseEventUid = eventDoc.id;

      // Varianten-Rezepte für dieses Event laden
      const recipesSnapshot = await getDocs(
        collection(
          firebase.firestore,
          `recipes/variants/events/${firebaseEventUid}/recipes`,
        ),
      );

      for (const recipeDoc of recipesSnapshot.docs) {
        const value = recipeDoc.data();
        const uid = recipeDoc.id;

        records.push({
          id: uid,
          label: value.name ?? uid,
          data: {
            name: value.name ?? "",
            portions: value.portions ?? 0,
            source: value.source ?? "",
            times: {
              preparation: value.times?.preparation ?? 0,
              rest: value.times?.rest ?? 0,
              cooking: value.times?.cooking ?? 0,
            },
            pictureSrc: value.pictureSrc ?? "",
            note: value.note ?? "",
            tags: value.tags ?? [],
            ingredients: value.ingredients ?? {entries: {}, order: []},
            preparationSteps: value.preparationSteps ?? {
              entries: {},
              order: [],
            },
            materials: value.materials ?? {entries: {}, order: []},
            dietProperties: value.dietProperties ?? {allergens: [], diet: 1},
            menuTypes: value.menuTypes ?? [],
            outdoorKitchenSuitable: value.outdoorKitchenSuitable ?? false,
            isInReview: value.isInReview ?? false,
            rating: value.rating ?? {avgRating: 0, noRatings: 0},
            created: value.created ?? {
              date: new Date(0),
              fromUid: "",
              fromDisplayName: "",
            },
            variantProperties: {
              note: value.variantProperties?.note ?? "",
              variantName: value.variantProperties?.variantName ?? "",
              eventUid: value.variantProperties?.eventUid ?? firebaseEventUid,
              originalRecipeUid:
                value.variantProperties?.originalRecipeUid ?? "",
              originalRecipeType:
                value.variantProperties?.originalRecipeType ?? "",
              originalRecipeCreator:
                value.variantProperties?.originalRecipeCreator ?? "",
              originalRecipeName:
                value.variantProperties?.originalRecipeName ?? "",
            },
            firebaseEventUid,
            firebaseCreatorUid: value.created?.fromUid ?? "",
          },
        });
      }
    }

    return records;
  }

  /* =====================================================================
  // Prüfen, ob ein Varianten-Rezept bereits in Postgres existiert
  // ===================================================================== */
  /**
   * Prüft anhand der `firebase_uid`, ob das Varianten-Rezept bereits migriert wurde.
   *
   * @param database - DatabaseService-Instanz
   * @param record - Der zu prüfende Quelldatensatz
   * @returns true, falls das Rezept bereits vorhanden ist
   */
  async checkExists(
    _database: DatabaseService,
    record: SourceRecord<FirebaseVariantRecipeData>,
  ): Promise<boolean> {
    // In-Memory-Prüfung gegen vorab geladene Set (kein DB-Roundtrip)
    return this.existingFirebaseUids?.has(record.id) ?? false;
  }

  /* =====================================================================
  // Einzelnes Varianten-Rezept nach Postgres migrieren
  // ===================================================================== */
  /**
   * Fügt ein Varianten-Rezept inklusive aller Kindtabellen in Postgres ein.
   *
   * Überspringt das Rezept, wenn das zugehörige Event oder das Original-Rezept
   * noch nicht migriert wurden (FK-Auflösung schlägt fehl).
   *
   * Reihenfolge:
   * 1. FK-Auflösung (Event, Original-Rezept, Ersteller)
   * 2. Rezept-Kopfdaten (recipes) mit variant-spezifischen Feldern
   * 3. Zutaten / Abschnitt-Trennzeilen (recipe_ingredients)
   * 4. Zubereitungsschritte / Abschnitt-Trennzeilen (recipe_preparation_steps)
   * 5. Materialpositionen (recipe_materials)
   *
   * @param database - DatabaseService-Instanz
   * @param record - Der zu migrierende Quelldatensatz
   * @param authUser - Der angemeldete Admin-Benutzer
   * @throws {Error} Wenn Event oder Original-Rezept nicht aufgelöst werden können
   */
  async migrateRecord(
    database: DatabaseService,
    record: SourceRecord<FirebaseVariantRecipeData>,
    authUser: AuthUser,
  ): Promise<void> {
    const data = record.data;
    const client = supabaseAdmin!;
    const recipes = database.recipes;

    // 1. FK-Auflösung: Event
    const variantEventUid = this.eventIdByFirebaseUid.get(
      data.firebaseEventUid,
    );
    if (!variantEventUid) {
      throw new Error(
        `Event mit Firebase-UID '${data.firebaseEventUid}' nicht gefunden — Event noch nicht migriert?`,
      );
    }

    // 2. FK-Auflösung: Original-Rezept (kann null sein, wenn das Original gelöscht wurde)
    const variantOriginalRecipeUid = this.recipeIdByFirebaseUid.get(
      data.variantProperties.originalRecipeUid,
    ) ?? null;

    // 3. FK-Auflösung: Ersteller des Originals und des Varianten-Rezepts
    const variantOriginalRecipeCreator =
      this.userAuthUidByFirebaseUid.get(
        data.variantProperties.originalRecipeCreator,
      ) ?? null;
    const createdBy =
      this.userAuthUidByFirebaseUid.get(data.firebaseCreatorUid) ?? null;

    // 4. Rezept-Kopfdaten einfügen (via Repository für Enum-Mapping)
    const {id: recipeId} = await recipes.insert({
      value: {
        uid: "",
        name: data.name,
        portions: data.portions,
        source: data.source,
        times: data.times,
        pictureSrc: data.pictureSrc,
        note: data.note,
        tags: data.tags,
        menuTypes: data.menuTypes,
        dietProperties: data.dietProperties,
        outdoorKitchenSuitable: data.outdoorKitchenSuitable,
        usable: true,
        avgRating: data.rating?.avgRating ?? 0,
        noRatings: data.rating?.noRatings ?? 0,
        recipeType: "variant",
        variantProperties: {
          variantName: data.variantProperties.variantName,
          note: data.variantProperties.note,
          eventUid: variantEventUid,
          originalRecipeUid: variantOriginalRecipeUid ?? "",
          originalRecipeType: data.variantProperties.originalRecipeType || "public",
          originalRecipeCreatorUid: variantOriginalRecipeCreator ?? "",
        },
        createdAt: new Date(0),
        createdBy: "",
      },
      authUser,
    });

    // firebase_uid und created_by nachträglich setzen
    await client
      .from("recipes")
      .update({
        firebase_uid: record.id,
        ...(createdBy ? {created_by: createdBy} : {}),
      })
      .eq("id", recipeId);

    // 5. Zutaten als Batch einfügen (1 INSERT statt 2×N Einzelabfragen)
    const ingredientOrder: string[] = data.ingredients?.order ?? [];
    const ingredientEntries = data.ingredients?.entries ?? {};
    const ingredientRows: Record<string, unknown>[] = [];
    let sortOrder = 10;

    for (const entryUid of ingredientOrder) {
      const entry = ingredientEntries[entryUid];
      if (!entry) continue;

      const productId = entry.product?.uid
        ? (this.productIdByFirebaseUid.get(entry.product.uid) ?? null)
        : null;

      ingredientRows.push({
        firebase_uid: entryUid,
        recipe_id: recipeId,
        sort_order: sortOrder,
        pos_type: ingredientPosTypeToDb(entry.posType ?? 0),
        product_id: productId,
        quantity: Number.isFinite(entry.quantity) ? entry.quantity : 0,
        unit: entry.unit || null,
        detail: entry.detail ?? "",
        scaling_factor: Number.isFinite(entry.scalingFactor) ? entry.scalingFactor : 1,
        section_name: entry.name ?? "",
      });
      sortOrder += 10;
    }

    if (ingredientRows.length > 0) {
      const {error: ingredientError} = await client
        .from("recipe_ingredients")
        .insert(ingredientRows);
      if (ingredientError) throw ingredientError;
    }

    // 6. Zubereitungsschritte als Batch einfügen
    const stepOrder: string[] = data.preparationSteps?.order ?? [];
    const stepEntries = data.preparationSteps?.entries ?? {};
    const stepRows: Record<string, unknown>[] = [];
    sortOrder = 10;

    for (const entryUid of stepOrder) {
      const entry = stepEntries[entryUid];
      if (!entry) continue;

      stepRows.push({
        firebase_uid: entryUid,
        recipe_id: recipeId,
        sort_order: sortOrder,
        pos_type: stepPosTypeToDb(entry.posType ?? 1),
        step: entry.step ?? "",
        section_name: entry.name ?? "",
      });
      sortOrder += 10;
    }

    if (stepRows.length > 0) {
      const {error: stepError} = await client
        .from("recipe_preparation_steps")
        .insert(stepRows);
      if (stepError) throw stepError;
    }

    // 7. Materialpositionen als Batch einfügen
    const materialOrder: string[] = data.materials?.order ?? [];
    const materialEntries = data.materials?.entries ?? {};
    const materialRows: Record<string, unknown>[] = [];
    sortOrder = 10;

    for (const entryUid of materialOrder) {
      const entry = materialEntries[entryUid];
      if (!entry) continue;

      const materialId = entry.material?.uid
        ? (this.materialIdByFirebaseUid.get(entry.material.uid) ?? null)
        : null;

      materialRows.push({
        firebase_uid: entryUid,
        recipe_id: recipeId,
        sort_order: sortOrder,
        material_id: materialId,
        quantity: Number.isFinite(entry.quantity) ? entry.quantity : 0,
      });
      sortOrder += 10;
    }

    if (materialRows.length > 0) {
      const {error: materialError} = await client
        .from("recipe_materials")
        .insert(materialRows);
      if (materialError) throw materialError;
    }
  }

  /* =====================================================================
  // Hilfsmethode: FK-Lookup-Maps aufbauen
  // ===================================================================== */
  /**
   * Lädt Events, Rezepte, Produkte, Materialien und Benutzer aus Postgres
   * und befüllt die internen Lookup-Maps für schnelle FK-Auflösungen.
   *
   * Verwendet den Supabase-Client für den direkten Zugriff auf
   * die `firebase_uid`-Spalten, die nicht Teil der Domain-Modelle sind.
   *
   * @param _database - DatabaseService-Instanz (nicht verwendet, Admin-Client direkt)
   */
  private async buildLookupMaps(_database: DatabaseService): Promise<void> {
    const client = supabaseAdmin!;

    const [eventRows, recipeRows, productRows, materialRows, userRows] = await Promise.all([
      fetchAllRows(client, "events", "id, firebase_uid"),
      fetchAllRows(client, "recipes", "id, firebase_uid"),
      fetchAllRows(client, "products", "id, firebase_uid"),
      fetchAllRows(client, "materials", "id, firebase_uid"),
      fetchAllRows(client, "users", "id, legacy_firebase_uid",
        (query) => query.not("legacy_firebase_uid", "is", null)),
    ]);

    for (const row of eventRows) {
      if (row.firebase_uid) {
        this.eventIdByFirebaseUid.set(row.firebase_uid as string, row.id as string);
      }
    }
    for (const row of recipeRows) {
      if (row.firebase_uid) {
        this.recipeIdByFirebaseUid.set(row.firebase_uid as string, row.id as string);
      }
    }
    for (const row of productRows) {
      if (row.firebase_uid) {
        this.productIdByFirebaseUid.set(row.firebase_uid as string, row.id as string);
      }
    }
    for (const row of materialRows) {
      if (row.firebase_uid) {
        this.materialIdByFirebaseUid.set(row.firebase_uid as string, row.id as string);
      }
    }
    for (const row of userRows) {
      if (row.legacy_firebase_uid && row.id) {
        this.userAuthUidByFirebaseUid.set(row.legacy_firebase_uid as string, row.id as string);
      }
    }
  }
}
