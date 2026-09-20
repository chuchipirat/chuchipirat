/**
 * Unit-Tests fuer EventExpenseTrackingPage.
 *
 * Prüfung ob je nach Spende die richtige Ansicht angezeigt wird.
 */
// Polyfill fuer jsdom (react-router benoetigt TextEncoder/TextDecoder) — die
// gesperrte Ansicht bindet jetzt DonationForm ein, das ueber authUserContext
// transitiv react-router importiert (Muster: DonationForm.test.tsx).
import {TextEncoder, TextDecoder} from "util";
Object.assign(global, {TextEncoder, TextDecoder});

import React from "react";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import "@testing-library/jest-dom";

import {BudgetDetailDialog, EventExpenseTrackingPage} from "../expenseTracking";
import {getHelpPageUrl} from "../../../Navigation/helpCenter";
import {AuthUserContext} from "../../../Session/authUserContext";
import AuthUser from "../../../Session/authUser.class";
import {BudgetType, BudgetIcon} from "../budget.types";
import {EventGroupConfiguration} from "../../GroupConfiguration/groupConfiguration.class";
import {budget as mockBudget} from "../__mocks__/budget.mock";
import {REALTIME_RECONNECTING as TEXT_REALTIME_RECONNECTING} from "../../../../constants/text";
import {
  NEW_BUDGET as TEXT_NEW_BUDGET,
  BUDGET_HAS_EXPENSES as TEXT_BUDGET_HAS_EXPENSES,
  DELETE_BUDGET_DIALOG as TEXT_DELETE_BUDGET_DIALOG,
} from "../../../../constants/text/expenseTracking";
/**
 * Mock: customDialog — die Tests steuern, was die Nutzer:in «antwortet».
 * `jest.mock` muss auf oberster Ebene der Datei stehen: Es wird vor den
 * Imports ausgeführt und wirkt nicht, wenn es in einem `describe` steht.
 */
const mockCustomDialog = jest.fn();
jest.mock("../../../Shared/customDialogContext", () => ({
  ...jest.requireActual("../../../Shared/customDialogContext"),
  useCustomDialog: () => ({customDialog: mockCustomDialog}),
}));

/** Testdaten: Ein Event mit einem Koch und einer Datumsperiode. */
const mockEvent = {
  uid: "evt-1",
  name: "Sommerlager",
  motto: "Abenteuer",
  location: "Pfadiheim",
  dates: [
    {
      uid: "date-1",
      pos: 1,
      from: new Date("2027-06-15"),
      to: new Date("2027-06-20"),
    },
  ],
  cooks: [
    {
      uid: "user-123",
      displayName: "Max Muster",
      motto: "Kochen ist toll",
      pictureSrc: "",
    },
  ],
  pictureSrc: "",
};
const mockGroupConfiguration = {
  totalPortions: 10,
};

// Handle, den `subscribeToBudgets` zurückgibt — als Konstanten, damit die Tests
// prüfen können, ob unsubscribe/reconnect aufgerufen wurden.
const mockUnsubscribe = jest.fn();
const mockReconnect = jest.fn();

const mockDatabase = {
  donations: {getEventDonations: jest.fn().mockResolvedValue([])},
  budgets: {
    getBudgetsForEvent: jest.fn().mockResolvedValue([]),
    createBudget: jest.fn(),
    updateBudget: jest.fn(),
    deleteBudget: jest.fn(),
    subscribeToBudgets: jest.fn().mockReturnValue({
      unsubscribe: mockUnsubscribe,
      reconnect: mockReconnect,
    }),
  },
  expenses: {
    getSpentAmountsByBudget: jest.fn().mockResolvedValue({}),
  },
} as any;
const mockAuthUser = new AuthUser();
mockAuthUser.uid = "auth-uid-1";

/**
 * Rendert die EventExpenseTracking mit Standard-Props.
 * Optionale Overrides koennen uebergeben werden.
 *
 * @param overrides Partielle Props, die die Standardwerte ueberschreiben.
 * @returns Das Render-Ergebnis von @testing-library/react.
 */
const renderEventExpenseTrackingPage = (
  overrides: Record<string, any> = {},
) => {
  const defaultProps = {
    event: mockEvent as any,
    groupConfiguration: mockGroupConfiguration as EventGroupConfiguration,
    database: mockDatabase,
  };

  return render(
    <AuthUserContext.Provider value={mockAuthUser}>
      <EventExpenseTrackingPage {...defaultProps} {...overrides} />
    </AuthUserContext.Provider>,
  );
};

beforeEach(() => {
  jest.clearAllMocks();
  // `clearAllMocks` leert nur die Aufrufe, nicht die Warteschlange der
  // `...Once`-Rückgabewerte. Ein nicht verbrauchter Wert würde sonst an den
  // nächsten Test «vererbt» und dort einen Folgefehler auslösen.
  mockDatabase.donations.getEventDonations.mockReset().mockResolvedValue([]);
  mockDatabase.budgets.getBudgetsForEvent.mockReset().mockResolvedValue([]);
  mockDatabase.expenses.getSpentAmountsByBudget.mockReset().mockResolvedValue({});
  mockCustomDialog.mockReset();
});

/** Ein bestehendes Budget, wie es die Datenbank liefert. */
const kitchenBudget = {...mockBudget, id: "budget-001", name: "Küche"};

/**
 * Rendert die freigeschaltete Seite, wartet bis die Subscription steht und
 * liefert die Callbacks, die die Seite an `subscribeToBudgets` übergeben hat.
 * Die Tests rufen sie selbst auf und simulieren damit Ereignisse von Supabase.
 *
 * @param initialBudgets Budgets, die der Erstlade-Aufruf liefert.
 * @param spentAmounts Bisher ausgegebene Beträge je Budget-ID (in Rappen).
 * @returns Render-Ergebnis sowie `onChange` und `onStatusChange` der Seite.
 */
const renderUnlockedPage = async (
  initialBudgets: unknown[] = [],
  spentAmounts: Record<string, number> = {},
) => {
  mockDatabase.donations.getEventDonations.mockResolvedValueOnce([{}]);
  mockDatabase.budgets.getBudgetsForEvent.mockResolvedValueOnce(initialBudgets);
  mockDatabase.expenses.getSpentAmountsByBudget.mockResolvedValueOnce(
    spentAmounts,
  );

  const view = renderEventExpenseTrackingPage();
  await waitFor(() =>
    expect(mockDatabase.budgets.subscribeToBudgets).toHaveBeenCalled(),
  );

  // Aufrufparameter: (eventUid, onChange, onError, onStatusChange)
  const [, onChange, , onStatusChange] =
    mockDatabase.budgets.subscribeToBudgets.mock.calls[0];
  return {view, onChange, onStatusChange};
};

describe("EventExpenseTrackingPage", () => {
  test("ohne Spende: gesperrte Ansicht", async () => {
    mockDatabase.donations.getEventDonations.mockResolvedValueOnce([]);

    renderEventExpenseTrackingPage();

    expect(
      await screen.findByTestId("expense-tracking-locked"),
    ).toBeInTheDocument();
  });

  test("gesperrte Ansicht: Helpcenter-Link zeigt auf die richtige Seite", async () => {
    mockDatabase.donations.getEventDonations.mockResolvedValueOnce([]);

    renderEventExpenseTrackingPage();

    const helpLink = await screen.findByRole("link", {name: "Helpcenter"});
    expect(helpLink).toHaveAttribute(
      "href",
      getHelpPageUrl("event", "expensetracking"),
    );
  });

  test("mit Spende: Abrechnung sichtbar", async () => {
    mockDatabase.donations.getEventDonations.mockResolvedValueOnce([{}]);
    renderEventExpenseTrackingPage();
    expect(
      await screen.findByTestId("expense-tracking-unlocked"),
    ).toBeInTheDocument();
  });

  test("zeigt zuerst den Ladezustand", () => {
    mockDatabase.donations.getEventDonations.mockReturnValueOnce(
      new Promise(() => {}),
    ); // nie resolven
    renderEventExpenseTrackingPage();
    expect(screen.getByTestId("expense-tracking-loading")).toBeInTheDocument();
  });

  test("Budget wird geladen, wenn Spende erfolgt", async () => {
    mockDatabase.donations.getEventDonations.mockResolvedValueOnce([{}]);
    const existingBudget = {
      id: "budget-001",
      eventId: mockEvent.uid,
      name: "Küche",
      budgetType: BudgetType.FIXED_AMOUNT,
      amountInCents: 50000,
      currency: "CHF",
      icon: BudgetIcon.KITCHEN,
    };
    mockDatabase.budgets.getBudgetsForEvent.mockResolvedValueOnce([
      existingBudget,
    ]);

    renderEventExpenseTrackingPage();

    expect(await screen.findByTestId(existingBudget.id)).toBeInTheDocument();
    expect(mockDatabase.budgets.createBudget).not.toHaveBeenCalled();
  });

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
    expect(screen.getByText("Bitte einen Namen angeben.")).toBeInTheDocument();
    expect(
      screen.getByText("Bitte einen gültigen Betrag angeben"),
    ).toBeInTheDocument();
    expect(screen.getByText("Bitte ein Icon auswählen")).toBeInTheDocument();
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

/* =====================================================================
// Realtime-Subscription der Budgets
// ===================================================================== */
describe("EventExpenseTrackingPage: Realtime der Budgets", () => {
  const transportBudget = {
    ...mockBudget,
    id: "budget-002",
    name: "Transport",
    icon: BudgetIcon.TRANSPORT,
  };

  test("abonniert erst, wenn eine Spende bestätigt ist", async () => {
    mockDatabase.donations.getEventDonations.mockResolvedValueOnce([]);

    renderEventExpenseTrackingPage();

    await screen.findByTestId("expense-tracking-locked");
    expect(mockDatabase.budgets.subscribeToBudgets).not.toHaveBeenCalled();
  });

  test("abonniert die Budgets des Events", async () => {
    await renderUnlockedPage();

    expect(mockDatabase.budgets.subscribeToBudgets).toHaveBeenCalledWith(
      mockEvent.uid,
      expect.any(Function),
      expect.any(Function),
      expect.any(Function),
    );
  });

  test("zeigt ein neues Budget, wenn eine andere Sitzung es anlegt", async () => {
    const {onChange} = await renderUnlockedPage([kitchenBudget]);
    expect(await screen.findByTestId("budget-001")).toBeInTheDocument();
    expect(screen.queryByTestId("budget-002")).not.toBeInTheDocument();

    // Supabase meldet eine Änderung, der Reload liefert jetzt zwei Budgets
    mockDatabase.budgets.getBudgetsForEvent.mockResolvedValueOnce([
      kitchenBudget,
      transportBudget,
    ]);
    await act(async () => {
      await onChange();
    });

    expect(await screen.findByTestId("budget-002")).toBeInTheDocument();
  });

  test("entfernt eine Karte, wenn eine andere Sitzung das Budget löscht", async () => {
    const {onChange} = await renderUnlockedPage([
      kitchenBudget,
      transportBudget,
    ]);
    expect(await screen.findByTestId("budget-002")).toBeInTheDocument();

    mockDatabase.budgets.getBudgetsForEvent.mockResolvedValueOnce([
      kitchenBudget,
    ]);
    await act(async () => {
      await onChange();
    });

    await waitFor(() =>
      expect(screen.queryByTestId("budget-002")).not.toBeInTheDocument(),
    );
    expect(screen.getByTestId("budget-001")).toBeInTheDocument();
  });

  test("legt bei leerer Liste nie automatisch ein Budget an", async () => {
    const {onChange} = await renderUnlockedPage([]);
    await screen.findByTestId("expense-tracking-unlocked");
    // Leerzustand: nur die «Neues Budget»-Elemente, keine Budget-Karte
    expect(screen.getAllByText(TEXT_NEW_BUDGET).length).toBeGreaterThan(0);

    await act(async () => {
      await onChange();
    });

    expect(mockDatabase.budgets.createBudget).not.toHaveBeenCalled();
  });

  test("lädt nach einem Verbindungsabbruch neu, aber nicht schon beim Abbruch", async () => {
    const {onStatusChange} = await renderUnlockedPage([kitchenBudget]);
    await screen.findByTestId("budget-001");
    expect(mockDatabase.budgets.getBudgetsForEvent).toHaveBeenCalledTimes(1);

    // Verbindung bricht ab: Hinweis erscheint, aber noch kein Reload
    await act(async () => {
      onStatusChange("reconnecting");
    });
    expect(screen.getByText(TEXT_REALTIME_RECONNECTING)).toBeInTheDocument();
    expect(mockDatabase.budgets.getBudgetsForEvent).toHaveBeenCalledTimes(1);

    // Verbindung steht wieder: in der Zwischenzeit verpasste Änderungen nachladen
    mockDatabase.budgets.getBudgetsForEvent.mockResolvedValueOnce([
      kitchenBudget,
      transportBudget,
    ]);
    await act(async () => {
      onStatusChange("connected");
    });

    expect(await screen.findByTestId("budget-002")).toBeInTheDocument();
    expect(mockDatabase.budgets.getBudgetsForEvent).toHaveBeenCalledTimes(2);
  });

  test("abonniert nur einmal, auch wenn sich der Verbindungsstatus ändert", async () => {
    const {onStatusChange} = await renderUnlockedPage([kitchenBudget]);
    await screen.findByTestId("budget-001");

    // Statuswechsel löst ein Re-Render aus. Wären die Dependencies des
    // Effects instabil, würde die Seite dabei neu abonnieren.
    await act(async () => {
      onStatusChange("reconnecting");
    });

    expect(mockDatabase.budgets.subscribeToBudgets).toHaveBeenCalledTimes(1);
    expect(mockUnsubscribe).not.toHaveBeenCalled();
  });

  test("beendet die Subscription, wenn die Seite verlassen wird", async () => {
    const {view} = await renderUnlockedPage([kitchenBudget]);
    await screen.findByTestId("budget-001");

    view.unmount();

    expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
  });

  test("zeigt einen Fehler beim Neuladen und blendet ihn nach Erfolg wieder aus", async () => {
    const {onChange} = await renderUnlockedPage([kitchenBudget]);
    await screen.findByTestId("budget-001");

    // Reload schlägt fehl → Fehlerhinweis
    mockDatabase.budgets.getBudgetsForEvent.mockRejectedValueOnce(
      new Error("Verbindung verloren"),
    );
    await act(async () => {
      await onChange();
    });
    expect(await screen.findByRole("alert")).toBeInTheDocument();

    // Nächster Reload klappt → der Fehlerhinweis verschwindet wieder
    mockDatabase.budgets.getBudgetsForEvent.mockResolvedValueOnce([
      kitchenBudget,
    ]);
    await act(async () => {
      await onChange();
    });
    await waitFor(() =>
      expect(screen.queryByRole("alert")).not.toBeInTheDocument(),
    );
  });
});
/* =====================================================================
// Budget bearbeiten und löschen
// ===================================================================== */
describe("EventExpenseTrackingPage: Budget bearbeiten und löschen", () => {
  /** Öffnet den Bearbeiten-Dialog über das Stift-Icon der Karte. */
  const openEditDialog = async (spentAmounts: Record<string, number> = {}) => {
    await renderUnlockedPage([kitchenBudget], spentAmounts);
    const card = await screen.findByTestId("budget-001");
    fireEvent.click(
      within(card).getByRole("button", {name: "Budget bearbeiten"}),
    );
    return screen.findByRole("dialog");
  };

  /** Öffnet den Bearbeiten-Dialog und klickt auf «Löschen». */
  const openEditDialogAndClickDelete = async (
    spentAmounts: Record<string, number> = {},
  ) => {
    const dialog = await openEditDialog(spentAmounts);
    fireEvent.click(within(dialog).getByRole("button", {name: "Löschen"}));
  };

  /* ------------------------------------------
  // Bearbeiten
  // ------------------------------------------ */
  test("Klick auf das Stift-Icon öffnet den Dialog mit den Werten des Budgets", async () => {
    const dialog = await openEditDialog();

    expect(within(dialog).getByLabelText("Name")).toHaveValue("Küche");
    expect(
      within(dialog).getByRole("button", {name: "Löschen"}),
    ).toBeInTheDocument();
  });

  test("Speichern ruft updateBudget auf und aktualisiert die Karte", async () => {
    mockDatabase.budgets.updateBudget.mockResolvedValueOnce({
      ...kitchenBudget,
      name: "Motto",
    });
    const dialog = await openEditDialog();

    fireEvent.change(within(dialog).getByLabelText("Name"), {
      target: {value: "Motto"},
    });
    fireEvent.click(within(dialog).getByRole("button", {name: "Speichern"}));

    await waitFor(() =>
      expect(mockDatabase.budgets.updateBudget).toHaveBeenCalledWith(
        expect.objectContaining({id: "budget-001", name: "Motto"}),
        mockAuthUser,
      ),
    );
    expect(
      await within(screen.getByTestId("budget-001")).findByText("Motto"),
    ).toBeInTheDocument();
  });

  test("schlägt das Speichern fehl, erscheint ein Fehler und die Karte bleibt unverändert", async () => {
    mockDatabase.budgets.updateBudget.mockRejectedValueOnce(
      new Error("Speichern fehlgeschlagen"),
    );
    const dialog = await openEditDialog();

    fireEvent.change(within(dialog).getByLabelText("Name"), {
      target: {value: "Motto"},
    });
    fireEvent.click(within(dialog).getByRole("button", {name: "Speichern"}));

    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(
      within(screen.getByTestId("budget-001")).getByText("Küche"),
    ).toBeInTheDocument();
  });

  /* ------------------------------------------
  // Löschen
  // ------------------------------------------ */
  test("nach Bestätigung wird das Budget gelöscht und die Karte entfernt", async () => {
    mockCustomDialog.mockResolvedValue(true); // Nutzer:in bestätigt
    mockDatabase.budgets.deleteBudget.mockResolvedValueOnce(undefined);

    await openEditDialogAndClickDelete();

    await waitFor(() =>
      expect(mockDatabase.budgets.deleteBudget).toHaveBeenCalledWith(
        "budget-001",
      ),
    );
    expect(mockCustomDialog).toHaveBeenCalledWith(
      expect.objectContaining({title: TEXT_DELETE_BUDGET_DIALOG("Küche")}),
    );
    await waitFor(() =>
      expect(screen.queryByTestId("budget-001")).not.toBeInTheDocument(),
    );
  });

  test("bei Abbruch bleibt das Budget bestehen", async () => {
    mockCustomDialog.mockResolvedValue(false); // Nutzer:in bricht ab

    await openEditDialogAndClickDelete();

    await waitFor(() => expect(mockCustomDialog).toHaveBeenCalledTimes(1));
    expect(mockDatabase.budgets.deleteBudget).not.toHaveBeenCalled();
    expect(screen.getByTestId("budget-001")).toBeInTheDocument();
  });

  test("ein Budget mit Ausgaben kann nicht gelöscht werden", async () => {
    // Selbst wenn die Nutzer:in im Dialog «OK» klickt (true), darf nichts passieren
    mockCustomDialog.mockResolvedValue(true);

    await openEditDialogAndClickDelete({"budget-001": 2500}); // 25.00 CHF ausgegeben

    await waitFor(() =>
      expect(mockCustomDialog).toHaveBeenCalledWith(
        expect.objectContaining({text: TEXT_BUDGET_HAS_EXPENSES}),
      ),
    );
    expect(mockCustomDialog).toHaveBeenCalledTimes(1); // nur der Hinweis, keine Rückfrage
    expect(mockDatabase.budgets.deleteBudget).not.toHaveBeenCalled();
    expect(screen.getByTestId("budget-001")).toBeInTheDocument();
  });

  test("meldet die Datenbank einen Fremdschlüssel-Fehler, erscheint der Hinweis", async () => {
    // Lokal sieht es nach «keine Ausgaben» aus, in der DB gibt es aber inzwischen welche
    mockCustomDialog.mockResolvedValue(true);
    mockDatabase.budgets.deleteBudget.mockRejectedValueOnce({
      code: "23503",
      message: "violates foreign key constraint",
    });

    await openEditDialogAndClickDelete();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      TEXT_BUDGET_HAS_EXPENSES,
    );
    expect(screen.getByTestId("budget-001")).toBeInTheDocument();
  });

  test("schlägt das Löschen aus anderem Grund fehl, erscheint ein Fehler und das Budget bleibt", async () => {
    mockCustomDialog.mockResolvedValue(true);
    mockDatabase.budgets.deleteBudget.mockRejectedValueOnce(
      new Error("Löschen fehlgeschlagen"),
    );

    await openEditDialogAndClickDelete();

    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(screen.getByTestId("budget-001")).toBeInTheDocument();
  });
});
