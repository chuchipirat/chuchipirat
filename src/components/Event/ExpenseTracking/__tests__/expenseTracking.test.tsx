/**
 * Unit-Tests fuer EventExpenseTrackingPage.
 *
 * Prüfung ob je nach Spende die richtige Ansicht angezeigt wird.
 */
// Polyfill für jsdom (react-router benötigt TextEncoder/TextDecoder) — die
// gesperrte Ansicht bindet jetzt DonationForm ein, das ueber authUserContext
// transitiv react-router importiert (Muster: DonationForm.test.tsx).
import {TextEncoder, TextDecoder} from "util";
Object.assign(global, {TextEncoder, TextDecoder});

import React from "react";
import {
  act,
  fireEvent,
  getDefaultNormalizer,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import "@testing-library/jest-dom";

import {EventExpenseTrackingPage} from "../expenseTracking";
import {getHelpPageUrl} from "../../../Navigation/helpCenter";
import {AuthUserContext} from "../../../Session/authUserContext";
import AuthUser from "../../../Session/authUser.class";
import {BudgetType, BudgetIcon} from "../budget.types";
import {EventGroupConfiguration} from "../../GroupConfiguration/groupConfiguration.class";
import {budget as mockBudget} from "../__mocks__/budget.mock";
import {expense as mockExpense} from "../__mocks__/expense.mock";
import {REALTIME_RECONNECTING as TEXT_REALTIME_RECONNECTING} from "../../../../constants/text";
import {
  NEW_BUDGET as TEXT_NEW_BUDGET,
  BUDGET_HAS_EXPENSES as TEXT_BUDGET_HAS_EXPENSES,
  DELETE_BUDGET_DIALOG as TEXT_DELETE_BUDGET_DIALOG,
} from "../../../../constants/text/expenseTracking";
import {ExpenseDomain, ExpensePayeeType} from "../expense.types";
import {formatAmountFromCents} from "../../../Shared/utils/currencyUtils";
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
    getExpensesForEvent: jest.fn().mockResolvedValue({}),
  },
} as any;
const mockAuthUser = new AuthUser();
mockAuthUser.uid = "auth-uid-1";

/**
 * Rendert die EventExpenseTracking mit Standard-Props.
 * Optionale Overrides können übergeben werden.
 *
 * @param overrides Partielle Props, die die Standardwerte überschreiben.
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
  mockDatabase.expenses.getExpensesForEvent.mockReset().mockResolvedValue([]);
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
 * @param expenses Bisher ausgegebene Beträge je Budget-ID  und Währung (in Rappen).
 * @returns Render-Ergebnis sowie `onChange` und `onStatusChange` der Seite.
 */
const renderUnlockedPage = async (
  initialBudgets: unknown[] = [],
  expenses: ExpenseDomain[] = [],
) => {
  mockDatabase.donations.getEventDonations.mockResolvedValueOnce([{}]);
  mockDatabase.budgets.getBudgetsForEvent.mockResolvedValueOnce(initialBudgets);
  mockDatabase.expenses.getExpensesForEvent.mockResolvedValueOnce(expenses);

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
});
describe("Budget-Cards werden richtig dargestellt", () => {
  test("Ausgaben in mehreren Währungen werden angezeigt", async () => {
    mockDatabase.donations.getEventDonations.mockResolvedValueOnce([{}]);
    const existingBudget = {
      id: "budget-001",
      eventId: mockEvent.uid,
      name: "Küche",
      budgetType: BudgetType.FIXED_AMOUNT,
      amountInCents: 60000,
      currency: "CHF",
      icon: BudgetIcon.KITCHEN,
    };

    const expenses: ExpenseDomain[] = [
      {
        id: "expense-id-001",
        eventId: mockEvent.uid,
        budgetId: "budget-001",
        expenseDate: new Date(2026, 9, 21),
        amountInCents: 4200,
        currency: "CHF",
        label: "Migros Brunaupark",
        comment: "Vorweekend",
        payeeType: ExpensePayeeType.EXISTING_USER,
        payeeUserId: "payee-id-001",
        payeeName: null,
        attachmentPath: null,
        attachmentOriginalFilename: null,
      },
      {
        id: "expense-id-002",
        eventId: mockEvent.uid,
        budgetId: "budget-001",
        expenseDate: new Date(2026, 9, 21),
        amountInCents: 1100,
        currency: "EUR",
        label: "EDEKA",
        comment: "Vorweekend",
        payeeType: ExpensePayeeType.EXISTING_USER,
        payeeUserId: "payee-id-001",
        payeeName: null,
        attachmentPath: null,
        attachmentOriginalFilename: null,
      },
    ];
    const normalizer = getDefaultNormalizer();

    mockDatabase.budgets.getBudgetsForEvent.mockResolvedValueOnce([
      existingBudget,
    ]);
    mockDatabase.expenses.getExpensesForEvent.mockResolvedValueOnce(expenses);

    renderEventExpenseTrackingPage();

    expect(await screen.findByTestId(existingBudget.id)).toBeInTheDocument();

    const card = screen.getByTestId(kitchenBudget.id);
    expect(
      within(card).getByText(normalizer(formatAmountFromCents(1100, "EUR"))),
    ).toBeInTheDocument();
  });
  test("Fremdwährung erscheint als Zusatzzeile und zählt nicht zum Fortschritt", async () => {
    // kitchenBudget: CHF, Sollbetrag 1000 Rappen (10.00 CHF)
    await renderUnlockedPage(
      [kitchenBudget],
      [
        {
          ...mockExpense,
          budgetId: kitchenBudget.id,
          currency: "CHF",
          amountInCents: 400,
          id: "expense-1",
        },
        {
          ...mockExpense,
          budgetId: kitchenBudget.id,
          currency: "EUR",
          amountInCents: 500,
          id: "expense-2",
        },
      ],
    );
    const normalizer = getDefaultNormalizer();
    const card = await screen.findByTestId(kitchenBudget.id);

    // Balken/Prozent zählen nur die 400 CHF, nicht die zusätzlichen 500 EUR
    expect(within(card).getByRole("progressbar")).toHaveAttribute(
      "aria-valuenow",
      "40",
    );

    // Beide Beträge sind sichtbar
    expect(
      within(card).getByText(normalizer(formatAmountFromCents(400, "CHF"))),
    ).toBeInTheDocument();
    expect(
      within(card).getByText(normalizer(formatAmountFromCents(500, "EUR"))),
    ).toBeInTheDocument();
  });
  test("Fortschrittsbalken wird richtig berechnet", async () => {
    // kitchenBudget: CHF, Sollbetrag 7500 Rappen (75.00 CHF)
    await renderUnlockedPage(
      [{...kitchenBudget, amountInCents: 7500}],
      [
        {
          ...mockExpense,
          budgetId: kitchenBudget.id,
          currency: "CHF",
          amountInCents: 4200,
          id: "expense-1",
        },
        {
          ...mockExpense,
          budgetId: kitchenBudget.id,
          currency: "EUR",
          amountInCents: 500,
          id: "expense-2",
        },
      ],
    );

    const card = await screen.findByTestId(kitchenBudget.id);
    // Balken/Prozent zählen nur die 42 CHF, nicht die zusätzlichen 5.00 EUR
    expect(within(card).getByRole("progressbar")).toHaveAttribute(
      "aria-valuenow",
      "56",
    );
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
  const openEditDialog = async (expenses: ExpenseDomain[] = []) => {
    await renderUnlockedPage([kitchenBudget], expenses);
    const card = await screen.findByTestId("budget-001");
    fireEvent.click(
      within(card).getByRole("button", {name: "Budget bearbeiten"}),
    );
    return screen.findByRole("dialog");
  };

  /** Öffnet den Bearbeiten-Dialog und klickt auf «Löschen». */
  const openEditDialogAndClickDelete = async (
    expenses: ExpenseDomain[] = [],
  ) => {
    const dialog = await openEditDialog(expenses);
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

    await openEditDialogAndClickDelete([
      {...mockExpense, budgetId: kitchenBudget.id},
    ]); // 42.00 CHF ausgegeben
    await waitFor(() =>
      expect(mockCustomDialog).toHaveBeenCalledWith(
        expect.objectContaining({text: TEXT_BUDGET_HAS_EXPENSES}),
      ),
    );
    expect(mockCustomDialog).toHaveBeenCalledTimes(1); // nur der Hinweis, keine Rückfrage
    expect(mockDatabase.budgets.deleteBudget).not.toHaveBeenCalled();
    expect(screen.getByTestId("budget-001")).toBeInTheDocument();
  });

  test("Löschsperre gilt auch bei einer reinen Fremdwährungs-Ausgabe", async () => {
    mockCustomDialog.mockResolvedValue(true);
    await openEditDialogAndClickDelete([
      {...mockExpense, budgetId: kitchenBudget.id, currency: "EUR"},
    ]);
    await waitFor(() =>
      expect(mockCustomDialog).toHaveBeenCalledWith(
        expect.objectContaining({text: TEXT_BUDGET_HAS_EXPENSES}),
      ),
    );
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
