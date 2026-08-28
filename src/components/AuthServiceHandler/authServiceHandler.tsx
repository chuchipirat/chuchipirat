import React from "react";
import {useLocation} from "react-router";

import {Alert, AlertTitle, Container, Typography} from "@mui/material";

import {VerifyEmailPage} from "./verifyEmail";
import {ConfirmEmailChangePage} from "./confirmEmailChange";
import {ResetPasswordPage} from "./resetPassword";
import {PageTitle} from "../Shared/pageTitle";
import {
  initialAuthCallbackHash,
  initialAuthCallbackSearch,
} from "../Database/supabaseClient";

import {useCustomStyles} from "../../constants/styles";
import * as TEXT from "../../constants/text";

const AUTH_SERVICE_HANDLER_MODE = {
  VERIFY_EMAIL: "verifyEmail",
  RESET_PASSWORD: "resetPassword",
  EMAIL_CHANGE: "emailChange",
};

/** Rückgabewert von detectMode */
type DetectedMode = {
  mode: string;
  errorDescription: string;
};

/**
 * Erkennt den Modus anhand der URL-Parameter.
 *
 * Unterstützt zwei Formate:
 * - Supabase Implicit: `#access_token=...&type=signup` (Hash-Fragment)
 * - Supabase PKCE: `?code=AUTH_CODE` (Query-Parameter)
 *
 * Erkennt auch Supabase-Fehlerweiterleitungen bei abgelaufenen oder
 * ungültigen Links (`?error=...&error_description=...` oder `#error=...`).
 *
 * @param search - Query-String der URL (location.search)
 * @param hash - Hash-Fragment der URL (location.hash)
 * @returns Erkannter Modus und ggf. Fehlerbeschreibung
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
        errorDescription: hashParams.get("error_description") || "",
      };
    }
  }
  if (search) {
    const searchParams = new URLSearchParams(search);
    if (searchParams.has("error")) {
      return {
        mode: "",
        errorDescription: searchParams.get("error_description") || "",
      };
    }
  }

  // 1. Supabase Hash-Format prüfen (Implicit Flow: type=... im Hash-Fragment)
  if (hash) {
    const hashParams = new URLSearchParams(hash.replace("#", ""));
    const type = hashParams.get("type");

    if (type === "recovery") {
      return {mode: AUTH_SERVICE_HANDLER_MODE.RESET_PASSWORD, errorDescription: ""};
    }
    if (type === "signup") {
      return {mode: AUTH_SERVICE_HANDLER_MODE.VERIFY_EMAIL, errorDescription: ""};
    }
    if (type === "email_change") {
      return {mode: AUTH_SERVICE_HANDLER_MODE.EMAIL_CHANGE, errorDescription: ""};
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
        return {mode: AUTH_SERVICE_HANDLER_MODE.EMAIL_CHANGE, errorDescription: ""};
      }
      return {mode: AUTH_SERVICE_HANDLER_MODE.VERIFY_EMAIL, errorDescription: ""};
    }
  }

  return {mode: "", errorDescription: ""};
}

/**
 * AuthServiceHandler — Routing für Auth-Aktionen (Passwort-Reset, E-Mail-Verifizierung).
 *
 * Unterstützt Supabase-Style Hash-Fragmente und PKCE-Query-Parameter.
 * Die Session wird automatisch vom Client etabliert.
 */
export const AuthServiceHandlerPage = () => {
  const location = useLocation();
  // Modus einmalig beim ersten Render erfassen. Bevorzugt den Schnappschuss
  // aus supabaseClient.ts (vor jeglicher Supabase-Verarbeitung eingefroren,
  // siehe Kommentar dort) — location.hash/.search können zu diesem Zeitpunkt
  // bereits vom Supabase-Client geleert worden sein. Fallback auf location.*
  // greift in Tests (MemoryRouter berührt window.location nie) sowie für
  // den seltenen Fall einer SPA-internen Navigation auf diese Route.
  const {mode, errorDescription} = React.useRef(
    detectMode(
      initialAuthCallbackSearch || location.search,
      initialAuthCallbackHash || location.hash,
    )
  ).current;

  return (
    <>
      {mode === AUTH_SERVICE_HANDLER_MODE.VERIFY_EMAIL && <VerifyEmailPage />}
      {mode === AUTH_SERVICE_HANDLER_MODE.RESET_PASSWORD && <ResetPasswordPage />}
      {mode === AUTH_SERVICE_HANDLER_MODE.EMAIL_CHANGE && (
        <ConfirmEmailChangePage />
      )}
      {!mode && (
        <AuthServiceHandlerError errorDescription={errorDescription} />
      )}
    </>
  );
};

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
    <>
      <PageTitle
        subTitle={
          isExpiredLink
            ? TEXT.AUTH_SERVICE_HANDLER_EXPIRED_LINK_SUBTITLE
            : TEXT.AUTH_SERVICE_HANDLER_NO_MODE_SUBTITLE
        }
      />
      <Container sx={classes.container} component="main" maxWidth="xs">
        <Alert severity={isExpiredLink ? "warning" : "info"}>
          <AlertTitle>
            {isExpiredLink
              ? TEXT.AUTH_SERVICE_HANDLER_EXPIRED_LINK_TITLE
              : TEXT.AUTH_SERVICE_HANDLER_NO_MODE_TITLE}
          </AlertTitle>
          <Typography>
            {isExpiredLink
              ? TEXT.AUTH_SERVICE_HANDLER_EXPIRED_LINK_TEXT
              : TEXT.AUTH_SERVICE_HANDLER_NO_MODE}
          </Typography>
        </Alert>
      </Container>
    </>
  );
};
