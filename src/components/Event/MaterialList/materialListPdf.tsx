import React from "react";
import {Document, Page, View, Text} from "@react-pdf/renderer";
import "../../Shared/pdfFontRegistration";
import Event from "../Event/event.class";
import AuthUser from "../../Firebase/Authentication/authUser.class";
import {pdfStyles} from "../../../constants/stylesMaterialListPdf";

import {
  APP_NAME as TEXT_APP_NAME,
  MATERIAL_LIST as TEXT_MATERIAL_LIST,
} from "../../../constants/text";

import {Footer, Header} from "../../Shared/pdfComponents";
import {MaterialListEntry, MaterialListMaterial} from "./materialList.class";
import Utils from "../../Shared/utils.class";

/** Zahlenformat für Mengenangaben (Schweizer Locale, max. 3 signifikante Stellen). */
const QUANTITY_FORMAT = new Intl.NumberFormat("de-CH", {
  maximumSignificantDigits: 3,
});
/* ===================================================================
// ========================= PDF Materialliste =======================
// =================================================================== */
/**
 * PDF-Dokument für die Materialliste eines Events.
 *
 * Rendert eine einseitige Materialliste mit Mengenangaben, alphabetisch
 * sortiert. Bereits abgehakte Positionen werden durchgestrichen dargestellt.
 *
 * @param props - Materiallistendaten, Zeitabschnitt, Event-Name und Autoreninfo.
 */
interface MaterialListPdfProps {
  materialList: MaterialListEntry;
  materialListSelectedTimeSlice: string;
  eventName: Event["name"];
  authUser: AuthUser;
}
const MaterialListPdf = ({
  materialList,
  materialListSelectedTimeSlice,
  eventName,
  authUser,
}: MaterialListPdfProps) => {
  const actualDate = new Date();

  return (
    <Document
      author={authUser.publicProfile.displayName}
      creator={TEXT_APP_NAME}
      keywords={eventName + " " + TEXT_MATERIAL_LIST}
      subject={TEXT_MATERIAL_LIST + " " + eventName}
      title={TEXT_MATERIAL_LIST + " " + eventName}
    >
      <MaterialListPage
        eventName={eventName}
        materialList={materialList}
        materialListSelectedTimeSlice={materialListSelectedTimeSlice}
        actualDate={actualDate}
        authUser={authUser}
      />
    </Document>
  );
};

/* ===================================================================
// ========================= Materialliste-Seite =====================
// =================================================================== */
/**
 * Einzelne Seite der Materialliste im PDF.
 *
 * @param props - Materiallistendaten, Zeitabschnitt, Zeitstempel und Autoreninfo.
 */
interface MaterialListPageProps {
  materialList: MaterialListEntry;
  materialListSelectedTimeSlice: string;
  eventName: Event["name"];
  actualDate: Date;
  authUser: AuthUser;
}
const MaterialListPage = ({
  materialList,
  materialListSelectedTimeSlice,
  eventName,
  actualDate,
  authUser,
}: MaterialListPageProps) => {
  return (
    <Page key={"page_" + materialList.properties.uid} style={styles.body}>
      <Header text={eventName} uid={materialList.properties.uid} />
      <MaterialListTitle
        materialListName={materialList.properties.name}
        materialListSelectedTimeSlice={materialListSelectedTimeSlice}
      />
      <MaterialListList materialList={materialList} />

      <Footer
        uid={"Footer_" + materialList.properties.uid}
        actualDate={actualDate}
        authUser={authUser}
      />
    </Page>
  );
};
/* ===================================================================
// ============================== Titel ==============================
// =================================================================== */
/**
 * Titelbereich der Materialliste mit Name und Zeitraum.
 *
 * @param props - Listenname und ausgewählter Zeitabschnitt.
 */
interface MaterialListTitleProps {
  materialListName: MaterialListMaterial["name"];
  materialListSelectedTimeSlice: string;
}
const MaterialListTitle = ({
  materialListName,
  materialListSelectedTimeSlice,
}: MaterialListTitleProps) => {
  return (
    <React.Fragment>
      <View>
        <Text style={styles.title}>{TEXT_MATERIAL_LIST}</Text>
      </View>
      <View style={styles.containerBottomBorder} />
      <Text
        style={styles.subSubTitle}
      >{`${materialListName}: ${materialListSelectedTimeSlice}`}</Text>
      <View style={styles.containerBottomBorder} />
    </React.Fragment>
  );
};
/* ===================================================================
// ============================ Item-Liste ===========================
// =================================================================== */
/**
 * Tabelle mit den Materiallistenpositionen, alphabetisch sortiert.
 *
 * @param props - Materiallistendaten mit Positionen.
 */
interface MaterialListListProps {
  materialList: MaterialListEntry;
}
const MaterialListList = ({materialList}: MaterialListListProps) => {
  return (
    <View style={styles.table} key={"materialBlockTable"}>
      {Utils.sortArray({array: materialList.items, attributeName: "name"}).map(
        (material, line) => (
          <View style={styles.tableRow} key={"materialLine_" + "_" + line}>
            <View
              style={styles.tableColQuantity}
              key={"materialBlockQuantity" + line}
            >
              <Text
                style={
                  material.checked
                    ? {
                        ...styles.tableCell,
                        ...styles.gray,
                        ...styles.strikeTrough,
                      }
                    : styles.tableCell
                }
              >
                {Number.isNaN(material.quantity) || !material.quantity
                  ? ""
                  : QUANTITY_FORMAT.format(material.quantity)}
              </Text>
            </View>
            <View style={styles.tableCol5} key={"materialBlockSpacer" + line} />

            <View style={styles.tableColItem} key={"materialBlockName" + line}>
              <Text
                style={
                  material.checked
                    ? {
                        ...styles.tableCell,
                        ...styles.gray,
                        ...styles.strikeTrough,
                      }
                    : styles.tableCell
                }
              >
                {material.name}
              </Text>
            </View>
          </View>
        )
      )}
    </View>
  );
};

export default MaterialListPdf;

const styles = pdfStyles;
