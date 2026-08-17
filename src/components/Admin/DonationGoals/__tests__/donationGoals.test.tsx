/**
 * Unit-Tests für DonationGoalsPage.
 *
 * Fokussiert auf die drei numerischen Eingabefelder (Zielbetrag,
 * Reihenfolge, Jahr): ungültige Eingaben (negativ, ausserhalb des
 * Postgres-integer-Bereichs, unplausibles Jahr) müssen auf gültige Werte
 * gekappt werden, statt einen rohen DB-Fehler zu provozieren.
 */
// Polyfill für jsdom (react-router benötigt TextEncoder/TextDecoder)
import {TextEncoder, TextDecoder} from "util";
Object.assign(global, {TextEncoder, TextDecoder});

import React from "react";
import {render, screen, waitFor, fireEvent} from "@testing-library/react";
import "@testing-library/jest-dom";
import {MemoryRouter} from "react-router";

import {DonationGoalsPage} from "../donationGoals";
import {DatabaseContext} from "../../../Database/DatabaseContext";

/* ===================================================================
// ======================== Mock-Setup ================================
// =================================================================== */

const mockAuthUser = {
  uid: "auth-uuid-123",
  email: "admin@chuchipirat.ch",
  roles: ["admin"],
};
jest.mock("../../../Session/authUserContext", () => ({
  useAuthUser: () => mockAuthUser,
}));

const mockCustomDialog = jest.fn();
jest.mock("../../../Shared/customDialogContext", () => ({
  ...jest.requireActual("../../../Shared/customDialogContext"),
  useCustomDialog: () => ({customDialog: mockCustomDialog}),
}));

const mockGetGoalSections = jest.fn();
const mockCreateGoalSection = jest.fn();
const mockUpdateGoalSection = jest.fn();
const mockDeleteGoalSection = jest.fn();

const mockDatabase = {
  donations: {
    getGoalSections: mockGetGoalSections,
    createGoalSection: mockCreateGoalSection,
    updateGoalSection: mockUpdateGoalSection,
    deleteGoalSection: mockDeleteGoalSection,
  },
} as any;

const renderPage = () => {
  return render(
    <MemoryRouter initialEntries={["/system/donationgoals"]}>
      <DatabaseContext.Provider value={mockDatabase}>
        <DonationGoalsPage />
      </DatabaseContext.Provider>
    </MemoryRouter>,
  );
};

beforeEach(() => {
  jest.clearAllMocks();
  mockGetGoalSections.mockResolvedValue([
    {
      id: "s1",
      label: "Infrastruktur",
      targetCents: 40000,
      sortOrder: 1,
      year: 2026,
      details: "",
    },
  ]);
});

describe("DonationGoalsPage — Numerische Felder", () => {
  test("kappt einen negativ eingegebenen Zielbetrag auf 0", async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByDisplayValue("400.00")).toBeInTheDocument();
    });

    const targetInput = screen.getByLabelText(
      "Zielbetrag (CHF)",
    ) as HTMLInputElement;
    fireEvent.change(targetInput, {target: {value: "-50"}});

    expect(targetInput.value).toBe("0.00");
  });

  test("kappt einen zu grossen Zielbetrag auf den Postgres-integer-Maximalwert (in Rappen)", async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByDisplayValue("400.00")).toBeInTheDocument();
    });

    const targetInput = screen.getByLabelText(
      "Zielbetrag (CHF)",
    ) as HTMLInputElement;
    // 99999999999 CHF * 100 würde weit über den int4-Bereich hinausgehen
    fireEvent.change(targetInput, {target: {value: "99999999999"}});

    expect(targetInput.value).toBe("21474836.47");
  });

  test("kappt eine negativ eingegebene Reihenfolge auf 0", async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByDisplayValue("1")).toBeInTheDocument();
    });

    const sortOrderInput = screen.getByLabelText(
      "Reihenfolge",
    ) as HTMLInputElement;
    fireEvent.change(sortOrderInput, {target: {value: "-3"}});

    expect(sortOrderInput.value).toBe("0");
  });

  test("kappt eine zu grosse Reihenfolge auf den Postgres-integer-Maximalwert", async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByDisplayValue("1")).toBeInTheDocument();
    });

    const sortOrderInput = screen.getByLabelText(
      "Reihenfolge",
    ) as HTMLInputElement;
    fireEvent.change(sortOrderInput, {target: {value: "99999999999"}});

    expect(sortOrderInput.value).toBe("2147483647");
  });

  test("kappt ein zu kleines Jahr auf den unteren Grenzwert (2000)", async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByDisplayValue("2026")).toBeInTheDocument();
    });

    const yearInput = screen.getByLabelText("Jahr") as HTMLInputElement;
    fireEvent.change(yearInput, {target: {value: "0"}});

    expect(yearInput.value).toBe("2000");
  });

  test("kappt ein zu grosses Jahr auf den oberen Grenzwert (2100)", async () => {
    renderPage();

    await waitFor(() => {
      expect(screen.getByDisplayValue("2026")).toBeInTheDocument();
    });

    const yearInput = screen.getByLabelText("Jahr") as HTMLInputElement;
    fireEvent.change(yearInput, {target: {value: "99999999999"}});

    expect(yearInput.value).toBe("2100");
  });
});
