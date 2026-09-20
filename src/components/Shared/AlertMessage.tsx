import {Alert, AlertColor, AlertTitle, Button} from "@mui/material";
import SupabaseMessageHandler from "../Database/supabaseMessageHandler.class";
import {useCustomStyles} from "../../constants/styles";
import {isMissingSessionError} from "../../utils/errorUtils";
import {BUTTON_RELOAD_PAGE as TEXT_BUTTON_RELOAD_PAGE} from "../../constants/text";

/**
 * Eigenschaften für die AlertMessage-Komponente.
 *
 * @param error Optionaler Fehler — wird via SupabaseMessageHandler übersetzt.
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

  const translatedError = error
    ? SupabaseMessageHandler.translateMessage(error)
    : null;

  // Eine fehlende/abgelaufene Sitzung heilt sich durch ein Neuladen der
  // Seite selbst (der nächste Aufruf nutzt ein aufgefrischtes Token) — dem
  // Nutzer direkt eine passende Aktion anbieten, statt ihn auf einer
  // Fehlermeldung ohne nächsten Schritt sitzen zu lassen.
  const showReloadAction = isMissingSessionError(error);

  return (
    <Alert severity={severity} sx={classes.alertMessage}>
      {messageTitle && <AlertTitle>{messageTitle}</AlertTitle>}
      {translatedError}
      {body}
      {showReloadAction && (
        <Button
          variant="outlined"
          size="small"
          sx={{marginTop: 1}}
          onClick={() => window.location.reload()}
        >
          {TEXT_BUTTON_RELOAD_PAGE}
        </Button>
      )}
    </Alert>
  );
};

export {AlertMessage};
