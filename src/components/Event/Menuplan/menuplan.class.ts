import Utils from "../../Shared/utils.class";
import * as DEFAULT_VALUES from "../../../constants/defaultValues";
import {ChangeRecord} from "../../Shared/global.interface";
import Event from "../Event/event.class";
import AuthUser from "../../Firebase/Authentication/authUser.class";
import Recipe, {RecipeType} from "../../Recipe/recipe.class";
import Product from "../../Product/product.class";
import Material from "../../Material/material.class";
import EventGroupConfiguration, {
  Intolerance,
  Diet,
} from "../GroupConfiguration/groupConfiguration.class";
import RecipeShort from "../../Recipe/recipeShort.class";
import Unit from "../../Unit/unit.class";
import _ from "lodash";
interface MenuplanObjectStructure<T> {
  entries: {[key: string]: T};
  order: string[];
}

export interface MealType {
  uid: string;
  name: string;
}

export enum MenueListOrderTypes {
  mealRecipeOrder = "mealRecipeOrder",
  materialOrder = "materialOrder",
  productOrder = "productOrder",
  mealTypeOrder = "order",
  menuOrder = "menuOrder",
}

export interface Menue {
  uid: string;
  name: string;
  mealRecipeOrder: Recipe["uid"][];
  materialOrder: Material["uid"][];
  productOrder: Product["uid"][];
}
export interface Menues {
  [key: Menue["uid"]]: Menue;
}
export interface Meal {
  uid: string;
  date: string; // YYYY-MM-DD,
  mealType: MealType["uid"];
  mealTypeName?: MealType["name"];
  menuOrder: Menue["uid"][];
}
export interface Meals {
  [key: Meal["uid"]]: Meal;
}
export interface Note {
  uid: string;
  date: string; // YYYY-MM-DD
  menueUid: Menue["uid"];
  text: string;
}
export interface Notes {
  [key: Note["uid"]]: Note;
}
export enum PlanedIntolerances {
  ALL = "ALL",
  FIX = "FIX",
}
export enum PlanedDiet {
  ALL = "ALL",
  FIX = "FIX",
}
export interface MealRecipes {
  [key: MealRecipe["uid"]]: MealRecipe;
}
export interface PortionPlan {
  diet: PlanedDiet | Diet["uid"];
  intolerance: PlanedIntolerances | Intolerance["uid"];
  factor: number;
  totalPortions: number;
}
export const MealRecipeDeletedPrefix = "[DELETED]";
export interface MealRecipe {
  uid: string;
  recipe: {
    recipeUid: Recipe["uid"];
    name: Recipe["name"];
    type: Recipe["type"];
    createdFromUid: Recipe["created"]["fromUid"];
    variantName?: string;
  };
  plan: PortionPlan[];
  totalPortions: number;
}
export interface Materials {
  [key: MenuplanMaterial["uid"]]: MenuplanMaterial;
}
export interface Products {
  [key: MenuplanProduct["uid"]]: MenuplanProduct;
}
export interface MenuplanMaterial {
  uid: string;
  quantity: number;
  unit: Unit["key"];
  materialUid: Material["uid"];
  materialName: Material["name"];
  planMode: GoodsPlanMode;
  plan: PortionPlan[];
  // Summer aller plan-positionen
  totalQuantity: number;
}
export interface MenuplanProduct {
  uid: string;
  quantity: number;
  unit: Unit["key"];
  productUid: Product["uid"];
  productName: Product["name"];
  planMode: GoodsPlanMode;
  plan: PortionPlan[];
  // Summer aller plan-positionen
  totalQuantity: number;
}

export enum GoodsType {
  NONE,
  MATERIAL = "MATERIAL",
  PRODUCT = "PRODUCT",
}
export enum GoodsPlanMode {
  TOTAL,
  PER_PORTION,
}
export interface PlanedMealsRecipe {
  mealPlanRecipe: MealRecipe["uid"];
  meal: Meal;
  menue: Menue;
  mealPlan: PortionPlan[];
}
interface Factory {
  event: Event;
  authUser: AuthUser;
}
interface CreateMealType {
  newMealName: MealType["name"];
}
interface CreateMeal {
  mealType: MealType["uid"];
  date: Date | string;
}
interface AddMealType {
  mealType: MealType;
  mealTypes: Menuplan["mealTypes"];
  meals: Menuplan["meals"];
  menues: Menuplan["menues"];
  dates: Menuplan["dates"];
}
interface DeleteMealType {
  mealTypeToDelete: MealType;
  mealTypes: Menuplan["mealTypes"];
  meals: Menuplan["meals"];
  menues: Menuplan["menues"];
  mealRecipes: Menuplan["mealRecipes"];
  products: Menuplan["products"];
  materials: Menuplan["materials"];
}
interface GetMealsOfMenues {
  menuplan: Menuplan;
  menues: Menue["uid"][];
}
interface GetMenuesOfMeals {
  menuplan: Menuplan;
  meals: Meal["uid"][];
}

interface FindMealOfMenu {
  menueUid: Menue["uid"];
  meals: Menuplan["meals"];
}
interface FindMenueOfMealRecipe {
  mealRecipeUid: MealRecipe["uid"];
  menues: Menuplan["menues"];
}
interface FindMenueOfMealProduct {
  productUid: MenuplanProduct["uid"];
  menues: Menuplan["menues"];
}
interface FindMenueOfMealMaterial {
  materialUid: MenuplanMaterial["uid"];
  menues: Menuplan["menues"];
}
interface CreateMealRecipe {
  recipe: RecipeShort;
  plan: {
    [key: Intolerance["uid"]]: {
      active: boolean;
      factor: string;
      portions: number;
      total: number;
      diet: Diet["uid"];
    };
  };
}
interface AddPlanToGood<T> {
  good: T;
  plan: {
    [key: Intolerance["uid"]]: {
      active: boolean;
      factor: string;
      portions: number;
      total: number;
      diet: Diet["uid"];
    };
  };
}

interface RecalculatePortions {
  menuplan: Menuplan;
  groupConfig: EventGroupConfiguration;
}
interface RecalculateSinglePortion {
  portionPlan: PortionPlan;
  groupConfig: EventGroupConfiguration;
}

interface GetEventDateList {
  event: Event;
}
interface AdjustMenuplanWithNewDays {
  menuplan: Menuplan;
  existingEvent: Event;
  newEvent: Event;
}

export interface MenueCoordinates {
  menueUid: Menue["uid"];
  date: Date;
  menueName: Menue["name"];
  mealUid: Meal["uid"];
  mealType: MealType;
}

interface SortSelectedMenues {
  menueList: string[];
  menuplan: Menuplan;
}

interface ConsistencyReport {
  menues: string[];
  mealRecipes: string[];
  materials: string[];
  products: string[];
}

interface FixMenuplan {
  menuplan: Menuplan;
  report: ConsistencyReport;
  /** true, wenn keine Inkonsistenzen gefunden wurden */
  isConsistent: boolean;
}

export default class Menuplan {
  // HINT: Änderungen müssen auch im Cloud-FX-Type nachgeführt werden
  uid: string;
  dates: Date[];
  // meals: Meal[];
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

  /* =====================================================================
   // Konstruktor
   // ===================================================================== */
  constructor() {
    this.uid = "";
    this.dates = [];
    this.mealTypes = {
      entries: {} as MenuplanObjectStructure<MealType>["entries"],
      order: [],
    };
    this.meals = {} as Meals;
    this.menues = {} as Menues;
    this.notes = {} as Notes;
    this.mealRecipes = {} as MealRecipes;
    this.materials = {} as Materials;
    this.products = {} as Products;
    this.created = {date: new Date(0), fromUid: "", fromDisplayName: ""};
    this.lastChange = {date: new Date(0), fromUid: "", fromDisplayName: ""};
    this.usedRecipes = [];
    this.usedProducts = [];
    this.usedMaterials = [];
  }

  // ===================================================================== */
  /**
   * Menüplan erstellen anhand eines Events
   */
  static factory = ({event, authUser}: Factory) => {
    const menuplan = new Menuplan();

    menuplan.uid = event.uid;

    menuplan.created = {
      date: new Date(),
      fromUid: authUser.uid,
      fromDisplayName: authUser.publicProfile.displayName,
    };

    // Datumsliste generieren
    menuplan.dates = Menuplan.getEventDateList({event: event});

    // Mahlzeiten generieren (aus Default)
    DEFAULT_VALUES.MENUPLAN_MEALS.forEach((mealType) => {
      const mealTypeUid = crypto.randomUUID();
      mealType.uid = mealTypeUid;
      menuplan.mealTypes.order.push(mealTypeUid);
      menuplan.mealTypes.entries[mealTypeUid] = mealType;
    });

    // Für jedes Datum/Mahlzeit ein Meal generieren
    Object.values(menuplan.mealTypes.entries).forEach((mealType) => {
      menuplan.dates.forEach((date) => {
        // Mahlzeit erstellen
        const meal = Menuplan.createMeal({mealType: mealType.uid, date: date});
        menuplan.meals[meal.uid] = meal;
        // Ein Menü erzeugen und der Mahlzeit hinzufügen
        const menu = Menuplan.createMenu();
        menuplan.meals[meal.uid].menuOrder.push(menu.uid);
        menuplan.menues[menu.uid] = menu;
      });
    });

    return menuplan;
  };
  // ===================================================================== */
  /**
   * Neue Mahlzeit erstellen
   * alle Parameter als 1 Objekt
   * @param newMealName
   * @returns object --> neues Meal
   */
  static createMealType = ({newMealName}: CreateMealType) => {
    return <MealType>{
      name: newMealName,
      uid: crypto.randomUUID(),
    };
  };
  // ===================================================================== */
  /**
   * Neue Mahlzeit zu Menüplan hinzufügen
   * in Allen nötigen Objekten die neue Mahlzeit hinzufügen, damit diese im
   * Menüplan angezeigt werden kann.
   * @param object {mealType --> neue Mahlzeit, mealTypes: alle bestehende Mahlzeiten, meal: Mahlzeit pro Tag/Mahlzeittyp, menues: Menüs }
   * @returns object {mealTypes, meals, menues} --> kann mittels spread wieder auseinander genommen werden
   */
  static addMealType = ({
    mealType,
    mealTypes,
    meals,
    menues,
    dates,
  }: AddMealType) => {
    const newMealTypes = {...mealTypes};
    const newMeals = {...meals};
    const newMenues = {...menues};

    // Mahlzeit in Übersicht aufnehmen
    newMealTypes.entries[mealType.uid] = mealType;
    newMealTypes.order.push(mealType.uid);

    // Für jeden Tag eine Mahlzeit erstellen und Menü einfügen
    dates.forEach((date) => {
      // Mahlzeit erstellen
      const meal = Menuplan.createMeal({mealType: mealType.uid, date: date});
      newMeals[meal.uid] = meal;
      // Ein Menü erzeugen und der Mahlzeit hinzufügen
      const menu = Menuplan.createMenu();
      newMeals[meal.uid].menuOrder.push(menu.uid);
      newMenues[menu.uid] = menu;
    });

    return {mealTypes: newMealTypes, meals: newMeals, menues: newMenues};
  };
  // ===================================================================== */
  /**
   * Mahlzeit aus Menüplan löschen
   */
  static deleteMealType = ({
    mealTypeToDelete,
    mealTypes,
    meals,
    menues,
    mealRecipes,
    products,
    materials,
  }: DeleteMealType) => {
    // Mahlzeit allgemein löschen

    if (!mealTypeToDelete.uid) {
      return {
        mealTypes: mealTypes,
        meals: meals,
        menues: menues,
        mealRecipes: mealRecipes,
        products: products,
        materials: materials,
      };
    }
    const newMealTypes = {...mealTypes};
    const newMeals = {...meals};
    const newMenues = {...menues};
    const newMealRecipes = {...mealRecipes};
    const newProducts = {...products};
    const newMaterials = {...materials};

    // Mahlzeittyp löschen
    newMealTypes.order = mealTypes.order.filter(
      (mealType) => mealType != mealTypeToDelete.uid,
    );
    delete newMealTypes.entries[mealTypeToDelete.uid];

    // alle Meals und Menüs löschen
    Object.keys(meals).forEach((mealUid) => {
      if (meals[mealUid].mealType == mealTypeToDelete.uid) {
        // Alle Menüs löschen, die in dieser Mahlzeit sind
        meals[mealUid].menuOrder.forEach((menuUid) => {
          // Alle Rezepte löschen
          menues[menuUid].mealRecipeOrder.forEach(
            (mealRecipeUid) => delete newMealRecipes[mealRecipeUid],
          );
          // Alle Produkte löschen
          menues[menuUid].productOrder.forEach(
            (productUid) => delete newProducts[productUid],
          );
          // Alle Materialien löschen
          menues[menuUid].materialOrder.forEach(
            (materialUid) => delete newMaterials[materialUid],
          );
          delete newMenues[menuUid];
        });
        // Mahlzeit selbst löschen
        delete newMeals[mealUid];
      }
    });

    return {
      mealTypes: newMealTypes,
      meals: newMeals,
      menues: newMenues,
      mealRecipes: newMealRecipes,
      products: newProducts,
      materials: newMaterials,
    };
  };

  // ===================================================================== */
  /**
   * Leere Notiz erzeugen
   * @returns leere Notiz
   */
  static createEmptyNote = () => {
    return {
      uid: crypto.randomUUID(),
      text: "",
      date: Utils.dateAsString(new Date()),
      menueUid: "",
    } as Note;
  };
  // ===================================================================== */
  /**
   * Leere Mahlzeit erzeugen
   * Die Mahlzeit kommt pro Datum und Mahlzeittyp einmal vor und kann mehrere
   * Menüs halten
   * @param object {mealTyp, date}
   * @returns object as Meal
   */
  static createMeal = ({mealType, date}: CreateMeal) => {
    let stringDate: string;

    if (date instanceof Date) {
      stringDate = Utils.dateAsString(date);
    } else {
      stringDate = date;
    }

    return {
      uid: crypto.randomUUID(),
      date: stringDate,
      mealType: mealType,
      menuOrder: [],
    } as Meal;
  };
  // ===================================================================== */
  /**
   * Neues Menü erstellen
   * @returns object as Menu
   */
  static createMenu = () => {
    return {
      uid: crypto.randomUUID(),
      name: "",
      mealRecipeOrder: [],
      productOrder: [],
      materialOrder: [],
    } as Menue;
  };
  // ===================================================================== */
  /**
   * Die Mahlzeit finden, in der das Menü sich befindet
   * @param menueUid - UID des Menüs
   * @returns meal - Mahlzeit
   */
  static findMealOfMenu = ({menueUid, meals}: FindMealOfMenu) => {
    let foundMealUid = "";
    Object.keys(meals).forEach((mealUid) => {
      if (meals[mealUid].menuOrder.includes(menueUid)) {
        foundMealUid = mealUid;
      }
    });

    if (!foundMealUid) {
      throw Error(`No Meal found for Menu ${menueUid}`);
    }

    return meals[foundMealUid as string];
  };
  // ===================================================================== */
  /**
   * Das Menü finden, in dem das eigeplante Rezept sich befindet
   * @param mealRecipeUid - UID des Menüs
   * @returns menue - Menü
   */
  static findMenueOfMealRecipe = ({
    mealRecipeUid,
    menues,
  }: FindMenueOfMealRecipe) => {
    const menue = Object.values(menues).find((menue) =>
      menue.mealRecipeOrder.includes(mealRecipeUid),
    );
    return menue;
  };
  // ===================================================================== */
  /**
   * Das Menü finden, in dem das eigeplante Produkt sich befindet
   * @param productUid - UID des Menüs
   * @returns menue - Menü
   */
  static findMenueOfMealProduct = ({
    productUid,
    menues,
  }: FindMenueOfMealProduct) => {
    const menue = Object.values(menues).find((menue) =>
      menue.productOrder.includes(productUid),
    );
    return menue;
  };
  // ===================================================================== */
  /**
   * Das Menü finden, in dem das eigeplante Material sich befindet
   * @param materialUid - UID des Menüs
   * @returns menue - Menü
   */
  static findMenueOfMealMaterial = ({
    materialUid,
    menues,
  }: FindMenueOfMealMaterial) => {
    const menue = Object.values(menues).find((menue) =>
      menue.materialOrder.includes(materialUid),
    );
    return menue;
  };
  // ===================================================================== */
  /**
   * Die Menüs bestimmen, die Mahlzeiten bestimmen, in denen die
   * übergebenen Menüs sind.
   * @param Objekt - Menüplan und Menues (als Array)
   * @returns Array mit Meal-UID
   */
  static getMealsOfMenues = ({menuplan, menues}: GetMealsOfMenues) => {
    const mealsOfMenues: Meal["uid"][] = [];

    menues.forEach((menueUid) => {
      const meal = Object.values(menuplan.meals).find((meal) =>
        meal.menuOrder.includes(menueUid),
      );

      if (meal && !mealsOfMenues.includes(meal.uid)) {
        mealsOfMenues.push(meal.uid);
      }
    });
    return mealsOfMenues;
  };
  // ===================================================================== */
  /**
   * Die Menüs bestimmen, die in den Übergebenen Mahlzeiten sind.
   * @param Objekt - Menüplan und Mahlzeiten (als Array)
   * @returns Array mit Menue-UID
   */
  static getMenuesOfMeals = ({menuplan, meals}: GetMenuesOfMeals) => {
    const menuesOfMeals: Menue["uid"][] = [];
    meals.forEach((mealUid) => {
      menuplan.meals[mealUid].menuOrder.forEach((menueUid) =>
        menuesOfMeals.push(menueUid),
      );
    });

    return menuesOfMeals;
  };
  // ===================================================================== */
  /**
   * Ein neues Rezept, welches im Menüplan eingeplant wird erzeugen
   * @returns
   */
  static createMealRecipe = ({recipe, plan}: CreateMealRecipe) => {
    const mealRecipe = {} as MealRecipe;
    mealRecipe.plan = [];
    Object.keys(plan).forEach((intoleranceUid) =>
      mealRecipe.plan.push({
        diet: plan[intoleranceUid].diet,
        intolerance: intoleranceUid,
        factor: parseFloat(plan[intoleranceUid].factor),
        totalPortions: plan[intoleranceUid].total,
      }),
    );

    mealRecipe.uid = crypto.randomUUID();

    mealRecipe.recipe = {
      recipeUid: recipe.uid,
      name: recipe.name,
      type: recipe.type,
      createdFromUid: recipe.created.fromUid,
    };

    if (recipe.type == RecipeType.variant) {
      mealRecipe.recipe.variantName = recipe.variantName;
    }

    mealRecipe.totalPortions = mealRecipe.plan.reduce(
      (runningSum, intolerance) => {
        runningSum = runningSum + intolerance.totalPortions;
        return runningSum;
      },
      0,
    );

    return mealRecipe;
  };
  // ===================================================================== */
  /**
   * Ein neues Material für die Einplanung erstellen
   * @returns Material
   */
  static createMaterial = () => {
    const material = {} as MenuplanMaterial;

    material.uid = crypto.randomUUID();
    material.materialName = "";
    material.materialUid = "";
    material.quantity = 0;
    material.unit = "";
    material.planMode = GoodsPlanMode.TOTAL;
    material.plan = [];
    return material;
  };
  // ===================================================================== */
  /**
   * Der Plan für ein Menuplan-Material/Produkt einfügen
   * @returns Menuplan-Material/Produkt
   */
  static addPlanToGood<T extends MenuplanProduct | MenuplanMaterial>({
    good,
    plan,
  }: AddPlanToGood<T>) {
    Object.keys(plan).forEach((intoleranceUid) =>
      good.plan.push({
        diet: plan[intoleranceUid].diet,
        intolerance: intoleranceUid,
        factor: parseFloat(plan[intoleranceUid].factor),
        totalPortions: plan[intoleranceUid].total,
      }),
    );

    good.totalQuantity = good.plan.reduce((runningSum, intolerance) => {
      runningSum = runningSum + intolerance.totalPortions;
      return runningSum;
    }, 0);

    return good;
  }
  // ===================================================================== */
  /**
   * Ein neues Produkt für die Einplanung erstellen
   * @returns Produkt
   */
  static createProduct = () => {
    const product = {} as MenuplanProduct;

    product.uid = crypto.randomUUID();
    product.productName = "";
    product.productUid = "";
    product.quantity = 0;
    product.unit = "";
    product.planMode = GoodsPlanMode.TOTAL;
    product.plan = [];
    return product;
  };
  // ===================================================================== */
  /**
   * Alle Portionen anhand der neuen GroupConfig berechnen
   * @returns Menuüplan
   */
  static recalculatePortions = ({
    menuplan,
    groupConfig,
  }: RecalculatePortions) => {
    Object.values(menuplan.mealRecipes).forEach((mealRecipe) => {
      let totalPortions = 0;
      mealRecipe.plan = mealRecipe.plan.map((plan) => {
        if (
          plan.diet != PlanedDiet.FIX &&
          plan.intolerance != PlanedIntolerances.FIX
        ) {
          // Nur ändern was nicht fix eingeplant wurde
          plan = Menuplan._recalculateSinglePortion({
            portionPlan: plan,
            groupConfig: groupConfig,
          });
          totalPortions += plan.totalPortions;
          return plan;
        } else {
          return plan;
        }
      });
      mealRecipe.totalPortions = totalPortions;
      // Aus der Einplanung löschen, was es nicht mehr gibt
      mealRecipe.plan = mealRecipe.plan.filter(
        (plan) => plan.diet != "" && plan.intolerance != "",
      );
    });

    // Produkte iterieren
    Object.values(menuplan.products).forEach((product) => {
      let totalPortions = 0;
      product.plan = product.plan.map((plan) => {
        if (
          plan.diet != PlanedDiet.FIX &&
          plan.intolerance != PlanedIntolerances.FIX
        ) {
          // Nur ändern was nicht fix eingeplant wurde
          plan = Menuplan._recalculateSinglePortion({
            portionPlan: plan,
            groupConfig: groupConfig,
          });
          totalPortions += plan.totalPortions;
          return plan;
        } else {
          return plan;
        }
      });
      // Gesamtmenge = Basisquantität × Summe der Portionen
      product.totalQuantity = product.quantity * totalPortions;
      // Aus der Einplanung löschen, was es nicht mehr gibt
      product.plan = product.plan.filter(
        (plan) => plan.diet != "" && plan.intolerance != "",
      );
    });

    // Material iterieren
    Object.values(menuplan.materials).forEach((material) => {
      let totalPortions = 0;
      material.plan = material.plan.map((plan) => {
        if (
          plan.diet != PlanedDiet.FIX &&
          plan.intolerance != PlanedIntolerances.FIX
        ) {
          // Nur ändern was nicht fix eingeplant wurde
          plan = Menuplan._recalculateSinglePortion({
            portionPlan: plan,
            groupConfig: groupConfig,
          });
          totalPortions += plan.totalPortions;
          return plan;
        } else {
          return plan;
        }
      });
      // Gesamtmenge = Basisquantität × Summe der Portionen
      material.totalQuantity = material.quantity * totalPortions;
      // Aus der Einplanung löschen, was es nicht mehr gibt
      material.plan = material.plan.filter(
        (plan) => plan.diet != "" && plan.intolerance != "",
      );
    });

    return menuplan;
  };
  // ===================================================================== */
  /**
   * Übergebene Menües in die Reihenfolge bringen, in der sie auch eingeplant
   * sind
   * @param Object - Objekt mit Array-MenueUid und der Menueplan
   * @returns Array mit MenueUid in der richtigen Reihenfolge
   */
  static sortSelectedMenues = ({menueList, menuplan}: SortSelectedMenues) => {
    const result: MenueCoordinates[] = [];

    menuplan.dates.forEach((date) => {
      const dateAsString = Utils.dateAsString(date);
      menuplan.mealTypes.order.forEach((mealTypeUid) => {
        const meal = Object.values(menuplan.meals).find(
          (meal) => meal.date == dateAsString && meal.mealType == mealTypeUid,
        );
        if (meal) {
          meal.menuOrder.forEach((menueUid) => {
            if (menueList.includes(menueUid)) {
              result.push({
                menueUid: menueUid,
                date: date,
                menueName: menuplan.menues[menueUid].name,
                mealUid: meal!.uid,
                mealType: menuplan.mealTypes.entries[mealTypeUid],
              });
            }
          });
        }
      });
    });
    return result;
  };

  // ===================================================================== */
  /**
   * Einzelne Portion neu berechnen
   * @returns Geplante Portion
   */
  static _recalculateSinglePortion = ({
    portionPlan,
    groupConfig,
  }: RecalculateSinglePortion) => {
    // Anzahl Portionen holen, die in der GroupConfig hinterlegt ist
    let planedPortions = 0;

    // Prüfen ob es die Diät nocht gibt
    if (
      portionPlan.diet != PlanedDiet.ALL &&
      portionPlan.diet != PlanedDiet.FIX &&
      !Object.values(groupConfig.diets.entries).some(
        (entry) => entry.uid == portionPlan.diet,
      )
    ) {
      portionPlan.diet = "";
      portionPlan.intolerance = "";
      portionPlan.totalPortions = 0;
      return portionPlan;
    }

    // Prüfen ob es die Intoleranz nocht gibt
    if (
      portionPlan.intolerance != PlanedIntolerances.ALL &&
      portionPlan.intolerance != PlanedIntolerances.FIX &&
      !Object.values(groupConfig.intolerances.entries).some(
        (entry) => entry.uid == portionPlan.intolerance,
      )
    ) {
      portionPlan.diet = "";
      portionPlan.intolerance = "";
      portionPlan.totalPortions = 0;
      return portionPlan;
    }

    if (
      portionPlan.diet == PlanedDiet.ALL &&
      portionPlan.intolerance == PlanedIntolerances.ALL
    ) {
      // Alle Portionen
      planedPortions = groupConfig.totalPortions;
    } else if (
      portionPlan.diet == PlanedDiet.ALL &&
      portionPlan.intolerance != PlanedIntolerances.ALL
    ) {
      // Alle einer bestimmten Intoleranz
      planedPortions =
        groupConfig.intolerances.entries[portionPlan.intolerance].totalPortions;
    } else if (
      portionPlan.diet != PlanedDiet.ALL &&
      portionPlan.intolerance == PlanedIntolerances.ALL
    ) {
      // Aller einer bestimmten Diät
      planedPortions =
        groupConfig.diets.entries[portionPlan.diet].totalPortions;
    } else {
      // Bestimmte Diät mit Intoleranz
      planedPortions =
        groupConfig.portions[portionPlan.diet][portionPlan.intolerance];
    }

    portionPlan.totalPortions = planedPortions * portionPlan.factor;

    return portionPlan;
  };
  // ===================================================================== */
  /**
   * Menuplan anpassen mit neuer Tagesauwahl
   * Werden die Tage des Anlasses angepasst, muss auch der Menuplan an-
   * gepasst werden.
   * @param Object - Objekt mit Menüplan, Event und neuen Tagen
   * @returns updatedMenuplan
   */
  static adjustMenuplanWithNewDays = ({
    menuplan,
    existingEvent,
    newEvent,
  }: AdjustMenuplanWithNewDays) => {
    const updatedMenuplan = _.cloneDeep(menuplan) as Menuplan;

    const newDayList = Menuplan.getEventDateList({event: newEvent}).map(
      (date) => Utils.dateAsString(date),
    );
    const oldDayList = Menuplan.getEventDateList({event: existingEvent}).map(
      (date) => Utils.dateAsString(date),
    );
    const datesToDAdd = newDayList.filter((date) => !oldDayList.includes(date));

    updatedMenuplan.dates = newDayList.map(
      (date) => new Date(new Date(date).setUTCHours(0, 0, 0, 0)),
    );
    const mealsToDelete = Object.values(menuplan.meals).filter(
      (meal) => !newDayList.includes(meal.date),
    );
    const menueUidsToDelete = mealsToDelete.reduce<Meal["uid"][]>(
      (accumulator, meal) => accumulator.concat(meal.menuOrder),
      [],
    );

    const mealRecipeUidsToDelete = menueUidsToDelete.reduce<
      MealRecipe["uid"][]
    >(
      (accumulator, menuUid) =>
        accumulator.concat(menuplan.menues[menuUid].mealRecipeOrder),
      [],
    );

    const productUidsToDelete = menueUidsToDelete.reduce<
      MenuplanProduct["uid"][]
    >(
      (accumulator, menuUid) =>
        accumulator.concat(menuplan.menues[menuUid].productOrder),
      [],
    );

    const materialUidToDelete = menueUidsToDelete.reduce<
      MenuplanMaterial["uid"][]
    >(
      (accumulator, menuUid) =>
        accumulator.concat(menuplan.menues[menuUid].materialOrder),
      [],
    );

    const notesToDelete = Object.values(menuplan.notes).filter((note) =>
      menueUidsToDelete.includes(note.menueUid),
    );

    mealsToDelete.forEach((meal) => delete updatedMenuplan.meals[meal.uid]);
    menueUidsToDelete.forEach(
      (menueUid) => delete updatedMenuplan.menues[menueUid],
    );
    mealRecipeUidsToDelete.forEach(
      (mealRecipeUid) => delete updatedMenuplan.mealRecipes[mealRecipeUid],
    );
    productUidsToDelete.forEach(
      (productUid) => delete updatedMenuplan.products[productUid],
    );
    materialUidToDelete.forEach(
      (materialUid) => delete updatedMenuplan.materials[materialUid],
    );
    notesToDelete.forEach((note) => delete updatedMenuplan.notes[note.uid]);

    // Für jeden neuen Tage Malhzeit, und eine Menü erstellen
    datesToDAdd.forEach((newDay) => {
      Object.values(updatedMenuplan.mealTypes.entries).forEach((mealType) => {
        const meal = Menuplan.createMeal({
          mealType: mealType.uid,
          date: newDay,
        });
        updatedMenuplan.meals[meal.uid] = meal;
        const menu = Menuplan.createMenu();
        updatedMenuplan.meals[meal.uid].menuOrder.push(menu.uid);
        updatedMenuplan.menues[menu.uid] = menu;
      });
    });
    return updatedMenuplan;
  };
  /**
   * Datumsliste generieren
   * Anhand der Zeitscheiben, ein Array mit allen Daten erstellen
   * @param {event}
   */
  static getEventDateList = ({event}: GetEventDateList) => {
    const dateList: Date[] = [];

    const dateRanges = Event.deleteEmptyDates(event.dates);
    dateRanges.forEach((daterange) => {
      const currentDate = new Date(daterange.from);
      while (currentDate <= daterange.to) {
        dateList.push(new Date(currentDate.setHours(0, 0, 0, 0)));
        currentDate.setDate(currentDate.getDate() + 1);
      }
    });
    return dateList;
  };
  //  ================================================================================================
  /**
   * Entfernt aus einem Order-Array alle Einträge, deren Key nicht in `objectKeys` enthalten ist.
   *
   * @param order Das ursprüngliche Order-Array (z.B. `materialOrder`).
   * @param objectKeys Set mit allen gültigen Keys (z.B. `new Set(Object.keys(materials))`).
   *
   * @returns
   * - `order`: das bereinigte Order-Array (nur noch gültige Keys)
   * - `removed`: Array der entfernten Keys (in gleicher Reihenfolge wie im ursprünglichen Order)
   *
   * @example
   * const fixedMaterials = Menuplan.adjustConsistencyForOrderAndKeys({
   *   order: Object.values(menuplan.menues).flatMap(
   *     (menue) => menue.materialOrder,
   *   ),
   *   objectKeys: new Set(Object.keys(menuplan.materials)),
   * });
   *  if (fixedMaterials.removed.length > 0) {...
   */
  private static adjustConsistencyForOrderAndKeys = ({
    order,
    objectKeys,
  }: {
    order: string[];
    objectKeys: Set<string>;
  }) => {
    const removed: string[] = [];

    const adjustedOrder = order.filter((key) => {
      const ok = objectKeys.has(key);
      if (!ok) removed.push(key);
      return ok;
    });

    return {
      order: adjustedOrder,
      removed,
    };
  };
  //  ================================================================================================
  /**
   * Konsistenzcheck + Reparatur für alle Order-Arrays im Menuplan.
   *
   * Regel:
   * - Alles, was in einem Order-Array referenziert wird, muss in der entsprechenden "Quelle"
   *   (Entries/Objekte bzw. indirekte UID-Listen) existieren.
   * - Fehlt ein referenziertes Element, wird es aus dem Order-Array entfernt.
   *
   * Aktuell prüft/bereinigt diese Funktion:
   * - `meal.menuOrder` gegen `menuplan.menues` (Menue-UIDs)
   * - `menue.productOrder` gegen `menuplan.products[*].productUid` (indirekte Referenz)
   * - `menue.materialOrder` gegen `menuplan.materials[*].materialUid` (indirekte Referenz)
   * - `menue.mealRecipeOrder` gegen `menuplan.mealRecipes[*].recipe.recipeUid` (indirekte Referenz)
   *
   * @param menuplan Der zu prüfende Menuplan.
   *
   * @returns
   * - `menuplan`: bereinigte Kopie (immutable, Original bleibt unverändert)
   * - `report`: Details, welche UIDs entfernt wurden (pro Bereich)
   * - `isConsistent`: true, wenn nichts entfernt werden musste
   *
   * @example
   * const { menuplan: fixed, isConsistent, report } = Menuplan.fixMenuplan(menuplan);
   * if (!isConsistent) console.log("Bereinigt:", report);
   */
  static fixMenuplan = (menuplan: Menuplan): FixMenuplan => {
    const report: ConsistencyReport = {
      menues: [],
      mealRecipes: [],
      materials: [],
      products: [],
    };

    const fixedMenuplan = _.cloneDeep(menuplan);
    let didFix = false;

    const fixedMaterials = Menuplan.adjustConsistencyForOrderAndKeys({
      order: Object.values(menuplan.menues).flatMap(
        (menue) => menue.materialOrder,
      ),
      objectKeys: new Set(Object.keys(menuplan.materials)),
    });

    // Materials
    if (fixedMaterials.removed.length > 0) {
      console.debug("Removed materials:", fixedMaterials.removed);
      didFix = true;
      report.materials = fixedMaterials.removed;
      Object.values(fixedMenuplan.menues).forEach((menue) => {
        fixedMaterials.removed.forEach((removedUid) => {
          menue.materialOrder = menue.materialOrder.filter(
            (uid) => uid !== removedUid,
          );
        });
      });
    }

    //Produkte
    const fixedProducts = Menuplan.adjustConsistencyForOrderAndKeys({
      order: Object.values(menuplan.menues).flatMap(
        (menue) => menue.productOrder,
      ),
      objectKeys: new Set(Object.keys(menuplan.products)),
    });

    if (fixedProducts.removed.length > 0) {
      console.debug("Removed products:", fixedProducts.removed);
      didFix = true;
      report.products = fixedProducts.removed;
      Object.values(fixedMenuplan.menues).forEach((menue) => {
        fixedProducts.removed.forEach((removedUid) => {
          menue.productOrder = menue.productOrder.filter(
            (uid) => uid !== removedUid,
          );
        });
      });
    }

    // MealRecipes
    const fixedMealRecipes = Menuplan.adjustConsistencyForOrderAndKeys({
      order: Object.values(menuplan.menues).flatMap(
        (menue) => menue.mealRecipeOrder,
      ),
      objectKeys: new Set(Object.keys(menuplan.mealRecipes)),
    });

    if (fixedMealRecipes.removed.length > 0) {
      console.debug("Removed mealRecipes:", fixedMealRecipes.removed);
      didFix = true;
      report.mealRecipes = fixedMealRecipes.removed;
      Object.values(fixedMenuplan.menues).forEach((menue) => {
        fixedMealRecipes.removed.forEach((removedUid) => {
          menue.mealRecipeOrder = menue.mealRecipeOrder.filter(
            (uid) => uid !== removedUid,
          );
        });
      });
    }

    return {
      menuplan: fixedMenuplan,
      report,
      isConsistent: !didFix,
    };
  };
}
