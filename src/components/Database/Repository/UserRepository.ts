import {BaseRepository} from "./BaseRepository";
import {
  STORAGE_OBJECT_PROPERTY,
  StorageObjectProperty,
} from "../../Firebase/Db/sessionStorageHandler.class";
import {Picture} from "../../Shared/global.interface";
import {Role} from "../../../constants/roles";
import {UserOverviewStructure} from "../../User/user.class";
import UserPublicProfile from "../../User/user.public.profile.class";

/* =====================================================================
// DB-Zeilenstruktur (snake_case, entspricht den Postgres-Spalten)
// ===================================================================== */
/**
 * Datenbank-Zeilentyp für die users-Tabelle.
 * Alle Feldnamen in snake_case, entsprechend den Postgres-Spalten.
 * Der Index-Signature ist nötig für die Kompatibilität mit Record<string, unknown>.
 */
export interface UserRow {
  [key: string]: unknown;
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  roles: string[];
  last_login: string | null;
  no_logins: number;
  display_name: string;
  member_since: string;
  member_id: number;
  motto: string;
  picture_src_small: string;
  picture_src_normal: string;
  picture_src_full: string;
  created_at: string;
  last_change_at: string;
}

/* =====================================================================
// Domain-Modell (camelCase, wird in der App verwendet)
// ===================================================================== */
/**
 * Einheitliches Domain-Modell für Benutzer.
 * Vereint die bisherigen getrennten Modelle User + UserPublicProfile
 * in einer flachen Struktur. Alle Felder in camelCase.
 */
export interface UserDomain {
  uid: string;
  email: string;
  firstName: string;
  lastName: string;
  roles: Role[];
  lastLogin: Date;
  noLogins: number;
  displayName: string;
  memberSince: Date;
  memberId: number;
  motto: string;
  pictureSrc: Picture;
}

/* =====================================================================
// UserRepository — Ersetzt 5 Firebase-DB-Klassen:
//   FirebaseDbUser, FirebaseDbUserPublic, FirebaseDbUserPublicProfile,
//   FirebaseDbUserPublicSearchFields, FirebaseDbUserShort
// ===================================================================== */
/**
 * Repository für Benutzer-CRUD-Operationen.
 *
 * Vereint den Zugriff auf die vereinheitlichte users-Tabelle in Postgres.
 * Ersetzt die bisherigen 5 Firebase-DB-Klassen und fasst die 3 Firestore-
 * Speicherorte (users/{uid}, users/{uid}/public/profile,
 * users/{uid}/public/searchFields) in einer einzigen Tabelle zusammen.
 *
 * Die Statistiken (noComments, noEvents, etc.) werden nicht mehr auf dem
 * User gespeichert, sondern später über Views/JOINs aus den Datentabellen
 * berechnet. Bis dahin werden Standardwerte (0) zurückgegeben.
 */
export class UserRepository extends BaseRepository<UserDomain, UserRow> {
  tableName = "users";

  /* =====================================================================
  // Domain → DB-Zeile Mapping
  // ===================================================================== */
  /**
   * Konvertiert ein UserDomain-Objekt in eine Postgres-Zeile.
   * Wandelt camelCase → snake_case und flacht die Picture-Struktur ab.
   * @param user - Das Domain-Objekt
   * @returns Partielle DB-Zeile
   */
  toRow(user: UserDomain): Partial<UserRow> {
    return {
      id: user.uid,
      email: user.email.toLocaleLowerCase(),
      first_name: user.firstName,
      last_name: user.lastName,
      roles: user.roles,
      last_login: user.lastLogin ? user.lastLogin.toISOString() : null,
      no_logins: user.noLogins,
      display_name: user.displayName,
      member_since: user.memberSince
        ? user.memberSince.toISOString()
        : new Date().toISOString(),
      motto: user.motto,
      picture_src_small: user.pictureSrc?.smallSize ?? "",
      picture_src_normal: user.pictureSrc?.normalSize ?? "",
      picture_src_full: user.pictureSrc?.fullSize ?? "",
    };
  }

  /* =====================================================================
  // DB-Zeile → Domain Mapping
  // ===================================================================== */
  /**
   * Konvertiert eine Postgres-Zeile in ein UserDomain-Objekt.
   * Wandelt snake_case → camelCase und baut die Picture-Struktur zusammen.
   * @param row - Die DB-Zeile
   * @returns Domain-Objekt
   */
  toDomain(row: UserRow): UserDomain {
    return {
      uid: row.id,
      email: row.email,
      firstName: row.first_name,
      lastName: row.last_name,
      roles: row.roles as Role[],
      lastLogin: row.last_login ? new Date(row.last_login) : new Date(0),
      noLogins: row.no_logins,
      displayName: row.display_name,
      memberSince: row.member_since ? new Date(row.member_since) : new Date(0),
      memberId: row.member_id,
      motto: row.motto,
      pictureSrc: {
        smallSize: row.picture_src_small,
        normalSize: row.picture_src_normal,
        fullSize: row.picture_src_full,
      },
    };
  }

  /* =====================================================================
  // Cache-Konfiguration
  // ===================================================================== */
  /**
   * Gibt die Cache-Konfiguration zurück.
   * Aktuell: NONE (kein Caching), analog zum bisherigen Firebase-Verhalten.
   */
  getCacheConfig(): StorageObjectProperty {
    return STORAGE_OBJECT_PROPERTY.NONE;
  }

  /* =====================================================================
  // Alle User für Admin-Übersicht holen
  // Ersetzt: firebase.user.short.read({uids: []}) → 000_allUsers-Dokument
  // ===================================================================== */
  /**
   * Lädt eine Übersicht aller Benutzer für die Admin-Seite.
   * Ersetzt das bisherige 000_allUsers-Aggregat-Dokument durch eine SQL-Abfrage.
   * @returns Array mit Benutzerübersichts-Daten (Name, Email, MemberId, etc.)
   */
  async findOverview(): Promise<UserOverviewStructure[]> {
    const {data, error} = await this.client
      .from(this.tableName)
      .select(
        "id, first_name, last_name, email, display_name, member_id, member_since"
      )
      .order("first_name", {ascending: true});

    if (error) throw error;

    return (data as Pick<
      UserRow,
      | "id"
      | "first_name"
      | "last_name"
      | "email"
      | "display_name"
      | "member_id"
      | "member_since"
    >[]).map((row) => ({
      uid: row.id,
      firstName: row.first_name,
      lastName: row.last_name,
      email: row.email,
      displayName: row.display_name,
      memberId: row.member_id,
      memberSince: new Date(row.member_since),
    }));
  }

  /* =====================================================================
  // Benutzer-UID anhand der E-Mail-Adresse suchen
  // Ersetzt: firebase.user.public.searchFields.readCollectionGroup()
  // ===================================================================== */
  /**
   * Sucht die UID eines Benutzers anhand der E-Mail-Adresse.
   * Ersetzt die bisherige searchFields-Subcollection durch eine direkte Abfrage
   * auf der email-Spalte mit Index.
   * @param email - E-Mail-Adresse (wird automatisch lowercase + trimmed)
   * @returns Die Benutzer-UID oder null, falls nicht gefunden oder mehrdeutig
   */
  async findByEmail(email: string): Promise<string | null> {
    const {data, error} = await this.client
      .from(this.tableName)
      .select("id")
      .eq("email", email.toLocaleLowerCase().trim())
      .limit(2);

    if (error) throw error;
    if (!data || data.length === 0) return null;
    if (data.length > 1) return null; // ambiguous
    return data[0].id;
  }

  /* =====================================================================
  // Öffentliches Profil eines Benutzers lesen
  // Ersetzt: firebase.user.public.profile.read({uids: [uid]})
  // ===================================================================== */
  /**
   * Lädt das öffentliche Profil eines Benutzers aus der user_profiles-View.
   * Die View enthält nur die öffentlich sichtbaren Felder (DisplayName, Motto, Bild, etc.).
   * Statistiken werden vorerst mit Standardwerten (0) gefüllt und später über
   * Views/JOINs aus den Datentabellen berechnet.
   * @param userId - UID des Benutzers
   * @returns UserPublicProfile-Objekt
   */
  async findPublicProfile(userId: string): Promise<UserPublicProfile> {
    const {data, error} = await this.client
      .from("user_profiles")
      .select("*")
      .eq("id", userId)
      .single();

    if (error) throw error;

    const profile = new UserPublicProfile();
    profile.uid = data.id;
    profile.displayName = data.display_name;
    profile.memberSince = new Date(data.member_since);
    profile.memberId = data.member_id;
    profile.motto = data.motto;
    profile.pictureSrc = {
      smallSize: data.picture_src_small,
      normalSize: data.picture_src_normal,
      fullSize: data.picture_src_full,
    };
    // Stats will be populated via views/joins once data tables exist
    profile.stats = {
      noComments: 0,
      noEvents: 0,
      noRecipesPublic: 0,
      noRecipesPrivate: 0,
      noFoundBugs: 0,
    };
    return profile;
  }

  /* =====================================================================
  // Vollständiges Profil (privat + öffentlich) in einer Abfrage
  // Ersetzt: User.getFullProfile() das zuvor 2 separate Reads brauchte
  // ===================================================================== */
  /**
   * Lädt das vollständige Benutzerprofil (private + öffentliche Daten).
   * Dank der vereinheitlichten users-Tabelle reicht eine einzige Abfrage,
   * statt wie bisher 2 separate Firestore-Reads (user + public/profile).
   * @param userId - UID des Benutzers
   * @returns Vollständiges Benutzerprofil inkl. Statistiken (vorerst mit Standardwerten)
   * @throws Error falls der Benutzer nicht gefunden wird
   */
  async findFullProfile(
    userId: string
  ): Promise<UserDomain & {stats: UserPublicProfile["stats"]}> {
    const user = await this.findById(userId);
    if (!user) throw new Error(`User not found: ${userId}`);

    // Stats will be computed from data tables via views later
    return {
      ...user,
      stats: {
        noComments: 0,
        noEvents: 0,
        noRecipesPublic: 0,
        noRecipesPrivate: 0,
        noFoundBugs: 0,
      },
    };
  }

  /* =====================================================================
  // Login registrieren (last_login aktualisieren, no_logins hochzählen)
  // Ersetzt: User.registerSignIn()
  // ===================================================================== */
  /**
   * Registriert einen erfolgreichen Login. Aktualisiert den Zeitstempel
   * des letzten Logins und zählt die Anzahl Logins hoch.
   * @param userId - UID des Benutzers
   */
  async registerSignIn(userId: string): Promise<void> {
    // Read current login count, then increment
    const {data: current, error: readError} = await this.client
      .from(this.tableName)
      .select("no_logins")
      .eq("id", userId)
      .single();

    if (readError) throw readError;

    const {error} = await this.client
      .from(this.tableName)
      .update({
        last_login: new Date().toISOString(),
        no_logins: ((current?.no_logins as number) ?? 0) + 1,
      })
      .eq("id", userId);

    if (error) throw error;
  }
}
