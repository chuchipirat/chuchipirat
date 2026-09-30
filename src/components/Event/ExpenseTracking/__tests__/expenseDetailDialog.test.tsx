import {fireEvent, render, screen, within} from "@testing-library/react";
import "@testing-library/jest-dom";
import {ExpenseDetailDialog} from "../expenseDetailDialog";
import {BudgetDomain} from "../budget.types";
import {budget, budget2} from "../__mocks__/budget.mock";
import {expense} from "../__mocks__/expense.mock";
import {
  PLEASE_PROVIDE_LABEL as TEXT_PLEASE_PROVIDE_LABEL,
  PLEASE_PROVIDE_AMOUNT as TEXT_PLEASE_PROVIDE_AMOUNT,
  PLEASE_PROVIDE_BUDGET as TEXT_PLEASE_PROVIDE_BUDGET,
  PLEASE_PROVIDE_DATE as TEXT_PLEASE_PROVIDE_DATE,
  PLEASE_PROVIDE_CURRENCY as TEXT_PLEASE_PROVIDE_CURRENCY,
  PLEASE_PROVIDE_LABEL,
  PLEASE_PROVIDE_PAYEE as TEXT_PLEASE_PROVIDE_PAYEE,
  PLEASE_PROVIDE_PAYEE_NAME as TEXT_PLEASE_PROVIDE_PAYEE_NAME,
} from "../../../../constants/text";
import dayjs from "dayjs";
import {Cook} from "../../Event/event.class";
import {cook1, cook2} from "../../Event/__mocks__/event.mock";

jest.mock("@mui/x-date-pickers", () => ({
  DatePicker: (props: any) => (
    <div>
      <input
        data-testid={`datepicker-${props.label}`}
        value={props.value?.isValid?.() ? props.value.format("YYYY-MM-DD") : ""}
        onChange={(event) => props.onChange?.(dayjs(event.target.value))}
      />
      {props.slotProps?.textField?.helperText}
    </div>
  ),
}));

const budgets: BudgetDomain[] = [{...budget}, {...budget2}];
const cooks: Cook[] = [cook1, cook2];

describe("Ausgabe Detail Test", () => {
  test("zeigt Validierungsfehler bei leerem Formular", () => {
    const onCreate = jest.fn();
    render(
      <ExpenseDetailDialog
        open
        expense={null}
        budgets={budgets}
        defaultBudgetId={null}
        cooks={cooks}
        onClose={jest.fn()}
        onCreate={onCreate}
        onEdit={jest.fn()}
        onDelete={jest.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("radio", {name: "Bestehende Person"}));
    fireEvent.click(screen.getByRole("button", {name: "Speichern"}));

    expect(screen.getByText(TEXT_PLEASE_PROVIDE_AMOUNT)).toBeInTheDocument();
    expect(screen.getByText(TEXT_PLEASE_PROVIDE_CURRENCY)).toBeInTheDocument();
    expect(screen.getByText(TEXT_PLEASE_PROVIDE_LABEL)).toBeInTheDocument();
    expect(screen.getByText(TEXT_PLEASE_PROVIDE_BUDGET)).toBeInTheDocument();
    expect(screen.getByText(TEXT_PLEASE_PROVIDE_PAYEE)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("radio", {name: "Neue Person erfassen"}));
    expect(
      screen.getByText(TEXT_PLEASE_PROVIDE_PAYEE_NAME),
    ).toBeInTheDocument();

    expect(onCreate).not.toHaveBeenCalled();
  });
  describe("Zeigt Validierungsfehler bei falschen Einträgen", () => {
    test("Validierungsfehler: Datum", () => {
      const onEdit = jest.fn();
      const mockExpense = {...expense};
      mockExpense.date = new Date(NaN);

      render(
        <ExpenseDetailDialog
          open
          expense={mockExpense}
          budgets={budgets}
          defaultBudgetId={null}
          cooks={cooks}
          onClose={jest.fn()}
          onCreate={jest.fn()}
          onEdit={onEdit}
          onDelete={jest.fn()}
        />,
      );
      fireEvent.click(screen.getByRole("button", {name: "Speichern"}));
      expect(screen.getByText(TEXT_PLEASE_PROVIDE_DATE)).toBeInTheDocument();
      expect(onEdit).not.toHaveBeenCalled();
    });
    test("Validierungsfehler: Betrag", () => {
      const onEdit = jest.fn();
      const mockExpense = {...expense};
      mockExpense.amountInCents = -100;

      render(
        <ExpenseDetailDialog
          open
          expense={mockExpense}
          budgets={budgets}
          defaultBudgetId={null}
          cooks={cooks}
          onClose={jest.fn()}
          onCreate={jest.fn()}
          onEdit={onEdit}
          onDelete={jest.fn()}
        />,
      );
      fireEvent.click(screen.getByRole("button", {name: "Speichern"}));
      expect(screen.getByText(TEXT_PLEASE_PROVIDE_AMOUNT)).toBeInTheDocument();
      expect(onEdit).not.toHaveBeenCalled();
    });
    test("Validierungsfehler: Bezeichnung", () => {
      const onEdit = jest.fn();
      const mockExpense = {...expense};
      mockExpense.label = "      ";

      render(
        <ExpenseDetailDialog
          open
          expense={mockExpense}
          budgets={budgets}
          defaultBudgetId={null}
          cooks={cooks}
          onClose={jest.fn()}
          onCreate={jest.fn()}
          onEdit={onEdit}
          onDelete={jest.fn()}
        />,
      );
      fireEvent.click(screen.getByRole("button", {name: "Speichern"}));
      expect(screen.getByText(PLEASE_PROVIDE_LABEL)).toBeInTheDocument();
      expect(onEdit).not.toHaveBeenCalled();
    });
  });
  test("ruft onCreate mit den eingegebenen Werten auf, wenn gültig", () => {
    const onCreate = jest.fn();
    render(
      <ExpenseDetailDialog
        open
        expense={null}
        budgets={budgets}
        defaultBudgetId={null}
        cooks={cooks}
        onClose={jest.fn()}
        onCreate={onCreate}
        onEdit={jest.fn()}
        onDelete={jest.fn()}
      />,
    );

    expect(screen.getByText("Neue Ausgabe")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", {name: "Löschen"}),
    ).not.toBeInTheDocument();
    expect(screen.getByLabelText("Bezeichnung")).toHaveValue("");

    // Werte eingeben
    fireEvent.change(screen.getByLabelText("Bezeichnung"), {
      target: {value: "Coop"},
    });
    fireEvent.change(screen.getByLabelText("Betrag"), {
      target: {value: "11.50"},
    });
    // Dropdown wählen
    fireEvent.mouseDown(screen.getByRole("combobox", {name: "Währung"}));
    fireEvent.click(screen.getByRole("option", {name: "EUR"}));

    fireEvent.mouseDown(screen.getByRole("combobox", {name: "Budget"}));
    fireEvent.click(screen.getByRole("option", {name: "Motto"}));

    fireEvent.click(screen.getByRole("button", {name: "Speichern"}));

    expect(onCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        label: "Coop",
        amount: "11.50",
        currency: "EUR",
        budgetId: "budget-id-002",
      }),
    );
  });
  test("Richtige Vorbelegung des Budgets", () => {
    render(
      <ExpenseDetailDialog
        open
        expense={null}
        budgets={budgets}
        defaultBudgetId={"budget-id-002"}
        cooks={cooks}
        onClose={jest.fn()}
        onCreate={jest.fn()}
        onEdit={jest.fn()}
        onDelete={jest.fn()}
      />,
    );

    expect(screen.getByText("Motto")).toBeInTheDocument();
  });
  test("Datum wird beim Bearbeiten mit dem Datum der Ausgabe vorbelegt", () => {
    const mockExpense = {...expense, date: new Date(2026, 9, 15)};
    render(
      <ExpenseDetailDialog
        open
        expense={mockExpense}
        budgets={budgets}
        defaultBudgetId={null}
        cooks={cooks}
        onClose={jest.fn()}
        onCreate={jest.fn()}
        onEdit={jest.fn()}
        onDelete={jest.fn()}
      />,
    );

    expect(screen.getByTestId("datepicker-Datum")).toHaveValue(
      dayjs(mockExpense.date).format("YYYY-MM-DD"),
    );
  });
  test("Datum wird beim Anlegen mit dem heutigen Datum vorbelegt", () => {
    render(
      <ExpenseDetailDialog
        open
        expense={null}
        budgets={budgets}
        defaultBudgetId={null}
        cooks={cooks}
        onClose={jest.fn()}
        onCreate={jest.fn()}
        onEdit={jest.fn()}
        onDelete={jest.fn()}
      />,
    );

    expect(screen.getByTestId("datepicker-Datum")).toHaveValue(
      dayjs().format("YYYY-MM-DD"),
    );
  });
  test("Kommentar ist optional", () => {
    const mockExpense = {...expense};
    mockExpense.comment = null;
    const onEdit = jest.fn();

    render(
      <ExpenseDetailDialog
        open
        expense={mockExpense}
        budgets={budgets}
        defaultBudgetId={"budget-id-002"}
        cooks={cooks}
        onClose={jest.fn()}
        onCreate={jest.fn()}
        onEdit={onEdit}
        onDelete={jest.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", {name: "Speichern"}));
    expect(onEdit).toHaveBeenCalled();
  });
  test("Leere Budget hat keinen Einfluss", () => {
    const mockExpense = {...expense};
    const onEdit = jest.fn();

    render(
      <ExpenseDetailDialog
        open
        expense={mockExpense}
        budgets={[]}
        defaultBudgetId={"budget-id-002"}
        cooks={cooks}
        onClose={jest.fn()}
        onCreate={jest.fn()}
        onEdit={onEdit}
        onDelete={jest.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", {name: "Speichern"}));
    expect(onEdit).toHaveBeenCalled();
  });
  test("Wechsel des Ausgabentyp, löscht vorherige Werte", () => {
    render(
      <ExpenseDetailDialog
        open
        expense={null}
        budgets={budgets}
        defaultBudgetId={null}
        cooks={cooks}
        onClose={jest.fn()}
        onCreate={jest.fn()}
        onEdit={jest.fn()}
        onDelete={jest.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("radio", {name: "Bestehende Person"}));

    // Werte eingeben
    fireEvent.mouseDown(screen.getByRole("combobox", {name: "Name"}));
    fireEvent.click(screen.getByRole("option", {name: "Fondueli Fritz"}));

    fireEvent.click(screen.getByRole("radio", {name: "Neue Person erfassen"}));
    expect(screen.getByLabelText("Name")).toHaveValue("");

    fireEvent.change(screen.getByLabelText("Name"), {
      target: {value: "Beispiel Benno"},
    });

    fireEvent.click(screen.getByRole("radio", {name: "Bestehende Person"}));
    expect(
      within(screen.getByRole("combobox", {name: "Name"})).queryByText(
        "Fondueli Fritz",
      ),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("radio", {name: "Neue Person erfassen"}));
    expect(screen.getByLabelText("Name")).toHaveValue("");
  });
});
describe("Mutationsprobe", () => {
  test("Nach Typ-Wechsel wird die alte Auswahl nicht mitgeschickt", () => {
    const onCreate = jest.fn();
    render(
      <ExpenseDetailDialog
        open
        expense={null}
        budgets={budgets}
        defaultBudgetId={null}
        cooks={cooks}
        onClose={jest.fn()}
        onCreate={onCreate}
        onEdit={jest.fn()}
        onDelete={jest.fn()}
      />,
    );

    // Erst bestehende Person wählen...
    fireEvent.click(screen.getByRole("radio", {name: "Bestehende Person"}));
    fireEvent.mouseDown(screen.getByRole("combobox", {name: "Name"}));
    fireEvent.click(screen.getByRole("option", {name: "Fondueli Fritz"}));

    // ...dann zu Neue Person wechseln und einen Namen eintippen
    fireEvent.click(screen.getByRole("radio", {name: "Neue Person erfassen"}));
    fireEvent.change(screen.getByLabelText("Name"), {
      target: {value: "Beispiel Benno"},
    });

    fireEvent.change(screen.getByLabelText("Bezeichnung"), {
      target: {value: "Sackmesser"},
    });
    fireEvent.change(screen.getByLabelText("Betrag"), {
      target: {value: "12.00"},
    });
    fireEvent.mouseDown(screen.getByRole("combobox", {name: "Währung"}));
    fireEvent.click(screen.getByRole("option", {name: "CHF"}));
    fireEvent.mouseDown(screen.getByRole("combobox", {name: "Budget"}));
    fireEvent.click(screen.getByRole("option", {name: "Küche"}));

    fireEvent.click(screen.getByRole("button", {name: "Speichern"}));

    expect(onCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        payeeType: "new_person",
        payeeUserId: null, // die frühere Auswahl (cook2) darf hier nicht mehr stehen
        payeeName: "Beispiel Benno",
      }),
    );
  });
});
