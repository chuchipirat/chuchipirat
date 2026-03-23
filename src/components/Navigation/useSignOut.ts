import {useCallback} from "react";
import {useNavigate} from "react-router";

import * as ROUTES from "../../constants/routes";
import {LocalStorageKey} from "../../constants/localStorage";
import {useFirebase} from "../Firebase/firebaseContext";
import {useDatabase} from "../Database/DatabaseContext";

/**
 * Hook für das sichere Abmelden des Benutzers.
 *
 * Meldet den Benutzer gleichzeitig bei Supabase und Firebase ab,
 * entfernt die lokale Auth-Information und navigiert zur Landing-Seite.
 * Verwendet `Promise.allSettled`, damit beide Abmeldungen unabhängig
 * voneinander abgeschlossen werden können.
 *
 * @returns Asynchrone Callback-Funktion zum Abmelden.
 *
 * @example
 * const signOut = useSignOut();
 * <MenuItem onClick={signOut}>Abmelden</MenuItem>
 */
export const useSignOut = () => {
  const database = useDatabase();
  const firebase = useFirebase();
  const navigate = useNavigate();

  return useCallback(async () => {
    await Promise.allSettled([
      database.auth.signOut(),
      firebase.signOut(),
    ]);
    localStorage.removeItem(LocalStorageKey.AUTH_USER);
    navigate(ROUTES.LANDING);
  }, [database, firebase, navigate]);
};
