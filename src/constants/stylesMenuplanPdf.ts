import {StyleSheet} from "@react-pdf/renderer";

/**
 * Stildefinitionen für den Menüplan-PDF-Export.
 *
 * Enthält Layout-, Typografie- und Rahmen-Stile für die tabellarische
 * Darstellung des Menüplans im Querformat. Wird ausschliesslich von
 * `menuplanPdf.tsx` verwendet.
 */
export default class PdfStyles {
  /**
   * Erstellt die StyleSheet-Instanz für den Menüplan-PDF-Export.
   *
   * @returns React-PDF StyleSheet mit allen Menüplan-Stilen.
   */
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
      title: {
        fontSize: 18,
        textAlign: "center",
        fontFamily: "Roboto",
        fontStyle: "normal",
        fontWeight: 100,
        marginBottom: 10,
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
      tableCol20: {
        width: "20%",
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
        fontWeight: 400,
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
        color: "gray",
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
        fontWeight: 100,
      },
      bodyFontSmall: {
        fontSize: 8,
      },
    });
  }
}
