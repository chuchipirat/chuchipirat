import React from "react";

import {
  Stack,
  Button,
  TextField,
  Checkbox,
  Radio,
  RadioGroup,
  FormControl,
  FormLabel,
  FormControlLabel,
  FormHelperText,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  useTheme,
} from "@mui/material";

import Material, {MaterialType} from "./material.class";
import {useDatabase} from "../Database/DatabaseContext";
import {FeedType} from "../Shared/feed.class";
import Role from "../../constants/roles";

import {
  DIALOG_TITLE_MATERIAL_ADD,
  DIALOG_TITLE_MATERIAL_EDIT,
  DIALOG_TEXT_MATERIAL,
  MATERIAL,
  MATERIAL_TYPE,
  MATERIAL_TYPE_CONSUMABLE,
  MATERIAL_TYPE_USAGE,
  DIALOG_EXPLANATION_MATERIAL_TYPE_CONSUMABLE,
  DIALOG_EXPLANATION_MATERIAL_TYPE_USAGE,
  FORM_GIVE_MATERIAL,
  FORM_GIVE_MATERIAL_TYPE,
  CREATE as TEXT_CREATE,
  BUTTON_SAVE,
  BUTTON_CANCEL,
  ERROR_MATERIAL_WITH_THIS_NAME_ALREADY_EXISTS,
  USABLE,
} from "../../constants/text";

import AuthUser from "../Firebase/Authentication/authUser.class";
import {ValueObject} from "../Firebase/Db/firebase.db.super.class";

/* ===================================================================
// ======================== globale Funktionen =======================
// =================================================================== */
export const MATERIAL_POP_UP_VALUES_INITIAL_STATE = {
  uid: "",
  name: "",
  type: MaterialType.none,
  usable: true,
  clear: false,
};

export enum MaterialDialog {
  CREATE = "create",
  EDIT = "edit",
}
export const MATERIAL_DIALOG_TYPE = {
  CREATE: "create",
  EDIT: "edit",
};

/* ===================================================================
// ===================== Pop Up Material hinzufügen ==================
// =================================================================== */

/**
 * Props für den DialogMaterial.
 */
interface DialogMaterialProps {
  dialogType: MaterialDialog;
  materialName: Material["name"];
  materialUid: Material["uid"];
  materialType: Material["type"];
  materialUsable: Material["usable"];
  materials: Material[];
  dialogOpen: boolean;
  handleOk: (material: Material) => void;
  handleClose: () => void;
  authUser: AuthUser;
}

/**
 * Dialog zum Erstellen und Bearbeiten eines Materials.
 * Im CREATE-Modus wird das Material via Supabase (useDatabase()) angelegt.
 * Im EDIT-Modus werden die geänderten Werte per handleOk-Callback zurückgegeben.
 *
 * @param props - DialogMaterialProps
 * @returns JSX-Element des Dialogs
 */
const DialogMaterial = ({
  dialogType,
  materialName = "",
  materialUid = "",
  materials = [],
  materialType = MaterialType.none,
  materialUsable,
  dialogOpen,
  handleOk,
  handleClose,
  authUser,
}: DialogMaterialProps) => {
  const theme = useTheme();
  const database = useDatabase();

  const [materialPopUpValues, setMaterialPopUpValues] = React.useState(
    MATERIAL_POP_UP_VALUES_INITIAL_STATE
  );
  const [validation, setValidation] = React.useState({
    name: {hasError: false, errorText: ""},
    type: {hasError: false, errorText: ""},
  });

  // Formularfelder beim Öffnen des Dialogs initialisieren
  React.useEffect(() => {
    if (!dialogOpen) return;
    setMaterialPopUpValues({
      ...MATERIAL_POP_UP_VALUES_INITIAL_STATE,
      uid: materialUid,
      name: materialName?.trim() ?? "",
      type: materialType,
      usable: materialUsable,
    });
    // Validierungsfehler zurücksetzen
    setValidation({
      name: {hasError: false, errorText: ""},
      type: {hasError: false, errorText: ""},
    });
  }, [dialogOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ------------------------------------------
  // Change Ereignis Felder
  // ------------------------------------------ */
  /**
   * Verarbeitet Änderungen am Name-Textfeld.
   *
   * @param event - Change-Event des Eingabefelds
   */
  const onChangeField = (event: React.ChangeEvent<HTMLInputElement>) => {
    const field = event.target.id.split("-")[0];
    switch (field) {
      case "name":
        setMaterialPopUpValues({
          ...materialPopUpValues,
          name: event.target.value,
          clear: false,
        });
        break;
      default:
        return;
    }
  };

  /**
   * Verarbeitet Änderungen am Materialtyp-RadioButton.
   *
   * @param event - Change-Event des Radio-Inputs
   */
  const onChangeRadioButton = (event: React.ChangeEvent<HTMLInputElement>) => {
    setMaterialPopUpValues({
      ...materialPopUpValues,
      type: parseInt((event.target as HTMLInputElement).value) as MaterialType,
      clear: false,
    });
  };

  /**
   * Verarbeitet Änderungen der Verwendbar-Checkbox.
   *
   * @param event - Change-Event der Checkbox
   */
  const onChangeCheckbox = (event: React.ChangeEvent<HTMLInputElement>) => {
    setMaterialPopUpValues({
      ...materialPopUpValues,
      usable: event.target.checked,
    });
  };

  /* ------------------------------------------
  // PopUp Abbrechen
  // ------------------------------------------ */
  const onCancelClick = () => {
    setMaterialPopUpValues({
      ...MATERIAL_POP_UP_VALUES_INITIAL_STATE,
    });
    handleClose();
  };

  /* ------------------------------------------
  // PopUp Ok - schliessen
  // ------------------------------------------ */
  const onOkClick = () => {
    // Prüfung Typ und Name gesetzt
    const tempValidation = {...validation};

    !materialPopUpValues.name
      ? (tempValidation.name = {
          hasError: true,
          errorText: FORM_GIVE_MATERIAL,
        })
      : (tempValidation.name = {hasError: false, errorText: ""});

    materialPopUpValues.type === MaterialType.none
      ? (tempValidation.type = {
          hasError: true,
          errorText: FORM_GIVE_MATERIAL_TYPE,
        })
      : (tempValidation.type = {hasError: false, errorText: ""});

    if (
      // Sicherstellen, dass nicht zwei Materialien mit demselben Namen erfasst werden
      !materialPopUpValues.uid &&
      materials.find(
        (material) =>
          material.name.toLowerCase() ==
          materialPopUpValues.name.toLowerCase().trim()
      ) !== undefined
    ) {
      tempValidation.name = {
        hasError: true,
        errorText: ERROR_MATERIAL_WITH_THIS_NAME_ALREADY_EXISTS,
      };
    }

    if (tempValidation.name.hasError || tempValidation.type.hasError) {
      setValidation(tempValidation);
      setMaterialPopUpValues({...materialPopUpValues});
    } else {
      switch (dialogType) {
        case MATERIAL_DIALOG_TYPE.CREATE:
          // Neues Material in Supabase anlegen
          database.materials
            .insertMaterial(
              {
                name: materialPopUpValues.name,
                type: materialPopUpValues.type,
                usable: true,
              },
              authUser
            )
            .then((domain) => {
              // Domain → Material-Instanz für Rückgabe an den Aufrufer
              const result = new Material();
              result.uid = domain.uid;
              result.name = domain.name;
              result.type = domain.type;
              result.usable = domain.usable;
              handleOk(result);
              setMaterialPopUpValues({
                ...MATERIAL_POP_UP_VALUES_INITIAL_STATE,
                clear: true,
              });

              // Feed-Eintrag: Material erstellt
              database.feeds
                .insertFeed(
                  {
                    feedType: FeedType.materialCreated,
                    visibility: Role.communityLeader,
                    sourceObjectType: "material",
                    sourceObjectUid: domain.uid,
                  },
                  authUser,
                )
                .catch((err) => console.warn("Feed-Eintrag konnte nicht erstellt werden:", err));
            })
            .catch((error) => {
              console.error("Fehler beim Anlegen des Materials:", error);
            });
          break;
        case MATERIAL_DIALOG_TYPE.EDIT: {
          const material = new Material();
          material.uid = materialPopUpValues.uid;
          material.name = materialPopUpValues.name;
          material.type = materialPopUpValues.type;
          material.usable = materialPopUpValues.usable;
          handleOk(material);
          setMaterialPopUpValues({
            ...MATERIAL_POP_UP_VALUES_INITIAL_STATE,
            clear: true,
          });
        }
      }
    }
  };

  /* ------------------------------------------
  // Dialog schliessen (Backdrop / ESC)
  // ------------------------------------------ */
  const onClose = (_event: ValueObject, reason: string) => {
    if (reason !== "backdropClick" && reason !== "escapeKeyDown") {
      handleClose();
    }
  };

  return (
    <Dialog
      open={dialogOpen}
      onClose={onClose}
      aria-labelledby="dialog Add Material"
    >
      <DialogTitle id="dialogAddMaterial">
        {dialogType === MATERIAL_DIALOG_TYPE.CREATE
          ? DIALOG_TITLE_MATERIAL_ADD
          : DIALOG_TITLE_MATERIAL_EDIT}
      </DialogTitle>

      <DialogContent>
        <DialogContentText sx={{marginBottom: theme.spacing(2)}}>
          {dialogType === MATERIAL_DIALOG_TYPE.CREATE && DIALOG_TEXT_MATERIAL}
        </DialogContentText>
        <Stack spacing={2}>
          <TextField
            autoComplete="off"
            error={validation.name.hasError}
            margin="dense"
            id="name"
            name="name"
            value={materialPopUpValues.name}
            required
            fullWidth
            onChange={onChangeField}
            label={MATERIAL}
            type="text"
            helperText={validation.name.errorText}
            autoFocus
          />

          <FormControl component="fieldset" error={validation.type.hasError}>
            <FormLabel component="legend">{MATERIAL_TYPE}</FormLabel>
            <RadioGroup
              aria-label="materialtyp"
              name="materialtype"
              id="materialtype"
              value={materialPopUpValues.type}
              onChange={onChangeRadioButton}
              row
            >
              <FormControlLabel
                value={MaterialType.consumable}
                control={<Radio required />}
                label={MATERIAL_TYPE_CONSUMABLE}
                id="materialtype"
              />
              <FormControlLabel
                value={MaterialType.usage}
                control={<Radio required />}
                label={MATERIAL_TYPE_USAGE}
                id="materialtype"
              />
            </RadioGroup>
            <FormHelperText>{validation.type.errorText}</FormHelperText>
          </FormControl>
          <FormHelperText>
            {DIALOG_EXPLANATION_MATERIAL_TYPE_CONSUMABLE}
          </FormHelperText>
          <FormHelperText>
            {DIALOG_EXPLANATION_MATERIAL_TYPE_USAGE}
          </FormHelperText>
          {dialogType == MATERIAL_DIALOG_TYPE.EDIT && (
            <FormControlLabel
              control={
                <Checkbox
                  checked={materialPopUpValues.usable}
                  onChange={onChangeCheckbox}
                  name="usable"
                />
              }
              label={USABLE}
            />
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancelClick} color="primary" variant="outlined">
          {BUTTON_CANCEL}
        </Button>
        <Button onClick={onOkClick} color="primary" variant="contained">
          {dialogType === MATERIAL_DIALOG_TYPE.CREATE
            ? TEXT_CREATE
            : BUTTON_SAVE}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default DialogMaterial;
