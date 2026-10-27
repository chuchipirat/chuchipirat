import React from "react";
import {Text, View} from "@react-pdf/renderer";

import {
  REPORT_COLORS,
  reportLayoutStyles as styles,
} from "../../../../constants/styles/expenseTrackingReportPDF.styles";
import {BudgetIcon} from "../Budget/budget.types";
import {BUDGET_ICON_PDF_PATHS} from "../Budget/budgetIconPaths";
import {CurrencyTotal} from "./expenseReport.types";
import {formatTotals} from "./expenseReportPdfHelpers";
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
 */
type BudgetBarProps = {
  budgetName: string;
  budgetIcon: BudgetIcon;
  totals: CurrencyTotal[];
};

/**
 * Balken über den Ausgaben eines Budgets (Aufbau B, Spez. 4): Icon, Name
 * und Zwischentotal, mehrere Währungen mit « · ».
 *
 * @param props - Siehe {@link BudgetBarProps}.
 * @returns Der Balken.
 * @example
 * <BudgetBar budgetName="Küche" budgetIcon={BudgetIcon.KITCHEN} totals={group.totals} />
 */
export const BudgetBar = ({budgetName, budgetIcon, totals}: BudgetBarProps) => (
  <View style={styles.budgetBar} minPresenceAhead={MIN_PRESENCE_AHEAD}>
    <View style={styles.budgetBarName}>
      <PdfIcon
        paths={BUDGET_ICON_PDF_PATHS[budgetIcon]}
        size={10}
        color={REPORT_COLORS.primary}
      />
      <Text style={styles.budgetBarText}>{budgetName}</Text>
    </View>
    <Text style={styles.budgetBarTotal}>
      {formatTotals(totals).join(" · ")}
    </Text>
  </View>
);
