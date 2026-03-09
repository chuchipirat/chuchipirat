import {StyleSheet} from "@react-pdf/renderer";

export default class PdfStyles {
  // Stile für PDF Export
  static getPdfStyles() {
    return StyleSheet.create({
      containerBottomBorder: {
        flexDirection: "row",
        // flexFlow: "wrap",
        borderBottomWidth: 1,
        borderBottomColor: "#112131",
        borderBottomStyle: "solid",
        alignItems: "stretch",
        marginBottom: 10,
      },
      containerBottomBorderThin: {
        flexDirection: "row",
        // flexFlow: "wrap",
        borderBottomWidth: 0.2,
        borderBottomColor: "#112131",
        borderBottomStyle: "solid",
        alignItems: "stretch",
        marginBottom: 10,
        paddingHorizontal: 10,
      },

      containerBottomBorderThinEmptyRow: {
        flexDirection: "row",
        // flexFlow: "wrap",
        borderBottomWidth: 0.2,
        borderBottomColor: "#112131",
        borderBottomStyle: "solid",
        alignItems: "stretch",
        marginTop: 20,
        marginBottom: 10,
        paddingHorizontal: 10,
      },

      title: {
        fontSize: 32,
        textAlign: "center",
        fontFamily: "Roboto",
        fontStyle: "normal",
        fontWeight: 100,
        marginBottom: 10,
      },
      subTitle: {
        fontSize: 16,
        textAlign: "center",
        fontFamily: "Roboto",
        fontStyle: "normal",
        fontWeight: 100,
        marginBottom: 10,
      },
      subSubTitle: {
        fontSize: 12,
        textAlign: "center",
        fontFamily: "Roboto",
        fontStyle: "normal",
        fontWeight: 100,
        marginBottom: 10,
      },
      text: {
        fontSize: 11,
        textAlign: "justify",
        fontFamily: "Roboto",
        fontStyle: "normal",
        fontWeight: 400,
      },

      section: {
        fontSize: 11,
        marginTop: 10,
        marginBottom: 5,
        fontFamily: "Roboto",
        fontStyle: "normal",
        fontWeight: 700,
        textAlign: "left",
        flexDirection: "row",
        borderTopWidth: 0.2,
        borderTopColor: "#112131",
        borderTopStyle: "solid",
        alignItems: "stretch",
        paddingTop: 10,
        marginRight: 10,
      },

      // tabellen Coding

      body: {
        paddingTop: 15,
        paddingBottom: 65,
        paddingHorizontal: 35,
      },
      table: {
        display: "table" as any,
        width: "auto",
        marginTop: 10,
        marginBottom: 10,
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
        margin: "auto",
        flexDirection: "row",
      },

      tableColKey: {
        width: "15%",
        textAlign: "right",
        color: "grey",
        fontFamily: "Roboto",
        fontStyle: "normal",
      },
      tableColValue: {
        width: "35%",
        textAlign: "left",
        fontFamily: "Roboto",
        fontStyle: "normal",
        fontWeight: 400,
      },
      tableColValueLarge: {
        width: "85%",
        textAlign: "left",
        fontFamily: "Roboto",
        fontStyle: "normal",
        fontWeight: 400,
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
        color: "grey",
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
        fontSize: 11,
        margin: 3,
        fontFamily: "Roboto",
        fontStyle: "normal",
        fontWeight: 400,
      },
      tableCellMeal: {
        textAlign: "left",
        fontSize: 11,
        margin: 3,
        marginLeft: 10,
        fontFamily: "Roboto",
        fontStyle: "normal",
        fontWeight: 700,
      },
      tableCellHeadNote: {
        textAlign: "center",
        fontSize: 11,
        margin: 3,
        fontFamily: "Roboto",
        fontStyle: "italic",
        fontWeight: 400,
      },
      tableCellNote: {
        textAlign: "left",
        fontSize: 11,
        margin: 3,
        fontFamily: "Roboto",
        fontStyle: "italic",
        fontWeight: 400,
      },
      tableCell: {
        margin: 3,
        fontSize: 11,
        fontFamily: "Roboto",
        fontStyle: "normal",
        fontWeight: 400,
      },
      tableCellGrey: {
        color: "grey",
      },
      tableCellThin: {
        fontSize: 11,
        fontFamily: "Roboto",
        fontStyle: "normal",
        fontWeight: 100,
      },
      tableCellBold: {
        margin: 3,
        fontFamily: "Roboto",
        fontStyle: "normal",
        fontWeight: 700,
        fontSize: 11,
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
        fontWeight: 100,
      },
      alignLeft: {
        textAlign: "left",
      },
    });
  }
}
