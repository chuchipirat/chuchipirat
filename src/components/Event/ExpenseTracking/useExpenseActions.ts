import * as Sentry from "@sentry/react";
import React from "react";
import {Event} from "../Event/event.class";
import DatabaseService from "../../Database/DatabaseService";
import {
  DELETE_BUDGET_SIMPLE as TEXT_DELETE_BUDGET_SIMPLE,
  CANCEL as TEXT_CANCEL,
  DELETE as TEXT_DELETE,
  DELETE_EXPENSE_DIALOG as TEXT_DELETE_EXPENSE_DIALOG,
} from "../../../constants/text";
import {AnalyticsEvent} from "../../Analytics/analyticsEvents";
import {trackEvent} from "../../Analytics/analyticsService";
import {DialogType, useCustomDialog} from "../../Shared/customDialogContext";
import {parseAmountToCents} from "../../Shared/utils/currencyUtils";
import {Expense} from "./Expense/expense.class";
import {
  ExpenseDomain,
  ExpensePayeeType,
  ATTACHMENT_MIME_TO_EXTENSION,
} from "./Expense/expense.types";
import {ExpenseDetailDialogState} from "./Expense/expenseDetailDialog";
import {DispatchAction, ReducerActions} from "./expenseTracking.reducer";
import AuthUser from "../../Session/authUser.class";
import {BudgetDomain} from "./Budget/budget.types";

/**
 * Gültigkeit eines signierten Beleg-Links. Der Link wird direkt vor dem
 * Öffnen oder Herunterladen erstellt, darum genügen wenige Minuten.
 */
const RECEIPT_LINK_VALIDITY_SECONDS = 300;

/**
 * Übersetzt die Formulareingaben des Ausgaben-Dialogs in ein `ExpenseDomain`-
 * Objekt für die Persistierung. Auf Modul-Ebene (nicht als Closure in der
 * Seite) definiert, damit sie unabhängig von der UI direkt getestet werden
 * kann — insbesondere die `payeeUserId`/`payeeName`-Zweige, die im normalen
 * Dialog-Ablauf nie mit einer zum `payeeType` inkonsistenten Kombination
 * aufgerufen werden (der Dialog setzt sie beim Typ-Wechsel bereits zurück),
 * hier aber trotzdem als zweite, unabhängige Absicherung greifen sollen.
 *
 * @param expenseInput - Die Formularwerte aus `ExpenseDetailDialogState`.
 * @param eventId - ID des Events, dem die Ausgabe zugeordnet wird.
 * @returns Das für `createExpense`/`updateExpense` vorbereitete Domain-Objekt.
 */
export const transformInputToExpenseDomain = (
  expenseInput: ExpenseDetailDialogState,
  eventId: string,
): ExpenseDomain => {
  return {
    id: "",
    eventId,
    budgetId: expenseInput.budgetId,
    date: expenseInput.date?.toDate() ?? new Date(NaN),
    amountInCents: parseAmountToCents(expenseInput.amount) ?? 0,
    currency: expenseInput.currency,
    label: expenseInput.label,
    comment: expenseInput.comment.trim() || null,
    payeeType: expenseInput.payeeType,
    payeeUserId:
      expenseInput.payeeType === ExpensePayeeType.EXISTING_USER
        ? expenseInput.payeeUserId
        : null,
    payeeName:
      expenseInput.payeeType === ExpensePayeeType.NEW_PERSON
        ? expenseInput.payeeName.trim() || null
        : null,
    attachmentPath: null,
    attachmentOriginalFilename: null,
  };
};

/** Parameter für {@link useExpenseActions}. */
type UseExpenseActionsParams = {
  event: Event;
  expenses: ExpenseDomain[] | null;
  budgets: BudgetDomain[] | null;
  database: DatabaseService;
  authUser: AuthUser | null;
  dispatch: React.Dispatch<DispatchAction>;
  handleError: (error: unknown, context: string) => void;
  /** Zähler eigener Saves, siehe `useExpenseTrackingData`. */
  saveInProgressRef: React.MutableRefObject<number>;
};

/**
 * Ausgaben anlegen, ändern und löschen, Belege öffnen, samt Zustand des Ausgaben-Dialogs.
 *
 * @param params - Siehe {@link UseExpenseActionsParams}.
 * @returns Zustand und Handler für die Seite.
 */
export const useExpenseActions = ({
  event,
  database,
  authUser,
  expenses,
  budgets,
  dispatch,
  handleError,
  saveInProgressRef,
}: UseExpenseActionsParams) => {
  const {customDialog} = useCustomDialog();
  const [expenseDetailDialogProperties, setExpenseDetailDialogProperties] =
    React.useState<{expense: ExpenseDomain | null; open: boolean}>({
      expense: null,
      open: false,
    });
  /** Link auf einen Beleg, falls der Browser den neuen Tab blockiert. */
  const [receiptFallback, setReceiptFallback] = React.useState({
    open: false,
    url: "",
  });
  const [lastUsedBudgetId, setLastUsedBudgetId] = React.useState<string | null>(
    null,
  );
  const defaultBudgetId = lastUsedBudgetId ?? budgets?.[0]?.id ?? null;

  /** Öffnet den Dialog im Anlegen-Modus (ohne vorhandene Ausgabe). */
  const handleOpenCreateExpenseDialog = () => {
    setExpenseDetailDialogProperties({expense: null, open: true});
  };

  /**
   * Öffnet den Bearbeiten-Dialog für eine Ausgabe.
   *
   * @param expenseId - ID der angeklickten Ausgabe.
   */
  const handleEditExpense = (expenseId: string) => {
    const expense =
      expenses?.find((expense) => expense.id === expenseId) ?? null;
    setExpenseDetailDialogProperties({expense, open: true});
  };

  /**
   * Validiert eine Ausgabe vor dem Speichern und zeigt Fehler an.
   *
   * @param expense - Zu prüfende Ausgabe.
   * @returns `true`, wenn die Ausgabe gültig ist.
   */
  const checkExpenseInputdata = (expense: ExpenseDomain): boolean => {
    try {
      Expense.checkExpenseData(expense);
    } catch (error) {
      handleError(error, "Validierung Expense-Input");
      return false;
    }
    return true;
  };

  /**
   * Liefert einen zeitlich begrenzten Link auf einen Beleg.
   *
   * @param attachmentPath - Beleg-Pfad relativ zum Ausgaben-Ordner
   *   (`<eventId>/expenses/<expenseId>.<ext>`).
   * @returns Signierter Link auf die Datei.
   * @throws Error, wenn der Link nicht erstellt werden kann.
   */
  const handleGetAttachmentUrl = (attachmentPath: string) =>
    database.storage.expenses.getSignedUrl(
      attachmentPath,
      RECEIPT_LINK_VALIDITY_SECONDS,
    );

  /**
   * Öffnet einen Beleg in einem neuen Tab. Der Tab wird noch im Klick
   * geöffnet und erst danach auf den Link gesetzt: Browser, vor allem Safari
   * auf dem Handy, blockieren Tabs, die erst nach einer Serverantwort aufgehen.
   *
   * @param attachmentPath - Beleg-Pfad relativ zum Ausgaben-Ordner.
   * @returns `null`, wenn der Tab offen ist. Blockiert ihn der Browser (z.B.
   *   Brave auf dem iPhone, auch ohne Pop-up-Blocker), der signierte Link: Einen
   *   echten Link blockieren Browser nicht.
   * @throws Error, wenn der Link nicht erstellt werden kann.
   */
  const openAttachment = async (
    attachmentPath: string,
  ): Promise<string | null> => {
    const receiptTab = window.open("", "_blank");
    if (!receiptTab) return handleGetAttachmentUrl(attachmentPath);
    receiptTab.opener = null;

    try {
      receiptTab.location.href = await handleGetAttachmentUrl(attachmentPath);
      return null;
    } catch (error) {
      receiptTab.close();
      throw error;
    }
  };

  /**
   * Öffnet einen Beleg aus der Liste. Blockiert der Browser den Tab, erscheint
   * ein kleiner Dialog mit Link; ein Fehler erscheint oben auf der Seite.
   *
   * @param attachmentPath - Beleg-Pfad relativ zum Ausgaben-Ordner.
   */
  const handleOpenAttachmentFromList = (attachmentPath: string) => {
    openAttachment(attachmentPath)
      .then((url) => {
        if (url) setReceiptFallback({open: true, url});
      })
      .catch((error) => handleError(error, "Beleg öffnen"));
  };

  /**
   * Schliesst den Dialog mit dem Beleg-Link. Der Link behält sein Ziel: Der
   * Browser folgt ihm erst nach dem Klick-Handler und täte sonst nichts.
   */
  const closeReceiptFallback = () =>
    setReceiptFallback((current) => ({...current, open: false}));

  /**
   * Öffnet einen Beleg aus dem Dialog. Der Dialog zeigt den Fehler selbst, darum
   * hier nur die Meldung an Sentry.
   *
   * @param attachmentPath - Beleg-Pfad relativ zum Ausgaben-Ordner.
   * @returns Siehe {@link openAttachment}.
   * @throws Den Fehler aus {@link openAttachment}.
   */
  const handleOpenAttachmentFromDialog = async (attachmentPath: string) => {
    try {
      return await openAttachment(attachmentPath);
    } catch (error) {
      Sentry.captureException(error, {extra: {context: "Beleg öffnen"}});
      throw error;
    }
  };

  /**
   * Legt eine neue Ausgabe an. Der Dialog wird sofort geschlossen; ein
   * Fehler erscheint oben auf der Seite.
   *
   * Beleg-Upload erfolgt zweiphasig: die Ausgabe muss zuerst angelegt sein,
   * damit ihre (von der DB vergebene) ID als Speicherpfad verwendet werden
   * kann. Ein fehlgeschlagener Upload wird separat gemeldet ("Beleg
   * hochladen"), damit er nicht fälschlich als gescheitertes Anlegen der
   * Ausgabe selbst erscheint.
   *
   * @param expenseInput - Eingaben aus dem Dialog.
   */
  const handleCreateExpense = async (
    expenseInput: ExpenseDetailDialogState,
  ) => {
    const expense = transformInputToExpenseDomain(expenseInput, event.uid);
    if (!checkExpenseInputdata(expense)) return;

    saveInProgressRef.current += 1;
    try {
      const newExpense = await database.expenses.createExpense(
        expense,
        authUser!,
      );
      setLastUsedBudgetId(newExpense.value.budgetId);
      trackEvent(AnalyticsEvent.EXPENSE_CREATED);
      dispatch({
        type: ReducerActions.EXPENSE_CREATED,
        payload: newExpense.value,
      });

      if (expenseInput.attachmentFile) {
        try {
          const extension =
            ATTACHMENT_MIME_TO_EXTENSION[expenseInput.attachmentFile.type];
          const relativePath = `${event.uid}/expenses/${newExpense.value.id}.${extension}`;

          // cacheControl "0": derselbe Pfad kann später wiederverwendet werden
          // (z.B. beim Ersetzen mit gleicher Endung) — ohne das würde ein
          // Browser/die CDN bis zu eine Stunde den alten Inhalt der gleichen
          // URL ausliefern (Supabase-Standard: cacheControl "3600").
          await database.storage.expenses.upload(
            relativePath,
            expenseInput.attachmentFile,
            expenseInput.attachmentFile.type,
            "0",
          );
          const updated = await database.expenses.updateExpense(
            {
              ...newExpense.value,
              attachmentPath: relativePath,
              attachmentOriginalFilename: expenseInput.attachmentFile.name,
            },
            authUser!,
          );
          dispatch({type: ReducerActions.EXPENSE_UPDATED, payload: updated});
        } catch (error) {
          // Ausgabe existiert bereits — nur der Beleg-Upload ist fehlgeschlagen.
          handleError(error, "Beleg hochladen");
        }
      }
    } catch (error) {
      handleError(error, "Ausgabe erstellen");
    } finally {
      setTimeout(() => {
        saveInProgressRef.current = Math.max(0, saveInProgressRef.current - 1);
      }, 400);
    }

    setExpenseDetailDialogProperties({expense: null, open: false});
  };

  /**
   * Speichert Änderungen an einer bestehenden Ausgabe.
   *
   * @param expenseId - ID der bearbeiteten Ausgabe.
   * @param expenseInput - Neue Eingaben aus dem Dialog.
   */
  const handleUpdateExpense = async (
    expenseId: string,
    expenseInput: ExpenseDetailDialogState,
  ) => {
    const expense = {
      ...transformInputToExpenseDomain(expenseInput, event.uid),
      id: expenseId,
    };
    if (!checkExpenseInputdata(expense)) {
      return;
    }
    saveInProgressRef.current += 1;
    try {
      const previousExpense = expenses?.find(
        (expense) => expense.id === expenseId,
      );

      if (expenseInput.attachmentFile) {
        const extension =
          ATTACHMENT_MIME_TO_EXTENSION[expenseInput.attachmentFile.type];
        const relativePath = `${event.uid}/expenses/${expenseId}.${extension}`;
        // Nur löschen, wenn sich der Pfad tatsächlich ändert (andere Endung als
        // vorher) — beim Ersetzen mit derselben Endung überschreibt
        // `upsert: true` denselben Pfad automatisch, genau wie bei cover.jpg.
        if (
          previousExpense?.attachmentPath &&
          previousExpense.attachmentPath !== relativePath
        ) {
          await database.storage.expenses.remove(
            previousExpense.attachmentPath,
          );
        }
        // cacheControl "0": siehe handleCreateExpense — derselbe Pfad kann bei
        // gleicher Endung wiederverwendet werden, ohne den alten Inhalt bis zu
        // eine Stunde lang aus dem Cache auszuliefern.
        await database.storage.expenses.upload(
          relativePath,
          expenseInput.attachmentFile,
          expenseInput.attachmentFile.type,
          "0",
        );
        expense.attachmentPath = relativePath;
        expense.attachmentOriginalFilename = expenseInput.attachmentFile.name;
      } else if (expenseInput.removeAttachment) {
        if (previousExpense?.attachmentPath) {
          await database.storage.expenses.remove(
            previousExpense.attachmentPath,
          );
        }
        expense.attachmentPath = null;
        expense.attachmentOriginalFilename = null;
      } else {
        // Beleg nicht angefasst — bestehenden Pfad/Dateinamen übernehmen,
        // sonst überschreibt transformInputToExpenseDomain()'s hartkodiertes
        // null das update() als volles Zeilen-Update.
        expense.attachmentPath = previousExpense?.attachmentPath ?? null;
        expense.attachmentOriginalFilename =
          previousExpense?.attachmentOriginalFilename ?? null;
      }

      const updated = await database.expenses.updateExpense(expense, authUser!);
      trackEvent(AnalyticsEvent.EXPENSE_UPDATED);
      dispatch({type: ReducerActions.EXPENSE_UPDATED, payload: updated});
    } catch (error) {
      handleError(error, "Ausgabe aktualisieren");
    } finally {
      setTimeout(() => {
        saveInProgressRef.current = Math.max(0, saveInProgressRef.current - 1);
      }, 400);
    }
  };

  /**
   * Löscht eine Ausgabe nach Rückfrage.
   *
   * @param expense - Die zu löschende Ausgabe.
   */
  const handleDeleteExpense = async (expense: ExpenseDomain) => {
    const isConfirmed = await customDialog({
      dialogType: DialogType.Confirm,
      destructive: true,
      title: TEXT_DELETE_EXPENSE_DIALOG(
        expense.label,
        expense.amountInCents,
        expense.currency,
      ),
      text: TEXT_DELETE_BUDGET_SIMPLE,
      buttonTextCancel: TEXT_CANCEL,
      buttonTextConfirm: TEXT_DELETE,
    });
    if (!isConfirmed) return;

    saveInProgressRef.current += 1;
    try {
      await database.expenses.deleteExpense(expense.id);
      trackEvent(AnalyticsEvent.EXPENSE_DELETED);
      dispatch({type: ReducerActions.EXPENSE_DELETED, payload: expense});

      if (expense.attachmentPath) {
        try {
          await database.storage.expenses.remove(expense.attachmentPath);
        } catch (error) {
          handleError(error, "Beleg löschen");
        }
      }
    } catch (error) {
      handleError(error, "Ausgabe löschen");
    } finally {
      setTimeout(() => {
        saveInProgressRef.current = Math.max(0, saveInProgressRef.current - 1);
      }, 400);
    }

    setExpenseDetailDialogProperties({expense: null, open: false});
  };

  return {
    expenseDetailDialogProperties,
    setExpenseDetailDialogProperties,
    defaultBudgetId,
    receiptFallback,
    closeReceiptFallback,
    getAttachmentUrl: handleGetAttachmentUrl,
    handleOpenAttachmentFromList,
    handleOpenAttachmentFromDialog,
    handleOpenCreateExpenseDialog,
    handleEditExpense,
    handleCreateExpense,
    handleUpdateExpense,
    handleDeleteExpense,
  };
};
