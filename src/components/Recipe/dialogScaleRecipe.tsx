import React from "react";

import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Switch,
  Typography,
  useTheme,
  Alert,
  AlertTitle,
} from "@mui/material";
import Grid from "@mui/material/Grid";

import {
  PORTIONS_TO_SCALE as TEXT_PORTIONS_TO_SCALE,
  DIALOG_TITLE_SCALE_RECIPE as TEXT_DIALOG_TITLE_SCALE_RECIPE,
  INFO_PANEL_TITLE_SCALE as TEXT_INFO_PANEL_TITLE_SCALE,
  INFO_PANEL_TEXT_SCALE as TEXT_INFO_PANEL_TEXT_SCALE,
  CONVERT_UNITS as TEXT_CONVERT_UNITS,
  CONVERT_UNITS_EXPLANATION as TEXT_CONVERT_UNITS_EXPLANATION,
  BUTTON_CANCEL as TEXT_BUTTON_CANCEL,
  BUTTON_OK as TEXT_BUTTON_OK,
} from "../../constants/text";
import {ScalingOptions} from "./recipe.class";

/* ===================================================================
// ======================== globale Funktionen =======================
// =================================================================== */
export interface OnScale {
  scaledPortions: number;
  scalingOptions: ScalingOptions;
}
/* ===================================================================
// ==================== Pop Up Abteilung hinzufügen ==================
// =================================================================== */
interface DialogScaleRecipeProps {
  dialogOpen: boolean;
  handleOk: ({scaledPortions, scalingOptions}: OnScale) => void;
  handleClose: () => void;
  scaledPortions: number;
}

/**
 * Dialog zum Skalieren eines Rezepts auf eine andere Portionenanzahl.
 *
 * Ermöglicht die Eingabe der gewünschten Portionen und bietet optional
 * die automatische Umrechnung von Einheiten (z.B. g → kg) an.
 *
 * @param props - Dialog-Steuerung, aktuelle Portionen und Callback-Handler.
 */
export const DialogScaleRecipe = ({
  dialogOpen,
  handleOk,
  handleClose,
  scaledPortions,
}: DialogScaleRecipeProps) => {
  const theme = useTheme();

  const [formFields, setFormFields] = React.useState({
    scaledPortions: 0,
    initial: true,
    convertUnits: true,
  });

  // Werte setzen aus dem Rezept
  if (!formFields.scaledPortions && scaledPortions && formFields.initial) {
    setFormFields({
      ...formFields,
      scaledPortions: scaledPortions,
      initial: false,
    });
  }
  /* ------------------------------------------
  // Change Ereignis Felder
  // ------------------------------------------ */
  const onChangeField = (
    event: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>
  ) => {
    setFormFields({
      ...formFields,
      scaledPortions: parseInt(event.target.value),
      initial: false,
    });
  };
  const onChangeSwitch = (event: React.ChangeEvent<HTMLInputElement>) => {
    setFormFields({
      ...formFields,
      convertUnits: event.target.checked,
    });
  };
  /* ------------------------------------------
  // PopUp Ok
  // ------------------------------------------ */
  const onOkClick = () => {
    setFormFields({...formFields, initial: true});
    handleOk({
      scaledPortions: formFields.scaledPortions,
      scalingOptions: {convertUnits: formFields.convertUnits},
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
      aria-labelledby="dialogScaleRecipe"
      fullWidth={true}
      maxWidth="xs"
    >
      <DialogTitle id="dialogScaleRecipe">
        {TEXT_DIALOG_TITLE_SCALE_RECIPE}
      </DialogTitle>
      <DialogContent>
        <Grid container alignItems="center" spacing={1}>
 <Grid size={12} >
            <TextField
              margin="dense"
              id="scaledPortions"
              name="scaledPortions"
              value={formFields.scaledPortions}
              fullWidth
              onChange={onChangeField}
              variant="outlined"
              label={TEXT_PORTIONS_TO_SCALE}
              type="number"
            />
          </Grid>
 <Grid size={10} >
            <Typography variant="body1">{TEXT_CONVERT_UNITS}</Typography>
          </Grid>
 <Grid size={2} sx={{textAlign: "right"}}>
            <Switch
              checked={formFields.convertUnits}
              onChange={onChangeSwitch}
            />
          </Grid>
 <Grid size={12} >
            <Typography variant="body2" color="textSecondary">
              {TEXT_CONVERT_UNITS_EXPLANATION}
            </Typography>
          </Grid>
 <Grid size={12} >
            <Alert severity="info" sx={{marginTop: theme.spacing(1)}}>
              <AlertTitle>{TEXT_INFO_PANEL_TITLE_SCALE}</AlertTitle>
              {TEXT_INFO_PANEL_TEXT_SCALE}
            </Alert>
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancelClick} variant="outlined">
          {TEXT_BUTTON_CANCEL}
        </Button>
        <Button onClick={onOkClick} variant="contained">
          {TEXT_BUTTON_OK}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

