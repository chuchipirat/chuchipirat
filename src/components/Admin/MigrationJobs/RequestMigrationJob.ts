/**
 * Migrationsjob für Anträge von Firebase nach Postgres.
 *
 * Migriert:
 * 1. Aktive Anträge aus `requests/active/requests`
 * 2. Geschlossene Anträge aus `requests/closed/requests`
 * 3. Kommentare (eingebettet in Firebase-Dokumenten → separate Tabelle)
 *
 * FK-Auflösungen:
 * - author.uid (Firebase-UID) → users.legacy_firebase_uid → users.id (Supabase UUID)
 * - assignee.uid (Firebase-UID) → users.legacy_firebase_uid → users.id (Supabase UUID)
 * - requestObject.uid (Rezept-ID) → recipes.id (über firebase_uid)
 *
 * WICHTIG: Nach der Migration muss die Sequenz zurückgesetzt werden:
 * `SELECT setval('request_number_seq', (SELECT COALESCE(MAX(number), 0) FROM requests))`
 *
 * @example
 * const job = new RequestMigrationJob();
 * const records = await job.fetchSourceRecords(firebase, database);
 */
import * as Sentry from "@sentry/react";
import {collection, getDocs} from "firebase/firestore";
import Firebase from "../../Firebase/firebase.class";
import DatabaseService from "../../Database/DatabaseService";
import AuthUser from "../../Firebase/Authentication/authUser.class";
import {supabaseAdmin} from "../../Database/supabaseClient";
import {fetchAllRows, MigrationJob, SourceRecord} from "./MigrationJob.interface";

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

  /** firebase_uid → Supabase Auth UUID für Benutzer */
  private userAuthUidByFirebaseUid: Map<string, string> = new Map();
  /** firebase_uid → recipes.id für Rezepte */
  private recipeIdByFirebaseUid: Map<string, string> = new Map();
  /** Bereits migrierte Anträge (firebase_uid) — für schnelle checkExists-Prüfung */
  private existingFirebaseUids: Set<string> | null = null;

  /**
   * Liest alle aktiven und geschlossenen Anträge aus Firebase.
   *
   * @param firebase - Firebase-Instanz
   * @returns Array aller Anträge als SourceRecords
   */
  async fetchSourceRecords(
    firebase: Firebase,
  ): Promise<SourceRecord<FirebaseRequest>[]> {
    // Lookup-Maps vorladen (Benutzer, Rezepte, bereits migrierte Anträge)
    await this.buildLookupMaps();

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
    // In-Memory-Prüfung gegen vorab geladene Set (kein DB-Roundtrip)
    return this.existingFirebaseUids?.has(record.id) ?? false;
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
    const fb = record.data;
    const adminClient = supabaseAdmin!;

    // Autor-UID auflösen via vorgeladener Map
    const authorAuthUid = fb.author?.uid
      ? this.userAuthUidByFirebaseUid.get(fb.author.uid) ?? null
      : null;
    if (!authorAuthUid) {
      throw new Error(`Autor-UID nicht gefunden: ${fb.author?.uid}`);
    }

    // Assignee-UID auflösen via vorgeladener Map (optional)
    const assigneeAuthUid = fb.assignee?.uid
      ? this.userAuthUidByFirebaseUid.get(fb.assignee.uid) ?? null
      : null;

    // Rezept-ID auflösen via vorgeladener Map
    const recipeId = fb.requestObject?.uid
      ? this.recipeIdByFirebaseUid.get(fb.requestObject.uid) ?? null
      : null;
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
        // Kommentar-Autor-UID auflösen via vorgeladener Map
        const commentAuthorUid = c.user?.uid
          ? this.userAuthUidByFirebaseUid.get(c.user.uid) ?? null
          : null;

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
          Sentry.captureException(commentError, {
            extra: {
              context: `Kommentare für Antrag #${fb.number} konnten nicht migriert werden`,
            },
          });
        }
      }
    }
  }

  /**
   * Lädt alle Lookup-Maps vor: Benutzer (firebase_uid → Supabase UUID),
   * Rezepte (firebase_uid → recipes.id) und bereits migrierte Anträge.
   */
  private async buildLookupMaps(): Promise<void> {
    const client = supabaseAdmin!;

    // Benutzer: legacy_firebase_uid → id (UUID)
    const userRows = await fetchAllRows(client, "users", "id, legacy_firebase_uid",
      (query) => query.not("legacy_firebase_uid", "is", null));

    for (const row of userRows) {
      if (row.legacy_firebase_uid && row.id) {
        this.userAuthUidByFirebaseUid.set(
          row.legacy_firebase_uid as string,
          row.id as string,
        );
      }
    }

    // Rezepte: firebase_uid → id
    const recipeRows = await fetchAllRows(client, "recipes", "id, firebase_uid",
      (query) => query.not("firebase_uid", "is", null));

    for (const row of recipeRows) {
      if (row.firebase_uid && row.id) {
        this.recipeIdByFirebaseUid.set(
          row.firebase_uid as string,
          row.id as string,
        );
      }
    }

    // Bereits migrierte Anträge laden (für In-Memory checkExists)
    const existingRows = await fetchAllRows(
      client, "requests", "firebase_uid",
      (query) => query.not("firebase_uid", "is", null),
    );
    this.existingFirebaseUids = new Set(
      existingRows.map((row) => row.firebase_uid as string),
    );
  }
}
