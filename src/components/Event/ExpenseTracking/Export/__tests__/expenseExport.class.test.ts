/**
 * Unit-Tests für die Datenaufbereitung des Exports
 * (expenseExport.class.ts).
 *
 * Fixture: zwei Budgets (Küche, Motto), die Köch:innen Anna und Ben, eine
 * Köchin, die nicht mehr im Team ist, eine Ausgabe ohne Rückerstattung und
 * eine Ausgabe mit gelöschtem Budget. Die Eingabe ist absichtlich nicht
 * sortiert. Anna hat eine Motto-Ausgabe zwischen zwei Küchen-Ausgaben: In
 * Modus A steht sie dazwischen, in Modus B dahinter. So fällt auf, wenn
 * der Export den falschen Modus verwendet.
 */
import {EXPORT_REPORT_OPTIONS, ExpenseExport} from "../expenseExport.class";
import {ExportRow} from "../expenseExport.types";
import {ExpenseReport} from "../../Report/expenseReport.class";
import {ExpenseDomain, ExpensePayeeType} from "../../Expense/expense.types";
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

const BUDGETS: BudgetDomain[] = [
  makeBudget("budget-kitchen", "Küche"),
  makeBudget("budget-theme", "Motto"),
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
 * Erstellt eine Ausgabe von Anna mit Standardwerten.
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

const ANNA_KITCHEN_WITH_RECEIPT = makeExpense({
  id: "anna-kitchen-with-receipt",
  date: new Date(2026, 6, 10),
  label: "Grosseinkauf Migros",
  attachmentPath: "events/event-id-001/expenses/anna-kitchen.pdf",
});
const ANNA_THEME_WITH_RECEIPT = makeExpense({
  id: "anna-theme-with-receipt",
  budgetId: "budget-theme",
  date: new Date(2026, 6, 11),
  label: "Bastelmaterial",
  attachmentPath: "events/event-id-001/expenses/anna-theme.jpg",
});
const ANNA_KITCHEN_WITHOUT_RECEIPT = makeExpense({
  id: "anna-kitchen-without-receipt",
  date: new Date(2026, 6, 12),
  label: "Bäckerei",
});
const ANNA_UNKNOWN_BUDGET = makeExpense({
  id: "anna-unknown-budget",
  budgetId: "budget-deleted",
  date: new Date(2026, 6, 13),
  label: "Gaskartusche",
});
const BEN_THEME_WITH_COMMENT = makeExpense({
  id: "ben-theme-with-comment",
  budgetId: "budget-theme",
  date: new Date(2026, 6, 12),
  label: "Piratenhüte",
  comment: "Für den Mottotag",
  payeeUserId: BEN.uid,
  attachmentPath: "events/event-id-001/expenses/ben-theme.png",
});
const FORMER_COOK = makeExpense({
  id: "former-cook",
  budgetId: "budget-theme",
  date: new Date(2026, 6, 8),
  label: "Schatzkiste",
  payeeUserId: "user-gone",
  attachmentPath: "events/event-id-001/expenses/former.pdf",
});
const NO_REFUND = makeExpense({
  id: "no-refund",
  date: new Date(2026, 6, 9),
  label: "Vereinskarte Volg",
  payeeType: ExpensePayeeType.NO_REFUND_NEEDED,
  payeeUserId: null,
  attachmentPath: "events/event-id-001/expenses/no-refund.pdf",
});

/** Absichtlich unsortiert. */
const EXPENSES: ExpenseDomain[] = [
  NO_REFUND,
  BEN_THEME_WITH_COMMENT,
  ANNA_UNKNOWN_BUDGET,
  FORMER_COOK,
  ANNA_KITCHEN_WITHOUT_RECEIPT,
  ANNA_THEME_WITH_RECEIPT,
  ANNA_KITCHEN_WITH_RECEIPT,
];

/**
 * Baut die Export-Zeilen aus der Fixture.
 *
 * @param expenses - Ausgaben (Standard: alle aus der Fixture).
 * @returns Die Zeilen.
 */
const buildRows = (expenses: ExpenseDomain[] = EXPENSES) =>
  ExpenseExport.buildRows({expenses, budgets: BUDGETS, cooks: COOKS});

/* =====================================================================
// Tests
// ===================================================================== */

describe("ExpenseExport.buildRows", () => {
  test("eine Zeile pro Ausgabe: Person → Datum, Ohne Rückerstattung zuletzt", () => {
    expect(buildRows().map((row) => row.expenseId)).toEqual([
      // Modus A: Annas Motto-Ausgabe steht nach Datum zwischen den Küchen-Ausgaben
      "anna-kitchen-with-receipt",
      "anna-theme-with-receipt",
      "anna-kitchen-without-receipt",
      "anna-unknown-budget",
      "ben-theme-with-comment",
      "former-cook",
      "no-refund",
    ]);
  });

  test("jede Zeile trägt den Namen ihrer Person", () => {
    expect(buildRows().map((row) => row.payeeDisplayName)).toEqual([
      "Anna",
      "Anna",
      "Anna",
      "Anna",
      "Ben",
      TEXT_FORMER_EVENT_COOK,
      TEXT_REPORT_NO_REFUND_GROUP,
    ]);
  });

  test("jede Zeile trägt den Namen ihres Budgets, gelöschtes Budget als «Unbekanntes Budget»", () => {
    expect(buildRows().map((row) => row.budgetName)).toEqual([
      "Küche",
      "Motto",
      "Küche",
      TEXT_REPORT_UNKNOWN_BUDGET,
      "Motto",
      "Motto",
      "Küche",
    ]);
  });

  test("Belegnummer nur mit Beleg, lückenlos, ohne Beleg null", () => {
    expect(buildRows().map((row) => row.receiptNumber)).toEqual([
      1,
      2,
      null,
      null,
      3,
      4,
      5,
    ]);
  });

  test("übernimmt die Felder der Ausgabe", () => {
    const benRow = buildRows().find(
      (row) => row.expenseId === BEN_THEME_WITH_COMMENT.id,
    );

    expect(benRow).toEqual({
      expenseId: BEN_THEME_WITH_COMMENT.id,
      date: BEN_THEME_WITH_COMMENT.date,
      label: "Piratenhüte",
      comment: "Für den Mottotag",
      budgetName: "Motto",
      amountInCents: 1000,
      currency: "CHF",
      receiptNumber: 3,
      attachmentPath: BEN_THEME_WITH_COMMENT.attachmentPath,
      payeeDisplayName: "Ben",
    });
  });

  test("gleiche Belegnummern wie die Abrechnung mit denselben Optionen", () => {
    const report = ExpenseReport.build({
      expenses: EXPENSES,
      budgets: BUDGETS,
      cooks: COOKS,
      options: EXPORT_REPORT_OPTIONS,
    });
    const reportNumbers = report.receipts.map((receipt) => [
      receipt.expenseId,
      receipt.receiptNumber,
    ]);

    const exportNumbers = buildRows()
      .filter((row) => row.receiptNumber !== null)
      .map((row) => [row.expenseId, row.receiptNumber]);

    expect(exportNumbers).toEqual(reportNumbers);
  });

  test("verändert die Eingabe nicht", () => {
    const expenses = [...EXPENSES];

    buildRows(expenses);

    expect(expenses).toEqual(EXPENSES);
  });

  test("ohne Ausgaben eine leere Liste", () => {
    expect(buildRows([])).toEqual([]);
  });
});

/* =====================================================================
// Dateinamen: Die Namen landen als Einträge im ZIP. Ein / oder \ im
// Namen würde dort einen Ordner erzeugen, darum wird die Bereinigung
// genau geprüft.
// ===================================================================== */

/**
 * Erstellt eine Export-Zeile mit Beleg und Standardwerten.
 *
 * @param overrides - Felder, die vom Standard abweichen.
 * @returns Die Zeile.
 */
const makeRow = (overrides: Partial<ExportRow>): ExportRow => ({
  expenseId: "expense-id",
  date: new Date(2026, 6, 10),
  label: "Grosseinkauf Migros",
  comment: null,
  budgetName: "Küche",
  amountInCents: 18240,
  currency: "CHF",
  receiptNumber: 3,
  attachmentPath: "events/event-id-001/expenses/expense-id.pdf",
  payeeDisplayName: "Anna",
  ...overrides,
});

describe("ExpenseExport.getReceiptFileName", () => {
  test("Nummer dreistellig, Bezeichnung und Endung aus dem Pfad", () => {
    expect(ExpenseExport.getReceiptFileName(makeRow({}))).toBe(
      "003 Grosseinkauf Migros.pdf",
    );
  });

  test.each([
    [12, "012 Grosseinkauf Migros.pdf"],
    [1234, "1234 Grosseinkauf Migros.pdf"],
  ])("Nummer %i → %s", (receiptNumber, expected) => {
    expect(ExpenseExport.getReceiptFileName(makeRow({receiptNumber}))).toBe(
      expected,
    );
  });

  test.each([
    ["events/e/expenses/a.jpg", "003 Grosseinkauf Migros.jpg"],
    ["events/e/expenses/a.png", "003 Grosseinkauf Migros.png"],
    ["events/e/expenses/a.PDF", "003 Grosseinkauf Migros.pdf"],
  ])("Endung aus %s", (attachmentPath, expected) => {
    expect(ExpenseExport.getReceiptFileName(makeRow({attachmentPath}))).toBe(
      expected,
    );
  });

  test.each([
    ["unbekannte Endung", "events/e/expenses/a.heic"],
    ["Pfad ohne Punkt", "events/e/expenses/a"],
  ])("%s → Name ohne Endung", (_case, attachmentPath) => {
    expect(ExpenseExport.getReceiptFileName(makeRow({attachmentPath}))).toBe(
      "003 Grosseinkauf Migros",
    );
  });

  test.each([
    ["Migros: Brot/Milch", "003 Migros Brot Milch.pdf"],
    ['a\\b*c?d"e<f>g|h', "003 a b c d e f g h.pdf"],
    ["Brot\nMilch\tButter", "003 Brot Milch Butter.pdf"],
    ["Brot\u0000Milch\u001bButter", "003 Brot Milch Butter.pdf"],
    ["  viel   Platz  ", "003 viel Platz.pdf"],
  ])("bereinigt %j", (label, expected) => {
    expect(ExpenseExport.getReceiptFileName(makeRow({label}))).toBe(expected);
  });

  test("keine Ordner im ZIP: weder / noch \\ im Namen", () => {
    const fileName = ExpenseExport.getReceiptFileName(
      makeRow({label: "../../etc/passwd\\x", attachmentPath: "a/b/c"}),
    );

    expect(fileName).not.toMatch(/[/\\]/);
  });

  test("Bezeichnung auf 60 Zeichen gekürzt, ohne Leerzeichen am Ende", () => {
    const longLabel = "A".repeat(59) + " " + "B".repeat(140);

    expect(ExpenseExport.getReceiptFileName(makeRow({label: longLabel}))).toBe(
      `003 ${"A".repeat(59)}.pdf`,
    );
  });

  test("Bezeichnung nur aus Sonderzeichen → nur die Nummer", () => {
    expect(ExpenseExport.getReceiptFileName(makeRow({label: "???"}))).toBe(
      "003.pdf",
    );
  });

  test("ohne Beleg null", () => {
    expect(
      ExpenseExport.getReceiptFileName(
        makeRow({attachmentPath: null, receiptNumber: null}),
      ),
    ).toBeNull();
  });
});

describe("ExpenseExport.getExportFileName", () => {
  test.each([
    ["csv" as const, "Ausgaben Sommerlager 2026.csv"],
    ["zip" as const, "Ausgaben Sommerlager 2026.zip"],
  ])("Endung %s", (extension, expected) => {
    expect(ExpenseExport.getExportFileName("Sommerlager 2026", extension)).toBe(
      expected,
    );
  });

  test("Anlassname wird bereinigt (die CSV liegt auch im ZIP)", () => {
    expect(ExpenseExport.getExportFileName("Sola 2025/26", "csv")).toBe(
      "Ausgaben Sola 2025 26.csv",
    );
  });
});
