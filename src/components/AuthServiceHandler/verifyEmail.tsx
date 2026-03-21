import React from "react";

import {useNavigate} from "react-router";

import Container from "@mui/material/Container";
import * as ROUTES from "../../constants/routes";
import {
  WELCOME_ON_BOARD as TEXT_WELCOME_ON_BOARD,
  WELCOME_ON_BOARD_REDIRECT as TEXT_WELCOME_ON_BOARD_REDIRECT,
  AYE_AYE_CAPTAIN as TEXT_AYE_AYE_CAPTAIN,
  THANK_YOU_FOR_VERIFYING_YOUR_EMAIL as TEXT_THANK_YOU_FOR_VERIFYING_YOUR_EMAIL,
} from "../../constants/text";
import useCustomStyles from "../../constants/styles";
import {useDatabase} from "../Database/DatabaseContext";
import {supabase} from "../Database/supabaseClient";
import {FeedType} from "../Shared/feed.class";

import PageTitle from "../Shared/pageTitle";
import {Typography, Alert, AlertTitle} from "@mui/material";

/* ===================================================================
// =============================== Page ==============================
// =================================================================== */
/**
 * Seite zur E-Mail-Verifizierung (Supabase PKCE-Flow).
 *
 * Der Supabase-Client hat den Authorization-Code aus der URL bereits
 * automatisch gegen eine Session eingetauscht. Diese Seite zeigt eine
 * Erfolgsmeldung, löst die Vestaboard-Benachrichtigung aus und leitet
 * nach einem Countdown auf die Home-Seite weiter.
 */
const VerifyEmailPage = () => {
  const [timer, setTimer] = React.useState(10);
  const navigate = useNavigate();
  const classes = useCustomStyles();
  const database = useDatabase();

  // Login registrieren und Vestaboard-Benachrichtigung auslösen
  React.useEffect(() => {
    let cancelled = false;

    const onVerified = async () => {
      try {
        const user = await database.auth.getUser();
        if (!user || cancelled) return;

        // Admin-Client verwenden, da die Session nach PKCE-Austausch
        // möglicherweise noch nicht vollständig für RLS-Abfragen bereit ist.
        const users = database.admin?.users ?? database.users;
        const userDomain = await users.findById(user.id);
        if (!userDomain || cancelled) return;

        // Login-Zähler hochzählen (erster Login nach E-Mail-Verifizierung)
        await users.registerSignIn(userDomain.uid);

        // Feed-Eintrag für neuen User (nur bei Erstregistrierung, nicht bei E-Mail-Änderung)
        const {data: sessionData} = await supabase.auth.getSession();
        const isSignup = sessionData?.session?.user?.app_metadata?.provider !== "email"
          || userDomain.noLogins <= 1;
        if (isSignup) {
          database.feeds
            .insertFeed(
              {
                feedType: FeedType.userCreated,
                sourceObjectType: "user",
                sourceObjectUid: user.id,
              },
              {uid: user.id, publicProfile: {displayName: userDomain.displayName, pictureSrc: userDomain.pictureSrc ?? ""}} as any,
            )
            .catch((err) => console.warn("Feed-Eintrag konnte nicht erstellt werden:", err));
        }

        // Willkommens-E-Mail senden (nur bei Erstregistrierung)
        if (isSignup) {
          supabase.functions
            .invoke("send-welcome-email", {
              body: {user_id: user.id},
            })
            .catch((err) =>
              console.warn("Willkommens-E-Mail konnte nicht gesendet werden:", err),
            );
        }

        // Vestaboard-Benachrichtigung (nicht kritisch)
        await supabase.functions.invoke("notify-vestaboard", {
          body: {
            firstName: userDomain.firstName,
            memberId: userDomain.memberId,
          },
        });
      } catch (error) {
        console.warn("Post-verification actions failed:", error);
      }
    };

    onVerified();

    return () => {
      cancelled = true;
    };
  }, [database]);

  // Nach 10 Sekunden auf Home weiterleiten
  React.useEffect(() => {
    if (timer === 0) {
      setTimeout(() => navigate(ROUTES.HOME), 500);
    } else {
      setTimeout(() => setTimer(timer - 1), 1000);
    }
  }, [timer, navigate]);

  return (
    <React.Fragment>
      <PageTitle
        title={TEXT_AYE_AYE_CAPTAIN}
        subTitle={TEXT_THANK_YOU_FOR_VERIFYING_YOUR_EMAIL}
      />
      <Container sx={classes.container} component="main" maxWidth="xs">
        <Alert severity="info">
          <AlertTitle>{TEXT_WELCOME_ON_BOARD}</AlertTitle>
          <Typography>{TEXT_WELCOME_ON_BOARD_REDIRECT(timer)}</Typography>
        </Alert>
      </Container>
    </React.Fragment>
  );
};

export default VerifyEmailPage;
