import React from "react";

import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Typography,
  Button,
  TextField,
} from "@mui/material";
import {
  REPORT_ERROR as TEXT_REPORT_ERROR,
  REPORT_ERROR_DESCIRPTION as TEXT_REPORT_ERROR_DESCIRPTION,
  ERROR_DESCRIPTION as TEXT_ERROR_DESCRIPTION,
  THIS_FIELD_CANT_BE_EMPTY as TEXT_THIS_FIELD_CANT_BE_EMPTY,
  CANCEL as TEXT_CANCEL,
} from "../../constants/text";

/* ===================================================================
// ======================= Pop Up Fehler melden ======================
// =================================================================== */
interface DialogReportErrorProps {
  dialogOpen: boolean;
  handleOk: (messageForReview: string) => void;
  handleClose: () => void;
}
/**
 * Dialog zum Melden eines Fehlers in einem Rezept.
 *
 * Zeigt ein Textfeld für die Fehlerbeschreibung an. Das Feld ist
 * Pflicht — bei leerem Inhalt wird eine Fehlermeldung angezeigt.
 *
 * @param props - Dialog-Steuerung und Callback-Handler.
 */
export const DialogReportError = ({
  dialogOpen,
  handleOk,
  handleClose,
}: DialogReportErrorProps) => {
  const [formFields, setFormFields] = React.useState({
    messageForReview: "",
    isError: false,
    initial: true,
  });
  /* ------------------------------------------
  // Change Ereignis Felder
  // ------------------------------------------ */
  const onChangeField = (
    event: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>
  ) => {
    setFormFields({
      ...formFields,
      messageForReview: event.target.value,
      initial: false,
    });
  };
  /* ------------------------------------------
  // PopUp Ok
  // ------------------------------------------ */
  const onOkClick = () => {
    if (!formFields.messageForReview) {
      setFormFields({...formFields, isError: true});
      return;
    }

    setFormFields({...formFields, initial: true});
    handleOk(formFields.messageForReview);
  };
  /* ------------------------------------------
  // PopUp Abbrechen
  // ------------------------------------------ */
  const onCancelClick = () => {
    handleClose();
  };

  return (
    <Dialog
      open={dialogOpen}
      onClose={handleClose}
      aria-labelledby="dialogReportError"
      fullWidth={true}
      maxWidth="sm"
    >
      <DialogTitle id="dialogReportErrorTitle">{TEXT_REPORT_ERROR}</DialogTitle>
      <DialogContent>
        <Typography>{TEXT_REPORT_ERROR_DESCIRPTION}</Typography>
        <br />
        <TextField
          margin="dense"
          id="messageForReview"
          name="messageForReview"
          value={formFields.messageForReview}
          multiline
          fullWidth
          minRows={3}
          maxRows={10}
          onChange={onChangeField}
          variant="outlined"
          label={TEXT_ERROR_DESCRIPTION}
          required
          error={formFields.isError}
          helperText={formFields.isError ? TEXT_THIS_FIELD_CANT_BE_EMPTY : ""}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancelClick} variant="outlined">
          {TEXT_CANCEL}
        </Button>
        <Button onClick={onOkClick} variant="contained" color="primary">
          {TEXT_REPORT_ERROR}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

