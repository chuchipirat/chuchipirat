import React from "react";
import {Document, Page} from "@react-pdf/renderer";
import "../../../Shared/pdfFontRegistration";

import AuthUser from "../../../Session/authUser.class";
import {PaymentDetailsFormValues} from "../../../User/userPaymentDetails.types";
import {APP_NAME as TEXT_APP_NAME} from "../../../../constants/text";
import {ExpenseReportData, LoadedReceipt} from "./expenseReport.types";
import {
  getAccountHolderName,
  getCreatedAtLabel,
  getReportTitle,
} from "./expenseReportLabels";
import {PayeeCard} from "./expenseReportPayeeCard";
import {ReportFooter} from "./expenseReportPdfFooter";
import {ReportHeader} from "./expenseReportPdfHeader";
import {
  getReceiptMetaByExpenseId,
  getReportKpis,
} from "./expenseReportPdfHelpers";
import {ReceiptPage} from "./expenseReportReceiptPages";
import {getReceiptPageSlots} from "./receiptPageSlots";
import {reportLayoutStyles as styles} from "../../../../constants/styles/expenseTrackingReportPDF.styles";

/**
 * Props für {@link ExpenseReportPdf}.
 *
 * @param report - Fertige Abrechnung aus `ExpenseReport.build`.
 * @param eventName - Name des Anlasses (Kopf, Titel).
 * @param loadedReceipts - Belege des Anhangs in Nummernreihenfolge
 *                         (leer = kein Anhang).
 * @param authUser - Angemeldete Person (Footer «von …», Kontoinhaber*in
 *   der eigenen Abrechnung).
 * @param generatedAt - Zeitpunkt der Erstellung (Footer).
 * @param refundDetailsByPayeeKey - Adresse und IBAN pro Person
 *   (`section.payeeKey`, Story 7.4); wer fehlt, bekommt den Kasten zum
 *   Ergänzen.
 * @param receiptStartPages - Belegnummer → Startseite im fertigen PDF für
 *   die Spalte «Beleg» (Story 7.5); fehlt eine Nummer, bleibt die Zelle
 *   leer.
 */
type ExpenseReportPdfProps = {
  report: ExpenseReportData;
  eventName: string;
  loadedReceipts: LoadedReceipt[];
  authUser: AuthUser;
  generatedAt: Date;
  refundDetailsByPayeeKey: Record<string, PaymentDetailsFormValues>;
  receiptStartPages: Map<number, number>;
};

/**
 * PDF-Dokument der Abrechnung (Layout Story 7.5): Kopf mit Kennzahlen,
 * eine Karte pro Person, danach die Belegseiten. Zeichnet nur die fertige
 * Struktur, rechnet selbst nichts.
 *
 * @param props - Siehe {@link ExpenseReportPdfProps}.
 * @returns Das react-pdf-Dokument.
 * @example
 * <ExpenseReportPdf
 *   report={ExpenseReport.build({expenses, budgets, cooks, options})}
 *   eventName={event.name}
 *   loadedReceipts={[]}
 *   authUser={authUser}
 *   generatedAt={new Date()}
 *   refundDetailsByPayeeKey={{[authUser.uid]: ownPaymentDetails}}
 *   receiptStartPages={new Map()}
 * />
 */
export const ExpenseReportPdf = ({
  report,
  eventName,
  loadedReceipts,
  authUser,
  generatedAt,
  refundDetailsByPayeeKey,
  receiptStartPages,
}: ExpenseReportPdfProps) => {
  const title = getReportTitle(eventName, report.payeeDisplayName);
  const receiptMetaByExpenseId = getReceiptMetaByExpenseId(report);

  return (
    <Document
      author={authUser.publicProfile.displayName}
      creator={TEXT_APP_NAME}
      title={title}
      subject={title}
    >
      <Page size="A4" style={styles.page}>
        <ReportHeader eventName={eventName} kpis={getReportKpis(report)} />
        {report.sections.map((section) => (
          <PayeeCard
            key={section.payeeKey}
            section={section}
            mode={report.mode}
            includeComments={report.includeComments}
            accountHolder={getAccountHolderName(section, authUser)}
            refundDetails={refundDetailsByPayeeKey[section.payeeKey] ?? null}
            receiptStartPages={receiptStartPages}
          />
        ))}
        <ReportFooter leftText={getCreatedAtLabel(generatedAt, authUser)} />
      </Page>
      {getReceiptPageSlots(loadedReceipts).map((slot) => (
        <ReceiptPage
          key={`${slot.loadedReceipt.receipt.receiptNumber}_${slot.pageNumber}`}
          slot={slot}
          receiptCount={loadedReceipts.length}
          meta={receiptMetaByExpenseId.get(
            slot.loadedReceipt.receipt.expenseId,
          )}
        />
      ))}
    </Document>
  );
};
