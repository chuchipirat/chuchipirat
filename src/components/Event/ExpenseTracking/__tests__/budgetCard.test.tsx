/**
 * Unit-Tests für die Budget-Karte (budgetCard.tsx).
 *
 * Schwerpunkt: Anzeige der Hochrechnung bis Anlassende inkl. Warnfall
 * (Story 6.1). Reine Anzeige-Komponente, darum ohne Contexts.
 */
import {fireEvent, render, screen} from "@testing-library/react";
import "@testing-library/jest-dom";

import {BudgetCard} from "../budgetCard";
import {budget} from "../__mocks__/budget.mock";
import {BudgetProjection, BudgetWithProgress} from "../budget.types";
import {formatAmountFromCents} from "../../../Shared/utils/currencyUtils";

import {
  EDIT_BUDGET as TEXT_EDIT_BUDGET,
  PROJECTION_TILL_EVENT_END as TEXT_PROJECTION_TILL_EVENT_END,
  DAY_X_OF_Y_IN_EVENT as TEXT_DAY_X_OF_Y_IN_EVENT,
  PROJECTION_ABOVE_BUDGET as TEXT_PROJECTION_ABOVE_BUDGET,
} from "../../../../constants/text/expenseTracking";

// MUI-Icons rendern ein <svg data-testid="<Name>Icon">
const PROJECTION_WARNING_ICON_TEST_ID = "TrendingUpOutlinedIcon";

/**
 * Formatiert einen Betrag wie die Karte, aber mit normalem Leerzeichen.
 * `Intl.NumberFormat` trennt Währung und Betrag mit einem geschützten
 * Leerzeichen; `toHaveTextContent` normalisiert nur den gerenderten Text,
 * nicht den erwarteten — ohne Ersetzen schlägt der Vergleich fehl.
 *
 * @param amountInCents - Betrag in Rappen.
 * @param currency - ISO-4217-Währungscode.
 * @returns Formatierter Betrag mit normalen Leerzeichen.
 */
const expectedAmount = (amountInCents: number, currency: string): string =>
  formatAmountFromCents(amountInCents, currency).replace(/\s/g, " ");

/**
 * Baut eine Budget-Karten-Eingabe mit Soll CHF 1'000 und CHF 300 Ist.
 *
 * @param overrides - Felder, die vom Standard abweichen sollen.
 * @returns Vollständiges `BudgetWithProgress` für die Karte.
 */
const createBudgetWithProgress = (
  overrides: Partial<BudgetWithProgress> = {},
): BudgetWithProgress => ({
  budget: {...budget, amountInCents: 100000},
  targetAmountInCents: 100000,
  spentAmountInCents: 30000,
  otherCurrenciesSpent: [],
  percentage: 30,
  projection: null,
  ...overrides,
});

const projectionBelowTarget: BudgetProjection = {
  projectedAmountInCents: 70000,
  elapsedCampDays: 3,
  totalCampDays: 7,
};

const projectionAboveTarget: BudgetProjection = {
  projectedAmountInCents: 148000,
  elapsedCampDays: 3,
  totalCampDays: 7,
};

/**
 * Rendert die Karte mit den übergebenen Daten.
 *
 * @param budgetWithProgress - Daten der Karte.
 * @returns Den Mock für den Bearbeiten-Klick.
 */
const renderBudgetCard = (budgetWithProgress: BudgetWithProgress) => {
  const handleEditClick = jest.fn();
  render(
    <BudgetCard
      budgetWithProgress={budgetWithProgress}
      isHighlighted={false}
      handleEditClick={handleEditClick}
    />,
  );
  return handleEditClick;
};

describe("BudgetCard, Hochrechnung", () => {
  test("Ohne Hochrechnung (`null`) wird keine Hochrechnungszeile angezeigt", () => {
    renderBudgetCard(createBudgetWithProgress({projection: null}));

    expect(
      screen.queryByText(TEXT_PROJECTION_TILL_EVENT_END, {exact: false}),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/Anlasstag/)).not.toBeInTheDocument();
    expect(
      screen.queryByText(TEXT_PROJECTION_ABOVE_BUDGET),
    ).not.toBeInTheDocument();
  });

  test("Hochrechnung unter Soll: Betrag und Anlasstag sichtbar, keine Warnung", () => {
    renderBudgetCard(
      createBudgetWithProgress({projection: projectionBelowTarget}),
    );

    expect(
      screen.getByText(TEXT_PROJECTION_TILL_EVENT_END, {exact: false}),
    ).toHaveTextContent(expectedAmount(70000, "CHF"));
    expect(
      screen.getByText(TEXT_DAY_X_OF_Y_IN_EVENT(3, 7)),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(TEXT_PROJECTION_ABOVE_BUDGET),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId(PROJECTION_WARNING_ICON_TEST_ID),
    ).not.toBeInTheDocument();
  });

  test("Hochrechnung über Soll: Warntext und Icon sichtbar", () => {
    renderBudgetCard(
      createBudgetWithProgress({projection: projectionAboveTarget}),
    );

    expect(
      screen.getByText(TEXT_PROJECTION_TILL_EVENT_END, {exact: false}),
    ).toHaveTextContent(expectedAmount(148000, "CHF"));
    expect(screen.getByText(TEXT_PROJECTION_ABOVE_BUDGET)).toBeInTheDocument();
    expect(
      screen.getByTestId(PROJECTION_WARNING_ICON_TEST_ID),
    ).toBeInTheDocument();
  });

  test("Hochrechnung genau auf Soll: keine Warnung", () => {
    renderBudgetCard(
      createBudgetWithProgress({
        projection: {...projectionBelowTarget, projectedAmountInCents: 100000},
      }),
    );

    expect(
      screen.queryByText(TEXT_PROJECTION_ABOVE_BUDGET),
    ).not.toBeInTheDocument();
  });

  test("Soll 0: Hochrechnung neutral, keine Warnung", () => {
    renderBudgetCard(
      createBudgetWithProgress({
        budget: {...budget, amountInCents: null},
        targetAmountInCents: 0,
        percentage: 0,
        projection: projectionAboveTarget,
      }),
    );

    expect(
      screen.getByText(TEXT_PROJECTION_TILL_EVENT_END, {exact: false}),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(TEXT_PROJECTION_ABOVE_BUDGET),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId(PROJECTION_WARNING_ICON_TEST_ID),
    ).not.toBeInTheDocument();
  });

  test("Betrag wird in der Budgetwährung angezeigt", () => {
    renderBudgetCard(
      createBudgetWithProgress({
        budget: {...budget, amountInCents: 100000, currency: "EUR"},
        projection: projectionBelowTarget,
      }),
    );

    expect(
      screen.getByText(TEXT_PROJECTION_TILL_EVENT_END, {exact: false}),
    ).toHaveTextContent(expectedAmount(70000, "EUR"));
  });
});

describe("BudgetCard, Bearbeiten", () => {
  test("Klick auf Bearbeiten übergibt die Budget-ID", () => {
    const handleEditClick = renderBudgetCard(createBudgetWithProgress());

    fireEvent.click(screen.getByRole("button", {name: TEXT_EDIT_BUDGET}));

    expect(handleEditClick).toHaveBeenCalledWith(budget.id);
  });
});
