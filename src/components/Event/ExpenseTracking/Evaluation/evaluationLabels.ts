import {BudgetDomain} from "../Budget/budget.types";
import {
  EVALUATION_BUDGET_FILTER_ALL as TEXT_EVALUATION_BUDGET_FILTER_ALL,
  EVALUATION_BUDGET_FILTER_PARTIAL as TEXT_EVALUATION_BUDGET_FILTER_PARTIAL,
  EVALUATION_SCOPE_NOTE_CURRENCIES as TEXT_EVALUATION_SCOPE_NOTE_CURRENCIES,
  EVALUATION_SCOPE_NOTE_BUDGETS as TEXT_EVALUATION_SCOPE_NOTE_BUDGETS,
} from "../../../../constants/text";

/**
 * Liefert die Beschriftung des Budget-Filters passend zur aktuellen Auswahl.
 *
 * @param selectedBudgets - Aktuell berücksichtigte Budgets.
 * @param totalBudgetCount - Anzahl aller Budgets des Anlasses.
 * @returns "Alle Budgets", der Budgetname bei genau einer Auswahl oder "2 von 3 Budgets".
 */
export const getBudgetFilterLabel = (
  selectedBudgets: BudgetDomain[],
  totalBudgetCount: number,
): string => {
  if (selectedBudgets.length === totalBudgetCount) {
    return TEXT_EVALUATION_BUDGET_FILTER_ALL;
  }
  if (selectedBudgets.length === 1) {
    return selectedBudgets[0].name;
  }
  return TEXT_EVALUATION_BUDGET_FILTER_PARTIAL(
    selectedBudgets.length,
    totalBudgetCount,
  );
};

/**
 * Erzeugt den Hinweistext, was in den Kennzahlen nicht enthalten ist. Ein
 * Satz pro Filter, damit sichtbar bleibt, warum eine Zahl kleiner ist.
 *
 * @param excludedCurrencies - Durch die Währungsauswahl ausgeblendete Währungen.
 * @param excludedBudgetNames - Namen der durch den Budget-Filter ausgeblendeten Budgets.
 * @returns Hinweistext oder null, wenn nichts ausgeblendet ist.
 * @example
 * getStatisticsScopeNote(["EUR"], ["Material"])
 * // «Ausgaben in EUR sind hier nicht enthalten. Nicht berücksichtigte Budgets: Material.»
 */
export const getStatisticsScopeNote = (
  excludedCurrencies: string[],
  excludedBudgetNames: string[],
): string | null => {
  const sentences: string[] = [];
  if (excludedCurrencies.length > 0) {
    sentences.push(TEXT_EVALUATION_SCOPE_NOTE_CURRENCIES(excludedCurrencies));
  }
  if (excludedBudgetNames.length > 0) {
    sentences.push(TEXT_EVALUATION_SCOPE_NOTE_BUDGETS(excludedBudgetNames));
  }
  return sentences.length > 0 ? sentences.join(" ") : null;
};
