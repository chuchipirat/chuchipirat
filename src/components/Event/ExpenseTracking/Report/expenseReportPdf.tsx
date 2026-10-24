import React from "react";
import {Document, Page, View, Text} from "@react-pdf/renderer";
import "../../../Shared/pdfFontRegistration";

import AuthUser from "../../../Session/authUser.class";
import {Footer, Header} from "../../../Shared/pdfComponents";
import {formatAmountFromCents} from "../../../Shared/utils/currencyUtils";
import {
  AMOUNT as TEXT_AMOUNT,
  APP_NAME as TEXT_APP_NAME,
  BUDGET as TEXT_BUDGET,
  DATE as TEXT_DATE,
  LABEL as TEXT_LABEL,
  REPORT_COLUMN_RECEIPT as TEXT_REPORT_COLUMN_RECEIPT,
  REPORT_GRAND_TOTAL as TEXT_REPORT_GRAND_TOTAL,
  REPORT_NO_RECEIPT_NUMBER as TEXT_REPORT_NO_RECEIPT_NUMBER,
  REPORT_NO_REFUND_HINT as TEXT_REPORT_NO_REFUND_HINT,
  REPORT_REFUND_TOTAL as TEXT_REPORT_REFUND_TOTAL,
  REPORT_TITLE as TEXT_REPORT_TITLE,
  REPORT_TOTAL_OF as TEXT_REPORT_TOTAL_OF,
} from "../../../../constants/text";
import {
  CurrencyTotal,
  ExpenseReportData,
  ReportGroup,
  ReportMode,
  ReportPayeeSection,
  ReportRow,
} from "./expenseReport.types";
import {
  formatReportDate,
  getReportSubtitle,
  getReportTitle,
} from "./expenseReportLabels";
import {pdfStyles as styles} from "../../../../constants/styles/expenseTrackingReportPDF.styles";

/**
 * Mindestplatz (pt) nach einer Überschrift auf derselben Seite, damit
 * keine Personen- oder Budgetüberschrift allein unten steht.
 */
const MIN_PRESENCE_AHEAD = 40;

/**
 * Props für {@link ExpenseReportPdf}.
 *
 * @param report - Fertige Abrechnung aus `ExpenseReport.build`.
 * @param eventName - Name des Anlasses (Kopfzeile, Titel).
 * @param authUser - Angemeldete Person (Fusszeile «erstellt von»).
 * @param generatedAt - Zeitpunkt der Erstellung (Fusszeile).
 */
type ExpenseReportPdfProps = {
  report: ExpenseReportData;
  eventName: string;
  authUser: AuthUser;
  generatedAt: Date;
};

/**
 * PDF-Dokument der Abrechnung: Titel, pro Person eine oder
 * mehrere Tabellen mit Summen und bei «Alle Personen» das Gesamttotal.
 * Zeichnet nur die fertige Struktur, rechnet selbst nichts. Belege
 * und Zahlungsangaben folgen.
 *
 * @param props - Siehe {@link ExpenseReportPdfProps}.
 * @returns Das react-pdf-Dokument.
 * @example
 * <ExpenseReportPdf
 *   report={ExpenseReport.build({expenses, budgets, cooks, options})}
 *   eventName={event.name}
 *   authUser={authUser}
 *   generatedAt={new Date()}
 * />
 */
export const ExpenseReportPdf = ({
  report,
  eventName,
  authUser,
  generatedAt,
}: ExpenseReportPdfProps) => {
  const title = getReportTitle(eventName, report.payeeDisplayName);

  return (
    <Document
      author={authUser.publicProfile.displayName}
      creator={TEXT_APP_NAME}
      title={title}
      subject={title}
    >
      <Page size="A4" style={styles.body}>
        <Header text={eventName} uid="expenseReport" />
        <Text style={styles.title}>{TEXT_REPORT_TITLE}</Text>
        <View style={styles.titleUnderline} />
        <Text style={styles.subTitle}>
          {getReportSubtitle(report.payeeDisplayName, report.mode)}
        </Text>
        <View style={styles.infoSectionDivider} />
        {report.sections.map((section) => (
          <PayeeSectionBlock
            key={section.payeeKey}
            section={section}
            mode={report.mode}
            includeComments={report.includeComments}
          />
        ))}
        {report.grandTotals !== null && report.refundTotals !== null ? (
          <View style={styles.grandTotalBlock} wrap={false}>
            <TotalRows
              label={TEXT_REPORT_GRAND_TOTAL}
              totals={report.grandTotals}
              isBold
            />
            <TotalRows
              label={TEXT_REPORT_REFUND_TOTAL}
              totals={report.refundTotals}
            />
          </View>
        ) : null}
        <Footer
          uid="expenseReport"
          actualDate={generatedAt}
          authUser={authUser}
        />
      </Page>
    </Document>
  );
};

/**
 * Props für {@link PayeeSectionBlock}.
 *
 * @param section - Block einer Person.
 * @param mode - Modus der Abrechnung.
 * @param includeComments - Kommentarzeilen zeigen.
 */
type PayeeSectionBlockProps = {
  section: ReportPayeeSection;
  mode: ReportMode;
  includeComments: boolean;
};

/**
 * Block einer Person: Überschrift, Tabelle(n) und Personentotal. In
 * Modus A ist das Gruppentotal gleich dem Personentotal und wird darum
 * nur einmal gezeigt.
 *
 * @param props - Siehe {@link PayeeSectionBlockProps}.
 */
const PayeeSectionBlock = ({
  section,
  mode,
  includeComments,
}: PayeeSectionBlockProps) => (
  <View style={styles.section}>
    <Text style={styles.payeeHeading} minPresenceAhead={MIN_PRESENCE_AHEAD}>
      {section.displayName}
    </Text>
    {section.isNoRefund ? (
      <Text style={styles.noRefundHint}>{TEXT_REPORT_NO_REFUND_HINT}</Text>
    ) : null}
    {section.groups.map((group, groupIndex) => (
      <ReportTable
        // Gruppen kennen keine Budget-ID; Index ist stabil (statisches Dokument)
        key={`${groupIndex}_${group.budgetName}`}
        group={group}
        mode={mode}
        includeComments={includeComments}
      />
    ))}
    <TotalRows
      label={TEXT_REPORT_TOTAL_OF(section.displayName)}
      totals={section.totals}
      isBold
    />
  </View>
);

/**
 * Props für {@link ReportTable}.
 *
 * @param group - Eine Tabelle (Modus B: ein Budget).
 * @param mode - Modus der Abrechnung.
 * @param includeComments - Kommentarzeilen zeigen.
 */
type ReportTableProps = {
  group: ReportGroup;
  mode: ReportMode;
  includeComments: boolean;
};

/**
 * Eine Tabelle: in Modus B mit Budget als Titel und Zwischensumme,
 * in Modus A ohne beides.
 *
 * @param props - Siehe {@link ReportTableProps}.
 */
const ReportTable = ({group, mode, includeComments}: ReportTableProps) => (
  <View style={styles.table}>
    {group.budgetName !== null ? (
      <Text style={styles.groupHeading} minPresenceAhead={MIN_PRESENCE_AHEAD}>
        {group.budgetName}
      </Text>
    ) : null}
    <ReportTableHeader mode={mode} />
    {group.rows.map((row) => (
      <ReportTableRow
        key={row.expenseId}
        row={row}
        mode={mode}
        includeComments={includeComments}
      />
    ))}
    {group.budgetName !== null ? (
      <TotalRows
        label={TEXT_REPORT_TOTAL_OF(group.budgetName)}
        totals={group.totals}
      />
    ) : null}
  </View>
);

/**
 * Spaltenköpfe; die Budgetspalte gibt es nur in Modus A.
 *
 * @param props.mode - Modus der Abrechnung.
 */
const ReportTableHeader = ({mode}: {mode: ReportMode}) => {
  const showBudgetColumn = mode === ReportMode.PER_PERSON;

  return (
    <View style={styles.tableHeaderRow} wrap={false}>
      <Text style={[styles.tableHeaderCell, styles.colReceipt]}>
        {TEXT_REPORT_COLUMN_RECEIPT}
      </Text>
      <Text style={[styles.tableHeaderCell, styles.colDate]}>{TEXT_DATE}</Text>
      <Text
        style={[
          styles.tableHeaderCell,
          showBudgetColumn ? styles.colLabel : styles.colLabelWide,
        ]}
      >
        {TEXT_LABEL}
      </Text>
      {showBudgetColumn ? (
        <Text style={[styles.tableHeaderCell, styles.colBudget]}>
          {TEXT_BUDGET}
        </Text>
      ) : null}
      <Text style={[styles.tableHeaderCell, styles.colAmount]}>
        {TEXT_AMOUNT}
      </Text>
    </View>
  );
};

/**
 * Props für {@link ReportTableRow}.
 *
 * @param row - Die Zeile.
 * @param mode - Modus der Abrechnung (Budgetspalte ja/nein).
 * @param includeComments - Kommentarzeile zeigen.
 */
type ReportTableRowProps = {
  row: ReportRow;
  mode: ReportMode;
  includeComments: boolean;
};

/**
 * Eine Ausgabe. Wird nie über zwei Seiten verteilt (`wrap={false}`).
 * Ohne Belegnummer steht «–».
 *
 * @param props - Siehe {@link ReportTableRowProps}.
 */
const ReportTableRow = ({row, mode, includeComments}: ReportTableRowProps) => {
  const showBudgetColumn = mode === ReportMode.PER_PERSON;

  return (
    <View style={styles.tableRow} wrap={false}>
      <Text style={[styles.cell, styles.colReceipt]}>
        {row.receiptNumber !== null
          ? String(row.receiptNumber)
          : TEXT_REPORT_NO_RECEIPT_NUMBER}
      </Text>
      <Text style={[styles.cell, styles.colDate]}>
        {formatReportDate(row.date)}
      </Text>
      <View style={showBudgetColumn ? styles.colLabel : styles.colLabelWide}>
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
    </View>
  );
};

/**
 * Props für {@link TotalRows}.
 *
 * @param label - Beschriftung, z.B. «Total Anna».
 * @param totals - Summen pro Währung (CHF zuerst).
 * @param isBold - Fett für Personen- und Gesamttotal.
 */
type TotalRowsProps = {
  label: string;
  totals: CurrencyTotal[];
  isBold?: boolean;
};

/**
 * Summenzeilen, eine pro Währung. Die Beschriftung steht nur in der
 * ersten Zeile, weitere Währungen folgen darunter.
 *
 * @param props - Siehe {@link TotalRowsProps}.
 */
const TotalRows = ({label, totals, isBold = false}: TotalRowsProps) => (
  <View wrap={false}>
    {totals.map((total, index) => (
      <View key={total.currency} style={styles.totalRow}>
        <Text style={isBold ? styles.totalLabelBold : styles.totalLabel}>
          {index === 0 ? label : ""}
        </Text>
        <Text style={isBold ? styles.totalAmountBold : styles.totalAmount}>
          {formatAmountFromCents(total.amountInCents, total.currency)}
        </Text>
      </View>
    ))}
  </View>
);
