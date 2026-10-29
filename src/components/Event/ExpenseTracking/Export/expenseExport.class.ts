import {Cook} from "../../Event/event.class";
import {BudgetDomain} from "../Budget/budget.types";
import {
  ATTACHMENT_MIME_TO_EXTENSION,
  ExpenseDomain,
} from "../Expense/expense.types";
import {ExportRow} from "./expenseExport.types";
import {ExpenseReport} from "../Report/expenseReport.class";
import {ReportMode, ReportOptions} from "../Report/expenseReport.types";

import {EXPORT_FILE_PREFIX as TEXT_EXPORT_FILE_PREFIX} from "../../../../constants/text";

/** Höchstlänge der Bezeichnung im Dateinamen eines Belegs. */
const MAX_LABEL_LENGTH = 60;
/**
 * Stellen der Belegnummer im Dateinamen. Mit führenden Nullen sortiert der
 * Datei-Explorer die Belege in der richtigen Reihenfolge.
 */
const RECEIPT_NUMBER_DIGITS = 3;

/**
 * Feste Optionen, mit denen der Export die Abrechnung aufbereitet: alle
 * Personen, Modus A, ohne Leerseiten. So tragen nur Ausgaben mit Beleg eine
 * Nummer, und die Nummern stimmen mit dem PDF in genau dieser Variante
 * überein.
 */
export const EXPORT_REPORT_OPTIONS: ReportOptions = {
  mode: ReportMode.PER_PERSON,
  payeeSelection: {kind: "all"},
  // ohne Wirkung auf die Zeilen: `comment` ist immer gefüllt, die Option
  // steuert nur, ob das PDF Kommentare zeichnet
  includeComments: true,
  includeMissingReceiptPages: false,
};

/**
 * Datenaufbereitung für den CSV- und ZIP-Export.
 *
 * Reine Logik ohne UI und ohne Datenbank. Reihenfolge und Belegnummern
 * stammen aus `ExpenseReport.build`, damit CSV, ZIP und PDF dieselben
 * Nummern zeigen. Hier wird nichts neu sortiert oder nummeriert.
 */
export class ExpenseExport {
  /**
   * Liefert eine flache Liste mit einer Zeile pro Ausgabe, in der
   * Reihenfolge der Abrechnung (Person → Datum → Bezeichnung).
   * Die übergebenen Arrays werden nicht verändert.
   *
   * @param params - Eingaben des Exports.
   * @param params.expenses - Alle Ausgaben des Anlasses.
   * @param params.budgets - Alle Budgets des Anlasses.
   * @param params.cooks - Köch:innen des Anlasses, für die Anzeigenamen.
   * @returns Zeilen für den Export; leer ohne Ausgaben.
   * @example
   * const rows = ExpenseExport.buildRows({
   *   expenses,
   *   budgets,
   *   cooks: event.cooks,
   * });
   */
  static buildRows({
    expenses,
    budgets,
    cooks,
  }: {
    expenses: ExpenseDomain[];
    budgets: BudgetDomain[];
    cooks: Cook[];
  }): ExportRow[] {
    const report = ExpenseReport.build({
      expenses,
      budgets,
      cooks,
      options: EXPORT_REPORT_OPTIONS,
    });

    return report.sections.flatMap((section) =>
      section.groups.flatMap((group) =>
        group.rows.map((row) => ({
          ...row,
          payeeDisplayName: section.displayName,
        })),
      ),
    );
  }

  /**
   * Dateiname eines Belegs im ZIP: Nummer, Bezeichnung und Endung. Die
   * Bezeichnung wird bereinigt und gekürzt, unbekannte Endungen entfallen.
   *
   * @param row - Zeile des Exports.
   * @returns Dateiname, `null` ohne Beleg.
   * @example
   * ExpenseExport.getReceiptFileName(row) // "003 Grosseinkauf Migros.pdf"
   */
  static getReceiptFileName(row: ExportRow): string | null {
    if (!row.attachmentPath || row.receiptNumber === null) return null;

    const extension = ExpenseExport.getFileExtension(row.attachmentPath);

    // erneut trimmen: der Schnitt kann direkt hinter einem Leerzeichen liegen
    const fileName = ExpenseExport.sanitizeFileNamePart(row.label)
      .substring(0, MAX_LABEL_LENGTH)
      .trim();

    return `${row.receiptNumber.toString().padStart(RECEIPT_NUMBER_DIGITS, "0")}${fileName ? " " : ""}${fileName}${extension}`;
  }

  /**
   * Dateiname der CSV- bzw. ZIP-Datei. Der Anlassname wird bereinigt, weil
   * die CSV auch als Eintrag im ZIP liegt.
   *
   * @param eventName - Name des Anlasses.
   * @param extension - Endung ohne Punkt.
   * @returns Dateiname, z.B. «Ausgaben Sommerlager 2026.csv».
   * @example
   * ExpenseExport.getExportFileName("Sommerlager 2026", "zip")
   * // "Ausgaben Sommerlager 2026.zip"
   */
  static getExportFileName(
    eventName: string,
    extension: "csv" | "zip",
  ): string {
    return `${TEXT_EXPORT_FILE_PREFIX} ${ExpenseExport.sanitizeFileNamePart(eventName)}.${extension}`;
  }

  /**
   * Dateinamen der Belege im ZIP, je Ausgabe. Die CSV nennt in der Spalte
   * «Belegdatei» denselben Namen, damit Zeile und Datei zusammenpassen.
   * Ausgaben ohne Beleg fehlen in der Map.
   *
   * @param rows - Export-Zeilen in der Reihenfolge der Abrechnung.
   * @returns Map von Ausgaben-ID auf Dateiname, z.B. «001 Grosseinkauf Migros.pdf».
   * @example
   * ExpenseExport.getReceiptFileNames(rows).get("expense-1")
   * // "001 Grosseinkauf Migros.pdf"
   */
  static getReceiptFileNames(rows: ExportRow[]): Map<string, string> {
    const receiptFileNames = new Map<string, string>();

    rows.forEach((row) => {
      const fileName = ExpenseExport.getReceiptFileName(row);
      if (fileName) {
        receiptFileNames.set(row.expenseId, fileName);
      }
    });

    return receiptFileNames;
  }

  /**
   * Bereinigt einen Teil eines Dateinamens. Zeichen, die Windows in
   * Dateinamen verbietet, und Steuerzeichen werden zu Leerzeichen; ohne
   * `/` und `\` entstehen im ZIP keine Ordner.
   *
   * @param text - Freier Text, z.B. Bezeichnung oder Anlassname.
   * @returns Bereinigter Text ohne doppelte Leerzeichen, evtl. leer.
   * @example
   * ExpenseExport.sanitizeFileNamePart("Migros: Brot/Milch") // "Migros Brot Milch"
   */
  private static sanitizeFileNamePart(text: string): string {
    return text
      .replace(/[/\\:*?"<>|\p{Cc}]/gu, " ")
      .trim()
      .replace(/\s+/g, " ");
  }

  /**
   * Endung eines Belegs aus seinem Pfad. Die App vergibt sie beim Upload
   * selbst; geprüft wird trotzdem gegen die erlaubten Endungen, weil ein
   * Pfad ohne Punkt sonst als Ganzes zur Endung würde.
   *
   * @param attachmentPath - Pfad des Belegs im Storage.
   * @returns Endung mit Punkt in Kleinbuchstaben, leer wenn unbekannt.
   * @example
   * ExpenseExport.getFileExtension("events/e1/expenses/x.PDF") // ".pdf"
   */
  private static getFileExtension(attachmentPath: string): string {
    const extension = attachmentPath.split(".").pop()?.toLowerCase() ?? "";
    const isKnownExtension = Object.values(
      ATTACHMENT_MIME_TO_EXTENSION,
    ).includes(extension);
    return isKnownExtension ? `.${extension}` : "";
  }
}
