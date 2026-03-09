import {StyleSheet} from "@react-pdf/renderer";

export default class PdfStyles {
  // Stile für PDF Export
  static getPdfStyles() {
    return StyleSheet.create({
      containerBottomBorderThin: {
        borderBottomWidth: 0.2,
        borderBottomColor: "#112131",
        borderBottomStyle: "solid",
        alignItems: "stretch",
      },
      containerRightBorderThin: {
        borderRightWidth: 0.2,
        borderRightColor: "#112131",
        borderRightStyle: "solid",
        alignItems: "stretch",
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
        fontSize: 18,
        textAlign: "center",
        fontFamily: "Roboto",
        fontStyle: "normal",
        fontWeight: 100,
        marginBottom: 10,
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
      },

      pageMargins: {
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

      tableRow: {
        margin: "auto",
        flexDirection: "row",
      },

      cellPadding: {
        paddingLeft: 6,
        paddingRight: 3,
        paddingTop: 3,
        paddingBottom: 3,
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

      body: {
        fontSize: 10,
        fontFamily: "Roboto",
        fontStyle: "normal",
        fontWeight: 100,
      },

      italic: {
        fontStyle: "italic",
      },
      bold: {
        fontStyle: "normal",
      },
      thinItalic: {
        fontStyle: "italic",
        fontWeight: 100,
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
      marginLeft18: {
        marginLeft: 18,
      },
      alignLeft: {
        textAlign: "left",
      },
      gray: {
        color: "gray",
      },
      bodyThin: {
        fontWeight: 100,
      },
      bodyFontSmall: {
        fontSize: 8,
      },
    });
  }
}
