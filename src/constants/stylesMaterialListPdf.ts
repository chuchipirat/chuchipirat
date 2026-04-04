/**
 * Stildefinitionen für den Materialliste-PDF-Export.
 *
 * Verwendet App-Farbe (#006064) als Akzentfarbe für Titelunterstrich,
 * Trennlinien und Spaltenüberschriften — konsistent mit dem
 * Rezept- und Menüplan-PDF.
 *
 * Wird von `materialListPdf.tsx` verwendet.
 */
import {StyleSheet} from "@react-pdf/renderer";
import {PDF_TOKENS} from "./pdfTokens";

/** App-Primärfarbe (Teal). */
export const APP_PRIMARY = "#006064";

export const pdfStyles = StyleSheet.create({
  /* ── Seiten-Body ────────────────────────────── */
  body: {
    paddingTop: PDF_TOKENS.margin.top,
    paddingBottom: PDF_TOKENS.margin.bottom,
    paddingHorizontal: PDF_TOKENS.margin.horizontal,
  },

  /* ── Titel ──────────────────────────────────── */
  title: {
    fontSize: 28,
    textAlign: "center",
    fontFamily: PDF_TOKENS.fontFamily,
    fontStyle: "normal",
    fontWeight: PDF_TOKENS.fontWeight.thin,
    marginBottom: 4,
  },

  /** Teal-Unterstrich unter dem Titel. */
  titleUnderline: {
    borderBottomWidth: 1,
    borderBottomColor: APP_PRIMARY,
    borderBottomStyle: "solid",
    marginBottom: 4,
  },

  /* ── Untertitel (Listenname + Zeitraum) ──────── */
  subTitle: {
    fontSize: 14,
    textAlign: "center",
    fontFamily: PDF_TOKENS.fontFamily,
    fontStyle: "normal",
    fontWeight: PDF_TOKENS.fontWeight.thin,
    marginBottom: 4,
  },

  /** Trennlinie unter dem Untertitel. */
  infoSectionDivider: {
    borderBottomWidth: 0.5,
    borderBottomColor: "#00606433", // APP_PRIMARY mit ~20% Opacity
    borderBottomStyle: "solid",
    marginBottom: 4,
  },

  /* ── Tabelle ────────────────────────────────── */
  table: {
    ...PDF_TOKENS.table,
  },
  tableRow: {
    ...PDF_TOKENS.tableRow,
  },

  /* ── Spaltenbreiten ─────────────────────────── */
  tableCol5: {
    width: "5%",
    textAlign: "center",
  },
  tableColQuantity: {
    width: "40%",
    textAlign: "right",
  },
  tableColItem: {
    width: "60%",
    textAlign: "left",
  },
  tableColItemNarrow: {
    width: "35%",
    textAlign: "left",
  },
  tableColCook: {
    width: "25%",
    textAlign: "left",
  },

  /* ── Spalten-Überschriften ──────────────────── */
  columnHeading: {
    fontSize: 13,
    textAlign: "left",
    fontFamily: PDF_TOKENS.fontFamily,
    fontStyle: "normal",
    fontWeight: PDF_TOKENS.fontWeight.bold,
    color: APP_PRIMARY,
    marginBottom: 4,
  },

  /* ── Zellen-Formate ─────────────────────────── */
  tableCell: {
    ...PDF_TOKENS.tableCell,
  },
  tableCellBold: {
    ...PDF_TOKENS.tableCellBold,
  },

  /* ── Abgehakte Items ────────────────────────── */
  strikeTrough: {
    textDecoration: "line-through",
  },
  gray: {
    color: PDF_TOKENS.color.gray,
  },
});
