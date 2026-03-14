import React from "react";

import {pdfStyles} from "../../constants/stylesGeneralPdf";

import {Text, Image} from "@react-pdf/renderer";
import AuthUser from "../Firebase/Authentication/authUser.class";

import {
  APP_NAME as TEXT_APP_NAME,
  GENERATED_ON as TEXT_GENERATED_ON,
  GENERATED_FROM as TEXT_GENERATED_FROM,
} from "../../constants/text";

import {ImageRepository} from "../../constants/imageRepository";
/* ===================================================================
// ============================ Kopfzeile ============================
// =================================================================== */
/**
 * Gemeinsame Kopfzeile für alle PDF-Dokumente.
 *
 * Zeigt den Event- oder Dokumentnamen zentriert am oberen Seitenrand an.
 *
 * @param props.text - Anzeigetext (z.B. Event-Name).
 * @param props.uid - Eindeutiger Key-Suffix für React-Elemente.
 */
interface HeaderProps {
  text: string;
  uid: string;
}
export const Header = ({text, uid}: HeaderProps) => {
  const styles = pdfStyles;

  return (
    <Text key={"pageHeader_" + uid} style={styles.header} fixed>
      <Text key={"pageHeader_event_" + uid} style={styles.header} fixed>
        {text}
      </Text>
    </Text>
  );
};
/* ===================================================================
// ============================ Fusszeile ============================
// =================================================================== */
/**
 * Gemeinsame Fusszeile für alle PDF-Dokumente.
 *
 * Enthält Generierungsdatum, Autorenname, Seitenzahlen, App-Name
 * und optional das Chuchipirat-Logo.
 *
 * @param props.uid - Eindeutiger Key-Suffix für React-Elemente.
 * @param props.actualDate - Zeitstempel der PDF-Generierung.
 * @param props.authUser - Aktueller Benutzer (für Anzeigename).
 * @param props.showLogo - Logo in der Fusszeile anzeigen (Standard: true).
 */
interface FooterProps {
  uid: string;
  actualDate: Date;
  authUser: AuthUser;
  showLogo?: boolean;
}
export const Footer = ({
  uid,
  actualDate,
  authUser,
  showLogo = true,
}: FooterProps) => {
  const styles = pdfStyles;
  return (
    <React.Fragment>
      <Text
        key={"pageFooter_generatedOn_" + uid}
        style={styles.printedOn}
        fixed
      >
        {TEXT_GENERATED_ON}
        {actualDate.toLocaleString("de-CH", {
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
        })}
      </Text>
      <Text
        key={"pageFooter_printedFrom" + uid}
        style={styles.printedFrom}
        fixed
      >
        {TEXT_GENERATED_FROM}
        {authUser.publicProfile.displayName}
      </Text>
      <Text
        key={"pageFooter_pages_" + uid}
        style={styles.pageNumber}
        render={(renderProps) =>
          `${renderProps?.pageNumber ?? 0} / ${renderProps?.totalPages ?? 0}`
        }
        fixed
      />
      <Text key={"pageFooter_appName_" + uid} style={styles.chuchipirat} fixed>
        {TEXT_APP_NAME}
      </Text>
      {showLogo && (
        <Image
          style={styles.footerImage}
          src={ImageRepository.getEnvironmentRelatedPicture().PDF_FOOTER_IMAGE}
          fixed
        />
      )}
    </React.Fragment>
  );
};
