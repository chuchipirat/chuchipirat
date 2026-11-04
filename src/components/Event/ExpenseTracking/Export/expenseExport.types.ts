import {ReportRow} from "../Report/expenseReport.types";

/**
 * Eine Zeile des CSV-Exports, entspricht einer Ausgabe.
 *
 * Gleiche Felder wie eine Tabellenzeile der Abrechnung (`ReportRow`), dazu
 * der Name der zahlenden Person. In der Abrechnung steht dieser in der
 * Section, im CSV braucht ihn jede Zeile.
 *
 * @param payeeDisplayName - Anzeigename der zahlenden Person, «Ehemalige
 *   Person» oder «Ohne Rückerstattung».
 */
export type ExportRow = ReportRow & {payeeDisplayName: string};

/**
 * Fortschritt beim Laden der Belege für das ZIP.
 *
 * @param loaded - Bereits verarbeitete Belege (geladen oder fehlgeschlagen).
 * @param total - Anzahl Belege; `0`, solange der Export erst startet.
 */
export type ExportProgress = {loaded: number; total: number};

/**
 * Ergebnis von `downloadExpenseZip`.
 *
 * @param failedReceiptNumbers - Belegnummern, die nicht geladen werden
 *   konnten. Leer, wenn alles geklappt hat.
 */
export type ExpenseZipResult = {failedReceiptNumbers: number[]};
