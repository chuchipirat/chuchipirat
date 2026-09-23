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
  Grid,
  Button,
  ToggleButtonGroup,
  ToggleButton,
  SnackbarCloseReason,
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
  DELETE_BUDGET_DIALOG as TEXT_DELETE_BUDGET_DIALOG,
  DELETE_BUDGET_SIMPLE as TEXT_DELETE_BUDGET_SIMPLE,
  BUDGET_HAS_EXPENSES as TEXT_BUDGET_HAS_EXPENSES,
  BUDGET_CANT_BE_DELETED as TEXT_BUDGET_CANT_BE_DELETED,
} from "../../../constants/text/expenseTracking";
import {
  ALERT_TITLE_WAIT_A_MINUTE as TEXT_ALERT_TITLE_WAIT_A_MINUTE,
  CANCEL as TEXT_CANCEL,
  DELETE as TEXT_DELETE,
  OK as TEXT_OK,
} from "../../../constants/text";

import {
  isForeignKeyViolationError,
  isTransientNetworkError,
  toError,
} from "../../../utils/errorUtils";
import {DonationForm} from "../../Donate/DonationForm";
import {useCustomStyles} from "../../../constants/styles";
import {getHelpPageUrl} from "../../Navigation/helpCenter";
import {
  NavigationObject,
  NavigationValuesContext,
} from "../../Navigation/navigationContext";
import {Action} from "../../../constants/actions";
import {Budget} from "./budget.class";
import {useAuthUser} from "../../Session/authUserContext";
import {BudgetWithProgress, BudgetDomain} from "./budget.types";
import {CustomSnackbar} from "../../Shared/customSnackbar";
import {AlertMessage} from "../../Shared/AlertMessage";

import {AddOutlined} from "@mui/icons-material";

import {AnalyticsEvent} from "../../Analytics/analyticsEvents";
import {trackEvent} from "../../Analytics/analyticsService";
import {parseAmountToCents} from "../../Shared/utils/currencyUtils";
import {FieldValidationError} from "../../Shared/fieldValidation.error.class";
import {EventGroupConfiguration} from "../GroupConfiguration/groupConfiguration.class";
import {DialogType, useCustomDialog} from "../../Shared/customDialogContext";
import {useRealtimeConnectionStatus} from "../../Shared/useRealtimeConnectionStatus";
import {RealtimeStatusBanner} from "../../Shared/RealtimeStatusBanner";
import {
  expenseTrackingReducer,
  initialState,
  ReducerActions,
} from "./expenseTracking.reducer";
import {BudgetCard, AddBudgetCard} from "./budgetCard";
import {
  BudgetDetailDialog,
  BudgetDetailDialogState,
} from "./budgetDetailDialog";
import {Expense} from "./expense.class";

/** Ansicht der Abrechnungsseite: Budget-Übersicht oder (folgt) Ausgabenliste. */
type ExpenseTrackingView = "overview" | "expenses";

/** Props für die Event-Abrechnungsseite. */
interface EventExpenseTrackingPageProps {
  /** Das aktuelle Event-Objekt. */
  event: Event;
  /** Gruppenzusammenstellung */
  groupConfiguration: EventGroupConfiguration;
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
  database,
}: EventExpenseTrackingPageProps) => {
  const navigationValuesContext = React.useContext(NavigationValuesContext);

  const [hasDonation, setHasDonation] = React.useState<boolean | null>(null);
  const [state, dispatch] = React.useReducer(
    expenseTrackingReducer,
    initialState,
  );
  const [view, setView] = React.useState<ExpenseTrackingView>("overview");
  const [budgetDetailDialogProperties, setBudgetDetailDialogProperties] =
    React.useState<{budget: BudgetDomain | null; open: boolean}>({
      budget: null,
      open: false,
    });
  const realtime = useRealtimeConnectionStatus();

  const classes = useCustomStyles();
  const authUser = useAuthUser();
  const {customDialog} = useCustomDialog();
  /* ------------------------------------------
  // Error Handling
  // ------------------------------------------ */
  /**
   * Zentrale Fehlerbehandlung: zeigt den Fehler oben auf der Seite an und
   * meldet ihn an Sentry. Nutzerhinweise (`FieldValidationError`) und
   * vorübergehende Netzwerkfehler werden bewusst nicht gemeldet.
   *
   * @param error - Der aufgetretene Fehler.
   * @param context - Kurzbeschreibung der Aktion für den Sentry-Kontext.
   */
  const handleError = React.useCallback((error: unknown, context: string) => {
    const isUserHint = error instanceof FieldValidationError;
    if (!isTransientNetworkError(error) && !isUserHint) {
      Sentry.captureException(error, {extra: {context}});
    }
    dispatch({type: ReducerActions.GENERIC_ERROR, payload: toError(error)});
  }, []);

  /* ------------------------------------------
  // Budget für dieses Event laden
  // ------------------------------------------ */
  /**
   * Liest Budgets und bereits getätigte Ausgaben. Rein
   * lesend — legt nie ein Budget an, damit es auch aus dem Realtime-Reload
   * gefahrlos aufgerufen werden kann.
   *
   * @returns Budgets und Ausgaben des Anlasses, als Array
   */
  const fetchData = React.useCallback(async () => {
    return await Promise.all([
      database.budgets.getBudgetsForEvent(event.uid),
      database.expenses.getExpensesForEvent(event.uid),
    ]);
  }, [database, event.uid]);

  /**
   * Lädt die Budgets und schreibt sie in den State. Fehler werden über
   * {@link handleError} angezeigt und gemeldet. Wird für das Erstladen, bei
   * jeder Realtime-Änderung und nach einem Verbindungsabbruch verwendet.
   */
  const loadBudgets = React.useCallback(async () => {
    try {
      const [budgets, expenses] = await fetchData();
      dispatch({
        type: ReducerActions.BUDGETS_FETCH_SUCCESS,
        payload: {budgets, expenses},
      });
    } catch (error) {
      handleError(error, "Budgets laden");
    }
  }, [fetchData, handleError]);

  /* ------------------------------------------
  // Realtime-Subscription für Budgets
  // ------------------------------------------ */
  // Erstladen: Die Realtime-Subscription meldet nur Änderungen (auch beim
  // ersten Verbindungsaufbau wird `onChange` nicht aufgerufen) — der
  // Ausgangszustand muss deshalb separat geladen werden.
  React.useEffect(() => {
    if (hasDonation !== true || !authUser) return;
    void loadBudgets();
  }, [hasDonation, authUser, loadBudgets]);

  // Realtime: `onChange` liefert keinen Payload, daher wird bei jeder
  // Änderung neu geladen. Ein eigener Save löst ebenfalls ein Echo aus — das
  // ist harmlos, weil der Reload idempotent ist und dieselben Daten liefert.
  // Zu `realtime` werden nur die (stabilen) Funktionen als Dependencies
  // geführt: `useRealtimeConnectionStatus()` gibt bei jedem Render ein neues
  // Objekt zurück, sonst würde der Channel bei jedem Render neu aufgebaut.
  React.useEffect(() => {
    if (!event.uid || hasDonation !== true || !authUser) return;

    const {unsubscribe, reconnect} = database.budgets.subscribeToBudgets(
      event.uid,
      loadBudgets, // Änderung durch eine andere Sitzung
      (error) =>
        Sentry.captureException(error, {
          extra: {context: "Realtime budgets subscription"},
        }),
      (status) => {
        realtime.setStatus("budgets", status);
        // Nach einem Verbindungsabbruch sind Änderungen verpasst worden, die
        // Realtime nicht nachliefert — daher einmalig neu laden.
        if (status === "connected") void loadBudgets();
      },
    );

    realtime.register("budgets", reconnect);
    return () => {
      unsubscribe();
      realtime.unregister("budgets");
    };
  }, [
    hasDonation,
    authUser,
    event.uid,
    database,
    loadBudgets,
    realtime.setStatus,
    realtime.register,
    realtime.unregister,
  ]);
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
  // (nicht im State speichern: Teilnehmerzahl und Lagertage ändern sich live
  // über die Gruppenkonfiguration, der Sollbetrag muss dann mitziehen)
  // ------------------------------------------ */
  const expenseTotals = React.useMemo(
    () => Expense.sumByBudgetAndCurrency(state.expenses ?? []),
    [state.expenses],
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
      };
    });
  }, [state.budgets, expenseTotals, groupConfiguration, event.numberOfDays]);

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
  const handleViewChange = (
    _event: React.MouseEvent<HTMLElement>,
    newView: ExpenseTrackingView | null,
  ) => {
    if (newView !== null) {
      setView(newView);
    }
  };
  /* ------------------------------------------
  // Dialog Handling
  // ------------------------------------------ */
  /**
   * Wandelt die Formulareingaben des Dialogs in ein Domain-Objekt um.
   * Die ID bleibt leer und wird beim Anlegen von der Datenbank vergeben.
   *
   * @param budgetInput - Eingaben aus dem Dialog (Betrag als Text).
   * @returns Budget mit Betrag in Rappen (`null`, falls nicht lesbar).
   */
  const transformInputToBudgetDomain = (
    budgetInput: BudgetDetailDialogState,
  ): BudgetDomain => {
    return {
      id: "",
      eventId: event.uid,
      name: budgetInput.name,
      budgetType: budgetInput.budgetType,
      amountInCents: parseAmountToCents(budgetInput.amount),
      currency: budgetInput.currency,
      icon: budgetInput.icon!,
    };
  };
  /** Öffnet den Dialog im Anlegen-Modus (ohne vorhandenes Budget). */
  const handleOpenCreateBudgetDialog = () => {
    setBudgetDetailDialogProperties({
      ...budgetDetailDialogProperties,
      budget: null,
      open: true,
    });
  };

  /**
   * Validiert ein Budget vor dem Speichern und zeigt Fehler an.
   *
   * @param budget - Zu prüfendes Budget.
   * @returns `true`, wenn das Budget gültig ist.
   */
  const checkInputdata = (budget: BudgetDomain): boolean => {
    try {
      Budget.checkBudgetData(budget);
    } catch (error) {
      handleError(error, "Validierung Budget-Input");
      return false;
    }
    return true;
  };

  /**
   * Legt ein neues Budget an. Der Dialog wird sofort geschlossen; ein
   * Fehler erscheint oben auf der Seite.
   *
   * @param budgetInput - Eingaben aus dem Dialog.
   */
  const handleCreateBudget = async (budgetInput: BudgetDetailDialogState) => {
    const budget = transformInputToBudgetDomain(budgetInput);

    if (!checkInputdata(budget)) {
      return;
    }

    try {
      const newBudget = await database.budgets.createBudget(budget, authUser!);
      trackEvent(AnalyticsEvent.BUDGET_CREATED);
      dispatch({
        type: ReducerActions.BUDGET_CREATED,
        payload: newBudget.value,
      });
    } catch (error) {
      handleError(error, "Budget erstellen");
    }

    setBudgetDetailDialogProperties({budget: null, open: false});
  };
  /**
   * Speichert Änderungen an einem bestehenden Budget.
   *
   * @param budgetId - ID des bearbeiteten Budgets.
   * @param budgetInput - Neue Eingaben aus dem Dialog.
   */
  const handleUpdateBudget = async (
    budgetId: string,
    budgetInput: BudgetDetailDialogState,
  ) => {
    const budget = {...transformInputToBudgetDomain(budgetInput), id: budgetId};

    if (!checkInputdata(budget)) {
      return;
    }

    try {
      const updated = await database.budgets.updateBudget(budget, authUser!);
      trackEvent(AnalyticsEvent.BUDGET_UPDATED);
      dispatch({type: ReducerActions.BUDGET_UPDATED, payload: updated});
    } catch (error) {
      handleError(error, "Budget aktualisieren");
    }
  };
  /**
   * Löscht ein Budget nach Rückfrage. Budgets mit Ausgaben können nicht
   * gelöscht werden (FK `event_expenses.budget_id` ist `ON DELETE RESTRICT`).
   *
   * @param budget - Das zu löschende Budget.
   */
  const handleDeleteBudget = async (budget: BudgetDomain) => {
    // Vorab prüfen, damit die Nutzer:in eine klare Meldung statt eines
    // Datenbankfehlers erhält. Zeigt der lokale Stand (noch) keine Ausgaben,
    // sie sind aber inzwischen von jemand anderem erfasst worden, meldet die
    // Datenbank den Fremdschlüssel-Fehler und `handleError` zeigt ihn an.
    if (state.expenses?.some((expense) => expense.budgetId === budget.id)) {
      await customDialog({
        dialogType: DialogType.Confirm,
        title: TEXT_BUDGET_CANT_BE_DELETED,
        text: TEXT_BUDGET_HAS_EXPENSES,
        buttonTextConfirm: TEXT_OK,
      });
      return;
    }

    const isConfirmed = await customDialog({
      dialogType: DialogType.Confirm,
      title: TEXT_DELETE_BUDGET_DIALOG(budget.name),
      text: TEXT_DELETE_BUDGET_SIMPLE,
      buttonTextCancel: TEXT_CANCEL,
      buttonTextConfirm: TEXT_DELETE,
    });
    if (!isConfirmed) return;

    try {
      await database.budgets.deleteBudget(budget.id);
      trackEvent(AnalyticsEvent.BUDGET_DELETED);
      dispatch({type: ReducerActions.BUDGET_DELETED, payload: budget});
    } catch (error) {
      if (isForeignKeyViolationError(error)) {
        handleError(
          new FieldValidationError(TEXT_BUDGET_HAS_EXPENSES),
          "Budget löschen",
        );
      } else {
        handleError(error, "Budget löschen");
      }
    }

    setBudgetDetailDialogProperties({budget: null, open: false});
  };

  /**
   * Öffnet den Dialog im Bearbeiten-Modus für das angeklickte Budget.
   *
   * @param budgetId - ID des Budgets der angeklickten Karte.
   */
  const handleBudgetEditClick = (budgetId: BudgetDomain["id"]) => {
    const budget =
      state.budgets?.find((budget) => budget.id === budgetId) ?? null;

    setBudgetDetailDialogProperties({
      ...budgetDetailDialogProperties,
      budget: budget,
      open: true,
    });
  };
  /* ------------------------------------------
  // Snackbar-Handler
  // ------------------------------------------ */
  const handleSnackbarClose = (
    _event: globalThis.Event | React.SyntheticEvent<Element, globalThis.Event>,
    reason: SnackbarCloseReason,
  ) => {
    if (reason === "clickaway") {
      return;
    }
    dispatch({type: ReducerActions.SNACKBAR_CLOSE});
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
        {hasDonation === true && (
          <Box data-testid="expense-tracking-unlocked">
            <Box sx={classes.budgetToolbar}>
              <ToggleButtonGroup
                value={view}
                exclusive
                onChange={handleViewChange}
                size="small"
                color="primary"
              >
                <ToggleButton value="overview">
                  {TEXT_EXPENSE_TRACKING_OVERVIEW}
                </ToggleButton>
                <ToggleButton value="expenses" disabled>
                  {TEXT_EXPENSE_TRACKING_EXPENSES}
                </ToggleButton>
              </ToggleButtonGroup>

              <Button
                variant="contained"
                color="primary"
                startIcon={<AddOutlined />}
                onClick={handleOpenCreateBudgetDialog}
              >
                {TEXT_NEW_BUDGET}
              </Button>
            </Box>

            <Grid container spacing={2}>
              {budgetsWithProgress?.map((budget) => (
                <Grid
                  key={`budgeCardGrid_${budget.budget.id}`}
                  size={{xs: 12, md: 4}}
                >
                  <BudgetCard
                    key={`budgetCard_${budget.budget.id}`}
                    budgetWithProgress={budget}
                    handleEditClick={handleBudgetEditClick}
                  />
                </Grid>
              ))}
              <Grid size={{xs: 12, md: 4}}>
                <AddBudgetCard onClick={handleOpenCreateBudgetDialog} />
              </Grid>
            </Grid>
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
