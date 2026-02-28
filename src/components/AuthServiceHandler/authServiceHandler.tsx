import React from "react";
import qs from "qs";
import {useLocation} from "react-router";

import VerifyEmail from "./verifyEmail";
import ConfirmEmailChange from "./confirmEmailChange";
import RecoverEmail from "./recoverEmail";
import ResetPassword from "./resetPassword";
import AlertMessage from "../Shared/AlertMessage";

import * as TEXT from "../../constants/text";

/* ===================================================================
// ======================== globale Funktionen =======================
// =================================================================== */
const AUTH_SERVICE_HANDLER_MODE = {
  VERIFY_EMAIL: "verifyEmail",
  RESET_PASSWORD: "resetPassword",
  RECOVER_EMAIL: "recoverEmail",
  EMAIL_CHANGE: "emailChange",
};

/**
 * Erkennt den Modus anhand der URL-Parameter.
 *
 * Unterstützt drei Formate:
 * - Supabase Implicit: `#access_token=...&type=signup` (Hash-Fragment)
 * - Supabase PKCE: `?code=AUTH_CODE` (Query-Parameter)
 * - Firebase: `?mode=resetPassword&oobCode=...` (Query-Parameter)
 *
 * @param search - Query-String der URL (location.search)
 * @param hash - Hash-Fragment der URL (location.hash)
 * @returns Erkannter Modus und ggf. oobCode für Firebase
 */
function detectMode(search: string, hash: string): {mode: string; oobCode: string} {
  // 1. Supabase Hash-Format prüfen (Implicit Flow: type=... im Hash-Fragment)
  if (hash) {
    const hashParams = new URLSearchParams(hash.replace("#", ""));
    const type = hashParams.get("type");

    if (type === "recovery") {
      return {mode: AUTH_SERVICE_HANDLER_MODE.RESET_PASSWORD, oobCode: ""};
    }
    if (type === "signup") {
      return {mode: AUTH_SERVICE_HANDLER_MODE.VERIFY_EMAIL, oobCode: ""};
    }
    if (type === "email_change") {
      return {mode: AUTH_SERVICE_HANDLER_MODE.EMAIL_CHANGE, oobCode: ""};
    }
  }

  // 2. Supabase PKCE-Format prüfen (?code=... in der Query)
  // Passwort-Recovery leitet auf /action um, daher ist ein code hier
  // entweder eine E-Mail-Bestätigung oder eine E-Mail-Änderung.
  if (search) {
    const searchParams = new URLSearchParams(search);
    if (searchParams.has("code")) {
      const type = searchParams.get("type");
      if (type === "email_change") {
        return {mode: AUTH_SERVICE_HANDLER_MODE.EMAIL_CHANGE, oobCode: ""};
      }
      return {mode: AUTH_SERVICE_HANDLER_MODE.VERIFY_EMAIL, oobCode: ""};
    }
  }

  // 3. Firebase Query-Format prüfen (?mode=...&oobCode=...)
  if (search) {
    let queryString = search;
    if (queryString.charAt(0) === "?") {
      queryString = queryString.slice(1);
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
  // Modus einmalig beim ersten Render erfassen, bevor Supabase
  // die URL-Parameter entfernt (PKCE code cleanup).
  const {mode, oobCode} = React.useRef(
    detectMode(location.search, location.hash)
  ).current;

  return (
    <React.Fragment>
      {mode === AUTH_SERVICE_HANDLER_MODE.VERIFY_EMAIL && <VerifyEmail />}
      {mode === AUTH_SERVICE_HANDLER_MODE.RESET_PASSWORD && <ResetPassword />}
      {mode === AUTH_SERVICE_HANDLER_MODE.EMAIL_CHANGE && (
        <ConfirmEmailChange />
      )}
      {mode === AUTH_SERVICE_HANDLER_MODE.RECOVER_EMAIL && (
        <RecoverEmail oobCode={oobCode} />
      )}
      {!mode && <AlertMessage body={TEXT.AUTH_SERVICE_HANLDER_NO_MODE} />}
    </React.Fragment>
  );
};

export default AuthServiceHandlerPage;
