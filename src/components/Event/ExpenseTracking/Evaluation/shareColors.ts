import {ChartCategoryColors} from "../../../App/customTheme";
import {BudgetShare} from "../Expense/expense.types";

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
