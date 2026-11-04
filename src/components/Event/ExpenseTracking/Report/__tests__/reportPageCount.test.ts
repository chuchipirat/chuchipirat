/**
 * Unit-Tests für die Seitenzahlen des Zweidurchlaufs (reportPageCount.ts,
 * Story 7.5) mit echten, im Test erzeugten PDFs.
 */
import {PDFDocument} from "pdf-lib";

import {
  assertPageCount,
  checkPageCount,
  countPdfPages,
} from "../reportPageCount";

/**
 * Erstellt ein leeres PDF.
 *
 * @param pageCount - Anzahl Seiten.
 * @returns Die Bytes.
 */
const createPdf = async (pageCount: number): Promise<Uint8Array> => {
  const pdfDocument = await PDFDocument.create();
  for (let index = 0; index < pageCount; index += 1) {
    pdfDocument.addPage();
  }
  return pdfDocument.save();
};

describe("assertPageCount", () => {
  test("gleich: kein Fehler", () => {
    expect(() => assertPageCount(8, 8)).not.toThrow();
  });

  test("abweichend: Fehler mit beiden Zahlen", () => {
    expect(() => assertPageCount(9, 8)).toThrow(
      "Seitenzahl der Abrechnung hat sich zwischen den Durchläufen geändert: 9 statt 8.",
    );
  });
});

describe("countPdfPages", () => {
  test("zählt die Seiten", async () => {
    expect(await countPdfPages(await createPdf(3))).toBe(3);
  });
});

describe("checkPageCount", () => {
  test("stimmt: dieselben Bytes zurück (nicht neu gespeichert)", async () => {
    const reportBytes = await createPdf(2);

    expect(await checkPageCount(reportBytes, 2)).toBe(reportBytes);
  });

  test("weicht ab: Fehler", async () => {
    await expect(checkPageCount(await createPdf(2), 3)).rejects.toThrow(
      "2 statt 3",
    );
  });
});
