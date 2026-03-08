/**
 * EventRepository — Repository für Events (Kopfdaten, Köche, Zeitscheiben).
 *
 * Verwaltet die Tabellen `events`, `event_cooks` und `event_dates`.
 * Ersetzt die Firebase-Methoden in event.class.ts.
 *
 * @example
 * const event = await repo.getEvent('abc-123');
 * const events = await repo.getAllEventsForUser();
 */
import {SupabaseClient} from "@supabase/supabase-js";
import {BaseRepository} from "./BaseRepository";
import {
  STORAGE_OBJECT_PROPERTY,
  StorageObjectProperty,
} from "../../Firebase/Db/sessionStorageHandler.class";
import {AuthUser} from "../../Firebase/Authentication/authUser.class";
import {supabase} from "../supabaseClient";

/* =====================================================================
// DB-Zeilenstrukturen (snake_case, entspricht den Postgres-Spalten)
// ===================================================================== */

/**
 * Datenbank-Zeilentyp für die events-Tabelle.
 */
export interface EventRow {
  [key: string]: unknown;
  id: string;
  firebase_uid: string | null;
  name: string;
  motto: string;
  location: string;
  picture_src: string;
  created_at: string;
  created_by: string | null;
  updated_at: string;
  updated_by: string | null;
}

/**
 * Datenbank-Zeilentyp für die event_cooks-Tabelle.
 */
export interface EventCookRow {
  [key: string]: unknown;
  id: string;
  firebase_uid: string | null;
  event_id: string;
  user_id: string;
  created_at: string;
  created_by: string | null;
  updated_at: string;
  updated_by: string | null;
}

/**
 * Datenbank-Zeilentyp für die event_dates-Tabelle.
 */
export interface EventDateRow {
  [key: string]: unknown;
  id: string;
  firebase_uid: string | null;
  event_id: string;
  sort_order: number;
  date_from: string;
  date_to: string;
  created_at: string;
  created_by: string | null;
  updated_at: string;
  updated_by: string | null;
}

/* =====================================================================
// Domain-Modelle (camelCase, werden in der App verwendet)
// ===================================================================== */

/**
 * Koch/Teammitglied eines Events.
 *
 * @param uid - Eindeutige ID des Cook-Eintrags (event_cooks.id)
 * @param userId - Supabase Auth UUID des Benutzers
 */
export interface EventCookDomain {
  uid: string;
  userId: string;
}

/**
 * Zeitscheibe eines Events (von–bis).
 *
 * @param uid - Eindeutige ID der Zeitscheibe
 * @param sortOrder - Reihenfolge der Zeitscheibe
 * @param dateFrom - Startdatum
 * @param dateTo - Enddatum
 */
export interface EventDateDomain {
  uid: string;
  sortOrder: number;
  dateFrom: Date;
  dateTo: Date;
}

/**
 * Domain-Modell für ein Event (Kopfdaten + Köche + Zeitscheiben).
 *
 * @param uid - Eindeutige ID (events.id)
 * @param name - Name des Events
 * @param motto - Motto des Events
 * @param location - Veranstaltungsort
 * @param pictureSrc - URL des Event-Bilds
 * @param cooks - Köche/Teammitglieder des Events
 * @param dates - Zeitscheiben des Events
 * @param createdAt - Erstellungszeitpunkt
 * @param createdBy - Auth-UUID des Erstellers (null bei Migration ohne JWT)
 * @param updatedAt - Zeitpunkt der letzten Änderung
 * @param updatedBy - Auth-UUID des letzten Bearbeiters
 */
export interface EventDomain {
  uid: string;
  name: string;
  motto: string;
  location: string;
  pictureSrc: string;
  cooks: EventCookDomain[];
  dates: EventDateDomain[];
  createdAt: Date;
  createdBy: string | null;
  updatedAt: Date;
  updatedBy: string | null;
}

/* =====================================================================
// EventRepository
// ===================================================================== */

/**
 * Repository für Events inklusive Köche und Zeitscheiben.
 *
 * Lädt `event_cooks` und `event_dates` immer zusammen mit dem Event
 * (keine lazy-loading). Für Echtzeit-Updates steht `subscribeToEvent()`
 * zur Verfügung.
 */
export class EventRepository extends BaseRepository<EventDomain, EventRow> {
  tableName = "events";

  constructor(client?: SupabaseClient) {
    super(client);
  }

  /* =====================================================================
  // Cache-Konfiguration — Events nicht cachen (Realtime)
  // ===================================================================== */
  /**
   * Gibt die Cache-Konfiguration zurück.
   * Events werden nicht gecacht, da sie via Realtime aktuell gehalten werden.
   */
  getCacheConfig(): StorageObjectProperty {
    return STORAGE_OBJECT_PROPERTY.EVENT;
  }

  /* =====================================================================
  // Domain → DB-Zeile Mapping
  // ===================================================================== */
  /**
   * Konvertiert ein EventDomain-Objekt in eine Postgres-Zeile.
   *
   * @param domain - Das Domain-Objekt (camelCase)
   * @returns Partielle DB-Zeile (snake_case)
   */
  toRow(domain: EventDomain): Partial<EventRow> {
    return {
      name: domain.name,
      motto: domain.motto,
      location: domain.location,
      picture_src: domain.pictureSrc ?? "",
    };
  }

  /* =====================================================================
  // DB-Zeile → Domain Mapping (nur Kopfdaten)
  // ===================================================================== */
  /**
   * Konvertiert eine Postgres-Zeile in ein EventDomain-Objekt (nur Kopfdaten).
   * Köche und Zeitscheiben werden NICHT in dieser Methode geladen.
   *
   * @param row - Die DB-Zeile (snake_case)
   * @returns Domain-Objekt ohne cooks/dates
   */
  toDomain(row: EventRow): EventDomain {
    return {
      uid: row.id,
      name: row.name,
      motto: row.motto,
      location: row.location,
      pictureSrc: row.picture_src,
      cooks: [],
      dates: [],
      createdAt: row.created_at ? new Date(row.created_at) : new Date(0),
      createdBy: row.created_by ?? null,
      updatedAt: row.updated_at ? new Date(row.updated_at) : new Date(0),
      updatedBy: row.updated_by ?? null,
    };
  }

  /* =====================================================================
  // Hilfsmethoden: Cook-Zeilen und Date-Zeilen konvertieren
  // ===================================================================== */
  /**
   * Konvertiert eine event_cooks-Zeile in ein EventCookDomain-Objekt.
   *
   * @param row - Die DB-Zeile
   * @returns EventCookDomain
   */
  private cookRowToDomain(row: EventCookRow): EventCookDomain {
    return {
      uid: row.id,
      userId: row.user_id,
    };
  }

  /**
   * Konvertiert eine event_dates-Zeile in ein EventDateDomain-Objekt.
   *
   * @param row - Die DB-Zeile
   * @returns EventDateDomain
   */
  private dateRowToDomain(row: EventDateRow): EventDateDomain {
    return {
      uid: row.id,
      sortOrder: row.sort_order,
      dateFrom: new Date(row.date_from),
      dateTo: new Date(row.date_to),
    };
  }

  /* =====================================================================
  // Vollständiges Event laden (Kopfdaten + Köche + Zeitscheiben)
  // ===================================================================== */
  /**
   * Lädt ein einzelnes Event inklusive Köche und Zeitscheiben.
   *
   * @param eventId - Die ID des Events
   * @returns Das vollständige EventDomain oder null, falls nicht gefunden
   */
  async getEvent(eventId: string): Promise<EventDomain | null> {
    // Alle drei Tabellen parallel laden für optimale Performance
    const [eventResult, cooksResult, datesResult] = await Promise.all([
      this.client.from("events").select("*").eq("id", eventId).single(),
      this.client.from("event_cooks").select("*").eq("event_id", eventId),
      this.client.from("event_dates").select("*").eq("event_id", eventId).order("sort_order"),
    ]);

    if (eventResult.error) {
      if (eventResult.error.code === "PGRST116") return null;
      throw eventResult.error;
    }
    if (cooksResult.error) throw cooksResult.error;
    if (datesResult.error) throw datesResult.error;

    const eventDomain = this.toDomain(eventResult.data as EventRow);
    eventDomain.cooks = ((cooksResult.data ?? []) as EventCookRow[]).map((row) =>
      this.cookRowToDomain(row)
    );
    eventDomain.dates = ((datesResult.data ?? []) as EventDateRow[]).map((row) =>
      this.dateRowToDomain(row)
    );

    return eventDomain;
  }

  /* =====================================================================
  // Alle Events des angemeldeten Benutzers laden
  // ===================================================================== */
  /**
   * Lädt alle Events, bei denen der angemeldete Benutzer als Koch eingetragen ist.
   * Die RLS-Policy auf event_cooks filtert automatisch nach auth.uid().
   *
   * @returns Array aller Events des Benutzers (ohne Köche/Zeitscheiben)
   */
  async getAllEventsForUser(): Promise<EventDomain[]> {
    // Über event_cooks joinen, um nur Events des aktuellen Benutzers zu erhalten.
    // event_dates werden mitgeladen, damit maxDate berechnet werden kann.
    const {data, error} = await this.client
      .from("events")
      .select("*, event_cooks!inner(user_id), event_dates(id, sort_order, date_from, date_to)")
      .eq("event_cooks.user_id", (await this.client.auth.getUser()).data.user?.id ?? "")
      .order("name");

    if (error) throw error;

    return (data ?? []).map((row) => {
      const event = this.toDomain(row as EventRow);
      const dateRows = (row as any).event_dates as EventDateRow[] | undefined;
      event.dates = (dateRows ?? []).map((dateRow) => this.dateRowToDomain(dateRow));
      return event;
    });
  }

  /* =====================================================================
  // Event erstellen
  // ===================================================================== */
  /**
   * Erstellt ein neues Event und gibt das vollständige Domain-Objekt zurück.
   * Fügt keine Köche oder Zeitscheiben ein — dies geschieht via addCook() / saveDates().
   *
   * @param eventData - Die Event-Daten (uid wird ignoriert)
   * @param authUser - Der angemeldete Benutzer (für Audit-Zwecke)
   * @returns Das neu erstellte EventDomain mit generierter uid
   */
  async createEvent(
    eventData: Omit<EventDomain, "uid" | "cooks" | "dates" | "createdAt" | "createdBy" | "updatedAt" | "updatedBy">,
    authUser: AuthUser,
  ): Promise<EventDomain> {
    const {value} = await this.insert({
      value: {
        ...eventData,
        uid: "",
        cooks: [],
        dates: [],
        createdAt: new Date(),
        createdBy: null,
        updatedAt: new Date(),
        updatedBy: null,
      },
      authUser,
    });
    return value;
  }

  /* =====================================================================
  // Event aktualisieren
  // ===================================================================== */
  /**
   * Aktualisiert die Kopfdaten eines Events (name, motto, location, pictureSrc).
   * Köche und Zeitscheiben werden separat verwaltet.
   *
   * @param eventData - Das aktualisierte Event
   * @param authUser - Der angemeldete Benutzer (für Audit-Zwecke)
   * @returns Das aktualisierte EventDomain
   */
  async updateEvent(
    eventData: EventDomain,
    authUser: AuthUser,
  ): Promise<EventDomain> {
    return this.update({id: eventData.uid, value: eventData, authUser});
  }

  /* =====================================================================
  // Event löschen
  // ===================================================================== */
  /**
   * Löscht ein Event und alle zugehörigen Kind-Datensätze (via CASCADE).
   *
   * @param eventId - Die ID des zu löschenden Events
   */
  async deleteEvent(eventId: string): Promise<void> {
    return this.remove(eventId);
  }

  /* =====================================================================
  // Koch hinzufügen
  // ===================================================================== */
  /**
   * Fügt einen Benutzer als Koch zu einem Event hinzu.
   *
   * @param eventId - Die ID des Events
   * @param userId - Die Supabase Auth UUID des neuen Kochs
   * @param authUser - Der angemeldete Benutzer (für Audit-Zwecke)
   * @returns Der neu erstellte EventCookDomain-Eintrag
   */
  async addCook(
    eventId: string,
    userId: string,
    authUser: AuthUser,
  ): Promise<EventCookDomain> {
    const {data, error} = await this.client
      .from("event_cooks")
      .insert({event_id: eventId, user_id: userId})
      .select()
      .single();

    if (error) throw error;
    return this.cookRowToDomain(data as EventCookRow);
  }

  /* =====================================================================
  // Koch entfernen
  // ===================================================================== */
  /**
   * Entfernt einen Koch-Eintrag anhand der Cook-ID (event_cooks.id).
   *
   * @param cookId - Die ID des event_cooks-Eintrags
   */
  async removeCook(cookId: string): Promise<void> {
    const {error} = await this.client.from("event_cooks").delete().eq("id", cookId);
    if (error) throw error;
  }

  /* =====================================================================
  // Zeitscheiben speichern (Replace-Strategie)
  // ===================================================================== */
  /**
   * Ersetzt alle Zeitscheiben eines Events durch die übergebene Liste.
   * Bestehende Zeitscheiben werden gelöscht, neue werden eingefügt.
   *
   * @param eventId - Die ID des Events
   * @param dates - Die neuen Zeitscheiben
   * @param authUser - Der angemeldete Benutzer (für Audit-Zwecke)
   */
  async saveDates(
    eventId: string,
    dates: Omit<EventDateDomain, "uid">[],
    authUser: AuthUser,
  ): Promise<void> {
    // Alle alten Zeitscheiben löschen
    const {error: deleteError} = await this.client
      .from("event_dates")
      .delete()
      .eq("event_id", eventId);

    if (deleteError) throw deleteError;

    if (dates.length === 0) return;

    // Neue Zeitscheiben einfügen
    const rows = dates.map((dateEntry, index) => ({
      event_id: eventId,
      sort_order: index * 10,
      date_from: dateEntry.dateFrom.toISOString().split("T")[0],
      date_to: dateEntry.dateTo.toISOString().split("T")[0],
    }));

    const {error: insertError} = await this.client.from("event_dates").insert(rows);
    if (insertError) throw insertError;
  }

  /* =====================================================================
  // Echtzeit-Abonnement für ein Event
  // ===================================================================== */
  /**
   * Abonniert Echtzeit-Änderungen an einem Event (Kopfdaten, Köche, Zeitscheiben).
   * Bei jeder Änderung an einer der drei Tabellen wird onData mit dem
   * vollständigen EventDomain aufgerufen.
   *
   * @param eventId - Die ID des Events
   * @param onData - Callback bei Datenänderung
   * @param onError - Callback bei Fehler
   * @returns Unsubscribe-Funktion
   */
  subscribeToEvent(
    eventId: string,
    onData: (eventData: EventDomain) => void,
    onError: (error: Error) => void,
  ): () => void {
    const clientRef = this.client;

    const reloadEvent = async () => {
      try {
        const updated = await this.getEvent(eventId);
        if (updated) onData(updated);
      } catch (err) {
        onError(err instanceof Error ? err : new Error(String(err)));
      }
    };

    // Ein einziger Channel für alle 3 Event-Tabellen — spart Realtime-Connections
    const channel = clientRef
      .channel(`event:${eventId}`)
      .on("postgres_changes", {event: "*", schema: "public", table: "events", filter: `id=eq.${eventId}`}, reloadEvent)
      .on("postgres_changes", {event: "*", schema: "public", table: "event_cooks", filter: `event_id=eq.${eventId}`}, reloadEvent)
      .on("postgres_changes", {event: "*", schema: "public", table: "event_dates", filter: `event_id=eq.${eventId}`}, reloadEvent)
      .subscribe((status, err) => {
        console.debug(`Realtime event:${eventId} status: ${status}`, err ?? "");
        if (status === "CHANNEL_ERROR") {
          onError(new Error(`Realtime-Fehler für event:${eventId}`));
        }
      });

    return () => {
      clientRef.removeChannel(channel);
    };
  }
}

/* =====================================================================
// Hilfsfunktion: spätestes Enddatum eines Events ermitteln
// ===================================================================== */
/**
 * Ermittelt das späteste Enddatum (dateTo) aller Zeitscheiben eines Events.
 * Wird verwendet, um Events in «bevorstehend» und «vergangen» aufzuteilen.
 *
 * @param event - Das Event mit Zeitscheiben
 * @returns Das späteste dateTo oder new Date(0), falls keine Zeitscheiben vorhanden
 *
 * @example
 * const max = getMaxDate(event);
 * if (max > new Date()) { /* zukünftig *\/ }
 */
export function getMaxDate(event: EventDomain): Date {
  if (event.dates.length === 0) return new Date(0);
  return event.dates.reduce(
    (max, d) => (d.dateTo > max ? d.dateTo : max),
    event.dates[0].dateTo,
  );
}
