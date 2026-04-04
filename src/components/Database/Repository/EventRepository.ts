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
import {Event,Cook, EventDate} from "../../Event/Event/event.class";

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
 * Koch/Teammitglied eines Events mit öffentlichen Profildaten.
 *
 * @param uid - Eindeutige ID des Cook-Eintrags (event_cooks.id)
 * @param userId - Supabase Auth UUID des Benutzers
 * @param displayName - Anzeigename des Kochs (aus users-Tabelle)
 * @param motto - Motto des Kochs (aus users-Tabelle)
 * @param pictureSrc - Profilbild-URL des Kochs (aus users-Tabelle)
 */
export interface EventCookDomain {
  uid: string;
  userId: string;
  displayName: string;
  motto: string;
  pictureSrc: string;
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
      displayName: "",
      motto: "",
      pictureSrc: "",
    };
  }

  /**
   * Konvertiert eine Zeile aus get_event_cook_profiles() RPC in ein EventCookDomain.
   *
   * @param row - Die RPC-Ergebniszeile
   * @returns EventCookDomain mit Profildaten
   */
  private cookProfileRowToDomain(row: {
    id: string;
    user_id: string;
    display_name: string;
    motto: string;
    picture_src: string;
  }): EventCookDomain {
    return {
      uid: row.id,
      userId: row.user_id,
      displayName: row.display_name ?? "",
      motto: row.motto ?? "",
      pictureSrc: row.picture_src ?? "",
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
    // Event-Kopfdaten, Köche (mit Profil via RPC) und Zeitscheiben parallel laden
    const [eventResult, cooksResult, datesResult] = await Promise.all([
      this.client.from("events").select("*").eq("id", eventId).single(),
      this.client.rpc("get_event_cook_profiles", {p_event_id: eventId}),
      this.client.from("event_dates").select("*").eq("event_id", eventId).order("sort_order"),
    ]);

    if (eventResult.error) {
      if (eventResult.error.code === "PGRST116") return null;
      throw eventResult.error;
    }
    if (cooksResult.error) throw cooksResult.error;
    if (datesResult.error) throw datesResult.error;

    const eventDomain = this.toDomain(eventResult.data as EventRow);
    eventDomain.cooks = (cooksResult.data ?? []).map((row: any) =>
      this.cookProfileRowToDomain(row),
    );
    eventDomain.dates = ((datesResult.data ?? []) as EventDateRow[]).map((row) =>
      this.dateRowToDomain(row),
    );

    return eventDomain;
  }

  /* =====================================================================
  // Alle Events laden (Admin-Übersicht)
  // ===================================================================== */
  /**
   * Lädt alle Events mit Köche-Anzahl und Zeitscheiben (für die Admin-Übersicht).
   * RLS-geschützt: nur Admins sehen alle Events (via is_admin() Policy).
   *
   * @returns Array aller Events inkl. Köche-Anzahl und Zeitscheiben
   */
  async getAllEventsShort(): Promise<EventDomain[]> {
    const {data, error} = await this.client
      .from("events")
      .select("*, event_cooks(user_id), event_dates(id, sort_order, date_from, date_to)")
      .order("created_at", {ascending: false});

    if (error) throw error;

    return (data ?? []).map((row) => {
      const event = this.toDomain(row as EventRow);
      // Köche: nur Anzahl relevant, userId wird für die Zählung gebraucht
      const cookRows = (row as any).event_cooks as EventCookRow[] | undefined;
      event.cooks = (cookRows ?? []).map((cookRow) => this.cookRowToDomain(cookRow));
      // Zeitscheiben laden
      const dateRows = (row as any).event_dates as EventDateRow[] | undefined;
      event.dates = (dateRows ?? []).map((dateRow) => this.dateRowToDomain(dateRow));
      return event;
    });
  }

  /* =====================================================================
  // Alle Events des angemeldeten Benutzers laden
  // ===================================================================== */
  /**
   * Lädt alle Events, bei denen ein Benutzer als Koch eingetragen ist.
   * Ohne Parameter wird der angemeldete Benutzer verwendet. Mit userId
   * können Admins die Anlässe eines beliebigen Benutzers laden (RLS
   * steuert den Zugriff via is_admin() Policy).
   *
   * @param userId - Optionale Supabase Auth UUID. Falls nicht angegeben,
   *                 wird die ID des angemeldeten Benutzers verwendet.
   * @returns Array aller Events des Benutzers inkl. Zeitscheiben
   */
  async getAllEventsForUser(userId?: string): Promise<EventDomain[]> {
    // Falls keine userId übergeben, die des aktuell angemeldeten Benutzers verwenden
    const effectiveUserId = userId
      ?? (await this.client.auth.getUser()).data.user?.id
      ?? "";

    const {data, error} = await this.client
      .from("events")
      .select("*, event_cooks!inner(user_id), event_dates(id, sort_order, date_from, date_to)")
      .eq("event_cooks.user_id", effectiveUserId)
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
    _authUser: AuthUser,
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
    _authUser: AuthUser,
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

  /* =====================================================================
  // UI-ready Methoden — konvertieren Domain ↔ Event-Klasse direkt
  // ===================================================================== */

  /**
   * Konvertiert ein EventDomain in eine Event-Klasseninstanz (UI-Format).
   *
   * Köche werden nur mit der userId gemappt — die öffentlichen Profildaten
   * müssen separat geladen werden. Enthält eine leere Datumszeile am Ende
   * für die UI-Bearbeitung.
   *
   * @param domain - Das EventDomain-Objekt
   * @returns Eine befüllte Event-Instanz
   */
  eventDomainToUi(domain: EventDomain): Event {
    const event = new Event();

    event.uid = domain.uid;
    event.name = domain.name;
    event.motto = domain.motto;
    event.location = domain.location;
    event.pictureSrc = domain.pictureSrc;

    // Köche: Profildaten werden via get_event_cook_profiles() geladen
    event.cooks = domain.cooks.map(
      (cookDomain: EventCookDomain): Cook => ({
        uid: cookDomain.userId,
        displayName: cookDomain.displayName,
        motto: cookDomain.motto,
        pictureSrc: cookDomain.pictureSrc,
      }),
    );

    // Zeitscheiben: sortOrder wird als index * 10 gespeichert
    event.dates = domain.dates.map(
      (dateDomain: EventDateDomain): EventDate => ({
        uid: dateDomain.uid,
        pos: dateDomain.sortOrder / 10,
        from: dateDomain.dateFrom,
        to: dateDomain.dateTo,
      }),
    );

    // Leere Datumszeile anhängen (UI braucht immer eine neue Zeile zum Bearbeiten)
    const emptyDate = Event.createDateEntry();
    emptyDate.pos = event.dates.length + 1;
    event.dates.push(emptyDate);

    // Audit-Felder
    event.created = {
      date: domain.createdAt,
      fromUid: domain.createdBy ?? "",
      fromDisplayName: "",
    };
    event.lastChange = {
      date: domain.updatedAt,
      fromUid: domain.updatedBy ?? "",
      fromDisplayName: "",
    };

    // Berechtigte Benutzer aus den Köchen extrahieren
    event.authUsers = domain.cooks.map((c) => c.userId);

    // maxDate aus den Zeitscheiben berechnen
    if (event.dates.length > 0) {
      event.maxDate = event.dates.reduce((maxDate, currentDate) => {
        return currentDate.to > maxDate.to ? currentDate : maxDate;
      }, event.dates[0]).to;
      event.maxDate = new Date(event.maxDate.getTime());
      event.maxDate.setHours(0, 0, 0, 0);
    }

    // Anzahl Tage berechnen
    event.numberOfDays = Event.defineEventDuration(event.dates);

    return event;
  }

  /**
   * Konvertiert eine Event-Klasseninstanz in ein EventDomain für die DB.
   *
   * Köche und Zeitscheiben werden als leere Arrays gesetzt, da diese über
   * separate Repository-Methoden (addCook/removeCook, saveDates) verwaltet werden.
   *
   * @param event - Die Event-Klasseninstanz
   * @returns Ein EventDomain für das Repository
   */
  eventUiToDomain(event: Event): EventDomain {
    return {
      uid: event.uid,
      name: event.name,
      motto: event.motto,
      location: event.location,
      pictureSrc: event.pictureSrc,
      cooks: [],
      dates: [],
      createdAt: event.created.date,
      createdBy: event.created.fromUid || null,
      updatedAt: event.lastChange.date,
      updatedBy: event.lastChange.fromUid || null,
    };
  }

  /**
   * Konvertiert Event-Zeitscheiben in das Domain-Format für saveDates().
   *
   * Filtert leere Datumszeilen heraus und konvertiert die Position
   * in sortOrder (pos × 10).
   *
   * @param dates - Array der Event-Zeitscheiben aus der Klassenstruktur
   * @returns Array der Domain-Zeitscheiben ohne uid
   */
  eventDatesToDateDomains(dates: EventDate[]): Omit<EventDateDomain, "uid">[] {
    return Event.deleteEmptyDates(dates).map((date) => ({
      sortOrder: date.pos * 10,
      dateFrom: date.from,
      dateTo: date.to,
    }));
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
