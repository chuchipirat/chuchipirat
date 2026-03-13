/**
 * RecipePreparationStepRepository — Repository für Zubereitungsschritte und Abschnitts-Trennzeilen.
 *
 * Greift auf die Tabelle `recipe_preparation_steps` zu. Eine Zeile kann entweder
 * ein Schritt ('preparation_step') oder eine Abschnitts-Trennzeile ('section') sein,
 * unterschieden durch den Spaltentyp `pos_type`.
 *
 * @example
 * const steps = await repo.getStepsForRecipe('recipe-id');
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
 * Datenbank-Zeilentyp für die recipe_preparation_steps-Tabelle.
 *
 * @param id - Primärschlüssel (UUID als TEXT)
 * @param firebase_uid - Alte Firebase-UID für Migrationszuordnung
 * @param recipe_id - FK auf recipes.id
 * @param sort_order - Reihenfolge innerhalb des Rezepts
 * @param pos_type - Positionstyp ('preparation_step' | 'section')
 * @param step - Schritttext (leer bei pos_type='section')
 * @param section_name - Abschnittsname (leer bei pos_type='preparation_step')
 * @param created_at - Erstellungszeitpunkt
 * @param created_by - UID des Erstellers
 * @param updated_at - Zeitpunkt der letzten Änderung
 * @param updated_by - UID des letzten Bearbeiters
 */
export interface RecipePreparationStepRow {
  [key: string]: unknown;
  id: string;
  firebase_uid: string | null;
  recipe_id: string;
  sort_order: number;
  pos_type: string;
  step: string;
  section_name: string;
  created_at: string;
  created_by: string | null;
  updated_at: string;
  updated_by: string | null;
}

/* =====================================================================
// Domain-Modell (camelCase, wird in der App verwendet)
// ===================================================================== */
/**
 * Domain-Modell für einen Zubereitungsschritt oder eine Abschnitts-Trennzeile.
 *
 * @param uid - Eindeutige ID (entspricht DB-Spalte id)
 * @param recipeId - ID des zugehörigen Rezepts
 * @param sortOrder - Reihenfolge innerhalb des Rezepts
 * @param posType - 'preparation_step' oder 'section'
 * @param step - Schritttext (leer bei posType='section')
 * @param sectionName - Abschnittsname (leer bei posType='preparation_step')
 */
export interface RecipePreparationStepDomain {
  uid: string;
  recipeId: string;
  sortOrder: number;
  posType: string;
  step: string;
  sectionName: string;
}

/* =====================================================================
// RecipePreparationStepRepository
// ===================================================================== */
/**
 * Repository für Zubereitungsschritte und Abschnitts-Trennzeilen.
 */
export class RecipePreparationStepRepository extends BaseRepository<
  RecipePreparationStepDomain,
  RecipePreparationStepRow
> {
  tableName = "recipe_preparation_steps";

  constructor(client?: SupabaseClient) {
    super(client);
  }

  /* =====================================================================
  // Domain → DB-Zeile Mapping
  // ===================================================================== */
  /**
   * Konvertiert ein RecipePreparationStepDomain-Objekt in eine Postgres-Zeile.
   *
   * @param domain - Das Domain-Objekt (camelCase)
   * @returns Partielle DB-Zeile (snake_case)
   */
  toRow(domain: RecipePreparationStepDomain): Partial<RecipePreparationStepRow> {
    return {
      recipe_id: domain.recipeId,
      sort_order: domain.sortOrder,
      pos_type: domain.posType,
      step: domain.step ?? "",
      section_name: domain.sectionName ?? "",
    };
  }

  /* =====================================================================
  // DB-Zeile → Domain Mapping
  // ===================================================================== */
  /**
   * Konvertiert eine Postgres-Zeile in ein RecipePreparationStepDomain-Objekt.
   *
   * @param row - Die DB-Zeile (snake_case)
   * @returns Domain-Objekt (camelCase)
   */
  toDomain(row: RecipePreparationStepRow): RecipePreparationStepDomain {
    return {
      uid: row.id,
      recipeId: row.recipe_id,
      sortOrder: row.sort_order,
      posType: row.pos_type,
      step: row.step,
      sectionName: row.section_name,
    };
  }

  /* =====================================================================
  // Cache-Konfiguration
  // ===================================================================== */
  /**
   * Gibt die Cache-Konfiguration zurück.
   * Zubereitungsschritte werden nicht gecacht, da sie immer als
   * Gruppe mit dem Rezept aktualisiert werden.
   */
  getCacheConfig(): StorageObjectProperty {
    return STORAGE_OBJECT_PROPERTY.RECIPE_PREPARATION_STEP;
  }

  /* =====================================================================
  // Convenience-Methoden
  // ===================================================================== */
  /**
   * Lädt alle Zubereitungsschritte und Abschnitts-Trennzeilen eines Rezepts.
   * Das Ergebnis ist nach sort_order aufsteigend sortiert.
   *
   * @param recipeId - Die ID des Rezepts
   * @returns Sortiertes Array der Schritt-/Abschnitts-Zeilen
   */
  async getStepsForRecipe(
    recipeId: string,
  ): Promise<RecipePreparationStepDomain[]> {
    return this.findMany({
      filters: [{field: "recipe_id", operator: "eq", value: recipeId}],
      orderBy: {field: "sort_order", direction: "asc"},
    });
  }

  /**
   * Löscht alle Zubereitungsschritte eines Rezepts auf einmal.
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
   * Speichert alle Zubereitungsschritte eines Rezepts (Batch-Upsert mit
   * Batch-Löschung entfernter Zeilen). Gibt die gespeicherten Schritte zurück.
   *
   * @param recipeId - Die ID des Rezepts
   * @param steps - Neue vollständige Liste der Schritte
   * @param _authUser - Der angemeldete Benutzer (für Audit-Zwecke)
   * @returns Gespeicherte Zubereitungsschritte
   */
  async saveAllForRecipe(
    recipeId: string,
    steps: RecipePreparationStepDomain[],
    _authUser: AuthUser,
  ): Promise<RecipePreparationStepDomain[]> {
    // Bestehende IDs laden für Diff-Berechnung
    const existing = await this.getStepsForRecipe(recipeId);
    const existingIds = new Set(existing.map((s) => s.uid));
    const newIds = new Set(steps.map((s) => s.uid));

    // Entfernte Zeilen in einem Batch löschen
    const idsToDelete = [...existingIds].filter((id) => !newIds.has(id));
    await this.batchRemove(idsToDelete);

    // Neue/geänderte Zeilen in einem Batch upserten
    await this.batchUpsert(steps, (s) => s.uid);

    // Neu laden (Konsistenz mit Ingredient/Material-Pattern)
    return this.getStepsForRecipe(recipeId);
  }
}
