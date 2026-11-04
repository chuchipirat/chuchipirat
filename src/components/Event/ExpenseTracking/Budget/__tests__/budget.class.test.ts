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
} from "../../../../../constants/text";
import {expenseTotalsByBudget} from "../../Expense/__mocks__/expense.mock";
import {parseLocalDate} from "../../../../../utils/dateUtils";
import {ExpenseDomain} from "../../Expense/expense.types";
import {expense} from "../../Expense/__mocks__/expense.mock";

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
describe("Budget.projectSpending", () => {
  // Testanlass: 7 Tage, 5.–11. Juli 2026

  const eventDaysMock: Date[] = [
    parseLocalDate("2026-07-05"),
    parseLocalDate("2026-07-06"),
    parseLocalDate("2026-07-07"),
    parseLocalDate("2026-07-08"),
    parseLocalDate("2026-07-09"),
    parseLocalDate("2026-07-10"),
    parseLocalDate("2026-07-11"),
  ];

  test("Vor dem Anlass, Hochrechnung ist `null`", () => {
    expect(
      Budget.projectSpending({
        expenses: [],
        budget,
        eventDays: eventDaysMock,
        today: parseLocalDate("2026-06-01"),
      }),
    ).toBeNull();
  });
  test("Erster Anlasstag", () => {
    const expenseMock: ExpenseDomain[] = [
      {...expense, date: parseLocalDate("2026-07-05"), amountInCents: 10000},
    ];

    const projectSpending = Budget.projectSpending({
      expenses: expenseMock,
      budget: budget,
      eventDays: eventDaysMock,
      today: parseLocalDate("2026-07-05"),
    });
    expect(projectSpending).not.toBeNull();
    expect(projectSpending?.projectedAmountInCents).toEqual(70000);
    expect(projectSpending?.elapsedEventDays).toEqual(1);
    expect(projectSpending?.totalEventDays).toEqual(7);
  });
  test("Mitte des Anlasses, mit mehreren Ausgaben", () => {
    const expenseMock: ExpenseDomain[] = [
      {...expense, date: parseLocalDate("2026-07-05"), amountInCents: 10000},
      {...expense, date: parseLocalDate("2026-07-06"), amountInCents: 20000},
    ];

    const projectSpending = Budget.projectSpending({
      expenses: expenseMock,
      budget: budget,
      eventDays: eventDaysMock,
      today: parseLocalDate("2026-07-07"),
    });
    expect(projectSpending).not.toBeNull();
    expect(projectSpending?.projectedAmountInCents).toEqual(70000);
    expect(projectSpending?.elapsedEventDays).toEqual(3);
    expect(projectSpending?.totalEventDays).toEqual(7);
  });
  test("Vorab-Einkauf wird nicht hochgerechnet", () => {
    const expenseMock: ExpenseDomain[] = [
      {...expense, date: parseLocalDate("2026-07-03"), amountInCents: 120000},
      {...expense, date: parseLocalDate("2026-07-05"), amountInCents: 10000},
      {...expense, date: parseLocalDate("2026-07-06"), amountInCents: 20000},
    ];

    const projectSpending = Budget.projectSpending({
      expenses: expenseMock,
      budget: budget,
      eventDays: eventDaysMock,
      today: parseLocalDate("2026-07-07"),
    });
    expect(projectSpending).not.toBeNull();
    expect(projectSpending?.projectedAmountInCents).toEqual(190000);
    expect(projectSpending?.elapsedEventDays).toEqual(3);
    expect(projectSpending?.totalEventDays).toEqual(7);
  });
  test("Vorausdatierte Ausgabe zählt fest", () => {
    const expenseMock: ExpenseDomain[] = [
      {...expense, date: parseLocalDate("2026-07-03"), amountInCents: 120000},
      {...expense, date: parseLocalDate("2026-07-05"), amountInCents: 10000},
      {...expense, date: parseLocalDate("2026-07-06"), amountInCents: 20000},
      {...expense, date: parseLocalDate("2026-07-09"), amountInCents: 5000},
    ];

    const projectSpending = Budget.projectSpending({
      expenses: expenseMock,
      budget: budget,
      eventDays: eventDaysMock,
      today: parseLocalDate("2026-07-07"),
    });
    expect(projectSpending).not.toBeNull();
    expect(projectSpending?.projectedAmountInCents).toEqual(195000);
    expect(projectSpending?.elapsedEventDays).toEqual(3);
    expect(projectSpending?.totalEventDays).toEqual(7);
  });
  test("Letzter Anlasstag = `null;` nach dem Anlass =`null`", () => {
    const expenseMock: ExpenseDomain[] = [
      {...expense, date: parseLocalDate("2026-07-03"), amountInCents: 120000},
      {...expense, date: parseLocalDate("2026-07-05"), amountInCents: 10000},
    ];

    let projectSpending = Budget.projectSpending({
      expenses: expenseMock,
      budget: budget,
      eventDays: eventDaysMock,
      today: parseLocalDate("2026-07-11"),
    });
    expect(projectSpending).toBeNull();

    projectSpending = Budget.projectSpending({
      expenses: expenseMock,
      budget: budget,
      eventDays: eventDaysMock,
      today: parseLocalDate("2026-07-31"),
    });
    expect(projectSpending).toBeNull();
  });
  test("Fremdwährung ignoriert", () => {
    const expenseMock: ExpenseDomain[] = [
      {...expense, date: parseLocalDate("2026-07-03"), amountInCents: 120000},
      {...expense, date: parseLocalDate("2026-07-05"), amountInCents: 10000},
      {...expense, date: parseLocalDate("2026-07-06"), amountInCents: 20000},
      {
        ...expense,
        date: parseLocalDate("2026-07-06"),
        amountInCents: 50000,
        currency: "EUR",
      },
    ];

    const projectSpending = Budget.projectSpending({
      expenses: expenseMock,
      budget: budget,
      eventDays: eventDaysMock,
      today: parseLocalDate("2026-07-07"),
    });
    expect(projectSpending).not.toBeNull();
    expect(projectSpending?.projectedAmountInCents).toEqual(190000);
    expect(projectSpending?.elapsedEventDays).toEqual(3);
    expect(projectSpending?.totalEventDays).toEqual(7);
  });
  test("Anderes Budget ignoriert", () => {
    const expenseMock: ExpenseDomain[] = [
      {...expense, date: parseLocalDate("2026-07-03"), amountInCents: 120000},
      {...expense, date: parseLocalDate("2026-07-05"), amountInCents: 10000},
      {...expense, date: parseLocalDate("2026-07-06"), amountInCents: 20000},
      {
        ...expense,
        date: parseLocalDate("2026-07-06"),
        amountInCents: 20000,
        budgetId: "budget-id-002",
      },
    ];

    const projectSpending = Budget.projectSpending({
      expenses: expenseMock,
      budget: budget,
      eventDays: eventDaysMock,
      today: parseLocalDate("2026-07-07"),
    });
    expect(projectSpending).not.toBeNull();
    expect(projectSpending?.projectedAmountInCents).toEqual(190000);
    expect(projectSpending?.elapsedEventDays).toEqual(3);
    expect(projectSpending?.totalEventDays).toEqual(7);
  });
  test("Keine Ausgaben, während des Anlasses = Hochrechnung 0", () => {
    const projectSpending = Budget.projectSpending({
      expenses: [],
      budget: budget,
      eventDays: eventDaysMock,
      today: parseLocalDate("2026-07-07"),
    });
    expect(projectSpending).not.toBeNull();
    expect(projectSpending?.projectedAmountInCents).toEqual(0);
    expect(projectSpending?.elapsedEventDays).toEqual(3);
    expect(projectSpending?.totalEventDays).toEqual(7);
  });
  test("Leere Anlasstage = `null`", () => {
    const expenseMock: ExpenseDomain[] = [
      {...expense, date: parseLocalDate("2026-07-03"), amountInCents: 120000},
      {...expense, date: parseLocalDate("2026-07-05"), amountInCents: 10000},
      {...expense, date: parseLocalDate("2026-07-06"), amountInCents: 20000},
    ];

    const projectSpending = Budget.projectSpending({
      expenses: expenseMock,
      budget: budget,
      eventDays: [],
      today: parseLocalDate("2026-07-07"),
    });
    expect(projectSpending).toBeNull();
  });
  test("Mehrere Zeitscheiben", () => {
    const expenseMock: ExpenseDomain[] = [
      {...expense, date: parseLocalDate("2026-07-03"), amountInCents: 120000},
      {...expense, date: parseLocalDate("2026-07-05"), amountInCents: 10000},
      {...expense, date: parseLocalDate("2026-07-06"), amountInCents: 20000},
      {...expense, date: parseLocalDate("2026-07-09"), amountInCents: 30000},
    ];

    const eventDaysWithTimeslice: Date[] = [
      parseLocalDate("2026-07-06"),
      parseLocalDate("2026-07-07"),
      parseLocalDate("2026-07-08"),
      parseLocalDate("2026-07-10"),
      parseLocalDate("2026-07-11"),
      parseLocalDate("2026-07-12"),
    ];

    const projectSpending = Budget.projectSpending({
      expenses: expenseMock,
      budget: budget,
      eventDays: eventDaysWithTimeslice,
      today: parseLocalDate("2026-07-10"),
    });
    expect(projectSpending).not.toBeNull();
    expect(projectSpending?.projectedAmountInCents).toEqual(205000);
    expect(projectSpending?.elapsedEventDays).toEqual(4);
    expect(projectSpending?.totalEventDays).toEqual(6);
  });
  test("Uhrzeit egal", () => {
    const expenseMock: ExpenseDomain[] = [
      {...expense, date: parseLocalDate("2026-07-03"), amountInCents: 120000},
      {...expense, date: parseLocalDate("2026-07-05"), amountInCents: 10000},
      {...expense, date: parseLocalDate("2026-07-06"), amountInCents: 20000},
    ];

    let projectSpending = Budget.projectSpending({
      expenses: expenseMock,
      budget: budget,
      eventDays: eventDaysMock,
      today: new Date(2026, 6, 7, 23, 59, 59),
    });
    expect(projectSpending).not.toBeNull();
    expect(projectSpending?.projectedAmountInCents).toEqual(190000);
    expect(projectSpending?.elapsedEventDays).toEqual(3);
    expect(projectSpending?.totalEventDays).toEqual(7);

    projectSpending = Budget.projectSpending({
      expenses: expenseMock,
      budget: budget,
      eventDays: eventDaysMock,
      today: new Date(2026, 6, 7, 0, 0, 0),
    });
    expect(projectSpending).not.toBeNull();
    expect(projectSpending?.projectedAmountInCents).toEqual(190000);
    expect(projectSpending?.elapsedEventDays).toEqual(3);
    expect(projectSpending?.totalEventDays).toEqual(7);
  });
  describe("Zeitumstellung im Anlass", () => {
    // Die Zeitumstellung (25.10.2026, 03:00 → 02:00) wirkt nur in einer
    // Zeitzone mit Sommerzeit. Jest setzt keine TZ, darum hier explizit
    // Europe/Zurich setzen und danach zurücksetzen, damit andere Tests im
    // selben Worker nicht betroffen sind.
    const originalTimeZone = process.env.TZ;
    beforeAll(() => {
      process.env.TZ = "Europe/Zurich";
    });
    afterAll(() => {
      process.env.TZ = originalTimeZone;
    });

    test("Tage über die Umstellung hinweg werden korrekt gezählt", () => {
      // Anlass 23.10.–1.11.2026 (10 Tage); der 25.10. hat 25 Stunden
      const eventDaysAcrossDst: Date[] = [
        "2026-10-23",
        "2026-10-24",
        "2026-10-25",
        "2026-10-26",
        "2026-10-27",
        "2026-10-28",
        "2026-10-29",
        "2026-10-30",
        "2026-10-31",
        "2026-11-01",
      ].map((dayKey) => parseLocalDate(dayKey));
      const expenseMock: ExpenseDomain[] = [
        {...expense, date: parseLocalDate("2026-10-24"), amountInCents: 10000},
      ];

      const projectSpending = Budget.projectSpending({
        expenses: expenseMock,
        budget: budget,
        eventDays: eventDaysAcrossDst,
        today: parseLocalDate("2026-10-27"),
      });
      expect(projectSpending).not.toBeNull();
      expect(projectSpending?.elapsedEventDays).toEqual(5);
      expect(projectSpending?.totalEventDays).toEqual(10);
      // 10000 ÷ 5 × 10
      expect(projectSpending?.projectedAmountInCents).toEqual(20000);
    });
  });
  test("Rundung laufend 1 Rappen", () => {
    const expenseMock: ExpenseDomain[] = [
      {...expense, date: parseLocalDate("2026-07-07"), amountInCents: 1},
    ];

    const projectSpending = Budget.projectSpending({
      expenses: expenseMock,
      budget: budget,
      eventDays: eventDaysMock,
      today: parseLocalDate("2026-07-07"),
    });
    expect(projectSpending).not.toBeNull();
    expect(projectSpending?.elapsedEventDays).toEqual(3);
    // 1 ÷ 3 × 7 = 2.33… → auf ganze Rappen gerundet
    expect(projectSpending?.projectedAmountInCents).toEqual(2);
    expect(Number.isInteger(projectSpending?.projectedAmountInCents)).toBe(
      true,
    );
  });
});
