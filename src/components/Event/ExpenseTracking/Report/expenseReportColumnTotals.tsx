import React from "react";
import {Text, View} from "@react-pdf/renderer";
import {Style} from "@react-pdf/types";

import {reportLayoutStyles as styles} from "../../../../constants/styles/expenseTrackingReportPDF.styles";
import {CurrencyTotal} from "./expenseReport.types";
import {formatTotals} from "./expenseReportPdfHelpers";

/**
 * Props für {@link ColumnAlignedTotals}.
 *
 * @param totals - Beträge pro Währung, CHF zuerst.
 * @param textStyle - Schrift der Beträge (Balken bzw. Totalzeile).
 */
type ColumnAlignedTotalsProps = {
  totals: CurrencyTotal[];
  textStyle: Style;
};

/**
 * Beträge pro Währung untereinander, in der Breite der Spalte «Betrag»,
 * dahinter ein leerer Platz in der Breite der Spalte «Beleg». So stehen
 * Zwischentotal und Total genau unter den Beträgen der Ausgaben.
 *
 * @param props - Siehe {@link ColumnAlignedTotalsProps}.
 * @returns Betragsblock und Platzhalter.
 * @example
 * <ColumnAlignedTotals totals={section.totals} textStyle={styles.totalText} />
 */
export const ColumnAlignedTotals = ({
  totals,
  textStyle,
}: ColumnAlignedTotalsProps) => (
  <React.Fragment>
    <View style={styles.colAmount}>
      {formatTotals(totals).map((amount) => (
        <Text key={amount} style={[textStyle, styles.columnTotal]}>
          {amount}
        </Text>
      ))}
    </View>
    <View style={styles.colReceiptRef} />
  </React.Fragment>
);
