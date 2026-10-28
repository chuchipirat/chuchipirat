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
