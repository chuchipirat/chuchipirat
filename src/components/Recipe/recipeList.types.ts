/**
 * Typen der Rezeptsuche (Sucheinstellungen inkl. erweiterte Filter).
 */
import {MenuType, RecipeType} from "./recipe.class";
import {Allergen, Diet} from "../Product/product.types";

/**
 * Sucheinstellungen für die Rezeptsuche inkl. erweiterte Filter.
 *
 * @param showAdvancedSearch Ob die erweiterte Suche angezeigt wird.
 * @param searchString Freitextsuche.
 * @param allergens Ausgewählte Allergene zum Ausfiltern (`[Allergen.None]` = kein Filter).
 * @param diet Gewählte Ernährungsform (`Diet.Meat` = kein Filter).
 * @param menuTypes Ausgewählte Menütypen.
 * @param outdoorKitchenSuitable Nur Rezepte für Outdoorküche anzeigen.
 * @param recipeType Filterung nach Rezepttyp (alle, öffentlich, privat, Variante).
 * @param showOnlyMyRecipes Nur eigene Rezepte anzeigen.
 */
export interface SearchSettings {
  showAdvancedSearch: boolean;
  searchString: string;
  allergens: Allergen[];
  diet: Diet;
  menuTypes: MenuType[];
  outdoorKitchenSuitable: boolean;
  recipeType: RecipeType | "all";
  showOnlyMyRecipes: boolean;
}

/**
 * Initiale Sucheinstellungen für die Rezeptsuche.
 * Wird als Ausgangszustand und beim Zurücksetzen der erweiterten Suche verwendet.
 */
export const INITIAL_SEARCH_SETTINGS: SearchSettings = {
  showAdvancedSearch: false,
  searchString: "",
  allergens: [Allergen.None],
  diet: Diet.Meat,
  menuTypes: [],
  recipeType: "all",
  outdoorKitchenSuitable: false,
  showOnlyMyRecipes: false,
};
