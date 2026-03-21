import Role from "../../../constants/roles";

export interface AuthUserPublicProfile {
  displayName: string;
  motto: string;
  pictureSrc: string;
}

/**
 * Authentifizierter Benutzer — enthält Profil- und Auth-Daten.
 *
 * `uid` ist die Supabase Auth UUID (= `auth.users.id` = `public.users.id`).
 *
 * @param uid - Benutzer-UUID (identisch mit auth.users.id und public.users.id)
 * @param email - E-Mail-Adresse des Benutzers
 * @param emailVerified - Ob die E-Mail verifiziert wurde
 * @param firstName - Vorname
 * @param lastName - Nachname
 * @param roles - Zugewiesene Rollen
 * @param publicProfile - Öffentlich sichtbare Profildaten
 */
export class AuthUser {
  /** Benutzer-UUID (identisch mit auth.users.id und public.users.id) */
  uid: string;
  email: string;
  emailVerified: boolean;
  firstName: string;
  lastName: string;
  roles: Role[];
  publicProfile: AuthUserPublicProfile;
  constructor() {
    this.uid = "";
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
