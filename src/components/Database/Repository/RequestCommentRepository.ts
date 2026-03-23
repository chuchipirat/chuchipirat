/**
 * RequestCommentRepository — Repository für Antrags-Kommentare.
 *
 * Greift auf die View `request_comments_view` (Lesen) bzw. die Tabelle
 * `request_comments` (Schreiben) zu. Kommentar-Autor-Daten (Anzeigename,
 * Profilbild) werden über die View automatisch aufgelöst.
 *
 * Beim Einfügen eines Kommentars wird asynchron die Edge Function
 * `notify-request` ausgelöst, um die Gegenpartei zu benachrichtigen.
 *
 * @example
 * const comments = await repo.getCommentsForRequest('request-id');
 * const comment = await repo.insertComment('request-id', 'Tolles Rezept!', authUser);
 */
import {SupabaseClient} from "@supabase/supabase-js";
import * as Sentry from "@sentry/browser";
import {BaseRepository} from "./BaseRepository";
import {
  STORAGE_OBJECT_PROPERTY,
  StorageObjectProperty,
} from "../../Firebase/Db/sessionStorageHandler.class";
import {AuthUser} from "../../Firebase/Authentication/authUser.class";

/* =====================================================================
// DB-Zeilenstruktur (snake_case, entspricht den Postgres-Spalten der View)
// ===================================================================== */

/**
 * Datenbank-Zeilentyp für die request_comments_view.
 *
 * @param id - Primärschlüssel (UUID als TEXT)
 * @param request_id - FK auf requests.id
 * @param comment - Kommentartext
 * @param created_at - Erstellungszeitpunkt
 * @param created_by - Auth-UID des Erstellers
 * @param user_display_name - Anzeigename des Kommentar-Autors (aus View)
 * @param user_picture_src - Profilbild des Kommentar-Autors (aus View)
 */
export interface RequestCommentRow {
  [key: string]: unknown;
  id: string;
  request_id: string;
  comment: string;
  created_at: string;
  created_by: string | null;
  updated_at: string;
  updated_by: string | null;
  // View-Felder
  user_display_name: string | null;
  user_picture_src: string | null;
}

/* =====================================================================
// Domain-Modell (camelCase, wird in der App verwendet)
// ===================================================================== */

/**
 * Domain-Modell für einen Antrags-Kommentar.
 *
 * @param uid - Eindeutige ID
 * @param requestId - ID des zugehörigen Antrags
 * @param comment - Kommentartext
 * @param userUid - Auth-UID des Kommentar-Autors
 * @param userDisplayName - Anzeigename des Kommentar-Autors
 * @param userPictureSrc - Profilbild-URL des Kommentar-Autors
 * @param createdAt - Zeitpunkt des Kommentars
 */
export interface RequestCommentDomain {
  uid: string;
  requestId: string;
  comment: string;
  userUid: string;
  userDisplayName: string;
  userPictureSrc: string;
  createdAt: Date;
}

/* =====================================================================
// RequestCommentRepository
// ===================================================================== */

/**
 * Repository für Antrags-Kommentare.
 *
 * Liest über die View `request_comments_view`, schreibt in `request_comments`.
 * Benachrichtigungen werden asynchron über die Edge Function `notify-request`
 * ausgelöst (fire-and-forget).
 */
export class RequestCommentRepository extends BaseRepository<
  RequestCommentDomain,
  RequestCommentRow
> {
  tableName = "request_comments";

  /** View-Name für Leseoperationen. */
  private readonly viewName = "request_comments_view";

  constructor(client?: SupabaseClient) {
    super(client);
  }

  /* =====================================================================
  // Domain → DB-Zeile Mapping
  // ===================================================================== */
  /**
   * Konvertiert ein RequestCommentDomain-Objekt in eine Postgres-Zeile.
   * View-Felder werden nicht geschrieben.
   *
   * @param domain - Das Domain-Objekt (camelCase)
   * @returns Partielle DB-Zeile (snake_case)
   */
  toRow(domain: RequestCommentDomain): Partial<RequestCommentRow> {
    return {
      request_id: domain.requestId,
      comment: domain.comment,
    };
  }

  /* =====================================================================
  // DB-Zeile → Domain Mapping
  // ===================================================================== */
  /**
   * Konvertiert eine Postgres-Zeile (aus der View) in ein RequestCommentDomain-Objekt.
   *
   * @param row - Die DB-Zeile (snake_case)
   * @returns Domain-Objekt (camelCase)
   */
  toDomain(row: RequestCommentRow): RequestCommentDomain {
    return {
      uid: row.id,
      requestId: row.request_id,
      comment: row.comment,
      userUid: row.created_by ?? "",
      userDisplayName: row.user_display_name ?? "",
      userPictureSrc: row.user_picture_src ?? "",
      createdAt: row.created_at ? new Date(row.created_at) : new Date(0),
    };
  }

  /* =====================================================================
  // Cache-Konfiguration
  // ===================================================================== */
  /**
   * Gibt die Cache-Konfiguration zurück.
   * Kommentare werden nicht gecacht.
   */
  getCacheConfig(): StorageObjectProperty {
    return STORAGE_OBJECT_PROPERTY.REQUEST_COMMENTS;
  }

  /* =====================================================================
  // Convenience-Methoden
  // ===================================================================== */

  /**
   * Lädt alle Kommentare für einen Antrag.
   *
   * @param requestId - Die Antrags-ID
   * @returns Array der Kommentare, sortiert nach Erstellungsdatum (älteste zuerst)
   */
  async getCommentsForRequest(requestId: string): Promise<RequestCommentDomain[]> {
    try {
      const {data, error} = await this.client
        .from(this.viewName)
        .select("*")
        .eq("request_id", requestId)
        .order("created_at", {ascending: true});

      if (error) throw error;
      return (data ?? []).map((row) =>
        this.toDomain(row as unknown as RequestCommentRow),
      );
    } catch (error) {
      Sentry.captureException(error);
      throw error;
    }
  }

  /**
   * Fügt einen neuen Kommentar ein und löst eine E-Mail-Benachrichtigung aus.
   *
   * Die Benachrichtigung wird als Fire-and-Forget über die Edge Function
   * `notify-request` mit dem Szenario `requestNewComment` ausgelöst.
   *
   * @param requestId - Die Antrags-ID
   * @param comment - Der Kommentartext
   * @param authUser - Der angemeldete Benutzer
   * @param skipNotification - Wenn true, wird keine separate Kommentar-E-Mail
   *   ausgelöst (z.B. bei Kommentaren als Teil eines Statuswechsels, der
   *   bereits eine eigene Benachrichtigung auslöst).
   * @returns Der eingefügte Kommentar mit Profilfeldern aus authUser
   */
  async insertComment(
    requestId: string,
    comment: string,
    authUser: AuthUser,
    skipNotification = false,
  ): Promise<RequestCommentDomain> {
    try {
      const {data, error} = await this.client
        .from(this.tableName)
        .insert({
          request_id: requestId,
          comment,
        })
        .select("*")
        .single();

      if (error) throw error;

      // Benachrichtigung asynchron auslösen — Fehler beim Senden blocken nicht.
      // Bei Statuswechseln (done, declined) wird die Benachrichtigung
      // übersprungen, da bereits eine spezifische E-Mail ausgelöst wird.
      if (!skipNotification) {
        this.client.functions
          .invoke("notify-request", {
            body: {
              scenario: "requestNewComment",
              requestId,
              commentId: data.id,
            },
          })
          .catch((err: unknown) =>
            Sentry.captureException(err),
          );
      }

      // Domain-Objekt mit Profilfeldern aus authUser zurückgeben
      return {
        uid: data.id,
        requestId,
        comment,
        userUid: authUser.uid ?? "",
        userDisplayName: authUser.publicProfile?.displayName ?? "",
        userPictureSrc: authUser.publicProfile?.pictureSrc ?? "",
        createdAt: data.created_at ? new Date(data.created_at) : new Date(),
      };
    } catch (error) {
      Sentry.captureException(error);
      throw error;
    }
  }
}
