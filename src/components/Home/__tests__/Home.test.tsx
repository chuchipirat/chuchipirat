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
import {AnalyticsEvent} from "../../Analytics/analyticsEvents";
import {createEmptyMenuplan} from "../../Event/Menuplan/menuplanService";
import {PlanedDiet, PlanedIntolerances} from "../../Event/Menuplan/menuplan.types";
import {EventGroupConfiguration} from "../../Event/GroupConfiguration/groupConfiguration.class";
import {RecipeType} from "../../Recipe/recipe.class";
import {formatLocalDate} from "../../../utils/dateUtils";

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

/** Mock: Analytics */
const mockTrackEvent = jest.fn();
jest.mock("../../Analytics/analyticsService", () => ({
  trackEvent: (...args: unknown[]) => mockTrackEvent(...args),
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
jest.mock("../../Navigation/navigationContext", () => ({
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
const mockGetMealIdsForEventInRange = jest.fn();
const mockGetMenuplanForUi = jest.fn();
const mockGetCutoffTimes = jest.fn();
const mockGetUsedRecipeListsForEvent = jest.fn();
const mockGetShoppingListsForEvent = jest.fn();
const mockGetMaterialListsForEvent = jest.fn();
const mockGetGroupConfig = jest.fn();
const mockGroupConfigDomainToUi = jest.fn();
const mockGetRecipe = jest.fn();

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
  menuplan: {
    getMealIdsForEventInRange: mockGetMealIdsForEventInRange,
    getMenuplanForUi: mockGetMenuplanForUi,
    getCutoffTimes: mockGetCutoffTimes,
  },
  eventGroupConfig: {
    getGroupConfig: mockGetGroupConfig,
    groupConfigDomainToUi: mockGroupConfigDomainToUi,
  },
  recipes: {
    getRecipe: mockGetRecipe,
  },
  usedRecipeLists: {
    getListsForEvent: mockGetUsedRecipeListsForEvent,
  },
  shoppingLists: {
    getListsForEvent: mockGetShoppingListsForEvent,
  },
  materialLists: {
    getListsForEvent: mockGetMaterialListsForEvent,
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
  mockGetMealIdsForEventInRange.mockResolvedValue(new Set());
  mockGetMenuplanForUi.mockResolvedValue(createEmptyMenuplan());
  mockGetCutoffTimes.mockResolvedValue([]);
  mockGetUsedRecipeListsForEvent.mockResolvedValue([]);
  mockGetShoppingListsForEvent.mockResolvedValue([]);
  mockGetMaterialListsForEvent.mockResolvedValue([]);
  mockGetGroupConfig.mockResolvedValue({diets: [], intolerances: [], portions: []});
  mockGroupConfigDomainToUi.mockReturnValue(new EventGroupConfiguration());
  mockGetRecipe.mockResolvedValue(null);
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
      // Die "Anlass erstellen"-Karte bleibt auch im Leerstand sichtbar (nur breiter/zentriert)
      expect(screen.getByText("Anlass erstellen")).toBeInTheDocument();
    });

    test("zeigt Countdown-Badge beim naechsten bevorstehenden Event", async () => {
      renderHomePage();

      await waitFor(() => {
        expect(screen.getByText(/^In \d+ Tagen/)).toBeInTheDocument();
      });
    });

    test("zeigt Countdown fuer jedes Event einzeln, nicht nur fuer das naechste", async () => {
      const soonEvent = createTestEvent({
        uid: "evt-soon",
        name: "Naechste Woche Lager",
        dates: [
          {
            uid: "d-soon",
            sortOrder: 0,
            dateFrom: new Date(Date.now() + 5 * 86_400_000),
            dateTo: new Date(Date.now() + 6 * 86_400_000),
          },
        ],
      });
      const laterEvent = createTestEvent({
        uid: "evt-later",
        name: "Spaeter Lager",
        dates: [
          {
            uid: "d-later",
            sortOrder: 0,
            dateFrom: new Date(Date.now() + 40 * 86_400_000),
            dateTo: new Date(Date.now() + 42 * 86_400_000),
          },
        ],
      });
      mockGetAllEventsForUser.mockResolvedValue([soonEvent, laterEvent]);

      renderHomePage();

      await waitFor(() => {
        expect(screen.getByText("Naechste Woche Lager")).toBeInTheDocument();
        expect(screen.getByText("Spaeter Lager")).toBeInTheDocument();
      });
      // Beide Events zeigen ein eigenes Countdown-Badge ("In X Tagen")
      expect(screen.getAllByText(/^In \d+ Tagen/)).toHaveLength(2);
    });

    test("zeigt keinen Countdown wenn keine Events vorhanden", async () => {
      mockGetAllEventsForUser.mockResolvedValue([]);
      renderHomePage();

      await waitFor(() => {
        expect(
          screen.getByText("Noch keine Anlässe vorhanden. Erstelle deinen ersten Anlass!"),
        ).toBeInTheDocument();
      });
      expect(screen.queryByText(/In \d+ Tagen/)).not.toBeInTheDocument();
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

    test("zeigt ein Event, dessen letzter Tag heute ist, als aktuell (nicht vergangen)", async () => {
      const todayMidnight = new Date();
      todayMidnight.setHours(0, 0, 0, 0);
      const lastDayTodayEvent = createTestEvent({
        uid: "evt-ends-today",
        name: "Endet Heute Lager",
        dates: [
          {
            uid: "d-ends-today",
            sortOrder: 0,
            dateFrom: new Date(todayMidnight.getTime() - 2 * 86_400_000),
            dateTo: todayMidnight,
          },
        ],
      });
      mockGetAllEventsForUser.mockResolvedValue([lastDayTodayEvent]);

      renderHomePage();

      await waitFor(() => {
        expect(screen.getByText("Endet Heute Lager")).toBeInTheDocument();
      });
      // Darf nicht unter "vergangene Anlässe" gezaehlt werden
      expect(
        screen.getByText("Zeige vergangene Anlässe (0)"),
      ).toBeInTheDocument();
    });
  });

  /* ------------------------------------------
  // Bereitschafts-Checkliste
  // ------------------------------------------ */
  describe("Bereitschafts-Checkliste", () => {
    /** Event, das in `daysFromNow` Tagen beginnt (Zeitscheibe von 2 Tagen Dauer). */
    function createEventStartingInDays(daysFromNow: number): EventDomain {
      const from = new Date();
      from.setHours(12, 0, 0, 0);
      from.setDate(from.getDate() + daysFromNow);
      const to = new Date(from);
      to.setDate(to.getDate() + 1);

      return createTestEvent({
        uid: "evt-readiness-1",
        name: "Herbstlager",
        dates: [{uid: "d-readiness-1", sortOrder: 0, dateFrom: from, dateTo: to}],
      });
    }

    test("zeigt die Checkliste, wenn der Anlass innerhalb von 14 Tagen beginnt", async () => {
      mockGetAllEventsForUser.mockResolvedValue([createEventStartingInDays(5)]);
      mockGetUsedRecipeListsForEvent.mockResolvedValue([]);
      mockGetShoppingListsForEvent.mockResolvedValue([]);
      mockGetMaterialListsForEvent.mockResolvedValue([]);

      renderHomePage();

      await waitFor(() => {
        expect(screen.getByText("Verwendete Rezepte")).toBeInTheDocument();
        expect(screen.getByText("Einkaufsliste")).toBeInTheDocument();
        expect(screen.getByText("Materialliste")).toBeInTheDocument();
      });
      screen.getAllByRole("checkbox").forEach((checkbox) => {
        expect(checkbox).not.toBeChecked();
      });
    });

    test("zeigt die Checkliste nicht, wenn der Anlass mehr als 14 Tage entfernt ist", async () => {
      mockGetAllEventsForUser.mockResolvedValue([createEventStartingInDays(20)]);

      renderHomePage();

      await waitFor(() => {
        expect(screen.getByText("Herbstlager")).toBeInTheDocument();
      });
      expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    });

    test("zeigt einen Eintrag als bereit, wenn eine Liste eine Mahlzeit der Zielzeitscheibe abdeckt", async () => {
      mockGetAllEventsForUser.mockResolvedValue([createEventStartingInDays(5)]);
      mockGetMealIdsForEventInRange.mockResolvedValue(new Set(["meal-1"]));
      mockGetUsedRecipeListsForEvent.mockResolvedValue([
        {id: "list-1", eventId: "evt-readiness-1", name: "Liste", selectedMeals: ["meal-1"]},
      ]);

      renderHomePage();

      await waitFor(() => {
        expect(screen.getByText("Verwendete Rezepte")).toBeInTheDocument();
      });
      expect(screen.getAllByRole("checkbox")[0]).toBeChecked();
    });

    test("zeigt einen Eintrag als nicht bereit, wenn eine Liste nur eine ANDERE Zeitscheibe abdeckt", async () => {
      mockGetAllEventsForUser.mockResolvedValue([createEventStartingInDays(5)]);
      // Liste deckt "meal-other" ab — nicht Teil der Ziel-Zeitscheibe (meal-1)
      mockGetMealIdsForEventInRange.mockResolvedValue(new Set(["meal-1"]));
      mockGetUsedRecipeListsForEvent.mockResolvedValue([
        {id: "list-1", eventId: "evt-readiness-1", name: "Liste", selectedMeals: ["meal-other"]},
      ]);

      renderHomePage();

      await waitFor(() => {
        expect(screen.getByText("Verwendete Rezepte")).toBeInTheDocument();
      });
      expect(screen.getAllByRole("checkbox")[0]).not.toBeChecked();
    });

    test("navigiert beim Klick auf einen Checklisten-Eintrag zum passenden Tab", async () => {
      mockGetAllEventsForUser.mockResolvedValue([createEventStartingInDays(5)]);

      renderHomePage();

      await waitFor(() => {
        expect(screen.getByText("Einkaufsliste")).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText("Einkaufsliste"));

      expect(mockNavigate).toHaveBeenCalledWith(
        "/event/evt-readiness-1?tab=shoppinglist",
      );
    });
  });

  /* ------------------------------------------
  // "Läuft gerade"-Abschnitt
  // ------------------------------------------ */
  describe("Läuft-gerade-Abschnitt", () => {
    /** Event, das heute läuft (Zeitscheibe von gestern bis morgen). */
    function createOngoingEvent(): EventDomain {
      const from = new Date();
      from.setDate(from.getDate() - 1);
      const to = new Date();
      to.setDate(to.getDate() + 1);

      return createTestEvent({
        uid: "evt-ongoing-1",
        name: "Laufendes Lager",
        dates: [{uid: "d-ongoing-1", sortOrder: 0, dateFrom: from, dateTo: to}],
      });
    }

    test("zeigt den Abschnitt nicht, wenn kein Anlass gerade laeuft", async () => {
      renderHomePage();

      await waitFor(() => {
        expect(screen.getByText("Sommerlager 2027")).toBeInTheDocument();
      });
      expect(screen.queryByText("Läuft gerade")).not.toBeInTheDocument();
    });

    /** Baut einen Menuplan mit genau einer heutigen Mahlzeit/einem Rezept. */
    function buildTodaysMenuplan({
      mealTypeName,
      recipeName,
    }: {
      mealTypeName: string;
      recipeName: string;
    }) {
      const menuplan = createEmptyMenuplan();
      const todayStr = formatLocalDate(new Date());
      menuplan.mealTypes = {
        entries: {"mt-1": {uid: "mt-1", name: mealTypeName}},
        order: ["mt-1"],
      };
      menuplan.meals = {
        "meal-1": {
          uid: "meal-1",
          date: todayStr,
          mealType: "mt-1",
          menuOrder: ["menue-1"],
        },
      };
      menuplan.menues = {
        "menue-1": {
          uid: "menue-1",
          name: "",
          mealRecipeOrder: ["mr-1"],
          materialOrder: [],
          productOrder: [],
        },
      };
      menuplan.mealRecipes = {
        "mr-1": {
          uid: "mr-1",
          recipe: {
            recipeUid: "recipe-1",
            name: recipeName,
            type: RecipeType.public,
            createdFromUid: "",
          },
          plan: [
            {
              diet: PlanedDiet.ALL,
              intolerance: PlanedIntolerances.ALL,
              factor: 1,
              totalPortions: 12,
            },
          ],
          totalPortions: 12,
        },
      };
      return menuplan;
    }

    test("zeigt den Abschnitt mit noch anstehenden Mahlzeiten, wenn ein Anlass laeuft", async () => {
      mockGetAllEventsForUser.mockResolvedValue([createOngoingEvent()]);
      mockGetMenuplanForUi.mockResolvedValue(
        buildTodaysMenuplan({mealTypeName: "Zmittag", recipeName: "Rösti"}),
      );
      mockGetCutoffTimes.mockResolvedValue([]);

      renderHomePage();

      await waitFor(() => {
        expect(screen.getByText("Läuft gerade")).toBeInTheDocument();
        expect(screen.getByText("Zmittag")).toBeInTheDocument();
        expect(screen.getByText("Rösti")).toBeInTheDocument();
      });
    });

    test("navigiert beim Klick auf ein Rezept zum Menuplan-Tab mit Deep-Link zum Rezept-Drawer", async () => {
      mockGetAllEventsForUser.mockResolvedValue([createOngoingEvent()]);
      mockGetMenuplanForUi.mockResolvedValue(
        buildTodaysMenuplan({mealTypeName: "Zmittag", recipeName: "Rösti"}),
      );
      mockGetCutoffTimes.mockResolvedValue([]);

      renderHomePage();

      await waitFor(() => {
        expect(screen.getByText("Rösti")).toBeInTheDocument();
      });
      fireEvent.click(screen.getByText("Rösti"));

      expect(mockNavigate).toHaveBeenCalledWith(
        "/event/evt-ongoing-1?tab=menuplan&openRecipe=mr-1",
      );
    });

    test("zeigt einen Trenner nach dem Abschnitt, wenn er sichtbar ist", async () => {
      mockGetAllEventsForUser.mockResolvedValue([createOngoingEvent()]);
      mockGetMenuplanForUi.mockResolvedValue(
        buildTodaysMenuplan({mealTypeName: "Zmittag", recipeName: "Rösti"}),
      );
      mockGetCutoffTimes.mockResolvedValue([]);

      const {container} = renderHomePage();

      await waitFor(() => {
        expect(screen.getByText("Läuft gerade")).toBeInTheDocument();
      });
      // 1 bestehender Trenner (vor Rezepte/Feed) + 1 neuer nach "Läuft gerade"
      // (Trenner der Statistik-Gruppen sind <li>, nicht <hr>, und daher ausgeschlossen)
      expect(container.querySelectorAll("hr")).toHaveLength(2);
    });

    test("zeigt keinen zusaetzlichen Trenner, wenn der Abschnitt nicht sichtbar ist", async () => {
      const {container} = renderHomePage();

      await waitFor(() => {
        expect(screen.getByText("Sommerlager 2027")).toBeInTheDocument();
      });
      expect(container.querySelectorAll("hr")).toHaveLength(1);
    });

    test("zeigt eine eigene Sektion pro gleichzeitig laufendem Anlass", async () => {
      const from = new Date();
      from.setDate(from.getDate() - 1);
      const to = new Date();
      to.setDate(to.getDate() + 1);
      const secondOngoingEvent = createTestEvent({
        uid: "evt-ongoing-2",
        name: "Zweites Laufendes Lager",
        dates: [{uid: "d-ongoing-2", sortOrder: 0, dateFrom: from, dateTo: to}],
      });
      mockGetAllEventsForUser.mockResolvedValue([
        createOngoingEvent(),
        secondOngoingEvent,
      ]);
      mockGetMenuplanForUi.mockResolvedValue(
        buildTodaysMenuplan({mealTypeName: "Zmittag", recipeName: "Rösti"}),
      );
      mockGetCutoffTimes.mockResolvedValue([]);

      renderHomePage();

      await waitFor(() => {
        expect(screen.getAllByText("Läuft gerade")).toHaveLength(2);
      });
    });

    test("blendet den Abschnitt aus, wenn alle Mahlzeiten bereits ihre Cutoff-Zeit ueberschritten haben", async () => {
      mockGetAllEventsForUser.mockResolvedValue([createOngoingEvent()]);
      mockGetMenuplanForUi.mockResolvedValue(
        buildTodaysMenuplan({mealTypeName: "Zmorge", recipeName: "Rösti"}),
      );
      // Cutoff von "00:01" ist garantiert bereits ueberschritten
      mockGetCutoffTimes.mockResolvedValue([
        {id: "c1", names: ["Zmorge"], cutoffTime: "00:01", sortOrder: 1},
      ]);

      renderHomePage();

      await waitFor(() => {
        expect(screen.getByText("Laufendes Lager")).toBeInTheDocument();
      });
      expect(screen.queryByText("Läuft gerade")).not.toBeInTheDocument();
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

    test("zeigt nur 5 Eintraege und einen 'Zeige weitere Eintraege'-Button bei mehr als 5", async () => {
      const manyFeedEntries: FeedDomain[] = Array.from({length: 7}, (_, index) => ({
        ...mockFeedEntry,
        uid: `feed-many-${index}`,
        title: `Feed-Eintrag ${index}`,
      }));
      mockGetNewestFeeds
        .mockResolvedValueOnce([mockRecipeFeed])
        .mockResolvedValueOnce(manyFeedEntries);
      renderHomePage();

      await waitFor(() => {
        expect(screen.getByText("Feed-Eintrag 0")).toBeInTheDocument();
      });

      // Nur die ersten 5 sind sichtbar
      expect(screen.getByText("Feed-Eintrag 4")).toBeInTheDocument();
      expect(screen.queryByText("Feed-Eintrag 5")).not.toBeInTheDocument();
      expect(screen.queryByText("Feed-Eintrag 6")).not.toBeInTheDocument();

      const showMoreButton = screen.getByText("Zeige weitere Einträge (2)");
      expect(showMoreButton).toBeInTheDocument();

      fireEvent.click(showMoreButton);

      await waitFor(() => {
        expect(screen.getByText("Feed-Eintrag 5")).toBeInTheDocument();
        expect(screen.getByText("Feed-Eintrag 6")).toBeInTheDocument();
      });
      expect(
        screen.queryByText(/Zeige weitere Einträge/),
      ).not.toBeInTheDocument();
    });

    test("zeigt keinen 'Zeige weitere Eintraege'-Button bei 5 oder weniger Eintraegen", async () => {
      const fewFeedEntries: FeedDomain[] = Array.from({length: 3}, (_, index) => ({
        ...mockFeedEntry,
        uid: `feed-few-${index}`,
        title: `Feed-Eintrag ${index}`,
      }));
      mockGetNewestFeeds
        .mockResolvedValueOnce([mockRecipeFeed])
        .mockResolvedValueOnce(fewFeedEntries);
      renderHomePage();

      await waitFor(() => {
        expect(screen.getByText("Feed-Eintrag 0")).toBeInTheDocument();
      });
      expect(
        screen.queryByText(/Zeige weitere Einträge/),
      ).not.toBeInTheDocument();
    });

    test("trackt Umami-Event beim Klick auf 'Zeige weitere Eintraege'", async () => {
      const manyFeedEntries: FeedDomain[] = Array.from({length: 7}, (_, index) => ({
        ...mockFeedEntry,
        uid: `feed-track-${index}`,
        title: `Feed-Eintrag ${index}`,
      }));
      mockGetNewestFeeds
        .mockResolvedValueOnce([mockRecipeFeed])
        .mockResolvedValueOnce(manyFeedEntries);
      renderHomePage();

      await waitFor(() => {
        expect(screen.getByText("Feed-Eintrag 0")).toBeInTheDocument();
      });

      const showMoreButton = screen.getByText("Zeige weitere Einträge (2)");
      fireEvent.click(showMoreButton);

      expect(mockTrackEvent).toHaveBeenCalledWith(
        AnalyticsEvent.HOME_FEED_SHOW_MORE,
      );
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
      const Sentry = jest.requireMock<typeof import("@sentry/react")>("@sentry/react");
      const testError = new Error("Events Sentry Test");
      mockGetAllEventsForUser.mockRejectedValue(testError);
      renderHomePage();

      await waitFor(() => {
        expect(Sentry.captureException).toHaveBeenCalledWith(testError);
      });
    });

    test("loggt Stats-Fehler in Sentry", async () => {
      const Sentry = jest.requireMock<typeof import("@sentry/react")>("@sentry/react");
      const testError = new Error("Stats Sentry Test");
      mockGetStats.mockRejectedValue(testError);
      renderHomePage();

      await waitFor(() => {
        expect(Sentry.captureException).toHaveBeenCalledWith(testError);
      });
    });

    test("loggt Feed-Fehler in Sentry", async () => {
      const Sentry = jest.requireMock<typeof import("@sentry/react")>("@sentry/react");
      const testError = new Error("Feed Sentry Test");
      mockGetNewestFeeds.mockRejectedValue(testError);
      renderHomePage();

      await waitFor(() => {
        expect(Sentry.captureException).toHaveBeenCalledWith(testError);
      });
    });
  });
});
