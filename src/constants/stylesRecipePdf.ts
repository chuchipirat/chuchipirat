import {StyleSheet} from "@react-pdf/renderer";
import {PDF_TOKENS} from "./pdfTokens";

/**
 * Stile für den Rezept-PDF-Export.
 *
 * Wird von `recipePdf.tsx` und `usedRecipesPdf.tsx` verwendet.
 */
export const pdfStyles = StyleSheet.create({
  containerBottomBorder: {
    ...PDF_TOKENS.borderBottom,
  },
  containerBottomBorderThin: {
    flexDirection: "row",
    ...PDF_TOKENS.borderBottomThin,
    marginBottom: 10,
    paddingHorizontal: 10,
  },

  containerBottomBorderThinEmptyRow: {
    flexDirection: "row",
    ...PDF_TOKENS.borderBottomThin,
    marginTop: 20,
    marginBottom: 10,
    paddingHorizontal: 10,
  },

  title: {
    fontSize: PDF_TOKENS.fontSize.title,
    textAlign: "center",
    fontFamily: PDF_TOKENS.fontFamily,
    fontStyle: "normal",
    fontWeight: PDF_TOKENS.fontWeight.thin,
    marginBottom: 10,
  },
  subTitle: {
    fontSize: PDF_TOKENS.fontSize.subTitle,
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
  text: {
    fontSize: PDF_TOKENS.fontSize.body,
    textAlign: "justify",
    fontFamily: PDF_TOKENS.fontFamily,
    fontStyle: "normal",
    fontWeight: PDF_TOKENS.fontWeight.normal,
  },

  section: {
    fontSize: PDF_TOKENS.fontSize.body,
    marginTop: 10,
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
    paddingTop: 10,
    marginRight: 10,
  },

  body: {
    paddingTop: PDF_TOKENS.margin.top,
    paddingBottom: PDF_TOKENS.margin.bottom,
    paddingHorizontal: PDF_TOKENS.margin.horizontal,
  },
  table: {
    ...PDF_TOKENS.table,
  },
  tableNoMargin: {
    display: "table" as any,
    width: "auto",
  },
  // Zweispaltige Zeile ohne vertikale Margins — minimiert den vertikalen
  // Leerraum damit auch längere Rezepte auf einer Seite Platz finden.
  twoColumnRow: {
    flexDirection: "row",
    width: "100%",
    marginTop: 4,
  },

  tableRow: {
    ...PDF_TOKENS.tableRow,
  },

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
  tableCol100: {
    width: "100%",
    textAlign: "center",
  },
  tableCol50: {
    width: "50%",
    textAlign: "center",
  },
  tableCol20: {
    width: "20%",
    textAlign: "center",
  },
  tableCol25: {
    width: "25%",
    textAlign: "center",
  },
  tableCol75: {
    width: "75%",
    textAlign: "center",
  },
  tableCol80: {
    width: "80%",
    textAlign: "center",
  },
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
  // Falls die skalierte Menge auch angezeigt werden muss
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

  tableColStepPos: {
    width: "10%",
    textAlign: "center",
    color: PDF_TOKENS.color.grey,
  },
  tableColStep: {
    width: "90%",
    textAlign: "left",
  },
  tableColNote: {
    width: "100%",
    textAlign: "left",
  },
  tableColUnitShoppingList: {
    width: "10%",
    textAlign: "left",
  },
  tableColItemShoppingList: {
    width: "30%",
    textAlign: "left",
  },
  // Spezifische Formate für den Menüplan
  tableCellRecipe: {
    textAlign: "left",
    fontSize: PDF_TOKENS.fontSize.body,
    margin: 3,
    fontFamily: PDF_TOKENS.fontFamily,
    fontStyle: "normal",
    fontWeight: PDF_TOKENS.fontWeight.normal,
  },
  tableCellMeal: {
    textAlign: "left",
    fontSize: PDF_TOKENS.fontSize.body,
    margin: 3,
    marginLeft: 10,
    fontFamily: PDF_TOKENS.fontFamily,
    fontStyle: "normal",
    fontWeight: PDF_TOKENS.fontWeight.bold,
  },
  tableCellHeadNote: {
    textAlign: "center",
    fontSize: PDF_TOKENS.fontSize.body,
    margin: 3,
    fontFamily: PDF_TOKENS.fontFamily,
    fontStyle: "italic",
    fontWeight: PDF_TOKENS.fontWeight.normal,
  },
  tableCellNote: {
    textAlign: "left",
    fontSize: PDF_TOKENS.fontSize.body,
    margin: 3,
    fontFamily: PDF_TOKENS.fontFamily,
    fontStyle: "italic",
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
