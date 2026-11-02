import React from "react";
import {Event} from "../Event/event.class";
import DatabaseService from "../../Database/DatabaseService";
import {
  REPORT_RECEIPTS_FAILED as TEXT_REPORT_RECEIPTS_FAILED,
  REPORT_PAYMENT_DETAILS_SAVE_FAILED as TEXT_REPORT_PAYMENT_DETAILS_SAVE_FAILED,
} from "../../../constants/text";
import {AnalyticsEvent} from "../../Analytics/analyticsEvents";
import {trackEvent} from "../../Analytics/analyticsService";
import {ExpenseDomain} from "./Expense/expense.types";
import {
  ReportOptions,
  ReportProgress,
  ReportRefund,
} from "./Report/expenseReport.types";
import {useOwnPaymentDetails} from "./Report/useOwnPaymentDetails";
import {downloadExpenseCsv} from "./Export/downloadExpenseCsv";
import {DispatchAction, ReducerActions} from "./expenseTracking.reducer";
import AuthUser from "../../Session/authUser.class";
import {BudgetDomain} from "./Budget/budget.types";

/** Parameter für {@link useExpenseReportExport}. */
type UseExpenseReportExportParams = {
  event: Event;
  expenses: ExpenseDomain[] | null;
  budgets: BudgetDomain[] | null;
  database: DatabaseService;
  authUser: AuthUser | null;
  getAttachmentUrl: (attachmentPath: string) => Promise<string>;
  /** Schliesst das Menü «Exportieren». */
  closeExportMenu: () => void;
  dispatch: React.Dispatch<DispatchAction>;
  handleError: (error: unknown, context: string) => void;
};

/**
 * Abrechnung als PDF und Ausgaben als CSV exportieren, samt Zustand des Dialogs «Abrechnung erstellen».
 *
 * @param params - Siehe {@link UseExpenseReportExportParams}.
 * @returns Zustand und Handler für die Seite.
 */
export const useExpenseReportExport = ({
  event,
  database,
  authUser,
  expenses,
  budgets,
  getAttachmentUrl,
  closeExportMenu,
  dispatch,
  handleError,
}: UseExpenseReportExportParams) => {
  const {ownPaymentDetails, loadOwnPaymentDetails, saveOwnPaymentDetails} =
    useOwnPaymentDetails(database, authUser);
  /** Dialog «Abrechnung erstellen»; `key` zählt pro Öffnen hoch. */
  const [reportDialog, setReportDialog] = React.useState({
    open: false,
    key: 0,
  });
  /** Ein Export läuft: Knopf «Exportieren» zeigt Fortschritt und ist gesperrt. */
  const [isExporting, setIsExporting] = React.useState(false);

  /**
   * Öffnet den Dialog «Abrechnung erstellen» mit frischem Zustand und lädt
   * erst jetzt die eigenen Zahlungsangaben.
   */
  const handleOpenReportDialog = () => {
    closeExportMenu();
    loadOwnPaymentDetails();
    setReportDialog((previous) => ({open: true, key: previous.key + 1}));
  };

  /**
   * Menü «Exportieren» → «Ausgaben als CSV»: schliesst das Menü und lädt die
   * CSV mit allen Ausgaben herunter. Ein Fehler erscheint oben auf der Seite
   * und geht an Sentry; der Knopf «Exportieren» bleibt dabei bedienbar.
   */
  const handleExportCsv = () => {
    closeExportMenu();
    trackEvent(AnalyticsEvent.EXPENSES_EXPORTED, {type: "csv"});
    try {
      downloadExpenseCsv({
        expenses: expenses ?? [],
        budgets: budgets ?? [],
        event,
      });
    } catch (error) {
      handleError(error, "CSV exportieren");
    }
  };

  /** Schliesst den Dialog «Abrechnung erstellen». */
  const handleCloseReportDialog = () => {
    setReportDialog((previous) => ({...previous, open: false}));
  };

  /**
   * Erstellt die Abrechnung und startet den Download. Das PDF-Modul wird
   * erst hier nachgeladen. Fehler beim Erstellen meldet
   * `generateAndDownloadPdf` selbst an Sentry, darum nur anzeigen.
   * Fehlten Belege, erscheint danach ein Hinweis. Während des Exports
   * ist der Knopf «Exportieren» gesperrt. Auf Wunsch werden vorher die
   * eigenen Zahlungsangaben gespeichert; scheitert das, entsteht das PDF
   * trotzdem.
   *
   * @param options - Im Dialog gewählte Optionen.
   * @param refund - Adresse und IBAN; `null` bei «Alle Personen». Nie in
   *   Analytics oder Sentry.
   * @param onProgress - Fortschritt für den Dialog.
   */
  const handleCreateReport = async (
    options: ReportOptions,
    refund: ReportRefund | null,
    onProgress: (progress: ReportProgress) => void,
  ) => {
    trackEvent(AnalyticsEvent.PDF_EXPORTED, {type: "expenseReport"});
    setIsExporting(true);
    const isSaveFailed = refund?.shouldSave
      ? !(await saveOwnPaymentDetails(refund.details))
      : false;
    let isReportFailed = false;
    try {
      const {downloadExpenseReport} =
        await import("./Report/downloadExpenseReport");
      const result = await downloadExpenseReport({
        expenses: expenses ?? [],
        budgets: budgets ?? [],
        event,
        authUser: authUser!,
        options,
        refundDetails: refund?.details ?? null,
        getAttachmentUrl,
        onProgress,
        onError: (error) => {
          isReportFailed = true;
          dispatch({type: ReducerActions.GENERIC_ERROR, payload: error});
        },
      });
      // ohne PDF stimmt «trotzdem erstellt» nicht, der Fehler steht oben
      showReportHints(
        result.failedReceiptNumbers,
        isSaveFailed && !isReportFailed,
      );
    } catch (error) {
      // nur das Nachladen (Chunk nach einem Deploy weg) oder ein
      // Programmierfehler kann werfen
      handleError(error, "Abrechnung erstellen");
    } finally {
      // auch nach einem Fehler, sonst bliebe der Knopf gesperrt
      setIsExporting(false);
    }
    handleCloseReportDialog();
  };

  /**
   * Zeigt nach dem Erstellen einen Hinweis, wenn Belege fehlten
   * oder die Zahlungsangaben nicht gespeichert wurden.
   * Beides in einer Snackbar, sonst überschriebe der zweite den ersten.
   *
   * @param failedReceiptNumbers - Nummern der nicht geladenen Belege.
   * @param isPaymentDetailsSaveFailed - Speichern ins Profil gescheitert.
   */
  const showReportHints = (
    failedReceiptNumbers: number[],
    isPaymentDetailsSaveFailed: boolean,
  ) => {
    const hints = [
      ...(failedReceiptNumbers.length > 0
        ? [TEXT_REPORT_RECEIPTS_FAILED(failedReceiptNumbers)]
        : []),
      ...(isPaymentDetailsSaveFailed
        ? [TEXT_REPORT_PAYMENT_DETAILS_SAVE_FAILED]
        : []),
    ];
    if (hints.length === 0) {
      return;
    }
    dispatch({
      type: ReducerActions.SNACKBAR_SHOW,
      payload: {severity: "warning", message: hints.join(" ")},
    });
  };

  return {
    reportDialog,
    isExporting,
    ownPaymentDetails,
    handleOpenReportDialog,
    handleCloseReportDialog,
    handleExportCsv,
    handleCreateReport,
  };
};
