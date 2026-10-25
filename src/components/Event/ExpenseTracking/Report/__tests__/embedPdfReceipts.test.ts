/**
 * Unit-Tests für das Einsetzen der PDF-Belege (embedPdfReceipts.ts,
 * Story 7.3b): Lage im Feld (Skalierung, Mitte, Drehung) und das
 * Einsetzen in die richtigen Seiten mit echten, im Test erzeugten PDFs.
 */
import {PDFDocument, PDFName, PDFPage, degrees} from "pdf-lib";

import {embedPdfReceipts, getEmbeddedPagePlacement} from "../embedPdfReceipts";
import {LoadedReceipt, ReportReceipt} from "../expenseReport.types";
import {A4_SIZE} from "../receiptPageLayout";
import {getReceiptPageSlots} from "../receiptPageSlots";

/* =====================================================================
// getEmbeddedPagePlacement
// ===================================================================== */

/**
 * Feld mit runden Zahlen: 400 × 600, oben 100, links 50. Unterkante in
 * pdf-lib-Koordinaten: 841.89 − 100 − 600 = 141.89.
 */
const BOX = {top: 100, left: 50, width: 400, height: 600};
const BOX_BOTTOM = A4_SIZE.height - BOX.top - BOX.height;

/**
 * Lage mit gerundeten Zahlen, damit Rundungsfehler den Vergleich nicht
 * stören.
 *
 * @param sourceWidth - Breite der Originalseite.
 * @param sourceHeight - Höhe der Originalseite.
 * @param rotation - Drehung in Grad.
 * @returns Die gerundete Lage.
 */
const placementOf = (
  sourceWidth: number,
  sourceHeight: number,
  rotation: number,
) => {
  const {x, y, width, height, rotate} = getEmbeddedPagePlacement(
    BOX,
    sourceWidth,
    sourceHeight,
    rotation,
  );
  const round = (value = 0) => Math.round(value * 100) / 100;
  return {
    x: round(x),
    y: round(y),
    width: round(width),
    height: round(height),
    rotate,
  };
};

describe("getEmbeddedPagePlacement", () => {
  test("Hochformat im Seitenverhältnis des Felds: füllt das Feld", () => {
    expect(placementOf(200, 300, 0)).toEqual({
      x: 50,
      y: BOX_BOTTOM,
      width: 400,
      height: 600,
      rotate: degrees(0),
    });
  });

  test("Querformat: volle Breite, senkrecht in der Mitte", () => {
    // Faktor 1 (Breite begrenzt), Rand oben und unten je (600 − 200) / 2
    expect(placementOf(400, 200, 0)).toEqual({
      x: 50,
      y: Math.round((BOX_BOTTOM + 200) * 100) / 100,
      width: 400,
      height: 200,
      rotate: degrees(0),
    });
  });

  test("90° gedreht: Breite und Höhe getauscht, Ansatzpunkt oben links", () => {
    // angezeigt 200 × 400 → Faktor 1.5 (Höhe begrenzt) → 300 × 600,
    // waagrecht mittig: links 50 + (400 − 300) / 2 = 100
    expect(placementOf(400, 200, 90)).toEqual({
      x: 100,
      y: Math.round((BOX_BOTTOM + 600) * 100) / 100,
      width: 600,
      height: 300,
      rotate: degrees(270),
    });
  });

  test("270° gedreht: Ansatzpunkt unten rechts", () => {
    expect(placementOf(400, 200, 270)).toEqual({
      x: 400,
      y: BOX_BOTTOM,
      width: 600,
      height: 300,
      rotate: degrees(90),
    });
  });

  test("180° gedreht: Ansatzpunkt oben rechts", () => {
    expect(placementOf(200, 300, 180)).toMatchObject({
      x: 450,
      y: Math.round((BOX_BOTTOM + 600) * 100) / 100,
      rotate: degrees(180),
    });
  });

  test("negative Drehung (−90) gilt wie 270°", () => {
    expect(placementOf(400, 200, -90)).toEqual(placementOf(400, 200, 270));
  });
});

/* =====================================================================
// embedPdfReceipts
// ===================================================================== */

/**
 * Erstellt einen Beleg.
 *
 * @param receiptNumber - Belegnummer.
 * @returns Der Beleg.
 */
const makeReceipt = (receiptNumber: number): ReportReceipt => ({
  receiptNumber,
  expenseId: `expense-${receiptNumber}`,
  attachmentPath: null,
  date: new Date(2026, 6, 12),
  label: `Ausgabe ${receiptNumber}`,
  amountInCents: 1000,
  currency: "CHF",
});

/**
 * Erstellt ein PDF mit A4-Seiten. Seiten mit Inhalt bekommen ein Rechteck;
 * ganz leere Seiten haben keinen Inhalt (`Contents`), wie die reservierten
 * Belegseiten einer Abrechnung im Test.
 *
 * @param pageCount - Anzahl Seiten.
 * @param withContent - Rechteck auf jede Seite zeichnen.
 * @returns Die Bytes.
 */
const createPdf = async (
  pageCount: number,
  withContent = false,
): Promise<Uint8Array> => {
  const pdfDocument = await PDFDocument.create();
  for (let index = 0; index < pageCount; index += 1) {
    const page = pdfDocument.addPage([A4_SIZE.width, A4_SIZE.height]);
    if (withContent) {
      page.drawRectangle({x: 50, y: 50, width: 100, height: 100});
    }
  }
  return pdfDocument.save();
};

/**
 * `true`, wenn auf der Seite etwas eingebettet ist. `drawPage` legt die
 * eingesetzte Seite als «XObject» in den Ressourcen der Seite ab.
 *
 * @param page - Seite der Abrechnung.
 * @returns `true` mit eingesetzter Seite.
 */
const hasEmbeddedPage = (page: PDFPage): boolean =>
  page.node.Resources()?.get(PDFName.of("XObject")) !== undefined;

describe("embedPdfReceipts", () => {
  test("setzt die Seiten nur in die Belegseiten des PDF-Belegs ein", async () => {
    // Abrechnung: 1 Tabellenseite + Leerseite (Beleg 1) + 2 Seiten (Beleg 2)
    const loadedReceipts: LoadedReceipt[] = [
      {kind: "missing", receipt: makeReceipt(1)},
      {
        kind: "pdf",
        receipt: makeReceipt(2),
        bytes: await createPdf(2, true),
        pageCount: 2,
      },
    ];
    const reportBytes = await createPdf(4);

    const resultBytes = await embedPdfReceipts(
      reportBytes,
      getReceiptPageSlots(loadedReceipts),
    );

    const resultDocument = await PDFDocument.load(resultBytes);
    expect(resultDocument.getPageCount()).toBe(4);
    expect(resultDocument.getPages().map(hasEmbeddedPage)).toEqual([
      false,
      false,
      true,
      true,
    ]);
  });

  test("leere Seite im PDF-Beleg: kein Fehler, das Feld bleibt leer", async () => {
    const loadedReceipts: LoadedReceipt[] = [
      {
        kind: "pdf",
        receipt: makeReceipt(1),
        bytes: await createPdf(1),
        pageCount: 1,
      },
    ];

    const resultBytes = await embedPdfReceipts(
      await createPdf(2),
      getReceiptPageSlots(loadedReceipts),
    );

    const resultDocument = await PDFDocument.load(resultBytes);
    expect(resultDocument.getPages().map(hasEmbeddedPage)).toEqual([
      false,
      false,
    ]);
  });

  test("weniger Seiten als Belegseiten: Fehler (Liste passt nicht)", async () => {
    const loadedReceipts: LoadedReceipt[] = [
      {
        kind: "pdf",
        receipt: makeReceipt(1),
        bytes: await createPdf(3),
        pageCount: 3,
      },
    ];

    await expect(
      embedPdfReceipts(await createPdf(2), getReceiptPageSlots(loadedReceipts)),
    ).rejects.toThrow("Abrechnung hat weniger Seiten als Belegseiten.");
  });
});
