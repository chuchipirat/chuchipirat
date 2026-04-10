/**
 * RecipeCommentRepository — Repository für Rezeptkommentare.
 *
 * Greift auf die Tabelle `recipe_comments` zu. Kommentare können nur bei
 * öffentlichen Rezepten hinterlassen werden (via RLS-Policy).
 *
 * Anzeigename und Profilbild werden NICHT in recipe_comments gespeichert.
 * Sie werden bei Bedarf aus der View `public.user_profiles` geladen, die
 * keine RLS hat und für alle authentifizierten Nutzer lesbar ist — ein
 * direkter Join auf `public.users` würde an der RLS-Policy scheitern,
 * da `recipe_comments.created_by` auf `auth.users` zeigt, nicht auf
 * `public.users`.
 *
 * @example
 * const comments = await repo.getCommentsForRecipe('recipe-id');
 * const comment = await repo.insertComment({recipeId: 'r1', comment: 'Lecker!'}, authUser);
 */
import * as Sentry from "@sentry/react";
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
 * Datenbank-Zeilentyp für die recipe_comments-Tabelle.
 *
 * @param id - Primärschlüssel (UUID als TEXT)
 * @param firebase_uid - Alte Firebase-UID für Migrationszuordnung
 * @param recipe_id - FK auf recipes.id
 * @param comment - Kommentartext
 * @param created_at - Erstellungszeitpunkt
 * @param created_by - Auth-UID des Erstellers (FK auf auth.users.id)
 * @param updated_at - Zeitpunkt der letzten Änderung
 * @param updated_by - UID des letzten Bearbeiters
 */
export interface RecipeCommentRow {
  [key: string]: unknown;
  id: string;
  firebase_uid: string | null;
  recipe_id: string;
  comment: string;
  created_at: string;
  created_by: string | null;
  updated_at: string;
  updated_by: string | null;
}

/* =====================================================================
// Domain-Modell (camelCase, wird in der App verwendet)
// ===================================================================== */
/**
 * Domain-Modell für einen Rezeptkommentar.
 *
 * @param uid - Eindeutige ID (entspricht DB-Spalte id)
 * @param recipeId - ID des kommentierten Rezepts
 * @param comment - Kommentartext
 * @param createdAt - Zeitpunkt des Kommentars
 * @param createdBy - Auth-UID des Kommentierenden
 * @param displayName - Anzeigename des Kommentierenden (aus user_profiles-View)
 * @param pictureSrc - Profilbild-URL des Kommentierenden (aus user_profiles-View)
 */
export interface RecipeCommentDomain {
  uid: string;
  recipeId: string;
  comment: string;
  createdAt: Date;
  createdBy: string;
  displayName: string;
  pictureSrc: string;
}

/**
 * Zeilentyp für die recipe_comments_view (enthält angereicherte Profilfelder).
 */
interface RecipeCommentViewRow {
  id: string;
  recipe_id: string;
  comment: string;
  created_at: string;
  user_uid: string | null;
  updated_at: string;
  recipe_name: string | null;
  user_display_name: string | null;
  user_picture_src: string | null;
}

/* =====================================================================
// RecipeCommentRepository
// ===================================================================== */
/**
 * Repository für Rezeptkommentare.
 *
 * Profilfelder (displayName, pictureSrc) werden nicht in der Tabelle gespeichert,
 * sondern bei Lesezugriffen aus der View `public.user_profiles` nachgeladen,
 * die ohne RLS für alle authentifizierten Benutzer zugänglich ist.
 */
export class RecipeCommentRepository extends BaseRepository<
  RecipeCommentDomain,
  RecipeCommentRow
> {
  tableName = "recipe_comments";

  constructor(client?: SupabaseClient) {
    super(client);
  }

  /* =====================================================================
  // Domain → DB-Zeile Mapping
  // ===================================================================== */
  /**
   * Konvertiert ein RecipeCommentDomain-Objekt in eine Postgres-Zeile.
   * displayName und pictureSrc werden nicht persistiert — sie stammen aus
   * der user_profiles-View und werden nur im Domain-Modell gehalten.
   *
   * @param domain - Das Domain-Objekt (camelCase)
   * @returns Partielle DB-Zeile (snake_case)
   */
  toRow(domain: RecipeCommentDomain): Partial<RecipeCommentRow> {
    return {
      recipe_id: domain.recipeId,
      comment: domain.comment,
    };
  }

  /* =====================================================================
  // DB-Zeile → Domain Mapping
  // ===================================================================== */
  /**
   * Konvertiert eine Postgres-Zeile in ein RecipeCommentDomain-Objekt.
   * displayName und pictureSrc werden leer zurückgegeben — sie werden
   * separat aus user_profiles angereichert (siehe getCommentsForRecipe).
   *
   * @param row - Die DB-Zeile (snake_case)
   * @returns Domain-Objekt (camelCase) mit leeren Profilfeldern
   */
  toDomain(row: RecipeCommentRow): RecipeCommentDomain {
    return {
      uid: row.id,
      recipeId: row.recipe_id,
      comment: row.comment,
      createdAt: row.created_at ? new Date(row.created_at) : new Date(0),
      createdBy: row.created_by ?? "",
      // Profilfelder leer — werden in getCommentsForRecipe() angereichert
      displayName: "",
      pictureSrc: "",
    };
  }

  /* =====================================================================
  // Cache-Konfiguration
  // ===================================================================== */
  /**
   * Gibt die Cache-Konfiguration zurück.
   * Kommentare werden nicht gecacht, da sie häufig aktualisiert werden.
   */
  getCacheConfig(): StorageObjectProperty {
    return STORAGE_OBJECT_PROPERTY.RECIPE_COMMENT;
  }

  /* =====================================================================
  // Convenience-Methoden
  // ===================================================================== */
  /**
   * Lädt Kommentare für ein Rezept via `recipe_comments_view`.
   *
   * Die View joined `recipe_comments` mit `user_profiles` und `recipes`,
   * sodass Anzeigename und Profilbild direkt in der Abfrage enthalten sind —
   * kein separater RPC-Aufruf nötig.
   *
   * @param recipeId - Die ID des Rezepts
   * @param limit - Maximale Anzahl zu ladender Kommentare (Standard: 50)
   * @param offset - Versatz für Paginierung (Standard: 0)
   * @returns Array der Kommentare (neueste zuerst) mit befüllten Profilfeldern
   */
  async getCommentsForRecipe(
    recipeId: string,
    limit = 50,
    offset = 0,
  ): Promise<RecipeCommentDomain[]> {
    const {data, error} = await this.client
      .from("recipe_comments_view")
      .select("*")
      .eq("recipe_id", recipeId)
      .order("created_at", {ascending: false})
      .range(offset, offset + limit - 1);

    if (error) throw error;
    if (!data || data.length === 0) return [];

    return (data as unknown as RecipeCommentViewRow[]).map((row) => ({
      uid: row.id,
      recipeId: row.recipe_id,
      comment: row.comment,
      createdAt: row.created_at ? new Date(row.created_at) : new Date(0),
      createdBy: row.user_uid ?? "",
      displayName: row.user_display_name ?? "",
      pictureSrc: row.user_picture_src ?? "",
    }));
  }

  /**
   * Fügt einen neuen Kommentar ein und benachrichtigt den Rezeptautor per E-Mail.
   * Die E-Mail-Benachrichtigung wird als Fire-and-Forget ausgelöst — ein Fehler
   * beim Senden verhindert die Rückgabe des Kommentars nicht.
   *
   * Da Profilfelder nicht in der DB gespeichert sind, werden displayName und
   * pictureSrc direkt aus dem authUser-Objekt in das zurückgegebene Domain-Objekt
   * eingefügt, ohne einen weiteren DB-Query auszuführen.
   *
   * @param params - Objekt mit recipeId und Kommentartext
   * @param authUser - Der angemeldete Benutzer (für Profilfelder und Audit)
   * @returns Der eingefügte Kommentar mit generierter uid, createdAt und Profilfeldern
   */
  async insertComment(
    params: {recipeId: string; comment: string},
    authUser: AuthUser,
  ): Promise<RecipeCommentDomain> {
    const {value} = await this.insert({
      value: {
        uid: "",
        recipeId: params.recipeId,
        comment: params.comment,
        createdAt: new Date(),
        createdBy: "",
        displayName: "",
        pictureSrc: "",
      },
      authUser,
    });

    // Benachrichtigung asynchron auslösen — Fehler beim Senden blocken nicht.
    this.client.functions
      .invoke("notify-recipe-comment", {
        body: {commentId: value.uid, recipeId: params.recipeId},
      })
      .catch((err: unknown) =>
        Sentry.captureException(err, {
          extra: {context: "notify-recipe-comment konnte nicht aufgerufen werden"},
        }),
      );

    // Profilfelder aus authUser anreichern — kein zusätzlicher DB-Query nötig
    return {
      ...value,
      displayName: authUser.publicProfile?.displayName ?? "",
      pictureSrc: authUser.publicProfile?.pictureSrc ?? "",
    };
  }

  /**
   * Aktualisiert den Text eines bestehenden Kommentars.
   * Nur der Ersteller darf den eigenen Kommentar bearbeiten (via RLS-Policy).
   * Verwendet patch() statt update(), damit recipe_id nicht überschrieben wird.
   *
   * @param commentId - Die ID des zu aktualisierenden Kommentars
   * @param comment - Der neue Kommentartext
   * @param authUser - Der angemeldete Benutzer (für Audit-Zwecke)
   */
  async updateComment(
    commentId: string,
    comment: string,
    authUser: AuthUser,
  ): Promise<void> {
    return this.patch({
      id: commentId,
      fields: {comment} as Partial<RecipeCommentRow>,
      authUser,
    });
  }

  /**
   * Löscht einen Kommentar anhand der ID.
   * Nur der Ersteller oder ein Community Leader / Admin darf löschen (via RLS-Policy).
   *
   * @param commentId - Die ID des zu löschenden Kommentars
   */
  async deleteComment(commentId: string): Promise<void> {
    return this.remove(commentId);
  }
}
