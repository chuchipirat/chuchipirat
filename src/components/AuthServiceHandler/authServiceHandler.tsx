import React from "react";
import qs from "qs";
import {useLocation} from "react-router";

import VerifyEmail from "./verifyEmail";
import RecoverEmail from "./recoverEmail";
import ChangePassword from "../PasswordChange/passwordChange";
import AlertMessage from "../Shared/AlertMessage";

import * as TEXT from "../../constants/text";

/* ===================================================================
// ======================== globale Funktionen =======================
// =================================================================== */
const AUTH_SERVICE_HANDLER_MODE = {
  VERIFY_EMAIL: "verifyEmail",
  RESET_PASSWORD: "resetPassword",
  RECOVER_EMAIL: "recoverEmail",
};

/**
 * Erkennt den Modus anhand der URL-Parameter.
 *
 * Unterstützt zwei Formate:
 * - Firebase: `?mode=resetPassword&oobCode=...`
 * - Supabase: `#access_token=...&type=recovery` (Hash-Fragment)
 *
 * Bei Supabase Recovery-Links wird die Session automatisch vom
 * Supabase-Client erkannt. Der AuthServiceHandler zeigt dann
 * die Passwort-Änderungsseite an.
 */
function detectMode(search: string, hash: string): {mode: string; oobCode: string} {
  // 1. Supabase Hash-Format prüfen (type=recovery im Hash-Fragment)
  if (hash) {
    const hashParams = new URLSearchParams(hash.replace("#", ""));
    const type = hashParams.get("type");

    if (type === "recovery") {
      return {mode: AUTH_SERVICE_HANDLER_MODE.RESET_PASSWORD, oobCode: ""};
    }
    if (type === "signup" || type === "email_change") {
      return {mode: AUTH_SERVICE_HANDLER_MODE.VERIFY_EMAIL, oobCode: ""};
    }
  }

  // 2. Firebase Query-Format prüfen (?mode=...&oobCode=...)
  if (search) {
    let queryString = search;
    if (queryString.charAt(0) === "?") {
      queryString = queryString.slice(1, -1);
    }
    const parsed = qs.parse(queryString);
    const mode = (parsed.mode as string) || "";
    const oobCode = (parsed.oobCode as string) || "";
    return {mode, oobCode};
  }

  return {mode: "", oobCode: ""};
}

/* ===================================================================
// =============================== Page ==============================
// =================================================================== */
/**
 * AuthServiceHandler — Routing für Auth-Aktionen (Passwort-Reset, E-Mail-Verifizierung).
 *
 * Unterstützt sowohl Firebase-Style Query-Parameter als auch
 * Supabase-Style Hash-Fragmente. Bei Supabase wird die Session
 * automatisch vom Client etabliert, sodass kein oobCode benötigt wird.
 */
const AuthServiceHandlerPage = () => {
  const location = useLocation();
  const {mode, oobCode} = detectMode(location.search, location.hash);

  return (
    <React.Fragment>
      {mode === AUTH_SERVICE_HANDLER_MODE.VERIFY_EMAIL && <VerifyEmail />}
      {mode === AUTH_SERVICE_HANDLER_MODE.RESET_PASSWORD && (
        <ChangePassword oobCode={oobCode} />
      )}
      {mode === AUTH_SERVICE_HANDLER_MODE.RECOVER_EMAIL && (
        <RecoverEmail oobCode={oobCode} />
      )}
      {!mode && <AlertMessage body={TEXT.AUTH_SERVICE_HANLDER_NO_MODE} />}
    </React.Fragment>
  );
};

export default AuthServiceHandlerPage;
