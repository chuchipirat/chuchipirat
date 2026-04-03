/**
 * Unit-Tests fuer DonationGoalWidget.
 *
 * Testet Skeleton-Ladeanzeige, Leerstand, Fortschrittsbalken,
 * Zielerreichung und Spender-Statistik.
 */
// Polyfill fuer jsdom (react-router benoetigt TextEncoder/TextDecoder)
import {TextEncoder, TextDecoder} from "util";
Object.assign(global, {TextEncoder, TextDecoder});

import React from "react";
import {render, screen, waitFor} from "@testing-library/react";
import "@testing-library/jest-dom";

import {DonationGoalSection, DonationGoalStats} from "../donation.types";

/* ===================================================================
// Mock-Setup
// =================================================================== */

/** Mock: getGoalSections und getDonationGoalStats. */
const mockGetGoalSections = jest.fn();
const mockGetDonationGoalStats = jest.fn();

/** Mock: useDatabase — liefert das donations-Repository. */
jest.mock("../../Database/DatabaseContext", () => ({
  useDatabase: () => ({
    donations: {
      getGoalSections: mockGetGoalSections,
      getDonationGoalStats: mockGetDonationGoalStats,
    },
  }),
}));

import {DonationGoalWidget} from "../DonationGoalWidget";

/* ===================================================================
// Testdaten
// =================================================================== */

/** Beispiel-Abschnitte mit 2 Sektionen. */
const mockSections: DonationGoalSection[] = [
  {id: "s1", label: "Server & Betrieb", targetCents: 40000, sortOrder: 1, year: 2026, details: "Server, Domain, E-Mail Service usw."},
  {id: "s2", label: "Vereinskosten", targetCents: 20000, sortOrder: 2, year: 2026, details: "Administration, Kontoführungsgebühren usw."},
];

/** Statistik: 400 CHF gesammelt, 5 Spender, 8 Spenden. */
const mockStats: DonationGoalStats = {
  totalCents: 40000,
  donorCount: 5,
  donationCount: 8,
};

/** Statistik: Ziel uebertroffen (>= 60000). */
const mockStatsGoalReached: DonationGoalStats = {
  totalCents: 70000,
  donorCount: 12,
  donationCount: 20,
};

/* ===================================================================
// Hilfs-Render-Funktion
// =================================================================== */

/**
 * Rendert DonationGoalWidget und wartet, bis das Laden abgeschlossen ist.
 */
const renderWidget = async () => {
  render(<DonationGoalWidget />);
  // Warten, bis useEffect-Laden abgeschlossen
  await waitFor(() => {
    expect(mockGetGoalSections).toHaveBeenCalled();
  });
};

/* ===================================================================
// Tests
// =================================================================== */

describe("DonationGoalWidget", () => {
  beforeEach(() => {
    mockGetGoalSections.mockReset();
    mockGetDonationGoalStats.mockReset();
  });

  /* ----- Ladeanzeige ----- */

  describe("Ladezustand", () => {
    test("zeigt Skeleton-Elemente waehrend des Ladens", () => {
      // Promises nicht aufloesen — bleibt im Ladezustand
      mockGetGoalSections.mockReturnValue(new Promise(() => {}));
      mockGetDonationGoalStats.mockReturnValue(new Promise(() => {}));

      render(<DonationGoalWidget />);

      // MUI Skeleton rendert role="progressbar" nicht; prüfen via DOM-Klassen
      const skeletons = document.querySelectorAll(".MuiSkeleton-root");
      expect(skeletons.length).toBeGreaterThanOrEqual(1);
    });
  });

  /* ----- Leerstand ----- */

  describe("Keine Daten", () => {
    test("rendert nichts wenn keine Abschnitte vorhanden", async () => {
      mockGetGoalSections.mockResolvedValue([]);
      mockGetDonationGoalStats.mockResolvedValue(mockStats);

      const {container} = render(<DonationGoalWidget />);

      await waitFor(() => {
        expect(mockGetGoalSections).toHaveBeenCalled();
      });

      // Nach dem Laden: Widget sollte leer sein (null)
      await waitFor(() => {
        expect(container.querySelector(".MuiSkeleton-root")).toBeNull();
      });

      // Kein Titel sichtbar
      expect(screen.queryByText("Spendenziel")).not.toBeInTheDocument();
    });
  });

  /* ----- Spendenappell und Kostenaufschlüsselung ----- */

  describe("Spendenappell und Kostenaufschlüsselung", () => {
    test("zeigt Appell-Text an", async () => {
      mockGetGoalSections.mockResolvedValue(mockSections);
      mockGetDonationGoalStats.mockResolvedValue(mockStats);

      await renderWidget();

      await waitFor(() => {
        expect(
          screen.getByText(/ehrenamtlich entwickelt/),
        ).toBeInTheDocument();
      });
    });

    test("zeigt Kostenaufschlüsselungs-Labels an", async () => {
      mockGetGoalSections.mockResolvedValue(mockSections);
      mockGetDonationGoalStats.mockResolvedValue(mockStats);

      await renderWidget();

      await waitFor(() => {
        expect(
          screen.getByText(/Server & Betrieb.*CHF 400/),
        ).toBeInTheDocument();
        expect(
          screen.getByText(/Vereinskosten.*CHF 200/),
        ).toBeInTheDocument();
      });
    });

    test("zeigt 'Weitere Details'-Link an", async () => {
      mockGetGoalSections.mockResolvedValue(mockSections);
      mockGetDonationGoalStats.mockResolvedValue(mockStats);

      await renderWidget();

      await waitFor(() => {
        const link = screen.getByText(/Klicke hier für weitere Details/);
        expect(link).toBeInTheDocument();
        expect(link.closest("a")).toHaveAttribute(
          "href",
          expect.stringContaining("cost_transparency"),
        );
      });
    });

    test("zeigt Fortschrittsbalken-Caption mit Jahresziel", async () => {
      mockGetGoalSections.mockResolvedValue(mockSections);
      mockGetDonationGoalStats.mockResolvedValue(mockStats);

      await renderWidget();

      const currentYear = new Date().getFullYear();
      await waitFor(() => {
        expect(
          screen.getByText(new RegExp(`Jahresziel ${currentYear}`)),
        ).toBeInTheDocument();
      });
    });
  });

  /* ----- Ziel erreicht ----- */

  describe("Zielerreichung", () => {
    test("zeigt 'Jahresziel erreicht!' wenn total >= target", async () => {
      mockGetGoalSections.mockResolvedValue(mockSections);
      mockGetDonationGoalStats.mockResolvedValue(mockStatsGoalReached);

      await renderWidget();

      await waitFor(() => {
        expect(
          screen.getByText(/Jahresziel erreicht!/),
        ).toBeInTheDocument();
      });
    });

    test("zeigt Fortschritt-Text wenn total < target", async () => {
      mockGetGoalSections.mockResolvedValue(mockSections);
      mockGetDonationGoalStats.mockResolvedValue(mockStats);

      await renderWidget();

      const currentYear = new Date().getFullYear();
      await waitFor(() => {
        expect(
          screen.getByText(new RegExp(`Jahresziel ${currentYear}`)),
        ).toBeInTheDocument();
      });

      expect(
        screen.queryByText(/Jahresziel erreicht!/),
      ).not.toBeInTheDocument();
    });
  });
});
