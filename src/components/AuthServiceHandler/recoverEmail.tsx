import React from "react";

import {Link as RouterLink} from "react-router";

import {Container, Link, Alert, AlertTitle, CircularProgress} from "@mui/material";
import * as Sentry from "@sentry/react";

import {PageTitle} from "../Shared/pageTitle";

import {useCustomStyles} from "../../constants/styles";

import FirebaseMessageHandler from "../Firebase/firebaseMessageHandler.class";
import SupabaseMessageHandler from "../Database/supabaseMessageHandler.class";
import {useFirebase} from "../Firebase/firebaseContext";
import {SIGN_IN as ROUTE_SIGN_IN} from "../../constants/routes";
import {
  ALERT_TITLE_UUPS as TEXT_ALERT_TITLE_UUPS,
  BACKSPELLED as TEXT_BACKSPELLED,
  CHANGE_UNDONE as TEXT_CHANGE_UNDONE,
  EMAIL_RECOVERED as TEXT_EMAIL_RECOVERED,
  PLEASE_WAIT as TEXT_PLEASE_WAIT,
  SIGN_IN as TEXT_SIGN_IN,
} from "../../constants/text";
import {LocalStorageKey} from "../../constants/localStorage";
import AuthUser from "../Firebase/Authentication/authUser.class";
import {checkActionCode} from "firebase/auth";

/**
 * @deprecated Nur für Legacy-Firebase-Links (oobCode-basiert).
 * Supabase verwendet keinen separaten „Recover Email"-Action-Code-Flow.
 * Diese Komponente bleibt funktionsfähig, damit bestehende Firebase-Links
 * noch verarbeitet werden können, wird aber nicht mehr aktiv verwendet.
 */
interface RecoverEmailPageProps {
  authUser?: AuthUser | null;
  oobCode: string;
}

export const RecoverEmailPage: React.FC<RecoverEmailPageProps> = ({authUser: authUserProp = null, oobCode}) => {
  let authUser = authUserProp;
  const firebase = useFirebase();
  const actionCode = oobCode;
  const [error, setError] = React.useState<Error | null>(null);
  const [isRecovered, setIsRecovered] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(true);
  const classes = useCustomStyles();

  React.useEffect(() => {
    if (!authUser) {
      authUser = JSON.parse(localStorage.getItem(LocalStorageKey.AUTH_USER)!);
    }

    if (!authUser) {
      setIsLoading(false);
      setError({message: TEXT_ALERT_TITLE_UUPS, name: "undefined"});
      return;
    }

    if (!actionCode) {
      setIsLoading(false);
      return;
    }

    checkActionCode(firebase.auth, actionCode).then((actionCodeInfo) => {
      // E-Mail-Sync in public.users erfolgt automatisch über den
      // Datenbank-Trigger trg_sync_auth_email — kein manueller Patch nötig.
      updateLocalStorage(actionCodeInfo.data.email as string);

      firebase
        .applyActionCode(actionCode)
        .then(() => {
          firebase.signOut();
          setIsLoading(false);
          setIsRecovered(true);
        })
        .catch((error) => {
          Sentry.captureException(error);
          setIsLoading(false);
          setError(error);
        });
    });
  }, [firebase, actionCode]);

  /**
   * Aktualisiert den localStorage mit der alten E-Mail-Adresse
   * nach einer erfolgreichen E-Mail-Recovery.
   *
   * @param oldEmail - Die ursprüngliche E-Mail-Adresse vor der Änderung.
   */
  const updateLocalStorage = (oldEmail: string) => {
    // alles löschen damit die alten Werte neu gelesen werden
    const user = JSON.parse(
      localStorage.getItem(LocalStorageKey.AUTH_USER)!
    ) as AuthUser;
    user.email = oldEmail;
    user.emailVerified = true;
    localStorage.setItem(LocalStorageKey.AUTH_USER, JSON.stringify(user));
  };

  return (
    <>
      <PageTitle
        title={TEXT_BACKSPELLED}
      />
      <Container sx={classes.container} component="main" maxWidth="xs">
        {isLoading && !error && !isRecovered && (
          <Alert severity="info">
            <AlertTitle>{TEXT_PLEASE_WAIT}</AlertTitle>
            <CircularProgress size={16} />
          </Alert>
        )}
        {error && (
          <Alert severity="error">
            <AlertTitle>{TEXT_ALERT_TITLE_UUPS}</AlertTitle>
            {FirebaseMessageHandler.translateMessage(error) ??
              SupabaseMessageHandler.translateMessage(error)}
          </Alert>
        )}
        {isRecovered && (
          <Alert severity="info">
            <AlertTitle>{TEXT_CHANGE_UNDONE}</AlertTitle>
            {TEXT_EMAIL_RECOVERED}
            <Link component={RouterLink} to={ROUTE_SIGN_IN}>
              {TEXT_SIGN_IN}
            </Link>
          </Alert>
        )}
      </Container>
    </>
  );
};
