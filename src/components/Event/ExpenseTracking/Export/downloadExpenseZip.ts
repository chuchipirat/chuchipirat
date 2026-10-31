import * as Sentry from "@sentry/react";
import fileSaver from "file-saver";
import JSZip from "jszip";

import {Event} from "../../Event/event.class";
import {BudgetDomain} from "../Budget/budget.types";
import {ExpenseDomain} from "../Expense/expense.types";
import {ExpenseExport} from "./expenseExport.class";
import {
  ExpenseZipResult,
  ExportProgress,
  ExportRow,
} from "./expenseExport.types";
import {fetchReceiptBlob} from "../Report/receiptLoader";
import {isTransientNetworkError, toError} from "../../../../utils/errorUtils";
import {
  EXPORT_RECEIPT_FOLDER as TEXT_EXPORT_RECEIPT_FOLDER,
  EXPORT_RECEIPT_NOT_LOADED as TEXT_EXPORT_RECEIPT_NOT_LOADED,
} from "../../../../constants/text";
import {buildExpenseCsv} from "./expenseCsv";

/**
 * Ein Beleg, der nicht geladen werden konnte.
 *
 * @param row - Zeile der Ausgabe (Nummer und ID für Hinweis und Sentry).
 * @param error - Grund, z.B. HTTP 404, wenn der Beleg gelöscht wurde.
 */
type FailedReceipt = {row: ExportRow; error: Error};

/**
 * Erstellt ein ZIP mit der CSV aller Ausgaben und den Originalbelegen im
 * Ordner «Belege» und startet den Download. Reihenfolge, Belegnummern und
 * Dateinamen passen zur CSV und zur PDF-Abrechnung.
 *
 * Ein Beleg, der nicht lädt, blockiert nicht: Er fehlt im ZIP, seine
 * CSV-Zelle sagt es, und seine Nummer steht im Ergebnis.
 *
 * @param params.expenses - Alle Ausgaben des Anlasses.
 * @param params.budgets - Budgets des Anlasses, für den Budgetnamen pro Zeile.
 * @param params.event - Anlass: Köche, Name für die Dateinamen, UID für Sentry.
 * @param params.getAttachmentUrl - Liefert die URL eines Belegs (von der Seite,
 *   damit dieses Modul die Datenbank nicht kennt).
 * @param params.onProgress - Fortschritt für den Dialog, nur Belege zählen.
 * @param params.fetchBlob - Lädt eine Datei; Standard: `fetchReceiptBlob`.
 *   Für Tests ersetzbar.
 * @returns Nummern der Belege, die nicht geladen werden konnten.
 * @throws Fehler beim Erstellen oder Speichern des ZIP werden nicht
 *   abgefangen; der Aufrufer zeigt sie an.
 * @example
 * const {failedReceiptNumbers} = await downloadExpenseZip({
 *   expenses,
 *   budgets,
 *   event,
 *   getAttachmentUrl,
 *   onProgress: setZipProgress,
 * });
 * // speichert «Ausgaben Sommerlager.zip»
 */
export const downloadExpenseZip = async ({
  expenses,
  budgets,
  event,
  getAttachmentUrl,
  onProgress,
  fetchBlob = fetchReceiptBlob,
}: {
  expenses: ExpenseDomain[];
  budgets: BudgetDomain[];
  event: Event;
  getAttachmentUrl: (attachmentPath: string) => string;
  onProgress: (progress: ExportProgress) => void;
  fetchBlob?: (url: string) => Promise<Blob>;
}): Promise<ExpenseZipResult> => {
  const zip = new JSZip();

  const rows = ExpenseExport.buildRows({expenses, budgets, cooks: event.cooks});
  const receiptFileNames = ExpenseExport.getReceiptFileNames(rows);
  const receiptRows = rows.filter((row) => receiptFileNames.has(row.expenseId));

  const failedReceipts = await addReceiptsToZip({
    zip,
    receiptRows,
    receiptFileNames,
    getAttachmentUrl,
    onProgress,
    fetchBlob,
  });

  await saveZip({
    zip,
    eventName: event.name,
    rows,
    receiptFileNames,
    failedReceipts,
  });

  reportFailedReceipts(failedReceipts, event.uid);
  return {
    failedReceiptNumbers: failedReceipts
      .map(({row}) => row.receiptNumber)
      .filter((receiptNumber) => receiptNumber !== null),
  };
};

/**
 * Lädt die Belege nacheinander und legt sie unverändert in den Ordner
 * «Belege» des ZIP. Wirft nicht wegen eines einzelnen Belegs.
 *
 * @param params.zip - Das ZIP, wird ergänzt.
 * @param params.receiptRows - Zeilen mit Beleg, in Nummernreihenfolge.
 * @param params.receiptFileNames - Dateiname pro Ausgaben-ID.
 * @param params.getAttachmentUrl - Liefert die URL eines Belegs.
 * @param params.fetchBlob - Lädt eine Datei.
 * @param params.onProgress - Vor dem ersten und nach jedem Beleg.
 * @returns Die Belege, die nicht geladen werden konnten.
 */
const addReceiptsToZip = async ({
  zip,
  receiptRows,
  receiptFileNames,
  getAttachmentUrl,
  fetchBlob,
  onProgress,
}: {
  zip: JSZip;
  receiptRows: ExportRow[];
  receiptFileNames: Map<string, string>;
  getAttachmentUrl: (attachmentPath: string) => string;
  fetchBlob: (url: string) => Promise<Blob>;
  onProgress: (progress: ExportProgress) => void;
}): Promise<FailedReceipt[]> => {
  const failedReceipts: FailedReceipt[] = [];

  const total = receiptRows.length;
  let loaded = 0;
  if (total > 0) {
    onProgress({loaded, total});
  }

  // nacheinander statt Promise.all: viele Handyfotos gleichzeitig im
  // Speicher sprengen auf dem Handy den Browser
  for (const row of receiptRows) {
    if (row.attachmentPath === null) continue;

    try {
      const blob = await fetchBlob(getAttachmentUrl(row.attachmentPath));
      zip.file(
        `${TEXT_EXPORT_RECEIPT_FOLDER}/${receiptFileNames.get(row.expenseId)}`,
        blob,
      );
    } catch (error) {
      failedReceipts.push({row, error: toError(error)});
    }
    loaded += 1;
    onProgress({loaded, total});
  }
  return failedReceipts;
};

/**
 * Legt die CSV ins ZIP, packt es und startet den Download. Bei nicht
 * geladenen Belegen steht in der Spalte «Belegdatei» ein Hinweis statt des
 * Dateinamens, damit niemand im ZIP nach der Datei sucht.
 *
 * @param params.zip - Das ZIP mit den Belegen.
 * @param params.eventName - Name des Anlasses, für die Dateinamen.
 * @param params.rows - Alle Export-Zeilen.
 * @param params.receiptFileNames - Dateiname pro Ausgaben-ID.
 * @param params.failedReceipts - Belege, die nicht geladen werden konnten.
 * @throws Fehler von `generateAsync` oder `saveAs` werden weitergeworfen.
 */
const saveZip = async ({
  zip,
  eventName,
  rows,
  receiptFileNames,
  failedReceipts,
}: {
  zip: JSZip;
  eventName: string;
  rows: ExportRow[];
  receiptFileNames: Map<string, string>;
  failedReceipts: FailedReceipt[];
}): Promise<void> => {
  const receiptCells = new Map(receiptFileNames);
  failedReceipts.forEach(({row}) =>
    receiptCells.set(row.expenseId, TEXT_EXPORT_RECEIPT_NOT_LOADED),
  );
  zip.file(
    ExpenseExport.getExportFileName(eventName, "csv"),
    buildExpenseCsv(rows, receiptCells),
  );

  // ohne Kompression: JPEG, PNG und PDF sind schon komprimiert
  const zipBlob = await zip.generateAsync({type: "blob", compression: "STORE"});
  fileSaver.saveAs(zipBlob, ExpenseExport.getExportFileName(eventName, "zip"));
};

/**
 * Meldet nicht ladbare Belege gesammelt als ein Sentry-Ereignis, nur mit
 * Ausgaben-IDs, ohne Inhalt. Netzfehler (offline, Abbruch) werden nicht
 * gemeldet, sie sind kein Programmfehler.
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
      context: "Export: Belege laden",
      eventUid,
      expenseIds: reportableReceipts.map((failed) => failed.row.expenseId),
    },
  });
};
