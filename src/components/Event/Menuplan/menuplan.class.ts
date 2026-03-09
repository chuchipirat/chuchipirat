/**
 * @deprecated Barrel-Re-Export — importiere direkt aus `menuplan.types.ts` und `menuplanService.ts`.
 *
 * Diese Datei existiert nur noch für Abwärtskompatibilität während der Migration.
 * Sie wird gelöscht, sobald alle Consumers umgestellt sind.
 */

// Re-export aller Typen
export type {
  MenuplanObjectStructure,
  MealType,
  Menue,
  Menues,
  Meal,
  Meals,
  Note,
  Notes,
  PortionPlan,
  MealRecipe,
  MealRecipes,
  MenuplanMaterial,
  Materials,
  MenuplanProduct,
  Products,
  MenueCoordinates,
  PlanedMealsRecipe,
  ConsistencyReport,
  FixMenuplanResult,
  MenuplanData,
} from "./menuplan.types";

export {
  MenueListOrderTypes,
  PlanedIntolerances,
  PlanedDiet,
  MealRecipeDeletedPrefix,
  GoodsType,
  GoodsPlanMode,
} from "./menuplan.types";

// Re-export aller Service-Funktionen
export {
  createEmptyMenuplan,
  createMenuplan,
  createMealType,
  addMealType,
  deleteMealType,
  createEmptyNote,
  createMeal,
  createMenu,
  findMealOfMenu,
  findMenueOfMealRecipe,
  findMenueOfMealProduct,
  findMenueOfMealMaterial,
  getMealsOfMenues,
  getMenuesOfMeals,
  createMealRecipe,
  createMaterial,
  addPlanToGood,
  createProduct,
  recalculatePortions,
  sortSelectedMenues,
  getEventDateList,
  adjustMenuplanWithNewDays,
  fixMenuplan,
} from "./menuplanService";

// Abwärtskompatible Klasse — delegiert an Service-Funktionen
import {ChangeRecord} from "../../Shared/global.interface";
import Event from "../Event/event.class";
import AuthUser from "../../Firebase/Authentication/authUser.class";
import Recipe from "../../Recipe/recipe.class";
import Product from "../../Product/product.class";
import Material from "../../Material/material.class";
import EventGroupConfiguration, {
  Intolerance,
  Diet,
} from "../GroupConfiguration/groupConfiguration.class";
import RecipeShort from "../../Recipe/recipeShort.class";
import {
  MenuplanObjectStructure,
  MealType,
  Meal,
  Meals,
  Menue,
  Menues,
  Note,
  Notes,
  MealRecipe,
  MealRecipes,
  MenuplanMaterial,
  Materials,
  MenuplanProduct,
  Products,
  PortionPlan,
  MenueCoordinates,
  GoodsPlanMode,
  MenuplanData,
} from "./menuplan.types";
import * as Service from "./menuplanService";

/**
 * @deprecated Verwende stattdessen `MenuplanData` Interface und Funktionen aus `menuplanService.ts`.
 *
 * Diese Klasse existiert nur noch für Abwärtskompatibilität während der Migration.
 */
export default class Menuplan implements MenuplanData {
  uid: string;
  dates: Date[];
  meals: Meals;
  menues: Menues;
  mealTypes: MenuplanObjectStructure<MealType>;
  notes: Notes;
  mealRecipes: MealRecipes;
  created: ChangeRecord;
  lastChange: ChangeRecord;
  materials: Materials;
  products: Products;
  usedRecipes?: Recipe["uid"][];
  usedProducts?: Product["uid"][];
  usedMaterials?: Material["uid"][];

  constructor() {
    const empty = Service.createEmptyMenuplan();
    this.uid = empty.uid;
    this.dates = empty.dates;
    this.mealTypes = empty.mealTypes;
    this.meals = empty.meals;
    this.menues = empty.menues;
    this.notes = empty.notes;
    this.mealRecipes = empty.mealRecipes;
    this.materials = empty.materials;
    this.products = empty.products;
    this.created = empty.created;
    this.lastChange = empty.lastChange;
    this.usedRecipes = empty.usedRecipes;
    this.usedProducts = empty.usedProducts;
    this.usedMaterials = empty.usedMaterials;
  }

  /** @deprecated Verwende `createMenuplan()` aus menuplanService.ts */
  static factory = ({event, authUser}: {event: Event; authUser: AuthUser}) =>
    Service.createMenuplan(event, authUser) as Menuplan;

  /** @deprecated Verwende `createMealType()` aus menuplanService.ts */
  static createMealType = Service.createMealType;

  /** @deprecated Verwende `addMealType()` aus menuplanService.ts */
  static addMealType = Service.addMealType;

  /** @deprecated Verwende `deleteMealType()` aus menuplanService.ts */
  static deleteMealType = Service.deleteMealType;

  /** @deprecated Verwende `createEmptyNote()` aus menuplanService.ts */
  static createEmptyNote = Service.createEmptyNote;

  /** @deprecated Verwende `createMeal()` aus menuplanService.ts */
  static createMeal = Service.createMeal;

  /** @deprecated Verwende `createMenu()` aus menuplanService.ts */
  static createMenu = Service.createMenu;

  /** @deprecated Verwende `findMealOfMenu()` aus menuplanService.ts */
  static findMealOfMenu = Service.findMealOfMenu;

  /** @deprecated Verwende `findMenueOfMealRecipe()` aus menuplanService.ts */
  static findMenueOfMealRecipe = Service.findMenueOfMealRecipe;

  /** @deprecated Verwende `findMenueOfMealProduct()` aus menuplanService.ts */
  static findMenueOfMealProduct = Service.findMenueOfMealProduct;

  /** @deprecated Verwende `findMenueOfMealMaterial()` aus menuplanService.ts */
  static findMenueOfMealMaterial = Service.findMenueOfMealMaterial;

  /** @deprecated Verwende `getMealsOfMenues()` aus menuplanService.ts */
  static getMealsOfMenues = Service.getMealsOfMenues;

  /** @deprecated Verwende `getMenuesOfMeals()` aus menuplanService.ts */
  static getMenuesOfMeals = Service.getMenuesOfMeals;

  /** @deprecated Verwende `createMealRecipe()` aus menuplanService.ts */
  static createMealRecipe = Service.createMealRecipe;

  /** @deprecated Verwende `createMaterial()` aus menuplanService.ts */
  static createMaterial = Service.createMaterial;

  /** @deprecated Verwende `addPlanToGood()` aus menuplanService.ts */
  static addPlanToGood = Service.addPlanToGood;

  /** @deprecated Verwende `createProduct()` aus menuplanService.ts */
  static createProduct = Service.createProduct;

  /** @deprecated Verwende `recalculatePortions()` aus menuplanService.ts */
  static recalculatePortions = Service.recalculatePortions;

  /** @deprecated Verwende `sortSelectedMenues()` aus menuplanService.ts */
  static sortSelectedMenues = Service.sortSelectedMenues;

  /** @deprecated Verwende die nicht-exportierte Funktion in menuplanService.ts */
  static _recalculateSinglePortion = (params: {
    portionPlan: PortionPlan;
    groupConfig: EventGroupConfiguration;
  }) => {
    // _recalculateSinglePortion ist jetzt privat in menuplanService.ts.
    // Diese Methode wird nur noch von altem Code aufgerufen, der nicht migriert ist.
    // Der recalculatePortions-Aufruf deckt denselben Use-Case ab.
    throw new Error(
      "_recalculateSinglePortion ist privat. Verwende recalculatePortions() stattdessen.",
    );
  };

  /** @deprecated Verwende `adjustMenuplanWithNewDays()` aus menuplanService.ts */
  static adjustMenuplanWithNewDays = Service.adjustMenuplanWithNewDays;

  /** @deprecated Verwende `getEventDateList()` aus menuplanService.ts */
  static getEventDateList = Service.getEventDateList;

  /** @deprecated Verwende `fixMenuplan()` aus menuplanService.ts */
  static fixMenuplan = (menuplan: Menuplan) =>
    Service.fixMenuplan(menuplan) as {
      menuplan: Menuplan;
      report: {
        menues: string[];
        mealRecipes: string[];
        materials: string[];
        products: string[];
      };
      isConsistent: boolean;
    };
}
