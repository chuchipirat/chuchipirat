/**
 * Migrationsjob für Rezepte von Firebase nach Postgres.
 *
 * Migriert alle öffentlichen und privaten Rezepte aus den Firestore-Kollektionen:
 * - `recipes/public/recipes/{uid}` (öffentliche Rezepte)
 * - `recipes/private/users/{userUid}/recipes/{uid}` (private Rezepte)
 *
 * Varianten-Rezepte (`recipes/variants/events/{eventUid}/recipes/{uid}`) werden
 * in dieser Phase NICHT migriert — sie setzen die Event-Migration voraus und
 * werden in einer späteren Phase nachgeführt.
 *
 * Pro Rezept werden folgende Datensätze in Postgres angelegt:
 * - Kopfdaten in `recipes`
 * - Zutaten und Abschnitt-Trennzeilen in `recipe_ingredients`
 * - Zubereitungsschritte und Abschnitt-Trennzeilen in `recipe_preparation_steps`
 * - Materialpositionen in `recipe_materials`
 *
 * FK-Auflösung über `firebase_uid`-Spalten:
 * - `ingredient.product.uid` → `products.firebase_uid` → `products.id`
 * - `material.material.uid`  → `materials.firebase_uid` → `materials.id`
 * - `created.fromUid`        → `users.id`              → `users.auth_uid` (= auth UUID, für created_by)
 *
 * Voraussetzungen (müssen vor dieser Migration ausgeführt worden sein):
 * - Abteilungen, Einheiten, Materialien, Produkte, Benutzer
 *
 * @example
 * const job = new RecipeMigrationJob();
 * const records = await job.fetchSourceRecords(firebase, database);
 */
import {getDocs, collectionGroup} from "firebase/firestore";
import Firebase from "../../Firebase/firebase.class";
import DatabaseService from "../../Database/DatabaseService";
import AuthUser from "../../Firebase/Authentication/authUser.class";
import {supabaseAdmin, supabase} from "../../Database/supabaseClient";
import {SupabaseClient} from "@supabase/supabase-js";
import {MigrationJob, SourceRecord} from "./MigrationJob.interface";

/* =====================================================================
// Firebase-Datenstrukturen (spiegeln die Firestore-Dokumente)
// ===================================================================== */

/**
 * Firebase-Datenstruktur eines Zutaten- oder Abschnitt-Eintrags.
 * Entspricht Ingredient | Section aus recipe.class.ts.
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
 * Entspricht PreparationStep | Section aus recipe.class.ts.
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
 * Entspricht RecipeMaterialPosition aus recipe.class.ts.
 */
interface FirebaseMaterialEntry {
  uid: string;
  material?: {uid: string; name: string};
  quantity?: number;
}

/**
 * Vollständige Firebase-Datenstruktur eines Rezepts.
 * Entspricht Recipe aus recipe.class.ts, erweitert um Migrationshilfsfelder.
 */
interface FirebaseRecipeData {
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
  /** Datum wird von Firestore als Timestamp mit .toDate() geliefert */
  created: {
    date: {toDate: () => Date} | Date | string;
    fromUid: string;
    fromDisplayName: string;
  };
  /** Ermittelt aus dem Firestore-Dokumentpfad */
  recipeType: "public" | "private";
  /** Firebase-UID des Rezept-Erstellers (aus Pfad bei privaten, aus created.fromUid bei öffentlichen) */
  firebaseCreatorUid: string;
  variantProperties?: {
    note: string;
    variantName: string;
    eventUid: string;
    originalRecipeUid: string;
    originalRecipeType: string;
    originalRecipeCreator: string;
  };
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
// RecipeMigrationJob — Migriert Rezepte von Firebase nach Postgres
// ===================================================================== */

/**
 * Migrations-Job für öffentliche und private Rezepte.
 *
 * Baut beim ersten `fetchSourceRecords`-Aufruf Lookup-Maps für Produkte,
 * Materialien und Benutzer auf, um FK-Auflösungen in `migrateRecord`
 * effizient durchzuführen (einmalige DB-Abfrage statt N+1).
 */
export class RecipeMigrationJob implements MigrationJob<FirebaseRecipeData> {
  name = "Rezepte (öffentlich + privat)";
  description =
    "Migriert alle öffentlichen und privaten Rezepte von Firebase nach Postgres. " +
    "Varianten-Rezepte werden in dieser Phase übersprungen (setzen Event-Migration voraus). " +
    "Setzt voraus, dass Benutzer, Produkte und Materialien bereits migriert sind.";

  /** firebase_uid → Postgres-ID für Produkte */
  private productIdByFirebaseUid: Map<string, string> = new Map();
  /** firebase_uid → Postgres-ID für Materialien */
  private materialIdByFirebaseUid: Map<string, string> = new Map();
  /** firebase_uid → Supabase-Auth-UUID für Benutzer */
  private userAuthUidByFirebaseUid: Map<string, string> = new Map();

  /* =====================================================================
  // Alle Rezepte aus Firebase lesen
  // ===================================================================== */
  /**
   * Liest alle öffentlichen und privaten Rezepte aus Firestore über
   * eine collectionGroup-Abfrage. Varianten (Pfad enthält '/variants/')
   * werden übersprungen.
   *
   * Baut ausserdem Lookup-Maps für FK-Auflösungen auf.
   *
   * @param firebase - Firebase-Instanz
   * @param database - DatabaseService-Instanz (optional, für FK-Maps)
   * @returns Array aller Rezept-Quelldatensätze
   */
  async fetchSourceRecords(
    firebase: Firebase,
    database?: DatabaseService,
  ): Promise<SourceRecord<FirebaseRecipeData>[]> {
    // FK-Lookup-Maps aus Postgres aufbauen (einmalig pro Migrations-Lauf)
    if (database) {
      await this.buildLookupMaps(database);
    }

    // Alle 'recipes'-Subcollections in Firestore laden (public + private + variants)
    const snapshot = await getDocs(
      collectionGroup(firebase.firestore, "recipes"),
    );

    const records: SourceRecord<FirebaseRecipeData>[] = [];

    for (const document of snapshot.docs) {
      const path = document.ref.path;

      // Varianten in dieser Phase überspringen
      if (path.includes("/variants/")) {
        continue;
      }

      const value = document.data();
      const uid = document.id;

      // Rezepttyp und Ersteller-UID aus dem Firestore-Pfad ableiten
      let recipeType: "public" | "private";
      let firebaseCreatorUid = "";

      if (path.startsWith("recipes/public/")) {
        recipeType = "public";
        // Bei öffentlichen Rezepten: Ersteller aus created.fromUid
        firebaseCreatorUid = value.created?.fromUid ?? "";
      } else if (path.includes("/private/")) {
        recipeType = "private";
        // Pfadstruktur: recipes/private/users/{userUid}/recipes/{recipeUid}
        const pathSegments = path.split("/");
        const userUidIndex = pathSegments.indexOf("users") + 1;
        firebaseCreatorUid =
          userUidIndex > 0 ? (pathSegments[userUidIndex] ?? "") : "";
      } else {
        // Unbekannter Pfad – überspringen
        continue;
      }

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
          recipeType,
          firebaseCreatorUid,
          variantProperties: value.variantProperties ?? undefined,
        },
      });
    }

    return records;
  }

  /* =====================================================================
  // Prüfen, ob ein Rezept bereits in Postgres existiert
  // ===================================================================== */
  /**
   * Prüft anhand der `firebase_uid`, ob das Rezept bereits migriert wurde.
   *
   * @param database - DatabaseService-Instanz
   * @param record - Der zu prüfende Quelldatensatz
   * @returns true, falls das Rezept bereits vorhanden ist
   */
  async checkExists(
    database: DatabaseService,
    record: SourceRecord<FirebaseRecipeData>,
  ): Promise<boolean> {
    const recipes = database.admin?.recipes ?? database.recipes;
    const existing = await recipes.findMany({
      filters: [{field: "firebase_uid", operator: "eq", value: record.id}],
    });
    return existing.length > 0;
  }

  /* =====================================================================
  // Einzelnes Rezept nach Postgres migrieren
  // ===================================================================== */
  /**
   * Fügt ein Rezept inklusive aller Kindtabellen in Postgres ein.
   *
   * Reihenfolge:
   * 1. Rezept-Kopfdaten (recipes)
   * 2. Zutaten / Abschnitt-Trennzeilen (recipe_ingredients)
   * 3. Zubereitungsschritte / Abschnitt-Trennzeilen (recipe_preparation_steps)
   * 4. Materialpositionen (recipe_materials)
   *
   * @param database - DatabaseService-Instanz
   * @param record - Der zu migrierende Quelldatensatz
   * @param authUser - Der angemeldete Admin-Benutzer
   */
  async migrateRecord(
    database: DatabaseService,
    record: SourceRecord<FirebaseRecipeData>,
    authUser: AuthUser,
  ): Promise<void> {
    const data = record.data;
    const recipes = database.admin?.recipes ?? database.recipes;
    const ingredients = database.admin?.recipeIngredients ?? database.recipeIngredients;
    const steps = database.admin?.recipePreparationSteps ?? database.recipePreparationSteps;
    const materials = database.admin?.recipeMaterials ?? database.recipeMaterials;

    // 1. Supabase-Auth-UUID des Erstellers auflösen (für created_by / RLS)
    const createdBy =
      this.userAuthUidByFirebaseUid.get(data.firebaseCreatorUid) ?? null;

    // 2. Rezept-Kopfdaten einfügen
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
        recipeType: data.recipeType,
        variantProperties: undefined,
        createdAt: new Date(0),
        createdBy: "",
      },
      authUser,
    });

    // firebase_uid und created_by (für RLS) nachträglich setzen
    await recipes.patch({
      id: recipeId,
      fields: {
        firebase_uid: record.id,
        // created_by muss explizit gesetzt werden, damit RLS für private Rezepte greift
        ...(createdBy ? {created_by: createdBy} : {}),
      },
      authUser,
    });

    // 3. Zutaten und Abschnitt-Trennzeilen einfügen
    const ingredientOrder: string[] = data.ingredients?.order ?? [];
    const ingredientEntries = data.ingredients?.entries ?? {};
    let sortOrder = 10;

    for (const entryUid of ingredientOrder) {
      const entry = ingredientEntries[entryUid];
      if (!entry) {
        continue;
      }

      // Produkt-FK auflösen
      const productId = entry.product?.uid
        ? (this.productIdByFirebaseUid.get(entry.product.uid) ?? null)
        : null;

      const {id: ingredientId} = await ingredients.insert({
        value: {
          uid: "",
          recipeId,
          sortOrder,
          posType: ingredientPosTypeToDb(entry.posType ?? 0),
          productId,
          // Number.isFinite verhindert, dass NaN/Infinity als JSON-null ankommen
          quantity: Number.isFinite(entry.quantity) ? (entry.quantity as number) : 0,
          // Leerer String ist kein gültiger units.key → als null speichern
          unit: entry.unit || null,
          detail: entry.detail ?? "",
          scalingFactor: entry.scalingFactor ?? 1,
          sectionName: entry.name ?? "",
        },
        authUser,
      });

      // firebase_uid der Zutat setzen
      await ingredients.patch({
        id: ingredientId,
        fields: {firebase_uid: entryUid},
        authUser,
      });

      sortOrder += 10;
    }

    // 4. Zubereitungsschritte und Abschnitt-Trennzeilen einfügen
    const stepOrder: string[] = data.preparationSteps?.order ?? [];
    const stepEntries = data.preparationSteps?.entries ?? {};
    sortOrder = 10;

    for (const entryUid of stepOrder) {
      const entry = stepEntries[entryUid];
      if (!entry) {
        continue;
      }

      const {id: stepId} = await steps.insert({
        value: {
          uid: "",
          recipeId,
          sortOrder,
          posType: stepPosTypeToDb(entry.posType ?? 1),
          step: entry.step ?? "",
          sectionName: entry.name ?? "",
        },
        authUser,
      });

      await steps.patch({
        id: stepId,
        fields: {firebase_uid: entryUid},
        authUser,
      });

      sortOrder += 10;
    }

    // 5. Materialpositionen einfügen
    const materialOrder: string[] = data.materials?.order ?? [];
    const materialEntries = data.materials?.entries ?? {};
    sortOrder = 10;

    for (const entryUid of materialOrder) {
      const entry = materialEntries[entryUid];
      if (!entry) {
        continue;
      }

      // Material-FK auflösen
      const materialId = entry.material?.uid
        ? (this.materialIdByFirebaseUid.get(entry.material.uid) ?? null)
        : null;

      const {id: materialRowId} = await materials.insert({
        value: {
          uid: "",
          recipeId,
          sortOrder,
          materialId,
          quantity: Number.isFinite(entry.quantity) ? (entry.quantity as number) : 0,
        },
        authUser,
      });

      await materials.patch({
        id: materialRowId,
        fields: {firebase_uid: entryUid},
        authUser,
      });

      sortOrder += 10;
    }
  }

  /* =====================================================================
  // Hilfsmethode: FK-Lookup-Maps aufbauen
  // ===================================================================== */
  /**
   * Lädt alle Produkte, Materialien und Benutzer aus Postgres und
   * befüllt die internen Lookup-Maps für schnelle FK-Auflösungen.
   *
   * Verwendet `supabaseAdmin` (Service Role) für den direkten Zugriff auf
   * die `firebase_uid`-Spalten, die nicht Teil der Domain-Modelle sind.
   * Fällt auf den Anon-Client zurück, falls kein Admin-Client konfiguriert ist.
   *
   * Wird einmalig beim Start von `fetchSourceRecords` aufgerufen.
   *
   * @param _database - DatabaseService-Instanz (nicht verwendet, Admin-Client direkt)
   */
  private async buildLookupMaps(_database: DatabaseService): Promise<void> {
    // Für reine Lookup-Queries verwenden wir den Admin-Client direkt,
    // da die Domain-Objekte die firebase_uid-Spalte nicht enthalten.
    const client: SupabaseClient = supabaseAdmin ?? supabase;

    // Produkte: firebase_uid → Postgres-id
    const {data: productRows, error: productError} = await client
      .from("products")
      .select("id, firebase_uid");

    if (productError) throw productError;

    for (const row of productRows ?? []) {
      if (row.firebase_uid) {
        this.productIdByFirebaseUid.set(row.firebase_uid as string, row.id as string);
      }
    }

    // Materialien: firebase_uid → Postgres-id
    const {data: materialRows, error: materialError} = await client
      .from("materials")
      .select("id, firebase_uid");

    if (materialError) throw materialError;

    for (const row of materialRows ?? []) {
      if (row.firebase_uid) {
        this.materialIdByFirebaseUid.set(row.firebase_uid as string, row.id as string);
      }
    }

    // Benutzer: users.id IS der Firebase-UID (TEXT PRIMARY KEY), auth_uid ist die Supabase-UUID.
    // Die users-Tabelle hat keine firebase_uid-Spalte — id dient direkt als Firebase-Identifier.
    const {data: userRows, error: userError} = await client
      .from("users")
      .select("id, auth_uid");

    if (userError) throw userError;

    for (const row of userRows ?? []) {
      if (row.id && row.auth_uid) {
        this.userAuthUidByFirebaseUid.set(
          row.id as string,
          row.auth_uid as string,
        );
      }
    }
  }
}
