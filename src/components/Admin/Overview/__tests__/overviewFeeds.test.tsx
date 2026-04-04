/**
 * Unit-Tests für Admin/Overview/overviewFeeds.tsx.
 *
 * Testet das Laden der Feed-Liste aus Supabase, DataGrid-Darstellung,
 * Suche/Filter, Detail-Dialog, Einzellöschung, Massenlöschung,
 * und Fehlerbehandlung.
 *
 * Firebase, Supabase und AuthUser werden vollständig gemockt.
 */
import {TextEncoder, TextDecoder} from "util";
Object.assign(global, {TextEncoder, TextDecoder});

import {render, screen, waitFor, within} from "@testing-library/react";
import "@testing-library/jest-dom";
import userEvent from "@testing-library/user-event";
import {MemoryRouter} from "react-router";

import OverviewFeedsPage from "../overviewFeeds";
import {DatabaseContext} from "../../../Database/DatabaseContext";
import {FeedType} from "../../../Shared/feed.class";

/* useCustomStyles liefert im Test nur leere Objekte –
   umgeht den import.meta.env-Fehler in utils.class.ts */
jest.mock("../../../../constants/styles", () => ({
  useCustomStyles: jest.fn(() => ({
    container: {},
    backdrop: {},
    card: {},
    cardContent: {},
    submit: {},
    deleteButton: {},
    typographyCode: "typographyCode",
    dataGridDisabled: "dataGridDisabled",
    dialogHeaderWithPicture: {},
  })),
}));

/* ===================================================================
// ======================== Mocks =====================================
// =================================================================== */

jest.mock("../../../Session/authUserContext", () => ({
  useAuthUser: () => ({
    uid: "admin-uid",
    email: "admin@test.ch",
    publicProfile: {displayName: "Admin"},
  }),
}));

const mockFirebase = {};
jest.mock("../../../Firebase/firebaseContext", () => ({
  useFirebase: () => mockFirebase,
}));

/** Mock: useCustomDialog — simuliert den Bestätigungsdialog */
const mockCustomDialog = jest.fn();
jest.mock("../../../Shared/customDialogContext", () => ({
  ...jest.requireActual("../../../Shared/customDialogContext"),
  useCustomDialog: () => ({customDialog: mockCustomDialog}),
}));

/* ------------------------------------------
// Mock-Daten
// ------------------------------------------ */

/** Beispiel-Feeds (Supabase FeedDomain-Struktur). */
const mockFeeds = [
  {
    uid: "feed-aaa-001",
    feedType: FeedType.recipePublished,
    visibility: "basic",
    title: "Neues Rezept publiziert",
    text: "Pasta Carbonara wurde publiziert",
    createdAt: new Date("2025-12-01T10:30:00"),
    user: {
      uid: "user-001",
      displayName: "Anna Koch",
      pictureSrc: "",
    },
    sourceObject: {
      type: "recipe",
      uid: "recipe-001",
      name: "Pasta Carbonara",
      pictureSrc: "",
    },
  },
  {
    uid: "feed-bbb-002",
    feedType: FeedType.eventCreated,
    visibility: "basic",
    title: "Neuer Anlass erstellt",
    text: "Sommerlager 2025 wurde erstellt",
    createdAt: new Date("2025-11-15T08:00:00"),
    user: {
      uid: "user-002",
      displayName: "Beat Müller",
      pictureSrc: "",
    },
    sourceObject: {
      type: "event",
      uid: "event-001",
      name: "Sommerlager 2025",
      pictureSrc: "https://example.com/pic.jpg",
    },
  },
  {
    uid: "feed-ccc-003",
    feedType: FeedType.userCreated,
    visibility: "basic",
    title: "Neuer User",
    text: "Clara Beispiel hat sich registriert",
    createdAt: new Date("2025-10-01T14:00:00"),
    user: {
      uid: "user-003",
      displayName: "Clara Beispiel",
      pictureSrc: "",
    },
    sourceObject: {
      type: "user",
      uid: "user-003",
      name: "Clara Beispiel",
      pictureSrc: "",
    },
  },
];

/* ------------------------------------------
// Mock-Repository-Methoden
// ------------------------------------------ */
const mockGetAllFeeds = jest.fn();
const mockDeleteFeed = jest.fn();
const mockDeleteFeedsByAge = jest.fn();

/** Mock-DatabaseService mit Feed-Repository. */
const mockDatabase: any = {
  feeds: {
    getAllFeeds: mockGetAllFeeds,
    deleteFeed: mockDeleteFeed,
    deleteFeedsByAge: mockDeleteFeedsByAge,
  },
};

/** Hilfs-Render mit DatabaseContext. */
const renderPage = () =>
  render(
    <MemoryRouter>
      <DatabaseContext.Provider value={mockDatabase}>
        <OverviewFeedsPage />
      </DatabaseContext.Provider>
    </MemoryRouter>,
  );

beforeEach(() => {
  jest.clearAllMocks();
  mockGetAllFeeds.mockResolvedValue([...mockFeeds]);
  mockDeleteFeed.mockResolvedValue(undefined);
  mockDeleteFeedsByAge.mockResolvedValue(2);
  mockCustomDialog.mockResolvedValue(true);
});

/* ===================================================================
// ======================== Tests =====================================
// =================================================================== */

/* ------------------------------------------
// Laden & Darstellung
// ------------------------------------------ */

test("1 – getAllFeeds wird beim Mount aufgerufen", async () => {
  renderPage();

  await waitFor(() => {
    expect(mockGetAllFeeds).toHaveBeenCalledTimes(1);
  });
});

test("2 – Feeds werden nach Fetch im DataGrid dargestellt", async () => {
  renderPage();

  // Warten bis die Feeds geladen sind
  expect(await screen.findByText("Anna Koch")).toBeInTheDocument();
  expect(screen.getByText("Beat Müller")).toBeInTheDocument();
  expect(screen.getByText("Clara Beispiel")).toBeInTheDocument();
});

test("3 – Anzahl Feeds wird korrekt angezeigt", async () => {
  renderPage();

  expect(await screen.findByText(/3 Feed-Einträge/i)).toBeInTheDocument();
});

/* ------------------------------------------
// Suche & Filter
// ------------------------------------------ */

test("4 – Suche filtert Feeds nach Benutzernamen", async () => {
  renderPage();
  await screen.findByText("Anna Koch");

  const searchInput = screen.getByRole("textbox");
  await userEvent.type(searchInput, "Beat");

  expect(screen.queryByText("Anna Koch")).not.toBeInTheDocument();
  expect(screen.getByText("Beat Müller")).toBeInTheDocument();
  expect(screen.queryByText("Clara Beispiel")).not.toBeInTheDocument();
});

test("5 – Suche filtert Feeds nach Typ", async () => {
  renderPage();
  await screen.findByText("Anna Koch");

  const searchInput = screen.getByRole("textbox");
  await userEvent.type(searchInput, "recipePublished");

  expect(screen.getByText("Anna Koch")).toBeInTheDocument();
  expect(screen.queryByText("Beat Müller")).not.toBeInTheDocument();
});

test("6 – Suche löschen setzt Filter zurück", async () => {
  renderPage();
  await screen.findByText("Anna Koch");

  const searchInput = screen.getByRole("textbox");
  await userEvent.type(searchInput, "Beat");
  expect(screen.queryByText("Anna Koch")).not.toBeInTheDocument();

  const clearButton = screen.getByRole("button", {
    name: /clear search term/i,
  });
  await userEvent.click(clearButton);

  expect(screen.getByText("Anna Koch")).toBeInTheDocument();
  expect(screen.getByText("Beat Müller")).toBeInTheDocument();
  expect(screen.getByText("Clara Beispiel")).toBeInTheDocument();
});

test("7 – Gefilterte Anzahl wird korrekt angezeigt", async () => {
  renderPage();
  await screen.findByText("Anna Koch");

  const searchInput = screen.getByRole("textbox");
  await userEvent.type(searchInput, "Beat");

  expect(screen.getByText(/1 von 3 Feed-Einträge/i)).toBeInTheDocument();
});

/* ------------------------------------------
// Detail-Dialog
// ------------------------------------------ */

test("8 – Klick auf Öffnen-Icon zeigt Detail-Dialog mit Feed-Daten", async () => {
  renderPage();
  await screen.findByText("Anna Koch");

  // Öffnen-Icon des ersten Feeds klicken
  const openButtons = screen.getAllByRole("button", {name: /open feed/i});
  await userEvent.click(openButtons[0]);

  const dialog = screen.getByRole("dialog");
  expect(dialog).toBeInTheDocument();

  // Dialog-Titel zeigt den Feed-Typ
  const dialogTitle = within(dialog).getByRole("heading");
  expect(dialogTitle).toHaveTextContent(/recipePublished|eventCreated|userCreated/);
});

test("9 – Dialog schliesst bei Klick auf Schliessen", async () => {
  renderPage();
  await screen.findByText("Anna Koch");

  const openButtons = screen.getAllByRole("button", {name: /open feed/i});
  await userEvent.click(openButtons[0]);
  expect(screen.getByRole("dialog")).toBeInTheDocument();

  const closeButton = within(screen.getByRole("dialog")).getByRole("button", {
    name: /schliessen/i,
  });
  await userEvent.click(closeButton);

  await waitFor(() => {
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});

/* ------------------------------------------
// Einzellöschung
// ------------------------------------------ */

test("10 – Einzelner Feed wird nach Bestätigung gelöscht", async () => {
  renderPage();
  await screen.findByText("Anna Koch");

  // Dialog öffnen
  const openButtons = screen.getAllByRole("button", {name: /open feed/i});
  await userEvent.click(openButtons[0]);

  // Löschen-Button im Dialog klicken
  const deleteButton = within(screen.getByRole("dialog")).getByRole("button", {
    name: /löschen/i,
  });
  await userEvent.click(deleteButton);

  await waitFor(() => {
    expect(mockCustomDialog).toHaveBeenCalledTimes(1);
  });

  await waitFor(() => {
    expect(mockDeleteFeed).toHaveBeenCalledWith("feed-aaa-001");
  });
});

test("11 – Löschen wird abgebrochen wenn User nicht bestätigt", async () => {
  mockCustomDialog.mockResolvedValue(false);

  renderPage();
  await screen.findByText("Anna Koch");

  const openButtons = screen.getAllByRole("button", {name: /open feed/i});
  await userEvent.click(openButtons[0]);

  const deleteButton = within(screen.getByRole("dialog")).getByRole("button", {
    name: /löschen/i,
  });
  await userEvent.click(deleteButton);

  await waitFor(() => {
    expect(mockCustomDialog).toHaveBeenCalledTimes(1);
  });

  expect(mockDeleteFeed).not.toHaveBeenCalled();
});

/* ------------------------------------------
// Massenlöschung (Delete-Tab)
// ------------------------------------------ */

test("12 – Delete-Tab zeigt Lösch-Panel mit Feed-Anzahl", async () => {
  renderPage();
  await screen.findByText("Anna Koch");

  // Auf den Delete-Tab wechseln
  const deleteTab = screen.getByRole("tab", {name: /löschen/i});
  await userEvent.click(deleteTab);

  expect(screen.getByText("Feeds löschen")).toBeInTheDocument();
  expect(screen.getByText(/3 Feed-Einträge/i)).toBeInTheDocument();
});

test("13 – Massenlöschung ruft deleteFeedsByAge auf", async () => {
  renderPage();
  await screen.findByText("Anna Koch");

  // Auf den Delete-Tab wechseln
  const deleteTab = screen.getByRole("tab", {name: /löschen/i});
  await userEvent.click(deleteTab);

  // Lösch-Button klicken (Standardwert 180 Tage)
  const deleteButton = screen.getByRole("button", {
    name: /feed-einträge löschen/i,
  });
  await userEvent.click(deleteButton);

  await waitFor(() => {
    expect(mockDeleteFeedsByAge).toHaveBeenCalledWith(180);
  });
});

/* ------------------------------------------
// Fehlerbehandlung
// ------------------------------------------ */

test("14 – Fehler beim Laden zeigt AlertMessage", async () => {
  mockGetAllFeeds.mockRejectedValue(new Error("DB-Fehler"));

  renderPage();

  await waitFor(() => {
    expect(screen.getByText(/uups/i)).toBeInTheDocument();
  });
});

test("15 – Leerer Zustand (keine Feeds)", async () => {
  mockGetAllFeeds.mockResolvedValue([]);

  renderPage();

  await waitFor(() => {
    expect(screen.getByText(/0 Feed-Einträge/i)).toBeInTheDocument();
  });
});

test("16 – Fehler beim Einzellöschen zeigt Fehlermeldung", async () => {
  mockDeleteFeed.mockRejectedValue(new Error("Löschfehler"));

  renderPage();
  await screen.findByText("Anna Koch");

  // Dialog öffnen und löschen
  const openButtons = screen.getAllByRole("button", {name: /open feed/i});
  await userEvent.click(openButtons[0]);

  const deleteButton = within(screen.getByRole("dialog")).getByRole("button", {
    name: /löschen/i,
  });
  await userEvent.click(deleteButton);

  await waitFor(() => {
    expect(screen.getByText(/uups/i)).toBeInTheDocument();
  });
});
