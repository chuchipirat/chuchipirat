/**
 * Unit-Tests für die Datenaufbereitung der PDF-Abrechnung
 * (expenseReport.class.ts, Story 7.1).
 *
 * Fixture: drei Budgets (Küche, Motto, Material), die Köch:innen Anna
 * (= angemeldet) und Ben, die neue Person «Lagerleitung», eine Ausgabe ohne
 * Rückerstattung und eine Ausgabe in EUR. Die Eingabe ist absichtlich nicht
 * sortiert (Ben zuerst, Motto vor Küche), damit Sortierfehler auffallen.
 */
import {ExpenseReport} from "../expenseReport.class";
import {
  ExpenseReportData,
  ReportMode,
  ReportOptions,
  ReportPayeeSection,
} from "../expenseReport.types";
import {
  ExpenseDomain,
  ExpensePayeeType,
  NO_REFUND_PAYEE_KEY,
} from "../../Expense/expense.types";
import {BudgetDomain, BudgetIcon, BudgetType} from "../../Budget/budget.types";
import {Cook} from "../../../Event/event.class";
import {
  FORMER_EVENT_COOK as TEXT_FORMER_EVENT_COOK,
  REPORT_NO_REFUND_GROUP as TEXT_REPORT_NO_REFUND_GROUP,
  REPORT_UNKNOWN_BUDGET as TEXT_REPORT_UNKNOWN_BUDGET,
} from "../../../../../constants/text/expenseTracking";

/* =====================================================================
// Fixture
// ===================================================================== */

/**
 * Erstellt ein Budget mit Standardwerten.
 *
 * @param id - ID des Budgets.
 * @param name - Name des Budgets.
 * @returns Das Budget.
 */
const makeBudget = (id: string, name: string): BudgetDomain => ({
  id,
  eventId: "event-id-001",
  name,
  budgetType: BudgetType.FIXED_AMOUNT,
  amountInCents: 100000,
  currency: "CHF",
  icon: BudgetIcon.KITCHEN,
});

/** Budgets in Anzeigereihenfolge. */
const BUDGETS: BudgetDomain[] = [
  makeBudget("budget-kitchen", "Küche"),
  makeBudget("budget-theme", "Motto"),
  makeBudget("budget-material", "Material"),
];

const ANNA: Cook = {
  uid: "user-anna",
  displayName: "Anna",
  motto: "",
  pictureSrc: "",
};
const BEN: Cook = {
  uid: "user-ben",
  displayName: "Ben",
  motto: "",
  pictureSrc: "",
};
const COOKS: Cook[] = [ANNA, BEN];

/**
 * Erstellt eine Ausgabe einer Köchin mit Standardwerten.
 *
 * @param overrides - Felder, die vom Standard abweichen.
 * @returns Die Ausgabe.
 */
const makeExpense = (overrides: Partial<ExpenseDomain>): ExpenseDomain => ({
  id: "expense-id",
  eventId: "event-id-001",
  budgetId: "budget-kitchen",
  date: new Date(2026, 6, 10),
  amountInCents: 1000,
  currency: "CHF",
  label: "Einkauf",
  comment: null,
  payeeType: ExpensePayeeType.EXISTING_USER,
  payeeUserId: ANNA.uid,
  payeeName: null,
  attachmentPath: null,
  attachmentOriginalFilename: null,
  ...overrides,
});

/**
 * Felder für eine Ausgabe der neuen Person mit dem angegebenen Namen.
 *
 * @param payeeName - Erfasster Name.
 * @returns Payee-Felder für `makeExpense`.
 */
const newPerson = (payeeName: string): Partial<ExpenseDomain> => ({
  payeeType: ExpensePayeeType.NEW_PERSON,
  payeeUserId: null,
  payeeName,
});

const NO_REFUND: Partial<ExpenseDomain> = {
  payeeType: ExpensePayeeType.NO_REFUND_NEEDED,
  payeeUserId: null,
  payeeName: null,
};

// Ben
const BEN_VOLG = makeExpense({
  id: "ben-volg",
  payeeUserId: BEN.uid,
  budgetId: "budget-kitchen",
  date: new Date(2026, 6, 11),
  label: "Volg",
  amountInCents: 1000,
});
const BEN_HORNBACH = makeExpense({
  id: "ben-hornbach",
  payeeUserId: BEN.uid,
  budgetId: "budget-material",
  date: new Date(2026, 6, 9),
  label: "Hornbach",
  amountInCents: 3000,
  attachmentPath: "events/event-id-001/expenses/ben-hornbach.jpg",
});
// Anna (Motto vor Küche in der Eingabe)
const ANNA_CRAFT_SHOP = makeExpense({
  id: "anna-craft-shop",
  budgetId: "budget-theme",
  date: new Date(2026, 6, 8),
  label: "Bastelladen",
  amountInCents: 2500,
  comment: "Für das Mottospiel",
});
const ANNA_MIGROS = makeExpense({
  id: "anna-migros",
  budgetId: "budget-kitchen",
  date: new Date(2026, 6, 10),
  label: "Migros",
  amountInCents: 4000,
  attachmentPath: "events/event-id-001/expenses/anna-migros.jpg",
});
const ANNA_BAKERY_EUR = makeExpense({
  id: "anna-bakery-eur",
  budgetId: "budget-kitchen",
  date: new Date(2026, 6, 12),
  label: "Bäckerei",
  amountInCents: 1500,
  currency: "EUR",
  attachmentPath: "events/event-id-001/expenses/anna-bakery.pdf",
});
// neue Person und ohne Rückerstattung
const CAMP_LEAD_BUTCHER = makeExpense({
  id: "camp-lead-butcher",
  ...newPerson("Lagerleitung"),
  date: new Date(2026, 6, 9),
  label: "Metzgerei",
  amountInCents: 5000,
  attachmentPath: "events/event-id-001/expenses/camp-lead-butcher.jpg",
});
const NO_REFUND_DONATION = makeExpense({
  id: "no-refund-donation",
  ...NO_REFUND,
  budgetId: "budget-theme",
  date: new Date(2026, 6, 10),
  label: "Spende Bauernhof",
  amountInCents: 2000,
});

/** Alle Ausgaben, absichtlich unsortiert. */
const EXPENSES: ExpenseDomain[] = [
  NO_REFUND_DONATION,
  BEN_VOLG,
  BEN_HORNBACH,
  ANNA_CRAFT_SHOP,
  CAMP_LEAD_BUTCHER,
  ANNA_MIGROS,
  ANNA_BAKERY_EUR,
];

const DEFAULT_OPTIONS: ReportOptions = {
  mode: ReportMode.PER_PERSON,
  payeeSelection: {kind: "all"},
  includeComments: true,
  includeMissingReceiptPages: false,
};

/**
 * Baut die Abrechnung mit der Fixture.
 *
 * @param options - Optionen, die vom Standard abweichen.
 * @param expenses - Ausgaben, Standard: die ganze Fixture.
 * @returns Die Abrechnung.
 */
const buildReport = (
  options: Partial<ReportOptions> = {},
  expenses: ExpenseDomain[] = EXPENSES,
): ExpenseReportData =>
  ExpenseReport.build({
    expenses,
    budgets: BUDGETS,
    cooks: COOKS,
    options: {...DEFAULT_OPTIONS, ...options},
  });

/**
 * Liefert die Ausgaben-IDs einer Sektion in Tabellenreihenfolge.
 *
 * @param section - Sektion einer Person.
 * @returns IDs über alle Gruppen.
 */
const rowIdsOf = (section: ReportPayeeSection): string[] =>
  section.groups.flatMap((group) => group.rows.map((row) => row.expenseId));

/**
 * Liefert die Belegnummern aller Zeilen in Dokumentreihenfolge.
 *
 * @param report - Die Abrechnung.
 * @returns Paare [Ausgaben-ID, Belegnummer].
 */
const receiptNumbersOf = (
  report: ExpenseReportData,
): [string, number | null][] =>
  report.sections.flatMap((section) =>
    section.groups.flatMap((group) =>
      group.rows.map((row): [string, number | null] => [
        row.expenseId,
        row.receiptNumber,
      ]),
    ),
  );

/* =====================================================================
// build
// ===================================================================== */

describe("ExpenseReport.build, eine Person, Modus A", () => {
  const report = buildReport({
    payeeSelection: {kind: "single", payeeKey: ANNA.uid},
  });

  test("nur die Ausgaben der Person, in einer Gruppe ohne Titel", () => {
    expect(report.sections).toHaveLength(1);
    expect(report.sections[0].payeeKey).toEqual(ANNA.uid);
    expect(report.sections[0].displayName).toEqual("Anna");
    expect(report.sections[0].payeeUserId).toEqual(ANNA.uid);
    expect(report.sections[0].isNoRefund).toBe(false);
    expect(report.sections[0].groups).toHaveLength(1);
    expect(report.sections[0].groups[0].budgetName).toBeNull();
  });

  test("Zeilen nach Datum aufsteigend, mit Budgetname je Zeile", () => {
    const rows = report.sections[0].groups[0].rows;

    expect(rows.map((row) => row.expenseId)).toEqual([
      "anna-craft-shop",
      "anna-migros",
      "anna-bakery-eur",
    ]);
    expect(rows.map((row) => row.budgetName)).toEqual([
      "Motto",
      "Küche",
      "Küche",
    ]);
  });

  test("Summen pro Währung, CHF vor EUR", () => {
    const expectedTotals = [
      {currency: "CHF", amountInCents: 6500},
      {currency: "EUR", amountInCents: 1500},
    ];

    expect(report.sections[0].totals).toEqual(expectedTotals);
    expect(report.sections[0].groups[0].totals).toEqual(expectedTotals);
  });

  test("ohne Gesamttotale bei einer Person", () => {
    expect(report.grandTotals).toBeNull();
    expect(report.refundTotals).toBeNull();
  });

  test("neue Person über ihren Namen auswählbar", () => {
    const campLeadReport = buildReport({
      payeeSelection: {kind: "single", payeeKey: "Lagerleitung"},
    });

    expect(campLeadReport.sections).toHaveLength(1);
    expect(campLeadReport.sections[0].displayName).toEqual("Lagerleitung");
    expect(campLeadReport.sections[0].payeeUserId).toBeNull();
    expect(rowIdsOf(campLeadReport.sections[0])).toEqual(["camp-lead-butcher"]);
  });
});

describe("ExpenseReport.build, Modus B", () => {
  const report = buildReport({
    mode: ReportMode.PER_PERSON_AND_BUDGET,
    payeeSelection: {kind: "single", payeeKey: ANNA.uid},
  });
  const groups = report.sections[0].groups;

  test("eine Gruppe pro Budget in Budget-Reihenfolge, ohne leere Budgets", () => {
    // Motto kommt in der Eingabe zuerst, Material hat keine Ausgabe von Anna
    expect(groups.map((group) => group.budgetName)).toEqual(["Küche", "Motto"]);
  });

  test("Zeilen innerhalb einer Gruppe nach Datum sortiert", () => {
    expect(groups[0].rows.map((row) => row.expenseId)).toEqual([
      "anna-migros",
      "anna-bakery-eur",
    ]);
  });

  test("Zwischensummen pro Budget, Personentotal = Summe der Gruppen", () => {
    expect(groups[0].totals).toEqual([
      {currency: "CHF", amountInCents: 4000},
      {currency: "EUR", amountInCents: 1500},
    ]);
    expect(groups[1].totals).toEqual([{currency: "CHF", amountInCents: 2500}]);
    expect(report.sections[0].totals).toEqual([
      {currency: "CHF", amountInCents: 6500},
      {currency: "EUR", amountInCents: 1500},
    ]);
  });
});

describe("ExpenseReport.build, Belegnummern", () => {
  test("laufen über das ganze Dokument, ohne Beleg keine Nummer", () => {
    const report = buildReport();

    expect(receiptNumbersOf(report)).toEqual([
      ["anna-craft-shop", null],
      ["anna-migros", 1],
      ["anna-bakery-eur", 2],
      ["ben-hornbach", 3],
      ["ben-volg", null],
      ["camp-lead-butcher", 4],
      ["no-refund-donation", null],
    ]);
  });

  test("receipts in Nummernreihenfolge, eine Seite pro Nummer", () => {
    const report = buildReport();

    expect(report.receipts.map((receipt) => receipt.receiptNumber)).toEqual([
      1, 2, 3, 4,
    ]);
    expect(report.receipts[0]).toEqual({
      receiptNumber: 1,
      expenseId: "anna-migros",
      attachmentPath: ANNA_MIGROS.attachmentPath,
      date: ANNA_MIGROS.date,
      label: "Migros",
      amountInCents: 4000,
      currency: "CHF",
    });
  });

  test("mit Leerseiten: alle Zeilen nummeriert, Leerseite an der richtigen Stelle", () => {
    const report = buildReport({includeMissingReceiptPages: true});

    expect(receiptNumbersOf(report)).toEqual([
      ["anna-craft-shop", 1],
      ["anna-migros", 2],
      ["anna-bakery-eur", 3],
      ["ben-hornbach", 4],
      ["ben-volg", 5],
      ["camp-lead-butcher", 6],
      ["no-refund-donation", 7],
    ]);
    expect(report.receipts).toHaveLength(7);
    expect(
      report.receipts
        .filter((receipt) => receipt.attachmentPath === null)
        .map((receipt) => receipt.receiptNumber),
    ).toEqual([1, 5, 7]);
  });

  test("Modus B: Nummern folgen der Budget-Reihenfolge", () => {
    const report = buildReport({
      mode: ReportMode.PER_PERSON_AND_BUDGET,
      payeeSelection: {kind: "single", payeeKey: ANNA.uid},
      includeMissingReceiptPages: true,
    });

    // Küche (Migros, Bäckerei) vor Motto (Bastelladen), trotz früherem Datum
    expect(receiptNumbersOf(report)).toEqual([
      ["anna-migros", 1],
      ["anna-bakery-eur", 2],
      ["anna-craft-shop", 3],
    ]);
  });

  test("gleiches Datum: nach Bezeichnung, dann nach ID", () => {
    const sameDay = new Date(2026, 6, 10);
    const expenses = [
      makeExpense({id: "id-b", date: sameDay, label: "Zucker"}),
      makeExpense({id: "id-c", date: sameDay, label: "Apfel"}),
      makeExpense({id: "id-a", date: sameDay, label: "Zucker"}),
    ].map((expense) => ({...expense, attachmentPath: `${expense.id}.jpg`}));

    const report = buildReport({}, expenses);

    expect(receiptNumbersOf(report)).toEqual([
      ["id-c", 1],
      ["id-a", 2],
      ["id-b", 3],
    ]);
  });
});

describe("ExpenseReport.build, Alle Personen", () => {
  const report = buildReport();

  test("Personen alphabetisch, «Ohne Rückerstattung» zuletzt", () => {
    expect(report.sections.map((section) => section.displayName)).toEqual([
      "Anna",
      "Ben",
      "Lagerleitung",
      TEXT_REPORT_NO_REFUND_GROUP,
    ]);
    expect(report.sections[3].payeeKey).toEqual(NO_REFUND_PAYEE_KEY);
    expect(report.sections[3].isNoRefund).toBe(true);
  });

  test("«Ohne Rückerstattung» zuletzt, auch vor Namen nach «O» im Alphabet", () => {
    const expenses = [
      makeExpense({id: "tent", ...newPerson("Zeltchef")}),
      NO_REFUND_DONATION,
    ];

    expect(
      buildReport({}, expenses).sections.map((section) => section.displayName),
    ).toEqual(["Zeltchef", TEXT_REPORT_NO_REFUND_GROUP]);
  });

  test("Gesamttotal mit, «davon zurückzuerstatten» ohne die Gruppe", () => {
    expect(report.grandTotals).toEqual([
      {currency: "CHF", amountInCents: 17500},
      {currency: "EUR", amountInCents: 1500},
    ]);
    // 17500 minus die Spende (2000) ohne Rückerstattung
    expect(report.refundTotals).toEqual([
      {currency: "CHF", amountInCents: 15500},
      {currency: "EUR", amountInCents: 1500},
    ]);
  });

  test("neue Personen: gleicher Name eine Sektion, andere Schreibweise zwei", () => {
    const expenses = [
      makeExpense({id: "lead-1", ...newPerson("Lagerleitung")}),
      makeExpense({id: "lead-2", ...newPerson("Lagerleitung")}),
      makeExpense({id: "lead-3", ...newPerson("lagerleitung")}),
    ];

    const sections = buildReport({}, expenses).sections;

    expect(sections).toHaveLength(2);
    expect(
      sections.map((section) => [section.displayName, rowIdsOf(section)]),
    ).toEqual(
      expect.arrayContaining([
        ["Lagerleitung", ["lead-1", "lead-2"]],
        ["lagerleitung", ["lead-3"]],
      ]),
    );
  });

  test("Köchin nicht mehr im Team → «Ehemalige Person»", () => {
    const expenses = [makeExpense({id: "gone", payeeUserId: "user-gone"})];

    const section = buildReport({}, expenses).sections[0];

    expect(section.displayName).toEqual(TEXT_FORMER_EVENT_COOK);
    expect(section.payeeUserId).toEqual("user-gone");
  });
});

describe("ExpenseReport.build, Sonderfälle", () => {
  const expensesWithUnknownBudget = [
    makeExpense({id: "deleted-budget", budgetId: "budget-deleted"}),
    makeExpense({id: "kitchen", budgetId: "budget-kitchen"}),
  ];

  test("unbekanntes Budget in Modus B: eigene Gruppe zuletzt, Ausgabe bleibt drin", () => {
    const groups = buildReport(
      {mode: ReportMode.PER_PERSON_AND_BUDGET},
      expensesWithUnknownBudget,
    ).sections[0].groups;

    expect(groups.map((group) => group.budgetName)).toEqual([
      "Küche",
      TEXT_REPORT_UNKNOWN_BUDGET,
    ]);
    expect(groups[1].rows.map((row) => row.expenseId)).toEqual([
      "deleted-budget",
    ]);
  });

  test("unbekanntes Budget in Modus A: Budgetname der Zeile", () => {
    const rows = buildReport({}, expensesWithUnknownBudget).sections[0]
      .groups[0].rows;

    expect(
      rows.find((row) => row.expenseId === "deleted-budget")?.budgetName,
    ).toEqual(TEXT_REPORT_UNKNOWN_BUDGET);
  });

  test("includeComments: false → Flag im Ergebnis, Kommentar bleibt in den Daten", () => {
    const report = buildReport({
      includeComments: false,
      payeeSelection: {kind: "single", payeeKey: ANNA.uid},
    });

    expect(report.includeComments).toBe(false);
    expect(report.sections[0].groups[0].rows[0].comment).toEqual(
      "Für das Mottospiel",
    );
  });

  test("Modus wird ins Ergebnis übernommen", () => {
    expect(buildReport().mode).toEqual(ReportMode.PER_PERSON);
    expect(buildReport({mode: ReportMode.PER_PERSON_AND_BUDGET}).mode).toEqual(
      ReportMode.PER_PERSON_AND_BUDGET,
    );
  });

  test("Währungen: CHF zuerst, auch vor alphabetisch früheren, danach alphabetisch", () => {
    const expenses = ["EUR", "CHF", "AUD"].map((currency) =>
      makeExpense({id: currency, currency, amountInCents: 100}),
    );

    expect(
      buildReport({}, expenses).grandTotals?.map((total) => total.currency),
    ).toEqual(["CHF", "AUD", "EUR"]);
  });

  test("ohne Ausgaben: leere Abrechnung", () => {
    const report = buildReport({}, []);

    expect(report.sections).toEqual([]);
    expect(report.receipts).toEqual([]);
    expect(report.grandTotals).toEqual([]);
  });

  test("Eingabe bleibt unverändert", () => {
    const expenses = [...EXPENSES];
    // flache Kopien reichen: build ersetzt keine Felder, Reihenfolge und
    // Werte müssen gleich bleiben (structuredClone macht in jsdom aus Date
    // einen String)
    const snapshot = expenses.map((expense) => ({...expense}));

    buildReport({includeMissingReceiptPages: true}, expenses);

    expect(expenses).toEqual(snapshot);
  });
});

/* =====================================================================
// Hilfsmethoden für den Dialog
// ===================================================================== */

describe("ExpenseReport.getPayeeOptions", () => {
  test("Personen mit Ausgaben, alphabetisch, mit Anzahl, ohne «Ohne Rückerstattung»", () => {
    expect(ExpenseReport.getPayeeOptions(EXPENSES, COOKS)).toEqual([
      {payeeKey: ANNA.uid, displayName: "Anna", expenseCount: 3},
      {payeeKey: BEN.uid, displayName: "Ben", expenseCount: 2},
      {payeeKey: "Lagerleitung", displayName: "Lagerleitung", expenseCount: 1},
    ]);
  });

  test("ohne Ausgaben: leere Liste", () => {
    expect(ExpenseReport.getPayeeOptions([], COOKS)).toEqual([]);
  });

  test("nur Ausgaben ohne Rückerstattung: leere Liste", () => {
    expect(ExpenseReport.getPayeeOptions([NO_REFUND_DONATION], COOKS)).toEqual(
      [],
    );
  });
});

describe("ExpenseReport.getDefaultPayeeKey", () => {
  const options = ExpenseReport.getPayeeOptions(EXPENSES, COOKS);

  test("angemeldete Person mit Ausgaben → sie selbst", () => {
    expect(ExpenseReport.getDefaultPayeeKey(options, BEN.uid)).toEqual(BEN.uid);
  });

  test("angemeldete Person ohne Ausgaben → erste Option", () => {
    expect(ExpenseReport.getDefaultPayeeKey(options, "user-other")).toEqual(
      ANNA.uid,
    );
  });

  test("keine Optionen → null", () => {
    expect(ExpenseReport.getDefaultPayeeKey([], ANNA.uid)).toBeNull();
  });
});

describe("ExpenseReport.countMissingReceipts", () => {
  test("Alle Personen: inklusive «Ohne Rückerstattung»", () => {
    expect(ExpenseReport.countMissingReceipts(EXPENSES, {kind: "all"})).toEqual(
      3,
    );
  });

  test("nur in der Auswahl einer Köchin", () => {
    expect(
      ExpenseReport.countMissingReceipts(EXPENSES, {
        kind: "single",
        payeeKey: BEN.uid,
      }),
    ).toEqual(1);
  });

  test("neue Person über ihren Namen", () => {
    const expenses = [
      ...EXPENSES,
      makeExpense({id: "lead-no-receipt", ...newPerson("Lagerleitung")}),
    ];

    expect(
      ExpenseReport.countMissingReceipts(expenses, {
        kind: "single",
        payeeKey: "Lagerleitung",
      }),
    ).toEqual(1);
  });
});
