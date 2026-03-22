import Recipe, {MenuType, RecipeType} from "./recipe.class";
import {Event} from "../Event/Event/event.class";
import Firebase from "../Firebase/firebase.class";
import {AuthUser} from "../Firebase/Authentication/authUser.class";
import Utils from "../Shared/utils.class";
import {ChangeRecord} from "../Shared/global.interface";

import {ValueObject} from "../Firebase/Db/firebase.db.super.class";

import {ERROR_PARAMETER_NOT_PASSED} from "../../constants/text";
import {Rating} from "./recipe.rating.class";
import Product, {Diet, DietProperties} from "../Product/product.class";
interface GetShortRecipes {
  firebase: Firebase;
  authUser: AuthUser;
  eventUid?: Event["uid"];
}
interface GetShortRecipesPublic {
  firebase: Firebase;
}
interface GetShortRecipesPrivate {
  firebase: Firebase;
  userUid: string;
}
interface GetShortRecipesVariant {
  firebase: Firebase;
  eventUid: Event["uid"];
}
interface GetShortRecipesPrivateAll {
  firebase: Firebase;
}
interface Delete {
  firebase: Firebase;
  recipeUid: string;
  recipeType: RecipeType;
  authUser: AuthUser;
  eventUid: string;
}
interface DeleteRecipeType {
  firebase: Firebase;
  recipeUid: string;
  userUid?: string;
  eventUid?: string;
}
interface DeleteAllVariants {
  eventUid: Event["uid"];
  firebase: Firebase;
}

interface PublicRecipeRating {
  avgRating: Rating["avgRating"];
  noRatings: Rating["noRatings"];
}

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
    this.dietProperties = Product.createEmptyDietProperty();
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
  // ===================================================================== */
  /**
   * Alle Rezepte (in Kurzform) holen. Es wird das Dokument ausgelesen, welches
   * alle Rezepte beinhaltet. Die Methode ändert den Aufbau von einem Objekt
   * (pro Property ein Rezept) zu einem Array mit einem Rezept pro Eintrag
   * --> Falls eine Event UID mitgeben wird, wirdn auch nach diesem
   *     Rezept-Index gesucht
   * @param param0 - Objekt mit Firebase-Referenz und authUser
   */
  static async getShortRecipes({
    firebase,
    authUser,
    eventUid = "",
  }: GetShortRecipes) {
    let recipesShort: RecipeShort[] = [];

    recipesShort = await this.getShortRecipesPublic({firebase: firebase});
    recipesShort = recipesShort.concat(
      await this.getShortRecipesPrivate({
        firebase: firebase,
        userUid: authUser.uid,
      })
    );
    if (eventUid !== "") {
      const recipeList = await this.getShortRecipesVariant({
        firebase: firebase,
        eventUid: eventUid,
      });

      if (recipeList.length != 0) {
        recipesShort = recipesShort.concat(recipeList);
      }
    }

    recipesShort = Utils.sortArray({
      array: recipesShort,
      attributeName: "name",
    });

    return recipesShort;
  }
  // ===================================================================== */
  /**
   * Alle öffentliche Rezepte (in Kurzform) holen. Es wird das Dokuement ausgelesen, welches
   * alle Rezepte beinhaltet. Die Methode ändert den Aufbau von einem Objekt
   * (pro Property ein Rezept) zu einem Arry mit einem Rezept pro Eintrag
   * @param firebase - Objekt mit Firebase-Referenz
   */
  static async getShortRecipesPublic({firebase}: GetShortRecipesPublic) {
    let recipesShort: RecipeShort[] = [];

    await firebase.recipeShortPublic
      .read<RecipeShort>({uids: []})
      .then((result) => {
        recipesShort = this.moveDbDateFromObjectToArray(result);
      })
      .catch((error) => console.error(error));

    recipesShort = Utils.sortArray({
      array: recipesShort,
      attributeName: "name",
    });

    return recipesShort;
  }
  // ===================================================================== */
  /**
   * Alle Rezepte (in Kurzform) holen. Es wird das Dokuement ausgelesen, welches
   * alle Rezepte beinhaltet. Die Methode ändert den Aufbau von einem Objekt
   * (pro Property ein Rezept) zu einem Arry mit einem Rezept pro Eintrag
   * @param object - Objekt mit Firebase-Referenz und User-Uid
   * */
  static async getShortRecipesPrivate({
    firebase,
    userUid,
  }: GetShortRecipesPrivate) {
    let recipesShort: RecipeShort[] = [];

    await firebase.recipeShortPrivate
      .read<RecipeShort>({uids: [userUid]})
      .then((result) => {
        recipesShort = this.moveDbDateFromObjectToArray(result);
      })
      .catch((error) => console.error(error));

    recipesShort = Utils.sortArray({
      array: recipesShort,
      attributeName: "name",
    });

    return recipesShort;
  }
  // ===================================================================== */
  /**
   * Alle Rezepte (in Kurzform) holen. Es wird das Dokument ausgelesen, welches
   * alle Rezepte beinhaltet. Hier werden nur die Rezepte eines spezifischen
   * Events gelesen
   * @param object - Objekt mit Firebase-Referenz und User-Uid
   * */
  static async getShortRecipesVariant({
    firebase,
    eventUid,
  }: GetShortRecipesVariant) {
    let recipesShort: RecipeShort[] = [];

    await firebase.recipeShortVariant
      .read<RecipeShort>({uids: [eventUid]})
      .then((result) => {
        recipesShort = this.moveDbDateFromObjectToArray(result);
      })
      .catch((error) => console.info(error));

    recipesShort = Utils.sortArray({
      array: recipesShort,
      attributeName: "name",
    });

    return recipesShort;
  }
  // ===================================================================== */
  /**
   * Alle privaten Rezepte (in Kurzform) holen (aller User)
   * @param object - Objekt mit Firebase-Referenz und User-Uid
   * */
  static async getShortRecipesPrivateAll({
    firebase,
  }: GetShortRecipesPrivateAll) {
    // alle Sammlungen holen --> Firebase bietet keine Möglichkeit von
    // einem Dokument alle Sammlungen zu holen. Daher wird im File 000_userRecipes
    // Buch geführt, wer alles mindestens ein privates Rezept hat
    let recipesShort: RecipeShort[] = [];
    let userWithPrivateRecipes: string[] = [];

    await firebase.recipeShortPrivate
      .readRawData({uids: []})
      .then((result) => {
        userWithPrivateRecipes = result.userWithPrivateRecipes;
      })
      .then(async () => {
        for (const userUid of userWithPrivateRecipes) {
          await firebase.recipeShortPrivate
            .read<ValueObject>({uids: [userUid]})
            .then((result) => {
              recipesShort = recipesShort.concat(
                this.moveDbDateFromObjectToArray(result)
              );
            });
        }
      })
      .then(() => {
        return Utils.sortArray({
          array: recipesShort,
          attributeName: "name",
        });
      });

    return recipesShort;
  }

  // ===================================================================== */
  /**
   * Rezept von Objekt ins Array verschieben
   * @param object - Daten wie sie in der DB abgelegt sind: Ein Objekt,
   *                 jedes Attribut = 1 Rezept
   */
  static moveDbDateFromObjectToArray = (object: ValueObject) => {
    const recipesShort: RecipeShort[] = [];

    Object.keys(object).forEach((key) => {
      const recipeShort = {
        uid: key,
        name: object[key].name,
        source: object[key].source,
        pictureSrc: object[key].pictureSrc,
        tags: object[key].tags,
        linkedRecipes: object[key].linkedRecipes,
        dietProperties: object[key].dietProperties
          ? object[key].dietProperties
          : {diet: Diet.Meat, allergens: []},
        menuTypes: object[key].menuTypes ? object[key].menuTypes : [],
        outdoorKitchenSuitable: object[key].outdoorKitchenSuitable
          ? object[key].outdoorKitchenSuitable
          : false,
        created: object[key].created,
        type: object[key].type,
        rating: object[key].rating
          ? object[key].rating
          : {avgRating: 0, noRatings: 0},
        variantName: object[key]?.variantName ? object[key].variantName : "",
      };

      if (recipeShort.type !== RecipeType.variant) {
        delete recipeShort.variantName;
      }

      recipesShort.push(recipeShort);
    });

    return recipesShort;
  };

  /**
   * Bestimmtes Rezept aus allen Rezepten löschen
   * @param param0 - Objekt mit Firebase-Referenz und Rezept-UID und User-Referenz
   */
  static async delete({
    firebase,
    recipeUid,
    recipeType,
    authUser,
    eventUid,
  }: Delete) {
    if (recipeType === RecipeType.public) {
      await this.deletePublic({
        firebase: firebase,
        recipeUid: recipeUid,
      }).catch((error) => {
        console.error(error);
        throw error;
      });
    } else if (recipeType === RecipeType.private) {
      await this.deletePrivate({
        firebase: firebase,
        recipeUid: recipeUid,
        userUid: authUser.uid,
      }).catch((error) => {
        console.error(error);
        throw error;
      });
    } else if (recipeType === RecipeType.variant) {
      await this.deleteVariant({
        firebase: firebase,
        recipeUid: recipeUid,
        eventUid: eventUid,
      }).catch((error) => {
        console.error(error);
        throw error;
      });
    }
  }
  /**
   * löschen eines des Eintrages in 000_allRecipes (privates Rezept)
   * @param param0 - Objekt mit Firebase-Referenz und Rezept-UID
   */
  private static deletePrivate = async ({
    firebase,
    recipeUid,
    userUid,
  }: DeleteRecipeType) => {
    if (!userUid) {
      throw Error(ERROR_PARAMETER_NOT_PASSED);
    }
    firebase.recipeShortPrivate
      .deleteField({fieldName: recipeUid, uids: [userUid]})
      .catch((error) => {
        throw error;
      });
  };
  /**
   * löschen eines des Eintrages in 000_allRecipes (Variante Event)
   * @param param0 - Objekt mit Firebase-Referenz und Rezept-UID
   */
  private static deleteVariant = async ({
    firebase,
    recipeUid,
    eventUid,
  }: DeleteRecipeType) => {
    if (!eventUid) {
      throw Error(ERROR_PARAMETER_NOT_PASSED);
    }
    firebase.recipeShortVariant
      .deleteField({fieldName: recipeUid, uids: [eventUid]})
      .catch((error) => {
        throw error;
      });
  };

  /**
   * löschen eines des Eintrages in 000_allRecipes (Öffentliches Rezept)
   * @param param0 - Objekt mit Firebase-Referenz und Rezept-UID
   */
  private static deletePublic = async ({
    firebase,
    recipeUid,
  }: DeleteRecipeType) => {
    firebase.recipeShortPublic
      .deleteField({fieldName: recipeUid, uids: []})
      .catch((error) => {
        throw error;
      });
  };
  /* =====================================================================
  /**
   * Das gesamte File 000_allRecipes löschen
   */
  static deleteOverview = async ({eventUid, firebase}: DeleteAllVariants) => {
    firebase.recipeShortVariant.delete({uids: [eventUid]}).catch((error) => {
      console.error(error);
      throw error;
    });
  };
}

export default RecipeShort;
