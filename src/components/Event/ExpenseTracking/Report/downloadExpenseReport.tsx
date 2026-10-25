import React from "react";
import * as Sentry from "@sentry/react";

import AuthUser from "../../../Session/authUser.class";
import {generateAndDownloadPdf} from "../../../Shared/pdfUtils";
import {isTransientNetworkError} from "../../../../utils/errorUtils";
import {Event} from "../../Event/event.class";
import {BudgetDomain} from "../Budget/budget.types";
import {ExpenseDomain} from "../Expense/expense.types";
import {ExpenseReport} from "./expenseReport.class";
import {
  ExpenseReportResult,
  LoadedReceipt,
  ReportOptions,
  ReportProgress,
} from "./expenseReport.types";
import {ExpenseReportPdf} from "./expenseReportPdf";
import {getReportFileName} from "./expenseReportLabels";
import {loadReceipts} from "./receiptLoader";

/** Ein Beleg, der nicht geladen werden konnte. */
type FailedReceipt = Extract<LoadedReceipt, {kind: "failed"}>;

/**
 * Eingaben für {@link downloadExpenseReport}.
 *
 * @param expenses - Alle Ausgaben des Anlasses.
 * @param budgets - Alle Budgets des Anlasses, in Anzeigereihenfolge.
 * @param event - Der Anlass (Name, Köch:innen, UID für Sentry).
 * @param authUser - Angemeldete Person (Fusszeile).
 * @param options - Im Dialog gewählte Optionen.
 * @param getAttachmentUrl - Liefert die URL eines Belegs.
 * @param onProgress - Fortschritt für den Dialog.
 * @param onError - Wird aufgerufen, wenn kein PDF entstand; Sentry ist dann
 *   bereits informiert (`generateAndDownloadPdf`).
 */
export type DownloadExpenseReportParams = {
  expenses: ExpenseDomain[];
  budgets: BudgetDomain[];
  event: Event;
  authUser: AuthUser;
  options: ReportOptions;
  getAttachmentUrl: (attachmentPath: string) => string;
  onProgress: (progress: ReportProgress) => void;
  onError: (error: Error) => void;
};

/**
 * Erstellt die Abrechnung als PDF mit Belegen und startet den Download.
 * Ein Beleg, der nicht lädt, blockiert nicht: Er wird im PDF als Leerseite
 * markiert und im Ergebnis zurückgegeben. Wirft nicht wegen Belegen
 * oder des PDFs; nur ein Programmierfehler könnte werfen, den fängt die Seite.
 *
 * @param params - Siehe {@link DownloadExpenseReportParams}.
 * @returns Nummern der Belege, die nicht geladen werden konnten.
 * @example
 * const {downloadExpenseReport} = await import("./Report/downloadExpenseReport");
 * const result = await downloadExpenseReport({...params});
 */
export const downloadExpenseReport = async ({
  expenses,
  budgets,
  event,
  authUser,
  options,
  getAttachmentUrl,
  onProgress,
  onError,
}: DownloadExpenseReportParams): Promise<ExpenseReportResult> => {
  const report = ExpenseReport.build({
    expenses,
    budgets,
    cooks: event.cooks,
    options,
  });
  const loadedReceipts = await loadReceipts(report.receipts, {
    getAttachmentUrl,
    onProgress,
  });
  const failedReceipts = loadedReceipts.filter(isFailedReceipt);
  reportFailedReceipts(failedReceipts, event.uid);

  onProgress({stage: "rendering"});
  const isDownloaded = await generateAndDownloadPdf(
    <ExpenseReportPdf
      report={report}
      loadedReceipts={loadedReceipts}
      eventName={event.name}
      authUser={authUser}
      generatedAt={new Date()}
    />,
    getReportFileName(event.name, report.payeeDisplayName),
    onError,
    {
      eventUid: event.uid,
      mode: options.mode,
      receiptCount: loadedReceipts.length,
    },
  );

  return {
    // ohne PDF kein Hinweis auf einzelne Belege, der Fehler steht schon oben
    failedReceiptNumbers: isDownloaded
      ? failedReceipts.map((failed) => failed.receipt.receiptNumber)
      : [],
  };
};

/**
 * Type Guard für nicht geladene Belege.
 *
 * @param loadedReceipt - Ein geladener Beleg.
 * @returns `true`, wenn der Beleg nicht geladen werden konnte.
 */
const isFailedReceipt = (
  loadedReceipt: LoadedReceipt,
): loadedReceipt is FailedReceipt => loadedReceipt.kind === "failed";

/**
 * Meldet nicht ladbare Belege gesammelt als ein Sentry-Ereignis: nur
 * Ausgaben-IDs, kein Inhalt. Netzfehler (offline, Abbruch) sind kein
 * Code-Problem und werden nicht gemeldet.
 *
 * @param failedReceipts - Nicht geladene Belege.
 * @param eventUid - UID des Anlasses.
 */
const reportFailedReceipts = (
  failedReceipts: FailedReceipt[],
  eventUid: string,
): void => {
  const reportableReceipts = failedReceipts.filter(
    (failed) => !isTransientNetworkError(failed.error),
  );
  if (reportableReceipts.length === 0) {
    return;
  }
  Sentry.captureException(reportableReceipts[0].error, {
    extra: {
      context: "Abrechnung: Belege laden",
      eventUid,
      expenseIds: reportableReceipts.map((failed) => failed.receipt.expenseId),
    },
  });
};
