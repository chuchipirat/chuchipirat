import React from "react";
import {Card, Theme, Typography, useTheme} from "@mui/material";
import {LineChart, type LineChartProps} from "@mui/x-charts/LineChart";

import {
  EVALUATION_HISTORY_NO_EVENT_DAYS as TEXT_EVALUATION_HISTORY_NO_EVENT_DAYS,
  EVALUATION_HISTORY_TITLE as TEXT_EVALUATION_HISTORY_TITLE,
  EVALUATION_HISTORY_NOT_STARTED as TEXT_EVALUATION_HISTORY_NOT_STARTED,
  EVALUATION_HISTORY_SUMMARY as TEXT_EVALUATION_HISTORY_SUMMARY,
  EVALUATION_HISTORY_ACTUAL as TEXT_EVALUATION_HISTORY_ACTUAL,
  EVALUATION_HISTORY_TARGET as TEXT_EVALUATION_HISTORY_TARGET,
} from "../../../../constants/text";
import {useCustomStyles} from "../../../../constants/styles";
import {formatAmountFromCents} from "../../../Shared/utils/currencyUtils";
import type {AxisConfig} from "@mui/x-charts/models";

/**
 * Kontext, den x-charts einem Achsen-Formatter übergibt (`location`: Achse,
 * Tooltip oder Legende). In v7 nicht öffentlich exportiert, darum aus der
 * öffentlichen `AxisConfig` abgeleitet statt aus `@mui/x-charts/internals`.
 */
type AxisValueFormatterContext = Parameters<
  NonNullable<AxisConfig["valueFormatter"]>
>[1];

/**
 * Props für {@link ExpenseHistoryChart}.
 *
 * @param eventDays - Alle Anlasstage, aufsteigend (`getEventDateList`); bilden die x-Achse.
 * @param actualValues - Kumulierte Ausgaben in Rappen, ein Wert pro Anlasstag,
 *   `null` für Tage nach heute (`ExpenseStatistics.cumulativeByEventDay`).
 * @param targetValues - Linear verteilter Sollbetrag in Rappen, ein Wert pro
 *   Anlasstag (`ExpenseStatistics.targetLineByEventDay`), `null`, wenn die
 *   ausgewählten Budgets keinen Sollbetrag haben (dann keine Soll-Linie).
 * @param currency - Währung der Werte (ISO-4217-Code), für Tooltip und Textzeile.
 */
type ExpenseHistoryChartProps = {
  eventDays: Date[];
  actualValues: (number | null)[];
  targetValues: number[] | null;
  currency: string;
};

/** Feste Höhe des Diagramms in Pixeln; die Breite passt sich dem Container an. */
const CHART_HEIGHT = 280;
// muss zum Selektor `.MuiLineElement-series-target` in expenseTracking.styles.ts passen
const TARGET_SERIES_ID = "target";

/**
 * Karte «Ausgabenverlauf» der Auswertung: Liniendiagramm mit den kumulierten
 * Ausgaben bis heute (Ist) und, falls vorhanden, dem linear verteilten
 * Sollbetrag (Soll, gestrichelt). Darunter eine Textzeile mit dem aktuellen
 * Stand, weil das Diagramm für Screenreader nicht lesbar ist und die Zahl auf
 * dem Handy schneller erfasst wird als die Kurve.
 *
 * Rechnet selbst nichts: Die Reihen kommen fertig aus `ExpenseEvaluation`.
 * Ohne Anlasstage oder vor dem ersten Anlasstag steht statt des Diagramms
 * ein erklärender Satz.
 *
 * @param props - Siehe {@link ExpenseHistoryChartProps}.
 * @returns Die Diagramm-Karte oder die Karte mit Hinweistext.
 * @example
 * <ExpenseHistoryChart
 *   eventDays={eventDays}
 *   actualValues={statistics.history.actualValues}
 *   targetValues={statistics.history.targetValues}
 *   currency={selectedCurrency}
 * />
 */
export const ExpenseHistoryChart = ({
  eventDays,
  actualValues,
  targetValues,
  currency,
}: ExpenseHistoryChartProps) => {
  const classes = useCustomStyles();
  const theme = useTheme();

  // Anzahl Tage bis heute = Anzahl Ist-Werte; die Datumslogik steckt schon in cumulativeByEventDay
  const elapsedEventDays = actualValues.filter(
    (value) => value !== null,
  ).length;

  // Satz statt Diagramm, solange es nichts zu zeigen gibt; null = Diagramm zeigen
  const hint =
    eventDays.length === 0
      ? TEXT_EVALUATION_HISTORY_NO_EVENT_DAYS
      : elapsedEventDays === 0
        ? TEXT_EVALUATION_HISTORY_NOT_STARTED
        : null;

  // Index des letzten Ist-Werts (heute bzw. letzter Anlasstag); nur relevant, wenn hint null ist
  const lastIndex = elapsedEventDays - 1;

  return (
    <Card variant="outlined" sx={classes.evaluationTile}>
      <Typography variant="subtitle2" color="text.secondary">
        {TEXT_EVALUATION_HISTORY_TITLE}
      </Typography>
      {hint ? (
        <Typography
          variant="body2"
          color="text.secondary"
          sx={classes.evaluationTileHint}
        >
          {hint}
        </Typography>
      ) : (
        <>
          <LineChart
            height={CHART_HEIGHT}
            xAxis={[
              {
                data: eventDays,
                scaleType: "point",
                valueFormatter: formatEventDay,
              },
            ]}
            yAxis={[{valueFormatter: formatAxisAmount}]}
            series={buildSeries({actualValues, targetValues, currency, theme})}
            grid={{horizontal: true}}
            sx={classes.evaluationHistoryChart}
          />
          <Typography variant="caption" color="text.secondary">
            {TEXT_EVALUATION_HISTORY_SUMMARY(
              elapsedEventDays,
              eventDays.length,
              currency,
              actualValues[lastIndex] ?? 0,
              targetValues?.[lastIndex] ?? null,
            )}
          </Typography>
        </>
      )}
    </Card>
  );
};

/**
 * Baut die Serien für das `LineChart`: immer «Ist», «Soll» nur mit Sollbetrag.
 * Beide Serien formatieren ihre Werte im Tooltip mit Währung; `null` (Tage
 * nach heute) wird im Tooltip weggelassen statt als 0 angezeigt.
 *
 * @param params.actualValues - Kumulierte Ist-Werte in Rappen, `null` nach heute.
 * @param params.targetValues - Soll-Werte in Rappen oder `null` (keine Soll-Linie).
 * @param params.currency - Währung für die Tooltip-Beträge.
 * @param params.theme - MUI-Theme, liefert die Linienfarben (auch im Dark Mode passend).
 * @returns Eine oder zwei Serien-Konfigurationen für die `series`-Prop.
 */
const buildSeries = ({
  actualValues,
  targetValues,
  currency,
  theme,
}: {
  actualValues: (number | null)[];
  targetValues: number[] | null;
  currency: string;
  theme: Theme;
}): LineChartProps["series"] => {
  // null → Tooltip lässt den Wert weg (Tage nach heute)
  const formatTooltipAmount = (value: number | null) =>
    value === null ? null : formatAmountFromCents(value, currency);

  // typisiertes Array: sonst wird `curve: "linear"` zu `string` verbreitert
  const series: LineChartProps["series"] = [
    {
      id: "actual",
      label: TEXT_EVALUATION_HISTORY_ACTUAL,
      data: actualValues,
      // gerade Linien: kumulierte Tageswerte steigen sprunghaft, nicht allmählich
      curve: "linear",
      color: theme.palette.primary.main,
      valueFormatter: formatTooltipAmount,
    },
  ];
  if (targetValues) {
    series.push({
      id: TARGET_SERIES_ID,
      label: TEXT_EVALUATION_HISTORY_TARGET,
      data: targetValues,
      curve: "linear",
      color: theme.palette.text.secondary,
      // Fläche unter dem Soll = «Budgetraum»; Füllfarbe kommt aus expenseTracking.styles.ts
      area: true,
      showMark: false,
      valueFormatter: formatTooltipAmount,
    });
  }
  return series;
};

/**
 * Formatiert einen Anlasstag für die x-Achse: auf der Achse kurz, im Tooltip
 * mit Wochentag, damit man den Tag im Anlass schneller einordnen kann.
 *
 * @param day - Anlasstag (lokale Mitternacht).
 * @param context - Von x-charts übergeben; `location` sagt, wo der Wert erscheint.
 * @returns z.B. «05.07.» auf der Achse, «Mo., 05.07.» im Tooltip.
 */
const formatEventDay = (day: Date, context: AxisValueFormatterContext) =>
  day.toLocaleDateString("de-CH", {
    ...(context.location === "tooltip" && {weekday: "short"}),
    day: "2-digit",
    month: "2-digit",
  });

/**
 * Formatiert einen Betrag für die y-Achse: ohne Währung und ohne Rappen, damit
 * die Beschriftung schmal bleibt. Die Währung steht im Tooltip und in der Textzeile.
 *
 * @param valueInCents - Betrag in Rappen.
 * @returns z.B. «1’200» für 120000.
 */
const formatAxisAmount = (valueInCents: number) =>
  (valueInCents / 100).toLocaleString("de-CH", {maximumFractionDigits: 0});
