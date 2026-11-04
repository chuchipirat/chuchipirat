import React from "react";
import {Image, Page, Text, View} from "@react-pdf/renderer";

import {
  REPORT_COLORS,
  reportLayoutStyles as styles,
} from "../../../../constants/styles/expenseTrackingReportPDF.styles";
import {
  REPORT_PAGE_OF as TEXT_REPORT_PAGE_OF,
  REPORT_RECEIPT_LOAD_FAILED as TEXT_REPORT_RECEIPT_LOAD_FAILED,
  REPORT_RECEIPT_LOAD_FAILED_HINT as TEXT_REPORT_RECEIPT_LOAD_FAILED_HINT,
  REPORT_RECEIPT_NOT_UPLOADED as TEXT_REPORT_RECEIPT_NOT_UPLOADED,
  REPORT_RECEIPT_OF as TEXT_REPORT_RECEIPT_OF,
  REPORT_RECEIPT_PASTE_HERE as TEXT_REPORT_RECEIPT_PASTE_HERE,
} from "../../../../constants/text";
import {formatAmountFromCents} from "../../../Shared/utils/currencyUtils";
import {LoadedReceipt, ReceiptPageSlot} from "./expenseReport.types";
import {getReceiptMetaLine} from "./expenseReportLabels";
import {ReportFooter} from "./expenseReportPdfFooter";
import {ReceiptMeta} from "./expenseReportPdfHelpers";
import {PdfIcon, RECEIPT_ICON_PATHS} from "./expenseReportPdfIcon";

/**
 * Props für {@link ReceiptPage}.
 *
 * @param slot - Die Belegseite (Beleg und Seite innerhalb des Belegs).
 * @param receiptCount - Anzahl Belege im PDF (Footer «Beleg n von N»).
 * @param meta - Budget und Person der Ausgabe für die Zeile unter der
 *   Bezeichnung; `undefined`, wenn die Ausgabe nicht gefunden wurde.
 */
type ReceiptPageProps = {
  slot: ReceiptPageSlot;
  receiptCount: number;
  meta: ReceiptMeta | undefined;
};

/**
 * Eine Seite des Anhangs (Spez. 7): Kopf mit Nummer im Teal-Kreis,
 * Bezeichnung (bei mehrseitigen PDF-Belegen mit «· Seite 2 von 3»),
 * «Datum · Budget · Person» und Betrag, Teal-Linie; darunter das Bild, ein
 * Klebefeld (Leerseite, Fehler) oder bei PDF-Belegen ein leeres Feld, in
 * das pdf-lib danach die Originalseite zeichnet. Immer genau eine Seite.
 *
 * @param props - Siehe {@link ReceiptPageProps}.
 * @returns Die Seite.
 * @example
 * <ReceiptPage slot={slot} receiptCount={5}
 *   meta={{budgetName: "Küche", payeeDisplayName: "Gio"}} />
 */
export const ReceiptPage = ({slot, receiptCount, meta}: ReceiptPageProps) => {
  const {loadedReceipt, pageNumber, pageCount} = slot;
  const {receipt} = loadedReceipt;

  return (
    // Kein wrap={false} an der Page: react-pdf überspringt dann den Schritt,
    // der die A4-Höhe setzt, und die Seite wird nur so hoch wie ihr Inhalt.
    // Eine Seite pro Beleg ist trotzdem sicher: Der Kopf ist fest hoch und
    // der Inhalt steht absolut im Feld RECEIPT_CONTENT_BOX.
    <Page size="A4" style={styles.page}>
      <View style={styles.receiptHeader}>
        <View style={styles.receiptBadge}>
          <Text style={styles.receiptBadgeText}>
            {String(receipt.receiptNumber)}
          </Text>
        </View>
        <View style={styles.receiptTitle}>
          <Text style={styles.receiptLabel}>
            {receipt.label}
            {pageCount > 1 ? (
              <Text style={styles.receiptLabelPageOf}>
                {` · ${TEXT_REPORT_PAGE_OF(pageNumber, pageCount)}`}
              </Text>
            ) : null}
          </Text>
          <Text style={styles.receiptMeta}>
            {getReceiptMetaLine(receipt, meta)}
          </Text>
        </View>
        <Text style={styles.receiptAmount}>
          {formatAmountFromCents(receipt.amountInCents, receipt.currency)}
        </Text>
      </View>
      <View style={styles.receiptContentBox}>
        <ReceiptContent loadedReceipt={loadedReceipt} />
      </View>
      <ReportFooter
        leftText={TEXT_REPORT_RECEIPT_OF(receipt.receiptNumber, receiptCount)}
      />
    </Page>
  );
};

/**
 * Inhalt des Felds, je nach Art des Belegs. Bei PDF-Belegen bleibt das
 * Feld leer: pdf-lib zeichnet die Originalseite hinein (Story 7.3b).
 *
 * @param props.loadedReceipt - Der geladene Beleg.
 */
const ReceiptContent = ({loadedReceipt}: {loadedReceipt: LoadedReceipt}) => {
  switch (loadedReceipt.kind) {
    case "image":
      return <Image src={loadedReceipt.dataUrl} style={styles.receiptImage} />;
    case "missing":
      return (
        <ReceiptPlaceholder
          text={TEXT_REPORT_RECEIPT_PASTE_HERE}
          hint={TEXT_REPORT_RECEIPT_NOT_UPLOADED}
        />
      );
    case "failed":
      return (
        <ReceiptPlaceholder
          text={TEXT_REPORT_RECEIPT_LOAD_FAILED}
          hint={TEXT_REPORT_RECEIPT_LOAD_FAILED_HINT}
        />
      );
    case "pdf":
      return null;
  }
};

/**
 * Gestricheltes Klebefeld mit Beleg-Icon, z.B. zum Aufkleben einer
 * Papierquittung.
 *
 * @param props.text - Grosser Text in der Mitte.
 * @param props.hint - Kleiner Text darunter.
 */
const ReceiptPlaceholder = ({text, hint}: {text: string; hint: string}) => (
  <View style={styles.receiptPlaceholder}>
    <PdfIcon paths={RECEIPT_ICON_PATHS} size={26} color={REPORT_COLORS.hint} />
    <Text style={styles.receiptPlaceholderText}>{text}</Text>
    <Text style={styles.receiptPlaceholderHint}>{hint}</Text>
  </View>
);
