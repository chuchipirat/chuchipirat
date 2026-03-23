/**
 * DonationReceiptPdf — Spendenquittung im "Thank-You Card"-Stil.
 *
 * Rendert eine A5-Hochformat-Quittung mit vertikalem Fluss,
 * abgerundeter Info-Box und persoenlicher Dankesnachricht.
 * Verwendet dieselben Fonts, Tokens und den gemeinsamen Footer
 * wie alle anderen PDF-Dokumente.
 *
 * @example
 * <PDFDownloadLink document={<DonationReceiptPdf donation={donation} authUser={authUser} />}>
 *   Quittung herunterladen
 * </PDFDownloadLink>
 */
import {Document, Page, View, Text, Image, Svg, Path} from "@react-pdf/renderer";
import "../Shared/pdfFontRegistration";

import {donationReceiptStyles as styles} from "../../constants/stylesDonationReceiptPdf";
import AuthUser from "../Firebase/Authentication/authUser.class";
import {DonationDomain} from "./donation.types";

import {
  APP_NAME as TEXT_APP_NAME,
  EVENT as TEXT_EVENT,
  DATE as TEXT_DATE,
  AMOUNT as TEXT_AMOUNT,
  ASSOCIATION as TEXT_ASSOCIATION,
} from "../../constants/text";

import {
  DONATION_RECEIPT_TITLE as TEXT_RECEIPT_TITLE,
  DONATION_RECEIPT_PERSONAL_MESSAGE as TEXT_PERSONAL_MESSAGE,
  DONATION_RECEIPT_URL as TEXT_RECEIPT_URL,
} from "../../constants/text/donations";

/* ===================================================================
// Props
// =================================================================== */

/**
 * Props fuer die DonationReceiptPdf-Komponente.
 *
 * @param donation - Die Spende mit allen Feldern (inkl. View-Felder).
 * @param authUser - Der Benutzer, der die Quittung generiert.
 */
type DonationReceiptPdfProps = {
  donation: DonationDomain;
  authUser: AuthUser;
};

/* ===================================================================
// Dokument
// =================================================================== */

/**
 * PDF-Dokument fuer die Spendenquittung (Thank-You Card).
 */
const DonationReceiptPdf = ({
  donation,
  authUser,
}: DonationReceiptPdfProps) => {
  const documentTitle = donation.eventName
    ? `${TEXT_RECEIPT_TITLE} ${donation.eventName}`
    : `${TEXT_RECEIPT_TITLE} ${donation.receiptNumber ?? donation.id}`;

  const receiptDate = donation.paidAt ?? donation.createdAt;
  const amountFormatted = `Fr. ${(donation.amountInCents / 100).toFixed(2)}`;
  const formattedDate = receiptDate.toLocaleString("de-CH", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  return (
    <Document
      author={authUser.publicProfile.displayName}
      creator={TEXT_APP_NAME}
      keywords={documentTitle}
      subject={documentTitle}
      title={documentTitle}
    >
      <Page size="A5" style={styles.page}>
        {/* Logo-Header */}
        <View style={styles.logoHeader}>
          <Image src="/logo512.png" style={styles.logoImage} />
          <Text style={styles.logoText}>{TEXT_APP_NAME}</Text>
        </View>

        {/* Dekorative Herz-Trennlinie */}
        <View style={styles.heartDividerRow}>
          <View style={styles.heartDividerLine} />
          <Svg style={styles.heartSvg} width="12" height="12" viewBox="0 0 24 24">
            <Path
              d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
              fill="#e57373"
            />
          </Svg>
          <View style={styles.heartDividerLine} />
        </View>

        {/* Titel */}
        <Text style={styles.title}>{TEXT_RECEIPT_TITLE}</Text>

        {/* Quittungsnummer (optional) */}
        {donation.receiptNumber && (
          <Text style={styles.subtitle}>{donation.receiptNumber}</Text>
        )}

        {/* Info-Box */}
        <View style={styles.infoBox}>
          {/* Anlass (nur wenn vorhanden) */}
          {donation.eventName && (
            <View style={styles.infoRow}>
              <Text style={styles.infoKey}>{TEXT_EVENT}</Text>
              <Text style={styles.infoValue}>{donation.eventName}</Text>
            </View>
          )}
          {/* Datum */}
          <View style={styles.infoRow}>
            <Text style={styles.infoKey}>{TEXT_DATE}</Text>
            <Text style={styles.infoValue}>{formattedDate}</Text>
          </View>
          {/* Betrag */}
          <View style={styles.infoRow}>
            <Text style={styles.infoKey}>{TEXT_AMOUNT}</Text>
            <Text style={styles.infoValue}>{amountFormatted}</Text>
          </View>
        </View>

        {/* Trennlinie */}
        <View style={styles.divider} />

        {/* Persoenliche Danksagung */}
        <Text style={styles.thankYouHeading}>Herzlichen Dank,</Text>
        <Text style={styles.donorName}>{donation.donorDisplayName}!</Text>
        <Text style={styles.personalMessage}>{TEXT_PERSONAL_MESSAGE}</Text>

        {/* Trennlinie */}
        <View style={styles.divider} />

        {/* Verein */}
        <Text style={styles.association}>
          {TEXT_ASSOCIATION} {TEXT_APP_NAME}
        </Text>

        {/* Einfacher Footer */}
        <Text style={styles.simpleFooter}>
          {TEXT_APP_NAME} · {TEXT_RECEIPT_URL}
        </Text>
      </Page>
    </Document>
  );
};

export {DonationReceiptPdf};
