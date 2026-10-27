import React from "react";
import {Text, View} from "@react-pdf/renderer";

import {
  AMOUNT as TEXT_AMOUNT,
  BUDGET as TEXT_BUDGET,
  DATE as TEXT_DATE,
  LABEL as TEXT_LABEL,
  REPORT_COLUMN_NUMBER as TEXT_REPORT_COLUMN_NUMBER,
  REPORT_COLUMN_RECEIPT as TEXT_REPORT_COLUMN_RECEIPT,
  REPORT_NO_RECEIPT_NUMBER as TEXT_REPORT_NO_RECEIPT_NUMBER,
  REPORT_PAGE_REF as TEXT_REPORT_PAGE_REF,
} from "../../../../constants/text";
import {reportLayoutStyles as styles} from "../../../../constants/styles/expenseTrackingReportPDF.styles";
import {formatAmountFromCents} from "../../../Shared/utils/currencyUtils";
import {ReportRow} from "./expenseReport.types";
import {formatReportDate} from "./expenseReportLabels";

/**
 * Spaltenköpfe: Nr. | Datum | Bezeichnung | (Budget) | Betrag | Beleg.
 * `fixed`: wiederholt sich auf jeder Seite, über die die Karte umbricht.
 *
 * @param props.showBudgetColumn - Budgetspalte (nur Aufbau A).
 * @returns Die Kopfzeile.
 * @example
 * <ReportTableHeader showBudgetColumn />
 */
export const ReportTableHeader = ({
  showBudgetColumn,
}: {
  showBudgetColumn: boolean;
}) => (
  <View style={styles.tableHeaderRow} fixed>
    <Text style={[styles.tableHeaderCell, styles.colNumber]}>
      {TEXT_REPORT_COLUMN_NUMBER}
    </Text>
    <Text style={[styles.tableHeaderCell, styles.colDate]}>{TEXT_DATE}</Text>
    <Text style={[styles.tableHeaderCell, styles.colLabel]}>{TEXT_LABEL}</Text>
    {showBudgetColumn ? (
      <Text style={[styles.tableHeaderCell, styles.colBudget]}>
        {TEXT_BUDGET}
      </Text>
    ) : null}
    <Text style={[styles.tableHeaderCell, styles.colAmount]}>
      {TEXT_AMOUNT}
    </Text>
    <Text style={[styles.tableHeaderCell, styles.colReceiptRef]}>
      {TEXT_REPORT_COLUMN_RECEIPT}
    </Text>
  </View>
);

/**
 * Props für {@link ReportTableRow}.
 *
 * @param row - Die Ausgabe.
 * @param showBudgetColumn - Budgetspalte (nur Aufbau A).
 * @param includeComments - Kommentar als zweite Zeile zeigen.
 * @param receiptStartPage - Startseite des Belegs im PDF; `undefined` =
 *   leere Zelle (kein Beleg und keine Leerseite).
 * @param isLastInCard - Letzte Zeile der Karte: ohne Trennlinie, weil
 *   Kartenrand bzw. Totallinie folgen.
 */
type ReportTableRowProps = {
  row: ReportRow;
  showBudgetColumn: boolean;
  includeComments: boolean;
  receiptStartPage: number | undefined;
  isLastInCard: boolean;
};

/**
 * Eine Ausgabe. Wird nie über zwei Seiten verteilt (`wrap={false}`), damit
 * Kommentar und Zeile zusammenbleiben. Ohne Belegnummer steht «–».
 *
 * @param props - Siehe {@link ReportTableRowProps}.
 * @returns Die Zeile.
 * @example
 * <ReportTableRow row={row} showBudgetColumn includeComments
 *   receiptStartPage={5} isLastInCard={false} />
 */
export const ReportTableRow = ({
  row,
  showBudgetColumn,
  includeComments,
  receiptStartPage,
  isLastInCard,
}: ReportTableRowProps) => (
  <View
    style={isLastInCard ? styles.tableRowLast : styles.tableRow}
    wrap={false}
  >
    <Text style={[styles.cell, styles.colNumber]}>
      {row.receiptNumber !== null
        ? String(row.receiptNumber)
        : TEXT_REPORT_NO_RECEIPT_NUMBER}
    </Text>
    <Text style={[styles.cell, styles.colDate]}>
      {formatReportDate(row.date)}
    </Text>
    <View style={styles.colLabel}>
      <Text style={styles.cell}>{row.label}</Text>
      {/* Ternary statt &&: ein leerer Kommentar ("") darf nicht als Kind landen */}
      {includeComments && row.comment ? (
        <Text style={styles.comment}>{row.comment}</Text>
      ) : null}
    </View>
    {showBudgetColumn ? (
      <Text style={[styles.cell, styles.colBudget]}>{row.budgetName}</Text>
    ) : null}
    <Text style={[styles.cell, styles.colAmount]}>
      {formatAmountFromCents(row.amountInCents, row.currency)}
    </Text>
    {receiptStartPage !== undefined ? (
      <Text style={[styles.cell, styles.pageRef, styles.colReceiptRef]}>
        {TEXT_REPORT_PAGE_REF(receiptStartPage)}
      </Text>
    ) : (
      <View style={styles.colReceiptRef} />
    )}
  </View>
);
