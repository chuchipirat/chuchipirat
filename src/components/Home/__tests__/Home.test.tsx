/**
 * Unit-Tests fuer HomePage.
 *
 * Testet das initiale Laden aller 5 Datenquellen, Skeleton-Anzeige,
 * Leerstandsmeldungen, Fehlerbehandlung, Layout und Navigation.
 */
// Polyfill fuer jsdom (react-router benoetigt TextEncoder/TextDecoder)
import {TextEncoder, TextDecoder} from "util";
Object.assign(global, {TextEncoder, TextDecoder});

/** Mock: RichTextEditor — vereinfacht als leeres div (wird via systemMessage.tsx gezogen) */
jest.mock("../../Shared/RichTextEditor", () => ({
  RichTextEditor: () => <div data-testid="mock-rich-text-editor" />,
}));

import React from "react";
import {render, screen, waitFor, fireEvent} from "@testing-library/react";
import "@testing-library/jest-dom";
import {MemoryRouter} from "react-router";

import {HomePage} from "../Home";
import {DatabaseContext} from "../../Database/DatabaseContext";
import {EventDomain} from "../../Database/Repository/EventRepository";
import {FeedDomain} from "../../Database/Repository/FeedRepository";
import {Kpi} from "../../Database/Repository/StatsRepository";
import {SystemMessageDomain} from "../../Database/Repository/SystemMessageRepository";
import {FeedType} from "../../Shared/feed.class";

/* ===================================================================
// ======================== Mock-Setup ================================
// =================================================================== */

/** Mock: useAuthUser */
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
jest.mock("../../Session/authUserContext", () => ({
  useAuthUser: () => mockAuthUser,
}));

/** Mock: Sentry */
jest.mock("@sentry/react", () => ({
  captureException: jest.fn(),
}));

/** Mock: ImageRepository */
jest.mock("../../../constants/imageRepository", () => ({
  ImageRepository: {
    getEnvironmentRelatedPicture: () => ({
      CARD_PLACEHOLDER_MEDIA: "test-placeholder.png",
      SIGN_IN_HEADER: "test-header.png",
    }),
  },
}));

/** Mock: NavigationValuesContext */
jest.mock("../../Navigation/NavigationContext", () => ({
  NavigationValuesContext: React.createContext({
    setNavigationValues: jest.fn(),
  }),
  NavigationObject: {home: 1, none: 0},
}));

/** Mock: useNavigate / useLocation */
const mockNavigate = jest.fn();
jest.mock("react-router", () => ({
  ...jest.requireActual("react-router"),
  useNavigate: () => mockNavigate,
  useLocation: () => ({state: null, pathname: "/home"}),
}));

/** Mock: useCustomStyles */
jest.mock("../../../constants/styles", () => ({
  useCustomStyles: jest.fn(() => ({
    container: {},
    card: {},
    cardMedia: {},
    centerCenter: {},
    button: {},
  })),
}));

/** Mock: Repository-Methoden */
const mockGetAllEventsForUser = jest.fn();
const mockGetNewestFeeds = jest.fn();
const mockGetStats = jest.fn();
const mockGetValidMessages = jest.fn();

/** Mock-DatabaseService */
const mockDatabase = {
  events: {
    getAllEventsForUser: mockGetAllEventsForUser,
  },
  feeds: {
    getNewestFeeds: mockGetNewestFeeds,
  },
  stats: {
    getStats: mockGetStats,
  },
  systemMessages: {
    getValidMessages: mockGetValidMessages,
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

const futureDate = new Date("2027-06-15");
const pastDate = new Date("2025-01-10");

const mockFutureEvent = createTestEvent({
  uid: "evt-future-1",
  name: "Sommerlager 2027",
  motto: "Abenteuer",
  dates: [
    {uid: "d1", sortOrder: 0, dateFrom: futureDate, dateTo: new Date("2027-06-20")},
  ],
});

const mockPastEvent = createTestEvent({
  uid: "evt-past-1",
  name: "Winterlager 2024",
  motto: "Schnee",
  dates: [
    {uid: "d2", sortOrder: 0, dateFrom: pastDate, dateTo: new Date("2025-01-15")},
  ],
});

const mockRecipeFeed: FeedDomain = {
  uid: "feed-recipe-1",
  feedType: FeedType.recipePublished,
  visibility: "basic",
  title: "Neues Rezept publiziert",
  text: "Ein tolles Rezept",
  user: {uid: "user-1", displayName: "Koch Anna", pictureSrc: ""},
  sourceObject: {uid: "recipe-1", name: "Spaghetti Bolognese", pictureSrc: ""},
  createdAt: new Date("2026-03-01"),
};

const mockFeedEntry: FeedDomain = {
  uid: "feed-1",
  feedType: FeedType.recipeCommented,
  visibility: "basic",
  title: "Kommentar geschrieben",
  text: "Lecker!",
  user: {uid: "user-2", displayName: "Koch Bruno", pictureSrc: ""},
  sourceObject: {uid: "recipe-2", name: "Risotto", pictureSrc: ""},
  createdAt: new Date("2026-03-02"),
};

const mockStats: Kpi[] = [
  {id: "noUsers", value: 128, caption: "User", group: "Plattform"},
  {id: "noCooks", value: 42, caption: "Aktive Köche", group: "Plattform"},
  {id: "noRecipesPublic", value: 87, caption: "Öffentliche Rezepte", group: "Rezepte"},
  {id: "noEvents", value: 15, caption: "Anlässe", group: "Anlässe"},
];

const mockSystemMessage: SystemMessageDomain = {
  uid: "msg-1",
  text: "Wartungsarbeiten am Samstag",
  severity: "info",
  validFrom: new Date("2026-03-01"),
  validTo: new Date("2026-12-31"),
};

/* ===================================================================
// ======================== Render-Helper =============================
// =================================================================== */

const renderHomePage = () => {
  return render(
    <MemoryRouter initialEntries={["/home"]}>
      <DatabaseContext.Provider value={mockDatabase}>
        <HomePage />
      </DatabaseContext.Provider>
    </MemoryRouter>,
  );
};

/* ===================================================================
// ======================== Tests =====================================
// =================================================================== */

beforeEach(() => {
  jest.clearAllMocks();
  // Standard: alle Datenquellen liefern Daten
  mockGetAllEventsForUser.mockResolvedValue([mockFutureEvent, mockPastEvent]);
  mockGetNewestFeeds.mockResolvedValue([mockRecipeFeed]);
  mockGetStats.mockResolvedValue(mockStats);
  mockGetValidMessages.mockResolvedValue([]);
});

describe("HomePage", () => {
  /* ------------------------------------------
  // Initiales Laden
  // ------------------------------------------ */
  describe("Initiales Laden", () => {
    test("ruft alle Datenquellen beim Laden auf", async () => {
      renderHomePage();

      await waitFor(() => {
        expect(mockGetAllEventsForUser).toHaveBeenCalledTimes(1);
        // getNewestFeeds wird 2x aufgerufen: einmal fuer Rezepte, einmal fuer Feed
        expect(mockGetNewestFeeds).toHaveBeenCalledTimes(2);
        expect(mockGetStats).toHaveBeenCalledTimes(1);
        expect(mockGetValidMessages).toHaveBeenCalledTimes(1);
      });
    });

    test("zeigt Begruessungstext mit Benutzernamen", async () => {
      renderHomePage();

      await waitFor(() => {
        expect(screen.getByText("Hoi Test Koch")).toBeInTheDocument();
      });
    });

    test("zeigt Untertitel 'Lass uns kochen'", async () => {
      renderHomePage();

      await waitFor(() => {
        expect(screen.getByText("Lass uns kochen")).toBeInTheDocument();
      });
    });
  });

  /* ------------------------------------------
  // Events-Bereich
  // ------------------------------------------ */
  describe("Events-Bereich", () => {
    test("zeigt zukuenftige Events an", async () => {
      renderHomePage();

      await waitFor(() => {
        expect(screen.getByText("Sommerlager 2027")).toBeInTheDocument();
      });
    });

    test("zeigt 'Anlass erstellen' Text in der Erstellen-Karte", async () => {
      renderHomePage();

      await waitFor(() => {
        expect(screen.getByText("Anlass erstellen")).toBeInTheDocument();
      });
    });

    test("zeigt Leerstandsmeldung wenn keine Events vorhanden", async () => {
      mockGetAllEventsForUser.mockResolvedValue([]);
      renderHomePage();

      await waitFor(() => {
        expect(
          screen.getByText(
            "Noch keine Anlässe vorhanden. Erstelle deinen ersten Anlass!",
          ),
        ).toBeInTheDocument();
      });
    });

    test("zeigt Button 'Zeige vergangene Anlässe' mit Anzahl", async () => {
      renderHomePage();

      await waitFor(() => {
        expect(
          screen.getByText("Zeige vergangene Anlässe (1)"),
        ).toBeInTheDocument();
      });
    });

    test("zeigt vergangene Events nach Klick auf Toggle", async () => {
      renderHomePage();

      // Warten bis Events geladen
      await waitFor(() => {
        expect(screen.getByText("Sommerlager 2027")).toBeInTheDocument();
      });

      // Auf "Zeige vergangene Anlaesse" klicken
      const toggleButton = screen.getByText("Zeige vergangene Anlässe (1)");
      fireEvent.click(toggleButton);

      await waitFor(() => {
        expect(screen.getByText("Winterlager 2024")).toBeInTheDocument();
      });
    });

    test("zeigt Fehlermeldung bei Events-Ladefehler", async () => {
      mockGetAllEventsForUser.mockRejectedValue(new Error("Events DB Fehler"));
      renderHomePage();

      await waitFor(() => {
        expect(screen.getByRole("alert")).toBeInTheDocument();
      });
    });
  });

  /* ------------------------------------------
  // Rezepte-Bereich
  // ------------------------------------------ */
  describe("Rezepte-Bereich", () => {
    test("zeigt Abschnittsueberschrift 'Die neusten Rezepte'", async () => {
      renderHomePage();

      await waitFor(() => {
        expect(screen.getByText("Die neusten Rezepte")).toBeInTheDocument();
      });
    });

    test("zeigt neueste Rezepte an", async () => {
      renderHomePage();

      await waitFor(() => {
        expect(screen.getByText("Spaghetti Bolognese")).toBeInTheDocument();
      });
    });

    test("zeigt Leerstandsmeldung wenn keine Rezepte", async () => {
      mockGetNewestFeeds.mockResolvedValue([]);
      renderHomePage();

      await waitFor(() => {
        expect(
          screen.getByText("Noch keine Rezepte publiziert."),
        ).toBeInTheDocument();
      });
    });

    test("zeigt Fehlermeldung bei Rezept-Ladefehler", async () => {
      mockGetNewestFeeds.mockRejectedValue(new Error("Recipes DB Fehler"));
      renderHomePage();

      await waitFor(() => {
        expect(screen.getAllByRole("alert").length).toBeGreaterThanOrEqual(1);
      });
    });
  });

  /* ------------------------------------------
  // Feed-Bereich
  // ------------------------------------------ */
  describe("Feed-Bereich", () => {
    test("zeigt Abschnittsueberschrift 'Feed'", async () => {
      renderHomePage();

      await waitFor(() => {
        expect(screen.getByText("Feed")).toBeInTheDocument();
      });
    });

    test("zeigt Feed-Eintraege an", async () => {
      // getNewestFeeds wird 2x aufgerufen: zuerst Rezepte (mit FeedType), dann Feed (ohne)
      mockGetNewestFeeds
        .mockResolvedValueOnce([mockRecipeFeed])
        .mockResolvedValueOnce([mockFeedEntry]);
      renderHomePage();

      await waitFor(() => {
        expect(screen.getByText("Kommentar geschrieben")).toBeInTheDocument();
      });
    });

    test("zeigt Leerstandsmeldung wenn kein Feed vorhanden", async () => {
      mockGetNewestFeeds.mockResolvedValue([]);
      renderHomePage();

      await waitFor(() => {
        expect(
          screen.getByText(
            "Noch keine Aktivitäten. Erstelle einen Anlass oder publiziere ein Rezept, um loszulegen.",
          ),
        ).toBeInTheDocument();
      });
    });
  });

  /* ------------------------------------------
  // Statistik-Bereich
  // ------------------------------------------ */
  describe("Statistik-Bereich", () => {
    test("zeigt Abschnittsueberschrift 'Statistik'", async () => {
      renderHomePage();

      await waitFor(() => {
        expect(screen.getByText("Statistik")).toBeInTheDocument();
      });
    });

    test("zeigt KPI-Werte an", async () => {
      renderHomePage();

      await waitFor(() => {
        expect(screen.getByText("User")).toBeInTheDocument();
        expect(screen.getByText("128")).toBeInTheDocument();
        expect(screen.getByText("Aktive Köche")).toBeInTheDocument();
        expect(screen.getByText("42")).toBeInTheDocument();
      });
    });

    test("zeigt Gruppenheader an", async () => {
      renderHomePage();

      await waitFor(() => {
        expect(screen.getByText("Plattform")).toBeInTheDocument();
        expect(screen.getByText("Rezepte")).toBeInTheDocument();
        // "Anlässe" erscheint mehrfach (als Gruppenheader und als KPI-Caption)
        expect(screen.getAllByText("Anlässe").length).toBeGreaterThanOrEqual(2);
      });
    });

    test("degradiert leise bei Stats-Ladefehler (kein Alert)", async () => {
      mockGetStats.mockRejectedValue(new Error("Stats DB Fehler"));
      renderHomePage();

      // Andere Bereiche laden normal weiter
      await waitFor(() => {
        expect(screen.getByText("Sommerlager 2027")).toBeInTheDocument();
        expect(screen.getByText("Statistik")).toBeInTheDocument();
      });
    });
  });

  /* ------------------------------------------
  // Systemmeldungen
  // ------------------------------------------ */
  describe("Systemmeldungen", () => {
    test("zeigt Systemmeldungen an wenn vorhanden", async () => {
      mockGetValidMessages.mockResolvedValue([mockSystemMessage]);
      renderHomePage();

      await waitFor(() => {
        expect(
          screen.getByText("Wartungsarbeiten am Samstag"),
        ).toBeInTheDocument();
      });
    });

    test("zeigt keine Systemmeldungen wenn leer", async () => {
      mockGetValidMessages.mockResolvedValue([]);
      renderHomePage();

      await waitFor(() => {
        expect(screen.getByText("Sommerlager 2027")).toBeInTheDocument();
      });
      expect(
        screen.queryByText("Wartungsarbeiten am Samstag"),
      ).not.toBeInTheDocument();
    });
  });

  /* ------------------------------------------
  // Sentry-Logging
  // ------------------------------------------ */
  describe("Sentry-Logging", () => {
    test("loggt Events-Fehler in Sentry", async () => {
      const Sentry = require("@sentry/react");
      const testError = new Error("Events Sentry Test");
      mockGetAllEventsForUser.mockRejectedValue(testError);
      renderHomePage();

      await waitFor(() => {
        expect(Sentry.captureException).toHaveBeenCalledWith(testError);
      });
    });

    test("loggt Stats-Fehler in Sentry", async () => {
      const Sentry = require("@sentry/react");
      const testError = new Error("Stats Sentry Test");
      mockGetStats.mockRejectedValue(testError);
      renderHomePage();

      await waitFor(() => {
        expect(Sentry.captureException).toHaveBeenCalledWith(testError);
      });
    });

    test("loggt Feed-Fehler in Sentry", async () => {
      const Sentry = require("@sentry/react");
      const testError = new Error("Feed Sentry Test");
      mockGetNewestFeeds.mockRejectedValue(testError);
      renderHomePage();

      await waitFor(() => {
        expect(Sentry.captureException).toHaveBeenCalledWith(testError);
      });
    });
  });
});
