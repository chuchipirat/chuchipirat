/**
 * RequestRepository — Repository für Anträge (Rezept-Veröffentlichung, Fehlermeldungen).
 *
 * Greift auf die View `requests_view` (Lesen) bzw. die Tabelle `requests`
 * (Schreiben) zu. Autor-, Assignee- und Rezeptdaten werden über die View
 * bei SELECT automatisch aufgelöst — keine manuelle Denormalisierung nötig.
 *
 * Die fortlaufende Antragsnummer wird über die Postgres-SEQUENCE
 * `request_number_seq` automatisch vergeben.
 *
 * @example
 * const active = await repo.getActiveRequests();
 * const request = await repo.createRequest({...}, authUser);
 */
import {SupabaseClient} from "@supabase/supabase-js";
import * as Sentry from "@sentry/react";
import {BaseRepository} from "./BaseRepository";
import {
  STORAGE_OBJECT_PROPERTY,
  StorageObjectProperty,
} from "../../Firebase/Db/sessionStorageHandler.class";
import {AuthUser} from "../../Firebase/Authentication/authUser.class";
import {RequestStatus, RequestType} from "../../Request/request.class";

/* =====================================================================
// DB-Zeilenstruktur (snake_case, entspricht den Postgres-Spalten der View)
// ===================================================================== */

/**
 * Datenbank-Zeilentyp für die requests_view.
 *
 * @param id - Primärschlüssel (UUID als TEXT)
 * @param firebase_uid - Alte Firebase-UID für Migrationszuordnung
 * @param number - Fortlaufende Antragsnummer
 * @param status - Aktueller Status
 * @param request_type - Typ des Antrags
 * @param author_uid - Auth-UID des Autors
 * @param assignee_uid - Auth-UID des Bearbeiters
 * @param request_object_uid - UID des Rezepts
 * @param change_log - Statusänderungs-Protokoll als JSONB
 * @param resolve_date - Abschlussdatum
 * @param created_at - Erstellungszeitpunkt
 * @param author_display_name - Anzeigename des Autors (aus View)
 * @param author_picture_src - Profilbild des Autors (aus View)
 * @param assignee_display_name - Anzeigename des Bearbeiters (aus View)
 * @param assignee_picture_src - Profilbild des Bearbeiters (aus View)
 * @param recipe_name - Rezeptname (aus View)
 * @param recipe_picture_src - Rezeptbild (aus View)
 */
export interface RequestRow {
  [key: string]: unknown;
  id: string;
  firebase_uid: string | null;
  number: number;
  status: string;
  request_type: string;
  author_uid: string;
  assignee_uid: string | null;
  request_object_uid: string;
  change_log: ChangeLogEntry[];
  resolve_date: string | null;
  created_at: string;
  created_by: string | null;
  updated_at: string;
  updated_by: string | null;
  // View-Felder
  author_display_name: string | null;
  author_picture_src: string | null;
  assignee_display_name: string | null;
  assignee_picture_src: string | null;
  recipe_name: string | null;
  recipe_picture_src: string | null;
}

/* =====================================================================
// Domain-Modell (camelCase, wird in der App verwendet)
// ===================================================================== */

/**
 * Einzelner Eintrag im Statusänderungs-Protokoll.
 *
 * @param date - Zeitpunkt der Änderung (ISO-String oder Date)
 * @param userUid - Auth-UID des ausführenden Benutzers
 * @param userDisplayName - Anzeigename des ausführenden Benutzers
 * @param action - Art der Aktion (created, assign, changeState)
 * @param newValue - Neuer Wert (z.B. {status: 'inReview'})
 */
export interface ChangeLogEntry {
  date: string;
  userUid: string;
  userDisplayName: string;
  action: string;
  newValue: Record<string, unknown>;
}

/**
 * Domain-Modell für einen Antrag.
 *
 * @param uid - Eindeutige ID
 * @param number - Fortlaufende Antragsnummer
 * @param status - Aktueller Status
 * @param requestType - Typ des Antrags
 * @param authorUid - Auth-UID des Autors
 * @param authorDisplayName - Anzeigename des Autors
 * @param authorPictureSrc - Profilbild des Autors
 * @param assigneeUid - Auth-UID des Bearbeiters
 * @param assigneeDisplayName - Anzeigename des Bearbeiters
 * @param assigneePictureSrc - Profilbild des Bearbeiters
 * @param recipeUid - UID des Rezepts
 * @param recipeName - Name des Rezepts
 * @param recipePictureSrc - Bild des Rezepts
 * @param changeLog - Statusänderungs-Protokoll
 * @param resolveDate - Abschlussdatum (null wenn offen)
 * @param createdAt - Erstellungszeitpunkt
 */
export interface RequestDomain {
  uid: string;
  number: number;
  status: string;
  requestType: string;
  authorUid: string;
  authorDisplayName: string;
  authorPictureSrc: string;
  assigneeUid: string;
  assigneeDisplayName: string;
  assigneePictureSrc: string;
  recipeUid: string;
  recipeName: string;
  recipePictureSrc: string;
  changeLog: ChangeLogEntry[];
  resolveDate: Date | null;
  createdAt: Date;
}

/**
 * Parameter für die Erstellung eines neuen Antrags.
 *
 * @param requestType - Typ des Antrags ('recipePublish' | 'reportError')
 * @param recipeUid - UID des Rezepts
 * @param changeLog - Initialer Changelog-Eintrag
 */
export interface CreateRequestParams {
  requestType: string;
  recipeUid: string;
  changeLog: ChangeLogEntry[];
}

/* =====================================================================
// RequestRepository
// ===================================================================== */

/**
 * Repository für Anträge (Rezept-Veröffentlichung, Fehlermeldungen).
 *
 * Liest über die View `requests_view`, schreibt in die Tabelle `requests`.
 * Die Antragsnummer wird automatisch von der Postgres-SEQUENCE vergeben.
 */
export class RequestRepository extends BaseRepository<
  RequestDomain,
  RequestRow
> {
  tableName = "requests";

  /** View-Name für Leseoperationen. */
  private readonly viewName = "requests_view";

  constructor(client?: SupabaseClient) {
    super(client);
  }

  /* =====================================================================
  // Domain → DB-Zeile Mapping
  // ===================================================================== */
  /**
   * Konvertiert ein RequestDomain-Objekt in eine Postgres-Zeile.
   * View-Felder (author_display_name etc.) werden nicht geschrieben.
   *
   * @param domain - Das Domain-Objekt (camelCase)
   * @returns Partielle DB-Zeile (snake_case)
   */
  toRow(domain: RequestDomain): Partial<RequestRow> {
    return {
      status: domain.status,
      request_type: domain.requestType,
      author_uid: domain.authorUid,
      assignee_uid: domain.assigneeUid || null,
      request_object_uid: domain.recipeUid,
      change_log: domain.changeLog,
      resolve_date: domain.resolveDate?.toISOString() ?? null,
    };
  }

  /* =====================================================================
  // DB-Zeile → Domain Mapping
  // ===================================================================== */
  /**
   * Konvertiert eine Postgres-Zeile (aus der View) in ein RequestDomain-Objekt.
   *
   * @param row - Die DB-Zeile (snake_case)
   * @returns Domain-Objekt (camelCase)
   */
  toDomain(row: RequestRow): RequestDomain {
    return {
      uid: row.id,
      number: row.number,
      status: row.status,
      requestType: row.request_type,
      authorUid: row.author_uid,
      authorDisplayName: row.author_display_name ?? "",
      authorPictureSrc: row.author_picture_src ?? "",
      assigneeUid: row.assignee_uid ?? "",
      assigneeDisplayName: row.assignee_display_name ?? "",
      assigneePictureSrc: row.assignee_picture_src ?? "",
      recipeUid: row.request_object_uid,
      recipeName: row.recipe_name ?? "",
      recipePictureSrc: row.recipe_picture_src ?? "",
      changeLog: Array.isArray(row.change_log) ? row.change_log : [],
      resolveDate: row.resolve_date ? new Date(row.resolve_date) : null,
      createdAt: row.created_at ? new Date(row.created_at) : new Date(0),
    };
  }

  /* =====================================================================
  // Cache-Konfiguration
  // ===================================================================== */
  /**
   * Gibt die Cache-Konfiguration zurück.
   * Anträge werden nicht gecacht — sie ändern sich häufig.
   */
  getCacheConfig(): StorageObjectProperty {
    return STORAGE_OBJECT_PROPERTY.REQUESTS;
  }

  /* =====================================================================
  // Leseoperationen (über View)
  // ===================================================================== */

  /**
   * Lädt alle aktiven Anträge (Status nicht 'done' oder 'declined').
   *
   * @returns Array aktiver Anträge, sortiert nach Erstellungsdatum (neueste zuerst)
   */
  async getActiveRequests(): Promise<RequestDomain[]> {
    try {
      const {data, error} = await this.client
        .from(this.viewName)
        .select("*")
        .not("status", "in", '("done","declined")')
        .order("created_at", {ascending: false});

      if (error) throw error;
      return (data ?? []).map((row) =>
        this.toDomain(row as unknown as RequestRow),
      );
    } catch (error) {
      Sentry.captureException(error);
      throw error;
    }
  }

  /**
   * Lädt alle geschlossenen Anträge (Status 'done' oder 'declined').
   *
   * @returns Array geschlossener Anträge, sortiert nach Erstellungsdatum (neueste zuerst)
   */
  async getClosedRequests(): Promise<RequestDomain[]> {
    try {
      const {data, error} = await this.client
        .from(this.viewName)
        .select("*")
        .in("status", ["done", "declined"])
        .order("created_at", {ascending: false});

      if (error) throw error;
      return (data ?? []).map((row) =>
        this.toDomain(row as unknown as RequestRow),
      );
    } catch (error) {
      Sentry.captureException(error);
      throw error;
    }
  }

  /**
   * Lädt einen einzelnen Antrag anhand seiner ID.
   *
   * @param uid - Die Antrags-ID
   * @returns Der Antrag oder null, falls nicht gefunden
   */
  async getRequestByUid(uid: string): Promise<RequestDomain | null> {
    try {
      const {data, error} = await this.client
        .from(this.viewName)
        .select("*")
        .eq("id", uid)
        .maybeSingle();

      if (error) throw error;
      return data ? this.toDomain(data as unknown as RequestRow) : null;
    } catch (error) {
      Sentry.captureException(error);
      throw error;
    }
  }

  /**
   * Prüft, ob für ein Rezept ein aktiver Veröffentlichungsantrag existiert.
   *
   * Ein Antrag gilt als aktiv, wenn der Status weder 'done' noch 'declined' ist.
   * Ersetzt das denormalisierte `is_in_review`-Flag in der Rezepttabelle.
   *
   * @param recipeUid - UID des Rezepts
   * @returns `true`, wenn ein aktiver Veröffentlichungsantrag existiert
   */
  async hasActivePublishRequest(recipeUid: string): Promise<boolean> {
    try {
      const {count, error} = await this.client
        .from(this.tableName)
        .select("id", {count: "exact", head: true})
        .eq("request_object_uid", recipeUid)
        .eq("request_type", RequestType.recipePublish)
        .not(
          "status",
          "in",
          `("${RequestStatus.done}","${RequestStatus.declined}")`,
        );

      if (error) throw error;
      return (count ?? 0) > 0;
    } catch (error) {
      Sentry.captureException(error);
      throw error;
    }
  }

  /* =====================================================================
  // Schreiboperationen (auf Tabelle)
  // ===================================================================== */

  /**
   * Erstellt einen neuen Antrag. Die Nummer wird automatisch von der
   * Postgres-SEQUENCE vergeben.
   *
   * @param params - Antragstyp, Rezept-UID und initialer Changelog
   * @param authUser - Der angemeldete Benutzer
   * @returns Der erstellte Antrag mit generierter ID und Nummer
   */
  async createRequest(
    params: CreateRequestParams,
    authUser: AuthUser,
  ): Promise<RequestDomain> {
    try {
      const {data, error} = await this.client
        .from(this.tableName)
        .insert({
          status: "created",
          request_type: params.requestType,
          author_uid: authUser.uid,
          request_object_uid: params.recipeUid,
          change_log: params.changeLog,
        })
        .select("*")
        .single();

      if (error) throw error;

      // View-Daten nachladen, um die aufgelösten Felder zu erhalten
      const created = await this.getRequestByUid(data.id);
      if (!created) throw new Error("Erstellter Antrag nicht gefunden");
      return created;
    } catch (error) {
      Sentry.captureException(error);
      throw error;
    }
  }

  /**
   * Aktualisiert den Status eines Antrags und schreibt den Changelog.
   *
   * @param id - Antrags-ID
   * @param status - Neuer Status
   * @param changeLog - Aktualisiertes Changelog-Array
   * @param resolveDate - Optionales Abschlussdatum (bei Statuswechsel zu done/declined)
   * @param authUser - Der angemeldete Benutzer (für Audit)
   * @returns Der aktualisierte Antrag
   */
  async updateStatus(
    id: string,
    status: string,
    changeLog: ChangeLogEntry[],
    authUser: AuthUser,
    resolveDate?: Date,
  ): Promise<RequestDomain> {
    try {
      const fields: Record<string, unknown> = {
        status,
        change_log: changeLog,
      };
      if (resolveDate) {
        fields.resolve_date = resolveDate.toISOString();
      }

      const {error} = await this.client
        .from(this.tableName)
        .update(fields)
        .eq("id", id);

      if (error) throw error;

      const updated = await this.getRequestByUid(id);
      if (!updated) throw new Error("Aktualisierter Antrag nicht gefunden");
      return updated;
    } catch (error) {
      Sentry.captureException(error);
      throw error;
    }
  }

  /**
   * Weist einen Antrag einem Bearbeiter zu.
   *
   * @param id - Antrags-ID
   * @param assigneeUid - Auth-UID des Bearbeiters
   * @param changeLog - Aktualisiertes Changelog-Array
   * @param authUser - Der angemeldete Benutzer (für Audit)
   * @returns Der aktualisierte Antrag
   */
  async assignRequest(
    id: string,
    assigneeUid: string,
    changeLog: ChangeLogEntry[],
    authUser: AuthUser,
  ): Promise<RequestDomain> {
    try {
      const {error} = await this.client
        .from(this.tableName)
        .update({
          assignee_uid: assigneeUid,
          change_log: changeLog,
        })
        .eq("id", id);

      if (error) throw error;

      const updated = await this.getRequestByUid(id);
      if (!updated) throw new Error("Aktualisierter Antrag nicht gefunden");
      return updated;
    } catch (error) {
      Sentry.captureException(error);
      throw error;
    }
  }

  /**
   * Löscht einen Antrag (nur für Admin-Cleanup).
   *
   * @param id - Antrags-ID
   */
  async deleteRequest(id: string): Promise<void> {
    try {
      return this.remove(id);
    } catch (error) {
      Sentry.captureException(error);
      throw error;
    }
  }
}
