/**
 * Unit-Tests für die Datenintegritätsseite (DataIntegrityPage).
 *
 * Fokus: Anlass-Prüfungen («ohne Zeitscheiben», «ohne Köch:innen») zeigen den
 * Inhalt, «Alle löschen» erfasst nur leere Anlässe, Einzellöschen erlaubt
 * auch Anlässe mit Inhalt; bestehende Prüfungen bleiben unverändert.
 */
// Polyfill für jsdom (react-router benötigt TextEncoder/TextDecoder)
import {TextEncoder, TextDecoder} from "util";
Object.assign(global, {TextEncoder, TextDecoder});

import React from "react";
import {render, screen, waitFor, within} from "@testing-library/react";
import "@testing-library/jest-dom";
import userEvent from "@testing-library/user-event";
import {MemoryRouter} from "react-router";

import DataIntegrityPage from "../dataIntegrity";
import {DatabaseContext} from "../../../Database/DatabaseContext";
import {DatabaseService} from "../../../Database/DatabaseService";

/* ===================================================================
// ======================== Mock-Setup ================================
// =================================================================== */

jest.mock("../../../../constants/imageRepository", () => ({
  ImageRepository: {
    getEnvironmentRelatedPicture: () => ({SIGN_IN_HEADER: "test-image.png"}),
  },
}));

jest.mock("../../../Session/authUserContext", () => ({
  useAuthUser: () => ({uid: "admin-1", email: "admin@test.ch", roles: ["admin"]}),
}));

jest.mock("@sentry/react", () => ({captureException: jest.fn()}));

/** Schwere Detail-Komponenten sind für diese Tests nicht relevant. */
jest.mock("../../Overview/overviewRecipes", () => ({
  DialogRecipeAdminDetail: () => null,
}));
jest.mock("../../../Recipe/RecipeDrawer", () => ({RecipeDrawer: () => null}));

const mockRpc = jest.fn();
jest.mock("../../../Database/supabaseClient", () => ({
  supabase: {rpc: (...args: unknown[]) => mockRpc(...args)},
}));

const mockDatabase = {} as unknown as DatabaseService;

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={["/system/dataintegrity"]}>
      <DatabaseContext.Provider value={mockDatabase}>
        <DataIntegrityPage />
      </DatabaseContext.Provider>
    </MemoryRouter>,
  );

/** Anlass-Auffälligkeit, wie sie `check_events_without_*` liefert. */
const createEventAnomaly = (
  id: string,
  name: string,
  overrides: Record<string, unknown> = {},
) => ({
  event_id: id,
  event_name: name,
  created_at: "2026-11-12T12:00:00+00:00",
  created_by_name: "Anna",
  last_activity_at: "2026-11-12T12:00:00+00:00",
  cook_count: 1,
  meal_count: 0,
  list_count: 0,
  donation_count: 0,
  is_empty: true,
  ...overrides,
});

const EMPTY_A = createEventAnomaly("event-a", "Leerer Anlass A");
const WITH_DATA_B = createEventAnomaly("event-b", "Anlass mit Inhalt B", {
  meal_count: 5,
  is_empty: false,
});
const EMPTY_C = createEventAnomaly("event-c", "Leerer Anlass C");

/** Konfiguriert mockRpc: Prüfungen liefern `checks[name]`, Cleanups `cleanupResult`. */
const setupRpc = (
  checks: Record<string, unknown[]>,
  cleanupResult: {data: number | null; error: {message: string} | null} = {
    data: 1,
    error: null,
  },
) => {
  mockRpc.mockImplementation((name: string) => {
    if (name in checks) return Promise.resolve({data: checks[name], error: null});
    return Promise.resolve(cleanupResult);
  });
};

const runCheck = async (
  user: ReturnType<typeof userEvent.setup>,
  label: string,
) => {
  await user.click(screen.getByRole("button", {name: `${label} ausführen`}));
};

const cleanupCalls = () =>
  mockRpc.mock.calls.filter(([name]) => String(name).startsWith("cleanup_"));

beforeEach(() => {
  jest.clearAllMocks();
});

/* ===================================================================
// ============================ Tests =================================
// =================================================================== */

describe("DataIntegrityPage — Events ohne Zeitscheiben", () => {
  const CHECK_LABEL = "Events ohne Zeitscheiben";

  test("zeigt zu jedem Anlass den Inhalt an", async () => {
    setupRpc({check_events_without_dates: [EMPTY_A, WITH_DATA_B]});
    renderPage();
    await runCheck(userEvent.setup(), CHECK_LABEL);

    expect(await screen.findByText("Anlass mit Inhalt B")).toBeInTheDocument();
    expect(screen.getByText(/^Leer · angelegt 12\.11\.2026 von Anna/)).toBeInTheDocument();
    expect(screen.getByText(/^Enthält Daten · .*Mahlzeiten 5/)).toBeInTheDocument();
  });

  test("«Alle löschen» zählt nur leere Anlässe und weist auf die übrigen hin", async () => {
    setupRpc({check_events_without_dates: [EMPTY_A, WITH_DATA_B, EMPTY_C]});
    renderPage();
    await runCheck(userEvent.setup(), CHECK_LABEL);

    expect(
      await screen.findByRole("button", {name: "2 leere löschen"}),
    ).toBeEnabled();
    expect(
      screen.getByText(/Anlässe mit Inhalt \(1\) werden nicht mitgelöscht/),
    ).toBeInTheDocument();
  });

  test("Sammel-Löschen sendet nur die IDs der leeren Anlässe ohne only_empty", async () => {
    setupRpc({check_events_without_dates: [EMPTY_A, WITH_DATA_B, EMPTY_C]});
    renderPage();
    const user = userEvent.setup();
    await runCheck(user, CHECK_LABEL);

    await user.click(await screen.findByRole("button", {name: "2 leere löschen"}));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText(/2 leere Anlässe/)).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", {name: "Löschen"}));

    await waitFor(() => expect(cleanupCalls()).toHaveLength(1));
    expect(cleanupCalls()[0]).toEqual([
      "cleanup_events_without_dates",
      {event_ids: ["event-a", "event-c"]},
    ]);
  });

  test("Sammel-Löschen ist gesperrt, wenn kein Anlass leer ist", async () => {
    setupRpc({check_events_without_dates: [WITH_DATA_B]});
    renderPage();
    await runCheck(userEvent.setup(), CHECK_LABEL);

    expect(
      await screen.findByRole("button", {name: "0 leere löschen"}),
    ).toBeDisabled();
  });

  test("fehlt is_empty (ältere DB), wird nichts automatisch gelöscht", async () => {
    const {is_empty: _ignored, ...withoutFlag} = EMPTY_A;
    setupRpc({check_events_without_dates: [withoutFlag]});
    renderPage();
    await runCheck(userEvent.setup(), CHECK_LABEL);

    expect(
      await screen.findByRole("button", {name: "0 leere löschen"}),
    ).toBeDisabled();
  });

  test("Einzellöschen eines Anlasses mit Inhalt: Warnung im Dialog, only_empty=false", async () => {
    setupRpc({check_events_without_dates: [EMPTY_A, WITH_DATA_B]});
    renderPage();
    const user = userEvent.setup();
    await runCheck(user, CHECK_LABEL);
    await screen.findByText("Anlass mit Inhalt B");

    // Zweite Zeile = Anlass mit Inhalt
    await user.click(screen.getAllByRole("button", {name: "Löschen"})[1]);
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText(/Enthält Daten/)).toBeInTheDocument();
    expect(within(dialog).getByText(/unwiderruflich gelöscht/)).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", {name: "Löschen"}));

    await waitFor(() => expect(cleanupCalls()).toHaveLength(1));
    expect(cleanupCalls()[0]).toEqual([
      "cleanup_events_without_dates",
      {event_ids: ["event-b"], only_empty: false},
    ]);
    await waitFor(() =>
      expect(screen.queryByText("Anlass mit Inhalt B")).not.toBeInTheDocument(),
    );
  });

  test("meldet «nicht gelöscht» und lädt neu, wenn die RPC 0 Zeilen löscht", async () => {
    setupRpc({check_events_without_dates: [WITH_DATA_B]}, {data: 0, error: null});
    renderPage();
    const user = userEvent.setup();
    await runCheck(user, CHECK_LABEL);
    await screen.findByText("Anlass mit Inhalt B");

    await user.click(screen.getAllByRole("button", {name: "Löschen"})[0]);
    await user.click(
      within(screen.getByRole("dialog")).getByRole("button", {name: "Löschen"}),
    );

    expect(await screen.findByText(/Nicht gelöscht/)).toBeInTheDocument();
    // Prüfung wurde neu ausgeführt: 1x initial + 1x nach dem Löschen
    await waitFor(() =>
      expect(
        mockRpc.mock.calls.filter(([name]) => name === "check_events_without_dates"),
      ).toHaveLength(2),
    );
    expect(screen.getByText("Anlass mit Inhalt B")).toBeInTheDocument();
  });

  test("ein Löschfehler ist sichtbar und verschwindet beim nächsten erfolgreichen Löschen", async () => {
    setupRpc({check_events_without_dates: [EMPTY_A, EMPTY_C]});
    renderPage();
    const user = userEvent.setup();
    await runCheck(user, CHECK_LABEL);
    await screen.findByText("Leerer Anlass A");

    mockRpc.mockImplementationOnce(() =>
      Promise.resolve({data: null, error: {message: "boom"}}),
    );
    // Der Mock liefert für die erste Cleanup-Anfrage einen Fehler
    setupRpc({check_events_without_dates: [EMPTY_A, EMPTY_C]});
    mockRpc.mockImplementationOnce(() =>
      Promise.resolve({data: null, error: {message: "boom"}}),
    );
    await user.click(screen.getAllByRole("button", {name: "Löschen"})[0]);
    await user.click(
      within(screen.getByRole("dialog")).getByRole("button", {name: "Löschen"}),
    );
    expect(await screen.findByRole("alert")).toBeInTheDocument();

    await user.click(screen.getAllByRole("button", {name: "Löschen"})[0]);
    await user.click(
      within(screen.getByRole("dialog")).getByRole("button", {name: "Löschen"}),
    );
    await waitFor(() =>
      expect(screen.queryByRole("alert")).not.toBeInTheDocument(),
    );
  });
});

describe("DataIntegrityPage — Events ohne Köch:innen", () => {
  test("ruft die neue Prüfung auf und löscht über die passende RPC", async () => {
    setupRpc({check_events_without_cooks: [EMPTY_A]});
    renderPage();
    const user = userEvent.setup();
    await runCheck(user, "Events ohne Köch:innen");

    await user.click(await screen.findByRole("button", {name: "1 leere löschen"}));
    await user.click(
      within(screen.getByRole("dialog")).getByRole("button", {name: "Löschen"}),
    );

    await waitFor(() => expect(cleanupCalls()).toHaveLength(1));
    expect(cleanupCalls()[0]).toEqual([
      "cleanup_events_without_cooks",
      {event_ids: ["event-a"]},
    ]);
  });
});

describe("DataIntegrityPage — bestehende Prüfungen bleiben unverändert", () => {
  const PRODUCTS = [
    {product_id: "p1", product_name: "Apfel"},
    {product_id: "p2", product_name: "Birne"},
  ];

  test("«Alle N löschen» sendet alle IDs ohne Zusatzparameter", async () => {
    setupRpc({check_unused_products: PRODUCTS});
    renderPage();
    const user = userEvent.setup();
    await runCheck(user, "Unbenutzte Produkte");

    await user.click(await screen.findByRole("button", {name: "Alle 2 löschen"}));
    await user.click(
      within(screen.getByRole("dialog")).getByRole("button", {name: "Löschen"}),
    );

    await waitFor(() => expect(cleanupCalls()).toHaveLength(1));
    expect(cleanupCalls()[0]).toEqual([
      "cleanup_unused_products",
      {product_ids: ["p1", "p2"]},
    ]);
  });

  test("Einzellöschen sendet nur die ID und zeigt keinen Anlass-Hinweis", async () => {
    setupRpc({check_unused_products: PRODUCTS});
    renderPage();
    const user = userEvent.setup();
    await runCheck(user, "Unbenutzte Produkte");
    await screen.findByText("Apfel");

    await user.click(screen.getAllByRole("button", {name: "Löschen"})[0]);
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).queryByText(/unwiderruflich/)).not.toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", {name: "Löschen"}));

    await waitFor(() => expect(cleanupCalls()).toHaveLength(1));
    expect(cleanupCalls()[0]).toEqual([
      "cleanup_unused_products",
      {product_ids: ["p1"]},
    ]);
  });
});
