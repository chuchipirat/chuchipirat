import fileSaver from "file-saver";
import {Event} from "../../Event/event.class";
import {BudgetDomain} from "../Budget/budget.types";
import {ExpenseDomain} from "../Expense/expense.types";
import {buildExpenseCsv} from "./expenseCsv";
import {ExpenseExport} from "./expenseExport.class";

/**
 * Erstellt die CSV mit allen Ausgaben des Anlasses und startet den Download.
 * Reihenfolge und Belegnummern sind dieselben wie in der PDF-Abrechnung.
 *
 * @param params.expenses - Alle Ausgaben des Anlasses.
 * @param params.budgets - Budgets des Anlasses, für den Budgetnamen pro Zeile.
 * @param params.event - Anlass, liefert Köche (Namen der zahlenden Personen)
 *   und Namen für den Dateinamen.
 * @throws Fehler beim Erstellen oder Speichern werden nicht abgefangen; die
 *   aufrufende Seite zeigt sie an und meldet sie an Sentry.
 * @example
 * downloadExpenseCsv({expenses, budgets, event});
 * // speichert «Ausgaben Sommerlager.csv»
 */
export const downloadExpenseCsv = ({
  expenses,
  budgets,
  event,
}: {
  expenses: ExpenseDomain[];
  budgets: BudgetDomain[];
  event: Event;
}): void => {
  const rows = ExpenseExport.buildRows({expenses, budgets, cooks: event.cooks});
  const csv = buildExpenseCsv(rows, ExpenseExport.getReceiptFileNames(rows));
  const blob = new Blob([csv], {type: "text/csv;charset=utf-8"});

  fileSaver.saveAs(blob, ExpenseExport.getExportFileName(event.name, "csv"));
};
