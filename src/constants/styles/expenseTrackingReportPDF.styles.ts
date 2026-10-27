/**
 * Stildefinitionen für die PDF-Abrechnung.
 *
 * Gleiche Gestaltung wie Materialliste und Menüplan (Teal-Akzent, dünner
 * Titel), damit alle chuchipirat-PDFs zusammenpassen.
 *
 * Wird von `ExpenseTracking/Report/expenseReportPdf.tsx` verwendet.
 */
import {StyleSheet} from "@react-pdf/renderer";
import {APP_PRIMARY} from "../stylesMaterialListPdf";
import {PDF_TOKENS} from "../pdfTokens";
import {RECEIPT_CONTENT_BOX} from "../../components/Event/ExpenseTracking/Report/receiptPageLayout";

/** Gemeinsame Schrift aller Tabellenzellen. */
const CELL_BASE = {
  fontFamily: PDF_TOKENS.fontFamily,
  fontStyle: "normal" as const,
  fontWeight: PDF_TOKENS.fontWeight.normal,
  fontSize: 10,
  paddingVertical: 3,
  paddingHorizontal: 2,
};

export const pdfStyles = StyleSheet.create({
  /* ── Seite und Titel ────────────────────────── */
  body: {
    paddingTop: PDF_TOKENS.margin.top,
    paddingBottom: PDF_TOKENS.margin.bottom,
    paddingHorizontal: PDF_TOKENS.margin.horizontal,
  },
  title: {
    fontSize: 28,
    textAlign: "center",
    fontFamily: PDF_TOKENS.fontFamily,
    fontStyle: "normal",
    fontWeight: PDF_TOKENS.fontWeight.thin,
    marginBottom: 4,
  },
  titleUnderline: {
    borderBottomWidth: 1,
    borderBottomColor: APP_PRIMARY,
    borderBottomStyle: "solid",
    marginBottom: 4,
  },
  subTitle: {
    fontSize: 14,
    textAlign: "center",
    fontFamily: PDF_TOKENS.fontFamily,
    fontStyle: "normal",
    fontWeight: PDF_TOKENS.fontWeight.thin,
    marginBottom: 4,
  },
  infoSectionDivider: {
    borderBottomWidth: 0.5,
    borderBottomColor: "#00606433", // APP_PRIMARY mit ~20% Deckkraft
    borderBottomStyle: "solid",
    marginBottom: 8,
  },

  /* ── Personen und Budgets ───────────────────── */
  section: {
    marginTop: 14,
  },
  payeeHeading: {
    fontSize: 14,
    fontFamily: PDF_TOKENS.fontFamily,
    fontStyle: "normal",
    fontWeight: PDF_TOKENS.fontWeight.bold,
    color: APP_PRIMARY,
  },
  noRefundHint: {
    fontSize: PDF_TOKENS.fontSize.small,
    fontFamily: PDF_TOKENS.fontFamily,
    color: PDF_TOKENS.color.gray,
    marginTop: 2,
  },
  /* ── Rückerstattung an (Story 7.4) ─────────── */
  /** Block unter dem Personennamen, vor den Tabellen (F8). */
  refundBlock: {
    marginTop: 6,
    marginBottom: 4,
    width: "70%",
  },
  refundHeading: {
    fontSize: PDF_TOKENS.fontSize.small,
    fontFamily: PDF_TOKENS.fontFamily,
    fontStyle: "normal",
    fontWeight: PDF_TOKENS.fontWeight.bold,
    color: APP_PRIMARY,
    marginBottom: 2,
  },
  refundRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    marginTop: 3,
  },
  refundLabel: {
    ...CELL_BASE,
    width: "28%",
    paddingVertical: 1,
    color: PDF_TOKENS.color.gray,
  },
  refundValue: {
    ...CELL_BASE,
    flexGrow: 1,
    paddingVertical: 1,
  },
  /**
   * Linie zum Ausfüllen von Hand. Höher als eine Textzeile, damit man
   * bequem darauf schreiben kann.
   */
  refundLine: {
    flexGrow: 1,
    height: 18,
    borderBottomWidth: 0.5,
    borderBottomColor: PDF_TOKENS.color.gray,
    borderBottomStyle: "solid",
  },
  groupHeading: {
    fontSize: 11,
    fontFamily: PDF_TOKENS.fontFamily,
    fontStyle: "normal",
    fontWeight: PDF_TOKENS.fontWeight.bold,
    marginTop: 8,
  },
  table: {
    marginTop: 4,
  },

  /* ── Tabelle ────────────────────────────────── */
  tableHeaderRow: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: APP_PRIMARY,
    borderBottomStyle: "solid",
  },
  tableHeaderCell: {
    ...CELL_BASE,
    fontSize: PDF_TOKENS.fontSize.small,
    fontWeight: PDF_TOKENS.fontWeight.bold,
    color: APP_PRIMARY,
  },
  tableRow: {
    flexDirection: "row",
    ...PDF_TOKENS.borderBottomThin,
  },
  cell: {
    ...CELL_BASE,
  },
  /** Kommentar als zweite, kleinere Zeile unter der Bezeichnung (E8). */
  comment: {
    ...CELL_BASE,
    paddingTop: 0,
    fontSize: 8,
    color: PDF_TOKENS.color.gray,
  },

  /* ── Spaltenbreiten (Summe je Modus = 100%) ─── */
  colReceipt: {width: "8%", textAlign: "center"},
  colDate: {width: "14%"},
  /** Modus A: Platz für die Budgetspalte lassen. */
  colLabel: {width: "46%"},
  /** Modus B: keine Budgetspalte, Bezeichnung breiter. */
  colLabelWide: {width: "62%"},
  colBudget: {width: "16%"},
  colAmount: {width: "16%", textAlign: "right"},

  /* ── Summen ─────────────────────────────────── */
  totalRow: {
    flexDirection: "row",
  },
  /** Beschriftung über alle Spalten ausser «Betrag». */
  totalLabel: {...CELL_BASE, width: "84%", textAlign: "right"},
  totalLabelBold: {
    ...CELL_BASE,
    width: "84%",
    textAlign: "right",
    fontWeight: PDF_TOKENS.fontWeight.bold,
  },
  totalAmount: {...CELL_BASE, width: "16%", textAlign: "right"},
  totalAmountBold: {
    ...CELL_BASE,
    width: "16%",
    textAlign: "right",
    fontWeight: PDF_TOKENS.fontWeight.bold,
  },
  grandTotalBlock: {
    marginTop: 20,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: APP_PRIMARY,
    borderTopStyle: "solid",
  },
  /* ── Belegseiten  ──────────────────────────── */
  receiptPage: {
    paddingTop: PDF_TOKENS.margin.top,
    paddingBottom: PDF_TOKENS.margin.bottom,
    paddingHorizontal: PDF_TOKENS.margin.horizontal,
    flexDirection: "column",
  },
  receiptHeader: {
    fontSize: 12,
    fontFamily: PDF_TOKENS.fontFamily,
    fontStyle: "normal",
    fontWeight: PDF_TOKENS.fontWeight.bold,
    color: APP_PRIMARY,
    paddingBottom: 6,
    marginBottom: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: APP_PRIMARY,
    borderBottomStyle: "solid",
  },
  /**
   * Nimmt den ganzen Rest der Seite ein (Bild bzw. gestricheltes Feld).
   * `justifyContent: "center"` setzt das gestrichelte Feld senkrecht in die
   * Mitte; das Bild ist 100 % hoch und bleibt davon unberührt.
   */
  receiptBody: {
    flexGrow: 1,
    justifyContent: "center",
  },
  /** Bild füllt das Feld, ohne verzerrt oder abgeschnitten zu werden. */
  receiptImage: {
    width: "100%",
    height: "100%",
    objectFit: "contain",
  },
  /**
   * Gestricheltes Feld in Quittungsgrösse, mitten im Feld. Bewusst
   * schmaler als übliche Kassenzettel (57–80 mm), damit ein aufgeklebter
   * Beleg die Linie ganz verdeckt.
   */
  receiptPlaceholder: {
    width: "55mm",
    height: "90mm",
    alignSelf: "center",
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: PDF_TOKENS.color.gray,
    justifyContent: "center",
    alignItems: "center",
    padding: 10,
  },
  receiptPlaceholderText: {
    fontSize: 12,
    fontFamily: PDF_TOKENS.fontFamily,
    fontStyle: "normal",
    fontWeight: PDF_TOKENS.fontWeight.normal,
    color: PDF_TOKENS.color.gray,
    textAlign: "center",
  },
  receiptPlaceholderHint: {
    fontSize: PDF_TOKENS.fontSize.small,
    fontFamily: PDF_TOKENS.fontFamily,
    color: PDF_TOKENS.color.gray,
    textAlign: "center",
    marginTop: 6,
  },
  /**
   * Leeres Feld einer PDF-Belegseite; pdf-lib zeichnet die Originalseite
   * hinein (Story 7.3b, C2). Lage und Grösse nur aus RECEIPT_CONTENT_BOX,
   * damit react-pdf und pdf-lib dasselbe Feld meinen.
   */
  receiptPdfBox: {
    position: "absolute",
    ...RECEIPT_CONTENT_BOX,
  },
});
