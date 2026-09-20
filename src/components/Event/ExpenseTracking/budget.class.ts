import {FieldValidationError} from "../../Shared/fieldValidation.error.class";
import {BudgetDomain, BudgetIcon, BudgetType} from "./budget.types";

import {
  PLEASE_PROVIDE_NAME as TEXT_PLEASE_PROVIDE_NAME,
  PLEASE_PROVIDE_AMOUNT as TEXT_PLEASE_PROVIDE_AMOUNT,
  PROVIDE_BUDGET_TYPE as TEXT_PROVIDE_BUDGET_TYPE,
  BUDGET_ICON_INVALID as TEXT_BUDGET_ICON_INVALID,
} from "../../../constants/text";

/**
 * Parameter für {@link Budget.computeBudgetPerPersonPerDayAmount}.
 *
 * @param participantCount - Anzahl Teilnehmer:innen.
 * @param dayCount - Anzahl Lagertage.
 * @param amountPerPersonPerDay - Betrag pro Person und Tag in Rappen.
 */
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
}
