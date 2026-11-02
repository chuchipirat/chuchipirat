import * as Sentry from "@sentry/react";
import React from "react";

import {
  Card,
  CardContent,
  CardHeader,
  Box,
  Skeleton,
  Container,
  Typography,
  Link,
  Stack,
  Button,
  ToggleButtonGroup,
  ToggleButton,
  SnackbarCloseReason,
  Tooltip,
  Chip,
  CircularProgress,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Dialog,
  DialogContent,
} from "@mui/material";
import {Event} from "../Event/event.class";

import DatabaseService from "../../Database/DatabaseService";

import {
  EXPENSE_TRACKING as TEXT_EXPENSE_TRACKING,
  EXPENSE_TRACKING_NOT_ACTIVE as TEXT_EXPENSE_TRACKING_NOT_ACTIVE,
  EXPENSE_TRACKING_NOT_ACTIVE_DESCRIPTION as TEXT_EXPENSE_TRACKING_NOT_ACTIVE_DESCRIPTION,
  EXPENSE_TRACKING_NOT_ACTIVE_DESCRIPTION_HELPCENTER_LINK as TEXT_EXPENSE_TRACKING_NOT_ACTIVE_DESCRIPTION_HELPCENTER_LINK,
  NEW_BUDGET as TEXT_NEW_BUDGET,
  EXPENSE_TRACKING_OVERVIEW as TEXT_EXPENSE_TRACKING_OVERVIEW,
  EXPENSE_TRACKING_EXPENSES as TEXT_EXPENSE_TRACKING_EXPENSES,
  EXPENSE_TRACKING_EVALUATION as TEXT_EXPENSE_TRACKING_EVALUATION,
  NEW_EXPENSE as TEXT_NEW_EXPENSE,
  ALERT_TITLE_WAIT_A_MINUTE as TEXT_ALERT_TITLE_WAIT_A_MINUTE,
  PLEASE_CREATE_BUDGET_FIRST as TEXT_PLEASE_CREATE_BUDGET_FIRST,
  ONLY_WITHOUT_RECEIPT as TEXT_ONLY_WITHOUT_RECEIPT,
  ALL_EXPENSES_HAVE_A_RECEIPT as TEXT_ALL_EXPENSES_HAVE_A_RECEIPT,
  CREATE_EXPENSE_REPORT as TEXT_CREATE_EXPENSE_REPORT,
  CREATE_EXPENSE_REPORT_NO_EXPENSES as TEXT_CREATE_EXPENSE_REPORT_NO_EXPENSES,
  EXPORT as TEXT_EXPORT,
  EXPORT_CSV as TEXT_EXPORT_CSV,
  EXPORT_ZIP as TEXT_EXPORT_ZIP,
  NO_RECEIPTS_AVAILABLE as TEXT_NO_RECEIPTS_AVAILABLE,
  EXPENSE_RECEIPT_TAB_BLOCKED as TEXT_EXPENSE_RECEIPT_TAB_BLOCKED,
  EXPENSE_RECEIPT_OPEN_LINK as TEXT_EXPENSE_RECEIPT_OPEN_LINK,
} from "../../../constants/text";

import {isTransientNetworkError} from "../../../utils/errorUtils";
import {DonationForm} from "../../Donate/DonationForm";
import {useCustomStyles} from "../../../constants/styles";
import {getHelpPageUrl} from "../../Navigation/helpCenter";
import {
  NavigationObject,
  NavigationValuesContext,
} from "../../Navigation/navigationContext";
import {Action} from "../../../constants/actions";
import {Budget} from "./Budget/budget.class";
import {useAuthUser} from "../../Session/authUserContext";
import {BudgetWithProgress} from "./Budget/budget.types";
import {CustomSnackbar} from "../../Shared/customSnackbar";
import {AlertMessage} from "../../Shared/AlertMessage";

import {
  AddOutlined,
  ArrowDropDown,
  FileDownloadOutlined,
  FolderZipOutlined,
  PictureAsPdfOutlined,
  TableChartOutlined,
} from "@mui/icons-material";

import {EventGroupConfiguration} from "../GroupConfiguration/groupConfiguration.class";
import {useRealtimeConnectionStatus} from "../../Shared/useRealtimeConnectionStatus";
import {RealtimeStatusBanner} from "../../Shared/RealtimeStatusBanner";
import {ReducerActions} from "./expenseTracking.reducer";
import {BudgetDetailDialog} from "./Budget/budgetDetailDialog";
import {Expense} from "./Expense/expense.class";
import {useExpenseTrackingData} from "./useExpenseTrackingData";
import {ExpenseOverview} from "./expenseOverview";
import {ExpenseTrackingPreview} from "./Preview/expenseTrackingPreview";
import {EXPENSE_TRACKING_PREVIEW_DATA} from "./Preview/expenseTrackingPreview.data";
import {useBudgetActions} from "./useBudgetActions";
import {useExpenseActions} from "./useExpenseActions";
import {useExpenseReportExport} from "./useExpenseReportExport";
import {useExpenseZipExport} from "./useExpenseZipExport";
import {ExpenseList} from "./Expense/expenseList";
import {ExpenseGroup} from "./Expense/expense.types";
import {ExpenseDetailDialog} from "./Expense/expenseDetailDialog";
import {ExpenseReportDialog} from "./Report/expenseReportDialog";
import {getEventDateList} from "../Menuplan/menuplanService";
import {MenuplanData} from "../Menuplan/menuplan.types";
import {ExpenseEvaluation} from "./Evaluation/expenseEvaluation";
import {getAccountHolderName} from "./Report/expenseReportLabels";
import {ExportProgressDialog} from "./Export/exportProgressDialog";

/** Ansicht der Abrechnungsseite: Budget-Übersicht, Ausgabenliste oder Auswertung. */
type ExpenseTrackingView = "overview" | "expenses" | "evaluation";

/** Props für die Event-Abrechnungsseite. */
interface EventExpenseTrackingPageProps {
  /** Das aktuelle Event-Objekt. */
  event: Event;
  /** Gruppenzusammenstellung */
  groupConfiguration: EventGroupConfiguration;
  /** Menüplan des Anlasses (für «Ø pro Mahlzeit» in der Auswertung). */
  menuplan: MenuplanData;
  /** Datenbank-Service für Supabase-Zugriffe. */
  database: DatabaseService;
}

/**
 * Abrechnungsseite eines Events (Tab «Abrechnung»).
 *
 * Ohne bestätigte Spende für den Anlass wird eine Freischaltungs-Ansicht mit
 * Spendenformular gezeigt. Mit Spende erscheinen die Budgets als Karten
 * (inkl. Fortschritt gegenüber den Ausgaben), die live über Supabase Realtime
 * aktuell gehalten werden. Budgets werden über einen Dialog angelegt,
 * bearbeitet und gelöscht.
 *
 * @param props - Siehe {@link EventExpenseTrackingPageProps}.
 */
const EventExpenseTrackingPage = ({
  event,
  groupConfiguration,
  menuplan,
  database,
}: EventExpenseTrackingPageProps) => {
  const navigationValuesContext = React.useContext(NavigationValuesContext);

  const [hasDonation, setHasDonation] = React.useState<boolean | null>(null);
  const [view, setView] = React.useState<ExpenseTrackingView>("overview");
  const [exportMenuAnchor, setExportMenuAnchor] =
    React.useState<HTMLElement | null>(null);
  const [showOnlyMissingReceipts, setShowOnlyMissingReceipts] =
    React.useState(false);
  const realtime = useRealtimeConnectionStatus();

  const classes = useCustomStyles();
  const authUser = useAuthUser();

  const saveInProgressRef = React.useRef(0);
  const {
    state,
    dispatch,
    handleError,
    highlightedBudgetIds,
    highlightedExpenseIds,
  } = useExpenseTrackingData({
    event,
    database,
    hasDonation,
    realtime,
    saveInProgressRef,
  });
  const {
    budgetDetailDialogProperties,
    setBudgetDetailDialogProperties,
    handleOpenCreateBudgetDialog,
    handleCreateBudget,
    handleUpdateBudget,
    handleDeleteBudget,
    handleBudgetEditClick,
  } = useBudgetActions({
    event,
    database,
    authUser,
    budgets: state.budgets,
    expenses: state.expenses,
    dispatch,
    handleError,
    saveInProgressRef,
  });
  const {
    expenseDetailDialogProperties,
    setExpenseDetailDialogProperties,
    defaultBudgetId,
    receiptFallback,
    closeReceiptFallback,
    getAttachmentUrl,
    handleOpenAttachmentFromList,
    handleOpenAttachmentFromDialog,
    handleOpenCreateExpenseDialog,
    handleEditExpense,
    handleCreateExpense,
    handleUpdateExpense,
    handleDeleteExpense,
  } = useExpenseActions({
    event,
    database,
    authUser,
    expenses: state.expenses,
    budgets: state.budgets,
    dispatch,
    handleError,
    saveInProgressRef,
  });
  const closeExportMenu = () => setExportMenuAnchor(null);
  const {
    reportDialog,
    isExporting,
    ownPaymentDetails,
    handleOpenReportDialog,
    handleCloseReportDialog,
    handleExportCsv,
    handleCreateReport,
  } = useExpenseReportExport({
    event,
    database,
    authUser,
    expenses: state.expenses,
    budgets: state.budgets,
    getAttachmentUrl,
    closeExportMenu,
    dispatch,
    handleError,
  });
  const {zipProgress, handleDownloadReceiptsZip} = useExpenseZipExport({
    event,
    expenses: state.expenses,
    budgets: state.budgets,
    getAttachmentUrl,
    closeExportMenu,
    dispatch,
    handleError,
  });
  const hasExpenses = (state.expenses?.length ?? 0) > 0;
  const hasReceipts =
    state.expenses?.some((expense) => expense.attachmentPath !== null) ?? false;

  /* ------------------------------------------
  // Spende für dieses Event laden
  // ------------------------------------------ */
  React.useEffect(() => {
    if (!event.uid) return;

    database.donations
      .getEventDonations(event.uid)
      .then((donations) => {
        setHasDonation(donations.length > 0);
      })
      .catch((error) => {
        setHasDonation(false);
        if (!isTransientNetworkError(error)) {
          Sentry.captureException(error, {
            extra: {context: "Event-Spende laden"},
          });
        }
      });
  }, [event.uid]);

  /* ------------------------------------------
  // Sollbetrag und Ausschöpfung je Budget ableiten
  // (nicht im State speichern: Teilnehmerzahl und Anlasstage ändern sich live
  // über die Gruppenkonfiguration, der Sollbetrag muss dann mitziehen)
  // ------------------------------------------ */
  const expenseTotals = React.useMemo(
    () => Expense.sumByBudgetAndCurrency(state.expenses ?? []),
    [state.expenses],
  );
  const eventDays = React.useMemo(
    () => getEventDateList({event}),
    [event.dates],
  );

  const budgetsWithProgress = React.useMemo<BudgetWithProgress[]>(() => {
    if (!state.budgets) return [];

    return state.budgets.map((budget) => {
      const targetAmountInCents = Budget.getTargetAmountInCents(
        budget,
        groupConfiguration.totalPortions,
        event.numberOfDays,
      );
      const {spentAmountInCents, otherCurrencies} = Budget.getSpentAmounts(
        budget,
        expenseTotals,
      );
      return {
        budget,
        targetAmountInCents,
        spentAmountInCents,
        otherCurrenciesSpent: otherCurrencies,
        percentage:
          targetAmountInCents > 0
            ? Math.round((spentAmountInCents / targetAmountInCents) * 100)
            : 0,
        projection: Budget.projectSpending({
          budget,
          expenses: state.expenses ?? [],
          eventDays,
          today: new Date(),
        }),
      };
    });
  }, [
    state.budgets,
    expenseTotals,
    groupConfiguration,
    event.numberOfDays,
    state.expenses,
    eventDays,
  ]);

  const expenseGroups = React.useMemo<ExpenseGroup[]>(() => {
    const visibleExpenses = showOnlyMissingReceipts
      ? (state.expenses ?? []).filter(
          (expense) => expense.attachmentPath === null,
        )
      : (state.expenses ?? []);
    return Expense.groupByBudget(visibleExpenses, state.budgets ?? []);
  }, [state.expenses, state.budgets, showOnlyMissingReceipts]);

  /* ------------------------------------------
  // Navigation-Handler
  // ------------------------------------------ */
  React.useEffect(() => {
    navigationValuesContext?.setNavigationValues({
      action: Action.NONE,
      object: NavigationObject.expenseTracking,
    });
  }, []);

  /* ------------------------------------------
  // View Handler Budget / Ausgaben
  // ------------------------------------------ */
  /**
   * Wechselt zwischen Budget-Übersicht und Ausgaben-Liste. `newView` ist
   * `null`, wenn auf den bereits aktiven Button geklickt wird (exklusive
   * `ToggleButtonGroup`) — dann bleibt die aktuelle Ansicht bestehen.
   *
   * @param _event - Klick-Event (ungenutzt).
   * @param newView - Neu gewählte Ansicht, oder `null` bei erneutem Klick.
   */
  const handleViewChange = (
    _event: React.MouseEvent<HTMLElement>,
    newView: ExpenseTrackingView | null,
  ) => {
    if (newView !== null) {
      setView(newView);
      setShowOnlyMissingReceipts(false);
    }
  };
  /* ------------------------------------------
  // Dialog Handling
  // ------------------------------------------ */

  /* ------------------------------------------
  // Snackbar-Handler
  // ------------------------------------------ */
  /**
   * Schliesst die Erfolgs-Snackbar. Ein Klick daneben (`"clickaway"`) wird
   * ignoriert, damit die Meldung nicht verschwindet, während man noch liest.
   *
   * @param _event - Schliess-Event (ungenutzt).
   * @param reason - Grund des Schliessens.
   */
  const handleSnackbarClose = (
    _event: globalThis.Event | React.SyntheticEvent<Element, globalThis.Event>,
    reason: SnackbarCloseReason,
  ) => {
    if (reason === "clickaway") {
      return;
    }
    dispatch({type: ReducerActions.SNACKBAR_CLOSE});
  };
  /* ------------------------------------------
  // UI Steuerung
  // ------------------------------------------ */
  const hasNoBudgets = !state.budgets || state.budgets.length === 0;
  /* ------------------------------------------
  // Filter «Nur ohne Beleg»
  // ------------------------------------------ */
  /**
   * Springt aus der Auswertung in die Ausgabenliste und zeigt dort nur die
   * Ausgaben ohne Beleg. Beide `setState` im selben Handler, damit React sie
   * zu einem Render zusammenfasst (kein kurzes Aufblitzen der vollen Liste).
   */
  const handleShowMissingReceipts = () => {
    setShowOnlyMissingReceipts(true);
    setView("expenses");
  };
  /**
   * Entfernt den Filter «Nur ohne Beleg» (✕ am Chip), die Ansicht bleibt.
   */
  const handleDeleteMissingReceiptFilter = () => {
    setShowOnlyMissingReceipts(false);
  };
  return (
    <React.Fragment>
      <Stack spacing={2}>
        <RealtimeStatusBanner
          status={realtime.overallStatus}
          onRetry={realtime.retryAll}
        />
        {state.isError && (
          <AlertMessage
            error={state.error!}
            messageTitle={TEXT_ALERT_TITLE_WAIT_A_MINUTE}
          />
        )}

        <Card sx={classes.card}>
          <CardHeader
            title={
              hasDonation || hasDonation === null
                ? TEXT_EXPENSE_TRACKING
                : TEXT_EXPENSE_TRACKING_NOT_ACTIVE
            }
            action={
              hasDonation === true ? (
                // Tooltip braucht ein Element, das Maus-Events liefert;
                // ein deaktivierter Button tut das nicht
                <Tooltip
                  title={
                    hasExpenses ? "" : TEXT_CREATE_EXPENSE_REPORT_NO_EXPENSES
                  }
                >
                  <Box component="span">
                    <Button
                      variant="outlined"
                      disabled={!hasExpenses || isExporting}
                      startIcon={
                        isExporting ? (
                          <CircularProgress size={16} />
                        ) : (
                          <FileDownloadOutlined />
                        )
                      }
                      endIcon={<ArrowDropDown />}
                      onClick={(clickEvent) =>
                        setExportMenuAnchor(clickEvent.currentTarget)
                      }
                      aria-haspopup="menu"
                      aria-expanded={Boolean(exportMenuAnchor)}
                    >
                      {TEXT_EXPORT}
                    </Button>

                    <Menu
                      anchorEl={exportMenuAnchor}
                      open={Boolean(exportMenuAnchor)}
                      onClose={() => setExportMenuAnchor(null)}
                      anchorOrigin={{vertical: "bottom", horizontal: "right"}}
                      transformOrigin={{vertical: "top", horizontal: "right"}}
                    >
                      <MenuItem onClick={handleOpenReportDialog}>
                        <ListItemIcon>
                          <PictureAsPdfOutlined fontSize="small" />
                        </ListItemIcon>
                        <ListItemText>
                          {TEXT_CREATE_EXPENSE_REPORT}
                        </ListItemText>
                      </MenuItem>
                      <MenuItem onClick={handleExportCsv}>
                        <ListItemIcon>
                          <TableChartOutlined fontSize="small" />
                        </ListItemIcon>
                        <ListItemText>{TEXT_EXPORT_CSV}</ListItemText>
                      </MenuItem>
                      <MenuItem
                        onClick={handleDownloadReceiptsZip}
                        disabled={!hasReceipts}
                      >
                        <ListItemIcon>
                          <FolderZipOutlined fontSize="small" />
                        </ListItemIcon>
                        <ListItemText
                          primary={TEXT_EXPORT_ZIP}
                          secondary={
                            hasReceipts ? undefined : TEXT_NO_RECEIPTS_AVAILABLE
                          }
                        />
                      </MenuItem>
                    </Menu>
                  </Box>
                </Tooltip>
              ) : null
            }
          />
          <CardContent>
            {hasDonation == null ? (
              <Box data-testid="expense-tracking-loading">
                <Skeleton />
                <Skeleton />
                <Skeleton />
              </Box>
            ) : hasDonation === false ? (
              <React.Fragment>
                <Typography variant="body1" sx={{marginBottom: 2}}>
                  {TEXT_EXPENSE_TRACKING_NOT_ACTIVE_DESCRIPTION}{" "}
                  <Link
                    href={getHelpPageUrl("event", "expensetracking")}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {
                      TEXT_EXPENSE_TRACKING_NOT_ACTIVE_DESCRIPTION_HELPCENTER_LINK
                    }
                  </Link>
                  .
                </Typography>

                <Container
                  data-testid="expense-tracking-locked"
                  maxWidth="sm"
                  sx={classes.container}
                >
                  <DonationForm
                    eventId={event.uid}
                    returnPath={`/event/${event.uid}?tab=expensetracking`}
                    source="expense-tracking"
                  />
                </Container>
              </React.Fragment>
            ) : null}
          </CardContent>
        </Card>
        {hasDonation === false && (
          <ExpenseTrackingPreview data={EXPENSE_TRACKING_PREVIEW_DATA} />
        )}
        {hasDonation === true && (
          <Box data-testid="expense-tracking-unlocked">
            <Box sx={classes.expenseTrackingToolbar}>
              <ToggleButtonGroup
                value={view}
                exclusive
                onChange={handleViewChange}
                size="small"
                color="primary"
                fullWidth
                sx={classes.expenseToolbarToggleGroup}
              >
                <ToggleButton value="overview">
                  {TEXT_EXPENSE_TRACKING_OVERVIEW}
                </ToggleButton>
                <ToggleButton value="expenses">
                  {TEXT_EXPENSE_TRACKING_EXPENSES}
                </ToggleButton>
                <ToggleButton value="evaluation">
                  {TEXT_EXPENSE_TRACKING_EVALUATION}
                </ToggleButton>
              </ToggleButtonGroup>
              {view === "overview" ? (
                <Button
                  fullWidth
                  variant="contained"
                  color="primary"
                  startIcon={<AddOutlined />}
                  onClick={handleOpenCreateBudgetDialog}
                  sx={classes.expenseToolbarAction}
                >
                  {TEXT_NEW_BUDGET}
                </Button>
              ) : view === "expenses" ? (
                <Tooltip
                  title={hasNoBudgets ? TEXT_PLEASE_CREATE_BUDGET_FIRST : ""}
                >
                  <Box component="span" sx={classes.expenseToolbarAction}>
                    <Button
                      fullWidth
                      variant="contained"
                      color="primary"
                      startIcon={<AddOutlined />}
                      onClick={handleOpenCreateExpenseDialog}
                      disabled={hasNoBudgets}
                    >
                      {TEXT_NEW_EXPENSE}
                    </Button>
                  </Box>
                </Tooltip>
              ) : null}
            </Box>
            {view === "overview" ? (
              <ExpenseOverview
                budgetsWithProgress={budgetsWithProgress}
                highlightedBudgetIds={highlightedBudgetIds}
                expenses={state.expenses ?? []}
                cooks={event.cooks}
                handleEditBudgetClick={handleBudgetEditClick}
                handleAddBudgetClick={handleOpenCreateBudgetDialog}
              />
            ) : view === "expenses" ? (
              <>
                {/* Ganzer Chip klickbar: das ✕ allein ist auf Mobile zu klein zum Tippen */}
                {showOnlyMissingReceipts && (
                  <Chip
                    onClick={handleDeleteMissingReceiptFilter}
                    onDelete={handleDeleteMissingReceiptFilter}
                    label={TEXT_ONLY_WITHOUT_RECEIPT}
                    sx={classes.expenseListFilterChip}
                  />
                )}
                <ExpenseList
                  expenseGroups={expenseGroups}
                  highlightedExpenseIds={highlightedExpenseIds}
                  emptyText={
                    showOnlyMissingReceipts
                      ? TEXT_ALL_EXPENSES_HAVE_A_RECEIPT
                      : undefined
                  }
                  handleEditClick={handleEditExpense}
                  handleOpenAttachment={handleOpenAttachmentFromList}
                />
              </>
            ) : (
              <ExpenseEvaluation
                eventId={event.uid}
                expenses={state.expenses ?? []}
                budgets={state.budgets ?? []}
                participantCount={groupConfiguration.totalPortions}
                eventDays={eventDays}
                handleEditClick={handleEditExpense}
                handleShowMissingReceipts={handleShowMissingReceipts}
                today={new Date()}
                menuplan={menuplan}
              />
            )}
          </Box>
        )}
      </Stack>
      <BudgetDetailDialog
        open={budgetDetailDialogProperties.open}
        budget={budgetDetailDialogProperties.budget}
        onClose={() =>
          setBudgetDetailDialogProperties({
            ...budgetDetailDialogProperties,
            open: false,
          })
        }
        onCreate={handleCreateBudget}
        onEdit={handleUpdateBudget}
        onDelete={handleDeleteBudget}
      />
      <ExpenseDetailDialog
        open={expenseDetailDialogProperties.open}
        expense={expenseDetailDialogProperties.expense}
        budgets={state.budgets ?? []}
        defaultBudgetId={defaultBudgetId}
        cooks={event.cooks}
        onCreate={handleCreateExpense}
        onEdit={handleUpdateExpense}
        onDelete={handleDeleteExpense}
        onClose={() =>
          setExpenseDetailDialogProperties({
            ...expenseDetailDialogProperties,
            open: false,
          })
        }
        handleOpenAttachment={handleOpenAttachmentFromDialog}
      />
      <Dialog open={receiptFallback.open} onClose={closeReceiptFallback}>
        <DialogContent>
          <Typography>
            {TEXT_EXPENSE_RECEIPT_TAB_BLOCKED}{" "}
            <Link
              href={receiptFallback.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={closeReceiptFallback}
            >
              {TEXT_EXPENSE_RECEIPT_OPEN_LINK}
            </Link>
          </Typography>
        </DialogContent>
      </Dialog>
      <ExpenseReportDialog
        key={reportDialog.key}
        open={reportDialog.open}
        expenses={state.expenses ?? []}
        cooks={event.cooks}
        authUserId={authUser!.uid}
        ownPaymentDetails={ownPaymentDetails}
        ownAccountHolderName={getAccountHolderName(
          {
            displayName: authUser!.publicProfile.displayName,
            payeeUserId: authUser!.uid,
          },
          authUser!,
        )}
        onCreate={handleCreateReport}
        onClose={handleCloseReportDialog}
      />
      <ExportProgressDialog progress={zipProgress} />

      <CustomSnackbar
        message={state.snackbar.message}
        severity={state.snackbar.severity}
        snackbarOpen={state.snackbar.open}
        handleClose={handleSnackbarClose}
      />
    </React.Fragment>
  );
};

export {EventExpenseTrackingPage};
