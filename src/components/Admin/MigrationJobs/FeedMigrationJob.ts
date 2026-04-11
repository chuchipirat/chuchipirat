/**
 * Migrationsjob für Feed-Einträge von Firebase nach Postgres.
 *
 * Migriert alle Dokumente aus der Firebase-Collection `feeds` (exklusive
 * `000_log`-Audit-Dokument). Mapping:
 * - `menuplanCreated` → `eventCreated`
 * - `recipeCreated`, `none` → übersprungen
 * - `sourceObject.uid` → `source_object_uid`
 * - `user.uid` → `user_uid`
 * - `created.fromUid` → `created_by` (über users-Tabelle aufgelöst)
 *
 * Denormalisierte Felder (sourceObject.name, user.displayName) werden NICHT
 * migriert — die View `feeds_view` löst diese live via JOIN auf.
 *
 * @example
 * const job = new FeedMigrationJob();
 * const records = await job.fetchSourceRecords(firebase);
 */
import {collection, getDocs} from "firebase/firestore";
import Firebase from "../../Firebase/firebase.class";
import DatabaseService from "../../Database/DatabaseService";
import AuthUser from "../../Firebase/Authentication/authUser.class";
import {supabaseAdmin} from "../../Database/supabaseClient";
import {fetchAllRows, MigrationJob, SourceRecord} from "./MigrationJob.interface";

/* =====================================================================
// Firebase-Datenstruktur
// ===================================================================== */

/** Firebase Feed-Dokument. */
interface FirebaseFeed {
  title: string;
  text: string;
  type: string;
  visibility: string;
  sourceObject: {
    uid: string;
    name: string;
    pictureSrc?: string;
    type?: string;
    additionalData?: Record<string, unknown>;
  };
  user: {
    uid: string;
    displayName: string;
    pictureSrc?: string;
  };
  created: {
    date: {seconds?: number; toDate?: () => Date} | Date | string;
    fromUid: string;
    fromDisplayName: string;
  };
}

/* =====================================================================
// FeedMigrationJob
// ===================================================================== */

/**
 * Migrationsjob für Feed-Einträge.
 */
export class FeedMigrationJob implements MigrationJob<FirebaseFeed> {
  name = "Feeds";
  description = "Migriert Feed-Einträge aus der Firebase-Collection «feeds» nach Postgres.";

  /** firebase_uid → Supabase Auth UUID für Benutzer */
  private userAuthUidByFirebaseUid: Map<string, string> = new Map();
  /** firebase_uid → Postgres-ID für Rezepte */
  private recipeIdByFirebaseUid: Map<string, string> = new Map();
  /** firebase_uid → Postgres-ID für Events */
  private eventIdByFirebaseUid: Map<string, string> = new Map();
  /** firebase_uid → Postgres-ID für Produkte */
  private productIdByFirebaseUid: Map<string, string> = new Map();
  /** firebase_uid → Postgres-ID für Materialien */
  private materialIdByFirebaseUid: Map<string, string> = new Map();
  /** Bereits migrierte Feeds (firebase_uid) — für schnelle checkExists-Prüfung */
  private existingFirebaseUids: Set<string> | null = null;

  /* =====================================================================
  // Quelldaten aus Firebase lesen
  // ===================================================================== */
  /**
   * Liest alle Feed-Dokumente aus Firebase (exklusive 000_log).
   *
   * @param firebase - Firebase-Instanz
   * @returns Array der Quelldatensätze
   */
  async fetchSourceRecords(firebase: Firebase): Promise<SourceRecord<FirebaseFeed>[]> {
    // Lookup-Maps vorladen (Benutzer + bereits migrierte Feeds)
    await this.buildLookupMaps();

    const feedsRef = collection(firebase.firestore, "feeds");
    const snapshot = await getDocs(feedsRef);
    const records: SourceRecord<FirebaseFeed>[] = [];

    snapshot.forEach((doc) => {
      // 000_log ist das Audit-Dokument — nicht migrieren
      if (doc.id === "000_log") return;

      const data = doc.data() as FirebaseFeed;
      records.push({
        id: doc.id,
        label: `${data.type}: ${data.title}`,
        data,
      });
    });

    return records;
  }

  /* =====================================================================
  // Prüfen ob bereits migriert
  // ===================================================================== */
  /**
   * Prüft ob ein Feed-Eintrag bereits in Postgres existiert.
   *
   * @param database - DatabaseService-Instanz
   * @param record - Der zu prüfende Quelldatensatz
   * @returns true, falls der Datensatz bereits migriert wurde
   */
  async checkExists(
    _database: DatabaseService,
    record: SourceRecord<FirebaseFeed>,
  ): Promise<boolean> {
    // In-Memory-Prüfung gegen vorab geladene Set (kein DB-Roundtrip)
    return this.existingFirebaseUids?.has(record.id) ?? false;
  }

  /* =====================================================================
  // Einen Datensatz migrieren
  // ===================================================================== */
  /**
   * Migriert einen einzelnen Feed-Eintrag nach Postgres.
   *
   * @param database - DatabaseService-Instanz
   * @param record - Der zu migrierende Quelldatensatz
   * @param authUser - Der angemeldete Admin-Benutzer
   */
  async migrateRecord(
    database: DatabaseService,
    record: SourceRecord<FirebaseFeed>,
    _authUser: AuthUser,
  ): Promise<void> {
    const data = record.data;
    const client = supabaseAdmin!;

    // Feed-Typ mappen
    let feedType = data.type;
    if (feedType === "menuplanCreated") {
      feedType = "eventCreated";
    }
    if (feedType === "recipeCreated" || feedType === "none") {
      // Diese Typen werden nicht migriert
      return;
    }

    // Visibility mappen — Firebase-Wert kann ein numerischer Role-Wert sein
    const visibility = this.mapVisibility(data.visibility);

    // source_object_type bestimmen (in Firebase nicht immer gesetzt)
    const sourceObjectType = data.sourceObject.type || this.inferSourceObjectType(feedType);

    // user_uid aufgelöst: Firebase-UID → auth.users.id (UUID) via vorgeladener Map
    const userUid = data.user?.uid
      ? this.userAuthUidByFirebaseUid.get(data.user.uid) ?? null
      : null;
    if (!userUid) {
      // Ohne gültigen User kann kein Feed-Eintrag erstellt werden (NOT NULL + FK)
      if (import.meta.env.DEV) console.warn(`Feed ${record.id}: user.uid konnte nicht aufgelöst werden, übersprungen.`);
      return;
    }

    // created_by aufgelöst: Firebase-UID → auth.users.id via vorgeladener Map
    const createdBy = data.created?.fromUid
      ? this.userAuthUidByFirebaseUid.get(data.created.fromUid) ?? null
      : null;

    // Erstellungszeitpunkt
    const createdAt = this.toIsoString(data.created?.date);

    // source_object_uid auflösen: Firebase-UID → Supabase-ID
    const firebaseSourceUid = data.sourceObject?.uid ?? "";
    let resolvedSourceUid: string | null = null;
    switch (sourceObjectType) {
      case "recipe":
        resolvedSourceUid = this.recipeIdByFirebaseUid.get(firebaseSourceUid) ?? null;
        break;
      case "event":
        resolvedSourceUid = this.eventIdByFirebaseUid.get(firebaseSourceUid) ?? null;
        break;
      case "product":
        resolvedSourceUid = this.productIdByFirebaseUid.get(firebaseSourceUid) ?? null;
        break;
      case "material":
        resolvedSourceUid = this.materialIdByFirebaseUid.get(firebaseSourceUid) ?? null;
        break;
      case "user":
        resolvedSourceUid = this.userAuthUidByFirebaseUid.get(firebaseSourceUid) ?? null;
        break;
    }

    if (!resolvedSourceUid) {
      // Quellobjekt nicht gefunden — Feed überspringen
      return;
    }

    await client.from("feeds").insert({
      firebase_uid: record.id,
      feed_type: feedType,
      visibility: visibility,
      user_uid: userUid,
      source_object_type: sourceObjectType,
      source_object_uid: resolvedSourceUid,
      source_object_data: data.sourceObject?.additionalData
        ? data.sourceObject.additionalData
        : null,
      created_at: createdAt,
      created_by: createdBy,
    });
  }

  /* =====================================================================
  // Hilfsmethoden
  // ===================================================================== */

  /**
   * Konvertiert die Firebase-Visibility in den Postgres-Enum-Wert.
   */
  private mapVisibility(visibility: string): string {
    switch (visibility) {
      case "communityLeader":
        return "communityLeader";
      case "admin":
        return "admin";
      default:
        return "basic";
    }
  }

  /**
   * Leitet den source_object_type aus dem Feed-Typ ab, falls nicht gesetzt.
   */
  private inferSourceObjectType(feedType: string): string {
    switch (feedType) {
      case "userCreated":
      case "profilePictureChanged":
        return "user";
      case "recipePublished":
      case "recipeRated":
      case "recipeCommented":
        return "recipe";
      case "eventCreated":
      case "eventCookAdded":
      case "shoppingListCreated":
        return "event";
      case "productCreated":
        return "product";
      case "materialCreated":
        return "material";
      default:
        return "unknown";
    }
  }

  /**
   * Konvertiert einen Firebase-Timestamp in einen ISO-String.
   */
  private toIsoString(
    value: {seconds?: number; toDate?: () => Date} | Date | string | undefined,
  ): string {
    if (!value) return new Date().toISOString();
    if (typeof value === "string") return value;
    if (value instanceof Date) return value.toISOString();
    if (typeof (value as any).toDate === "function") {
      return (value as any).toDate().toISOString();
    }
    if (typeof (value as any).seconds === "number") {
      return new Date((value as any).seconds * 1000).toISOString();
    }
    return new Date().toISOString();
  }

  /**
   * Lädt alle Lookup-Maps vor: Benutzer (firebase_uid → Supabase UUID)
   * und bereits migrierte Feeds (firebase_uid Set).
   */
  private async buildLookupMaps(): Promise<void> {
    const client = supabaseAdmin!;

    // Alle Lookup-Maps parallel laden
    const [userRows, recipeRows, eventRows, productRows, materialRows, existingRows] = await Promise.all([
      fetchAllRows(client, "users", "id, legacy_firebase_uid",
        (query) => query.not("legacy_firebase_uid", "is", null)),
      fetchAllRows(client, "recipes", "id, firebase_uid",
        (query) => query.not("firebase_uid", "is", null)),
      fetchAllRows(client, "events", "id, firebase_uid",
        (query) => query.not("firebase_uid", "is", null)),
      fetchAllRows(client, "products", "id, firebase_uid",
        (query) => query.not("firebase_uid", "is", null)),
      fetchAllRows(client, "materials", "id, firebase_uid",
        (query) => query.not("firebase_uid", "is", null)),
      fetchAllRows(client, "feeds", "firebase_uid",
        (query) => query.not("firebase_uid", "is", null)),
    ]);

    for (const row of userRows) {
      if (row.legacy_firebase_uid && row.id) {
        this.userAuthUidByFirebaseUid.set(row.legacy_firebase_uid as string, row.id as string);
      }
    }
    for (const row of recipeRows) {
      if (row.firebase_uid) this.recipeIdByFirebaseUid.set(row.firebase_uid as string, row.id as string);
    }
    for (const row of eventRows) {
      if (row.firebase_uid) this.eventIdByFirebaseUid.set(row.firebase_uid as string, row.id as string);
    }
    for (const row of productRows) {
      if (row.firebase_uid) this.productIdByFirebaseUid.set(row.firebase_uid as string, row.id as string);
    }
    for (const row of materialRows) {
      if (row.firebase_uid) this.materialIdByFirebaseUid.set(row.firebase_uid as string, row.id as string);
    }

    this.existingFirebaseUids = new Set(
      existingRows.map((row) => row.firebase_uid as string),
    );
  }
}
