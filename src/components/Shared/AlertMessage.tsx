import React from "react";
import {Alert, AlertColor, AlertTitle} from "@mui/material";
import FirebaseMessageHandler from "../Firebase/firebaseMessageHandler.class";
import SupabaseMessageHandler from "../Database/supabaseMessageHandler.class";
import useCustomStyles from "../../constants/styles";

interface AlertMessageProps {
  error?: Error | null;
  severity?: AlertColor;
  messageTitle?: string;
  body?: string | JSX.Element;
}

/* ===================================================================
// =============================== Alert =============================
// =================================================================== */
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
    <React.Fragment>
      <Alert severity={severity} sx={classes.alertMessage}>
        {messageTitle && <AlertTitle>{messageTitle}</AlertTitle>}
        <React.Fragment>
          {translatedError}
          {body}
        </React.Fragment>
      </Alert>
    </React.Fragment>
  );
};

export default AlertMessage;
