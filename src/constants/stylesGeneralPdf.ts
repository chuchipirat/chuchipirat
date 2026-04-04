import {StyleSheet} from "@react-pdf/renderer";
import {PDF_TOKENS} from "./pdfTokens";

/**
 * Stile für die gemeinsamen PDF-Komponenten (Kopf-/Fusszeile).
 *
 * Wird von `pdfComponents.tsx` verwendet.
 */
export const pdfStyles = StyleSheet.create({
  header: {
    fontSize: PDF_TOKENS.fontSize.small,
    marginBottom: 20,
    fontFamily: PDF_TOKENS.fontFamily,
    fontStyle: "normal",
    fontWeight: PDF_TOKENS.fontWeight.thin,
    textAlign: "center",
  },

  printedOn: {
    position: "absolute",
    fontSize: PDF_TOKENS.fontSize.small,
    bottom: 30,
    left: PDF_TOKENS.margin.horizontal,
    right: 0,
    fontFamily: PDF_TOKENS.fontFamily,
    fontStyle: "normal",
    fontWeight: PDF_TOKENS.fontWeight.thin,
    textAlign: "left",
  },
  printedFrom: {
    position: "absolute",
    fontSize: PDF_TOKENS.fontSize.small,
    bottom: 16,
    left: PDF_TOKENS.margin.horizontal,
    right: 0,
    fontFamily: PDF_TOKENS.fontFamily,
    fontStyle: "normal",
    fontWeight: PDF_TOKENS.fontWeight.thin,
    textAlign: "left",
  },
  pageNumber: {
    position: "absolute",
    fontSize: 10,
    bottom: 30,
    left: 0,
    right: 0,
    fontFamily: PDF_TOKENS.fontFamily,
    fontStyle: "normal",
    fontWeight: PDF_TOKENS.fontWeight.thin,
    textAlign: "center",
  },
  chuchipirat: {
    position: "absolute",
    fontSize: PDF_TOKENS.fontSize.small,
    bottom: 16,
    left: 0,
    right: 0,
    fontFamily: PDF_TOKENS.fontFamily,
    fontStyle: "normal",
    fontWeight: PDF_TOKENS.fontWeight.thin,
    textAlign: "center",
  },
  footerImage: {
    opacity: 0.5,
    width: "50px",
    position: "absolute",
    bottom: 10,
    right: 30,
  },
});
