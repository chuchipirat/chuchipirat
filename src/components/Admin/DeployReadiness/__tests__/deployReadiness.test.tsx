/**
 * Unit-Tests für die Deploy-Check-Seite (DeployReadinessPage).
 *
 * Prüft die zwei getrennten Fragen: laufende Lager heute und Personen,
 * die gerade arbeiten — inklusive Leerzuständen, Navigation und Auto-Refresh.
 */
// Polyfill für jsdom (react-router benötigt TextEncoder/TextDecoder)
import {TextEncoder, TextDecoder} from "util";
Object.assign(global, {TextEncoder, TextDecoder});

import React from "react";
import {render, screen, waitFor, act} from "@testing-library/react";
import "@testing-library/jest-dom";
import userEvent from "@testing-library/user-event";
import {MemoryRouter} from "react-router";

import DeployReadinessPage from "../deployReadiness";
import {DatabaseContext} from "../../../Database/DatabaseContext";
import {DatabaseService} from "../../../Database/DatabaseService";
import {
  RecentActivityDomain,
  RunningEventDomain,
} from "../../../Database/Repository/AdminOperationsRepository";
import {AUTO_REFRESH_INTERVAL_MS} from "../deployReadinessUtils";

/* ===================================================================
// ======================== Mock-Setup ================================
// =================================================================== */

const mockNavigate = jest.fn();
jest.mock("react-router", () => ({
  ...jest.requireActual("react-router"),
  useNavigate: () => mockNavigate,
}));

jest.mock("../../../../constants/imageRepository", () => ({
  ImageRepository: {
    getEnvironmentRelatedPicture: () => ({SIGN_IN_HEADER: "test-image.png"}),
  },
}));

jest.mock("../../../Session/authUserContext", () => ({
  useAuthUser: () => ({uid: "admin-1", email: "admin@test.ch", roles: ["admin"]}),
}));

jest.mock("@sentry/react", () => ({captureException: jest.fn()}));

const mockGetRunningEvents = jest.fn();
const mockGetRecentActivity = jest.fn();
const mockDatabase = {
  adminOps: {
    getRunningEvents: mockGetRunningEvents,
    getRecentActivity: mockGetRecentActivity,
  },
} as unknown as DatabaseService;

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={["/system/deployreadiness"]}>
      <DatabaseContext.Provider value={mockDatabase}>
        <DeployReadinessPage />
      </DatabaseContext.Provider>
    </MemoryRouter>,
  );

/** Simuliert ein Handy-Viewport, damit die Kartenansicht gerendert wird. */
const mockMobileViewport = () => {
  window.matchMedia = jest.fn().mockImplementation((query: string) => ({
    matches: true,
    media: query,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  }));
};

const runningEvent: RunningEventDomain = {
  eventId: "event-1",
  name: "Sommerlager Wolfstufe",
  location: "Lungern OW",
  dateFrom: new Date(2026, 8, 15),
  dateTo: new Date(2026, 8, 18),
};

/** Aktivität, die `minutesAgo` Minuten zurückliegt. */
const createActivity = (
  minutesAgo: number,
  overrides: Partial<RecentActivityDomain> = {},
): RecentActivityDomain => ({
  userId: "user-1",
  userName: "Gio",
  area: "event",
  objectId: "event-9",
  objectName: "Herbstlager",
  lastActivityAt: new Date(Date.now() - minutesAgo * 60_000),
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
  mockMobileViewport();
  mockGetRunningEvents.mockResolvedValue([]);
  mockGetRecentActivity.mockResolvedValue([]);
});

/* ===================================================================
// ============================ Tests =================================
// =================================================================== */

describe("DeployReadinessPage", () => {
  test("lädt beide Listen und fragt 24 Stunden Aktivität ab", async () => {
    renderPage();
    await waitFor(() => expect(mockGetRunningEvents).toHaveBeenCalledTimes(1));
    expect(mockGetRecentActivity).toHaveBeenCalledWith(1440);
  });

  test("zeigt Leerzustände, wenn nichts läuft und niemand arbeitet", async () => {
    renderPage();
    expect(
      await screen.findByText("Heute läuft kein Lager."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("In den letzten 24 Stunden wurde nichts geändert."),
    ).toBeInTheDocument();
  });

  test("zeigt laufendes Lager und öffnet es per Klick", async () => {
    mockGetRunningEvents.mockResolvedValue([runningEvent]);
    renderPage();

    const eventName = await screen.findByText("Sommerlager Wolfstufe");
    await userEvent.setup().click(eventName);

    expect(mockNavigate).toHaveBeenCalledWith("/event/event-1", {
      state: {action: expect.anything()},
    });
  });

  test("zählt gerade aktive Personen einmal, Systemprozesse nicht", async () => {
    mockGetRecentActivity.mockResolvedValue([
      createActivity(2, {objectId: "event-1"}),
      createActivity(4, {objectId: "event-2"}),
      createActivity(3, {userId: "user-2", userName: "Anna"}),
      createActivity(1, {userId: null, userName: "System"}),
      createActivity(120, {userId: "user-3", userName: "Peter"}),
    ]);
    renderPage();

    const label = await screen.findByText(
      "Aktiv in den letzten 15 Minuten (15 Min.)",
    );
    // Kennzahl steht direkt vor der Beschriftung: Gio + Anna = 2.
    // Die Beschriftung erscheint schon vor den Daten, daher auf den Wert warten.
    await waitFor(() => expect(label.previousSibling).toHaveTextContent("2"));
  });

  test("zeigt Person, Bereich, Objekt und relative Zeit", async () => {
    mockGetRecentActivity.mockResolvedValue([createActivity(7)]);
    renderPage();

    expect(await screen.findByText("Gio")).toBeInTheDocument();
    expect(screen.getByText(/Anlass · Herbstlager/)).toBeInTheDocument();
    expect(screen.getByText("vor 7 Min.")).toBeInTheDocument();
  });

  test("aktualisiert automatisch nach dem Intervall", async () => {
    jest.useFakeTimers();
    try {
      renderPage();
      await waitFor(() => expect(mockGetRunningEvents).toHaveBeenCalledTimes(1));

      await act(async () => {
        jest.advanceTimersByTime(AUTO_REFRESH_INTERVAL_MS);
      });

      expect(mockGetRunningEvents).toHaveBeenCalledTimes(2);
    } finally {
      jest.useRealTimers();
    }
  });

  test("stoppt den Auto-Refresh beim Verlassen der Seite", async () => {
    jest.useFakeTimers();
    try {
      const {unmount} = renderPage();
      await waitFor(() => expect(mockGetRunningEvents).toHaveBeenCalledTimes(1));

      unmount();
      await act(async () => {
        jest.advanceTimersByTime(AUTO_REFRESH_INTERVAL_MS * 3);
      });

      expect(mockGetRunningEvents).toHaveBeenCalledTimes(1);
    } finally {
      jest.useRealTimers();
    }
  });

  test("meldet einen Ladefehler und stürzt nicht ab", async () => {
    mockGetRunningEvents.mockRejectedValue(new Error("RPC kaputt"));
    renderPage();
    expect(await screen.findByText(/RPC kaputt/)).toBeInTheDocument();
  });
});
