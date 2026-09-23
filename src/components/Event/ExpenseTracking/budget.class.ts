import {FieldValidationError} from "../../Shared/fieldValidation.error.class";
import {BudgetDomain, BudgetIcon, BudgetType} from "./budget.types";

import {
  PLEASE_PROVIDE_NAME as TEXT_PLEASE_PROVIDE_NAME,
  PLEASE_PROVIDE_AMOUNT as TEXT_PLEASE_PROVIDE_AMOUNT,
  PROVIDE_BUDGET_TYPE as TEXT_PROVIDE_BUDGET_TYPE,
  BUDGET_ICON_INVALID as TEXT_BUDGET_ICON_INVALID,
} from "../../../constants/text";
import {ExpenseTotalsByBudget} from "./expense.types";

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
}
