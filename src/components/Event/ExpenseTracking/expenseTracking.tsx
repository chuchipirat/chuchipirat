import * as Sentry from "@sentry/react";
import React, {useState} from "react";

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
  IconButton,
  Chip,
  Button,
  ToggleButtonGroup,
  ToggleButton,
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
  SnackbarCloseReason,
  LinearProgress,
} from "@mui/material";
import {Event} from "../Event/event.class";

import DatabaseService from "../../Database/DatabaseService";

import {
  EXPENSE_TRACKING as TEXT_EXPENSE_TRACKING,
  EXPENSE_TRACKING_NOT_ACTIVE as TEXT_EXPENSE_TRACKING_NOT_ACTIVE,
  EXPENSE_TRACKING_NOT_ACTIVE_DESCRIPTION as TEXT_EXPENSE_TRACKING_NOT_ACTIVE_DESCRIPTION,
  EXPENSE_TRACKING_NOT_ACTIVE_DESCRIPTION_HELPCENTER_LINK as TEXT_EXPENSE_TRACKING_NOT_ACTIVE_DESCRIPTION_HELPCENTER_LINK,
  // BUDGET_TYPE_PER_PERSON_PER_DAY_AMOUNT as TEXT_BUDGET_TYPE_PER_PERSON_PER_DAY_AMOUNT,
  // BUDGET_TYPE_FIXED as TEXT_BUDGET_TYPE_FIXED,
  EDIT_BUDGET as TEXT_EDIT_BUDGET,
  BUDGET_PER_PERSON_PER_DAY as TEXT_BUDGET_PER_PERSON_PER_DAY,
  BUDGET_TYPE_FIXED_AMOUNT as TEXT_BUDGET_TYPE_FIXED_AMOUNT,
  BUDGET_TYPE_PER_PERSON_PER_DAY as TEXT_BUDGET_TYPE_PER_PERSON_PER_DAY,
  BUDGET_TARGET_AMOUNT as TEXT_BUDGET_TARGET_AMOUNT,
  BUDGET_TARGET_AMOUNT_MISSING as TEXT_BUDGET_TARGET_AMOUNT_MISSING,
  NEW_BUDGET as TEXT_NEW_BUDGET,
  EXPENSE_TRACKING_OVERVIEW as TEXT_EXPENSE_TRACKING_OVERVIEW,
  EXPENSE_TRACKING_EXPENSES as TEXT_EXPENSE_TRACKING_EXPENSES,
  BUDGET_NAME as TEXT_BUDGET_NAME,
  BUDGET_AMOUNT as TEXT_BUDGET_AMOUNT,
  PLEASE_PROVIDE_NAME as TEXT_PLEASE_PROVIDE_NAME,
  PLEASE_PROVIDE_AMOUNT as TEXT_PLEASE_PROVIDE_AMOUNT,
  BUDGET_CURRENCY as TEXT_BUDGET_CURRENCY,
  BUDGET_ICON as TEXT_BUDGET_ICON,
  PLEASE_PROVIDE_ICON as TEXT_PLEASE_PROVIDE_ICON,
  BUDGET_TYPE as TEXT_BUDGET_TYPE,
  BUDGET_SAVED as TEXT_BUDGET_SAVED,
  SPENT_AMOUNT as TEXT_SPENT_AMOUNT,
  OF_LIMIT as TEXT_OF_LIMIT,
  BUDGET as TEXT_BUDGET,
  BUDGET_UPDATED as TEXT_BUDGET_UPDATED,
  BUDGET_DELETED as TEXT_BUDGET_DELETED,
  DELETE_BUDGET_DIALOG as TEXT_DELETE_BUDGET_DIALOG,
  DELETE_BUDGET_SIMPLE as TEXT_DELETE_BUDGET_SIMPLE,
  BUDGET_HAS_EXPENSES as TEXT_BUDGET_HAS_EXPENSES,
  BUDGET_CANT_BE_DELETED as TEXT_BUDGET_CANT_BE_DELETED,
} from "../../../constants/text/expenseTracking";
import {
  ALERT_TITLE_WAIT_A_MINUTE as TEXT_ALERT_TITLE_WAIT_A_MINUTE,
  CANCEL as TEXT_CANCEL,
  SAVE as TEXT_SAVE,
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
import {
  BudgetWithProgress,
  BudgetDomain,
  BudgetIcon,
  BudgetType,
} from "./budget.types";
import {CustomSnackbar, SnackbarState} from "../../Shared/customSnackbar";
import {AlertMessage} from "../../Shared/AlertMessage";

import EditIcon from "@mui/icons-material/EditOutlined";
import {
  CabinOutlined,
  CategoryOutlined,
  CelebrationOutlined,
  CleaningServicesOutlined,
  DirectionsBusOutlined,
  HandymanOutlined,
  HealthAndSafetyOutlined,
  LocalBarOutlined,
  LocalGroceryStoreOutlined,
  RestaurantOutlined,
  SportsSoccerOutlined,
  StorefrontOutlined,
  AddOutlined,
} from "@mui/icons-material";
import DeleteIcon from "@mui/icons-material/Delete";

import {AnalyticsEvent} from "../../Analytics/analyticsEvents";
import {trackEvent} from "../../Analytics/analyticsService";
import {
  formatAmountFromCents,
  parseAmountToCents,
} from "../../Shared/utils/currencyUtils";
import {FieldValidationError} from "../../Shared/fieldValidation.error.class";
import {EventGroupConfiguration} from "../GroupConfiguration/groupConfiguration.class";
import {DialogType, useCustomDialog} from "../../Shared/customDialogContext";
import {useRealtimeConnectionStatus} from "../../Shared/useRealtimeConnectionStatus";
import {RealtimeStatusBanner} from "../../Shared/RealtimeStatusBanner";

/** Ansicht der Abrechnungsseite: Budget-Übersicht oder (folgt) Ausgabenliste. */
type ExpenseTrackingView = "overview" | "expenses";

/**
 * Ordnet jedem {@link BudgetIcon} die passende MUI-Icon-Komponente zu.
 * Als `Record` typisiert, damit der Compiler eine fehlende Zuordnung meldet,
 * sobald dem Enum (und der DB) ein neues Icon hinzugefügt wird.
 */
export const BUDGET_ICON_MAP: Record<BudgetIcon, React.ElementType> = {
  [BudgetIcon.KITCHEN]: RestaurantOutlined,
  [BudgetIcon.GROCERIES]: LocalGroceryStoreOutlined,
  [BudgetIcon.BEVERAGES]: LocalBarOutlined,
  [BudgetIcon.KIOSK]: StorefrontOutlined,
  [BudgetIcon.THEME]: CelebrationOutlined,
  [BudgetIcon.MATERIAL]: HandymanOutlined,
  [BudgetIcon.TRANSPORT]: DirectionsBusOutlined,
  [BudgetIcon.ACCOMMODATION]: CabinOutlined,
  [BudgetIcon.ACTIVITIES]: SportsSoccerOutlined,
  [BudgetIcon.SAFETY]: HealthAndSafetyOutlined,
  [BudgetIcon.CLEANING]: CleaningServicesOutlined,
  [BudgetIcon.OTHER]: CategoryOutlined,
};

/** Aktionen, die der Reducer der Abrechnungsseite verarbeitet. */
enum ReducerActions {
  BUDGETS_FETCH_SUCCESS,
  BUDGET_CREATED,
  BUDGET_UPDATED,
  BUDGET_DELETED,
  GENERIC_ERROR,
  // SNACKBAR_SHOW,
  SNACKBAR_CLOSE,
}
/**
 * State der Abrechnungsseite.
 *
 * @param isError - `true`, solange ein Fehler oder Validierungshinweis angezeigt wird.
 * @param error - Anzuzeigender Fehler (nur gesetzt, wenn `isError` `true` ist).
 * @param budgets - Budgets des Events; `null`, solange noch nicht geladen.
 * @param spentAmounts - Summe der Ausgaben je Budget-ID in Rappen; `null` vor dem Laden.
 * @param snackbar - Zustand der Rückmeldung nach erfolgreichem Speichern/Löschen.
 */
type State = {
  isError: boolean;
  error: Error | null;
  budgets: BudgetDomain[] | null;
  spentAmounts: Record<string, number> | null;
  snackbar: SnackbarState;
};
/**
 * Alle Aktionen des Reducers mit ihrem jeweiligen Payload.
 * `BUDGET_DELETED` trägt das ganze Budget (statt nur der ID), damit der
 * Reducer bei Bedarf auf dessen Felder zugreifen kann.
 */
type DispatchAction =
  | {
      type: ReducerActions.BUDGETS_FETCH_SUCCESS;
      payload: {budgets: BudgetDomain[]; spentAmounts: Record<string, number>};
    }
  | {type: ReducerActions.BUDGET_CREATED; payload: BudgetDomain}
  | {type: ReducerActions.BUDGET_UPDATED; payload: BudgetDomain}
  | {type: ReducerActions.BUDGET_DELETED; payload: BudgetDomain}
  | {type: ReducerActions.GENERIC_ERROR; payload: Error}
  // | {
  //     type: ReducerActions.SNACKBAR_SHOW;
  //     payload: {severity: AlertColor; message: string};
  //   }
  | {type: ReducerActions.SNACKBAR_CLOSE};
/** Ausgangszustand: noch nichts geladen, kein Fehler, Snackbar geschlossen. */
const initialState: State = {
  budgets: null,
  spentAmounts: null,
  isError: false,
  error: null,
  snackbar: {open: false, severity: "success", message: ""},
};

/**
 * Reducer der Abrechnungsseite. Jede erfolgreiche Aktion setzt `isError`
 * zurück, damit ein vorübergehender Fehler (z.B. Netzwerk) nicht stehen
 * bleibt, sobald die Daten wieder erfolgreich geladen oder gespeichert wurden.
 *
 * @param state - Bisheriger State.
 * @param action - Auszuführende Aktion.
 * @returns Neuer State.
 * @throws {Error} Bei einer unbekannten Aktion (Exhaustive-Check).
 */
const expenseTrackingReducer = (
  state: State,
  action: DispatchAction,
): State => {
  switch (action.type) {
    case ReducerActions.BUDGETS_FETCH_SUCCESS:
      return {
        ...state,
        budgets: action.payload.budgets,
        spentAmounts: action.payload.spentAmounts,
        isError: false,
        error: null,
      };
    case ReducerActions.BUDGET_CREATED:
      return {
        ...state,
        budgets:
          state.budgets?.length == 0 || state.budgets == null
            ? [action.payload]
            : state.budgets?.concat(action.payload),
        snackbar: {open: true, severity: "success", message: TEXT_BUDGET_SAVED},
        isError: false,
        error: null,
      };
    case ReducerActions.BUDGET_UPDATED: {
      const updatedBudgets = (state.budgets ?? []).map((budget) =>
        budget.id === action.payload.id ? action.payload : budget,
      );
      return {
        ...state,
        budgets: updatedBudgets,
        snackbar: {
          open: true,
          severity: "success",
          message: TEXT_BUDGET_UPDATED,
        },
        isError: false,
        error: null,
      };
    }
    case ReducerActions.BUDGET_DELETED: {
      const updatedBudgets = (state.budgets ?? []).filter(
        (budget) => budget.id !== action.payload.id,
      );
      return {
        ...state,
        budgets: updatedBudgets,
        snackbar: {
          open: true,
          severity: "success",
          message: TEXT_BUDGET_DELETED,
        },
        isError: false,
        error: null,
      };
    }
    case ReducerActions.GENERIC_ERROR:
      return {
        ...state,
        isError: true,
        error: action.payload as Error,
      };
    case ReducerActions.SNACKBAR_CLOSE:
      return {
        ...state,
        snackbar: {
          severity: "success",
          message: "",
          open: false,
        },
        isError: false,
        error: null,
      };
    default: {
      const _exhaustiveCheck: never = action;
      throw new Error(`Unknown action: ${_exhaustiveCheck}`);
    }
  }
};

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
   * Liest Budgets und die bisher ausgegebenen Beträge je Budget. Rein
   * lesend — legt nie ein Budget an, damit es auch aus dem Realtime-Reload
   * gefahrlos aufgerufen werden kann.
   *
   * @returns Budgets des Events und Ausgabensummen je Budget-ID.
   */
  const fetchBudgets = React.useCallback(async () => {
    const budgets = await database.budgets.getBudgetsForEvent(event.uid);
    const spentAmounts = await database.expenses.getSpentAmountsByBudget(
      event.uid,
    );
    return {budgets, spentAmounts};
  }, [database, event.uid]);

  /**
   * Lädt die Budgets und schreibt sie in den State. Fehler werden über
   * {@link handleError} angezeigt und gemeldet. Wird für das Erstladen, bei
   * jeder Realtime-Änderung und nach einem Verbindungsabbruch verwendet.
   */
  const loadBudgets = React.useCallback(async () => {
    try {
      const {budgets, spentAmounts} = await fetchBudgets();
      dispatch({
        type: ReducerActions.BUDGETS_FETCH_SUCCESS,
        payload: {budgets, spentAmounts},
      });
    } catch (error) {
      handleError(error, "Budgets laden");
    }
  }, [fetchBudgets, handleError]);

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
  const budgetsWithProgress = React.useMemo<BudgetWithProgress[]>(() => {
    if (!state.budgets) return [];
    const spentAmounts = state.spentAmounts ?? {};
    return state.budgets.map((budget) => {
      const targetAmountInCents = Budget.getTargetAmountInCents(
        budget,
        groupConfiguration.totalPortions,
        event.numberOfDays,
      );
      const spentAmountInCents = spentAmounts[budget.id] ?? 0;
      return {
        budget,
        targetAmountInCents,
        spentAmountInCents,
        percentage:
          targetAmountInCents > 0
            ? Math.round((spentAmountInCents / targetAmountInCents) * 100)
            : 0,
      };
    });
  }, [
    state.budgets,
    state.spentAmounts,
    groupConfiguration,
    event.numberOfDays,
  ]);

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
    if (state.spentAmounts && state.spentAmounts[budget.id] > 0) {
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
/** Props für die Budget-Karte. */
interface BudgetCardProps {
  budgetWithProgress: BudgetWithProgress;
  handleEditClick: (budgetId: string) => void;
}

/**
 * Karte eines Budgets: Name, Icon, Typ, Fortschrittsbalken und Beträge.
 * Der Balken wird bei 85 % gelb und ab 100 % rot.
 *
 * @param props - Siehe {@link BudgetCardProps}.
 */
const BudgetCard = ({budgetWithProgress, handleEditClick}: BudgetCardProps) => {
  const classes = useCustomStyles();

  const BudgetIconComponent = BUDGET_ICON_MAP[budgetWithProgress.budget.icon];

  /** Farbe des Fortschrittsbalkens je nach Ausschöpfung des Budgets. */
  const getProgressColor = (
    percentage: number,
  ): "success" | "warning" | "error" => {
    if (percentage >= 100) return "error";
    if (percentage >= 85) return "warning";
    return "success";
  };

  const isPerPersonPerDay =
    budgetWithProgress.budget.budgetType === BudgetType.PER_PERSON_PER_DAY;

  const chipLabel = isPerPersonPerDay
    ? TEXT_BUDGET_PER_PERSON_PER_DAY(
        budgetWithProgress.budget.amountInCents,
        budgetWithProgress.budget.currency,
      )
    : budgetWithProgress.budget.amountInCents
      ? `${TEXT_BUDGET_TYPE_FIXED_AMOUNT}: ${formatAmountFromCents(budgetWithProgress.budget.amountInCents, budgetWithProgress.budget.currency)}`
      : TEXT_BUDGET_TYPE_FIXED_AMOUNT;

  return (
    <Card
      sx={classes.budgetCard}
      elevation={0}
      data-testid={budgetWithProgress.budget.id}
    >
      <Box sx={classes.budgetCardHeader}>
        <Box sx={classes.budgetCardTitleGroup}>
          <BudgetIconComponent fontSize="small" />
          <Typography variant="subtitle1" sx={classes.budgetCardTitle}>
            {budgetWithProgress.budget.name}
          </Typography>
        </Box>
        <IconButton
          size="small"
          aria-label={TEXT_EDIT_BUDGET}
          onClick={() => handleEditClick(budgetWithProgress.budget.id)}
        >
          <EditIcon fontSize="small" />
        </IconButton>
      </Box>

      <Chip
        size="small"
        label={chipLabel}
        sx={
          isPerPersonPerDay
            ? classes.budgetChipVariable
            : classes.budgetChipFixed
        }
      />

      <LinearProgress
        variant="determinate"
        value={Math.min(budgetWithProgress.percentage, 100)}
        color={getProgressColor(budgetWithProgress.percentage)}
        sx={classes.budgetProgressBar}
      />

      <Box sx={classes.budgetAmountRow}>
        <Typography
          variant="body2"
          sx={
            budgetWithProgress.percentage >= 100
              ? classes.budgetAmountOver
              : classes.budgetAmountNormal
          }
        >
          {TEXT_SPENT_AMOUNT(
            budgetWithProgress.spentAmountInCents,
            budgetWithProgress.budget.currency,
          )}
        </Typography>
        <Typography variant="body2" sx={classes.budgetAmountSecondary}>
          {TEXT_OF_LIMIT(
            budgetWithProgress.targetAmountInCents,
            budgetWithProgress.budget.currency,
          )}
        </Typography>
      </Box>

      {!isPerPersonPerDay && (
        <Box sx={classes.budgetAmountRow}>
          <Typography variant="body2" sx={classes.budgetAmountSecondary}>
            {budgetWithProgress.budget.amountInCents != null
              ? TEXT_BUDGET_TARGET_AMOUNT(
                  budgetWithProgress.budget.amountInCents,
                  budgetWithProgress.budget.currency,
                )
              : TEXT_BUDGET_TARGET_AMOUNT_MISSING}
          </Typography>
        </Box>
      )}
    </Card>
  );
};

/** Props der «Neues Budget»-Karte. */
interface AddBudgetCardProps {
  onClick: () => void;
}

/**
 * Klickbare Karte am Ende der Budget-Liste zum Anlegen eines neuen Budgets.
 * Dient bei leerer Liste zugleich als Leerzustand (analog Einkaufsliste).
 *
 * @param props - Siehe {@link AddBudgetCardProps}.
 */
export const AddBudgetCard: React.FC<AddBudgetCardProps> = ({onClick}) => {
  const classes = useCustomStyles();

  const handleClick = () => {
    onClick();
  };

  // Die Karte ist ein `Box` mit `role="button"` — Enter und Leertaste müssen
  // für die Tastaturbedienung von Hand abgebildet werden.
  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handleClick();
    }
  };

  return (
    <Box
      sx={classes.budgetCardAddNew}
      role="button"
      tabIndex={0}
      aria-label={TEXT_NEW_BUDGET}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
    >
      <AddOutlined fontSize="medium" />
      <Typography variant="body2">{TEXT_NEW_BUDGET}</Typography>
    </Box>
  );
};

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
type BudgetDetailDialogState = {
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

export {EventExpenseTrackingPage};
