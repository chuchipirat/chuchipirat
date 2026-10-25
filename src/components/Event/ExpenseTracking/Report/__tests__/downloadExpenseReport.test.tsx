/**
 * Unit-Tests für das Erstellen der Abrechnung (downloadExpenseReport.tsx,
 * Story 7.3a): Ablauf Laden → Zeichnen → Download, Ergebnis mit den
 * fehlenden Belegen und ein Sentry-Ereignis pro Abrechnung. Seit Story
 * 7.3b: Zwischenschritt für PDF-Belege, verschlüsselte PDFs.
 *
 * `loadReceipts`, `embedPdfReceipts`, `generateAndDownloadPdf` und Sentry
 * werden gemockt. Das
 * PDF-Dokument ebenfalls: geprüft wird nur, was es als Props bekommt.
 * `ExpenseReport.build` läuft echt (reine Funktion).
 */
jest.mock("../receiptLoader", () => ({
  ...jest.requireActual("../receiptLoader"),
  loadReceipts: jest.fn(),
}));
jest.mock("../embedPdfReceipts", () => ({embedPdfReceipts: jest.fn()}));
jest.mock("../../../../Shared/pdfUtils", () => ({
  generateAndDownloadPdf: jest.fn(),
}));
jest.mock("../expenseReportPdf", () => ({ExpenseReportPdf: () => null}));
jest.mock("@sentry/react", () => ({captureException: jest.fn()}));

import React from "react";
import * as Sentry from "@sentry/react";

import AuthUser from "../../../../Session/authUser.class";
import {generateAndDownloadPdf} from "../../../../Shared/pdfUtils";
import {Event} from "../../../Event/event.class";
import {BudgetDomain, BudgetIcon, BudgetType} from "../../Budget/budget.types";
import {ExpenseDomain, ExpensePayeeType} from "../../Expense/expense.types";
import {downloadExpenseReport} from "../downloadExpenseReport";
import {embedPdfReceipts} from "../embedPdfReceipts";
import {
  LoadedReceipt,
  ReportMode,
  ReportOptions,
  ReportProgress,
} from "../expenseReport.types";
import {EncryptedReceiptError, loadReceipts} from "../receiptLoader";

const mockedLoadReceipts = jest.mocked(loadReceipts);
const mockedGenerateAndDownloadPdf = jest.mocked(generateAndDownloadPdf);
const mockedEmbedPdfReceipts = jest.mocked(embedPdfReceipts);

/* =====================================================================
// Fixture
// ===================================================================== */

const BUDGET: BudgetDomain = {
  id: "budget-kitchen",
  eventId: "event-1",
  name: "Küche",
  budgetType: BudgetType.FIXED_AMOUNT,
  amountInCents: 100000,
  currency: "CHF",
  icon: BudgetIcon.KITCHEN,
};

/**
 * Erstellt eine Ausgabe von Anna.
 *
 * @param id - ID der Ausgabe.
 * @param day - Tag im Juli 2026 (bestimmt die Belegnummer).
 * @param attachmentPath - Pfad des Belegs, `null` ohne Beleg.
 * @returns Die Ausgabe.
 */
const makeExpense = (
  id: string,
  day: number,
  attachmentPath: string | null,
): ExpenseDomain => ({
  id,
  eventId: "event-1",
  budgetId: BUDGET.id,
  date: new Date(2026, 6, day),
  amountInCents: 1000,
  currency: "CHF",
  label: `Einkauf ${day}`,
  comment: null,
  payeeType: ExpensePayeeType.EXISTING_USER,
  payeeUserId: "user-anna",
  payeeName: null,
  attachmentPath,
  attachmentOriginalFilename: null,
});

/** Beleg 1 (Bild) und Beleg 2 (ohne Beleg, Leerseite). */
const EXPENSES = [
  makeExpense("expense-image", 9, "event-1/expenses/expense-image.jpg"),
  makeExpense("expense-missing", 10, null),
];

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

const OPTIONS: ReportOptions = {
  mode: ReportMode.PER_PERSON,
  payeeSelection: {kind: "single", payeeKey: "user-anna"},
  includeComments: false,
  includeMissingReceiptPages: true,
};

/**
 * Ruft `downloadExpenseReport` mit der Fixture auf.
 *
 * @returns Ergebnis und die übergebenen Callbacks.
 */
const runDownload = async () => {
  const getAttachmentUrl = jest.fn(
    (attachmentPath: string) => `https://storage.test/${attachmentPath}`,
  );
  const onProgress = jest.fn<void, [ReportProgress]>();
  const onError = jest.fn();
  const result = await downloadExpenseReport({
    expenses: EXPENSES,
    budgets: [BUDGET],
    event: buildEvent(),
    authUser: new AuthUser(),
    options: OPTIONS,
    getAttachmentUrl,
    onProgress,
    onError,
  });
  return {result, getAttachmentUrl, onProgress, onError};
};

/**
 * Lässt `loadReceipts` die Belege mit den gegebenen Arten liefern.
 *
 * @param toLoadedReceipt - Macht aus einem Beleg den geladenen Eintrag.
 */
const mockLoadedReceipts = (
  toLoadedReceipt: (
    receipt: LoadedReceipt["receipt"],
    index: number,
  ) => LoadedReceipt,
) => {
  mockedLoadReceipts.mockImplementation(async (receipts) =>
    receipts.map(toLoadedReceipt),
  );
};

/** Alle Belege als Leerseite: kein Fehler. */
const allMissing = (receipt: LoadedReceipt["receipt"]): LoadedReceipt => ({
  kind: "missing",
  receipt,
});

beforeEach(() => {
  jest.clearAllMocks();
  mockLoadedReceipts(allMissing);
  mockedGenerateAndDownloadPdf.mockResolvedValue(true);
});

/* =====================================================================
// Tests
// ===================================================================== */

describe("downloadExpenseReport: Ablauf", () => {
  test("lädt die Belege der Abrechnung mit getAttachmentUrl und onProgress", async () => {
    const {getAttachmentUrl, onProgress} = await runDownload();

    expect(mockedLoadReceipts).toHaveBeenCalledTimes(1);
    const [receipts, dependencies] = mockedLoadReceipts.mock.calls[0];
    expect(receipts.map((receipt) => receipt.receiptNumber)).toEqual([1, 2]);
    expect(dependencies).toEqual({getAttachmentUrl, onProgress});
  });

  test("meldet nach dem Laden «rendering», dann wird gezeichnet", async () => {
    const {onProgress} = await runDownload();

    expect(onProgress).toHaveBeenLastCalledWith({stage: "rendering"});
    expect(onProgress.mock.invocationCallOrder[0]).toBeLessThan(
      mockedGenerateAndDownloadPdf.mock.invocationCallOrder[0],
    );
  });

  test("PDF mit den geladenen Belegen, Dateiname und Sentry-Kontext", async () => {
    const {onError} = await runDownload();

    const [element, fileName, passedOnError, sentryContext] =
      mockedGenerateAndDownloadPdf.mock.calls[0];
    // das Element ist <ExpenseReportPdf …/>, seine Props reichen zum Prüfen
    const props = (
      element as React.ReactElement<{
        loadedReceipts: LoadedReceipt[];
        eventName: string;
      }>
    ).props;
    expect(props.loadedReceipts.map((entry) => entry.kind)).toEqual([
      "missing",
      "missing",
    ]);
    expect(props.eventName).toBe("Sommerlager");
    expect(fileName).toBe("Abrechnung Sommerlager Anna.pdf");
    expect(passedOnError).toBe(onError);
    expect(sentryContext).toEqual({
      eventUid: "event-1",
      mode: ReportMode.PER_PERSON,
      receiptCount: 2,
      pdfReceiptPageCount: 0,
    });
  });
});

describe("downloadExpenseReport: Ergebnis", () => {
  test("ohne Fehler: keine Nummern", async () => {
    const {result} = await runDownload();

    expect(result).toEqual({failedReceiptNumbers: []});
  });

  test("Nummern der nicht geladenen Belege", async () => {
    mockLoadedReceipts((receipt) => ({
      kind: "failed",
      receipt,
      error: new Error("HTTP 404"),
    }));

    const {result} = await runDownload();

    expect(result).toEqual({failedReceiptNumbers: [1, 2]});
  });

  test("ohne PDF (false) keine Nummern, der Fehler steht schon oben", async () => {
    mockLoadedReceipts((receipt) => ({
      kind: "failed",
      receipt,
      error: new Error("HTTP 404"),
    }));
    mockedGenerateAndDownloadPdf.mockResolvedValue(false);

    const {result} = await runDownload();

    expect(result).toEqual({failedReceiptNumbers: []});
  });
});

describe("downloadExpenseReport: Sentry", () => {
  test("ein Ereignis mit allen Ausgaben-IDs", async () => {
    const firstError = new Error("HTTP 404");
    mockLoadedReceipts((receipt, index) => ({
      kind: "failed",
      receipt,
      error: index === 0 ? firstError : new Error("HTTP 403"),
    }));

    await runDownload();

    expect(Sentry.captureException).toHaveBeenCalledTimes(1);
    expect(Sentry.captureException).toHaveBeenCalledWith(firstError, {
      extra: {
        context: "Abrechnung: Belege laden",
        eventUid: "event-1",
        expenseIds: ["expense-image", "expense-missing"],
      },
    });
  });

  test("Netzfehler werden nicht gemeldet", async () => {
    mockLoadedReceipts((receipt) => ({
      kind: "failed",
      receipt,
      error: new TypeError("Failed to fetch"),
    }));

    const {result} = await runDownload();

    expect(Sentry.captureException).not.toHaveBeenCalled();
    // im Ergebnis bleiben sie, der Hinweis erscheint trotzdem
    expect(result.failedReceiptNumbers).toEqual([1, 2]);
  });

  test("ohne Fehler kein Ereignis", async () => {
    await runDownload();

    expect(Sentry.captureException).not.toHaveBeenCalled();
  });
});

describe("downloadExpenseReport: PDF-Belege (Story 7.3b)", () => {
  /** Beleg 1 als PDF mit 3 Seiten, Beleg 2 als Leerseite. */
  const withPdfReceipt = (
    receipt: LoadedReceipt["receipt"],
    index: number,
  ): LoadedReceipt =>
    index === 0
      ? {kind: "pdf", receipt, bytes: new Uint8Array([37, 80]), pageCount: 3}
      : {kind: "missing", receipt};

  test("ohne PDF-Beleg: kein Zwischenschritt", async () => {
    await runDownload();

    expect(mockedGenerateAndDownloadPdf.mock.calls[0][4]).toBeUndefined();
  });

  test("mit PDF-Beleg: Zwischenschritt setzt die Seiten mit den Slots ein", async () => {
    mockLoadedReceipts(withPdfReceipt);
    const embeddedBytes = new Uint8Array([1, 2, 3]);
    mockedEmbedPdfReceipts.mockResolvedValue(embeddedBytes);

    await runDownload();

    const transformPdf = mockedGenerateAndDownloadPdf.mock.calls[0][4];
    const reportBytes = new Uint8Array([9]);
    expect(await transformPdf!(reportBytes)).toBe(embeddedBytes);
    const [passedBytes, slots] = mockedEmbedPdfReceipts.mock.calls[0];
    expect(passedBytes).toBe(reportBytes);
    // 3 Seiten des PDF-Belegs + 1 Leerseite
    expect(slots.map((slot) => slot.pageNumber)).toEqual([1, 2, 3, 1]);
  });

  test("Sentry-Kontext zählt die Seiten der PDF-Belege", async () => {
    mockLoadedReceipts(withPdfReceipt);

    await runDownload();

    expect(mockedGenerateAndDownloadPdf.mock.calls[0][3]).toMatchObject({
      pdfReceiptPageCount: 3,
    });
  });

  test("verschlüsseltes PDF: nicht an Sentry, aber im Ergebnis", async () => {
    mockLoadedReceipts((receipt) => ({
      kind: "failed",
      receipt,
      error: new EncryptedReceiptError(),
    }));

    const {result} = await runDownload();

    expect(Sentry.captureException).not.toHaveBeenCalled();
    expect(result.failedReceiptNumbers).toEqual([1, 2]);
  });
});
