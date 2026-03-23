import React from "react";
import {Alert, AlertColor, AlertTitle} from "@mui/material";
import FirebaseMessageHandler from "../Firebase/firebaseMessageHandler.class";
import SupabaseMessageHandler from "../Database/supabaseMessageHandler.class";
import {useCustomStyles} from "../../constants/styles";

/**
 * Eigenschaften für die AlertMessage-Komponente.
 *
 * @param error Optionaler Fehler — wird via Firebase/Supabase-MessageHandler übersetzt.
 * @param severity Schweregrad der Meldung (Standard: "error").
 * @param messageTitle Optionaler Titel der Alert-Meldung.
 * @param body Optionaler Inhalt als Text oder JSX.
 */
interface AlertMessageProps {
  error?: Error | null;
  severity?: AlertColor;
  messageTitle?: string;
  body?: string | JSX.Element;
}

/* ===================================================================
// =============================== Alert =============================
// =================================================================== */
/**
 * Zeigt eine Alert-Meldung mit optionalem Titel, Fehlerübersetzung und Body an.
 *
 * @param error Optionaler Fehler.
 * @param severity Schweregrad (Standard: "error").
 * @param messageTitle Optionaler Titel.
 * @param body Optionaler Inhalt.
 */
const AlertMessage = ({
  error,
  severity = "error",
  messageTitle = "",
  body,
}: AlertMessageProps) => {
  const classes = useCustomStyles();

  // Firebase-Code zuerst prüfen, dann Supabase-Nachricht
  const translatedError = error
    ? FirebaseMessageHandler.translateMessage(error) ??
      SupabaseMessageHandler.translateMessage(error)
    : null;

  return (
    <Alert severity={severity} sx={classes.alertMessage}>
      {messageTitle && <AlertTitle>{messageTitle}</AlertTitle>}
      {translatedError}
      {body}
    </Alert>
  );
};

export {AlertMessage};
