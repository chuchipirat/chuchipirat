/**
 * Migrationsjob für Rezept-Bewertungen von Firebase nach Postgres.
 *
 * Migriert individuelle Bewertungen aus den Firestore-Subcollections:
 * - `recipes/public/recipes/{recipeId}/ratings/{userUid}`
 *
 * Jedes Rating-Dokument enthält `{ rating: number }` (1–5).
 *
 * In Supabase werden die Bewertungen in `recipe_ratings` gespeichert.
 * Ein Trigger (`update_recipe_rating_aggregate`) aktualisiert automatisch
 * `avg_rating` und `no_ratings` auf der `recipes`-Tabelle.
 *
 * Voraussetzungen:
 * - Rezepte müssen bereits migriert sein (firebase_uid gesetzt)
 * - Benutzer müssen bereits migriert sein (legacy_firebase_uid gesetzt)
 */
import {getDocs, collection} from "firebase/firestore";
import Firebase from "../../Firebase/firebase.class";
import DatabaseService from "../../Database/DatabaseService";
import AuthUser from "../../Firebase/Authentication/authUser.class";
import {supabaseAdmin} from "../../Database/supabaseClient";
import {MigrationJob, SourceRecord, fetchAllRows} from "./MigrationJob.interface";

/* =====================================================================
// Datenstrukturen
// ===================================================================== */

/**
 * Quelldaten für eine Rezept-Bewertungsmigration.
 * Ein SourceRecord enthält alle Bewertungen eines Rezepts.
 *
 * @param recipeId - Postgres-ID des Rezepts
 * @param ratings - Array aller Bewertungen mit aufgelöster User-UUID
 */
interface RatingSourceData {
  recipeId: string;
  ratings: {userId: string; rating: number}[];
}

/* =====================================================================
// RecipeRatingMigrationJob
// ===================================================================== */

/**
 * Migriert individuelle Rezept-Bewertungen von Firebase nach Postgres.
 *
 * Pro Rezept werden alle Bewertungen als Batch eingefügt (1 DB-Aufruf
 * pro Rezept statt 1 pro Bewertung).
 *
 * @example
 * const job = new RecipeRatingMigrationJob();
 * const records = await job.fetchSourceRecords(firebase, database);
 */
export class RecipeRatingMigrationJob implements MigrationJob<RatingSourceData> {
  name = "Rezept-Bewertungen";
  description =
    "Migriert individuelle Bewertungen von Firebase nach Postgres. " +
    "Setzt voraus, dass Rezepte und Benutzer bereits migriert sind.";

  /** Firebase-UID → Supabase-Auth-UUID für Benutzer */
  private userAuthUidByFirebaseUid: Map<string, string> = new Map();
  /** Set der recipe_ids, für die bereits Bewertungen existieren */
  private existingRatingRecipeIds: Set<string> | null = null;

  /** Firebase-UID → Postgres-ID für Rezepte */
  private recipeIdByFirebaseUid: Map<string, string> = new Map();

  /* =====================================================================
  // Quelldaten aus Firebase laden
  // ===================================================================== */
  /**
   * Liest alle öffentlichen Rezepte aus Firestore und prüft anhand des
   * `rating`-Felds (direkt im Rezeptdokument), ob Bewertungen vorhanden sind.
   * Nur für Rezepte mit `rating.noRatings > 0` wird die `ratings`-Subcollection
   * gelesen und die individuellen Bewertungen gesammelt.
   *
   * @param firebase - Firebase-Instanz (für Firestore-Zugriff)
   * @param _database - DatabaseService-Instanz (nicht verwendet)
   * @returns Array der Rezepte mit ihren Bewertungen
   */
  async fetchSourceRecords(
    firebase: Firebase,
    _database?: DatabaseService,
  ): Promise<SourceRecord<RatingSourceData>[]> {
    const client = supabaseAdmin!;

    // Lookup-Map für Benutzer aufbauen (Firebase-UID → Supabase-UUID)
    const userRows = await fetchAllRows(
      client, "users", "id, legacy_firebase_uid",
      (query) => query.not("legacy_firebase_uid", "is", null),
    );
    for (const row of userRows) {
      if (row.legacy_firebase_uid && row.id) {
        this.userAuthUidByFirebaseUid.set(
          row.legacy_firebase_uid as string,
          row.id as string,
        );
      }
    }

    // Lookup-Map für Rezepte aufbauen (Firebase-UID → Postgres-ID)
    const recipeRows = await fetchAllRows(
      client, "recipes", "id, firebase_uid",
      (query) => query.not("firebase_uid", "is", null),
    );
    for (const row of recipeRows) {
      if (row.firebase_uid) {
        this.recipeIdByFirebaseUid.set(
          row.firebase_uid as string,
          row.id as string,
        );
      }
    }

    // Bereits migrierte Bewertungen laden (für checkExists)
    const existingRows = await fetchAllRows(
      client, "recipe_ratings", "recipe_id",
    );
    this.existingRatingRecipeIds = new Set(
      existingRows.map((row) => row.recipe_id as string),
    );

    // Alle öffentlichen Rezepte aus Firestore laden (1 Query)
    const recipesRef = collection(
      firebase.firestore,
      "recipes/public/recipes",
    );
    const recipesSnapshot = await getDocs(recipesRef);

    const records: SourceRecord<RatingSourceData>[] = [];

    for (const recipeDoc of recipesSnapshot.docs) {
      const firebaseUid = recipeDoc.id;
      const recipeData = recipeDoc.data();

      // Nur Rezepte mit Bewertungen verarbeiten
      const noRatings = recipeData.rating?.noRatings ?? 0;
      if (noRatings === 0) continue;

      // Postgres-ID auflösen
      const recipeId = this.recipeIdByFirebaseUid.get(firebaseUid);
      if (!recipeId) continue; // Rezept nicht in Postgres → überspringen

      // Ratings-Subcollection lesen
      let ratingDocs;
      try {
        const ratingsRef = collection(
          firebase.firestore,
          `recipes/public/recipes/${firebaseUid}/ratings`,
        );
        const snapshot = await getDocs(ratingsRef);
        ratingDocs = snapshot.docs;
      } catch {
        continue;
      }

      if (ratingDocs.length === 0) continue;

      // Ratings mit aufgelösten User-UUIDs sammeln
      const ratings: {userId: string; rating: number}[] = [];
      for (const ratingDoc of ratingDocs) {
        const userFirebaseUid = ratingDoc.id;
        const userId = this.userAuthUidByFirebaseUid.get(userFirebaseUid);
        if (!userId) continue;

        const data = ratingDoc.data();
        const rawRating = data.rating;
        if (typeof rawRating !== "number" || rawRating < 1 || rawRating > 5) continue;
        const ratingValue = Math.floor(rawRating);

        ratings.push({userId, rating: ratingValue});
      }

      if (ratings.length === 0) continue;

      const recipeName = (recipeData.name as string) ?? firebaseUid;
      records.push({
        id: recipeId,
        label: `${recipeName} (${ratings.length} Bewertungen)`,
        data: {recipeId, ratings},
      });
    }

    return records;
  }

  /* =====================================================================
  // Prüfen ob Bewertungen für dieses Rezept bereits existieren
  // ===================================================================== */
  /**
   * Prüft in-memory, ob für dieses Rezept bereits Bewertungen migriert wurden.
   *
   * @param _database - DatabaseService-Instanz (nicht verwendet)
   * @param record - Der zu prüfende Quelldatensatz
   * @returns true, falls bereits Bewertungen existieren
   */
  async checkExists(
    _database: DatabaseService,
    record: SourceRecord<RatingSourceData>,
  ): Promise<boolean> {
    return this.existingRatingRecipeIds?.has(record.data.recipeId) ?? false;
  }

  /* =====================================================================
  // Bewertungen eines Rezepts migrieren
  // ===================================================================== */
  /**
   * Fügt alle Bewertungen eines Rezepts als Batch in `recipe_ratings` ein.
   *
   * @param _database - DatabaseService-Instanz (nicht verwendet)
   * @param record - Quelldatensatz mit allen Bewertungen des Rezepts
   * @param _authUser - Admin-Benutzer (nicht verwendet)
   */
  async migrateRecord(
    _database: DatabaseService,
    record: SourceRecord<RatingSourceData>,
    _authUser: AuthUser,
  ): Promise<void> {
    const {recipeId, ratings} = record.data;

    const rows = ratings.map((entry) => ({
      recipe_id: recipeId,
      user_id: entry.userId,
      rating: entry.rating,
    }));

    const {error} = await supabaseAdmin!
      .from("recipe_ratings")
      .insert(rows);

    if (error) throw error;
  }
}
