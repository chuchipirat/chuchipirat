/**
 * Unit-Tests für ExpenseStatistics (expenseStatistics.class.ts).
 *
 * Reine Funktionen der Auswertung (Story 6.2a): Währungen und Vorauswahl,
 * Filter, Summen, Durchschnitte, fehlende Belege und grösste Ausgaben.
 */
import {ExpenseStatistics} from "../expenseStatistics.class";
import {ExpenseDomain} from "../expense.types";
import {expense} from "../__mocks__/expense.mock";
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
