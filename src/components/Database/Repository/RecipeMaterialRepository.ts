/**
 * RecipeMaterialRepository — Repository für Materialpositionen eines Rezepts.
 *
 * Greift auf die Tabelle `recipe_materials` zu. Jede Zeile repräsentiert
 * eine Materialposition (Menge + Material-Referenz).
 *
 * @example
 * const materials = await repo.getMaterialsForRecipe('recipe-id');
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
 * Datenbank-Zeilentyp für die recipe_materials-Tabelle.
 *
 * @param id - Primärschlüssel (UUID als TEXT)
 * @param firebase_uid - Alte Firebase-UID für Migrationszuordnung
 * @param recipe_id - FK auf recipes.id
 * @param sort_order - Reihenfolge innerhalb des Rezepts
 * @param material_id - FK auf materials.id (nullable bei gelöschtem Material)
 * @param quantity - Menge des Materials
 * @param material_name - Aufgelöster Materialname (nur von View, nullable)
 * @param created_at - Erstellungszeitpunkt
 * @param created_by - UID des Erstellers
 * @param updated_at - Zeitpunkt der letzten Änderung
 * @param updated_by - UID des letzten Bearbeiters
 */
export interface RecipeMaterialRow {
  [key: string]: unknown;
  id: string;
  firebase_uid: string | null;
  recipe_id: string;
  sort_order: number;
  material_id: string | null;
  quantity: number;
  material_name: string | null;
  created_at: string;
  created_by: string | null;
  updated_at: string;
  updated_by: string | null;
}

/* =====================================================================
// Domain-Modell (camelCase, wird in der App verwendet)
// ===================================================================== */
/**
 * Domain-Modell für eine Rezept-Materialposition.
 *
 * @param uid - Eindeutige ID (entspricht DB-Spalte id)
 * @param recipeId - ID des zugehörigen Rezepts
 * @param sortOrder - Reihenfolge innerhalb des Rezepts
 * @param materialId - ID des Materials (null, wenn Material gelöscht wurde)
 * @param quantity - Menge des Materials
 * @param materialName - Aufgelöster Materialname (optional, nur beim Lesen via View gesetzt)
 */
export interface RecipeMaterialDomain {
  uid: string;
  recipeId: string;
  sortOrder: number;
  materialId: string | null;
  quantity: number;
  materialName?: string;
}

/* =====================================================================
// RecipeMaterialRepository
// ===================================================================== */
/**
 * Repository für Materialpositionen eines Rezepts.
 */
export class RecipeMaterialRepository extends BaseRepository<
  RecipeMaterialDomain,
  RecipeMaterialRow
> {
  tableName = "recipe_materials";

  constructor(client?: SupabaseClient) {
    super(client);
  }

  /* =====================================================================
  // Domain → DB-Zeile Mapping
  // ===================================================================== */
  /**
   * Konvertiert ein RecipeMaterialDomain-Objekt in eine Postgres-Zeile.
   *
   * @param domain - Das Domain-Objekt (camelCase)
   * @returns Partielle DB-Zeile (snake_case)
   */
  toRow(domain: RecipeMaterialDomain): Partial<RecipeMaterialRow> {
    return {
      recipe_id: domain.recipeId,
      sort_order: domain.sortOrder,
      material_id: domain.materialId ?? null,
      quantity: Number.isFinite(domain.quantity) ? domain.quantity : 0,
    };
  }

  /* =====================================================================
  // DB-Zeile → Domain Mapping
  // ===================================================================== */
  /**
   * Konvertiert eine Postgres-Zeile in ein RecipeMaterialDomain-Objekt.
   *
   * @param row - Die DB-Zeile (snake_case)
   * @returns Domain-Objekt (camelCase)
   */
  toDomain(row: RecipeMaterialRow): RecipeMaterialDomain {
    return {
      uid: row.id,
      recipeId: row.recipe_id,
      sortOrder: row.sort_order,
      materialId: row.material_id ?? null,
      quantity: Number(row.quantity),
      materialName: row.material_name ?? "",
    };
  }

  /* =====================================================================
  // Cache-Konfiguration
  // ===================================================================== */
  /**
   * Gibt die Cache-Konfiguration zurück.
   * Materialpositionen werden nicht gecacht.
   */
  getCacheConfig(): StorageObjectProperty {
    return STORAGE_OBJECT_PROPERTY.RECIPE_MATERIAL;
  }

  /* =====================================================================
  // Convenience-Methoden
  // ===================================================================== */
  /**
   * Lädt alle Materialpositionen eines Rezepts, sortiert nach sort_order.
   *
   * @param recipeId - Die ID des Rezepts
   * @returns Sortiertes Array der Materialpositionen
   */
  async getMaterialsForRecipe(
    recipeId: string,
  ): Promise<RecipeMaterialDomain[]> {
    // View statt Basistabelle: liefert material_name via LEFT JOIN
    const {data, error} = await this.client
      .from("recipe_materials_with_names")
      .select("*")
      .eq("recipe_id", recipeId)
      .order("sort_order", {ascending: true});

    if (error) throw error;
    return (data ?? []).map((row) => this.toDomain(row as RecipeMaterialRow));
  }

  /**
   * Löscht alle Materialpositionen eines Rezepts auf einmal.
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
   * Speichert alle Materialpositionen eines Rezepts (Batch-Upsert mit
   * Batch-Löschung entfernter Zeilen). Gibt die gespeicherten Materialien
   * mit aufgelösten Materialnamen zurück (via View).
   *
   * @param recipeId - Die ID des Rezepts
   * @param materials - Neue vollständige Liste der Materialpositionen
   * @param _authUser - Der angemeldete Benutzer (für Audit-Zwecke)
   * @returns Gespeicherte Materialien mit aufgelösten Materialnamen
   */
  async saveAllForRecipe(
    recipeId: string,
    materials: RecipeMaterialDomain[],
    _authUser: AuthUser,
  ): Promise<RecipeMaterialDomain[]> {
    // Bestehende IDs laden für Diff-Berechnung
    const existing = await this.getMaterialsForRecipe(recipeId);
    const existingIds = new Set(existing.map((m) => m.uid));
    const newIds = new Set(materials.map((m) => m.uid));

    // Entfernte Zeilen in einem Batch löschen
    const idsToDelete = [...existingIds].filter((id) => !newIds.has(id));
    await this.batchRemove(idsToDelete);

    // Neue/geänderte Zeilen in einem Batch upserten
    await this.batchUpsert(materials, (m) => m.uid);

    // Via View neu laden, um aufgelöste Materialnamen zu erhalten
    return this.getMaterialsForRecipe(recipeId);
  }
}
