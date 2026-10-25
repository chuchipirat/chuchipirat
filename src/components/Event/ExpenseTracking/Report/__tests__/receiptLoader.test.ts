/**
 * Unit-Tests für das Laden der Belege (receiptLoader.ts, Story 7.3a):
 * Dateiart aus der Endung, Reihenfolge, Laden nacheinander, Fortschritt
 * und Fehler pro Beleg.
 *
 * Download und Aufbereiten werden über `fetchBlob`/`prepareImage`/
 * `preparePdf` durch Fakes ersetzt; so läuft der Test ohne Netz und Canvas.
 * Das echte Lesen eines PDFs (pdf-lib) prüft ein eigener Block am Ende.
 */
import {PDFDocument} from "pdf-lib";

import {ReportProgress, ReportReceipt} from "../expenseReport.types";
import {
  EncryptedReceiptError,
  getReceiptFileKind,
  loadReceipts,
} from "../receiptLoader";

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
 * Inhalt, das Verkleinern eine Data-URL aus diesem Inhalt, das Lesen
 * eines PDFs feste Bytes mit 2 Seiten.
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
  const preparePdf = jest.fn(async () => ({
    bytes: new Uint8Array([37, 80, 68, 70]),
    pageCount: 2,
  }));
  return {
    progress,
    fetchBlob,
    prepareImage,
    preparePdf,
    dependencies: {
      getAttachmentUrl,
      onProgress: (entry: ReportProgress) => progress.push(entry),
      fetchBlob,
      prepareImage,
      preparePdf,
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
      [3, "pdf"],
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

  test("ohne Beleg: kein Download", async () => {
    const {dependencies, fetchBlob} = createFakes();

    await loadReceipts([MISSING_2], dependencies);

    expect(fetchBlob).not.toHaveBeenCalled();
  });

  test("PDF: lädt herunter, liest es, liefert Bytes und Seitenzahl", async () => {
    const {dependencies, fetchBlob, prepareImage, preparePdf} = createFakes();

    const [loadedReceipt] = await loadReceipts([PDF_3], dependencies);

    expect(fetchBlob).toHaveBeenCalledWith(
      "https://storage.test/event-1/expenses/expense-3.pdf",
    );
    expect(preparePdf).toHaveBeenCalledTimes(1);
    expect(prepareImage).not.toHaveBeenCalled();
    expect(loadedReceipt).toEqual({
      kind: "pdf",
      receipt: PDF_3,
      bytes: new Uint8Array([37, 80, 68, 70]),
      pageCount: 2,
    });
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
  test("zählt Bilder und PDFs, keine Leerseiten: 0 bis 3 von 3", async () => {
    const {dependencies, progress} = createFakes();

    await loadReceipts([IMAGE_1, MISSING_2, PDF_3, IMAGE_4], dependencies);

    expect(progress).toEqual([
      {stage: "loading", loaded: 0, total: 3},
      {stage: "loading", loaded: 1, total: 3},
      {stage: "loading", loaded: 2, total: 3},
      {stage: "loading", loaded: 3, total: 3},
    ]);
  });

  test("ohne Downloads kein Fortschritt", async () => {
    const {dependencies, progress} = createFakes();

    await loadReceipts([MISSING_2], dependencies);

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

  test("PDF lesen wirft: failed, die übrigen laden trotzdem", async () => {
    const {dependencies, preparePdf} = createFakes();
    preparePdf.mockRejectedValueOnce(new Error("PDF kaputt"));

    const loadedReceipts = await loadReceipts([PDF_3, IMAGE_4], dependencies);

    expect(loadedReceipts.map((loadedReceipt) => loadedReceipt.kind)).toEqual([
      "failed",
      "image",
    ]);
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

/* =====================================================================
// Echtes Lesen eines PDFs (Standard-preparePdf mit pdf-lib)
// ===================================================================== */

/**
 * Blob-Ersatz, der nur `arrayBuffer()` kann. jsdom fehlt diese Methode
 * (wie `Blob.text()`), der echte `preparePdf` braucht aber genau sie.
 * `slice()` macht eine passgenaue Kopie: Das `buffer` eines Uint8Array
 * kann grösser sein als der Ausschnitt, den das Array zeigt.
 *
 * @param bytes - Inhalt der «Datei».
 * @returns Ein Objekt, das sich für den Loader wie ein Blob verhält.
 */
const blobWithBytes = (bytes: Uint8Array): Blob =>
  ({arrayBuffer: async () => bytes.slice().buffer}) as unknown as Blob;

/**
 * Lädt einen PDF-Beleg mit dem echten `preparePdf`; nur der Download ist
 * ersetzt und liefert die gegebenen Bytes.
 *
 * @param bytes - Inhalt der PDF-Datei.
 * @returns Der geladene Beleg.
 */
const loadRealPdf = async (bytes: Uint8Array) => {
  const [loadedReceipt] = await loadReceipts([PDF_3], {
    getAttachmentUrl,
    onProgress: () => undefined,
    fetchBlob: async () => blobWithBytes(bytes),
  });
  return loadedReceipt;
};

describe("loadReceipts: echtes PDF", () => {
  test("PDF mit 2 Seiten: pageCount 2, Bytes unverändert", async () => {
    const pdfDocument = await PDFDocument.create();
    pdfDocument.addPage();
    pdfDocument.addPage();
    const bytes = await pdfDocument.save();

    const loadedReceipt = await loadRealPdf(bytes);

    expect(loadedReceipt).toMatchObject({kind: "pdf", pageCount: 2});
    expect(loadedReceipt.kind === "pdf" && loadedReceipt.bytes).toEqual(bytes);
  });

  test("keine PDF-Datei: failed", async () => {
    const loadedReceipt = await loadRealPdf(new Uint8Array([1, 2, 3]));

    expect(loadedReceipt.kind).toBe("failed");
  });

  test("passwortgeschütztes PDF: failed mit EncryptedReceiptError", async () => {
    const pdfDocument = await PDFDocument.create();
    pdfDocument.addPage();
    // pdf-lib kann nicht verschlüsseln; ein Eintrag «Encrypt» im Trailer
    // reicht, damit es das PDF als verschlüsselt erkennt
    pdfDocument.context.trailerInfo.Encrypt = pdfDocument.context.register(
      pdfDocument.context.obj({Filter: "Standard"}),
    );
    const bytes = await pdfDocument.save();

    const loadedReceipt = await loadRealPdf(bytes);

    expect(
      loadedReceipt.kind === "failed" && loadedReceipt.error,
    ).toBeInstanceOf(EncryptedReceiptError);
  });

  test("PDF ohne Seite: failed", async () => {
    // save() fügt sonst von sich aus eine leere Seite ein
    const bytes = await (
      await PDFDocument.create()
    ).save({addDefaultPage: false});

    const loadedReceipt = await loadRealPdf(bytes);

    expect(loadedReceipt).toMatchObject({
      kind: "failed",
      error: new Error("PDF-Beleg hat keine Seite."),
    });
  });
});
