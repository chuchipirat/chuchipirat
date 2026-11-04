/**
 * Unit-Tests für den CSV-Download (downloadExpenseCsv.ts).
 *
 * `file-saver` ist gemockt; geprüft wird die Datei, die an `saveAs` geht.
 * jsdom kennt `blob.arrayBuffer()` und `blob.text()` nicht, darum liest der
 * Test den Blob über `FileReader`. `readAsText` entfernt die BOM beim
 * Dekodieren, sie wird darum an den Bytes geprüft (so wie Excel sie sieht).
 */
jest.mock("file-saver", () => ({
  __esModule: true,
  default: {saveAs: jest.fn()},
}));

import fileSaver from "file-saver";
import {downloadExpenseCsv} from "../downloadExpenseCsv";
import {Event} from "../../../Event/event.class";
import {BudgetDomain, BudgetIcon, BudgetType} from "../../Budget/budget.types";
import {ExpenseDomain, ExpensePayeeType} from "../../Expense/expense.types";

const mockedSaveAs = jest.mocked(fileSaver.saveAs);

/* =====================================================================
// Fixture
// ===================================================================== */

const KITCHEN_BUDGET: BudgetDomain = {
  id: "budget-kitchen",
  eventId: "event-1",
  name: "Küche",
  budgetType: BudgetType.FIXED_AMOUNT,
  amountInCents: 100000,
  currency: "CHF",
  icon: BudgetIcon.KITCHEN,
};

/**
 * Erstellt eine Ausgabe von Anna mit Standardwerten.
 *
 * @param overrides - Felder, die vom Standard abweichen.
 * @returns Die Ausgabe.
 */
const makeExpense = (overrides: Partial<ExpenseDomain>): ExpenseDomain => ({
  id: "expense-id",
  eventId: "event-1",
  budgetId: KITCHEN_BUDGET.id,
  date: new Date(2026, 6, 10),
  amountInCents: 18240,
  currency: "CHF",
  label: "Grosseinkauf Migros",
  comment: null,
  payeeType: ExpensePayeeType.EXISTING_USER,
  payeeUserId: "user-anna",
  payeeName: null,
  attachmentPath: null,
  attachmentOriginalFilename: null,
  ...overrides,
});

const EXPENSE_WITH_RECEIPT = makeExpense({
  id: "expense-with-receipt",
  attachmentPath: "events/event-1/expenses/expense-with-receipt.pdf",
});
const EXPENSE_WITHOUT_RECEIPT = makeExpense({
  id: "expense-without-receipt",
  date: new Date(2026, 6, 11),
  label: "Bäckerei",
  amountInCents: 2350,
});

/** Anlass mit Anna als Köchin. */
const buildEvent = (): Event => {
  const event = new Event();
  event.uid = "event-1";
  event.name = "Sommerlager";
  event.cooks = [
    {uid: "user-anna", displayName: "Anna", motto: "", pictureSrc: ""},
  ];
  return event;
};

/**
 * Startet den Download mit der Fixture.
 *
 * @param expenses - Ausgaben (Standard: eine mit und eine ohne Beleg).
 */
const runDownload = (
  expenses: ExpenseDomain[] = [EXPENSE_WITH_RECEIPT, EXPENSE_WITHOUT_RECEIPT],
) =>
  downloadExpenseCsv({expenses, budgets: [KITCHEN_BUDGET], event: buildEvent()});

/**
 * Liefert den Blob und den Dateinamen aus dem einzigen `saveAs`-Aufruf.
 *
 * @returns Blob und Dateiname.
 */
const getSavedFile = (): {blob: Blob; fileName: string} => {
  expect(mockedSaveAs).toHaveBeenCalledTimes(1);
  const [blob, fileName] = mockedSaveAs.mock.calls[0];
  return {blob: blob as Blob, fileName: fileName as string};
};

/**
 * Liest einen Blob über `FileReader`.
 *
 * @param blob - Der Blob.
 * @param asText - `true`: als Text (ohne BOM), `false`: als Bytes.
 * @returns Text bzw. ArrayBuffer.
 */
const readBlob = (
  blob: Blob,
  asText: boolean,
): Promise<string | ArrayBuffer | null> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    if (asText) {
      reader.readAsText(blob);
    } else {
      reader.readAsArrayBuffer(blob);
    }
  });

/**
 * Liest den Inhalt der gespeicherten CSV als Zeilen.
 *
 * @returns Die Zeilen ohne BOM.
 */
const readSavedLines = async (): Promise<string[]> => {
  const text = (await readBlob(getSavedFile().blob, true)) as string;
  return text.split("\r\n");
};

beforeEach(() => {
  mockedSaveAs.mockReset();
});

/* =====================================================================
// Tests
// ===================================================================== */

describe("downloadExpenseCsv", () => {
  test("speichert genau eine Datei «Ausgaben <Anlass>.csv»", () => {
    runDownload();

    expect(getSavedFile().fileName).toBe("Ausgaben Sommerlager.csv");
  });

  test("Blob ist CSV in UTF-8", () => {
    runDownload();

    expect(getSavedFile().blob.type).toBe("text/csv;charset=utf-8");
  });

  test("Datei beginnt mit den BOM-Bytes EF BB BF", async () => {
    runDownload();

    const bytes = new Uint8Array(
      (await readBlob(getSavedFile().blob, false)) as ArrayBuffer,
    );
    expect(Array.from(bytes.slice(0, 3))).toEqual([0xef, 0xbb, 0xbf]);
  });

  test("Kopfzeile und eine Zeile pro Ausgabe", async () => {
    runDownload();

    const lines = await readSavedLines();
    expect(lines).toHaveLength(3);
    expect(lines[0]).toBe(
      "Belegnummer;Datum;Betrag;Währung;Budget;Zahlende Instanz;Bezeichnung;Kommentar;Belegdatei",
    );
  });

  test("Ausgabe mit Beleg: Nummer, Name der Köchin und Dateiname wie im ZIP", async () => {
    runDownload();

    const lines = await readSavedLines();
    expect(lines[1]).toBe(
      '1;10.07.2026;182.40;CHF;"Küche";"Anna";"Grosseinkauf Migros";"";"001 Grosseinkauf Migros.pdf"',
    );
  });

  test("Ausgabe ohne Beleg: Nummer und Belegdatei leer", async () => {
    runDownload();

    const lines = await readSavedLines();
    expect(lines[2]).toBe(
      ';11.07.2026;23.50;CHF;"Küche";"Anna";"Bäckerei";"";""',
    );
  });

  test("ohne Ausgaben nur die Kopfzeile", async () => {
    runDownload([]);

    expect(await readSavedLines()).toHaveLength(1);
  });

  test("ein Fehler von saveAs wird weitergeworfen", () => {
    mockedSaveAs.mockImplementationOnce(() => {
      throw new Error("Download blockiert");
    });

    expect(() => runDownload()).toThrow("Download blockiert");
  });
});
