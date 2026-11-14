/**
 * Unit-Tests für die Darstellungshilfen der PDF-Abrechnung
 * (expenseReportPdfHelpers.ts, Story 7.5) und `getCreatedAtLabel`.
 */
import AuthUser from "../../../../Session/authUser.class";
import {
  CurrencyTotal,
  ExpenseReportData,
  LoadedReceipt,
  ReportMode,
  ReportPayeeSection,
  ReportReceipt,
  ReportRow,
} from "../expenseReport.types";
import {getCreatedAtLabel} from "../expenseReportLabels";
import {
  canKeepCardTogether,
  formatBudgetNames,
  formatTotals,
  getCardStartHeight,
  getIbanBoxGroups,
  getPaymentDetailsLine,
  getReceiptMetaByExpenseId,
  getReceiptStartPages,
  getReportKpis,
  isPaymentDetailsComplete,
  splitTotalsForAccounting,
} from "../expenseReportPdfHelpers";
import {getReceiptPageSlots} from "../receiptPageSlots";
import {formatAmountFromCents} from "../../../../Shared/utils/currencyUtils";

/* =====================================================================
// Fixture
// ===================================================================== */

const CHF_300 = {currency: "CHF", amountInCents: 300};
const EUR_500 = {currency: "EUR", amountInCents: 500};
const CHF_100 = {currency: "CHF", amountInCents: 100};

/**
 * Erstellt eine Zeile mit Standardwerten.
 *
 * @param overrides - Felder, die vom Standard abweichen.
 * @returns Die Zeile.
 */
const makeRow = (overrides: Partial<ReportRow>): ReportRow => ({
  expenseId: "expense-1",
  date: new Date(2026, 9, 5),
  label: "Migros",
  comment: null,
  budgetName: "Küche",
  amountInCents: 300,
  currency: "CHF",
  receiptNumber: 1,
  attachmentPath: null,
  ...overrides,
});

/**
 * Erstellt eine Section mit einer Gruppe.
 *
 * @param overrides - Felder, die vom Standard abweichen.
 * @param rows - Zeilen der einzigen Gruppe.
 * @returns Die Section.
 */
const makeSection = (
  overrides: Partial<ReportPayeeSection>,
  rows: ReportRow[] = [],
): ReportPayeeSection => ({
  payeeKey: "user-anna",
  displayName: "Anna",
  isNoRefund: false,
  payeeUserId: "user-anna",
  groups: [{budgetName: null, budgetIcon: null, rows, totals: []}],
  totals: [CHF_300],
  ...overrides,
});

/**
 * Erstellt eine Abrechnung mit Standardwerten (eine Person).
 *
 * @param overrides - Felder, die vom Standard abweichen.
 * @returns Die Abrechnung.
 */
const makeReport = (
  overrides: Partial<ExpenseReportData>,
): ExpenseReportData => ({
  mode: ReportMode.PER_PERSON,
  includeComments: false,
  sections: [makeSection({})],
  receipts: [],
  grandTotals: null,
  refundTotals: null,
  payeeDisplayName: "Anna",
  ...overrides,
});

/**
 * Erstellt einen Beleg mit Nummer.
 *
 * @param receiptNumber - Belegnummer.
 * @returns Der Beleg.
 */
const makeReceipt = (receiptNumber: number): ReportReceipt => ({
  receiptNumber,
  expenseId: `expense-${receiptNumber}`,
  attachmentPath: null,
  date: new Date(2026, 9, 5),
  label: "Migros",
  amountInCents: 300,
  currency: "CHF",
});

/** Gültige, vollständige Angaben. */
const COMPLETE_DETAILS = {
  street: " Beispielstrasse 12 ",
  postalCode: "8000",
  city: "Zürich",
  iban: "ch93 0076 2011 6238 5295 7",
};

/* =====================================================================
// Tests
// ===================================================================== */

describe("getReportKpis", () => {
  /**
   * Kennzahlen als [Beschriftung, Werte, hervorgehoben], Leerzeichen aus
   * `Intl` normalisiert.
   *
   * @param report - Die Abrechnung.
   * @returns Vergleichbare Kennzahlen.
   */
  const kpisOf = (report: ExpenseReportData) =>
    getReportKpis(report).map((kpi) => [
      kpi.label,
      kpi.values.map((value) => value.replace(/\s/g, " ")),
      kpi.isHighlighted,
    ]);

  test("eine Person: Ausgaben, Zurückzuerstatten (hervorgehoben), Budgets mit Namen", () => {
    const report = makeReport({
      sections: [
        makeSection({totals: [CHF_300, EUR_500]}, [
          makeRow({expenseId: "motto-1", budgetName: "Motto"}),
          makeRow({expenseId: "kitchen-1", budgetName: "Küche"}),
          makeRow({expenseId: "motto-2", budgetName: "Motto"}),
        ]),
      ],
    });

    expect(kpisOf(report)).toEqual([
      ["Ausgaben", ["3"], false],
      ["Zurückzuerstatten", ["CHF 3.00", "EUR 5.00"], true],
      ["Budgets", ["2"], false],
    ]);
    // alphabetisch, jedes Budget einmal
    expect(getReportKpis(report)[2].detail).toBe("Küche, Motto");
  });

  test("nur die Kachel «Budgets» hat eine Detailzeile", () => {
    const kpis = getReportKpis(
      makeReport({grandTotals: [CHF_300], refundTotals: [CHF_300]}),
    );

    expect(kpis.map((kpi) => kpi.detail)).toEqual([null, null, null]);
  });

  test("Alle Personen: Gesamttotal, Zurückzuerstatten, «Ohne Rückerstattung» aus deren Section", () => {
    const report = makeReport({
      sections: [
        makeSection({}),
        makeSection({
          payeeKey: "no-refund",
          isNoRefund: true,
          payeeUserId: null,
          totals: [CHF_100, EUR_500],
        }),
      ],
      grandTotals: [{currency: "CHF", amountInCents: 400}, EUR_500],
      refundTotals: [CHF_300],
      payeeDisplayName: null,
    });

    expect(kpisOf(report)).toEqual([
      ["Gesamttotal", ["CHF 4.00", "EUR 5.00"], false],
      ["Zurückzuerstatten", ["CHF 3.00"], true],
      ["Ohne Rückerstattung", ["CHF 1.00", "EUR 5.00"], false],
    ]);
  });

  test("Alle Personen ohne «Ohne Rückerstattung»: «–»", () => {
    const kpis = getReportKpis(
      makeReport({grandTotals: [CHF_300], refundTotals: [CHF_300]}),
    );

    expect(kpis[2]).toMatchObject({key: "noRefund", values: ["–"]});
  });
});

describe("formatBudgetNames", () => {
  test("bis drei Budgets: alle Namen", () => {
    expect(formatBudgetNames(["Küche", "Material", "Motto"])).toBe(
      "Küche, Material, Motto",
    );
  });

  test("mehr als drei: zwei Namen und «+n»", () => {
    expect(formatBudgetNames(["Küche", "Material", "Motto", "Transport"])).toBe(
      "Küche, Material, +2",
    );
  });

  test("keine Budgets: keine Zeile", () => {
    expect(formatBudgetNames([])).toBeNull();
  });
});

describe("formatTotals", () => {
  test("ein Betrag pro Währung, in der gegebenen Reihenfolge", () => {
    expect(
      formatTotals([CHF_300, EUR_500]).map((text) => text.replace(/\s/g, " ")),
    ).toEqual(["CHF 3.00", "EUR 5.00"]);
  });
});

describe("splitTotalsForAccounting", () => {
  test("Währung und Zahl getrennt, Zahl wie formatAmountFromCents", () => {
    expect(
      splitTotalsForAccounting([
        {currency: "CHF", amountInCents: 200000},
        EUR_500,
      ]),
    ).toEqual([
      // Trennzeichen wie in der Tabelle, egal welches Apostroph Intl setzt
      {
        currency: "CHF",
        amount: formatAmountFromCents(200000, "CHF").replace(/^CHF\s*/, ""),
      },
      {currency: "EUR", amount: "5.00"},
    ]);
  });

  test("negativer Betrag: Vorzeichen bleibt bei der Zahl", () => {
    expect(
      splitTotalsForAccounting([{currency: "CHF", amountInCents: -1250}]),
    ).toEqual([{currency: "CHF", amount: "-12.50"}]);
  });

  test("ohne Beträge: leere Liste", () => {
    expect(splitTotalsForAccounting([])).toEqual([]);
  });
});

describe("isPaymentDetailsComplete", () => {
  test("alle vier Angaben: vollständig", () => {
    expect(isPaymentDetailsComplete(COMPLETE_DETAILS)).toBe(true);
  });

  test("keine Angaben: unvollständig", () => {
    expect(isPaymentDetailsComplete(null)).toBe(false);
  });

  test.each(["street", "postalCode", "city", "iban"] as const)(
    "%s fehlt (nur Leerzeichen): unvollständig",
    (fieldName) => {
      expect(
        isPaymentDetailsComplete({...COMPLETE_DETAILS, [fieldName]: "  "}),
      ).toBe(false);
    },
  );
});

describe("getPaymentDetailsLine", () => {
  test("Adresse getrimmt, IBAN normalisiert in Viererblöcken", () => {
    expect(getPaymentDetailsLine(COMPLETE_DETAILS)).toBe(
      "Beispielstrasse 12, 8000 Zürich · CH93 0076 2011 6238 5295 7",
    );
  });
});

describe("getIbanBoxGroups", () => {
  test("leer: 21 leere Kästchen in 5 × 4 + 1", () => {
    const groups = getIbanBoxGroups("");

    expect(groups?.map((group) => group.length)).toEqual([4, 4, 4, 4, 4, 1]);
    expect(groups?.flat().every((character) => character === "")).toBe(true);
  });

  test("Schweizer IBAN: ein Zeichen pro Kästchen, normalisiert", () => {
    expect(getIbanBoxGroups("ch93 0076 2011 6238 5295 7")).toEqual([
      ["C", "H", "9", "3"],
      ["0", "0", "7", "6"],
      ["2", "0", "1", "1"],
      ["6", "2", "3", "8"],
      ["5", "2", "9", "5"],
      ["7"],
    ]);
  });

  test("IBAN mit anderer Länge (z.B. Deutschland): null, steht als Text", () => {
    expect(getIbanBoxGroups("DE89370400440532013000")).toBeNull();
  });
});

describe("getReceiptMetaByExpenseId", () => {
  test("Budget aus der Zeile, Person aus der Section", () => {
    const report = makeReport({
      sections: [
        makeSection({}, [makeRow({expenseId: "anna-1"})]),
        makeSection({payeeKey: "user-ben", displayName: "Ben"}, [
          makeRow({expenseId: "ben-1", budgetName: "Motto"}),
        ]),
      ],
    });

    const metaByExpenseId = getReceiptMetaByExpenseId(report);

    expect(metaByExpenseId.get("anna-1")).toEqual({
      budgetName: "Küche",
      payeeDisplayName: "Anna",
    });
    expect(metaByExpenseId.get("ben-1")).toEqual({
      budgetName: "Motto",
      payeeDisplayName: "Ben",
    });
  });
});

describe("getReceiptStartPages", () => {
  test("Belege folgen auf die Abrechnung; ein PDF mit 3 Seiten belegt 3 Seiten", () => {
    const loadedReceipts: LoadedReceipt[] = [
      {kind: "missing", receipt: makeReceipt(1)},
      {
        kind: "pdf",
        receipt: makeReceipt(2),
        bytes: new Uint8Array(),
        pageCount: 3,
      },
      {kind: "image", receipt: makeReceipt(3), dataUrl: "data:"},
    ];

    const startPages = getReceiptStartPages(
      getReceiptPageSlots(loadedReceipts),
      2,
    );

    expect([...startPages]).toEqual([
      [1, 3],
      [2, 4],
      [3, 7],
    ]);
  });

  test("ohne Belege: leer", () => {
    expect(getReceiptStartPages([], 3).size).toBe(0);
  });
});

describe("getCreatedAtLabel", () => {
  test("Datum, Zeit und Anzeigename", () => {
    const authUser = new AuthUser();
    authUser.publicProfile = {displayName: "Gio", motto: "", pictureSrc: ""};

    expect(getCreatedAtLabel(new Date(2026, 9, 27, 18, 21), authUser)).toBe(
      "Erstellt am 27.10.2026, 18:21 von Gio",
    );
  });
});

describe("canKeepCardTogether", () => {
  /**
   * Section mit der gegebenen Anzahl Zeilen.
   *
   * @param rowCount - Anzahl Zeilen.
   * @returns Die Section.
   */
  const sectionWithRows = (rowCount: number) =>
    makeSection(
      {},
      Array.from({length: rowCount}, (_unused, index) =>
        makeRow({expenseId: `expense-${index}`, comment: "Kommentar"}),
      ),
    );

  test("wenige Zeilen: bleibt zusammen", () => {
    expect(canKeepCardTogether(sectionWithRows(5), true, true)).toBe(true);
  });

  test("viele Zeilen: darf umbrechen", () => {
    expect(canKeepCardTogether(sectionWithRows(30), false, false)).toBe(false);
  });

  test("Kommentare allein können den Ausschlag geben", () => {
    // 20 Zeilen mit grauer Zeile: ohne Kommentare passt es, mit nicht mehr
    expect(canKeepCardTogether(sectionWithRows(20), false, false)).toBe(true);
    expect(canKeepCardTogether(sectionWithRows(20), true, false)).toBe(false);
  });

  test("Aufbau B: jede weitere Währung braucht eine Zeile mehr", () => {
    /**
     * Section in Aufbau B mit einem Budget und den gegebenen Beträgen.
     *
     * @param totals - Beträge pro Währung (Balken und Total).
     * @returns Die Section.
     */
    const perBudgetSection = (totals: CurrencyTotal[]) =>
      makeSection({
        groups: [
          {
            budgetName: "Küche",
            budgetIcon: null,
            rows: Array.from({length: 23}, (_unused, index) =>
              makeRow({expenseId: `expense-${index}`}),
            ),
            totals,
          },
        ],
        totals,
      });

    // 23 Zeilen passen knapp mit einer Währung, mit zweien nicht mehr
    expect(canKeepCardTogether(perBudgetSection([CHF_300]), false, false)).toBe(
      true,
    );
    expect(
      canKeepCardTogether(perBudgetSection([CHF_300, EUR_500]), false, false),
    ).toBe(false);
  });

  test("Kommentare und Kasten zählen mit", () => {
    // 20 Zeilen passen ohne Kommentare und mit grauer Zeile, mit beidem nicht
    expect(canKeepCardTogether(sectionWithRows(20), false, false)).toBe(true);
    expect(canKeepCardTogether(sectionWithRows(20), true, true)).toBe(false);
  });
});

describe("getCardStartHeight", () => {
  test("Kasten braucht mehr Platz als die graue Zeile", () => {
    const section = makeSection({});

    expect(getCardStartHeight(section, true)).toBeGreaterThan(
      getCardStartHeight(section, false),
    );
  });

  test("Aufbau B: Platz für den ersten Budget-Balken", () => {
    const perPerson = makeSection({});
    const perBudget = makeSection({
      groups: [{budgetName: "Küche", budgetIcon: null, rows: [], totals: []}],
    });

    expect(getCardStartHeight(perBudget, false)).toBeGreaterThan(
      getCardStartHeight(perPerson, false),
    );
  });

  test("«Ohne Rückerstattung»: kein Kasten, auch ohne Angaben", () => {
    const noRefund = makeSection({isNoRefund: true});

    expect(getCardStartHeight(noRefund, true)).toBe(
      getCardStartHeight(noRefund, false),
    );
    expect(getCardStartHeight(noRefund, true)).toBeLessThan(
      getCardStartHeight(makeSection({}), true),
    );
  });
});
