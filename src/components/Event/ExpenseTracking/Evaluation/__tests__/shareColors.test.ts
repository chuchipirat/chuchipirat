/**
 * Unit-Tests für die Farbzuordnung der Verteilung nach Budget
 * (shareColors.ts, Story 6.4): Farbe nach Budget-Position, Kollision → nächste
 * freie Farbe, «Übrige» grau.
 */
import {assignShareColors} from "../shareColors";
import {BudgetShare} from "../../Expense/expense.types";
import {getChartCategoryColors} from "../../../../App/customTheme";

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

describe("assignShareColors", () => {
  test("ohne Kollision Farbe nach Budget-Position, nicht nach Rang", () => {
    // Motto (Budget 2) ist grösser und steht vorne, behält aber Farbe 2
    expect(
      assignShareColors([THEME_SHARE, KITCHEN_SHARE], LIGHT_COLORS),
    ).toEqual([LIGHT_COLORS.categories[1], LIGHT_COLORS.categories[0]]);
  });

  test("Budget 1 und 6 im Donut → Budget 6 bekommt die nächste freie Farbe", () => {
    const sixthShare = createShare({id: "budget-6", colorIndex: 5});
    // Budget 6 steht als grösstes Stück vorne; Budget 1 behält trotzdem Farbe 1
    expect(
      assignShareColors([sixthShare, KITCHEN_SHARE, THEME_SHARE], LIGHT_COLORS),
    ).toEqual([
      LIGHT_COLORS.categories[2],
      LIGHT_COLORS.categories[0],
      LIGHT_COLORS.categories[1],
    ]);
  });

  test("«Übrige» immer grau", () => {
    expect(
      assignShareColors(
        [KITCHEN_SHARE, createShare({id: "others", colorIndex: null})],
        LIGHT_COLORS,
      ),
    ).toEqual([LIGHT_COLORS.categories[0], LIGHT_COLORS.others]);
  });
});
