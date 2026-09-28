import * as Sentry from "@sentry/react";
import React from "react";

import DatabaseService from "../../Database/DatabaseService";
import {useRealtimeConnectionStatus} from "../../Shared/useRealtimeConnectionStatus";
import {FieldValidationError} from "../../Shared/fieldValidation.error.class";
import {isTransientNetworkError, toError} from "../../../utils/errorUtils";
import {
  expenseTrackingReducer,
  initialState,
  ReducerActions,
} from "./expenseTracking.reducer";
import {useAuthUser} from "../../Session/authUserContext";
import {Event} from "../Event/event.class";
import {BudgetDomain} from "./budget.types";
import {ExpenseDomain} from "./expense.types";
import {Expense} from "./expense.class";

/** Parameter für {@link useExpenseTrackingData}. */
type UseExpenseTrackingDataParams = {
  event: Event;
  database: DatabaseService;
  /** `null`, solange noch nicht bekannt ist, ob eine Spende vorliegt. */
  hasDonation: boolean | null;
  /** Eine gemeinsame Instanz mit der Seite — sonst sieht das Status-Banner
   *  der Seite nicht denselben Verbindungsstatus, den dieser Hook setzt. */
  realtime: ReturnType<typeof useRealtimeConnectionStatus>;
  /** Zähler eigener, noch nicht abgeschlossener Saves — unterdrückt den
   *  Reload für das kurze Nachlauf-Fenster, in dem das Realtime-Echo des
   *  eigenen Saves eintreffen kann (Muster `useShoppingListHandlers.tsx`). */
  saveInProgressRef: React.MutableRefObject<number>;
};

/**
 * Lädt Budgets und Ausgaben eines Events und hält sie per Realtime aktuell.
 *
 * @param params - Siehe {@link UseExpenseTrackingDataParams}.
 * @returns State und Dispatch des Reducers sowie `loadData` (manuelles
 *   Neuladen) und `handleError` (auch für Fehler ausserhalb der
 *   Datenladung, z.B. beim Speichern/Löschen eines Budgets).
 */
export const useExpenseTrackingData = ({
  event,
  database,
  hasDonation,
  realtime,
  saveInProgressRef,
}: UseExpenseTrackingDataParams) => {
  const authUser = useAuthUser();
  const [state, dispatch] = React.useReducer(
    expenseTrackingReducer,
    initialState,
  );

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
   *
   * @returns Die frisch geladenen Budgets und Ausgaben, oder `null` bei
   *   einem Fehler — `loadDataAndHighlightChanges` braucht den direkten
   *   Rückgabewert für den Diff, weil `state` nach einem `dispatch()` erst
   *   mit dem nächsten React-Render aktuell ist, nicht schon synchron danach.
   */
  const loadData = React.useCallback(async () => {
    try {
      const [budgets, expenses] = await fetchData();
      dispatch({
        type: ReducerActions.BUDGETS_FETCH_SUCCESS,
        payload: {budgets, expenses},
      });
      return {budgets, expenses};
    } catch (error) {
      handleError(error, "Budgets laden");
      return null;
    }
  }, [fetchData, handleError]);

  const budgetsRef = React.useRef<BudgetDomain[]>([]);
  const expensesRef = React.useRef<ExpenseDomain[]>([]);
  const [highlightedBudgetIds, setHighlightedBudgetIds] = React.useState<
    Set<string>
  >(new Set());
  const [highlightedExpenseIds, setHighlightedExpenseIds] = React.useState<
    Set<string>
  >(new Set());
  const highlightTimeoutRef = React.useRef<ReturnType<typeof setTimeout>>();

  // Hält die Refs auch nach dem Erstladen aktuell (das ruft `loadData`
  // direkt auf, nicht `loadDataAndHighlightChanges`, siehe unten).
  React.useEffect(() => {
    budgetsRef.current = state.budgets ?? [];
    expensesRef.current = state.expenses ?? [];
  }, [state.budgets, state.expenses]);

  /**
   * Lädt neu und markiert Budgets/Ausgaben, die sich gegenüber dem letzten
   * bekannten Stand geändert haben, für 2 Sekunden zum Aufleuchten. Wird nur
   * von den Realtime-Callbacks aufgerufen, nicht vom Erstladen.
   */
  const loadDataAndHighlightChanges = React.useCallback(async () => {
    if (saveInProgressRef.current > 0) return; // eigener Save, Echo ignorieren

    const oldBudgets = budgetsRef.current;
    const oldExpenses = expensesRef.current;
    const result = await loadData();
    if (!result) return; // Fehlerfall, bereits von handleError gemeldet

    // Direkt mit dem frischen Rückgabewert diffen, nicht mit budgetsRef/
    // expensesRef: die werden erst vom Effect oben aktualisiert, sobald
    // React nach dem dispatch() neu gerendert hat — an dieser Stelle, direkt
    // nach `await loadData()`, ist das noch nicht passiert.
    const changedBudgetIds = Expense.diffIds(oldBudgets, result.budgets);
    const changedExpenseIds = Expense.diffIds(oldExpenses, result.expenses);

    // Refs auch direkt hier nachziehen: zwei schnell aufeinanderfolgende
    // Realtime-Events sollen jeweils gegen den wirklich letzten bekannten
    // Stand diffen, nicht gegen einen noch nicht nachgezogenen Ref-Wert.
    budgetsRef.current = result.budgets;
    expensesRef.current = result.expenses;

    if (changedBudgetIds.size === 0 && changedExpenseIds.size === 0) return;

    setHighlightedBudgetIds(changedBudgetIds);
    setHighlightedExpenseIds(changedExpenseIds);
    if (highlightTimeoutRef.current) clearTimeout(highlightTimeoutRef.current);
    highlightTimeoutRef.current = setTimeout(() => {
      setHighlightedBudgetIds(new Set());
      setHighlightedExpenseIds(new Set());
    }, 2000);
  }, [loadData, saveInProgressRef]);

  // Erstladen: Die Realtime-Subscription meldet nur Änderungen (auch beim
  // ersten Verbindungsaufbau wird `onChange` nicht aufgerufen) — der
  // Ausgangszustand muss deshalb separat geladen werden.
  React.useEffect(() => {
    if (hasDonation !== true || !authUser) return;
    void loadData();
  }, [hasDonation, authUser, loadData]);
  /* ------------------------------------------
  // Realtime-Subscription für Budgets
  // ------------------------------------------ */
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
      loadDataAndHighlightChanges, // Änderung durch eine andere Sitzung
      (error) =>
        Sentry.captureException(error, {
          extra: {context: "Realtime budgets subscription"},
        }),
      (status) => {
        realtime.setStatus("budgets", status);
        // Nach einem Verbindungsabbruch sind Änderungen verpasst worden, die
        // Realtime nicht nachliefert — daher einmalig neu laden.
        if (status === "connected") void loadDataAndHighlightChanges();
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
    loadDataAndHighlightChanges,
    realtime.setStatus,
    realtime.register,
    realtime.unregister,
  ]);
  /* ------------------------------------------
  // Realtime-Subscription für Ausgaben
  // ------------------------------------------ */
  // Realtime: `onChange` liefert keinen Payload, daher wird bei jeder
  // Änderung neu geladen. Ein eigener Save löst ebenfalls ein Echo aus — das
  // ist harmlos, weil der Reload idempotent ist und dieselben Daten liefert.
  // Zu `realtime` werden nur die (stabilen) Funktionen als Dependencies
  // geführt: `useRealtimeConnectionStatus()` gibt bei jedem Render ein neues
  // Objekt zurück, sonst würde der Channel bei jedem Render neu aufgebaut.

  React.useEffect(() => {
    if (!event.uid || hasDonation !== true || !authUser) return;

    const {unsubscribe, reconnect} = database.expenses.subscribeToExpenses(
      event.uid,
      loadDataAndHighlightChanges,
      (error) =>
        Sentry.captureException(error, {
          extra: {context: "Realtime expenses subscription"},
        }),
      (status) => {
        realtime.setStatus("expenses", status);
        if (status === "connected") void loadDataAndHighlightChanges();
      },
    );

    realtime.register("expenses", reconnect);
    return () => {
      unsubscribe();
      realtime.unregister("expenses");
    };
  }, [
    hasDonation,
    authUser,
    event.uid,
    database,
    loadDataAndHighlightChanges,
    realtime.setStatus,
    realtime.register,
    realtime.unregister,
  ]);

  return {
    state,
    dispatch,
    loadDataAndHighlightChanges,
    handleError,
    highlightedBudgetIds,
    highlightedExpenseIds,
  };
};
