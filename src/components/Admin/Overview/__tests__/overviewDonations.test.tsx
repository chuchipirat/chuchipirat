/**
 * Unit-Tests für Admin/Overview/overviewDonations.tsx.
 *
 * Fokus: Die "Total dieses Jahr"-Statistikkarte muss tatsächlich nach dem
 * aktuellen Jahr filtern (paidAt) und migrierte Spenden wie bestätigte
 * mitzählen — beides war zuvor fehlerhaft (kein Jahresfilter, migrated
 * fehlte in der Summe).
 */
import {TextEncoder, TextDecoder} from "util";
Object.assign(global, {TextEncoder, TextDecoder});

import React from "react";
import {render, screen, waitFor, within} from "@testing-library/react";
import "@testing-library/jest-dom";
import {MemoryRouter} from "react-router";

import OverviewDonationsPage from "../overviewDonations";
import {DatabaseContext} from "../../../Database/DatabaseContext";
import {DonationDomain, DonationStatus} from "../../../Donate/donation.types";
import {DONATION_TOTAL_THIS_YEAR} from "../../../../constants/text/donations";

/* ===================================================================
// ======================== Mocks =====================================
// =================================================================== */

jest.mock("../../../../constants/styles", () => ({
  useCustomStyles: jest.fn(() => ({})),
}));

jest.mock("../../../Session/authUserContext", () => ({
  useAuthUser: () => ({
    uid: "admin-uid",
    email: "admin@test.ch",
    publicProfile: {displayName: "Admin"},
  }),
}));

/** Aktuelles Jahr, um die Testdaten unabhängig vom Ausführungsdatum zu halten. */
const CURRENT_YEAR = new Date().getFullYear();
const LAST_YEAR = CURRENT_YEAR - 1;

/**
 * Erstellt ein minimales DonationDomain-Testobjekt.
 *
 * @param overrides - Felder, die vom Standardwert abweichen sollen.
 */
const createDonationMock = (
  overrides: Partial<DonationDomain> = {},
): DonationDomain => ({
  id: "donation-1",
  eventId: null,
  paymentGatewayId: null,
  paymentReferenceId: null,
  paymentTransactionId: null,
  amountInCents: 5000,
  currency: "CHF",
  status: DonationStatus.confirmed,
  paymentMethod: "twint",
  paidAt: new Date(`${CURRENT_YEAR}-03-15`),
  donorUid: "donor-1",
  donorMessage: null,
  receiptNumber: "2026-0001",
  receiptSentAt: null,
  createdAt: new Date(`${CURRENT_YEAR}-03-15`),
  donorDisplayName: "Test Spender",
  eventName: "Sommerlager",
  ...overrides,
});

const mockGetAllDonations = jest.fn();

const mockDatabase: any = {
  donations: {getAllDonations: mockGetAllDonations},
};

const renderPage = () =>
  render(
    <MemoryRouter>
      <DatabaseContext.Provider value={mockDatabase}>
        <OverviewDonationsPage />
      </DatabaseContext.Provider>
    </MemoryRouter>,
  );

/**
 * Liest den Wert der "Total dieses Jahr"-Karte aus, unabhängig von anderen
 * Karten (z.B. "⌀ Spende"), die zufällig denselben Text zeigen können.
 */
const findTotalThisYearValue = async (): Promise<string> => {
  const label = await screen.findByText(DONATION_TOTAL_THIS_YEAR);
  const card = label.closest(".MuiCardContent-root") as HTMLElement;
  return within(card).getByRole("heading").textContent ?? "";
};

beforeEach(() => {
  jest.clearAllMocks();
});

/* ===================================================================
// ======================== Tests =====================================
// =================================================================== */

test("1 – getAllDonations wird beim Mount aufgerufen", async () => {
  mockGetAllDonations.mockResolvedValue([]);
  renderPage();

  await waitFor(() => {
    expect(mockGetAllDonations).toHaveBeenCalledTimes(1);
  });
});

test("2 – 'Total dieses Jahr' zählt nur Spenden mit paidAt im aktuellen Jahr", async () => {
  mockGetAllDonations.mockResolvedValue([
    createDonationMock({id: "d1", amountInCents: 5000, paidAt: new Date(`${CURRENT_YEAR}-03-15`)}),
    createDonationMock({id: "d2", amountInCents: 10000, paidAt: new Date(`${LAST_YEAR}-03-15`)}),
  ]);
  renderPage();

  // Nur die 50.00 aus diesem Jahr, nicht die 100.00 aus dem Vorjahr
  expect(await findTotalThisYearValue()).toBe("CHF 50.00");
});

test("3 – 'Total dieses Jahr' zählt migrierte Spenden wie bestätigte mit", async () => {
  mockGetAllDonations.mockResolvedValue([
    createDonationMock({id: "d1", status: DonationStatus.confirmed, amountInCents: 5000}),
    createDonationMock({id: "d2", status: DonationStatus.migrated, amountInCents: 3000}),
  ]);
  renderPage();

  expect(await findTotalThisYearValue()).toBe("CHF 80.00");
});

test("4 – 'Total dieses Jahr' schliesst ausstehende Spenden aus", async () => {
  mockGetAllDonations.mockResolvedValue([
    createDonationMock({id: "d1", status: DonationStatus.confirmed, amountInCents: 5000}),
    createDonationMock({id: "d2", status: DonationStatus.pending, amountInCents: 9000}),
  ]);
  renderPage();

  expect(await findTotalThisYearValue()).toBe("CHF 50.00");
});
