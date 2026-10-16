/**
 * Unit-Tests für ExpenseStatistics (expenseStatistics.class.ts).
 *
 * Reine Funktionen der Auswertung (Story 6.2a): Währungen und Vorauswahl,
 * Filter, Summen, Durchschnitte, fehlende Belege und grösste Ausgaben.
 * Story 6.3: kumulierter Ausgabenverlauf pro Anlasstag, Soll-Linie und
 * Summe der Sollbeträge.
 */
import {ExpenseStatistics} from "../expenseStatistics.class";
import {ExpenseDomain} from "../expense.types";
import {expense} from "../__mocks__/expense.mock";
import {budget} from "../__mocks__/budget.mock";
import {BudgetDomain, BudgetType} from "../budget.types";
import {parseLocalDate} from "../../../../utils/dateUtils";

/**
 * Baut eine Test-Ausgabe auf Basis des Standard-Mocks (CHF, ohne Beleg).
 *
 * @param overrides - Felder, die vom Standard abweichen sollen.
 * @returns Vollständige Ausgabe.
 */
const createExpense = (
  overrides: Partial<ExpenseDomain> = {},
): ExpenseDomain => ({
  ...expense,
  date: parseLocalDate("2026-07-05"),
  currency: "CHF",
  attachmentPath: null,
  ...overrides,
});

describe("ExpenseStatistics.getCurrenciesInUse", () => {
  test("keine Ausgaben → leere Liste, Vorauswahl CHF", () => {
    expect(ExpenseStatistics.getCurrenciesInUse([])).toEqual({
      currencies: [],
      defaultCurrency: "CHF",
    });
  });

  test("nur CHF", () => {
    const expenses = [createExpense({id: "e1"}), createExpense({id: "e2"})];

    expect(ExpenseStatistics.getCurrenciesInUse(expenses)).toEqual({
      currencies: ["CHF"],
      defaultCurrency: "CHF",
    });
  });

  test("Anzahl entscheidet: 2 × EUR vor 1 × CHF", () => {
    const expenses = [
      createExpense({id: "e1", currency: "CHF"}),
      createExpense({id: "e2", currency: "EUR"}),
      createExpense({id: "e3", currency: "EUR"}),
    ];

    expect(ExpenseStatistics.getCurrenciesInUse(expenses)).toEqual({
      currencies: ["EUR", "CHF"],
      defaultCurrency: "EUR",
    });
  });

  test("Anzahl, nicht Betrag: 2 kleine CHF-Ausgaben schlagen 1 grosse EUR-Ausgabe", () => {
    const expenses = [
      createExpense({id: "e1", currency: "EUR", amountInCents: 100000}),
      createExpense({id: "e2", currency: "CHF", amountInCents: 1}),
      createExpense({id: "e3", currency: "CHF", amountInCents: 1}),
    ];

    expect(ExpenseStatistics.getCurrenciesInUse(expenses).defaultCurrency).toBe(
      "CHF",
    );
  });

  // `sort` ist stabil: Ohne CHF-Regel bliebe bei Gleichstand die
  // Eingabereihenfolge. Nur beide Reihenfolgen zusammen beweisen die Regel.
  test("Gleichstand EUR/CHF → CHF zuerst (EUR in der Eingabe vorne)", () => {
    const expenses = [
      createExpense({id: "e1", currency: "EUR"}),
      createExpense({id: "e2", currency: "CHF"}),
    ];

    expect(ExpenseStatistics.getCurrenciesInUse(expenses)).toEqual({
      currencies: ["CHF", "EUR"],
      defaultCurrency: "CHF",
    });
  });

  test("Gleichstand EUR/CHF → CHF zuerst (CHF in der Eingabe vorne)", () => {
    const expenses = [
      createExpense({id: "e1", currency: "CHF"}),
      createExpense({id: "e2", currency: "EUR"}),
    ];

    expect(ExpenseStatistics.getCurrenciesInUse(expenses)).toEqual({
      currencies: ["CHF", "EUR"],
      defaultCurrency: "CHF",
    });
  });

  // Gegen EUR gewinnt CHF auch alphabetisch. Nur eine Währung, die
  // alphabetisch vor CHF liegt (CAD), beweist die CHF-Regel wirklich.
  test("Gleichstand CAD/CHF → CHF zuerst, obwohl CAD alphabetisch vorne liegt", () => {
    const expenses = [
      createExpense({id: "e1", currency: "CAD"}),
      createExpense({id: "e2", currency: "CHF"}),
    ];

    expect(ExpenseStatistics.getCurrenciesInUse(expenses)).toEqual({
      currencies: ["CHF", "CAD"],
      defaultCurrency: "CHF",
    });
  });

  test("Gleichstand ohne CHF → alphabetisch", () => {
    const expenses = [
      createExpense({id: "e1", currency: "USD"}),
      createExpense({id: "e2", currency: "EUR"}),
    ];

    expect(ExpenseStatistics.getCurrenciesInUse(expenses)).toEqual({
      currencies: ["EUR", "USD"],
      defaultCurrency: "EUR",
    });
  });

  test("mehrere Regeln: Anzahl zuerst, danach alphabetisch", () => {
    const expenses = [
      createExpense({id: "e1", currency: "USD"}),
      createExpense({id: "e2", currency: "CHF"}),
      createExpense({id: "e3", currency: "EUR"}),
      createExpense({id: "e4", currency: "CHF"}),
    ];

    expect(ExpenseStatistics.getCurrenciesInUse(expenses).currencies).toEqual([
      "CHF",
      "EUR",
      "USD",
    ]);
  });
});

describe("ExpenseStatistics.filterByCurrency", () => {
  test("liefert nur Ausgaben der gewählten Währung", () => {
    const chfExpense = createExpense({id: "e1", currency: "CHF"});
    const eurExpense = createExpense({id: "e2", currency: "EUR"});

    expect(
      ExpenseStatistics.filterByCurrency([chfExpense, eurExpense], "EUR"),
    ).toEqual([eurExpense]);
  });

  test("leere Liste → leere Liste", () => {
    expect(ExpenseStatistics.filterByCurrency([], "CHF")).toEqual([]);
  });
});

describe("ExpenseStatistics.sumAmountInCents", () => {
  test("summiert alle Beträge", () => {
    const expenses = [
      createExpense({id: "e1", amountInCents: 1050}),
      createExpense({id: "e2", amountInCents: 2000}),
    ];

    expect(ExpenseStatistics.sumAmountInCents(expenses)).toBe(3050);
  });

  test("leere Liste → 0", () => {
    expect(ExpenseStatistics.sumAmountInCents([])).toBe(0);
  });
});

describe("ExpenseStatistics.averagePerParticipant", () => {
  test("teilt die Summe durch die Teilnehmenden", () => {
    expect(ExpenseStatistics.averagePerParticipant(240000, 24)).toBe(10000);
  });

  test("rundet auf ganze Rappen (ab)", () => {
    expect(ExpenseStatistics.averagePerParticipant(1000, 3)).toBe(333);
  });

  test("rundet auf ganze Rappen (auf)", () => {
    expect(ExpenseStatistics.averagePerParticipant(2000, 3)).toBe(667);
  });

  test("0 Teilnehmende → null statt Infinity", () => {
    expect(ExpenseStatistics.averagePerParticipant(240000, 0)).toBeNull();
  });

  test("Summe 0 → 0 (gültige Aussage, nicht null)", () => {
    expect(ExpenseStatistics.averagePerParticipant(0, 10)).toBe(0);
  });
});

describe("ExpenseStatistics.averagePerParticipantAndDay", () => {
  test("teilt durch Teilnehmende und alle Anlasstage", () => {
    expect(ExpenseStatistics.averagePerParticipantAndDay(168000, 24, 7)).toBe(
      1000,
    );
  });

  test("rundet erst am Schluss", () => {
    // 100000 / 3 / 3 = 11111.1 → 11111. Zwischenrunden ergäbe dasselbe nur zufällig,
    // darum zusätzlich ein Fall, bei dem es abweicht: 5 / 2 / 2 = 1.25 → 1,
    // zwischengerundet wäre Math.round(Math.round(2.5) / 2) = Math.round(1.5) = 2.
    expect(ExpenseStatistics.averagePerParticipantAndDay(100000, 3, 3)).toBe(
      11111,
    );
    expect(ExpenseStatistics.averagePerParticipantAndDay(5, 2, 2)).toBe(1);
  });

  test("0 Teilnehmende → null", () => {
    expect(
      ExpenseStatistics.averagePerParticipantAndDay(168000, 0, 7),
    ).toBeNull();
  });

  test("0 Anlasstage → null", () => {
    expect(
      ExpenseStatistics.averagePerParticipantAndDay(168000, 24, 0),
    ).toBeNull();
  });
});

describe("ExpenseStatistics.countWithoutAttachment", () => {
  test("zählt nur Ausgaben ohne Beleg", () => {
    const expenses = [
      createExpense({id: "e1", attachmentPath: null}),
      createExpense({id: "e2", attachmentPath: "evt/expenses/e2.pdf"}),
      createExpense({id: "e3", attachmentPath: null}),
    ];

    expect(ExpenseStatistics.countWithoutAttachment(expenses)).toBe(2);
  });

  test("zählt über alle Währungen", () => {
    const expenses = [
      createExpense({id: "e1", currency: "CHF"}),
      createExpense({id: "e2", currency: "EUR"}),
    ];

    expect(ExpenseStatistics.countWithoutAttachment(expenses)).toBe(2);
  });

  test("leere Liste → 0", () => {
    expect(ExpenseStatistics.countWithoutAttachment([])).toBe(0);
  });
});

describe("ExpenseStatistics.topExpenses", () => {
  test("liefert höchstens 5, absteigend nach Betrag", () => {
    const expenses = [100, 700, 300, 500, 200, 600, 400].map(
      (amountInCents, index) => createExpense({id: `e${index}`, amountInCents}),
    );

    const result = ExpenseStatistics.topExpenses(expenses);

    expect(result.map((topExpense) => topExpense.amountInCents)).toEqual([
      700, 600, 500, 400, 300,
    ]);
  });

  test("weniger als 5 Ausgaben → alle", () => {
    const expenses = [
      createExpense({id: "e1", amountInCents: 100}),
      createExpense({id: "e2", amountInCents: 300}),
      createExpense({id: "e3", amountInCents: 200}),
    ];

    expect(ExpenseStatistics.topExpenses(expenses)).toHaveLength(3);
  });

  test("eigenes Limit", () => {
    const expenses = [
      createExpense({id: "e1", amountInCents: 100}),
      createExpense({id: "e2", amountInCents: 300}),
      createExpense({id: "e3", amountInCents: 200}),
    ];

    expect(
      ExpenseStatistics.topExpenses(expenses, 2).map(
        (topExpense) => topExpense.id,
      ),
    ).toEqual(["e2", "e3"]);
  });

  test("gleicher Betrag → neueres Datum zuerst", () => {
    const olderExpense = createExpense({
      id: "older",
      amountInCents: 500,
      date: parseLocalDate("2026-07-05"),
    });
    const newerExpense = createExpense({
      id: "newer",
      amountInCents: 500,
      date: parseLocalDate("2026-07-07"),
    });

    expect(
      ExpenseStatistics.topExpenses([olderExpense, newerExpense]).map(
        (topExpense) => topExpense.id,
      ),
    ).toEqual(["newer", "older"]);
  });

  test("gleicher Betrag und Datum → alphabetisch nach Bezeichnung", () => {
    const expenses = [
      createExpense({id: "e1", amountInCents: 500, label: "Volg"}),
      createExpense({id: "e2", amountInCents: 500, label: "Coop"}),
      createExpense({id: "e3", amountInCents: 500, label: "Migros"}),
    ];

    expect(
      ExpenseStatistics.topExpenses(expenses).map(
        (topExpense) => topExpense.label,
      ),
    ).toEqual(["Coop", "Migros", "Volg"]);
  });

  test("verändert die Eingabe nicht", () => {
    const expenses = [
      createExpense({id: "e1", amountInCents: 100}),
      createExpense({id: "e2", amountInCents: 300}),
      createExpense({id: "e3", amountInCents: 200}),
    ];
    const orderBefore = expenses.map((originalExpense) => originalExpense.id);

    ExpenseStatistics.topExpenses(expenses);

    expect(expenses.map((originalExpense) => originalExpense.id)).toEqual(
      orderBefore,
    );
  });
});

describe("ExpenseStatistics.excludeBudgets", () => {
  const kitchenExpense = createExpense({id: "e1", budgetId: "budget-kitchen"});
  const materialExpense = createExpense({
    id: "e2",
    budgetId: "budget-material",
  });

  test("keine ausgeschlossenen Budgets → alle Ausgaben", () => {
    expect(
      ExpenseStatistics.excludeBudgets([kitchenExpense, materialExpense], []),
    ).toEqual([kitchenExpense, materialExpense]);
  });

  test("ausgeschlossenes Budget fehlt, Rest bleibt", () => {
    expect(
      ExpenseStatistics.excludeBudgets(
        [kitchenExpense, materialExpense],
        ["budget-material"],
      ),
    ).toEqual([kitchenExpense]);
  });

  test("unbekannte ID (gelöschtes Budget) → keine Wirkung", () => {
    expect(
      ExpenseStatistics.excludeBudgets(
        [kitchenExpense, materialExpense],
        ["budget-deleted"],
      ),
    ).toEqual([kitchenExpense, materialExpense]);
  });
});

/**
 * Wandelt `YYYY-MM-DD`-Schlüssel in Anlasstage (lokale Mitternacht, wie
 * `getEventDateList`).
 *
 * @param dayKeys - Tage als `YYYY-MM-DD`, aufsteigend.
 * @returns Anlasstage als `Date`.
 */
const toEventDays = (dayKeys: string[]): Date[] =>
  dayKeys.map((dayKey) => parseLocalDate(dayKey));

/** Anlass mit 7 Tagen, 5.–11. Juli 2026. */
const SEVEN_EVENT_DAYS = toEventDays([
  "2026-07-05",
  "2026-07-06",
  "2026-07-07",
  "2026-07-08",
  "2026-07-09",
  "2026-07-10",
  "2026-07-11",
]);

/** Anlass aus zwei Zeitscheiben (6.–8.7. und 10.–12.7.), der 9.7. ist eine Lücke. */
const TWO_TIMESLICE_EVENT_DAYS = toEventDays([
  "2026-07-06",
  "2026-07-07",
  "2026-07-08",
  "2026-07-10",
  "2026-07-11",
  "2026-07-12",
]);

describe("ExpenseStatistics.cumulativeByEventDay", () => {
  /**
   * Ruft die Funktion mit dem 7-Tage-Anlass auf.
   *
   * @param expenses - Ausgaben einer Währung.
   * @param todayKey - Stichtag als `YYYY-MM-DD`.
   * @returns Kumulierte Werte pro Anlasstag.
   */
  const cumulate = (expenses: ExpenseDomain[], todayKey: string) =>
    ExpenseStatistics.cumulativeByEventDay({
      expenses,
      eventDays: SEVEN_EVENT_DAYS,
      today: parseLocalDate(todayKey),
    });

  test("keine Anlasstage → leere Liste", () => {
    expect(
      ExpenseStatistics.cumulativeByEventDay({
        expenses: [createExpense({id: "e1"})],
        eventDays: [],
        today: parseLocalDate("2026-07-07"),
      }),
    ).toEqual([]);
  });

  test("keine Ausgaben → 0 bis heute, danach null", () => {
    expect(cumulate([], "2026-07-07")).toEqual([
      0,
      0,
      0,
      null,
      null,
      null,
      null,
    ]);
  });

  test("Ausgaben werden pro Tag aufsummiert", () => {
    const expenses = [
      createExpense({id: "e1", date: parseLocalDate("2026-07-05"), amountInCents: 1000}),
      createExpense({id: "e2", date: parseLocalDate("2026-07-07"), amountInCents: 2000}),
    ];

    expect(cumulate(expenses, "2026-07-07")).toEqual([
      1000,
      1000,
      3000,
      null,
      null,
      null,
      null,
    ]);
  });

  test("Ausgabe vor dem Anlass (Grosseinkauf) zählt an Tag 1", () => {
    const expenses = [
      createExpense({id: "e1", date: parseLocalDate("2026-07-03"), amountInCents: 120000}),
    ];

    expect(cumulate(expenses, "2026-07-07").slice(0, 3)).toEqual([
      120000, 120000, 120000,
    ]);
  });

  test("Ausgabe in einer Lücke zwischen Zeitscheiben zählt am nächsten Anlasstag", () => {
    const actualValues = ExpenseStatistics.cumulativeByEventDay({
      expenses: [
        createExpense({id: "e1", date: parseLocalDate("2026-07-09"), amountInCents: 500}),
      ],
      eventDays: TWO_TIMESLICE_EVENT_DAYS,
      today: parseLocalDate("2026-07-12"),
    });

    // 6., 7., 8. Juli ohne Ausgabe, ab 10. Juli (Index 3) mit
    expect(actualValues).toEqual([0, 0, 0, 500, 500, 500]);
  });

  test("Ausgabe nach dem Anlass zählt am letzten Anlasstag; nach dem Anlass kein null", () => {
    const expenses = [
      createExpense({id: "e1", date: parseLocalDate("2026-07-13"), amountInCents: 700}),
    ];

    expect(cumulate(expenses, "2026-07-13")).toEqual([0, 0, 0, 0, 0, 0, 700]);
  });

  test("vorausdatierte Ausgabe zählt heute (O1)", () => {
    const expenses = [
      createExpense({id: "e1", date: parseLocalDate("2026-07-10"), amountInCents: 900}),
    ];

    expect(cumulate(expenses, "2026-07-07")).toEqual([
      0,
      0,
      900,
      null,
      null,
      null,
      null,
    ]);
  });

  test("letzter Wert entspricht der Summe aller Ausgaben (Invariante)", () => {
    const expenses = [
      createExpense({id: "before", date: parseLocalDate("2026-07-01"), amountInCents: 100000}),
      createExpense({id: "gap", date: parseLocalDate("2026-07-09"), amountInCents: 2500}),
      createExpense({id: "after", date: parseLocalDate("2026-07-20"), amountInCents: 1300}),
      createExpense({id: "today", date: parseLocalDate("2026-07-10"), amountInCents: 4200}),
    ];

    const actualValues = ExpenseStatistics.cumulativeByEventDay({
      expenses,
      eventDays: TWO_TIMESLICE_EVENT_DAYS,
      today: parseLocalDate("2026-07-10"),
    });
    const lastActualValue = actualValues.filter((value) => value !== null).pop();

    expect(lastActualValue).toEqual(
      ExpenseStatistics.sumAmountInCents(expenses),
    );
  });

  test("heute vor dem Anlass → nur null", () => {
    const expenses = [
      createExpense({id: "e1", date: parseLocalDate("2026-07-03"), amountInCents: 120000}),
    ];

    expect(cumulate(expenses, "2026-07-04")).toEqual(
      new Array(7).fill(null),
    );
  });

  test("heute in der Lücke zwischen Zeitscheiben → Werte bis zum letzten vergangenen Anlasstag", () => {
    const actualValues = ExpenseStatistics.cumulativeByEventDay({
      expenses: [
        createExpense({id: "e1", date: parseLocalDate("2026-07-07"), amountInCents: 300}),
      ],
      eventDays: TWO_TIMESLICE_EVENT_DAYS,
      today: parseLocalDate("2026-07-09"),
    });

    expect(actualValues).toEqual([0, 300, 300, null, null, null]);
  });

  test("Uhrzeit von heute spielt keine Rolle", () => {
    const expenses = [createExpense({id: "e1", amountInCents: 1000})];
    const atMidnight = ExpenseStatistics.cumulativeByEventDay({
      expenses,
      eventDays: SEVEN_EVENT_DAYS,
      today: new Date(2026, 6, 7, 0, 0),
    });
    const beforeMidnight = ExpenseStatistics.cumulativeByEventDay({
      expenses,
      eventDays: SEVEN_EVENT_DAYS,
      today: new Date(2026, 6, 7, 23, 59),
    });

    expect(beforeMidnight).toEqual(atMidnight);
  });

  test("Eingabe bleibt unverändert", () => {
    const expenses = [
      createExpense({id: "e2", date: parseLocalDate("2026-07-06")}),
      createExpense({id: "e1", date: parseLocalDate("2026-07-05")}),
    ];
    // keine structuredClone: Der Jest-Polyfill (JSON) macht aus Date einen String
    const expensesBefore = expenses.map((expense) => ({
      ...expense,
      date: new Date(expense.date),
    }));

    cumulate(expenses, "2026-07-07");

    expect(expenses).toEqual(expensesBefore);
  });

  describe("Zeitumstellung im Anlass", () => {
    // Wie in budget.class.test.ts: Die Umstellung (25.10.2026) wirkt nur in
    // einer Zeitzone mit Sommerzeit, darum Europe/Zurich setzen und zurücksetzen.
    const originalTimeZone = process.env.TZ;
    beforeAll(() => {
      process.env.TZ = "Europe/Zurich";
    });
    afterAll(() => {
      process.env.TZ = originalTimeZone;
    });

    test("Tage über die Umstellung hinweg: genau 5 Werte bis heute", () => {
      const eventDaysAcrossDst = toEventDays([
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
      ]);

      const actualValues = ExpenseStatistics.cumulativeByEventDay({
        expenses: [
          createExpense({id: "e1", date: parseLocalDate("2026-10-26"), amountInCents: 800}),
        ],
        eventDays: eventDaysAcrossDst,
        today: parseLocalDate("2026-10-27"),
      });

      expect(actualValues.filter((value) => value !== null)).toEqual([
        0, 0, 0, 800, 800,
      ]);
    });
  });
});

describe("ExpenseStatistics.targetLineByEventDay", () => {
  test("Soll linear verteilt, letzter Wert = Soll", () => {
    expect(ExpenseStatistics.targetLineByEventDay(7000, 7)).toEqual([
      1000, 2000, 3000, 4000, 5000, 6000, 7000,
    ]);
  });

  test("gerundet auf ganze Rappen, ohne Rundungsrest am letzten Tag", () => {
    expect(ExpenseStatistics.targetLineByEventDay(1000, 3)).toEqual([
      333, 667, 1000,
    ]);
  });

  test("0 Anlasstage → leere Liste", () => {
    expect(ExpenseStatistics.targetLineByEventDay(7000, 0)).toEqual([]);
  });
});

describe("ExpenseStatistics.sumTargetAmountInCents", () => {
  const kitchenBudget: BudgetDomain = {
    ...budget,
    id: "budget-kitchen",
    budgetType: BudgetType.FIXED_AMOUNT,
    amountInCents: 50000,
    currency: "CHF",
  };
  const foodBudget: BudgetDomain = {
    ...budget,
    id: "budget-food",
    budgetType: BudgetType.PER_PERSON_PER_DAY,
    amountInCents: 1000,
    currency: "CHF",
  };
  const euroBudget: BudgetDomain = {
    ...budget,
    id: "budget-euro",
    budgetType: BudgetType.FIXED_AMOUNT,
    amountInCents: 30000,
    currency: "EUR",
  };

  /**
   * Ruft die Funktion mit 24 Personen und 7 Anlasstagen auf.
   *
   * @param budgets - Budgets des Anlasses.
   * @param excludedBudgetIds - Abgewählte Budget-IDs.
   * @param currency - Gewählte Währung.
   * @returns Summe der Sollbeträge in Rappen.
   */
  const sumTargets = (
    budgets: BudgetDomain[],
    excludedBudgetIds: string[] = [],
    currency = "CHF",
  ) =>
    ExpenseStatistics.sumTargetAmountInCents({
      budgets,
      excludedBudgetIds,
      currency,
      participantCount: 24,
      eventDayCount: 7,
    });

  test("fix + pro Person & Tag werden summiert", () => {
    // 50000 + 1000 × 24 × 7
    expect(sumTargets([kitchenBudget, foodBudget])).toEqual(218000);
  });

  test("abgewähltes Budget fehlt", () => {
    expect(sumTargets([kitchenBudget, foodBudget], [foodBudget.id])).toEqual(
      50000,
    );
  });

  test("Budget in anderer Währung fehlt", () => {
    expect(sumTargets([kitchenBudget, euroBudget])).toEqual(50000);
    expect(sumTargets([kitchenBudget, euroBudget], [], "EUR")).toEqual(30000);
  });

  test("Budget ohne Sollbetrag zählt 0", () => {
    expect(
      sumTargets([kitchenBudget, {...foodBudget, amountInCents: null}]),
    ).toEqual(50000);
  });

  test("keine Budgets → 0", () => {
    expect(sumTargets([])).toEqual(0);
  });
});
