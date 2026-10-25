import {
  PDFDocument,
  PDFEmbeddedPage,
  PDFPageDrawPageOptions,
  degrees,
} from "pdf-lib";

import {LoadedReceipt, ReceiptPageSlot} from "./expenseReport.types";
import {A4_SIZE, ContentBox, RECEIPT_CONTENT_BOX} from "./receiptPageLayout";

/** Ein PDF-Beleg, wie pdf-lib ihn in Story 7.3b braucht. */
type PdfReceipt = Extract<LoadedReceipt, {kind: "pdf"}>;

/**
 * Eine eingebettete Seite eines PDF-Belegs.
 *
 * @param embeddedPage - Die Seite als Objekt im Abrechnungs-PDF.
 * @param rotation - Drehung der Originalseite in Grad (0, 90, 180, 270),
 *   im Uhrzeigersinn wie `/Rotate` im PDF.
 */
type SourcePage = {embeddedPage: PDFEmbeddedPage; rotation: number};

/**
 * Rechteck in pdf-lib-Koordinaten (Ursprung unten links).
 *
 * @param left - Linke Kante.
 * @param bottom - Untere Kante.
 * @param width - Breite.
 * @param height - Höhe.
 */
type Rect = {left: number; bottom: number; width: number; height: number};

/**
 * Setzt die Seiten der PDF-Belege in die reservierten Belegseiten der
 * Abrechnung ein (Story 7.3b). react-pdf hat für jeden Slot eine Seite mit
 * Kopfzeile und leerem Feld gezeichnet; die Belegseiten sind die letzten
 * Seiten (B11, C3). Bild-, Leer- und Fehlerseiten bleiben unverändert.
 *
 * @param reportBytes - Die fertige Abrechnung aus react-pdf.
 * @param slots - Dieselben Slots, die react-pdf gezeichnet hat
 *   (`getReceiptPageSlots`).
 * @returns Die Abrechnung mit eingesetzten PDF-Seiten.
 * @throws {Error} Wenn die Abrechnung weniger Seiten hat als Slots
 *   (Programmfehler: Liste und gezeichnete Seiten passen nicht zusammen).
 * @example
 * const bytes = await embedPdfReceipts(reportBytes, getReceiptPageSlots(loadedReceipts));
 */
export const embedPdfReceipts = async (
  reportBytes: Uint8Array,
  slots: ReceiptPageSlot[],
): Promise<Uint8Array> => {
  const reportDocument = await PDFDocument.load(reportBytes);
  const firstReceiptPageIndex = reportDocument.getPageCount() - slots.length;
  if (firstReceiptPageIndex < 0) {
    throw new Error("Abrechnung hat weniger Seiten als Belegseiten.");
  }
  const sourcePages = await embedSourcePages(reportDocument, slots);

  slots.forEach((slot, slotIndex) => {
    const sourcePage = sourcePages
      .get(slot.loadedReceipt)
      ?.at(slot.pageNumber - 1);
    if (!sourcePage) {
      // kein PDF-Beleg (react-pdf hat die Seite fertig gezeichnet) oder
      // eine leere Seite ohne Inhalt: nichts einzusetzen
      return;
    }
    reportDocument
      .getPage(firstReceiptPageIndex + slotIndex)
      .drawPage(sourcePage.embeddedPage, toPlacement(sourcePage));
  });
  return reportDocument.save();
};

/**
 * Bettet alle Seiten aller PDF-Belege ins Abrechnungs-PDF ein. Jedes
 * Quell-PDF wird nur einmal geladen, nacheinander (Speicher, wie B3).
 *
 * @param reportDocument - Das Abrechnungs-PDF.
 * @param slots - Die Belegseiten.
 * @returns Pro PDF-Beleg seine Seiten in Originalreihenfolge (`null` für
 *   Seiten ohne Inhalt).
 */
const embedSourcePages = async (
  reportDocument: PDFDocument,
  slots: ReceiptPageSlot[],
): Promise<Map<LoadedReceipt, (SourcePage | null)[]>> => {
  const pdfReceipts = new Set(
    slots
      .map((slot) => slot.loadedReceipt)
      .filter(
        (loadedReceipt): loadedReceipt is PdfReceipt =>
          loadedReceipt.kind === "pdf",
      ),
  );
  const sourcePages = new Map<LoadedReceipt, (SourcePage | null)[]>();
  for (const pdfReceipt of pdfReceipts) {
    sourcePages.set(
      pdfReceipt,
      await embedReceiptPdf(reportDocument, pdfReceipt),
    );
  }
  return sourcePages;
};

/**
 * Bettet alle Seiten eines PDF-Belegs ein und merkt sich ihre Drehung;
 * pdf-lib übernimmt `/Rotate` beim Einbetten nicht (C8).
 *
 * @param reportDocument - Das Abrechnungs-PDF.
 * @param pdfReceipt - Der PDF-Beleg.
 * @returns Seine Seiten in Originalreihenfolge; `null` für eine Seite ohne
 *   Inhalt.
 */
const embedReceiptPdf = async (
  reportDocument: PDFDocument,
  pdfReceipt: PdfReceipt,
): Promise<(SourcePage | null)[]> => {
  const sourceDocument = await PDFDocument.load(pdfReceipt.bytes);
  const sourcePages: (SourcePage | null)[] = [];
  for (const page of sourceDocument.getPages()) {
    // Eine Seite ganz ohne Inhalt kann pdf-lib nicht einbetten (wirft);
    // sie zeigt ohnehin nichts, das Feld bleibt einfach leer
    sourcePages.push(
      page.node.Contents() === undefined
        ? null
        : {
            embeddedPage: await reportDocument.embedPage(page),
            rotation: page.getRotation().angle,
          },
    );
  }
  return sourcePages;
};

/**
 * Lage einer eingebetteten Seite im Feld der Belegseite.
 *
 * @param sourcePage - Die eingebettete Seite.
 * @returns Optionen für `drawPage`.
 */
const toPlacement = ({
  embeddedPage,
  rotation,
}: SourcePage): PDFPageDrawPageOptions =>
  getEmbeddedPagePlacement(
    RECEIPT_CONTENT_BOX,
    embeddedPage.width,
    embeddedPage.height,
    rotation,
  );

/**
 * Berechnet, wo und wie gross eine Seite ins Feld gezeichnet wird: so gross
 * wie möglich, ohne Verzerrung, mittig (wie `objectFit: "contain"`), und
 * so gedreht, wie sie im Original angezeigt wird (C8).
 *
 * pdf-lib misst von unten links und dreht um die linke untere Ecke der
 * gezeichneten Seite, gegen den Uhrzeigersinn. `/Rotate` im PDF dreht im
 * Uhrzeigersinn; 90° im Uhrzeigersinn sind 270° dagegen, darum
 * `rotate: degrees((360 - rotation) % 360)`.
 *
 * @param box - Das Feld, gemessen von oben links (`RECEIPT_CONTENT_BOX`).
 * @param sourceWidth - Breite der Originalseite, ungedreht.
 * @param sourceHeight - Höhe der Originalseite, ungedreht.
 * @param rotation - Drehung der Originalseite in Grad (Vielfaches von 90).
 * @returns `x`, `y`, `width`, `height` und `rotate` für `drawPage`.
 * @example
 * // A4-Seite, nicht gedreht
 * getEmbeddedPagePlacement(RECEIPT_CONTENT_BOX, 595.28, 841.89, 0)
 */
export const getEmbeddedPagePlacement = (
  box: ContentBox,
  sourceWidth: number,
  sourceHeight: number,
  rotation: number,
): PDFPageDrawPageOptions => {
  const normalizedRotation = ((rotation % 360) + 360) % 360;
  const isSideways = normalizedRotation === 90 || normalizedRotation === 270;
  // so breit/hoch, wie die Seite im Original angezeigt wird
  const shownWidth = isSideways ? sourceHeight : sourceWidth;
  const shownHeight = isSideways ? sourceWidth : sourceHeight;
  const scale = Math.min(box.width / shownWidth, box.height / shownHeight);
  const target = centerInBox(box, shownWidth * scale, shownHeight * scale);

  return {
    ...getRotationOrigin(target, normalizedRotation),
    width: sourceWidth * scale,
    height: sourceHeight * scale,
    rotate: degrees((360 - normalizedRotation) % 360),
  };
};

/**
 * Rechteck der gegebenen Grösse mittig im Feld, umgerechnet auf pdf-lib
 * (Ursprung unten links): `y = Seitenhöhe - top - height` (C2).
 *
 * @param box - Das Feld, gemessen von oben links.
 * @param width - Breite des Rechtecks.
 * @param height - Höhe des Rechtecks.
 * @returns Das Rechteck in pdf-lib-Koordinaten.
 */
const centerInBox = (box: ContentBox, width: number, height: number): Rect => {
  const boxBottom = A4_SIZE.height - box.top - box.height;
  return {
    left: box.left + (box.width - width) / 2,
    bottom: boxBottom + (box.height - height) / 2,
    width,
    height,
  };
};

/**
 * Punkt, an dem pdf-lib die gedrehte Seite ansetzen muss, damit sie genau
 * im Zielrechteck liegt. Gedreht wird um die linke untere Ecke der Seite;
 * nach einer Drehung im Uhrzeigersinn liegt diese Ecke an einer anderen
 * Ecke des Zielrechtecks:
 * - 0°: unten links
 * - 90°: oben links
 * - 180°: oben rechts
 * - 270°: unten rechts
 *
 * @param target - Zielrechteck (so, wie die Seite angezeigt wird).
 * @param rotation - Drehung 0, 90, 180 oder 270.
 * @returns `x` und `y` für `drawPage`.
 */
const getRotationOrigin = (
  target: Rect,
  rotation: number,
): {x: number; y: number} => {
  const right = target.left + target.width;
  const top = target.bottom + target.height;
  switch (rotation) {
    case 90:
      return {x: target.left, y: top};
    case 180:
      return {x: right, y: top};
    case 270:
      return {x: right, y: target.bottom};
    default:
      return {x: target.left, y: target.bottom};
  }
};
