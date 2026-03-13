import React from "react";
import qs from "qs";
import {useLocation} from "react-router";

import {Alert, AlertTitle, Container, Typography} from "@mui/material";

import VerifyEmail from "./verifyEmail";
import ConfirmEmailChange from "./confirmEmailChange";
import RecoverEmail from "./recoverEmail";
import ResetPassword from "./resetPassword";
import PageTitle from "../Shared/pageTitle";

import useCustomStyles from "../../constants/styles";
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

/** Rückgabewert von detectMode */
type DetectedMode = {
  mode: string;
  oobCode: string;
  errorDescription: string;
};

/**
 * Erkennt den Modus anhand der URL-Parameter.
 *
 * Unterstützt drei Formate:
 * - Supabase Implicit: `#access_token=...&type=signup` (Hash-Fragment)
 * - Supabase PKCE: `?code=AUTH_CODE` (Query-Parameter)
 * - Firebase: `?mode=resetPassword&oobCode=...` (Query-Parameter)
 *
 * Erkennt auch Supabase-Fehlerweiterleitungen bei abgelaufenen oder
 * ungültigen Links (`?error=...&error_description=...` oder `#error=...`).
 *
 * @param search - Query-String der URL (location.search)
 * @param hash - Hash-Fragment der URL (location.hash)
 * @returns Erkannter Modus, ggf. oobCode für Firebase und Fehlerbeschreibung
 */
function detectMode(search: string, hash: string): DetectedMode {
  // 0. Supabase-Fehlerweiterleitung prüfen (abgelaufene/ungültige Links)
  // Supabase leitet bei Fehlern mit ?error=...&error_description=... oder
  // #error=...&error_description=... weiter.
  if (hash) {
    const hashParams = new URLSearchParams(hash.replace("#", ""));
    if (hashParams.has("error")) {
      return {
        mode: "",
        oobCode: "",
        errorDescription: hashParams.get("error_description") || "",
      };
    }
  }
  if (search) {
    const searchParams = new URLSearchParams(search);
    if (searchParams.has("error")) {
      return {
        mode: "",
        oobCode: "",
        errorDescription: searchParams.get("error_description") || "",
      };
    }
  }

  // 1. Supabase Hash-Format prüfen (Implicit Flow: type=... im Hash-Fragment)
  if (hash) {
    const hashParams = new URLSearchParams(hash.replace("#", ""));
    const type = hashParams.get("type");

    if (type === "recovery") {
      return {mode: AUTH_SERVICE_HANDLER_MODE.RESET_PASSWORD, oobCode: "", errorDescription: ""};
    }
    if (type === "signup") {
      return {mode: AUTH_SERVICE_HANDLER_MODE.VERIFY_EMAIL, oobCode: "", errorDescription: ""};
    }
    if (type === "email_change") {
      return {mode: AUTH_SERVICE_HANDLER_MODE.EMAIL_CHANGE, oobCode: "", errorDescription: ""};
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
        return {mode: AUTH_SERVICE_HANDLER_MODE.EMAIL_CHANGE, oobCode: "", errorDescription: ""};
      }
      return {mode: AUTH_SERVICE_HANDLER_MODE.VERIFY_EMAIL, oobCode: "", errorDescription: ""};
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
    return {mode, oobCode, errorDescription: ""};
  }

  return {mode: "", oobCode: "", errorDescription: ""};
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
  const {mode, oobCode, errorDescription} = React.useRef(
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
      {!mode && (
        <AuthServiceHandlerError errorDescription={errorDescription} />
      )}
    </React.Fragment>
  );
};

/* ===================================================================
// ======================== Fehler-Anzeige ============================
// =================================================================== */

/**
 * Props für die AuthServiceHandlerError-Komponente.
 *
 * @param errorDescription - Fehlerbeschreibung aus der URL (Supabase) oder leer
 */
interface AuthServiceHandlerErrorProps {
  errorDescription: string;
}

/**
 * Fehleranzeige für den AuthServiceHandler.
 *
 * Zeigt eine spezifische Meldung bei abgelaufenen/ungültigen Links
 * oder eine generische Meldung bei unbekannten URLs. Das Layout
 * entspricht dem der Bestätigungsseite (zentriert, maxWidth xs).
 */
const AuthServiceHandlerError = ({
  errorDescription,
}: AuthServiceHandlerErrorProps) => {
  const classes = useCustomStyles();

  // Supabase liefert eine errorDescription bei abgelaufenen/ungültigen Links
  const isExpiredLink = !!errorDescription;

  return (
    <React.Fragment>
      <PageTitle
        subTitle={
          isExpiredLink
            ? TEXT.AUTH_SERVICE_HANDLER_EXPIRED_LINK_SUBTITLE
            : TEXT.AUTH_SERVICE_HANLDER_NO_MODE_SUBTITLE
        }
      />
      <Container sx={classes.container} component="main" maxWidth="xs">
        <Alert severity={isExpiredLink ? "warning" : "info"}>
          <AlertTitle>
            {isExpiredLink
              ? TEXT.AUTH_SERVICE_HANDLER_EXPIRED_LINK_TITLE
              : TEXT.AUTH_SERVICE_HANLDER_NO_MODE_TITLE}
          </AlertTitle>
          <Typography>
            {isExpiredLink
              ? TEXT.AUTH_SERVICE_HANDLER_EXPIRED_LINK_TEXT
              : TEXT.AUTH_SERVICE_HANLDER_NO_MODE}
          </Typography>
        </Alert>
      </Container>
    </React.Fragment>
  );
};

export default AuthServiceHandlerPage;
