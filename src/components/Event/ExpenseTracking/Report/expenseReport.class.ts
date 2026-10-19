import {Cook} from "../../Event/event.class";
import {BudgetDomain} from "../Budget/budget.types";
import {
  ExpenseDomain,
  ExpensePayeeType,
  NO_REFUND_PAYEE_KEY,
} from "../Expense/expense.types";
import {
  CurrencyTotal,
  ExpenseReportData,
  ReportGroup,
  ReportMode,
  ReportOptions,
  ReportPayeeOption,
  ReportPayeeSection,
  ReportPayeeSelection,
  ReportReceipt,
  ReportRow,
} from "./expenseReport.types";

import {REPORT_UNKNOWN_BUDGET as TEXT_REPORT_UNKNOWN_BUDGET} from "../../../../constants/text";
import {Expense} from "../Expense/expense.class";

/**
 * Datenaufbereitung der PDF-Abrechnung.
 *
 * Reine Logik ohne UI und ohne Datenbank: Aus den Ausgaben des Anlasses
 * entsteht eine fertige Struktur (Personen → Tabellen → Zeilen, Summen,
 * Belegnummern), die das PDF nur noch zeichnet. Dazu Hilfsmethoden für den
 * Dialog (Personenauswahl, Vorauswahl, Anzahl fehlender Belege).
 *
 * Gruppiert wird gleich wie in der Übersicht «Ausgegebene Beträge pro
 * Person» (`Expense.getPayeeKey`), damit Dialog, PDF und Übersicht
 * dieselben Personen zeigen.
 */
export class ExpenseReport {
  /**
   * Baut die komplette Abrechnung für die gewählten Optionen.
   *
   * Ablauf: Ausgaben der Auswahl filtern → nach Person gruppieren → pro
   * Person eine Sektion (Modus A: eine Tabelle, Modus B: eine Tabelle pro
   * Budget) → Sektionen sortieren → Belegnummern vergeben. Bei «Alle
   * Personen» kommen Gesamttotal und «davon zurückzuerstatten» dazu.
   * Die übergebenen Arrays werden nicht verändert.
   *
   * @param params - Eingaben der Abrechnung.
   * @param params.expenses - Alle Ausgaben des Anlasses.
   * @param params.budgets - Alle Budgets des Anlasses, in Anzeigereihenfolge.
   * @param params.cooks - Köch:innen des Anlasses, für die Anzeigenamen.
   * @param params.options - Im Dialog gewählte Optionen.
   * @returns Die fertige Struktur für das PDF.
   * @example
   * const report = ExpenseReport.build({
   *   expenses,
   *   budgets,
   *   cooks: event.cooks,
   *   options: {
   *     mode: ReportMode.PER_PERSON,
   *     payeeSelection: {kind: "all"},
   *     includeComments: true,
   *     includeMissingReceiptPages: true,
   *   },
   * });
   */
  static build({
    expenses,
    budgets,
    cooks,
    options,
  }: {
    expenses: ExpenseDomain[];
    budgets: BudgetDomain[];
    cooks: Cook[];
    options: ReportOptions;
  }): ExpenseReportData {
    const selectedExpenses = ExpenseReport.filterBySelection(
      expenses,
      options.payeeSelection,
    );

    const unsortedSections = [
      ...ExpenseReport.groupByPayee(selectedExpenses),
    ].map(([payeeKey, expensesOfPayee]) =>
      ExpenseReport.buildSection(
        payeeKey,
        expensesOfPayee,
        budgets,
        cooks,
        options.mode,
      ),
    );

    const {sections, receipts} = ExpenseReport.numberReceipts(
      ExpenseReport.sortSections(unsortedSections),
      options.includeMissingReceiptPages,
    );
    // Gesamttotale nur bei «Alle Personen», bei einer Person sind sie
    // identisch mit dem Personentotal
    const isAllPayees = options.payeeSelection.kind === "all";

    return {
      mode: options.mode,
      includeComments: options.includeComments,
      sections,
      receipts,
      grandTotals: isAllPayees
        ? ExpenseReport.sumByCurrency(selectedExpenses)
        : null,
      refundTotals: isAllPayees
        ? ExpenseReport.sumByCurrency(
            selectedExpenses.filter(
              (expense) =>
                expense.payeeType !== ExpensePayeeType.NO_REFUND_NEEDED,
            ),
          )
        : null,
    };
  }
  /**
   * Liefert die Personen für die Auswahl im Dialog: eine Option pro Person
   * mit Ausgaben, alphabetisch nach Anzeigename. «Ohne Rückerstattung» ist
   * nicht dabei, diese Ausgaben erscheinen nur bei «Alle Personen».
   *
   * @param expenses - Alle Ausgaben des Anlasses.
   * @param cooks - Köch:innen des Anlasses, für die Anzeigenamen.
   * @returns Optionen mit Schlüssel, Anzeigename und Anzahl Ausgaben;
   *   leer, wenn niemand etwas bezahlt hat.
   * @example
   * ExpenseReport.getPayeeOptions(expenses, event.cooks)
   * // [{payeeKey: "user-1", displayName: "Felix", expenseCount: 7}]
   */
  static getPayeeOptions(
    expenses: ExpenseDomain[],
    cooks: Cook[],
  ): ReportPayeeOption[] {
    return (
      [...ExpenseReport.groupByPayee(expenses)]
        // «Ohne Rückerstattung» ist keine Person, die etwas zurückbekommt
        .filter(([payeeKey]) => payeeKey !== NO_REFUND_PAYEE_KEY)
        .map(([payeeKey, expensesOfPayee]) => ({
          payeeKey,
          displayName: Expense.getPayeeDisplayName(expensesOfPayee[0], cooks),
          expenseCount: expensesOfPayee.length,
        }))
        .sort((optionA, optionB) =>
          optionA.displayName.localeCompare(optionB.displayName, "de"),
        )
    );
  }
  /**
   * Bestimmt die vorausgewählte Person im Dialog: die angemeldete Person,
   * falls sie Ausgaben hat, sonst die erste Person der Liste.
   *
   * @param options - Optionen aus {@link ExpenseReport.getPayeeOptions}.
   * @param authUserId - UID der angemeldeten Person.
   * @returns Schlüssel der vorausgewählten Person, `null` ohne Optionen
   *   (dann bleibt nur «Alle Personen»).
   * @example
   * ExpenseReport.getDefaultPayeeKey(options, authUser.uid) // "user-1"
   */
  static getDefaultPayeeKey(
    options: ReportPayeeOption[],
    authUserId: string,
  ): string | null {
    // Köch:innen haben ihre UID als Schlüssel, darum direkt vergleichbar
    const hasOwnExpenses = options.some(
      (option) => option.payeeKey === authUserId,
    );
    return hasOwnExpenses ? authUserId : (options[0]?.payeeKey ?? null);
  }

  /**
   * Zählt die Ausgaben ohne Beleg in der aktuellen Auswahl. Der Dialog
   * blendet damit die Option «Leerseiten für fehlende Belege» ein
   * und zeigt die Anzahl an.
   *
   * @param expenses - Alle Ausgaben des Anlasses.
   * @param payeeSelection - Im Dialog gewählte Person oder «Alle Personen».
   * @returns Anzahl Ausgaben ohne Anhang; 0 blendet die Option aus.
   * @example
   * ExpenseReport.countMissingReceipts(expenses, {kind: "all"}) // 3
   */
  static countMissingReceipts(
    expenses: ExpenseDomain[],
    payeeSelection: ReportPayeeSelection,
  ): number {
    return ExpenseReport.filterBySelection(expenses, payeeSelection).filter(
      (expense) => expense.attachmentPath === null,
    ).length;
  }

  /**
   * Wandelt eine Ausgabe in eine Tabellenzeile um. Die Belegnummer bleibt
   * leer, sie kommt erst in {@link ExpenseReport.numberReceipts}.
   *
   * @param expense - Die Ausgabe.
   * @param budgets - Alle Budgets, für den Budgetnamen.
   * @returns Die Zeile; unbekanntes Budget als «Unbekanntes Budget».
   */
  private static toRow(
    expense: ExpenseDomain,
    budgets: BudgetDomain[],
  ): ReportRow {
    return {
      expenseId: expense.id,
      date: expense.date,
      label: expense.label,
      comment: expense.comment,
      budgetName:
        budgets.find((budget) => budget.id === expense.budgetId)?.name ??
        TEXT_REPORT_UNKNOWN_BUDGET,
      amountInCents: expense.amountInCents,
      currency: expense.currency,
      receiptNumber: null, // Wird später bestimmt
      attachmentPath: expense.attachmentPath,
    };
  }

  /**
   * Behält die Ausgaben der gewählten Person, bei «Alle Personen» alle
   * (inklusive «Ohne Rückerstattung»).
   *
   * @param expenses - Alle Ausgaben des Anlasses.
   * @param selection - Gewählte Person oder «Alle Personen».
   * @returns Die Ausgaben der Auswahl.
   */
  private static filterBySelection(
    expenses: ExpenseDomain[],
    selection: ReportPayeeSelection,
  ): ExpenseDomain[] {
    if (selection.kind === "all") {
      return expenses;
    } else {
      return expenses.filter(
        (expense) => Expense.getPayeeKey(expense) === selection.payeeKey,
      );
    }
  }

  /**
   * Baut den Block einer Person: Anzeigename, Tabellen und Personentotal.
   *
   * @param payeeKey - Schlüssel der Person aus der Gruppierung.
   * @param expenses - Ausgaben dieser Person, mindestens eine.
   * @param budgets - Alle Budgets des Anlasses.
   * @param cooks - Köch:innen des Anlasses, für den Anzeigenamen.
   * @param mode - Modus A (eine Tabelle) oder B (pro Budget).
   * @returns Die Sektion; `payeeUserId` ist für Story 7.4 (eigene
   *   Abrechnung mit Zahlungsangaben).
   */
  private static buildSection(
    payeeKey: string,
    expenses: ExpenseDomain[],
    budgets: BudgetDomain[],
    cooks: Cook[],
    mode: ReportMode,
  ): ReportPayeeSection {
    return {
      payeeKey,
      // alle Ausgaben der Gruppe haben dieselbe zahlende Person
      displayName: Expense.getPayeeDisplayName(expenses[0], cooks),
      isNoRefund: payeeKey === NO_REFUND_PAYEE_KEY,
      payeeUserId: expenses[0].payeeUserId,
      groups: ExpenseReport.buildGroups(expenses, budgets, mode),
      totals: ExpenseReport.sumByCurrency(expenses),
    };
  }
  /**
   * Teilt die Ausgaben einer Person in Tabellen auf. Modus A: eine Tabelle
   * ohne Titel. Modus B: eine Tabelle pro Budget in der Reihenfolge von
   * `budgets`, Ausgaben mit unbekanntem Budget zuletzt (R6). Budgets ohne
   * Ausgaben entfallen.
   *
   * @param expenses - Ausgaben einer Person.
   * @param budgets - Alle Budgets des Anlasses, in Anzeigereihenfolge.
   * @param mode - Modus der Abrechnung.
   * @returns Die Tabellen der Person.
   */
  private static buildGroups(
    expenses: ExpenseDomain[],
    budgets: BudgetDomain[],
    mode: ReportMode,
  ): ReportGroup[] {
    if (mode === ReportMode.PER_PERSON) {
      return [ExpenseReport.buildGroup(null, expenses, budgets)];
    }
    const knownBudgetIds = new Set(budgets.map((budget) => budget.id));
    const groups = budgets.map((budget) =>
      ExpenseReport.buildGroup(
        budget.name,
        expenses.filter((expense) => expense.budgetId === budget.id),
        budgets,
      ),
    );
    // Ausgaben ohne bekanntes Budget nicht weglassen, sondern zuletzt
    groups.push(
      ExpenseReport.buildGroup(
        TEXT_REPORT_UNKNOWN_BUDGET,
        expenses.filter((expense) => !knownBudgetIds.has(expense.budgetId)),
        budgets,
      ),
    );
    // nur Budgets mit Ausgaben bekommen eine Tabelle
    return groups.filter((group) => group.rows.length > 0);
  }

  /**
   * Baut eine Tabelle: sortierte Zeilen und Summen pro Währung.
   *
   * @param budgetName - Titel der Tabelle, `null` in Modus A.
   * @param expenses - Ausgaben dieser Tabelle.
   * @param budgets - Alle Budgets, für den Budgetnamen pro Zeile.
   * @returns Die Gruppe.
   */
  private static buildGroup(
    budgetName: string | null,
    expenses: ExpenseDomain[],
    budgets: BudgetDomain[],
  ): ReportGroup {
    return {
      budgetName,
      rows: ExpenseReport.sortRows(
        expenses.map((expense) => ExpenseReport.toRow(expense, budgets)),
      ),
      totals: ExpenseReport.sumByCurrency(expenses),
    };
  }

  /**
   * Sortiert Zeilen nach Datum aufsteigend, bei gleichem Datum nach
   * Bezeichnung, zuletzt nach ID. Die ID als fester Tie-Breaker hält die
   * Belegnummern stabil, wenn das PDF erneut erzeugt wird.
   *
   * @param rows - Zu sortierende Zeilen (werden nicht verändert).
   * @returns Sortierte Kopie.
   */
  private static sortRows(rows: ReportRow[]): ReportRow[] {
    return [...rows].sort((rowA, rowB) => {
      return (
        rowA.date.getTime() - rowB.date.getTime() ||
        rowA.label.localeCompare(rowB.label, "de") ||
        (rowA.expenseId < rowB.expenseId ? -1 : 1)
      );
    });
  }

  /**
   * Vergibt die Belegnummern in Lesereihenfolge (Person → Tabelle → Zeile),
   * fortlaufend ab 1 über das ganze Dokument. Zeilen mit Beleg bekommen
   * immer eine Nummer, Zeilen ohne Beleg nur mit Leerseiten. Jede
   * Nummer ergibt genau eine Anhang-Seite.
   *
   * Muss nach allen Sortierungen laufen, sonst stimmen Tabelle und Anhang
   * nicht überein. Setzt `receiptNumber` direkt in den Zeilen.
   *
   * @param sections - Fertig sortierte Sektionen.
   * @param includeMissingReceiptPages - Leerseiten für fehlende Belege.
   * @returns Dieselben Sektionen mit Nummern und die Anhang-Seiten;
   *   `attachmentPath: null` bedeutet Leerseite «Beleg hier aufkleben».
   */
  private static numberReceipts(
    sections: ReportPayeeSection[],
    includeMissingReceiptPages: boolean,
  ): {sections: ReportPayeeSection[]; receipts: ReportReceipt[]} {
    const receipts: ReportReceipt[] = [];

    sections.forEach((section) => {
      section.groups.forEach((group) => {
        group.rows.forEach((row) => {
          if (row.attachmentPath === null && !includeMissingReceiptPages) {
            return; // ohne Leerseiten: kein Beleg, keine Nummer («–»)
          }
          // Zeilen stammen frisch aus toRow, direktes Setzen ist hier sicher
          row.receiptNumber = receipts.length + 1;
          receipts.push({
            receiptNumber: row.receiptNumber,
            expenseId: row.expenseId,
            attachmentPath: row.attachmentPath,
            date: row.date,
            label: row.label,
            amountInCents: row.amountInCents,
            currency: row.currency,
          });
        });
      });
    });

    return {sections, receipts};
  }

  /**
   * Summiert Beträge pro Währung, ohne Umrechnung.
   *
   * @param items - Ausgaben oder Zeilen (nur Betrag und Währung zählen).
   * @returns Ein Total pro Währung, CHF zuerst, danach alphabetisch;
   *   leer ohne Einträge.
   * @example
   * ExpenseReport.sumByCurrency([
   *   {amountInCents: 500, currency: "EUR"},
   *   {amountInCents: 1000, currency: "CHF"},
   * ]) // [{currency: "CHF", amountInCents: 1000}, {currency: "EUR", amountInCents: 500}]
   */
  private static sumByCurrency(
    items: {amountInCents: number; currency: string}[],
  ): CurrencyTotal[] {
    const currencyTotal: CurrencyTotal[] = [];

    items.forEach((item) => {
      const entry = currencyTotal.find(
        (entry) => entry.currency === item.currency,
      );

      if (entry !== undefined) {
        entry.amountInCents += item.amountInCents;
      } else {
        currencyTotal.push({
          currency: item.currency,
          amountInCents: item.amountInCents,
        });
      }
    });

    return currencyTotal.sort(
      (totalA, totalB) =>
        // CHF zuerst, danach alphabetisch
        Number(totalB.currency === "CHF") - Number(totalA.currency === "CHF") ||
        totalA.currency.localeCompare(totalB.currency),
    );
  }
  /**
   * Gruppiert Ausgaben nach zahlender Person (Schlüssel aus
   * `Expense.getPayeeKey`). Die Map behält die Reihenfolge, in der die
   * Personen zuerst vorkommen.
   *
   * @param expenses - Zu gruppierende Ausgaben.
   * @returns Map Personen-Schlüssel → Ausgaben dieser Person.
   */
  private static groupByPayee(
    expenses: ExpenseDomain[],
  ): Map<string, ExpenseDomain[]> {
    const expensesByPayee = new Map<string, ExpenseDomain[]>();
    for (const expense of expenses) {
      const payeeKey = Expense.getPayeeKey(expense);
      const expensesOfPayee = expensesByPayee.get(payeeKey) ?? [];
      expensesOfPayee.push(expense);
      expensesByPayee.set(payeeKey, expensesOfPayee);
    }
    return expensesByPayee;
  }
  /**
   * Sortiert die Personen alphabetisch nach Anzeigename, «Ohne
   * Rückerstattung» immer zuletzt.
   *
   * @param sections - Zu sortierende Sektionen (werden nicht verändert).
   * @returns Sortierte Kopie.
   */
  private static sortSections(
    sections: ReportPayeeSection[],
  ): ReportPayeeSection[] {
    return [...sections].sort(
      (sectionA, sectionB) =>
        // false (0) vor true (1): «Ohne Rückerstattung» immer zuletzt
        Number(sectionA.isNoRefund) - Number(sectionB.isNoRefund) ||
        sectionA.displayName.localeCompare(sectionB.displayName, "de"),
    );
  }
}
