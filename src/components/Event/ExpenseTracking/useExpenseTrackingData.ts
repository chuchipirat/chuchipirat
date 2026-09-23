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

/** Parameter für {@link useExpenseTrackingData}. */
type UseExpenseTrackingDataParams = {
  event: Event;
  database: DatabaseService;
  /** `null`, solange noch nicht bekannt ist, ob eine Spende vorliegt. */
  hasDonation: boolean | null;
  /** Eine gemeinsame Instanz mit der Seite — sonst sieht das Status-Banner
   *  der Seite nicht denselben Verbindungsstatus, den dieser Hook setzt. */
  realtime: ReturnType<typeof useRealtimeConnectionStatus>;
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
   */
  const loadData = React.useCallback(async () => {
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
    void loadData();
  }, [hasDonation, authUser, loadData]);

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
      loadData, // Änderung durch eine andere Sitzung
      (error) =>
        Sentry.captureException(error, {
          extra: {context: "Realtime budgets subscription"},
        }),
      (status) => {
        realtime.setStatus("budgets", status);
        // Nach einem Verbindungsabbruch sind Änderungen verpasst worden, die
        // Realtime nicht nachliefert — daher einmalig neu laden.
        if (status === "connected") void loadData();
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
    loadData,
    realtime.setStatus,
    realtime.register,
    realtime.unregister,
  ]);

  return {state, dispatch, loadData, handleError};
};
