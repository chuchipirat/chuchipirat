/**
 * Zwischenspeicher der Rezeptliste im sessionStorage.
 *
 * Beim Öffnen eines Rezepts und dem Zurückkehren sollen Karten, Sucheinstellungen
 * und Scroll-Position sofort wieder da sein, ohne neue Anfrage. Gespeichert
 * werden die bereits geladenen Seiten (höchstens {@link MAX_CACHED_RECIPES}),
 * der Cursor zum Weiterladen und die Sucheinstellungen.
 */
import type {RecipeListCursor} from "../Database/Repository/RecipeRepository";
import {SearchSettings} from "./recipeList.types";
import {RecipeShort} from "./recipe.types";

/** SessionStorage-Schlüssel für den Rezeptlisten-Cache (Version 2: seitenweise). */
const RECIPE_LIST_CACHE_KEY = "recipeListCacheV2";

/** Frühere Version (ganze Liste); wird beim Leeren mit entfernt. */
const LEGACY_RECIPE_LIST_CACHE_KEY = "recipeListCache";

/** SessionStorage-Schlüssel für die gespeicherte Scroll-Position. */
const RECIPE_LIST_SCROLL_Y_KEY = "recipeListScrollY";

/** SessionStorage-Schlüssel zum Unterdrücken von ScrollToTop nach Navigation zurück. */
const SKIP_SCROLL_TO_TOP_KEY = "skipScrollToTop";

/** Cache-Gültigkeitsdauer in Millisekunden (5 Minuten). */
export const RECIPE_LIST_CACHE_TTL_MS = 300_000;

/** Höchstzahl der zwischengespeicherten Karten (begrenzt die Grösse im sessionStorage). */
export const MAX_CACHED_RECIPES = 300;

/**
 * Zwischengespeicherter Stand der Rezeptliste.
 *
 * @param userId Auth-UID der Person (der Cache gilt nur für sie).
 * @param queryKey Schlüssel der Abfrage, zu der die Karten gehören.
 * @param searchSettings Sucheinstellungen zum Zeitpunkt des Speicherns.
 * @param recipes Geladene Karten.
 * @param cursor Cursor zum Nachladen (`null` = Ende der Liste).
 * @param hasMore Ob weitere Seiten folgen.
 * @param total Gesamtzahl der Treffer.
 * @param timestamp Zeitpunkt des Speicherns (Epoch-Millisekunden).
 */
export type RecipeListCacheEntry = {
  userId: string;
  queryKey: string;
  searchSettings: SearchSettings;
  recipes: RecipeShort[];
  cursor: RecipeListCursor | null;
  hasMore: boolean;
  total: number | null;
  timestamp: number;
};

/** RecipeShort mit Datum als ISO-String (sessionStorage kennt nur JSON). */
type SerializedRecipeShort = Omit<RecipeShort, "created"> & {
  created: {date: string; fromUid: string; fromDisplayName: string};
};

type SerializedEntry = Omit<RecipeListCacheEntry, "recipes"> & {
  recipes: SerializedRecipeShort[];
};

/**
 * Speichert den Stand der Rezeptliste. Mehr als {@link MAX_CACHED_RECIPES}
 * Karten werden abgeschnitten; der Cursor zeigt dann auf die letzte
 * gespeicherte Karte, damit das Weiterladen nahtlos anschliesst.
 *
 * @param entry Zu speichernder Stand (Zeitstempel wird gesetzt).
 */
export const saveRecipeListCache = (
  entry: Omit<RecipeListCacheEntry, "timestamp">,
): void => {
  try {
    const truncated = entry.recipes.length > MAX_CACHED_RECIPES;
    const recipes = entry.recipes.slice(0, MAX_CACHED_RECIPES);
    const lastRecipe = recipes[recipes.length - 1];
    const serialized: SerializedEntry = {
      ...entry,
      recipes: recipes.map((recipe) => ({
        ...recipe,
        created: {...recipe.created, date: recipe.created.date.toISOString()},
      })),
      hasMore: truncated ? true : entry.hasMore,
      cursor:
        truncated && lastRecipe
          ? {name: lastRecipe.name, uid: lastRecipe.uid}
          : entry.cursor,
      timestamp: Date.now(),
    };
    sessionStorage.setItem(RECIPE_LIST_CACHE_KEY, JSON.stringify(serialized));
  } catch {
    // sessionStorage voll oder nicht verfügbar — kein Fehler nach aussen
  }
};

/**
 * Lädt den gespeicherten Stand der Rezeptliste, falls vorhanden, nicht
 * abgelaufen und von derselben Person gespeichert.
 *
 * @param userId Auth-UID der angemeldeten Person.
 * @param now Aktueller Zeitpunkt (Epoch-Millisekunden), für Tests überschreibbar.
 * @returns Gespeicherter Stand oder `null`.
 */
export const loadRecipeListCache = (
  userId: string,
  now: number = Date.now(),
): RecipeListCacheEntry | null => {
  try {
    const raw = sessionStorage.getItem(RECIPE_LIST_CACHE_KEY);
    if (!raw) return null;

    const entry: SerializedEntry = JSON.parse(raw);
    if (entry.userId !== userId || now - entry.timestamp > RECIPE_LIST_CACHE_TTL_MS) {
      sessionStorage.removeItem(RECIPE_LIST_CACHE_KEY);
      return null;
    }
    return {
      ...entry,
      recipes: entry.recipes.map((recipe) => ({
        ...recipe,
        created: {...recipe.created, date: new Date(recipe.created.date)},
      })),
    };
  } catch {
    sessionStorage.removeItem(RECIPE_LIST_CACHE_KEY);
    return null;
  }
};

/**
 * Leert den Cache und die gemerkte Scroll-Position (z.B. nach dem Anlegen
 * oder Löschen eines Rezepts, damit die Liste neu geladen wird).
 */
export const clearRecipeListCache = (): void => {
  try {
    sessionStorage.removeItem(RECIPE_LIST_CACHE_KEY);
    sessionStorage.removeItem(LEGACY_RECIPE_LIST_CACHE_KEY);
    sessionStorage.removeItem(RECIPE_LIST_SCROLL_Y_KEY);
  } catch {
    // ignorieren
  }
};

/**
 * Merkt die aktuelle Scroll-Position, bevor ein Rezept geöffnet wird.
 *
 * @param scrollY Vertikale Scroll-Position in Pixeln.
 */
export const saveRecipeListScrollY = (scrollY: number): void => {
  try {
    sessionStorage.setItem(RECIPE_LIST_SCROLL_Y_KEY, String(scrollY));
  } catch {
    // ignorieren
  }
};

/**
 * Liest die gemerkte Scroll-Position und löscht sie (einmalige Wiederherstellung).
 *
 * @returns Scroll-Position in Pixeln oder `null`, wenn keine gemerkt ist.
 */
export const consumeRecipeListScrollY = (): number | null => {
  try {
    const stored = sessionStorage.getItem(RECIPE_LIST_SCROLL_Y_KEY);
    sessionStorage.removeItem(RECIPE_LIST_SCROLL_Y_KEY);
    if (stored === null) return null;
    const scrollY = parseInt(stored, 10);
    return Number.isNaN(scrollY) ? null : scrollY;
  } catch {
    return null;
  }
};

/**
 * Unterdrückt das automatische Hochscrollen (`ScrollToTop`) bei der
 * Rückkehr zur Liste, wenn Cache und Scroll-Position vorliegen. Muss vor dem
 * ersten Effekt von `ScrollToTop` aufgerufen werden (also synchron beim Rendern).
 */
export const skipScrollToTopIfRestorable = (): void => {
  try {
    if (
      sessionStorage.getItem(RECIPE_LIST_SCROLL_Y_KEY) &&
      sessionStorage.getItem(RECIPE_LIST_CACHE_KEY)
    ) {
      sessionStorage.setItem(SKIP_SCROLL_TO_TOP_KEY, "true");
    }
  } catch {
    // ignorieren
  }
};
