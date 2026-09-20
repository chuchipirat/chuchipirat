/**
 * Hilfsfunktionen der Rezeptliste: Suchtext-Normalisierung, lokale Filter
 * (Vorschau, bis die Datenbank antwortet), Abfrage-Aufbau und Abbildung der
 * Repository-Daten auf die UI-Typen.
 *
 * Reine Funktionen ohne Seiteneffekte, damit sie ohne Rendering testbar sind.
 */
import type {
  RecipeListQuery,
  RecipeListScope,
  RecipeShortDomain,
} from "../Database/Repository/RecipeRepository";
import {Allergen, Diet} from "../Product/product.types";
import {SearchSettings} from "./recipeList.types";
import {RecipeShort, createEmptyRecipeShort} from "./recipe.types";

/** Verzögerung, bevor der Suchtext an die Datenbank geschickt wird. */
export const RECIPE_LIST_SEARCH_DEBOUNCE_MS = 300;

/** Höchstzahl der Suchwörter (wie in der Datenbank-Funktion). */
const MAX_SEARCH_TOKENS = 4;

/**
 * Zeichen, die sich nicht per Unicode-Zerlegung (NFD) auf ASCII abbilden
 * lassen. Entspricht den gängigen Regeln von PostgreSQL `unaccent`.
 */
const SPECIAL_CHARACTERS: Record<string, string> = {
  ß: "ss",
  æ: "ae",
  œ: "oe",
  ø: "o",
  đ: "d",
  ł: "l",
};

/**
 * Bringt einen Text in die Form, in der gesucht wird: klein und ohne Akzente
 * («Hörnli» → «hornli», «Straße» → «strasse»). Muss mit der Datenbank-Funktion
 * `recipe_search_text` übereinstimmen, damit die lokale Vorschau und das
 * Ergebnis der Datenbank dieselben Rezepte finden.
 *
 * @param text Beliebiger Text.
 * @returns Normalisierter Text.
 * @example
 * normalizeSearchText("Hörnli und Ghackets") // "hornli und ghackets"
 */
export const normalizeSearchText = (text: string): string =>
  text
    .toLowerCase()
    .replace(/[ßæœøđł]/g, (character) => SPECIAL_CHARACTERS[character])
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

/**
 * Teilt einen Suchtext in Wörter (normalisiert, höchstens 4). Jedes Wort muss
 * vorkommen, die Reihenfolge spielt keine Rolle.
 *
 * @param searchString Freitext-Suchbegriff.
 * @returns Normalisierte Suchwörter; leeres Array bei leerem Suchtext.
 * @example
 * splitSearchTokens("  Hörnli  Ghackets ") // ["hornli", "ghackets"]
 */
export const splitSearchTokens = (searchString: string): string[] =>
  normalizeSearchText(searchString)
    .split(/\s+/)
    .filter((token) => token !== "")
    .slice(0, MAX_SEARCH_TOKENS);

/**
 * Prüft, ob ein Rezept zum Freitext-Suchbegriff passt: Jedes Suchwort muss in
 * Name, Variantenname oder einem Tag vorkommen (ohne Akzente, ohne
 * Gross-/Kleinschreibung). Bei leerem Suchbegriff gilt jedes Rezept als Treffer.
 *
 * Der Variantenname wird unabhängig von den Tags geprüft (früher wurde er nur
 * bei Rezepten mit mindestens einem Tag gefunden).
 *
 * @param recipe Zu prüfendes Rezept.
 * @param searchString Freitext-Suchbegriff.
 * @returns `true`, wenn das Rezept zum Suchbegriff passt.
 */
export const recipeMatchesSearchText = (
  recipe: RecipeShort,
  searchString: string,
): boolean => {
  const tokens = splitSearchTokens(searchString);
  if (tokens.length === 0) return true;

  const searchable = normalizeSearchText(
    [recipe.name, recipe.variantName ?? "", ...recipe.tags].join(" "),
  );
  return tokens.every((token) => searchable.includes(token));
};

/**
 * Filtert Rezepte lokal anhand der Sucheinstellungen. Dient als sofortige
 * Vorschau auf den bereits geladenen Karten, bis die Datenbank antwortet.
 * Gleiche Regeln wie die Datenbank-Funktion: Diät strikt gleich (Vegetarisch
 * schliesst Vegan aus), Allergene ausschliessend, Menütypen überlappend.
 *
 * @param recipes Zu filternde Rezepte.
 * @param searchSettings Aktuelle Sucheinstellungen.
 * @param userId Auth-UID der angemeldeten Person (für «nur meine»).
 * @returns Rezepte, die alle Bedingungen erfüllen.
 */
export const filterRecipes = (
  recipes: RecipeShort[],
  searchSettings: SearchSettings,
  userId: string,
): RecipeShort[] =>
  recipes.filter((recipe) => {
    if (!recipeMatchesSearchText(recipe, searchSettings.searchString)) {
      return false;
    }
    if (
      searchSettings.diet !== Diet.Meat &&
      recipe.dietProperties?.diet !== searchSettings.diet
    ) {
      return false;
    }
    if (
      !searchSettings.allergens.includes(Allergen.None) &&
      searchSettings.allergens.some((allergen) =>
        recipe.dietProperties.allergens.includes(allergen),
      )
    ) {
      return false;
    }
    if (
      searchSettings.menuTypes.length > 0 &&
      !searchSettings.menuTypes.some((menuType) =>
        recipe.menuTypes.includes(menuType),
      )
    ) {
      return false;
    }
    if (searchSettings.outdoorKitchenSuitable && !recipe.outdoorKitchenSuitable) {
      return false;
    }
    if (
      searchSettings.recipeType !== "all" &&
      recipe.type !== searchSettings.recipeType
    ) {
      return false;
    }
    return !(searchSettings.showOnlyMyRecipes && recipe.created.fromUid !== userId);
  });

/**
 * Sortiert Rezepte wie die Datenbank: nach Name, bei gleichem Namen nach UID
 * (Varianten heissen wie das Original).
 *
 * @param recipes Rezepte (wird nicht verändert).
 * @returns Neue, sortierte Liste.
 */
export const sortRecipesByName = (recipes: RecipeShort[]): RecipeShort[] =>
  [...recipes].sort(
    (first, second) =>
      first.name.localeCompare(second.name) || first.uid.localeCompare(second.uid),
  );

/**
 * Baut aus den Sucheinstellungen die Abfrage an die Datenbank.
 * «Diät: Fleisch» und «Allergen: keine» bedeuten «kein Filter».
 *
 * @param searchSettings Sucheinstellungen der Oberfläche.
 * @param eventUid Anlass, dessen Varianten mitgeliefert werden (nur Rezept-Schublade).
 * @returns Abfrage für `RecipeRepository.listRecipeShorts`.
 * @example
 * buildRecipeListQuery({...INITIAL_SEARCH_SETTINGS, diet: Diet.Vegan}).diet // 3
 */
export const buildRecipeListQuery = (
  searchSettings: SearchSettings,
  eventUid?: string,
): RecipeListQuery => ({
  searchText: searchSettings.searchString.trim(),
  diet: searchSettings.diet === Diet.Meat ? undefined : searchSettings.diet,
  excludedAllergens: searchSettings.allergens.filter(
    (allergen) => allergen !== Allergen.None,
  ),
  menuTypes: searchSettings.menuTypes,
  outdoorKitchen: searchSettings.outdoorKitchenSuitable,
  scope: searchSettings.recipeType as RecipeListScope,
  onlyMine: searchSettings.showOnlyMyRecipes,
  eventUid,
});

/**
 * Schlüssel einer Abfrage ohne Seitenangaben. Gleiche Suche mit gleichen
 * Filtern ergibt denselben Schlüssel (Suchtext normalisiert, Listen sortiert).
 *
 * @param query Abfrage der Rezeptliste.
 * @returns Stabiler Schlüssel als Text.
 */
export const getRecipeListQueryKey = (query: RecipeListQuery): string =>
  JSON.stringify({
    text: splitSearchTokens(query.searchText ?? ""),
    diet: query.diet ?? null,
    allergens: [...(query.excludedAllergens ?? [])].sort(),
    menuTypes: [...(query.menuTypes ?? [])].sort(),
    outdoor: query.outdoorKitchen ?? false,
    scope: query.scope ?? "all",
    mine: query.onlyMine ?? false,
    event: query.eventUid ?? null,
  });

/**
 * Wandelt ein `RecipeShortDomain` aus dem Repository in ein `RecipeShort`
 * um, wie es die Karten (`RecipeCard`) verwenden.
 *
 * @param domain Kurzrezept aus dem Repository.
 * @returns Kurzrezept für die Oberfläche.
 */
export const domainToRecipeShort = (domain: RecipeShortDomain): RecipeShort => {
  const recipeShort = createEmptyRecipeShort();
  recipeShort.uid = domain.uid;
  recipeShort.name = domain.name;
  recipeShort.source = domain.source;
  recipeShort.pictureSrc = domain.pictureSrc;
  recipeShort.tags = domain.tags;
  recipeShort.linkedRecipes = [];
  recipeShort.dietProperties = {
    diet: domain.dietProperties.diet,
    allergens: domain.dietProperties.allergens,
  };
  recipeShort.menuTypes = domain.menuTypes as RecipeShort["menuTypes"];
  recipeShort.outdoorKitchenSuitable = domain.outdoorKitchenSuitable;
  recipeShort.created = {
    date: domain.createdAt,
    fromUid: domain.createdBy,
    fromDisplayName: "",
  };
  recipeShort.type = domain.recipeType as RecipeShort["type"];
  recipeShort.rating = {
    avgRating: domain.avgRating,
    noRatings: domain.noRatings,
  };
  recipeShort.noComments = domain.noComments;
  if (domain.variantName) {
    recipeShort.variantName = domain.variantName;
  }
  return recipeShort;
};
