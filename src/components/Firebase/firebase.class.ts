import FirebaseAnalyticEvent from "../../constants/firebaseEvent";

import FirebaseDbEvent from "./Db/firebase.db.event.class";

import FirebaseDbMasterData from "./Db/firebase.db.masterData.class";
import FirebaseDbRecipePublic from "./Db/firebase.db.recipe.public.class";
import FirebaseDbRecipePrivate from "./Db/firebase.db.recipe.private.class";
import FirebaseDbRecipeVariant from "./Db/firebase.db.recipe.variant.class";
import FirebaseDbRecipeShortPublic from "./Db/firebase.db.recipeShort.public.class";
import FirebaseDbRecipeShortPrivate from "./Db/firebase.db.recipeShort.private.class";
import FirebaseDbRecipeShortVariant from "./Db/firebase.db.recipeShort.variant.class";
import FirebaseStorage from "./Storage/firebase.storage.class";
import {FirebaseDbRequest} from "./Db/firebase.db.request.class";

import FirebaseDbStats from "./Db/firebase.db.stats.class";
import FirebaseDbUser from "./Db/firebase.db.user.class";
import FirebaseDbCloudFunction from "./Db/firebase.db.cloudfunction.class";
import FirebaseDbMailbox from "./Db/firebase.db.mailbox.class";
import FirebaseDbConfiguration from "./Db/firebase.db.configuration.class";

import {initializeApp} from "firebase/app";
import {Firestore, getFirestore} from "firebase/firestore";
import {Analytics, getAnalytics, logEvent} from "firebase/analytics";
import {FirebaseStorage as Storage, getStorage} from "firebase/storage";
import {FirebasePerformance, getPerformance} from "firebase/performance";

import {
  Auth,
  getAuth,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  signInWithEmailAndPassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
  signOut,
  updateEmail,
  sendPasswordResetEmail,
  updatePassword,
  confirmPasswordReset,
  verifyPasswordResetCode,
  applyActionCode,
  checkActionCode,
} from "firebase/auth";

import {Functions, getFunctions, httpsCallable} from "firebase/functions";

import FirebaseDbEventShort from "./Db/firebase.db.eventShort.class";
import LocalStorageKey from "../../constants/localStorage";
import AuthUser from "./Authentication/authUser.class";
import User from "../User/user.class";
import {DatabaseService} from "../Database/DatabaseService";

interface SignInWithEmailAndPassword {
  email: string;
  password: string;
}
interface CreateUserWithEmailAndPassword {
  email: string;
  password: string;
}
interface ConfirmPasswordReset {
  resetCode: string;
  password: string;
}
interface PasswordUpdate {
  password: string;
}
interface ReauthenticateWithCredential {
  email: string;
  password: string;
}
/* ===================================================================
// ======================== globale Funktionen =======================
// =================================================================== */
const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

export default class Firebase {
  auth: Auth;
  firestore: Firestore;
  analytics: Analytics;
  performance: FirebasePerformance;
  storage: Storage;
  functions: Functions;

  recipePublic: FirebaseDbRecipePublic;
  recipePrivate: FirebaseDbRecipePrivate;
  recipeVariant: FirebaseDbRecipeVariant;
  recipeShortPublic: FirebaseDbRecipeShortPublic;
  recipeShortPrivate: FirebaseDbRecipeShortPrivate;
  recipeShortVariant: FirebaseDbRecipeShortVariant;
  request: FirebaseDbRequest;
  event: FirebaseDbEvent;
  eventShort: FirebaseDbEventShort;
  user: FirebaseDbUser;
  stats: FirebaseDbStats;
  masterdata: FirebaseDbMasterData;
  configuration: FirebaseDbConfiguration;
  cloudFunction: FirebaseDbCloudFunction;
  mailbox: FirebaseDbMailbox;
  fileStore: FirebaseStorage;

  /* =====================================================================
  // Konstruktor
  // ===================================================================== */
  constructor() {
    const firebaseApp = initializeApp(config);

    this.auth = getAuth(firebaseApp);
    this.firestore = getFirestore(firebaseApp);
    this.analytics = getAnalytics(firebaseApp);
    this.performance = getPerformance(firebaseApp);
    this.storage = getStorage(firebaseApp);
    this.functions = getFunctions(firebaseApp, "europe-west6");

    this.recipePublic = new FirebaseDbRecipePublic(this);
    this.recipePrivate = new FirebaseDbRecipePrivate(this);
    this.recipeVariant = new FirebaseDbRecipeVariant(this);
    this.recipeShortPublic = new FirebaseDbRecipeShortPublic(this);
    this.recipeShortPrivate = new FirebaseDbRecipeShortPrivate(this);
    this.recipeShortVariant = new FirebaseDbRecipeShortVariant(this);
    this.request = new FirebaseDbRequest(this);

    this.event = new FirebaseDbEvent(this);
    this.eventShort = new FirebaseDbEventShort(this);
    this.user = new FirebaseDbUser(this);

    this.stats = new FirebaseDbStats(this);
    this.masterdata = new FirebaseDbMasterData(this);

    // this.cloudFunctionRecipeTrace =
    //   new FirebaseDbCloudfunctionWaitingareaRecipetrace(this);
    this.configuration = new FirebaseDbConfiguration(this);
    this.cloudFunction = new FirebaseDbCloudFunction(this);
    this.mailbox = new FirebaseDbMailbox(this);
    this.fileStore = new FirebaseStorage(this);
  }

  /* =====================================================================
  // Listener, falls sich mit dem User was ändern
  // ===================================================================== */
  /**
   * onAuthUserListener: User Attribute holen.
   * @param callback Methode, die ausgeführt wird, wenn sich die Werte auf
   * der DB ändern sollten.
   */
  onAuthUserListener = (
    callback: (authUser: AuthUser | null) => void,
    database?: DatabaseService,
  ) => {
    let authUser: AuthUser;
    // let dbUser: app.firestore.DocumentData | undefined;
    return this.auth.onAuthStateChanged(async (user) => {
      if (user) {
        // Prüfen ob Infos zu User bereits im Session Storage gespeichert wurden
        const localStorageAuthUserString = localStorage.getItem(
          LocalStorageKey.AUTH_USER,
        );

        if (!localStorageAuthUserString) {
          await User.getFullProfile({
            firebase: this,
            database: database!,
            uid: user.uid,
          }).then((result) => {
            console.warn("user-Full-Profile read");
            authUser = {
              uid: user.uid,
              email: result.email,
              emailVerified: user.emailVerified,
              firstName: result.firstName,
              lastName: result.lastName,
              roles: result.roles,
              publicProfile: {
                displayName: result.displayName,
                motto: result.motto,
                pictureSrc: result.pictureSrc,
              },
            };

            localStorage.setItem(
              LocalStorageKey.AUTH_USER,
              JSON.stringify(authUser),
            );
            callback(authUser);
          });
        } else {
          // Prüfen ob sich was geändert hat
          const localStorageUser = JSON.parse(
            localStorageAuthUserString,
          ) as AuthUser;
          if (user.emailVerified !== localStorageUser.emailVerified) {
            localStorageUser.emailVerified = user.emailVerified;
            localStorage.setItem(
              LocalStorageKey.AUTH_USER,
              JSON.stringify(localStorageUser),
            );
          }

          callback(localStorageUser);
        }
      } else {
        callback(null);
      }
    });
  };
  /* =====================================================================
  // Neuer User anlegen mit Mail/Passwort
  // ===================================================================== */
  /**
   * Neuer User auf der App anlegen
   * @param email E-Mailadresse des User
   * @param password Password des User
   * @deprecated Wird durch AuthService.signUp() ersetzt (Phase 2).
   */
  createUserWithEmailAndPassword = ({
    email,
    password,
  }: CreateUserWithEmailAndPassword) => {
    const auth = getAuth();
    return createUserWithEmailAndPassword(auth, email, password)
      .then((userCredential) => {
        return userCredential;
      })
      .catch((error) => {
        console.error(error);
        throw error;
      });
  };
  /* =====================================================================
  // Email Verifizierung versenden 
  // ===================================================================== */
  /**
   * Verifizierung des Users per E-Mail: löst eine E-Mail aus, mit dem
   * Link um die Verifizierung durchzuführen
   * @deprecated Supabase Auth übernimmt E-Mail-Verifizierung automatisch (Phase 2).
   */
  sendEmailVerification = () => {
    const auth = getAuth();
    return sendEmailVerification(auth.currentUser!, {
      url: import.meta.env.VITE_CONFIRMATION_EMAIL_REDIRECT!,
    }).catch((error) => {
      console.error(error);
      throw error;
    });
  };
  /* =====================================================================
   * Anmeldung mit Email und Password durchühren
  // ===================================================================== */
  /**
   * Sign-In in der App
   * @param email E-Mailadresse des User
   * @param password Password des User
   * @deprecated Wird durch AuthService.signInWithPassword() ersetzt (Phase 2).
   * Bleibt als Fallback für noch nicht migrierte User aktiv.
   */
  signInWithEmailAndPassword = ({
    email,
    password,
  }: SignInWithEmailAndPassword) => {
    const auth = getAuth();
    return signInWithEmailAndPassword(auth, email, password)
      .then((userCredential) => {
        return userCredential;
      })
      .catch((error) => {
        console.error(error);
        throw error;
      });
  };
  /* =====================================================================
   * Erneut anmelden
  // ===================================================================== */
  /**
   * Erneut anmelden. Einige Aktionen (bspw. Passwordwechsel) benötigen
   * eine Re-Authentifizierung
   * @param email E-Mailadresse des User
   * @param password Password des User
   * @deprecated Wird in Phase 3 entfernt, wenn Firebase Auth komplett abgeschaltet wird.
   */
  reauthenticateWithCredential = ({
    email,
    password,
  }: ReauthenticateWithCredential) => {
    const auth = getAuth();
    const credential = EmailAuthProvider.credential(email, password);

    return reauthenticateWithCredential(auth.currentUser!, credential).catch(
      (error) => {
        console.error(error);
        throw error;
      },
    );
  };
  /* =====================================================================
   * Abmelden
  // ===================================================================== */
  /**
   * Den aktuellen User abmelden
   * @deprecated Wird durch AuthService.signOut() ersetzt (Phase 2).
   */
  signOut = async () => {
    const auth = getAuth();
    try {
      return await signOut(auth);
    } catch (error) {
      console.error(error);
      throw error;
    }
  };
  /* =====================================================================
  // Firebase Auth Account deaktivieren
  // ===================================================================== */
  /**
   * Deaktiviert den Firebase Auth Account des aktuell angemeldeten Users.
   * Wird nach erfolgreicher Migration zu Supabase aufgerufen, damit sich
   * der User nicht mehr über Firebase einloggen kann.
   *
   * @returns Promise<void>
   * @throws Fehler, wenn der Cloud-Function-Aufruf fehlschlägt.
   */
  disableAuthAccount = async (): Promise<void> => {
    const callable = httpsCallable(this.functions, "disableFirebaseAuth");
    await callable();
  };
  /* =====================================================================
   * E-Mailadresse ändern
  // ===================================================================== */
  /**
   * Die aktuelle E-Mailadresse ändern
   * @param email - Neue Adresse
   * @deprecated Wird in Phase 3 durch Supabase Auth E-Mail-Änderung ersetzt.
   */
  emailChange = (email: string) => {
    const auth = getAuth();
    return updateEmail(auth.currentUser!, email).catch((error) => {
      console.error(error);
      throw error;
    });
  };
  /* =====================================================================
   * Password zurücksetzen
  // ===================================================================== */
  /**
   * Das aktuelle Passwort zurücksetzen -> Passwort vergessen
   * @param email - Adresse
   * @deprecated Wird durch AuthService.resetPassword() ersetzt (Phase 2).
   */
  passwordReset = (email: string) => {
    const auth = getAuth();
    return sendPasswordResetEmail(auth, email).catch((error) => {
      console.error(error);
      throw error;
    });
  };
  /* =====================================================================
   * Password ändern
  // ===================================================================== */
  /**
   * Das aktuelle Passwort ändern. Der User muss angemeldet und allenfalls
   * reauthentifiziert sein.
   * @param password - Neues Password
   * @deprecated Wird durch AuthService.updatePassword() ersetzt (Phase 2).
   */
  passwordUpdate = ({password}: PasswordUpdate) => {
    const auth = getAuth();
    const analytics = getAnalytics();

    logEvent(analytics, FirebaseAnalyticEvent.userChangedPassword);

    return updatePassword(auth.currentUser!, password).catch((error) => {
      console.error(error);
      throw error;
    });
  };
  /* =====================================================================
   * Password anhand des Reset-Codes zurücksetzen
  // ===================================================================== */
  /**
   * Das aktuelle Passwort ändern. Der User muss angemeldet und allenfalls
   * reauthentifiziert sein.
   * @param resetCode - Code aus der E-Mail
   * @param password - Password
   * @deprecated Wird durch AuthService.updatePassword() ersetzt (Phase 2).
   */
  confirmPasswordReset = ({resetCode, password}: ConfirmPasswordReset) => {
    const auth = getAuth();
    const analytics = getAnalytics();

    logEvent(analytics, FirebaseAnalyticEvent.userResetetPassword);

    return confirmPasswordReset(auth, resetCode, password).catch((error) => {
      console.error(error);
      throw error;
    });
  };
  /* =====================================================================
   * E-Mail anhand Reset Code bestimmen
  // ===================================================================== */
  /**
   * Mailadresse abfragen anhand Obj.Code (Passwort zurücksetzen)
   * @param resetCode - Code aus der E-Mail
   * @deprecated Wird in Phase 3 entfernt. Supabase Auth handhabt Token-Verifizierung automatisch.
   */
  getEmailFromVerifyCode = (resetCode: string) => {
    const auth = getAuth();
    return verifyPasswordResetCode(auth, resetCode)
      .then((email) => {
        return email;
      })
      .catch((error) => {
        console.error(error);
        throw error;
      });
  };
  /* =====================================================================
  // Objektcode Verifizieren
  // ===================================================================== */
  /**
   * Code überprüfen
   * @param objectCode - Code aus der E-Mail
   */
  applyActionCode = (objectCode) => {
    const auth = getAuth();
    return applyActionCode(auth, objectCode).catch((error) => {
      console.error(error);
      throw error;
    });
  };
  /**
   * Code prüfen
   * @param objectCode - Code aus der E-Mail
   */
  checkActionCode = (objectCode) => {
    const auth = getAuth();
    return checkActionCode(auth, objectCode)
      .then((info) => {
        return info;
      })
      .catch((error) => {
        console.error(error);
        throw error;
      });
  };
}
