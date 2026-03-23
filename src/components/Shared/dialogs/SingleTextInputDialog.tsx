import React from "react";
import {
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Button,
  Typography,
  TextField,
  useTheme,
} from "@mui/material";

interface SingleTextInputDialogProps {
  visible: boolean;
  title: string;
  text: string | JSX.Element;
  buttonTextConfirm: string;
  buttonTextCancel: string;
  initialValue?: string;
  textInputLabel?: string;
  textInputMultiline?: boolean;
  onConfirm: (input: string) => void;
  onCancel: (input: string) => void;
}

/**
 * Dialog mit einem einzelnen Textfeld für Benutzereingaben.
 *
 * @param visible Ob der Dialog sichtbar ist.
 * @param title Dialogtitel.
 * @param text Erklärungstext.
 * @param buttonTextConfirm Text des Bestätigen-Buttons.
 * @param buttonTextCancel Text des Abbrechen-Buttons.
 * @param initialValue Anfangswert des Textfeldes.
 * @param textInputLabel Label des Textfeldes.
 * @param textInputMultiline Mehrzeilige Eingabe erlauben.
 * @param onConfirm Callback bei Bestätigung mit dem eingegebenen Text.
 * @param onCancel Callback bei Abbruch.
 */
export const SingleTextInputDialog = ({
  visible,
  title,
  text,
  buttonTextConfirm,
  buttonTextCancel,
  initialValue,
  textInputLabel,
  textInputMultiline,
  onConfirm,
  onCancel,
}: SingleTextInputDialogProps) => {
  const theme = useTheme();
  const [userInput, setUserInput] = React.useState("");

  // Initialwert setzen wenn Dialog geöffnet wird
  React.useEffect(() => {
    if (initialValue) {
      setUserInput(initialValue);
    }
  }, [initialValue]);

  const handleConfirm = () => {
    onConfirm(userInput);
    setUserInput("");
  };

  const handleCancel = () => {
    onCancel("");
    setUserInput("");
  };

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setUserInput(event.target.value);
  };

  return (
    <Dialog open={visible} maxWidth="xs" fullWidth>
      {title !== "" && (
        <DialogTitle id="dialogTitle">{title}</DialogTitle>
      )}
      <DialogContent>
        <Typography sx={{marginBottom: theme.spacing(1)}}>{text}</Typography>
        <TextField
          fullWidth
          autoFocus
          id="userInput"
          name="userInput"
          label={textInputLabel}
          value={userInput}
          onChange={handleChange}
          multiline={textInputMultiline}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={handleCancel} color="primary" variant="outlined">
          {buttonTextCancel}
        </Button>
        <Button
          onClick={handleConfirm}
          color="primary"
          variant="contained"
          disabled={!userInput}
        >
          {buttonTextConfirm}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
