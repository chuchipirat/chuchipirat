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
  CANCEL as TEXT_CANCEL,
  CREATE as TEXT_CREATE,
} from "../../constants/text";
import AuthUser from "../Firebase/Authentication/authUser.class";
import {useDatabase} from "../Database/DatabaseContext";

/* ===================================================================
// ======================== globale Funktionen =======================
// =================================================================== */
export const DEPARTMENT_INITIAL_STATE = {
  name: "",
};
/* ===================================================================
// ==================== Pop Up Abteilung hinzufügen ==================
// =================================================================== */
interface DialogDepartmentProps {
  authUser: AuthUser;
  dialogOpen: boolean;
  handleCreate: (department: DepartmentDomain) => void;
  handleClose: () => void;
  handleError: (error: Error) => void;
  nextHigherPos: number;
}
const DialogDepartment = ({
  authUser,
  dialogOpen,
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

  /* ------------------------------------------
  // Change Ereignis Felder
  // ------------------------------------------ */
  const onChangeField = (event: React.ChangeEvent<HTMLInputElement>) => {
    const field = event.target.id.split("-")[0];

    setFormFields({
      ...formFields,
      [field]: event.target.value,
    });
  };
  /* ------------------------------------------
  // PopUp Ok
  // ------------------------------------------ */
  const onOkClick = () => {
    //  Prüfung Name ausgefüllt
    let hasError = false;
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

export default DialogDepartment;
