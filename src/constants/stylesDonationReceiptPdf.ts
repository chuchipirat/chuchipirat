import {StyleSheet} from "@react-pdf/renderer";
import {PDF_TOKENS} from "./pdfTokens";

/**
 * Stile fuer die Spendenquittung ("Thank-You Card").
 *
 * A5 Hochformat mit vertikalem Fluss, abgerundeter Info-Box
 * und persoenlicher Dankesnachricht.
 */
export const donationReceiptStyles = StyleSheet.create({
  /* Seite */
  page: {
    paddingTop: 30,
    paddingBottom: 65,
    paddingHorizontal: 40,
    fontFamily: PDF_TOKENS.fontFamily,
  },

  /* Logo-Header (Logo + App-Name zentriert) */
  logoHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  logoImage: {
    width: 40,
    height: 40,
    marginRight: 8,
  },
  logoText: {
    fontSize: 14,
    fontWeight: PDF_TOKENS.fontWeight.bold,
    color: "#333",
  },

  /* Herz-Trennlinie (Logo + Linien mit SVG-Herz) */
  heartDividerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 10,
  },
  heartDividerLine: {
    flex: 1,
    height: 0.5,
    backgroundColor: "#ccc",
  },
  heartSvg: {
    marginHorizontal: 8,
  },

  /* Titel */
  title: {
    fontSize: 24,
    fontWeight: PDF_TOKENS.fontWeight.bold,
    textAlign: "center",
    marginBottom: 4,
  },

  /* Quittungsnummer unter dem Titel */
  subtitle: {
    fontSize: 11,
    color: "#999",
    textAlign: "center",
    marginBottom: 16,
  },

  /* Abgerundete Info-Box */
  infoBox: {
    backgroundColor: "#f5f5f5",
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: "row",
    marginBottom: 6,
  },
  infoKey: {
    width: "30%",
    fontSize: 11,
    color: "#666",
    fontWeight: PDF_TOKENS.fontWeight.normal,
  },
  infoValue: {
    width: "70%",
    fontSize: 11,
    fontWeight: PDF_TOKENS.fontWeight.bold,
  },

  /* Dünne Trennlinie */
  divider: {
    borderBottomWidth: 0.5,
    borderBottomColor: "#ccc",
    borderBottomStyle: "solid",
    marginVertical: 12,
  },

  /* Danke-Block */
  thankYouHeading: {
    fontSize: 14,
    marginBottom: 2,
  },
  donorName: {
    fontSize: 16,
    fontWeight: PDF_TOKENS.fontWeight.bold,
    marginBottom: 8,
  },
  personalMessage: {
    fontSize: 11,
    color: "#666",
    lineHeight: 1.6,
  },

  /* Verein (rechts) */
  association: {
    fontSize: 11,
    color: "#666",
    textAlign: "right",
  },

  /* Einfacher Footer (zentriert am Seitenende) */
  simpleFooter: {
    position: "absolute",
    bottom: 20,
    left: 0,
    right: 0,
    textAlign: "center",
    fontSize: 9,
    color: "#999",
  },
});
