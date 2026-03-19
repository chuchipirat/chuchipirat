import Firebase from "../firebase.class";
import {
  FirebaseDbSuper,
  ValueObject,
  PrepareDataForDb,
  PrepareDataForApp,
} from "./firebase.db.super.class";
import FirebaseDbRecipeRating from "./firebase.db.recipe.rating.class";
import FirebaseDbRecipeComment from "./firebase.db.recipe.comment.class";

import {
  ERROR_WRONG_DB_CLASS,
  ERROR_NOT_IMPLEMENTED_YET,
} from "../../../constants/text";
import {Diet} from "../../Product/product.class";
import {
  Ingredient,
  PositionType,
  RecipeMaterialPosition,
  RecipeObjectStructure,
  RecipeType,
} from "../../Recipe/recipe.class";
import {
  STORAGE_OBJECT_PROPERTY,
  StorageObjectProperty,
} from "./sessionStorageHandler.class";
import {collection, collectionGroup, doc} from "firebase/firestore";

export class FirebaseDbRecipe extends FirebaseDbSuper {
  firebase: Firebase;
  comment: FirebaseDbRecipeComment;
  rating: FirebaseDbRecipeRating;
  /* =====================================================================
  // Constructor
  // ===================================================================== */
  constructor(firebase: Firebase) {
    super();
    this.firebase = firebase;
    this.comment = new FirebaseDbRecipeComment(firebase);
    this.rating = new FirebaseDbRecipeRating(firebase);
  }
  /* =====================================================================
  // Collection holen
  // ===================================================================== */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  getCollection(uids: string[]) {
    throw Error(ERROR_WRONG_DB_CLASS);
    return collection(this.firebase.firestore, `recipes`);
  }
  /* =====================================================================
  // Collection-Group holen
  // ===================================================================== */
  getCollectionGroup() {
    throw Error(ERROR_NOT_IMPLEMENTED_YET);
    return collectionGroup(this.firebase.firestore, `none`);
  }
  /* =====================================================================
  // Dokument holen
  // ===================================================================== */
  getDocument(uids: string[]) {
    throw Error(ERROR_WRONG_DB_CLASS);
    return doc(this.firebase.firestore, this.getCollection(uids).path, uids[0]);
  }
  /* =====================================================================
  // Dokumente holen
  // ===================================================================== */
  getDocuments() {
    throw Error(ERROR_WRONG_DB_CLASS);
    // Not implemented
  }
  /* =====================================================================
  // Daten für DB-Strutkur vorbereiten
  // ===================================================================== */
  prepareDataForDb<T extends ValueObject>({value}: PrepareDataForDb<T>) {
    // Für die DB braucht es ein Array mit UsedProduct (für diverse Suchen)
    // da dies nur auf der DB benötigt wird, wird das auch nur hier generiert
    const usedProducts: string[] = [];
    const usedMaterials: string[] = [];

    Object.values(
      value.ingredients.entries as RecipeObjectStructure<Ingredient>["entries"]
    ).forEach((ingredient) => {
      if (ingredient.posType == PositionType.ingredient) {
        usedProducts.push(ingredient.product.uid);
      }
    });

    if (value.materials.order.length > 0) {
      Object.values(
        value.materials
          .entries as RecipeObjectStructure<RecipeMaterialPosition>["entries"]
      ).forEach((material) => {
        usedMaterials.push(material.material.uid);
      });
    }

    const recipe = {
      ingredients: value.ingredients,
      name: value.name,
      note: value.note,
      pictureSrc: value.pictureSrc,
      portions: value.portions,
      preparationSteps: value.preparationSteps,
      rating: {
        avgRating: value.rating.avgRating,
        noRatings: value.rating.noRatings,
      },
      materials: value.materials,
      dietProperties: value.dietProperties,
      menuTypes: value.menuTypes,
      outdoorKitchenSuitable: value.outdoorKitchenSuitable,
      source: value.source,
      tags: value.tags,
      times: {
        preparation: value.times.preparation,
        rest: value.times.rest,
        cooking: value.times.cooking,
      },
      usedProducts: usedProducts,
      usedMaterials: usedMaterials,
      created: value.created,
      lastChange: value.lastChange,
      variantProperties:
        value.type == RecipeType.variant ? value.variantProperties : null,
    };

    if (value.type !== RecipeType.variant) {
      // löschen wenn keine Variante
      delete recipe.variantProperties;
    }
    return recipe;
  }
  /* =====================================================================
  // Daten für DB-Strutkur vorbereiten
  // ===================================================================== */
  prepareDataForApp<T extends ValueObject>({uid, value}: PrepareDataForApp) {
    const recipe = {
      uid: uid,
      name: value.name,
      portions: value.portions,
      source: value.source,
      pictureSrc: value.pictureSrc,
      note: value.note,
      tags: value.tags,
      ingredients: value.ingredients
        ? value.ingredients
        : {entries: {}, order: []},
      preparationSteps: value.preparationSteps
        ? value.preparationSteps
        : {entries: {}, order: []},
      materials: value.materials ? value.materials : {entries: {}, order: []},
      dietProperties: value.dietProperties
        ? value.dietProperties
        : {
            allergens: [],
            diet: Diet.Meat,
          },
      menuTypes: value.menuTypes ? value.menuTypes : [],
      outdoorKitchenSuitable: value.outdoorKitchenSuitable
        ? value.outdoorKitchenSuitable
        : false,
      rating: value?.rating
        ? value.rating
        : {avgRating: 0, myRating: 0, noRatings: 0},
      times: {
        preparation: value.times.preparation,
        rest: value.times.rest,
        cooking: value.times.cooking,
      },
      usedProducts: value.usedProducts,
      created: value.created,
      lastChange: value.lastChange,
      variantProperties: value.variantProperties
        ? value.variantProperties
        : null,
    } as unknown as T;
    if (recipe.variantProperties == null) {
      // Nur hinzufügen, wenn auch vorhanden
      delete recipe.variantProperties;
    }
    return recipe;
  }
  /* =====================================================================
  // Einstellungen für den Session Storage zurückgeben
  //===================================================================== */
  getSessionHandlerProperty(): StorageObjectProperty {
    return STORAGE_OBJECT_PROPERTY.RECIPE;
  }
}
export default FirebaseDbRecipe;
