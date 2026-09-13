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
  donations: {
    getEventDonations: jest.fn().mockResolvedValue([]),
  },
} as any;

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

  return render(<EventExpenseTrackingPage {...defaultProps} {...overrides} />);
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
});
