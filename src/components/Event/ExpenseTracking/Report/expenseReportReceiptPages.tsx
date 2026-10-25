import React from "react";
import {Image, Page, Text, View} from "@react-pdf/renderer";

import AuthUser from "../../../Session/authUser.class";
import {Footer, Header} from "../../../Shared/pdfComponents";
import {pdfStyles as styles} from "../../../../constants/styles/expenseTrackingReportPDF.styles";
import {
  REPORT_RECEIPT_LOAD_FAILED as TEXT_REPORT_RECEIPT_LOAD_FAILED,
  REPORT_RECEIPT_LOAD_FAILED_HINT as TEXT_REPORT_RECEIPT_LOAD_FAILED_HINT,
  REPORT_RECEIPT_PASTE_HERE as TEXT_REPORT_RECEIPT_PASTE_HERE,
} from "../../../../constants/text";
import {LoadedReceipt, ReceiptPageSlot} from "./expenseReport.types";
import {getReceiptHeader} from "./expenseReportLabels";

/**
 * Props für {@link ReceiptPage}.
 *
 * @param slot - Die Belegseite (Beleg und Seite innerhalb des Belegs).
 * @param eventName - Name des Anlasses (Kopfzeile).
 * @param authUser - Angemeldete Person (Fusszeile).
 * @param generatedAt - Zeitpunkt der Erstellung (Fusszeile).
 */
type ReceiptPageProps = {
  slot: ReceiptPageSlot;
  eventName: string;
  authUser: AuthUser;
  generatedAt: Date;
};

/**
 * Eine Seite des Anhangs: Kopfzeile «Beleg 3 · Datum · Bezeichnung ·
 * Betrag», bei mehrseitigen PDF-Belegen mit «Seite 2 von 3». Darunter das
 * Bild, ein gestricheltes Feld (Leerseite, Fehler) oder bei PDF-Belegen
 * ein leeres Feld, in das pdf-lib danach die Originalseite zeichnet.
 * Immer genau eine Seite.
 *
 * @param props - Siehe {@link ReceiptPageProps}.
 * @returns Die Seite.
 * @example
 * <ReceiptPage slot={slot} eventName="Sommerlager"
 *   authUser={authUser} generatedAt={new Date()} />
 */
export const ReceiptPage = ({
  slot,
  eventName,
  authUser,
  generatedAt,
}: ReceiptPageProps) => {
  const {loadedReceipt, pageNumber, pageCount} = slot;
  // pro Seite eindeutig: ein PDF-Beleg hat evtl. mehrere Seiten
  const uid = `receipt_${loadedReceipt.receipt.receiptNumber}_${pageNumber}`;

  return (
    // Kein wrap={false} an der Page: react-pdf überspringt dann den Schritt,
    // der die A4-Höhe setzt, und die Seite wird nur so hoch wie ihr Inhalt.
    // Eine Seite pro Beleg ist trotzdem sicher: receiptBody füllt nur den
    // Rest der Seite, und das Bild wird mit objectFit "contain" eingepasst.
    <Page size="A4" style={styles.receiptPage}>
      <Header text={eventName} uid={uid} />
      <Text style={styles.receiptHeader}>
        {getReceiptHeader(loadedReceipt.receipt, pageNumber, pageCount)}
      </Text>
      {loadedReceipt.kind === "pdf" ? (
        // direkt in der Page: `position: "absolute"` misst dann von der
        // Seitenecke, wie pdf-lib (RECEIPT_CONTENT_BOX)
        <View style={styles.receiptPdfBox} />
      ) : (
        <View style={styles.receiptBody}>
          <ReceiptContent loadedReceipt={loadedReceipt} />
        </View>
      )}
      <Footer uid={uid} actualDate={generatedAt} authUser={authUser} />
    </Page>
  );
};

/**
 * Inhalt unter der Kopfzeile, je nach Art des Belegs. PDF-Belege zeichnet
 * pdf-lib, darum sind sie hier ausgeschlossen.
 *
 * @param props.loadedReceipt - Der geladene Beleg (kein PDF).
 */
const ReceiptContent = ({
  loadedReceipt,
}: {
  loadedReceipt: Exclude<LoadedReceipt, {kind: "pdf"}>;
}) => {
  switch (loadedReceipt.kind) {
    case "image":
      return <Image src={loadedReceipt.dataUrl} style={styles.receiptImage} />;
    case "missing":
      return <ReceiptPlaceholder text={TEXT_REPORT_RECEIPT_PASTE_HERE} />;
    case "failed":
      return (
        <ReceiptPlaceholder
          text={TEXT_REPORT_RECEIPT_LOAD_FAILED}
          hint={TEXT_REPORT_RECEIPT_LOAD_FAILED_HINT}
        />
      );
  }
};

/**
 * Gestricheltes Feld in Quittungsgrösse, z.B. zum Aufkleben einer
 * Papierquittung.
 *
 * @param props.text - Grosser Text in der Mitte.
 * @param props.hint - Optionaler kleiner Text darunter.
 */
const ReceiptPlaceholder = ({text, hint}: {text: string; hint?: string}) => (
  <View style={styles.receiptPlaceholder}>
    <Text style={styles.receiptPlaceholderText}>{text}</Text>
    {/* Ternary statt &&: hint === "" darf nicht als Kind landen */}
    {hint ? <Text style={styles.receiptPlaceholderHint}>{hint}</Text> : null}
  </View>
);
