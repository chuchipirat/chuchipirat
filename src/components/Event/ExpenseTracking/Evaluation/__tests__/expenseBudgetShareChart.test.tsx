/**
 * Unit-Tests für die Karte «Verteilung nach Budget» (expenseBudgetShareChart.tsx).
 *
 * Reine Anzeige-Komponente (Story 6.4), darum ohne Contexts: Props direkt.
 * Schwerpunkte: Daten, die an den Donut gehen, und die Legende. Die
 * Farbzuordnung selbst testet `shareColors.test.ts`.
 */
import React from "react";
import {render, screen, within} from "@testing-library/react";
import "@testing-library/jest-dom";
import {createTheme, ThemeProvider} from "@mui/material/styles";
import type {PieChartProps} from "@mui/x-charts/PieChart";

import {ExpenseBudgetShareChart} from "../expenseBudgetShareChart";
import {BudgetShare} from "../../Expense/expense.types";
import {getChartCategoryColors} from "../../../../App/customTheme";
import {formatAmountFromCents} from "../../../../Shared/utils/currencyUtils";
import {EVALUATION_SHARE_TITLE as TEXT_EVALUATION_SHARE_TITLE} from "../../../../../constants/text/expenseTracking";

/**
 * Mock: PieChart — jsdom hat kein Layout, ein gerendertes SVG lässt sich
 * nicht sinnvoll prüfen. Die Fake-Komponente hält ihre Props fest.
 */
const mockPieChart = jest.fn();
jest.mock("@mui/x-charts/PieChart", () => ({
  PieChart: (props: PieChartProps) => {
    mockPieChart(props);
    return <div data-testid="pie-chart" />;
  },
}));

/**
 * Liefert die Props des zuletzt gerenderten Donuts.
 *
 * @returns Props, die die Karte an `PieChart` übergeben hat.
 */
const getLastChartProps = (): PieChartProps => mockPieChart.mock.lastCall[0];

/**
 * Normalisiert Leerzeichen eines Textes (geschützte → normale), für Texte,
 * die einen formatierten Betrag enthalten.
 *
 * @param text - Zu normalisierender Text.
 * @returns Text mit normalen Leerzeichen.
 */
const normalizeSpaces = (text: string): string => text.replace(/\s/g, " ");

const LIGHT_COLORS = getChartCategoryColors("light");

/**
 * Baut ein Stück der Verteilung.
 *
 * @param overrides - Felder, die vom Standard abweichen sollen.
 * @returns Vollständiges Stück.
 */
const createShare = (overrides: Partial<BudgetShare>): BudgetShare => ({
  id: "budget-kitchen",
  label: "Küche",
  amountInCents: 20300,
  sharePercent: 78,
  colorIndex: 0,
  groupedBudgetNames: [],
  ...overrides,
});

const KITCHEN_SHARE = createShare({});
const THEME_SHARE = createShare({
  id: "budget-theme",
  label: "Motto",
  amountInCents: 5700,
  sharePercent: 22,
  colorIndex: 1,
});

beforeEach(() => {
  mockPieChart.mockClear();
});

/**
 * Rendert die Karte (Standard: Küche und Motto, CHF).
 *
 * @param shares - Stücke der Verteilung.
 * @returns Render-Ergebnis.
 */
const renderChart = (shares: BudgetShare[] = [KITCHEN_SHARE, THEME_SHARE]) =>
  render(<ExpenseBudgetShareChart shares={shares} currency="CHF" />);

/**
 * Liefert die Texte der Legendeneinträge in Anzeigereihenfolge.
 *
 * @returns Pro Eintrag der Text mit normalisierten Leerzeichen.
 */
const getLegendTexts = (): string[] =>
  within(screen.getByTestId("evaluation-share-legend"))
    .getAllByRole("listitem")
    .map((item) => normalizeSpaces(item.textContent ?? ""));

describe("ExpenseBudgetShareChart, Donut", () => {
  test("Titel und Donut sichtbar", () => {
    renderChart();

    expect(screen.getByText(TEXT_EVALUATION_SHARE_TITLE)).toBeInTheDocument();
    expect(screen.getByTestId("pie-chart")).toBeInTheDocument();
  });

  test("ein Stück pro Budget mit id, Betrag, Name und Farbe", () => {
    renderChart();

    const series = getLastChartProps().series[0];
    expect(series.data).toEqual([
      {
        id: "budget-kitchen",
        value: 20300,
        label: "Küche",
        color: LIGHT_COLORS.categories[0],
      },
      {
        id: "budget-theme",
        value: 5700,
        label: "Motto",
        color: LIGHT_COLORS.categories[1],
      },
    ]);
    expect(series.innerRadius).toEqual("60%");
  });

  test("eingebaute Legende ausgeblendet (eigene Legende daneben)", () => {
    renderChart();

    expect(getLastChartProps().slotProps?.legend?.hidden).toBe(true);
  });

  test("Tooltip: Betrag mit Währung und Anteil", () => {
    renderChart();

    const valueFormatter = getLastChartProps().series[0].valueFormatter;
    const item = {id: "budget-theme", value: 5700};
    expect(
      normalizeSpaces(valueFormatter?.(item, {dataIndex: 1}) ?? ""),
    ).toEqual(normalizeSpaces(`${formatAmountFromCents(5700, "CHF")} · 22 %`));
  });

  test("Dark Mode: Farben aus der dunklen Palette", () => {
    render(
      <ThemeProvider theme={createTheme({palette: {mode: "dark"}})}>
        <ExpenseBudgetShareChart
          shares={[KITCHEN_SHARE, THEME_SHARE]}
          currency="CHF"
        />
      </ThemeProvider>,
    );

    expect(getLastChartProps().series[0].data[0].color).toEqual(
      getChartCategoryColors("dark").categories[0],
    );
  });
});

describe("ExpenseBudgetShareChart, Legende", () => {
  test("Name, Betrag und Anteil je Stück, in Donut-Reihenfolge", () => {
    renderChart();

    expect(getLegendTexts()).toEqual([
      normalizeSpaces(`Küche${formatAmountFromCents(20300, "CHF")} · 78 %`),
      normalizeSpaces(`Motto${formatAmountFromCents(5700, "CHF")} · 22 %`),
    ]);
  });

  test("Anteil 0 → «< 1 %»", () => {
    renderChart([
      createShare({sharePercent: 100}),
      createShare({
        id: "budget-theme",
        label: "Motto",
        amountInCents: 10,
        sharePercent: 0,
        colorIndex: 1,
      }),
    ]);

    expect(getLegendTexts()[1]).toMatch(/· < 1 %$/);
  });

  test("«Übrige» zeigt die zusammengefassten Namen und ist grau", () => {
    const othersShare = createShare({
      id: "others",
      label: "Übrige (2 Budgets)",
      amountInCents: 5000,
      sharePercent: 5,
      colorIndex: null,
      groupedBudgetNames: ["Material", "Ausflug"],
    });
    renderChart([KITCHEN_SHARE, othersShare]);

    expect(getLegendTexts()[1]).toMatch(
      /^Übrige \(2 Budgets\).*Material, Ausflug$/,
    );
    expect(getLastChartProps().series[0].data[1].color).toEqual(
      LIGHT_COLORS.others,
    );
    expect(screen.getByTestId("evaluation-share-dot-others")).toHaveStyle({
      backgroundColor: LIGHT_COLORS.others,
    });
  });
});
