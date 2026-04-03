import React from "react";
import * as Sentry from "@sentry/react";

import {
  Alert,
  Button,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
} from "@mui/material";

import {Utils} from "../Shared/utils.class";
import {User} from "./user.class";

import {
  GIVE_VALID_EMAIL as TEXT_GIVE_VALID_EMAIL,
  ADD_PERSON_TO_TEAM as TEXT_ADD_PERSON_TO_TEAM,
  USER_ADD_BY_EMAIL as TEXT_USER_ADD_BY_EMAIL,
  USER_MUST_BE_REGISTERED as TEXT_USER_MUST_BE_REGISTERED,
  BUTTON_CANCEL as TEXT_BUTTON_CANCEL,
  BUTTON_ADD as TEXT_BUTTON_ADD,
  EMAIL as TEXT_EMAIL,
  YOU_CANNOT_ADD_YOURSELF as TEXT_YOU_CANNOT_ADD_YOURSELF,
  ERROR_GENERIC as TEXT_ERROR_GENERIC,
} from "../../constants/text";

import AuthUser from "../Firebase/Authentication/authUser.class";
import DatabaseService from "../Database/DatabaseService";

/* ===================================================================
// ====================== Pop Up User hinzufügen =====================
// =================================================================== */

/**
 * Props für den Dialog zum Hinzufügen eines Benutzers.
 *
 * @param database - DatabaseService-Instanz für Supabase-Zugriff.
 * @param authUser - Der aktuell angemeldete Benutzer.
 * @param dialogOpen - Steuert, ob der Dialog sichtbar ist.
 * @param handleAddUser - Callback, wird mit der UID des gefundenen Users aufgerufen.
 * @param handleClose - Callback zum Schliessen des Dialogs.
 */
interface DialogAddUserProps {
  database: DatabaseService;
  authUser: AuthUser;
  /** Optionale Event-ID für Koch-Berechtigungsprüfung bei E-Mail-Suche. */
  eventId?: string;
  dialogOpen: boolean;
  handleAddUser: (userUid: string) => void;
  handleClose: () => void;
}

/**
 * Dialog zum Hinzufügen eines Benutzers anhand seiner E-Mail-Adresse.
 *
 * Prüft die eingegebene E-Mail, verhindert das Hinzufügen der eigenen
 * Adresse und sucht die UID des eingegebenen Users in der Datenbank.
 */
const DialogAddUser = ({
  database,
  authUser,
  eventId,
  dialogOpen,
  handleAddUser,
  handleClose,
}: DialogAddUserProps) => {
  const [userEmail, setUserEmail] = React.useState("");
  const [formValidationState, setFormValidationState] = React.useState({
    error: false,
    errorText: "",
  });
  const [infoBox, setInfoBox] = React.useState({visible: false, text: ""});

  /* ------------------------------------------
  // OnChange
  // ------------------------------------------ */
  const onEmailChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setUserEmail(event.target.value);
  };
  /* ------------------------------------------
  // Go
  // ------------------------------------------ */
  const onSubmit = async (event?: React.FormEvent) => {
    if (event) {
      event.preventDefault();
    }

    if (Utils.isEmail(userEmail)) {
      if (userEmail.toLowerCase() === authUser.email.toLowerCase()) {
        setInfoBox({visible: true, text: TEXT_YOU_CANNOT_ADD_YOURSELF});
        return;
      }

      // UID aus E-Mail-Adresse ermitteln
      await User.getUidByEmail({
        database: database,
        email: userEmail.toLocaleLowerCase(),
        eventId: eventId,
      })
        .then((result) => {
          handleAddUser(result);
          setUserEmail("");
        })
        .catch((error) => {
          Sentry.captureException(error);
          setInfoBox({visible: true, text: TEXT_ERROR_GENERIC});
        });
    } else {
      setFormValidationState({
        error: true,
        errorText: TEXT_GIVE_VALID_EMAIL,
      });
    }
  };
  const onCancel = () => {
    setUserEmail("");
    handleClose();
  };
  return (
    <Dialog
      open={dialogOpen}
      onClose={handleClose}
      aria-labelledby="Benutzer*in hinzufügen"
    >
      <form onSubmit={onSubmit}>
        <DialogTitle id="form-dialog-title">
          {TEXT_ADD_PERSON_TO_TEAM}
        </DialogTitle>
        <DialogContent>
          <DialogContentText>{TEXT_USER_ADD_BY_EMAIL}</DialogContentText>
          <DialogContentText>{TEXT_USER_MUST_BE_REGISTERED}</DialogContentText>
          <TextField
            autoFocus
            margin="dense"
            id="cook_email"
            error={formValidationState.error}
            helperText={formValidationState.errorText}
            required
            fullWidth
            value={userEmail}
            onChange={onEmailChange}
            label={TEXT_EMAIL}
            type="text"
          />
          {infoBox.visible && (
            <Alert severity="warning" style={{marginTop: "1rem"}}>
              {infoBox.text}
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button
            type="button"
            onClick={onCancel}
            color="primary"
            variant="outlined"
          >
            {TEXT_BUTTON_CANCEL}
          </Button>
          <Button type="submit" color="primary" variant="contained">
            {TEXT_BUTTON_ADD}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};

export {DialogAddUser};
export type {DialogAddUserProps};
