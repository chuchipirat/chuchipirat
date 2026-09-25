import {ExpenseGroup} from "../expense.types";
import {Expense} from "../expense.class";
import {ExpenseList} from "../expenseList";
import {budget, budget2} from "../__mocks__/budget.mock";
import {expense, expenseChf, expenseEur} from "../__mocks__/expense.mock";
import {
  fireEvent,
  getDefaultNormalizer,
  render,
  screen,
  within,
} from "@testing-library/react";
import "@testing-library/jest-dom";

import {NO_EXPENSES_YET as TEXT_NO_EXPENSES_YET} from "../../../../constants/text";
import {formatAmountFromCents} from "../../../Shared/utils/currencyUtils";

const normalizer = getDefaultNormalizer();

const formattedDate = (date: Date) =>
  date.toLocaleString("de-CH", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

describe("ExpenseList, Standard Funktionalität ", () => {
  test("Keine Ausgaben: Text wird angezeigt", () => {
    const mockExpenseGroup: ExpenseGroup[] = [
      {
        budget: budget,
        expenses: [],
        totalsByCurrency: {},
      },
    ];

    render(
      <ExpenseList
        expenseGroups={mockExpenseGroup}
        handleEditClick={jest.fn()}
      />,
    );

    expect(screen.getByText(TEXT_NO_EXPENSES_YET)).toBeInTheDocument();
  });
  test("Reihenfolge der Gruppen und Ausgaben entspricht der Reihenfolge der ExpenseGroup", () => {
    const mockExpenseGroup: ExpenseGroup[] = [
      {
        budget: budget,
        expenses: [expense],
        totalsByCurrency:
          Expense.sumByBudgetAndCurrency([expense])[budget.id] ?? {},
      },
      {
        budget: budget2,
        expenses: [expenseChf],
        totalsByCurrency:
          Expense.sumByBudgetAndCurrency([expenseChf])[budget2.id] ?? {},
      },
    ];

    render(
      <ExpenseList
        expenseGroups={mockExpenseGroup}
        handleEditClick={jest.fn()}
      />,
    );

    // within(): nur Nachfahren der Liste, nicht ihr eigenes data-testid
    const list = screen.getByTestId("expense-tracking-expenses-list");
    const orderedIds = [...list.querySelectorAll("[data-testid]")].map((el) =>
      el.getAttribute("data-testid"),
    );
    expect(orderedIds).toEqual([
      "budget-subheader-budget-id-001",
      "RestaurantOutlinedIcon",
      "expense-expense-id-001",
      "budget-subheader-budget-id-002",
      "CelebrationOutlinedIcon",
      "expense-expense-id-002",
    ]);
  });
  test("Sortierung der Ausgaben stimmt, mit dem Array überrein", () => {
    // Array kommt schon sortiert
    const mockExpenseGroup: ExpenseGroup[] = [
      {
        budget: budget,
        expenses: [{...expenseChf}, {...expense}],
        totalsByCurrency:
          Expense.sumByBudgetAndCurrency([expense, expenseChf])[budget.id] ??
          {},
      },
    ];

    render(
      <ExpenseList
        expenseGroups={mockExpenseGroup}
        handleEditClick={jest.fn()}
      />,
    );

    // Regex `/^expense-/` würde auch den Listen-Container
    // ("expense-tracking-expenses-list") treffen — genauer eingrenzen.
    const rows = screen.getAllByTestId(/^expense-expense-id-/);
    expect(rows.map((row) => row.getAttribute("data-testid"))).toEqual([
      "expense-expense-id-002",
      "expense-expense-id-001",
    ]);
  });
  test("Total Ausgaben für Budget wird angezeigt", () => {
    const mockExpenseGroup: ExpenseGroup[] = [
      {
        budget: budget,
        expenses: [expense, expenseChf],
        totalsByCurrency:
          Expense.sumByBudgetAndCurrency([expense, expenseChf])[budget.id] ??
          {},
      },
    ];

    render(
      <ExpenseList
        expenseGroups={mockExpenseGroup}
        handleEditClick={jest.fn()}
      />,
    );

    expect(
      screen.getByText(normalizer(formatAmountFromCents(5300, "CHF"))),
    ).toBeInTheDocument();
  });
  test("Total Ausgaben mit mehreren Währungen", () => {
    const mockExpenseGroup: ExpenseGroup[] = [
      {
        budget: budget,
        expenses: [{...expenseEur}, {...expense}, {...expenseChf}],
        // EUR zuerst einfügen (kein Zufall): sumByBudgetAndCurrency baut
        // totalsByCurrency per reduce, Object.entries() liefert dessen
        // Einfüge-Reihenfolge zurück. Käme CHF zuerst hinein, würde ein
        // kaputter (No-op-)Sort dieselbe — zufällig schon alphabetische —
        // Reihenfolge liefern wie ein echter Sort, und der Test unten würde
        // nichts mehr beweisen.
        totalsByCurrency:
          Expense.sumByBudgetAndCurrency([expenseEur, expense, expenseChf])[
            budget.id
          ] ?? {},
      },
    ];
    render(
      <ExpenseList
        expenseGroups={mockExpenseGroup}
        handleEditClick={jest.fn()}
      />,
    );

    const groupHeader = screen.getByTestId("budget-subheader-budget-id-001");

    expect(
      within(groupHeader).getByText(
        normalizer(formatAmountFromCents(5300, "CHF")),
      ),
    ).toBeInTheDocument();
    expect(
      within(groupHeader).getByText(
        normalizer(formatAmountFromCents(1100, "EUR")),
      ),
    ).toBeInTheDocument();
    const amounts = within(groupHeader).getAllByText(/^(CHF|EUR)/);
    expect(amounts.map((el) => el.textContent)).toEqual([
      formatAmountFromCents(5300, "CHF"),
      formatAmountFromCents(1100, "EUR"),
    ]);
  });
  test("Kommentare werden richtig angezeigt", () => {
    const mockExpenseGroup: ExpenseGroup[] = [
      {
        budget: budget,
        expenses: [{...expense}, {...expenseChf, comment: ""}],
        totalsByCurrency:
          Expense.sumByBudgetAndCurrency([expense, expenseChf])[budget.id] ??
          {},
      },
    ];
    render(
      <ExpenseList
        expenseGroups={mockExpenseGroup}
        handleEditClick={jest.fn()}
      />,
    );

    const expenseRow1 = screen.getByTestId("expense-expense-id-001");
    const expenseRow2 = screen.getByTestId("expense-expense-id-002");
    expect(
      within(expenseRow1).getByText(
        `${formattedDate(expense.expenseDate)} · Vorweekend`,
      ),
    ).toBeInTheDocument();
    expect(
      within(expenseRow2).getByText(formattedDate(expenseChf.expenseDate)),
    ).toBeInTheDocument();
    expect(
      within(expenseRow2).queryByText(/Kurswoche/),
    ).not.toBeInTheDocument();
  });
  test("Gruppe ohne Ausgabe wird nicht angezeigt", () => {
    const mockExpenseGroup: ExpenseGroup[] = [
      {
        budget: budget,
        expenses: [{...expense}, {...expenseChf, comment: ""}],
        totalsByCurrency:
          Expense.sumByBudgetAndCurrency([expense, expenseChf])[budget.id] ??
          {},
      },
      {
        budget: budget2,
        expenses: [],
        totalsByCurrency: Expense.sumByBudgetAndCurrency([])[budget2.id] ?? {},
      },
    ];

    render(
      <ExpenseList
        expenseGroups={mockExpenseGroup}
        handleEditClick={jest.fn()}
      />,
    );

    expect(
      screen.getByTestId("budget-subheader-budget-id-001"),
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId("budget-subheader-budget-id-002"),
    ).not.toBeInTheDocument();
  });
  test("Klick auf Zeile ruft onEditClick() auf", async () => {
    const onEdit = jest.fn();

    const mockExpenseGroup: ExpenseGroup[] = [
      {
        budget: budget,
        expenses: [{...expense}, {...expenseChf, comment: ""}],
        totalsByCurrency:
          Expense.sumByBudgetAndCurrency([expense, expenseChf])[budget.id] ??
          {},
      },
    ];

    render(
      <ExpenseList expenseGroups={mockExpenseGroup} handleEditClick={onEdit} />,
    );

    fireEvent.click(screen.getByTestId("expense-expense-id-001"));

    expect(onEdit).toHaveBeenCalledWith("expense-id-001");
  });
});
