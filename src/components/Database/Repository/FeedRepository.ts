/**
 * FeedRepository — Repository für Feed-Einträge (Aktivitätsübersicht).
 *
 * Liest über die View `feeds_view` (löst User- und Quellobjektdaten via JOIN auf),
 * schreibt in die Tabelle `feeds`. Feed-Einträge werden nur erstellt und gelöscht,
 * nie aktualisiert.
 *
 * Titel und Text werden NICHT in der DB gespeichert, sondern bei jedem Lesen
 * aus `feedType`, `source_object_name` (View) und `source_object_data` (JSONB)
 * via {@link getFeedTitle}/{@link getFeedText} generiert.
 *
 * @example
 * const feeds = await repo.getNewestFeeds(10, 'basic');
 * await repo.insertFeed({feedType: FeedType.recipePublished, ...}, authUser);
 */
import {SupabaseClient} from "@supabase/supabase-js";
import * as Sentry from "@sentry/browser";
import {BaseRepository} from "./BaseRepository";
import {
  STORAGE_OBJECT_PROPERTY,
  StorageObjectProperty,
} from "../../Firebase/Db/sessionStorageHandler.class";
import {AuthUser} from "../../Firebase/Authentication/authUser.class";
import {FeedType, getFeedTitle, getFeedText} from "../../Shared/feed.class";
import {Role} from "../../../constants/roles";

/* =====================================================================
// DB-Zeilenstruktur (snake_case, entspricht den Postgres-Spalten der View)
// ===================================================================== */

/**
 * Datenbank-Zeilentyp für die feeds_view.
 *
 * Titel und Text werden nicht in der DB gespeichert — sie werden
 * in {@link FeedRepository.toDomain} aus feedType + View-Daten generiert.
 *
 * @param id - Primärschlüssel (UUID als TEXT)
 * @param firebase_uid - Alte Firebase-UID für Migrationszuordnung
 * @param feed_type - Feed-Typ als DB-Enum
 * @param visibility - Sichtbarkeitsstufe als DB-Enum
 * @param user_uid - Supabase Auth UUID der im Feed angezeigten Person
 * @param source_object_type - Typ des Quellobjekts ('recipe', 'event', etc.)
 * @param source_object_uid - UID des Quellobjekts
 * @param source_object_data - Optionale Zusatzdaten als JSONB (z.B. Rating, Shopping-Item)
 * @param created_at - Erstellungszeitpunkt
 * @param created_by - Auth-UID des Erstellers
 * @param user_display_name - Anzeigename (aus View)
 * @param user_picture_src - Profilbild (aus View)
 * @param source_object_name - Quellobjekt-Name (aus View)
 * @param source_object_picture_src - Quellobjekt-Bild (aus View)
 */
export interface FeedRow {
  [key: string]: unknown;
  id: string;
  firebase_uid: string | null;
  feed_type: string;
  visibility: string;
  user_uid: string;
  source_object_type: string;
  source_object_uid: string;
  source_object_data: Record<string, unknown> | null;
  created_at: string;
  created_by: string | null;
  updated_at: string;
  updated_by: string | null;
  // View-Felder
  user_display_name: string | null;
  user_picture_src: string | null;
  source_object_name: string | null;
  source_object_picture_src: string | null;
}

/* =====================================================================
// Domain-Modell (camelCase, wird in der App verwendet)
// ===================================================================== */

/**
 * Domain-Modell für einen Feed-Eintrag.
 *
 * Titel und Text werden beim Lesen aus `feedType`, `sourceObject.name`
 * und `sourceObject.data` generiert — nicht aus der DB gelesen.
 *
 * @param uid - Eindeutige ID
 * @param feedType - Typ des Feed-Eintrags
 * @param visibility - Sichtbarkeitsstufe
 * @param title - Generierter Titel (aus feedType + sourceObject)
 * @param text - Generierter Text (aus feedType + sourceObject)
 * @param createdAt - Erstellungszeitpunkt
 * @param user - Person, die im Feed angezeigt wird
 * @param sourceObject - Quellobjekt des Feed-Eintrags
 */
export interface FeedDomain {
  uid: string;
  feedType: FeedType;
  visibility: string;
  title: string;
  text: string;
  createdAt: Date;
  user: {
    uid: string;
    displayName: string;
    pictureSrc: string;
  };
  sourceObject: {
    type: string;
    uid: string;
    name: string;
    pictureSrc: string;
    data?: Record<string, unknown>;
  };
}

/**
 * Parameter für das Erstellen eines neuen Feed-Eintrags.
 *
 * @param feedType - Typ des Feed-Eintrags
 * @param visibility - Sichtbarkeitsstufe (Standard: basic)
 * @param userUid - Supabase Auth UUID der angezeigten Person (Standard: authUser.uid)
 * @param sourceObjectType - Typ des Quellobjekts
 * @param sourceObjectUid - UID des Quellobjekts
 * @param sourceObjectData - Zusatzdaten, die nicht aus der View ableitbar sind
 *   (z.B. {rating: 5} für recipeRated, {randomItem: "2 kg Mehl", remainingCount: 12} für shoppingListCreated)
 */
export interface CreateFeedParams {
  feedType: FeedType;
  visibility?: Role;
  userUid?: string;
  sourceObjectType: string;
  sourceObjectUid: string;
  sourceObjectData?: Record<string, unknown>;
}

/* =====================================================================
// FeedRepository
// ===================================================================== */

/**
 * Repository für Feed-Einträge.
 *
 * Liest über die View `feeds_view`, schreibt in die Tabelle `feeds`.
 * Titel und Text werden in `toDomain()` aus feedType + View-Daten generiert.
 */
export class FeedRepository extends BaseRepository<FeedDomain, FeedRow> {
  tableName = "feeds";

  /** View-Name für Leseoperationen. */
  private readonly viewName = "feeds_view";

  constructor(client?: SupabaseClient) {
    super(client);
  }

  /* =====================================================================
  // Domain → DB-Zeile Mapping
  // ===================================================================== */
  /**
   * Konvertiert ein FeedDomain-Objekt in eine Postgres-Zeile.
   * View-Felder und generierte Felder (title, text) werden nicht geschrieben.
   *
   * @param domain - Das Domain-Objekt (camelCase)
   * @returns Partielle DB-Zeile (snake_case)
   */
  toRow(domain: FeedDomain): Partial<FeedRow> {
    return {
      feed_type: domain.feedType,
      visibility: domain.visibility,
      user_uid: domain.user.uid,
      source_object_type: domain.sourceObject.type,
      source_object_uid: domain.sourceObject.uid,
      source_object_data: domain.sourceObject.data ?? null,
    };
  }

  /* =====================================================================
  // DB-Zeile → Domain Mapping
  // ===================================================================== */
  /**
   * Konvertiert eine Postgres-Zeile (aus der View) in ein FeedDomain-Objekt.
   *
   * Titel und Text werden aus `feedType`, `source_object_name` (View)
   * und `source_object_data` (JSONB) generiert.
   *
   * @param row - Die DB-Zeile (snake_case)
   * @returns Domain-Objekt (camelCase)
   */
  toDomain(row: FeedRow): FeedDomain {
    const feedType = row.feed_type as FeedType;
    const sourceObjectName = row.source_object_name ?? "";
    const sourceObjectData = row.source_object_data ?? {};

    // textElements aus View-Daten und source_object_data ableiten
    const textElements = this.buildTextElements(
      feedType,
      sourceObjectName,
      sourceObjectData,
    );

    return {
      uid: row.id,
      feedType,
      visibility: row.visibility,
      title: getFeedTitle(feedType, textElements),
      text: getFeedText(feedType, textElements),
      createdAt: row.created_at ? new Date(row.created_at) : new Date(0),
      user: {
        uid: row.user_uid,
        displayName: row.user_display_name ?? "",
        pictureSrc: row.user_picture_src ?? "",
      },
      sourceObject: {
        type: row.source_object_type,
        uid: row.source_object_uid,
        name: sourceObjectName,
        pictureSrc: row.source_object_picture_src ?? "",
        data: row.source_object_data ?? undefined,
      },
    };
  }

  /* =====================================================================
  // textElements aus View-Daten und source_object_data ableiten
  // ===================================================================== */
  /**
   * Baut die textElements für die Titel-/Textgenerierung aus den
   * View-Daten und den JSONB-Zusatzdaten zusammen.
   *
   * @param feedType - Der Feed-Typ
   * @param sourceObjectName - Name des Quellobjekts (aus View aufgelöst)
   * @param data - Zusatzdaten aus source_object_data (JSONB)
   * @returns Array von Textbausteinen für getFeedTitle/getFeedText
   */
  private buildTextElements(
    feedType: FeedType,
    sourceObjectName: string,
    data: Record<string, unknown>,
  ): string[] {
    switch (feedType) {
      case FeedType.recipeRated:
        // textElements: [rezeptName, rating]
        return [sourceObjectName, String(data.rating ?? "0")];

      case FeedType.shoppingListCreated:
        // textElements: [randomItemText, remainingCount]
        return [
          String(data.randomItem ?? ""),
          String(data.remainingCount ?? "0"),
        ];

      case FeedType.productCreated:
      case FeedType.materialCreated:
        // textElements: [produktName] — Name wird als Titel verwendet
        return [sourceObjectName];

      case FeedType.recipePublished:
      case FeedType.recipeCommented:
      case FeedType.eventCreated:
      case FeedType.eventCookAdded:
        // textElements: [quellobjektName]
        return [sourceObjectName];

      case FeedType.donationConfirmed:
        // textElements: [amount] — Betrag in Rappen aus source_object_data
        return [String(data.amount ?? "0")];

      case FeedType.userCreated:
      case FeedType.profilePictureChanged:
        // Keine textElements nötig
        return [];

      default:
        return [];
    }
  }

  /* =====================================================================
  // Cache-Konfiguration
  // ===================================================================== */
  /**
   * Gibt die Cache-Konfiguration zurück.
   * Feeds werden kurzzeitig gecacht (15 Minuten).
   */
  getCacheConfig(): StorageObjectProperty {
    return STORAGE_OBJECT_PROPERTY.FEED;
  }

  /* =====================================================================
  // Leseoperationen (über View)
  // ===================================================================== */

  /**
   * Lädt die neuesten Feed-Einträge.
   *
   * @param limit - Maximale Anzahl Einträge
   * @param visibility - Sichtbarkeitsfilter (optional)
   * @param feedType - Feed-Typ-Filter (optional)
   * @returns Array der neuesten Feeds, sortiert nach Erstellungsdatum (neueste zuerst)
   */
  async getNewestFeeds(
    limit: number,
    visibility?: string,
    feedType?: FeedType,
  ): Promise<FeedDomain[]> {
    try {
      let query = this.client
        .from(this.viewName)
        .select("*")
        .order("created_at", {ascending: false})
        .limit(limit);

      if (visibility) {
        query = query.eq("visibility", visibility);
      }

      if (feedType) {
        query = query.eq("feed_type", feedType);
      }

      const {data, error} = await query;

      if (error) throw error;
      return (data ?? []).map((row) => this.toDomain(row as unknown as FeedRow));
    } catch (error) {
      Sentry.captureException(error);
      throw error;
    }
  }

  /**
   * Lädt einen einzelnen Feed-Eintrag anhand der ID.
   *
   * @param uid - Die Feed-ID
   * @returns Der Feed oder null, falls nicht gefunden
   */
  async getFeedById(uid: string): Promise<FeedDomain | null> {
    try {
      const {data, error} = await this.client
        .from(this.viewName)
        .select("*")
        .eq("id", uid)
        .maybeSingle();

      if (error) throw error;
      return data ? this.toDomain(data as unknown as FeedRow) : null;
    } catch (error) {
      Sentry.captureException(error);
      throw error;
    }
  }

  /**
   * Lädt alle Feed-Einträge (für Admin-Übersicht).
   *
   * @returns Array aller Feeds, sortiert nach Erstellungsdatum (neueste zuerst)
   */
  async getAllFeeds(): Promise<FeedDomain[]> {
    try {
      const {data, error} = await this.client
        .from(this.viewName)
        .select("*")
        .order("created_at", {ascending: false});

      if (error) throw error;
      return (data ?? []).map((row) => this.toDomain(row as unknown as FeedRow));
    } catch (error) {
      Sentry.captureException(error);
      throw error;
    }
  }

  /* =====================================================================
  // Schreiboperationen (auf Tabelle)
  // ===================================================================== */

  /**
   * Erstellt einen neuen Feed-Eintrag.
   *
   * Titel und Text werden NICHT gespeichert — sie werden beim Lesen
   * in {@link toDomain} generiert.
   *
   * @param params - Erstellungsparameter
   * @param authUser - Der angemeldete Benutzer
   * @returns Der erstellte Feed mit aufgelösten View-Daten
   */
  async insertFeed(
    params: CreateFeedParams,
    authUser: AuthUser,
  ): Promise<FeedDomain> {
    try {
      const userUid = params.userUid ?? authUser.uid;
      const visibility = params.visibility ?? Role.basic;

      const {data, error} = await this.client
        .from(this.tableName)
        .insert({
          feed_type: params.feedType,
          visibility: visibility,
          user_uid: userUid,
          source_object_type: params.sourceObjectType,
          source_object_uid: params.sourceObjectUid,
          source_object_data: params.sourceObjectData ?? null,
        })
        .select("*")
        .single();

      if (error) throw error;

      // View-Daten nachladen, um die aufgelösten Felder zu erhalten
      const created = await this.getFeedById(data.id);
      if (!created) throw new Error("Erstellter Feed nicht gefunden");
      return created;
    } catch (error) {
      Sentry.captureException(error);
      throw error;
    }
  }

  /**
   * Löscht einen einzelnen Feed-Eintrag.
   *
   * @param uid - Die Feed-ID
   */
  async deleteFeed(uid: string): Promise<void> {
    try {
      return this.remove(uid);
    } catch (error) {
      Sentry.captureException(error);
      throw error;
    }
  }

  /**
   * Löscht alle Feed-Einträge, die älter als die angegebene Anzahl Tage sind.
   *
   * @param daysOffset - Mindestanzahl Tage seit Erstellung
   * @returns Anzahl der gelöschten Einträge
   */
  async deleteFeedsByAge(daysOffset: number): Promise<number> {
    try {
      const offsetDate = new Date();
      offsetDate.setDate(offsetDate.getDate() - daysOffset);

      const {data, error} = await this.client
        .from(this.tableName)
        .delete()
        .lt("created_at", offsetDate.toISOString())
        .select("id");

      if (error) throw error;
      return data?.length ?? 0;
    } catch (error) {
      Sentry.captureException(error);
      throw error;
    }
  }
}
