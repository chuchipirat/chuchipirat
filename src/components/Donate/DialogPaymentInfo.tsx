/**
 * DialogPaymentInfo — Hinweisdialog zur Zahlungsmethode (TWINT-Empfehlung).
 *
 * Wird vor dem Weiterleiten zur Payrexx-Zahlungsseite angezeigt,
 * um den Benutzer auf die günstigste Zahlungsmethode hinzuweisen.
 *
 * @param props.open - Ob der Dialog sichtbar ist.
 * @param props.onClose - Callback zum Schliessen (Abbrechen).
 * @param props.onConfirm - Callback bei Bestätigung (weiter zur Zahlung).
 */
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
} from "@mui/material";

import {
  DONATION_PAYMENT_INFO_TITLE as TEXT_TITLE,
  DONATION_PAYMENT_INFO_TEXT as TEXT_BODY,
  DONATION_PAYMENT_INFO_CONFIRM as TEXT_CONFIRM,
} from "../../constants/text";
import {CANCEL as TEXT_CANCEL} from "../../constants/text";

/* ===================================================================
// Props
// =================================================================== */

/**
 * Props für den DialogPaymentInfo.
 *
 * @param open - Ob der Dialog angezeigt wird.
 * @param onClose - Schliesst den Dialog ohne Aktion.
 * @param onConfirm - Bestätigung — löst die Zahlung aus.
 */
type DialogPaymentInfoProps = {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
};

/* ===================================================================
// Komponente
// =================================================================== */

/**
 * Zeigt einen Hinweis, dass TWINT die tiefsten Gebühren hat,
 * bevor der Benutzer zur Zahlungsseite weitergeleitet wird.
 */
const DialogPaymentInfo = ({
  open,
  onClose,
  onConfirm,
}: DialogPaymentInfoProps) => (
  <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
    <DialogTitle>{TEXT_TITLE}</DialogTitle>
    <DialogContent>
      <Typography variant="body2">{TEXT_BODY}</Typography>
    </DialogContent>
    <DialogActions>
      <Button onClick={onClose}>{TEXT_CANCEL}</Button>
      <Button onClick={onConfirm} variant="contained" autoFocus>
        {TEXT_CONFIRM}
      </Button>
    </DialogActions>
  </Dialog>
);

export {DialogPaymentInfo};
