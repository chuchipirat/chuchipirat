import React from "react";
import {Text, View} from "@react-pdf/renderer";

import {
  REPORT_NO_REFUND_HINT as TEXT_REPORT_NO_REFUND_HINT,
  REPORT_TOTAL_OF as TEXT_REPORT_TOTAL_OF,
} from "../../../../constants/text";
import {reportLayoutStyles as styles} from "../../../../constants/styles/expenseTrackingReportPDF.styles";
import {BudgetIcon} from "../Budget/budget.types";
import {PaymentDetailsFormValues} from "../../../User/userPaymentDetails.types";
import {
  CurrencyTotal,
  ReportGroup,
  ReportMode,
  ReportPayeeSection,
} from "./expenseReport.types";
import {BudgetBar} from "./expenseReportBudgetBar";
import {PaymentDetailsBlock} from "./expenseReportPaymentDetails";
import {
  canKeepCardTogether,
  getCardStartHeight,
  isPaymentDetailsComplete,
  splitTotalsForAccounting,
} from "./expenseReportPdfHelpers";
import {ColumnAlignedTotals} from "./expenseReportColumnTotals";
import {ReportTableHeader, ReportTableRow} from "./expenseReportTableRow";

/** Mindestplatz (pt) für die Totalzeile, damit sie nicht verwaist. */
const TOTAL_MIN_PRESENCE_AHEAD = 20;

/**
 * Props für {@link PayeeCard}.
 *
 * @param section - Block der Person.
 * @param mode - Aufbau A (eine Tabelle) oder B (pro Budget).
 * @param includeComments - Kommentare zeigen.
 * @param accountHolder - Name der Kontoinhaber*in.
 * @param refundDetails - Adresse und IBAN; `null` = Kasten zum Ergänzen.
 * @param receiptStartPages - Belegnummer → Startseite im PDF.
 */
type PayeeCardProps = {
  section: ReportPayeeSection;
  mode: ReportMode;
  includeComments: boolean;
  accountHolder: string;
  refundDetails: PaymentDetailsFormValues | null;
  receiptStartPages: Map<number, number>;
};

/**
 * Karte einer Person (Spez. 3, 4, 6): Name und Rückerstattungsbetrag,
 * Zahlungsangaben (ausser bei «Ohne Rückerstattung»), dann die Ausgaben.
 * Aufbau A: eine Tabelle mit Budgetspalte. Aufbau B: je Budget ein Balken
 * mit Zwischentotal, am Ende «Total <Name>»; beide Beträge stehen in der
 * Spalte «Betrag», je Währung eine Zeile.
 *
 * @param props - Siehe {@link PayeeCardProps}.
 * @returns Die Karte.
 * @example
 * <PayeeCard section={section} mode={report.mode} includeComments={false}
 *   accountHolder="Anna" refundDetails={null} receiptStartPages={new Map()} />
 */
export const PayeeCard = ({
  section,
  mode,
  includeComments,
  accountHolder,
  refundDetails,
  receiptStartPages,
}: PayeeCardProps) => {
  const isPerBudget = mode === ReportMode.PER_PERSON_AND_BUDGET;
  const lastExpenseId = section.groups.at(-1)?.rows.at(-1)?.expenseId;
  const hasFillInBox =
    !section.isNoRefund && !isPaymentDetailsComplete(refundDetails);

  return (
    <React.Fragment>
      {/* Leerer Platzhalter: Passt der Anfang der Karte nicht mehr auf die
          Seite, rutscht er mitsamt Karte auf die nächste. Direkt an der
          Karte wirkt minPresenceAhead nicht, weil sie selbst umbricht. */}
      <View minPresenceAhead={getCardStartHeight(section, hasFillInBox)} />
      <View
        style={styles.card}
        wrap={!canKeepCardTogether(section, includeComments, hasFillInBox)}
      >
        <View style={styles.cardHead}>
          <Text style={styles.payeeName}>{section.displayName}</Text>
          <AccountingTotals totals={section.totals} />
        </View>
        {section.isNoRefund ? (
          <Text style={styles.noRefundHint}>{TEXT_REPORT_NO_REFUND_HINT}</Text>
        ) : (
          <PaymentDetailsBlock
            accountHolder={accountHolder}
            details={refundDetails}
          />
        )}
        <ReportTableHeader showBudgetColumn={!isPerBudget} />
        {section.groups.map((group, groupIndex) => (
          <GroupRows
            // Gruppen kennen keine Budget-ID; Index ist stabil (statisches Dokument)
            key={`${groupIndex}_${group.budgetName}`}
            group={group}
            showBudgetColumn={!isPerBudget}
            // Nur ein Budget: Zwischentotal wäre gleich wie das Total
            showGroupTotals={section.groups.length > 1}
            includeComments={includeComments}
            receiptStartPages={receiptStartPages}
            lastExpenseId={lastExpenseId}
          />
        ))}
        {isPerBudget ? (
          <View
            style={styles.totalRow}
            wrap={false}
            minPresenceAhead={TOTAL_MIN_PRESENCE_AHEAD}
          >
            <Text style={[styles.totalText, styles.totalLabel]}>
              {TEXT_REPORT_TOTAL_OF(section.displayName)}
            </Text>
            <ColumnAlignedTotals
              totals={section.totals}
              textStyle={styles.totalText}
            />
          </View>
        ) : null}
      </View>
    </React.Fragment>
  );
};

/**
 * Props für {@link GroupRows}.
 *
 * @param group - Eine Tabelle der Person (Aufbau B: ein Budget).
 * @param showBudgetColumn - Budgetspalte (Aufbau A).
 * @param showGroupTotals - Zwischentotal im Budget-Balken (Aufbau B) zeigen.
 * @param includeComments - Kommentare zeigen.
 * @param receiptStartPages - Belegnummer → Startseite im PDF.
 * @param lastExpenseId - Letzte Ausgabe der Karte (ohne Trennlinie).
 */
type GroupRowsProps = {
  group: ReportGroup;
  showBudgetColumn: boolean;
  showGroupTotals: boolean;
  includeComments: boolean;
  receiptStartPages: Map<number, number>;
  lastExpenseId: string | undefined;
};

/**
 * Zeilen einer Gruppe, in Aufbau B mit Budget-Balken davor.
 *
 * @param props - Siehe {@link GroupRowsProps}.
 */
const GroupRows = ({
  group,
  showBudgetColumn,
  showGroupTotals,
  includeComments,
  receiptStartPages,
  lastExpenseId,
}: GroupRowsProps) => (
  <React.Fragment>
    {group.budgetName !== null ? (
      <BudgetBar
        budgetName={group.budgetName}
        budgetIcon={group.budgetIcon ?? BudgetIcon.OTHER}
        totals={group.totals}
        showTotals={showGroupTotals}
      />
    ) : null}
    {group.rows.map((row) => (
      <ReportTableRow
        key={row.expenseId}
        row={row}
        showBudgetColumn={showBudgetColumn}
        includeComments={includeComments}
        receiptStartPage={
          row.receiptNumber !== null
            ? receiptStartPages.get(row.receiptNumber)
            : undefined
        }
        isLastInCard={row.expenseId === lastExpenseId}
      />
    ))}
  </React.Fragment>
);

/**
 * Personentotal im Kartenkopf im Buchhaltungsformat: Währungen
 * linksbündig untereinander, Zahlen rechtsbündig daneben, damit die
 * Dezimalpunkte untereinander stehen.
 *
 * @param props.totals - Beträge pro Währung, CHF zuerst.
 * @returns Zwei Spalten; ohne Beträge leer.
 * @example
 * <AccountingTotals totals={section.totals} />
 */
const AccountingTotals = ({totals}: {totals: CurrencyTotal[]}) => {
  const amounts = splitTotalsForAccounting(totals);
  return (
    <View style={styles.accountingAmounts}>
      <View style={styles.accountingCurrencies}>
        {amounts.map(({currency}) => (
          <Text key={currency} style={styles.payeeTotalCurrency}>
            {currency}
          </Text>
        ))}
      </View>
      <View style={styles.accountingNumbers}>
        {amounts.map(({currency, amount}) => (
          <Text key={currency} style={styles.payeeTotal}>
            {amount}
          </Text>
        ))}
      </View>
    </View>
  );
};
