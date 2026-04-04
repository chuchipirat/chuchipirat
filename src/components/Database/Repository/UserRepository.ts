import {BaseRepository} from "./BaseRepository";
import {
  STORAGE_OBJECT_PROPERTY,
  StorageObjectProperty,
} from "../../Firebase/Db/sessionStorageHandler.class";
import {Role} from "../../../constants/roles";
import {UserOverviewStructure} from "../../User/user.class";
import {UserPublicProfile} from "../../User/user.public.profile.class";

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
  /** UUID — identisch mit auth.users.id */
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  roles: string[];
  no_logins: number;
  no_found_bugs: number;
  display_name: string;
  member_id: number;
  motto: string;
  picture_src: string;
  created_at: string;
  updated_at: string;
  /** Firebase-UID des Benutzers (nur bei migrierten Benutzern gesetzt) */
  legacy_firebase_uid?: string;
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
  /** UUID — identisch mit auth.users.id */
  uid: string;
  email: string;
  firstName: string;
  lastName: string;
  roles: Role[];
  noLogins: number;
  /** Anzahl gemeldeter/bestätigter Bugs (aus Firebase stats.noFoundBugs migriert). */
  noFoundBugs: number;
  displayName: string;
  memberId: number;
  motto: string;
  pictureSrc: string;
  /** Erstellungsdatum (DB-Spalte created_at). Bei der Migration aus memberSince gesetzt. */
  createdAt?: Date;
  /** Firebase-UID des Benutzers (nur bei migrierten Benutzern gesetzt) */
  legacyFirebaseUid?: string;
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

  constructor(client?: import("@supabase/supabase-js").SupabaseClient) {
    super(client);
  }

  /* =====================================================================
  // Domain → DB-Zeile Mapping
  // ===================================================================== */
  /**
   * Konvertiert ein UserDomain-Objekt in eine Postgres-Zeile.
   * Wandelt camelCase → snake_case.
   * @param user - Das Domain-Objekt
   * @returns Partielle DB-Zeile
   */
  toRow(user: UserDomain): Partial<UserRow> {
    const row: Partial<UserRow> = {
      id: user.uid,
      email: user.email.toLocaleLowerCase(),
      first_name: user.firstName,
      last_name: user.lastName,
      roles: user.roles,
      no_logins: user.noLogins,
      no_found_bugs: user.noFoundBugs ?? 0,
      display_name: user.displayName,
      motto: user.motto,
      picture_src: user.pictureSrc ?? "",
    };

    // member_id nur setzen, wenn vorhanden (Migration).
    // Andernfalls greift die IDENTITY-Sequenz.
    if (user.memberId) {
      row.member_id = user.memberId;
    }

    // created_at nur setzen, wenn explizit angegeben (z.B. bei Migration).
    // Andernfalls greift der DB-Default (NOW()).
    if (user.createdAt) {
      row.created_at = user.createdAt.toISOString();
    }

    // legacy_firebase_uid nur setzen, wenn vorhanden (Migration)
    if (user.legacyFirebaseUid) {
      row.legacy_firebase_uid = user.legacyFirebaseUid;
    }

    return row;
  }

  /* =====================================================================
  // DB-Zeile → Domain Mapping
  // ===================================================================== */
  /**
   * Konvertiert eine Postgres-Zeile in ein UserDomain-Objekt.
   * Wandelt snake_case → camelCase.
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
      noLogins: row.no_logins,
      noFoundBugs: row.no_found_bugs ?? 0,
      displayName: row.display_name,
      memberId: row.member_id,
      motto: row.motto,
      pictureSrc: row.picture_src,
      createdAt: row.created_at ? new Date(row.created_at) : undefined,
      legacyFirebaseUid: row.legacy_firebase_uid ?? undefined,
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
        "id, first_name, last_name, email, display_name, member_id, created_at"
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
      | "created_at"
    >[]).map((row) => ({
      uid: row.id,
      firstName: row.first_name,
      lastName: row.last_name,
      email: row.email,
      displayName: row.display_name,
      memberId: row.member_id,
      memberSince: new Date(row.created_at),
    }));
  }

  /* =====================================================================
  // no_found_bugs atomar erhöhen / verringern
  // Ersetzt: firebase.user.public.profile.incrementField({field: 'stats.noFoundBugs'})
  // ===================================================================== */
  /**
   * Erhöht oder verringert no_found_bugs atomar per RPC.
   * Der DB-Wert unterschreitet nie 0 (GREATEST(0, …) in der Funktion gesichert).
   *
   * @param userId - Firebase UID (PK in users)
   * @param delta - +1 (Increment) oder -1 (Decrement)
   * @throws {PostgrestError} bei Datenbankfehler
   */
  async incrementFoundBugs(userId: string, delta: number): Promise<void> {
    const {error} = await this.client.rpc("increment_found_bugs", {
      p_user_id: userId,
      p_delta: delta,
    });
    if (error) throw error;
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
   * @param eventId - Optionale Event-ID für Koch-Berechtigungsprüfung
   * @returns Die Benutzer-UID oder null, falls nicht gefunden oder mehrdeutig
   */
  async findByEmail(email: string, eventId?: string): Promise<string | null> {
    // RPC-Aufruf über SECURITY DEFINER Funktion — umgeht die RLS-Policy,
    // die nur die eigene Zeile sichtbar macht.
    const {data, error} = await this.client.rpc("find_user_id_by_email", {
      lookup_email: email.toLocaleLowerCase().trim(),
      p_event_id: eventId ?? null,
    });

    if (error) throw error;
    return data ?? null;
  }

  /* =====================================================================
  // Öffentliches Profil eines Benutzers lesen
  // Ersetzt: firebase.user.public.profile.read({uids: [uid]})
  // ===================================================================== */
  /**
   * Lädt das öffentliche Profil eines Benutzers aus der user_profiles-View
   * und die Statistiken über die RPC-Funktion `get_user_profile_stats()`.
   * Beide Abfragen laufen parallel (Promise.all).
   *
   * @param userId - Benutzer-UUID (= auth.users.id = public.users.id)
   * @returns UserPublicProfile-Objekt
   */
  async findPublicProfile(userId: string): Promise<UserPublicProfile> {
    // Profildaten und Statistiken parallel laden
    const [profileResult, statsResult] = await Promise.all([
      this.client
        .from("user_profiles")
        .select("*")
        .eq("id", userId)
        .maybeSingle(),
      this.client.rpc("get_user_profile_stats", {p_user_id: userId}),
    ]);

    if (profileResult.error) throw profileResult.error;
    if (!profileResult.data)
      throw new Error(`Benutzerprofil nicht gefunden: ${userId}`);
    if (statsResult.error) throw statsResult.error;

    const data = profileResult.data;
    const profile = new UserPublicProfile();
    profile.uid = data.id;
    profile.displayName = data.display_name;
    profile.memberSince = new Date(data.created_at);
    profile.memberId = data.member_id;
    profile.motto = data.motto;
    profile.pictureSrc = data.picture_src;

    // Stats aus RPC-Ergebnis mappen
    const statsMap = new Map<string, number>(
      (statsResult.data ?? []).map(
        (row: {field: string; value: number}) => [row.field, Number(row.value)],
      ),
    );
    profile.stats = UserRepository.mapStatsFromRpc(statsMap);
    return profile;
  }

  /* =====================================================================
  // Vollständiges Profil (privat + öffentlich) in einer Abfrage
  // Ersetzt: User.getFullProfile() das zuvor 2 separate Reads brauchte
  // ===================================================================== */
  /**
   * Lädt das vollständige Benutzerprofil (private + öffentliche Daten)
   * inkl. Statistiken via `get_user_profile_stats()`.
   *
   * @param userId - UID des Benutzers (Firebase UID / users.id)
   * @returns Vollständiges Benutzerprofil inkl. berechneten Statistiken
   * @throws Error falls der Benutzer nicht gefunden wird
   */
  async findFullProfile(
    userId: string
  ): Promise<UserDomain & {stats: UserPublicProfile["stats"]}> {
    const user = await this.findById(userId);
    if (!user) throw new Error(`User not found: ${userId}`);

    // Stats über RPC laden
    let stats = UserRepository.emptyStats();

    const {data, error} = await this.client.rpc("get_user_profile_stats", {
      p_user_id: user.uid,
    });

    if (!error && data) {
      const statsMap = new Map<string, number>(
        data.map((row: {field: string; value: number}) => [
          row.field,
          Number(row.value),
        ]),
      );
      stats = UserRepository.mapStatsFromRpc(statsMap);
    }

    return {...user, stats};
  }

  /* =====================================================================
  // Hilfsmethoden für Stats-Mapping
  // ===================================================================== */

  /** Gibt ein leeres Stats-Objekt mit allen Feldern auf 0 zurück. */
  private static emptyStats(): UserPublicProfile["stats"] {
    return {
      noComments: 0,
      noRatings: 0,
      noEvents: 0,
      noRecipesPublic: 0,
      noRecipesPrivate: 0,
      noRecipesVariants: 0,
      noFoundBugs: 0,
    };
  }

  /** Mappt die RPC-Ergebnisse auf das Stats-Objekt. */
  private static mapStatsFromRpc(
    statsMap: Map<string, number>,
  ): UserPublicProfile["stats"] {
    return {
      noRecipesPublic: statsMap.get("noRecipesPublic") ?? 0,
      noRecipesPrivate: statsMap.get("noRecipesPrivate") ?? 0,
      noRecipesVariants: statsMap.get("noRecipesVariants") ?? 0,
      noEvents: statsMap.get("noEvents") ?? 0,
      noComments: statsMap.get("noComments") ?? 0,
      noRatings: statsMap.get("noRatings") ?? 0,
      noFoundBugs: statsMap.get("noFoundBugs") ?? 0,
    };
  }

  /* =====================================================================
  // Login registrieren (no_logins hochzählen)
  // Ersetzt: User.registerSignIn()
  // ===================================================================== */
  /**
   * Registriert einen erfolgreichen Login. Zählt die Anzahl Logins
   * atomar in einem einzigen Statement hoch.
   * Der Zeitstempel des letzten Logins wird von Supabase Auth in
   * auth.users.last_sign_in_at verwaltet.
   *
   * @param userId - UID des Benutzers
   */
  async registerSignIn(userId: string): Promise<void> {
    const {error} = await this.client.rpc("increment_logins", {
      user_id: userId,
    });

    if (error) throw error;
  }

  /* =====================================================================
  // Admin-Suchmethoden — verwenden Service Role Client (kein RLS)
  // ===================================================================== */

  /**
   * Findet IDs aller Benutzer, deren display_name den Begriff enthält.
   * Wird als erste Stufe der Ersteller-Namens-Suche in der Admin-Rezeptübersicht
   * eingesetzt.
   *
   * @param term - Suchbegriff (case-insensitive Teilstring)
   * @returns Array von Benutzer-UUIDs der gefundenen Benutzer
   */
  async findIdsByDisplayName(term: string): Promise<string[]> {
    const {data, error} = await this.client
      .from(this.tableName)
      .select("id")
      .ilike("display_name", `%${term}%`);

    if (error) throw error;
    return (data ?? [])
      .map((row: {id: string}) => row.id)
      .filter((uid): uid is string => uid !== null && uid !== "");
  }

  /**
   * Zählt die Benutzer mit einer bestimmten Rolle.
   * Nutzt Supabase `.contains()` für den Array-Vergleich auf der roles-Spalte.
   *
   * @param role - Die zu zählende Rolle.
   * @returns Anzahl der Benutzer mit dieser Rolle.
   */
  async countByRole(role: Role): Promise<number> {
    const {count, error} = await this.client
      .from(this.tableName)
      .select("id", {count: "exact", head: true})
      .contains("roles", [role]);

    if (error) throw error;
    return count ?? 0;
  }

  /**
   * Gibt eine Map von id → display_name für eine Menge von UUIDs zurück.
   * Wird verwendet, um Ersteller-Namen auf Admin-Karten anzuzeigen.
   *
   * @param userIds - Array von Benutzer-UUIDs
   * @returns Map<id, display_name>
   */
  async findDisplayNamesByIds(
    userIds: string[],
  ): Promise<Map<string, string>> {
    if (userIds.length === 0) return new Map();

    const {data, error} = await this.client
      .from(this.tableName)
      .select("id, display_name")
      .in("id", userIds);

    if (error) throw error;
    return new Map(
      (data ?? []).map((row: {id: string; display_name: string}) => [
        row.id,
        row.display_name,
      ]),
    );
  }

  /**
   * Gibt die minimalen Anzeige-Felder (display_name, picture_src) für eine
   * Menge von Benutzer-UUIDs zurück. Verwendet die SECURITY DEFINER Funktion
   * `get_comment_author_profiles`, die RLS auf public.users umgeht und
   * ausschliesslich öffentliche Felder exponiert.
   *
   * @param userIds - Array von Benutzer-UUIDs
   * @returns Map<id, {displayName, pictureSrc}>
   */
  async getUserDisplayInfo(
    userIds: string[],
  ): Promise<Map<string, {displayName: string; pictureSrc: string}>> {
    if (userIds.length === 0) return new Map();

    const {data, error} = await this.client.rpc("get_comment_author_profiles", {
      uids: userIds,
    });

    if (error) throw error;

    return new Map(
      (
        data as Array<{
          id: string;
          display_name: string;
          picture_src: string;
        }>
      ).map((profile) => [
        profile.id,
        {displayName: profile.display_name ?? "", pictureSrc: profile.picture_src ?? ""},
      ]),
    );
  }
}
