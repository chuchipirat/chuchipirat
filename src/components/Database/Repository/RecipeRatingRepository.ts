/**
 * RecipeRatingRepository — Repository für Rezeptbewertungen.
 *
 * Greift auf die Tabelle `recipe_ratings` zu. Jeder Benutzer kann ein
 * öffentliches Rezept genau einmal bewerten (UNIQUE-Constraint auf recipe_id + user_id).
 * Die Aggregatwerte (avg_rating, no_ratings) werden automatisch via DB-Trigger
 * auf der recipes-Tabelle aktuell gehalten.
 *
 * @example
 * const myRating = await repo.getRatingForUser('recipe-id', 'user-uid');
 * await repo.upsertRating({uid: '', recipeId: 'r1', userId: 'u1', rating: 4}, authUser);
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
 * Datenbank-Zeilentyp für die recipe_ratings-Tabelle.
 *
 * @param id - Primärschlüssel (UUID als TEXT)
 * @param recipe_id - FK auf recipes.id
 * @param user_id - FK auf auth.users(id)
 * @param rating - Bewertung von 1–5
 * @param created_at - Erstellungszeitpunkt
 * @param created_by - UID des Erstellers
 * @param updated_at - Zeitpunkt der letzten Änderung
 * @param updated_by - UID des letzten Bearbeiters
 */
export interface RecipeRatingRow {
  [key: string]: unknown;
  id: string;
  recipe_id: string;
  user_id: string;
  rating: number;
  created_at: string;
  created_by: string | null;
  updated_at: string;
  updated_by: string | null;
}

/* =====================================================================
// Domain-Modell (camelCase, wird in der App verwendet)
// ===================================================================== */
/**
 * Domain-Modell für eine Rezeptbewertung.
 *
 * @param uid - Eindeutige ID (entspricht DB-Spalte id)
 * @param recipeId - ID des bewerteten Rezepts
 * @param userId - Auth-UID des bewertenden Benutzers
 * @param rating - Bewertung (1–5)
 */
export interface RecipeRatingDomain {
  uid: string;
  recipeId: string;
  userId: string;
  rating: number;
}

/* =====================================================================
// RecipeRatingRepository
// ===================================================================== */
/**
 * Repository für Rezeptbewertungen.
 * Verwendet Upsert auf den Unique-Constraint (recipe_id, user_id),
 * damit jeder User ein Rezept jederzeit neu bewerten kann.
 */
export class RecipeRatingRepository extends BaseRepository<
  RecipeRatingDomain,
  RecipeRatingRow
> {
  tableName = "recipe_ratings";

  constructor(client?: SupabaseClient) {
    super(client);
  }

  /* =====================================================================
  // Domain → DB-Zeile Mapping
  // ===================================================================== */
  /**
   * Konvertiert ein RecipeRatingDomain-Objekt in eine Postgres-Zeile.
   *
   * @param domain - Das Domain-Objekt (camelCase)
   * @returns Partielle DB-Zeile (snake_case)
   */
  toRow(domain: RecipeRatingDomain): Partial<RecipeRatingRow> {
    return {
      recipe_id: domain.recipeId,
      user_id: domain.userId,
      rating: domain.rating,
    };
  }

  /* =====================================================================
  // DB-Zeile → Domain Mapping
  // ===================================================================== */
  /**
   * Konvertiert eine Postgres-Zeile in ein RecipeRatingDomain-Objekt.
   *
   * @param row - Die DB-Zeile (snake_case)
   * @returns Domain-Objekt (camelCase)
   */
  toDomain(row: RecipeRatingRow): RecipeRatingDomain {
    return {
      uid: row.id,
      recipeId: row.recipe_id,
      userId: row.user_id,
      rating: row.rating,
    };
  }

  /* =====================================================================
  // Cache-Konfiguration
  // ===================================================================== */
  /**
   * Gibt die Cache-Konfiguration zurück.
   * Bewertungen sind benutzerspezifisch und werden nicht gecacht.
   */
  getCacheConfig(): StorageObjectProperty {
    return STORAGE_OBJECT_PROPERTY.RECIPE_RATING;
  }

  /* =====================================================================
  // Convenience-Methoden
  // ===================================================================== */
  /**
   * Lädt die Bewertung eines bestimmten Benutzers für ein Rezept.
   *
   * @param recipeId - Die ID des Rezepts
   * @param userId - Die Auth-UID des Benutzers
   * @returns Die Bewertung oder null, falls der Benutzer noch nicht bewertet hat
   */
  async getRatingForUser(
    recipeId: string,
    userId: string,
  ): Promise<RecipeRatingDomain | null> {
    const {data, error} = await this.client
      .from(this.tableName)
      .select("*")
      .eq("recipe_id", recipeId)
      .eq("user_id", userId)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;

    return this.toDomain(data as RecipeRatingRow);
  }

  /**
   * Fügt eine Bewertung ein oder aktualisiert sie (Upsert auf recipe_id + user_id).
   * Der DB-Trigger aktualisiert anschliessend automatisch avg_rating und no_ratings
   * in der recipes-Tabelle.
   *
   * @param rating - Das Domain-Objekt (uid kann leer sein — wird von Postgres vergeben)
   * @param authUser - Der angemeldete Benutzer (für Audit-Zwecke)
   * @returns Das gespeicherte Domain-Objekt
   */
  async upsertRating(
    rating: RecipeRatingDomain,
    authUser: AuthUser,
  ): Promise<RecipeRatingDomain> {
    // Upsert auf den Unique-Constraint recipe_id + user_id, nicht auf id
    const row = this.toRow(rating);
    if (rating.uid) {
      (row as Record<string, unknown>)["id"] = rating.uid;
    }

    const {data, error} = await this.client
      .from(this.tableName)
      .upsert(row, {onConflict: "recipe_id,user_id"})
      .select()
      .single();

    if (error) throw error;

    return this.toDomain(data as RecipeRatingRow);
  }

  /**
   * Löscht die Bewertung eines Benutzers für ein Rezept.
   * Der DB-Trigger aktualisiert anschliessend automatisch avg_rating und no_ratings.
   *
   * @param recipeId - Die ID des Rezepts
   * @param userId - Die Auth-UID des Benutzers
   */
  async deleteRating(recipeId: string, userId: string): Promise<void> {
    const {error} = await this.client
      .from(this.tableName)
      .delete()
      .eq("recipe_id", recipeId)
      .eq("user_id", userId);

    if (error) throw error;
  }
}
