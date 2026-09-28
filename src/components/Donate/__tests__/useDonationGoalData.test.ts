/**
 * Unit-Tests für useDonationGoalData.
 *
 * Regression CHUCHIPIRAT-FV: loadData() wird ohne await gestartet und hatte
 * nur try/finally — ein Fehler beim Laden landete als UnhandledRejection in
 * Sentry.
 */
import {renderHook, waitFor} from "@testing-library/react";
import * as Sentry from "@sentry/react";

const mockGetGoalSections = jest.fn();
const mockGetDonationGoalStats = jest.fn();

// Stabile Instanz wie im echten Context — sonst läuft der Effect (database
// ist Dependency) nach jedem Render erneut.
const mockDatabase = {
  donations: {
    getGoalSections: mockGetGoalSections,
    getDonationGoalStats: mockGetDonationGoalStats,
  },
};
jest.mock("../../Database/DatabaseContext", () => ({
  useDatabase: () => mockDatabase,
}));

jest.mock("@sentry/react", () => ({captureException: jest.fn()}));

import {useDonationGoalData} from "../useDonationGoalData";

/** Wie viele unbehandelte Rejections während eines Tests auftraten. */
let unhandledRejections = 0;
const onUnhandledRejection = () => {
  unhandledRejections++;
};

describe("useDonationGoalData — Fehlerbehandlung", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    unhandledRejections = 0;
    process.on("unhandledRejection", onUnhandledRejection);
  });

  afterEach(() => {
    process.off("unhandledRejection", onUnhandledRejection);
  });

  test("fängt einen Netzfehler ab, meldet ihn nicht und beendet das Laden", async () => {
    mockGetGoalSections.mockRejectedValue({
      code: "",
      details: "TypeError: Failed to fetch",
      hint: "",
      message: "TypeError: Failed to fetch (api.chuchipirat.ch)",
    });
    mockGetDonationGoalStats.mockResolvedValue(null);

    const {result} = renderHook(() => useDonationGoalData(2026));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    // Einen Makrotask abwarten, damit Node eine Rejection gemeldet hätte
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(result.current.sections).toEqual([]);
    expect(result.current.stats).toBeNull();
    expect(Sentry.captureException).not.toHaveBeenCalled();
    expect(unhandledRejections).toBe(0);
  });

  test("meldet einen echten Fehler an Sentry", async () => {
    mockGetGoalSections.mockRejectedValue({
      code: "42P01",
      message: "relation does not exist",
    });
    mockGetDonationGoalStats.mockResolvedValue(null);

    const {result} = renderHook(() => useDonationGoalData(2026));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(Sentry.captureException).toHaveBeenCalledTimes(1);
  });
});
