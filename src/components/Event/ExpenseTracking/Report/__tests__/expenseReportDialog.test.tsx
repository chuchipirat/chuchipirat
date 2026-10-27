/**
 * Unit-Tests für den Dialog «Abrechnung erstellen»
 * (expenseReportDialog.tsx, Story 7.2; Schalter für Leerseiten und
 * Fortschritt seit Story 7.3a; «Rückerstattung an» seit Story 7.4).
 *
 * Fixture: Anna (3 Ausgaben) steht alphabetisch vor Ben (1 Ausgabe),
 * angemeldet ist aber Ben. So fällt auf, wenn die Vorauswahl die
 * angemeldete Person ignoriert und einfach die erste nimmt.
 */
import React from "react";
import {act, fireEvent, render, screen, within} from "@testing-library/react";
import "@testing-library/jest-dom";

import {UserPaymentDetailsDomain} from "../../../../User/userPaymentDetails.types";
import {Cook} from "../../../Event/event.class";
import {ExpenseDomain, ExpensePayeeType} from "../../Expense/expense.types";
import {
  ReportMode,
  ReportOptions,
  ReportProgress,
  ReportRefund,
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
  // nichts hinterlegt: Formular sofort da, «Erstellen» nicht gesperrt
  ownPaymentDetails: null,
  ownAccountHolderName: "Ben Beispiel",
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
        _refund: ReportRefund | null,
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

/* =====================================================================
// Rückerstattung an (Story 7.4)
// ===================================================================== */

describe("ExpenseReportDialog: Rückerstattung an", () => {
  /** Bens Angaben im Profil. */
  const OWN_DETAILS = {
    street: "Bahnhofstrasse 1",
    postalCode: "8001",
    city: "Zürich",
    iban: "CH9300762011623852957",
  };
  /** So liefert die Seite das Profil: mit `userId`. */
  const PROFILE_DETAILS: UserPaymentDetailsDomain = {
    ...OWN_DETAILS,
    userId: BEN.uid,
  };
  const EMPTY_DETAILS = {street: "", postalCode: "", city: "", iban: ""};
  const SAVE_LABEL = "Angaben in meinem Profil speichern";

  /**
   * Feld des Formulars «Rückerstattung an».
   *
   * @param label - Beschriftung, z.B. «Strasse».
   * @returns Das Eingabefeld.
   */
  const getField = (label: string) => screen.getByLabelText(label);

  /**
   * Tippt einen Wert in ein Feld.
   *
   * @param label - Beschriftung des Felds.
   * @param value - Neuer Wert.
   */
  const typeInto = (label: string, value: string) =>
    fireEvent.change(getField(label), {target: {value}});

  /** Füllt alle vier Felder vollständig und gültig aus. */
  const fillAllFields = () => {
    typeInto("Strasse", " Bahnhofstrasse 1 ");
    typeInto("Postleitzahl", "8001");
    typeInto("Ort", "Zürich");
    typeInto("IBAN", "ch93 0076 2011 6238 5295 7");
  };

  /**
   * Klickt «Erstellen» und liefert, was `onCreate` als `refund` bekam.
   *
   * @param onCreate - Mock aus den Props.
   * @returns Die übergebene Rückerstattung.
   */
  const createAndGetRefund = async (
    onCreate: jest.Mock,
  ): Promise<ReportRefund | null> => {
    await createAndGetOptions(onCreate);
    return onCreate.mock.calls[0][1];
  };

  const queryRefundHeading = () => screen.queryByText("Rückerstattung an");
  const querySaveCheckbox = () =>
    screen.queryByRole("checkbox", {name: SAVE_LABEL});

  test("«Alle Personen» ohne eigene Ausgaben: kein Abschnitt, refund null", async () => {
    const onCreate = jest.fn().mockResolvedValue(undefined);
    render(
      <ExpenseReportDialog
        {...makeProps({onCreate, authUserId: "user-zoe"})}
      />,
    );
    expect(queryRefundHeading()).toBeInTheDocument();

    selectPayee("Alle Personen");

    expect(queryRefundHeading()).not.toBeInTheDocument();
    expect(await createAndGetRefund(onCreate)).toBeNull();
  });

  test("«Alle Personen» mit eigenen Ausgaben: Formular für die eigene Person mit Hinweis", () => {
    render(
      <ExpenseReportDialog {...makeProps({ownPaymentDetails: OWN_DETAILS})} />,
    );

    selectPayee("Alle Personen");

    expect(
      screen.getByText("Kontoinhaber*in: Ben Beispiel"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Gilt für deinen Teil der Abrechnung. Bei den anderen Personen erscheinen Linien zum Ausfüllen.",
      ),
    ).toBeInTheDocument();
    expect(getField("Strasse")).toHaveValue("Bahnhofstrasse 1");
  });

  test("«Alle Personen»: eigene Angaben ändern und speichern", async () => {
    const onCreate = jest.fn().mockResolvedValue(undefined);
    render(<ExpenseReportDialog {...makeProps({onCreate})} />);
    selectPayee("Alle Personen");
    fillAllFields();

    fireEvent.click(querySaveCheckbox()!);

    expect(await createAndGetRefund(onCreate)).toEqual({
      details: OWN_DETAILS,
      shouldSave: true,
    });
  });

  test("Eingaben bei Ben bleiben beim Wechsel auf «Alle Personen» (gleiche Person)", () => {
    render(<ExpenseReportDialog {...makeProps()} />);
    typeInto("Strasse", "Dorfweg 3");

    selectPayee("Alle Personen");

    expect(getField("Strasse")).toHaveValue("Dorfweg 3");
  });

  test("einzelne Person: kein Hinweis zu den anderen Personen", () => {
    render(<ExpenseReportDialog {...makeProps()} />);

    expect(
      screen.queryByText(/Bei den anderen Personen erscheinen Linien/),
    ).not.toBeInTheDocument();
  });

  test("«Alle Personen» mit Profil: refund mit den eigenen Angaben, ohne Speichern", async () => {
    const onCreate = jest.fn().mockResolvedValue(undefined);
    render(
      <ExpenseReportDialog
        {...makeProps({onCreate, ownPaymentDetails: PROFILE_DETAILS})}
      />,
    );

    selectPayee("Alle Personen");

    // ohne userId: nur die vier Felder reisen ins PDF
    expect(await createAndGetRefund(onCreate)).toEqual({
      details: OWN_DETAILS,
      shouldSave: false,
    });
  });

  test("«Alle Personen», eigene Angaben laden noch: «Erstellen» gesperrt", () => {
    render(
      <ExpenseReportDialog {...makeProps({ownPaymentDetails: undefined})} />,
    );

    selectPayee("Alle Personen");

    expect(screen.getByRole("button", {name: "Erstellen"})).toBeDisabled();
  });

  test("eigene Person: Name aus dem Profil, Felder aus ownPaymentDetails", () => {
    render(
      <ExpenseReportDialog
        {...makeProps({ownPaymentDetails: PROFILE_DETAILS})}
      />,
    );

    expect(
      screen.getByText("Kontoinhaber*in: Ben Beispiel"),
    ).toBeInTheDocument();
    expect(getField("Strasse")).toHaveValue("Bahnhofstrasse 1");
    expect(getField("IBAN")).toHaveValue("CH9300762011623852957");
  });

  test("kein Autofokus im Formular (Handy-Tastatur)", () => {
    render(<ExpenseReportDialog {...makeProps()} />);

    expect(getField("Strasse")).not.toHaveFocus();
  });

  test("eigene Angaben laden noch: Ladehinweis statt Formular, «Erstellen» gesperrt", () => {
    render(
      <ExpenseReportDialog {...makeProps({ownPaymentDetails: undefined})} />,
    );

    expect(
      screen.getByText("Zahlungsangaben werden geladen …"),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText("Strasse")).not.toBeInTheDocument();
    expect(screen.getByRole("button", {name: "Erstellen"})).toBeDisabled();
  });

  test("Angaben treffen nach dem Öffnen ein: Formular vorausgefüllt", () => {
    const {rerender} = render(
      <ExpenseReportDialog {...makeProps({ownPaymentDetails: undefined})} />,
    );

    rerender(
      <ExpenseReportDialog {...makeProps({ownPaymentDetails: OWN_DETAILS})} />,
    );

    expect(getField("Strasse")).toHaveValue("Bahnhofstrasse 1");
    expect(screen.getByRole("button", {name: "Erstellen"})).toBeEnabled();
  });

  test("andere Person: Anzeigename, leere Felder, keine Checkbox", () => {
    render(
      <ExpenseReportDialog {...makeProps({ownPaymentDetails: OWN_DETAILS})} />,
    );

    selectPayee("Anna (3 Ausgaben)");

    expect(screen.getByText("Kontoinhaber*in: Anna")).toBeInTheDocument();
    expect(getField("Strasse")).toHaveValue("");
    expect(getField("IBAN")).toHaveValue("");
    // fremde Bankdaten werden nie gespeichert, auch vollständige nicht
    // (andere Werte als Bens Profil, sonst gälten sie als «unverändert»)
    fillAllFields();
    typeInto("Strasse", "Dorfweg 3");
    expect(querySaveCheckbox()).not.toBeInTheDocument();
  });

  test("Wechsel Anna → Ben → Anna: Annas Eingaben bleiben (F3)", () => {
    render(<ExpenseReportDialog {...makeProps()} />);
    selectPayee("Anna (3 Ausgaben)");
    typeInto("Strasse", "Dorfweg 3");

    selectPayee("Ben (1 Ausgabe)");
    expect(getField("Strasse")).toHaveValue("");
    selectPayee("Anna (3 Ausgaben)");

    expect(getField("Strasse")).toHaveValue("Dorfweg 3");
  });

  test("ungültige IBAN: Fehler am Feld, onCreate nicht aufgerufen (F4)", async () => {
    const onCreate = jest.fn().mockResolvedValue(undefined);
    render(<ExpenseReportDialog {...makeProps({onCreate})} />);
    typeInto("IBAN", "CH9300762011623852958");

    await act(async () => {
      fireEvent.click(screen.getByRole("button", {name: "Erstellen"}));
    });

    expect(onCreate).not.toHaveBeenCalled();
    expect(
      screen.getByText("Bitte eine gültige IBAN angeben."),
    ).toBeInTheDocument();
    expect(getField("IBAN")).toHaveAttribute("aria-invalid", "true");
  });

  test("leere Felder sind erlaubt: onCreate mit leeren Angaben", async () => {
    const onCreate = jest.fn().mockResolvedValue(undefined);
    render(<ExpenseReportDialog {...makeProps({onCreate})} />);

    expect(await createAndGetRefund(onCreate)).toEqual({
      details: EMPTY_DETAILS,
      shouldSave: false,
    });
  });

  test("refund: getrimmt, IBAN normalisiert, ohne userId", async () => {
    const onCreate = jest.fn().mockResolvedValue(undefined);
    render(
      <ExpenseReportDialog
        {...makeProps({
          onCreate,
          ownPaymentDetails: PROFILE_DETAILS,
        })}
      />,
    );
    typeInto("Strasse", "  Bahnhofstrasse 2 ");
    typeInto("IBAN", "ch93 0076 2011 6238 5295 7");

    expect((await createAndGetRefund(onCreate))?.details).toEqual({
      ...OWN_DETAILS,
      street: "Bahnhofstrasse 2",
    });
  });

  test("Checkbox: ausgegraut bei unvollständig, aktiv bei vollständig (F5)", () => {
    render(<ExpenseReportDialog {...makeProps()} />);

    expect(querySaveCheckbox()).toBeDisabled();
    expect(
      screen.getByText(
        "Zum Speichern Strasse, PLZ, Ort und eine gültige IBAN ausfüllen.",
      ),
    ).toBeInTheDocument();

    fillAllFields();

    expect(querySaveCheckbox()).toBeEnabled();
  });

  test("Checkbox angehakt: onCreate bekommt shouldSave true", async () => {
    const onCreate = jest.fn().mockResolvedValue(undefined);
    render(<ExpenseReportDialog {...makeProps({onCreate})} />);
    fillAllFields();

    fireEvent.click(querySaveCheckbox()!);

    expect(await createAndGetRefund(onCreate)).toEqual({
      details: OWN_DETAILS,
      shouldSave: true,
    });
  });

  test("angehakt, dann wieder unvollständig: shouldSave false", async () => {
    const onCreate = jest.fn().mockResolvedValue(undefined);
    render(<ExpenseReportDialog {...makeProps({onCreate})} />);
    fillAllFields();
    fireEvent.click(querySaveCheckbox()!);

    typeInto("Ort", "");

    expect(querySaveCheckbox()).not.toBeChecked();
    expect((await createAndGetRefund(onCreate))?.shouldSave).toBe(false);
  });

  test("unverändert aus dem Profil: keine Checkbox; nach Änderung wieder da", () => {
    render(
      <ExpenseReportDialog {...makeProps({ownPaymentDetails: OWN_DETAILS})} />,
    );

    expect(querySaveCheckbox()).not.toBeInTheDocument();

    typeInto("Strasse", "Bahnhofstrasse 2");

    expect(querySaveCheckbox()).toBeInTheDocument();
  });

  test("gleiche Angaben, nur anders geschrieben: gilt als unverändert", () => {
    render(
      <ExpenseReportDialog {...makeProps({ownPaymentDetails: OWN_DETAILS})} />,
    );

    typeInto("IBAN", "ch93 0076 2011 6238 5295 7");

    expect(querySaveCheckbox()).not.toBeInTheDocument();
  });
});
