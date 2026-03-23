import React, {useState, useEffect, useRef} from "react";
import {useNavigate} from "react-router";
import * as Sentry from "@sentry/react";

import AuthUser from "../Firebase/Authentication/authUser.class";
import {useFirebase} from "../Firebase/firebaseContext";
import {useDatabase} from "../Database/DatabaseContext";
import {LocalStorageKey} from "../../constants/localStorage";

import {
  SIGN_IN as ROUTE_SIGN_IN,
  NO_AUTH as ROUTE_NO_AUTH,
} from "../../constants/routes";

/**
 * React-Context für den authentifizierten Benutzer.
 *
 * Wird von `AuthUserProvider` befüllt und über `useAuthUser()` konsumiert.
 * Liefert `null`, wenn kein Benutzer angemeldet ist oder das Profil
 * noch geladen wird.
 */
export const AuthUserContext = React.createContext<AuthUser | null>(null);

/* ===================================================================
// ============================== Hooks ==============================
// =================================================================== */
/**
 * Gibt den aktuellen AuthUser aus dem Context zurück.
 *
 * @returns Den angemeldeten Benutzer oder `null`.
 */
export const useAuthUser = (): AuthUser | null => {
  return React.useContext(AuthUserContext);
};

/* ===================================================================
// ========================= Hilfsfunktionen =========================
// =================================================================== */
/**
 * Prüft, ob der geparste localStorage-Wert ein gültiges AuthUser-Objekt ist.
 *
 * Schützt vor manipulierten oder veralteten Cache-Einträgen, die nach
 * einem `JSON.parse` nicht die erwartete Struktur aufweisen.
 *
 * @param value - Der geparste Wert aus dem localStorage.
 * @returns `true`, wenn der Wert die minimale AuthUser-Struktur aufweist.
 */
const isValidCachedAuthUser = (value: unknown): value is AuthUser => {
  if (typeof value !== "object" || value === null) return false;
  const obj = value as Record<string, unknown>;
  return (
    typeof obj.uid === "string" &&
    typeof obj.email === "string" &&
    typeof obj.publicProfile === "object" &&
    obj.publicProfile !== null
  );
};

/* ===================================================================
// ========================= AuthUserProvider ========================
// =================================================================== */
/**
 * AuthUserProvider — Stellt den authentifizierten Benutzer via Context bereit.
 *
 * Hört primär auf Supabase Auth State-Änderungen. Bei einem Supabase-Login
 * wird das Benutzerprofil via findById geladen. Wenn kein Supabase-User
 * gefunden wird, fällt der Provider auf den Firebase-Listener zurück
 * (für User, die noch nicht migriert wurden).
 */
export const AuthUserProvider: React.FC<{children: React.ReactNode}> = ({
  children,
}) => {
  const firebase = useFirebase();
  const database = useDatabase();
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);

  // Ref hält den aktuellen authUser-Wert, damit Listener-Closures
  // nicht auf veraltete Werte zugreifen (Stale-Closure-Problem).
  const authUserRef = useRef<AuthUser | null>(null);

  /**
   * Setzt authUser im State und im Ref gleichzeitig.
   *
   * @param user - Der neue AuthUser-Wert oder null.
   */
  const updateAuthUser = (user: AuthUser | null) => {
    authUserRef.current = user;
    setAuthUser(user);
  };

  useEffect(() => {
    // Primär: Supabase Auth State-Listener
    const unsubscribeSupabase = database.auth.onAuthStateChange(
      async (event, session) => {
        if (session?.user) {
          // Prüfe zuerst den LocalStorage-Cache — aber nur wenn er zum aktuellen
          // Session-User gehört. Sonst würde ein anderer User (z.B. nach Benutzer-
          // wechsel ohne expliziten Logout) den falschen uid erhalten, was zu
          // RLS-Verletzungen führt (user_id != auth.uid()).
          const cachedString = localStorage.getItem(LocalStorageKey.AUTH_USER);
          if (cachedString) {
            const parsed: unknown = JSON.parse(cachedString);
            if (!isValidCachedAuthUser(parsed)) {
              // Ungültiger Cache-Eintrag → verwerfen
              localStorage.removeItem(LocalStorageKey.AUTH_USER);
            } else if (parsed.uid === session.user.id) {
              // emailVerified aus Supabase Session ableiten
              parsed.emailVerified = !!session.user.email_confirmed_at;

              // Kompatibilitäts-Shim: Im Cache kann pictureSrc noch als altes
              // Picture-Objekt vorliegen (vor der Storage-Migration)
              type LegacyPictureSrc = {normalSize?: string};
              const picSrc: unknown = parsed.publicProfile.pictureSrc;
              if (typeof picSrc !== "string") {
                parsed.publicProfile.pictureSrc =
                  (picSrc as LegacyPictureSrc)?.normalSize ?? "";
              }

              updateAuthUser(parsed);
              return;
            } else {
              // Cache gehört einem anderen User → verwerfen
              localStorage.removeItem(LocalStorageKey.AUTH_USER);
            }
          }

          // Benutzerprofil via User-ID laden
          // Admin-Client verwenden, da RLS den eigenen User erst nach vollständigem
          // Session-Setup erlaubt (Timing-Problem beim Auth-State-Change)
          const usersRepo = database.admin?.users ?? database.users;
          try {
            const userDomain = await usersRepo.findById(
              session.user.id
            );

            if (userDomain) {
              const newAuthUser: AuthUser = {
                uid: session.user.id,
                email: userDomain.email,
                emailVerified: !!session.user.email_confirmed_at,
                firstName: userDomain.firstName,
                lastName: userDomain.lastName,
                roles: userDomain.roles,
                publicProfile: {
                  displayName: userDomain.displayName,
                  motto: userDomain.motto,
                  pictureSrc: userDomain.pictureSrc,
                },
              };

              localStorage.setItem(
                LocalStorageKey.AUTH_USER,
                JSON.stringify(newAuthUser)
              );
              updateAuthUser(newAuthUser);
              return;
            }
          } catch (err) {
            Sentry.captureException(err);
          }

          // Fallback: Benutzer via E-Mail suchen (noch nicht migrierte User)
          try {
            const userId = await usersRepo.findByEmail(
              session.user.email ?? ""
            );
            if (userId) {
              const fullProfile = await usersRepo.findFullProfile(userId);

              const newAuthUser: AuthUser = {
                uid: session.user.id,
                email: fullProfile.email,
                emailVerified: !!session.user.email_confirmed_at,
                firstName: fullProfile.firstName,
                lastName: fullProfile.lastName,
                roles: fullProfile.roles,
                publicProfile: {
                  displayName: fullProfile.displayName,
                  motto: fullProfile.motto,
                  pictureSrc: fullProfile.pictureSrc,
                },
              };

              localStorage.setItem(
                LocalStorageKey.AUTH_USER,
                JSON.stringify(newAuthUser)
              );
              updateAuthUser(newAuthUser);
              return;
            }
          } catch (err) {
            Sentry.captureException(err);
          }
        } else if (event === "SIGNED_OUT") {
          localStorage.removeItem(LocalStorageKey.AUTH_USER);
          updateAuthUser(null);
        }
      }
    );

    // Sekundär: Firebase Auth Listener (Fallback für noch nicht migrierte User)
    const unsubscribeFirebase = firebase.onAuthUserListener(
      (firebaseAuthUser) => {
        // authUserRef statt authUser verwenden, um Stale-Closure zu vermeiden.
        // Nur setzen, falls Supabase keinen User geliefert hat.
        if (!authUserRef.current && firebaseAuthUser) {
          updateAuthUser(firebaseAuthUser);
        } else if (!firebaseAuthUser && !authUserRef.current) {
          updateAuthUser(null);
        }
      },
      database
    );

    return () => {
      unsubscribeSupabase();
      unsubscribeFirebase();
    };
  }, []);

  return (
    <AuthUserContext.Provider value={authUser}>
      {children}
    </AuthUserContext.Provider>
  );
};

/* ===================================================================
// ======================= AuthorizationGuard ========================
// =================================================================== */
/**
 * Schützt Routen basierend auf dem Authentifizierungsstatus und Berechtigungen.
 *
 * Reagiert auf den `authUser`-Context statt einen eigenen Auth-Listener
 * zu registrieren. Bei `authUser === null` wird einmalig geprüft, ob
 * eine aktive Session existiert (Lade-Phase vs. tatsächlich abgemeldet).
 *
 * @param condition - Funktion, die prüft, ob der Benutzer Zugriff hat.
 * @param children - Die geschützten Kind-Komponenten.
 */
interface AuthorizationGuardProps {
  condition: (authUser: AuthUser | null) => boolean;
  children: React.ReactNode;
}
export const AuthorizationGuard: React.FC<AuthorizationGuardProps> = ({
  condition,
  children,
}) => {
  const authUser = useAuthUser();
  const database = useDatabase();
  const navigate = useNavigate();

  useEffect(() => {
    if (authUser === null) {
      // authUser null = entweder noch am Laden oder abgemeldet.
      // Einmalige Session-Prüfung, um die beiden Fälle zu unterscheiden.
      database.auth.getSession().then((session) => {
        if (!session) {
          navigate(ROUTE_SIGN_IN);
        }
        // Wenn Session vorhanden, warten bis AuthUserProvider den authUser setzt.
      });
    } else if (!condition(authUser)) {
      navigate(ROUTE_NO_AUTH);
    }
  }, [authUser, condition, navigate]);

  // Während authUser null ist (Laden), nichts rendern; bei fehlender Berechtigung ebenfalls.
  return condition(authUser) ? <>{children}</> : null;
};
