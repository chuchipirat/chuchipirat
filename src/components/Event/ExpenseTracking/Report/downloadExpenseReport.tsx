import React from "react";
import * as Sentry from "@sentry/react";

import AuthUser from "../../../Session/authUser.class";
import {generateAndDownloadPdf} from "../../../Shared/pdfUtils";
import {isTransientNetworkError} from "../../../../utils/errorUtils";
import {PaymentDetailsFormValues} from "../../../User/userPaymentDetails.types";
import {Event} from "../../Event/event.class";
import {BudgetDomain} from "../Budget/budget.types";
import {ExpenseDomain} from "../Expense/expense.types";
import {ExpenseReport} from "./expenseReport.class";
import {
  ExpenseReportResult,
  LoadedReceipt,
  ReportOptions,
  ReportPayeeSelection,
  ReportProgress,
} from "./expenseReport.types";
import {embedPdfReceipts} from "./embedPdfReceipts";
import {ExpenseReportPdf} from "./expenseReportPdf";
import {getReportFileName} from "./expenseReportLabels";
import {EncryptedReceiptError, loadReceipts} from "./receiptLoader";
import {getReceiptPageSlots} from "./receiptPageSlots";

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
 * @param refundDetails - Adresse und IBAN für «Rückerstattung an»
 *   (Story 7.4): der gewählten Person bzw. bei «Alle Personen» die eigenen;
 *   `null` = Linien. Bewusst getrennt von `options` und nie im
 *   Sentry-Kontext (F7).
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
  refundDetails: PaymentDetailsFormValues | null;
  getAttachmentUrl: (attachmentPath: string) => string;
  onProgress: (progress: ReportProgress) => void;
  onError: (error: Error) => void;
};

/**
 * Erstellt die Abrechnung als PDF mit Belegen und startet den Download.
 * PDF-Belege setzt pdf-lib nach dem Zeichnen Seite für Seite ein.
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
  refundDetails,
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
      refundDetailsByPayeeKey={getRefundDetailsByPayeeKey(
        options.payeeSelection,
        refundDetails,
        authUser.uid,
      )}
    />,
    getReportFileName(event.name, report.payeeDisplayName),
    onError,
    {
      eventUid: event.uid,
      mode: options.mode,
      receiptCount: loadedReceipts.length,
      pdfReceiptPageCount: countPdfReceiptPages(loadedReceipts),
    },
    createPdfTransform(loadedReceipts),
  );

  return {
    // ohne PDF kein Hinweis auf einzelne Belege, der Fehler steht schon oben
    failedReceiptNumbers: isDownloaded
      ? failedReceipts.map((failed) => failed.receipt.receiptNumber)
      : [],
  };
};

/**
 * Ordnet die Angaben der richtigen Person zu: bei einer Person dieser, bei
 * «Alle Personen» der eigenen Section. Alle anderen bekommen Linien.
 *
 * @param payeeSelection - Auswahl im Dialog.
 * @param refundDetails - Angaben aus dem Dialog.
 * @param authUserId - UID der angemeldeten Person.
 * @returns Angaben pro `payeeKey`; leer ohne Angaben.
 */
const getRefundDetailsByPayeeKey = (
  payeeSelection: ReportPayeeSelection,
  refundDetails: PaymentDetailsFormValues | null,
  authUserId: string,
): Record<string, PaymentDetailsFormValues> => {
  if (refundDetails === null) {
    return {};
  }
  const payeeKey =
    payeeSelection.kind === "single" ? payeeSelection.payeeKey : authUserId;
  return {[payeeKey]: refundDetails};
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
 * Anzahl Belegseiten, die pdf-lib einsetzen muss (für Sentry: grosse
 * Werte erklären Speicherprobleme auf dem Handy).
 *
 * @param loadedReceipts - Geladene Belege.
 * @returns Summe der Seiten aller PDF-Belege.
 */
const countPdfReceiptPages = (loadedReceipts: LoadedReceipt[]): number =>
  loadedReceipts.reduce(
    (pageCount, loadedReceipt) =>
      loadedReceipt.kind === "pdf"
        ? pageCount + loadedReceipt.pageCount
        : pageCount,
    0,
  );

/**
 * Zwischenschritt für `generateAndDownloadPdf`, der die PDF-Belege einsetzt
 * (Story 7.3b, C6). Ohne PDF-Beleg `undefined`: dann öffnet pdf-lib die
 * Abrechnung gar nicht erst.
 *
 * Die Slots entstehen hier mit derselben Funktion wie in `ExpenseReportPdf`,
 * darum passen sie zu den gezeichneten Seiten (C3).
 *
 * @param loadedReceipts - Geladene Belege.
 * @returns Der Zwischenschritt oder `undefined`.
 */
const createPdfTransform = (
  loadedReceipts: LoadedReceipt[],
): ((bytes: Uint8Array) => Promise<Uint8Array>) | undefined => {
  if (!loadedReceipts.some((loadedReceipt) => loadedReceipt.kind === "pdf")) {
    return undefined;
  }
  const slots = getReceiptPageSlots(loadedReceipts);
  return (reportBytes) => embedPdfReceipts(reportBytes, slots);
};

/**
 * `true` für Fehler, die nicht an Sentry gehen: Netzfehler (offline,
 * Abbruch) und passwortgeschützte PDFs (C5). Beides ist eine Eigenschaft
 * des Geräts bzw. der Datei, kein Programmfehler.
 *
 * @param error - Fehler eines Belegs.
 * @returns `true`, wenn der Fehler nicht gemeldet wird.
 */
const isExpectedReceiptError = (error: Error): boolean =>
  isTransientNetworkError(error) || error instanceof EncryptedReceiptError;

/**
 * Meldet nicht ladbare Belege gesammelt als ein Sentry-Ereignis: nur
 * Ausgaben-IDs, kein Inhalt. Erwartbare Fehler (Netz, Passwortschutz,
 * {@link isExpectedReceiptError}) werden nicht gemeldet.
 *
 * @param failedReceipts - Nicht geladene Belege.
 * @param eventUid - UID des Anlasses.
 */
const reportFailedReceipts = (
  failedReceipts: FailedReceipt[],
  eventUid: string,
): void => {
  const reportableReceipts = failedReceipts.filter(
    (failed) => !isExpectedReceiptError(failed.error),
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
