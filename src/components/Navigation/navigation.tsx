import {useAuthUser} from "../Session/authUserContext";
import {NavigationBar} from "./NavigationBar";
import {NavigationNoAuth} from "./NavigationNoAuth";

/**
 * Wurzelkomponente der Navigation.
 *
 * Prüft den Authentifizierungsstatus und rendert die passende
 * Navigationsleiste: {@link NavigationBar} für angemeldete Benutzer
 * oder {@link NavigationNoAuth} für nicht angemeldete Benutzer.
 *
 * @returns Die auth-abhängige Navigationsleiste.
 */
export const Navigation = () => {
  const authUser = useAuthUser();

  if (authUser) {
    return <NavigationBar authUser={authUser} />;
  }

  return <NavigationNoAuth />;
};
