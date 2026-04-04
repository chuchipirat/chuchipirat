/**
 * Gemeinsame Design-Tokens für alle PDF-Dokumente.
 *
 * Zentralisiert wiederkehrende Werte (Schriftart, Farben, Abstände, Rahmen),
 * die in den einzelnen `styles*Pdf.ts`-Dateien referenziert werden.
 * Änderungen an diesen Tokens wirken sich auf sämtliche PDF-Exporte aus.
 */
export const PDF_TOKENS = {
  /** Primäre Schriftfamilie — registriert in `pdfFontRegistration.ts`. */
  fontFamily: "Roboto",

  /** Standard-Seitenränder (body-Padding). */
  margin: {
    top: 15,
    bottom: 65,
    horizontal: 35,
  },

  /** Häufig verwendete Schriftgrössen. */
  fontSize: {
    /** Fliesstext / Tabellenzellen */
    body: 11,
    /** Kleine Hinweistexte, Kopf-/Fusszeilen */
    small: 9,
    /** Zwischentitel / Untertitel */
    subTitle: 16,
    /** Untertitel zweiter Ordnung */
    subSubTitle: 12,
    /** Seitentitel */
    title: 32,
  },

  /** Schriftstärken. */
  fontWeight: {
    thin: 100 as const,
    normal: 400 as const,
    bold: 700 as const,
  },

  /** Farben. */
  color: {
    /** Rahmenfarbe für Trennlinien */
    border: "#112131",
    /** Grau für abgedimmte Texte */
    gray: "gray" as const,
    /** Grau für Schlüsselbeschriftungen (Quittung) */
    grey: "grey" as const,
  },

  /** Standard-Tabelleneinstellungen. */
  table: {
    display: "table" as any, // eslint-disable-line @typescript-eslint/no-explicit-any -- @react-pdf/renderer typisiert Display nicht mit "table"
    width: "auto" as const,
    marginTop: 10,
    marginBottom: 10,
  },

  /** Standard-Tabellenzeile. */
  tableRow: {
    margin: "auto" as const,
    flexDirection: "row" as const,
  },

  /** Standard-Tabellenzelle (Abstand + Schrift). */
  tableCell: {
    margin: 3,
    fontSize: 11,
    fontFamily: "Roboto",
    fontStyle: "normal" as const,
    fontWeight: 400 as const,
  },

  /** Fette Tabellenzelle. */
  tableCellBold: {
    margin: 3,
    fontFamily: "Roboto",
    fontStyle: "normal" as const,
    fontWeight: 700 as const,
    fontSize: 11,
  },

  /** Unterer Trennstrich (dick). */
  borderBottom: {
    flexDirection: "row" as const,
    borderBottomWidth: 1,
    borderBottomColor: "#112131",
    borderBottomStyle: "solid" as const,
    alignItems: "stretch" as const,
    marginBottom: 10,
  },

  /** Unterer Trennstrich (dünn). */
  borderBottomThin: {
    borderBottomWidth: 0.2,
    borderBottomColor: "#112131",
    borderBottomStyle: "solid" as const,
    alignItems: "stretch" as const,
  },
} as const;
