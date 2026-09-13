import {BudgetDomain, BudgetType} from "./budget.types";

interface ComputeBudgetPerPersonPerDayAmountParams {
  participantCount: number;
  dayCount: number;
  amountPerPersonPerDay: number;
}
/**
 * Domain-Klasse für das Budget eines Events.
 *
 * Enthält reine Business-Logik (kein Supabase). Persistenz
 * erfolgt über BudgetRepository.
 */
export class Budget {
  /**
   * Berechnet das Totalbudget für ein Event anhand der Anzahl Teilnehmer,
   * Anzahl Tage und Budget pro Person pro Tag.
   *
   * @param params -Anzahl TN, Anzahl Tage, Budget pro Person pro Tag
   * @returns Totalbudget in Rappen
   */
  static computeBudgetPerPersonPerDayAmount({
    participantCount,
    dayCount,
    amountPerPersonPerDay,
  }: ComputeBudgetPerPersonPerDayAmountParams) {
    return participantCount * dayCount * amountPerPersonPerDay;
  }
  /**
   * Erstellt ein Standard-Küchenbudget für ein Event.
   *
   * @param eventId - Die ID des Events
   * @returns Das erstellte Default-Küchenbudget
   */
  static createDefaultKitchenBudget(eventId: string): BudgetDomain {
    return {
      id: "",
      eventId,
      name: "Küche",
      budgetType: BudgetType.PER_PERSON_PER_DAY,
      amountInCents: null,
      currency: "CHF",
    };
  }
}
