/**
 * Unit-Tests für Budget (budget.class.ts).
 *
 * Testet die Default-Budget-Erstellung und die
 * Pro-Person-pro-Tag-Berechnung.
 */
import {Budget} from "../budget.class";
import {budget} from "../__mocks__/budget.mock";
import {BudgetType, BudgetIcon} from "../budget.types";
import {
  PLEASE_PROVIDE_NAME as TEXT_PLEASE_PROVIDE_NAME,
  PLEASE_PROVIDE_AMOUNT as TEXT_PLEASE_PROVIDE_AMOUNT,
  PROVIDE_BUDGET_TYPE as TEXT_PROVIDE_BUDGET_TYPE,
  BUDGET_ICON_INVALID as TEXT_BUDGET_ICON_INVALID,
} from "../../../../constants/text";

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
      icon: "kitchen",
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
describe("Budget.checkBudgetData", () => {
  test("Budget.checkBudgetData(), kein Name", () => {
    const budgetMock = structuredClone(budget);
    budgetMock.name = "";
    expect(() => Budget.checkBudgetData(budgetMock)).toThrow(
      TEXT_PLEASE_PROVIDE_NAME,
    );
  });
  test("Budget.checkBudgetData(), kein Betrag", () => {
    const budgetMock = structuredClone(budget);
    budgetMock.amountInCents = 0;
    expect(() => Budget.checkBudgetData(budgetMock)).toThrow(
      TEXT_PLEASE_PROVIDE_AMOUNT,
    );
  });
  test("Budget.checkBudgetData(), kein Budgettyp", () => {
    const budgetMock = structuredClone(budget);
    // Ungültiger Laufzeitwert simulieren (TS würde das an dieser Stelle
    // sonst schon verhindern) — daher der Cast über `unknown`.
    budgetMock.budgetType = "" as unknown as BudgetType;
    expect(() => Budget.checkBudgetData(budgetMock)).toThrow(
      TEXT_PROVIDE_BUDGET_TYPE,
    );
  });
  test("Budget.checkBudgetData(), kein Icon", () => {
    const budgetMock = structuredClone(budget);
    budgetMock.icon = null as unknown as BudgetIcon;
    expect(() => Budget.checkBudgetData(budgetMock)).toThrow(
      TEXT_BUDGET_ICON_INVALID,
    );
  });
});
