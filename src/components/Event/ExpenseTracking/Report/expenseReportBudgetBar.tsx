import React from "react";
import {Text, View} from "@react-pdf/renderer";

import {
  REPORT_COLORS,
  reportLayoutStyles as styles,
} from "../../../../constants/styles/expenseTrackingReportPDF.styles";
import {BudgetIcon} from "../Budget/budget.types";
import {BUDGET_ICON_PDF_PATHS} from "../Budget/budgetIconPaths";
import {CurrencyTotal} from "./expenseReport.types";
import {ColumnAlignedTotals} from "./expenseReportColumnTotals";
import {PdfIcon} from "./expenseReportPdfIcon";

/**
 * Mindestplatz (pt) nach dem Balken auf derselben Seite: Kopfzeile und
 * eine Ausgabe, damit kein Balken allein am Seitenende steht.
 */
const MIN_PRESENCE_AHEAD = 40;

/**
 * Props für {@link BudgetBar}.
 *
 * @param budgetName - Name des Budgets.
 * @param budgetIcon - Icon des Budgets.
 * @param totals - Zwischentotal pro Währung.
 * @param showTotals - Zwischentotal zeigen; `false`, wenn die Person nur
 *   ein Budget hat und der Betrag gleich dem Total ist.
 */
type BudgetBarProps = {
  budgetName: string;
  budgetIcon: BudgetIcon;
  totals: CurrencyTotal[];
  showTotals: boolean;
};

/**
 * Balken über den Ausgaben eines Budgets (Aufbau B, Spez. 4): Icon, Name
 * und Zwischentotal in der Spalte «Betrag», je Währung eine Zeile. Ohne
 * Zwischentotal nur Icon und Name.
 *
 * @param props - Siehe {@link BudgetBarProps}.
 * @returns Der Balken.
 * @example
 * <BudgetBar budgetName="Küche" budgetIcon={BudgetIcon.KITCHEN}
 *   totals={group.totals} showTotals />
 */
export const BudgetBar = ({
  budgetName,
  budgetIcon,
  totals,
  showTotals,
}: BudgetBarProps) => (
  <View style={styles.budgetBar} minPresenceAhead={MIN_PRESENCE_AHEAD}>
    <View style={styles.budgetBarName}>
      <PdfIcon
        paths={BUDGET_ICON_PDF_PATHS[budgetIcon]}
        size={10}
        color={REPORT_COLORS.primary}
      />
      <Text style={styles.budgetBarText}>{budgetName}</Text>
    </View>
    {showTotals ? (
      <ColumnAlignedTotals totals={totals} textStyle={styles.budgetBarTotal} />
    ) : null}
  </View>
);
