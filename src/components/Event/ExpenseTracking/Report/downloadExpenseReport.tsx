import React from "react";
import {pdf} from "@react-pdf/renderer";
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
  ReceiptPageSlot,
} from "./expenseReport.types";
import {embedPdfReceipts} from "./embedPdfReceipts";
import {ExpenseReportPdf} from "./expenseReportPdf";
import {getReportFileName} from "./expenseReportLabels";
import {getReceiptStartPages} from "./expenseReportPdfHelpers";
import {EncryptedReceiptError, loadReceipts} from "./receiptLoader";
import {getReceiptPageSlots} from "./receiptPageSlots";
import {checkPageCount, countPdfPages} from "./reportPageCount";

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
  getAttachmentUrl: (attachmentPath: string) => Promise<string>;
  onProgress: (progress: ReportProgress) => void;
  onError: (error: Error) => void;
};

/**
 * Erstellt die Abrechnung als PDF mit Belegen und startet den Download.
 * Gezeichnet wird zweimal: zuerst ohne Belege, um die Seitenzahl für die
 * Spalte «Beleg» zu kennen, dann alles. PDF-Belege setzt pdf-lib danach
 * Seite für Seite ein.
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
  const slots = getReceiptPageSlots(loadedReceipts);
  const documentProps: ReportDocumentProps = {
    report,
    eventName: event.name,
    authUser,
    generatedAt: new Date(),
    refundDetailsByPayeeKey: getRefundDetailsByPayeeKey(
      options.payeeSelection,
      refundDetails,
      authUser.uid,
    ),
  };
  // Zweidurchlauf (Story 7.5, Spez. 8): Durchlauf 1 bestimmt die Anzahl
  // Abrechnungsseiten, Durchlauf 2 setzt damit die Seitenverweise; der
  // Zwischenschritt danach prüft, dass sich nichts verschoben hat.
  const pageCounts = {reportPageCount: 0};
  const isDownloaded = await generateAndDownloadPdf(
    async () => {
      pageCounts.reportPageCount = await countReportPages(documentProps, slots);
      return (
        <ExpenseReportPdf
          {...documentProps}
          loadedReceipts={loadedReceipts}
          receiptStartPages={getReceiptStartPages(
            slots,
            pageCounts.reportPageCount,
          )}
        />
      );
    },
    getReportFileName(event.name, report.payeeDisplayName),
    onError,
    {
      eventUid: event.uid,
      mode: options.mode,
      receiptCount: loadedReceipts.length,
      pdfReceiptPageCount: countPdfReceiptPages(loadedReceipts),
    },
    (reportBytes) =>
      finishReportPdf(
        reportBytes,
        slots,
        pageCounts.reportPageCount + slots.length,
      ),
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
 * Props des Dokuments, die in beiden Durchläufen gleich sind.
 */
type ReportDocumentProps = Omit<
  React.ComponentProps<typeof ExpenseReportPdf>,
  "loadedReceipts" | "receiptStartPages"
>;

/**
 * Durchlauf 1: zeichnet nur die Abrechnung, ohne Belegseiten (schnell,
 * keine Bilder), und zählt ihre Seiten. Die Spalte «Beleg» bekommt
 * Platzhalter-Verweise; sie hat eine feste Breite, darum ändern die echten
 * Zahlen in Durchlauf 2 den Umbruch nicht.
 *
 * @param documentProps - Props beider Durchläufe.
 * @param slots - Belegseiten.
 * @returns Anzahl Abrechnungsseiten.
 */
const countReportPages = async (
  documentProps: ReportDocumentProps,
  slots: ReceiptPageSlot[],
): Promise<number> => {
  const blob = await pdf(
    <ExpenseReportPdf
      {...documentProps}
      loadedReceipts={[]}
      receiptStartPages={getReceiptStartPages(slots, 0)}
    />,
  ).toBlob();
  return countPdfPages(new Uint8Array(await blob.arrayBuffer()));
};

/**
 * Zwischenschritt nach Durchlauf 2 (Story 7.3b, C6; Story 7.5): prüft die
 * Seitenzahl und setzt PDF-Belege ein. Ohne PDF-Beleg wird nur gezählt,
 * das PDF bleibt unverändert. Die Slots sind dieselben wie in
 * `ExpenseReportPdf`, darum passen sie zu den gezeichneten Seiten (C3).
 *
 * @param reportBytes - Das PDF aus Durchlauf 2.
 * @param slots - Belegseiten.
 * @param expectedPageCount - Abrechnungsseiten plus Belegseiten.
 * @returns Das fertige PDF.
 * @throws {Error} Wenn die Seitenzahl abweicht.
 */
const finishReportPdf = (
  reportBytes: Uint8Array,
  slots: ReceiptPageSlot[],
  expectedPageCount: number,
): Promise<Uint8Array> =>
  slots.some((slot) => slot.loadedReceipt.kind === "pdf")
    ? embedPdfReceipts(reportBytes, slots, expectedPageCount)
    : checkPageCount(reportBytes, expectedPageCount);

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
