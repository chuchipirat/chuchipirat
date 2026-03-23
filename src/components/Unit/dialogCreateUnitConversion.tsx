import React from "react";

import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Autocomplete,
  Button,
  TextField,
  Alert,
  AlertTitle,
} from "@mui/material";
import Grid from "@mui/material/Grid";

import {
  DENOMINATOR as TEXT_DENOMINATOR,
  NUMERATOR as TEXT_NUMERATOR,
  GIVE_PRODUCT as TEXT_GIVE_PRODUCT,
  GIVE_GREATE_ZERO as TEXT_GIVE_GREATE_ZERO,
  GIVE_UNIT as TEXT_GIVE_UNIT,
  CREATE_NEW_UNIT_CONVERSION as TEXT_CREATE_NEW_UNIT_CONVERSION,
  METRIC_SYSTEM as TEXT_METRIC_SYSTEM,
  HINT_CREATE_IN_METRIC_SYSTEM as TEXT_HINT_CREATE_IN_METRIC_SYSTEM,
  PRODUCT as TEXT_PRODUCT,
  UNIT_FROM as TEXT_UNIT_FROM,
  UNIT_TO as TEXT_UNIT_TO,
  CANCEL as TEXT_CANCEL,
  CREATE as TEXT_CREATE,
  ERROR_UNIT_CONVERSION_TYPE_MISSING as TEXT_ERROR_UNIT_CONVERSION_TYPE_MISSING,
} from "../../constants/text";
import {Product} from "../Product/product.types";
import {Unit} from "./unit.class";
import {
  UnitConversion,
  SingleUnitConversionBasic,
  SingleUnitConversionProduct,
} from "./unitConversion.class";

/* ===================================================================
// ======================== globale Funktionen =======================
// =================================================================== */
interface UnitConversionAdd {
  product: Product | null;
  denominator: string;
  fromUnit: Unit | null;
  numerator: string;
  toUnit: Unit | null;
}
const UNIT_CONVERSION_ADD_INITIAL_STATE: UnitConversionAdd = {
  product: null,
  denominator: "",
  fromUnit: null,
  numerator: "",
  toUnit: null,
};

const UNIT_CONVERSION_VALIDATION_INITIAL_STATE = {
  product: {hasError: false, helperText: ""},
  denominator: {hasError: false, helperText: ""},
  fromUnit: {hasError: false, helperText: ""},
  numerator: {hasError: false, helperText: ""},
  toUnit: {hasError: false, helperText: ""},
};

/**
 * Art der Umrechnung im Erstellungsdialog.
 */
export enum UnitConversionType {
  NONE = "none",
  BASIC = "basic",
  PRODUCT = "product",
}

export interface HandleCreateProps {
  unitConversion: SingleUnitConversionBasic | SingleUnitConversionProduct;
}

/* ===================================================================
// ===================== Pop Up Einheit hinzufügen ===================
// =================================================================== */
interface DialogCreateUnitConversionProps {
  units: Unit[];
  products: Product[];
  dialogOpen: boolean;
  unitConversionType: UnitConversionType;
  handleCreate: (unitConversion: UnitConversion) => void;
  handleClose: () => void;
}
const DialogCreateUnitConversion = ({
  units,
  products,
  dialogOpen,
  unitConversionType,
  handleCreate,
  handleClose,
}: DialogCreateUnitConversionProps) => {
  const [formFields, setFormFields] = React.useState(
    UNIT_CONVERSION_ADD_INITIAL_STATE
  );
  const [validation, setValidation] = React.useState(
    UNIT_CONVERSION_VALIDATION_INITIAL_STATE
  );

  /* ------------------------------------------
  // Change Ereignis Felder
  // ------------------------------------------ */
  const onChangeField = (
    event: React.ChangeEvent<HTMLInputElement>,
    newValue?: Product | Unit | null
  ) => {
    let value: string | Product | Unit | null;
    const field = event.target.id.split("-")[0];

    switch (field) {
      // Textfield und Autocomplete sind unterschiedlich
      case "product":
      case "fromUnit":
      case "toUnit":
        value = newValue ?? null;
        break;
      case "denominator":
      case "numerator":
        value = event.target.value;
        break;
      default:
        return;
    }
    setFormFields({
      ...formFields,
      [field]: value,
    });
  };
  /* ------------------------------------------
  // PopUp Abbrechen
  // ------------------------------------------ */
  const onOkClick = () => {
    if (!isInputValid()) {
      return;
    }

    let newUnitConversion: UnitConversion;

    switch (unitConversionType) {
      case UnitConversionType.BASIC:
        newUnitConversion = UnitConversion.createUnitConversionBasic({
          denominator: parseInt(formFields.denominator, 10),
          numerator: parseInt(formFields.numerator, 10),
          fromUnit: formFields.fromUnit?.key as Unit["key"],
          toUnit: formFields.toUnit?.key as Unit["key"],
        });
        break;
      case UnitConversionType.PRODUCT:
        newUnitConversion = UnitConversion.createUnitConversionProduct({
          product: formFields.product!,
          denominator: parseInt(formFields.denominator, 10),
          numerator: parseInt(formFields.numerator, 10),
          fromUnit: formFields.fromUnit?.key as Unit["key"],
          toUnit: formFields.toUnit?.key as Unit["key"],
        });
        break;
      default:
        throw new Error(TEXT_ERROR_UNIT_CONVERSION_TYPE_MISSING);
    }

    handleCreate(newUnitConversion);
    setFormFields(UNIT_CONVERSION_ADD_INITIAL_STATE);
    setValidation(UNIT_CONVERSION_VALIDATION_INITIAL_STATE);
  };
  /* ------------------------------------------
  // Validation
  // ------------------------------------------ */
  const isInputValid = () => {
    let hasError = false;
    const validationCheck = validation;

    // Prüfung ob Werte gesetzt
    if (
      unitConversionType === UnitConversionType.PRODUCT &&
      !formFields.product
    ) {
      validationCheck.product = {
        hasError: true,
        helperText: TEXT_GIVE_PRODUCT,
      };
      hasError = true;
    } else {
      validationCheck.product = {
        hasError: false,
        helperText: "",
      };
    }
    if (!formFields.denominator || parseInt(formFields.denominator, 10) <= 0) {
      validationCheck.denominator = {
        hasError: true,
        helperText: TEXT_GIVE_GREATE_ZERO,
      };
      hasError = true;
    } else {
      validationCheck.denominator = {
        hasError: false,
        helperText: "",
      };
    }
    if (!formFields.numerator || parseInt(formFields.numerator, 10) <= 0) {
      validationCheck.numerator = {
        hasError: true,
        helperText: TEXT_GIVE_GREATE_ZERO,
      };
      hasError = true;
    } else {
      validationCheck.numerator = {
        hasError: false,
        helperText: "",
      };
    }
    if (!formFields.fromUnit) {
      validationCheck.fromUnit = {
        hasError: true,
        helperText: TEXT_GIVE_UNIT,
      };
      hasError = true;
    } else {
      validationCheck.fromUnit = {
        hasError: false,
        helperText: "",
      };
    }
    if (!formFields.toUnit) {
      validationCheck.toUnit = {
        hasError: true,
        helperText: TEXT_GIVE_UNIT,
      };
      hasError = true;
    } else {
      validationCheck.toUnit = {
        hasError: false,
        helperText: "",
      };
    }

    setValidation({
      product: validationCheck.product,
      denominator: validationCheck.denominator,
      numerator: validationCheck.numerator,
      fromUnit: validationCheck.fromUnit,
      toUnit: validationCheck.toUnit,
    });

    // Wenn Fehler, ist Input nicht valide
    return !hasError;
  };
  /* ------------------------------------------
  // PopUp Ok
  // ------------------------------------------ */
  const onCancelClick = () => {
    setFormFields(UNIT_CONVERSION_ADD_INITIAL_STATE);
    setValidation(UNIT_CONVERSION_VALIDATION_INITIAL_STATE);
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
      aria-labelledby="dialogAddUnitConversion"
    >
      <form onSubmit={onSubmit}>
        <DialogTitle id="dialogAddUnitConversion">
          {TEXT_CREATE_NEW_UNIT_CONVERSION}
        </DialogTitle>
      <DialogContent>
        {unitConversionType === UnitConversionType.PRODUCT && (
          <Alert severity="info">
            <AlertTitle>{TEXT_METRIC_SYSTEM}</AlertTitle>
            {TEXT_HINT_CREATE_IN_METRIC_SYSTEM}
          </Alert>
        )}
        <Grid container spacing={2}>
          {unitConversionType === UnitConversionType.PRODUCT && (
            <Grid size={12}>
              <Autocomplete
                id={"product"}
                value={formFields.product}
                options={products}
                autoSelect
                autoHighlight
                getOptionLabel={(product) => product.name}
                onChange={(event, newValue) => {
                  onChangeField(
                    event as React.ChangeEvent<HTMLInputElement>,
                    newValue
                  );
                }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    margin="normal"
                    label={TEXT_PRODUCT}
                    error={validation.product.hasError}
                    helperText={validation.product.helperText}
                  />
                )}
              />
            </Grid>
          )}
          <Grid size={6}>
            <TextField
              error={validation.denominator.hasError}
              margin="normal"
              id="denominator"
              name="denominator"
              value={formFields.denominator}
              required
              fullWidth
              onChange={onChangeField}
              label={TEXT_DENOMINATOR}
              type="number"
              helperText={validation.denominator.helperText}
            />
          </Grid>
          <Grid size={6}>
            <Autocomplete
              id={"fromUnit"}
              value={formFields.fromUnit}
              options={units}
              autoSelect
              autoHighlight
              getOptionLabel={(unit) => unit.key}
              onChange={(event, newValue) => {
                onChangeField(
                  event as React.ChangeEvent<HTMLInputElement>,
                  newValue
                );
              }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  margin="normal"
                  label={TEXT_UNIT_FROM}
                  error={validation.fromUnit.hasError}
                  helperText={validation.fromUnit.helperText}
                />
              )}
            />
          </Grid>
          <Grid size={6}>
            <TextField
              error={validation.numerator.hasError}
              margin="normal"
              id="numerator"
              name="numerator"
              value={formFields.numerator}
              required
              fullWidth
              onChange={onChangeField}
              label={TEXT_NUMERATOR}
              type="number"
              helperText={validation.numerator.helperText}
            />
          </Grid>
          <Grid size={6}>
            <Autocomplete
              id={"toUnit"}
              value={formFields.toUnit}
              options={units}
              autoSelect
              autoHighlight
              getOptionLabel={(unit) => unit.key}
              onChange={(event, newValue) => {
                onChangeField(
                  event as React.ChangeEvent<HTMLInputElement>,
                  newValue
                );
              }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  margin="normal"
                  label={TEXT_UNIT_TO}
                  error={validation.toUnit.hasError}
                  helperText={validation.toUnit.helperText}
                />
              )}
            />
          </Grid>
        </Grid>
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

export {DialogCreateUnitConversion};
