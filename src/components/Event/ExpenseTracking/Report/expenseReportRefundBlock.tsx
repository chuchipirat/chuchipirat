import React from "react";
import {Text, View} from "@react-pdf/renderer";

import {
  IBAN as TEXT_IBAN,
  REPORT_ACCOUNT_HOLDER as TEXT_REPORT_ACCOUNT_HOLDER,
  REPORT_POSTAL_CODE_CITY as TEXT_REPORT_POSTAL_CODE_CITY,
  REPORT_REFUND_TO as TEXT_REPORT_REFUND_TO,
  STREET as TEXT_STREET,
} from "../../../../constants/text";
import {pdfStyles as styles} from "../../../../constants/styles/expenseTrackingReportPDF.styles";
import {formatIban, normalizeIban} from "../../../../utils/ibanUtils";
import {PaymentDetailsFormValues} from "../../../User/userPaymentDetails.types";

/**
 * Eine Zeile im Block «Rückerstattung an».
 *
 * @param key - Stabiler Schlüssel für React.
 * @param label - Bezeichnung, z.B. «IBAN».
 * @param value - Wert; leer = Linie zum Ausfüllen.
 */
export type RefundRow = {key: string; label: string; value: string};

/**
 * Zeilen des Blocks «Rückerstattung an»: Kontoinhaber*in, Strasse,
 * PLZ / Ort und IBAN (in Viererblöcken). Ohne Angaben bleiben die Werte
 * leer und werden zu Linien (F8).
 *
 * @param accountHolder - Name der Kontoinhaber*in.
 * @param details - Adresse und IBAN; `null` = keine Angaben (Linien).
 * @returns Vier Zeilen in fester Reihenfolge.
 * @example
 * getRefundRows("Anna", null).map((row) => row.value) // ["Anna", "", "", ""]
 */
export const getRefundRows = (
  accountHolder: string,
  details: PaymentDetailsFormValues | null,
): RefundRow[] => {
  const iban = normalizeIban(details?.iban ?? "");
  return [
    {
      key: "accountHolder",
      label: TEXT_REPORT_ACCOUNT_HOLDER,
      value: accountHolder.trim(),
    },
    {key: "street", label: TEXT_STREET, value: details?.street.trim() ?? ""},
    {
      key: "postalCodeCity",
      label: TEXT_REPORT_POSTAL_CODE_CITY,
      value: [details?.postalCode.trim(), details?.city.trim()]
        .filter(Boolean)
        .join(" "),
    },
    {key: "iban", label: TEXT_IBAN, value: iban ? formatIban(iban) : ""},
  ];
};

/**
 * Props für {@link RefundDetailsBlock}.
 *
 * @param accountHolder - Name der Kontoinhaber*in (`getAccountHolderName`).
 * @param details - Adresse und IBAN; `null` = Linien zum Ausfüllen.
 */
type RefundDetailsBlockProps = {
  accountHolder: string;
  details: PaymentDetailsFormValues | null;
};

/**
 * Block «Rückerstattung an» unter dem Personennamen im PDF (Story 7.4):
 * wohin das Geld geht. Wird nie über zwei Seiten verteilt.
 *
 * @param props - Siehe {@link RefundDetailsBlockProps}.
 * @returns Der Block.
 * @example
 * <RefundDetailsBlock accountHolder="Anna Muster" details={refundDetails} />
 */
export const RefundDetailsBlock = ({
  accountHolder,
  details,
}: RefundDetailsBlockProps) => (
  <View style={styles.refundBlock} wrap={false}>
    <Text style={styles.refundHeading}>{TEXT_REPORT_REFUND_TO}</Text>
    {getRefundRows(accountHolder, details).map((row) => (
      <View key={row.key} style={styles.refundRow}>
        <Text style={styles.refundLabel}>{row.label}</Text>
        {/* Ternary: ein leerer Wert darf nicht als String in <View> landen */}
        {row.value ? (
          <Text style={styles.refundValue}>{row.value}</Text>
        ) : (
          <View style={styles.refundLine} />
        )}
      </View>
    ))}
  </View>
);
