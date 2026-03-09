import {StyleSheet} from "@react-pdf/renderer";

export default class PdfStyles {
  // Stile für PDF Export
  static getPdfStyles() {
    return StyleSheet.create({
      pageMargins: {
        paddingTop: 15,
        paddingBottom: 15,
        paddingHorizontal: 35,
      },

      // containerBottomBorder: {
      //   flexDirection: "row",
      //   // flexFlow: "wrap",
      //   borderBottomWidth: 1,
      //   borderBottomColor: "#112131",
      //   borderBottomStyle: "solid",
      //   alignItems: "stretch",
      //   marginBottom: 10,
      // },
      // containerBottomBorderThin: {
      //   flexDirection: "row",
      //   // flexFlow: "wrap",
      //   borderBottomWidth: 0.2,
      //   borderBottomColor: "#112131",
      //   borderBottomStyle: "solid",
      //   alignItems: "stretch",
      //   marginBottom: 10,
      //   paddingHorizontal: 10,
      // },

      // containerBottomBorderThinEmptyRow: {
      //   flexDirection: "row",
      //   // flexFlow: "wrap",
      //   borderBottomWidth: 0.2,
      //   borderBottomColor: "#112131",
      //   borderBottomStyle: "solid",
      //   alignItems: "stretch",
      //   marginTop: 20,
      //   marginBottom: 10,
      //   paddingHorizontal: 10,
      // },

      title: {
        fontSize: 32,
        textAlign: "left",
        fontFamily: "Roboto",
        fontStyle: "normal",
        fontWeight: 700,
        marginBottom: 10,
      },
      // subTitle: {
      //   fontSize: 16,
      //   textAlign: "center",
      //   fontFamily: "Roboto",
      //   fontStyle: "thin",
      //   fontWeight: 100,
      //   marginBottom: 10,
      // },
      // subSubTitle: {
      //   fontSize: 12,
      //   textAlign: "center",
      //   fontFamily: "Roboto",
      //   fontStyle: "thin",
      //   fontWeight: 100,
      //   marginBottom: 10,
      // },
      // text: {
      //   fontSize: 11,
      //   textAlign: "justify",
      //   fontFamily: "Roboto",
      //   fontStyle: "normal",
      //   fontWeight: 400,
      // },

      // section: {
      //   fontSize: 11,
      //   marginTop: 10,
      //   marginBottom: 5,
      //   fontFamily: "Roboto",
      //   fontStyle: "bold",
      //   fontWeight: 700,
      //   textAlign: "left",
      //   flexDirection: "row",
      //   borderTopWidth: 0.2,
      //   borderTopColor: "#112131",
      //   borderTopStyle: "solid",
      //   alignItems: "stretch",
      //   paddingTop: 10,
      //   marginRight: 10,
      // },

      // // tabellen Coding

      // body: {
      //   paddingTop: 15,
      //   paddingBottom: 65,
      //   paddingHorizontal: 35,
      // },
      table: {
        display: "table" as any,
        width: "auto",
        marginTop: 10,
        marginBottom: 10,
      },
      // tableNoMargin: {
      //   display: "table",
      //   width: "auto",
      // },

      tableRow: {
        margin: "auto",
        flexDirection: "row",
      },

      // tableColKey: {
      //   width: "15%",
      //   textAlign: "right",
      //   color: "grey",
      //   fontFamily: "Roboto",
      //   fontStyle: "normal",
      // },
      // tableColValue: {
      //   width: "35%",
      //   textAlign: "left",
      //   fontFamily: "Roboto",
      //   fontStyle: "normal",
      //   fontWeight: 400,
      // },
      // tableColValueLarge: {
      //   width: "85%",
      //   textAlign: "left",
      //   fontFamily: "Roboto",
      //   fontStyle: "normal",
      //   fontWeight: 400,
      // },
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
        fontSize: 16,
        fontFamily: "Roboto",
        fontStyle: "normal",
        fontWeight: 300,
        marginBottom: 10,
        marginRight: 10,
        textAlign: "right",
        color: "grey",
      },
      dataValue: {
        fontSize: 16,
        fontFamily: "Roboto",
        fontStyle: "normal",
        fontWeight: 700,
        marginBottom: 10,
        marginLeft: 10,
        textAlign: "left",
      },
      fontSizeSmall: {
        fontSize: 12,
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
        // opacity: 0.5,
        // width: "80%",
        // position: "absolute",
        top: 10,
        bottom: 10,
        // left: 0,
        // right: 30,
      },

      // tableCol20: {
      //   width: "20%",
      //   textAlign: "center",
      // },
      // tableCol25: {
      //   width: "25%",
      //   textAlign: "center",
      // },
      // tableCol75: {
      //   width: "75%",
      //   textAlign: "center",
      // },
      // tableCol80: {
      //   width: "80%",
      //   textAlign: "center",
      // },
      // tableColQuantity: {
      //   width: "20%",
      //   textAlign: "right",
      // },
      // tableColUnit: {
      //   width: "15%",
      //   textAlign: "left",
      // },
      // tableColItem: {
      //   width: "65%",
      //   textAlign: "left",
      // },
      // // Falls die skalierte Menge auch angezeigt werden muss
      // tableColQuantityHeaderSmall: {
      //   width: "25%",
      //   textAlign: "right",
      // },
      // tableColQuantitySmall: {
      //   width: "15%",
      //   textAlign: "right",
      // },
      // tableColUnitSmall: {
      //   width: "10%",
      //   textAlign: "left",
      // },
      // tableColItemSmall: {
      //   width: "50%",
      //   textAlign: "left",
      // },

      // tableColStepPos: {
      //   width: "10%",
      //   textAlign: "center",
      //   color: "grey",
      // },
      // tableColStep: {
      //   width: "90%",
      //   textAlign: "left",
      // },
      // tableColNote: {
      //   width: "100%",
      //   textAlign: "left",
      // },
      // tableColUnitShoppingList: {
      //   width: "10%",
      //   textAlign: "left",
      // },
      // tableColItemShoppingList: {
      //   width: "30%",
      //   textAlign: "left",
      // },
      // // Spezifische Formate für den Menüplan
      // tableCellRecipe: {
      //   textAlign: "left",
      //   fontSize: 11,
      //   margin: 3,
      //   fontFamily: "Roboto",
      //   fontStyle: "normal",
      //   fontWeight: 400,
      // },
      // tableCellMeal: {
      //   textAlign: "left",
      //   fontSize: 11,
      //   margin: 3,
      //   marginLeft: 10,
      //   fontFamily: "Roboto",
      //   fontStyle: "bold",
      //   fontWeight: 700,
      // },
      // tableCellHeadNote: {
      //   textAlign: "center",
      //   fontSize: 11,
      //   margin: 3,
      //   fontFamily: "Roboto",
      //   fontStyle: "italic",
      //   fontWeight: 400,
      // },
      // tableCellNote: {
      //   textAlign: "left",
      //   fontSize: 11,
      //   margin: 3,
      //   fontFamily: "Roboto",
      //   fontStyle: "italic",
      //   fontWeight: 400,
      // },
      // tableCell: {
      //   margin: 3,
      //   fontSize: 11,
      //   fontFamily: "Roboto",
      //   fontStyle: "normal",
      //   fontWeight: 400,
      // },
      // tableCellGrey: {
      //   color: "grey",
      // },
      // tableCellThin: {
      //   fontSize: 11,
      //   fontFamily: "Roboto",
      //   fontStyle: "thin",
      //   fontWeight: 100,
      // },
      // tableCellBold: {
      //   margin: 3,
      //   fontFamily: "Roboto",
      //   fontStyle: "bold",
      //   fontWeight: 700,
      //   fontSize: 11,
      // },
      // tableCellAlignLeft: {
      //   textAlign: "left",
      // },
      // tableCellAlignRight: {
      //   textAlign: "right",
      // },
      // italic: {
      //   fontStyle: "italic",
      // },
      // thinItalic: {
      //   fontStyle: "thinItalic",
      //   fontWeight: 100,
      // },
      // alignLeft: {
      //   textAlign: "left",
      // },
    });
  }
}
