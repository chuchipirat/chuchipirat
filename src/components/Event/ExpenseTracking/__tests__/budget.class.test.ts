/**
 * Unit-Tests für Budget (budget.class.ts).
 *
 * Testet die Default-Budget-Erstellung und die
 * Pro-Person-pro-Tag-Berechnung.
 */
import {Budget} from "../budget.class";
import {budget} from "../__mocks__/budget.mock";
import {BudgetType, BudgetIcon, BudgetDomain} from "../budget.types";
import {
  PLEASE_PROVIDE_NAME as TEXT_PLEASE_PROVIDE_NAME,
  PLEASE_PROVIDE_AMOUNT as TEXT_PLEASE_PROVIDE_AMOUNT,
  PROVIDE_BUDGET_TYPE as TEXT_PROVIDE_BUDGET_TYPE,
  BUDGET_ICON_INVALID as TEXT_BUDGET_ICON_INVALID,
} from "../../../../constants/text";
import {expenseTotalsByBudget} from "../__mocks__/expense.mock";

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
describe("Budget.getSpentAmounts", () => {
  test("stabile Sortierung", () => {
    let budgetMock = structuredClone(budget);
    const expensteTotalByBudgetMock = {...expenseTotalsByBudget};

    let totals = Budget.getSpentAmounts(budgetMock, expensteTotalByBudgetMock);

    expect(totals).toEqual({
      spentAmountInCents: 4200,
      otherCurrencies: [],
    });

    budgetMock = {id: "budget-id-002", currency: "EUR"} as BudgetDomain;
    totals = Budget.getSpentAmounts(budgetMock, expensteTotalByBudgetMock);

    expect(totals).toEqual({
      spentAmountInCents: 3300,
      otherCurrencies: [{CHF: 2000}],
    });

    budgetMock = {id: "budget-id-003", currency: "CHF"} as BudgetDomain;
    totals = Budget.getSpentAmounts(budgetMock, expensteTotalByBudgetMock);

    expect(totals).toEqual({
      spentAmountInCents: 3700,
      otherCurrencies: [{EUR: 1100}, {USD: 50}],
    });

    totals = Budget.getSpentAmounts(budgetMock, expensteTotalByBudgetMock);

    expect(
      Budget.getSpentAmounts(budgetMock, {
        "budget-id-002": {CHF: 2000, EUR: 3300},
      }),
    ).toEqual({spentAmountInCents: 0, otherCurrencies: []});
  });

  test("Budget-Währung nachträglich geändert: Rollen tauschen, Ausgaben bleiben gleich", () => {
    // Dieselben Ausgaben wie im Bearbeiten-Dialog vor und nach dem
    // Währungswechsel — nur budget.currency ändert sich, die Summen aus den
    // Ausgaben selbst bleiben unangetastet (dasselbe Objekt für beide Calls).
    const totalsForBudget = {"budget-id-002": {CHF: 2000, EUR: 3300}};

    // Budget ursprünglich in EUR angelegt: EUR zählt zum Fortschritt, CHF
    // erscheint als Fremdwährungszeile.
    const budgetInEur = {id: "budget-id-002", currency: "EUR"} as BudgetDomain;
    expect(Budget.getSpentAmounts(budgetInEur, totalsForBudget)).toEqual({
      spentAmountInCents: 3300,
      otherCurrencies: [{CHF: 2000}],
    });

    // Nutzer:in stellt die Budget-Währung im Dialog auf CHF um — die
    // bisherigen EUR-Ausgaben zählen jetzt nicht mehr zum Fortschritt,
    // sondern stehen als Fremdwährung darunter (Entscheidung 2, bewusst
    // keine Sperre).
    const budgetInChf = {id: "budget-id-002", currency: "CHF"} as BudgetDomain;
    expect(Budget.getSpentAmounts(budgetInChf, totalsForBudget)).toEqual({
      spentAmountInCents: 2000,
      otherCurrencies: [{EUR: 3300}],
    });
  });
});
