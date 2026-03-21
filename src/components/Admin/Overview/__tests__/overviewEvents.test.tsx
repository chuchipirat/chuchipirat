/**
 * Unit-Tests für Admin/Overview/overviewEvents.tsx.
 *
 * Testet das Laden der Anlass-Liste aus Supabase, Kartenansicht, Detail-Dialog,
 * Suche/Filter, Ansichts-Toggle und Fehlerbehandlung.
 *
 * Firebase, Supabase und AuthUser werden vollständig gemockt.
 */
import {TextEncoder, TextDecoder} from "util";
Object.assign(global, {TextEncoder, TextDecoder});

import React from "react";
import {render, screen, waitFor, within} from "@testing-library/react";
import "@testing-library/jest-dom";
import userEvent from "@testing-library/user-event";

import OverviewEventsPage from "../overviewEvents";
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
    uid: "admin-uid",
    email: "admin@test.ch",
    publicProfile: {displayName: "Admin"},
  }),
}));

const mockFirebase = {eventShort: {}};
jest.mock("../../../Firebase/firebaseContext", () => ({
  useFirebase: () => mockFirebase,
}));

// User.getFullProfile mock
const mockGetFullProfile = jest.fn();
jest.mock("../../../User/user.class", () => ({
  __esModule: true,
  default: {
    getFullProfile: (...args: any[]) => mockGetFullProfile(...args),
  },
}));

// Receipt mock
jest.mock("../../../Event/Event/receipt.class", () => ({
  __esModule: true,
  default: class Receipt {
    eventUid = "";
    eventName = "";
    payDate = new Date();
    amount = 0;
    donorName = "";
    donorEmail = "";
    created = {date: new Date(), fromUid: "", fromDisplayName: ""};
    static save = jest.fn().mockResolvedValue(undefined);
  },
}));

// @react-pdf/renderer mock
jest.mock("@react-pdf/renderer", () => ({
  pdf: () => ({toBlob: () => Promise.resolve(new Blob())}),
  Document: ({children}: any) => <div>{children}</div>,
  Page: ({children}: any) => <div>{children}</div>,
  View: ({children}: any) => <div>{children}</div>,
  Text: ({children}: any) => <span>{children}</span>,
  Image: () => <img />,
}));

// file-saver mock
jest.mock("file-saver", () => ({
  __esModule: true,
  default: {saveAs: jest.fn()},
}));

// EventReceiptPdf mock
jest.mock("../../../Event/Event/eventRecipePdf", () => ({
  __esModule: true,
  default: () => <div data-testid="receipt-pdf" />,
}));

// DatePicker mock (benötigt sonst LocalizationProvider)
jest.mock("@mui/x-date-pickers", () => ({
  DatePicker: (props: any) => (
    <input
      data-testid={`datepicker-${props.label}`}
      value={props.value ? props.value.toISOString() : ""}
      onChange={() => props.onChange?.(new Date())}
    />
  ),
}));

/** Beispiel-Events (Supabase EventDomain-Struktur). */
const mockEventDomains = [
  {
    uid: "550e8400-e29b-41d4-a716-446655440000",
    name: "Sommerlager",
    motto: "Abenteuer",
    location: "Zürich",
    pictureSrc: "",
    cooks: [{uid: "cook-1", userId: "user-1", displayName: "", motto: "", pictureSrc: ""}, {uid: "cook-2", userId: "user-2", displayName: "", motto: "", pictureSrc: ""}, {uid: "cook-3", userId: "user-3", displayName: "", motto: "", pictureSrc: ""}],
    dates: [{uid: "date-1", sortOrder: 0, dateFrom: new Date("2025-07-01"), dateTo: new Date("2025-07-05")}],
    createdAt: new Date("2025-06-01"),
    createdBy: "creator-auth-1",
    updatedAt: new Date("2025-06-01"),
    updatedBy: null,
  },
  {
    uid: "660e8400-e29b-41d4-a716-446655440001",
    name: "Herbstweekend",
    motto: "Gemütlich",
    location: "Bern",
    pictureSrc: "",
    cooks: [{uid: "cook-4", userId: "user-4", displayName: "", motto: "", pictureSrc: ""}, {uid: "cook-5", userId: "user-5", displayName: "", motto: "", pictureSrc: ""}],
    dates: [{uid: "date-2", sortOrder: 0, dateFrom: new Date("2025-10-10"), dateTo: new Date("2025-10-11")}],
    createdAt: new Date("2025-09-01"),
    createdBy: "creator-auth-2",
    updatedAt: new Date("2025-09-01"),
    updatedBy: null,
  },
];

/** Mock-Methoden für Repositories. */
const mockGetAllEventsShort = jest.fn();
const mockFindDisplayNamesByAuthUids = jest.fn();

/** Mock-DatabaseService (kein admin-Client, RLS via is_admin()). */
const mockDatabase: any = {
  events: {
    getAllEventsShort: mockGetAllEventsShort,
  },
  users: {
    findDisplayNamesByIds: mockFindDisplayNamesByAuthUids,
  },
};

/** Hilfs-Render mit DatabaseContext. */
const renderPage = () =>
  render(
    <DatabaseContext.Provider value={mockDatabase}>
      <OverviewEventsPage />
    </DatabaseContext.Provider>
  );

beforeEach(() => {
  jest.clearAllMocks();
  mockGetAllEventsShort.mockResolvedValue([...mockEventDomains]);
  mockFindDisplayNamesByAuthUids.mockResolvedValue(
    new Map([
      ["creator-auth-1", "Anna Koch"],
      ["creator-auth-2", "Beat Müller"],
    ]),
  );
  mockGetFullProfile.mockResolvedValue({
    email: "anna@test.ch",
    firstName: "Anna",
    lastName: "Koch",
    displayName: "Anna Koch",
  });
});

/* ===================================================================
// ======================== Tests =====================================
// =================================================================== */

test("1 – getAllEventsShort wird beim Mount aufgerufen", async () => {
  renderPage();

  await waitFor(() => {
    expect(mockGetAllEventsShort).toHaveBeenCalledTimes(1);
  });
});

test("2 – Events werden nach Fetch als Karten dargestellt", async () => {
  renderPage();

  expect(await screen.findByText("Sommerlager")).toBeInTheDocument();
  expect(await screen.findByText("Herbstweekend")).toBeInTheDocument();
});

test("3 – Suche filtert Events nach Name", async () => {
  renderPage();
  await screen.findByText("Sommerlager");

  const searchInput = screen.getByRole("textbox");
  await userEvent.type(searchInput, "Herbst");

  expect(screen.queryByText("Sommerlager")).not.toBeInTheDocument();
  expect(screen.getByText("Herbstweekend")).toBeInTheDocument();
});

test("4 – Suche löschen setzt Filter zurück", async () => {
  renderPage();
  await screen.findByText("Sommerlager");

  const searchInput = screen.getByRole("textbox");
  await userEvent.type(searchInput, "Herbst");
  expect(screen.queryByText("Sommerlager")).not.toBeInTheDocument();

  const clearButton = screen.getByRole("button", {name: /clear search term/i});
  await userEvent.click(clearButton);

  expect(screen.getByText("Sommerlager")).toBeInTheDocument();
  expect(screen.getByText("Herbstweekend")).toBeInTheDocument();
});

test("5 – Klick auf Karte öffnet Detail-Dialog mit Metadaten", async () => {
  renderPage();
  const card = await screen.findByText("Sommerlager");
  await userEvent.click(card);

  const dialog = screen.getByRole("dialog");
  expect(dialog).toBeInTheDocument();

  // UID im Dialog prüfen (Supabase UUID)
  expect(
    within(dialog).getByText("550e8400-e29b-41d4-a716-446655440000"),
  ).toBeInTheDocument();
  expect(within(dialog).getByText("Zürich")).toBeInTheDocument();
  expect(within(dialog).getByText("Abenteuer")).toBeInTheDocument();
});

test("6 – 'Anlass Öffnen' navigiert mit Supabase UUID", async () => {
  renderPage();
  await userEvent.click(await screen.findByText("Sommerlager"));

  const openButton = screen.getByRole("button", {name: /anlass öffnen/i});
  await userEvent.click(openButton);

  expect(mockNavigate).toHaveBeenCalledWith(
    expect.stringContaining("550e8400-e29b-41d4-a716-446655440000"),
    expect.objectContaining({state: expect.objectContaining({action: expect.anything()})}),
  );
});

test("7 – 'Quittung erstellen' öffnet den Quittungs-Dialog", async () => {
  renderPage();
  await userEvent.click(await screen.findByText("Sommerlager"));

  const receiptButton = screen.getByRole("button", {
    name: /quittung erstellen/i,
  });
  await userEvent.click(receiptButton);

  await waitFor(() => {
    expect(mockGetFullProfile).toHaveBeenCalled();
  });

  await waitFor(() => {
    expect(screen.getByText("Quittung erstellen")).toBeInTheDocument();
  });
});

test("8 – Ansichts-Toggle wechselt zwischen Karten und DataGrid", async () => {
  renderPage();
  await screen.findByText("Sommerlager");

  const listButton = screen.getByRole("button", {name: /listenansicht/i});
  await userEvent.click(listButton);

  await waitFor(() => {
    expect(screen.getByRole("grid")).toBeInTheDocument();
  });

  const cardButton = screen.getByRole("button", {name: /kartenansicht/i});
  await userEvent.click(cardButton);

  await waitFor(() => {
    expect(screen.queryByRole("grid")).not.toBeInTheDocument();
  });
});

test("9 – Fehler beim Laden zeigt AlertMessage", async () => {
  mockGetAllEventsShort.mockRejectedValue(new Error("DB-Fehler"));

  renderPage();

  await waitFor(() => {
    expect(screen.getByText(/warte mal kurz/i)).toBeInTheDocument();
  });
});

test("10 – Leerer Zustand (keine Events)", async () => {
  mockGetAllEventsShort.mockResolvedValue([]);

  renderPage();

  await waitFor(() => {
    expect(screen.getByText(/0 Anlässe/i)).toBeInTheDocument();
  });
});

test("11 – Ersteller-Namen werden aus Supabase aufgelöst", async () => {
  renderPage();

  await waitFor(() => {
    expect(mockFindDisplayNamesByAuthUids).toHaveBeenCalledWith(
      expect.arrayContaining(["creator-auth-1", "creator-auth-2"]),
    );
  });

  // Ersteller-Name auf der Karte sichtbar
  expect(await screen.findByText("Anna Koch")).toBeInTheDocument();
  expect(await screen.findByText("Beat Müller")).toBeInTheDocument();
});
