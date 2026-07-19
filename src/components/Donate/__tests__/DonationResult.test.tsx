/**
 * Unit-Tests fuer DonationResultPage.
 *
 * Testet die korrekte Darstellung der verschiedenen Zahlungsstatus
 * (success, failed, cancel, unknown) und die Navigation via Weiter-Button.
 */
// Polyfill fuer jsdom (react-router benoetigt TextEncoder/TextDecoder)
import {TextEncoder, TextDecoder} from "util";
Object.assign(global, {TextEncoder, TextDecoder});

import React from "react";
import {render, screen, waitFor} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom";
import {MemoryRouter} from "react-router";
import {DatabaseContext} from "../../Database/DatabaseContext";
import {AuthUserContext} from "../../Session/authUserContext";
import {AuthUser} from "../../Firebase/Authentication/authUser.class";

/* ===================================================================
// Mock-Setup
// =================================================================== */

/** Mock: useCustomStyles */
jest.mock("../../../constants/styles", () => ({
  useCustomStyles: () => ({
    container: {},
    card: {},
    cardContent: {},
  }),
}));

/** Mock: PageTitle */
jest.mock("../../Shared/pageTitle", () => ({
  PageTitle: ({title, subTitle}: {title: string; subTitle: string}) => (
    <div data-testid="page-title">
      {title} - {subTitle}
    </div>
  ),
}));

/** Mock: useNavigate — merkt sich den letzten Aufruf. */
const mockNavigate = jest.fn();
jest.mock("react-router", () => {
  const actual = jest.requireActual("react-router");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

/** Mock: trackEvent (Umami) */
const mockTrackEvent = jest.fn();
jest.mock("../../Analytics/analyticsService", () => ({
  trackEvent: (...args: unknown[]) => mockTrackEvent(...args),
}));

import {DonationResultPage} from "../DonationResult";

/* ===================================================================
// Mock-DatabaseService
// =================================================================== */

/** Mock für database.donations.cancelOwnPendingDonation */
const mockCancelOwnPendingDonation = jest.fn().mockResolvedValue(undefined);

const mockDatabase = {
  donations: {
    cancelOwnPendingDonation: mockCancelOwnPendingDonation,
  },
} as unknown as import("../../Database/DatabaseService").default;

/** Mock: eingeloggter authUser (Route ist guard: isAuthenticated) */
const mockAuthUser = new AuthUser();
mockAuthUser.uid = "test-user-uid";

/* ===================================================================
// Hilfs-Render-Funktion
// =================================================================== */

/**
 * Rendert DonationResultPage mit den uebergebenen URL-Parametern.
 *
 * @param searchParams URL-Parameter als String (z.B. "?status=success").
 */
const renderResult = (searchParams: string = "") => {
  return render(
    <MemoryRouter initialEntries={[`/donate/result${searchParams}`]}>
      <DatabaseContext.Provider value={mockDatabase}>
        <AuthUserContext.Provider value={mockAuthUser}>
          <DonationResultPage />
        </AuthUserContext.Provider>
      </DatabaseContext.Provider>
    </MemoryRouter>,
  );
};

/* ===================================================================
// Tests
// =================================================================== */

describe("DonationResultPage", () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    mockCancelOwnPendingDonation.mockClear();
    mockTrackEvent.mockClear();
  });

  /* ----- Status: success ----- */

  describe("Status: success", () => {
    test("zeigt Danke-Titel und Bestaetigungstext an", () => {
      renderResult("?status=success");

      expect(
        screen.getByText("Vielen Dank für deine Spende!"),
      ).toBeInTheDocument();
      expect(
        screen.getByText(/Deine Zahlung wird verarbeitet/),
      ).toBeInTheDocument();
    });

    test("zeigt ein Check-Icon an (success.main Farbe)", () => {
      renderResult("?status=success");

      // Das CheckCircleOutline-Icon wird als SVG gerendert (data-testid=CheckCircleOutlineIcon)
      const icon = document.querySelector("[data-testid='CheckCircleOutlineIcon']");
      expect(icon).toBeInTheDocument();
    });
  });

  /* ----- Status: failed ----- */

  describe("Status: failed", () => {
    test("zeigt Fehler-Titel und Fehlertext an", () => {
      renderResult("?status=failed");

      expect(
        screen.getByText("Zahlung konnte nicht verarbeitet werden"),
      ).toBeInTheDocument();
      expect(
        screen.getByText(/Leider ist bei der Zahlung ein Fehler aufgetreten/),
      ).toBeInTheDocument();
    });

    test("zeigt ein Error-Icon an", () => {
      renderResult("?status=failed");

      const icon = document.querySelector("[data-testid='ErrorOutlineIcon']");
      expect(icon).toBeInTheDocument();
    });
  });

  /* ----- Status: cancel ----- */

  describe("Status: cancel", () => {
    test("zeigt Abbruch-Titel und Abbruchtext an", () => {
      renderResult("?status=cancel");

      expect(screen.getByText("Zahlung abgebrochen")).toBeInTheDocument();
      expect(
        screen.getByText(/Du hast die Zahlung abgebrochen/),
      ).toBeInTheDocument();
    });

    test("zeigt ein Warning-Icon an", () => {
      renderResult("?status=cancel");

      const icon = document.querySelector("[data-testid='WarningAmberIcon']");
      expect(icon).toBeInTheDocument();
    });

    test("markiert die eigene Spende als abgebrochen (kein Webhook bei Checkout-Abbruch)", async () => {
      renderResult("?status=cancel&donationId=test-donation-id");

      await waitFor(() => {
        expect(mockCancelOwnPendingDonation).toHaveBeenCalledWith(
          "test-donation-id",
        );
      });
    });

    test("ruft die RPC nicht auf, wenn keine donationId in der URL ist", () => {
      renderResult("?status=cancel");

      expect(mockCancelOwnPendingDonation).not.toHaveBeenCalled();
    });

    test("trackt entgangenen Umsatz separat von DONATION_COMPLETED", () => {
      renderResult("?status=cancel&amount=1500");

      expect(mockTrackEvent).toHaveBeenCalledWith("donation_cancelled", {
        amount: 15,
        currency: "CHF",
        userId: "test-user-uid",
      });
    });

    test("trackt eventId nur wenn in der URL vorhanden", () => {
      renderResult("?status=cancel&amount=1500&eventId=event-123");

      expect(mockTrackEvent).toHaveBeenCalledWith("donation_cancelled", {
        eventId: "event-123",
        amount: 15,
        currency: "CHF",
        userId: "test-user-uid",
      });
    });
  });

  /* ----- Status: unknown ----- */

  describe("Status: unknown / fehlend", () => {
    test("zeigt Fallback-Titel bei unbekanntem Status", () => {
      renderResult("?status=xyz");

      expect(screen.getByText("Unbekannter Status")).toBeInTheDocument();
      expect(
        screen.getByText(/Status der Zahlung konnte nicht ermittelt werden/),
      ).toBeInTheDocument();
    });

    test("zeigt Fallback-Titel wenn kein Status-Parameter vorhanden", () => {
      renderResult();

      expect(screen.getByText("Unbekannter Status")).toBeInTheDocument();
    });
  });

  /* ----- Navigation ----- */

  describe("Weiter-Button", () => {
    test("navigiert zum return-Parameter", async () => {
      renderResult("?status=success&return=%2Fdonate");

      const continueButton = screen.getByRole("button", {name: "Weiter"});
      await userEvent.click(continueButton);

      expect(mockNavigate).toHaveBeenCalledWith("/donate");
    });

    test("navigiert standardmaessig zu /home wenn kein return-Parameter", async () => {
      renderResult("?status=success");

      const continueButton = screen.getByRole("button", {name: "Weiter"});
      await userEvent.click(continueButton);

      expect(mockNavigate).toHaveBeenCalledWith("/home");
    });
  });
});
