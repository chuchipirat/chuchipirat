import {StyleSheet} from "@react-pdf/renderer";
import {PDF_TOKENS} from "./pdfTokens";

/**
 * Stildefinitionen für den Menüplan-PDF-Export.
 *
 * Enthält Layout-, Typografie- und Rahmen-Stile für die tabellarische
 * Darstellung des Menüplans im Querformat. Wird ausschliesslich von
 * `menuplanPdf.tsx` verwendet.
 */
export const pdfStyles = StyleSheet.create({
  containerBottomBorderThin: {
    ...PDF_TOKENS.borderBottomThin,
  },
  containerRightBorderThin: {
    borderRightWidth: 0.2,
    borderRightColor: PDF_TOKENS.color.border,
    borderRightStyle: "solid",
    alignItems: "stretch",
  },
  title: {
    fontSize: 18,
    textAlign: "center",
    fontFamily: PDF_TOKENS.fontFamily,
    fontStyle: "normal",
    fontWeight: PDF_TOKENS.fontWeight.thin,
    marginBottom: 10,
  },
  pageMargins: {
    paddingTop: PDF_TOKENS.margin.top,
    paddingBottom: PDF_TOKENS.margin.bottom,
    paddingHorizontal: PDF_TOKENS.margin.horizontal,
  },
  table: {
    ...PDF_TOKENS.table,
  },
  tableRow: {
    ...PDF_TOKENS.tableRow,
  },
  cellPadding: {
    paddingLeft: 6,
    paddingRight: 3,
    paddingTop: 3,
    paddingBottom: 3,
  },
  tableCol20: {
    width: "20%",
    textAlign: "center",
  },
  body: {
    fontSize: 10,
    fontFamily: PDF_TOKENS.fontFamily,
    fontStyle: "normal",
    fontWeight: PDF_TOKENS.fontWeight.thin,
  },
  italic: {
    fontStyle: "italic",
  },
  bold: {
    fontWeight: PDF_TOKENS.fontWeight.normal,
  },
  marginTop6: {
    marginTop: 6,
  },
  marginBottom3: {
    marginBottom: 3,
  },
  marginBottom6: {
    marginBottom: 6,
  },
  marginLeft12: {
    marginLeft: 12,
  },
  alignLeft: {
    textAlign: "left",
  },
  gray: {
    color: PDF_TOKENS.color.gray,
  },
  noteBackground: {
    backgroundColor: "#E0E0E0",
    // Zell-Padding ausgleichen, damit der Hintergrund symmetrisch wirkt
    marginLeft: -6,
    marginRight: -3,
    paddingLeft: 6,
    paddingRight: 6,
    paddingTop: 4,
    paddingBottom: 4,
  },
  bodyThin: {
    fontWeight: PDF_TOKENS.fontWeight.thin,
  },
  bodyFontSmall: {
    fontSize: 8,
  },
});
