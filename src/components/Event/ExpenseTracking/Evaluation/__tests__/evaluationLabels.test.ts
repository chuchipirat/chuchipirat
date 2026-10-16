/**
 * Unit-Tests für die Texthilfen der Auswertung (evaluationLabels.ts):
 * Beschriftung des Budget-Filters und Hinweiszeile zu ausgeblendeten
 * Währungen/Budgets (Story 6.2b).
 */
import {
  getBudgetFilterLabel,
  getStatisticsScopeNote,
} from "../evaluationLabels";
import {budget, budget2} from "../../Budget/__mocks__/budget.mock";
import {
  EVALUATION_BUDGET_FILTER_ALL as TEXT_EVALUATION_BUDGET_FILTER_ALL,
  EVALUATION_BUDGET_FILTER_PARTIAL as TEXT_EVALUATION_BUDGET_FILTER_PARTIAL,
} from "../../../../../constants/text/expenseTracking";

describe("getBudgetFilterLabel", () => {
  test("alle Budgets gewählt → «Alle Budgets»", () => {
    expect(getBudgetFilterLabel([budget, budget2], 2)).toBe(
      TEXT_EVALUATION_BUDGET_FILTER_ALL,
    );
  });

  test("genau ein Budget gewählt → dessen Name", () => {
    expect(getBudgetFilterLabel([budget2], 3)).toBe(budget2.name);
  });

  test("Teilauswahl mit mehreren → «2 von 3 Budgets»", () => {
    expect(getBudgetFilterLabel([budget, budget2], 3)).toBe(
      TEXT_EVALUATION_BUDGET_FILTER_PARTIAL(2, 3),
    );
    expect(TEXT_EVALUATION_BUDGET_FILTER_PARTIAL(2, 3)).toBe("2 von 3 Budgets");
  });
});

describe("getStatisticsScopeNote", () => {
  test("nichts ausgeblendet → null", () => {
    expect(getStatisticsScopeNote([], [])).toBeNull();
  });

  test("nur andere Währungen → nur Währungssatz", () => {
    expect(getStatisticsScopeNote(["EUR"], [])).toBe(
      "Ausgaben in EUR sind hier nicht enthalten.",
    );
  });

  test("nur abgewählte Budgets → nur Budgetsatz, Aufzählung mit «und»", () => {
    expect(getStatisticsScopeNote([], ["Motto", "Material", "Lagerbau"])).toBe(
      "Nicht berücksichtigte Budgets: Motto, Material und Lagerbau.",
    );
  });

  test("beides → zuerst Währungen, dann Budgets", () => {
    expect(getStatisticsScopeNote(["EUR", "USD"], ["Motto"])).toBe(
      "Ausgaben in EUR und USD sind hier nicht enthalten. " +
        "Nicht berücksichtigte Budgets: Motto.",
    );
  });
});
