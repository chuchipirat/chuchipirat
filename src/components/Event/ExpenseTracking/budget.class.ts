import {FieldValidationError} from "../../Shared/fieldValidation.error.class";
import {
  BudgetDomain,
  BudgetIcon,
  BudgetProjection,
  BudgetType,
} from "./budget.types";

import {
  PLEASE_PROVIDE_NAME as TEXT_PLEASE_PROVIDE_NAME,
  PLEASE_PROVIDE_AMOUNT as TEXT_PLEASE_PROVIDE_AMOUNT,
  PROVIDE_BUDGET_TYPE as TEXT_PROVIDE_BUDGET_TYPE,
  BUDGET_ICON_INVALID as TEXT_BUDGET_ICON_INVALID,
} from "../../../constants/text";
import {ExpenseDomain, ExpenseTotalsByBudget} from "./expense.types";
import {formatLocalDate} from "../../../utils/dateUtils";

/**
 * Domain-Klasse für das Budget eines Events.
 *
 * Enthält reine Business-Logik (kein Supabase). Persistenz
 * erfolgt über BudgetRepository.
 */
export class Budget {
  /**
   * Validiert die Felder eines Budgets
   *
   * @param budget - Das zu prüfende Budget.
   * @throws {FieldValidationError} Wenn Pflichtfelder fehlen oder ungültige
   *   Werte enthalten. Der Fehler ist eine Nutzer-Hinweismeldung und wird
   *   bewusst nicht an Sentry gemeldet.
   */

  static checkBudgetData(budget: BudgetDomain): void {
    if (!budget.name) {
      throw new FieldValidationError(TEXT_PLEASE_PROVIDE_NAME);
    }
    if (
      !budget.amountInCents ||
      budget.amountInCents === 0 ||
      isNaN(budget.amountInCents)
    ) {
      throw new FieldValidationError(TEXT_PLEASE_PROVIDE_AMOUNT);
    }
    if (
      budget.budgetType !== BudgetType.FIXED_AMOUNT &&
      budget.budgetType !== BudgetType.PER_PERSON_PER_DAY
    ) {
      throw new FieldValidationError(TEXT_PROVIDE_BUDGET_TYPE);
    }
    if (!Object.values(BudgetIcon).includes(budget.icon)) {
      throw new FieldValidationError(TEXT_BUDGET_ICON_INVALID);
    }
  }
  /**
   * Berechnet den effektiven Sollbetrag eines Budgets in Rappen.
   *
   * @param budget - Das Budget.
   * @param participantCount - Anzahl Teilnehmer:innen des Events.
   * @param dayCount - Anzahl Lagertage.
   * @returns Sollbetrag in Rappen.
   */
  static getTargetAmountInCents = (
    budget: BudgetDomain,
    participantCount: number,
    dayCount: number,
  ): number => {
    if (budget.budgetType === BudgetType.PER_PERSON_PER_DAY) {
      return (budget.amountInCents ?? 0) * participantCount * dayCount;
    }
    return budget.amountInCents ?? 0;
  };
  /**
   * Berechnet die Ausgegebenen Beträge für das übergebene Budget.
   *
   * @param budget - Das Budget.
   * @param expenseTotalsByBudget - Alle Ausgaben, sortiert nach Budget und Währung
   * @returns - die Ausgaben für das übergebene Budget
   */
  static getSpentAmounts = (
    budget: BudgetDomain,
    expenseTotalsByBudget: ExpenseTotalsByBudget,
  ) => {
    const spentAmounts: {
      spentAmountInCents: number;
      otherCurrencies: Record<string, number>[];
    } = {spentAmountInCents: 0, otherCurrencies: []};

    if (!expenseTotalsByBudget[budget.id]) {
      spentAmounts.spentAmountInCents = 0;
      return spentAmounts;
    }

    Object.keys(expenseTotalsByBudget[budget.id]).map((currency) => {
      if (currency.toLowerCase() == budget.currency.toLowerCase()) {
        spentAmounts.spentAmountInCents =
          expenseTotalsByBudget[budget.id][currency] ?? 0;
      } else {
        spentAmounts.otherCurrencies.push({
          [currency.toUpperCase()]:
            expenseTotalsByBudget[budget.id][currency] ?? 0,
        });
      }
    });

    spentAmounts.otherCurrencies.sort((a, b) => {
      const currencyA = Object.keys(a)[0];
      const currencyB = Object.keys(b)[0];

      if (currencyA < currencyB) {
        return -1;
      }
      if (currencyA > currencyB) {
        return 1;
      }
      return 0;
    });

    return spentAmounts;
  };
  /**
   * Hochrechnung wie viel am Ende des Anlasses ausgegeben wird.
   * Dabei wird unterschieden zwischen den initialen Kosten und den laufenden Kosten
   * - Laufend = Ausgaben vom ersten Lagertag bis heute
   * - alles andere (vor dem Lager, vorausdatiert, nach Lagerende) zählt einmal fest.
   *
   * Beispiel Anlass mit 7 Tagen, Heute ist Tag 3, CHF 1'200 ausgegeben vor dem Anlass
   * CHF 300 während des Anlasses:
   *  - fixed = 120000
   *  - laufend = 30000 → 30000 ÷ 3 × 7 = 70000
   *
   * Hochrechnung = 190000 (CHF 1'900)
   * @param budget - Das Budget.
   * @param expenses - Ausgaben
   * @param campDays - Liste der Anlass-Tage
   * @param today - Stichtag Heute
   * @returns Die Hochrechnung der Ausgaben, `null` vor dem ersten Lagertag,
   *  ab dem letzten Lagertag und ohne Lagertage
   */
  static projectSpending = ({
    budget,
    expenses,
    campDays,
    today,
  }: {
    budget: BudgetDomain;
    expenses: ExpenseDomain[];
    campDays: Date[];
    today: Date;
  }): BudgetProjection | null => {
    const todayKey = formatLocalDate(today);
    const campDayKeys = campDays.map((day) => formatLocalDate(day));
    const elapsedCampDays = campDayKeys.filter(
      (dayKey) => dayKey <= todayKey,
    ).length;

    if (elapsedCampDays < 1 || elapsedCampDays >= campDayKeys.length)
      return null;

    const firstCampDayKey = campDayKeys[0];

    const {runningAmountInCents, fixedAmountInCents} =
      Budget.splitFixedAndRunningExpenses({
        expenses,
        budget,
        firstCampDayKey,
        todayKey,
      });

    return {
      projectedAmountInCents: Math.round(
        (runningAmountInCents / elapsedCampDays) * campDays.length +
          fixedAmountInCents,
      ),
      elapsedCampDays,
      totalCampDays: campDays.length,
    };
  };
  /**
   * Kosten aufteilen in laufende und Fixkosten
   *
   * @param expenses - Ausgaben
   * @param budget - Das Budget
   * @param firstCampDayKey - Erster Lagertag im Format YYYY-MM-DD
   * @param todayKey - Heute im Format YYYY-MM-DD
   * @returns Die gesplitteten Kosten als `runningAmountInCents`und `fixedAmountInCents`
   */
  private static splitFixedAndRunningExpenses = ({
    expenses,
    budget,
    firstCampDayKey,
    todayKey,
  }: {
    expenses: ExpenseDomain[];
    budget: BudgetDomain;
    firstCampDayKey: string;
    todayKey: string;
  }) => {
    let fixedAmountInCents = 0;
    let runningAmountInCents = 0;

    for (const expense of expenses) {
      if (
        expense.budgetId !== budget.id ||
        expense.currency.toLocaleLowerCase() !==
          budget.currency.toLocaleLowerCase()
      )
        continue;
      const expenseDayKey = formatLocalDate(expense.date);

      if (expenseDayKey >= firstCampDayKey && expenseDayKey <= todayKey) {
        runningAmountInCents += expense.amountInCents;
      } else {
        fixedAmountInCents += expense.amountInCents;
      }
    }
    return {runningAmountInCents, fixedAmountInCents};
  };
}
