/**
 * Dialog zur Erstellung einer Quittung für einen Anlass.
 *
 * Der Dialog zeigt vorausgefüllte Felder (Event-UID, Event-Name, Zahldatum,
 * Spendername, Spender-E-Mail) und lässt den Admin den Betrag eingeben.
 * Die eigentliche PDF-Generierung und Speicherung erfolgt im übergeordneten
 * Component (OverviewEventsPage).
 *
 * @example
 * <DialogCreateReceipt
 *   dialogData={dialogCreateReceipt}
 *   handleClose={onCreateReceiptClose}
 *   handleOk={generateReceipt}
 * />
 */
import React from "react";

import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Stack,
} from "@mui/material";
import {DatePicker} from "@mui/x-date-pickers";

import {useCustomStyles} from "../../../constants/styles";
import {
  UID as TEXT_UID,
  EVENT as TEXT_EVENT,
  CREATE_RECEIPT as TEXT_CREATE_RECEIPT,
  CREATE as TEXT_CREATE,
  PAY_DATE as TEXT_PAY_DATE,
  DONOR as TEXT_DONOR,
  EMAIL as TEXT_EMAIL,
  AMOUNT as TEXT_AMOUNT,
  CANCEL as TEXT_CANCEL,
} from "../../../constants/text";

/* ===================================================================
// ========================= Typen / State ===========================
// =================================================================== */

/**
 * Zustand des Quittungs-Dialogs.
 *
 * @property dialogOpen - Ob der Dialog geöffnet ist.
 * @property eventUid - UID des Anlasses.
 * @property eventName - Name des Anlasses.
 * @property payDate - Zahldatum.
 * @property amount - Betrag in CHF.
 * @property donorName - Name des Spenders.
 * @property donorEmail - E-Mail des Spenders.
 */
export interface DialogCreateReceiptState {
  dialogOpen: boolean;
  eventUid: string;
  eventName: string;
  payDate: Date;
  amount: number;
  donorName: string;
  donorEmail: string;
}

/** Initialzustand für den Quittungs-Dialog. */
export const DIALOG_CREATE_RECEIPT_INITIAL_STATE: DialogCreateReceiptState = {
  dialogOpen: false,
  eventUid: "",
  eventName: "",
  payDate: new Date(),
  amount: 0,
  donorName: "",
  donorEmail: "",
};

/**
 * Props für den Quittungs-Dialog.
 *
 * @param dialogData - Aktueller Dialog-Zustand mit vorausgefüllten Werten.
 * @param handleClose - Callback zum Schliessen des Dialogs.
 * @param handleOk - Callback bei Bestätigung mit den finalen Dialog-Werten.
 */
interface DialogCreateReceiptProps {
  dialogData: DialogCreateReceiptState;
  handleClose: () => void;
  handleOk: (dialogValues: DialogCreateReceiptState) => void;
}

/**
 * Dialog zur Erstellung einer Quittung.
 *
 * Zeigt ein Formular mit Event-UID (readonly), Event-Name, Zahldatum,
 * Spendername, Spender-E-Mail und Betrag. Bei Bestätigung werden die
 * finalen Werte via handleOk zurückgegeben.
 */
const DialogCreateReceipt = ({
  dialogData,
  handleClose,
  handleOk: handleOkSuper,
}: DialogCreateReceiptProps) => {
  const classes = useCustomStyles();
  const [dialogValues, setDialogValues] = React.useState(
    DIALOG_CREATE_RECEIPT_INITIAL_STATE
  );

  // Dialog-Werte initialisieren, wenn neue Daten hereinkommen
  if (
    dialogValues === DIALOG_CREATE_RECEIPT_INITIAL_STATE &&
    dialogData !== DIALOG_CREATE_RECEIPT_INITIAL_STATE
  ) {
    setDialogValues(dialogData);
  }

  /** Feld-Update für Textfelder. */
  const onFieldChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    let value: string | number;
    if (event.target.id === "amount") {
      value = parseFloat(event.target.value);
    } else {
      value = event.target.value;
    }
    setDialogValues({...dialogValues, [event.target.id]: value});
  };

  /** Bestätigung: Werte zurückgeben und Dialog zurücksetzen. */
  const handleOk = () => {
    handleOkSuper(dialogValues);
    setDialogValues(DIALOG_CREATE_RECEIPT_INITIAL_STATE);
  };

  return (
    <Dialog
      open={dialogData.dialogOpen}
      onClose={handleClose}
      aria-labelledby="dialog Quittung für Event erstellen"
      fullWidth={true}
      maxWidth="sm"
    >
      <DialogTitle>{TEXT_CREATE_RECEIPT}</DialogTitle>
      <DialogContent>
        <Stack spacing={2}>
          <TextField
            id="eventUid"
            fullWidth
            label={TEXT_UID}
            value={dialogValues.eventUid}
            disabled={true}
            sx={classes.typographyCode}
          />
          <TextField
            id="eventName"
            fullWidth
            value={dialogValues.eventName}
            label={TEXT_EVENT}
            onChange={onFieldChange}
          />
          <DatePicker
            key={"payDate"}
            label={TEXT_PAY_DATE}
            format="dd.MM.yyyy"
            value={dialogValues.payDate}
            onChange={(date) => {
              setDialogValues({...dialogValues, payDate: date as Date});
            }}
          />
          <TextField
            id="donorName"
            fullWidth
            value={dialogValues.donorName}
            label={TEXT_DONOR}
            onChange={onFieldChange}
          />
          <TextField
            id="donorEmail"
            fullWidth
            value={dialogValues.donorEmail}
            label={`${TEXT_DONOR} ${TEXT_EMAIL}`}
            onChange={onFieldChange}
          />
          <TextField
            id="amount"
            fullWidth
            value={dialogValues.amount}
            label={TEXT_AMOUNT}
            onChange={onFieldChange}
            inputProps={{
              inputMode: "numeric",
              pattern: "[0-9]*",
            }}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button color="primary" onClick={handleClose}>
          {TEXT_CANCEL}
        </Button>
        <Button variant="outlined" color="primary" onClick={handleOk}>
          {TEXT_CREATE}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default DialogCreateReceipt;
