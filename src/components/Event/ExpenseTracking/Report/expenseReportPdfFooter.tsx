import React from "react";
import {Text, View} from "@react-pdf/renderer";

import {
  DONATION_RECEIPT_URL as TEXT_APP_URL,
  REPORT_PAGE_OF as TEXT_REPORT_PAGE_OF,
} from "../../../../constants/text";
import {reportLayoutStyles as styles} from "../../../../constants/styles/expenseTrackingReportPDF.styles";

/**
 * Footer jeder Seite der Abrechnung (Spez. 2.5, 7): links ein Text, in der
 * Mitte «Seite x von y» über das ganze PDF, rechts «chuchipirat.ch».
 * `fixed`, damit er auf jeder Seite eines umbrechenden Inhalts steht.
 *
 * @param props.leftText - Abrechnungsseiten: «Erstellt am … von …»;
 *   Belegseiten: «Beleg n von N».
 * @returns Der Footer.
 * @example
 * <ReportFooter leftText={getCreatedAtLabel(generatedAt, authUser)} />
 */
export const ReportFooter = ({leftText}: {leftText: string}) => (
  <View style={styles.footer} fixed>
    <Text style={[styles.footerText, styles.footerLeft]}>{leftText}</Text>
    <Text
      style={[styles.footerText, styles.footerCenter]}
      render={({pageNumber, totalPages}) =>
        TEXT_REPORT_PAGE_OF(pageNumber, totalPages)
      }
    />
    <Text style={[styles.footerText, styles.footerRight]}>{TEXT_APP_URL}</Text>
  </View>
);
