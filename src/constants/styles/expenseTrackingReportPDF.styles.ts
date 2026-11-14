/**
 * Stildefinitionen für die PDF-Abrechnung.
 *
 * Gestaltung nach der Spendenquittung (Story 7.5): Logo, Trenner mit Icon,
 * Kennzahlen, Karten pro Person, Teal-Akzent.
 *
 * Wird von den Bausteinen in `ExpenseTracking/Report/` verwendet.
 */
import {StyleSheet} from "@react-pdf/renderer";
import {PDF_TOKENS} from "../pdfTokens";
import {
  RECEIPT_CONTENT_BOX,
  RECEIPT_HEADER_HEIGHT,
  RECEIPT_HEADER_LINE_WIDTH,
  RECEIPT_HEADER_MARGIN_BOTTOM,
  RECEIPT_HEADER_PADDING_BOTTOM,
  REPORT_PAGE_PADDING_TOP,
} from "../../components/Event/ExpenseTracking/Report/receiptPageLayout";

/**
 * Farben der Abrechnung (Story 7.5). Nur bestehende Werte: Teal aus
 * `PDF_TOKENS`, Grautöne aus der Spendenquittung
 * (`stylesDonationReceiptPdf.ts`), Teal mit Deckkraft aus Menüplan und
 * Listen. Exportiert, weil `<Path fill>` eine Farbe als Prop braucht.
 */
export const REPORT_COLORS = {
  primary: PDF_TOKENS.color.primary,
  /** Teal ~7 % (Menüplan `MEAL_BAND_BG`): Budget-Balken. */
  primaryTint: "#00606412",
  /** Kacheln und Kasten (Spendenquittung `infoBox`). */
  surface: "#f5f5f5",
  /** Trennlinien und Kartenrand (Spendenquittung `divider`). */
  line: "#ccc",
  /** Beschriftungen (Spendenquittung `infoKey`). */
  label: "#666",
  /** Hilfstexte und Footer (Spendenquittung `simpleFooter`). */
  hint: "#999",
  /** Schriftzug «chuchipirat» (Spendenquittung `logoText`). */
  text: "#333",
  onPrimary: "#fff",
} as const;

/** Schriftgrössen der Abrechnung (Spez. 11). */
const FONT_SIZE = {name: 13, table: 10, hint: 9} as const;

/** Gemeinsame Schrift aller Texte des neuen Layouts. */
const TEXT_BASE = {
  fontFamily: PDF_TOKENS.fontFamily,
  fontStyle: "normal" as const,
  fontWeight: PDF_TOKENS.fontWeight.normal,
};

/** Rundung von Karten, Kacheln und Kasten (Spez. 11). */
const CARD_RADIUS = 8;

/** Feine Linie (Spez. 11). */
const HAIRLINE = 0.5;

/** Bausteine des neuen Layouts (Story 7.5). */
export const reportLayoutStyles = StyleSheet.create({
  /* ── Seite ──────────────────────────────────── */
  page: {
    paddingTop: REPORT_PAGE_PADDING_TOP,
    paddingBottom: PDF_TOKENS.margin.bottom,
    paddingHorizontal: PDF_TOKENS.margin.horizontal,
    ...TEXT_BASE,
    fontSize: FONT_SIZE.table,
  },

  /* ── Kopf Seite 1 (wie Spendenquittung) ─────── */
  logoHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  logoImage: {width: 40, height: 40, marginRight: 8},
  logoText: {
    ...TEXT_BASE,
    fontSize: 14,
    fontWeight: PDF_TOKENS.fontWeight.bold,
    color: REPORT_COLORS.text,
  },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 10,
  },
  dividerLine: {flex: 1, height: HAIRLINE, backgroundColor: REPORT_COLORS.line},
  dividerIcon: {marginHorizontal: 8},
  title: {
    ...TEXT_BASE,
    fontSize: 24,
    fontWeight: PDF_TOKENS.fontWeight.bold,
    textAlign: "center",
    marginBottom: 4,
  },
  eventName: {
    ...TEXT_BASE,
    fontSize: 11,
    color: REPORT_COLORS.hint,
    textAlign: "center",
    marginBottom: 16,
  },

  /* ── Kennzahlen ─────────────────────────────── */
  kpiRow: {flexDirection: "row", marginBottom: 16},
  kpiTile: {
    flex: 1,
    backgroundColor: REPORT_COLORS.surface,
    borderRadius: CARD_RADIUS,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  /** Abstand zwischen den Kacheln (react-pdf kennt kein `gap` überall). */
  kpiTileSpacing: {marginLeft: 8},
  kpiTileHighlighted: {backgroundColor: REPORT_COLORS.primary},
  kpiLabel: {
    ...TEXT_BASE,
    fontSize: FONT_SIZE.hint,
    color: REPORT_COLORS.label,
  },
  kpiLabelHighlighted: {color: REPORT_COLORS.onPrimary},
  kpiValue: {
    ...TEXT_BASE,
    fontSize: FONT_SIZE.name,
    fontWeight: PDF_TOKENS.fontWeight.bold,
  },
  kpiValueHighlighted: {color: REPORT_COLORS.onPrimary},
  /** Kleine Zeile unter dem Wert, z.B. «Küche, Motto». */
  kpiDetail: {
    ...TEXT_BASE,
    fontSize: FONT_SIZE.hint,
    color: REPORT_COLORS.label,
    marginTop: 1,
  },

  /* ── Footer (alle Seiten) ───────────────────── */
  footer: {
    position: "absolute",
    bottom: 20,
    left: PDF_TOKENS.margin.horizontal,
    right: PDF_TOKENS.margin.horizontal,
    flexDirection: "row",
    paddingTop: 6,
    borderTopWidth: HAIRLINE,
    borderTopColor: REPORT_COLORS.line,
    borderTopStyle: "solid",
  },
  footerText: {
    ...TEXT_BASE,
    fontSize: FONT_SIZE.hint,
    color: REPORT_COLORS.hint,
  },
  /**
   * Links und rechts gleich breit (`flex: 1`), die Mitte fest: So steht
   * «Seite x von y» genau in der Seitenmitte, egal wie lang die Texte sind.
   */
  footerLeft: {flex: 1},
  footerCenter: {width: 90, textAlign: "center"},
  footerRight: {flex: 1, textAlign: "right"},

  /* ── Zahlungsangaben ────────────────────────── */
  paymentLine: {
    ...TEXT_BASE,
    fontSize: FONT_SIZE.hint,
    color: REPORT_COLORS.label,
    marginBottom: 8,
  },
  fillBox: {
    backgroundColor: REPORT_COLORS.surface,
    borderRadius: CARD_RADIUS,
    padding: 10,
    marginBottom: 10,
  },
  fillRow: {flexDirection: "row", alignItems: "flex-end", marginTop: 4},
  fillLabel: {
    ...TEXT_BASE,
    width: 90,
    fontSize: FONT_SIZE.hint,
    color: REPORT_COLORS.label,
    paddingBottom: 2,
  },
  /**
   * Linie zum Schreiben, höher als eine Textzeile. Vorhandene Teilangaben
   * stehen direkt auf der Linie.
   */
  fillLine: {
    flexGrow: 1,
    height: 18,
    justifyContent: "flex-end",
    borderBottomWidth: HAIRLINE,
    borderBottomColor: REPORT_COLORS.label,
    borderBottomStyle: "solid",
  },
  fillValue: {...TEXT_BASE, fontSize: FONT_SIZE.table, paddingBottom: 2},
  ibanBoxes: {flexDirection: "row"},
  ibanGroup: {flexDirection: "row", marginRight: 6},
  ibanBox: {
    width: 13,
    height: 17,
    borderWidth: HAIRLINE,
    borderColor: REPORT_COLORS.label,
    borderStyle: "solid",
    backgroundColor: REPORT_COLORS.onPrimary,
    // Ränder überlappen, damit zwischen Kästchen keine doppelte Linie entsteht
    marginRight: -HAIRLINE,
    justifyContent: "center",
    alignItems: "center",
  },
  ibanBoxText: {...TEXT_BASE, fontSize: FONT_SIZE.table},

  /* ── Personenblock (Karte) ──────────────────── */
  card: {
    borderWidth: HAIRLINE,
    borderColor: REPORT_COLORS.line,
    borderStyle: "solid",
    borderRadius: CARD_RADIUS,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 12,
  },
  cardHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 2,
  },
  payeeName: {
    ...TEXT_BASE,
    fontSize: FONT_SIZE.name,
    fontWeight: PDF_TOKENS.fontWeight.bold,
    color: REPORT_COLORS.primary,
  },
  payeeTotal: {
    ...TEXT_BASE,
    fontSize: FONT_SIZE.name,
    fontWeight: PDF_TOKENS.fontWeight.bold,
    textAlign: "right",
  },
  noRefundHint: {
    ...TEXT_BASE,
    fontSize: FONT_SIZE.hint,
    color: REPORT_COLORS.label,
    marginBottom: 8,
  },

  /* ── Tabelle ────────────────────────────────── */
  tableHeaderRow: {
    flexDirection: "row",
    paddingBottom: 3,
    borderBottomWidth: HAIRLINE,
    borderBottomColor: REPORT_COLORS.primary,
    borderBottomStyle: "solid",
  },
  tableHeaderCell: {
    ...TEXT_BASE,
    fontSize: FONT_SIZE.hint,
    fontWeight: PDF_TOKENS.fontWeight.bold,
    color: REPORT_COLORS.primary,
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 4,
    borderBottomWidth: HAIRLINE,
    borderBottomColor: REPORT_COLORS.line,
    borderBottomStyle: "solid",
  },
  /** Letzte Zeile der Karte: Kartenrand bzw. Totallinie trennen schon. */
  tableRowLast: {flexDirection: "row", paddingVertical: 4},
  cell: {...TEXT_BASE, fontSize: FONT_SIZE.table},
  /** Kommentar als zweite Zeile unter der Bezeichnung (Spez. 3). */
  comment: {
    ...TEXT_BASE,
    fontSize: FONT_SIZE.hint,
    color: REPORT_COLORS.label,
    marginTop: 1,
  },
  /** Seitenverweis «S. 5» in der Spalte «Beleg». */
  pageRef: {color: REPORT_COLORS.label},

  /* ── Spalten (feste Breiten in pt, Bezeichnung füllt den Rest) ── */
  colNumber: {width: 24},
  colDate: {width: 58},
  colLabel: {flex: 1, paddingRight: 6},
  colBudget: {width: 70, paddingRight: 6},
  colAmount: {width: 72, textAlign: "right"},
  /**
   * Feste Breite: «S. 5» und «S. 123» brauchen gleich viel Platz, darum
   * ändert der zweite Durchlauf die Seitenzahl der Abrechnung nicht.
   */
  colReceiptRef: {width: 36, textAlign: "right"},

  /* ── Budget-Balken und Total (Modus B) ──────── */
  budgetBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: REPORT_COLORS.primaryTint,
    borderRadius: 4,
    paddingVertical: 4,
    // rechts ohne Abstand: Der Betrag steht so genau unter der Spalte «Betrag»
    paddingLeft: 6,
    marginTop: 8,
    marginBottom: 2,
  },
  budgetBarName: {flexDirection: "row", alignItems: "center", flex: 1},
  budgetBarText: {
    ...TEXT_BASE,
    fontSize: FONT_SIZE.table,
    fontWeight: PDF_TOKENS.fontWeight.bold,
    color: REPORT_COLORS.primary,
    marginLeft: 4,
  },
  budgetBarTotal: {
    ...TEXT_BASE,
    fontSize: FONT_SIZE.table,
    fontWeight: PDF_TOKENS.fontWeight.bold,
    color: REPORT_COLORS.primary,
  },
  /** Betrag in der Spalte «Betrag» (Balken und Totalzeile). */
  columnTotal: {textAlign: "right"},
  /** Bezeichnung «Total <Name>»: füllt den Platz bis zur Spalte «Betrag». */
  totalLabel: {flex: 1},
  totalRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingTop: 6,
    marginTop: 4,
    borderTopWidth: HAIRLINE,
    borderTopColor: REPORT_COLORS.primary,
    borderTopStyle: "solid",
  },
  totalText: {
    ...TEXT_BASE,
    fontSize: FONT_SIZE.table,
    fontWeight: PDF_TOKENS.fontWeight.bold,
  },

  /* ── Belegseiten (Spez. 7) ──────────────────── */
  /**
   * Fester Kopf: Höhe und Abstände aus `receiptPageLayout`, damit das Feld
   * darunter für react-pdf und pdf-lib gleich liegt.
   */
  receiptHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    height:
      RECEIPT_HEADER_HEIGHT +
      RECEIPT_HEADER_PADDING_BOTTOM +
      RECEIPT_HEADER_LINE_WIDTH,
    paddingBottom: RECEIPT_HEADER_PADDING_BOTTOM,
    marginBottom: RECEIPT_HEADER_MARGIN_BOTTOM,
    borderBottomWidth: RECEIPT_HEADER_LINE_WIDTH,
    borderBottomColor: REPORT_COLORS.primary,
    borderBottomStyle: "solid",
    overflow: "hidden",
  },
  /** Belegnummer im Teal-Kreis, gleich wie in der Spalte «Nr.». */
  receiptBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: REPORT_COLORS.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  receiptBadgeText: {
    ...TEXT_BASE,
    fontSize: FONT_SIZE.table,
    fontWeight: PDF_TOKENS.fontWeight.bold,
    color: REPORT_COLORS.onPrimary,
  },
  receiptTitle: {flex: 1, marginHorizontal: 10},
  /** Höchstens zwei Zeilen, sonst sprengt eine lange Bezeichnung den Kopf. */
  receiptLabel: {
    ...TEXT_BASE,
    fontSize: 12,
    fontWeight: PDF_TOKENS.fontWeight.bold,
    maxLines: 2,
    textOverflow: "ellipsis",
  },
  /** «· Seite 2 von 3» hinter der Bezeichnung eines mehrseitigen Belegs. */
  receiptLabelPageOf: {
    fontWeight: PDF_TOKENS.fontWeight.normal,
    color: REPORT_COLORS.label,
  },
  receiptMeta: {
    ...TEXT_BASE,
    fontSize: FONT_SIZE.hint,
    color: REPORT_COLORS.label,
    marginTop: 2,
    maxLines: 1,
    textOverflow: "ellipsis",
  },
  receiptAmount: {
    ...TEXT_BASE,
    fontSize: FONT_SIZE.name,
    fontWeight: PDF_TOKENS.fontWeight.bold,
    textAlign: "right",
  },
  /**
   * Feld unter dem Kopf für Bild, Klebefeld oder PDF-Beleg. Lage und
   * Grösse nur aus `RECEIPT_CONTENT_BOX`; direkt in der Page, damit
   * `position: "absolute"` von der Seitenecke misst wie pdf-lib.
   */
  receiptContentBox: {
    position: "absolute",
    ...RECEIPT_CONTENT_BOX,
  },
  /** Bild füllt das Feld, ohne verzerrt oder abgeschnitten zu werden. */
  receiptImage: {width: "100%", height: "100%", objectFit: "contain"},
  /** Gestricheltes Klebefeld über das ganze Feld (Mockup Belegseiten). */
  receiptPlaceholder: {
    flex: 1,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: REPORT_COLORS.hint,
    borderRadius: CARD_RADIUS,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  receiptPlaceholderText: {
    ...TEXT_BASE,
    fontSize: FONT_SIZE.name,
    fontWeight: PDF_TOKENS.fontWeight.bold,
    color: REPORT_COLORS.label,
    textAlign: "center",
    marginTop: 8,
  },
  receiptPlaceholderHint: {
    ...TEXT_BASE,
    fontSize: FONT_SIZE.hint,
    color: REPORT_COLORS.hint,
    textAlign: "center",
    marginTop: 4,
  },
});
