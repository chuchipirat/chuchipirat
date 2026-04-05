import React, {useState, useEffect, useRef} from "react";
import {useNavigate} from "react-router";
import * as Sentry from "@sentry/react";

import AuthUser from "../Firebase/Authentication/authUser.class";
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
 * Hört auf Supabase Auth State-Änderungen. Bei einem Login wird das
 * Benutzerprofil via `get_own_profile()` RPC geladen (SECURITY DEFINER,
 * umgeht das RLS-Timing-Problem beim Auth-State-Change).
 */
export const AuthUserProvider: React.FC<{children: React.ReactNode}> = ({
  children,
}) => {
  const database = useDatabase();

  // Initialer Wert aus dem localStorage-Cache, damit nach einem Hard-Refresh
  // sofort der richtige Benutzer angezeigt wird (kein Flash von "Anmelden").
  // Der Cache wird später durch den onAuthStateChange-Listener verifiziert.
  const [authUser, setAuthUser] = useState<AuthUser | null>(() => {
    const cachedString = localStorage.getItem(LocalStorageKey.AUTH_USER);
    if (!cachedString) return null;
    const parsed: unknown = JSON.parse(cachedString);
    return isValidCachedAuthUser(parsed) ? parsed : null;
  });

  // Ref hält den aktuellen authUser-Wert, damit Listener-Closures
  // nicht auf veraltete Werte zugreifen (Stale-Closure-Problem).
  const authUserRef = useRef<AuthUser | null>(authUser);

  /**
   * Setzt authUser im State und im Ref gleichzeitig.
   * Aktualisiert zusätzlich den Sentry-Benutzerkontext, damit
   * alle zukünftigen Fehler dem aktuellen Benutzer zugeordnet werden.
   *
   * @param user - Der neue AuthUser-Wert oder null.
   */
  const updateAuthUser = (user: AuthUser | null) => {
    authUserRef.current = user;
    setAuthUser(user);

    if (user) {
      Sentry.setUser({
        id: user.uid,
        email: user.email,
        username: user.publicProfile.displayName,
      });
      Sentry.setTag("user.role", user.roles.join(","));
      Sentry.setTag("user.emailVerified", String(user.emailVerified));
    } else {
      Sentry.setUser(null);
      Sentry.setTag("user.role", undefined);
      Sentry.setTag("user.emailVerified", undefined);
    }
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

          // Benutzerprofil via get_own_profile() RPC laden.
          // SECURITY DEFINER umgeht das RLS-Timing-Problem — auth.uid()
          // ist im JWT immer verfügbar, auch direkt nach dem Auth-State-Change.
          try {
            const userDomain = await database.users.findOwnProfile();

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
        } else if (event === "SIGNED_OUT") {
          localStorage.removeItem(LocalStorageKey.AUTH_USER);
          updateAuthUser(null);
        }
      }
    );

    return () => {
      unsubscribeSupabase();
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
