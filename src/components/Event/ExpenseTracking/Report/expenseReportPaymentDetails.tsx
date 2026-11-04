import React from "react";
import {Text, View} from "@react-pdf/renderer";

import {
  IBAN as TEXT_IBAN,
  REPORT_ACCOUNT_HOLDER as TEXT_REPORT_ACCOUNT_HOLDER,
  REPORT_POSTAL_CODE_CITY as TEXT_REPORT_POSTAL_CODE_CITY,
  STREET as TEXT_STREET,
} from "../../../../constants/text";
import {reportLayoutStyles as styles} from "../../../../constants/styles/expenseTrackingReportPDF.styles";
import {normalizeIban} from "../../../../utils/ibanUtils";
import {PaymentDetailsFormValues} from "../../../User/userPaymentDetails.types";
import {
  getIbanBoxGroups,
  getPaymentDetailsLine,
  isPaymentDetailsComplete,
} from "./expenseReportPdfHelpers";

/**
 * Props für {@link PaymentDetailsBlock}.
 *
 * @param accountHolder - Name der Kontoinhaber*in (`getAccountHolderName`).
 * @param details - Adresse und IBAN; `null` = keine Angaben.
 */
type PaymentDetailsBlockProps = {
  accountHolder: string;
  details: PaymentDetailsFormValues | null;
};

/**
 * Zahlungsangaben unter dem Personennamen (Spez. 5): vollständig als graue
 * Zeile, sonst ein Kasten zum Ergänzen von Hand, in dem vorhandene
 * Teilangaben schon stehen.
 *
 * @param props - Siehe {@link PaymentDetailsBlockProps}.
 * @returns Zeile oder Kasten.
 * @example
 * <PaymentDetailsBlock accountHolder="Anna Muster" details={null} />
 */
export const PaymentDetailsBlock = ({
  accountHolder,
  details,
}: PaymentDetailsBlockProps) =>
  isPaymentDetailsComplete(details) ? (
    <Text style={styles.paymentLine}>{getPaymentDetailsLine(details)}</Text>
  ) : (
    <PaymentDetailsFillIn accountHolder={accountHolder} details={details} />
  );

/**
 * Grauer Kasten «Zahlungsangaben bitte von Hand ergänzen» mit Linien und
 * IBAN-Kästchen. Wird nie über zwei Seiten verteilt.
 *
 * @param props - Siehe {@link PaymentDetailsBlockProps}.
 */
const PaymentDetailsFillIn = ({
  accountHolder,
  details,
}: PaymentDetailsBlockProps) => {
  const postalCodeCity = [details?.postalCode.trim(), details?.city.trim()]
    .filter(Boolean)
    .join(" ");
  const iban = details?.iban ?? "";
  const ibanBoxGroups = getIbanBoxGroups(iban);

  return (
    <View style={styles.fillBox} wrap={false}>
      <FillInRow
        label={TEXT_REPORT_ACCOUNT_HOLDER}
        value={accountHolder.trim()}
      />
      <FillInRow label={TEXT_STREET} value={details?.street.trim() ?? ""} />
      <FillInRow label={TEXT_REPORT_POSTAL_CODE_CITY} value={postalCodeCity} />
      {ibanBoxGroups === null ? (
        // passt nicht in 21 Kästchen (z.B. ausländische IBAN): als Text
        <FillInRow label={TEXT_IBAN} value={normalizeIban(iban)} />
      ) : (
        <View style={styles.fillRow}>
          <Text style={styles.fillLabel}>{TEXT_IBAN}</Text>
          <IbanBoxes groups={ibanBoxGroups} />
        </View>
      )}
    </View>
  );
};

/**
 * Eine Zeile im Kasten: Beschriftung und Linie, ein vorhandener Wert steht
 * auf der Linie.
 *
 * @param props.label - Beschriftung, z.B. «Strasse».
 * @param props.value - Vorhandener Wert; leer = nur Linie.
 */
const FillInRow = ({label, value}: {label: string; value: string}) => (
  <View style={styles.fillRow}>
    <Text style={styles.fillLabel}>{label}</Text>
    <View style={styles.fillLine}>
      {/* Ternary: ein leerer Wert darf nicht als String in <View> landen */}
      {value ? <Text style={styles.fillValue}>{value}</Text> : null}
    </View>
  </View>
);

/**
 * 21 Kästchen für eine Schweizer IBAN, gruppiert zu 5 × 4 + 1.
 *
 * @param props.groups - Zeichen pro Gruppe aus `getIbanBoxGroups`.
 */
const IbanBoxes = ({groups}: {groups: string[][]}) => (
  <View style={styles.ibanBoxes}>
    {groups.map((group, groupIndex) => (
      // feste Anzahl Gruppen und Kästchen: Index ist stabil
      <View key={groupIndex} style={styles.ibanGroup}>
        {group.map((character, boxIndex) => (
          <View key={boxIndex} style={styles.ibanBox}>
            {character ? (
              <Text style={styles.ibanBoxText}>{character}</Text>
            ) : null}
          </View>
        ))}
      </View>
    ))}
  </View>
);
