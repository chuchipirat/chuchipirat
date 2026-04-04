import React from "react";

import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";

import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";

import {DepartmentDomain} from "../Database/Repository/DepartmentRepository";
import {
  GIVE_DEPARTMENT_NAME as TEXT_GIVE_DEPARTMENT_NAME,
  CREATE_DEPARTMENT as TEXT_CREATE_DEPARTMENT,
  DEPARTMENT as TEXT_DEPARTMENT,
  DEPARTMENT_ALREADY_EXISTS as TEXT_DEPARTMENT_ALREADY_EXISTS,
  CANCEL as TEXT_CANCEL,
  CREATE as TEXT_CREATE,
} from "../../constants/text";
import AuthUser from "../Firebase/Authentication/authUser.class";
import {useDatabase} from "../Database/DatabaseContext";

/**
 * Initialzustand des Formulars für den Abteilungs-Dialog.
 */
export const DEPARTMENT_INITIAL_STATE = {
  name: "",
};

/**
 * Props für den Dialog zum Erstellen einer neuen Abteilung.
 *
 * @param authUser - Der aktuell authentifizierte Benutzer.
 * @param dialogOpen - Ob der Dialog geöffnet ist.
 * @param existingNames - Liste der bereits vorhandenen Abteilungsnamen (für Duplikat-Prüfung).
 * @param handleCreate - Callback, der nach erfolgreicher Erstellung aufgerufen wird.
 * @param handleClose - Callback zum Schliessen des Dialogs.
 * @param handleError - Callback für Fehlerbehandlung.
 * @param nextHigherPos - Nächste freie Position für die Sortierung.
 */
interface DialogDepartmentProps {
  authUser: AuthUser;
  dialogOpen: boolean;
  existingNames: string[];
  handleCreate: (department: DepartmentDomain) => void;
  handleClose: () => void;
  handleError: (error: Error) => void;
  nextHigherPos: number;
}

/**
 * Dialog-Komponente zum Erstellen einer neuen Abteilung.
 * Validiert den Namen auf Pflichtfeld und Duplikate,
 * erstellt die Abteilung über die Datenbank und gibt das
 * Ergebnis an den Eltern-Callback zurück.
 */
export const DialogDepartment = ({
  authUser,
  dialogOpen,
  existingNames,
  handleCreate,
  handleClose,
  handleError,
  nextHigherPos = 99,
}: DialogDepartmentProps) => {
  const database = useDatabase();
  const [formFields, setFormFields] = React.useState(DEPARTMENT_INITIAL_STATE);
  const [validation, setValidation] = React.useState({
    name: {hasError: false, errorText: ""},
  });

  // Formular und Validierung zurücksetzen, wenn der Dialog geöffnet wird
  React.useEffect(() => {
    if (dialogOpen) {
      setFormFields(DEPARTMENT_INITIAL_STATE);
      setValidation({name: {hasError: false, errorText: ""}});
    }
  }, [dialogOpen]);

  const onChangeField = (event: React.ChangeEvent<HTMLInputElement>) => {
    const field = event.target.id.split("-")[0];

    setFormFields({
      ...formFields,
      [field]: event.target.value,
    });
  };

  const onOkClick = () => {
    let hasError = false;

    // Prüfung: Name ausgefüllt
    if (!formFields.name) {
      setValidation({
        ...validation,
        name: {
          hasError: true,
          errorText: TEXT_GIVE_DEPARTMENT_NAME,
        },
      });
      hasError = true;
    }

    // Prüfung: Duplikat (case-insensitive)
    const trimmedName = formFields.name.trim();
    if (
      !hasError &&
      existingNames.some(
        (name) => name.toLowerCase() === trimmedName.toLowerCase()
      )
    ) {
      setValidation({
        ...validation,
        name: {
          hasError: true,
          errorText: TEXT_DEPARTMENT_ALREADY_EXISTS,
        },
      });
      hasError = true;
    }

    if (hasError) {
      return;
    }

    // Neue Abteilung anlegen
    database.departments
      .createDepartment(formFields.name, nextHigherPos, authUser)
      .then((result) => {
        handleCreate({
          uid: result.id,
          name: result.value.name,
          pos: result.value.pos,
          usable: result.value.usable,
        });
        setFormFields(DEPARTMENT_INITIAL_STATE);
      })
      .catch((error) => {
        handleError(error);
      });
  };

  const onCancelClick = () => {
    handleClose();
  };

  return (
    <Dialog
      open={dialogOpen}
      onClose={handleClose}
      aria-labelledby="dialogDeparment"
      maxWidth="xs"
      fullWidth
    >
      <DialogTitle id="dialogTitleDeparment">
        {TEXT_CREATE_DEPARTMENT}
      </DialogTitle>
      <DialogContent>
        <TextField
          error={validation.name.hasError}
          margin="dense"
          id="name"
          name="name"
          value={formFields.name}
          required
          fullWidth
          onChange={onChangeField}
          label={TEXT_DEPARTMENT}
          type="text"
          helperText={validation.name.errorText}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancelClick} color="primary" variant="outlined">
          {TEXT_CANCEL}
        </Button>
        <Button onClick={onOkClick} color="primary" variant="contained">
          {TEXT_CREATE}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
