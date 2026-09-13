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
import {render, screen} from "@testing-library/react";
import "@testing-library/jest-dom";

import {EventExpenseTrackingPage} from "../expenseTracking";
import {getHelpPageUrl} from "../../../Navigation/helpCenter";
import {AuthUserContext} from "../../../Session/authUserContext";
import AuthUser from "../../../Session/authUser.class";
import {Budget} from "../budget.class";
import {BudgetType} from "../budget.types";

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

const mockDatabase = {
  donations: {getEventDonations: jest.fn().mockResolvedValue([])},
  budgets: {
    getBudgetsForEvent: jest.fn().mockResolvedValue([]),
    createBudget: jest.fn(),
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
});

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
    };
    mockDatabase.budgets.getBudgetsForEvent.mockResolvedValueOnce([
      existingBudget,
    ]);

    renderEventExpenseTrackingPage();

    expect(
      await screen.findByText(existingBudget.budgetType),
    ).toBeInTheDocument();
    expect(mockDatabase.budgets.createBudget).not.toHaveBeenCalled();
  });

  test("Neues Budget wird erstellt, wenn noch keines Vorhanden", async () => {
    mockDatabase.donations.getEventDonations.mockResolvedValueOnce([{}]);
    mockDatabase.budgets.getBudgetsForEvent.mockResolvedValueOnce([]);
    const defaultBudget = Budget.createDefaultKitchenBudget(mockEvent.uid);
    mockDatabase.budgets.createBudget.mockResolvedValueOnce({
      id: "new-budget-001",
      value: {...defaultBudget, id: "new-budget-001"},
    });

    renderEventExpenseTrackingPage();

    expect(
      await screen.findByText(defaultBudget.budgetType),
    ).toBeInTheDocument();
    expect(mockDatabase.budgets.createBudget).toHaveBeenCalledWith(
      defaultBudget,
      mockAuthUser,
    );
  });
});
