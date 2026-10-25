/**
 * Unit-Tests für die Beschriftungen der PDF-Abrechnung
 * (expenseReportLabels.ts, Story 7.2): Titel, Dateiname, Untertitel,
 * Datumsformat und Modus-Beschriftungen; Kopfzeile der Belegseiten
 * (Story 7.3a).
 */
import {ReportMode} from "../expenseReport.types";
import {
  REPORT_MODE_LABELS,
  formatReportDate,
  getReportFileName,
  getReportSubtitle,
  getReceiptHeader,
  getReportTitle,
} from "../expenseReportLabels";

describe("getReportTitle", () => {
  test("mit Person: «Abrechnung <Anlass> <Person>»", () => {
    expect(getReportTitle("Sommerlager 2026", "Anna")).toBe(
      "Abrechnung Sommerlager 2026 Anna",
    );
  });

  test("«Alle Personen» (null): ohne Person", () => {
    expect(getReportTitle("Sommerlager 2026", null)).toBe(
      "Abrechnung Sommerlager 2026",
    );
  });

  test("leerer Anlassname: keine doppelten Leerzeichen", () => {
    expect(getReportTitle("", "Anna")).toBe("Abrechnung Anna");
    expect(getReportTitle("", null)).toBe("Abrechnung");
  });
});

describe("getReportFileName", () => {
  test("mit Person: Titel plus Endung .pdf", () => {
    expect(getReportFileName("Sommerlager 2026", "Anna")).toBe(
      "Abrechnung Sommerlager 2026 Anna.pdf",
    );
  });

  test("«Alle Personen» (null): ohne Person", () => {
    expect(getReportFileName("Sommerlager 2026", null)).toBe(
      "Abrechnung Sommerlager 2026.pdf",
    );
  });
});

describe("getReportSubtitle", () => {
  test("eine Person, Modus A", () => {
    expect(getReportSubtitle("Anna", ReportMode.PER_PERSON)).toBe(
      "Anna · Eine Tabelle",
    );
  });

  test("«Alle Personen», Modus B", () => {
    expect(getReportSubtitle(null, ReportMode.PER_PERSON_AND_BUDGET)).toBe(
      "Alle Personen · Pro Budget",
    );
  });
});

describe("formatReportDate", () => {
  test("Schweizer Format mit führenden Nullen", () => {
    expect(formatReportDate(new Date(2026, 6, 9))).toBe("09.07.2026");
  });
});

describe("REPORT_MODE_LABELS", () => {
  test("jeder Modus hat Beschriftung und Erklärung", () => {
    Object.values(ReportMode).forEach((reportMode) => {
      expect(REPORT_MODE_LABELS[reportMode].label).not.toBe("");
      expect(REPORT_MODE_LABELS[reportMode].description).not.toBe("");
    });
  });
});

describe("getReceiptHeader", () => {
  test("«Beleg <Nummer> · Datum · Bezeichnung · Betrag»", () => {
    const header = getReceiptHeader(
      {
        receiptNumber: 3,
        expenseId: "expense-3",
        attachmentPath: null,
        date: new Date(2026, 6, 12),
        label: "Migros",
        amountInCents: 4250,
        currency: "CHF",
      },
      1,
      1,
    );

    // Intl setzt nach «CHF» ein geschütztes Leerzeichen
    expect(header.replace(/\s/g, " ")).toBe(
      "Beleg 3 · 12.07.2026 · Migros · CHF 42.50",
    );
  });
  test("«Beleg <Nummer> · Datum · Bezeichnung · Betrag · Seite X von Y»", () => {
    const header = getReceiptHeader(
      {
        receiptNumber: 3,
        expenseId: "expense-3",
        attachmentPath: null,
        date: new Date(2026, 6, 12),
        label: "Migros",
        amountInCents: 4250,
        currency: "CHF",
      },
      1,
      3,
    );

    // Intl setzt nach «CHF» ein geschütztes Leerzeichen
    expect(header.replace(/\s/g, " ")).toBe(
      "Beleg 3 · 12.07.2026 · Migros · CHF 42.50 · Seite 1 von 3",
    );
  });
});
