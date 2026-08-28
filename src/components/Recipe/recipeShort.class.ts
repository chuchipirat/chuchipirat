import Recipe, {MenuType, RecipeType} from "./recipe.class";
import {ChangeRecord} from "../Shared/global.interface";

import {PublicRecipeRating} from "./recipe.types";
import {DietProperties, createEmptyDietProperty} from "../Product/product.types";

// ===================================================================== */
/**
 * Kurz Rezept - aus den Übersichten:
 * Aufbau gleich wie auf der DB unter
 * recipe/000_allRecipes
 * @param uid - UID des Rezeptes
 * @param name - Name des Rezeptes
 * @param pictureSrc - Bildquelle (URL)
 * @param tags - Liste von Tags
 * @param linkedRecipes - Liste von verlinkten Rezepten
 * @param createdFromUid - UID des*r Erfasser*in
 */
export class RecipeShort {
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
  /** Anzahl Kommentare — optional, da für Firebase-Rezepte nicht verfügbar. */
  noComments?: number;
  variantName?: string;
  // ===================================================================== */
  /**
   * Konstruktor für ein leeres Objekt
   */
  constructor() {
    this.uid = "";
    this.name = "";
    this.pictureSrc = "";
    this.tags = [];
    this.linkedRecipes = [];
    this.dietProperties = createEmptyDietProperty();
    this.menuTypes = [];
    this.outdoorKitchenSuitable = false;
    this.created = {date: new Date(), fromUid: "", fromDisplayName: ""};
    this.source = "";
    this.type = RecipeType.private;
    this.rating = {avgRating: 0, noRatings: 0};
    this.noComments = 0;
  }
  // ===================================================================== */
  /**
   * Kurz-Rezept aus Rezept erzeugen
   * @param recipe Objekt Rezept
   * @returns Kurzrezept
   */
  static createShortRecipeFromRecipe(recipe: Recipe): RecipeShort {
    //ATTENTION: muss auch im File rebuildFile000AllRecipes angepasst werden
    const recipeShort = {
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

    if (recipe.type == RecipeType.variant) {
      recipeShort["variantName"] = recipe.variantProperties?.variantName;
    }
    return recipeShort;
  }
}

export default RecipeShort;
