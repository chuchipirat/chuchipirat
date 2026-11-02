/**
 * Unit-Tests für die Vorschau der Abrechnung ohne Spende
 * (expenseTrackingPreview.tsx).
 */
import {render, screen, within} from "@testing-library/react";
import "@testing-library/jest-dom";

import {ExpenseTrackingPreview} from "../expenseTrackingPreview";
import {EXPENSE_TRACKING_PREVIEW_DATA} from "../expenseTrackingPreview.data";
import {
  EDIT_BUDGET as TEXT_EDIT_BUDGET,
  EXPENSE_TRACKING_PREVIEW_HINT as TEXT_EXPENSE_TRACKING_PREVIEW_HINT,
  EXPENSE_TRACKING_PREVIEW_TITLE as TEXT_EXPENSE_TRACKING_PREVIEW_TITLE,
  NEW_BUDGET as TEXT_NEW_BUDGET,
  NEW_EXPENSE as TEXT_NEW_EXPENSE,
} from "../../../../../constants/text/expenseTracking";

const renderPreview = () =>
  render(<ExpenseTrackingPreview data={EXPENSE_TRACKING_PREVIEW_DATA} />);

/** Der Bereich mit den Beispieldaten, gesperrt für Maus, Tastatur und Screenreader. */
const getPreviewArea = () =>
  screen.getByTestId("expense-tracking-preview-area");

describe("ExpenseTrackingPreview", () => {
  test("Titel und Hinweis stehen ausserhalb des gesperrten Bereichs", () => {
    renderPreview();

    const title = screen.getByText(TEXT_EXPENSE_TRACKING_PREVIEW_TITLE);
    const hint = screen.getByText(TEXT_EXPENSE_TRACKING_PREVIEW_HINT);
    expect(getPreviewArea()).not.toContainElement(title);
    expect(getPreviewArea()).not.toContainElement(hint);
  });

  test("Bereich ist inert", () => {
    renderPreview();

    expect(getPreviewArea()).toHaveAttribute("inert");
  });

  test("zeigt die Beispielbudgets und -ausgaben", () => {
    renderPreview();
    const area = getPreviewArea();

    for (const budget of EXPENSE_TRACKING_PREVIEW_DATA.budgets) {
      expect(within(area).getAllByText(budget.name).length).toBeGreaterThan(0);
    }
    for (const expense of EXPENSE_TRACKING_PREVIEW_DATA.expenses) {
      expect(within(area).getAllByText(expense.label).length).toBeGreaterThan(
        0,
      );
    }
  });

  test("keine Aktionsknöpfe", () => {
    renderPreview();
    const area = getPreviewArea();

    expect(
      within(area).queryByRole("button", {name: TEXT_NEW_BUDGET}),
    ).not.toBeInTheDocument();
    expect(
      within(area).queryByRole("button", {name: TEXT_EDIT_BUDGET}),
    ).not.toBeInTheDocument();
    expect(within(area).queryByText(TEXT_NEW_EXPENSE)).not.toBeInTheDocument();
  });
});

describe("Beispieldaten der Vorschau", () => {
  test("ein Budget fast voll, eines halb voll", () => {
    const percentages = EXPENSE_TRACKING_PREVIEW_DATA.budgetsWithProgress
      .map((budget) => budget.percentage)
      .sort((first, second) => first - second);

    expect(percentages[0]).toBeGreaterThanOrEqual(40);
    expect(percentages[0]).toBeLessThanOrEqual(60);
    expect(percentages[1]).toBeGreaterThanOrEqual(85);
    expect(percentages[1]).toBeLessThan(100);
  });

  test("Fortschritt passt zu den Ausgaben", () => {
    for (const budgetWithProgress of EXPENSE_TRACKING_PREVIEW_DATA.budgetsWithProgress) {
      const spent = EXPENSE_TRACKING_PREVIEW_DATA.expenses
        .filter((expense) => expense.budgetId === budgetWithProgress.budget.id)
        .reduce((sum, expense) => sum + expense.amountInCents, 0);
      expect(budgetWithProgress.spentAmountInCents).toBe(spent);
    }
  });

  test("nur CHF, damit keine Währungsauswahl erscheint", () => {
    const currencies = new Set(
      EXPENSE_TRACKING_PREVIEW_DATA.expenses.map((expense) => expense.currency),
    );
    expect([...currencies]).toEqual(["CHF"]);
  });
});
