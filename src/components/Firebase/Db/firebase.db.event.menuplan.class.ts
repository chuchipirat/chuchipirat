import Firebase from "../firebase.class";
import {
  FirebaseDbSuper,
  ValueObject,
  PrepareDataForDb,
  PrepareDataForApp,
} from "./firebase.db.super.class";

import {ERROR_NOT_IMPLEMENTED_YET} from "../../../constants/text";
import {
  STORAGE_OBJECT_PROPERTY,
  StorageObjectProperty,
} from "./sessionStorageHandler.class";
import {
  MealRecipeDeletedPrefix,
  MealRecipes,
} from "../../Event/Menuplan/menuplan.types";
import Product from "../../Product/product.class";
import Material from "../../Material/material.class";
import {collection, collectionGroup, doc, Timestamp} from "firebase/firestore";

export class FirebaseDbEventMenuplan extends FirebaseDbSuper {
  firebase: Firebase;
  /* =====================================================================
  // Constructor
  // ===================================================================== */
  constructor(firebase: Firebase) {
    super();
    this.firebase = firebase;
  }
  /* =====================================================================
  // Collection holen
  // ===================================================================== */
  getCollection(uids: string[]) {
    return collection(this.firebase.firestore, `events/${uids[0]}/docs`);
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
    return doc(
      this.firebase.firestore,
      this.getCollection(uids).path,
      `menuplan`
    );
  }
  /* =====================================================================
  // Dokumente holen
  // ===================================================================== */
  getDocuments() {
    throw Error(ERROR_NOT_IMPLEMENTED_YET);
    // Not implemented
  }
  /* =====================================================================
  // Daten für DB-Strutkur vorbereiten
  // ===================================================================== */
  prepareDataForDb<T extends ValueObject>({value}: PrepareDataForDb<T>) {
    // Für die DB braucht es die verwendeten Rezepte in einem Array.
    // So können gelöschte Rezepte auch in einem Menüplan gefunden werden
    // in der App selbst ist diese Information bereits in den MealRecipes.
    // Das finden (Select - Where) funktioniert jedoch nur mit einem solchen
    // Array.
    const usedRecipes: string[] = [];
    const usedProducts: string[] = [];
    const usedMaterials: string[] = [];

    Object.values(value.mealRecipes as MealRecipes).forEach((mealRecipe) => {
      if (!mealRecipe.recipe.recipeUid.includes(MealRecipeDeletedPrefix)) {
        if (
          !usedRecipes.includes(mealRecipe.recipe.recipeUid) &&
          mealRecipe.recipe.recipeUid
        ) {
          usedRecipes.push(mealRecipe.recipe.recipeUid);
        }
      }
    });
    Object.values(value.products as Product).forEach((menuProduct) => {
      if (
        !usedProducts.includes(menuProduct.productUid) &&
        menuProduct.productUid
      ) {
        usedProducts.push(menuProduct.productUid);
      }
    });
    Object.values(value.materials as Material).forEach((menuMaterial) => {
      if (
        !usedMaterials.includes(menuMaterial.materialUid) &&
        menuMaterial.materialUid
      ) {
        usedMaterials.push(menuMaterial.materialUid);
      }
    });

    return {
      dates: value.dates.map((date) => Timestamp.fromDate(date)),
      mealTypes: value.mealTypes,
      notes: value.notes,
      mealRecipes: value.mealRecipes,
      meals: value.meals,
      menues: value.menues,
      materials: value.materials,
      products: value.products,
      created: value.created,
      lastChange: value.lastChange,
      usedRecipes: usedRecipes,
      usedProducts: usedProducts,
      usedMaterials: usedMaterials,
    };
  }
  /* =====================================================================
  // Daten für DB-Strutkur vorbereiten
  // ===================================================================== */
  prepareDataForApp<T extends ValueObject>({value}: PrepareDataForApp) {
    if (!value) {
      throw new Error("No Values fetched!");
    }
    return {
      dates: value.dates,
      mealTypes: value.mealTypes,
      notes: value?.notes ? value.notes : {},
      meals: value?.meals ? value.meals : {},
      menues: value?.menues ? value.menues : {},
      mealRecipes: value?.mealRecipes ? value.mealRecipes : {},
      materials: value?.materials ? value.materials : {},
      products: value?.products ? value.products : {},
      created: value.created,
      lastChange: value.lastChange,
    } as unknown as T;
  }
  /* =====================================================================
  // Einstellungen für den Session Storage zurückgeben
  //===================================================================== */
  getSessionHandlerProperty(): StorageObjectProperty {
    return STORAGE_OBJECT_PROPERTY.MENUPLAN;
  }
}
export default FirebaseDbEventMenuplan;
