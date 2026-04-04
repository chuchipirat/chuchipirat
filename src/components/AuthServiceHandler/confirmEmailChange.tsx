import React from "react";

import {useNavigate} from "react-router";

import {
  Container,
  Typography,
  Alert,
  AlertTitle,
  Link,
  CircularProgress,
} from "@mui/material";
import * as Sentry from "@sentry/react";

import * as ROUTES from "../../constants/routes";
import {
  EMAIL_CHANGE_CONFIRMED_TITLE as TEXT_EMAIL_CHANGE_CONFIRMED_TITLE,
  EMAIL_CHANGE_CONFIRMED_TEXT as TEXT_EMAIL_CHANGE_CONFIRMED_TEXT,
  EMAIL_CHANGE_CONFIRMED_REDIRECT as TEXT_EMAIL_CHANGE_CONFIRMED_REDIRECT,
  EMAIL_CHANGE_CONFIRMED_GO_TO_PROFILE as TEXT_EMAIL_CHANGE_CONFIRMED_GO_TO_PROFILE,
  ALERT_TITLE_UUPS as TEXT_ALERT_TITLE_UUPS,
  PLEASE_WAIT as TEXT_PLEASE_WAIT,
} from "../../constants/text";
import {LocalStorageKey} from "../../constants/localStorage";
import {useCustomStyles} from "../../constants/styles";
import {useDatabase} from "../Database/DatabaseContext";
import AuthUser from "../Firebase/Authentication/authUser.class";

import {PageTitle} from "../Shared/pageTitle";

/**
 * Bestätigungsseite nach E-Mail-Änderung (Supabase Implicit Flow).
 *
 * Der Supabase-Client verarbeitet den Hash-Fragment aus der URL
 * asynchron und etabliert eine neue Session. Diese Komponente wartet
 * via `onAuthStateChange` auf das `SIGNED_IN`-Event, aktualisiert
 * dann den localStorage und zeigt eine Erfolgsmeldung mit Countdown.
 *
 * Die Synchronisation der E-Mail in `public.users` erfolgt automatisch
 * über den Datenbank-Trigger `trg_sync_auth_email` — kein manueller
 * DB-Patch nötig.
 */
export const ConfirmEmailChangePage = () => {
  const [timer, setTimer] = React.useState(10);
  const [error, setError] = React.useState<string>("");
  const [done, setDone] = React.useState(false);
  const navigate = useNavigate();
  const classes = useCustomStyles();
  const database = useDatabase();

  // Auf neue Session warten, localStorage aktualisieren.
  React.useEffect(() => {
    let cancelled = false;

    const unsubscribe = database.auth.onAuthStateChange(
      async (event, session) => {
        if (cancelled || !session) return;
        if (event !== "INITIAL_SESSION" && event !== "SIGNED_IN") return;

        try {
          // E-Mail aus der neuen Session lesen
          const supabaseUser = await database.auth.getUser();
          if (!supabaseUser?.email || cancelled) return;

          const newEmail = supabaseUser.email;

          // localStorage aktualisieren
          const storedUser = localStorage.getItem(LocalStorageKey.AUTH_USER);
          if (storedUser) {
            const parsed = JSON.parse(storedUser) as AuthUser;
            parsed.email = newEmail;
            localStorage.setItem(
              LocalStorageKey.AUTH_USER,
              JSON.stringify(parsed),
            );
          }

          if (!cancelled) setDone(true);
        } catch (err) {
          if (cancelled) return;
          Sentry.captureException(err);
          setError(err instanceof Error ? err.message : "Unbekannter Fehler");
        }
      },
    );

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [database]);

  // Nach 10 Sekunden auf Profil weiterleiten (erst nach erfolgreichem Update)
  React.useEffect(() => {
    if (!done) return;

    if (timer === 0) {
      const timeout = setTimeout(() => navigate(ROUTES.USER_PROFILE), 500);
      return () => clearTimeout(timeout);
    }
    const timeout = setTimeout(() => setTimer(timer - 1), 1000);
    return () => clearTimeout(timeout);
  }, [timer, navigate, done]);

  return (
    <>
      <PageTitle title={TEXT_EMAIL_CHANGE_CONFIRMED_TITLE} />
      <Container sx={classes.container} component="main" maxWidth="sm">
        {error ? (
          <Alert severity="error">
            <AlertTitle>{TEXT_ALERT_TITLE_UUPS}</AlertTitle>
            <Typography>{error}</Typography>
          </Alert>
        ) : done ? (
          <Alert severity="success">
            <AlertTitle>{TEXT_EMAIL_CHANGE_CONFIRMED_TITLE}</AlertTitle>
            <Typography>{TEXT_EMAIL_CHANGE_CONFIRMED_TEXT}</Typography>
            <Typography>
              {TEXT_EMAIL_CHANGE_CONFIRMED_REDIRECT(timer)}
            </Typography>
            <Typography sx={{mt: 1}}>
              <Link
                component="button"
                onClick={() => navigate(ROUTES.USER_PROFILE)}
              >
                {TEXT_EMAIL_CHANGE_CONFIRMED_GO_TO_PROFILE}
              </Link>
            </Typography>
          </Alert>
        ) : (
          <Alert severity="info">
            <AlertTitle>{TEXT_EMAIL_CHANGE_CONFIRMED_TITLE}</AlertTitle>
            <Typography sx={{display: "flex", alignItems: "center", gap: 1}}>
              <CircularProgress size={16} />
              {TEXT_PLEASE_WAIT}
            </Typography>
          </Alert>
        )}
      </Container>
    </>
  );
};
