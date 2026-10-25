/**
 * Unit-Tests für den Dialog «Abrechnung erstellen»
 * (expenseReportDialog.tsx, Story 7.2; Schalter für Leerseiten und
 * Fortschritt seit Story 7.3a).
 *
 * Fixture: Anna (3 Ausgaben) steht alphabetisch vor Ben (1 Ausgabe),
 * angemeldet ist aber Ben. So fällt auf, wenn die Vorauswahl die
 * angemeldete Person ignoriert und einfach die erste nimmt.
 */
import React from "react";
import {act, fireEvent, render, screen, within} from "@testing-library/react";
import "@testing-library/jest-dom";

import {Cook} from "../../../Event/event.class";
import {ExpenseDomain, ExpensePayeeType} from "../../Expense/expense.types";
import {
  ReportMode,
  ReportOptions,
  ReportProgress,
} from "../expenseReport.types";
import {ExpenseReportDialog} from "../expenseReportDialog";

/* =====================================================================
// Fixture
// ===================================================================== */

const ANNA: Cook = {
  uid: "user-anna",
  displayName: "Anna",
  motto: "",
  pictureSrc: "",
};
const BEN: Cook = {
  uid: "user-ben",
  displayName: "Ben",
  motto: "",
  pictureSrc: "",
};
const COOKS: Cook[] = [ANNA, BEN];

/**
 * Erstellt eine Ausgabe von Anna mit Standardwerten.
 *
 * @param overrides - Felder, die vom Standard abweichen.
 * @returns Die Ausgabe.
 */
const makeExpense = (overrides: Partial<ExpenseDomain>): ExpenseDomain => ({
  id: "expense-id",
  eventId: "event-id-001",
  budgetId: "budget-kitchen",
  date: new Date(2026, 6, 10),
  amountInCents: 1000,
  currency: "CHF",
  label: "Einkauf",
  comment: null,
  payeeType: ExpensePayeeType.EXISTING_USER,
  payeeUserId: ANNA.uid,
  payeeName: null,
  attachmentPath: null,
  attachmentOriginalFilename: null,
  ...overrides,
});

const ANNA_EXPENSES = [
  makeExpense({id: "anna-1"}),
  makeExpense({id: "anna-2"}),
  makeExpense({id: "anna-3"}),
];
const BEN_EXPENSE = makeExpense({id: "ben-1", payeeUserId: BEN.uid});
const NO_REFUND_EXPENSE = makeExpense({
  id: "no-refund-1",
  payeeType: ExpensePayeeType.NO_REFUND_NEEDED,
  payeeUserId: null,
});
/** Neue Person, deren Name mit dem Wert von «Alle Personen» kollidieren könnte (P9). */
const PERSON_NAMED_ALL_EXPENSE = makeExpense({
  id: "all-1",
  payeeType: ExpensePayeeType.NEW_PERSON,
  payeeUserId: null,
  payeeName: "all",
});

const EXPENSES: ExpenseDomain[] = [
  BEN_EXPENSE,
  ...ANNA_EXPENSES,
  NO_REFUND_EXPENSE,
];

/**
 * Props des Dialogs mit Standardwerten: offen, angemeldet ist Ben.
 *
 * @param overrides - Props, die vom Standard abweichen.
 * @returns Die Props.
 */
const makeProps = (
  overrides: Partial<React.ComponentProps<typeof ExpenseReportDialog>> = {},
): React.ComponentProps<typeof ExpenseReportDialog> => ({
  open: true,
  expenses: EXPENSES,
  cooks: COOKS,
  authUserId: BEN.uid,
  onCreate: jest.fn().mockResolvedValue(undefined),
  onClose: jest.fn(),
  ...overrides,
});

/** Auswahlfeld «Für wen?». */
const getPayeeSelect = () => screen.getByRole("combobox", {name: "Für wen?"});

/**
 * Öffnet das Auswahlfeld und wählt einen Eintrag.
 *
 * @param optionName - Sichtbarer Text des Eintrags.
 */
const selectPayee = (optionName: string) => {
  fireEvent.mouseDown(getPayeeSelect());
  fireEvent.click(
    within(screen.getByRole("listbox")).getByRole("option", {name: optionName}),
  );
};

/**
 * Klickt «Erstellen» und wartet, bis `onCreate` erfüllt ist.
 *
 * @param onCreate - Mock aus den Props.
 * @returns Die übergebenen Optionen.
 */
const createAndGetOptions = async (
  onCreate: jest.Mock,
): Promise<ReportOptions> => {
  await act(async () => {
    fireEvent.click(screen.getByRole("button", {name: "Erstellen"}));
  });
  expect(onCreate).toHaveBeenCalledTimes(1);
  return onCreate.mock.calls[0][0];
};

/** Schalter «Leerseiten für fehlende Belege einfügen». */
const queryMissingReceiptPagesSwitch = () =>
  screen.queryByRole("switch", {
    name: /^Leerseiten für fehlende Belege einfügen/,
  });

/* =====================================================================
// Tests
// ===================================================================== */

describe("ExpenseReportDialog: Vorauswahl", () => {
  test("angemeldete Person, auch wenn sie nicht zuerst steht", () => {
    render(<ExpenseReportDialog {...makeProps()} />);

    expect(getPayeeSelect()).toHaveTextContent("Ben (1 Ausgabe)");
  });

  test("ohne eigene Ausgaben: erste Person", () => {
    render(<ExpenseReportDialog {...makeProps({authUserId: "user-zoe"})} />);

    expect(getPayeeSelect()).toHaveTextContent("Anna (3 Ausgaben)");
  });

  test("nur «Ohne Rückerstattung»: «Alle Personen»", () => {
    render(
      <ExpenseReportDialog {...makeProps({expenses: [NO_REFUND_EXPENSE]})} />,
    );

    expect(getPayeeSelect()).toHaveTextContent("Alle Personen");
  });

  test("Standard: «Eine Tabelle», Kommentare aus", () => {
    render(<ExpenseReportDialog {...makeProps()} />);

    expect(screen.getByRole("radio", {name: /^Eine Tabelle/})).toBeChecked();
    expect(screen.getByRole("radio", {name: /^Pro Budget/})).not.toBeChecked();
    expect(
      screen.getByRole("switch", {name: "Kommentare anzeigen"}),
    ).not.toBeChecked();
  });
});

describe("ExpenseReportDialog: Auswahl", () => {
  test("Einträge mit Anzahl, ohne «Ohne Rückerstattung», «Alle Personen» zuletzt", () => {
    render(<ExpenseReportDialog {...makeProps()} />);

    fireEvent.mouseDown(getPayeeSelect());
    const optionNames = within(screen.getByRole("listbox"))
      .getAllByRole("option")
      .map((option) => option.textContent);
    expect(optionNames).toEqual([
      "Anna (3 Ausgaben)",
      "Ben (1 Ausgabe)",
      "Alle Personen",
    ]);
  });

  test("«Erstellen» übergibt die gewählten Optionen", async () => {
    const onCreate = jest.fn().mockResolvedValue(undefined);
    render(<ExpenseReportDialog {...makeProps({onCreate})} />);

    selectPayee("Anna (3 Ausgaben)");
    fireEvent.click(screen.getByRole("radio", {name: /^Pro Budget/}));
    fireEvent.click(screen.getByRole("switch", {name: "Kommentare anzeigen"}));

    expect(await createAndGetOptions(onCreate)).toEqual({
      mode: ReportMode.PER_PERSON_AND_BUDGET,
      payeeSelection: {kind: "single", payeeKey: ANNA.uid},
      includeComments: true,
      includeMissingReceiptPages: true,
    });
  });

  test("«Alle Personen» übergibt kind «all»", async () => {
    const onCreate = jest.fn().mockResolvedValue(undefined);
    render(<ExpenseReportDialog {...makeProps({onCreate})} />);

    selectPayee("Alle Personen");

    expect((await createAndGetOptions(onCreate)).payeeSelection).toEqual({
      kind: "all",
    });
  });

  test("neue Person namens «all» ist eine Person, nicht «Alle Personen» (P9)", async () => {
    const onCreate = jest.fn().mockResolvedValue(undefined);
    render(
      <ExpenseReportDialog
        {...makeProps({
          onCreate,
          expenses: [...EXPENSES, PERSON_NAMED_ALL_EXPENSE],
        })}
      />,
    );

    selectPayee("all (1 Ausgabe)");

    expect(getPayeeSelect()).toHaveTextContent("all (1 Ausgabe)");
    expect((await createAndGetOptions(onCreate)).payeeSelection).toEqual({
      kind: "single",
      payeeKey: "all",
    });
  });

  test("gewählte Person verschwindet per Realtime: zurück zur Vorauswahl (P10)", async () => {
    const onCreate = jest.fn().mockResolvedValue(undefined);
    const {rerender} = render(
      <ExpenseReportDialog {...makeProps({onCreate})} />,
    );
    selectPayee("Anna (3 Ausgaben)");

    rerender(
      <ExpenseReportDialog
        {...makeProps({
          onCreate,
          expenses: [BEN_EXPENSE, NO_REFUND_EXPENSE],
        })}
      />,
    );

    expect(getPayeeSelect()).toHaveTextContent("Ben (1 Ausgabe)");
    expect((await createAndGetOptions(onCreate)).payeeSelection).toEqual({
      kind: "single",
      payeeKey: BEN.uid,
    });
  });
});

describe("ExpenseReportDialog: Erstellen und Abbrechen", () => {
  test("während des Erstellens: Knöpfe deaktiviert, Fortschritt sichtbar", async () => {
    let finishCreate: () => void = () => {};
    const onCreate = jest.fn(
      () =>
        new Promise<void>((resolve) => {
          finishCreate = resolve;
        }),
    );
    render(<ExpenseReportDialog {...makeProps({onCreate})} />);

    fireEvent.click(screen.getByRole("button", {name: "Erstellen"}));

    expect(screen.getByRole("button", {name: "Erstellen"})).toBeDisabled();
    expect(screen.getByRole("button", {name: "Abbrechen"})).toBeDisabled();
    expect(screen.getByRole("progressbar")).toBeInTheDocument();

    await act(async () => {
      finishCreate();
    });

    expect(screen.getByRole("button", {name: "Erstellen"})).toBeEnabled();
    expect(screen.getByRole("button", {name: "Abbrechen"})).toBeEnabled();
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  });

  test("«Abbrechen» ruft onClose", () => {
    const onClose = jest.fn();
    render(<ExpenseReportDialog {...makeProps({onClose})} />);

    fireEvent.click(screen.getByRole("button", {name: "Abbrechen"}));

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe("ExpenseReportDialog: Leerseiten für fehlende Belege", () => {
  /** Bens Ausgabe mit Beleg: Ben hat keine fehlenden Belege. */
  const BEN_EXPENSE_WITH_RECEIPT = {
    ...BEN_EXPENSE,
    attachmentPath: "event-id-001/expenses/ben-1.jpg",
  };

  test("mit Ausgaben ohne Beleg: Schalter mit Anzahl, Standard an", () => {
    render(<ExpenseReportDialog {...makeProps()} />);

    expect(queryMissingReceiptPagesSwitch()).toBeChecked();
    expect(
      screen.getByText(
        "1 Ausgabe ohne Beleg, zum Aufkleben von Papierquittungen",
      ),
    ).toBeInTheDocument();
  });

  test("Anzahl folgt der Auswahl, ohne fehlende Belege kein Schalter", () => {
    render(
      <ExpenseReportDialog
        {...makeProps({
          expenses: [BEN_EXPENSE_WITH_RECEIPT, ...ANNA_EXPENSES],
        })}
      />,
    );

    expect(queryMissingReceiptPagesSwitch()).not.toBeInTheDocument();

    selectPayee("Anna (3 Ausgaben)");

    expect(queryMissingReceiptPagesSwitch()).toBeInTheDocument();
    expect(
      screen.getByText(
        "3 Ausgaben ohne Beleg, zum Aufkleben von Papierquittungen",
      ),
    ).toBeInTheDocument();
  });

  test("ausgeschaltet: onCreate bekommt includeMissingReceiptPages false", async () => {
    const onCreate = jest.fn().mockResolvedValue(undefined);
    render(<ExpenseReportDialog {...makeProps({onCreate})} />);

    fireEvent.click(queryMissingReceiptPagesSwitch()!);

    expect(
      (await createAndGetOptions(onCreate)).includeMissingReceiptPages,
    ).toBe(false);
  });
});

describe("ExpenseReportDialog: Fortschritt", () => {
  test("zeigt, was onCreate meldet, und verschwindet danach", async () => {
    let reportProgress: (progress: ReportProgress) => void = () => {};
    let finishCreate: () => void = () => {};
    const onCreate = jest.fn(
      (
        _options: ReportOptions,
        onProgress: (progress: ReportProgress) => void,
      ) =>
        new Promise<void>((resolve) => {
          reportProgress = onProgress;
          finishCreate = resolve;
        }),
    );
    render(<ExpenseReportDialog {...makeProps({onCreate})} />);
    fireEvent.click(screen.getByRole("button", {name: "Erstellen"}));

    act(() => reportProgress({stage: "loading", loaded: 7, total: 23}));
    expect(screen.getByRole("status")).toHaveTextContent(
      "Belege werden geladen (7 von 23)",
    );

    act(() => reportProgress({stage: "rendering"}));
    expect(screen.getByRole("status")).toHaveTextContent(
      "PDF wird erstellt …",
    );

    await act(async () => {
      finishCreate();
    });
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});
