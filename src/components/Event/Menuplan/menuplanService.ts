/**
 * Menüplan-Service — reine Geschäftslogik-Funktionen.
 *
 * Alle Funktionen operieren auf dem MenuplanData-Interface und sind
 * frei von Seiteneffekten. Ersetzt die statischen Methoden der
 * ehemaligen Menuplan-Klasse.
 */
import Utils from "../../Shared/utils.class";
import * as DEFAULT_VALUES from "../../../constants/defaultValues";
import Event from "../Event/event.class";
import AuthUser from "../../Firebase/Authentication/authUser.class";
import {RecipeType} from "../../Recipe/recipe.class";
import RecipeShort from "../../Recipe/recipeShort.class";
import EventGroupConfiguration, {
  Intolerance,
  Diet,
} from "../GroupConfiguration/groupConfiguration.class";
import {
  MenuplanData,
  MenuplanObjectStructure,
  MealType,
  Menue,
  Menues,
  Meal,
  Meals,
  Note,
  Notes,
  MealRecipe,
  MealRecipes,
  MenuplanMaterial,
  MenuplanProduct,
  Materials,
  Products,
  PortionPlan,
  PlanedDiet,
  PlanedIntolerances,
  GoodsPlanMode,
  MenueCoordinates,
  ConsistencyReport,
  FixMenuplanResult,
} from "./menuplan.types";

/* =====================================================================
// Parameter-Interfaces
// ===================================================================== */

interface CreateMealTypeParams {
  newMealName: MealType["name"];
}

interface CreateMealParams {
  mealType: MealType["uid"];
  date: Date | string;
}

interface AddMealTypeParams {
  mealType: MealType;
  mealTypes: MenuplanObjectStructure<MealType>;
  meals: Meals;
  menues: Menues;
  dates: Date[];
}

interface DeleteMealTypeParams {
  mealTypeToDelete: MealType;
  mealTypes: MenuplanObjectStructure<MealType>;
  meals: Meals;
  menues: Menues;
  mealRecipes: MealRecipes;
  products: Products;
  materials: Materials;
}

interface FindMealOfMenuParams {
  menueUid: Menue["uid"];
  meals: Meals;
}

interface FindMenueOfMealRecipeParams {
  mealRecipeUid: MealRecipe["uid"];
  menues: Menues;
}

interface FindMenueOfMealProductParams {
  productUid: MenuplanProduct["uid"];
  menues: Menues;
}

interface FindMenueOfMealMaterialParams {
  materialUid: MenuplanMaterial["uid"];
  menues: Menues;
}

interface GetMealsOfMenuesParams {
  menuplan: MenuplanData;
  menues: Menue["uid"][];
}

interface GetMenuesOfMealsParams {
  menuplan: MenuplanData;
  meals: Meal["uid"][];
}

interface CreateMealRecipeParams {
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

interface AddPlanToGoodParams<T> {
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

interface RecalculatePortionsParams {
  menuplan: MenuplanData;
  groupConfig: EventGroupConfiguration;
}

interface RecalculateSinglePortionParams {
  portionPlan: PortionPlan;
  groupConfig: EventGroupConfiguration;
}

interface GetEventDateListParams {
  event: Event;
}

interface AdjustMenuplanWithNewDaysParams {
  menuplan: MenuplanData;
  existingEvent: Event;
  newEvent: Event;
}

interface SortSelectedMenuesParams {
  menueList: string[];
  menuplan: MenuplanData;
}

/* =====================================================================
// Factory: Leeren Menüplan erstellen
// ===================================================================== */

/**
 * Erstellt einen leeren Menüplan mit der korrekten Grundstruktur.
 *
 * @returns Leeres MenuplanData-Objekt
 */
export function createEmptyMenuplan(): MenuplanData {
  return {
    uid: "",
    dates: [],
    mealTypes: {
      entries: {} as MenuplanObjectStructure<MealType>["entries"],
      order: [],
    },
    meals: {} as Meals,
    menues: {} as Menues,
    notes: {} as Notes,
    mealRecipes: {} as MealRecipes,
    materials: {} as Materials,
    products: {} as Products,
    created: {date: new Date(0), fromUid: "", fromDisplayName: ""},
    lastChange: {date: new Date(0), fromUid: "", fromDisplayName: ""},
    usedRecipes: [],
    usedProducts: [],
    usedMaterials: [],
  };
}

/**
 * Erstellt einen neuen Menüplan anhand eines Events.
 * Generiert Datumsliste, Standard-Mahlzeitentypen und leere Menüs.
 *
 * @param event - Das Event, für das der Menüplan erstellt wird
 * @param authUser - Der erstellende Benutzer
 * @returns Vollständig initialisiertes MenuplanData-Objekt
 *
 * @example
 * const menuplan = createMenuplan(event, authUser);
 */
export function createMenuplan(event: Event, authUser: AuthUser): MenuplanData {
  const menuplan = createEmptyMenuplan();

  menuplan.uid = event.uid;

  menuplan.created = {
    date: new Date(),
    fromUid: authUser.uid,
    fromDisplayName: authUser.publicProfile.displayName,
  };

  // Datumsliste generieren
  menuplan.dates = getEventDateList({event});

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
      const meal = createMeal({mealType: mealType.uid, date});
      menuplan.meals[meal.uid] = meal;
      const menu = createMenu();
      menuplan.meals[meal.uid].menuOrder.push(menu.uid);
      menuplan.menues[menu.uid] = menu;
    });
  });

  return menuplan;
}

/* =====================================================================
// MealType-Operationen
// ===================================================================== */

/**
 * Erstellt einen neuen Mahlzeitentyp mit generierter UID.
 *
 * @param params.newMealName - Name des neuen Mahlzeitentyps
 * @returns Neuer MealType
 *
 * @example
 * const mealType = createMealType({ newMealName: "Brunch" });
 */
export function createMealType({newMealName}: CreateMealTypeParams): MealType {
  return {
    name: newMealName,
    uid: crypto.randomUUID(),
  };
}

/**
 * Fügt einen neuen Mahlzeitentyp zum Menüplan hinzu.
 * Erstellt für jeden Tag eine neue Mahlzeit und ein leeres Menü.
 *
 * @param params - Mahlzeitentyp, bestehende Strukturen und Datumsliste
 * @returns Aktualisierte mealTypes, meals und menues
 *
 * @example
 * const result = addMealType({ mealType, mealTypes, meals, menues, dates });
 */
export function addMealType({
  mealType,
  mealTypes,
  meals,
  menues,
  dates,
}: AddMealTypeParams) {
  const newMealTypes = {...mealTypes};
  const newMeals = {...meals};
  const newMenues = {...menues};

  // Mahlzeit in Übersicht aufnehmen
  newMealTypes.entries[mealType.uid] = mealType;
  newMealTypes.order.push(mealType.uid);

  // Für jeden Tag eine Mahlzeit erstellen und Menü einfügen
  dates.forEach((date) => {
    const meal = createMeal({mealType: mealType.uid, date});
    newMeals[meal.uid] = meal;
    const menu = createMenu();
    newMeals[meal.uid].menuOrder.push(menu.uid);
    newMenues[menu.uid] = menu;
  });

  return {mealTypes: newMealTypes, meals: newMeals, menues: newMenues};
}

/**
 * Löscht einen Mahlzeitentyp und alle zugehörigen Mahlzeiten, Menüs,
 * Rezepte, Produkte und Materialien.
 *
 * @param params - Zu löschender MealType und alle betroffenen Strukturen
 * @returns Bereinigte Strukturen
 */
export function deleteMealType({
  mealTypeToDelete,
  mealTypes,
  meals,
  menues,
  mealRecipes,
  products,
  materials,
}: DeleteMealTypeParams) {
  if (!mealTypeToDelete.uid) {
    return {mealTypes, meals, menues, mealRecipes, products, materials};
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

  // Alle Meals und Menüs löschen
  Object.keys(meals).forEach((mealUid) => {
    if (meals[mealUid].mealType == mealTypeToDelete.uid) {
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
}

/* =====================================================================
// Meal- & Menu-Operationen
// ===================================================================== */

/**
 * Erstellt eine leere Notiz mit generierter UID.
 *
 * @returns Leere Notiz mit aktuellem Datum
 */
export function createEmptyNote(): Note {
  return {
    uid: crypto.randomUUID(),
    text: "",
    date: Utils.dateAsString(new Date()),
    menueUid: "",
  };
}

/**
 * Erstellt eine neue Mahlzeit (Kombination aus Datum und Mahlzeitentyp).
 *
 * @param params.mealType - UID des Mahlzeitentyps
 * @param params.date - Datum (Date-Objekt oder YYYY-MM-DD String)
 * @returns Neue Mahlzeit mit generierter UID
 */
export function createMeal({mealType, date}: CreateMealParams): Meal {
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
  };
}

/**
 * Erstellt ein neues leeres Menü mit generierter UID.
 *
 * @returns Leeres Menü
 */
export function createMenu(): Menue {
  return {
    uid: crypto.randomUUID(),
    name: "",
    mealRecipeOrder: [],
    productOrder: [],
    materialOrder: [],
  };
}

/* =====================================================================
// Such-Funktionen
// ===================================================================== */

/**
 * Findet die Mahlzeit, zu der ein bestimmtes Menü gehört.
 *
 * @param params.menueUid - UID des gesuchten Menüs
 * @param params.meals - Alle Mahlzeiten
 * @returns Die zugehörige Mahlzeit
 * @throws {Error} Wenn keine Mahlzeit für das Menü gefunden wird
 */
export function findMealOfMenu({menueUid, meals}: FindMealOfMenuParams): Meal {
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
}

/**
 * Findet das Menü, in dem ein bestimmtes Rezept eingeplant ist.
 *
 * @param params.mealRecipeUid - UID des gesuchten MealRecipe
 * @param params.menues - Alle Menüs
 * @returns Das zugehörige Menü oder undefined
 */
export function findMenueOfMealRecipe({
  mealRecipeUid,
  menues,
}: FindMenueOfMealRecipeParams): Menue | undefined {
  return Object.values(menues).find((menue) =>
    menue.mealRecipeOrder.includes(mealRecipeUid),
  );
}

/**
 * Findet das Menü, in dem ein bestimmtes Produkt eingeplant ist.
 *
 * @param params.productUid - UID des gesuchten Produkts
 * @param params.menues - Alle Menüs
 * @returns Das zugehörige Menü oder undefined
 */
export function findMenueOfMealProduct({
  productUid,
  menues,
}: FindMenueOfMealProductParams): Menue | undefined {
  return Object.values(menues).find((menue) =>
    menue.productOrder.includes(productUid),
  );
}

/**
 * Findet das Menü, in dem ein bestimmtes Material eingeplant ist.
 *
 * @param params.materialUid - UID des gesuchten Materials
 * @param params.menues - Alle Menüs
 * @returns Das zugehörige Menü oder undefined
 */
export function findMenueOfMealMaterial({
  materialUid,
  menues,
}: FindMenueOfMealMaterialParams): Menue | undefined {
  return Object.values(menues).find((menue) =>
    menue.materialOrder.includes(materialUid),
  );
}

/**
 * Bestimmt die Mahlzeiten, die zu den übergebenen Menüs gehören.
 *
 * @param params.menuplan - Der Menüplan
 * @param params.menues - Array von Menü-UIDs
 * @returns Array von Meal-UIDs (dedupliziert)
 */
export function getMealsOfMenues({
  menuplan,
  menues,
}: GetMealsOfMenuesParams): Meal["uid"][] {
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
}

/**
 * Bestimmt die Menüs, die in den übergebenen Mahlzeiten enthalten sind.
 *
 * @param params.menuplan - Der Menüplan
 * @param params.meals - Array von Meal-UIDs
 * @returns Array von Menue-UIDs
 */
export function getMenuesOfMeals({
  menuplan,
  meals,
}: GetMenuesOfMealsParams): Menue["uid"][] {
  const menuesOfMeals: Menue["uid"][] = [];
  meals.forEach((mealUid) => {
    menuplan.meals[mealUid].menuOrder.forEach((menueUid) =>
      menuesOfMeals.push(menueUid),
    );
  });

  return menuesOfMeals;
}

/* =====================================================================
// Rezept-, Material- & Produkt-Operationen
// ===================================================================== */

/**
 * Erstellt ein neues MealRecipe (eingeplantes Rezept) mit Portionsplan.
 *
 * @param params.recipe - Das Rezept (RecipeShort)
 * @param params.plan - Portionsplan pro Intoleranz
 * @returns Neues MealRecipe mit berechneten Gesamtportionen
 */
export function createMealRecipe({
  recipe,
  plan,
}: CreateMealRecipeParams): MealRecipe {
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
}

/**
 * Erstellt ein leeres Material für die Einplanung im Menüplan.
 *
 * @returns Leeres MenuplanMaterial mit generierter UID
 */
export function createMaterial(): MenuplanMaterial {
  return {
    uid: crypto.randomUUID(),
    materialName: "",
    materialUid: "",
    quantity: 0,
    unit: "",
    planMode: GoodsPlanMode.TOTAL,
    plan: [],
    totalQuantity: 0,
  };
}

/**
 * Fügt einen Portionsplan zu einem Material oder Produkt hinzu
 * und berechnet die Gesamtmenge.
 *
 * @param params.good - Das Material oder Produkt
 * @param params.plan - Portionsplan pro Intoleranz
 * @returns Das aktualisierte Material/Produkt
 */
export function addPlanToGood<T extends MenuplanProduct | MenuplanMaterial>({
  good,
  plan,
}: AddPlanToGoodParams<T>): T {
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

/**
 * Erstellt ein leeres Produkt für die Einplanung im Menüplan.
 *
 * @returns Leeres MenuplanProduct mit generierter UID
 */
export function createProduct(): MenuplanProduct {
  return {
    uid: crypto.randomUUID(),
    productName: "",
    productUid: "",
    quantity: 0,
    unit: "",
    planMode: GoodsPlanMode.TOTAL,
    plan: [],
    totalQuantity: 0,
  };
}

/* =====================================================================
// Portionsberechnung
// ===================================================================== */

/**
 * Berechnet eine einzelne Portion anhand der GroupConfig neu.
 * Interne Hilfsfunktion.
 *
 * @param params.portionPlan - Die zu berechnende Portionsplan-Zeile
 * @param params.groupConfig - Die aktuelle Gruppenkonfiguration
 * @returns Die aktualisierte Portionsplan-Zeile
 */
function recalculateSinglePortion({
  portionPlan,
  groupConfig,
}: RecalculateSinglePortionParams): PortionPlan {
  let planedPortions = 0;

  // Prüfen ob es die Diät noch gibt
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

  // Prüfen ob es die Intoleranz noch gibt
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
    planedPortions = groupConfig.totalPortions;
  } else if (
    portionPlan.diet == PlanedDiet.ALL &&
    portionPlan.intolerance != PlanedIntolerances.ALL
  ) {
    planedPortions =
      groupConfig.intolerances.entries[portionPlan.intolerance].totalPortions;
  } else if (
    portionPlan.diet != PlanedDiet.ALL &&
    portionPlan.intolerance == PlanedIntolerances.ALL
  ) {
    planedPortions =
      groupConfig.diets.entries[portionPlan.diet].totalPortions;
  } else {
    planedPortions =
      groupConfig.portions[portionPlan.diet][portionPlan.intolerance];
  }

  portionPlan.totalPortions = planedPortions * portionPlan.factor;

  return portionPlan;
}

/**
 * Berechnet alle Portionen im Menüplan anhand der neuen GroupConfig neu.
 * Aktualisiert Rezepte, Produkte und Materialien.
 *
 * @param params.menuplan - Der Menüplan
 * @param params.groupConfig - Die aktuelle Gruppenkonfiguration
 * @returns Der aktualisierte Menüplan
 */
export function recalculatePortions({
  menuplan,
  groupConfig,
}: RecalculatePortionsParams): MenuplanData {
  Object.values(menuplan.mealRecipes).forEach((mealRecipe) => {
    let totalPortions = 0;
    mealRecipe.plan = mealRecipe.plan.map((plan) => {
      if (
        plan.diet != PlanedDiet.FIX &&
        plan.intolerance != PlanedIntolerances.FIX
      ) {
        plan = recalculateSinglePortion({
          portionPlan: plan,
          groupConfig,
        });
        totalPortions += plan.totalPortions;
        return plan;
      } else {
        return plan;
      }
    });
    mealRecipe.totalPortions = totalPortions;
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
        plan = recalculateSinglePortion({
          portionPlan: plan,
          groupConfig,
        });
        totalPortions += plan.totalPortions;
        return plan;
      } else {
        return plan;
      }
    });
    // Gesamtmenge = Basisquantität × Summe der Portionen
    product.totalQuantity = product.quantity * totalPortions;
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
        plan = recalculateSinglePortion({
          portionPlan: plan,
          groupConfig,
        });
        totalPortions += plan.totalPortions;
        return plan;
      } else {
        return plan;
      }
    });
    // Gesamtmenge = Basisquantität × Summe der Portionen
    material.totalQuantity = material.quantity * totalPortions;
    material.plan = material.plan.filter(
      (plan) => plan.diet != "" && plan.intolerance != "",
    );
  });

  return menuplan;
}

/* =====================================================================
// Sortierung & Datumslogik
// ===================================================================== */

/**
 * Sortiert übergebene Menüs in die Reihenfolge, in der sie im Menüplan eingeplant sind.
 *
 * @param params.menueList - Array von Menü-UIDs zum Sortieren
 * @param params.menuplan - Der Menüplan mit der Referenz-Reihenfolge
 * @returns Array von MenueCoordinates in der eingeplanten Reihenfolge
 */
export function sortSelectedMenues({
  menueList,
  menuplan,
}: SortSelectedMenuesParams): MenueCoordinates[] {
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
}

/**
 * Generiert eine Datumsliste anhand der Zeitscheiben eines Events.
 *
 * @param params.event - Das Event mit Zeitscheiben
 * @returns Sortiertes Array aller Einzeldaten
 */
export function getEventDateList({event}: GetEventDateListParams): Date[] {
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
}

/**
 * Passt den Menüplan an, wenn sich die Event-Tage ändern.
 * Entfernt Mahlzeiten/Menüs für gelöschte Tage und erstellt neue für
 * hinzugekommene Tage.
 *
 * @param params.menuplan - Der bestehende Menüplan
 * @param params.existingEvent - Das Event mit den bisherigen Tagen
 * @param params.newEvent - Das Event mit den neuen Tagen
 * @returns Der angepasste Menüplan (Kopie, Original bleibt unverändert)
 */
export function adjustMenuplanWithNewDays({
  menuplan,
  existingEvent,
  newEvent,
}: AdjustMenuplanWithNewDaysParams): MenuplanData {
  const updatedMenuplan = structuredClone(menuplan);

  const newDayList = getEventDateList({event: newEvent}).map((date) =>
    Utils.dateAsString(date),
  );
  const oldDayList = getEventDateList({event: existingEvent}).map((date) =>
    Utils.dateAsString(date),
  );
  const datesToAdd = newDayList.filter((date) => !oldDayList.includes(date));

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

  // Für jeden neuen Tag Mahlzeit und ein Menü erstellen
  datesToAdd.forEach((newDay) => {
    Object.values(updatedMenuplan.mealTypes.entries).forEach((mealType) => {
      const meal = createMeal({
        mealType: mealType.uid,
        date: newDay,
      });
      updatedMenuplan.meals[meal.uid] = meal;
      const menu = createMenu();
      updatedMenuplan.meals[meal.uid].menuOrder.push(menu.uid);
      updatedMenuplan.menues[menu.uid] = menu;
    });
  });
  return updatedMenuplan;
}

/* =====================================================================
// Konsistenz-Check
// ===================================================================== */

/**
 * Entfernt aus einem Order-Array alle Einträge, deren Key nicht in objectKeys enthalten ist.
 *
 * @param order - Das ursprüngliche Order-Array
 * @param objectKeys - Set mit allen gültigen Keys
 * @returns Bereinigtes Order-Array und entfernte Keys
 */
function adjustConsistencyForOrderAndKeys({
  order,
  objectKeys,
}: {
  order: string[];
  objectKeys: Set<string>;
}) {
  const removed: string[] = [];

  const adjustedOrder = order.filter((key) => {
    const ok = objectKeys.has(key);
    if (!ok) removed.push(key);
    return ok;
  });

  return {order: adjustedOrder, removed};
}

/**
 * Konsistenzcheck und Reparatur für alle Order-Arrays im Menüplan.
 *
 * Prüft ob alle referenzierten Elemente in den Order-Arrays auch tatsächlich
 * existieren. Fehlende Referenzen werden entfernt.
 *
 * @param menuplan - Der zu prüfende Menüplan
 * @returns Bereinigte Kopie, Bericht und Konsistenz-Flag
 *
 * @example
 * const { menuplan: fixed, isConsistent, report } = fixMenuplan(menuplan);
 * if (!isConsistent) console.log("Bereinigt:", report);
 */
export function fixMenuplan(menuplan: MenuplanData): FixMenuplanResult {
  const report: ConsistencyReport = {
    menues: [],
    mealRecipes: [],
    materials: [],
    products: [],
  };

  const fixedMenuplan = structuredClone(menuplan);
  let didFix = false;

  const fixedMaterials = adjustConsistencyForOrderAndKeys({
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

  // Produkte
  const fixedProducts = adjustConsistencyForOrderAndKeys({
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
  const fixedMealRecipes = adjustConsistencyForOrderAndKeys({
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
}
