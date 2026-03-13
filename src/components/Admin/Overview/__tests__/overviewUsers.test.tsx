/**
 * Unit-Tests für Admin/Overview/overviewUsers.tsx.
 *
 * Testet das Laden der Benutzerliste, die Darstellung der Supabase-ID-Spalte,
 * den Dialog mit Profil/Statistik/Anlässe-Tabs, die noFoundBugs-Buttons
 * sowie Fehlerbehandlung.
 *
 * Supabase, Firebase und AuthUser werden vollständig gemockt.
 */
import {TextEncoder, TextDecoder} from "util";
Object.assign(global, {TextEncoder, TextDecoder});

import React from "react";
import {render, screen, waitFor} from "@testing-library/react";
import "@testing-library/jest-dom";
import userEvent from "@testing-library/user-event";

import OverviewUsersPage from "../overviewUsers";
import {DatabaseContext} from "../../../Database/DatabaseContext";

/* ===================================================================
// ======================== Mocks =====================================
// =================================================================== */

const mockNavigate = jest.fn();
jest.mock("react-router", () => ({
  ...jest.requireActual("react-router"),
  useNavigate: () => mockNavigate,
}));

jest.mock("../../../Session/authUserContext", () => ({
  useAuthUser: () => ({
    uid: "admin-firebase-uid",
    email: "admin@test.ch",
    authUid: "admin-auth-uuid",
  }),
}));

/* Mock-Methoden */
const mockFindOverview = jest.fn();
const mockFindById = jest.fn();
const mockFindRecipeCountsByCreator = jest
  .fn()
  .mockResolvedValue({noRecipesPublic: 5, noRecipesPrivate: 1});
const mockIncrementFoundBugs = jest.fn().mockResolvedValue(undefined);
const mockPatch = jest.fn().mockResolvedValue(undefined);

/** Beispiel-Benutzer für findOverview() */
const overviewUsers = [
  {
    uid: "firebase-uid-1",
    authUid: "supabase-auth-uuid-1",
    firstName: "Anna",
    lastName: "Meier",
    displayName: "AnnaM",
    email: "anna@test.ch",
    memberId: 42,
    memberSince: new Date("2024-01-15"),
  },
  {
    uid: "firebase-uid-2",
    authUid: undefined,
    firstName: "Beat",
    lastName: "Müller",
    displayName: "BeatM",
    email: "beat@test.ch",
    memberId: 7,
    memberSince: new Date("2023-06-01"),
  },
];

/** Beispiel-UserDomain für findById() */
const userDomainMock = {
  uid: "firebase-uid-1",
  authUid: "supabase-auth-uuid-1",
  email: "anna@test.ch",
  firstName: "Anna",
  lastName: "Meier",
  roles: ["basic"],
  noLogins: 10,
  noFoundBugs: 3,
  displayName: "AnnaM",
  memberId: 42,
  motto: "Test-Motto",
  pictureSrc: "",
};

const mockGetAllEventsForUser = jest.fn();

/** Mock-DatabaseService */
const mockDatabase: any = {
  admin: {
    users: {
      findOverview: mockFindOverview,
      findById: mockFindById,
      incrementFoundBugs: mockIncrementFoundBugs,
      patch: mockPatch,
    },
    recipes: {
      findRecipeCountsByCreator: mockFindRecipeCountsByCreator,
    },
  },
  users: {
    findOverview: mockFindOverview,
    findById: mockFindById,
    incrementFoundBugs: mockIncrementFoundBugs,
    patch: mockPatch,
  },
  recipes: {
    findRecipeCountsByCreator: mockFindRecipeCountsByCreator,
  },
  events: {
    getAllEventsForUser: mockGetAllEventsForUser,
  },
};

/** Hilfs-Render mit DatabaseContext */
const renderPage = () =>
  render(
    <DatabaseContext.Provider value={mockDatabase}>
      <OverviewUsersPage />
    </DatabaseContext.Provider>
  );

beforeEach(() => {
  jest.clearAllMocks();
  mockFindOverview.mockResolvedValue(overviewUsers);
  mockFindById.mockResolvedValue(userDomainMock);
  mockFindRecipeCountsByCreator.mockResolvedValue({
    noRecipesPublic: 5,
    noRecipesPrivate: 1,
  });
  mockGetAllEventsForUser.mockResolvedValue([]);
});

/* ===================================================================
// ======================== Tests =====================================
// =================================================================== */

test("1 – DataGrid wird nach Laden der User angezeigt", async () => {
  renderPage();

  await waitFor(() => {
    expect(mockFindOverview).toHaveBeenCalledTimes(1);
  });

  // Benutzernamenn in der Tabelle sichtbar
  expect(await screen.findByText("AnnaM")).toBeInTheDocument();
  expect(await screen.findByText("BeatM")).toBeInTheDocument();
});

test("2 – authUid-Spalte zeigt Supabase-UUID des ersten Users", async () => {
  renderPage();

  // authUid des ersten Users erscheint (als Zelleninhalt)
  expect(
    await screen.findByText("supabase-auth-uuid-1")
  ).toBeInTheDocument();
});

test("3 – Klick auf Öffnen-Button öffnet Dialog und ruft findById + findRecipeCountsByCreator auf", async () => {
  renderPage();

  // Warten bis Tabelle geladen
  await screen.findByText("AnnaM");

  // Ersten Öffnen-Button klicken
  const openButtons = screen.getAllByRole("button", {name: /open user/i});
  await userEvent.click(openButtons[0]);

  await waitFor(() => {
    expect(mockFindById).toHaveBeenCalledWith("firebase-uid-1");
    expect(mockFindRecipeCountsByCreator).toHaveBeenCalledWith(
      "supabase-auth-uuid-1"
    );
  });

  // Dialog geöffnet
  expect(screen.getByRole("dialog")).toBeInTheDocument();
});

test("4 – Statistiken-Tab zeigt Rezeptanzahl (read-only)", async () => {
  renderPage();
  await screen.findByText("AnnaM");

  const openButtons = screen.getAllByRole("button", {name: /open user/i});
  await userEvent.click(openButtons[0]);

  // Auf Statistik-Tab wechseln
  const statsTab = await screen.findByRole("tab", {name: /statistik/i});
  await userEvent.click(statsTab);

  // Rezeptanzahlen sichtbar
  await waitFor(() => {
    expect(screen.getByText("5")).toBeInTheDocument(); // noRecipesPublic
    expect(screen.getByText("1")).toBeInTheDocument(); // noRecipesPrivate
  });
});

test("5 – Statistiken-Tab zeigt noFoundBugs mit +/- Buttons", async () => {
  renderPage();
  await screen.findByText("AnnaM");

  const openButtons = screen.getAllByRole("button", {name: /open user/i});
  await userEvent.click(openButtons[0]);

  const statsTab = await screen.findByRole("tab", {name: /statistik/i});
  await userEvent.click(statsTab);

  await waitFor(() => {
    // noFoundBugs = 3 angezeigt
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  // +/- Buttons vorhanden
  expect(
    screen.getByRole("button", {name: /bug hinzufügen/i})
  ).toBeInTheDocument();
  expect(
    screen.getByRole("button", {name: /bug entfernen/i})
  ).toBeInTheDocument();
});

test("6 – Klick auf + ruft incrementFoundBugs auf und aktualisiert den Wert", async () => {
  renderPage();
  await screen.findByText("AnnaM");

  const openButtons = screen.getAllByRole("button", {name: /open user/i});
  await userEvent.click(openButtons[0]);

  const statsTab = await screen.findByRole("tab", {name: /statistik/i});
  await userEvent.click(statsTab);

  await waitFor(() => {
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  const addButton = screen.getByRole("button", {name: /bug hinzufügen/i});
  await userEvent.click(addButton);

  await waitFor(() => {
    expect(mockIncrementFoundBugs).toHaveBeenCalledWith("firebase-uid-1", 1);
    // Wert erhöht auf 4
    expect(screen.getByText("4")).toBeInTheDocument();
  });
});

test("7 – Anlässe-Tab zeigt 'Keine Anlässe' wenn keine Events vorhanden", async () => {
  mockGetAllEventsForUser.mockResolvedValue([]);
  renderPage();
  await screen.findByText("AnnaM");

  const openButtons = screen.getAllByRole("button", {name: /open user/i});
  await userEvent.click(openButtons[0]);

  const eventsTab = await screen.findByRole("tab", {name: /anlässe/i});
  await userEvent.click(eventsTab);

  await waitFor(() => {
    expect(
      screen.getByText(/keine anlässe vorhanden/i)
    ).toBeInTheDocument();
  });
});

test("7b – Anlässe-Tab zeigt Events des Benutzers", async () => {
  mockGetAllEventsForUser.mockResolvedValue([
    {
      uid: "event-uuid-1",
      name: "Sommerlager 2025",
      motto: "Abenteuer",
      location: "Zürich",
      pictureSrc: "",
      cooks: [],
      dates: [
        {uid: "d1", sortOrder: 0, dateFrom: new Date("2025-07-01"), dateTo: new Date("2025-07-05")},
      ],
      createdAt: new Date("2025-06-01"),
      createdBy: null,
      updatedAt: new Date("2025-06-01"),
      updatedBy: null,
    },
  ]);

  renderPage();
  await screen.findByText("AnnaM");

  const openButtons = screen.getAllByRole("button", {name: /open user/i});
  await userEvent.click(openButtons[0]);

  const eventsTab = await screen.findByRole("tab", {name: /anlässe/i});
  await userEvent.click(eventsTab);

  await waitFor(() => {
    expect(screen.getByText("Sommerlager 2025")).toBeInTheDocument();
    expect(screen.getByText("1 Anlass")).toBeInTheDocument();
  });
});

test("8 – Fehler beim Laden der User → AlertMessage sichtbar", async () => {
  mockFindOverview.mockRejectedValue(new Error("DB-Fehler"));

  renderPage();

  await waitFor(() => {
    // AlertMessage zeigt Titel (TEXT_ALERT_TITLE_UUPS)
    expect(screen.getByText(/uups/i)).toBeInTheDocument();
  });
});
