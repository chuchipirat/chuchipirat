import React, {useState} from "react";

import {
  Box,
  Typography,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  RadioGroup,
  FormControlLabel,
  Radio,
  MenuItem,
  FormLabel,
  ButtonBase,
} from "@mui/material";
import {
  BUDGET_TYPE_FIXED_AMOUNT as TEXT_BUDGET_TYPE_FIXED_AMOUNT,
  BUDGET_TYPE_PER_PERSON_PER_DAY as TEXT_BUDGET_TYPE_PER_PERSON_PER_DAY,
  NEW_BUDGET as TEXT_NEW_BUDGET,
  BUDGET_NAME as TEXT_BUDGET_NAME,
  BUDGET_AMOUNT as TEXT_BUDGET_AMOUNT,
  PLEASE_PROVIDE_NAME as TEXT_PLEASE_PROVIDE_NAME,
  PLEASE_PROVIDE_AMOUNT as TEXT_PLEASE_PROVIDE_AMOUNT,
  BUDGET_CURRENCY as TEXT_BUDGET_CURRENCY,
  BUDGET_ICON as TEXT_BUDGET_ICON,
  PLEASE_PROVIDE_ICON as TEXT_PLEASE_PROVIDE_ICON,
  BUDGET_TYPE as TEXT_BUDGET_TYPE,
  BUDGET as TEXT_BUDGET,
} from "../../../constants/text/expenseTracking";
import {
  CANCEL as TEXT_CANCEL,
  SAVE as TEXT_SAVE,
  DELETE as TEXT_DELETE,
} from "../../../constants/text";

import {BudgetDomain, BudgetIcon, BudgetType} from "./budget.types";
import {BUDGET_ICON_MAP} from "./budgetIcons";
import {useCustomStyles} from "../../../constants/styles";
import {parseAmountToCents} from "../../Shared/utils/currencyUtils";

import DeleteIcon from "@mui/icons-material/Delete";

/**
 * Eingabezustand des Budget-Dialogs. Der Betrag bleibt als Text, damit
 * unvollständige Eingaben («8.», «») im Feld stehen bleiben können; die
 * Umrechnung in Rappen erfolgt erst beim Speichern.
 *
 * @param name - Name des Budgets.
 * @param budgetType - Fixbetrag oder Betrag pro Person und Tag.
 * @param amount - Betrag als Text (Rate bei «pro Person und Tag», sonst Total).
 * @param currency - ISO-Währungscode.
 * @param icon - Gewähltes Icon; `null`, solange noch keines gewählt wurde.
 */
export type BudgetDetailDialogState = {
  name: string;
  budgetType: BudgetType;
  amount: string;
  currency: string;
  icon: BudgetIcon | null;
};
/** Leeres Formular für ein neues Budget. */
const INITIAL_FORM_STATE: BudgetDetailDialogState = {
  name: "",
  budgetType: BudgetType.FIXED_AMOUNT,
  amount: "",
  currency: "CHF",
  icon: null,
};

/**
 * Props des Budget-Dialogs.
 *
 * @param open - Ob der Dialog sichtbar ist.
 * @param budget - Zu bearbeitendes Budget; `null` = neues Budget anlegen.
 * @param onClose - Wird beim Schliessen aufgerufen.
 * @param onCreate - Wird beim Speichern eines neuen Budgets aufgerufen.
 * @param onEdit - Wird beim Speichern eines bestehenden Budgets aufgerufen.
 * @param onDelete - Wird beim Klick auf «Löschen» aufgerufen (nur im Bearbeiten-Modus).
 */
interface BudgetDetailDialogProps {
  open: boolean;
  budget: BudgetDomain | null;
  onClose: () => void;
  onCreate: (budget: BudgetDetailDialogState) => void;
  onEdit: (
    budgetId: BudgetDomain["id"],
    budget: BudgetDetailDialogState,
  ) => void;
  onDelete: (budget: BudgetDomain) => void;
}
// Schweizer Franken (Hauptwährung der App) + Euro (häufigste Fremdwährung
// bei grenznahen Lagern) — bei Bedarf um weitere Währungen erweitern.
const AVAILABLE_CURRENCIES = ["CHF", "EUR"];

/**
 * Dialog zum Anlegen und Bearbeiten eines Budgets. Ist `budget` gesetzt,
 * werden die Felder vorbelegt und «Löschen» angeboten; sonst ist es ein leeres
 * Anlegen-Formular. Die eigentliche Speicher-/Löschlogik liegt beim Aufrufer
 * (über `onCreate`/`onEdit`/`onDelete`), der Dialog kennt weder Datenbank noch
 * Rückfrage.
 *
 * @param props - Siehe {@link BudgetDetailDialogProps}.
 */
export const BudgetDetailDialog: React.FC<BudgetDetailDialogProps> = ({
  open,
  budget,
  onClose,
  onCreate,
  onEdit,
  onDelete,
}) => {
  // Form-State erstellen
  const budgetToFormState = (
    budget: BudgetDomain | null,
  ): BudgetDetailDialogState =>
    budget
      ? {
          name: budget.name,
          budgetType: budget.budgetType,
          amount: budget.amountInCents
            ? (budget.amountInCents / 100).toFixed(2)
            : "",
          currency: budget.currency,
          icon: budget.icon,
        }
      : INITIAL_FORM_STATE;

  const classes = useCustomStyles();
  const [touched, setTouched] = React.useState(false);
  const [formState, setFormState] = useState<BudgetDetailDialogState>(
    budgetToFormState(budget),
  );

  /* ------------------------------------------
  // Formular beim Öffnen neu befüllen: `useState` liest den Startwert nur
  // beim ersten Rendern, der Dialog bleibt aber dauerhaft gemountet. Ohne
  // diesen Effekt blieben Werte eines früheren Budgets stehen.
  // ------------------------------------------ */
  React.useEffect(() => {
    if (!open) return;
    setFormState(budgetToFormState(budget));
    setTouched(false);
  }, [open, budget]);
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
    if (!isValid || formState.icon == null || amountInCents == null) {
      return;
    }

    if (budget?.id) {
      onEdit(budget.id, formState);
    } else {
      onCreate(formState);
    }
    handleClose();
  };

  /** Meldet das Löschen an den Aufrufer, der die Rückfrage übernimmt. */
  const handleDelete = () => {
    if (!budget) return;
    onDelete(budget);
    handleClose();
  };

  const updateField = <K extends keyof BudgetDetailDialogState>(
    field: K,
    value: BudgetDetailDialogState[K],
  ) => {
    setFormState((prev) => ({...prev, [field]: value}));
  };
  /* ------------------------------------------
  // UI Berechnungen
  // ------------------------------------------ */
  const amountInCents = parseAmountToCents(formState.amount);
  const isValid =
    formState.name.trim().length > 0 &&
    amountInCents != null &&
    amountInCents > 0 &&
    formState.icon != null;

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="sm">
      <DialogTitle>{budget ? TEXT_BUDGET : TEXT_NEW_BUDGET}</DialogTitle>
      <DialogContent>
        <TextField
          autoFocus
          fullWidth
          label={TEXT_BUDGET_NAME}
          value={formState.name}
          onChange={(event) => updateField("name", event.target.value)}
          error={touched && formState.name.trim().length === 0}
          helperText={
            touched && formState.name.trim().length === 0
              ? TEXT_PLEASE_PROVIDE_NAME
              : undefined
          }
          sx={classes.formControl}
          margin="normal"
        />
        <FormLabel>{TEXT_BUDGET_TYPE}</FormLabel>

        <RadioGroup
          value={formState.budgetType}
          onChange={(event) =>
            updateField("budgetType", event.target.value as BudgetType)
          }
        >
          <FormControlLabel
            value={BudgetType.FIXED_AMOUNT}
            control={<Radio />}
            label={TEXT_BUDGET_TYPE_FIXED_AMOUNT}
          />
          <FormControlLabel
            value={BudgetType.PER_PERSON_PER_DAY}
            control={<Radio />}
            label={TEXT_BUDGET_TYPE_PER_PERSON_PER_DAY}
          />
        </RadioGroup>

        <Box sx={classes.budgetFormAmountRow}>
          <TextField
            label={TEXT_BUDGET_AMOUNT}
            value={formState.amount}
            onChange={(event) => updateField("amount", event.target.value)}
            error={touched && (amountInCents == null || amountInCents <= 0)}
            helperText={
              touched && (amountInCents == null || amountInCents <= 0)
                ? TEXT_PLEASE_PROVIDE_AMOUNT
                : undefined
            }
            margin="normal"
            fullWidth
          />
          <TextField
            select
            label={TEXT_BUDGET_CURRENCY}
            value={formState.currency}
            onChange={(event) => updateField("currency", event.target.value)}
            margin="normal"
            sx={classes.budgetFormCurrencySelect}
          >
            {AVAILABLE_CURRENCIES.map((currencyOption) => (
              <MenuItem key={currencyOption} value={currencyOption}>
                {currencyOption}
              </MenuItem>
            ))}
          </TextField>
        </Box>

        <Typography variant="body2" sx={classes.formControl}>
          {TEXT_BUDGET_ICON}
        </Typography>
        <Box sx={classes.budgetIconPickerGrid}>
          {Object.values(BudgetIcon).map((iconOption) => {
            const IconComponent = BUDGET_ICON_MAP[iconOption];
            return (
              <ButtonBase
                key={iconOption}
                onClick={() => updateField("icon", iconOption)}
                sx={
                  formState.icon === iconOption
                    ? classes.budgetIconPickerButtonSelected
                    : classes.budgetIconPickerButton
                }
                aria-label={iconOption}
                aria-pressed={formState.icon === iconOption}
              >
                <IconComponent fontSize="small" />
              </ButtonBase>
            );
          })}
        </Box>
        {touched && formState.icon == null && (
          <Typography variant="caption" color="error">
            {TEXT_PLEASE_PROVIDE_ICON}
          </Typography>
        )}
      </DialogContent>
      <DialogActions>
        {budget && (
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
