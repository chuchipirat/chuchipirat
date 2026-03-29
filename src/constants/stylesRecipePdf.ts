/**
 * Stildefinitionen für den Rezept-PDF-Export.
 *
 * Verwendet App-Farbe (#006064) als Akzentfarbe für Überschriften,
 * Schrittnummern und Trennlinien. Kompakte Abstände bei Metadaten,
 * Sektionen und Untertiteln. Vertikale Trennlinie zwischen den
 * zwei Spalten (Zutaten/Zubereitung).
 *
 * Wird von `recipePdf.tsx` und `usedRecipesPdf.tsx` verwendet.
 */
import {StyleSheet} from "@react-pdf/renderer";
import {PDF_TOKENS} from "./pdfTokens";

/** App-Primärfarbe (Teal) — identisch mit Menüplan V2. */
export const APP_PRIMARY = "#006064";

export const pdfStyles = StyleSheet.create({
  /* ── Seiten-Body ─────��────────────────────────── */
  body: {
    paddingTop: PDF_TOKENS.margin.top,
    paddingBottom: PDF_TOKENS.margin.bottom,
    paddingHorizontal: PDF_TOKENS.margin.horizontal,
  },

  /* ── Titel ────────────────────────────────────── */
  title: {
    fontSize: 28,
    textAlign: "center",
    fontFamily: PDF_TOKENS.fontFamily,
    fontStyle: "normal",
    fontWeight: PDF_TOKENS.fontWeight.thin,
    marginBottom: 4,
  },

  /** Teal-Unterstrich unter dem Titel (ersetzt den alten containerBottomBorder). */
  titleUnderline: {
    borderBottomWidth: 1,
    borderBottomColor: APP_PRIMARY,
    borderBottomStyle: "solid",
    marginBottom: 4,
  },

  /* ��─ Varianten-Untertitel ─────────────────────── */
  subTitle: {
    fontSize: 14,
    textAlign: "center",
    fontFamily: PDF_TOKENS.fontFamily,
    fontStyle: "normal",
    fontWeight: PDF_TOKENS.fontWeight.thin,
    marginBottom: 4,
  },

  /* ─�� Spalten-Überschriften (Zutaten / Zubereitung / Material) ── */
  columnHeading: {
    fontSize: 13,
    textAlign: "left",
    fontFamily: PDF_TOKENS.fontFamily,
    fontStyle: "normal",
    fontWeight: PDF_TOKENS.fontWeight.bold,
    color: APP_PRIMARY,
    marginBottom: 4,
  },

  /** Trennlinie unter dem Metadaten-Block (Quelle, Portionen, Zeiten). */
  infoSectionDivider: {
    borderBottomWidth: 0.5,
    borderBottomColor: "#00606433", // APP_PRIMARY mit ~20% Opacity
    borderBottomStyle: "solid",
    marginBottom: 4,
  },

  /* ── Metadaten-Tabelle (Quelle, Portionen, Zeiten) ── */
  table: {
    display: "table" as any, // eslint-disable-line @typescript-eslint/no-explicit-any -- @react-pdf/renderer typisiert Display nicht mit "table"
    width: "auto",
    marginTop: 4,
    marginBottom: 4,
  },

  tableNoMargin: {
    display: "table" as any, // eslint-disable-line @typescript-eslint/no-explicit-any
    width: "auto",
  },

  /* ── Tabellenzeilen ──��────────────────────────── */
  tableRow: {
    ...PDF_TOKENS.tableRow,
  },

  /* ── Zweispaltiges Layout ────────���────────────── */
  twoColumnRow: {
    flexDirection: "row",
    width: "100%",
    marginTop: 4,
  },

  /** Linke Spalte mit Teal-Trennlinie rechts. */
  tableCol50Left: {
    width: "50%",
    textAlign: "center",
    borderRightWidth: 0.5,
    borderRightColor: "#00606433", // APP_PRIMARY mit ~20% Opacity
    borderRightStyle: "solid",
    paddingRight: 4,
  },

  /** Rechte Spalte. */
  tableCol50Right: {
    width: "50%",
    textAlign: "center",
    paddingLeft: 8,
  },

  /* ── Spaltenbreiten ──��────────────────────────── */
  tableCol100: {
    width: "100%",
    textAlign: "center",
  },
  tableCol50: {
    width: "50%",
    textAlign: "center",
  },

  /* ── Metadaten-Schlüssel/Wert ───────────────��─── */
  tableColKey: {
    width: "15%",
    textAlign: "right",
    color: PDF_TOKENS.color.grey,
    fontFamily: PDF_TOKENS.fontFamily,
    fontStyle: "normal",
  },
  tableColValue: {
    width: "35%",
    textAlign: "left",
    fontFamily: PDF_TOKENS.fontFamily,
    fontStyle: "normal",
    fontWeight: PDF_TOKENS.fontWeight.normal,
  },
  tableColValueLarge: {
    width: "85%",
    textAlign: "left",
    fontFamily: PDF_TOKENS.fontFamily,
    fontStyle: "normal",
    fontWeight: PDF_TOKENS.fontWeight.normal,
  },

  /* ── Zutaten-Spalten (normal) ────────��────────── */
  tableColQuantity: {
    width: "20%",
    textAlign: "right",
  },
  tableColUnit: {
    width: "15%",
    textAlign: "left",
  },
  tableColItem: {
    width: "65%",
    textAlign: "left",
  },

  /* ── Zutaten-Spalten (skaliert) ───────────────── */
  tableColQuantityHeaderSmall: {
    width: "25%",
    textAlign: "right",
  },
  tableColQuantitySmall: {
    width: "15%",
    textAlign: "right",
  },
  tableColUnitSmall: {
    width: "10%",
    textAlign: "left",
  },
  tableColItemSmall: {
    width: "50%",
    textAlign: "left",
  },

  /* ── Zubereitungsschritte ────────────���────────── */
  tableColStepPos: {
    width: "10%",
    textAlign: "center",
    color: APP_PRIMARY,
  },
  tableColStep: {
    width: "90%",
    textAlign: "left",
  },

  /* ── Notizen ─────��────────────────────────────── */
  tableColNote: {
    width: "100%",
    textAlign: "left",
  },

  /* ── Abschnitt-Trennzeile (Section) ───────────── */
  section: {
    fontSize: PDF_TOKENS.fontSize.body,
    marginTop: 6,
    marginBottom: 5,
    fontFamily: PDF_TOKENS.fontFamily,
    fontStyle: "normal",
    fontWeight: PDF_TOKENS.fontWeight.bold,
    textAlign: "left",
    flexDirection: "row",
    borderTopWidth: 0.2,
    borderTopColor: PDF_TOKENS.color.border,
    borderTopStyle: "solid",
    alignItems: "stretch",
    paddingTop: 4,
    marginRight: 10,
  },

  /* ── Trennstrich vor Notizen ──────��───────────── */
  notesDivider: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: APP_PRIMARY,
    borderBottomStyle: "solid",
    alignItems: "stretch",
    marginBottom: 4,
  },

  /* ── Zellen-Formate ────────���──────────────────── */
  text: {
    fontSize: PDF_TOKENS.fontSize.body,
    textAlign: "justify",
    fontFamily: PDF_TOKENS.fontFamily,
    fontStyle: "normal",
    fontWeight: PDF_TOKENS.fontWeight.normal,
  },
  tableCell: {
    ...PDF_TOKENS.tableCell,
  },
  tableCellGrey: {
    color: PDF_TOKENS.color.grey,
  },
  tableCellThin: {
    fontSize: PDF_TOKENS.fontSize.body,
    fontFamily: PDF_TOKENS.fontFamily,
    fontStyle: "normal",
    fontWeight: PDF_TOKENS.fontWeight.thin,
  },
  tableCellBold: {
    ...PDF_TOKENS.tableCellBold,
  },
  tableCellAlignLeft: {
    textAlign: "left",
  },
  tableCellAlignRight: {
    textAlign: "right",
  },
  italic: {
    fontStyle: "italic",
  },
  thinItalic: {
    fontStyle: "italic",
    fontWeight: PDF_TOKENS.fontWeight.thin,
  },
  alignLeft: {
    textAlign: "left",
  },
});
