import {FieldValidationError} from "../../../Shared/fieldValidation.error.class";
import {
  ExpenseDomain,
  ExpenseGroup,
  ExpensePayee,
  ExpensePayeeType,
  ExpenseTotalsByBudget,
  NO_REFUND_PAYEE_KEY,
  PayeeBalance,
} from "./expense.types";

import {
  PLEASE_PROVIDE_LABEL as TEXT_PLEASE_PROVIDE_LABEL,
  PLEASE_PROVIDE_AMOUNT as TEXT_PLEASE_PROVIDE_AMOUNT,
  EXPENSE_AMOUNT_TOO_LARGE as TEXT_EXPENSE_AMOUNT_TOO_LARGE,
  PLEASE_PROVIDE_BUDGET as TEXT_PLEASE_PROVIDE_BUDGET,
  PLEASE_PROVIDE_DATE as TEXT_PLEASE_PROVIDE_DATE,
  PLEASE_PROVIDE_CURRENCY as TEXT_PLEASE_PROVIDE_CURRENCY,
  PLEASE_PROVIDE_PAYEE as TEXT_PLEASE_PROVIDE_PAYEE,
  PLEASE_PROVIDE_PAYEE_NAME as TEXT_PLEASE_PROVIDE_PAYEE_NAME,
  REPORT_NO_REFUND_GROUP as TEXT_REPORT_NO_REFUND_GROUP,
  FORMER_EVENT_COOK as TEXT_FORMER_EVENT_COOK,
} from "../../../../constants/text/expenseTracking";
import {BudgetDomain} from "../Budget/budget.types";
import {Cook} from "../../Event/event.class";

/**
 * Erlaubtes Format eines Währungscodes: genau drei Grossbuchstaben (ISO 4217,
 * z.B. «CHF», «EUR»). Nötig, weil `Intl.NumberFormat` bei einem ungültigen
 * Code eine `RangeError` wirft und damit die ganze Ausgabenliste abstürzt.
 */
const CURRENCY_CODE_PATTERN = /^[A-Z]{3}$/;

/**
 * Domain-Klasse für die Ausgaben eines Events.
 *
 * Enthält reine Business-Logik (kein Supabase). Persistenz
 * erfolgt über ExpenseRepository.
 */
export class Expense {
  /**
   * Validiert die Felder einer Ausgabe
   *
   * @param expense - Die zu prüfende Ausgabe.
   * @throws {FieldValidationError} Wenn Pflichtfelder fehlen oder ungültige
   *   Werte enthalten. Der Fehler ist eine Nutzer-Hinweismeldung und wird
   *   bewusst nicht an Sentry gemeldet.
   */
  static checkExpenseData(expense: ExpenseDomain): void {
    if (!expense.label.trim()) {
      throw new FieldValidationError(TEXT_PLEASE_PROVIDE_LABEL);
    }
    if (
      !expense.amountInCents ||
      !Number.isInteger(expense.amountInCents) ||
      expense.amountInCents < 0
    ) {
      throw new FieldValidationError(TEXT_PLEASE_PROVIDE_AMOUNT);
    }

    if (expense.amountInCents > 2147483647) {
      throw new FieldValidationError(TEXT_EXPENSE_AMOUNT_TOO_LARGE);
    }

    if (!expense.budgetId) {
      throw new FieldValidationError(TEXT_PLEASE_PROVIDE_BUDGET);
    }

    if (!(expense.date instanceof Date) || isNaN(expense.date.getTime())) {
      throw new FieldValidationError(TEXT_PLEASE_PROVIDE_DATE);
    }

    if (!expense.currency || !CURRENCY_CODE_PATTERN.test(expense.currency)) {
      throw new FieldValidationError(TEXT_PLEASE_PROVIDE_CURRENCY);
    }
    if (
      expense.payeeType === ExpensePayeeType.EXISTING_USER &&
      !expense.payeeUserId
    ) {
      throw new FieldValidationError(TEXT_PLEASE_PROVIDE_PAYEE);
    }
    if (
      expense.payeeType === ExpensePayeeType.NEW_PERSON &&
      !expense.payeeName?.trim()
    ) {
      throw new FieldValidationError(TEXT_PLEASE_PROVIDE_PAYEE_NAME);
    }
  }
  /**
   * Summiert alle Ausgaben pro Budget und Währung.
   *
   * @param expenses - Alle Ausgaben des Anlasses
   * @returns Summen pro Budget und Währung
   */
  static sumByBudgetAndCurrency(
    expenses: ExpenseDomain[],
  ): ExpenseTotalsByBudget {
    return expenses.reduce<ExpenseTotalsByBudget>((totals, expense) => {
      totals[expense.budgetId] ??= {};
      totals[expense.budgetId][expense.currency] =
        (totals[expense.budgetId][expense.currency] ?? 0) +
        expense.amountInCents;
      return totals;
    }, {});
  }
  /**
   * Sortieren der Ausgaben nach Datum absteigend. Bei zwei gleichen Daten
   * wird nach Label sortiert
   * @param expenses - Alle Ausgaben des Anlasses
   * @returns Neue, nach Datum absteigend sortierte Liste (die Eingabe bleibt unverändert)
   */
  static sortByDateDescending(expenses: ExpenseDomain[]): ExpenseDomain[] {
    return [...expenses].sort((a, b) => {
      if (b.date.getTime() > a.date.getTime()) {
        return 1;
      } else if (a.date.getTime() > b.date.getTime()) {
        return -1;
      } else {
        // Gleiches Datum
        return a.label.localeCompare(b.label, "de");
      }
    });
  }
  /**
   * Ausgaben nach Budget gruppieren
   *
   * @param expenses - Alle Ausgaben des Anlasses
   * @param budgets - Alle Budgets des Anlasses
   * @returns Ausgaben gruppiert nach Budget, Budget ohne Ausgaben werden mit leeren Expenses zurückgegeben
   */
  static groupByBudget(
    expenses: ExpenseDomain[],
    budgets: BudgetDomain[],
  ): ExpenseGroup[] {
    return budgets.map((budget) => {
      const expensesOfBudget = expenses.filter(
        (expense) => expense.budgetId === budget.id,
      );

      return {
        budget,
        expenses: Expense.sortByDateDescending(expensesOfBudget),
        totalsByCurrency:
          Expense.sumByBudgetAndCurrency(expensesOfBudget)[budget.id] ?? {},
      };
    });
  }
  /**
   * Vergleicht zwei Listen (nach `id`) und liefert die IDs, die im
   * aktuellen Stand neu sind oder sich inhaltlich gegenüber dem vorherigen
   * Stand geändert haben. Für die Hervorhebung von Fremdänderungen (Paket
   * 2.8): eine ID in der Rückgabe bedeutet "Karte/Zeile soll aufleuchten".
   *
   * @param previous - Vorheriger Stand.
   * @param current - Aktueller Stand nach einem Reload.
   * @returns IDs aus `current`, die neu sind oder sich geändert haben.
   *   Gelöschte IDs (nur in `previous` vorhanden) sind nicht enthalten.
   * @example
   * Expense.diffIds([{id: "a", value: 1}], [{id: "a", value: 2}]) // Set(["a"])
   */
  static diffIds<T extends {id: string}>(
    previous: T[],
    current: T[],
  ): Set<string> {
    const previousById = new Map(previous.map((item) => [item.id, item]));
    const changed = new Set<string>();
    for (const item of current) {
      const before = previousById.get(item.id);
      if (!before || JSON.stringify(before) !== JSON.stringify(item)) {
        changed.add(item.id);
      }
    }
    return changed;
  }
  /**
   * Summiert alle Ausgaben mit zahlender Instanz (ohne `no_refund_needed`) pro
   * Person und Währung. Fasst `new_person`-Einträge mit exakt gleichem Namen
   * zusammen (kein Fuzzy-Matching).
   *
   * @param expenses - Alle Ausgaben des Anlasses.
   * @returns Eine Zeile je Person, unsortiert (Sortierung nach Anzeigename
   *   obliegt der UI-Schicht, die `event.cooks` zur Auflösung braucht).
   */
  static sumByPayee(expenses: ExpenseDomain[]): PayeeBalance[] {
    const balancesByKey = new Map<string, PayeeBalance>();

    for (const expense of expenses) {
      if (expense.payeeType === ExpensePayeeType.NO_REFUND_NEEDED) continue;

      const key = expense.payeeUserId ?? expense.payeeName ?? "";

      const balance = balancesByKey.get(key) ?? {
        payeeType: expense.payeeType,
        payeeUserId: expense.payeeUserId,
        payeeName: expense.payeeName,
        expenses: [],
        totalsByCurrency: {},
      };
      balance.expenses.push(expense);
      balance.totalsByCurrency[expense.currency] =
        (balance.totalsByCurrency[expense.currency] ?? 0) +
        expense.amountInCents;
      balancesByKey.set(key, balance);
    }

    return [...balancesByKey.values()].map((balance) => ({
      ...balance,
      expenses: Expense.sortByDateDescending(balance.expenses),
    }));
  }
  /**
   * Liefert den Schlüssel, unter dem eine Ausgabe einer Person zugeordnet
   * wird. Gleiche Regel wie `sumByPayee`: bestehende Köch:innen über ihre
   * User-ID, neue Personen über den exakten Namen (kein Fuzzy-Matching).
   * Alle Ausgaben ohne Rückerstattung teilen sich einen festen Schlüssel.
   *
   * @param payee - Ausgabe oder Personen-Saldo (nur die Payee-Felder zählen).
   * @returns Schlüssel der zahlenden Person bzw. `NO_REFUND_PAYEE_KEY`.
   * @example
   * Expense.getPayeeKey({
   *   payeeType: ExpensePayeeType.NEW_PERSON,
   *   payeeUserId: null,
   *   payeeName: "Felix",
   * }) // "Felix"
   */
  static getPayeeKey(payee: ExpensePayee): string {
    if (payee.payeeType === ExpensePayeeType.NO_REFUND_NEEDED) {
      return NO_REFUND_PAYEE_KEY;
    }
    return payee.payeeUserId ?? payee.payeeName ?? "";
  }
  /**
   * Liefert den Anzeigenamen der zahlenden Person für Übersicht und
   * Abrechnung.
   *
   * @param payee - Ausgabe oder Personen-Saldo (nur die Payee-Felderzählen).
   * @param cooks - Köch:innen des Anlasses (`event.cooks`).
   * @returns Name der Köch:in, «Ehemalige Person» wenn sie nicht mehr im
   *   Team ist, den erfassten Namen einer neuen Person oder «Ohne
   *   Rückerstattung».
   * @example
   * Expense.getPayeeDisplayName(expense, event.cooks) // "Felix"
   */
  static getPayeeDisplayName(payee: ExpensePayee, cooks: Cook[]): string {
    switch (payee.payeeType) {
      case ExpensePayeeType.NO_REFUND_NEEDED:
        return TEXT_REPORT_NO_REFUND_GROUP;
      case ExpensePayeeType.EXISTING_USER:
        // aus dem Team entfernt: der Name lässt sich nicht mehr auflösen
        return (
          cooks.find((cook) => cook.uid === payee.payeeUserId)?.displayName ??
          TEXT_FORMER_EVENT_COOK
        );
      case ExpensePayeeType.NEW_PERSON:
        return payee.payeeName ?? "";
    }
  }
}
