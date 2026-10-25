import {PDF_TOKENS} from "../../../../constants/pdfTokens";

/**
 * Grösse einer A4-Seite in Punkt (1 pt = 1/72 Zoll), wie react-pdf sie für
 * `size="A4"` verwendet.
 */
export const A4_SIZE = {width: 595.28, height: 841.89};

/**
 * Zeilenhöhe als Vielfaches der Schriftgrösse. react-pdf rechnet mit den
 * Massen der Schrift (Roboto etwa 1.17); 1.2 lässt etwas Reserve.
 */
const LINE_HEIGHT_FACTOR = 1.2;

/**
 * Höhe der Seitenkopfzeile mit dem Anlassnamen (`Header` aus
 * `pdfComponents`, Style `header` in `stylesGeneralPdf`): eine Zeile in
 * `fontSize.small` plus `marginBottom: 20`.
 */
const PAGE_HEADER_HEIGHT = PDF_TOKENS.fontSize.small * LINE_HEIGHT_FACTOR + 20;

/**
 * Höhe der Belegkopfzeile «Beleg 3 · … · Seite 2 von 3» (Style
 * `receiptHeader`): bis zu zwei Zeilen in 12 pt, weil lange Bezeichnungen
 * umbrechen, plus `paddingBottom: 6`, Linie 0.5 und `marginBottom: 10`.
 */
const RECEIPT_HEADER_HEIGHT = 2 * 12 * LINE_HEIGHT_FACTOR + 6 + 0.5 + 10;

/** Oberkante des Felds, von oben gemessen: unter beiden Kopfzeilen. */
const RECEIPT_CONTENT_TOP =
  PDF_TOKENS.margin.top + PAGE_HEADER_HEIGHT + RECEIPT_HEADER_HEIGHT;

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
 * Feld einer PDF-Belegseite, in das pdf-lib die Originalseite zeichnet.
 * Eine Quelle für beide Bibliotheken: der Style
 * `receiptPdfBox` (react-pdf) und `embedPdfReceipts` (pdf-lib) lesen diese
 * Werte, darum können sie nicht auseinanderlaufen.
 *
 * Alle Werte in Punkt, gemessen wie in react-pdf **von der oberen linken
 * Ecke**. pdf-lib misst `y` von unten und rechnet selbst um:
 * `y = A4_SIZE.height - top - height`.
 *
 * Ändert sich der Style `header` oder `receiptHeader`, müssen
 * `PAGE_HEADER_HEIGHT` bzw. `RECEIPT_HEADER_HEIGHT` mitziehen; sonst
 * überlappt die Kopfzeile das Feld.
 *
 * @param top - Abstand der Oberkante vom oberen Seitenrand; Platz für die
 *   Seitenkopfzeile und eine bis zu zweizeilige Belegkopfzeile (ca. 91).
 * @param left - Abstand vom linken Seitenrand.
 * @param width - Breite des Felds.
 * @param height - Höhe des Felds bis zum unteren Rand; `margin.bottom`
 *   hält die Fusszeile frei (ca. 686).
 */
export const RECEIPT_CONTENT_BOX: ContentBox = {
  top: RECEIPT_CONTENT_TOP,
  left: PDF_TOKENS.margin.horizontal,
  width: A4_SIZE.width - PDF_TOKENS.margin.horizontal * 2,
  height: A4_SIZE.height - RECEIPT_CONTENT_TOP - PDF_TOKENS.margin.bottom,
};
