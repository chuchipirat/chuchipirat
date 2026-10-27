import {PDFDocument} from "pdf-lib";

/**
 * Seitenzahlen für den Zweidurchlauf der Abrechnung (Story 7.5, Spez. 8):
 * Durchlauf 1 zählt die Abrechnungsseiten, damit die Spalte «Beleg» auf die
 * richtige Seite zeigt; nach Durchlauf 2 wird geprüft, dass sich die Zahl
 * nicht verschoben hat. Nur pdf-lib, damit `embedPdfReceipts` nichts von
 * react-pdf lädt.
 */

/**
 * Wirft, wenn das fertige PDF nicht so viele Seiten hat wie erwartet. Dann
 * zeigen die Seitenverweise in der Spalte «Beleg» ins Leere; lieber kein
 * PDF als ein falsches.
 *
 * @param pageCount - Seiten des fertigen PDFs.
 * @param expectedPageCount - Abrechnungsseiten aus Durchlauf 1 plus
 *   Belegseiten.
 * @throws {Error} Wenn die Zahlen abweichen (Programmfehler, geht über
 *   `generateAndDownloadPdf` an Sentry).
 * @example
 * assertPageCount(8, 8) // ok
 */
export const assertPageCount = (
  pageCount: number,
  expectedPageCount: number,
): void => {
  if (pageCount !== expectedPageCount) {
    throw new Error(
      `Seitenzahl der Abrechnung hat sich zwischen den Durchläufen geändert: ${pageCount} statt ${expectedPageCount}.`,
    );
  }
};

/**
 * Zählt die Seiten eines fertigen PDFs (Durchlauf 1).
 *
 * @param pdfBytes - Das PDF.
 * @returns Anzahl Seiten.
 * @example
 * const reportPageCount = await countPdfPages(firstPassBytes);
 */
export const countPdfPages = async (pdfBytes: Uint8Array): Promise<number> =>
  (await PDFDocument.load(pdfBytes)).getPageCount();

/**
 * Zwischenschritt nach Durchlauf 2, wenn kein PDF-Beleg einzusetzen ist:
 * prüft nur die Seitenzahl und gibt das PDF unverändert zurück (kein
 * erneutes Speichern mit pdf-lib).
 *
 * @param reportBytes - Das fertige PDF aus react-pdf.
 * @param expectedPageCount - Erwartete Seitenzahl.
 * @returns Dieselben Bytes.
 * @throws {Error} Siehe {@link assertPageCount}.
 * @example
 * const bytes = await checkPageCount(reportBytes, 8);
 */
export const checkPageCount = async (
  reportBytes: Uint8Array,
  expectedPageCount: number,
): Promise<Uint8Array> => {
  const document = await PDFDocument.load(reportBytes);
  assertPageCount(document.getPageCount(), expectedPageCount);
  return reportBytes;
};
