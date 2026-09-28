import {FieldValidationError} from "../../Shared/fieldValidation.error.class";
import {
  ExpenseDomain,
  ExpenseGroup,
  ExpenseTotalsByBudget,
} from "./expense.types";

import {
  PLEASE_PROVIDE_LABEL as TEXT_PLEASE_PROVIDE_LABEL,
  PLEASE_PROVIDE_AMOUNT as TEXT_PLEASE_PROVIDE_AMOUNT,
  EXPENSE_AMOUNT_TOO_LARGE as TEXT_EXPENSE_AMOUNT_TOO_LARGE,
  PLEASE_PROVIDE_BUDGET as TEXT_PLEASE_PROVIDE_BUDGET,
  PLEASE_PROVIDE_DATE as TEXT_PLEASE_PROVIDE_DATE,
  PLEASE_PROVIDE_CURRENCY as TEXT_PLEASE_PROVIDE_CURRENCY,
} from "../../../constants/text/expenseTracking";
import {BudgetDomain} from "./budget.types";

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
}
