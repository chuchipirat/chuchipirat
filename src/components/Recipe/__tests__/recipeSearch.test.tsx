/**
 * Unit-Tests für RecipeSearch und RecipesPage (seitenweise Rezeptliste).
 *
 * Fokus: erste Seite, Nachladen, Suche und Filter in der Datenbank, sofortige
 * lokale Vorschau, Leer-/Fehlerzustand, eingebettete Suche (Schublade) und
 * Wiederherstellen nach der Rückkehr aus einem Rezept.
 */
// Polyfill für jsdom (react-router benötigt TextEncoder/TextDecoder)
import {TextEncoder, TextDecoder} from "util";
Object.assign(global, {TextEncoder, TextDecoder});

import React from "react";
import {render, screen, act, fireEvent, waitFor} from "@testing-library/react";
import "@testing-library/jest-dom";
import {MemoryRouter} from "react-router";

import {RecipeSearch, RecipesPage} from "../recipes";
import {DatabaseContext} from "../../Database/DatabaseContext";
import {DatabaseService} from "../../Database/DatabaseService";
import type {
  RecipeListPage,
  RecipeShortDomain,
} from "../../Database/Repository/RecipeRepository";
import AuthUser from "../../Session/authUser.class";
import {Diet} from "../../Product/product.types";
import {INITIAL_SEARCH_SETTINGS} from "../recipeList.types";
import {saveRecipeListCache, saveRecipeListScrollY} from "../recipeListCache";
import {
  buildRecipeListQuery,
  domainToRecipeShort,
  getRecipeListQueryKey,
} from "../recipeListUtils";
import {AnalyticsEvent} from "../../Analytics/analyticsEvents";

/* ===================================================================
// ======================== Mock-Setup ================================
// =================================================================== */

jest.mock("../../../constants/imageRepository", () => ({
  ImageRepository: {
    getEnvironmentRelatedPicture: () => ({
      SIGN_IN_HEADER: "test-image.png",
      CARD_PLACEHOLDER_MEDIA: "placeholder.png",
    }),
  },
}));

const mockTrackEvent = jest.fn();
jest.mock("../../Analytics/analyticsService", () => ({
  trackEvent: (...args: unknown[]) => mockTrackEvent(...args),
}));

jest.mock("@sentry/react", () => ({captureException: jest.fn()}));

const authUser = {uid: "user-1", roles: []} as unknown as AuthUser;
jest.mock("../../Session/authUserContext", () => ({
  useAuthUser: () => ({uid: "user-1", roles: [], email: "a@b.ch"}),
}));

const mockListRecipeShorts = jest.fn();
const mockDatabase = {
  recipes: {listRecipeShorts: mockListRecipeShorts},
} as unknown as DatabaseService;

const createDomain = (index: number, name?: string): RecipeShortDomain => ({
  uid: `r${String(index).padStart(3, "0")}`,
  name: name ?? `Rezept ${String(index).padStart(3, "0")}`,
  source: "",
  pictureSrc: "",
  tags: [],
  menuTypes: [],
  dietProperties: {diet: Diet.Meat, allergens: []},
  outdoorKitchenSuitable: false,
  avgRating: 0,
  noRatings: 0,
  noComments: 0,
  recipeType: "public",
  variantName: null,
  createdAt: new Date("2026-01-01"),
  createdBy: "other",
});

const createPage = (
  indices: number[],
  options: {hasMore?: boolean; total?: number | null; names?: Record<number, string>} = {},
): RecipeListPage => {
  const recipes = indices.map((index) => createDomain(index, options.names?.[index]));
  const last = recipes[recipes.length - 1];
  const hasMore = options.hasMore ?? false;
  return {
    recipes,
    hasMore,
    nextCursor: hasMore && last ? {name: last.name, uid: last.uid} : null,
    total: options.total ?? null,
  };
};

type SearchProps = Partial<React.ComponentProps<typeof RecipeSearch>>;

const renderSearch = (props: SearchProps = {}) =>
  render(
    <DatabaseContext.Provider value={mockDatabase}>
      <RecipeSearch
        onNewClick={jest.fn()}
        onCardClick={jest.fn()}
        authUser={authUser}
        {...props}
      />
    </DatabaseContext.Provider>,
  );

const flush = async () => {
  await act(async () => {
    await Promise.resolve();
  });
};

const typeSearch = (text: string) => {
  fireEvent.change(screen.getByLabelText("Suchbegriff"), {target: {value: text}});
};

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  sessionStorage.clear();
});

afterEach(() => {
  jest.useRealTimers();
});

/* ===================================================================
// ============================ Tests =================================
// =================================================================== */

describe("RecipeSearch — Liste", () => {
  test("zeigt die erste Seite und die Gesamtzahl", async () => {
    mockListRecipeShorts.mockResolvedValue(createPage([1, 2, 3], {total: 57, hasMore: true}));
    renderSearch();
    await flush();

    expect(screen.getByText("Rezept 001")).toBeInTheDocument();
    expect(screen.getByText("Rezept 003")).toBeInTheDocument();
    expect(screen.getByText("57 Rezepte")).toBeInTheDocument();
  });

  test("Einzahl bei genau einem Rezept", async () => {
    mockListRecipeShorts.mockResolvedValue(createPage([1], {total: 1}));
    renderSearch();
    await flush();

    expect(screen.getByText("1 Rezept")).toBeInTheDocument();
  });

  test("zeigt bis zur Antwort Platzhalter und keine Leer-Meldung", async () => {
    mockListRecipeShorts.mockReturnValue(new Promise(() => undefined));
    renderSearch();
    await flush();

    expect(screen.queryByText("Kein passendes Rezept gefunden")).not.toBeInTheDocument();
  });

  test("meldet «keine Treffer» erst, wenn die Datenbank es bestätigt", async () => {
    mockListRecipeShorts.mockResolvedValue(createPage([], {total: 0}));
    renderSearch();
    await flush();

    expect(screen.getByText("Kein passendes Rezept gefunden")).toBeInTheDocument();
  });

  test("Kartenklick und FAB liefern das angeklickte Rezept", async () => {
    mockListRecipeShorts.mockResolvedValue(createPage([1, 2], {total: 2}));
    const onCardClick = jest.fn();
    const onFabButtonClick = jest.fn();
    renderSearch({onCardClick, onFabButtonClick, fabButtonIcon: <span>+</span>});
    await flush();

    fireEvent.click(screen.getByText("Rezept 002"));
    expect(onCardClick).toHaveBeenCalledWith(
      expect.objectContaining({recipe: expect.objectContaining({uid: "r002"})}),
    );

    fireEvent.click(document.getElementById("recipeCardFab_r001") as HTMLElement);
    expect(onFabButtonClick).toHaveBeenCalledWith(
      expect.objectContaining({recipe: expect.objectContaining({uid: "r001"})}),
    );
  });
});

describe("RecipeSearch — Nachladen", () => {
  test("ohne IntersectionObserver lädt der Knopf «Mehr Rezepte laden» die nächste Seite nach", async () => {
    mockListRecipeShorts.mockResolvedValueOnce(createPage([1, 2], {total: 4, hasMore: true}));
    renderSearch();
    await flush();

    mockListRecipeShorts.mockResolvedValueOnce(createPage([3, 4], {hasMore: false}));
    fireEvent.click(screen.getByRole("button", {name: "Mehr Rezepte laden"}));
    await flush();

    expect(screen.getByText("Rezept 004")).toBeInTheDocument();
    expect(screen.queryByRole("button", {name: "Mehr Rezepte laden"})).not.toBeInTheDocument();
    expect(mockListRecipeShorts.mock.calls[1][0]).toMatchObject({
      after: {name: "Rezept 002", uid: "r002"},
    });
  });

  test("ein Nachladefehler zeigt Hinweis und «Erneut versuchen», bereits geladene Karten bleiben", async () => {
    mockListRecipeShorts.mockResolvedValueOnce(createPage([1], {total: 3, hasMore: true}));
    renderSearch();
    await flush();

    mockListRecipeShorts.mockRejectedValueOnce(new Error("Timeout"));
    fireEvent.click(screen.getByRole("button", {name: "Mehr Rezepte laden"}));
    await flush();

    expect(screen.getByText("Weitere Rezepte konnten nicht geladen werden.")).toBeInTheDocument();
    expect(screen.getByText("Rezept 001")).toBeInTheDocument();

    mockListRecipeShorts.mockResolvedValueOnce(createPage([2, 3]));
    fireEvent.click(screen.getByRole("button", {name: "Erneut versuchen"}));
    await flush();
    expect(screen.getByText("Rezept 003")).toBeInTheDocument();
  });

  test("ein Ladefehler der ersten Seite zeigt Hinweis, «Erneut versuchen» lädt neu", async () => {
    mockListRecipeShorts.mockRejectedValueOnce(new Error("offline"));
    renderSearch();
    await flush();
    expect(screen.getByText(/Die Rezepte konnten nicht geladen werden/)).toBeInTheDocument();

    mockListRecipeShorts.mockResolvedValueOnce(createPage([1], {total: 1}));
    fireEvent.click(screen.getByRole("button", {name: "Erneut versuchen"}));
    await flush();

    expect(screen.getByText("Rezept 001")).toBeInTheDocument();
    expect(screen.queryByText(/Die Rezepte konnten nicht geladen werden/)).not.toBeInTheDocument();
  });
});

describe("RecipeSearch — Suche und Filter", () => {
  test("Tippen zeigt sofort die passenden geladenen Karten, danach kommt die Antwort der Datenbank", async () => {
    mockListRecipeShorts.mockResolvedValueOnce(
      createPage([1, 2], {total: 2, names: {1: "Hörnli und Ghackets", 2: "Spaghetti"}}),
    );
    renderSearch();
    await flush();

    typeSearch("hornli");
    expect(screen.getByText("Hörnli und Ghackets")).toBeInTheDocument();
    expect(screen.queryByText("Spaghetti")).not.toBeInTheDocument();
    expect(screen.getByText("1+ Rezepte")).toBeInTheDocument();
    expect(mockListRecipeShorts).toHaveBeenCalledTimes(1);

    mockListRecipeShorts.mockResolvedValueOnce(
      createPage([1, 9], {total: 2, names: {1: "Hörnli und Ghackets", 9: "Hörnli Auflauf"}}),
    );
    await act(async () => {
      jest.advanceTimersByTime(300);
    });
    await flush();

    expect(mockListRecipeShorts.mock.calls[1][0]).toMatchObject({searchText: "hornli"});
    expect(screen.getByText("Hörnli Auflauf")).toBeInTheDocument();
    expect(screen.getByText("2 Rezepte")).toBeInTheDocument();
  });

  test("ein Filter der erweiterten Suche geht sofort an die Datenbank", async () => {
    mockListRecipeShorts.mockResolvedValue(createPage([1], {total: 1}));
    renderSearch();
    await flush();

    fireEvent.click(screen.getByRole("button", {name: "Erweiterte Suche"}));
    mockListRecipeShorts.mockResolvedValueOnce(createPage([5], {total: 1}));
    fireEvent.click(screen.getByRole("button", {name: "Vegan"}));
    await flush();

    expect(mockListRecipeShorts.mock.calls[1][0]).toMatchObject({diet: Diet.Vegan});
  });

  const noResultCalls = () =>
    mockTrackEvent.mock.calls.filter(([event]) => event === AnalyticsEvent.SEARCH_NO_RESULTS);

  test("meldet eine erfolglose Suche genau einmal (Analytics)", async () => {
    mockListRecipeShorts.mockResolvedValueOnce(createPage([1], {total: 1}));
    renderSearch();
    await flush();

    mockListRecipeShorts.mockResolvedValueOnce(createPage([], {total: 0}));
    typeSearch("xyz");
    await act(async () => {
      jest.advanceTimersByTime(700);
    });
    await flush();

    expect(noResultCalls()).toHaveLength(1);
    expect(noResultCalls()[0][1]).toEqual({source: "recipe", searchTerm: "xyz"});

    // Ein späterer, unabhängiger Neuaufbau derselben Anzeige meldet nicht erneut
    await act(async () => {
      jest.advanceTimersByTime(2000);
    });
    expect(noResultCalls()).toHaveLength(1);
  });

  test("meldet ein leeres Ergebnis nicht als erfolglose Suche, solange ein Filter aktiv ist", async () => {
    mockListRecipeShorts.mockResolvedValueOnce(createPage([1], {total: 1}));
    renderSearch();
    await flush();

    fireEvent.click(screen.getByRole("button", {name: "Erweiterte Suche"}));
    mockListRecipeShorts.mockResolvedValueOnce(createPage([2], {total: 1}));
    fireEvent.click(screen.getByRole("button", {name: "Vegan"}));
    await flush();

    mockListRecipeShorts.mockResolvedValueOnce(createPage([], {total: 0}));
    typeSearch("qrs");
    await act(async () => {
      jest.advanceTimersByTime(700);
    });
    await flush();

    expect(screen.getByText("Kein passendes Rezept gefunden")).toBeInTheDocument();
    expect(noResultCalls()).toHaveLength(0);
  });
});

describe("RecipeSearch — eingebettet (Rezept-Schublade)", () => {
  test("übergibt den Anlass, lädt nicht bei enabled=false und startet beim Öffnen", async () => {
    mockListRecipeShorts.mockResolvedValue(createPage([1], {total: 1}));
    const view = renderSearch({embeddedMode: true, eventUid: "event-1", enabled: false});
    await flush();
    expect(mockListRecipeShorts).not.toHaveBeenCalled();

    view.rerender(
      <DatabaseContext.Provider value={mockDatabase}>
        <RecipeSearch
          onNewClick={jest.fn()}
          onCardClick={jest.fn()}
          authUser={authUser}
          embeddedMode={true}
          eventUid="event-1"
          enabled={true}
        />
      </DatabaseContext.Provider>,
    );
    await flush();

    expect(mockListRecipeShorts).toHaveBeenCalledTimes(1);
    expect(mockListRecipeShorts.mock.calls[0][0]).toMatchObject({eventUid: "event-1"});
  });

  test("ein neuer reloadToken lädt die Liste neu, die Suche bleibt bestehen", async () => {
    mockListRecipeShorts.mockResolvedValue(createPage([1], {total: 1}));
    const view = renderSearch({embeddedMode: true, eventUid: "event-1", reloadToken: 0});
    await flush();
    typeSearch("rez");
    expect(mockListRecipeShorts).toHaveBeenCalledTimes(1);

    view.rerender(
      <DatabaseContext.Provider value={mockDatabase}>
        <RecipeSearch
          onNewClick={jest.fn()}
          onCardClick={jest.fn()}
          authUser={authUser}
          embeddedMode={true}
          eventUid="event-1"
          reloadToken={1}
        />
      </DatabaseContext.Provider>,
    );
    await flush();

    expect(mockListRecipeShorts).toHaveBeenCalledTimes(2);
    expect(screen.getByLabelText("Suchbegriff")).toHaveValue("rez");
  });

  test("speichert nichts im sessionStorage (Schublade)", async () => {
    mockListRecipeShorts.mockResolvedValue(createPage([1], {total: 1}));
    renderSearch({embeddedMode: true, eventUid: "event-1"});
    await flush();

    expect(sessionStorage.getItem("recipeListCacheV2")).toBeNull();
  });
});

describe("RecipeSearch — Rückkehr aus einem Rezept (Rezeptseite)", () => {
  const initialKey = getRecipeListQueryKey(buildRecipeListQuery(INITIAL_SEARCH_SETTINGS));

  const storeCache = () =>
    saveRecipeListCache({
      userId: "user-1",
      queryKey: initialKey,
      searchSettings: INITIAL_SEARCH_SETTINGS,
      recipes: [domainToRecipeShort(createDomain(1, "Aus dem Cache"))],
      cursor: null,
      hasMore: false,
      total: 1,
    });

  test("stellt Karten wieder her, ohne neue Anfrage, und scrollt an die gemerkte Stelle", async () => {
    storeCache();
    saveRecipeListScrollY(420);
    const scrollTo = jest.spyOn(window, "scrollTo").mockImplementation(() => undefined);
    const raf = jest
      .spyOn(window, "requestAnimationFrame")
      .mockImplementation((callback) => {
        callback(0);
        return 0;
      });

    renderSearch();
    await flush();

    expect(screen.getByText("Aus dem Cache")).toBeInTheDocument();
    expect(mockListRecipeShorts).not.toHaveBeenCalled();
    expect(scrollTo).toHaveBeenCalledWith({top: 420});
    scrollTo.mockRestore();
    raf.mockRestore();
  });

  test("stellt auch die Sucheinstellungen wieder her", async () => {
    saveRecipeListCache({
      userId: "user-1",
      queryKey: getRecipeListQueryKey(
        buildRecipeListQuery({...INITIAL_SEARCH_SETTINGS, searchString: "cache"}),
      ),
      searchSettings: {...INITIAL_SEARCH_SETTINGS, searchString: "cache"},
      recipes: [domainToRecipeShort(createDomain(1, "Cache-Rezept"))],
      cursor: null,
      hasMore: false,
      total: 1,
    });

    renderSearch();
    await flush();

    expect(screen.getByLabelText("Suchbegriff")).toHaveValue("cache");
    expect(mockListRecipeShorts).not.toHaveBeenCalled();
  });
});

describe("RecipesPage", () => {
  const renderPage = (state?: unknown) =>
    render(
      <MemoryRouter initialEntries={[{pathname: "/recipes", state}]}>
        <DatabaseContext.Provider value={mockDatabase}>
          <RecipesPage />
        </DatabaseContext.Provider>
      </MemoryRouter>,
    );

  test("lädt die erste Seite der öffentlichen und eigenen Rezepte", async () => {
    mockListRecipeShorts.mockResolvedValue(createPage([1, 2], {total: 2}));
    renderPage();
    await flush();

    expect(screen.getByText("Rezept 001")).toBeInTheDocument();
    expect(mockListRecipeShorts.mock.calls[0][0]).toMatchObject({scope: "all", limit: 24});
  });

  test("nach dem Löschen eines Rezepts (Snackbar-Hinweis) wird der Cache verworfen und neu geladen", async () => {
    saveRecipeListCache({
      userId: "user-1",
      queryKey: getRecipeListQueryKey(buildRecipeListQuery(INITIAL_SEARCH_SETTINGS)),
      searchSettings: INITIAL_SEARCH_SETTINGS,
      recipes: [domainToRecipeShort(createDomain(9, "Gelöschtes Rezept"))],
      cursor: null,
      hasMore: false,
      total: 1,
    });
    mockListRecipeShorts.mockResolvedValue(createPage([1], {total: 1}));

    renderPage({snackbar: {open: true, severity: "success", message: "Rezept gelöscht"}});
    await flush();

    expect(screen.queryByText("Gelöschtes Rezept")).not.toBeInTheDocument();
    expect(mockListRecipeShorts).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.getByText("Rezept gelöscht")).toBeInTheDocument());
  });
});
