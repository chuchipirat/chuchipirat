/**
 * Unit-Tests fuer DonatePage.
 *
 * Testet die Rendering-Struktur der Hauptspendenseite:
 * PageTitle, DonationGoalWidget, DonationForm und Authentifizierungsguard.
 */
// Polyfill fuer jsdom (react-router benoetigt TextEncoder/TextDecoder)
import {TextEncoder, TextDecoder} from "util";
Object.assign(global, {TextEncoder, TextDecoder});

import React from "react";
import {render, screen} from "@testing-library/react";
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

/** Mock: useAuthUser — standardmaessig authentifiziert. */
const mockAuthUser = {
  uid: "auth-uuid-123",
  email: "test@chuchipirat.ch",
  roles: [],
  publicProfile: {
    displayName: "Test Koch",
    motto: "Testmotto",
    pictureSrc: "",
  },
};

let authUserValue: typeof mockAuthUser | null = mockAuthUser;

jest.mock("../../Session/authUserContext", () => ({
  useAuthUser: () => authUserValue,
}));

/** Mock: PageTitle — Stub-Komponente. */
jest.mock("../../Shared/pageTitle", () => ({
  PageTitle: ({title, subTitle}: {title: string; subTitle: string}) => (
    <div data-testid="page-title">
      {title} - {subTitle}
    </div>
  ),
}));

/** Mock: DonationGoalWidget — Stub-Komponente. */
jest.mock("../DonationGoalWidget", () => ({
  DonationGoalWidget: () => (
    <div data-testid="donation-goal-widget">DonationGoalWidget</div>
  ),
}));

/** Mock: DonationForm — Stub-Komponente. */
jest.mock("../DonationForm", () => ({
  DonationForm: ({returnPath}: {returnPath?: string}) => (
    <div data-testid="donation-form">DonationForm returnPath={returnPath}</div>
  ),
}));

import {DonatePage} from "../DonatePage";

/* ===================================================================
// Hilfs-Render-Funktion
// =================================================================== */

/**
 * Rendert DonatePage in einem MemoryRouter.
 */
const renderDonatePage = () => {
  return render(
    <MemoryRouter>
      <DonatePage />
    </MemoryRouter>,
  );
};

/* ===================================================================
// Tests
// =================================================================== */

describe("DonatePage", () => {
  beforeEach(() => {
    authUserValue = mockAuthUser;
  });

  /* ----- Seitenstruktur ----- */

  describe("Seitenstruktur", () => {
    test("rendert den Seitentitel mit Titel und Untertitel", () => {
      renderDonatePage();

      const pageTitle = screen.getByTestId("page-title");
      expect(pageTitle).toBeInTheDocument();
      expect(pageTitle).toHaveTextContent("Spenden");
      expect(pageTitle).toHaveTextContent("Merci 1000");
    });

    test("enthaelt das DonationGoalWidget", () => {
      renderDonatePage();

      expect(screen.getByTestId("donation-goal-widget")).toBeInTheDocument();
    });

    test("enthaelt das DonationForm", () => {
      renderDonatePage();

      expect(screen.getByTestId("donation-form")).toBeInTheDocument();
    });

    test("uebergibt returnPath='/donate' an DonationForm", () => {
      renderDonatePage();

      expect(screen.getByTestId("donation-form")).toHaveTextContent(
        "returnPath=/donate",
      );
    });
  });

  /* ----- Authentifizierung ----- */

  describe("Authentifizierung", () => {
    test("gibt null zurueck wenn nicht authentifiziert", () => {
      authUserValue = null;

      const {container} = renderDonatePage();
      expect(container.innerHTML).toBe("");
    });
  });
});
