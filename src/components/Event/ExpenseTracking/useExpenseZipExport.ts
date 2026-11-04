import React from "react";
import {Event} from "../Event/event.class";
import {EXPORT_RECEIPTS_FAILED as TEXT_EXPORT_RECEIPTS_FAILED} from "../../../constants/text";
import {AnalyticsEvent} from "../../Analytics/analyticsEvents";
import {trackEvent} from "../../Analytics/analyticsService";
import {ExpenseDomain} from "./Expense/expense.types";
import {ExportProgress} from "./Export/expenseExport.types";
import {DispatchAction, ReducerActions} from "./expenseTracking.reducer";
import {BudgetDomain} from "./Budget/budget.types";

/** Parameter für {@link useExpenseZipExport}. */
type UseExpenseZipExportParams = {
  event: Event;
  expenses: ExpenseDomain[] | null;
  budgets: BudgetDomain[] | null;
  getAttachmentUrl: (attachmentPath: string) => Promise<string>;
  /** Schliesst das Menü «Exportieren». */
  closeExportMenu: () => void;
  dispatch: React.Dispatch<DispatchAction>;
  handleError: (error: unknown, context: string) => void;
};

/**
 * Ausgaben mit Belegen als ZIP exportieren, samt Fortschritt.
 *
 * @param params - Siehe {@link UseExpenseZipExportParams}.
 * @returns Zustand und Handler für die Seite.
 */
export const useExpenseZipExport = ({
  event,
  expenses,
  budgets,
  getAttachmentUrl,
  closeExportMenu,
  dispatch,
  handleError,
}: UseExpenseZipExportParams) => {
  const [zipProgress, setZipProgress] = React.useState<ExportProgress | null>(
    null,
  );

  /**
   * Erstellt das ZIP mit CSV und Belegen und startet den Download.
   * `downloadExpenseZip` meldet nicht geladene Belege selbst an Sentry,
   * hier nur der Hinweis. Der Dialog öffnet sofort und schliesst in
   * jedem Fall, auch bei einem Fehler.
   */
  const handleDownloadReceiptsZip = async () => {
    closeExportMenu();
    trackEvent(AnalyticsEvent.EXPENSES_EXPORTED, {type: "zip"});
    setZipProgress({loaded: 0, total: 0});

    try {
      const {downloadExpenseZip} = await import("./Export/downloadExpenseZip");
      const {failedReceiptNumbers} = await downloadExpenseZip({
        expenses: expenses ?? [],
        budgets: budgets ?? [],
        event,
        getAttachmentUrl,
        onProgress: setZipProgress,
      });

      if (failedReceiptNumbers.length > 0) {
        dispatch({
          type: ReducerActions.SNACKBAR_SHOW,
          payload: {
            severity: "warning",
            message: TEXT_EXPORT_RECEIPTS_FAILED(failedReceiptNumbers),
          },
        });
      }
    } catch (error) {
      handleError(error, "ZIP exportieren");
    } finally {
      setZipProgress(null);
    }
  };

  return {
    zipProgress,
    handleDownloadReceiptsZip,
  };
};
