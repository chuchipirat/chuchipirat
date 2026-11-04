import {PDF_TOKENS} from "../../../../constants/pdfTokens";

/**
 * Grösse einer A4-Seite in Punkt (1 pt = 1/72 Zoll), wie react-pdf sie für
 * `size="A4"` verwendet.
 */
export const A4_SIZE = {width: 595.28, height: 841.89};

/**
 * Oberer Seitenrand aller Seiten der Abrechnung (Story 7.5), auch der
 * Abrechnungsseiten (`reportLayoutStyles.page`).
 */
export const REPORT_PAGE_PADDING_TOP = 30;

/**
 * Feste Höhe des Belegkopfs (Nummer im Kreis, Bezeichnung über höchstens
 * zwei Zeilen, Zeile «Datum · Budget · Person», Betrag). Fest, damit das
 * Feld darunter für react-pdf und pdf-lib an derselben Stelle liegt.
 */
export const RECEIPT_HEADER_HEIGHT = 44;

/** Abstand zwischen Kopf und Teal-Linie. */
export const RECEIPT_HEADER_PADDING_BOTTOM = 8;

/** Dicke der Teal-Linie unter dem Kopf. */
export const RECEIPT_HEADER_LINE_WIDTH = 0.5;

/** Abstand zwischen Teal-Linie und Feld. */
export const RECEIPT_HEADER_MARGIN_BOTTOM = 12;

/** Oberkante des Felds, von oben gemessen: unter dem Belegkopf. */
const RECEIPT_CONTENT_TOP =
  REPORT_PAGE_PADDING_TOP +
  RECEIPT_HEADER_HEIGHT +
  RECEIPT_HEADER_PADDING_BOTTOM +
  RECEIPT_HEADER_LINE_WIDTH +
  RECEIPT_HEADER_MARGIN_BOTTOM;

/**
 * Rechteck auf einer Seite in Punkt, gemessen von der oberen linken Ecke
 * (wie react-pdf).
 *
 * @param top - Abstand der Oberkante vom oberen Seitenrand.
 * @param left - Abstand vom linken Seitenrand.
 * @param width - Breite.
 * @param height - Höhe.
 */
export type ContentBox = {
  top: number;
  left: number;
  width: number;
  height: number;
};

/**
 * Feld einer Belegseite unter dem Kopf: Dort steht das Bild, das
 * Klebefeld, oder pdf-lib zeichnet die Originalseite eines PDF-Belegs
 * hinein. Eine Quelle für beide Bibliotheken: der Style
 * `receiptContentBox` (react-pdf) und `embedPdfReceipts` (pdf-lib) lesen
 * diese Werte, darum können sie nicht auseinanderlaufen.
 *
 * Alle Werte in Punkt, gemessen wie in react-pdf **von der oberen linken
 * Ecke**. pdf-lib misst `y` von unten und rechnet selbst um:
 * `y = A4_SIZE.height - top - height`.
 *
 * Der Style `receiptHeader` liest die Konstanten oben; der Kopf ist fest
 * hoch, darum überlappt er das Feld nie.
 *
 * @param top - Abstand der Oberkante vom oberen Seitenrand; Platz für
 *   den Belegkopf (ca. 95).
 * @param left - Abstand vom linken Seitenrand.
 * @param width - Breite des Felds.
 * @param height - Höhe des Felds bis zum unteren Rand; `margin.bottom`
 *   hält den Footer frei (ca. 682).
 */
export const RECEIPT_CONTENT_BOX: ContentBox = {
  top: RECEIPT_CONTENT_TOP,
  left: PDF_TOKENS.margin.horizontal,
  width: A4_SIZE.width - PDF_TOKENS.margin.horizontal * 2,
  height: A4_SIZE.height - RECEIPT_CONTENT_TOP - PDF_TOKENS.margin.bottom,
};
