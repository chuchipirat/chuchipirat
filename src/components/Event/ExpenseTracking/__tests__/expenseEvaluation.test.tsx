/**
 * Unit-Tests für die Ansicht «Auswertung» (expenseEvaluation.tsx).
 *
 * Reine Anzeige-Komponente (Story 6.2a), darum ohne Contexts: Props direkt.
 * Schwerpunkte: leerer Zustand, Währungsauswahl inkl. Rückfall (W4),
 * Kennzahl-Kacheln, Hinweis auf fehlende Belege und die Top-5-Liste.
 * Story 6.2b: Budget-Filter (Button mit Dropdown, `BudgetFilter`), die
 * Hilfsfunktionen für Beschriftung und Hinweiszeile sowie das Zusammenspiel
 * mit Kennzahlen, Währungen und LocalStorage.
 * Story 6.3: Reihen des Ausgabenverlaufs folgen Budget- und Währungsauswahl.
 */
import React from "react";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import "@testing-library/jest-dom";
import type {LineChartProps} from "@mui/x-charts/LineChart";

import {
  BudgetFilter,
  ExpenseEvaluation,
  getBudgetFilterLabel,
  getStatisticsScopeNote,
} from "../expenseEvaluation";
import {BudgetDomain} from "../budget.types";
import {ExpenseDomain} from "../expense.types";
import {expense} from "../__mocks__/expense.mock";
import {budget, budget2} from "../__mocks__/budget.mock";
import {parseLocalDate} from "../../../../utils/dateUtils";
import {formatAmountFromCents} from "../../../Shared/utils/currencyUtils";
import {LocalStorageKey} from "../../../../constants/localStorage";

import {
  NO_EXPENSES_FOR_STATS as TEXT_NO_EXPENSES_FOR_STATS,
  EVALUATION_TOTAL as TEXT_EVALUATION_TOTAL,
  EVALUATION_EXPENSE_COUNT as TEXT_EVALUATION_EXPENSE_COUNT,
  EVALUATION_AVERAGE_PER_PARTICIPANT as TEXT_EVALUATION_AVERAGE_PER_PARTICIPANT,
  EVALUATION_PARTICIPANTS_MISSING as TEXT_EVALUATION_PARTICIPANTS_MISSING,
  EVALUATION_PER_PARTICIPANT_AND_DAY_SO_FAR as TEXT_EVALUATION_PER_PARTICIPANT_AND_DAY_SO_FAR,
  EVALUATION_CALCULATION_BASIS as TEXT_EVALUATION_CALCULATION_BASIS,
  EVALUATION_WITHOUT_RECEIPT_COUNT as TEXT_EVALUATION_WITHOUT_RECEIPT_COUNT,
  EVALUATION_CURRENCY_FILTER_ARIA_LABEL as TEXT_EVALUATION_CURRENCY_FILTER_ARIA_LABEL,
  EVALUATION_SCOPE_NOTE_CURRENCIES as TEXT_EVALUATION_SCOPE_NOTE_CURRENCIES,
  EVALUATION_SCOPE_NOTE_BUDGETS as TEXT_EVALUATION_SCOPE_NOTE_BUDGETS,
  EVALUATION_BUDGET_FILTER_ALL as TEXT_EVALUATION_BUDGET_FILTER_ALL,
  EVALUATION_BUDGET_FILTER_PARTIAL as TEXT_EVALUATION_BUDGET_FILTER_PARTIAL,
  EVALUATION_BUDGET_FILTER_ARIA_LABEL as TEXT_EVALUATION_BUDGET_FILTER_ARIA_LABEL,
  EVALUATION_NO_EXPENSES_IN_SELECTED_BUDGETS as TEXT_EVALUATION_NO_EXPENSES_IN_SELECTED_BUDGETS,
} from "../../../../constants/text/expenseTracking";
import {SHOW as TEXT_SHOW} from "../../../../constants/text/shared";

/**
 * Mock: LineChart (Ausgabenverlauf, Story 6.3) — jsdom hat kein Layout, das
 * SVG lässt sich nicht prüfen. Die Fake-Komponente hält ihre Props fest,
 * damit die Tests die übergebenen Reihen prüfen können.
 */
const mockLineChart = jest.fn();
jest.mock("@mui/x-charts/LineChart", () => ({
  LineChart: (props: LineChartProps) => {
    mockLineChart(props);
    return <div data-testid="line-chart" />;
  },
}));

/**
 * Liefert die Reihen des zuletzt gerenderten Ausgabenverlaufs.
 *
 * @returns Ist-Werte und, falls vorhanden, Soll-Werte.
 */
const getLastHistorySeries = () => {
  const series = (mockLineChart.mock.lastCall[0] as LineChartProps).series;
  return {actualValues: series[0].data, targetValues: series[1]?.data ?? null};
};

/**
 * Formatiert einen Betrag wie die Ansicht, aber mit normalem Leerzeichen.
 * `Intl.NumberFormat` trennt Währung und Betrag mit einem geschützten
 * Leerzeichen; der Text-Vergleich normalisiert nur den gerenderten Text.
 *
 * @param amountInCents - Betrag in Rappen.
 * @param currency - ISO-4217-Währungscode.
 * @returns Formatierter Betrag mit normalen Leerzeichen.
 */
const expectedAmount = (amountInCents: number, currency: string): string =>
  formatAmountFromCents(amountInCents, currency).replace(/\s/g, " ");

/**
 * Normalisiert Leerzeichen eines Textes (geschützte → normale), für Texte,
 * die einen formatierten Betrag enthalten.
 *
 * @param text - Zu normalisierender Text.
 * @returns Text mit normalen Leerzeichen.
 */
const normalizeSpaces = (text: string): string => text.replace(/\s/g, " ");

/**
 * Baut eine Test-Ausgabe (Budget «Küche», CHF, ohne Beleg).
 *
 * @param overrides - Felder, die vom Standard abweichen sollen.
 * @returns Vollständige Ausgabe.
 */
const createExpense = (
  overrides: Partial<ExpenseDomain> = {},
): ExpenseDomain => ({
  ...expense,
  budgetId: budget.id,
  date: parseLocalDate("2026-07-05"),
  currency: "CHF",
  attachmentPath: null,
  ...overrides,
});

const budgets = [budget, budget2];

/** Drittes Budget für Teilauswahlen («2 von 3 Budgets»). */
const budget3: BudgetDomain = {
  ...budget,
  id: "budget-id-003",
  name: "Material",
};

/** Anlass mit 7 Tagen, 5.–11. Juli 2026 (lokale Mitternacht, wie `getEventDateList`). */
const EVENT_DAYS = [
  "2026-07-05",
  "2026-07-06",
  "2026-07-07",
  "2026-07-08",
  "2026-07-09",
  "2026-07-10",
  "2026-07-11",
].map((dayKey) => parseLocalDate(dayKey));
/** Stichtag der Tests: Anlasstag 3 von 7. */
const TODAY = parseLocalDate("2026-07-07");

const EVENT_ID = "event-id-001";
const STORAGE_KEY = `${LocalStorageKey.EXPENSE_EVALUATION_EXCLUDED_BUDGETS}_${EVENT_ID}`;

// Die Budget-Auswahl wird pro Gerät gespeichert: jeder Test startet leer
beforeEach(() => {
  localStorage.clear();
  mockLineChart.mockClear();
});

/**
 * Rendert die Auswertung mit Standardwerten (24 Personen, 7 Anlasstage,
 * heute = Anlasstag 3).
 *
 * @param expenses - Ausgaben des Anlasses.
 * @param overrides - Weitere Props, die vom Standard abweichen sollen.
 * @returns Render-Ergebnis sowie Mocks des Bearbeiten-Klicks und des
 *   Sprungs in die Liste der fehlenden Belege.
 */
const renderEvaluation = (
  expenses: ExpenseDomain[],
  overrides: Partial<React.ComponentProps<typeof ExpenseEvaluation>> = {},
) => {
  const handleEditClick = jest.fn();
  const handleShowMissingReceipts = jest.fn();
  const props = {
    eventId: EVENT_ID,
    expenses,
    budgets,
    participantCount: 24,
    eventDays: EVENT_DAYS,
    today: TODAY,
    handleEditClick,
    handleShowMissingReceipts,
    ...overrides,
  };
  const view = render(<ExpenseEvaluation {...props} />);
  return {view, props, handleEditClick, handleShowMissingReceipts};
};

/**
 * Liefert die Kachel (MUI-Card) mit dem gegebenen Titel, um Abfragen auf
 * diese Kachel einzugrenzen.
 *
 * @param title - Titel der Kachel.
 * @returns Das Kachel-Element.
 */
const getTile = (title: string): HTMLElement => {
  const tile = screen.getByText(title).closest(".MuiCard-root");
  if (!(tile instanceof HTMLElement)) {
    throw new Error(`Kachel «${title}» nicht gefunden`);
  }
  return tile;
};

/**
 * Screenreader-Name des Budget-Filter-Buttons unabhängig von der Auswahl
 * (der Name endet mit der aktuellen Auswahl).
 */
const BUDGET_FILTER_BUTTON_NAME = new RegExp(
  `^${TEXT_EVALUATION_BUDGET_FILTER_ARIA_LABEL("").trim()}`,
);

/**
 * Liefert den Button des Budget-Filters.
 *
 * @returns Der Button, der das Budget-Menü öffnet.
 */
const getBudgetFilterButton = (): HTMLElement =>
  screen.getByRole("button", {name: BUDGET_FILTER_BUTTON_NAME});

/**
 * Liefert den Menüeintrag eines Budgets (Menü muss offen sein).
 *
 * @param budgetName - Name des Budgets.
 * @returns Der Eintrag mit `role="menuitemcheckbox"`.
 */
const getBudgetMenuItem = (budgetName: string): HTMLElement =>
  screen.getByRole("menuitemcheckbox", {name: new RegExp(budgetName)});

/**
 * Öffnet das Budget-Menü, klickt die gegebenen Einträge und schliesst das
 * Menü wieder (Escape), damit der Rest der Seite für Abfragen nach Rolle
 * nicht mehr `aria-hidden` ist.
 *
 * @param menuItemNames - Namen der Einträge, in Klick-Reihenfolge.
 */
const clickBudgetMenuItems = async (menuItemNames: string[]) => {
  fireEvent.click(getBudgetFilterButton());
  for (const menuItemName of menuItemNames) {
    fireEvent.click(
      menuItemName === TEXT_EVALUATION_BUDGET_FILTER_ALL
        ? screen.getByRole("menuitem", {name: menuItemName})
        : getBudgetMenuItem(menuItemName),
    );
  }
  fireEvent.keyDown(screen.getByRole("menu"), {key: "Escape"});
  await waitFor(() =>
    expect(screen.queryByRole("menu")).not.toBeInTheDocument(),
  );
};

describe("ExpenseEvaluation, leerer Zustand", () => {
  test("ohne Ausgaben: nur Hinweistext, keine Kacheln", () => {
    renderEvaluation([]);

    expect(screen.getByText(TEXT_NO_EXPENSES_FOR_STATS)).toBeInTheDocument();
    expect(
      screen.queryByTestId("expense-tracking-evaluation"),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(TEXT_EVALUATION_TOTAL)).not.toBeInTheDocument();
  });
});

describe("ExpenseEvaluation, Währungsauswahl", () => {
  const twoChfOneEur = [
    createExpense({id: "chf-1", amountInCents: 10000}),
    createExpense({id: "chf-2", amountInCents: 5000}),
    createExpense({id: "eur-1", amountInCents: 3000, currency: "EUR"}),
  ];

  test("nur eine Währung: keine Chips, kein Hinweis auf andere Währungen", () => {
    renderEvaluation([createExpense({id: "chf-1"})]);

    expect(
      screen.queryByRole("group", {
        name: TEXT_EVALUATION_CURRENCY_FILTER_ARIA_LABEL,
      }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(/sind hier nicht enthalten/),
    ).not.toBeInTheDocument();
  });

  test("mehrere Währungen: häufigste vorausgewählt, Hinweis nennt die andere", () => {
    renderEvaluation(twoChfOneEur);

    const currencyGroup = screen.getByRole("group", {
      name: TEXT_EVALUATION_CURRENCY_FILTER_ARIA_LABEL,
    });
    expect(
      within(currencyGroup).getByRole("button", {name: "CHF"}),
    ).toHaveAttribute("aria-pressed", "true");
    expect(
      within(currencyGroup).getByRole("button", {name: "EUR"}),
    ).toHaveAttribute("aria-pressed", "false");
    expect(
      screen.getByText(TEXT_EVALUATION_SCOPE_NOTE_CURRENCIES(["EUR"])),
    ).toBeInTheDocument();
    expect(getTile(TEXT_EVALUATION_TOTAL)).toHaveTextContent(
      expectedAmount(15000, "CHF"),
    );
  });

  test("Klick auf EUR: Kennzahlen in EUR, Hinweis nennt CHF", () => {
    renderEvaluation(twoChfOneEur);

    fireEvent.click(screen.getByRole("button", {name: "EUR"}));

    const totalTile = getTile(TEXT_EVALUATION_TOTAL);
    expect(totalTile).toHaveTextContent(expectedAmount(3000, "EUR"));
    expect(totalTile).toHaveTextContent(TEXT_EVALUATION_EXPENSE_COUNT(1));
    expect(
      screen.getByText(TEXT_EVALUATION_SCOPE_NOTE_CURRENCIES(["CHF"])),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", {name: "EUR"})).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  test("Hinweis nennt mehrere andere Währungen", () => {
    renderEvaluation([
      createExpense({id: "chf-1"}),
      createExpense({id: "chf-2"}),
      createExpense({id: "eur-1", currency: "EUR"}),
      createExpense({id: "usd-1", currency: "USD"}),
    ]);

    expect(
      screen.getByText("Ausgaben in EUR und USD sind hier nicht enthalten."),
    ).toBeInTheDocument();
  });

  test("gewählte Währung verschwindet → Rückfall auf die Vorauswahl (W4)", () => {
    const {view, props} = renderEvaluation(twoChfOneEur);
    fireEvent.click(screen.getByRole("button", {name: "EUR"}));

    // Eine andere Köchin löscht die letzte EUR-Ausgabe (Realtime-Reload)
    view.rerender(
      <ExpenseEvaluation
        {...props}
        expenses={twoChfOneEur.filter(
          (remainingExpense) => remainingExpense.currency === "CHF",
        )}
      />,
    );

    expect(getTile(TEXT_EVALUATION_TOTAL)).toHaveTextContent(
      expectedAmount(15000, "CHF"),
    );
    expect(
      screen.queryByRole("group", {
        name: TEXT_EVALUATION_CURRENCY_FILTER_ARIA_LABEL,
      }),
    ).not.toBeInTheDocument();
  });
});

describe("ExpenseEvaluation, Kennzahl-Kacheln", () => {
  test("Gesamtausgaben mit Anzahl (Einzahl)", () => {
    renderEvaluation([createExpense({id: "e1", amountInCents: 12345})]);

    const totalTile = getTile(TEXT_EVALUATION_TOTAL);
    expect(totalTile).toHaveTextContent(expectedAmount(12345, "CHF"));
    expect(totalTile).toHaveTextContent(TEXT_EVALUATION_EXPENSE_COUNT(1));
  });

  test("Ø pro Person, pro Person & Tag und Rechengrundlage", () => {
    // 1680.00 / 24 Personen = 70.00; / 7 Anlasstage = 10.00
    renderEvaluation([createExpense({id: "e1", amountInCents: 168000})]);

    const averageTile = getTile(TEXT_EVALUATION_AVERAGE_PER_PARTICIPANT);
    expect(averageTile).toHaveTextContent(expectedAmount(7000, "CHF"));
    expect(averageTile).toHaveTextContent(
      normalizeSpaces(
        TEXT_EVALUATION_PER_PARTICIPANT_AND_DAY_SO_FAR(1000, "CHF"),
      ),
    );
    expect(averageTile).toHaveTextContent(
      TEXT_EVALUATION_CALCULATION_BASIS(24, 7),
    );
  });

  test("0 Teilnehmende: Hinweis statt Betrag, keine Zeile pro Tag", () => {
    renderEvaluation([createExpense({id: "e1", amountInCents: 168000})], {
      participantCount: 0,
    });

    const averageTile = getTile(TEXT_EVALUATION_AVERAGE_PER_PARTICIPANT);
    expect(averageTile).toHaveTextContent(TEXT_EVALUATION_PARTICIPANTS_MISSING);
    expect(averageTile).not.toHaveTextContent("CHF");
  });

  test("0 Anlasstage: Ø pro Person bleibt, Zeile pro Tag entfällt", () => {
    renderEvaluation([createExpense({id: "e1", amountInCents: 168000})], {
      eventDays: [],
    });

    const averageTile = getTile(TEXT_EVALUATION_AVERAGE_PER_PARTICIPANT);
    expect(averageTile).toHaveTextContent(expectedAmount(7000, "CHF"));
    expect(averageTile).not.toHaveTextContent(/pro Person & Tag/);
    expect(averageTile).toHaveTextContent(
      TEXT_EVALUATION_CALCULATION_BASIS(24, 0),
    );
    expect(averageTile).not.toHaveTextContent(/false/);
  });
});

describe("ExpenseEvaluation, fehlende Belege", () => {
  test("Hinweis mit Anzahl über alle Währungen", () => {
    renderEvaluation([
      createExpense({id: "chf-1"}),
      createExpense({id: "chf-2", attachmentPath: "evt/expenses/chf-2.pdf"}),
      createExpense({id: "eur-1", currency: "EUR"}),
    ]);

    expect(screen.getByRole("alert")).toHaveTextContent(
      TEXT_EVALUATION_WITHOUT_RECEIPT_COUNT(2),
    );
  });

  test("Hinweis bleibt beim Währungswechsel gleich", () => {
    renderEvaluation([
      createExpense({id: "chf-1"}),
      createExpense({id: "chf-2"}),
      createExpense({id: "eur-1", currency: "EUR"}),
    ]);

    fireEvent.click(screen.getByRole("button", {name: "EUR"}));

    expect(screen.getByRole("alert")).toHaveTextContent(
      TEXT_EVALUATION_WITHOUT_RECEIPT_COUNT(3),
    );
  });

  test("alle Belege vorhanden: kein Hinweis", () => {
    renderEvaluation([
      createExpense({id: "e1", attachmentPath: "evt/expenses/e1.pdf"}),
    ]);

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  test("«Anzeigen» im Hinweis ruft handleShowMissingReceipts genau einmal auf", () => {
    const {handleShowMissingReceipts} = renderEvaluation([
      createExpense({id: "e1"}),
    ]);

    fireEvent.click(
      within(screen.getByRole("alert")).getByRole("button", {
        name: TEXT_SHOW,
      }),
    );

    expect(handleShowMissingReceipts).toHaveBeenCalledTimes(1);
  });

  test("alle Belege vorhanden: auch kein «Anzeigen»", () => {
    renderEvaluation([
      createExpense({id: "e1", attachmentPath: "evt/expenses/e1.pdf"}),
    ]);

    expect(
      screen.queryByRole("button", {name: TEXT_SHOW}),
    ).not.toBeInTheDocument();
  });
});

describe("ExpenseEvaluation, grösste Ausgaben", () => {
  test("Zeilen absteigend nach Betrag, nur gewählte Währung", () => {
    renderEvaluation([
      createExpense({id: "small", amountInCents: 1000}),
      createExpense({id: "large", amountInCents: 9000}),
      createExpense({id: "medium", amountInCents: 5000}),
      createExpense({id: "eur", amountInCents: 99999, currency: "EUR"}),
    ]);

    const rows = within(
      screen.getByTestId("evaluation-top-expenses"),
    ).getAllByTestId(/^evaluation-top-expense-/);
    expect(rows.map((row) => row.dataset.testid)).toEqual([
      "evaluation-top-expense-large",
      "evaluation-top-expense-medium",
      "evaluation-top-expense-small",
    ]);
  });

  test("Zeile zeigt Bezeichnung, Betrag, Datum und Budgetname", () => {
    renderEvaluation([
      createExpense({
        id: "e1",
        label: "Grosseinkauf",
        amountInCents: 120000,
        budgetId: budget2.id,
        date: parseLocalDate("2026-07-03"),
      }),
    ]);

    const row = screen.getByTestId("evaluation-top-expense-e1");
    expect(row).toHaveTextContent("Grosseinkauf");
    expect(row).toHaveTextContent(expectedAmount(120000, "CHF"));
    expect(row).toHaveTextContent(`03.07.2026 · ${budget2.name}`);
  });

  test("Klick auf eine Zeile öffnet den Bearbeiten-Dialog dieser Ausgabe", () => {
    const {handleEditClick} = renderEvaluation([
      createExpense({id: "e1", amountInCents: 1000}),
      createExpense({id: "e2", amountInCents: 2000}),
    ]);

    fireEvent.click(screen.getByTestId("evaluation-top-expense-e1"));

    expect(handleEditClick).toHaveBeenCalledTimes(1);
    expect(handleEditClick).toHaveBeenCalledWith("e1");
  });
});

describe("getBudgetFilterLabel", () => {
  test("alle Budgets gewählt → «Alle Budgets»", () => {
    expect(getBudgetFilterLabel([budget, budget2], 2)).toBe(
      TEXT_EVALUATION_BUDGET_FILTER_ALL,
    );
  });

  test("genau ein Budget gewählt → dessen Name", () => {
    expect(getBudgetFilterLabel([budget2], 3)).toBe(budget2.name);
  });

  test("Teilauswahl mit mehreren → «2 von 3 Budgets»", () => {
    expect(getBudgetFilterLabel([budget, budget2], 3)).toBe(
      TEXT_EVALUATION_BUDGET_FILTER_PARTIAL(2, 3),
    );
    expect(TEXT_EVALUATION_BUDGET_FILTER_PARTIAL(2, 3)).toBe("2 von 3 Budgets");
  });
});

describe("getStatisticsScopeNote", () => {
  test("nichts ausgeblendet → null", () => {
    expect(getStatisticsScopeNote([], [])).toBeNull();
  });

  test("nur andere Währungen → nur Währungssatz", () => {
    expect(getStatisticsScopeNote(["EUR"], [])).toBe(
      "Ausgaben in EUR sind hier nicht enthalten.",
    );
  });

  test("nur abgewählte Budgets → nur Budgetsatz, Aufzählung mit «und»", () => {
    expect(getStatisticsScopeNote([], ["Motto", "Material", "Lagerbau"])).toBe(
      "Nicht berücksichtigte Budgets: Motto, Material und Lagerbau.",
    );
  });

  test("beides → zuerst Währungen, dann Budgets", () => {
    expect(getStatisticsScopeNote(["EUR", "USD"], ["Motto"])).toBe(
      "Ausgaben in EUR und USD sind hier nicht enthalten. " +
        "Nicht berücksichtigte Budgets: Motto.",
    );
  });
});

describe("BudgetFilter", () => {
  /**
   * Rendert den Budget-Filter mit drei Budgets.
   *
   * @param deselectedBudgetIds - Abgewählte Budget-IDs.
   * @returns Mocks der beiden Callbacks.
   */
  const renderBudgetFilter = (deselectedBudgetIds: string[] = []) => {
    const onToggleBudget = jest.fn();
    const onSelectAllBudgets = jest.fn();
    render(
      <BudgetFilter
        budgets={[budget, budget2, budget3]}
        deselectedBudgetIds={deselectedBudgetIds}
        onToggleBudget={onToggleBudget}
        onSelectAllBudgets={onSelectAllBudgets}
      />,
    );
    return {onToggleBudget, onSelectAllBudgets};
  };

  test("Button zeigt die Auswahl und ist als Menü-Auslöser ausgezeichnet", () => {
    renderBudgetFilter([budget3.id]);

    const button = getBudgetFilterButton();
    expect(button).toHaveTextContent(
      TEXT_EVALUATION_BUDGET_FILTER_PARTIAL(2, 3),
    );
    expect(button).toHaveAccessibleName(
      TEXT_EVALUATION_BUDGET_FILTER_ARIA_LABEL(
        TEXT_EVALUATION_BUDGET_FILTER_PARTIAL(2, 3),
      ),
    );
    expect(button).toHaveAttribute("aria-haspopup", "menu");
    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  test("unbekannte ID (gelöschtes Budget) zählt nicht als abgewählt", () => {
    renderBudgetFilter(["deleted-budget-id"]);

    expect(getBudgetFilterButton()).toHaveTextContent(
      TEXT_EVALUATION_BUDGET_FILTER_ALL,
    );
  });

  test("Klick öffnet das Menü: «Alle Budgets» und ein Eintrag pro Budget", () => {
    renderBudgetFilter([budget3.id]);

    fireEvent.click(getBudgetFilterButton());

    expect(screen.getByRole("menu")).toBeInTheDocument();
    expect(screen.getAllByRole("menuitemcheckbox")).toHaveLength(3);
    expect(getBudgetMenuItem(budget.name)).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(getBudgetMenuItem(budget2.name)).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(getBudgetMenuItem(budget3.name)).toHaveAttribute(
      "aria-checked",
      "false",
    );
  });

  test("Klick auf einen Eintrag meldet die Budget-ID", () => {
    const {onToggleBudget} = renderBudgetFilter();
    fireEvent.click(getBudgetFilterButton());

    fireEvent.click(getBudgetMenuItem(budget2.name));

    expect(onToggleBudget).toHaveBeenCalledTimes(1);
    expect(onToggleBudget).toHaveBeenCalledWith(budget2.id);
  });

  test("alle gewählt → «Alle Budgets» deaktiviert", () => {
    renderBudgetFilter();
    fireEvent.click(getBudgetFilterButton());

    expect(
      screen.getByRole("menuitem", {name: TEXT_EVALUATION_BUDGET_FILTER_ALL}),
    ).toHaveAttribute("aria-disabled", "true");
  });

  test("Filter aktiv → «Alle Budgets» aktiv und meldet den Klick", () => {
    const {onSelectAllBudgets} = renderBudgetFilter([budget2.id]);
    fireEvent.click(getBudgetFilterButton());

    const selectAllItem = screen.getByRole("menuitem", {
      name: TEXT_EVALUATION_BUDGET_FILTER_ALL,
    });
    expect(selectAllItem).not.toHaveAttribute("aria-disabled");
    fireEvent.click(selectAllItem);

    expect(onSelectAllBudgets).toHaveBeenCalledTimes(1);
  });

  test("letztes gewähltes Budget ist deaktiviert, die abgewählten nicht", () => {
    renderBudgetFilter([budget2.id, budget3.id]);
    fireEvent.click(getBudgetFilterButton());

    expect(getBudgetMenuItem(budget.name)).toHaveAttribute(
      "aria-disabled",
      "true",
    );
    expect(getBudgetMenuItem(budget2.name)).not.toHaveAttribute(
      "aria-disabled",
    );
    expect(getBudgetMenuItem(budget3.name)).not.toHaveAttribute(
      "aria-disabled",
    );
  });
});

describe("ExpenseEvaluation, Budget-Filter", () => {
  // Küche: CHF 100 + CHF 50; Motto: CHF 30 + EUR 20 (alle ohne Beleg)
  const kitchenAndThemeExpenses = [
    createExpense({id: "kitchen-1", amountInCents: 10000}),
    createExpense({id: "kitchen-2", amountInCents: 5000}),
    createExpense({id: "theme-1", amountInCents: 3000, budgetId: budget2.id}),
    createExpense({
      id: "theme-eur",
      amountInCents: 2000,
      budgetId: budget2.id,
      currency: "EUR",
    }),
  ];

  test("nur ein Budget → kein Budget-Filter", () => {
    renderEvaluation([createExpense({id: "kitchen-1"})], {budgets: [budget]});

    expect(
      screen.queryByRole("button", {
        name: BUDGET_FILTER_BUTTON_NAME,
      }),
    ).not.toBeInTheDocument();
  });

  test("Vorauswahl: alle Budgets, kein Budget-Hinweis", () => {
    renderEvaluation(kitchenAndThemeExpenses);

    expect(getBudgetFilterButton()).toHaveTextContent(
      TEXT_EVALUATION_BUDGET_FILTER_ALL,
    );
    expect(getTile(TEXT_EVALUATION_TOTAL)).toHaveTextContent(
      expectedAmount(18000, "CHF"),
    );
    expect(
      screen.queryByText(/Nicht berücksichtigte Budgets/),
    ).not.toBeInTheDocument();
  });

  test("Motto abwählen → Kennzahlen und Top-5 nur noch Küche, Button zeigt «Küche»", async () => {
    renderEvaluation(kitchenAndThemeExpenses);

    await clickBudgetMenuItems([budget2.name]);

    const totalTile = getTile(TEXT_EVALUATION_TOTAL);
    expect(totalTile).toHaveTextContent(expectedAmount(15000, "CHF"));
    expect(totalTile).toHaveTextContent(TEXT_EVALUATION_EXPENSE_COUNT(2));
    const rows = within(
      screen.getByTestId("evaluation-top-expenses"),
    ).getAllByTestId(/^evaluation-top-expense-/);
    expect(rows.map((row) => row.dataset.testid)).toEqual([
      "evaluation-top-expense-kitchen-1",
      "evaluation-top-expense-kitchen-2",
    ]);
    expect(getBudgetFilterButton()).toHaveTextContent(budget.name);
  });

  test("Motto abwählen → EUR-Chip verschwindet (Währungen aus der Auswahl, B4)", async () => {
    renderEvaluation(kitchenAndThemeExpenses);
    expect(
      screen.getByRole("group", {
        name: TEXT_EVALUATION_CURRENCY_FILTER_ARIA_LABEL,
      }),
    ).toBeInTheDocument();

    await clickBudgetMenuItems([budget2.name]);

    expect(
      screen.queryByRole("group", {
        name: TEXT_EVALUATION_CURRENCY_FILTER_ARIA_LABEL,
      }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(/sind hier nicht enthalten/),
    ).not.toBeInTheDocument();
  });

  test("Motto abwählen → Hinweis nennt das Budget, «Ohne Beleg» bleibt gleich", async () => {
    renderEvaluation(kitchenAndThemeExpenses);

    await clickBudgetMenuItems([budget2.name]);

    expect(
      screen.getByText(TEXT_EVALUATION_SCOPE_NOTE_BUDGETS([budget2.name])),
    ).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(
      TEXT_EVALUATION_WITHOUT_RECEIPT_COUNT(4),
    );
  });

  test("Hinweiszeile ist eine Live-Region, auch solange sie leer ist", async () => {
    renderEvaluation([createExpense({id: "kitchen-1"})]);
    const liveRegion = screen
      .getByTestId("expense-tracking-evaluation")
      .querySelector("[aria-live='polite']");
    expect(liveRegion).toBeInTheDocument();
    expect(liveRegion).toBeEmptyDOMElement();

    await clickBudgetMenuItems([budget2.name]);

    expect(liveRegion).toHaveTextContent(
      TEXT_EVALUATION_SCOPE_NOTE_BUDGETS([budget2.name]),
    );
  });

  test("«Alle Budgets» → wieder alles gewählt, Hinweis weg", async () => {
    renderEvaluation(kitchenAndThemeExpenses);
    await clickBudgetMenuItems([budget2.name]);

    await clickBudgetMenuItems([TEXT_EVALUATION_BUDGET_FILTER_ALL]);

    expect(getBudgetFilterButton()).toHaveTextContent(
      TEXT_EVALUATION_BUDGET_FILTER_ALL,
    );
    expect(getTile(TEXT_EVALUATION_TOTAL)).toHaveTextContent(
      expectedAmount(18000, "CHF"),
    );
    expect(
      screen.queryByText(/Nicht berücksichtigte Budgets/),
    ).not.toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null")).toEqual([]);
  });

  test("nur ein Budget ohne Ausgaben gewählt → Hinweis statt Kacheln", async () => {
    renderEvaluation([createExpense({id: "kitchen-1"})]);

    await clickBudgetMenuItems([budget.name]);

    expect(
      screen.getByText(TEXT_EVALUATION_NO_EXPENSES_IN_SELECTED_BUDGETS),
    ).toBeInTheDocument();
    expect(screen.queryByText(TEXT_EVALUATION_TOTAL)).not.toBeInTheDocument();
    expect(getBudgetFilterButton()).toBeInTheDocument();
  });

  test("Abwahl wird unter dem Schlüssel des Anlasses gespeichert", async () => {
    renderEvaluation(kitchenAndThemeExpenses);

    await clickBudgetMenuItems([budget2.name]);

    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null")).toEqual([
      budget2.id,
    ]);
  });

  test("gespeicherte Abwahl gilt schon beim ersten Rendern", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([budget2.id]));

    renderEvaluation(kitchenAndThemeExpenses);

    expect(getBudgetFilterButton()).toHaveTextContent(budget.name);
    expect(getTile(TEXT_EVALUATION_TOTAL)).toHaveTextContent(
      expectedAmount(15000, "CHF"),
    );
  });

  test("Abwahl eines anderen Anlasses hat keine Wirkung", () => {
    localStorage.setItem(
      `${LocalStorageKey.EXPENSE_EVALUATION_EXCLUDED_BUDGETS}_other-event`,
      JSON.stringify([budget2.id]),
    );

    renderEvaluation(kitchenAndThemeExpenses);

    expect(getBudgetFilterButton()).toHaveTextContent(
      TEXT_EVALUATION_BUDGET_FILTER_ALL,
    );
  });

  test("neues Budget (Rerender, nicht im Speicher) ist ausgewählt (B3)", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([budget2.id]));
    const {view, props} = renderEvaluation(kitchenAndThemeExpenses);

    // Eine andere Köchin legt «Material» mit einer Ausgabe an (Realtime)
    view.rerender(
      <ExpenseEvaluation
        {...props}
        budgets={[budget, budget2, budget3]}
        expenses={[
          ...kitchenAndThemeExpenses,
          createExpense({
            id: "material-1",
            amountInCents: 1000,
            budgetId: budget3.id,
          }),
        ]}
      />,
    );

    expect(getBudgetFilterButton()).toHaveTextContent(
      TEXT_EVALUATION_BUDGET_FILTER_PARTIAL(2, 3),
    );
    expect(getTile(TEXT_EVALUATION_TOTAL)).toHaveTextContent(
      expectedAmount(16000, "CHF"),
    );
  });
});

describe("ExpenseEvaluation, Ausgabenverlauf", () => {
  // Küche (Soll CHF 10): CHF 100 am 5.7., CHF 50 am 7.7.
  // Motto (Soll CHF 50): CHF 30 am 6.7., EUR 20 am 6.7.
  const historyExpenses = [
    createExpense({id: "kitchen-1", amountInCents: 10000}),
    createExpense({
      id: "kitchen-2",
      amountInCents: 5000,
      date: parseLocalDate("2026-07-07"),
    }),
    createExpense({
      id: "theme-1",
      amountInCents: 3000,
      budgetId: budget2.id,
      date: parseLocalDate("2026-07-06"),
    }),
    createExpense({
      id: "theme-eur",
      amountInCents: 2000,
      budgetId: budget2.id,
      currency: "EUR",
      date: parseLocalDate("2026-07-06"),
    }),
  ];

  test("ohne Ausgaben kein Diagramm", () => {
    renderEvaluation([]);

    expect(screen.queryByTestId("line-chart")).not.toBeInTheDocument();
  });

  test("Ist kumuliert bis heute, letzter Wert = Gesamtausgaben", () => {
    renderEvaluation(historyExpenses);

    const {actualValues} = getLastHistorySeries();
    expect(actualValues).toEqual([10000, 13000, 18000, null, null, null, null]);
    expect(getTile(TEXT_EVALUATION_TOTAL)).toHaveTextContent(
      expectedAmount(18000, "CHF"),
    );
  });

  test("Soll aus allen ausgewählten Budgets, linear bis zum letzten Anlasstag", () => {
    renderEvaluation(historyExpenses);

    // Küche 1000 + Motto 5000 = 6000 Rappen über 7 Tage
    const {targetValues} = getLastHistorySeries();
    expect(targetValues).toHaveLength(7);
    expect(targetValues?.[6]).toEqual(6000);
  });

  test("Budget abwählen → Ist und Soll ohne dieses Budget", async () => {
    renderEvaluation(historyExpenses);

    await clickBudgetMenuItems([budget2.name]);

    const {actualValues, targetValues} = getLastHistorySeries();
    expect(actualValues).toEqual([10000, 10000, 15000, null, null, null, null]);
    expect(targetValues?.[6]).toEqual(1000);
  });

  test("Wechsel auf EUR → Ist nur in EUR, kein Soll ohne EUR-Budget", () => {
    renderEvaluation(historyExpenses);

    fireEvent.click(screen.getByRole("button", {name: "EUR"}));

    const {actualValues, targetValues} = getLastHistorySeries();
    expect(actualValues).toEqual([0, 2000, 2000, null, null, null, null]);
    expect(targetValues).toBeNull();
  });

  test("Textzeile in der gewählten Währung (auch ohne Klick auf eine Währung)", () => {
    renderEvaluation(historyExpenses);

    expect(screen.getByText(/^Stand Anlasstag 3 von 7:/)).toHaveTextContent(
      expectedAmount(18000, "CHF"),
    );
  });
});
