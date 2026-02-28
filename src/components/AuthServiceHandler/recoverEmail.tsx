import React from "react";

import {useNavigate} from "react-router";

import { Container, Link, Alert, AlertTitle } from "@mui/material";

import PageTitle from "../Shared/pageTitle";

import useCustomStyles from "../../constants/styles";

import FirebaseMessageHandler from "../Firebase/firebaseMessageHandler.class";
import SupabaseMessageHandler from "../Database/supabaseMessageHandler.class";
import {useFirebase} from "../Firebase/firebaseContext";
import {SIGN_IN as ROUTE_SIGN_IN} from "../../constants/routes";
import {
  ALERT_TITLE_UUPS as TEXT_ALERT_TITLE_UUPS,
  BACKSPELLED as TEXT_BACKSPELLED,
  CHANGE_UNDONE as TEXT_CHANGE_UNDONE,
  EMAIL_RECOVERED as TEXT_EMAIL_RECOVERED,
  SIGN_IN as TEXT_SIGN_IN,
} from "../../constants/text";
import LocalStorageKey from "../../constants/localStorage";
import AuthUser from "../Firebase/Authentication/authUser.class";
import {checkActionCode} from "firebase/auth";

// ===================================================================
// =============================== Page ==============================
// ===================================================================
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

const RecoverEmailPage: React.FC<RecoverEmailPageProps> = ({authUser: authUserProp = null, oobCode}) => {
  let authUser = authUserProp;
  const firebase = useFirebase();
  const actionCode = oobCode;
  const [error, setError] = React.useState<Error | null>(null);
  const [isRecovered, setIsRecovered] = React.useState(false);
  const navigate = useNavigate();
  const classes = useCustomStyles();

  /* ------------------------------------------
  // E-Mail-Wechsel zurückbuchstabieren
  // ------------------------------------------ */
  React.useEffect(() => {
    if (!authUser) {
      authUser = JSON.parse(localStorage.getItem(LocalStorageKey.AUTH_USER)!);
    }

    if (!authUser) {
      setError({message: TEXT_ALERT_TITLE_UUPS, name: "undefined"});
      return;
    }

    if (!actionCode) {
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
          setIsRecovered(true);
        })
        .catch((error) => {
          console.error(error);
          setError(error);
        });
    });
  }, [firebase, actionCode]);

  /* ------------------------------------------
  // Session-Storage auf Änderungen umbiegen
  // ------------------------------------------ */
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
    <React.Fragment>
      <PageTitle
        title={TEXT_BACKSPELLED}
        // subTitle={TEXT.ALERT_TITLE_EMAIL_RECOVERED}
      />
      <Container sx={classes.container} component="main" maxWidth="xs">
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
            <Link onClick={() => navigate(ROUTE_SIGN_IN)}>
              {TEXT_SIGN_IN}
            </Link>
          </Alert>
        )}
      </Container>
    </React.Fragment>
  );
};

export default RecoverEmailPage;
