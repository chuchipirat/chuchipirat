import Firebase from "../../Firebase/firebase.class";
import DatabaseService from "../../Database/DatabaseService";
import AuthUser from "../../Firebase/Authentication/authUser.class";
import {UserDomain} from "../../Database/Repository/UserRepository";
import {SortOrder} from "../../Firebase/Db/firebase.db.super.class";
import {MigrationJob, SourceRecord} from "./MigrationJob.interface";
import {supabase} from "../../Database/supabaseClient";

/* =====================================================================
// Typ der zusammengeführten Firebase-Daten (User + Public Profile)
// ===================================================================== */

/**
 * Zusammengeführte Firebase-Nutzerdaten aus dem User-Dokument
 * und dem Public-Profile-Subdokument.
 */
/** Inline-Typ für das alte Firebase-Picture-Objekt (vor der Storage-Migration). */
interface FirebasePicture {
  smallSize?: string;
  normalSize?: string;
  fullSize?: string;
}

interface FirebaseUserData {
  email: string;
  firstName: string;
  lastName: string;
  roles: string[];
  lastLogin: Date | {toDate: () => Date} | null;
  noLogins: number;
  displayName: string;
  memberSince: Date | {toDate: () => Date};
  memberId: number;
  motto: string;
  pictureSrc: FirebasePicture | string;
  /** Aus Firebase public profile stats.noFoundBugs migriert. */
  noFoundBugs: number;
}

/* =====================================================================
// UserMigrationJob — Migriert Benutzer von Firebase nach Postgres
// ===================================================================== */

/**
 * Migrations-Job für Benutzer.
 *
 * Liest alle Benutzer-Dokumente aus Firestore (users/{uid}) sowie deren
 * öffentliches Profil (users/{uid}/public/profile), führt die Daten
 * zusammen und schreibt sie via UserRepository in die Postgres-Tabelle.
 *
 * Aggregate-Dokumente (mit Prefix "000_") werden automatisch gefiltert.
 * Fehlende Public-Profile werden mit Standardwerten ergänzt.
 *
 * @example
 * const job = new UserMigrationJob();
 * const records = await job.fetchSourceRecords(firebase);
 */
export class UserMigrationJob implements MigrationJob<FirebaseUserData> {
  name = "Benutzer";
  description =
    "Migriert alle Benutzer (User + Public Profile) von Firebase nach Postgres.";

  /** Cache: E-Mail → auth.users UUID (wird einmalig beim ersten migrateRecord geladen). */
  private authUsersByEmail: Map<string, string> | null = null;

  /* =====================================================================
  // Alle User-Dokumente aus Firebase lesen
  // ===================================================================== */
  /**
   * Liest alle Benutzer-Dokumente aus Firestore und deren öffentliches Profil.
   * Filtert Aggregate-Dokumente (000_*) heraus und führt User-Dokument
   * und Public Profile in einem SourceRecord zusammen.
   *
   * @param firebase - Firebase-Instanz
   * @returns Array aller zusammengeführten Benutzer-Quelldatensätze
   */
  async fetchSourceRecords(
    firebase: Firebase
  ): Promise<SourceRecord<FirebaseUserData>[]> {
    // Alle User-Dokumente lesen
    const users = await firebase.user.readCollection<{
      uid: string;
      email: string;
      firstName: string;
      lastName: string;
      roles: string[];
      lastLogin: Date | {toDate: () => Date} | null;
      noLogins: number;
    }>({
      uids: [""],
      orderBy: {field: "firstName", sortOrder: SortOrder.asc},
      ignoreCache: true,
    });

    const records: SourceRecord<FirebaseUserData>[] = [];

    for (const user of users) {
      const uid = user.uid;

      // Aggregate-Dokumente überspringen (z.B. 000_allUsers)
      if (uid.startsWith("000_")) {
        continue;
      }

      // Öffentliches Profil lesen
      let publicProfile: {
        displayName?: string;
        memberSince?: Date | {toDate: () => Date};
        memberId?: number;
        motto?: string;
        pictureSrc?: FirebasePicture | string;
        stats?: {noFoundBugs?: number};
      } = {};

      try {
        publicProfile = await firebase.user.public.profile.read<{
          displayName: string;
          memberSince: Date | {toDate: () => Date};
          memberId: number;
          motto: string;
          pictureSrc: FirebasePicture | string;
          stats?: {noFoundBugs?: number};
        }>({uids: [uid]});
      } catch {
        // Kein Public Profile vorhanden — Standardwerte werden verwendet
      }

      const displayName = publicProfile.displayName || `${user.firstName} ${user.lastName}`;

      records.push({
        id: uid,
        label: displayName,
        data: {
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          roles: user.roles ?? [],
          lastLogin: user.lastLogin ?? null,
          noLogins: user.noLogins ?? 0,
          displayName: displayName,
          memberSince: publicProfile.memberSince ?? new Date(0),
          memberId: publicProfile.memberId ?? 0,
          motto: publicProfile.motto ?? "",
          pictureSrc: publicProfile.pictureSrc ?? "",
          noFoundBugs: publicProfile.stats?.noFoundBugs ?? 0,
        },
      });
    }

    return records;
  }

  /* =====================================================================
  // Prüfen, ob ein Benutzer bereits in Postgres existiert
  // ===================================================================== */
  /**
   * Prüft anhand der E-Mail, ob der Benutzer bereits in Postgres existiert.
   * Da die id-Spalte jetzt UUID ist (= auth.users.id), kann nicht mehr
   * mit der Firebase-UID gesucht werden. Stattdessen wird per E-Mail geprüft.
   *
   * @param database - DatabaseService-Instanz
   * @param record - Der zu prüfende Quelldatensatz
   * @returns true, falls der Benutzer bereits vorhanden ist
   */
  async checkExists(
    database: DatabaseService,
    record: SourceRecord<FirebaseUserData>
  ): Promise<boolean> {
    const users = database.users;
    const existingId = await users.findByEmail(record.data.email);
    return existingId !== null;
  }

  /* =====================================================================
  // Einzelnen Benutzer nach Postgres migrieren
  // ===================================================================== */
  /**
   * Mappt die zusammengeführten Firebase-Daten auf ein UserDomain-Objekt
   * und schreibt es per Upsert in die Postgres-Tabelle.
   *
   * Da die id-Spalte jetzt UUID ist (= auth.users.id), wird zunächst
   * die Supabase-UUID anhand der E-Mail-Adresse ermittelt. Die
   * ursprüngliche Firebase-UID wird in legacy_firebase_uid gespeichert.
   *
   * Behandelt Sonderfälle:
   * - pictureSrc als String vs. Picture-Objekt
   * - Firestore Timestamp vs. Date bei lastLogin/memberSince
   *
   * @param database - DatabaseService-Instanz
   * @param record - Der zu migrierende Quelldatensatz
   * @param authUser - Der angemeldete Admin-Benutzer
   * @throws Error falls kein auth.users-Eintrag für die E-Mail existiert
   */
  async migrateRecord(
    database: DatabaseService,
    record: SourceRecord<FirebaseUserData>,
    authUser: AuthUser
  ): Promise<void> {
    const data = record.data;

    // Supabase-UUID direkt aus auth.users ermitteln (public.users existiert
    // zu diesem Zeitpunkt noch nicht — findByEmail() würde fehlschlagen).
    // Auth-User-Liste einmalig laden und cachen
    if (!this.authUsersByEmail) {
      const {data: listData, error: listError} =
        await supabase.auth.admin.listUsers({perPage: 1000});

      if (listError) throw listError;

      this.authUsersByEmail = new Map();
      for (const supabaseUser of listData.users) {
        if (supabaseUser.email) {
          this.authUsersByEmail.set(
            supabaseUser.email.toLocaleLowerCase().trim(),
            supabaseUser.id
          );
        }
      }
    }

    const normalizedEmail = data.email.toLocaleLowerCase().trim();
    const supabaseUserId = this.authUsersByEmail.get(normalizedEmail) ?? null;

    if (!supabaseUserId) {
      throw new Error(
        `Kein auth.users-Eintrag für ${data.email} gefunden. ` +
        `Der Benutzer muss zuerst in Supabase Auth importiert werden.`
      );
    }

    const memberSince = this.toDate(data.memberSince);
    const userDomain: UserDomain = {
      uid: supabaseUserId,
      email: data.email,
      firstName: data.firstName,
      lastName: data.lastName,
      roles: data.roles as UserDomain["roles"],
      noLogins: data.noLogins ?? 0,
      noFoundBugs: data.noFoundBugs ?? 0,
      displayName: data.displayName,
      memberId: data.memberId ?? 0,
      motto: data.motto ?? "",
      pictureSrc: this.extractPictureSrc(data.pictureSrc),
      createdAt: memberSince,
      legacyFirebaseUid: record.id,
    };

    const users = database.users;
    await users.upsert({
      id: supabaseUserId,
      value: userDomain,
      authUser: authUser,
    });
  }

  /* =====================================================================
  // Hilfsmethoden für Typkonvertierungen
  // ===================================================================== */

  /**
   * Konvertiert einen Firestore-Timestamp oder unbekannten Wert zu einem Date.
   * Firestore gibt Timestamps mit toDate()-Methode zurück, je nach Kontext
   * aber auch direkte Date-Objekte.
   */
  private toDate(
    value: Date | {toDate: () => Date} | null | undefined
  ): Date {
    if (!value) return new Date(0);
    if (value instanceof Date) return value;
    if (typeof (value as {toDate: () => Date}).toDate === "function") {
      return (value as {toDate: () => Date}).toDate();
    }
    // Fallback: als String parsen
    return new Date(value as unknown as string);
  }

  /**
   * Extrahiert die Bild-URL aus dem pictureSrc-Feld.
   * In Firebase kann pictureSrc als leerer String oder als Picture-Objekt
   * gespeichert sein. Gibt immer einen einzelnen String zurück.
   *
   * @param value - pictureSrc-Wert aus Firebase (String oder Picture-Objekt)
   * @returns Bild-URL als String (bevorzugt normalSize)
   */
  private extractPictureSrc(
    value: FirebasePicture | string | undefined | null
  ): string {
    if (!value) return "";
    if (typeof value === "string") return value;
    return value.normalSize ?? "";
  }
}
