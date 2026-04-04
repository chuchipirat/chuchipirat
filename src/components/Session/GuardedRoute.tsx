import React from "react";

import AuthUser from "../Firebase/Authentication/authUser.class";
import {AuthorizationGuard} from "./authUserContext";
import {EmailVerificationGuard} from "./emailVerificationGuard";

/**
 * Props für die GuardedRoute-Komponente.
 *
 * @param condition - Funktion, die prüft, ob der Benutzer Zugriff hat.
 * @param children - Die geschützten Kind-Komponenten.
 */
type GuardedRouteProps = {
  condition: (authUser: AuthUser | null) => boolean;
  children: React.ReactNode;
};

/**
 * Kombinierter Route-Guard — prüft erst die Autorisierung, dann die E-Mail-Verifizierung.
 *
 * Wird für alle geschützten Routen verwendet, die sowohl eine Berechtigungsprüfung
 * als auch eine E-Mail-Verifizierung erfordern.
 *
 * @param condition - Autorisierungsbedingung.
 * @param children - Geschützte Kinder-Komponenten.
 * @returns Die geschützten Kinder oder eine Umleitung.
 */
const GuardedRoute: React.FC<GuardedRouteProps> = ({condition, children}) => (
  <AuthorizationGuard condition={condition}>
    <EmailVerificationGuard>{children}</EmailVerificationGuard>
  </AuthorizationGuard>
);

export {GuardedRoute};
export type {GuardedRouteProps};
