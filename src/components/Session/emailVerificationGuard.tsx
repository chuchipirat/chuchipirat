import React, {useState} from "react";

import { Container, Stack, Alert } from "@mui/material";

import PageTitle from "../Shared/pageTitle";
import ButtonRow from "../Shared/buttonRow";

import {
  VERIFY_YOUR_EMAIL as TEXT_VERIFY_YOUR_EMAIL,
  VERIFICATION_EMAIL_SENT as TEXT_VERIFICATION_EMAIL_SENT,
  ISNT_THERE_A_CAPTAIN_MISSING_SOMEWHERE as TEXT_ISNT_THERE_A_CAPTAIN_MISSING_SOMEWHERE,
} from "../../constants/text";
import LocalStorageKey from "../../constants/localStorage";
import {useAuthUser} from "./authUserContext";
import {useDatabase} from "../Database/DatabaseContext";
import useCustomStyles from "../../constants/styles";

/* ===================================================================
// ============== Prüfung ob Email-Verifizierung nötig ist ===========
// =================================================================== */
/**
 * Prüft, ob der Benutzer seine E-Mail-Adresse noch bestätigen muss.
 *
 * @param authUser - Der aktuelle AuthUser oder null
 * @returns `true`, wenn E-Mail-Verifizierung noch aussteht
 */
const needsEmailVerification = (authUser: {emailVerified: boolean} | null) => {
  if (authUser && !authUser.emailVerified) {
    const storageContent = localStorage.getItem(LocalStorageKey.AUTH_USER);
    if (!storageContent) {
      return false;
    }

    const storageAuthUser = JSON.parse(storageContent);
    if (storageAuthUser && storageAuthUser.emailVerified) {
      return false;
    } else {
      return true;
    }
  } else {
    return false;
  }
};

/* ===================================================================
// ======== Prüfung und Anzeige der Verifizierungs-Nachricht =========
// =================================================================== */
/**
 * Guard-Komponente, die E-Mail-Verifizierung erzwingt.
 *
 * Zeigt eine Meldung mit Resend-Button an, wenn der Benutzer seine
 * E-Mail-Adresse noch nicht bestätigt hat. Verwendet Supabase Auth
 * zum erneuten Senden der Bestätigungs-E-Mail.
 *
 * @param children - Kinder-Komponenten, die nur bei verifizierter E-Mail gerendert werden
 */
export const EmailVerificationGuard: React.FC<{
  children: React.ReactNode;
}> = ({children}) => {
  const database = useDatabase();
  const authUser = useAuthUser();
  const [isSent, setIsSent] = useState(false);
  const classes = useCustomStyles();

  const onSendEmailVerification = () => {
    if (authUser?.email) {
      database.auth
        .resendConfirmationEmail(authUser.email)
        .then(() => setIsSent(true));
    }
  };

  if (needsEmailVerification(authUser)) {
    return (
      <React.Fragment>
        <PageTitle
          subTitle={TEXT_ISNT_THERE_A_CAPTAIN_MISSING_SOMEWHERE}
        />
        <Container sx={classes.container} component="main" maxWidth="xs">
          <br />
          <Stack spacing={2}>
            {isSent ? (
              <Alert severity="success">
                {TEXT_VERIFICATION_EMAIL_SENT}
              </Alert>
            ) : (
              <Alert severity="info">{TEXT_VERIFY_YOUR_EMAIL}</Alert>
            )}
            <ButtonRow
              buttons={[
                {
                  id: "buttonResendConfirmationEmail",
                  hero: true,
                  label: "Bestätigungs-E-Mail erneut senden",
                  variant: "contained",
                  color: "primary",
                  onClick: onSendEmailVerification,
                  disabled: isSent,
                  visible: true,
                },
              ]}
            />
          </Stack>
        </Container>
      </React.Fragment>
    );
  }

  return <>{children}</>;
};

export default EmailVerificationGuard;
