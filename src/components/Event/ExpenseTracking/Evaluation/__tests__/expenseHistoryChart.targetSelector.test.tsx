/**
 * Prüft mit einem echten LineChart, dass die Selektoren für die Soll-Linie
 * (gestrichelt, heller «Budgetraum») auf die gerenderten Elemente passen.
 *
 * Die Styles stehen in `expenseTracking.styles.ts` und hängen an Klassen und
 * Attributen von x-charts. Benennt eine neue Version sie um, bleiben Typen
 * und die übrigen Tests grün, die Linie ist aber nicht mehr gestrichelt. Die
 * übrigen Diagramm-Tests mocken den LineChart und sehen das nicht.
 */
import React from "react";
import {render} from "@testing-library/react";
import {LineChart, lineClasses} from "@mui/x-charts/LineChart";

/** Serien-ID der Soll-Linie, wie in expenseHistoryChart.tsx und den Styles. */
const TARGET_SERIES_ID = "target";

/**
 * Rendert ein kleines Diagramm mit Ist- und Soll-Serie (Soll mit Fläche).
 */
const renderChartWithTarget = () =>
  render(
    <LineChart
      width={400}
      height={200}
      skipAnimation
      xAxis={[{data: [1, 2, 3]}]}
      series={[
        {id: "actual", data: [1, 2, 3]},
        {id: TARGET_SERIES_ID, data: [2, 2, 2], area: true},
      ]}
    />,
  );

describe("Selektoren der Soll-Linie", () => {
  it("treffen genau die Linie der Soll-Serie", () => {
    const {container} = renderChartWithTarget();

    expect(
      container.querySelectorAll(
        `.${lineClasses.line}[data-series="${TARGET_SERIES_ID}"]`,
      ),
    ).toHaveLength(1);
  });

  it("treffen genau die Fläche der Soll-Serie", () => {
    const {container} = renderChartWithTarget();

    expect(
      container.querySelectorAll(
        `.${lineClasses.area}[data-series="${TARGET_SERIES_ID}"]`,
      ),
    ).toHaveLength(1);
  });
});
