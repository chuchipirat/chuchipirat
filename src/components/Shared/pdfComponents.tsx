import React from "react";

import StylesPdf from "../../constants/stylesGeneralPdf";

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
interface HeaderProps {
  text: string;
  uid: string;
}
export const Header = ({text, uid}: HeaderProps) => {
  const styles = StylesPdf.getPdfStyles();

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
  const styles = StylesPdf.getPdfStyles();
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
        render={({pageNumber, totalPages}) => `${pageNumber} / ${totalPages}`}
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
