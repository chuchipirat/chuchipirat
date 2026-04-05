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
import {supabase} from "../../Database/supabaseClient";
import {SupabaseClient} from "@supabase/supabase-js";
import {MigrationJob, SourceRecord} from "./MigrationJob.interface";

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
  /** firebase_uid → Postgres-ID für Diäten (event-übergreifend, nach Event aufgebaut) */
  private dietIdByEventAndFirebaseUid: Map<string, Map<string, string>> = new Map();
  /** firebase_uid → Postgres-ID für Unverträglichkeiten */
  private intoleranceIdByEventAndFirebaseUid: Map<string, Map<string, string>> = new Map();

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
    database: DatabaseService,
    record: SourceRecord<FirebaseMenuplanData>,
  ): Promise<boolean> {
    const eventId = this.eventIdByFirebaseUid.get(record.data.eventFirebaseUid);
    if (!eventId) return false;

    const client: SupabaseClient = supabase;
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

    const client: SupabaseClient = supabase;

    const eventId = this.eventIdByFirebaseUid.get(data.eventFirebaseUid);
    if (!eventId) {
      throw new Error(
        `MenuplanMigrationJob: Event ${data.eventFirebaseUid} nicht in Postgres gefunden.`,
      );
    }

    // Diät/Intolerance-Lookup für dieses Event laden (falls noch nicht vorhanden)
    await this.ensureDietIntoleranceMapsForEvent(client, eventId, data.eventFirebaseUid);
    const dietMap = this.dietIdByEventAndFirebaseUid.get(eventId) ?? new Map<string, string>();
    const intoleranceMap = this.intoleranceIdByEventAndFirebaseUid.get(eventId) ?? new Map<string, string>();

    // --- 1. Mahlzeitentypen ---
    const mealTypeIdMap = new Map<string, string>(); // Firebase-UID → Postgres-ID
    const mealTypeOrder: string[] = data.mealTypes.order ?? [];
    for (let index = 0; index < mealTypeOrder.length; index++) {
      const mealTypeFirebaseUid = mealTypeOrder[index];
      const mealType = data.mealTypes.entries[mealTypeFirebaseUid];
      if (!mealType) continue;

      const {data: mealTypeRow, error: mealTypeError} = await client
        .from("event_meal_types")
        .insert({
          event_id: eventId,
          name: mealType.name ?? "",
          sort_order: index * 10,
          firebase_uid: mealTypeFirebaseUid,
        })
        .select("id")
        .single();

      if (mealTypeError) throw mealTypeError;
      mealTypeIdMap.set(mealTypeFirebaseUid, (mealTypeRow as {id: string}).id);
    }

    // --- 2. Mahlzeit-Slots ---
    const mealIdMap = new Map<string, string>(); // Firebase-UID → Postgres-ID
    const meals = data.meals ?? {};
    for (const mealFirebaseUid of Object.keys(meals)) {
      const meal = meals[mealFirebaseUid];
      if (!meal) continue;

      const mealTypeId = mealTypeIdMap.get(meal.mealType);
      if (!mealTypeId) continue;

      // Mahlzeiten ohne gültiges Datum überspringen (Firebase-Inkonsistenz: date = "")
      if (!meal.date) {
        if (import.meta.env.DEV) console.warn(`MenuplanMigrationJob: Mahlzeit ${mealFirebaseUid} hat kein Datum, wird übersprungen.`);
        continue;
      }

      const {data: mealRow, error: mealError} = await client
        .from("event_meals")
        .insert({
          event_id: eventId,
          meal_date: meal.date,
          meal_type_id: mealTypeId,
          firebase_uid: mealFirebaseUid,
        })
        .select("id")
        .single();

      if (mealError) {
        // Duplikat (UNIQUE event+date+mealType) tolerieren
        if (mealError.code !== "23505") throw mealError;
        // Bestehende ID nachschlagen
        const {data: existing} = await client
          .from("event_meals")
          .select("id")
          .eq("event_id", eventId)
          .eq("meal_date", meal.date)
          .eq("meal_type_id", mealTypeId)
          .single();
        if (existing) mealIdMap.set(mealFirebaseUid, (existing as {id: string}).id);
        continue;
      }
      mealIdMap.set(mealFirebaseUid, (mealRow as {id: string}).id);
    }

    // --- 3. Menü-Container ---
    const menueIdMap = new Map<string, string>(); // Firebase-UID → Postgres-ID
    const menues = data.menues ?? {};
    const _menuOrder = data.menuOrder ?? [];

    // Reihenfolge der Menüs innerhalb der Mahlzeiten bestimmen
    // menuOrder ist eine flache Liste aller Mahlzeiten-UIDs in Reihenfolge
    // Die Menü-Reihenfolge liegt in meal.menuOrder
    for (const mealFirebaseUid of Object.keys(meals)) {
      const meal = meals[mealFirebaseUid];
      const mealId = mealIdMap.get(mealFirebaseUid);
      if (!meal || !mealId) continue;

      const menueOrder = meal.menuOrder ?? [];
      for (let index = 0; index < menueOrder.length; index++) {
        const menueFirebaseUid = menueOrder[index];
        const menue = menues[menueFirebaseUid];
        if (!menue) continue;

        const {data: menueRow, error: menueError} = await client
          .from("event_menues")
          .insert({
            event_id: eventId,
            meal_id: mealId,
            name: menue.name ?? "",
            sort_order: index * 10,
            firebase_uid: menueFirebaseUid,
          })
          .select("id")
          .single();

        if (menueError) throw menueError;
        menueIdMap.set(menueFirebaseUid, (menueRow as {id: string}).id);
      }
    }

    // --- 4. Rezepte im Menü ---
    const menueRecipeIdMap = new Map<string, string>(); // Firebase-UID → Postgres-ID
    const mealRecipes = data.mealRecipes ?? {};

    // Reihenfolge der Rezepte aus menue.mealRecipeOrder ableiten
    const recipeOrderInMenue = new Map<string, number>(); // Firebase-UID → sort_order
    for (const menue of Object.values(menues)) {
      const mealRecipeOrder = menue.mealRecipeOrder ?? [];
      for (let index = 0; index < mealRecipeOrder.length; index++) {
        recipeOrderInMenue.set(mealRecipeOrder[index], index * 10);
      }
    }

    // Für jedes Rezept: zugehöriges Menü bestimmen
    // Die Zuordnung Rezept → Menü ist implizit über menue.mealRecipeOrder
    const recipeToMenueMap = new Map<string, string>(); // Recipe Firebase-UID → Menue Firebase-UID
    for (const [menueFirebaseUid, menue] of Object.entries(menues)) {
      for (const recipeFirebaseUid of (menue.mealRecipeOrder ?? [])) {
        recipeToMenueMap.set(recipeFirebaseUid, menueFirebaseUid);
      }
    }

    for (const recipeFirebaseUid of Object.keys(mealRecipes)) {
      const mealRecipe = mealRecipes[recipeFirebaseUid];
      if (!mealRecipe) continue;

      const menueFirebaseUid = recipeToMenueMap.get(recipeFirebaseUid);
      if (!menueFirebaseUid) continue;

      const menueId = menueIdMap.get(menueFirebaseUid);
      if (!menueId) continue;

      // Rezept-ID aus Postgres auflösen
      const recipeId = this.recipeIdByFirebaseUid.get(mealRecipe.recipe.recipeUid) ?? null;
      const isDeleted = recipeId === null;
      const deletedRecipeName = isDeleted
        ? `[DELETED] ${mealRecipe.recipe.name ?? "Unbekanntes Rezept"}`
        : null;

      const {data: menueRecipeRow, error: menueRecipeError} = await client
        .from("event_menue_recipes")
        .insert({
          event_id: eventId,
          menue_id: menueId,
          recipe_id: recipeId,
          deleted_recipe_name: deletedRecipeName,
          variant_name: mealRecipe.recipe.variantName ?? null,
          total_portions: mealRecipe.totalPortions ?? 0,
          sort_order: recipeOrderInMenue.get(recipeFirebaseUid) ?? 0,
          firebase_uid: recipeFirebaseUid,
        })
        .select("id")
        .single();

      if (menueRecipeError) throw menueRecipeError;
      const menueRecipeId = (menueRecipeRow as {id: string}).id;
      menueRecipeIdMap.set(recipeFirebaseUid, menueRecipeId);

      // Plan-Zeilen für dieses Rezept einfügen
      await this.insertPlanRows(client, eventId, menueRecipeId, "recipe", mealRecipe.plan, dietMap, intoleranceMap);
    }

    // --- 5. Produkte im Menü ---
    const menueProductIdMap = new Map<string, string>();
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

    for (const productFirebaseUid of Object.keys(products)) {
      const product = products[productFirebaseUid];
      if (!product) continue;

      const menueFirebaseUid = productToMenueMap.get(productFirebaseUid);
      if (!menueFirebaseUid) continue;

      const menueId = menueIdMap.get(menueFirebaseUid);
      if (!menueId) continue;

      const productId = this.productIdByFirebaseUid.get(product.productUid);
      if (!productId) {
        if (import.meta.env.DEV) console.warn(`MenuplanMigrationJob: Produkt ${product.productUid} nicht gefunden, wird übersprungen.`);
        continue;
      }

      const {data: menueProductRow, error: menueProductError} = await client
        .from("event_menue_products")
        .insert({
          event_id: eventId,
          menue_id: menueId,
          product_id: productId,
          quantity: product.quantity ?? 0,
          unit: product.unit || null,
          plan_mode: planModeToDb(product.planMode ?? 0),
          total_quantity: product.totalQuantity ?? 0,
          sort_order: productOrderInMenue.get(productFirebaseUid) ?? 0,
          firebase_uid: productFirebaseUid,
        })
        .select("id")
        .single();

      if (menueProductError) throw menueProductError;
      const menueProductId = (menueProductRow as {id: string}).id;
      menueProductIdMap.set(productFirebaseUid, menueProductId);

      await this.insertPlanRows(client, eventId, menueProductId, "product", product.plan, dietMap, intoleranceMap);
    }

    // --- 6. Materialien im Menü ---
    const menueMaterialIdMap = new Map<string, string>();
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

    for (const materialFirebaseUid of Object.keys(materials)) {
      const material = materials[materialFirebaseUid];
      if (!material) continue;

      const menueFirebaseUid = materialToMenueMap.get(materialFirebaseUid);
      if (!menueFirebaseUid) continue;

      const menueId = menueIdMap.get(menueFirebaseUid);
      if (!menueId) continue;

      const materialId = this.materialIdByFirebaseUid.get(material.materialUid);
      if (!materialId) {
        if (import.meta.env.DEV) console.warn(`MenuplanMigrationJob: Material ${material.materialUid} nicht gefunden, wird übersprungen.`);
        continue;
      }

      const {data: menueMaterialRow, error: menueMaterialError} = await client
        .from("event_menue_materials")
        .insert({
          event_id: eventId,
          menue_id: menueId,
          material_id: materialId,
          quantity: material.quantity ?? 0,
          unit: material.unit || null,
          plan_mode: planModeToDb(material.planMode ?? 0),
          total_quantity: material.totalQuantity ?? 0,
          sort_order: materialOrderInMenue.get(materialFirebaseUid) ?? 0,
          firebase_uid: materialFirebaseUid,
        })
        .select("id")
        .single();

      if (menueMaterialError) throw menueMaterialError;
      const menueMaterialId = (menueMaterialRow as {id: string}).id;
      menueMaterialIdMap.set(materialFirebaseUid, menueMaterialId);

      await this.insertPlanRows(client, eventId, menueMaterialId, "material", material.plan, dietMap, intoleranceMap);
    }

    // --- 8. Notizen ---
    const notes = data.notes ?? {};
    for (const noteFirebaseUid of Object.keys(notes)) {
      const note = notes[noteFirebaseUid];
      if (!note) continue;

      // Notizen ohne gültiges Datum überspringen (Firebase-Inkonsistenz: date = "")
      if (!note.date) {
        if (import.meta.env.DEV) console.warn(`MenuplanMigrationJob: Notiz ${noteFirebaseUid} hat kein Datum, wird übersprungen.`);
        continue;
      }

      const menueId = menueIdMap.get(note.menueUid) ?? null;

      const {error: noteError} = await client.from("event_notes").insert({
        event_id: eventId,
        menue_id: menueId,
        note_date: note.date,
        text: note.text ?? "",
        firebase_uid: noteFirebaseUid,
      });

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
  private async insertPlanRows(
    client: SupabaseClient,
    eventId: string,
    itemId: string,
    itemType: "recipe" | "product" | "material",
    plans: FirebasePortionPlan[],
    dietMap: Map<string, string>,
    intoleranceMap: Map<string, string>,
  ): Promise<void> {
    if (!plans || plans.length === 0) return;

    for (const plan of plans) {
      const dietScope = scopeToDb(plan.diet);
      const intoleranceScope = scopeToDb(plan.intolerance);
      const dietId = dietScope === "group" ? (dietMap.get(plan.diet) ?? null) : null;
      const intoleranceId = intoleranceScope === "group" ? (intoleranceMap.get(plan.intolerance) ?? null) : null;

      // CHECK-Constraint: diet_scope='group' erfordert eine gültige diet_id.
      // Fehlt der Eintrag in der Gruppenconfig → Plan-Zeile überspringen statt Fehler werfen.
      if (dietScope === "group" && dietId === null) {
        if (import.meta.env.DEV) console.warn(
          `MenuplanMigrationJob: Plan-Zeile übersprungen — Diät "${plan.diet}" nicht in Gruppenconfig (item ${itemId}).`,
        );
        continue;
      }
      if (intoleranceScope === "group" && intoleranceId === null) {
        if (import.meta.env.DEV) console.warn(
          `MenuplanMigrationJob: Plan-Zeile übersprungen — Unverträglichkeit "${plan.intolerance}" nicht in Gruppenconfig (item ${itemId}).`,
        );
        continue;
      }

      const row: Record<string, unknown> = {
        event_id: eventId,
        diet_scope: dietScope,
        diet_id: dietId,
        intolerance_scope: intoleranceScope,
        intolerance_id: intoleranceId,
        factor: plan.factor ?? 1,
        servings: plan.totalPortions ?? 0,
      };

      if (itemType === "recipe") row.menue_recipe_id = itemId;
      else if (itemType === "product") row.menue_product_id = itemId;
      else row.menue_material_id = itemId;

      const {error} = await client.from("event_menuplan_item_plans").insert(row);
      if (error) throw error;
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
    const client: SupabaseClient = supabase;

    const [eventRows, recipeRows, productRows, materialRows] = await Promise.all([
      client.from("events").select("id, firebase_uid"),
      client.from("recipes").select("id, firebase_uid"),
      client.from("products").select("id, firebase_uid"),
      client.from("materials").select("id, firebase_uid"),
    ]);

    if (eventRows.error) throw eventRows.error;
    if (recipeRows.error) throw recipeRows.error;
    if (productRows.error) throw productRows.error;
    if (materialRows.error) throw materialRows.error;

    for (const row of eventRows.data ?? []) {
      if (row.firebase_uid) this.eventIdByFirebaseUid.set(row.firebase_uid as string, row.id as string);
    }
    for (const row of recipeRows.data ?? []) {
      if (row.firebase_uid) this.recipeIdByFirebaseUid.set(row.firebase_uid as string, row.id as string);
    }
    for (const row of productRows.data ?? []) {
      if (row.firebase_uid) this.productIdByFirebaseUid.set(row.firebase_uid as string, row.id as string);
    }
    for (const row of materialRows.data ?? []) {
      if (row.firebase_uid) this.materialIdByFirebaseUid.set(row.firebase_uid as string, row.id as string);
    }
  }

  /**
   * Lädt Diät- und Unverträglichkeits-Lookup-Maps für ein bestimmtes Event.
   * Wird nur einmal pro Event aufgerufen (lazy loading).
   *
   * @param client - Supabase-Client
   * @param eventId - Postgres-ID des Events
   * @param eventFirebaseUid - Firebase-UID des Events (für den Map-Key)
   */
  private async ensureDietIntoleranceMapsForEvent(
    client: SupabaseClient,
    eventId: string,
    _eventFirebaseUid: string,
  ): Promise<void> {
    if (this.dietIdByEventAndFirebaseUid.has(eventId)) return;

    const [dietsResult, intolerancesResult] = await Promise.all([
      client.from("event_groupconfiguration_diets").select("id, firebase_uid").eq("event_id", eventId),
      client.from("event_groupconfiguration_intolerances").select("id, firebase_uid").eq("event_id", eventId),
    ]);

    if (dietsResult.error) throw dietsResult.error;
    if (intolerancesResult.error) throw intolerancesResult.error;

    const dietMap = new Map<string, string>();
    for (const row of dietsResult.data ?? []) {
      if (row.firebase_uid) dietMap.set(row.firebase_uid as string, row.id as string);
    }

    const intoleranceMap = new Map<string, string>();
    for (const row of intolerancesResult.data ?? []) {
      if (row.firebase_uid) intoleranceMap.set(row.firebase_uid as string, row.id as string);
    }

    this.dietIdByEventAndFirebaseUid.set(eventId, dietMap);
    this.intoleranceIdByEventAndFirebaseUid.set(eventId, intoleranceMap);
  }
}
