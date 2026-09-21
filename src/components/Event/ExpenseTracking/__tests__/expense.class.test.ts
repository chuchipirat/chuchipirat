import {expense} from "../__mocks__/expense.mock";
import {Expense} from "../expense.class";

import {
  PLEASE_PROVIDE_LABEL as TEXT_PLEASE_PROVIDE_LABEL,
  PLEASE_PROVIDE_AMOUNT as TEXT_PLEASE_PROVIDE_AMOUNT,
  EXPENSE_AMOUNT_TOO_LARGE as TEXT_EXPENSE_AMOUNT_TOO_LARGE,
  PLEASE_PROVIDE_BUDGET as TEXT_PLEASE_PROVIDE_BUDGET,
  PLEASE_PROVIDE_DATE as TEXT_PLEASE_PROVIDE_DATE,
  PLEASE_PROVIDE_CURRENCY as TEXT_PLEASE_PROVIDE_CURRENCY,
} from "../../../../constants/text";
import {ExpenseDomain} from "../expense.types";
import {BudgetDomain} from "../budget.types";
import {FieldValidationError} from "../../../Shared/fieldValidation.error.class";

const expenses: ExpenseDomain[] = [
  {
    id: "expense-id-1",
    expenseDate: new Date(2026, 9, 21),

    label: "Migros",
    budgetId: "kitchen",
    currency: "CHF",
    amountInCents: 4200,
  } as ExpenseDomain,
  {
    id: "expense-id-2",
    expenseDate: new Date(2026, 9, 17),

    label: "Coop",
    budgetId: "kitchen",
    currency: "CHF",
    amountInCents: 1800,
  } as ExpenseDomain,
  {
    id: "expense-id-3",
    expenseDate: new Date(2026, 9, 24),

    label: "Aldi Deutschland",
    budgetId: "kitchen",
    currency: "EUR",
    amountInCents: 1000,
  } as ExpenseDomain,
  {
    id: "expense-id-4",
    expenseDate: new Date(2026, 9, 1),

    label: "Bus Billet",
    budgetId: "transport",
    currency: "CHF",
    amountInCents: 2500,
  } as ExpenseDomain,
];

const budgets: BudgetDomain[] = [
  {id: "transport"} as BudgetDomain,
  {id: "kitchen"} as BudgetDomain,
];

describe("Expense.checkExpenseData", () => {
  test("Expense.checkExpenseData(), keine Bezeichnung", () => {
    const expenseMock = {...expense};
    expenseMock.label = "";
    expect(() => Expense.checkExpenseData(expenseMock)).toThrow(
      TEXT_PLEASE_PROVIDE_LABEL,
    );

    expenseMock.label = "    ";
    expect(() => Expense.checkExpenseData(expenseMock)).toThrow(
      TEXT_PLEASE_PROVIDE_LABEL,
    );
    expect(() => Expense.checkExpenseData({...expense, label: ""})).toThrow(
      FieldValidationError,
    );
  });

  test("Expense.checkExpenseData(), Betragsprüfungen", () => {
    const expenseMock = {...expense};
    expenseMock.amountInCents = 0;
    expect(() => Expense.checkExpenseData(expenseMock)).toThrow(
      TEXT_PLEASE_PROVIDE_AMOUNT,
    );
    expenseMock.amountInCents = -40;
    expect(() => Expense.checkExpenseData(expenseMock)).toThrow(
      TEXT_PLEASE_PROVIDE_AMOUNT,
    );

    expenseMock.amountInCents = 12.5;
    expect(() => Expense.checkExpenseData(expenseMock)).toThrow(
      TEXT_PLEASE_PROVIDE_AMOUNT,
    );

    expenseMock.amountInCents = NaN;
    expect(() => Expense.checkExpenseData(expenseMock)).toThrow(
      TEXT_PLEASE_PROVIDE_AMOUNT,
    );

    expenseMock.amountInCents = 2147483648;
    expect(() => Expense.checkExpenseData(expenseMock)).toThrow(
      TEXT_EXPENSE_AMOUNT_TOO_LARGE,
    );

    expenseMock.amountInCents = Infinity;
    expect(() => Expense.checkExpenseData(expenseMock)).toThrow(
      TEXT_PLEASE_PROVIDE_AMOUNT,
    );

    expenseMock.amountInCents = 2147483647;
    expect(() => Expense.checkExpenseData(expenseMock)).not.toThrow();
  });

  test("Expense.checkExpenseData(), Budget gewählt", () => {
    const expenseMock = {...expense};
    expenseMock.budgetId = "";
    expect(() => Expense.checkExpenseData(expenseMock)).toThrow(
      TEXT_PLEASE_PROVIDE_BUDGET,
    );
  });

  test("Expense.checkExpenseData(), gültiges Datum", () => {
    const expenseMock = {...expense};
    expenseMock.expenseDate = new Date("invalid");
    expect(() => Expense.checkExpenseData(expenseMock)).toThrow(
      TEXT_PLEASE_PROVIDE_DATE,
    );
  });
  test("Expense.checkExpenseData(), gültiges Währung", () => {
    const expenseMock = {...expense};
    expenseMock.currency = "";
    expect(() => Expense.checkExpenseData(expenseMock)).toThrow(
      TEXT_PLEASE_PROVIDE_CURRENCY,
    );
    expenseMock.currency = "Schweizer Franken";
    expect(() => Expense.checkExpenseData(expenseMock)).toThrow(
      TEXT_PLEASE_PROVIDE_CURRENCY,
    );

    expenseMock.currency = "chf";
    expect(() => Expense.checkExpenseData(expenseMock)).toThrow(
      TEXT_PLEASE_PROVIDE_CURRENCY,
    );
  });
  test("Expense.checkExpenseData(), Positiv-Fall", () => {
    const expenseMock = {...expense};
    expect(() => Expense.checkExpenseData(expenseMock)).not.toThrow();
  });
  expect(() => Expense.checkExpenseData({...expense, label: ""})).toThrow(
    FieldValidationError,
  );
});
describe("Expense.sumByBudgetAndCurrency", () => {
  test("Leere Liste = {}", () => {
    expect(Expense.sumByBudgetAndCurrency([])).toEqual({});
  });
  test("Korrekte Summierung", () => {
    expect(Expense.sumByBudgetAndCurrency(expenses)).toEqual({
      kitchen: {CHF: 6000, EUR: 1000},
      transport: {CHF: 2500},
    });
  });
  test("Input wurde nicht geändert", () => {
    // const mockExpenses: ExpenseDomain[] = [
    //   {...expense, budgetId: "kitchen", currency: "CHF", amountInCents: 4200},
    //   {...expense, budgetId: "kitchen", currency: "EUR", amountInCents: 1000},
    // ];
    const expensesBefore = expenses.map((entry) => ({...entry}));

    Expense.sumByBudgetAndCurrency(expenses);

    expect(expenses).toEqual(expensesBefore);
  });
  test("leerer Input = {}", () => {
    expect(Expense.sumByBudgetAndCurrency([])).toEqual({});
  });
});
describe("Expense.sortByDateDescending", () => {
  test("Richtige sortierung", () => {
    const sortedList = Expense.sortByDateDescending(expenses);

    expect(sortedList[0].id).toEqual("expense-id-3");
  });
  test("Keine Mutation des Inputs", () => {
    const expenseBefore = expenses.map((expense) => ({...expense}));

    const sortedList = Expense.sortByDateDescending(expenses);

    expect(sortedList).not.toBe(expenses);
    expect(expenses).toEqual(expenseBefore);
  });
  test("Sortierung mit gleichen Daten", () => {
    const mockedExpenses = expenses.map((expense) => ({...expense}));

    mockedExpenses.forEach(
      (expense) => (expense.expenseDate = new Date(2026, 9, 21)),
    );

    const sortedList = Expense.sortByDateDescending(mockedExpenses);

    expect(sortedList[0].label).toBe("Aldi Deutschland");
    expect(sortedList[1].label).toBe("Bus Billet");
    expect(sortedList[2].label).toBe("Coop");
    expect(sortedList[3].label).toBe("Migros");
  });
  test("Leerer Input = []", () => {
    expect(Expense.sortByDateDescending([])).toEqual([]);
  });
});

describe("Expense.groupByBudget", () => {
  test("Richtige Gruppierung", () => {
    const groupedExpensesByBudget = Expense.groupByBudget(expenses, budgets);

    expect(groupedExpensesByBudget[0].budget.id).toBe("transport");
    expect(groupedExpensesByBudget[0].expenses.length).toBe(1);
    expect(
      Object.keys(groupedExpensesByBudget[1].totalsByCurrency).length,
    ).toBe(2);
    expect(groupedExpensesByBudget[1].totalsByCurrency).toEqual({
      CHF: 6000,
      EUR: 1000,
    });
  });

  test("Ausgaben innerhalb einer Gruppe: neueste zuerst", () => {
    const kitchenGroup = Expense.groupByBudget(expenses, budgets)[1];

    // Eingabereihenfolge ist 1, 2, 3 — erwartet wird nach Datum sortiert
    expect(kitchenGroup.expenses.map((entry) => entry.id)).toEqual([
      "expense-id-3",
      "expense-id-1",
      "expense-id-2",
    ]);
  });

  test("Budget ohne Ausgaben", () => {
    const groupedExpensesByBudget = Expense.groupByBudget(expenses, [
      {id: "empty"} as BudgetDomain,
    ]);

    expect(groupedExpensesByBudget[0].budget.id).toBe("empty");
    expect(groupedExpensesByBudget[0].expenses).toEqual([]);
    expect(groupedExpensesByBudget[0].totalsByCurrency).toEqual({});
  });

  test("Keine Ausgaben: pro Budget eine leere Gruppe, Reihenfolge bleibt", () => {
    const groups = Expense.groupByBudget([], budgets);

    expect(groups).toHaveLength(2);
    expect(groups.map((group) => group.budget.id)).toEqual([
      "transport",
      "kitchen",
    ]);
    expect(groups[0].expenses).toEqual([]);
    expect(groups[0].totalsByCurrency).toEqual({});
  });

  test("Ausgaben ohne zugehöriges Budget tauchen in keiner Gruppe auf", () => {
    const orphan = {id: "orphan", budgetId: "deleted-budget"} as ExpenseDomain;

    const groups = Expense.groupByBudget([...expenses, orphan], budgets);

    expect(groups).toHaveLength(budgets.length);
    expect(
      groups.flatMap((group) => group.expenses).map((entry) => entry.id),
    ).not.toContain("orphan");
  });
});
