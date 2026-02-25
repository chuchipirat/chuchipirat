import {Role} from "../../constants/roles";

import Firebase from "../Firebase/firebase.class";
import {Timestamp, increment} from "firebase/firestore";
import {logEvent} from "firebase/analytics";

import {
  USER_NOT_IDENTIFIED_BY_EMAIL as TEXT_USER_NOT_IDENTIFIED_BY_EMAIL,
  USER_PROFILE_ERROR_DISPLAYNAME_MISSING as TEXT_USER_PROFILE_ERROR_DISPLAYNAME_MISSING,
  NO_USER_WITH_THIS_EMAIL as TEXT_NO_USER_WITH_THIS_EMAIL,
} from "../../constants/text";
import FirebaseAnalyticEvent from "../../constants/firebaseEvent";
import {AuthUser} from "../Firebase/Authentication/authUser.class";
import UserPublicProfile from "./user.public.profile.class";
import UserPublicSearchFields from "./user.public.searchFields.class";
import {Operator, SortOrder} from "../Firebase/Db/firebase.db.super.class";

import {Picture} from "../Shared/global.interface";
import {
  IMAGES_SUFFIX,
  ImageSize,
} from "../Firebase/Storage/firebase.storage.super.class";
import DatabaseService from "../Database/DatabaseService";

/**
 * User Aufbau (kurz)
 * zu verwnden für Useranzeige im Kontext (Kommentar, Koch, usw)
 * @param userUid - UID des Users
 * @param displayName - Anzeigename des Users
 * @param picutreSrc - Bild-URL des Profilbildes
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
  firstName: User["firstName"];
  lastName: User["lastName"];
  displayName: UserPublicProfile["displayName"];
  email: User["email"];
  memberId: UserPublicProfile["memberId"];
  memberSince: Date;
  uid?: User["uid"];
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
  /** UID des neuen Users (von Firebase Auth) */
  uid: string;
  /** Vorname */
  firstName: string;
  /** Nachname */
  lastName: string;
  /** E-Mail-Adresse */
  email: string;
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
  /** Firebase-Instanz (noch benötigt für Analytics während Übergangsphase) */
  firebase: Firebase;
  /** DatabaseService-Instanz für Supabase-Zugriff */
  database: DatabaseService;
  /** Der angemeldete Benutzer */
  authUser: AuthUser;
}

/** Parameter für {@link User.getUidByEmail} */
interface GetUidByEmail {
  /** Firebase-Instanz (noch benötigt während Übergangsphase) */
  firebase: Firebase;
  /** DatabaseService-Instanz für Supabase-Zugriff */
  database: DatabaseService;
  /** E-Mail-Adresse zum Suchen */
  email: string;
}

/** Parameter für {@link User.getUser} */
interface GetUser {
  /** Firebase-Instanz (noch benötigt während Übergangsphase) */
  firebase: Firebase;
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
  /** Firebase-Instanz (noch benötigt während Übergangsphase) */
  firebase: Firebase;
  /** DatabaseService-Instanz für Supabase-Zugriff */
  database: DatabaseService;
}

/** Parameter für {@link User.getPublicProfile} */
interface GetPublicProfile {
  /** Firebase-Instanz (noch benötigt während Übergangsphase) */
  firebase: Firebase;
  /** DatabaseService-Instanz für Supabase-Zugriff */
  database: DatabaseService;
  /** UID des gesuchten Users */
  uid: string;
}

/** Parameter für {@link User.getFullProfile} */
interface GetFullProfile {
  /** Firebase-Instanz (noch benötigt während Übergangsphase) */
  firebase: Firebase;
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
  /** Firebase-Instanz (für Storage — Storage-Migration erfolgt in späterer Phase) */
  firebase: Firebase;
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

/** Parameter für {@link User.updateEmail} */
interface UpdateEmail {
  /** Firebase-Instanz (für Analytics) */
  firebase: Firebase;
  /** DatabaseService-Instanz für Supabase-Zugriff */
  database: DatabaseService;
  /** Die neue E-Mail-Adresse */
  newEmail: string;
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
  /** Firebase-Instanz (Stats werden vorerst noch über Firebase verwaltet) */
  firebase: Firebase;
  /** UID des Benutzers */
  userUid: User["uid"];
  /** Name des Statistik-Feldes (z.B. "noComments", "noEvents") */
  statsField: string;
  /** Wert um den das Feld geändert wird (positiv oder negativ) */
  statsValue: number;
}

export default class User {
  uid: string;
  firstName: string;
  lastName: string;
  email: string;
  lastLogin: Date;
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
    this.lastLogin = new Date();
    this.noLogins = 0;
    this.roles = [];
  }
  /* =====================================================================
    // Objekt erzeugen
    // ===================================================================== */
  static factory({uid, firstName, lastName, email, lastLogin, noLogins}: User) {
    const user = new User();

    user.uid = uid;
    user.firstName = firstName;
    user.lastName = lastName;
    user.email = email;
    user.lastLogin = lastLogin;
    user.noLogins = noLogins;
    return user;
  }

  /* =====================================================================
  // Alle User holen
  // ===================================================================== */
  /* istanbul ignore next */
  /* DB-Methode wird zur Zeit nicht geprüft */
  static async getAllUsers({firebase}: GetAllUsers) {
    let userList: User[] = [];

    await firebase.user
      .readCollection<User>({
        uids: [""],
        orderBy: {field: "firstName", sortOrder: SortOrder.desc},
        ignoreCache: true,
      })
      .then((result) => {
        userList = result;
      })
      .catch((error) => {
        console.error(error);
        throw error;
      });

    return userList;
  }
  /* =====================================================================
  // Neuer User anlegen
  // ===================================================================== */
  /* istanbul ignore next */
  /* DB-Methode wird zur Zeit nicht geprüft */
  static async createUser({
    database,
    uid,
    firstName,
    lastName,
    email,
  }: CreateUser) {
    await database.users
      .upsert({
        id: uid,
        value: {
          uid: uid,
          firstName: firstName,
          lastName: lastName,
          email: email.toLocaleLowerCase(),
          noLogins: 0,
          roles: [Role.basic],
          lastLogin: new Date(),
          displayName: email,
          memberSince: new Date(),
          memberId: 0,
          motto: "",
          pictureSrc: {smallSize: "", normalSize: "", fullSize: ""},
        },
        authUser: {} as AuthUser,
      })
      .catch((error) => {
        console.error(error);
        throw error;
      });
  }
  /* =====================================================================
  // Öffentliches Profil anlegen
  // ===================================================================== */
  // With Supabase, public profile data is part of the users table,
  // so this is handled by createUser(). Keep for Firebase cloud function
  // trigger during transition.
  static async createUserPublicData({firebase, email}: CreateUserPublicData) {
    const anonymousUser = new AuthUser();
    anonymousUser.email = email;
    anonymousUser.publicProfile.displayName = email;

    await firebase.cloudFunction.createUserPublicData
      .triggerCloudFunction({values: {email: email}, authUser: anonymousUser})
      .then(() => {
        logEvent(firebase.analytics, FirebaseAnalyticEvent.userCreated);
      })
      .catch((error) => {
        console.error(error);
        throw error;
      });
  }
  /* =====================================================================
  // Übersicht aller User holen
  // ===================================================================== */
  static getUsersOverview = async ({database}: GetUsersOverview) => {
    return await database.users.findOverview();
  };

  /* =====================================================================
  // Letztes Login updaten und Anzahl Logins hochzählen
  // ===================================================================== */
  /* istanbul ignore next */
  /* DB-Methode wird zur Zeit nicht geprüft */
  static registerSignIn({database, authUser}: RegisterSignIn) {
    database.users.registerSignIn(authUser.uid);
  }
  /* =====================================================================
  // User anhand der Mailadresse holen
  // ===================================================================== */
  /* istanbul ignore next */
  /* DB-Methode wird zur Zeit nicht geprüft */
  static getUidByEmail = async ({database, email}: GetUidByEmail) => {
    const userUid = await database.users.findByEmail(email);

    if (!userUid) {
      throw new Error(TEXT_NO_USER_WITH_THIS_EMAIL);
    }
    return userUid;
  };
  /* =====================================================================
  // Profile holen
  // ===================================================================== */
  /* istanbul ignore next */
  /* DB-Methode wird zur Zeit nicht geprüft */
  static getUser = async ({database, uid}: GetUser) => {
    const result = await database.users.findById(uid);
    if (!result) throw new Error(`User not found: ${uid}`);

    const user = new User();
    user.uid = result.uid;
    user.firstName = result.firstName;
    user.lastName = result.lastName;
    user.email = result.email;
    user.lastLogin = result.lastLogin;
    user.noLogins = result.noLogins;
    user.roles = result.roles;
    return user;
  };
  /* =====================================================================
  // Öffentliches Profil lesen
  // ===================================================================== */
  /* istanbul ignore next */
  /* DB-Methode wird zur Zeit nicht geprüft */
  static getPublicProfile = async ({database, uid}: GetPublicProfile) => {
    return await database.users.findPublicProfile(uid);
  };
  /* =====================================================================
  // Profil und Öffentliches Profil lesen
  // ===================================================================== */
  /* istanbul ignore next */
  /* DB-Methode wird zur Zeit nicht geprüft */
  static getFullProfile = async ({database, uid}: GetFullProfile) => {
    const fullProfile = await database.users.findFullProfile(uid);

    // Map to UserFullProfile shape for compatibility
    const userFullProfile = {
      uid: fullProfile.uid,
      firstName: fullProfile.firstName,
      lastName: fullProfile.lastName,
      email: fullProfile.email,
      lastLogin: fullProfile.lastLogin,
      noLogins: fullProfile.noLogins,
      roles: fullProfile.roles,
      displayName: fullProfile.displayName,
      memberSince: fullProfile.memberSince,
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
  static checkUserProfileData(userProfile: UserFullProfile) {
    if (!userProfile.displayName && !userProfile.firstName) {
      throw new Error(TEXT_USER_PROFILE_ERROR_DISPLAYNAME_MISSING);
    }
  }
  /* =====================================================================
  // Profilwerte speichern
  // ===================================================================== */
  // Aber nur diejeinige, die der User auch selbst ändern kann.
  /* istanbul ignore next */
  /* DB-Methode wird zur Zeit nicht geprüft */
  static saveFullProfile = async ({
    firebase,
    database,
    userProfile,
    localPicture,
    authUser,
  }: SaveFullProfile) => {
    let pictureSrc = userProfile.pictureSrc;

    if (userProfile.displayName == "") {
      userProfile.displayName = userProfile.firstName;
    }

    // Alte werte holen um zu vergleichen ob die Cloud Function gestartet werden muss
    const actualPublicProfile = await database.users.findPublicProfile(
      userProfile.uid
    );

    // Bild hochladen wenn vorhanden
    if (localPicture instanceof File) {
      if (userProfile.pictureSrc) {
        // Vorhandenes Bild löschen
        await User.deletePicture({
          firebase: firebase,
          database: database,
          authUser: authUser,
        }).catch(() => {
          // Nichts tun - wenn das Bild nicht vorhanden ist, kann es nicht gelöscht werden.
          return;
        });
      }

      await User.uploadPicture({
        firebase: firebase,
        file: localPicture,
        authUser: authUser,
      }).then((result) => {
        pictureSrc = result;
      });
    }

    // Update all user fields in a single patch
    await database.users.patch({
      id: userProfile.uid,
      fields: {
        first_name: userProfile.firstName,
        last_name: userProfile.lastName,
        display_name: userProfile.displayName,
        motto: userProfile.motto,
        picture_src_small: pictureSrc?.smallSize ?? "",
        picture_src_normal: pictureSrc?.normalSize ?? "",
        picture_src_full: pictureSrc?.fullSize ?? "",
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
  /* istanbul ignore next */
  /* DB-Methode wird zur Zeit nicht geprüft */
  static uploadPicture = async ({firebase, file, authUser}: UploadPicture) => {
    const pictureSrc: Picture = {normalSize: "", smallSize: "", fullSize: ""};

    await firebase.fileStore.users
      .uploadFile({file: file, filename: authUser.uid})
      .then(async () => {
        // Redimensionierte Varianten holen
        await firebase.fileStore.users
          .getPictureVariants({
            uid: authUser.uid,
            sizes: [ImageSize.size_600, ImageSize.size_50],
          })
          .then((result) => {
            result.forEach((size) => {
              if (size.size === ImageSize.size_50) {
                pictureSrc.smallSize = size.downloadURL;
              } else if (size.size === ImageSize.size_600) {
                pictureSrc.normalSize = size.downloadURL;
              }
            });
          });
      });

    return pictureSrc;
  };
  /* =====================================================================
  // Bild löschen
  // ===================================================================== */
  /* istanbul ignore next */
  /* DB-Methode wird zur Zeit nicht geprüft */
  static deletePicture = async ({firebase, database, authUser}: DeletePicture) => {
    await firebase.fileStore.users
      .deleteFile(`${authUser.uid}${IMAGES_SUFFIX.size50.suffix}`)
      .then(async () => {
        firebase.fileStore.users
          .deleteFile(`${authUser.uid}${IMAGES_SUFFIX.size600.suffix}`)
          .catch((error) => {
            console.error(error);
            throw error;
          });
      })
      .catch((error) => {
        console.error(error);
        throw error;
      });

    // Update picture in unified users table
    await database.users.patch({
      id: authUser.uid,
      fields: {
        picture_src_small: "",
        picture_src_normal: "",
        picture_src_full: "",
      },
      authUser: authUser,
    });

    // CloudFunction Triggern
    firebase.cloudFunction.updateUserPictureSrc.triggerCloudFunction({
      values: {
        uid: authUser.uid,
        pictureSrc: {smallSize: "", normalSize: "", fullSize: ""} as Picture,
      },
      authUser: authUser,
    });
  };
  /* =====================================================================
  // E-Mailadresse updaten
  // ===================================================================== */
  /* istanbul ignore next */
  /* DB-Methode wird zur Zeit nicht geprüft */
  static updateEmail = async ({firebase, database, newEmail, authUser}: UpdateEmail) => {
    // In Supabase, email is in the unified users table
    await database.users.patch({
      id: authUser.uid,
      fields: {email: newEmail},
      authUser: authUser,
    });

    logEvent(firebase.analytics, FirebaseAnalyticEvent.userChangedEmail);
  };
  /* =====================================================================
  // Berechtigungen aktualisieren
  // ===================================================================== */
  static updateRoles = async ({
    database,
    userUid,
    newRoles,
    authUser,
  }: UpdateRoles) => {
    await database.users.patch({
      id: userUid,
      fields: {roles: newRoles},
      authUser: authUser,
    });
  };
  /* =====================================================================
  // Statistikfeld hoch- bzw. runterzählen
  // ===================================================================== */
  // Stats are deferred — will be computed from data tables via views.
  // Keep this method for compatibility during transition.
  static updateStats = async ({
    firebase,
    userUid,
    statsField,
    statsValue,
  }: UpdateStats) => {
    firebase.user.public.profile
      .incrementField({
        uids: [userUid],
        field: `stats.${statsField}`,
        value: statsValue,
      })
      .catch((error) => {
        console.error(error);
        throw error;
      });
  };
}
