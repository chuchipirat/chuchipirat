import {fireEvent, render, screen} from "@testing-library/react";
import "@testing-library/jest-dom";

import {BudgetCardGrid} from "../budgetCardGrid";
import {BudgetWithProgress} from "../budget.types";
import {budget, budget2} from "../__mocks__/budget.mock";
import {NEW_BUDGET as TEXT_NEW_BUDGET} from "../../../../../constants/text/expenseTracking";

const withProgress = (source: typeof budget): BudgetWithProgress => ({
  budget: source,
  targetAmountInCents: 10000,
  spentAmountInCents: 5000,
  otherCurrenciesSpent: [],
  percentage: 50,
  projection: null,
});

const budgetsWithProgress = [withProgress(budget), withProgress(budget2)];

describe("BudgetCardGrid", () => {
  test("zeigt eine Karte pro Budget", () => {
    render(
      <BudgetCardGrid
        budgetsWithProgress={budgetsWithProgress}
        highlightedBudgetIds={new Set()}
        handleEditClick={jest.fn()}
      />,
    );

    expect(screen.getByTestId(budget.id)).toBeInTheDocument();
    expect(screen.getByTestId(budget2.id)).toBeInTheDocument();
  });

  test("ohne Handler keine Karte zum Hinzufügen", () => {
    render(
      <BudgetCardGrid
        budgetsWithProgress={budgetsWithProgress}
        highlightedBudgetIds={new Set()}
        handleEditClick={jest.fn()}
      />,
    );

    expect(
      screen.queryByRole("button", {name: TEXT_NEW_BUDGET}),
    ).not.toBeInTheDocument();
  });

  test("mit Handler: die Karte ruft ihn auf", () => {
    const handleAddClick = jest.fn();
    render(
      <BudgetCardGrid
        budgetsWithProgress={budgetsWithProgress}
        highlightedBudgetIds={new Set()}
        handleEditClick={jest.fn()}
        handleAddClick={handleAddClick}
      />,
    );

    fireEvent.click(screen.getByRole("button", {name: TEXT_NEW_BUDGET}));

    expect(handleAddClick).toHaveBeenCalledTimes(1);
  });
});
