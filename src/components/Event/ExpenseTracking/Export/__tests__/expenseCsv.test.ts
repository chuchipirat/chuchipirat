/**
 * Unit-Tests für den CSV-Inhalt des Exports (expenseCsv.ts).
 *
 * Format für Excel mit deutschsprachigen Einstellungen (CH und DE):
 * - UTF-8 mit BOM am Anfang, sonst zeigt Excel Umlaute falsch an.
 * - Trennzeichen `;`, Zeilenende CRLF, nach der letzten Zeile kein Zeilenende.
 * - Freie Texte (Budget, Person, Bezeichnung, Kommentar, Belegdatei) immer in
 *   Anführungszeichen, inneres `"` verdoppelt.
 * - Werte, die die App selbst erzeugt (Belegnummer, Datum, Betrag, Währung),
 *   ohne Anführungszeichen.
 * - Texte, die Excel als Formel ausführen würde, bekommen ein `'` davor.
 */
import {buildExpenseCsv, formatCsvAmount, toCsvField} from "../expenseCsv";
import {ExportRow} from "../expenseExport.types";

/** Byte Order Mark, damit Excel die Datei als UTF-8 liest. */
const BOM = "﻿";
const HEADER =
  "Belegnummer;Datum;Betrag;Währung;Budget;Zahlende Instanz;Bezeichnung;Kommentar;Belegdatei";

/**
 * Erstellt eine Export-Zeile mit Standardwerten.
 *
 * @param overrides - Felder, die vom Standard abweichen.
 * @returns Die Zeile.
 */
const makeRow = (overrides: Partial<ExportRow>): ExportRow => ({
  expenseId: "expense-1",
  date: new Date(2026, 6, 10),
  label: "Grosseinkauf Migros",
  comment: null,
  budgetName: "Küche",
  amountInCents: 18240,
  currency: "CHF",
  receiptNumber: 1,
  attachmentPath: "events/event-id-001/expenses/expense-1.pdf",
  payeeDisplayName: "Anna",
  ...overrides,
});

/**
 * Zerlegt eine CSV in Zeilen (ohne BOM). Nur für Tests ohne Zeilenumbruch
 * in einem Feld.
 *
 * @param csv - Inhalt der CSV.
 * @returns Die Zeilen.
 */
const toLines = (csv: string): string[] => csv.replace(BOM, "").split("\r\n");

/* =====================================================================
// toCsvField
// ===================================================================== */

describe("toCsvField", () => {
  test("normaler Text in Anführungszeichen", () => {
    expect(toCsvField("Grosseinkauf Migros")).toBe('"Grosseinkauf Migros"');
  });

  test("leerer Text ergibt leere Anführungszeichen", () => {
    expect(toCsvField("")).toBe('""');
  });

  test("inneres Anführungszeichen wird verdoppelt", () => {
    expect(toCsvField('Brot "Bio"')).toBe('"Brot ""Bio"""');
  });

  test("Semikolon bleibt im Feld", () => {
    expect(toCsvField("Brot; Milch")).toBe('"Brot; Milch"');
  });

  test("Zeilenumbruch bleibt im Feld", () => {
    expect(toCsvField("Zeile 1\nZeile 2")).toBe('"Zeile 1\nZeile 2"');
  });

  test.each([
    ["=SUM(A1:A9)", "\"'=SUM(A1:A9)\""],
    ["+41 79 123 45 67", "\"'+41 79 123 45 67\""],
    ["-5", "\"'-5\""],
    ["@SUM(A1)", "\"'@SUM(A1)\""],
    ["\t=1+1", "\"'\t=1+1\""],
    ["\r=1+1", "\"'\r=1+1\""],
  ])("Formel %j bekommt ein ' davor", (value, expected) => {
    expect(toCsvField(value)).toBe(expected);
  });

  test("Formelzeichen mitten im Text bleibt unverändert", () => {
    expect(toCsvField("Brot = 3.50")).toBe('"Brot = 3.50"');
  });

  test('Formel mit Anführungszeichen: erst \' davor, dann " verdoppelt', () => {
    expect(toCsvField('=HYPERLINK("http://x")')).toBe(
      '"\'=HYPERLINK(""http://x"")"',
    );
  });
});

/* =====================================================================
// formatCsvAmount
// ===================================================================== */

describe("formatCsvAmount", () => {
  test.each([
    [18240, "182.40"],
    [1050, "10.50"],
    [100, "1.00"],
    [5, "0.05"],
    [70, "0.70"],
    [0, "0.00"],
    [100000000, "1000000.00"],
  ])("%i Rappen → %s", (amountInCents, expected) => {
    expect(formatCsvAmount(amountInCents)).toBe(expected);
  });
});

/* =====================================================================
// buildExpenseCsv
// ===================================================================== */

describe("buildExpenseCsv", () => {
  test("beginnt mit BOM, danach die Kopfzeile", () => {
    const csv = buildExpenseCsv([], new Map());

    expect(csv.startsWith(BOM + HEADER)).toBe(true);
  });

  test("ohne Zeilen nur die Kopfzeile, ohne Zeilenende", () => {
    expect(buildExpenseCsv([], new Map())).toBe(BOM + HEADER);
  });

  test("eine Zeile mit allen Spalten in der richtigen Reihenfolge", () => {
    const csv = buildExpenseCsv(
      [makeRow({comment: "Für die ganze Woche"})],
      new Map([["expense-1", "001 Grosseinkauf Migros.pdf"]]),
    );

    expect(toLines(csv)[1]).toBe(
      '1;10.07.2026;182.40;CHF;"Küche";"Anna";"Grosseinkauf Migros";"Für die ganze Woche";"001 Grosseinkauf Migros.pdf"',
    );
  });

  test("Zeilen mit CRLF getrennt, Reihenfolge wie übergeben", () => {
    const csv = buildExpenseCsv(
      [
        makeRow({expenseId: "expense-2", label: "Zweite"}),
        makeRow({expenseId: "expense-1", label: "Erste"}),
      ],
      new Map(),
    );

    const lines = toLines(csv);
    expect(lines).toHaveLength(3);
    expect(lines[1]).toContain('"Zweite"');
    expect(lines[2]).toContain('"Erste"');
    // kein einzelnes \n zwischen den Zeilen (nur CRLF)
    expect(csv.replace(/\r\n/g, "")).not.toContain("\n");
  });

  test("ohne Beleg: Belegnummer leer, Belegdatei leer", () => {
    const csv = buildExpenseCsv(
      [makeRow({receiptNumber: null, attachmentPath: null})],
      new Map(),
    );

    const line = toLines(csv)[1];
    expect(line.startsWith(";10.07.2026;")).toBe(true);
    expect(line.endsWith(';""')).toBe(true);
  });

  test("Kommentar null ergibt ein leeres Feld", () => {
    const csv = buildExpenseCsv([makeRow({comment: null})], new Map());

    expect(toLines(csv)[1]).toContain('"Grosseinkauf Migros";"";');
  });

  test("Belegdatei kommt aus receiptCells, auch ein Hinweistext", () => {
    const csv = buildExpenseCsv(
      [makeRow({})],
      new Map([["expense-1", "Beleg konnte nicht geladen werden"]]),
    );

    expect(toLines(csv)[1].endsWith(';"Beleg konnte nicht geladen werden"')).toBe(
      true,
    );
  });

  test("freie Texte laufen durch toCsvField (Formel und Anführungszeichen)", () => {
    const csv = buildExpenseCsv(
      [
        makeRow({
          label: "=1+1",
          budgetName: '"Motto"',
          payeeDisplayName: "@Ben",
          comment: "-5 Rabatt",
        }),
      ],
      new Map(),
    );

    expect(toLines(csv)[1]).toBe(
      '1;10.07.2026;182.40;CHF;"""Motto""";"\'@Ben";"\'=1+1";"\'-5 Rabatt";""',
    );
  });

  test("Zeilenumbruch im Kommentar bleibt im Feld", () => {
    const csv = buildExpenseCsv(
      [makeRow({comment: "Zeile 1\nZeile 2"})],
      new Map(),
    );

    expect(csv).toContain('"Zeile 1\nZeile 2"');
  });

  test("Betrag in Rappen wird mit zwei Nachkommastellen geschrieben", () => {
    const csv = buildExpenseCsv([makeRow({amountInCents: 5})], new Map());

    expect(toLines(csv)[1]).toContain(";0.05;CHF;");
  });
});
