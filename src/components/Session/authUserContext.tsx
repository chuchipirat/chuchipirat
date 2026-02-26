import React, {useState, useEffect, useRef} from "react";
import {useNavigate} from "react-router";

import AuthUser from "../Firebase/Authentication/authUser.class";
import {useFirebase} from "../Firebase/firebaseContext";
import {useDatabase} from "../Database/DatabaseContext";
import LocalStorageKey from "../../constants/localStorage";

import {
  SIGN_IN as ROUTE_SIGN_IN,
  NO_AUTH as ROUTE_NO_AUTH,
} from "../../constants/routes";

export const AuthUserContext = React.createContext<AuthUser | null>(null);

/* ===================================================================
// ============================== Hooks ==============================
// =================================================================== */
export const useAuthUser = (): AuthUser | null => {
  return React.useContext(AuthUserContext);
};

/* ===================================================================
// ========================= AuthUserProvider ========================
// =================================================================== */
/**
 * AuthUserProvider — Stellt den authentifizierten Benutzer via Context bereit.
 *
 * Hört primär auf Supabase Auth State-Änderungen. Bei einem Supabase-Login
 * wird das Benutzerprofil via findByAuthUid geladen. Wenn kein Supabase-User
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

  /** Setzt authUser im State und im Ref gleichzeitig. */
  const updateAuthUser = (user: AuthUser | null) => {
    authUserRef.current = user;
    setAuthUser(user);
  };

  useEffect(() => {
    // Primär: Supabase Auth State-Listener
    const unsubscribeSupabase = database.auth.onAuthStateChange(
      async (event, session) => {
        if (session?.user) {
          // Prüfe zuerst den LocalStorage-Cache
          const cachedString = localStorage.getItem(LocalStorageKey.AUTH_USER);
          if (cachedString) {
            const cached = JSON.parse(cachedString) as AuthUser;
            // emailVerified aus Supabase Session ableiten
            cached.emailVerified = !!session.user.email_confirmed_at;

            // Kompatibilitäts-Shim: Im Cache kann pictureSrc noch als altes
            // Picture-Objekt vorliegen (vor der Storage-Migration)
            const picSrc = cached.publicProfile.pictureSrc;
            if (typeof picSrc !== "string") {
              cached.publicProfile.pictureSrc =
                (picSrc as any)?.normalSize ?? "";
            }

            updateAuthUser(cached);
            return;
          }

          // Benutzerprofil via auth_uid laden
          // Admin-Client verwenden, da RLS den eigenen User erst nach vollständigem
          // Session-Setup erlaubt (Timing-Problem beim Auth-State-Change)
          const usersRepo = database.admin?.users ?? database.users;
          try {
            const userDomain = await usersRepo.findByAuthUid(
              session.user.id
            );

            if (userDomain) {
              const newAuthUser: AuthUser = {
                uid: userDomain.uid,
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
            console.error("Fehler beim Laden des Benutzerprofils:", err);
          }

          // Fallback: Benutzer via E-Mail suchen (noch nicht migrierte User)
          try {
            const userId = await usersRepo.findByEmail(
              session.user.email ?? ""
            );
            if (userId) {
              const fullProfile = await usersRepo.findFullProfile(userId);

              const newAuthUser: AuthUser = {
                uid: fullProfile.uid,
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
            console.error("Fehler beim E-Mail-Fallback:", err);
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
 * Hört auf Supabase Auth State-Änderungen und leitet bei fehlender
 * Authentifizierung oder fehlenden Berechtigungen um.
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
    const unsubscribe = database.auth.onAuthStateChange(
      async (_event, session) => {
        if (!session) {
          navigate(ROUTE_SIGN_IN);
        } else if (authUser && !condition(authUser)) {
          // Nur umleiten, wenn authUser geladen ist aber die Bedingung nicht erfüllt.
          // Wenn authUser noch null ist (Profil wird geladen), abwarten.
          navigate(ROUTE_NO_AUTH);
        }
      }
    );

    return () => {
      unsubscribe();
    };
  }, [authUser, navigate]);

  // Während authUser null ist (Laden), nichts rendern; bei fehlender Berechtigung ebenfalls.
  return condition(authUser) ? <>{children}</> : null;
};
