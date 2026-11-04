/**
 * Unit-Tests für den ZIP-Download (downloadExpenseZip.ts).
 *
 * jszip läuft echt: Der Test öffnet den Blob aus `saveAs` wieder mit
 * `JSZip.loadAsync` und prüft, was darin liegt. `file-saver` und Sentry
 * sind gemockt, `fetchBlob` ersetzt das Netz.
 */
jest.mock("file-saver", () => ({
  __esModule: true,
  default: {saveAs: jest.fn()},
}));
jest.mock("@sentry/react", () => ({captureException: jest.fn()}));

import fileSaver from "file-saver";
import JSZip from "jszip";
import * as Sentry from "@sentry/react";
import {downloadExpenseZip} from "../downloadExpenseZip";
import {Event} from "../../../Event/event.class";
import {BudgetDomain, BudgetIcon, BudgetType} from "../../Budget/budget.types";
import {ExpenseDomain, ExpensePayeeType} from "../../Expense/expense.types";
import {ExportProgress} from "../expenseExport.types";

const mockedSaveAs = jest.mocked(fileSaver.saveAs);
const mockedCaptureException = jest.mocked(Sentry.captureException);

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

/** Beleg 001 (frühestes Datum). */
const EXPENSE_PDF = makeExpense({
  id: "expense-pdf",
  attachmentPath: "event-1/expenses/expense-pdf.pdf",
});
/** Ohne Beleg, liegt zwischen den beiden Belegen. */
const EXPENSE_WITHOUT_RECEIPT = makeExpense({
  id: "expense-none",
  date: new Date(2026, 6, 11),
  label: "Bäckerei",
  amountInCents: 2350,
});
/** Beleg 002. */
const EXPENSE_JPG = makeExpense({
  id: "expense-jpg",
  date: new Date(2026, 6, 12),
  label: "Gemüse Markt",
  amountInCents: 4500,
  attachmentPath: "event-1/expenses/expense-jpg.jpg",
});
const ALL_EXPENSES = [EXPENSE_PDF, EXPENSE_WITHOUT_RECEIPT, EXPENSE_JPG];

const CSV_NAME = "Ausgaben Sommerlager.csv";
const PDF_FILE = "Belege/001 Grosseinkauf Migros.pdf";
const JPG_FILE = "Belege/002 Gemüse Markt.jpg";

/**
 * URL eines Belegs im Test.
 *
 * @param attachmentPath - Pfad im Storage.
 * @returns Die URL.
 */
const getAttachmentUrl = async (attachmentPath: string) =>
  `https://storage.test/${attachmentPath}`;

/**
 * Inhalt, den der `fetchBlob`-Mock für eine URL liefert.
 *
 * @param url - URL des Belegs.
 * @returns Der Dateiinhalt als Text.
 */
const contentOf = (url: string) => `Inhalt von ${url}`;

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

let fetchBlob: jest.Mock<Promise<Blob>, [string]>;
let onProgress: jest.Mock<void, [ExportProgress]>;

/**
 * Startet den Download mit der Fixture.
 *
 * @param expenses - Ausgaben (Standard: zwei mit und eine ohne Beleg).
 * @returns Das Ergebnis von `downloadExpenseZip`.
 */
const runDownload = (expenses: ExpenseDomain[] = ALL_EXPENSES) =>
  downloadExpenseZip({
    expenses,
    budgets: [KITCHEN_BUDGET],
    event: buildEvent(),
    getAttachmentUrl,
    onProgress,
    fetchBlob,
  });

/**
 * Öffnet das ZIP aus dem einzigen `saveAs`-Aufruf.
 *
 * @returns Das geöffnete ZIP.
 */
const openSavedZip = async (): Promise<JSZip> => {
  expect(mockedSaveAs).toHaveBeenCalledTimes(1);
  return JSZip.loadAsync(mockedSaveAs.mock.calls[0][0] as Blob);
};

/**
 * Namen aller Dateien im ZIP (ohne Ordnereinträge), sortiert.
 *
 * @param zip - Das ZIP.
 * @returns Die Dateinamen.
 */
const fileNamesIn = (zip: JSZip): string[] =>
  Object.values(zip.files)
    .filter((entry) => !entry.dir)
    .map((entry) => entry.name)
    .sort();

/**
 * Liest eine Datei aus dem ZIP als Text.
 *
 * @param zip - Das ZIP.
 * @param name - Pfad der Datei im ZIP.
 * @returns Der Inhalt.
 */
const readText = async (zip: JSZip, name: string): Promise<string> => {
  const entry = zip.file(name);
  if (entry === null) {
    throw new Error(`${name} fehlt im ZIP`);
  }
  return entry.async("string");
};

/**
 * Liest die CSV im ZIP als Zeilen (ohne BOM).
 *
 * @param zip - Das ZIP.
 * @returns Die Zeilen.
 */
const readCsvLines = async (zip: JSZip): Promise<string[]> =>
  (await readText(zip, CSV_NAME)).replace(/^\uFEFF/, "").split("\r\n");

/** Lässt laufende Promises weiterlaufen. */
const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0));

beforeEach(() => {
  mockedSaveAs.mockReset();
  mockedCaptureException.mockReset();
  fetchBlob = jest.fn((url: string) =>
    Promise.resolve(new Blob([contentOf(url)])),
  );
  onProgress = jest.fn();
});

/* =====================================================================
// Tests
// ===================================================================== */

describe("downloadExpenseZip: Inhalt", () => {
  test("speichert genau eine Datei «Ausgaben <Anlass>.zip»", async () => {
    await runDownload();

    expect(mockedSaveAs).toHaveBeenCalledTimes(1);
    expect(mockedSaveAs.mock.calls[0][1]).toBe("Ausgaben Sommerlager.zip");
  });

  test("ZIP enthält die CSV und die Belege im Ordner «Belege», keine Datei ohne Beleg", async () => {
    await runDownload();

    expect(fileNamesIn(await openSavedZip())).toEqual(
      [CSV_NAME, JPG_FILE, PDF_FILE].sort(),
    );
  });

  test("Belegdatei ist das unveränderte Original, geladen über getAttachmentUrl", async () => {
    await runDownload();

    const zip = await openSavedZip();
    expect(await readText(zip, PDF_FILE)).toBe(
      contentOf("https://storage.test/event-1/expenses/expense-pdf.pdf"),
    );
    expect(await readText(zip, JPG_FILE)).toBe(
      contentOf("https://storage.test/event-1/expenses/expense-jpg.jpg"),
    );
  });

  test("CSV im ZIP: Dateiname bei Belegen, leere Zelle ohne Beleg", async () => {
    await runDownload();

    const lines = await readCsvLines(await openSavedZip());
    expect(lines).toHaveLength(4);
    expect(lines[1]).toBe(
      '1;10.07.2026;182.40;CHF;"Küche";"Anna";"Grosseinkauf Migros";"";"001 Grosseinkauf Migros.pdf"',
    );
    expect(lines[2]).toBe(
      ';11.07.2026;23.50;CHF;"Küche";"Anna";"Bäckerei";"";""',
    );
    expect(lines[3]).toBe(
      '2;12.07.2026;45.00;CHF;"Küche";"Anna";"Gemüse Markt";"";"002 Gemüse Markt.jpg"',
    );
  });

  test("alles geladen: keine fehlenden Belege, kein Sentry", async () => {
    expect(await runDownload()).toEqual({failedReceiptNumbers: []});
    expect(mockedCaptureException).not.toHaveBeenCalled();
  });

  test("ohne Kompression (STORE): Belege sind schon komprimiert", async () => {
    const generateSpy = jest.spyOn(JSZip.prototype, "generateAsync");

    await runDownload();

    expect(generateSpy).toHaveBeenCalledWith(
      expect.objectContaining({type: "blob", compression: "STORE"}),
    );
    generateSpy.mockRestore();
  });
});

describe("downloadExpenseZip: Laden und Fortschritt", () => {
  test("Fortschritt zählt nur die Belege", async () => {
    await runDownload();

    expect(onProgress.mock.calls).toEqual([
      [{loaded: 0, total: 2}],
      [{loaded: 1, total: 2}],
      [{loaded: 2, total: 2}],
    ]);
  });

  test("ohne Belege: kein Fortschritt, ZIP enthält nur die CSV", async () => {
    await runDownload([EXPENSE_WITHOUT_RECEIPT]);

    expect(onProgress).not.toHaveBeenCalled();
    expect(fetchBlob).not.toHaveBeenCalled();
    expect(fileNamesIn(await openSavedZip())).toEqual([CSV_NAME]);
  });

  test("lädt nacheinander in Nummernreihenfolge: der zweite Beleg startet erst nach dem ersten", async () => {
    let resolveFirst: (blob: Blob) => void = () => undefined;
    fetchBlob.mockImplementationOnce(
      () =>
        new Promise<Blob>((resolve) => {
          resolveFirst = resolve;
        }),
    );

    const download = runDownload();
    await flushPromises();
    expect(fetchBlob).toHaveBeenCalledTimes(1);

    resolveFirst(new Blob(["erster"]));
    await download;
    expect(fetchBlob.mock.calls.map(([url]) => url)).toEqual([
      "https://storage.test/event-1/expenses/expense-pdf.pdf",
      "https://storage.test/event-1/expenses/expense-jpg.jpg",
    ]);
  });
});

describe("downloadExpenseZip: Beleg lädt nicht", () => {
  const notFound = new Error("Beleg nicht abrufbar (HTTP 404)");

  test("ZIP entsteht trotzdem, ohne diese Datei", async () => {
    fetchBlob.mockRejectedValueOnce(notFound);

    await runDownload();

    expect(fileNamesIn(await openSavedZip())).toEqual(
      [CSV_NAME, JPG_FILE].sort(),
    );
  });

  test("CSV-Zelle sagt, dass der Beleg fehlt; Nummer bleibt", async () => {
    fetchBlob.mockRejectedValueOnce(notFound);

    await runDownload();

    const lines = await readCsvLines(await openSavedZip());
    expect(lines[1]).toBe(
      '1;10.07.2026;182.40;CHF;"Küche";"Anna";"Grosseinkauf Migros";"";"Beleg konnte nicht geladen werden"',
    );
    expect(lines[3].endsWith(';"002 Gemüse Markt.jpg"')).toBe(true);
  });

  test("Ergebnis nennt die Belegnummer", async () => {
    fetchBlob.mockRejectedValueOnce(notFound);

    expect(await runDownload()).toEqual({failedReceiptNumbers: [1]});
  });

  test("ein Sentry-Ereignis für alle Fehler, nur mit IDs", async () => {
    fetchBlob.mockRejectedValueOnce(notFound).mockRejectedValueOnce(notFound);

    expect(await runDownload()).toEqual({failedReceiptNumbers: [1, 2]});
    expect(mockedCaptureException).toHaveBeenCalledTimes(1);
    expect(mockedCaptureException).toHaveBeenCalledWith(notFound, {
      extra: {
        context: "Export: Belege laden",
        eventUid: "event-1",
        expenseIds: ["expense-pdf", "expense-jpg"],
      },
    });
  });

  test("Netzfehler zählt als fehlend, geht aber nicht an Sentry", async () => {
    fetchBlob.mockRejectedValueOnce(new TypeError("Failed to fetch"));

    expect(await runDownload()).toEqual({failedReceiptNumbers: [1]});
    expect(mockedCaptureException).not.toHaveBeenCalled();
  });
});

describe("downloadExpenseZip: Fehler beim Speichern", () => {
  test("ein Fehler von saveAs wird weitergeworfen", async () => {
    mockedSaveAs.mockImplementationOnce(() => {
      throw new Error("Download blockiert");
    });

    await expect(runDownload()).rejects.toThrow("Download blockiert");
  });
});
