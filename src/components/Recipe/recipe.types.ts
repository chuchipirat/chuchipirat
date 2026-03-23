/**
 * Typdefinitionen und Factory-Funktionen für Rezepte.
 *
 * Enthält die extrahierten Typen aus den ehemaligen Firebase-basierten
 * Klassen (`recipeShort.class.ts`, `recipe.rating.class.ts`,
 * `recipe.comment.class.ts`).
 */
import {MenuType, RecipeType} from "./recipe.class";
import {ChangeRecord} from "../Shared/global.interface";
import {DietProperties, createEmptyDietProperty} from "../Product/product.types";
import {UserShort} from "../User/user.class";

/* =====================================================================
// Rating
// ===================================================================== */

/**
 * Bewertungsdaten eines Rezepts.
 *
 * @param avgRating - Durchschnittliche Bewertung.
 * @param noRatings - Anzahl abgegebene Bewertungen.
 * @param myRating - Eigene Bewertung des aktuellen Users.
 */
export type Rating = {
  avgRating: number;
  noRatings: number;
  myRating: number;
};

/* =====================================================================
// Öffentliche Bewertungsdaten (ohne eigene Bewertung)
// ===================================================================== */

/**
 * Öffentliche Bewertungsdaten eines Rezepts (ohne persönliche Bewertung).
 *
 * @param avgRating - Durchschnittliche Bewertung.
 * @param noRatings - Anzahl abgegebene Bewertungen.
 */
export type PublicRecipeRating = {
  avgRating: Rating["avgRating"];
  noRatings: Rating["noRatings"];
};

/* =====================================================================
// RecipeComment
// ===================================================================== */

/**
 * Kommentar zu einem Rezept.
 *
 * @param uid - Eindeutige ID des Kommentars.
 * @param user - Kurzprofil des Verfassers.
 * @param createdAt - Zeitpunkt der Erstellung.
 * @param comment - Kommentartext.
 */
export type RecipeComment = {
  uid: string;
  user: UserShort;
  createdAt: Date;
  comment: string;
};

/* =====================================================================
// RecipeShort
// ===================================================================== */

/**
 * Kurzform eines Rezepts für Übersichtslisten.
 *
 * @param uid - UID des Rezepts.
 * @param name - Name des Rezepts.
 * @param pictureSrc - Bildquelle (URL).
 * @param tags - Liste von Tags.
 * @param linkedRecipes - Liste verlinkter Kurzrezepte.
 * @param dietProperties - Diät-/Allergeneigenschaften.
 * @param menuTypes - Zugewiesene Menütypen.
 * @param outdoorKitchenSuitable - Ob das Rezept für die Outdoor-Küche geeignet ist.
 * @param created - Erstellungsinformationen.
 * @param source - Quelle des Rezepts.
 * @param type - Rezepttyp (öffentlich, privat, Variante).
 * @param rating - Öffentliche Bewertungsdaten.
 * @param noComments - Anzahl Kommentare (optional, nicht bei Firebase-Rezepten).
 * @param variantName - Name der Variante (nur bei Varianten).
 */
export type RecipeShort = {
  uid: string;
  name: string;
  pictureSrc: string;
  tags: string[];
  linkedRecipes: RecipeShort[];
  dietProperties: DietProperties;
  menuTypes: MenuType[];
  outdoorKitchenSuitable: boolean;
  created: ChangeRecord;
  source: string;
  type: RecipeType;
  rating: PublicRecipeRating;
  noComments?: number;
  variantName?: string;
};

/* =====================================================================
// Factory-Funktionen
// ===================================================================== */

/**
 * Erzeugt ein leeres Kurzrezept mit Standardwerten.
 *
 * @returns Neues RecipeShort mit leeren Werten.
 * @example
 * const recipeShort = createEmptyRecipeShort();
 */
export function createEmptyRecipeShort(): RecipeShort {
  return {
    uid: "",
    name: "",
    pictureSrc: "",
    tags: [],
    linkedRecipes: [],
    dietProperties: createEmptyDietProperty(),
    menuTypes: [],
    outdoorKitchenSuitable: false,
    created: {date: new Date(), fromUid: "", fromDisplayName: ""},
    source: "",
    type: RecipeType.private,
    rating: {avgRating: 0, noRatings: 0},
    noComments: 0,
  };
}

/**
 * Erzeugt ein Kurzrezept aus einem vollständigen Rezept.
 *
 * @param recipe - Das vollständige Rezept.
 * @returns Kurzrezept mit den relevanten Feldern.
 * @example
 * const short = createShortRecipeFromRecipe(recipe);
 */
export function createShortRecipeFromRecipe(recipe: {
  uid: string;
  name: string;
  source: string;
  pictureSrc: string;
  tags: string[];
  linkedRecipes: RecipeShort[];
  dietProperties: DietProperties;
  menuTypes: MenuType[];
  outdoorKitchenSuitable: boolean;
  created: ChangeRecord;
  type: RecipeType;
  rating: {avgRating?: number; noRatings?: number};
  variantProperties?: {variantName?: string};
}): RecipeShort {
  // ATTENTION: Muss auch im File rebuildFile000AllRecipes angepasst werden
  const recipeShort: RecipeShort = {
    uid: recipe.uid,
    name: recipe.name,
    source: recipe.source,
    pictureSrc: recipe.pictureSrc,
    tags: recipe.tags ? recipe.tags : [],
    linkedRecipes: recipe.linkedRecipes ? recipe.linkedRecipes : [],
    dietProperties: recipe.dietProperties,
    menuTypes: recipe.menuTypes ? recipe.menuTypes : [],
    outdoorKitchenSuitable: recipe.outdoorKitchenSuitable,
    created: recipe.created,
    type: recipe.type,
    rating: {
      avgRating: recipe?.rating.avgRating ? recipe.rating.avgRating : 0,
      noRatings: recipe?.rating.noRatings ? recipe.rating.noRatings : 0,
    },
  };

  if (recipe.type === RecipeType.variant) {
    recipeShort.variantName = recipe.variantProperties?.variantName;
  }
  return recipeShort;
}
