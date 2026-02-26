/**
 * BaseRepository — Abstrakte Basisklasse für alle Repository-Implementierungen.
 *
 * Stellt generische CRUD-Operationen auf Supabase/Postgres-Tabellen bereit
 * und integriert den bestehenden SessionStorageHandler für Caching.
 * Ersetzt die bisherige FirebaseDbSuper-Klasse.
 *
 * Jede konkrete Implementierung (z.B. UserRepository) definiert:
 * - tableName: Name der Postgres-Tabelle
 * - toRow(): Mapping Domain-Model → DB-Zeile (camelCase → snake_case)
 * - toDomain(): Mapping DB-Zeile → Domain-Model (snake_case → camelCase)
 * - getCacheConfig(): Caching-Konfiguration
 *
 * @typeParam TDomain - Domain-Model-Typ (camelCase, wird in der App verwendet)
 * @typeParam TRow - Datenbank-Zeilen-Typ (snake_case, entspricht Postgres-Spalten)
 */
import {SupabaseClient, RealtimeChannel} from "@supabase/supabase-js";
import {supabase} from "../supabaseClient";
import {
  SessionStorageHandler,
  StorageObjectProperty,
} from "../../Firebase/Db/sessionStorageHandler.class";
import {AuthUser} from "../../Firebase/Authentication/authUser.class";

/**
 * Filter-Definition für Datenbankabfragen.
 * @param field - Name der Spalte in der Datenbank
 * @param operator - Vergleichsoperator (eq, neq, gt, gte, lt, lte, like, ilike, in)
 * @param value - Vergleichswert
 */
export interface Filter {
  field: string;
  operator: "eq" | "neq" | "gt" | "gte" | "lt" | "lte" | "like" | "ilike" | "in";
  value: unknown;
}

/**
 * Sortier-Definition für Datenbankabfragen.
 * @param field - Name der Spalte, nach der sortiert wird
 * @param direction - Sortierrichtung (aufsteigend oder absteigend)
 */
export interface OrderByClause {
  field: string;
  direction: "asc" | "desc";
}

/** Parameter für {@link BaseRepository.insert} */
interface InsertParams<TDomain> {
  /** Das Domain-Objekt, das eingefügt werden soll */
  value: TDomain;
  /** Der angemeldete Benutzer (für Audit-Zwecke) */
  authUser: AuthUser;
  /** Optionale ID — wenn nicht angegeben, wird sie von der DB generiert */
  id?: string;
}

/** Parameter für {@link BaseRepository.findMany} */
interface FindManyParams {
  /** Optionale Sortierung */
  orderBy?: OrderByClause;
  /** Optionale Filter */
  filters?: Filter[];
  /** Maximale Anzahl Ergebnisse */
  limit?: number;
}

/** Parameter für {@link BaseRepository.subscribe} */
interface SubscribeParams<TDomain> {
  /** ID des Datensatzes, auf den gelauscht wird */
  id: string;
  /** Callback bei Datenänderung */
  onData: (value: TDomain) => void;
  /** Callback bei Fehler */
  onError: (error: Error) => void;
}

/** Parameter für {@link BaseRepository.update} */
interface UpdateParams<TDomain> {
  /** ID des zu aktualisierenden Datensatzes */
  id: string;
  /** Neues Domain-Objekt (vollständiges Update) */
  value: TDomain;
  /** Der angemeldete Benutzer (für Audit-Zwecke) */
  authUser: AuthUser;
}

/** Parameter für {@link BaseRepository.patch} */
interface PatchParams<TRow> {
  /** ID des zu aktualisierenden Datensatzes */
  id: string;
  /** Nur die zu ändernden Felder (partielles Update) */
  fields: Partial<TRow>;
  /** Der angemeldete Benutzer (optional, für Audit-Zwecke) */
  authUser?: AuthUser;
}

/** Parameter für {@link BaseRepository.upsert} */
interface UpsertParams<TDomain> {
  /** ID des Datensatzes */
  id: string;
  /** Domain-Objekt — wird eingefügt oder überschrieben */
  value: TDomain;
  /** Der angemeldete Benutzer (für Audit-Zwecke) */
  authUser: AuthUser;
}

/** Parameter für {@link BaseRepository.increment} */
interface IncrementParams {
  /** ID des Datensatzes */
  id: string;
  /** Name des Feldes, das inkrementiert werden soll */
  field: string;
  /** Betrag der Inkrementierung (kann auch negativ sein) */
  amount: number;
}

/** Parameter für {@link BaseRepository.incrementMany} */
interface IncrementManyParams {
  /** ID des Datensatzes */
  id: string;
  /** Liste der zu inkrementierenden Felder mit Beträgen */
  increments: {field: string; amount: number}[];
}

export abstract class BaseRepository<TDomain, TRow extends Record<string, unknown>> {
  protected client: SupabaseClient;

  constructor(client?: SupabaseClient) {
    this.client = client ?? supabase;
  }

  /** Name der Postgres-Tabelle (z.B. "users", "events") */
  abstract tableName: string;

  /**
   * Konvertiert ein Domain-Objekt in eine DB-Zeile.
   * @param domain - Das Domain-Objekt (camelCase)
   * @returns Partielle DB-Zeile (snake_case)
   */
  abstract toRow(domain: TDomain): Partial<TRow>;

  /**
   * Konvertiert eine DB-Zeile in ein Domain-Objekt.
   * @param row - Die DB-Zeile (snake_case)
   * @returns Domain-Objekt (camelCase)
   */
  abstract toDomain(row: TRow): TDomain;

  /**
   * Gibt die Caching-Konfiguration für dieses Repository zurück.
   * @returns StorageObjectProperty mit Gültigkeitsdauer und Cache-Einstellungen
   */
  abstract getCacheConfig(): StorageObjectProperty;

  /* =====================================================================
  // Neuen Datensatz einfügen
  // ===================================================================== */
  /**
   * Fügt einen neuen Datensatz in die Tabelle ein.
   * @param params - value: Domain-Objekt, authUser: angemeldeter User, id: optionale ID
   * @returns Objekt mit generierter ID und dem eingefügten Domain-Objekt
   */
  async insert({
    value,
    authUser: _authUser,
    id,
  }: InsertParams<TDomain>): Promise<{id: string; value: TDomain}> {
    const row = this.toRow(value);

    if (id) {
      (row as Record<string, unknown>).id = id;
    }

    const {data, error} = await this.client
      .from(this.tableName)
      .insert(row)
      .select()
      .single();

    if (error) throw error;

    const domain = this.toDomain(data as TRow);
    this.cacheUpsert((data as Record<string, unknown>).id as string, domain);
    return {id: (data as Record<string, unknown>).id as string, value: domain};
  }

  /* =====================================================================
  // Einzelnen Datensatz anhand der ID suchen
  // ===================================================================== */
  /**
   * Sucht einen einzelnen Datensatz anhand der ID.
   * Prüft zuerst den Cache, bevor eine DB-Abfrage ausgeführt wird.
   * @param id - Primärschlüssel des Datensatzes
   * @param ignoreCache - Wenn true, wird der Cache übersprungen
   * @returns Das Domain-Objekt oder null, falls nicht gefunden
   */
  async findById(id: string, ignoreCache = false): Promise<TDomain | null> {
    if (!ignoreCache) {
      const cached = this.cacheGet(id);
      if (cached) return cached;
    }

    const {data, error} = await this.client
      .from(this.tableName)
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      if (error.code === "PGRST116") return null; // No rows found
      throw error;
    }

    const domain = this.toDomain(data as TRow);
    this.cacheUpsert(id, domain);
    return domain;
  }

  /* =====================================================================
  // Mehrere Datensätze mit optionaler Filterung und Sortierung suchen
  // ===================================================================== */
  /**
   * Sucht mehrere Datensätze mit optionaler Filterung, Sortierung und Limitierung.
   * @param params - orderBy: Sortierung, filters: Filterbedingungen, limit: Max. Ergebnisse
   * @returns Array von Domain-Objekten
   */
  async findMany({
    orderBy,
    filters,
    limit: limitCount,
  }: FindManyParams = {}): Promise<TDomain[]> {
    let query = this.client.from(this.tableName).select("*");

    if (filters) {
      for (const filter of filters) {
        query = this.applyFilter(query, filter);
      }
    }

    if (orderBy) {
      query = query.order(orderBy.field, {ascending: orderBy.direction === "asc"});
    }

    if (limitCount) {
      query = query.limit(limitCount);
    }

    const {data, error} = await query;
    if (error) throw error;

    return (data as TRow[]).map((row) => this.toDomain(row));
  }

  /* =====================================================================
  // Realtime-Änderungen an einem Datensatz abonnieren
  // ===================================================================== */
  /**
   * Abonniert Echtzeit-Änderungen an einem Datensatz über Supabase Realtime.
   * @param params - id: Datensatz-ID, onData: Callback bei Änderung, onError: Callback bei Fehler
   * @returns Unsubscribe-Funktion zum Beenden des Abonnements
   */
  subscribe({id, onData, onError}: SubscribeParams<TDomain>): () => void {
    const channel: RealtimeChannel = this.client
      .channel(`${this.tableName}:${id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: this.tableName,
          filter: `id=eq.${id}`,
        },
        (payload) => {
          try {
            if (payload.eventType === "DELETE") {
              onError(new Error("Record deleted"));
              return;
            }
            const domain = this.toDomain(payload.new as TRow);
            this.cacheUpsert(id, domain);
            onData(domain);
          } catch (err) {
            onError(err instanceof Error ? err : new Error(String(err)));
          }
        }
      )
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR") {
          onError(new Error(`Realtime subscription error for ${this.tableName}:${id}`));
        }
      });

    return () => {
      this.client.removeChannel(channel);
    };
  }

  /* =====================================================================
  // Vollständiges Update eines Datensatzes
  // ===================================================================== */
  /**
   * Aktualisiert einen Datensatz vollständig (alle Felder werden überschrieben).
   * @param params - id: Datensatz-ID, value: neues Domain-Objekt, authUser: angemeldeter User
   * @returns Das aktualisierte Domain-Objekt
   */
  async update({
    id,
    value,
    authUser: _authUser,
  }: UpdateParams<TDomain>): Promise<TDomain> {
    const row = this.toRow(value);
    // Remove id from the update payload — it's the primary key
    delete (row as Record<string, unknown>).id;

    const {data, error} = await this.client
      .from(this.tableName)
      .update(row)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;

    const domain = this.toDomain(data as TRow);
    this.cacheUpsert(id, domain);
    return domain;
  }

  /* =====================================================================
  // Partielles Update einzelner Felder
  // ===================================================================== */
  /**
   * Aktualisiert nur die angegebenen Felder eines Datensatzes.
   * @param params - id: Datensatz-ID, fields: zu ändernde Felder, authUser: angemeldeter User
   */
  async patch({
    id,
    fields,
    authUser: _authUser,
  }: PatchParams<TRow>): Promise<void> {
    const {error} = await this.client
      .from(this.tableName)
      .update(fields as Record<string, unknown>)
      .eq("id", id);

    if (error) throw error;

    this.cacheUpdateFields(id, fields as Record<string, unknown>);
  }

  /* =====================================================================
  // Einfügen oder Überschreiben (Upsert)
  // ===================================================================== */
  /**
   * Fügt einen Datensatz ein oder überschreibt ihn, falls die ID bereits existiert.
   * @param params - id: Datensatz-ID, value: Domain-Objekt, authUser: angemeldeter User
   * @returns Das eingefügte/aktualisierte Domain-Objekt
   */
  async upsert({
    id,
    value,
    authUser: _authUser,
  }: UpsertParams<TDomain>): Promise<TDomain> {
    const row = this.toRow(value);
    (row as Record<string, unknown>).id = id;

    const {data, error} = await this.client
      .from(this.tableName)
      .upsert(row)
      .select()
      .single();

    if (error) throw error;

    const domain = this.toDomain(data as TRow);
    this.cacheUpsert(id, domain);
    return domain;
  }

  /* =====================================================================
  // Atomares Inkrementieren eines einzelnen Feldes
  // ===================================================================== */
  /**
   * Inkrementiert ein numerisches Feld atomar via DB-Funktion.
   * @param params - id: Datensatz-ID, field: Feldname, amount: Betrag (auch negativ möglich)
   */
  async increment({id, field, amount}: IncrementParams): Promise<void> {
    const {error} = await this.client.rpc("increment_field", {
      table_name: this.tableName,
      row_id: id,
      field_name: field,
      amount: amount,
    });

    if (error) throw error;

    SessionStorageHandler.incrementFieldValue({
      storageObjectProperty: this.getCacheConfig(),
      documentUid: id,
      field,
      value: amount,
    });
  }

  /* =====================================================================
  // Atomares Inkrementieren mehrerer Felder
  // ===================================================================== */
  /**
   * Inkrementiert mehrere numerische Felder eines Datensatzes sequentiell.
   * @param params - id: Datensatz-ID, increments: Array mit Feld-/Betrag-Paaren
   */
  async incrementMany({id, increments}: IncrementManyParams): Promise<void> {
    // Execute increments sequentially since Supabase doesn't have a native
    // multi-field increment. Could be replaced with a DB function later.
    for (const inc of increments) {
      await this.increment({id, field: inc.field, amount: inc.amount});
    }
  }

  /* =====================================================================
  // Datensatz löschen
  // ===================================================================== */
  /**
   * Löscht einen Datensatz anhand der ID.
   * @param id - Primärschlüssel des zu löschenden Datensatzes
   */
  async remove(id: string): Promise<void> {
    const {error} = await this.client
      .from(this.tableName)
      .delete()
      .eq("id", id);

    if (error) throw error;

    SessionStorageHandler.deleteDocument({
      storageObjectProperty: this.getCacheConfig(),
      documentUid: id,
      prefix: "",
    });
  }

  /* =====================================================================
  // Cache-Hilfsmethoden
  // ===================================================================== */
  /**
   * Liest einen Datensatz aus dem SessionStorage-Cache.
   * @param id - Primärschlüssel des Datensatzes
   * @returns Gecachtes Domain-Objekt oder null
   */
  private cacheGet(id: string): TDomain | null {
    const config = this.getCacheConfig();
    if (config.excludeFromCaching) return null;

    const cached = SessionStorageHandler.getDocument<Record<string, unknown>>({
      storageObjectProperty: config,
      documentUid: id,
    });
    return (cached as TDomain | null) ?? null;
  }

  /**
   * Schreibt oder aktualisiert einen Datensatz im SessionStorage-Cache.
   * @param id - Primärschlüssel des Datensatzes
   * @param value - Das zu cachende Domain-Objekt
   */
  private cacheUpsert(id: string, value: TDomain): void {
    const config = this.getCacheConfig();
    if (config.excludeFromCaching) return;

    SessionStorageHandler.upsertDocument({
      storageObjectProperty: config,
      documentUid: id,
      value: value as Record<string, unknown>,
    });
  }

  /**
   * Aktualisiert einzelne Felder eines gecachten Datensatzes im SessionStorage.
   * @param id - Primärschlüssel des Datensatzes
   * @param fields - Die zu aktualisierenden Felder
   */
  private cacheUpdateFields(id: string, fields: Record<string, unknown>): void {
    const config = this.getCacheConfig();
    if (config.excludeFromCaching) return;

    SessionStorageHandler.updateDocumentField({
      storageObjectProperty: config,
      documentUid: id,
      value: fields,
    });
  }

  /* =====================================================================
  // Filter-Hilfsmethode
  // ===================================================================== */
  /**
   * Wendet einen einzelnen Filter auf eine Supabase-Query an.
   * @param query - Die aktuelle Supabase-Query
   * @param filter - Die anzuwendende Filterbedingung
   * @returns Die Query mit angewandtem Filter
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private applyFilter(query: any, filter: Filter) {
    switch (filter.operator) {
      case "eq":
        return query.eq(filter.field, filter.value);
      case "neq":
        return query.neq(filter.field, filter.value);
      case "gt":
        return query.gt(filter.field, filter.value);
      case "gte":
        return query.gte(filter.field, filter.value);
      case "lt":
        return query.lt(filter.field, filter.value);
      case "lte":
        return query.lte(filter.field, filter.value);
      case "like":
        return query.like(filter.field, filter.value);
      case "ilike":
        return query.ilike(filter.field, filter.value);
      case "in":
        return query.in(filter.field, filter.value as unknown[]);
      default:
        return query;
    }
  }
}
