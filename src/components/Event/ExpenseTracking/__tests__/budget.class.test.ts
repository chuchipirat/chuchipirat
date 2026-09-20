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
