/**
 * Migrationsjob für Anträge von Firebase nach Postgres.
 *
 * Migriert:
 * 1. Aktive Anträge aus `requests/active/requests`
 * 2. Geschlossene Anträge aus `requests/closed/requests`
 * 3. Kommentare (eingebettet in Firebase-Dokumenten → separate Tabelle)
 *
 * FK-Auflösungen:
 * - author.uid (Firebase-UID) → auth_uid → auth.users.id
 * - assignee.uid (Firebase-UID) → auth_uid → auth.users.id
 * - requestObject.uid (Rezept-ID) → recipes.id (über firebase_uid)
 *
 * WICHTIG: Nach der Migration muss die Sequenz zurückgesetzt werden:
 * `SELECT setval('request_number_seq', (SELECT COALESCE(MAX(number), 0) FROM requests))`
 *
 * @example
 * const job = new RequestMigrationJob();
 * const records = await job.fetchSourceRecords(firebase, database);
 */
import {collection, getDocs} from "firebase/firestore";
import Firebase from "../../Firebase/firebase.class";
import DatabaseService from "../../Database/DatabaseService";
import AuthUser from "../../Firebase/Authentication/authUser.class";
import {supabaseAdmin, supabase} from "../../Database/supabaseClient";
import {SupabaseClient} from "@supabase/supabase-js";
import {MigrationJob, SourceRecord} from "./MigrationJob.interface";

/* =====================================================================
// Firebase-Datenstrukturen
// ===================================================================== */

/** Firebase-Kommentar in einem Antrag. */
interface FirebaseComment {
  comment: string;
  date: {seconds?: number; toDate?: () => Date} | Date | string;
  user: {uid: string; displayName: string; pictureSrc?: string};
}

/** Firebase-Changelog-Eintrag. */
interface FirebaseChangeLogEntry {
  date: {seconds?: number; toDate?: () => Date} | Date | string;
  user: {uid: string; displayName: string};
  action: string;
  newValue: Record<string, unknown>;
}

/** Firebase-Antrags-Dokument. */
interface FirebaseRequest {
  uid: string;
  number: number;
  status: string;
  requestType: string;
  createDate: {seconds?: number; toDate?: () => Date} | Date | string;
  resolveDate: {seconds?: number; toDate?: () => Date} | Date | string;
  author: {
    uid: string;
    displayName: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    pictureSrc?: string;
  };
  assignee: {uid: string; displayName: string; pictureSrc?: string};
  requestObject: {
    uid: string;
    name: string;
    pictureSrc?: string;
    authorUid?: string;
  };
  comments: FirebaseComment[];
  changeLog: FirebaseChangeLogEntry[];
  /** Gibt an, ob der Antrag aus der aktiven oder geschlossenen Sammlung stammt. */
  _source?: "active" | "closed";
}

/* =====================================================================
// Hilfsfunktionen
// ===================================================================== */

/**
 * Konvertiert einen Firebase-Zeitstempel in ein ISO-String.
 */
function toIsoString(
  value: {seconds?: number; toDate?: () => Date} | Date | string | undefined,
): string {
  if (!value) return new Date().toISOString();
  if (typeof value === "string") return new Date(value).toISOString();
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object" && "toDate" in value && value.toDate) {
    return value.toDate().toISOString();
  }
  if (typeof value === "object" && "seconds" in value && value.seconds) {
    return new Date(value.seconds * 1000).toISOString();
  }
  return new Date().toISOString();
}

/**
 * Prüft ob ein Resolve-Date ein Platzhalter ist (9999-12-31).
 */
function isPlaceholderDate(dateStr: string): boolean {
  return dateStr.startsWith("9999");
}

/* =====================================================================
// RequestMigrationJob
// ===================================================================== */

export class RequestMigrationJob implements MigrationJob<FirebaseRequest> {
  name = "Anträge";
  description =
    "Migriert Anträge (aktiv + geschlossen) und deren Kommentare von Firebase nach Postgres.";

  /**
   * Liest alle aktiven und geschlossenen Anträge aus Firebase.
   *
   * @param firebase - Firebase-Instanz
   * @returns Array aller Anträge als SourceRecords
   */
  async fetchSourceRecords(
    firebase: Firebase,
  ): Promise<SourceRecord<FirebaseRequest>[]> {
    const records: SourceRecord<FirebaseRequest>[] = [];

    // Aktive Anträge lesen
    const activeRef = collection(
      firebase.firestore,
      "requests",
      "active",
      "requests",
    );
    const activeSnapshot = await getDocs(activeRef);
    activeSnapshot.forEach((doc) => {
      const data = doc.data() as FirebaseRequest;
      records.push({
        id: doc.id,
        label: `#${data.number} (aktiv)`,
        data: {...data, uid: doc.id, _source: "active"},
      });
    });

    // Geschlossene Anträge lesen
    const closedRef = collection(
      firebase.firestore,
      "requests",
      "closed",
      "requests",
    );
    const closedSnapshot = await getDocs(closedRef);
    closedSnapshot.forEach((doc) => {
      const data = doc.data() as FirebaseRequest;
      records.push({
        id: doc.id,
        label: `#${data.number} (geschlossen)`,
        data: {...data, uid: doc.id, _source: "closed"},
      });
    });

    return records;
  }

  /**
   * Prüft ob ein Antrag bereits in Postgres existiert (über firebase_uid).
   *
   * @param database - DatabaseService-Instanz
   * @param record - Der zu prüfende Quelldatensatz
   * @returns true, falls der Antrag bereits migriert wurde
   */
  async checkExists(
    _database: DatabaseService,
    record: SourceRecord<FirebaseRequest>,
  ): Promise<boolean> {
    const client: SupabaseClient = supabaseAdmin ?? supabase;

    const {data} = await client
      .from("requests")
      .select("id")
      .eq("firebase_uid", record.id)
      .maybeSingle();

    return data !== null;
  }

  /**
   * Migriert einen einzelnen Antrag nach Postgres.
   *
   * Erstellt den Antrag mit expliziter Nummer (überschreibt SEQUENCE DEFAULT)
   * und fügt Kommentare als separate Zeilen in request_comments ein.
   *
   * @param database - DatabaseService-Instanz
   * @param record - Der zu migrierende Quelldatensatz
   * @param authUser - Der Admin-Benutzer (für Audit)
   */
  async migrateRecord(
    _database: DatabaseService,
    record: SourceRecord<FirebaseRequest>,
    _authUser: AuthUser,
  ): Promise<void> {
    const client: SupabaseClient = supabaseAdmin ?? supabase;
    const fb = record.data;
    const adminClient = client;

    // Autor-UID auflösen: Firebase-UID → auth.users.id
    const authorAuthUid = await this.resolveAuthUid(adminClient, fb.author?.uid);
    if (!authorAuthUid) {
      throw new Error(`Autor-UID nicht gefunden: ${fb.author?.uid}`);
    }

    // Assignee-UID auflösen (optional)
    let assigneeAuthUid: string | null = null;
    if (fb.assignee?.uid) {
      assigneeAuthUid = await this.resolveAuthUid(adminClient, fb.assignee.uid);
    }

    // Rezept-ID auflösen: Firebase-UID → recipes.id
    const recipeId = await this.resolveRecipeId(adminClient, fb.requestObject?.uid);
    if (!recipeId) {
      throw new Error(`Rezept nicht gefunden: ${fb.requestObject?.uid}`);
    }

    // Changelog konvertieren
    const changeLog = (fb.changeLog ?? []).map((entry) => ({
      date: toIsoString(entry.date),
      userUid: entry.user?.uid ?? "",
      userDisplayName: entry.user?.displayName ?? "",
      action: entry.action ?? "",
      newValue: entry.newValue ?? {},
    }));

    // Resolve-Date
    const resolveDateStr = toIsoString(fb.resolveDate);
    const resolveDate = isPlaceholderDate(resolveDateStr) ? null : resolveDateStr;

    // Antrag einfügen — mit expliziter Nummer (SEQUENCE wird danach zurückgesetzt)
    const {data: insertedRequest, error: insertError} = await adminClient
      .from("requests")
      .insert({
        firebase_uid: record.id,
        number: fb.number,
        status: fb.status,
        request_type: fb.requestType,
        author_uid: authorAuthUid,
        assignee_uid: assigneeAuthUid,
        request_object_uid: recipeId,
        change_log: changeLog,
        resolve_date: resolveDate,
        created_at: toIsoString(fb.createDate),
      })
      .select("id")
      .single();

    if (insertError) throw insertError;

    // Kommentare migrieren
    if (fb.comments && fb.comments.length > 0) {
      const commentRows: {
        request_id: string;
        comment: string;
        created_at: string;
        created_by: string | null;
      }[] = [];
      for (const c of fb.comments) {
        // Kommentar-Autor-UID auflösen
        const commentAuthorUid = await this.resolveAuthUid(adminClient, c.user?.uid);

        commentRows.push({
          request_id: insertedRequest.id,
          comment: c.comment ?? "",
          created_at: toIsoString(c.date),
          created_by: commentAuthorUid,
        });
      }

      if (commentRows.length > 0) {
        const {error: commentError} = await adminClient
          .from("request_comments")
          .insert(commentRows);

        if (commentError) {
          console.error(
            `Kommentare für Antrag #${fb.number} konnten nicht migriert werden:`,
            commentError,
          );
        }
      }
    }
  }

  /**
   * Löst eine Firebase-UID zu einer auth.users.id auf.
   *
   * @param client - Supabase-Client
   * @param firebaseUid - Firebase-UID des Benutzers
   * @returns auth.users.id (UUID) oder null
   */
  private async resolveAuthUid(
    client: SupabaseClient,
    firebaseUid: string | undefined,
  ): Promise<string | null> {
    if (!firebaseUid) return null;

    // users.id ist die Firebase-UID (TEXT-PK aus der User-Migration)
    const {data} = await client
      .from("users")
      .select("auth_uid")
      .eq("id", firebaseUid)
      .maybeSingle();

    return data?.auth_uid ?? null;
  }

  /**
   * Löst eine Firebase-Rezept-UID zu einer recipes.id auf.
   *
   * @param client - Supabase-Client
   * @param firebaseRecipeUid - Firebase-UID des Rezepts
   * @returns recipes.id oder null
   */
  private async resolveRecipeId(
    client: SupabaseClient,
    firebaseRecipeUid: string | undefined,
  ): Promise<string | null> {
    if (!firebaseRecipeUid) return null;

    const {data} = await client
      .from("recipes")
      .select("id")
      .eq("firebase_uid", firebaseRecipeUid)
      .maybeSingle();

    return data?.id ?? null;
  }
}
