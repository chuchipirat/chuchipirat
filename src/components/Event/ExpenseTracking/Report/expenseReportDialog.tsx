import React from "react";
import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  FormLabel,
  LinearProgress,
  MenuItem,
  Radio,
  RadioGroup,
  Stack,
  Switch,
  TextField,
  Typography,
} from "@mui/material";

import {
  CANCEL as TEXT_CANCEL,
  CREATE as TEXT_CREATE,
  CREATE_EXPENSE_REPORT as TEXT_CREATE_EXPENSE_REPORT,
  REPORT_ALL_PAYEES as TEXT_REPORT_ALL_PAYEES,
  REPORT_INCLUDE_COMMENTS as TEXT_REPORT_INCLUDE_COMMENTS,
  REPORT_MODE as TEXT_REPORT_MODE,
  REPORT_PAYEE_OPTION as TEXT_REPORT_PAYEE_OPTION,
  REPORT_PAYEE_SELECTION as TEXT_REPORT_PAYEE_SELECTION,
  REPORT_INCLUDE_MISSING_RECEIPT_PAGES as TEXT_REPORT_INCLUDE_MISSING_RECEIPT_PAGES,
  REPORT_MISSING_RECEIPTS_COUNT as TEXT_REPORT_MISSING_RECEIPTS_COUNT,
  REPORT_PROGRESS_LOADING as TEXT_REPORT_PROGRESS_LOADING,
  REPORT_PROGRESS_RENDERING as TEXT_REPORT_PROGRESS_RENDERING,
} from "../../../../constants/text";
import {useCustomStyles} from "../../../../constants/styles";
import {Cook} from "../../Event/event.class";
import {ExpenseDomain} from "../Expense/expense.types";
import {ExpenseReport} from "./expenseReport.class";
import {
  ReportMode,
  ReportOptions,
  ReportPayeeOption,
  ReportPayeeSelection,
  ReportProgress,
} from "./expenseReport.types";
import {REPORT_MODE_LABELS} from "./expenseReportLabels";

/** Wert der Option «Alle Personen» im Auswahlfeld. */
const ALL_PAYEES_VALUE = "all";
/**
 * Präfix der Werte einzelner Personen: Schlüssel neuer Personen sind
 * frei erfasste Namen, ohne Präfix fiele «all» mit «Alle Personen» zusammen.
 */
const PAYEE_VALUE_PREFIX = "payee:";

/**
 * Wandelt eine Auswahl in den Wert des Auswahlfelds.
 *
 * @param selection - Person oder «Alle Personen».
 * @returns Wert für `TextField select`.
 */
const toPayeeSelectValue = (selection: ReportPayeeSelection): string =>
  selection.kind === "all"
    ? ALL_PAYEES_VALUE
    : PAYEE_VALUE_PREFIX + selection.payeeKey;

/**
 * Wandelt einen Wert des Auswahlfelds zurück in eine Auswahl.
 *
 * @param value - Wert aus `TextField select`.
 * @returns Person oder «Alle Personen».
 */
const toPayeeSelection = (value: string): ReportPayeeSelection =>
  value.startsWith(PAYEE_VALUE_PREFIX)
    ? {kind: "single", payeeKey: value.slice(PAYEE_VALUE_PREFIX.length)}
    : {kind: "all"};

/**
 * Vorauswahl: angemeldete Person, sonst die erste, ohne Personen
 * «Alle Personen».
 *
 * @param payeeOptions - Personen mit Ausgaben.
 * @param authUserId - UID der angemeldeten Person.
 * @returns Wert für das Auswahlfeld.
 */
const getDefaultPayeeValue = (
  payeeOptions: ReportPayeeOption[],
  authUserId: string,
): string => {
  const defaultPayeeKey = ExpenseReport.getDefaultPayeeKey(
    payeeOptions,
    authUserId,
  );
  return defaultPayeeKey === null
    ? ALL_PAYEES_VALUE
    : toPayeeSelectValue({kind: "single", payeeKey: defaultPayeeKey});
};

/**
 * Props für {@link ExpenseReportDialog}.
 *
 * @param open - Dialog sichtbar.
 * @param expenses - Alle Ausgaben des Anlasses (live, für die Personen).
 * @param cooks - Köch*innen des Anlasses, für die Anzeigenamen.
 * @param authUserId - UID der angemeldeten Person (Vorauswahl).
 * @param onCreate - Erstellt das PDF; der Dialog wartet darauf und zeigt
 *   solange den Fortschritt, den `onCreate` über `onProgress` meldet.
 * @param onClose - Schliesst den Dialog (Abbrechen, Klick daneben).
 */
type ExpenseReportDialogProps = {
  open: boolean;
  expenses: ExpenseDomain[];
  cooks: Cook[];
  authUserId: string;
  onCreate: (
    options: ReportOptions,
    onProgress: (progress: ReportProgress) => void,
  ) => Promise<void>;
  onClose: () => void;
};

/**
 * Dialog «Abrechnung erstellen»: für wen (eine Person oder alle), Aufbau
 * (eine Tabelle oder pro Budget) und Kommentare ja/nein (Standard: nein).
 * Startet beim Öffnen frisch, dafür setzt die Seite bei jedem Öffnen
 * einen neuen `key`. Während des Erstellens lässt er sich nicht
 * schliessen.
 *
 * @param props - Siehe {@link ExpenseReportDialogProps}.
 * @returns Der Dialog.
 * @example
 * <ExpenseReportDialog
 *   key={reportDialog.key}
 *   open={reportDialog.open}
 *   expenses={state.expenses ?? []}
 *   cooks={event.cooks}
 *   authUserId={authUser!.uid}
 *   onCreate={handleCreateReport}
 *   onClose={handleCloseReportDialog}
 * />
 */
export const ExpenseReportDialog = ({
  open,
  expenses,
  cooks,
  authUserId,
  onCreate,
  onClose,
}: ExpenseReportDialogProps) => {
  const classes = useCustomStyles();
  const modeLabelId = React.useId();
  const payeeOptions = React.useMemo(
    () => ExpenseReport.getPayeeOptions(expenses, cooks),
    [expenses, cooks],
  );
  const [payeeValue, setPayeeValue] = React.useState(() =>
    getDefaultPayeeValue(payeeOptions, authUserId),
  );
  const [mode, setMode] = React.useState(ReportMode.PER_PERSON);
  const [includeComments, setIncludeComments] = React.useState(false);
  const [isCreating, setIsCreating] = React.useState(false);
  const [includeMissingReceiptPages, setIncludeMissingReceiptPages] =
    React.useState(true);
  const [progress, setProgress] = React.useState<ReportProgress | null>(null);

  // Verschwindet die gewählte Person per Realtime, gilt wieder die
  // Vorauswahl (abgeleitet statt Effekt, kein leeres PDF)
  const isPayeeAvailable =
    payeeValue === ALL_PAYEES_VALUE ||
    payeeOptions.some(
      (option) => PAYEE_VALUE_PREFIX + option.payeeKey === payeeValue,
    );
  const selectedPayeeValue = isPayeeAvailable
    ? payeeValue
    : getDefaultPayeeValue(payeeOptions, authUserId);

  // Anzahl für die aktuell gewählte Person, ändert sich mit der Auswahl
  const missingReceiptCount = ExpenseReport.countMissingReceipts(
    expenses,
    toPayeeSelection(selectedPayeeValue),
  );

  /** Übergibt die Optionen und wartet, bis das PDF erstellt ist. */
  const handleCreate = async () => {
    setIsCreating(true);
    try {
      await onCreate(
        {
          mode,
          payeeSelection: toPayeeSelection(selectedPayeeValue),
          includeComments,
          includeMissingReceiptPages,
        },
        setProgress,
      );
    } finally {
      setIsCreating(false);
      setProgress(null);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={isCreating ? undefined : onClose}
      maxWidth="xs"
      fullWidth
    >
      <DialogTitle>{TEXT_CREATE_EXPENSE_REPORT}</DialogTitle>
      <DialogContent>
        <Stack spacing={3} sx={classes.expenseReportDialogContent}>
          <TextField
            select
            fullWidth
            label={TEXT_REPORT_PAYEE_SELECTION}
            value={selectedPayeeValue}
            onChange={(event) => setPayeeValue(event.target.value)}
          >
            {payeeOptions.map((option, index) => (
              <MenuItem
                key={option.payeeKey}
                value={PAYEE_VALUE_PREFIX + option.payeeKey}
                // Trennlinie über «Alle Personen» als Eigenschaft des Eintrags:
                // ein <Divider /> als Kind würde von Select zur leeren,
                // anklickbaren Option
                divider={index === payeeOptions.length - 1}
              >
                {TEXT_REPORT_PAYEE_OPTION(
                  option.displayName,
                  option.expenseCount,
                )}
              </MenuItem>
            ))}
            <MenuItem value={ALL_PAYEES_VALUE}>
              {TEXT_REPORT_ALL_PAYEES}
            </MenuItem>
          </TextField>
          <FormControl>
            <FormLabel id={modeLabelId}>{TEXT_REPORT_MODE}</FormLabel>
            <RadioGroup
              aria-labelledby={modeLabelId}
              value={mode}
              onChange={(event) => setMode(event.target.value as ReportMode)}
            >
              {Object.values(ReportMode).map((reportMode) => (
                <FormControlLabel
                  key={reportMode}
                  value={reportMode}
                  control={<Radio />}
                  label={
                    <Box>
                      <Typography variant="body1">
                        {REPORT_MODE_LABELS[reportMode].label}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {REPORT_MODE_LABELS[reportMode].description}
                      </Typography>
                    </Box>
                  }
                />
              ))}
            </RadioGroup>
          </FormControl>
          <FormControlLabel
            control={
              <Switch
                checked={includeComments}
                onChange={(event) => setIncludeComments(event.target.checked)}
              />
            }
            label={TEXT_REPORT_INCLUDE_COMMENTS}
          />
          {missingReceiptCount > 0 ? (
            <FormControlLabel
              control={
                <Switch
                  checked={includeMissingReceiptPages}
                  onChange={(event) =>
                    setIncludeMissingReceiptPages(event.target.checked)
                  }
                />
              }
              label={
                <Box>
                  <Typography variant="body1">
                    {TEXT_REPORT_INCLUDE_MISSING_RECEIPT_PAGES}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {TEXT_REPORT_MISSING_RECEIPTS_COUNT(missingReceiptCount)}
                  </Typography>
                </Box>
              }
            />
          ) : null}
          {progress !== null ? (
            <ReportProgressIndicator progress={progress} />
          ) : null}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={isCreating}>
          {TEXT_CANCEL}
        </Button>
        <Button
          variant="contained"
          onClick={handleCreate}
          disabled={isCreating}
          startIcon={
            isCreating ? <CircularProgress size={16} color="inherit" /> : null
          }
        >
          {TEXT_CREATE}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
/**
 * Fortschritt beim Erstellen (E10, B12): beim Laden mit Zahlen und Balken,
 * beim Zeichnen als laufender Balken. `role="status"`, damit
 * Screenreader den Text vorlesen.
 *
 * @param props.progress - Aktueller Fortschritt.
 */
const ReportProgressIndicator = ({progress}: {progress: ReportProgress}) => (
  <Stack spacing={1}>
    {progress.stage === "loading" ? (
      <LinearProgress
        variant="determinate"
        value={(progress.loaded / progress.total) * 100}
      />
    ) : (
      <LinearProgress />
    )}
    <Typography variant="body2" color="text.secondary" role="status">
      {progress.stage === "loading"
        ? TEXT_REPORT_PROGRESS_LOADING(progress.loaded, progress.total)
        : TEXT_REPORT_PROGRESS_RENDERING}
    </Typography>
  </Stack>
);
