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
import {render, screen} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom";
import {MemoryRouter} from "react-router";

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

import {DonationResultPage} from "../DonationResult";

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
      <DonationResultPage />
    </MemoryRouter>,
  );
};

/* ===================================================================
// Tests
// =================================================================== */

describe("DonationResultPage", () => {
  beforeEach(() => {
    mockNavigate.mockClear();
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
