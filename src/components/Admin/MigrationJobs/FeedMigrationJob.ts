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
import {supabaseAdmin, supabase} from "../../Database/supabaseClient";
import {SupabaseClient} from "@supabase/supabase-js";
import {MigrationJob, SourceRecord} from "./MigrationJob.interface";

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
    database: DatabaseService,
    record: SourceRecord<FirebaseFeed>,
  ): Promise<boolean> {
    const client: SupabaseClient = supabaseAdmin ?? supabase;
    const {data, error} = await client
      .from("feeds")
      .select("id")
      .eq("firebase_uid", record.id)
      .maybeSingle();

    if (error) throw error;
    return data !== null;
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
    authUser: AuthUser,
  ): Promise<void> {
    const data = record.data;
    const client: SupabaseClient = supabaseAdmin ?? supabase;

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

    // user_uid aufgelöst: Firebase-UID → auth.users.id (UUID)
    let userUid: string | null = null;
    if (data.user?.uid) {
      userUid = await this.resolveAuthUid(client, data.user.uid);
    }
    if (!userUid) {
      // Ohne gültigen User kann kein Feed-Eintrag erstellt werden (NOT NULL + FK)
      if (import.meta.env.DEV) console.warn(`Feed ${record.id}: user.uid konnte nicht aufgelöst werden, übersprungen.`);
      return;
    }

    // created_by aufgelöst: Firebase-UID → auth.users.id
    let createdBy: string | null = null;
    if (data.created?.fromUid) {
      createdBy = await this.resolveAuthUid(client, data.created.fromUid);
    }

    // Erstellungszeitpunkt
    const createdAt = this.toIsoString(data.created?.date);

    await client.from("feeds").insert({
      firebase_uid: record.id,
      feed_type: feedType,
      visibility: visibility,
      user_uid: userUid,
      source_object_type: sourceObjectType,
      source_object_uid: data.sourceObject?.uid ?? "",
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
   * Löst eine Firebase-UID in die Supabase-UUID (users.id) auf.
   * Nach der id-Vereinheitlichung (Phase 3) stehen die alten Firebase-UIDs
   * in legacy_firebase_uid, die id ist die Supabase-UUID.
   */
  private async resolveAuthUid(
    client: SupabaseClient,
    firebaseUid: string,
  ): Promise<string | null> {
    const {data} = await client
      .from("users")
      .select("id")
      .eq("legacy_firebase_uid", firebaseUid)
      .maybeSingle();
    return data?.id ?? null;
  }
}
