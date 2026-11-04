import React from "react";

import DatabaseService from "../../Database/DatabaseService";
import AuthUser from "../../Session/authUser.class";
import {AnalyticsEvent} from "../../Analytics/analyticsEvents";
import {trackEvent} from "../../Analytics/analyticsService";
import {DialogType, useCustomDialog} from "../../Shared/customDialogContext";
import {FieldValidationError} from "../../Shared/fieldValidation.error.class";
import {parseAmountToCents} from "../../Shared/utils/currencyUtils";
import {isForeignKeyViolationError} from "../../../utils/errorUtils";
import {
  DELETE_BUDGET_DIALOG as TEXT_DELETE_BUDGET_DIALOG,
  DELETE_BUDGET_SIMPLE as TEXT_DELETE_BUDGET_SIMPLE,
  BUDGET_HAS_EXPENSES as TEXT_BUDGET_HAS_EXPENSES,
  BUDGET_CANT_BE_DELETED as TEXT_BUDGET_CANT_BE_DELETED,
  CANCEL as TEXT_CANCEL,
  DELETE as TEXT_DELETE,
  OK as TEXT_OK,
} from "../../../constants/text";
import {Event} from "../Event/event.class";
import {Budget} from "./Budget/budget.class";
import {BudgetDomain} from "./Budget/budget.types";
import {BudgetDetailDialogState} from "./Budget/budgetDetailDialog";
import {ExpenseDomain} from "./Expense/expense.types";
import {DispatchAction, ReducerActions} from "./expenseTracking.reducer";

/** Parameter für {@link useBudgetActions}. */
type UseBudgetActionsParams = {
  event: Event;
  database: DatabaseService;
  authUser: AuthUser | null;
  budgets: BudgetDomain[] | null;
  expenses: ExpenseDomain[] | null;
  dispatch: React.Dispatch<DispatchAction>;
  handleError: (error: unknown, context: string) => void;
  /** Zähler eigener Saves, siehe `useExpenseTrackingData`. */
  saveInProgressRef: React.MutableRefObject<number>;
};

/**
 * Budgets anlegen, ändern und löschen, samt Zustand des Budget-Dialogs.
 *
 * @param params - Siehe {@link UseBudgetActionsParams}.
 * @returns Zustand des Dialogs und die Handler der Budget-Aktionen.
 */
export const useBudgetActions = ({
  event,
  database,
  authUser,
  budgets,
  expenses,
  dispatch,
  handleError,
  saveInProgressRef,
}: UseBudgetActionsParams) => {
  const {customDialog} = useCustomDialog();
  const [budgetDetailDialogProperties, setBudgetDetailDialogProperties] =
    React.useState<{budget: BudgetDomain | null; open: boolean}>({
      budget: null,
      open: false,
    });

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
  const checkBudgetInputdata = (budget: BudgetDomain): boolean => {
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

    if (!checkBudgetInputdata(budget)) {
      return;
    }

    saveInProgressRef.current += 1;
    try {
      const newBudget = await database.budgets.createBudget(budget, authUser!);
      trackEvent(AnalyticsEvent.BUDGET_CREATED);
      dispatch({
        type: ReducerActions.BUDGET_CREATED,
        payload: newBudget.value,
      });
    } catch (error) {
      handleError(error, "Budget erstellen");
    } finally {
      setTimeout(() => {
        saveInProgressRef.current = Math.max(0, saveInProgressRef.current - 1);
      }, 400);
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

    if (!checkBudgetInputdata(budget)) {
      return;
    }

    saveInProgressRef.current += 1;
    try {
      const updated = await database.budgets.updateBudget(budget, authUser!);
      trackEvent(AnalyticsEvent.BUDGET_UPDATED);
      dispatch({type: ReducerActions.BUDGET_UPDATED, payload: updated});
    } catch (error) {
      handleError(error, "Budget aktualisieren");
    } finally {
      setTimeout(() => {
        saveInProgressRef.current = Math.max(0, saveInProgressRef.current - 1);
      }, 400);
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
    if (expenses?.some((expense) => expense.budgetId === budget.id)) {
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
      destructive: true,
      title: TEXT_DELETE_BUDGET_DIALOG(budget.name),
      text: TEXT_DELETE_BUDGET_SIMPLE,
      buttonTextCancel: TEXT_CANCEL,
      buttonTextConfirm: TEXT_DELETE,
    });
    if (!isConfirmed) return;

    saveInProgressRef.current += 1;
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
    } finally {
      setTimeout(() => {
        saveInProgressRef.current = Math.max(0, saveInProgressRef.current - 1);
      }, 400);
    }

    setBudgetDetailDialogProperties({budget: null, open: false});
  };

  /**
   * Öffnet den Dialog im Bearbeiten-Modus für das angeklickte Budget.
   *
   * @param budgetId - ID des Budgets der angeklickten Karte.
   */
  const handleBudgetEditClick = (budgetId: BudgetDomain["id"]) => {
    const budget = budgets?.find((budget) => budget.id === budgetId) ?? null;

    setBudgetDetailDialogProperties({
      ...budgetDetailDialogProperties,
      budget: budget,
      open: true,
    });
  };

  return {
    budgetDetailDialogProperties,
    setBudgetDetailDialogProperties,
    handleOpenCreateBudgetDialog,
    handleCreateBudget,
    handleUpdateBudget,
    handleDeleteBudget,
    handleBudgetEditClick,
  };
};
