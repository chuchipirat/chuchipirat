import {expense, expenseChf, expenseEur} from "../__mocks__/expense.mock";
import {Expense} from "../expense.class";

import {
  PLEASE_PROVIDE_LABEL as TEXT_PLEASE_PROVIDE_LABEL,
  PLEASE_PROVIDE_AMOUNT as TEXT_PLEASE_PROVIDE_AMOUNT,
  EXPENSE_AMOUNT_TOO_LARGE as TEXT_EXPENSE_AMOUNT_TOO_LARGE,
  PLEASE_PROVIDE_BUDGET as TEXT_PLEASE_PROVIDE_BUDGET,
  PLEASE_PROVIDE_DATE as TEXT_PLEASE_PROVIDE_DATE,
  PLEASE_PROVIDE_CURRENCY as TEXT_PLEASE_PROVIDE_CURRENCY,
  PLEASE_PROVIDE_PAYEE as TEXT_PLEASE_PROVIDE_PAYEE,
  PLEASE_PROVIDE_PAYEE_NAME as TEXT_PLEASE_PROVIDE_PAYEE_NAME,
} from "../../../../constants/text";
import {ExpenseDomain, ExpensePayeeType} from "../expense.types";
import {BudgetDomain} from "../budget.types";
import {FieldValidationError} from "../../../Shared/fieldValidation.error.class";

const expenses: ExpenseDomain[] = [
  {
    id: "expense-id-1",
    date: new Date(2026, 9, 21),

    label: "Migros",
    budgetId: "kitchen",
    currency: "CHF",
    amountInCents: 4200,
  } as ExpenseDomain,
  {
    id: "expense-id-2",
    date: new Date(2026, 9, 17),

    label: "Coop",
    budgetId: "kitchen",
    currency: "CHF",
    amountInCents: 1800,
  } as ExpenseDomain,
  {
    id: "expense-id-3",
    date: new Date(2026, 9, 24),

    label: "Aldi Deutschland",
    budgetId: "kitchen",
    currency: "EUR",
    amountInCents: 1000,
  } as ExpenseDomain,
  {
    id: "expense-id-4",
    date: new Date(2026, 9, 1),

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
    expenseMock.date = new Date("invalid");
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
  test("Expense.checkExpenseData(), Payee-Kombinationen", () => {
    const expenseMock = {...expense};

    expenseMock.payeeType = ExpensePayeeType.EXISTING_USER;
    expenseMock.payeeUserId = null;
    expect(() => Expense.checkExpenseData(expenseMock)).toThrow(
      TEXT_PLEASE_PROVIDE_PAYEE,
    );

    expenseMock.payeeType = ExpensePayeeType.NEW_PERSON;
    expenseMock.payeeName = "";

    expect(() => Expense.checkExpenseData(expenseMock)).toThrow(
      TEXT_PLEASE_PROVIDE_PAYEE_NAME,
    );

    // Korrekte Kombinationen funktionieren
    expenseMock.payeeType = ExpensePayeeType.EXISTING_USER;
    expenseMock.payeeUserId = "user-id-01";
    expenseMock.payeeName = null;
    expect(() => Expense.checkExpenseData(expenseMock)).not.toThrow();

    expenseMock.payeeType = ExpensePayeeType.NEW_PERSON;
    expenseMock.payeeUserId = null;
    expenseMock.payeeName = "Hans Beispiel";
    expect(() => Expense.checkExpenseData(expenseMock)).not.toThrow();
  });
  test("Expense.checkExpenseData(), Positiv-Fall", () => {
    const expenseMock = {...expense};
    expect(() => Expense.checkExpenseData(expenseMock)).not.toThrow();
    expect(() => Expense.checkExpenseData({...expense, label: ""})).toThrow(
      FieldValidationError,
    );
  });
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

    mockedExpenses.forEach((expense) => (expense.date = new Date(2026, 9, 21)));

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

describe("Expense.diffIds", () => {
  test("Leere Listen ergeben eine leere Menge", () => {
    expect(Expense.diffIds([], [])).toEqual(new Set());
  });

  test("Neues Element (ID nicht in previous) wird erkannt", () => {
    const previous = [{id: "a", value: 1}];
    const current = [
      {id: "a", value: 1},
      {id: "b", value: 2},
    ];

    expect(Expense.diffIds(previous, current)).toEqual(new Set(["b"]));
  });

  test("Geändertes Feld wird erkannt", () => {
    const previous = [{id: "a", value: 1}];
    const current = [{id: "a", value: 2}];

    expect(Expense.diffIds(previous, current)).toEqual(new Set(["a"]));
  });

  test("Unverändertes Element wird nicht erkannt", () => {
    const previous = [{id: "a", value: 1}];
    const current = [{id: "a", value: 1}];

    expect(Expense.diffIds(previous, current)).toEqual(new Set());
  });

  test("Datum mit gleichem Wert, aber neuer Objekt-Instanz wird nicht fälschlich als geändert erkannt", () => {
    // Zwei verschiedene Date-Instanzen, gleicher Zeitpunkt — genau das, was
    // parseLocalDate() bei jedem Reload neu erzeugt. JSON.stringify ruft auf
    // Date.toISOString() zurück, ist also wertstabil, nicht referenzstabil.
    const previous = [{id: "a", date: new Date("2026-10-21")}];
    const current = [{id: "a", date: new Date("2026-10-21")}];
    expect(previous[0].date).not.toBe(current[0].date);

    expect(Expense.diffIds(previous, current)).toEqual(new Set());
  });
});
describe("Expense.sumByPayee", () => {
  test("Leere Expense-Liste = []", () => {
    expect(Expense.sumByPayee([])).toEqual([]);
  });
  test("NO_REFUND_NEEDED Einträge werden ignoriert", () => {
    // Beide Einträge teilen dieselbe payeeUserId — landen also so oder so in
    // derselben Zeile. Der eigentliche Beweis ist deshalb nicht payeeType
    // (das Feld stammt immer vom ersten verarbeiteten Eintrag für den
    // Schlüssel, unabhängig vom Filter), sondern dass der Betrag des
    // no_refund_needed-Eintrags nicht mitgezählt wird.
    const expensesMock: ExpenseDomain[] = [
      {...expense},
      {...expense, payeeType: ExpensePayeeType.NO_REFUND_NEEDED},
    ];

    const sumByPayee = Expense.sumByPayee(expensesMock);

    expect(sumByPayee).toHaveLength(1);
    expect(sumByPayee[0].totalsByCurrency["CHF"]).toEqual(
      expense.amountInCents, // nicht amountInCents * 2
    );
  });
  test("Selbe PayeeUserId wird summiert", () => {
    const expensesMock: ExpenseDomain[] = [
      {...expense},
      {...expenseChf},
      {...expense, payeeUserId: "payee-id-002"},
    ];
    const sumByPayee = Expense.sumByPayee(expensesMock);

    expect(
      sumByPayee.find((row) => row.payeeUserId == "payee-id-001")
        ?.totalsByCurrency["CHF"],
    ).toEqual(5300);
    expect(
      sumByPayee.find((row) => row.payeeUserId == "payee-id-002")
        ?.totalsByCurrency["CHF"],
    ).toEqual(4200);
  });
  test("Neue Person identisch wird summiert", () => {
    const expensesMock: ExpenseDomain[] = [
      {
        ...expense,
        payeeName: "Felix",
        payeeType: ExpensePayeeType.NEW_PERSON,
        payeeUserId: null,
      },
      {
        ...expenseChf,
        payeeName: "Felix",
        payeeType: ExpensePayeeType.NEW_PERSON,
        payeeUserId: null,
      },
      {
        ...expense,
        payeeName: "felix",
        payeeType: ExpensePayeeType.NEW_PERSON,
        payeeUserId: null,
      },
    ];
    const sumByPayee = Expense.sumByPayee(expensesMock);

    expect(
      sumByPayee.find((row) => row.payeeName == "Felix")?.totalsByCurrency[
        "CHF"
      ],
    ).toEqual(5300);
    expect(
      sumByPayee.find((row) => row.payeeName == "felix")?.totalsByCurrency[
        "CHF"
      ],
    ).toEqual(4200);
  });
  test("Mehrere Währungen pro Person, werden zusammengeführt", () => {
    const expensesMock: ExpenseDomain[] = [
      {
        ...expense,
        payeeType: ExpensePayeeType.EXISTING_USER,
      },
      {
        ...expenseChf,
        payeeType: ExpensePayeeType.EXISTING_USER,
      },
      {
        ...expenseEur,
        payeeType: ExpensePayeeType.EXISTING_USER,
        payeeUserId: "payee-id-001",
      },
    ];
    const sumByPayee = Expense.sumByPayee(expensesMock);

    expect(sumByPayee.length).toEqual(1);
    expect(sumByPayee[0].totalsByCurrency["CHF"]).toEqual(5300);
    expect(sumByPayee[0].totalsByCurrency["EUR"]).toEqual(1100);
  });
  test("Ausgaben einer Person werden richtig sortiert", () => {
    const expensesMock: ExpenseDomain[] = [
      {
        ...expense,
        id: "expense-id-001",
        date: new Date(2026, 10, 1),
        payeeType: ExpensePayeeType.EXISTING_USER,
        payeeUserId: "payee-id-001",
      },
      {
        ...expenseChf,
        id: "expense-id-002",
        date: new Date(2026, 10, 10),
        payeeType: ExpensePayeeType.EXISTING_USER,
        payeeUserId: "payee-id-001",
      },
      {
        ...expenseEur,
        id: "expense-id-003",
        date: new Date(2026, 9, 27),
        payeeType: ExpensePayeeType.EXISTING_USER,
        payeeUserId: "payee-id-001",
      },
    ];

    const sumByPayee = Expense.sumByPayee(expensesMock);

    // Eingabereihenfolge ist 1, 2, 3 — erwartet wird nach Datum sortiert
    expect(sumByPayee[0].expenses.map((entry) => entry.id)).toEqual([
      "expense-id-002",
      "expense-id-001",
      "expense-id-003",
    ]);
  });
});
