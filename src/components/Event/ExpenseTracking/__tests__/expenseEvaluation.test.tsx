/**
 * Unit-Tests für die Ansicht «Auswertung» (expenseEvaluation.tsx).
 *
 * Reine Anzeige-Komponente (Story 6.2a), darum ohne Contexts: Props direkt.
 * Schwerpunkte: leerer Zustand, Währungsauswahl inkl. Rückfall (W4),
 * Kennzahl-Kacheln, Hinweis auf fehlende Belege und die Top-5-Liste.
 */
import React from "react";
import {fireEvent, render, screen, within} from "@testing-library/react";
import "@testing-library/jest-dom";

import {ExpenseEvaluation} from "../expenseEvaluation";
import {ExpenseDomain} from "../expense.types";
import {expense} from "../__mocks__/expense.mock";
import {budget, budget2} from "../__mocks__/budget.mock";
import {parseLocalDate} from "../../../../utils/dateUtils";
import {formatAmountFromCents} from "../../../Shared/utils/currencyUtils";

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
  EVALUATION_OTHER_CURRENCIES_EXCLUDED as TEXT_EVALUATION_OTHER_CURRENCIES_EXCLUDED,
} from "../../../../constants/text/expenseTracking";

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

/**
 * Rendert die Auswertung mit Standardwerten (24 Personen, 7 Anlasstage).
 *
 * @param expenses - Ausgaben des Anlasses.
 * @param overrides - Weitere Props, die vom Standard abweichen sollen.
 * @returns Render-Ergebnis und Mock des Bearbeiten-Klicks.
 */
const renderEvaluation = (
  expenses: ExpenseDomain[],
  overrides: Partial<React.ComponentProps<typeof ExpenseEvaluation>> = {},
) => {
  const handleEditClick = jest.fn();
  const props = {
    expenses,
    budgets,
    participantCount: 24,
    campDayCount: 7,
    handleEditClick,
    ...overrides,
  };
  const view = render(<ExpenseEvaluation {...props} />);
  return {view, props, handleEditClick};
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
      screen.getByText(TEXT_EVALUATION_OTHER_CURRENCIES_EXCLUDED(["EUR"])),
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
      screen.getByText(TEXT_EVALUATION_OTHER_CURRENCIES_EXCLUDED(["CHF"])),
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
      campDayCount: 0,
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
