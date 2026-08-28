import {useCallback} from "react";
import {useNavigate} from "react-router";

import * as ROUTES from "../../constants/routes";
import {LocalStorageKey} from "../../constants/localStorage";
import {useDatabase} from "../Database/DatabaseContext";

/**
 * Hook für das sichere Abmelden des Benutzers.
 *
 * Meldet den Benutzer bei Supabase ab, entfernt die lokale
 * Auth-Information und navigiert zur Landing-Seite.
 *
 * @returns Asynchrone Callback-Funktion zum Abmelden.
 *
 * @example
 * const signOut = useSignOut();
 * <MenuItem onClick={signOut}>Abmelden</MenuItem>
 */
export const useSignOut = () => {
  const database = useDatabase();
  const navigate = useNavigate();

  return useCallback(async () => {
    await database.auth.signOut();
    localStorage.removeItem(LocalStorageKey.AUTH_USER);
    navigate(ROUTES.LANDING);
  }, [database, navigate]);
};
