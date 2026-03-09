import {StyleSheet} from "@react-pdf/renderer";

export default class PdfStyles {
  // Stile für PDF Export
  static getPdfStyles() {
    return StyleSheet.create({
      containerBottomBorder: {
        flexDirection: "row",
        borderBottomWidth: 1,
        borderBottomColor: "#112131",
        borderBottomStyle: "solid",
        alignItems: "stretch",
        marginBottom: 10,
      },
      title: {
        fontSize: 32,
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
      tableRow: {
        margin: "auto",
        flexDirection: "row",
      },
      tableCol50: {
        width: "50%",
        textAlign: "center",
      },
      tableColQuantity: {
        width: "10%",
        textAlign: "right",
      },
      tableColUnit: {
        width: "10%",
        textAlign: "left",
      },
      tableColItem: {
        width: "30%",
        textAlign: "left",
      },
      tableCell: {
        margin: 3,
        fontSize: 11,
        fontFamily: "Roboto",
        fontStyle: "normal",
        fontWeight: 400,
      },
      tableCellBold: {
        margin: 3,
        fontFamily: "Roboto",
        fontStyle: "normal",
        fontWeight: 700,
        fontSize: 11,
      },
      tableCellMarginTop: {
        marginTop: 6,
      },
      tableCellAlignLeft: {
        textAlign: "left",
      },
      strikeTrough: {
        textDecoration: "line-through",
      },
      gray: {
        color: "gray",
      },
    });
  }
}
