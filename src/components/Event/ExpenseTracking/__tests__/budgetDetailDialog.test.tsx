import {fireEvent, render, screen} from "@testing-library/react";
import "@testing-library/jest-dom";

import {budget as mockBudget} from "../__mocks__/budget.mock";
import {
  PLEASE_PROVIDE_AMOUNT as TEXT_PLEASE_PROVIDE_AMOUNT,
  PLEASE_PROVIDE_ICON as TEXT_PLEASE_PROVIDE_ICON,
  PLEASE_PROVIDE_NAME as TEXT_PLEASE_PROVIDE_NAME,
} from "../../../../constants/text/expenseTracking";
import {BudgetDetailDialog} from "../budgetDetailDialog";
import {BudgetIcon} from "../budget.types";

describe("Budget Details Tests", () => {
  test("zeigt Validierungsfehler bei leerem Formular", () => {
    const onCreate = jest.fn();
    render(
      <BudgetDetailDialog
        open
        onClose={jest.fn()}
        onCreate={onCreate}
        onEdit={jest.fn()}
        onDelete={jest.fn()}
        budget={null}
      />,
    );

    fireEvent.click(screen.getByRole("button", {name: "Speichern"}));

    // TEXT_SAVE
    expect(screen.getByText(TEXT_PLEASE_PROVIDE_NAME)).toBeInTheDocument();
    expect(screen.getByText(TEXT_PLEASE_PROVIDE_AMOUNT)).toBeInTheDocument();
    expect(screen.getByText(TEXT_PLEASE_PROVIDE_ICON)).toBeInTheDocument();
    expect(onCreate).not.toHaveBeenCalled();
  });

  test("ruft onCreate mit den eingegebenen Werten auf, wenn gültig", () => {
    const onCreate = jest.fn();
    render(
      <BudgetDetailDialog
        open
        onClose={jest.fn()}
        onCreate={onCreate}
        onEdit={jest.fn()}
        onDelete={jest.fn()}
        budget={null}
      />,
    );

    expect(screen.getByText("Neues Budget")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", {name: "Löschen"}),
    ).not.toBeInTheDocument();
    expect(screen.getByLabelText("Name")).toHaveValue("");

    fireEvent.change(screen.getByLabelText("Name"), {
      target: {value: "Transport"},
    });
    fireEvent.change(screen.getByLabelText("Betrag"), {target: {value: "150"}});
    fireEvent.click(screen.getByLabelText("transport")); // icon aria-label = iconOption value
    fireEvent.click(screen.getByRole("button", {name: "Speichern"}));

    expect(onCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Transport",
        amount: "150",
        icon: "transport",
      }),
    );
  });
  test("Ruft den Dialog im Änderungsmodus", () => {
    const onCreate = jest.fn();
    const onEdit = jest.fn();

    render(
      <BudgetDetailDialog
        open
        onClose={jest.fn()}
        onCreate={onCreate}
        onEdit={onEdit}
        onDelete={jest.fn()}
        budget={mockBudget}
      />,
    );

    expect(screen.getByText("Budget")).toBeInTheDocument();

    // Text input: name
    expect(screen.getByLabelText("Name")).toHaveValue("Küche");

    // Text input: amount (1000 cents → toFixed(2))
    expect(screen.getByLabelText("Betrag")).toHaveValue("10.00");

    // Radio button: budget type
    expect(screen.getByLabelText("Fixbetrag")).toBeChecked();
    expect(screen.getByLabelText("Pro Person & Tag")).not.toBeChecked();

    // Icon picker: selected icon vs. another one
    expect(screen.getByLabelText("kitchen")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByLabelText("transport")).toHaveAttribute(
      "aria-pressed",
      "false",
    );

    // Currency select (MUI renders a combobox, so check its shown text)
    expect(screen.getByRole("combobox", {name: /Währung/})).toHaveTextContent(
      "CHF",
    );

    expect(screen.queryByRole("button", {name: "Löschen"})).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Name"), {
      target: {value: "Motto"},
    });
    fireEvent.click(screen.getByRole("button", {name: "Speichern"}));

    expect(onCreate).not.toHaveBeenCalled();
    expect(onEdit).toHaveBeenCalledWith(
      "budget-id-001",
      expect.objectContaining({
        name: "Motto",
        currency: "CHF",
        amount: "10.00",
        icon: BudgetIcon.KITCHEN,
      }),
    );
  });
  test("Ruft den Dialog um Eintrag zu löschen", () => {
    const onCreate = jest.fn();
    const onEdit = jest.fn();
    const onDelete = jest.fn();

    render(
      <BudgetDetailDialog
        open
        onClose={jest.fn()}
        onCreate={onCreate}
        onEdit={onEdit}
        onDelete={onDelete}
        budget={mockBudget}
      />,
    );
    fireEvent.click(screen.getByRole("button", {name: "Löschen"}));

    expect(onCreate).not.toHaveBeenCalled();
    expect(onEdit).not.toHaveBeenCalled();
    expect(onDelete).toHaveBeenCalledWith(expect.objectContaining(mockBudget));
  });
});
