import {DEFAULT_CURRENCY} from "../../Shared/utils/currencyUtils";
import {CurrenciesInUse, ExpenseDomain} from "./expense.types";

/**
 * Kennzahlen über die Ausgaben eines Anlasses (Ansicht «Auswertung», Epic 6).
 *
 * Reine Funktionen: kein React, kein Supabase, «heute» oder andere
 * Laufzeitwerte kommen immer als Parameter. Summiert nie über Währungen
 * hinweg — wer eine Summe will, filtert zuerst mit `filterByCurrency`.
 */
export class ExpenseStatistics {
  /**
   * Ermittelt die Währungen, in denen es Ausgaben gibt, und die vorausgewählte
   * Währung. Sortiert nach Anzahl Ausgaben (nicht Betrag), bei Gleichstand CHF
   * zuerst, sonst alphabetisch (siehe `compareCurrencyUsage`).
   *
   * @param expenses - Ausgaben, deren Währungen ermittelt werden.
   * @returns Liste der Währungscodes (häufigste zuerst) und die Vorauswahl
   *   (erstes Element, «CHF», wenn es keine Ausgaben gibt).
   * @example
   * // 2 × EUR, 1 × CHF
   * ExpenseStatistics.getCurrenciesInUse(expenses)
   * // {currencies: ["EUR", "CHF"], defaultCurrency: "EUR"}
   */
  static getCurrenciesInUse(expenses: ExpenseDomain[]): CurrenciesInUse {
    const countByCurrency = new Map<string, number>();

    expenses.forEach((expense) => {
      countByCurrency.set(
        expense.currency,
        (countByCurrency.get(expense.currency) ?? 0) + 1,
      );
    });

    const currencies = [...countByCurrency.keys()].sort(
      (currencyA, currencyB) =>
        ExpenseStatistics.compareCurrencyUsage(
          currencyA,
          currencyB,
          countByCurrency,
        ),
    );

    return {currencies, defaultCurrency: currencies[0] ?? DEFAULT_CURRENCY};
  }

  /**
   * Filtert die Ausgaben auf eine Währung. Basis für alle Summen und
   * Durchschnitte, damit nie über Währungen hinweg gerechnet wird.
   *
   * @param expenses - Zu filternde Ausgaben.
   * @param currency - ISO-4217-Währungscode, z.B. «CHF».
   * @returns Neue Liste mit den Ausgaben dieser Währung.
   * @example
   * ExpenseStatistics.filterByCurrency(expenses, "CHF")
   */
  static filterByCurrency(
    expenses: ExpenseDomain[],
    currency: string,
  ): ExpenseDomain[] {
    return expenses.filter((expense) => expense.currency === currency);
  }

  /**
   * Summiert die Beträge der übergebenen Ausgaben. Erwartet Ausgaben einer
   * einzigen Währung (vorher `filterByCurrency`).
   *
   * @param expenses - Ausgaben einer Währung.
   * @returns Summe in Rappen, 0 bei leerer Liste.
   * @example
   * ExpenseStatistics.sumAmountInCents(expensesInChf) // 234050
   */
  static sumAmountInCents(expenses: ExpenseDomain[]): number {
    return expenses.reduce<number>((total, expense) => {
      return total + expense.amountInCents;
    }, 0);
  }

  /**
   * Berechnet den Durchschnitt pro Person, gerundet auf ganze Rappen.
   *
   * @param totalAmountInCents - Summe der Ausgaben in Rappen (eine Währung).
   * @param participantCount - Anzahl Teilnehmende aus der Gruppenkonfiguration.
   * @returns Ø pro Person in Rappen, `null` bei 0 Teilnehmenden (statt
   *   `Infinity`/`NaN`).
   * @example
   * ExpenseStatistics.averagePerParticipant(240000, 24) // 10000
   * ExpenseStatistics.averagePerParticipant(240000, 0)  // null
   */
  static averagePerParticipant(
    totalAmountInCents: number,
    participantCount: number,
  ): number | null {
    if (participantCount === 0) return null;

    return Math.round(totalAmountInCents / participantCount);
  }

  /**
   * Berechnet, was bisher pro Person und Tag verbraucht wurde, gemessen an
   * **allen** Anlasstagen (nicht nur den vergangenen). So bläht ein
   * Grosseinkauf vor dem Anlass den Wert nicht auf, und er ist direkt mit dem
   * Ansatz eines «pro Person & Tag»-Budgets vergleichbar. Gerundet wird erst
   * am Schluss auf ganze Rappen.
   *
   * @param totalAmountInCents - Summe der Ausgaben in Rappen (eine Währung).
   * @param participantCount - Anzahl Teilnehmende aus der Gruppenkonfiguration.
   * @param campDayCount - Anzahl Anlasstage (`event.numberOfDays`).
   * @returns Betrag pro Person und Tag in Rappen, `null` bei 0 Teilnehmenden
   *   oder 0 Anlasstagen.
   * @example
   * ExpenseStatistics.averagePerParticipantAndDay(168000, 24, 7) // 1000
   */
  static averagePerParticipantAndDay(
    totalAmountInCents: number,
    participantCount: number,
    campDayCount: number,
  ): number | null {
    if (participantCount === 0 || campDayCount === 0) return null;

    return Math.round(totalAmountInCents / campDayCount / participantCount);
  }

  /**
   * Zählt die Ausgaben ohne Beleg. Wird bewusst über alle Budgets und
   * Währungen aufgerufen: Für die Abrechnung braucht jede Ausgabe einen Beleg.
   *
   * @param expenses - Zu prüfende Ausgaben.
   * @returns Anzahl Ausgaben ohne `attachmentPath`.
   * @example
   * ExpenseStatistics.countWithoutAttachment(expenses) // 3
   */
  static countWithoutAttachment(expenses: ExpenseDomain[]): number {
    return expenses.filter((expense) => expense.attachmentPath === null).length;
  }

  /**
   * Liefert die grössten Ausgaben. Sortiert nach Betrag absteigend, bei
   * gleichem Betrag neueres Datum zuerst, dann nach Bezeichnung — ein fester
   * Tie-Breaker, damit die Reihenfolge nach einem Realtime-Reload nicht springt.
   * Die Eingabe bleibt unverändert.
   *
   * @param expenses - Ausgaben einer Währung.
   * @param limit - Maximale Anzahl Einträge (Standard 5).
   * @returns Neue Liste mit höchstens `limit` Ausgaben.
   * @example
   * ExpenseStatistics.topExpenses(expensesInChf)    // die 5 grössten
   * ExpenseStatistics.topExpenses(expensesInChf, 3) // die 3 grössten
   */
  static topExpenses(expenses: ExpenseDomain[], limit = 5): ExpenseDomain[] {
    return [...expenses]
      .sort((expenseA, expenseB) => {
        if (expenseA.amountInCents > expenseB.amountInCents) {
          return -1;
        } else if (expenseA.amountInCents < expenseB.amountInCents) {
          return 1;
        } else {
          if (expenseA.date.getTime() < expenseB.date.getTime()) {
            return 1;
          } else if (expenseA.date.getTime() > expenseB.date.getTime()) {
            return -1;
          } else {
            return expenseA.label.localeCompare(expenseB.label, "de");
          }
        }
      })
      .slice(0, limit);
  }
  /**
   * Entfernt die Ausgaben abgewählter Budgets. Gespeichert werden die
   * abgewählten statt der ausgewählten IDs, damit neue Budgets automatisch
   * mitzählen und IDs gelöschter Budgets nichts bewirken.
   *
   * @param expenses - Zu filternde Ausgaben.
   * @param excludedBudgetIds - IDs der Budgets, die nicht mitzählen.
   * @returns Neue Liste ohne die Ausgaben dieser Budgets.
   * @example
   * ExpenseStatistics.excludeBudgets(expenses, ["budget-material"])
   */
  static excludeBudgets(
    expenses: ExpenseDomain[],
    excludedBudgetIds: string[],
  ): ExpenseDomain[] {
    return expenses.filter(
      (expense) => !excludedBudgetIds.includes(expense.budgetId),
    );
  }

  /**
   * Sortier-Vergleich für Währungscodes: häufigste zuerst, bei Gleichstand
   * CHF vor allen anderen, sonst alphabetisch. Bestimmt damit sowohl die
   * Vorauswahl (erstes Element) als auch die Reihenfolge im Währungs-Toggle.
   *
   * @param currencyA - Erster Währungscode.
   * @param currencyB - Zweiter Währungscode.
   * @param countByCurrency - Anzahl Ausgaben je Währung.
   * @returns Negativ, wenn `currencyA` zuerst kommt; positiv, wenn `currencyB` zuerst kommt.
   */
  private static compareCurrencyUsage(
    currencyA: string,
    currencyB: string,
    countByCurrency: Map<string, number>,
  ): number {
    const countDifference =
      (countByCurrency.get(currencyB) ?? 0) -
      (countByCurrency.get(currencyA) ?? 0);
    if (countDifference !== 0) return countDifference;

    // Gleichstand: Hauptwährung der App bevorzugen
    if (currencyA === DEFAULT_CURRENCY) return -1;
    if (currencyB === DEFAULT_CURRENCY) return 1;

    return currencyA.localeCompare(currencyB);
  }
}
