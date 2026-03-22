/**
 * Dialog zur Konfiguration der Menüplan-PDF-Exportoptionen.
 *
 * Zeigt dem Benutzer Schalter an, mit denen er festlegen kann, welche
 * Details im exportierten Menüplan-PDF enthalten sein sollen
 * (Produkte, Materialien, Portionen pro Rezept).
 */
import React, {useState} from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  FormGroup,
  FormControlLabel,
  Switch,
} from "@mui/material";

import {
  CANCEL as TEXT_CANCEL,
  PRODUCTS as TEXT_PRODUCTS,
  MATERIALS as TEXT_MATERIALS,
  PORTIONS as TEXT_PORTIONS,
  PRINTVERSION as TEXT_PRINTVERSION,
  MENUPLAN_PDF_OPTIONS_TITLE as TEXT_MENUPLAN_PDF_OPTIONS_TITLE,
  MENUPLAN_PDF_SHOW_PRODUCTS as TEXT_MENUPLAN_PDF_SHOW_PRODUCTS,
  MENUPLAN_PDF_SHOW_MATERIALS as TEXT_MENUPLAN_PDF_SHOW_MATERIALS,
  MENUPLAN_PDF_SHOW_PORTIONS as TEXT_MENUPLAN_PDF_SHOW_PORTIONS,
} from "../../../constants/text";

/* =====================================================================
// Typen
// ===================================================================== */

/**
 * Optionen für den Menüplan-PDF-Export.
 *
 * @param showProducts - Ob Produkte pro Menü angezeigt werden sollen.
 * @param showMaterials - Ob Materialien pro Menü angezeigt werden sollen.
 * @param showPortions - Ob Portionen pro Rezept angezeigt werden sollen.
 */
export interface MenuplanPdfOptions {
  showProducts: boolean;
  showMaterials: boolean;
  showPortions: boolean;
}

/** Standardwerte: alles ausgeblendet (bisheriges Verhalten). */
export const MENUPLAN_PDF_OPTIONS_INITIAL: MenuplanPdfOptions = {
  showProducts: false,
  showMaterials: false,
  showPortions: false,
};

/**
 * Props des Dialogs.
 *
 * @param open - Ob der Dialog geöffnet ist.
 * @param onConfirm - Callback mit den gewählten Optionen beim Bestätigen.
 * @param onCancel - Callback beim Abbrechen.
 */
interface DialogMenuplanPdfOptionsProps {
  open: boolean;
  onConfirm: (options: MenuplanPdfOptions) => void;
  onCancel: () => void;
}

/* =====================================================================
// Komponente
// ===================================================================== */

/**
 * Dialog mit Schaltern für die Menüplan-PDF-Exportoptionen.
 *
 * Der Benutzer kann wählen, ob Produkte, Materialien und/oder
 * Portionenzahlen im PDF angezeigt werden sollen.
 *
 * @param open - Sichtbarkeit des Dialogs.
 * @param onConfirm - Wird mit den gewählten Optionen aufgerufen.
 * @param onCancel - Wird beim Abbrechen aufgerufen.
 */
const DialogMenuplanPdfOptions = ({
  open,
  onConfirm,
  onCancel,
}: DialogMenuplanPdfOptionsProps) => {
  const [options, setOptions] = useState<MenuplanPdfOptions>(
    MENUPLAN_PDF_OPTIONS_INITIAL
  );

  const handleToggle = (key: keyof MenuplanPdfOptions) => {
    setOptions((prev) => ({...prev, [key]: !prev[key]}));
  };

  const handleConfirm = () => {
    onConfirm(options);
    // State zurücksetzen für nächsten Aufruf
    setOptions(MENUPLAN_PDF_OPTIONS_INITIAL);
  };

  const handleCancel = () => {
    onCancel();
    setOptions(MENUPLAN_PDF_OPTIONS_INITIAL);
  };

  return (
    <Dialog open={open} onClose={handleCancel} maxWidth="xs" fullWidth>
      <DialogTitle>{TEXT_MENUPLAN_PDF_OPTIONS_TITLE}</DialogTitle>
      <DialogContent>
        <FormGroup>
          <FormControlLabel
            control={
              <Switch
                checked={options.showProducts}
                onChange={() => handleToggle("showProducts")}
              />
            }
            label={TEXT_MENUPLAN_PDF_SHOW_PRODUCTS}
          />
          <FormControlLabel
            control={
              <Switch
                checked={options.showMaterials}
                onChange={() => handleToggle("showMaterials")}
              />
            }
            label={TEXT_MENUPLAN_PDF_SHOW_MATERIALS}
          />
          <FormControlLabel
            control={
              <Switch
                checked={options.showPortions}
                onChange={() => handleToggle("showPortions")}
              />
            }
            label={TEXT_MENUPLAN_PDF_SHOW_PORTIONS}
          />
        </FormGroup>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleCancel}>{TEXT_CANCEL}</Button>
        <Button onClick={handleConfirm} variant="contained">
          {TEXT_PRINTVERSION}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export {DialogMenuplanPdfOptions};
