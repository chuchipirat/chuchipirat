import React from "react";
import {
  Box,
  Card,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Stack,
  Typography,
  useTheme,
} from "@mui/material";
import {PieChart} from "@mui/x-charts/PieChart";

import {
  EVALUATION_SHARE_TITLE as TEXT_EVALUATION_SHARE_TITLE,
  EVALUATION_SHARE_DETAIL as TEXT_EVALUATION_SHARE_DETAIL,
} from "../../../../constants/text";
import {useCustomStyles} from "../../../../constants/styles";
import {
  ChartCategoryColors,
  getChartCategoryColors,
} from "../../../App/customTheme";
import {BudgetShare} from "../Expense/expense.types";

/**
 * Props für {@link ExpenseBudgetShareChart}.
 *
 * @param shares - Stücke der Verteilung, fertig aus `ExpenseStatistics.shareByBudget`.
 * @param currency - Währung der Beträge (ISO-4217-Code), für Legende und Tooltip.
 */
type ExpenseBudgetShareChartProps = {
  shares: BudgetShare[];
  currency: string;
};

/** Breite und Höhe des Donuts in Pixeln; die Legende nimmt den Rest der Karte. */
const CHART_SIZE = 200;
/** Rand um den Donut, damit die Stücke am Rand nicht abgeschnitten werden. */
const CHART_MARGIN = 8;

/**
 * Karte «Verteilung nach Budget» der Auswertung: Donut mit einem Stück pro
 * Budget und daneben (schmale Karte: darunter) eine Legende mit Farbe, Name,
 * Betrag und Anteil. Die Legende ist zugleich die Textalternative zum Diagramm, darum
 * eine eigene MUI-Liste statt der SVG-Legende von x-charts.
 *
 * Rechnet selbst nichts ausser den Farben: Die Stücke kommen fertig aus
 * `ExpenseEvaluation`, die Karte erscheint dort erst ab zwei Stücken.
 *
 * @param props - Siehe {@link ExpenseBudgetShareChartProps}.
 * @returns Die Donut-Karte.
 * @example
 * <ExpenseBudgetShareChart
 *   shares={statistics.budgetShares}
 *   currency={selectedCurrency}
 * />
 */
export const ExpenseBudgetShareChart = ({
  shares,
  currency,
}: ExpenseBudgetShareChartProps) => {
  const classes = useCustomStyles();
  const theme = useTheme();
  const colors = assignShareColors(
    shares,
    getChartCategoryColors(theme.palette.mode),
  );

  // gleicher Text in Legende und Tooltip
  const formatDetail = (share: BudgetShare) =>
    TEXT_EVALUATION_SHARE_DETAIL(
      share.amountInCents,
      currency,
      share.sharePercent,
    );

  return (
    <Card variant="outlined" sx={classes.evaluationTile}>
      <Typography variant="subtitle2" color="text.secondary">
        {TEXT_EVALUATION_SHARE_TITLE}
      </Typography>
      <Stack direction="row" sx={classes.evaluationShareLayout}>
        <Box sx={classes.evaluationShareChart}>
          <PieChart
            width={CHART_SIZE}
            height={CHART_SIZE}
            margin={{
              top: CHART_MARGIN,
              bottom: CHART_MARGIN,
              left: CHART_MARGIN,
              right: CHART_MARGIN,
            }}
            series={[
              {
                data: shares.map((share, shareIndex) => ({
                  id: share.id,
                  value: share.amountInCents,
                  label: share.label,
                  color: colors[shareIndex],
                })),
                innerRadius: "60%",
                paddingAngle: 1,
                cornerRadius: 3,
                highlightScope: {fade: "global", highlight: "item"},
                valueFormatter: (_item, {dataIndex}) =>
                  formatDetail(shares[dataIndex]),
              },
            ]}
            // eigene Legende daneben, die eingebaute SVG-Legende bricht nicht um
            slotProps={{legend: {hidden: true}}}
          />
        </Box>
        <List
          dense
          disablePadding
          sx={classes.evaluationShareLegend}
          data-testid="evaluation-share-legend"
        >
          {shares.map((share, shareIndex) => (
            <ListItem key={share.id} disableGutters>
              <ListItemIcon sx={classes.evaluationShareLegendIcon}>
                <Box
                  aria-hidden
                  sx={{
                    ...classes.evaluationShareLegendDot,
                    backgroundColor: colors[shareIndex],
                  }}
                  data-testid={`evaluation-share-dot-${share.id}`}
                />
              </ListItemIcon>
              <ListItemText
                primary={share.label}
                secondary={
                  <>
                    {formatDetail(share)}
                    {share.groupedBudgetNames.length > 0 && (
                      <Typography
                        component="span"
                        variant="caption"
                        sx={classes.evaluationShareGroupedNames}
                      >
                        {share.groupedBudgetNames.join(", ")}
                      </Typography>
                    )}
                  </>
                }
                slotProps={{primary: {noWrap: true}}}
              />
            </ListItem>
          ))}
        </List>
      </Stack>
    </Card>
  );
};

/**
 * Ordnet jedem Stück seine Farbe zu. Die Farbe hängt am Budget (Position in
 * `budgets`), nicht am Rang im Donut, damit ein Budget seine Farbe behält,
 * wenn sich Beträge, Währung oder Budget-Auswahl ändern. «Übrige» ist grau.
 *
 * Ab dem sechsten Budget wiederholt sich die Palette. Sind zwei Budgets mit
 * derselben Palettenfarbe gleichzeitig im Donut (z.B. Budget 1 und 6), bekommt
 * das spätere Budget die nächste freie Farbe, nur für diese Anzeige.
 *
 * @param shares - Stücke der Verteilung (höchstens so viele Budgetstücke wie Kategorienfarben).
 * @param palette - Kategorienfarben aus `getChartCategoryColors`.
 * @returns Eine Farbe pro Stück, in der Reihenfolge von `shares`.
 * @example
 * assignShareColors(shares, getChartCategoryColors("light"))
 * // ["#00796b", "#e65100", "#90a4ae"]
 */
export const assignShareColors = (
  shares: BudgetShare[],
  palette: ChartCategoryColors,
): string[] => {
  const paletteIndexByShareId = new Map<string, number>();
  const usedPaletteIndexes = new Set<number>();

  // in Budget-Reihenfolge vergeben: Das frühere Budget behält seine Farbe
  shares
    .flatMap((share) =>
      share.colorIndex === null
        ? []
        : [{id: share.id, colorIndex: share.colorIndex}],
    )
    .sort((shareA, shareB) => shareA.colorIndex - shareB.colorIndex)
    .forEach((share) => {
      const paletteIndex = findFreePaletteIndex(
        share.colorIndex % palette.categories.length,
        usedPaletteIndexes,
        palette.categories.length,
      );
      usedPaletteIndexes.add(paletteIndex);
      paletteIndexByShareId.set(share.id, paletteIndex);
    });

  return shares.map((share) => {
    const paletteIndex = paletteIndexByShareId.get(share.id);
    return paletteIndex === undefined
      ? palette.others
      : palette.categories[paletteIndex];
  });
};

/**
 * Sucht ab der Wunschfarbe die nächste noch nicht vergebene Palettenfarbe.
 * Sind alle vergeben (mehr Budgetstücke als Farben), bleibt es bei der Wunschfarbe.
 *
 * @param preferredIndex - Palettenindex, der dem Budget zusteht.
 * @param usedIndexes - Bereits vergebene Palettenindizes.
 * @param paletteSize - Anzahl Kategorienfarben.
 * @returns Freier Palettenindex, sonst `preferredIndex`.
 */
const findFreePaletteIndex = (
  preferredIndex: number,
  usedIndexes: Set<number>,
  paletteSize: number,
): number => {
  for (let offset = 0; offset < paletteSize; offset++) {
    const candidateIndex = (preferredIndex + offset) % paletteSize;
    if (!usedIndexes.has(candidateIndex)) return candidateIndex;
  }
  return preferredIndex;
};
