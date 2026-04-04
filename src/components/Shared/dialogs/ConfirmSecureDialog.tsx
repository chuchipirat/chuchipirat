import React from "react";
import {
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Button,
  TextField,
  Box,
} from "@mui/material";
import WarningIcon from "@mui/icons-material/Warning";
import {useCustomStyles} from "../../../constants/styles";
import {
  DIALOG_DELETION_CONFIRMATION_STRING_DOES_NOT_MATCH as TEXT_DIALOG_DELETION_CONFIRMATION_STRING_DOES_NOT_MATCH,
  REQUIRED as TEXT_REQUIRED,
} from "../../../constants/text";

interface ConfirmSecureDialogProps {
  visible: boolean;
  title: string;
  subtitle: string;
  text: string | JSX.Element;
  buttonTextConfirm: string;
  buttonTextCancel: string;
  confirmationString?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Sicherer Lösch-Dialog — der Benutzer muss einen Bestätigungstext eingeben,
 * bevor die Löschung durchgeführt werden kann.
 *
 * @param visible Ob der Dialog sichtbar ist.
 * @param title Dialogtitel (mit Warn-Icon).
 * @param subtitle Untertitel mit weiteren Erklärungen.
 * @param text Anweisungstext (z.B. "Bitte tippe … ein").
 * @param buttonTextConfirm Text des Löschen-Buttons.
 * @param buttonTextCancel Text des Abbrechen-Buttons.
 * @param confirmationString Der exakte Text, den der Benutzer eingeben muss.
 * @param onConfirm Callback bei bestätigter Löschung.
 * @param onCancel Callback bei Abbruch.
 */
export const ConfirmSecureDialog = ({
  visible,
  title,
  subtitle,
  text,
  buttonTextConfirm,
  buttonTextCancel,
  confirmationString,
  onConfirm,
  onCancel,
}: ConfirmSecureDialogProps) => {
  const classes = useCustomStyles();

  const [inputValue, setInputValue] = React.useState("");
  const [inputMatches, setInputMatches] = React.useState(false);
  const [validation, setValidation] = React.useState({
    hasError: false,
    errorText: "",
  });

  // Ref für setTimeout-Cleanup
  const matchTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(
    null
  );

  React.useEffect(() => {
    return () => {
      if (matchTimeoutRef.current !== null) {
        clearTimeout(matchTimeoutRef.current);
      }
    };
  }, []);

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    setInputValue(value);
    setInputMatches(false);

    if (value === confirmationString) {
      // Kurzer Wait — macht einem nochmals klar, dass gelöscht wird!
      matchTimeoutRef.current = setTimeout(() => {
        setInputMatches(true);
      }, 300);
    }

    if (!value) {
      setValidation({hasError: true, errorText: TEXT_REQUIRED});
    } else if (value !== confirmationString) {
      setValidation({
        hasError: true,
        errorText: TEXT_DIALOG_DELETION_CONFIRMATION_STRING_DOES_NOT_MATCH,
      });
    } else {
      setValidation({hasError: false, errorText: ""});
    }
  };

  const handleConfirm = () => {
    resetState();
    onConfirm();
  };

  const handleCancel = () => {
    resetState();
    onCancel();
  };

  const resetState = () => {
    setInputValue("");
    setInputMatches(false);
    setValidation({hasError: false, errorText: ""});
  };

  return (
    <Dialog
      open={visible}
      onClose={handleCancel}
      aria-labelledby="confirm-dialog"
    >
      <DialogTitle
        id="dialogDeletionConfirmation"
        sx={classes.dialogDeletionConfirmationTitle}
      >
        <Box
          component="div"
          style={{
            display: "flex",
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <WarningIcon sx={classes.dialogDeletionConfirmationWarningIcon} />
          <span>{title}</span>
        </Box>
        <DialogContentText sx={classes.dialogDeletionConfirmationText}>
          {subtitle}
        </DialogContentText>
      </DialogTitle>
      <DialogContent>
        {text} <strong>{confirmationString}</strong>
        <TextField
          error={validation.hasError}
          margin="dense"
          id="confirmationString"
          name="confirmationString"
          value={inputValue}
          autoFocus
          required
          fullWidth
          onChange={handleInputChange}
          variant="outlined"
          placeholder={confirmationString}
          type="text"
          helperText={validation.errorText}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={handleCancel}>{buttonTextCancel}</Button>
        <Button
          sx={classes.dialogDeletedeleteButton}
          disabled={!inputMatches}
          onClick={handleConfirm}
          variant="contained"
        >
          {buttonTextConfirm}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
