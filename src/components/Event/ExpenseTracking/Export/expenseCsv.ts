import {ExportRow} from "./expenseExport.types";
import {formatReportDate} from "../Report/expenseReportLabels";

import {
  BUDGET as TEXT_BUDGET,
  CURRENCY as TEXT_CURRENCY,
  DATE as TEXT_DATE,
  EXPORT_COLUMN_AMOUNT as TEXT_EXPORT_COLUMN_AMOUNT,
  EXPORT_COLUMN_COMMENT as TEXT_EXPORT_COLUMN_COMMENT,
  EXPORT_COLUMN_PAYEE as TEXT_EXPORT_COLUMN_PAYEE,
  EXPORT_COLUMN_RECEIPT_FILE as TEXT_EXPORT_COLUMN_RECEIPT_FILE,
  EXPORT_COLUMN_RECEIPT_NUMBER as TEXT_EXPORT_COLUMN_RECEIPT_NUMBER,
  LABEL as TEXT_LABEL,
} from "../../../../constants/text";

/**
 * Byte Order Mark am Anfang der Datei. Ohne sie liest Excel unter Windows
 * die Datei nicht als UTF-8 und zeigt Umlaute falsch an («KÃ¼che»).
 */
const BOM = "\uFEFF";
/**
 * Spaltentitel der Kopfzeile. Reihenfolge wie die Werte in
 * {@link buildExpenseCsv}: Wer hier eine Spalte verschiebt, muss sie dort
 * genauso verschieben.
 */
const CSV_HEADER = [
  TEXT_EXPORT_COLUMN_RECEIPT_NUMBER,
  TEXT_DATE,
  TEXT_EXPORT_COLUMN_AMOUNT,
  TEXT_CURRENCY,
  TEXT_BUDGET,
  TEXT_EXPORT_COLUMN_PAYEE,
  TEXT_LABEL,
  TEXT_EXPORT_COLUMN_COMMENT,
  TEXT_EXPORT_COLUMN_RECEIPT_FILE,
];
/**
 * Trennzeichen zwischen den Spalten. Excel mit deutschsprachigen
 * Einstellungen (CH und DE) erwartet `;`, mit `,` landet alles in einer
 * Spalte.
 */
const CSV_DELIMITER = ";";
/** Zeilenende nach Windows-Konvention, wie es Excel selbst schreibt. */
const LINE_BREAK = "\r\n";
/**
 * Zeichen, mit denen Excel einen Zellinhalt als Formel ausführt. Tab und CR
 * zählen dazu, weil Excel sie am Anfang überspringt.
 */
const FORMULA_START = /^[=+\-@\t\r]/;

/**
 * Erzeugt den Inhalt der CSV-Datei: BOM, Kopfzeile und eine Zeile pro
 * Ausgabe, in der übergebenen Reihenfolge. Freie Texte laufen durch
 * {@link toCsvField}; Belegnummer, Datum, Betrag und Währung erzeugt die App
 * selbst, sie stehen ohne Anführungszeichen.
 *
 * @param rows - Zeilen aus `ExpenseExport.buildRows`.
 * @param receiptCells - Inhalt der Spalte «Belegdatei» pro Ausgabe
 *   (expenseId → Dateiname im ZIP oder Hinweistext). Fehlt eine Ausgabe,
 *   bleibt die Zelle leer.
 * @returns CSV-Inhalt mit CRLF zwischen den Zeilen, ohne Zeilenende am
 *   Schluss.
 * @example
 * const csv = buildExpenseCsv(rows, new Map([["expense-1", "001 Migros.pdf"]]));
 */
export const buildExpenseCsv = (
  rows: ExportRow[],
  receiptCells: Map<string, string>,
): string => {
  const encodedLines = rows.map((row) => {
    return [
      row.receiptNumber?.toString() ?? "",
      formatReportDate(row.date),
      formatCsvAmount(row.amountInCents),
      row.currency,
      toCsvField(row.budgetName),
      toCsvField(row.payeeDisplayName),
      toCsvField(row.label),
      toCsvField(row.comment ?? ""),
      toCsvField(receiptCells.get(row.expenseId) ?? ""),
    ].join(CSV_DELIMITER);
  });

  const headerLine = CSV_HEADER.join(CSV_DELIMITER);

  return BOM + [headerLine, ...encodedLines].join(LINE_BREAK);
};

/**
 * Macht aus einem freien Text ein CSV-Feld: in Anführungszeichen, inneres
 * `"` verdoppelt. Beginnt der Text mit `=`, `+`, `-`, `@`, Tab oder CR,
 * kommt ein `'` davor. Sonst führt Excel ihn als Formel aus, und die Texte
 * stammen von anderen Köch:innen.
 *
 * @param value - Freier Text, darf `;`, `"` und Zeilenumbrüche enthalten.
 * @returns Das fertige Feld.
 * @example
 * toCsvField('Brot "Bio"') // '"Brot ""Bio"""'
 * toCsvField("=1+1")       // "\"'=1+1\""
 */
export const toCsvField = (value: string): string => {
  const neutralizedText = FORMULA_START.test(value) ? `'${value}` : value;

  return `"${neutralizedText.replaceAll(`"`, `""`)}"`;
};

/**
 * Schreibt einen Betrag in Rappen bzw. Cent mit Punkt und zwei
 * Nachkommastellen. Rechnet nur mit ganzen Zahlen, damit kein
 * Rundungsfehler einer Kommazahl entstehen kann.
 *
 * @param amountInCents - Betrag in Rappen bzw. Cent (immer > 0, siehe
 *   CHECK-Constraint auf `event_expenses`).
 * @returns Betrag ohne Währung, z.B. «182.40».
 * @example
 * formatCsvAmount(18240) // "182.40"
 * formatCsvAmount(5)     // "0.05"
 */
export const formatCsvAmount = (amountInCents: number): string => {
  const major = Math.trunc(amountInCents / 100);
  const minor = amountInCents % 100;

  return `${major}.${minor.toString().padStart(2, "0")}`;
};
