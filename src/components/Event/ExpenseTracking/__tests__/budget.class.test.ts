/**
 * Unit-Tests für Budget (budget.class.ts).
 *
 * Testet die Default-Budget-Erstellung und die
 * Pro-Person-pro-Tag-Berechnung.
 */
import {Budget} from "../budget.class";

describe("Budget.createDefaultKitchenBudget", () => {
  test("erstellt ein Default-Küchenbudget", () => {
    const eventId = "event-uuid-001";
    const budget = Budget.createDefaultKitchenBudget(eventId);

    expect(budget).toEqual({
      id: "",
      eventId: eventId,
      name: "Küche",
      budgetType: "per_person_per_day",
      amountInCents: null,
      currency: "CHF",
    });
  });
});
describe("Budget.computeBudgetPerPersonPerDayAmount", () => {
  test("Berechnung des Budgets anhand von Teilnehmern, Tagen und Budget pro Person pro Tag", () => {
    const result = Budget.computeBudgetPerPersonPerDayAmount({
      participantCount: 10,
      dayCount: 5,
      amountPerPersonPerDay: 750,
    });
    expect(result).toBe(37500);
  });
  test("Berechnung des Budgets mit 0 Teilnehmern", () => {
    const result = Budget.computeBudgetPerPersonPerDayAmount({
      participantCount: 0,
      dayCount: 5,
      amountPerPersonPerDay: 750,
    });
    expect(result).toBe(0);
  });
  test("Berechnung des Budgets mit 0 Tagen", () => {
    const result = Budget.computeBudgetPerPersonPerDayAmount({
      participantCount: 10,
      dayCount: 0,
      amountPerPersonPerDay: 750,
    });
    expect(result).toBe(0);
  });
});
