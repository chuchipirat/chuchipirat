import {StyleSheet} from "@react-pdf/renderer";
import {PDF_TOKENS} from "./pdfTokens";

/**
 * Stile für den Materialliste-PDF-Export.
 *
 * Wird von `materialListPdf.tsx` verwendet.
 */
export const pdfStyles = StyleSheet.create({
  containerBottomBorder: {
    ...PDF_TOKENS.borderBottom,
  },
  title: {
    fontSize: PDF_TOKENS.fontSize.title,
    textAlign: "center",
    fontFamily: PDF_TOKENS.fontFamily,
    fontStyle: "normal",
    fontWeight: PDF_TOKENS.fontWeight.thin,
    marginBottom: 10,
  },
  subSubTitle: {
    fontSize: PDF_TOKENS.fontSize.subSubTitle,
    textAlign: "center",
    fontFamily: PDF_TOKENS.fontFamily,
    fontStyle: "normal",
    fontWeight: PDF_TOKENS.fontWeight.thin,
    marginBottom: 10,
  },
  body: {
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
  tableCol50: {
    width: "50%",
    textAlign: "center",
  },
  tableCol5: {
    width: "5%",
    textAlign: "center",
  },
  tableColQuantity: {
    width: "40%",
    textAlign: "right",
  },
  tableColUnit: {
    width: "10%",
    textAlign: "left",
  },
  tableColItem: {
    width: "60%",
    textAlign: "left",
  },
  tableCell: {
    ...PDF_TOKENS.tableCell,
  },
  tableCellBold: {
    ...PDF_TOKENS.tableCellBold,
  },
  tableCellAlignLeft: {
    textAlign: "left",
  },
  strikeTrough: {
    textDecoration: "line-through",
  },
  gray: {
    color: PDF_TOKENS.color.gray,
  },
});
