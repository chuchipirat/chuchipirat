/**
 * Unit-Tests für die Karte «Ausgabenverlauf» (expenseHistoryChart.tsx).
 *
 * Reine Anzeige-Komponente (Story 6.3), darum ohne Contexts: Props direkt.
 * Schwerpunkte: Reihen und Achsen, die an das Diagramm gehen, die Textzeile
 * unter dem Diagramm und die leeren Zustände.
 */
import React from "react";
import {render, screen} from "@testing-library/react";
import "@testing-library/jest-dom";
import type {LineChartProps} from "@mui/x-charts/LineChart";

import {ExpenseHistoryChart} from "../expenseHistoryChart";
import {parseLocalDate} from "../../../../utils/dateUtils";
import {formatAmountFromCents} from "../../../Shared/utils/currencyUtils";

import {
  EVALUATION_HISTORY_SUMMARY as TEXT_EVALUATION_HISTORY_SUMMARY,
  EVALUATION_HISTORY_NOT_STARTED as TEXT_EVALUATION_HISTORY_NOT_STARTED,
  EVALUATION_HISTORY_NO_EVENT_DAYS as TEXT_EVALUATION_HISTORY_NO_EVENT_DAYS,
  EVALUATION_HISTORY_TITLE as TEXT_EVALUATION_HISTORY_TITLE,
  EVALUATION_HISTORY_ACTUAL as TEXT_EVALUATION_HISTORY_ACTUAL,
  EVALUATION_HISTORY_TARGET as TEXT_EVALUATION_HISTORY_TARGET,
} from "../../../../constants/text/expenseTracking";

/**
 * Mock: LineChart — jsdom hat kein Layout, ein gerendertes SVG lässt sich
 * nicht sinnvoll prüfen. Die Fake-Komponente hält ihre Props fest, damit die
 * Tests Reihen und Achsen prüfen können.
 */
const mockLineChart = jest.fn();
jest.mock("@mui/x-charts/LineChart", () => ({
  LineChart: (props: LineChartProps) => {
    mockLineChart(props);
    return <div data-testid="line-chart" />;
  },
}));

/**
 * Liefert die Props des zuletzt gerenderten Diagramms.
 *
 * @returns Props, die die Karte an `LineChart` übergeben hat.
 */
const getLastChartProps = (): LineChartProps => mockLineChart.mock.lastCall[0];

/**
 * Normalisiert Leerzeichen eines Textes (geschützte → normale), für Texte,
 * die einen formatierten Betrag enthalten (Lehre aus 6.1).
 *
 * @param text - Zu normalisierender Text.
 * @returns Text mit normalen Leerzeichen.
 */
const normalizeSpaces = (text: string): string => text.replace(/\s/g, " ");

/** Anlass mit 7 Tagen, 5.–11. Juli 2026. */
const EVENT_DAYS = [
  "2026-07-05",
  "2026-07-06",
  "2026-07-07",
  "2026-07-08",
  "2026-07-09",
  "2026-07-10",
  "2026-07-11",
].map((dayKey) => parseLocalDate(dayKey));

/** Ist bis Anlasstag 3 (heute), danach null. */
const ACTUAL_VALUES = [120000, 125000, 135000, null, null, null, null];
/** Soll CHF 2'400, linear über 7 Tage. */
const TARGET_VALUES = [34286, 68571, 102857, 137143, 171429, 205714, 240000];

beforeEach(() => {
  mockLineChart.mockClear();
});

/**
 * Rendert die Karte mit Standardwerten (7 Tage, heute Tag 3, CHF, mit Soll).
 *
 * @param overrides - Props, die vom Standard abweichen sollen.
 * @returns Render-Ergebnis.
 */
const renderChart = (
  overrides: Partial<React.ComponentProps<typeof ExpenseHistoryChart>> = {},
) =>
  render(
    <ExpenseHistoryChart
      eventDays={EVENT_DAYS}
      actualValues={ACTUAL_VALUES}
      targetValues={TARGET_VALUES}
      currency="CHF"
      {...overrides}
    />,
  );

describe("ExpenseHistoryChart, Diagramm", () => {
  test("Titel und Diagramm sichtbar", () => {
    renderChart();

    expect(screen.getByText(TEXT_EVALUATION_HISTORY_TITLE)).toBeInTheDocument();
    expect(screen.getByTestId("line-chart")).toBeInTheDocument();
  });

  test("x-Achse: ein Punkt pro Anlasstag", () => {
    renderChart();

    const xAxis = getLastChartProps().xAxis?.[0];
    expect(xAxis?.scaleType).toEqual("point");
    expect(xAxis?.data).toEqual(EVENT_DAYS);
  });

  test("Ist und Soll werden unverändert als zwei Serien übergeben", () => {
    renderChart();

    const series = getLastChartProps().series;
    expect(series).toHaveLength(2);
    expect(series[0]).toMatchObject({
      label: TEXT_EVALUATION_HISTORY_ACTUAL,
      data: ACTUAL_VALUES,
      // kumulierte Tageswerte: gerade Linien, keine Glättung
      curve: "linear",
    });
    // id «target» muss zum Strich-Selektor in expenseTracking.styles.ts passen
    expect(series[1]).toMatchObject({
      id: "target",
      label: TEXT_EVALUATION_HISTORY_TARGET,
      data: TARGET_VALUES,
      curve: "linear",
      // Fläche unter dem Soll («Budgetraum»)
      area: true,
      showMark: false,
    });
  });

  test("ohne Sollbetrag nur die Ist-Serie", () => {
    renderChart({targetValues: null});

    const series = getLastChartProps().series;
    expect(series).toHaveLength(1);
    expect(series[0].data).toEqual(ACTUAL_VALUES);
  });

  test("Tooltip: Betrag mit Währung, Tage nach heute ohne Wert", () => {
    renderChart({currency: "EUR"});

    const valueFormatter = getLastChartProps().series[0].valueFormatter;
    const context = {dataIndex: 0};
    expect(valueFormatter?.(135000, context)).toEqual(
      formatAmountFromCents(135000, "EUR"),
    );
    expect(valueFormatter?.(null, context)).toBeNull();
  });

  test("Achsenbeschriftung: Datum kurz, im Tooltip mit Wochentag", () => {
    renderChart();

    const formatDay = getLastChartProps().xAxis?.[0].valueFormatter;
    const sunday = parseLocalDate("2026-07-05");
    expect(formatDay?.(sunday, {location: "tick"})).toEqual("05.07.");
    expect(formatDay?.(sunday, {location: "tooltip"})).toMatch(/^So.*05\.07\.$/);
  });

  test("y-Achse: Betrag ohne Währung und ohne Rappen", () => {
    renderChart();

    const formatAmount = getLastChartProps().yAxis?.[0].valueFormatter;
    const formatted = formatAmount?.(120050, {location: "tick"}) ?? "";
    expect(formatted).not.toMatch(/CHF|\./);
    expect(formatted.replace(/\D/g, "")).toEqual("1201");
  });
});

describe("ExpenseHistoryChart, Textzeile", () => {
  test("Stand mit Ist und Soll des letzten Ist-Tags", () => {
    renderChart();

    expect(
      screen.getByText(
        (_content, element) =>
          element?.tagName === "SPAN" &&
          normalizeSpaces(element.textContent ?? "") ===
            normalizeSpaces(
              TEXT_EVALUATION_HISTORY_SUMMARY(3, 7, "CHF", 135000, 102857),
            ),
      ),
    ).toBeInTheDocument();
  });

  test("ohne Sollbetrag ohne «Soll bis heute»", () => {
    renderChart({targetValues: null});

    expect(screen.getByText(/^Stand Anlasstag 3 von 7:/)).not.toHaveTextContent(
      /Soll/,
    );
  });

  test("nach dem Anlass: Stand am letzten Anlasstag", () => {
    renderChart({
      actualValues: [100, 200, 300, 400, 500, 600, 700],
      targetValues: null,
    });

    expect(screen.getByText(/^Stand Anlasstag 7 von 7:/)).toBeInTheDocument();
  });
});

describe("EVALUATION_HISTORY_SUMMARY", () => {
  test("während des Anlasses «Soll bis heute», ohne Zeilenumbruch", () => {
    expect(
      normalizeSpaces(TEXT_EVALUATION_HISTORY_SUMMARY(3, 7, "CHF", 135000, 102857)),
    ).toEqual(
      "Stand Anlasstag 3 von 7: CHF 1’350.00 ausgegeben, Soll bis heute CHF 1’028.57.",
    );
  });

  test("am letzten Anlasstag und danach «Soll gesamt»", () => {
    expect(
      normalizeSpaces(TEXT_EVALUATION_HISTORY_SUMMARY(4, 4, "CHF", 20300, 69100)),
    ).toEqual("Stand Anlasstag 4 von 4: CHF 203.00 ausgegeben, Soll gesamt CHF 691.00.");
  });

  test("ohne Sollbetrag nur der Ist-Teil", () => {
    expect(
      normalizeSpaces(TEXT_EVALUATION_HISTORY_SUMMARY(4, 4, "CHF", 20300, null)),
    ).toEqual("Stand Anlasstag 4 von 4: CHF 203.00 ausgegeben.");
  });
});

describe("ExpenseHistoryChart, leere Zustände", () => {
  test("heute vor dem Anlass → Hinweis statt Diagramm", () => {
    renderChart({actualValues: new Array(7).fill(null)});

    expect(
      screen.getByText(TEXT_EVALUATION_HISTORY_NOT_STARTED),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("line-chart")).not.toBeInTheDocument();
    expect(screen.queryByText(/^Stand Anlasstag/)).not.toBeInTheDocument();
  });

  test("keine Anlasstage → Hinweis statt Diagramm, Titel bleibt", () => {
    renderChart({eventDays: [], actualValues: [], targetValues: null});

    expect(
      screen.getByText(TEXT_EVALUATION_HISTORY_NO_EVENT_DAYS),
    ).toBeInTheDocument();
    expect(screen.getByText(TEXT_EVALUATION_HISTORY_TITLE)).toBeInTheDocument();
    expect(screen.queryByTestId("line-chart")).not.toBeInTheDocument();
  });
});
