/**
 * RecipeIngredientRepository — Repository für Rezept-Zutaten und Abschnitts-Trennzeilen.
 *
 * Greift auf die Tabelle `recipe_ingredients` zu. Eine Zeile kann entweder
 * eine Zutat ('ingredient') oder eine Abschnitts-Trennzeile ('section') sein,
 * unterschieden durch den Spaltentyp `pos_type`.
 *
 * @example
 * const ingredients = await repo.getIngredientsForRecipe('recipe-id');
 */
import {SupabaseClient} from "@supabase/supabase-js";
import {BaseRepository} from "./BaseRepository";
import {
  STORAGE_OBJECT_PROPERTY,
  StorageObjectProperty,
} from "../../Firebase/Db/sessionStorageHandler.class";
import {AuthUser} from "../../Firebase/Authentication/authUser.class";

/* =====================================================================
// DB-Zeilenstruktur (snake_case, entspricht den Postgres-Spalten)
// ===================================================================== */
/**
 * Datenbank-Zeilentyp für die recipe_ingredients-Tabelle.
 *
 * @param id - Primärschlüssel (UUID als TEXT)
 * @param firebase_uid - Alte Firebase-UID für Migrationszuordnung
 * @param recipe_id - FK auf recipes.id
 * @param sort_order - Reihenfolge innerhalb des Rezepts (Schritte von 10)
 * @param pos_type - Positionstyp ('ingredient' | 'section')
 * @param product_id - FK auf products.id (null bei pos_type='section')
 * @param quantity - Menge (0 bei pos_type='section')
 * @param unit - Einheit (null bei pos_type='section')
 * @param detail - Detailangabe (leer bei pos_type='section')
 * @param scaling_factor - Skalierungsfaktor (1.0 = normal)
 * @param section_name - Abschnittsname (leer bei pos_type='ingredient')
 * @param product_name - Aufgelöster Produktname (nur von View, null bei Abschnitten)
 * @param created_at - Erstellungszeitpunkt
 * @param created_by - UID des Erstellers
 * @param updated_at - Zeitpunkt der letzten Änderung
 * @param updated_by - UID des letzten Bearbeiters
 */
export interface RecipeIngredientRow {
  [key: string]: unknown;
  id: string;
  firebase_uid: string | null;
  recipe_id: string;
  sort_order: number;
  pos_type: string;
  product_id: string | null;
  quantity: number;
  unit: string | null;
  detail: string;
  scaling_factor: number;
  section_name: string;
  product_name: string | null;
  created_at: string;
  created_by: string | null;
  updated_at: string;
  updated_by: string | null;
}

/* =====================================================================
// Domain-Modell (camelCase, wird in der App verwendet)
// ===================================================================== */
/**
 * Domain-Modell für eine Rezept-Zutat oder eine Abschnitts-Trennzeile.
 *
 * @param uid - Eindeutige ID (entspricht DB-Spalte id)
 * @param recipeId - ID des zugehörigen Rezepts
 * @param sortOrder - Reihenfolge innerhalb des Rezepts
 * @param posType - 'ingredient' oder 'section'
 * @param productId - ID des Produkts (null bei posType='section')
 * @param quantity - Menge (0 bei posType='section')
 * @param unit - Einheiten-Key (null bei posType='section')
 * @param detail - Detailangabe (leer bei posType='section')
 * @param scalingFactor - Skalierungsfaktor (Standard: 1)
 * @param sectionName - Abschnittsname (leer bei posType='ingredient')
 * @param productName - Aufgelöster Produktname (optional, nur beim Lesen via View gesetzt)
 */
export interface RecipeIngredientDomain {
  uid: string;
  recipeId: string;
  sortOrder: number;
  posType: string;
  productId: string | null;
  quantity: number;
  unit: string | null;
  detail: string;
  scalingFactor: number;
  sectionName: string;
  productName?: string;
}

/* =====================================================================
// RecipeIngredientRepository
// ===================================================================== */
/**
 * Repository für Rezept-Zutaten und Abschnitts-Trennzeilen.
 */
export class RecipeIngredientRepository extends BaseRepository<
  RecipeIngredientDomain,
  RecipeIngredientRow
> {
  tableName = "recipe_ingredients";

  constructor(client?: SupabaseClient) {
    super(client);
  }

  /* =====================================================================
  // Domain → DB-Zeile Mapping
  // ===================================================================== */
  /**
   * Konvertiert ein RecipeIngredientDomain-Objekt in eine Postgres-Zeile.
   *
   * @param domain - Das Domain-Objekt (camelCase)
   * @returns Partielle DB-Zeile (snake_case)
   */
  toRow(domain: RecipeIngredientDomain): Partial<RecipeIngredientRow> {
    return {
      recipe_id: domain.recipeId,
      sort_order: domain.sortOrder,
      pos_type: domain.posType,
      product_id: domain.productId ?? null,
      // Number.isFinite schützt gegen NaN/undefined, die als JSON-null serialisiert würden
      quantity: Number.isFinite(domain.quantity) ? domain.quantity : 0,
      // Leerer String ist kein gültiger units.key → als null behandeln
      unit: domain.unit || null,
      detail: domain.detail ?? "",
      scaling_factor: domain.scalingFactor ?? 1,
      section_name: domain.sectionName ?? "",
    };
  }

  /* =====================================================================
  // DB-Zeile → Domain Mapping
  // ===================================================================== */
  /**
   * Konvertiert eine Postgres-Zeile in ein RecipeIngredientDomain-Objekt.
   *
   * @param row - Die DB-Zeile (snake_case)
   * @returns Domain-Objekt (camelCase)
   */
  toDomain(row: RecipeIngredientRow): RecipeIngredientDomain {
    return {
      uid: row.id,
      recipeId: row.recipe_id,
      sortOrder: row.sort_order,
      posType: row.pos_type,
      productId: row.product_id ?? null,
      quantity: Number(row.quantity),
      unit: row.unit ?? null,
      detail: row.detail,
      scalingFactor: Number(row.scaling_factor),
      sectionName: row.section_name,
      productName: row.product_name ?? "",
    };
  }

  /* =====================================================================
  // Cache-Konfiguration
  // ===================================================================== */
  /**
   * Gibt die Cache-Konfiguration zurück.
   * Zutaten werden nicht gecacht, da sie immer mit dem Rezept zusammen
   * geladen und als Gruppe aktualisiert werden.
   */
  getCacheConfig(): StorageObjectProperty {
    return STORAGE_OBJECT_PROPERTY.RECIPE_INGREDIENT;
  }

  /* =====================================================================
  // Convenience-Methoden
  // ===================================================================== */
  /**
   * Lädt alle Zutaten und Abschnitts-Trennzeilen eines Rezepts.
   * Das Ergebnis ist nach sort_order aufsteigend sortiert.
   *
   * @param recipeId - Die ID des Rezepts
   * @returns Sortiertes Array der Zutat-/Abschnitts-Zeilen
   */
  async getIngredientsForRecipe(
    recipeId: string,
  ): Promise<RecipeIngredientDomain[]> {
    // View statt Basistabelle: liefert product_name via LEFT JOIN
    const {data, error} = await this.client
      .from("recipe_ingredients_with_names")
      .select("*")
      .eq("recipe_id", recipeId)
      .order("sort_order", {ascending: true});

    if (error) throw error;
    return (data ?? []).map((row) => this.toDomain(row as RecipeIngredientRow));
  }

  /**
   * Löscht alle Zutaten eines Rezepts auf einmal.
   * Wird vor einem vollständigen Neuschreiben (Batch-Update) verwendet.
   *
   * @param recipeId - Die ID des Rezepts
   */
  async deleteAllForRecipe(recipeId: string): Promise<void> {
    const {error} = await this.client
      .from(this.tableName)
      .delete()
      .eq("recipe_id", recipeId);

    if (error) throw error;
  }

  /**
   * Speichert alle Zutaten eines Rezepts (Upsert mit Löschung entfernter Zeilen).
   * Vergleicht die übergebene Liste mit dem aktuellen DB-Stand.
   *
   * @param recipeId - Die ID des Rezepts
   * @param ingredients - Neue vollständige Liste der Zutaten
   * @param authUser - Der angemeldete Benutzer (für Audit-Zwecke)
   */
  async saveAllForRecipe(
    recipeId: string,
    ingredients: RecipeIngredientDomain[],
    authUser: AuthUser,
  ): Promise<void> {
    const existing = await this.getIngredientsForRecipe(recipeId);
    const existingIds = new Set(existing.map((ingredient) => ingredient.uid));
    const newIds = new Set(ingredients.map((ingredient) => ingredient.uid));

    // Entfernte Zeilen löschen
    for (const existingId of existingIds) {
      if (!newIds.has(existingId)) {
        await this.remove(existingId);
      }
    }

    // Neue/geänderte Zeilen upserten
    for (const ingredient of ingredients) {
      await this.upsert({
        id: ingredient.uid,
        value: ingredient,
        authUser,
      });
    }
  }
}
