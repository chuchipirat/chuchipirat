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
  useMediaQuery,
  useTheme,
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
import {PaymentDetailsFormValues} from "../../../User/userPaymentDetails.types";
import {Cook} from "../../Event/event.class";
import {ExpenseDomain} from "../Expense/expense.types";
import {ExpenseReport} from "./expenseReport.class";
import {
  ReportMode,
  ReportOptions,
  ReportPayeeOption,
  ReportPayeeSelection,
  ReportProgress,
  ReportRefund,
} from "./expenseReport.types";
import {REPORT_MODE_LABELS} from "./expenseReportLabels";
import {RefundDetailsSection} from "./expenseReportRefundSection";
import {useReportRefund} from "./useReportRefund";

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
 * @param ownPaymentDetails - Eigene Zahlungsangaben aus dem Profil
 *   (Story 7.4); `undefined` = werden noch geladen, `null` = keine
 *   hinterlegt.
 * @param ownAccountHolderName - Name für die eigene Abrechnung (Vor- und
 *   Nachname, `getAccountHolderName`); hält den Dialog frei von `AuthUser`.
 * @param onCreate - Erstellt das PDF; der Dialog wartet darauf und zeigt
 *   solange den Fortschritt, den `onCreate` über `onProgress` meldet.
 *   `refund`: Angaben der gewählten Person; bei «Alle Personen» die eigenen;
 *   `null` ohne Formular (keine eigenen Ausgaben bei «Alle Personen»).
 * @param onClose - Schliesst den Dialog (Abbrechen, Klick daneben).
 */
type ExpenseReportDialogProps = {
  open: boolean;
  expenses: ExpenseDomain[];
  cooks: Cook[];
  authUserId: string;
  ownPaymentDetails: PaymentDetailsFormValues | null | undefined;
  ownAccountHolderName: string;
  onCreate: (
    options: ReportOptions,
    refund: ReportRefund | null,
    onProgress: (progress: ReportProgress) => void,
  ) => Promise<void>;
  onClose: () => void;
};

/**
 * Dialog «Abrechnung erstellen»: für wen (eine Person oder alle), Aufbau
 * (eine Tabelle oder pro Budget) und Kommentare ja/nein (Standard: nein).
 * Dazu «Rückerstattung an» (Story 7.4): für die gewählte Person, bei «Alle
 * Personen» für die eigene (die anderen bekommen im PDF Linien).
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
 *   ownPaymentDetails={ownPaymentDetails}
 *   ownAccountHolderName={ownAccountHolderName}
 *   onCreate={handleCreateReport}
 *   onClose={handleCloseReportDialog}
 * />
 */
export const ExpenseReportDialog = ({
  open,
  expenses,
  cooks,
  authUserId,
  ownPaymentDetails,
  ownAccountHolderName,
  onCreate,
  onClose,
}: ExpenseReportDialogProps) => {
  const theme = useTheme();
  // Auf dem Handy als Vollbild wie die Dialoge für Budget und Ausgabe
  const fullScreen = useMediaQuery(theme.breakpoints.down("sm"));
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

  const payeeSelection = toPayeeSelection(selectedPayeeValue);
  // Anzahl für die aktuell gewählte Person, ändert sich mit der Auswahl
  const missingReceiptCount = ExpenseReport.countMissingReceipts(
    expenses,
    payeeSelection,
  );
  const reportRefund = useReportRefund({
    payeeSelection,
    authUserId,
    ownPaymentDetails,
    hasOwnExpenses: payeeOptions.some(
      (option) => option.payeeKey === authUserId,
    ),
  });
  const accountHolderName = reportRefund.isOwnPayee
    ? ownAccountHolderName
    : (payeeOptions.find(
        (option) => PAYEE_VALUE_PREFIX + option.payeeKey === selectedPayeeValue,
      )?.displayName ?? "");

  /**
   * Übergibt Optionen und Rückerstattung und wartet, bis das PDF erstellt
   * ist. Eine eingetippte, ungültige IBAN verhindert das Erstellen (F4).
   */
  const handleCreate = async () => {
    if (!reportRefund.validate()) return;
    setIsCreating(true);
    try {
      await onCreate(
        {
          mode,
          payeeSelection,
          includeComments,
          includeMissingReceiptPages,
        },
        reportRefund.refund,
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
      fullScreen={fullScreen}
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
          {reportRefund.details !== null ? (
            <RefundDetailsSection
              accountHolderName={accountHolderName}
              isAllPayees={payeeSelection.kind === "all"}
              details={reportRefund.details}
              isLoading={reportRefund.isLoading}
              formValidation={reportRefund.formValidation}
              onFieldChange={reportRefund.changeField}
              saveOption={reportRefund.saveOption}
            />
          ) : null}
        </Stack>
      </DialogContent>
      {/* Ausserhalb des Inhalts, damit er auch auf dem Handy sichtbar bleibt */}
      {progress !== null ? (
        <Box sx={classes.expenseReportProgress}>
          <ReportProgressIndicator progress={progress} />
        </Box>
      ) : null}
      <DialogActions>
        <Button onClick={onClose} disabled={isCreating}>
          {TEXT_CANCEL}
        </Button>
        <Button
          variant="contained"
          onClick={handleCreate}
          // solange die eigenen Angaben laden, entstünde ein PDF mit Linien
          disabled={isCreating || reportRefund.isLoading}
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
