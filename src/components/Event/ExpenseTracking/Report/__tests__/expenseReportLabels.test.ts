/**
 * Unit-Tests für die Beschriftungen der PDF-Abrechnung
 * (expenseReportLabels.ts, Story 7.2): Titel, Dateiname, Untertitel,
 * Datumsformat und Modus-Beschriftungen.
 */
import {ReportMode} from "../expenseReport.types";
import {
  REPORT_MODE_LABELS,
  formatReportDate,
  getReportFileName,
  getReportSubtitle,
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
