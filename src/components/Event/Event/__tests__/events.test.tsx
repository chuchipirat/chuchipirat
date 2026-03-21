/**
 * Unit-Tests fuer EventsPage.
 *
 * Testet das initiale Laden, die Aufteilung in zukuenftige/vergangene Events,
 * Leerstandsmeldungen und Fehlerbehandlung.
 */
// Polyfill fuer jsdom (react-router benoetigt TextEncoder/TextDecoder)
import {TextEncoder, TextDecoder} from "util";
Object.assign(global, {TextEncoder, TextDecoder});

import React from "react";
import {render, screen, waitFor} from "@testing-library/react";
import "@testing-library/jest-dom";
import {MemoryRouter} from "react-router";

import EventsPage from "../events";
import {DatabaseContext} from "../../../Database/DatabaseContext";
import {EventDomain, EventDateDomain} from "../../../Database/Repository/EventRepository";

/* ===================================================================
// ======================== Mock-Setup ================================
// =================================================================== */

/** Mock: useAuthUser */
const mockAuthUser = {
  uid: "auth-uuid-123",
  email: "test@chuchipirat.ch",
  roles: [],
};
jest.mock("../../../Session/authUserContext", () => ({
  useAuthUser: () => mockAuthUser,
}));

/** Mock: useCustomDialog */
jest.mock("../../../Shared/customDialogContext", () => ({
  ...jest.requireActual("../../../Shared/customDialogContext"),
  useCustomDialog: () => ({customDialog: jest.fn()}),
}));

/** Mock: ImageRepository */
jest.mock("../../../../constants/imageRepository", () => ({
  ImageRepository: {
    getEnvironmentRelatedPicture: () => ({
      CARD_PLACEHOLDER_MEDIA: "test-placeholder.png",
      SIGN_IN_HEADER: "test-header.png",
    }),
  },
}));

/** Mock: useFirebase (noch fuer andere Komponenten referenziert) */
jest.mock("../../../Firebase/firebaseContext", () => ({
  useFirebase: () => ({}),
}));

/** Mock: EventRepository */
const mockGetAllEventsForUser = jest.fn();

/** Mock-DatabaseService */
const mockDatabase = {
  events: {
    getAllEventsForUser: mockGetAllEventsForUser,
  },
} as any;

/* ===================================================================
// ======================== Testdaten =================================
// =================================================================== */

/**
 * Erzeugt ein Testevent mit den uebergebenen Daten.
 */
function createTestEvent(
  overrides: Partial<EventDomain> & {uid: string; name: string},
): EventDomain {
  return {
    motto: "",
    location: "",
    pictureSrc: "",
    cooks: [],
    dates: [],
    createdAt: new Date("2026-01-01"),
    createdBy: null,
    updatedAt: new Date("2026-01-01"),
    updatedBy: null,
    ...overrides,
  };
}

// Festes "heute" fuer deterministische Tests
const futureDate = new Date("2027-06-15");
const pastDate = new Date("2025-01-10");

const mockEvents: EventDomain[] = [
  createTestEvent({
    uid: "evt-future-1",
    name: "Sommerlager 2027",
    motto: "Abenteuer",
    dates: [
      {uid: "d1", sortOrder: 0, dateFrom: futureDate, dateTo: new Date("2027-06-20")},
    ],
  }),
  createTestEvent({
    uid: "evt-past-1",
    name: "Winterlager 2024",
    motto: "Schnee",
    dates: [
      {uid: "d2", sortOrder: 0, dateFrom: pastDate, dateTo: new Date("2025-01-15")},
    ],
  }),
];

/* ===================================================================
// ======================== Render-Helper =============================
// =================================================================== */

const renderEventsPage = () => {
  return render(
    <MemoryRouter initialEntries={["/events"]}>
      <DatabaseContext.Provider value={mockDatabase}>
        <EventsPage />
      </DatabaseContext.Provider>
    </MemoryRouter>,
  );
};

/* ===================================================================
// ======================== Tests =====================================
// =================================================================== */

beforeEach(() => {
  jest.clearAllMocks();
  mockGetAllEventsForUser.mockResolvedValue(mockEvents);
});

describe("EventsPage", () => {
  test("ruft getAllEventsForUser() beim Laden auf", async () => {
    renderEventsPage();

    await waitFor(() => {
      expect(mockGetAllEventsForUser).toHaveBeenCalledTimes(1);
    });
  });

  test("zeigt zukuenftige Events an", async () => {
    renderEventsPage();

    await waitFor(() => {
      expect(screen.getByText("Sommerlager 2027")).toBeInTheDocument();
    });
  });

  test("zeigt vergangene Events an", async () => {
    renderEventsPage();

    await waitFor(() => {
      expect(screen.getByText("Winterlager 2024")).toBeInTheDocument();
    });
  });

  test("zeigt Leerstandsmeldung wenn keine zukuenftigen Events", async () => {
    // Nur vergangene Events
    mockGetAllEventsForUser.mockResolvedValue([mockEvents[1]]);
    renderEventsPage();

    await waitFor(() => {
      expect(
        screen.getByText("Keine bevorstehenden Anlässe. Erstelle einen neuen Anlass!"),
      ).toBeInTheDocument();
    });
  });

  test("zeigt Leerstandsmeldung wenn keine vergangenen Events", async () => {
    // Nur zukuenftige Events
    mockGetAllEventsForUser.mockResolvedValue([mockEvents[0]]);
    renderEventsPage();

    await waitFor(() => {
      expect(
        screen.getByText("Keine vergangenen Anlässe vorhanden."),
      ).toBeInTheDocument();
    });
  });

  test("zeigt Fehlermeldung bei fehlgeschlagenem Laden", async () => {
    mockGetAllEventsForUser.mockRejectedValue(new Error("DB Fehler"));
    renderEventsPage();

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });
  });

  test("zeigt Seitentitel 'Anlässe'", async () => {
    renderEventsPage();

    await waitFor(() => {
      expect(screen.getByText("Anlässe")).toBeInTheDocument();
    });
  });
});
