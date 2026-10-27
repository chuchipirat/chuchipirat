import React from "react";
import {Image, Text, View} from "@react-pdf/renderer";

import {
  APP_NAME as TEXT_APP_NAME,
  REPORT_TITLE as TEXT_REPORT_TITLE,
} from "../../../../constants/text";
import {
  REPORT_COLORS,
  reportLayoutStyles as styles,
} from "../../../../constants/styles/expenseTrackingReportPDF.styles";
import {ReportKpi} from "./expenseReportPdfHelpers";
import {PdfIcon, RECEIPT_ICON_PATHS} from "./expenseReportPdfIcon";

/**
 * Props für {@link ReportHeader}.
 *
 * @param eventName - Name des Anlasses unter dem Titel.
 * @param kpis - Kennzahlen aus `getReportKpis`.
 */
type ReportHeaderProps = {eventName: string; kpis: ReportKpi[]};

/**
 * Kopf von Seite 1 im Stil der Spendenquittung: Logo, Trenner mit
 * Beleg-Icon, Titel «Abrechnung», Anlass und drei Kennzahlen.
 *
 * @param props - Siehe {@link ReportHeaderProps}.
 * @returns Der Kopf.
 * @example
 * <ReportHeader eventName="Sommerlager" kpis={getReportKpis(report)} />
 */
export const ReportHeader = ({eventName, kpis}: ReportHeaderProps) => (
  <View>
    <View style={styles.logoHeader}>
      <Image src="/logo512.png" style={styles.logoImage} />
      <Text style={styles.logoText}>{TEXT_APP_NAME}</Text>
    </View>
    <View style={styles.dividerRow}>
      <View style={styles.dividerLine} />
      <PdfIcon
        paths={RECEIPT_ICON_PATHS}
        size={14}
        color={REPORT_COLORS.primary}
        style={styles.dividerIcon}
      />
      <View style={styles.dividerLine} />
    </View>
    <Text style={styles.title}>{TEXT_REPORT_TITLE}</Text>
    <Text style={styles.eventName}>{eventName}</Text>
    <View style={styles.kpiRow}>
      {kpis.map((kpi, index) => (
        <KpiTile key={kpi.key} kpi={kpi} isFirst={index === 0} />
      ))}
    </View>
  </View>
);

/**
 * Eine Kachel: Beschriftung und Werte untereinander, darunter klein das
 * Detail (z.B. Budgetnamen).
 *
 * @param props.kpi - Die Kennzahl.
 * @param props.isFirst - Erste Kachel ohne Abstand links.
 */
const KpiTile = ({kpi, isFirst}: {kpi: ReportKpi; isFirst: boolean}) => (
  <View
    style={[
      styles.kpiTile,
      ...(isFirst ? [] : [styles.kpiTileSpacing]),
      ...(kpi.isHighlighted ? [styles.kpiTileHighlighted] : []),
    ]}
  >
    <Text
      style={[
        styles.kpiLabel,
        ...(kpi.isHighlighted ? [styles.kpiLabelHighlighted] : []),
      ]}
    >
      {kpi.label}
    </Text>
    {kpi.values.map((value) => (
      <Text
        key={value}
        style={[
          styles.kpiValue,
          ...(kpi.isHighlighted ? [styles.kpiValueHighlighted] : []),
        ]}
      >
        {value}
      </Text>
    ))}
    {kpi.detail ? <Text style={styles.kpiDetail}>{kpi.detail}</Text> : null}
  </View>
);
