/**
 * RecipeRepository — Repository für Rezepte (alle Typen: public, private, variant).
 *
 * Greift auf die Tabelle `recipes` zu und ersetzt die bisherigen
 * Firebase-Methoden in recipe.class.ts. Lädt nur Kopfdaten (Metadaten);
 * Zutaten, Schritte und Materialien werden über eigene Repositories geladen.
 *
 * @example
 * const recipe = await repo.getRecipe('abc-123');
 * const publicRecipes = await repo.getAllPublicRecipes();
 */
import {SupabaseClient} from "@supabase/supabase-js";
import {BaseRepository} from "./BaseRepository";
import {
  STORAGE_OBJECT_PROPERTY,
  StorageObjectProperty,
} from "../../Firebase/Db/sessionStorageHandler.class";
import {AuthUser} from "../../Firebase/Authentication/authUser.class";

/* =====================================================================
// Enum-Mapping: DB-Strings ↔ numerische MenuType-Werte
// =====================================================================
// Die DB speichert menu_types als Postgres-ENUM-Array.
// Die App verwendet die numerischen Werte aus MenuType in recipe.class.ts.
// MenuType.None (0) entspricht einem leeren Array und wird nicht gespeichert.
// ===================================================================== */

/** Zuordnung DB-ENUM-String → numerischer MenuType-Wert. */
const MENU_TYPE_FROM_DB: Record<string, number> = {
  main_course: 1,
  side_dish: 2,
  appetizer: 3,
  dessert: 4,
  breakfast: 5,
  snack: 6,
  apero: 7,
  beverage: 8,
};

/** Zuordnung numerischer MenuType-Wert → DB-ENUM-String. */
const MENU_TYPE_TO_DB: Record<number, string> = {
  1: "main_course",
  2: "side_dish",
  3: "appetizer",
  4: "dessert",
  5: "breakfast",
  6: "snack",
  7: "apero",
  8: "beverage",
};

/** Zuordnung DB-ENUM-String → numerischer Allergen-Wert (gleich wie in ProductRepository). */
const ALLERGEN_FROM_DB: Record<string, number> = {
  lactose: 1,
  gluten: 2,
};

/** Zuordnung numerischer Allergen-Wert → DB-ENUM-String. */
const ALLERGEN_TO_DB: Record<number, string> = {
  1: "lactose",
  2: "gluten",
};

/** Zuordnung DB-ENUM-String → numerischer Diet-Wert. */
const DIET_FROM_DB: Record<string, number> = {
  meat: 1,
  vegetarian: 2,
  vegan: 3,
};

/** Zuordnung numerischer Diet-Wert → DB-ENUM-String. */
const DIET_TO_DB: Record<number, string> = {
  1: "meat",
  2: "vegetarian",
  3: "vegan",
};

/* =====================================================================
// DB-Zeilenstruktur (snake_case, entspricht den Postgres-Spalten)
// ===================================================================== */
/**
 * Datenbank-Zeilentyp für die recipes-Tabelle.
 *
 * @param id - Primärschlüssel (UUID als TEXT)
 * @param firebase_uid - Alte Firebase-UID für Migrationszuordnung
 * @param name - Name des Rezepts
 * @param portions - Portionenanzahl
 * @param source - Quelle / URL des Rezepts
 * @param time_preparation - Vorbereitungszeit in Minuten
 * @param time_rest - Ruhezeit in Minuten
 * @param time_cooking - Kochzeit in Minuten
 * @param picture_src - URL des Rezeptbilds
 * @param note - Notiz zum Rezept
 * @param tags - Array mit Tags
 * @param menu_types - Array mit MenuType-Enums
 * @param diet - Diätklassifikation
 * @param allergens - Allergen-Array
 * @param outdoor_kitchen_suitable - Geeignet für Outdoor-Küche
 * @param is_in_review - Wartet auf Überprüfung
 * @param usable - Ob das Rezept aktiv ist
 * @param avg_rating - Durchschnittsbewertung (via Trigger)
 * @param no_ratings - Anzahl Bewertungen (via Trigger)
 * @param no_comments - Anzahl Kommentare (via Trigger)
 * @param recipe_type - Rezepttyp ('public' | 'private' | 'variant')
 * @param variant_note - Varianten-Notiz (nur bei variant)
 * @param variant_name - Varianten-Name (nur bei variant)
 * @param variant_event_uid - Event-UID der Variante (nur bei variant)
 * @param original_recipe_uid - UID des Original-Rezepts (nur bei variant)
 * @param original_recipe_type - Typ des Original-Rezepts (nur bei variant)
 * @param original_recipe_creator_uid - Auth-UID des Original-Erstellers (nur bei variant)
 * @param created_at - Erstellungszeitpunkt
 * @param created_by - UID des Erstellers
 * @param updated_at - Zeitpunkt der letzten Änderung
 * @param updated_by - UID des letzten Bearbeiters
 */
export interface RecipeRow {
  [key: string]: unknown;
  id: string;
  firebase_uid: string | null;
  name: string;
  portions: number;
  source: string;
  time_preparation: number;
  time_rest: number;
  time_cooking: number;
  picture_src: string;
  note: string;
  tags: string[];
  menu_types: string[];
  diet: string;
  allergens: string[];
  outdoor_kitchen_suitable: boolean;
  is_in_review: boolean;
  usable: boolean;
  avg_rating: number;
  no_ratings: number;
  no_comments: number;
  recipe_type: string;
  variant_note: string | null;
  variant_name: string | null;
  variant_event_uid: string | null;
  original_recipe_uid: string | null;
  original_recipe_type: string | null;
  original_recipe_creator_uid: string | null;
  created_at: string;
  created_by: string | null;
  updated_at: string;
  updated_by: string | null;
}

/* =====================================================================
// Kurz-Domain-Modell — nur die für die Übersicht benötigten Felder
// =====================================================================
// Wird von getAllPublicRecipeShorts() und getPrivateRecipeShortsForUser()
// zurückgegeben. Reduziert den Datenübertrag gegenüber RecipeDomain erheblich,
// da Felder wie note, portions, times etc. für die Listenansicht nicht nötig sind.
// ===================================================================== */
/**
 * Kurz-Domain-Modell für die Rezeptübersicht.
 *
 * Enthält nur die Felder, die für Rezeptlisten (RecipeCard) benötigt werden.
 * Vollständige Daten → RecipeDomain.
 *
 * @param uid                  - Eindeutige ID
 * @param name                 - Rezeptname
 * @param source               - Quelle / URL
 * @param pictureSrc           - Bild-URL
 * @param tags                 - Tag-Liste
 * @param menuTypes            - MenuType-Werte (numerisch)
 * @param dietProperties       - Diät- und Allergen-Eigenschaften
 * @param outdoorKitchenSuitable - Für Outdoor-Küche geeignet
 * @param avgRating            - Durchschnittsbewertung
 * @param noRatings            - Anzahl Bewertungen
 * @param noComments           - Anzahl Kommentare (via Trigger)
 * @param recipeType           - 'public' | 'private' | 'variant'
 * @param variantName          - Variantenname (nur bei recipe_type='variant')
 * @param createdAt            - Erstellungszeitpunkt
 * @param createdBy            - Auth-UID des Erstellers
 */
export interface RecipeShortDomain {
  uid: string;
  name: string;
  source: string;
  pictureSrc: string;
  tags: string[];
  menuTypes: number[];
  dietProperties: {
    allergens: number[];
    diet: number;
  };
  outdoorKitchenSuitable: boolean;
  avgRating: number;
  noRatings: number;
  noComments: number;
  recipeType: string;
  variantName: string | null;
  createdAt: Date;
  createdBy: string;
}

/** Spalten die für RecipeShortDomain aus der DB selektiert werden */
const RECIPE_SHORT_COLUMNS =
  "id, name, source, picture_src, tags, menu_types, diet, allergens, outdoor_kitchen_suitable, avg_rating, no_ratings, no_comments, recipe_type, variant_name, created_at, created_by";

/* =====================================================================
// Domain-Modell (camelCase, wird in der App verwendet)
// ===================================================================== */
/**
 * Varianten-Eigenschaften eines Rezepts.
 *
 * @param note - Freitext-Notiz zur Variante
 * @param variantName - Name der Variante
 * @param eventUid - UID des zugehörigen Events
 * @param originalRecipeUid - UID des Original-Rezepts
 * @param originalRecipeType - Typ des Original-Rezepts
 * @param originalRecipeCreatorUid - Auth-UID des Original-Erstellers
 */
export interface RecipeVariantPropertiesDomain {
  note: string;
  variantName: string;
  eventUid: string;
  originalRecipeUid: string;
  originalRecipeType: string;
  originalRecipeCreatorUid: string;
}

/**
 * Domain-Modell für ein Rezept (nur Kopfdaten).
 *
 * @param uid - Eindeutige ID (entspricht DB-Spalte id)
 * @param name - Name des Rezepts
 * @param portions - Portionenanzahl
 * @param source - Quelle des Rezepts
 * @param times - Zeitangaben in Minuten
 * @param pictureSrc - URL des Rezeptbilds
 * @param note - Notiz zum Rezept
 * @param tags - Liste der Tags
 * @param menuTypes - MenuType-Werte (numerisch, MenuType.None=0 nicht enthalten)
 * @param dietProperties - Diät- und Allergeneigenschaften
 * @param outdoorKitchenSuitable - Für Outdoor-Küche geeignet
 * @param isInReview - Wartet auf Admin-Review
 * @param usable - Aktiv
 * @param avgRating - Durchschnittsbewertung
 * @param noRatings - Anzahl Bewertungen
 * @param noComments - Anzahl Kommentare (via Trigger; optional — nicht vom App-Code gesetzt)
 * @param recipeType - Rezepttyp ('public' | 'private' | 'variant')
 * @param variantProperties - Nur gesetzt wenn recipeType='variant'
 * @param createdAt - Erstellungszeitpunkt
 * @param createdBy - Auth-UID des Erstellers
 */
export interface RecipeDomain {
  uid: string;
  name: string;
  portions: number;
  source: string;
  times: {
    preparation: number;
    rest: number;
    cooking: number;
  };
  pictureSrc: string;
  note: string;
  tags: string[];
  menuTypes: number[];
  dietProperties: {
    allergens: number[];
    diet: number;
  };
  outdoorKitchenSuitable: boolean;
  isInReview: boolean;
  usable: boolean;
  avgRating: number;
  noRatings: number;
  /** Anzahl Kommentare — optional, da nicht vom App-Code gesetzt (wird via DB-Trigger gepflegt). */
  noComments?: number;
  recipeType: string;
  variantProperties?: RecipeVariantPropertiesDomain;
  createdAt: Date;
  createdBy: string;
}

/* =====================================================================
// RecipeRepository
// ===================================================================== */
/**
 * Repository für Rezepte (Kopfdaten aller Typen).
 *
 * Kindtabellen (Zutaten, Schritte, Materialien, Bewertungen, Kommentare)
 * werden über eigene Repositories verwaltet.
 */
export class RecipeRepository extends BaseRepository<RecipeDomain, RecipeRow> {
  tableName = "recipes";

  constructor(client?: SupabaseClient) {
    super(client);
  }

  /* =====================================================================
  // Domain → DB-Zeile Mapping
  // ===================================================================== */
  /**
   * Konvertiert ein RecipeDomain-Objekt in eine Postgres-Zeile.
   *
   * @param domain - Das Domain-Objekt (camelCase)
   * @returns Partielle DB-Zeile (snake_case)
   */
  toRow(domain: RecipeDomain): Partial<RecipeRow> {
    return {
      name: domain.name,
      portions: domain.portions,
      source: domain.source,
      time_preparation: domain.times?.preparation ?? 0,
      time_rest: domain.times?.rest ?? 0,
      time_cooking: domain.times?.cooking ?? 0,
      picture_src: domain.pictureSrc ?? "",
      note: domain.note ?? "",
      tags: domain.tags ?? [],
      // MenuType.None (0) wird nicht gespeichert → filtern
      menu_types: (domain.menuTypes ?? [])
        .filter((menuType) => menuType !== 0)
        .map((menuType) => MENU_TYPE_TO_DB[menuType])
        .filter(Boolean),
      allergens: (domain.dietProperties?.allergens ?? [])
        .filter((allergen) => allergen !== 0)
        .map((allergen) => ALLERGEN_TO_DB[allergen])
        .filter(Boolean),
      diet: DIET_TO_DB[domain.dietProperties?.diet ?? 1] ?? "meat",
      outdoor_kitchen_suitable: domain.outdoorKitchenSuitable ?? false,
      is_in_review: domain.isInReview ?? false,
      usable: domain.usable ?? true,
      recipe_type: domain.recipeType ?? "public",
      variant_note: domain.variantProperties?.note ?? null,
      variant_name: domain.variantProperties?.variantName ?? null,
      variant_event_uid: domain.variantProperties?.eventUid ?? null,
      original_recipe_uid: domain.variantProperties?.originalRecipeUid ?? null,
      original_recipe_type: domain.variantProperties?.originalRecipeType ?? null,
      original_recipe_creator_uid:
        domain.variantProperties?.originalRecipeCreatorUid ?? null,
    };
  }

  /* =====================================================================
  // DB-Zeile → Domain Mapping
  // ===================================================================== */
  /**
   * Konvertiert eine Postgres-Zeile in ein RecipeDomain-Objekt.
   *
   * @param row - Die DB-Zeile (snake_case)
   * @returns Domain-Objekt (camelCase)
   */
  toDomain(row: RecipeRow): RecipeDomain {
    const isVariant = row.recipe_type === "variant";
    return {
      uid: row.id,
      name: row.name,
      portions: row.portions,
      source: row.source,
      times: {
        preparation: row.time_preparation,
        rest: row.time_rest,
        cooking: row.time_cooking,
      },
      pictureSrc: row.picture_src,
      note: row.note,
      tags: row.tags ?? [],
      menuTypes: (row.menu_types ?? [])
        .map((menuType) => MENU_TYPE_FROM_DB[menuType])
        .filter((menuType): menuType is number => menuType !== undefined),
      dietProperties: {
        allergens: (row.allergens ?? [])
          .map((allergen) => ALLERGEN_FROM_DB[allergen])
          .filter((allergen): allergen is number => allergen !== undefined),
        diet: DIET_FROM_DB[row.diet] ?? 1,
      },
      outdoorKitchenSuitable: row.outdoor_kitchen_suitable,
      isInReview: row.is_in_review,
      usable: row.usable,
      avgRating: Number(row.avg_rating),
      noRatings: row.no_ratings,
      noComments: row.no_comments ?? 0,
      recipeType: row.recipe_type,
      variantProperties: isVariant
        ? {
            note: row.variant_note ?? "",
            variantName: row.variant_name ?? "",
            eventUid: row.variant_event_uid ?? "",
            originalRecipeUid: row.original_recipe_uid ?? "",
            originalRecipeType: row.original_recipe_type ?? "public",
            originalRecipeCreatorUid: row.original_recipe_creator_uid ?? "",
          }
        : undefined,
      createdAt: row.created_at ? new Date(row.created_at) : new Date(0),
      createdBy: row.created_by ?? "",
    };
  }

  /* =====================================================================
  // Cache-Konfiguration
  // ===================================================================== */
  /**
   * Gibt die Cache-Konfiguration zurück.
   * Rezepte werden 60 Minuten gecacht.
   */
  getCacheConfig(): StorageObjectProperty {
    return STORAGE_OBJECT_PROPERTY.RECIPE;
  }

  /* =====================================================================
  // Convenience-Methoden
  // ===================================================================== */
  /**
   * Lädt ein einzelnes Rezept anhand der ID.
   *
   * @param recipeId - Die ID des Rezepts
   * @param ignoreCache - Wenn true, wird der Cache übersprungen und direkt die DB abgefragt
   * @returns Das Rezept oder null, falls nicht gefunden
   */
  async getRecipe(recipeId: string, ignoreCache = false): Promise<RecipeDomain | null> {
    return this.findById(recipeId, ignoreCache);
  }

  /**
   * Lädt alle öffentlichen Rezepte.
   *
   * @returns Array der öffentlichen Rezepte, sortiert nach Name
   */
  async getAllPublicRecipes(): Promise<RecipeDomain[]> {
    return this.findMany({
      filters: [{field: "recipe_type", operator: "eq", value: "public"}],
      orderBy: {field: "name", direction: "asc"},
    });
  }

  /**
   * Lädt alle privaten Rezepte eines Benutzers.
   * Die RLS-Policy stellt sicher, dass nur eigene Rezepte zurückgegeben werden.
   *
   * @param creatorUid - Die Auth-UID des Benutzers
   * @returns Array der privaten Rezepte, sortiert nach Name
   */
  async getPrivateRecipesForUser(creatorUid: string): Promise<RecipeDomain[]> {
    return this.findMany({
      filters: [
        {field: "recipe_type", operator: "eq", value: "private"},
        {field: "created_by", operator: "eq", value: creatorUid},
      ],
      orderBy: {field: "name", direction: "asc"},
    });
  }

  /**
   * Lädt alle Varianten-Rezepte für ein bestimmtes Event.
   *
   * @param eventUid - Die UID des Events
   * @returns Array der Varianten-Rezepte
   */
  async getVariantsForEvent(eventUid: string): Promise<RecipeDomain[]> {
    return this.findMany({
      filters: [
        {field: "recipe_type", operator: "eq", value: "variant"},
        {field: "variant_event_uid", operator: "eq", value: eventUid},
      ],
      orderBy: {field: "name", direction: "asc"},
    });
  }

  /**
   * Fügt ein neues Rezept in die Datenbank ein.
   * Die UUID wird von der Datenbank generiert.
   *
   * @param recipe - Das Domain-Objekt ohne uid (wird von Postgres vergeben)
   * @param authUser - Der angemeldete Benutzer (für Audit-Zwecke)
   * @returns Das eingefügte Domain-Objekt mit generierter uid
   */
  async insertRecipe(
    recipe: Omit<RecipeDomain, "uid">,
    authUser: AuthUser,
  ): Promise<RecipeDomain> {
    const {value} = await this.insert({
      value: {...recipe, uid: ""} as RecipeDomain,
      authUser,
    });
    return value;
  }

  /**
   * Aktualisiert ein bestehendes Rezept.
   *
   * @param recipe - Das aktualisierte Domain-Objekt
   * @param authUser - Der angemeldete Benutzer (für Audit-Zwecke)
   * @returns Das aktualisierte Domain-Objekt nach DB-Roundtrip
   */
  async updateRecipe(
    recipe: RecipeDomain,
    authUser: AuthUser,
  ): Promise<RecipeDomain> {
    return this.update({id: recipe.uid, value: recipe, authUser});
  }

  /**
   * Löscht ein Rezept und alle zugehörigen Kind-Datensätze (via CASCADE).
   *
   * @param recipeId - Die ID des zu löschenden Rezepts
   */
  async deleteRecipe(recipeId: string): Promise<void> {
    return this.remove(recipeId);
  }

  /* =====================================================================
  // Optimierte Kurz-Abfragen für die Rezeptübersicht
  // =====================================================================
  // Selektiert nur die für RecipeCard benötigten Spalten — deutlich
  // weniger Datenübertrag als getAllPublicRecipes() / getPrivateRecipesForUser().
  // ===================================================================== */

  /**
   * Konvertiert eine DB-Zeile (nur Kurz-Felder) in ein RecipeShortDomain-Objekt.
   *
   * @param row - Zeile aus der Kurz-Abfrage (snake_case)
   * @returns RecipeShortDomain (camelCase)
   */
  private rowToShortDomain(row: Record<string, unknown>): RecipeShortDomain {
    return {
      uid: row.id as string,
      name: (row.name as string) ?? "",
      source: (row.source as string) ?? "",
      pictureSrc: (row.picture_src as string) ?? "",
      tags: (row.tags as string[]) ?? [],
      menuTypes: ((row.menu_types as string[]) ?? [])
        .map((m) => MENU_TYPE_FROM_DB[m])
        .filter((m): m is number => m !== undefined),
      dietProperties: {
        allergens: ((row.allergens as string[]) ?? [])
          .map((a) => ALLERGEN_FROM_DB[a])
          .filter((a): a is number => a !== undefined),
        diet: DIET_FROM_DB[(row.diet as string)] ?? 1,
      },
      outdoorKitchenSuitable: (row.outdoor_kitchen_suitable as boolean) ?? false,
      avgRating: Number(row.avg_rating ?? 0),
      noRatings: (row.no_ratings as number) ?? 0,
      noComments: (row.no_comments as number) ?? 0,
      recipeType: (row.recipe_type as string) ?? "public",
      variantName: (row.variant_name as string | null) ?? null,
      createdAt: row.created_at ? new Date(row.created_at as string) : new Date(0),
      createdBy: (row.created_by as string) ?? "",
    };
  }

  /**
   * Lädt alle öffentlichen Rezepte in Kurzform (nur für die Übersicht benötigte Felder).
   * Deutlich effizienter als getAllPublicRecipes(), da nur 14 statt 28 Spalten gelesen werden.
   *
   * @returns Array der öffentlichen Kurz-Rezepte, sortiert nach Name
   */
  async getAllPublicRecipeShorts(): Promise<RecipeShortDomain[]> {
    const {data, error} = await this.client
      .from(this.tableName)
      .select(RECIPE_SHORT_COLUMNS)
      .eq("recipe_type", "public")
      .order("name", {ascending: true});

    if (error) throw error;
    return (data ?? []).map((row) => this.rowToShortDomain(row as unknown as Record<string, unknown>));
  }

  /**
   * Lädt alle privaten Rezepte eines Benutzers in Kurzform.
   * Die RLS-Policy stellt sicher, dass nur eigene Rezepte zurückgegeben werden.
   *
   * @param creatorUid - Die Auth-UID des Benutzers
   * @returns Array der privaten Kurz-Rezepte, sortiert nach Name
   */
  async getPrivateRecipeShortsForUser(
    creatorUid: string,
  ): Promise<RecipeShortDomain[]> {
    const {data, error} = await this.client
      .from(this.tableName)
      .select(RECIPE_SHORT_COLUMNS)
      .eq("recipe_type", "private")
      .eq("created_by", creatorUid)
      .order("name", {ascending: true});

    if (error) throw error;
    return (data ?? []).map((row) => this.rowToShortDomain(row as unknown as Record<string, unknown>));
  }

  /* =====================================================================
  // Admin-Suchmethoden — verwenden Service Role Client (kein RLS)
  // ===================================================================== */

  /**
   * Hilfsmethode: Filtert nach Rezepttyp wenn nicht "all".
   *
   * @param query - Laufende Supabase-Query
   * @param typeFilter - Rezepttyp-Filter ('all' | 'public' | 'private')
   * @returns Angepasste Query
   */
  private applyTypeFilter(
    query: any,
    typeFilter: "all" | "public" | "private",
  ): any {
    if (typeFilter === "public") return query.eq("recipe_type", "public");
    if (typeFilter === "private") return query.eq("recipe_type", "private");
    return query;
  }

  /**
   * Sucht Rezepte anhand des Namens (case-insensitive Teilstring-Suche).
   * Für die Admin-Übersicht — erfordert Service Role Client.
   *
   * @param term - Suchbegriff (Teilstring)
   * @param typeFilter - Optionaler Rezepttyp-Filter (default: 'all')
   * @returns Array der gefundenen Kurz-Rezepte, sortiert nach Name
   */
  async searchByName(
    term: string,
    typeFilter: "all" | "public" | "private" = "all",
  ): Promise<RecipeShortDomain[]> {
    let query = this.client
      .from(this.tableName)
      .select(RECIPE_SHORT_COLUMNS)
      .ilike("name", `%${term}%`);

    query = this.applyTypeFilter(query, typeFilter);

    const {data, error} = await query.order("name", {ascending: true});
    if (error) throw error;
    return (data ?? []).map((row: unknown) =>
      this.rowToShortDomain(row as Record<string, unknown>),
    );
  }

  /**
   * Sucht ein Rezept anhand seiner genauen UUID.
   * Für die Admin-Übersicht — erfordert Service Role Client.
   *
   * @param id - Die exakte UUID des Rezepts
   * @returns Array mit maximal einem Eintrag
   */
  async searchByRecipeId(id: string): Promise<RecipeShortDomain[]> {
    const {data, error} = await this.client
      .from(this.tableName)
      .select(RECIPE_SHORT_COLUMNS)
      .eq("id", id)
      .order("name", {ascending: true});

    if (error) throw error;
    return (data ?? []).map((row: unknown) =>
      this.rowToShortDomain(row as Record<string, unknown>),
    );
  }

  /**
   * Sucht Rezepte eines Erstellers anhand seiner Auth-UUID.
   * Für die Admin-Übersicht — erfordert Service Role Client.
   *
   * @param authUid - Auth-UUID des Erstellers
   * @param typeFilter - Optionaler Rezepttyp-Filter (default: 'all')
   * @returns Array der gefundenen Kurz-Rezepte, sortiert nach Name
   */
  async searchByCreatorId(
    authUid: string,
    typeFilter: "all" | "public" | "private" = "all",
  ): Promise<RecipeShortDomain[]> {
    let query = this.client
      .from(this.tableName)
      .select(RECIPE_SHORT_COLUMNS)
      .eq("created_by", authUid);

    query = this.applyTypeFilter(query, typeFilter);

    const {data, error} = await query.order("name", {ascending: true});
    if (error) throw error;
    return (data ?? []).map((row: unknown) =>
      this.rowToShortDomain(row as Record<string, unknown>),
    );
  }

  /**
   * Zählt die öffentlichen und privaten Rezepte eines Benutzers.
   * Wird für die Admin-Benutzerübersicht verwendet, um Rezeptstatistiken
   * live aus der Datenbank zu lesen (keine denormalisierte Speicherung).
   *
   * @param creatorAuthUid - Supabase Auth UUID des Erstellers (created_by-Spalte)
   * @returns Anzahl öffentlicher und privater Rezepte
   * @throws {PostgrestError} bei Datenbankfehler
   */
  async findRecipeCountsByCreator(
    creatorAuthUid: string,
  ): Promise<{noRecipesPublic: number; noRecipesPrivate: number}> {
    const {data, error} = await this.client
      .from(this.tableName)
      .select("recipe_type")
      .eq("created_by", creatorAuthUid);

    if (error) throw error;
    const rows = (data ?? []) as {recipe_type: string}[];
    return {
      noRecipesPublic: rows.filter((r) => r.recipe_type === "public").length,
      noRecipesPrivate: rows.filter((r) => r.recipe_type === "private").length,
    };
  }

  /**
   * Sucht Rezepte einer Menge von Ersteller-UUIDs (zweistufige Namenssuche).
   * Wird aufgerufen nachdem `UserRepository.findAuthUidsByDisplayName()` die
   * passenden Auth-UUIDs geliefert hat.
   * Für die Admin-Übersicht — erfordert Service Role Client.
   *
   * @param authUids - Array von Auth-UUIDs der Ersteller
   * @param typeFilter - Optionaler Rezepttyp-Filter (default: 'all')
   * @returns Array der gefundenen Kurz-Rezepte, sortiert nach Name
   */
  async searchByCreatorIds(
    authUids: string[],
    typeFilter: "all" | "public" | "private" = "all",
  ): Promise<RecipeShortDomain[]> {
    if (authUids.length === 0) return [];

    let query = this.client
      .from(this.tableName)
      .select(RECIPE_SHORT_COLUMNS)
      .in("created_by", authUids);

    query = this.applyTypeFilter(query, typeFilter);

    const {data, error} = await query.order("name", {ascending: true});
    if (error) throw error;
    return (data ?? []).map((row: unknown) =>
      this.rowToShortDomain(row as Record<string, unknown>),
    );
  }
}
