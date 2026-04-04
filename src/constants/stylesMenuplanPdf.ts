/**
 * Stildefinitionen für den Menüplan-PDF-Export.
 *
 * Verwendet:
 * - Dynamische Spaltenbreiten
 * - Einheitliche App-Farbe (#006064) mit Alpha für Mahlzeitentyp-Bänder
 * - Adaptive Schriftgrössen je nach Anzahl Tage
 * - Dickere Trennlinien zwischen Zeitscheiben (nicht-aufeinanderfolgende Tage)
 * - Vertikale Spaltentrennlinien und grosszügiges vertikales Padding
 * - Inline-Notizen
 */
import {StyleSheet} from "@react-pdf/renderer";
import {PDF_TOKENS} from "./pdfTokens";

/** App-Primärfarbe (Teal). */
export const APP_PRIMARY = "#006064";

/** Helle Hintergrundfarbe für Mahlzeitentyp-Bänder (App-Farbe mit starker Transparenz). */
export const MEAL_BAND_BG = "#00606412";

/** Textfarbe für Mahlzeitentyp-Banner (dunklerer Ton der App-Farbe). */
export const MEAL_BAND_TEXT = APP_PRIMARY;

/** Dezente Hintergrundfarbe für gerade Spalten (visuelle Trennung). */
export const COLUMN_TINT = "#F8F8F8";

/**
 * Prüft ob zwei aufeinanderfolgende Tage eine Zeitscheiben-Grenze bilden.
 * D.h. der nächste Tag ist nicht der Kalendertag nach dem aktuellen Tag.
 *
 * @param currentDay - Das aktuelle Datum.
 * @param nextDay - Das nächste Datum (oder undefined wenn letzter Tag).
 * @returns `true` wenn eine Lücke (Zeitscheiben-Grenze) vorliegt.
 */
export function isTimesliceBoundary(
  currentDay: Date,
  nextDay: Date | undefined
): boolean {
  if (!nextDay) return false;
  const oneDay = 24 * 60 * 60 * 1000;
  const diff = nextDay.getTime() - currentDay.getTime();
  return diff > oneDay + 1000; // +1s Toleranz für Sommerzeitwechsel
}

/**
 * Ermittelt die Hintergrundfarbe für eine Spalte basierend auf
 * gerader/ungerader Position.
 *
 * @param dayIndex - Spaltenindex (für alternierende Färbung).
 * @returns CSS-Farbwert als String.
 */
export function getColumnBackground(dayIndex: number): string {
  if (dayIndex % 2 === 1) return COLUMN_TINT;
  return "transparent";
}

/**
 * Erzeugt ein StyleSheet für die gegebene Basis-Schriftgrösse.
 * Erlaubt adaptive Grössen abhängig von der Anzahl Tage im Menüplan.
 *
 * @param baseFontSize - Basis-Schriftgrösse in Punkt (z.B. 8, 7, 6).
 * @returns StyleSheet mit allen Menüplan-PDF-Stilen.
 */
export function createMenuplanPdfStyles(baseFontSize: number) {
  return StyleSheet.create({
    /* ── Seiten-Layout ─────────────────────────────── */
    pageMargins: {
      paddingTop: 10,
      paddingBottom: 50,
      paddingHorizontal: 20,
    },

    /* ── Tabelle ───────────────────────────────────── */
    table: {
      display: "table" as any, // eslint-disable-line @typescript-eslint/no-explicit-any
      width: "auto",
      marginTop: 4,
      flexGrow: 1,
    },
    tableRow: {
      ...PDF_TOKENS.tableRow,
    },

    /* ── Zellen ────────────────────────────────────── */
    cellPadding: {
      paddingLeft: 3,
      paddingRight: 3,
      paddingTop: 3,
      paddingBottom: 3,
    },

    /* ── Vertikale Spaltentrennlinie (normal) ──────── */
    columnBorderRight: {
      borderRightWidth: 0.2,
      borderRightColor: "#D0D0D0",
      borderRightStyle: "solid",
    },

    /* ── Dickere Trennlinie für Zeitscheiben-Grenzen ─ */
    timesliceBorderRight: {
      borderRightWidth: 1.5,
      borderRightColor: APP_PRIMARY,
      borderRightStyle: "solid",
    },

    /* ── Typografie ────────────────────────────────── */
    body: {
      fontSize: baseFontSize,
      fontFamily: PDF_TOKENS.fontFamily,
      fontStyle: "normal",
      fontWeight: PDF_TOKENS.fontWeight.thin,
    },
    bodySmall: {
      fontSize: Math.max(baseFontSize - 1, 5),
      fontFamily: PDF_TOKENS.fontFamily,
      fontStyle: "normal",
      fontWeight: PDF_TOKENS.fontWeight.thin,
    },
    headerText: {
      fontSize: baseFontSize + 1,
      fontFamily: PDF_TOKENS.fontFamily,
      fontStyle: "normal",
      fontWeight: PDF_TOKENS.fontWeight.normal,
    },
    bold: {
      fontWeight: PDF_TOKENS.fontWeight.normal,
    },
    italic: {
      fontStyle: "italic",
    },
    gray: {
      color: PDF_TOKENS.color.gray,
    },

    /* ── Header-Zeile (Wochentage) ────────────────── */
    dateHeaderCell: {
      paddingLeft: 2,
      paddingRight: 2,
      paddingTop: 3,
      paddingBottom: 3,
      borderBottomWidth: 1,
      borderBottomColor: PDF_TOKENS.color.border,
      borderBottomStyle: "solid",
    },

    /* ── Mahlzeitentyp-Banner ─────────────────────── */
    mealBanner: {
      paddingLeft: 4,
      paddingRight: 6,
      paddingTop: 2,
      paddingBottom: 2,
      borderBottomWidth: 0.5,
      borderBottomColor: PDF_TOKENS.color.border,
      borderBottomStyle: "solid",
    },
    mealBannerText: {
      fontSize: baseFontSize + 1,
      fontFamily: PDF_TOKENS.fontFamily,
      fontStyle: "normal",
      fontWeight: PDF_TOKENS.fontWeight.bold,
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },

    /* ── Inhaltszellen-Zeile ──────────────────────── */
    contentRow: {
      ...PDF_TOKENS.tableRow,
      flexGrow: 1,
      borderBottomWidth: 0.2,
      borderBottomColor: PDF_TOKENS.color.border,
      borderBottomStyle: "solid",
    },

    /* ── Titelzeile ────────────────────────────────── */
    title: {
      fontSize: baseFontSize + 6,
      textAlign: "center",
      fontFamily: PDF_TOKENS.fontFamily,
      fontStyle: "normal",
      fontWeight: PDF_TOKENS.fontWeight.normal,
      marginBottom: 4,
    },

    /* ── Menüname ──────────────────────────────────── */
    menuName: {
      fontSize: baseFontSize,
      fontFamily: PDF_TOKENS.fontFamily,
      fontWeight: PDF_TOKENS.fontWeight.normal,
      marginBottom: 1,
      marginTop: 1,
    },

    /* ── Inline-Notiz ─────────────────────────────── */
    noteInline: {
      fontSize: Math.max(baseFontSize - 1, 5),
      fontFamily: PDF_TOKENS.fontFamily,
      fontStyle: "italic",
      fontWeight: PDF_TOKENS.fontWeight.thin,
      color: PDF_TOKENS.color.gray,
      backgroundColor: "#E8E8E8",
      paddingLeft: 2,
      paddingRight: 2,
      paddingTop: 1,
      paddingBottom: 1,
      marginTop: 1,
      marginBottom: 1,
      textAlign: "center",
    },

    /* ── Abstände ──────────────────────────────────── */
    marginTop2: {
      marginTop: 2,
    },
    marginBottom1: {
      marginBottom: 1,
    },
    alignLeft: {
      textAlign: "left",
    },
  });
}
