/**
 * Unit-Tests für das Laden der Belege (receiptLoader.ts, Story 7.3a):
 * Dateiart aus der Endung, Reihenfolge, Laden nacheinander, Fortschritt
 * und Fehler pro Beleg.
 *
 * Download und Verkleinern werden über `fetchBlob`/`prepareImage` durch
 * Fakes ersetzt; so läuft der Test ohne Netz und Canvas.
 */
import {ReportProgress, ReportReceipt} from "../expenseReport.types";
import {getReceiptFileKind, loadReceipts} from "../receiptLoader";

/* =====================================================================
// Fixture
// ===================================================================== */

/**
 * Erstellt einen Beleg.
 *
 * @param receiptNumber - Belegnummer.
 * @param attachmentPath - Pfad im Storage, `null` ohne Beleg.
 * @returns Der Beleg.
 */
const makeReceipt = (
  receiptNumber: number,
  attachmentPath: string | null,
): ReportReceipt => ({
  receiptNumber,
  expenseId: `expense-${receiptNumber}`,
  attachmentPath,
  date: new Date(2026, 6, 12),
  label: `Ausgabe ${receiptNumber}`,
  amountInCents: 1000,
  currency: "CHF",
});

const IMAGE_1 = makeReceipt(1, "event-1/expenses/expense-1.jpg");
const MISSING_2 = makeReceipt(2, null);
const PDF_3 = makeReceipt(3, "event-1/expenses/expense-3.pdf");
const IMAGE_4 = makeReceipt(4, "event-1/expenses/expense-4.png");

/** URL eines Belegs, wie sie die Seite liefern würde. */
const getAttachmentUrl = (attachmentPath: string) =>
  `https://storage.test/${attachmentPath}`;

/**
 * Fake-Abhängigkeiten: Der Download liefert einen Blob mit der URL als
 * Inhalt, das Verkleinern eine Data-URL aus diesem Inhalt.
 *
 * @returns Die Fakes und die gemeldeten Fortschritte.
 */
const createFakes = () => {
  const progress: ReportProgress[] = [];
  // jsdom kennt kein Blob.text(); darum merkt sich der Fake die URL je Blob
  const urlByBlob = new Map<Blob, string>();
  const fetchBlob = jest.fn((url: string) => {
    const blob = new Blob([url]);
    urlByBlob.set(blob, url);
    return Promise.resolve(blob);
  });
  const prepareImage = jest.fn(
    async (blob: Blob) => `data:image/jpeg;base64,${urlByBlob.get(blob)}`,
  );
  return {
    progress,
    fetchBlob,
    prepareImage,
    dependencies: {
      getAttachmentUrl,
      onProgress: (entry: ReportProgress) => progress.push(entry),
      fetchBlob,
      prepareImage,
    },
  };
};

/* =====================================================================
// getReceiptFileKind
// ===================================================================== */

describe("getReceiptFileKind", () => {
  test.each([
    ["event-1/expenses/expense-1.jpg", "image"],
    ["event-1/expenses/expense-1.png", "image"],
    ["event-1/expenses/expense-1.pdf", "pdf"],
    ["event-1/expenses/expense-1.JPG", "image"],
    ["event-1/expenses/expense-1", "unknown"],
    ["event-1/expenses/expense-1.heic", "unknown"],
  ])("%s → %s", (attachmentPath, expectedKind) => {
    expect(getReceiptFileKind(attachmentPath)).toBe(expectedKind);
  });
});

/* =====================================================================
// loadReceipts
// ===================================================================== */

describe("loadReceipts: Ergebnis", () => {
  test("ein Eintrag pro Beleg in derselben Reihenfolge", async () => {
    const {dependencies} = createFakes();

    const loadedReceipts = await loadReceipts(
      [IMAGE_1, MISSING_2, PDF_3, IMAGE_4],
      dependencies,
    );

    expect(
      loadedReceipts.map((loadedReceipt) => [
        loadedReceipt.receipt.receiptNumber,
        loadedReceipt.kind,
      ]),
    ).toEqual([
      [1, "image"],
      [2, "missing"],
      [3, "pdfPending"],
      [4, "image"],
    ]);
  });

  test("Bild: lädt über getAttachmentUrl, verkleinert, liefert Data-URL", async () => {
    const {dependencies, fetchBlob, prepareImage} = createFakes();

    const [loadedReceipt] = await loadReceipts([IMAGE_1], dependencies);

    const url = "https://storage.test/event-1/expenses/expense-1.jpg";
    expect(fetchBlob).toHaveBeenCalledWith(url);
    expect(prepareImage).toHaveBeenCalledTimes(1);
    expect(loadedReceipt).toEqual({
      kind: "image",
      receipt: IMAGE_1,
      dataUrl: `data:image/jpeg;base64,${url}`,
    });
  });

  test("ohne Beleg und PDF-Beleg: kein Download", async () => {
    const {dependencies, fetchBlob} = createFakes();

    await loadReceipts([MISSING_2, PDF_3], dependencies);

    expect(fetchBlob).not.toHaveBeenCalled();
  });

  test("unbekannte Endung: failed, kein Download", async () => {
    const {dependencies, fetchBlob} = createFakes();
    const unknownReceipt = makeReceipt(5, "event-1/expenses/expense-5.heic");

    const [loadedReceipt] = await loadReceipts([unknownReceipt], dependencies);

    expect(loadedReceipt.kind).toBe("failed");
    expect(fetchBlob).not.toHaveBeenCalled();
  });
});

describe("loadReceipts: nacheinander", () => {
  test("der zweite Download startet erst nach dem ersten", async () => {
    const {dependencies, fetchBlob} = createFakes();
    let finishFirstDownload: (blob: Blob) => void = () => undefined;
    fetchBlob.mockImplementationOnce(
      () =>
        new Promise<Blob>((resolve) => {
          finishFirstDownload = resolve;
        }),
    );

    const loading = loadReceipts([IMAGE_1, IMAGE_4], dependencies);
    // offene Promises abarbeiten lassen
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(fetchBlob).toHaveBeenCalledTimes(1);

    finishFirstDownload(new Blob(["erster"]));
    await loading;
    expect(fetchBlob).toHaveBeenCalledTimes(2);
  });
});

describe("loadReceipts: Fortschritt", () => {
  test("zählt nur Bilder: 0 von 2, 1 von 2, 2 von 2", async () => {
    const {dependencies, progress} = createFakes();

    await loadReceipts([IMAGE_1, MISSING_2, PDF_3, IMAGE_4], dependencies);

    expect(progress).toEqual([
      {stage: "loading", loaded: 0, total: 2},
      {stage: "loading", loaded: 1, total: 2},
      {stage: "loading", loaded: 2, total: 2},
    ]);
  });

  test("ohne Bilder kein Fortschritt", async () => {
    const {dependencies, progress} = createFakes();

    await loadReceipts([MISSING_2, PDF_3], dependencies);

    expect(progress).toEqual([]);
  });
});

describe("loadReceipts: Fehler pro Beleg", () => {
  test("Download wirft: failed mit dem Fehler, die übrigen laden trotzdem", async () => {
    const {dependencies, fetchBlob, progress} = createFakes();
    const error = new Error("Netz weg");
    fetchBlob.mockRejectedValueOnce(error);

    const loadedReceipts = await loadReceipts([IMAGE_1, IMAGE_4], dependencies);

    expect(loadedReceipts[0]).toEqual({
      kind: "failed",
      receipt: IMAGE_1,
      error,
    });
    expect(loadedReceipts[1].kind).toBe("image");
    // der fehlgeschlagene Beleg zählt im Fortschritt mit
    expect(progress.at(-1)).toEqual({stage: "loading", loaded: 2, total: 2});
  });

  test("Verkleinern wirft: failed", async () => {
    const {dependencies, prepareImage} = createFakes();
    prepareImage.mockRejectedValueOnce(new Error("Bild kaputt"));

    const [loadedReceipt] = await loadReceipts([IMAGE_1], dependencies);

    expect(loadedReceipt.kind).toBe("failed");
  });

  test("Standard-Download: HTTP 404 wird zu failed (fetch wirft dabei nicht)", async () => {
    const originalFetch = global.fetch;
    global.fetch = jest.fn().mockResolvedValue({ok: false, status: 404});
    const {dependencies} = createFakes();

    try {
      const [loadedReceipt] = await loadReceipts([IMAGE_1], {
        getAttachmentUrl: dependencies.getAttachmentUrl,
        onProgress: dependencies.onProgress,
        prepareImage: dependencies.prepareImage,
      });

      expect(loadedReceipt).toMatchObject({
        kind: "failed",
        error: new Error("Beleg nicht abrufbar (HTTP 404)"),
      });
    } finally {
      global.fetch = originalFetch;
    }
  });
});
