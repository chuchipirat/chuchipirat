import React from "react";

import {
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  useTheme,
  useMediaQuery,
} from "@mui/material";
import {
  PAYMENT_DETAILS_EDIT as TEXT_PAYMENT_DETAILS_EDIT,
  PAYMENT_DETAILS_ADD as TEXT_PAYMENT_DETAILS_ADD,
  CANCEL as TEXT_CANCEL,
  SAVE as TEXT_SAVE,
} from "../../constants/text";
import {AlertMessage} from "../Shared/AlertMessage";

import {
  PaymentDetailsForm,
  PaymentDetailsFieldName,
} from "./paymentDetailsForm";
import {UserPaymentDetailsDomain} from "./userPaymentDetails.types";
import {UserPaymentDetails} from "./userPaymentDetails.class";
import {FormValidationFieldError} from "../Shared/fieldValidation.error.class";
import {formatIban} from "../../utils/ibanUtils";

/**
 * Props des {@link UserPaymentDetailsDialog}.
 *
 * @property open - Ob der Dialog offen ist.
 * @property initialValues - Gespeicherte Angaben zum Bearbeiten; `null` = neu hinterlegen.
 * @property isSaving - Speichern läuft — "Speichern" ist dann deaktiviert (kein Doppel-Submit).
 * @property saveError - Technischer Fehler beim Speichern (Netzwerk, DB) — kommt von der Card.
 * @property onSave - Wird nur mit geprüften und normalisierten Angaben aufgerufen.
 * @property onClose - Dialog schliessen (Abbrechen).
 */
interface UserPaymentDetailsDialogProps {
  open: boolean;
  initialValues: UserPaymentDetailsDomain | null;
  isSaving: boolean;
  saveError: Error | null;
  onSave: (normalized: UserPaymentDetailsDomain) => void;
  onClose: () => void;
}

/** Leerer Entwurf für "Zahlungsangaben hinterlegen". */
const EMPTY_PAYMENT_DETAILS: UserPaymentDetailsDomain = {
  userId: "",
  street: "",
  postalCode: "",
  city: "",
  iban: "",
};

/**
 * Dialog zum Hinterlegen bzw. Bearbeiten der eigenen Zahlungsangaben.
 *
 * Besitzt den Entwurf und die Feldfehler und prüft beim Speichern selbst —
 * `onSave` wird nur mit gültigen, normalisierten Angaben aufgerufen, ein
 * Validierungsfehler erreicht die Card also nie. Technische Fehler kommen
 * umgekehrt von der Card (`saveError`) und erscheinen als Meldung im Dialog.
 *
 * Der Entwurf wird nur beim ersten Rendern aus `initialValues` übernommen —
 * die Card mountet den Dialog deshalb nur, solange er offen ist (frischer
 * Entwurf bei jedem Öffnen, keine alten Fehler).
 *
 * Auf Mobile (unter `sm`) im Vollbild. Das Dialog-Papier ist ein `<form>`,
 * damit Enter in einem Feld speichert.
 *
 * @param props - Siehe {@link UserPaymentDetailsDialogProps}.
 * @example
 * {dialogOpen && (
 *   <UserPaymentDetailsDialog open initialValues={details} isSaving={isSaving}
 *     saveError={saveError} onSave={handleSave} onClose={onCloseDialog} />
 * )}
 */
export const UserPaymentDetailsDialog: React.FC<
  UserPaymentDetailsDialogProps
> = ({open, initialValues, isSaving, saveError, onSave, onClose}) => {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down("sm"));

  // Beim Bearbeiten die IBAN gleich gruppiert anzeigen — wie in der Card
  // und wie nach dem Verlassen des Feldes (gespeichert wird sie normalisiert).
  const [values, setValues] = React.useState(
    initialValues
      ? {...initialValues, iban: formatIban(initialValues.iban)}
      : EMPTY_PAYMENT_DETAILS,
  );
  const [formValidation, setFormValidation] = React.useState<
    FormValidationFieldError[]
  >([]);

  /* ------------------------------------------
  // Dialog-Handler
  // ------------------------------------------ */
  const handleClose = () => {
    onClose();
  };
  /**
   * Übernimmt eine Feldänderung. Der Fehler genau dieses Feldes verschwindet
   * sofort, damit es beim Korrigieren nicht rot bleibt.
   *
   * @param fieldName - Geändertes Feld.
   * @param value - Neuer Wert.
   */
  const handleFieldChange = (
    fieldName: PaymentDetailsFieldName,
    value: string,
  ) => {
    setValues((previous) => ({...previous, [fieldName]: value}));
    // Fehler des geänderten Feldes verschwindet sofort, die anderen bleiben
    setFormValidation((previous) =>
      previous.filter((entry) => entry.fieldName !== fieldName),
    );
  };

  /**
   * Prüft die Eingaben; bei Fehlern werden die Felder markiert und nichts
   * gespeichert, sonst gehen die normalisierten Angaben an `onSave`.
   * Ausgelöst per "Speichern" oder Enter in einem Feld (Formular-Submit).
   *
   * @param event - Submit-Event des Formulars.
   */
  const handleSave = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); // kein Neuladen der Seite durch den Browser
    if (isSaving) return; // Enter während des Speicherns: kein Doppel-Submit
    const validationErrors = UserPaymentDetails.validatePaymentDetails(values);
    if (validationErrors.length > 0) {
      setFormValidation(validationErrors);
      return;
    }
    onSave(UserPaymentDetails.normalize(values));
  };
  return (
    <Dialog
      open={open}
      onClose={handleClose}
      fullWidth
      maxWidth="sm"
      fullScreen={fullScreen}
      slotProps={{paper: {component: "form", onSubmit: handleSave}}}
    >
      <DialogTitle>
        {initialValues ? TEXT_PAYMENT_DETAILS_EDIT : TEXT_PAYMENT_DETAILS_ADD}
      </DialogTitle>
      <DialogContent>
        <PaymentDetailsForm
          values={values}
          formValidation={formValidation}
          onFieldChange={handleFieldChange}
        />
        {saveError && <AlertMessage error={saveError} />}
      </DialogContent>
      <DialogActions>
        <Button variant="outlined" onClick={handleClose}>
          {TEXT_CANCEL}
        </Button>
        <Button variant="contained" type="submit" disabled={isSaving}>
          {TEXT_SAVE}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
