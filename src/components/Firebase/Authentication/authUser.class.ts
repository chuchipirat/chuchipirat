import Role from "../../../constants/roles";

export interface AuthUserPublicProfile {
  displayName: string;
  motto: string;
  pictureSrc: string;
}

/**
 * Authentifizierter Benutzer — enthält Profil- und Auth-Daten.
 *
 * @param uid - Firebase UID (aus users.id, wird nach Migration entfernt)
 * @param authUid - Supabase Auth UUID (aus auth.users.id) — massgebend für Audit-Spalten
 * @param email - E-Mail-Adresse des Benutzers
 * @param emailVerified - Ob die E-Mail verifiziert wurde
 * @param firstName - Vorname
 * @param lastName - Nachname
 * @param roles - Zugewiesene Rollen
 * @param publicProfile - Öffentlich sichtbare Profildaten
 */
export class AuthUser {
  uid: string;
  /** Supabase Auth UUID (auth.users.id) — wird für Audit-Spalten (created_by, updated_by) verwendet */
  authUid: string;
  email: string;
  emailVerified: boolean;
  firstName: string;
  lastName: string;
  roles: Role[];
  publicProfile: AuthUserPublicProfile;
  constructor() {
    this.uid = "";
    this.authUid = "";
    this.email = "";
    this.emailVerified = false;
    this.firstName = "";
    this.lastName = "";
    this.roles = [];
    this.publicProfile = {
      displayName: "",
      motto: "",
      pictureSrc: "",
    };
  }
}

export default AuthUser;
