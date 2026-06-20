/**
 * Migrationsjob für Menupläne von Firebase nach Postgres.
 *
 * Migriert alle Menuplan-Dokumente aus `events/{uid}/docs/menuplan`.
 * Legt pro Event folgende Datensätze an:
 * - Mahlzeitentypen (event_meal_types)
 * - Mahlzeit-Slots (event_meals)
 * - Menü-Container (event_menues)
 * - Rezepte im Menü (event_menue_recipes)
 * - Produkte im Menü (event_menue_products)
 * - Materialien im Menü (event_menue_materials)
 * - Plan-Zeilen (event_menuplan_item_plans)
 * - Notizen (event_notes)
 *
 * FK-Auflösungen:
 * - Event-Firebase-UID → events.firebase_uid → events.id
 * - Recipe-Firebase-UID → recipes.firebase_uid → recipes.id
 * - Product-Firebase-UID → products.firebase_uid → products.id
 * - Material-Firebase-UID → materials.firebase_uid → materials.id
 * - Diet-Firebase-UID → event_groupconfiguration_diets.firebase_uid → id
 * - Intolerance-Firebase-UID → event_groupconfiguration_intolerances.firebase_uid → id
 *
 * Voraussetzungen (müssen vor diesem Job ausgeführt worden sein):
 * - Events, Gruppenconfig, Rezepte, Produkte, Materialien
 *
 * @example
 * const job = new MenuplanMigrationJob();
 * const records = await job.fetchSourceRecords(firebase, database);
 */
import {collection, doc, getDoc, getDocs} from "firebase/firestore";
import Firebase from "../../Firebase/firebase.class";
import DatabaseService from "../../Database/DatabaseService";
import AuthUser from "../../Firebase/Authentication/authUser.class";
import {supabaseAdmin} from "../../Database/supabaseClient";

import {MigrationJob, SourceRecord, fetchAllRows} from "./MigrationJob.interface";

/* =====================================================================
// Firebase-Datenstrukturen
// ===================================================================== */

/** Plan-Zeile eines Rezepts/Produkts/Materials im Firebase-Menuplan. */
interface FirebasePortionPlan {
  diet: string;         // "ALL", "FIX", oder Firebase-UID einer Diät
  intolerance: string;  // "ALL", "FIX", oder Firebase-UID einer Unverträglichkeit
  factor: number;
  totalPortions: number;
}

/** Rezept-Eintrag im Firebase-Menuplan (in einem Menü). */
interface FirebaseMealRecipe {
  uid: string;
  recipe: {
    recipeUid: string;
    name: string;
    type?: string;
    createdFromUid?: string;
    variantName?: string;
  };
  plan: FirebasePortionPlan[];
  totalPortions: number;
}

/** Produkt-Eintrag im Firebase-Menuplan. */
interface FirebaseMenuplanProduct {
  uid: string;
  productUid: string;
  productName: string;
  quantity: number;
  unit: string;
  planMode: number; // 0=TOTAL, 1=PER_PORTION
  plan: FirebasePortionPlan[];
  totalQuantity: number;
}

/** Material-Eintrag im Firebase-Menuplan. */
interface FirebaseMenuplanMaterial {
  uid: string;
  materialUid: string;
  materialName: string;
  quantity: number;
  unit?: string;
  planMode: number;
  plan: FirebasePortionPlan[];
  totalQuantity: number;
}

/** Menü-Container im Firebase-Menuplan. */
interface FirebaseMenue {
  uid: string;
  name: string;
  mealRecipeOrder: string[];
  productOrder: string[];
  materialOrder: string[];
}

/** Mahlzeit-Slot im Firebase-Menuplan. */
interface FirebaseMeal {
  uid: string;
  date: string;         // YYYY-MM-DD
  mealType: string;     // Firebase-UID des MealType
  mealTypeName?: string;
  menuOrder: string[];  // UIDs der Menüs
}

/** Notiz im Firebase-Menuplan. */
interface FirebaseNote {
  uid: string;
  date: string;         // YYYY-MM-DD
  menueUid: string;
  text: string;
}

/** Mahlzeitentyp im Firebase-Menuplan. */
interface FirebaseMealType {
  uid: string;
  name: string;
}

/** Vollständige Firebase-Datenstruktur eines Menuplans. */
interface FirebaseMenuplanData {
  /** Firebase-UID des Events */
  eventFirebaseUid: string;
  mealTypes: {
    entries: {[uid: string]: FirebaseMealType};
    order: string[];
  };
  meals: {[uid: string]: FirebaseMeal};
  menuOrder: string[];  // Reihenfolge der Mahlzeiten
  menues: {[uid: string]: FirebaseMenue};
  mealRecipes: {[uid: string]: FirebaseMealRecipe};
  products: {[uid: string]: FirebaseMenuplanProduct};
  materials: {[uid: string]: FirebaseMenuplanMaterial};
  notes: {[uid: string]: FirebaseNote};
}

/* =====================================================================
// Hilfsfunktionen
// ===================================================================== */

/**
 * Konvertiert den numerischen GoodsPlanMode-Enum-Wert in den DB-Enum-String.
 *
 * @param planMode - 0 = TOTAL, 1 = PER_PORTION
 * @returns DB-Enum-String
 */
const planModeToDb = (planMode: number): string => {
  return planMode === 1 ? "per_portion" : "total";
};

/**
 * Normalisiert einen Datumswert aus Firebase zu einem lokalen YYYY-MM-DD String.
 *
 * Firebase kann Daten als String ("YYYY-MM-DD", "Thu May 16 2024 ...") oder als
 * Objekt ({seconds, nanoseconds}) liefern. new Date("YYYY-MM-DD") parst als UTC,
 * was in CET/CEST zum Vortag werden kann. Diese Funktion stellt sicher, dass das
 * Datum als lokales Datum interpretiert wird.
 *
 * @param value - Datumswert aus Firebase
 * @returns YYYY-MM-DD String im lokalen Zeitraum, oder null bei ungültigem Input
 */
const normalizeDateToLocalYmd = (value: unknown): string | null => {
  if (!value) return null;

  let date: Date;
  if (typeof value === "string") {
    // Wenn bereits YYYY-MM-DD: als lokales Datum parsen
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      date = new Date(value + "T00:00:00");
    } else {
      date = new Date(value);
    }
  } else if (typeof value === "object" && "seconds" in (value as Record<string, unknown>)) {
    // Firestore Timestamp
    date = new Date((value as {seconds: number}).seconds * 1000);
  } else {
    return null;
  }

  if (isNaN(date.getTime())) return null;

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

/**
 * Gibt einen sicheren numerischen Wert zurück. Fängt leere Strings,
 * NaN, Infinity und null/undefined ab.
 *
 * @param value - Wert aus Firebase (kann String, Zahl oder undefined sein)
 * @param fallback - Rückgabewert bei ungültigem Input (Standard: 0)
 * @returns Gültiger numerischer Wert
 */
const safeNumber = (value: unknown, fallback = 0): number => {
  if (value === undefined || value === null || value === "") return fallback;
  const num = typeof value === "number" ? value : Number(value);
  return Number.isFinite(num) ? num : fallback;
};


/**
 * Konvertiert einen Firebase-Scope-Wert ("ALL", "FIX", oder UID) in den plan_scope_type-Enum.
 *
 * @param scope - Firebase-Scope-Wert
 * @returns Postgres-ENUM-Wert
 */
const scopeToDb = (scope: string): string => {
  if (scope === "ALL" || scope === "FIX") return scope;
  return "group";
};

/* =====================================================================
// MenuplanMigrationJob
// ===================================================================== */

/**
 * Migrations-Job für Menupläne aller Events.
 *
 * Baut beim ersten Aufruf alle benötigten Lookup-Maps auf
 * (Events, Rezepte, Produkte, Materialien, Diäten, Unverträglichkeiten).
 */
export class MenuplanMigrationJob implements MigrationJob<FirebaseMenuplanData> {
  name = "Menupläne (Mahlzeiten, Menüs, Rezepte, Produkte, Materialien, Pläne)";
  description =
    "Migriert alle Menupläne von Firebase nach Postgres. " +
    "Legt Mahlzeitentypen, Mahlzeiten, Menüs, Rezepte, Produkte, Materialien " +
    "und Plan-Zeilen an. Setzt voraus, dass Events, Gruppenconfig, " +
    "Rezepte, Produkte und Materialien bereits migriert sind.";

  /** firebase_uid → Postgres-ID für Events */
  private eventIdByFirebaseUid: Map<string, string> = new Map();
  /** firebase_uid → Postgres-ID für Rezepte */
  private recipeIdByFirebaseUid: Map<string, string> = new Map();
  /** firebase_uid → Postgres-ID für Produkte */
  private productIdByFirebaseUid: Map<string, string> = new Map();
  /** firebase_uid → Postgres-ID für Materialien */
  private materialIdByFirebaseUid: Map<string, string> = new Map();
  /** Gültige Unit-Keys aus der units-Tabelle */
  private validUnits: Set<string> = new Set();
  /** firebase_uid → Postgres-ID für Diäten (event-übergreifend, nach Event aufgebaut) */
  private dietIdByEventAndFirebaseUid: Map<string, Map<string, string>> = new Map();
  /** firebase_uid → Postgres-ID für Unverträglichkeiten */
  private intoleranceIdByEventAndFirebaseUid: Map<string, Map<string, string>> = new Map();
  /** Bereits migrierte Event-IDs (für schnelle checkExists-Prüfung ohne DB-Query) */
  private existingEventIds: Set<string> | null = null;

  /* =====================================================================
  // Alle Menupläne aus Firebase lesen
  // ===================================================================== */
  /**
   * Liest alle Menuplan-Dokumente aus Firestore und baut Lookup-Maps auf.
   *
   * @param firebase - Firebase-Instanz
   * @param database - DatabaseService-Instanz (für FK-Lookup-Maps)
   * @returns Array aller Menuplan-Quelldatensätze
   */
  async fetchSourceRecords(
    firebase: Firebase,
    database?: DatabaseService,
  ): Promise<SourceRecord<FirebaseMenuplanData>[]> {
    if (database) {
      await this.buildLookupMaps();

      // Bereits migrierte Event-IDs vorladen (für schnelle In-Memory-Prüfung in checkExists)
      const existingRows = await fetchAllRows(
        supabaseAdmin!, "event_meal_types", "event_id");
      this.existingEventIds = new Set(
        existingRows.map((row) => row.event_id as string));
    }

    const eventsSnapshot = await getDocs(collection(firebase.firestore, "events"));
    const records: SourceRecord<FirebaseMenuplanData>[] = [];

    for (const eventDoc of eventsSnapshot.docs) {
      const eventUid = eventDoc.id;
      if (eventUid === "000_allEvents") continue;

      const menuplanRef = doc(firebase.firestore, "events", eventUid, "docs", "menuplan");
      const menuplanSnap = await getDoc(menuplanRef);

      if (!menuplanSnap.exists()) continue;

      const value = menuplanSnap.data();

      records.push({
        id: eventUid,
        label: `Menuplan für Event ${eventUid}`,
        data: {
          eventFirebaseUid: eventUid,
          mealTypes: value.mealTypes ?? {entries: {}, order: []},
          meals: value.meals ?? {},
          menuOrder: value.menuOrder ?? [],
          menues: value.menues ?? {},
          mealRecipes: value.mealRecipes ?? {},
          products: value.products ?? {},
          materials: value.materials ?? {},
          notes: value.notes ?? {},
        },
      });
    }

    return records;
  }

  /* =====================================================================
  // Prüfen ob Menuplan bereits migriert wurde
  // ===================================================================== */
  /**
   * Prüft ob für das Event bereits Mahlzeitentypen in Postgres vorhanden sind.
   *
   * @param database - DatabaseService-Instanz
   * @param record - Der zu prüfende Quelldatensatz
   * @returns true, falls der Menuplan bereits migriert wurde
   */
  async checkExists(
    _database: DatabaseService,
    record: SourceRecord<FirebaseMenuplanData>,
  ): Promise<boolean> {
    const eventId = this.eventIdByFirebaseUid.get(record.data.eventFirebaseUid);
    if (!eventId) return false;

    // In-Memory-Prüfung gegen vorgeladene Event-IDs (kein DB-Roundtrip pro Record)
    if (this.existingEventIds) {
      return this.existingEventIds.has(eventId);
    }

    // Fallback: DB-Query, falls existingEventIds nicht vorgeladen wurde
    const client = supabaseAdmin!;
    const {data, error} = await client
      .from("event_meal_types")
      .select("id")
      .eq("event_id", eventId)
      .limit(1);

    if (error) throw error;
    return (data ?? []).length > 0;
  }

  /* =====================================================================
  // Einzelnen Menuplan nach Postgres migrieren
  // ===================================================================== */
  /**
   * Fügt einen Menuplan inklusive aller Unter-Tabellen in Postgres ein.
   *
   * Reihenfolge:
   * 1. Mahlzeitentypen (event_meal_types)
   * 2. Mahlzeit-Slots (event_meals)
   * 3. Menü-Container (event_menues)
   * 4. Rezepte im Menü (event_menue_recipes)
   * 5. Produkte im Menü (event_menue_products)
   * 6. Materialien im Menü (event_menue_materials)
   * 7. Plan-Zeilen für alle Items (event_menuplan_item_plans)
   * 8. Notizen (event_notes)
   *
   * @param database - DatabaseService-Instanz
   * @param record - Der zu migrierende Quelldatensatz
   * @param authUser - Der angemeldete Admin-Benutzer
   */
  async migrateRecord(
    database: DatabaseService,
    record: SourceRecord<FirebaseMenuplanData>,
    _authUser: AuthUser,
  ): Promise<void> {
    // Inkonsistente Menuplandaten bereinigen (analog zu Menuplan.fixMenuplan()).
    // Läuft immer proaktiv — nicht als Retry-on-Error — damit Fehler klar zugeordnet werden.
    const {fixed: data, wasFixed, report: fixReport} = this.fixFirebaseMenuplan(record.data);
    if (wasFixed) {
      if (import.meta.env.DEV) console.warn(
        `MenuplanMigrationJob: Menuplan für Event ${record.data.eventFirebaseUid} ` +
        `war inkonsistent und wurde bereinigt: ${fixReport.join("; ")}`,
      );
    }

    const client = supabaseAdmin!;

    const eventId = this.eventIdByFirebaseUid.get(data.eventFirebaseUid);
    if (!eventId) {
      throw new Error(
        `MenuplanMigrationJob: Event ${data.eventFirebaseUid} nicht in Postgres gefunden.`,
      );
    }

    // Diät/Intolerance aus vorgeladener Map (buildLookupMaps hat alle Events geladen)
    const dietMap = this.dietIdByEventAndFirebaseUid.get(eventId) ?? new Map<string, string>();
    const intoleranceMap = this.intoleranceIdByEventAndFirebaseUid.get(eventId) ?? new Map<string, string>();

    // Alle Plan-Zeilen sammeln und am Ende als Batch einfügen
    const allPlanRows: Record<string, unknown>[] = [];

    // --- 1. Mahlzeitentypen (Batch) ---
    const mealTypeIdMap = new Map<string, string>();
    const mealTypeOrder: string[] = data.mealTypes.order ?? [];
    const mealTypeRows: Record<string, unknown>[] = [];

    for (let index = 0; index < mealTypeOrder.length; index++) {
      const mealTypeFirebaseUid = mealTypeOrder[index];
      const mealType = data.mealTypes.entries[mealTypeFirebaseUid];
      if (!mealType) continue;

      const id = crypto.randomUUID();
      mealTypeIdMap.set(mealTypeFirebaseUid, id);
      mealTypeRows.push({
        id,
        event_id: eventId,
        name: mealType.name ?? "",
        sort_order: index * 10,
        firebase_uid: mealTypeFirebaseUid,
      });
    }

    if (mealTypeRows.length > 0) {
      const {error} = await client.from("event_meal_types").insert(mealTypeRows);
      if (error) throw error;
    }

    // --- 2. Mahlzeit-Slots (Batch) ---
    const mealIdMap = new Map<string, string>();
    const meals = data.meals ?? {};
    const mealRows: Record<string, unknown>[] = [];

    for (const mealFirebaseUid of Object.keys(meals)) {
      const meal = meals[mealFirebaseUid];
      if (!meal) continue;

      const mealTypeId = mealTypeIdMap.get(meal.mealType);
      if (!mealTypeId) continue;

      if (!meal.date) continue;

      // Datum normalisieren: Firebase kann verschiedene Formate liefern.
      // Sicherstellen, dass das Datum als lokales YYYY-MM-DD gespeichert wird.
      const mealDate = normalizeDateToLocalYmd(meal.date);
      console.log(`[MenuplanMigration] Meal date: raw="${meal.date}" type=${typeof meal.date} normalized="${mealDate}"`);
      if (!mealDate) continue;

      const id = crypto.randomUUID();
      mealIdMap.set(mealFirebaseUid, id);
      mealRows.push({
        id,
        event_id: eventId,
        meal_date: mealDate,
        meal_type_id: mealTypeId,
        firebase_uid: mealFirebaseUid,
      });
    }

    if (mealRows.length > 0) {
      const {error} = await client.from("event_meals").insert(mealRows);
      if (error) throw error;
    }

    // --- 3. Menü-Container (Batch) ---
    const menueIdMap = new Map<string, string>();
    const menues = data.menues ?? {};
    const menueRows: Record<string, unknown>[] = [];

    for (const mealFirebaseUid of Object.keys(meals)) {
      const meal = meals[mealFirebaseUid];
      const mealId = mealIdMap.get(mealFirebaseUid);
      if (!meal || !mealId) continue;

      const menueOrder = meal.menuOrder ?? [];
      for (let index = 0; index < menueOrder.length; index++) {
        const menueFirebaseUid = menueOrder[index];
        const menue = menues[menueFirebaseUid];
        if (!menue) continue;

        const id = crypto.randomUUID();
        menueIdMap.set(menueFirebaseUid, id);
        menueRows.push({
          id,
          event_id: eventId,
          meal_id: mealId,
          name: menue.name ?? "",
          sort_order: index * 10,
          firebase_uid: menueFirebaseUid,
        });
      }
    }

    if (menueRows.length > 0) {
      const {error} = await client.from("event_menues").insert(menueRows);
      if (error) throw error;
    }

    // --- 4. Rezepte im Menü (Batch) ---
    const mealRecipes = data.mealRecipes ?? {};

    const recipeOrderInMenue = new Map<string, number>();
    const recipeToMenueMap = new Map<string, string>();
    for (const [menueFirebaseUid, menue] of Object.entries(menues)) {
      for (let index = 0; index < (menue.mealRecipeOrder ?? []).length; index++) {
        const recipeFirebaseUid = menue.mealRecipeOrder[index];
        recipeToMenueMap.set(recipeFirebaseUid, menueFirebaseUid);
        recipeOrderInMenue.set(recipeFirebaseUid, index * 10);
      }
    }

    const menueRecipeRows: Record<string, unknown>[] = [];
    for (const recipeFirebaseUid of Object.keys(mealRecipes)) {
      const mealRecipe = mealRecipes[recipeFirebaseUid];
      if (!mealRecipe) continue;

      const menueFirebaseUid = recipeToMenueMap.get(recipeFirebaseUid);
      if (!menueFirebaseUid) continue;
      const menueId = menueIdMap.get(menueFirebaseUid);
      if (!menueId) continue;

      const recipeId = this.recipeIdByFirebaseUid.get(mealRecipe.recipe.recipeUid) ?? null;
      const deletedRecipeName = recipeId === null
        ? `[DELETED] ${mealRecipe.recipe.name ?? "Unbekanntes Rezept"}`
        : null;

      const menueRecipeId = crypto.randomUUID();
      menueRecipeRows.push({
        id: menueRecipeId,
        event_id: eventId,
        menue_id: menueId,
        recipe_id: recipeId,
        deleted_recipe_name: deletedRecipeName,
        variant_name: mealRecipe.recipe.variantName ?? null,
        total_portions: safeNumber(mealRecipe.totalPortions),
        sort_order: recipeOrderInMenue.get(recipeFirebaseUid) ?? 0,
        firebase_uid: recipeFirebaseUid,
      });

      this.collectPlanRows(allPlanRows, eventId, menueRecipeId, "recipe", mealRecipe.plan, dietMap, intoleranceMap);
    }

    if (menueRecipeRows.length > 0) {
      const {error} = await client.from("event_menue_recipes").insert(menueRecipeRows);
      if (error) throw error;
    }

    // --- 5. Produkte im Menü (Batch) ---
    const products = data.products ?? {};

    const productToMenueMap = new Map<string, string>();
    const productOrderInMenue = new Map<string, number>();
    for (const [menueFirebaseUid, menue] of Object.entries(menues)) {
      for (let index = 0; index < (menue.productOrder ?? []).length; index++) {
        const productFirebaseUid = menue.productOrder[index];
        productToMenueMap.set(productFirebaseUid, menueFirebaseUid);
        productOrderInMenue.set(productFirebaseUid, index * 10);
      }
    }

    const menueProductRows: Record<string, unknown>[] = [];
    for (const productFirebaseUid of Object.keys(products)) {
      const product = products[productFirebaseUid];
      if (!product) continue;

      const menueFirebaseUid = productToMenueMap.get(productFirebaseUid);
      if (!menueFirebaseUid) continue;
      const menueId = menueIdMap.get(menueFirebaseUid);
      if (!menueId) continue;

      const productId = this.productIdByFirebaseUid.get(product.productUid);
      if (!productId) continue;

      const menueProductId = crypto.randomUUID();
      menueProductRows.push({
        id: menueProductId,
        event_id: eventId,
        menue_id: menueId,
        product_id: productId,
        quantity: safeNumber(product.quantity),
        unit: product.unit && this.validUnits.has(product.unit) ? product.unit : null,
        plan_mode: planModeToDb(safeNumber(product.planMode)),
        total_quantity: safeNumber(product.totalQuantity),
        sort_order: productOrderInMenue.get(productFirebaseUid) ?? 0,
        firebase_uid: productFirebaseUid,
      });

      this.collectPlanRows(allPlanRows, eventId, menueProductId, "product", product.plan, dietMap, intoleranceMap);
    }

    if (menueProductRows.length > 0) {
      const {error} = await client.from("event_menue_products").insert(menueProductRows);
      if (error) throw error;
    }

    // --- 6. Materialien im Menü (Batch) ---
    const materials = data.materials ?? {};

    const materialToMenueMap = new Map<string, string>();
    const materialOrderInMenue = new Map<string, number>();
    for (const [menueFirebaseUid, menue] of Object.entries(menues)) {
      for (let index = 0; index < (menue.materialOrder ?? []).length; index++) {
        const materialFirebaseUid = menue.materialOrder[index];
        materialToMenueMap.set(materialFirebaseUid, menueFirebaseUid);
        materialOrderInMenue.set(materialFirebaseUid, index * 10);
      }
    }

    const menueMaterialRows: Record<string, unknown>[] = [];
    for (const materialFirebaseUid of Object.keys(materials)) {
      const material = materials[materialFirebaseUid];
      if (!material) continue;

      const menueFirebaseUid = materialToMenueMap.get(materialFirebaseUid);
      if (!menueFirebaseUid) continue;
      const menueId = menueIdMap.get(menueFirebaseUid);
      if (!menueId) continue;

      const materialId = this.materialIdByFirebaseUid.get(material.materialUid);
      if (!materialId) continue;

      const menueMaterialId = crypto.randomUUID();
      menueMaterialRows.push({
        id: menueMaterialId,
        event_id: eventId,
        menue_id: menueId,
        material_id: materialId,
        quantity: safeNumber(material.quantity),
        unit: material.unit && this.validUnits.has(material.unit) ? material.unit : null,
        plan_mode: planModeToDb(safeNumber(material.planMode)),
        total_quantity: safeNumber(material.totalQuantity),
        sort_order: materialOrderInMenue.get(materialFirebaseUid) ?? 0,
        firebase_uid: materialFirebaseUid,
      });

      this.collectPlanRows(allPlanRows, eventId, menueMaterialId, "material", material.plan, dietMap, intoleranceMap);
    }

    if (menueMaterialRows.length > 0) {
      const {error} = await client.from("event_menue_materials").insert(menueMaterialRows);
      if (error) throw error;
    }

    // --- 7. Alle Plan-Zeilen als ein Batch einfügen ---
    if (allPlanRows.length > 0) {
      const {error} = await client.from("event_menuplan_item_plans").insert(allPlanRows);
      if (error) throw error;
    }

    // --- 8. Notizen (Batch-Insert) ---
    const notes = data.notes ?? {};
    const noteRows: Record<string, unknown>[] = [];
    for (const noteFirebaseUid of Object.keys(notes)) {
      const note = notes[noteFirebaseUid];
      if (!note) continue;

      // Notizen ohne gültiges Datum überspringen (Firebase-Inkonsistenz: date = "")
      if (!note.date) {
        if (import.meta.env.DEV) console.warn(`MenuplanMigrationJob: Notiz ${noteFirebaseUid} hat kein Datum, wird übersprungen.`);
        continue;
      }

      const menueId = menueIdMap.get(note.menueUid) ?? null;

      noteRows.push({
        event_id: eventId,
        menue_id: menueId,
        note_date: normalizeDateToLocalYmd(note.date) ?? note.date,
        text: note.text ?? "",
        firebase_uid: noteFirebaseUid,
      });
    }

    if (noteRows.length > 0) {
      const {error: noteError} = await client.from("event_notes").insert(noteRows);
      if (noteError) throw noteError;
    }

    // Tracking-Zeile für den Menuplan erstellen
    const {error: trackingError} = await client
      .from("event_menuplan_tracking")
      .insert({event_id: eventId});

    if (trackingError) throw trackingError;
  }

  /* =====================================================================
  // Hilfsmethode: Inkonsistente Firebase-Menuplandaten bereinigen
  // ===================================================================== */
  /**
   * Bereinigt inkonsistente Referenzen in einem Firebase-Menuplan-Datensatz.
   *
   * Entspricht der Logik von `Menuplan.fixMenuplan()`, arbeitet aber direkt
   * auf `FirebaseMenuplanData` ohne Konvertierung in eine Menuplan-Instanz.
   *
   * Bereinigt folgende Inkonsistenzen:
   * - UIDs in `menue.mealRecipeOrder`, die nicht in `mealRecipes` existieren
   * - UIDs in `menue.productOrder`, die nicht in `products` existieren
   * - UIDs in `menue.materialOrder`, die nicht in `materials` existieren
   * - UIDs in `meal.menuOrder`, die nicht in `menues` existieren
   *
   * @param data - Rohdaten aus Firebase
   * @returns Bereinigte Kopie, Flag ob Bereinigung nötig war, und Bericht
   */
  private fixFirebaseMenuplan(data: FirebaseMenuplanData): {
    fixed: FirebaseMenuplanData;
    wasFixed: boolean;
    report: string[];
  } {
    // Tiefe Kopie, damit der Original-Datensatz unverändert bleibt
    const fixed: FirebaseMenuplanData = JSON.parse(JSON.stringify(data));
    const report: string[] = [];
    let wasFixed = false;

    const mealRecipeKeys = new Set(Object.keys(fixed.mealRecipes));
    const productKeys = new Set(Object.keys(fixed.products));
    const materialKeys = new Set(Object.keys(fixed.materials));
    const menueKeys = new Set(Object.keys(fixed.menues));

    // Order-Arrays in jedem Menü bereinigen
    for (const menue of Object.values(fixed.menues)) {
      const beforeRecipes = menue.mealRecipeOrder.length;
      menue.mealRecipeOrder = menue.mealRecipeOrder.filter((uid) => mealRecipeKeys.has(uid));
      if (menue.mealRecipeOrder.length < beforeRecipes) {
        report.push(`mealRecipeOrder: ${beforeRecipes - menue.mealRecipeOrder.length} Ghost-UID(s) entfernt`);
        wasFixed = true;
      }

      const beforeProducts = menue.productOrder.length;
      menue.productOrder = menue.productOrder.filter((uid) => productKeys.has(uid));
      if (menue.productOrder.length < beforeProducts) {
        report.push(`productOrder: ${beforeProducts - menue.productOrder.length} Ghost-UID(s) entfernt`);
        wasFixed = true;
      }

      const beforeMaterials = menue.materialOrder.length;
      menue.materialOrder = menue.materialOrder.filter((uid) => materialKeys.has(uid));
      if (menue.materialOrder.length < beforeMaterials) {
        report.push(`materialOrder: ${beforeMaterials - menue.materialOrder.length} Ghost-UID(s) entfernt`);
        wasFixed = true;
      }
    }

    // meal.menuOrder bereinigen
    for (const meal of Object.values(fixed.meals)) {
      if (!meal.menuOrder) continue;
      const beforeMenues = meal.menuOrder.length;
      meal.menuOrder = meal.menuOrder.filter((uid) => menueKeys.has(uid));
      if (meal.menuOrder.length < beforeMenues) {
        report.push(`meal.menuOrder: ${beforeMenues - meal.menuOrder.length} Ghost-UID(s) entfernt`);
        wasFixed = true;
      }
    }

    return {fixed, wasFixed, report};
  }

  /* =====================================================================
  // Hilfsmethode: Plan-Zeilen einfügen
  // ===================================================================== */
  /**
   * Fügt Plan-Zeilen (event_menuplan_item_plans) für ein Item ein.
   *
   * @param client - Supabase-Client
   * @param eventId - Postgres-ID des Events
   * @param itemId - Postgres-ID des Items (Rezept, Produkt oder Material)
   * @param itemType - Typ des Items ("recipe", "product", "material")
   * @param plans - Array der Firebase-Plan-Zeilen
   * @param dietMap - Lookup-Map Firebase-UID → Postgres-ID für Diäten
   * @param intoleranceMap - Lookup-Map Firebase-UID → Postgres-ID für Unverträglichkeiten
   */
  /**
   * Sammelt Plan-Zeilen synchron in ein Array (kein DB-Aufruf).
   * Alle Zeilen werden am Ende von migrateRecord als ein Batch eingefügt.
   *
   * @param target - Ziel-Array, in das die Zeilen gepusht werden
   * @param eventId - Postgres-ID des Events
   * @param itemId - Client-generierte ID des Items (Rezept, Produkt oder Material)
   * @param itemType - Typ des Items
   * @param plans - Array der Firebase-Plan-Zeilen
   * @param dietMap - Lookup-Map Firebase-UID → Postgres-ID für Diäten
   * @param intoleranceMap - Lookup-Map Firebase-UID → Postgres-ID für Unverträglichkeiten
   */
  private collectPlanRows(
    target: Record<string, unknown>[],
    eventId: string,
    itemId: string,
    itemType: "recipe" | "product" | "material",
    plans: FirebasePortionPlan[],
    dietMap: Map<string, string>,
    intoleranceMap: Map<string, string>,
  ): void {
    if (!plans || plans.length === 0) return;

    for (const plan of plans) {
      const dietScope = scopeToDb(plan.diet);
      const intoleranceScope = scopeToDb(plan.intolerance);
      const dietId = dietScope === "group" ? (dietMap.get(plan.diet) ?? null) : null;
      const intoleranceId = intoleranceScope === "group" ? (intoleranceMap.get(plan.intolerance) ?? null) : null;

      if (dietScope === "group" && dietId === null) continue;
      if (intoleranceScope === "group" && intoleranceId === null) continue;

      const row: Record<string, unknown> = {
        event_id: eventId,
        diet_scope: dietScope,
        diet_id: dietId,
        intolerance_scope: intoleranceScope,
        intolerance_id: intoleranceId,
        factor: safeNumber(plan.factor, 1),
        servings: safeNumber(plan.totalPortions),
      };

      if (itemType === "recipe") row.menue_recipe_id = itemId;
      else if (itemType === "product") row.menue_product_id = itemId;
      else row.menue_material_id = itemId;

      target.push(row);
    }
  }

  /* =====================================================================
  // Hilfsmethode: Lookup-Maps aufbauen
  // ===================================================================== */
  /**
   * Lädt alle relevanten Tabellen aus Postgres und befüllt die Lookup-Maps.
   *
   * @throws {PostgrestError} bei Datenbankfehler
   */
  private async buildLookupMaps(): Promise<void> {
    const client = supabaseAdmin!;

    const [eventRows, recipeRows, productRows, materialRows, unitRows] = await Promise.all([
      fetchAllRows(client, "events", "id, firebase_uid"),
      fetchAllRows(client, "recipes", "id, firebase_uid"),
      fetchAllRows(client, "products", "id, firebase_uid"),
      fetchAllRows(client, "materials", "id, firebase_uid"),
      fetchAllRows(client, "units", "key"),
    ]);

    for (const row of eventRows) {
      if (row.firebase_uid) this.eventIdByFirebaseUid.set(row.firebase_uid as string, row.id as string);
    }
    for (const row of recipeRows) {
      if (row.firebase_uid) this.recipeIdByFirebaseUid.set(row.firebase_uid as string, row.id as string);
    }
    for (const row of productRows) {
      if (row.firebase_uid) this.productIdByFirebaseUid.set(row.firebase_uid as string, row.id as string);
    }
    for (const row of materialRows) {
      if (row.firebase_uid) this.materialIdByFirebaseUid.set(row.firebase_uid as string, row.id as string);
    }
    for (const row of unitRows) {
      if (row.key) this.validUnits.add(row.key as string);
    }

    // Diäten und Unverträglichkeiten für ALLE Events vorladen
    // (erspart 2 DB-Queries pro Menuplan in migrateRecord)
    const [allDiets, allIntolerances] = await Promise.all([
      fetchAllRows(client, "event_groupconfiguration_diets", "id, event_id, firebase_uid"),
      fetchAllRows(client, "event_groupconfiguration_intolerances", "id, event_id, firebase_uid"),
    ]);
    for (const row of allDiets) {
      const eventId = row.event_id as string;
      if (!this.dietIdByEventAndFirebaseUid.has(eventId)) {
        this.dietIdByEventAndFirebaseUid.set(eventId, new Map());
      }
      if (row.firebase_uid) {
        this.dietIdByEventAndFirebaseUid.get(eventId)!.set(row.firebase_uid as string, row.id as string);
      }
    }
    for (const row of allIntolerances) {
      const eventId = row.event_id as string;
      if (!this.intoleranceIdByEventAndFirebaseUid.has(eventId)) {
        this.intoleranceIdByEventAndFirebaseUid.set(eventId, new Map());
      }
      if (row.firebase_uid) {
        this.intoleranceIdByEventAndFirebaseUid.get(eventId)!.set(row.firebase_uid as string, row.id as string);
      }
    }
  }

}
