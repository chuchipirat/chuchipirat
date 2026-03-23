import React from "react";
import {Document, Page, View, Text} from "@react-pdf/renderer";
import "../../Shared/pdfFontRegistration";
import {Event} from "../Event/event.class";
import AuthUser from "../../Firebase/Authentication/authUser.class";
import {pdfStyles} from "../../../constants/stylesMaterialListPdf";

import {
  APP_NAME as TEXT_APP_NAME,
  MATERIAL_LIST as TEXT_MATERIAL_LIST,
} from "../../../constants/text";

import {Footer, Header} from "../../Shared/pdfComponents";
import {MaterialListEntry} from "./materialList.class";
import {Utils} from "../../Shared/utils.class";

const styles = pdfStyles;

/** Zahlenformat für Mengenangaben (Schweizer Locale, max. 3 signifikante Stellen). */
const QUANTITY_FORMAT = new Intl.NumberFormat("de-CH", {
  maximumSignificantDigits: 3,
});

/**
 * Erzeugt den kombinierten Style für abgehakte Zellen.
 *
 * @param checked - Ob das Item abgehakt ist
 * @returns Zellen-Style (grau + durchgestrichen wenn checked)
 */
const checkedCellStyle = (checked: boolean) =>
  checked
    ? {...styles.tableCell, ...styles.gray, ...styles.strikeTrough}
    : styles.tableCell;

/**
 * PDF-Dokument für die Materialliste eines Events.
 *
 * Rendert eine einseitige Materialliste mit Mengenangaben, alphabetisch
 * sortiert. Bereits abgehakte Positionen werden durchgestrichen dargestellt.
 * Zeigt optional eine Koch-Zuordnungs-Spalte an.
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
        itemCount={materialList.items.length}
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

/**
 * Titelbereich der Materialliste mit Name, Zeitraum und Item-Anzahl.
 *
 * @param props - Listenname, Zeitabschnitt und Anzahl Positionen.
 */
interface MaterialListTitleProps {
  materialListName: string;
  materialListSelectedTimeSlice: string;
  itemCount: number;
}
const MaterialListTitle = ({
  materialListName,
  materialListSelectedTimeSlice,
  itemCount,
}: MaterialListTitleProps) => {
  return (
    <React.Fragment>
      <View>
        <Text style={styles.title}>{TEXT_MATERIAL_LIST}</Text>
      </View>
      <View style={styles.containerBottomBorder} />
      <Text
        style={styles.subSubTitle}
      >{`${materialListName}: ${materialListSelectedTimeSlice} (${itemCount} Positionen)`}</Text>
      <View style={styles.containerBottomBorder} />
    </React.Fragment>
  );
};

/**
 * Tabelle mit den Materiallistenpositionen, alphabetisch sortiert.
 * Zeigt optional eine Koch-Spalte an, wenn mindestens ein Item eine
 * Koch-Zuordnung hat.
 *
 * @param props - Materiallistendaten mit Positionen.
 */
interface MaterialListListProps {
  materialList: MaterialListEntry;
}
const MaterialListList = ({materialList}: MaterialListListProps) => {
  // Koch-Spalte nur anzeigen wenn mindestens ein Item einen Koch hat
  const hasCookAssignment = materialList.items.some(
    (material) => material.resolvedCookName || material.assignedCookName,
  );

  return (
    <View style={styles.table} key={"materialBlockTable"}>
      {Utils.sortArray({array: materialList.items, attributeName: "name"}).map(
        (material, rowIndex) => (
          <View style={styles.tableRow} key={"materialLine_" + "_" + rowIndex}>
            <View
              style={styles.tableColQuantity}
              key={"materialBlockQuantity" + rowIndex}
            >
              <Text style={checkedCellStyle(material.checked)}>
                {Number.isNaN(material.quantity) || !material.quantity
                  ? ""
                  : QUANTITY_FORMAT.format(material.quantity)}
              </Text>
            </View>
            <View style={styles.tableCol5} key={"materialBlockSpacer" + rowIndex} />

            <View
              style={hasCookAssignment ? styles.tableColItemNarrow : styles.tableColItem}
              key={"materialBlockName" + rowIndex}
            >
              <Text style={checkedCellStyle(material.checked)}>
                {material.name}
              </Text>
            </View>
            {hasCookAssignment && (
              <View style={styles.tableColCook} key={"materialBlockCook" + rowIndex}>
                <Text style={checkedCellStyle(material.checked)}>
                  {material.resolvedCookName || material.assignedCookName || ""}
                </Text>
              </View>
            )}
          </View>
        ),
      )}
    </View>
  );
};

export {MaterialListPdf};
