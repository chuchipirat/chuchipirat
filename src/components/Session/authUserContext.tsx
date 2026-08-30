import React, {useState, useEffect, useRef} from "react";
import {useNavigate, useLocation} from "react-router";
import * as Sentry from "@sentry/react";

import AuthUser from "../Session/authUser.class";
import {useDatabase} from "../Database/DatabaseContext";
import {LocalStorageKey} from "../../constants/localStorage";
import {Role} from "../../constants/roles";
import {useGlobalSettings} from "./globalSettingsContext";
import {isUuid} from "../../utils/uuid";

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
 * einem `JSON.parse` nicht die erwartete Struktur aufweisen. `uid` muss eine
 * kanonische UUID sein — so werden insbesondere Cache-Einträge aus der
 * Firebase-Ära (28-stellige Firebase-UID) verworfen, die sonst als
 * `authUser.uid` an Postgres-`uuid`-Spalten gereicht würden (Fehler `22P02`).
 *
 * @param value - Der geparste Wert aus dem localStorage.
 * @returns `true`, wenn der Wert die minimale AuthUser-Struktur aufweist.
 */
export const isValidCachedAuthUser = (value: unknown): value is AuthUser => {
  if (typeof value !== "object" || value === null) return false;
  const obj = value as Record<string, unknown>;
  return (
    typeof obj.uid === "string" &&
    isUuid(obj.uid) &&
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
          // WICHTIG: Supabase-Aufrufe dürfen im onAuthStateChange-Callback
          // NICHT mit await blockiert werden, da signInWithPassword intern
          // einen Lock hält und getSession() denselben Lock benötigt → Deadlock.
          // Stattdessen wird der Aufruf per setTimeout aus dem Lock-Kontext
          // herausgelöst.
          const sessionUser = session.user;
          setTimeout(async () => {
            try {
              const userDomain = await database.users.findOwnProfile();

              if (userDomain) {
                const newAuthUser: AuthUser = {
                  uid: sessionUser.id,
                  email: userDomain.email,
                  emailVerified: !!sessionUser.email_confirmed_at,
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
                  JSON.stringify(newAuthUser),
                );
                updateAuthUser(newAuthUser);
              }
            } catch (err) {
              Sentry.captureException(err);
            }
          }, 0);
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
 * Prüft zusätzlich den Wartungsmodus (`useGlobalSettings`): wird dieser
 * aktiviert, während ein Nicht-Admin bereits angemeldet ist, wird er
 * ausgeloggt und zur Sign-In-Seite umgeleitet — ohne diese Prüfung würde
 * eine bereits laufende Session vom Wartungsmodus nie erfasst (der bisherige
 * Check erfolgt sonst nur einmalig beim Login, siehe SignInPage.onSignIn).
 * Dies ist weiterhin eine rein client-seitige, "weiche" Sperre (Polling,
 * keine RLS-Durchsetzung) — die eigentliche Sicherheitsgrenze bleibt der
 * JWT-Ablauf nach einem "Alle Sessions abmelden".
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
  const location = useLocation();
  const {maintenanceMode} = useGlobalSettings();

  const blockedByMaintenance =
    maintenanceMode && !!authUser && !authUser.roles.includes(Role.admin);

  useEffect(() => {
    if (authUser === null) {
      // authUser null = entweder noch am Laden oder abgemeldet.
      // Einmalige Session-Prüfung, um die beiden Fälle zu unterscheiden.
      database.auth.getSession().then((session) => {
        if (!session) {
          // Ursprünglich angeforderte URL mitgeben, damit SignInPage nach
          // erfolgreichem Login dorthin zurücknavigieren kann (statt immer /home).
          navigate(ROUTE_SIGN_IN, {
            state: {from: `${location.pathname}${location.search}`},
          });
        }
        // Wenn Session vorhanden, warten bis AuthUserProvider den authUser setzt.
      });
    } else if (blockedByMaintenance) {
      database.auth.signOut().then(() => {
        navigate(ROUTE_SIGN_IN);
      });
    } else if (!condition(authUser)) {
      navigate(ROUTE_NO_AUTH);
    }
  }, [authUser, condition, navigate, location, blockedByMaintenance, database]);

  // Während authUser null ist (Laden), bei fehlender Berechtigung oder
  // während des Wartungsmodus-Logouts nichts rendern.
  return condition(authUser) && !blockedByMaintenance ? <>{children}</> : null;
};
