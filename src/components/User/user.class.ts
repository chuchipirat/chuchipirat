import {Role} from "../../constants/roles";

import Firebase from "../Firebase/firebase.class";
import {logEvent} from "firebase/analytics";

import {
  USER_PROFILE_ERROR_DISPLAYNAME_MISSING as TEXT_USER_PROFILE_ERROR_DISPLAYNAME_MISSING,
  NO_USER_WITH_THIS_EMAIL as TEXT_NO_USER_WITH_THIS_EMAIL,
} from "../../constants/text";
import FirebaseAnalyticEvent from "../../constants/firebaseEvent";
import {AuthUser} from "../Firebase/Authentication/authUser.class";
import UserPublicProfile from "./user.public.profile.class";
import {SortOrder} from "../Firebase/Db/firebase.db.super.class";

import {resizeImage} from "../Shared/imageResize";
import DatabaseService from "../Database/DatabaseService";

/**
 * Kurzform eines Users für Anzeige im Kontext (Kommentar, Koch, usw.).
 *
 * @param userUid - UID des Users
 * @param displayName - Anzeigename des Users
 * @param pictureSrc - Bild-URL des Profilbildes
 * @param motto - Motto des Users
 */
export interface UserShort {
  userUid: string;
  displayName: string;
  pictureSrc: string;
  motto: string;
}

/**
 * Übersichtsstruktur für die Admin-Benutzerübersicht.
 * Wird von User.getUsersOverview() zurückgegeben.
 */
export interface UserOverviewStructure {
  uid?: User["uid"];
  /** Supabase Auth UUID — vorhanden sobald der User sich einmal per Supabase eingeloggt hat. */
  authUid?: string;
  firstName: User["firstName"];
  lastName: User["lastName"];
  displayName: UserPublicProfile["displayName"];
  email: User["email"];
  memberId: UserPublicProfile["memberId"];
  memberSince: Date;
}

/**
 * Vollständiges Benutzerprofil — vereint User (privat) und UserPublicProfile (öffentlich).
 */
export interface UserFullProfile extends User, UserPublicProfile {}

/** Parameter für {@link User.createUser} */
interface CreateUser {
  /** Firebase-Instanz (noch benötigt für Analytics/Storage während Übergangsphase) */
  firebase: Firebase;
  /** DatabaseService-Instanz für Supabase-Zugriff */
  database: DatabaseService;
  /** UID des neuen Users (von Supabase Auth oder Firebase Auth) */
  uid: string;
  /** Vorname */
  firstName: string;
  /** Nachname */
  lastName: string;
  /** E-Mail-Adresse */
  email: string;
  /** Supabase Auth UUID (optional, für neue Benutzer über Supabase Auth) */
  authUid?: string;
}

/** Parameter für {@link User.createUserPublicData} */
interface CreateUserPublicData {
  /** Firebase-Instanz (für Cloud Function Trigger) */
  firebase: Firebase;
  /** E-Mail-Adresse des neuen Users */
  email: string;
}

/** Parameter für {@link User.registerSignIn} */
interface RegisterSignIn {
  /** DatabaseService-Instanz für Supabase-Zugriff */
  database: DatabaseService;
  /** Der angemeldete Benutzer */
  authUser: AuthUser;
}

/** Parameter für {@link User.getUidByEmail} */
interface GetUidByEmail {
  /** DatabaseService-Instanz für Supabase-Zugriff */
  database: DatabaseService;
  /** E-Mail-Adresse zum Suchen */
  email: string;
}

/** Parameter für {@link User.getUser} */
interface GetUser {
  /** DatabaseService-Instanz für Supabase-Zugriff */
  database: DatabaseService;
  /** UID des gesuchten Users */
  uid: string;
}

/** Parameter für {@link User.getAllUsers} */
interface GetAllUsers {
  /** Firebase-Instanz (nutzt noch Firebase für diese Abfrage) */
  firebase: Firebase;
}

/** Parameter für {@link User.getUsersOverview} */
interface GetUsersOverview {
  /** DatabaseService-Instanz für Supabase-Zugriff */
  database: DatabaseService;
}

/** Parameter für {@link User.getPublicProfile} */
interface GetPublicProfile {
  /** DatabaseService-Instanz für Supabase-Zugriff */
  database: DatabaseService;
  /** UID des gesuchten Users */
  uid: string;
}

/** Parameter für {@link User.getFullProfile} */
interface GetFullProfile {
  /** Firebase-Instanz (optional, nicht mehr benötigt seit Supabase-Migration) */
  firebase?: Firebase;
  /** DatabaseService-Instanz für Supabase-Zugriff */
  database: DatabaseService;
  /** UID des gesuchten Users */
  uid: string;
}

/** Parameter für {@link User.saveFullProfile} */
interface SaveFullProfile {
  /** Firebase-Instanz (für Storage und Cloud Functions) */
  firebase: Firebase;
  /** DatabaseService-Instanz für Supabase-Zugriff */
  database: DatabaseService;
  /** Das zu speichernde Benutzerprofil */
  userProfile: UserFullProfile;
  /** Der angemeldete Benutzer */
  authUser: AuthUser;
  /** Optionales lokales Bild zum Hochladen */
  localPicture?: File | null;
}

/** Parameter für {@link User.uploadPicture} */
interface UploadPicture {
  /** DatabaseService-Instanz (für Supabase Storage) */
  database: DatabaseService;
  /** Die hochzuladende Bilddatei */
  file: File;
  /** Der angemeldete Benutzer */
  authUser: AuthUser;
}

/** Parameter für {@link User.deletePicture} */
interface DeletePicture {
  /** Firebase-Instanz (für Storage) */
  firebase: Firebase;
  /** DatabaseService-Instanz für Supabase-Zugriff */
  database: DatabaseService;
  /** Der angemeldete Benutzer */
  authUser: AuthUser;
}

/** Parameter für {@link User.updateRoles} */
interface UpdateRoles {
  /** Firebase-Instanz (noch benötigt während Übergangsphase) */
  firebase: Firebase;
  /** DatabaseService-Instanz für Supabase-Zugriff */
  database: DatabaseService;
  /** UID des Benutzers, dessen Rollen geändert werden */
  userUid: User["uid"];
  /** Die neuen Rollen */
  newRoles: User["roles"];
  /** Der angemeldete Admin-Benutzer */
  authUser: AuthUser;
}

/** Parameter für {@link User.updateStats} */
interface UpdateStats {
  /** DatabaseService-Instanz für Supabase-Zugriff */
  database: DatabaseService;
  /** UID des Benutzers (Firebase UID / PK in users) */
  userUid: User["uid"];
  /** Wert um den no_found_bugs geändert wird (+1 oder -1) */
  statsValue: number;
}

/**
 * Zentrale Service-Klasse für Benutzeroperationen.
 *
 * Delegiert die meisten DB-Operationen an das UserRepository (Supabase/Postgres).
 * Firebase wird noch für Storage, Cloud Functions, Analytics und einige
 * Legacy-Abfragen verwendet.
 */
export default class User {
  uid: string;
  firstName: string;
  lastName: string;
  email: string;
  noLogins: number;
  roles: Role[];
  /* =====================================================================
  // Konstruktor
  // ===================================================================== */
  constructor() {
    this.uid = "";
    this.firstName = "";
    this.lastName = "";
    this.email = "";
    this.noLogins = 0;
    this.roles = [];
  }
  /* =====================================================================
    // Objekt erzeugen
    // ===================================================================== */
  /**
   * Erzeugt eine User-Instanz aus einem bestehenden User-Objekt.
   *
   * @param user - Quell-User mit uid, firstName, lastName, email, noLogins
   * @returns Neue User-Instanz mit kopierten Werten
   */
  static factory({uid, firstName, lastName, email, noLogins}: User) {
    const user = new User();

    user.uid = uid;
    user.firstName = firstName;
    user.lastName = lastName;
    user.email = email;
    user.noLogins = noLogins;
    return user;
  }

  /* =====================================================================
  // Alle User holen
  // ===================================================================== */
  /**
   * Lädt alle User aus Firebase (Legacy-Methode).
   *
   * @param firebase - Firebase-Instanz
   * @returns Array aller User
   * @throws Error bei Datenbankfehler
   */
  static async getAllUsers({firebase}: GetAllUsers) {
    try {
      return await firebase.user.readCollection<User>({
        uids: [""],
        orderBy: {field: "firstName", sortOrder: SortOrder.desc},
        ignoreCache: true,
      });
    } catch (error) {
      console.error(error);
      throw error;
    }
  }
  /* =====================================================================
  // Neuer User anlegen
  // ===================================================================== */
  /**
   * Legt einen neuen Benutzer in der Datenbank an.
   *
   * @param database - DatabaseService-Instanz
   * @param uid - UID des neuen Users
   * @param firstName - Vorname
   * @param lastName - Nachname
   * @param email - E-Mail-Adresse
   * @param authUid - Supabase Auth UUID (optional)
   * @throws Error bei Datenbankfehler
   */
  static async createUser({
    database,
    uid,
    firstName,
    lastName,
    email,
    authUid,
  }: CreateUser) {
    // Admin-Client verwenden (umgeht RLS, da User noch nicht via Supabase Auth authentifiziert)
    const users = database.admin?.users ?? database.users;
    try {
      await users.upsert({
        id: uid,
        value: {
          uid: uid,
          authUid: authUid ?? uid,
          firstName: firstName,
          lastName: lastName,
          email: email.toLocaleLowerCase(),
          noLogins: 0,
          noFoundBugs: 0,
          roles: [Role.basic],
          displayName: `${firstName} ${lastName}`.trim() || firstName,
          memberId: 0,
          motto: "",
          pictureSrc: "",
        },
        authUser: {} as AuthUser,
      });
    } catch (error) {
      console.error(error);
      throw error;
    }
  }
  /* =====================================================================
  // Öffentliches Profil anlegen
  // ===================================================================== */
  // With Supabase, public profile data is part of the users table,
  // so this is handled by createUser(). Keep for Firebase cloud function
  // trigger during transition.
  /**
   * Löst die Cloud Function zum Erstellen der öffentlichen Profildaten aus.
   * Wird während der Übergangsphase noch für Firebase benötigt.
   *
   * @param firebase - Firebase-Instanz (für Cloud Function)
   * @param email - E-Mail-Adresse des neuen Users
   * @throws Error bei Cloud-Function-Fehler
   */
  static async createUserPublicData({firebase, email}: CreateUserPublicData) {
    const anonymousUser = new AuthUser();
    anonymousUser.email = email;
    anonymousUser.publicProfile.displayName = email;

    try {
      await firebase.cloudFunction.createUserPublicData.triggerCloudFunction({
        values: {email: email},
        authUser: anonymousUser,
      });
      logEvent(firebase.analytics, FirebaseAnalyticEvent.userCreated);
    } catch (error) {
      console.error(error);
      throw error;
    }
  }
  /* =====================================================================
  // Übersicht aller User holen
  // ===================================================================== */
  /**
   * Lädt die Benutzerübersicht für die Admin-Seite.
   *
   * @param database - DatabaseService-Instanz
   * @returns Array mit Benutzerübersichtsdaten
   */
  static getUsersOverview = async ({database}: GetUsersOverview) => {
    // Admin-Client verwenden (umgeht RLS während Übergangsphase)
    const users = database.admin?.users ?? database.users;
    return await users.findOverview();
  };

  /* =====================================================================
  // Letztes Login updaten und Anzahl Logins hochzählen
  // ===================================================================== */
  /**
   * Registriert einen erfolgreichen Login (zählt noLogins hoch).
   *
   * @param database - DatabaseService-Instanz
   * @param authUser - Der angemeldete Benutzer
   */
  static async registerSignIn({database, authUser}: RegisterSignIn) {
    // Admin-Client verwenden (umgeht RLS während Übergangsphase)
    const users = database.admin?.users ?? database.users;
    await users.registerSignIn(authUser.uid);
  }
  /* =====================================================================
  // User anhand der Mailadresse holen
  // ===================================================================== */
  /**
   * Sucht die UID eines Benutzers anhand der E-Mail-Adresse.
   *
   * @param database - DatabaseService-Instanz
   * @param email - E-Mail-Adresse zum Suchen
   * @returns UID des gefundenen Users
   * @throws Error wenn kein User mit dieser E-Mail gefunden wird
   */
  static getUidByEmail = async ({database, email}: GetUidByEmail) => {
    // Admin-Client verwenden (umgeht RLS während Übergangsphase)
    const users = database.admin?.users ?? database.users;
    const userUid = await users.findByEmail(email);

    if (!userUid) {
      throw new Error(TEXT_NO_USER_WITH_THIS_EMAIL);
    }
    return userUid;
  };
  /* =====================================================================
  // Profile holen
  // ===================================================================== */
  /**
   * Lädt einen User anhand seiner UID aus der Datenbank.
   *
   * @param database - DatabaseService-Instanz
   * @param uid - UID des gesuchten Users
   * @returns User-Instanz
   * @throws Error wenn der User nicht gefunden wird
   */
  static getUser = async ({database, uid}: GetUser) => {
    // Admin-Client verwenden (umgeht RLS während Übergangsphase)
    const users = database.admin?.users ?? database.users;
    const result = await users.findById(uid);
    if (!result) throw new Error(`User not found: ${uid}`);

    const user = new User();
    user.uid = result.uid;
    user.firstName = result.firstName;
    user.lastName = result.lastName;
    user.email = result.email;
    user.noLogins = result.noLogins;
    user.roles = result.roles;
    return user;
  };
  /* =====================================================================
  // Öffentliches Profil lesen
  // ===================================================================== */
  /**
   * Lädt das öffentliche Profil eines Users.
   *
   * @param database - DatabaseService-Instanz
   * @param uid - UID des gesuchten Users
   * @returns Öffentliches Profil
   */
  static getPublicProfile = async ({database, uid}: GetPublicProfile) => {
    // Admin-Client verwenden (umgeht RLS während Übergangsphase)
    const users = database.admin?.users ?? database.users;
    return await users.findPublicProfile(uid);
  };
  /* =====================================================================
  // Profil und Öffentliches Profil lesen
  // ===================================================================== */
  /**
   * Lädt das vollständige Benutzerprofil (privat + öffentlich).
   *
   * @param database - DatabaseService-Instanz
   * @param uid - UID des gesuchten Users
   * @returns Vollständiges Benutzerprofil als UserFullProfile
   */
  static getFullProfile = async ({database, uid}: GetFullProfile) => {
    // Admin-Client verwenden (umgeht RLS während Übergangsphase)
    const users = database.admin?.users ?? database.users;
    const fullProfile = await users.findFullProfile(uid);

    const userFullProfile = {
      uid: fullProfile.uid,
      firstName: fullProfile.firstName,
      lastName: fullProfile.lastName,
      email: fullProfile.email,
      noLogins: fullProfile.noLogins,
      roles: fullProfile.roles,
      displayName: fullProfile.displayName,
      memberSince: fullProfile.createdAt ?? new Date(0),
      memberId: fullProfile.memberId,
      motto: fullProfile.motto,
      pictureSrc: fullProfile.pictureSrc,
      stats: fullProfile.stats,
    } as UserFullProfile;

    return userFullProfile;
  };
  /* =====================================================================
  // Daten prüfen
  // ===================================================================== */
  /**
   * Prüft ob die Mindestangaben im Benutzerprofil vorhanden sind.
   * Fällt auf firstName zurück, wenn displayName fehlt.
   *
   * @param userProfile - Das zu prüfende Benutzerprofil
   * @throws Error wenn weder displayName noch firstName vorhanden
   */
  static checkUserProfileData(userProfile: UserFullProfile) {
    if (!userProfile.displayName && !userProfile.firstName) {
      throw new Error(TEXT_USER_PROFILE_ERROR_DISPLAYNAME_MISSING);
    }
  }
  /* =====================================================================
  // Profilwerte speichern
  // ===================================================================== */
  // Aber nur diejeinige, die der User auch selbst ändern kann.
  /**
   * Speichert die vom Benutzer änderbaren Profilwerte.
   * Lädt optional ein neues Profilbild hoch und löst Cloud Functions
   * aus, wenn displayName oder Motto geändert wurden.
   *
   * @param firebase - Firebase-Instanz (für Storage/Cloud Functions)
   * @param database - DatabaseService-Instanz
   * @param userProfile - Das zu speichernde Profil
   * @param authUser - Der angemeldete Benutzer
   * @param localPicture - Optionale Bilddatei zum Hochladen
   */
  static saveFullProfile = async ({
    firebase,
    database,
    userProfile,
    localPicture,
    authUser,
  }: SaveFullProfile) => {
    let pictureSrc = userProfile.pictureSrc;

    if (userProfile.displayName === "") {
      userProfile.displayName = userProfile.firstName;
    }

    // Admin-Client verwenden (umgeht RLS während Übergangsphase)
    const usersRead = database.admin?.users ?? database.users;
    // Alte Werte holen um zu vergleichen ob die Cloud Function gestartet werden muss
    const actualPublicProfile = await usersRead.findPublicProfile(
      userProfile.uid
    );

    // Bild hochladen wenn vorhanden
    if (localPicture instanceof File) {
      if (pictureSrc) {
        // Vorhandenes Bild löschen
        try {
          await User.deletePicture({
            firebase: firebase,
            database: database,
            authUser: authUser,
          });
        } catch {
          // Nichts tun - wenn das Bild nicht vorhanden ist, kann es nicht gelöscht werden.
        }
      }

      pictureSrc = await User.uploadPicture({
        database: database,
        file: localPicture,
        authUser: authUser,
      });
    }

    // Admin-Client verwenden (umgeht RLS während Übergangsphase)
    const users = database.admin?.users ?? database.users;
    await users.patch({
      id: userProfile.uid,
      fields: {
        first_name: userProfile.firstName,
        last_name: userProfile.lastName,
        display_name: userProfile.displayName,
        motto: userProfile.motto,
        picture_src: pictureSrc ?? "",
      },
      authUser: authUser,
    });

    // CloudFunction starten wenn displayname oder motto geändert wurde
    if (
      actualPublicProfile &&
      (actualPublicProfile.displayName !== userProfile.displayName ||
        actualPublicProfile.motto !== userProfile.motto)
    ) {
      if (actualPublicProfile.displayName !== userProfile.displayName) {
        firebase.cloudFunction.updateUserDisplayName.triggerCloudFunction({
          values: {
            uid: userProfile.uid,
            newDisplayName: userProfile.displayName,
          },
          authUser: authUser,
        });
      }
      if (actualPublicProfile.motto !== userProfile.motto) {
        firebase.cloudFunction.updateUserMotto.triggerCloudFunction({
          values: {
            uid: userProfile.uid,
            newValue: userProfile.motto,
          },
          authUser: authUser,
        });
      }
      logEvent(firebase.analytics, FirebaseAnalyticEvent.cloudFunctionExecuted);
    }
  };
  /* =====================================================================
  // Profilbild hochladen
  // ===================================================================== */
  /**
   * Lädt ein Profilbild hoch (Client-seitig skaliert, als JPEG in Supabase Storage).
   *
   * @param database - DatabaseService-Instanz (für Supabase Storage)
   * @param file - Die hochzuladende Bilddatei
   * @param authUser - Der angemeldete Benutzer
   * @returns Öffentliche URL des hochgeladenen Bildes
   */
  static uploadPicture = async ({database, file, authUser}: UploadPicture) => {
    // Client-seitiges Resize auf max. 1200px
    const resizedBlob = await resizeImage(file);

    // Admin-Storage verwenden (umgeht RLS während Übergangsphase)
    const storageUsers =
      database.admin?.storage.users ?? database.storage.users;
    const result = await storageUsers.upload(
      `${authUser.uid}.jpg`,
      resizedBlob,
      "image/jpeg"
    );

    return result.publicUrl;
  };
  /* =====================================================================
  // Bild löschen
  // ===================================================================== */
  /**
   * Löscht das Profilbild aus Supabase Storage und leert die DB-Spalte.
   *
   * @param firebase - Firebase-Instanz (für Cloud Function)
   * @param database - DatabaseService-Instanz
   * @param authUser - Der angemeldete Benutzer
   * @throws Error bei Storage- oder DB-Fehler
   */
  static deletePicture = async ({
    firebase,
    database,
    authUser,
  }: DeletePicture) => {
    // Admin-Clients verwenden (umgeht RLS während Übergangsphase)
    const storageUsers =
      database.admin?.storage.users ?? database.storage.users;
    await storageUsers.remove(`${authUser.uid}.jpg`);

    const users = database.admin?.users ?? database.users;
    await users.patch({
      id: authUser.uid,
      fields: {
        picture_src: "",
      },
      authUser: authUser,
    });

    // CloudFunction Triggern — leerer String statt Picture-Objekt
    firebase.cloudFunction.updateUserPictureSrc.triggerCloudFunction({
      values: {
        uid: authUser.uid,
        pictureSrc: "",
      },
      authUser: authUser,
    });
  };
  /* =====================================================================
  // Berechtigungen aktualisieren
  // ===================================================================== */
  /**
   * Aktualisiert die Rollen eines Benutzers.
   *
   * @param database - DatabaseService-Instanz
   * @param userUid - UID des Benutzers
   * @param newRoles - Die neuen Rollen
   * @param authUser - Der angemeldete Admin-Benutzer
   */
  static updateRoles = async ({
    database,
    userUid,
    newRoles,
    authUser,
  }: UpdateRoles) => {
    // Admin-Client verwenden (umgeht RLS während Übergangsphase)
    const users = database.admin?.users ?? database.users;
    await users.patch({
      id: userUid,
      fields: {roles: newRoles},
      authUser: authUser,
    });
  };
  /* =====================================================================
  // no_found_bugs hoch- bzw. runterzählen
  // ===================================================================== */
  /**
   * Zählt no_found_bugs eines Benutzers atomar hoch oder runter.
   * Nutzt den Supabase-RPC increment_found_bugs — der DB-Wert unterschreitet nie 0.
   *
   * @param database - DatabaseService-Instanz
   * @param userUid - UID des Benutzers (Firebase UID / PK in users)
   * @param statsValue - +1 (Increment) oder -1 (Decrement)
   * @throws Error bei Datenbankfehler
   */
  static updateStats = async ({database, userUid, statsValue}: UpdateStats) => {
    const repo = database.admin?.users ?? database.users;
    await repo.incrementFoundBugs(userUid, statsValue);
  };
}
