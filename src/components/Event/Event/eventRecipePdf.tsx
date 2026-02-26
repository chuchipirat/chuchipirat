import React from "react";
import {Document, Page, View, Text, Font, Image} from "@react-pdf/renderer";

import Receipt from "./receipt.class";
import StylesPdf from "../../../constants/stylesEventReceiptPdf";
import AuthUser from "../../Firebase/Authentication/authUser.class";

import {
  APP_NAME as TEXT_APP_NAME,
  RECEIPT as TEXT_RECEIPT,
  EVENT as TEXT_EVENT,
  DATE as TEXT_DATE,
  DONOR as TEXT_DONOR,
  AMOUNT as TEXT_AMOUNT,
  RECEIPT_THANK_YOU as TEXT_RECEIPT_THANK_YOU,
  ASSOCIATION as TEXT_ASSOSIACTION,
} from "../../../constants/text";
import {Footer} from "../../Shared/pdfComponents";
import {ImageRepository} from "../../../constants/imageRepository";
import Utils from "../../Shared/utils.class";

/* ===================================================================
// =========================== Quittung PDF ==========================
// =================================================================== */
interface EventRecipePdfProps {
  authUser: AuthUser;
  receiptData: Receipt;
}
const EventReceiptPdf = ({receiptData, authUser}: EventRecipePdfProps) => {
  let actualDate = new Date();

  if (!Utils.areDatesIdentical(receiptData.created.date, actualDate)) {
    // Datum angeben von der ersten Generierung
    actualDate = receiptData.created.date;
    authUser = {
      publicProfile: {displayName: receiptData.created.fromDisplayName},
    } as AuthUser;
  }

  return (
    <Document
      author={authUser.publicProfile.displayName}
      creator={TEXT_APP_NAME}
      keywords={TEXT_RECEIPT + " " + receiptData.eventName}
      subject={TEXT_RECEIPT + " " + receiptData.eventName}
      title={TEXT_RECEIPT + " " + receiptData.eventName}
    >
      <EventReceiptPdfPage
        key={"receiptPage"}
        receiptData={receiptData}
        actualDate={actualDate}
        authUser={authUser}
      />
    </Document>
  );
};
/* ===================================================================
// ========================== Quittung Page ==========================
// =================================================================== */
interface EventReceiptPdfPageProps {
  receiptData: Receipt;
  actualDate: Date;
  authUser: AuthUser;
}
const EventReceiptPdfPage = ({
  receiptData,
  actualDate,
  authUser,
}: EventReceiptPdfPageProps) => {
  return (
    <Page
      key={"receipt_page"}
      orientation="landscape"
      style={styles.pageMargins}
      size={"A5"}
    >
      <View style={styles.table}>
        {/* Titel Quittung */}
        <View style={styles.tableRow}>
          <View style={styles.tableCol100}>
            <Text style={styles.title}>{TEXT_RECEIPT}</Text>
          </View>
        </View>
        <View style={styles.tableRow}>
          {/* Bild links */}
          <View style={styles.tableCol40}>
            <Image
              style={styles.Image}
              src={ImageRepository.getEnvironmentRelatedPicture().RECEIPT_IMAGE}
            />
          </View>
          {/* Quittungsangaben rechts */}
          <View style={styles.tableCol60}>
            <DataBlock receiptData={receiptData} />
          </View>
        </View>
      </View>
      <Footer
        uid={receiptData.eventUid}
        actualDate={actualDate}
        authUser={authUser}
        showLogo={false}
      />
    </Page>
  );
};
/* ===================================================================
// =========================== Daten Block ===========================
// =================================================================== */
interface DataBlockProps {
  receiptData: Receipt;
}
const DataBlock = ({receiptData}: DataBlockProps) => {
  return (
    <View style={styles.table}>
      {/* Name Event */}
      <View style={styles.tableRow}>
        <View style={styles.tableCol30}>
          <Text style={styles.dataKey}>{TEXT_EVENT}</Text>
        </View>
        <View style={styles.tableCol70}>
          <Text style={styles.dataValue}>{receiptData.eventName}</Text>
        </View>
      </View>
      {/* Name Datum */}
      <View style={styles.tableRow}>
        <View style={styles.tableCol30}>
          <Text style={styles.dataKey}>{TEXT_DATE}</Text>
        </View>
        <View style={styles.tableCol70}>
          <Text style={styles.dataValue}>
            {receiptData.payDate.toLocaleString("de-CH", {
              year: "numeric",
              month: "2-digit",
              day: "2-digit",
            })}
          </Text>
        </View>
      </View>
      {/* Spender*in */}
      <View style={styles.tableRow}>
        <View style={styles.tableCol30}>
          <Text style={styles.dataKey}>{TEXT_DONOR}</Text>
        </View>
        <View style={styles.tableCol70}>
          <Text style={styles.dataValue}>{receiptData.donorName}</Text>
        </View>
      </View>
      {/* Spender*in Email*/}
      <View style={styles.tableRow}>
        <View style={styles.tableCol30}>
          {/* <Text style={styles.dataKey}>{TEXT_DONOR}</Text> */}
        </View>
        <View style={styles.tableCol70}>
          <Text style={styles.dataValue}>{receiptData.donorEmail}</Text>
        </View>
      </View>
      {/* Betrag*/}
      <View style={styles.tableRow}>
        <View style={styles.tableCol30}>
          <Text style={styles.dataKey}>{TEXT_AMOUNT}</Text>
        </View>
        <View style={styles.tableCol70}>
          <Text style={styles.dataValue}>{`Fr. ${receiptData.amount.toFixed(
            2,
          )}`}</Text>
        </View>
      </View>
      {/* Danke  */}
      <View style={{...styles.tableRow, ...styles.marginTop}}>
        <View style={styles.tableCol100}>
          <Text
            style={{
              ...styles.dataKey,
              ...styles.alignLeft,
              ...styles.fontSizeSmall,
            }}
          >
            {TEXT_RECEIPT_THANK_YOU}
          </Text>
        </View>
      </View>
      <View style={styles.tableRow}>
        <View style={styles.tableCol100}>
          <Text
            style={{
              ...styles.dataKey,
              ...styles.alignRight,
              ...styles.fontSizeSmall,
            }}
          >
            {`${TEXT_ASSOSIACTION} ${TEXT_APP_NAME}`}
          </Text>
        </View>
      </View>
    </View>
  );
};

/* ===================================================================
// ======================== Fonts registrieren =======================
// =================================================================== */
//-->gist.github.com/karimnaaji/b6c9c9e819204113e9cabf290d580551
Font.register({
  family: "Roboto",
  fonts: [
    {
      src: "https://fonts.gstatic.com/s/roboto/v15/7MygqTe2zs9YkP0adA9QQQ.ttf",
      fontStyle: "normal",
      fontWeight: 100,
    },
    {
      src: "https://fonts.gstatic.com/s/roboto/v15/T1xnudodhcgwXCmZQ490TPesZW2xOQ-xsNqO47m55DA.ttf",
      fontStyle: "italic",
      fontWeight: 100,
    },
    {
      src: "https://fonts.gstatic.com/s/roboto/v15/dtpHsbgPEm2lVWciJZ0P-A.ttf",
      fontStyle: "normal",
      fontWeight: 300,
    },
    {
      src: "https://fonts.gstatic.com/s/roboto/v16/zN7GBFwfMP4uA6AR0HCoLQ.ttf",
      fontStyle: "normal",
      fontWeight: 400,
    },
    {
      src: "https://fonts.gstatic.com/s/roboto/v15/bdHGHleUa-ndQCOrdpfxfw.ttf",
      fontStyle: "normal",
      fontWeight: 700,
    },
  ],
});

const styles = StylesPdf.getPdfStyles();
export default EventReceiptPdf;
