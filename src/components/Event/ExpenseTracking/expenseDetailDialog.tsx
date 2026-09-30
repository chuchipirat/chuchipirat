import React, {useState} from "react";

import {NEW_EXPENSE as TEXT_NEW_EXPENSE} from "../../../constants/text/expenseTracking";

import {
  CANCEL as TEXT_CANCEL,
  SAVE as TEXT_SAVE,
  AMOUNT as TEXT_AMOUNT,
  EXPENSE as TEXT_EXPENSE,
  DATE as TEXT_DATE,
  PLEASE_PROVIDE_AMOUNT as TEXT_PLEASE_PROVIDE_AMOUNT,
  CURRENCY as TEXT_CURRENCY,
  LABEL as TEXT_LABEL,
  PLEASE_PROVIDE_LABEL as TEXT_PLEASE_PROVIDE_LABEL,
  PLEASE_PROVIDE_BUDGET as TEXT_PLEASE_PROVIDE_BUDGET,
  PLACEHOLDER_LABEL as TEXT_PLACEHOLDER_LABEL,
  BUDGET as TEXT_BUDGET,
  COMMENT as TEXT_COMMENT,
  OPTIONAL as TEXT_OPTIONAL,
  PLEASE_PROVIDE_CURRENCY as TEXT_PLEASE_PROVIDE_CURRENCY,
  PLEASE_PROVIDE_DATE as TEXT_PLEASE_PROVIDE_DATE,
  DELETE as TEXT_DELETE,
  NAME as TEXT_NAME,
  PAYEE as TEXT_PAYEE,
  PAYEE_EXISTING_USER as TEXT_PAYEE_EXISTING_USER,
  PLEASE_PROVIDE_PAYEE as TEXT_PLEASE_PROVIDE_PAYEE,
  PAYEE_NEW_PERSON as TEXT_PAYEE_NEW_PERSON,
  PLEASE_PROVIDE_PAYEE_NAME as TEXT_PLEASE_PROVIDE_PAYEE_NAME,
  PAYEE_NO_REFUND_NEEDED as TEXT_PAYEE_NO_REFUND_NEEDED,
  FORMER_EVENT_COOK as TEXT_FORMER_EVENT_COOK,
} from "../../../constants/text";

import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  TextField,
  Box,
  FormLabel,
  RadioGroup,
  FormControlLabel,
  Radio,
} from "@mui/material";

import DeleteIcon from "@mui/icons-material/Delete";
import {ExpenseDomain, ExpensePayeeType} from "./expense.types";

import {
  AVAILABLE_CURRENCIES,
  parseAmountToCents,
} from "../../Shared/utils/currencyUtils";
import {DatePicker} from "@mui/x-date-pickers";
import {useCustomStyles} from "../../../constants/styles";
import dayjs, {Dayjs} from "dayjs";
import {BudgetDomain} from "./budget.types";
import {Cook} from "../Event/event.class";

/**
 * Props des Ausgaben-Dialogs.
 *
 * @param open - Ob der Dialog sichtbar ist.
 * @param expense - Zu bearbeitende Ausgabe; `null` = neue Ausgabe anlegen.
 * @param budgets - Budgets des Events, für die Budget-Auswahl.
 * @param defaultBudgetId - Vorbelegung der Budget-Auswahl im Anlegen-Modus
 *   (zuletzt verwendetes Budget, sonst `null`); bei genau einem Budget wird
 *   stattdessen immer dieses eine vorausgewählt.
 * @param onClose - Wird beim Schliessen aufgerufen.
 * @param onCreate - Wird beim Speichern einer neuen Ausgabe aufgerufen.
 * @param onEdit - Wird beim Speichern einer bestehenden Ausgabe aufgerufen.
 * @param onDelete - Wird beim Klick auf «Löschen» aufgerufen (nur im Bearbeiten-Modus).
 */
interface ExpenseDetailDialogProps {
  open: boolean;
  expense: ExpenseDomain | null;
  budgets: BudgetDomain[];
  defaultBudgetId: string | null;
  cooks: Cook[];
  onClose: () => void;
  onCreate: (budget: ExpenseDetailDialogState) => void;
  onEdit: (expenseId: string, expense: ExpenseDetailDialogState) => void;
  onDelete: (expense: ExpenseDomain) => void;
}

/**
 * Eingabezustand des Ausgaben-Dialogs. Betrag bleibt als Text (wie beim
 * Budget-Dialog), damit unvollständige Eingaben stehen bleiben können; die
 * Umrechnung in Rappen erfolgt erst beim Speichern. Datum als `Dayjs`, weil
 * `DatePicker` keine native `Date` liefert.
 *
 * @param label - Bezeichnung der Ausgabe.
 * @param amount - Betrag als Text.
 * @param currency - ISO-Währungscode.
 * @param budgetId - ID des gewählten Budgets.
 * @param date - Datum der Ausgabe; `null`, solange keines gewählt wurde.
 * @param comment - Optionaler Kommentar (leerer Text statt `null` im Formular).
 */
export type ExpenseDetailDialogState = {
  label: string;
  amount: string;
  currency: string;
  budgetId: string;
  date: Dayjs | null;
  comment: string;
  payeeType: ExpensePayeeType;
  payeeUserId: string | null;
  payeeName: string;
};

/** Leeres Formular für ein neues Budget. */
const INITIAL_FORM_STATE: ExpenseDetailDialogState = {
  label: "",
  amount: "",
  currency: "",
  budgetId: "",
  date: null,
  comment: "",
  payeeType: ExpensePayeeType.NO_REFUND_NEEDED,
  payeeUserId: null,
  payeeName: "",
};

/**
 * Dialog zum Anlegen und Bearbeiten einer Ausgabe. Ist `expense` gesetzt,
 * werden die Felder vorbelegt und «Löschen» angeboten; sonst ist es ein
 * leeres Anlegen-Formular (Budget-Auswahl vorbelegt mit `defaultBudgetId`
 * bzw. dem einzigen Budget, falls nur eines existiert). Die eigentliche
 * Speicher-/Löschlogik liegt beim Aufrufer (über `onCreate`/`onEdit`/
 * `onDelete`), der Dialog kennt weder Datenbank noch Rückfrage.
 *
 * @param props - Siehe {@link ExpenseDetailDialogProps}.
 */
export const ExpenseDetailDialog: React.FC<ExpenseDetailDialogProps> = ({
  open,
  expense,
  budgets,
  defaultBudgetId,
  cooks,
  onCreate,
  onClose,
  onEdit,
  onDelete,
}) => {
  const preselectedBudgetId =
    budgets.length === 1 ? budgets[0].id : (defaultBudgetId ?? "");

  // Form-State erstellen
  const expenseToFormState = (
    expense: ExpenseDomain | null,
  ): ExpenseDetailDialogState =>
    expense
      ? {
          label: expense.label,
          amount: expense.amountInCents
            ? (expense.amountInCents / 100).toFixed(2)
            : "",
          currency: expense.currency,
          budgetId: expense.budgetId,
          date: dayjs(expense.date),
          comment: expense.comment ?? "",
          payeeType: expense.payeeType,
          payeeUserId: expense.payeeUserId,
          payeeName: expense.payeeName ?? "",
        }
      : {
          ...INITIAL_FORM_STATE,
          date: dayjs(),
          // Wenn nur 1 Budget zur Auswahl, dieses vorauswählen
          budgetId: preselectedBudgetId,
          // Wenn das Budget in Euro läuft, auf Euro umstellen
          currency:
            budgets.find((budget) => budget.id === preselectedBudgetId)
              ?.currency ?? "",
        };
  const classes = useCustomStyles();
  const [touched, setTouched] = React.useState(false);
  const [formState, setFormState] = useState<ExpenseDetailDialogState>(
    expenseToFormState(expense),
  );

  /* ------------------------------------------
  // Formular beim Öffnen neu befüllen: `useState` liest den Startwert nur
  // beim ersten Rendern, der Dialog bleibt aber dauerhaft gemountet. Ohne
  // diesen Effekt blieben Werte eines früheren Budgets stehen.
  // ------------------------------------------ */
  React.useEffect(() => {
    if (!open) return;
    setFormState(expenseToFormState(expense));
    setTouched(false);
  }, [open, expense]);

  /* ------------------------------------------
  // Dialog-Handler
  // ------------------------------------------ */
  const handleClose = () => {
    setTouched(false);
    onClose();
  };
  /** Validiert die Eingaben und meldet sie je nach Modus an `onEdit`/`onCreate`. */
  const handleSave = () => {
    setTouched(true);
    if (!isValid || amountInCents == null) {
      return;
    }

    if (expense?.id) {
      onEdit(expense.id, formState);
    } else {
      onCreate(formState);
    }
    handleClose();
  };
  /** Meldet das Löschen an den Aufrufer, der die Rückfrage übernimmt. */
  const handleDelete = () => {
    if (!expense) return;
    onDelete(expense);
    handleClose();
  };
  const updateField = <K extends keyof ExpenseDetailDialogState>(
    field: K,
    value: ExpenseDetailDialogState[K],
  ) => {
    setFormState((prev) => ({...prev, [field]: value}));
  };
  /* ------------------------------------------
  // UI Berechnungen
  // ------------------------------------------ */
  const amountInCents = parseAmountToCents(formState.amount);
  const isDateValid = formState.date != null && formState.date.isValid();
  const isPayeeValid =
    formState.payeeType === ExpensePayeeType.EXISTING_USER
      ? !!formState.payeeUserId
      : formState.payeeType === ExpensePayeeType.NEW_PERSON
        ? formState.payeeName.trim().length > 0
        : true; // no_refund_needed braucht keine weitere Angabe

  const isValid =
    isDateValid &&
    formState.label.trim().length > 0 &&
    amountInCents != null &&
    amountInCents > 0 &&
    formState.date &&
    formState.currency &&
    formState.budgetId &&
    isPayeeValid;

  const payeeOptions =
    formState.payeeType === ExpensePayeeType.EXISTING_USER &&
    formState.payeeUserId &&
    !cooks.some((cook) => cook.uid === formState.payeeUserId)
      ? [
          ...cooks,
          {
            uid: formState.payeeUserId,
            displayName: TEXT_FORMER_EVENT_COOK,
          } as Cook,
        ]
      : cooks;

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="sm">
      <DialogTitle>{expense ? TEXT_EXPENSE : TEXT_NEW_EXPENSE}</DialogTitle>

      <DialogContent>
        <Box sx={classes.expenseFormAmountRow}>
          <DatePicker
            label={TEXT_DATE}
            format="DD.MM.YYYY"
            value={formState.date}
            onChange={(newValue) => updateField("date", newValue)}
            slotProps={{
              textField: {
                margin: "normal",
                sx: classes.expenseFormDateField,
                error: touched && !isDateValid,
                helperText:
                  touched && !isDateValid
                    ? TEXT_PLEASE_PROVIDE_DATE
                    : undefined,
              },
            }}
          />
          <TextField
            label={TEXT_AMOUNT}
            value={formState?.amount}
            onChange={(event) => updateField("amount", event.target.value)}
            error={touched && (amountInCents == null || amountInCents <= 0)}
            helperText={
              touched && (amountInCents == null || amountInCents <= 0)
                ? TEXT_PLEASE_PROVIDE_AMOUNT
                : undefined
            }
            margin="normal"
            fullWidth
            inputMode="decimal"
            sx={classes.expenseFormAmountField}
          />
          <TextField
            select
            label={TEXT_CURRENCY}
            value={formState.currency}
            onChange={(event) => updateField("currency", event.target.value)}
            error={touched && !formState.currency}
            helperText={
              touched && !formState.currency
                ? TEXT_PLEASE_PROVIDE_CURRENCY
                : undefined
            }
            margin="normal"
            sx={classes.expenseFormCurrencySelect}
          >
            {AVAILABLE_CURRENCIES.map((currencyOption) => (
              <MenuItem key={currencyOption} value={currencyOption}>
                {currencyOption}
              </MenuItem>
            ))}
          </TextField>
        </Box>
        <TextField
          fullWidth
          label={TEXT_LABEL}
          value={formState.label}
          onChange={(event) => updateField("label", event.target.value)}
          error={touched && formState.label.trim().length === 0}
          helperText={
            touched && formState.label.trim().length === 0
              ? TEXT_PLEASE_PROVIDE_LABEL
              : undefined
          }
          sx={classes.formControl}
          margin="normal"
          placeholder={TEXT_PLACEHOLDER_LABEL}
        />
        <TextField
          select
          label={TEXT_BUDGET}
          value={formState.budgetId}
          onChange={(event) => updateField("budgetId", event.target.value)}
          error={touched && !formState.budgetId}
          helperText={
            touched && !formState.budgetId
              ? TEXT_PLEASE_PROVIDE_BUDGET
              : undefined
          }
          margin="normal"
          fullWidth
          sx={classes.expenseFormCurrencySelect}
        >
          {budgets.map((budget) => (
            <MenuItem key={budget.id} value={budget.id}>
              {budget.name}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          multiline
          label={`${TEXT_COMMENT} (${TEXT_OPTIONAL})`}
          value={formState.comment}
          onChange={(event) => updateField("comment", event.target.value)}
          margin="normal"
          rows={3}
          fullWidth
        />
        <FormLabel sx={{mt: 2, display: "block"}}>{TEXT_PAYEE}</FormLabel>
        <RadioGroup
          value={formState.payeeType}
          onChange={(event) => {
            const payeeType = event.target.value as ExpensePayeeType;
            // Beim Typ-Wechsel die jeweils andere Auswahl zurücksetzen — sonst bliebe
            // z.B. eine payeeUserId stehen, obwohl "Neue Person" gewählt wurde, und
            // der CHECK-Constraint der DB würde das Speichern ablehnen.
            setFormState((prev) => ({
              ...prev,
              payeeType,
              payeeUserId:
                payeeType === ExpensePayeeType.EXISTING_USER
                  ? prev.payeeUserId
                  : null,
              payeeName:
                payeeType === ExpensePayeeType.NEW_PERSON ? prev.payeeName : "",
            }));
          }}
        >
          <Box sx={classes.payeeOptionCard}>
            <FormControlLabel
              value={ExpensePayeeType.EXISTING_USER}
              control={<Radio />}
              label={TEXT_PAYEE_EXISTING_USER}
            />
            {formState.payeeType === ExpensePayeeType.EXISTING_USER && (
              <TextField
                select
                fullWidth
                label={TEXT_NAME}
                value={formState.payeeUserId ?? ""}
                onChange={(event) =>
                  updateField("payeeUserId", event.target.value)
                }
                error={touched && !formState.payeeUserId}
                helperText={
                  touched && !formState.payeeUserId
                    ? TEXT_PLEASE_PROVIDE_PAYEE
                    : undefined
                }
                margin="normal"
                sx={{mt: 1}}
              >
                {payeeOptions.map((cook) => (
                  <MenuItem
                    key={cook.uid}
                    value={cook.uid}
                    disabled={!cooks.some((c) => c.uid === cook.uid)}
                  >
                    {cook.displayName}
                  </MenuItem>
                ))}
              </TextField>
            )}
          </Box>

          <Box sx={classes.payeeOptionCard}>
            <FormControlLabel
              value={ExpensePayeeType.NEW_PERSON}
              control={<Radio />}
              label={TEXT_PAYEE_NEW_PERSON}
            />
            {formState.payeeType === ExpensePayeeType.NEW_PERSON && (
              <TextField
                fullWidth
                label={TEXT_NAME}
                value={formState.payeeName}
                onChange={(event) =>
                  updateField("payeeName", event.target.value)
                }
                error={touched && formState.payeeName.trim().length === 0}
                helperText={
                  touched && formState.payeeName.trim().length === 0
                    ? TEXT_PLEASE_PROVIDE_PAYEE_NAME
                    : undefined
                }
                margin="normal"
                sx={{mt: 1}}
              />
            )}
          </Box>

          <Box sx={classes.payeeOptionCard}>
            <FormControlLabel
              value={ExpensePayeeType.NO_REFUND_NEEDED}
              control={<Radio />}
              label={TEXT_PAYEE_NO_REFUND_NEEDED}
            />
          </Box>
        </RadioGroup>
      </DialogContent>
      <DialogActions>
        {expense && (
          <React.Fragment>
            <Button
              variant="outlined"
              color="error"
              startIcon={<DeleteIcon />}
              onClick={handleDelete}
            >
              {TEXT_DELETE}
            </Button>
            <Box sx={{flex: 1}} />{" "}
          </React.Fragment>
        )}

        <Button variant="outlined" onClick={handleClose}>
          {TEXT_CANCEL}
        </Button>
        <Button variant="contained" onClick={handleSave}>
          {TEXT_SAVE}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
