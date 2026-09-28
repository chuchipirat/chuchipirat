import {useCallback} from "react";
import {useNavigate} from "react-router";

import * as ROUTES from "../../constants/routes";
import {LocalStorageKey} from "../../constants/localStorage";
import {useDatabase} from "../Database/DatabaseContext";
import {captureUnexpectedError} from "../../utils/errorUtils";

/**
 * Hook für das sichere Abmelden des Benutzers.
 *
 * Meldet den Benutzer bei Supabase ab, entfernt die lokale
 * Auth-Information und navigiert zur Landing-Seite.
 *
 * Schlägt das Abmelden fehl (typisch: offline), entfernt Supabase die lokale
 * Sitzung nicht — der Benutzer ist dann weiterhin angemeldet. In diesem Fall
 * wird bewusst nichts lokal bereinigt und nicht navigiert, damit die UI nicht
 * ein Abmelden vortäuscht; der Aufrufer zeigt stattdessen einen Hinweis an.
 *
 * @returns Asynchrone Callback-Funktion zum Abmelden; liefert `true`, wenn
 *   das Abmelden geklappt hat, sonst `false`. Rejected nie.
 *
 * @example
 * const signOut = useSignOut();
 * const signedOut = await signOut();
 * if (!signedOut) showSnackbar(TEXT.ERROR_SIGN_OUT_FAILED);
 */
export const useSignOut = () => {
  const database = useDatabase();
  const navigate = useNavigate();

  return useCallback(async (): Promise<boolean> => {
    try {
      await database.auth.signOut();
    } catch (error) {
      captureUnexpectedError(error, {context: "Abmelden"});
      return false;
    }
    localStorage.removeItem(LocalStorageKey.AUTH_USER);
    navigate(ROUTES.LANDING);
    return true;
  }, [database, navigate]);
};
