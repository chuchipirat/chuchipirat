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
  DROP_ATTACHMENT_HINT as TEXT_DROP_ATTACHMENT_HINT,
  ATTACHMENT_INVALID_TYPE as TEXT_ATTACHMENT_INVALID_TYPE,
  ATTACHMENT_TOO_LARGE as TEXT_ATTACHMENT_TOO_LARGE,
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

/* =====================================================================
// Ausgaben-Beleg
// ===================================================================== */
describe("Ausgaben-Beleg", () => {
  /**
   * Baut eine Testdatei. `size` überschreibt die tatsächliche Länge (für den
   * "zu gross"-Test, ohne ein echtes 10-MB-Array anlegen zu müssen).
   *
   * @param name - Dateiname.
   * @param type - MIME-Typ.
   * @param size - Optionale Grösse in Bytes.
   * @returns Die Testdatei.
   */
  const makeFile = (name: string, type: string, size?: number): File => {
    const file = new File(["Testinhalt"], name, {type});
    if (size != null) {
      Object.defineProperty(file, "size", {value: size});
    }
    return file;
  };

  /**
   * Wählt eine Datei über das versteckte `<input type="file">` aus. Der
   * MUI-`Dialog` rendert per Portal in `document.body`, nicht in den
   * `container` von `render()` — deshalb wird über `document` gesucht.
   *
   * @param file - Die auszuwählende Datei.
   */
  const selectFile = (file: File) => {
    const input = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement;
    fireEvent.change(input, {target: {files: [file]}});
  };

  /** Findet die Dropzone (das `<label>`, das das Datei-Input umschliesst). */
  const getDropzone = () =>
    document.querySelector('input[type="file"]')!.closest("label")!;

  test("zeigt die Dropzone, wenn (noch) kein Beleg vorhanden ist", () => {
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

    expect(screen.getByText(TEXT_DROP_ATTACHMENT_HINT)).toBeInTheDocument();
  });

  test("zeigt einen bestehenden Beleg direkt als Dateiname statt der Dropzone", () => {
    const mockExpense = {
      ...expense,
      attachmentPath: "evt-1/expenses/expense-id-001.pdf",
      attachmentOriginalFilename: "quittung.pdf",
    };
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

    expect(screen.getByText("quittung.pdf")).toBeInTheDocument();
    expect(
      screen.queryByText(TEXT_DROP_ATTACHMENT_HINT),
    ).not.toBeInTheDocument();
  });

  test("Dateiauswahl über das Dateidialog-Input zeigt den Dateinamen an", () => {
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

    selectFile(makeFile("beleg.pdf", "application/pdf"));

    expect(screen.getByText("beleg.pdf")).toBeInTheDocument();
    expect(
      screen.queryByText(TEXT_DROP_ATTACHMENT_HINT),
    ).not.toBeInTheDocument();
  });

  test("Drag & Drop einer Datei auf die Dropzone übernimmt sie wie die Dateiauswahl", () => {
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

    const dropzone = getDropzone();
    const file = makeFile("beleg.jpg", "image/jpeg");

    fireEvent.dragOver(dropzone, {dataTransfer: {files: [file]}});
    fireEvent.drop(dropzone, {dataTransfer: {files: [file]}});

    expect(screen.getByText("beleg.jpg")).toBeInTheDocument();
  });

  test("lehnt einen nicht erlaubten Dateityp ab und zeigt den Fehlertext", () => {
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

    selectFile(makeFile("notizen.txt", "text/plain"));

    expect(screen.getByText(TEXT_ATTACHMENT_INVALID_TYPE)).toBeInTheDocument();
    // Dropzone bleibt stehen — die Datei wurde nicht übernommen
    expect(screen.getByText(TEXT_DROP_ATTACHMENT_HINT)).toBeInTheDocument();
    expect(screen.queryByText("notizen.txt")).not.toBeInTheDocument();
  });

  test("lehnt eine zu grosse Datei ab und zeigt den Fehlertext", () => {
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

    selectFile(
      makeFile("grosse-datei.pdf", "application/pdf", 11 * 1024 * 1024),
    );

    expect(screen.getByText(TEXT_ATTACHMENT_TOO_LARGE)).toBeInTheDocument();
    expect(screen.getByText(TEXT_DROP_ATTACHMENT_HINT)).toBeInTheDocument();
    expect(screen.queryByText("grosse-datei.pdf")).not.toBeInTheDocument();
  });

  test("eine gültige Datei nach einem abgelehnten Versuch löscht den Fehlertext", () => {
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

    selectFile(makeFile("notizen.txt", "text/plain"));
    expect(screen.getByText(TEXT_ATTACHMENT_INVALID_TYPE)).toBeInTheDocument();

    selectFile(makeFile("beleg.pdf", "application/pdf"));
    expect(
      screen.queryByText(TEXT_ATTACHMENT_INVALID_TYPE),
    ).not.toBeInTheDocument();
    expect(screen.getByText("beleg.pdf")).toBeInTheDocument();
  });

  test("Löschen-Icon markiert den Beleg zum Entfernen, die Dropzone erscheint wieder", () => {
    const mockExpense = {
      ...expense,
      attachmentPath: "evt-1/expenses/expense-id-001.pdf",
      attachmentOriginalFilename: "quittung.pdf",
    };
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

    fireEvent.click(screen.getByRole("button", {name: "Beleg löschen"}));

    expect(screen.queryByText("quittung.pdf")).not.toBeInTheDocument();
    expect(screen.getByText(TEXT_DROP_ATTACHMENT_HINT)).toBeInTheDocument();
  });

  test("Speichern nach dem Markieren zum Entfernen sendet removeAttachment:true, ohne attachmentFile", () => {
    const onEdit = jest.fn();
    const mockExpense = {
      ...expense,
      attachmentPath: "evt-1/expenses/expense-id-001.pdf",
      attachmentOriginalFilename: "quittung.pdf",
    };
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

    fireEvent.click(screen.getByRole("button", {name: "Beleg löschen"}));
    fireEvent.click(screen.getByRole("button", {name: "Speichern"}));

    expect(onEdit).toHaveBeenCalledWith(
      mockExpense.id,
      expect.objectContaining({removeAttachment: true, attachmentFile: null}),
    );
  });

  test("eine neue Datei nach dem Markieren zum Entfernen hebt die Markierung wieder auf", () => {
    const onEdit = jest.fn();
    const mockExpense = {
      ...expense,
      attachmentPath: "evt-1/expenses/expense-id-001.pdf",
      attachmentOriginalFilename: "quittung.pdf",
    };
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

    fireEvent.click(screen.getByRole("button", {name: "Beleg löschen"}));
    selectFile(makeFile("neu.pdf", "application/pdf"));

    // Die Markierung ist aufgehoben: Dateiname (der neuen Datei) statt Dropzone
    expect(screen.getByText("neu.pdf")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", {name: "Speichern"}));

    expect(onEdit).toHaveBeenCalledWith(
      mockExpense.id,
      expect.objectContaining({
        removeAttachment: false,
        attachmentFile: expect.objectContaining({name: "neu.pdf"}),
      }),
    );
  });

  test("Speichern einer neuen Ausgabe mit ausgewähltem Beleg sendet die Datei mit", () => {
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

    fireEvent.change(screen.getByLabelText("Bezeichnung"), {
      target: {value: "Coop"},
    });
    fireEvent.change(screen.getByLabelText("Betrag"), {
      target: {value: "11.50"},
    });
    fireEvent.mouseDown(screen.getByRole("combobox", {name: "Währung"}));
    fireEvent.click(screen.getByRole("option", {name: "CHF"}));
    fireEvent.mouseDown(screen.getByRole("combobox", {name: "Budget"}));
    fireEvent.click(screen.getByRole("option", {name: "Motto"}));

    selectFile(makeFile("beleg.pdf", "application/pdf"));
    fireEvent.click(screen.getByRole("button", {name: "Speichern"}));

    expect(onCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        attachmentFile: expect.objectContaining({name: "beleg.pdf"}),
      }),
    );
  });
});
