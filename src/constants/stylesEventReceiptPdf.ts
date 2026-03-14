import {StyleSheet} from "@react-pdf/renderer";
import {PDF_TOKENS} from "./pdfTokens";

/**
 * Stile für den Quittung-PDF-Export.
 *
 * Wird von `eventRecipePdf.tsx` verwendet.
 */
export const pdfStyles = StyleSheet.create({
  pageMargins: {
    paddingTop: PDF_TOKENS.margin.top,
    paddingBottom: PDF_TOKENS.margin.top,
    paddingHorizontal: PDF_TOKENS.margin.horizontal,
  },
  title: {
    fontSize: PDF_TOKENS.fontSize.title,
    textAlign: "left",
    fontFamily: PDF_TOKENS.fontFamily,
    fontStyle: "normal",
    fontWeight: PDF_TOKENS.fontWeight.bold,
    marginBottom: 10,
  },
  table: {
    ...PDF_TOKENS.table,
  },
  tableRow: {
    ...PDF_TOKENS.tableRow,
  },
  tableCol100: {
    width: "100%",
    textAlign: "center",
  },
  tableCol30: {
    width: "30%",
    textAlign: "center",
  },
  tableCol40: {
    width: "40%",
    textAlign: "center",
  },
  tableCol60: {
    width: "60%",
    textAlign: "center",
  },
  tableCol70: {
    width: "70%",
    textAlign: "center",
  },
  dataKey: {
    fontSize: PDF_TOKENS.fontSize.subTitle,
    fontFamily: PDF_TOKENS.fontFamily,
    fontStyle: "normal",
    fontWeight: 300,
    marginBottom: 10,
    marginRight: 10,
    textAlign: "right",
    color: PDF_TOKENS.color.grey,
  },
  dataValue: {
    fontSize: PDF_TOKENS.fontSize.subTitle,
    fontFamily: PDF_TOKENS.fontFamily,
    fontStyle: "normal",
    fontWeight: PDF_TOKENS.fontWeight.bold,
    marginBottom: 10,
    marginLeft: 10,
    textAlign: "left",
  },
  fontSizeSmall: {
    fontSize: PDF_TOKENS.fontSize.subSubTitle,
  },
  alignLeft: {
    textAlign: "left",
  },
  alignRight: {
    textAlign: "right",
  },
  marginBottom: {
    marginBottom: 20,
  },
  marginTop: {
    marginTop: 20,
  },
  Image: {
    top: 10,
    bottom: 10,
  },
});
