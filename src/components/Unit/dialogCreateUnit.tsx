import React from "react";

import {
  Button,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
} from "@mui/material";

import {
  GIVE_UNIT as TEXT_GIVE_UNIT,
  UNIT_CREATE as TEXT_UNIT_CREATE,
  UNIT_CREATE_EXPLANATION as TEXT_UNIT_CREATE_EXPLANATION,
  UNIT_ABREVIATION as TEXT_UNIT_ABREVIATION,
  UNIT as TEXT_UNIT,
  CANCEL as TEXT_CANCEL,
  CREATE as TEXT_CREATE,
} from "../../constants/text";
import {Unit, UnitDimension} from "./unit.class";

/* ===================================================================
// ======================== globale Funktionen =======================
// =================================================================== */
const UNIT_ADD_INITIAL_STATE = {
  key: "",
  name: "",
};
/* ===================================================================
// ===================== Pop Up Einheit hinzufügen ===================
// =================================================================== */
interface DialogCreateUnitProps {
  dialogOpen: boolean;
  handleCreate: (unit: Unit) => void;
  handleClose: () => void;
}
const DialogCreateUnit = ({
  dialogOpen,
  handleCreate,
  handleClose,
}: DialogCreateUnitProps) => {
  const [formFields, setFormFields] = React.useState(UNIT_ADD_INITIAL_STATE);

  const [validation, setValidation] = React.useState({
    key: {hasError: false, errorText: ""},
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
    // Prüfung ob Abkürzung und Name gesetzt sind
    const nameError = !formFields.name;
    const keyError = !formFields.key;

    if (nameError || keyError) {
      setValidation({
        name: {
          hasError: nameError,
          errorText: nameError ? TEXT_GIVE_UNIT : "",
        },
        key: {
          hasError: keyError,
          errorText: keyError ? TEXT_GIVE_UNIT : "",
        },
      });
      return;
    }
    handleCreate({
      key: formFields.key,
      name: formFields.name,
      dimension: UnitDimension.dimensionless,
    });
    setFormFields(UNIT_ADD_INITIAL_STATE);
  };
  /* ------------------------------------------
  // PopUp Abbrechen
  // ------------------------------------------ */
  const onCancelClick = () => {
    setFormFields(UNIT_ADD_INITIAL_STATE);
    setValidation({
      key: {hasError: false, errorText: ""},
      name: {hasError: false, errorText: ""},
    });
    handleClose();
  };

  /** Formular-Submit — verhindert Seitenreload und delegiert an onOkClick. */
  const onSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    onOkClick();
  };

  return (
    <Dialog
      open={dialogOpen}
      onClose={onCancelClick}
      aria-labelledby="dialogAddUnit"
    >
      <form onSubmit={onSubmit}>
        <DialogTitle id="dialogAddUnit">{TEXT_UNIT_CREATE}</DialogTitle>
        <DialogContent>
          <DialogContentText>{TEXT_UNIT_CREATE_EXPLANATION}</DialogContentText>
          <TextField
            error={validation.key.hasError}
            margin="dense"
            id="key"
            name="key"
            value={formFields.key}
            required
            fullWidth
            onChange={onChangeField}
            label={TEXT_UNIT_ABREVIATION}
            type="text"
            helperText={validation.key.errorText}
            autoComplete="off"
          />
          <TextField
            error={validation.name.hasError}
            margin="dense"
            id="name"
            name="name"
            value={formFields.name}
            required
            fullWidth
            onChange={onChangeField}
            label={TEXT_UNIT}
            type="text"
            helperText={validation.name.errorText}
            autoComplete="off"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={onCancelClick} color="primary" variant="outlined" type="button">
            {TEXT_CANCEL}
          </Button>
          <Button color="primary" variant="contained" type="submit">
            {TEXT_CREATE}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};

export {DialogCreateUnit};
