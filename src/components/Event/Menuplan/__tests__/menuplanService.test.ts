/**
 * Unit-Tests für menuplanService.ts.
 *
 * Alle Funktionen sind rein (pure) — kein DB-Zugriff, keine Seiteneffekte.
 * Getestet werden Factory-Funktionen, CRUD-Operationen auf dem MenuplanData-Objekt,
 * Portionsberechnung, Datumslogik und der Konsistenz-Check.
 */

// structuredClone ist in jsdom (CRA-Test-Umgebung) nicht verfügbar
if (typeof globalThis.structuredClone === "undefined") {
  globalThis.structuredClone = <T>(val: T): T =>
    JSON.parse(JSON.stringify(val));
}

import {
  createEmptyMenuplan,
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
  createProduct,
  addPlanToGood,
  recalculatePortions,
  sortSelectedMenues,
  getEventDateList,
  adjustMenuplanWithNewDays,
  fixMenuplan,
} from "../menuplanService";
import type {
  MenuplanData,
  MealType,
  Meal,
  Menue,
  Meals,
  Menues,
  MealRecipes,
  Materials,
  Products,
  MenuplanObjectStructure,
  MenuplanMaterial,
  MenuplanProduct,
} from "../menuplan.types";
import {
  PlanedDiet,
  PlanedIntolerances,
  GoodsPlanMode,
} from "../menuplan.types";
import {RecipeType} from "../../../Recipe/recipe.class";
import RecipeShort from "../../../Recipe/recipeShort.class";
import {EventGroupConfiguration} from "../../GroupConfiguration/groupConfiguration.class";
import {Event} from "../../Event/event.class";
import AuthUser from "../../../Firebase/Authentication/authUser.class";


let uuidCounter = 0;

beforeEach(() => {
  uuidCounter = 0;
  jest.spyOn(crypto, "randomUUID").mockImplementation(() => {
    uuidCounter++;
    return `uuid-${uuidCounter}` as `${string}-${string}-${string}-${string}-${string}`;
  });
});

afterEach(() => {
  jest.restoreAllMocks();
});

/**
 * Erzeugt ein minimales Event mit einer Zeitscheibe.
 */
function buildEvent(overrides: Partial<Event> = {}): Event {
  const event = new Event();
  event.uid = "event-1";
  event.dates = [
    {
      uid: "d1",
      pos: 1,
      from: new Date(2026, 2, 10), // 10. März 2026
      to: new Date(2026, 2, 12), // 12. März 2026
    },
  ];
  Object.assign(event, overrides);
  return event;
}

/**
 * Erzeugt einen minimalen AuthUser.
 */
function buildAuthUser(): AuthUser {
  const user = new AuthUser();
  user.uid = "user-1";
  user.publicProfile = {
    displayName: "Test User",
    motto: "",
    pictureSrc: "",
  };
  return user;
}

/**
 * Erzeugt eine minimale GroupConfig mit einer Diät und einer Intoleranz.
 */
function buildGroupConfig(): EventGroupConfiguration {
  const gc = new EventGroupConfiguration();
  gc.diets = {
    entries: {
      "diet-1": {uid: "diet-1", name: "Fleisch", totalPortions: 10},
      "diet-2": {uid: "diet-2", name: "Vegi", totalPortions: 5},
    },
    order: ["diet-1", "diet-2"],
  };
  gc.intolerances = {
    entries: {
      "intol-1": {
        uid: "intol-1",
        name: "Ohne Unverträglichkeit",
        totalPortions: 12,
      },
      "intol-2": {uid: "intol-2", name: "Laktose", totalPortions: 3},
    },
    order: ["intol-1", "intol-2"],
  };
  gc.portions = {
    "diet-1": {"intol-1": 8, "intol-2": 2},
    "diet-2": {"intol-1": 4, "intol-2": 1},
  };
  gc.totalPortions = 15;
  return gc;
}

/**
 * Erzeugt ein minimales RecipeShort-Objekt.
 */
function buildRecipeShort(overrides: Partial<RecipeShort> = {}): RecipeShort {
  const recipe = new RecipeShort();
  recipe.uid = "recipe-1";
  recipe.name = "Testrezept";
  recipe.type = RecipeType.public;
  recipe.created = {
    date: new Date(),
    fromUid: "user-1",
    fromDisplayName: "Test User",
  };
  Object.assign(recipe, overrides);
  return recipe;
}

/**
 * Erzeugt einen Menüplan mit Grundstruktur:
 * - 2 Tage (10.+11. März)
 * - 2 MealTypes (Frühstück, Mittagessen)
 * - Für jeden Tag×MealType eine Meal mit einem Menü
 */
function buildPopulatedMenuplan(): MenuplanData {
  const mp = createEmptyMenuplan();
  mp.uid = "event-1";

  const day1 = new Date(2026, 2, 10);
  const day2 = new Date(2026, 2, 11);
  mp.dates = [day1, day2];

  // MealTypes
  const mt1: MealType = {uid: "mt-frueh", name: "Frühstück"};
  const mt2: MealType = {uid: "mt-mittag", name: "Mittagessen"};
  mp.mealTypes = {
    entries: {"mt-frueh": mt1, "mt-mittag": mt2},
    order: ["mt-frueh", "mt-mittag"],
  };

  // Meals & Menues — 4 combinations
  const mealData: Array<{
    mealUid: string;
    date: string;
    mealType: string;
    menueUid: string;
  }> = [
    {
      mealUid: "meal-1",
      date: "2026-03-10",
      mealType: "mt-frueh",
      menueUid: "menue-1",
    },
    {
      mealUid: "meal-2",
      date: "2026-03-10",
      mealType: "mt-mittag",
      menueUid: "menue-2",
    },
    {
      mealUid: "meal-3",
      date: "2026-03-11",
      mealType: "mt-frueh",
      menueUid: "menue-3",
    },
    {
      mealUid: "meal-4",
      date: "2026-03-11",
      mealType: "mt-mittag",
      menueUid: "menue-4",
    },
  ];

  for (const d of mealData) {
    mp.meals[d.mealUid] = {
      uid: d.mealUid,
      date: d.date,
      mealType: d.mealType,
      menuOrder: [d.menueUid],
    };
    mp.menues[d.menueUid] = {
      uid: d.menueUid,
      name: "",
      mealRecipeOrder: [],
      materialOrder: [],
      productOrder: [],
    };
  }

  return mp;
}

describe("createEmptyMenuplan", () => {
  it("sollte ein leeres MenuplanData-Objekt erstellen", () => {
    const mp = createEmptyMenuplan();

    expect(mp.uid).toBe("");
    expect(mp.dates).toEqual([]);
    expect(mp.mealTypes.entries).toEqual({});
    expect(mp.mealTypes.order).toEqual([]);
    expect(mp.meals).toEqual({});
    expect(mp.menues).toEqual({});
    expect(mp.notes).toEqual({});
    expect(mp.mealRecipes).toEqual({});
    expect(mp.materials).toEqual({});
    expect(mp.products).toEqual({});
    expect(mp.usedRecipes).toEqual([]);
    expect(mp.usedProducts).toEqual([]);
    expect(mp.usedMaterials).toEqual([]);
    expect(mp.created.fromUid).toBe("");
    expect(mp.lastChange.fromUid).toBe("");
  });

  it("sollte bei jedem Aufruf ein neues Objekt erzeugen (keine Referenz-Teilung)", () => {
    const mp1 = createEmptyMenuplan();
    const mp2 = createEmptyMenuplan();
    expect(mp1).not.toBe(mp2);
    expect(mp1.mealTypes).not.toBe(mp2.mealTypes);
  });
});

describe("createMealType", () => {
  it("sollte einen MealType mit generierter UID erstellen", () => {
    const mt = createMealType({newMealName: "Brunch"});

    expect(mt.name).toBe("Brunch");
    expect(mt.uid).toBe("uuid-1");
  });
});

describe("createMeal", () => {
  it("sollte ein Meal mit Date-Objekt erstellen", () => {
    const meal = createMeal({
      mealType: "mt-1",
      date: new Date(2026, 2, 10),
    });

    expect(meal.uid).toBe("uuid-1");
    expect(meal.mealType).toBe("mt-1");
    expect(meal.date).toBe("2026-03-10");
    expect(meal.menuOrder).toEqual([]);
  });

  it("sollte ein Meal mit String-Datum erstellen", () => {
    const meal = createMeal({mealType: "mt-1", date: "2026-03-15"});

    expect(meal.date).toBe("2026-03-15");
  });
});

describe("createMenu", () => {
  it("sollte ein leeres Menü erstellen", () => {
    const menu = createMenu();

    expect(menu.uid).toBe("uuid-1");
    expect(menu.name).toBe("");
    expect(menu.mealRecipeOrder).toEqual([]);
    expect(menu.materialOrder).toEqual([]);
    expect(menu.productOrder).toEqual([]);
  });
});

describe("createEmptyNote", () => {
  it("sollte eine leere Notiz mit generierter UID erstellen", () => {
    const note = createEmptyNote();

    expect(note.uid).toBe("uuid-1");
    expect(note.text).toBe("");
    expect(note.menueUid).toBe("");
    expect(note.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("addMealType", () => {
  it("sollte einen MealType hinzufügen und für jeden Tag Meal+Menü erstellen", () => {
    const day1 = new Date(2026, 2, 10);
    const day2 = new Date(2026, 2, 11);

    const mealTypes: MenuplanObjectStructure<MealType> = {
      entries: {},
      order: [],
    };
    const meals: Meals = {};
    const menues: Menues = {};
    const newMealType: MealType = {uid: "mt-new", name: "Zvieri"};

    const result = addMealType({
      mealType: newMealType,
      mealTypes,
      meals,
      menues,
      dates: [day1, day2],
    });

    // MealType wurde aufgenommen
    expect(result.mealTypes.entries["mt-new"]).toEqual(newMealType);
    expect(result.mealTypes.order).toContain("mt-new");

    // 2 Meals (eines pro Tag) erstellt
    const newMeals = Object.values(result.meals);
    expect(newMeals).toHaveLength(2);
    expect(newMeals.every((meal) => meal.mealType === "mt-new")).toBe(true);

    // Jedes Meal hat ein Menü
    newMeals.forEach((meal) => {
      expect(meal.menuOrder).toHaveLength(1);
      expect(result.menues[meal.menuOrder[0]]).toBeDefined();
    });
  });
});

describe("deleteMealType", () => {
  it("sollte MealType, zugehörige Meals, Menüs, Rezepte, Produkte und Materialien löschen", () => {
    const mp = buildPopulatedMenuplan();

    // Rezept und Material in menue-1 einplanen (gehört zu mt-frueh)
    mp.menues["menue-1"].mealRecipeOrder = ["mr-1"];
    mp.mealRecipes["mr-1"] = {
      uid: "mr-1",
      recipe: {
        recipeUid: "r1",
        name: "Test",
        type: RecipeType.public,
        createdFromUid: "u1",
      },
      plan: [],
      totalPortions: 0,
    };
    mp.menues["menue-1"].materialOrder = ["mat-1"];
    mp.materials["mat-1"] = {
      uid: "mat-1",
      materialName: "Holz",
      materialUid: "m1",
      quantity: 1,
      unit: "kg",
      planMode: GoodsPlanMode.TOTAL,
      plan: [],
      totalQuantity: 1,
    };
    mp.menues["menue-1"].productOrder = ["prod-1"];
    mp.products["prod-1"] = {
      uid: "prod-1",
      productName: "Brot",
      productUid: "p1",
      quantity: 2,
      unit: "Stk",
      planMode: GoodsPlanMode.TOTAL,
      plan: [],
      totalQuantity: 2,
    };

    const result = deleteMealType({
      mealTypeToDelete: mp.mealTypes.entries["mt-frueh"],
      mealTypes: mp.mealTypes,
      meals: mp.meals,
      menues: mp.menues,
      mealRecipes: mp.mealRecipes,
      products: mp.products,
      materials: mp.materials,
    });

    // MealType entfernt
    expect(result.mealTypes.entries["mt-frueh"]).toBeUndefined();
    expect(result.mealTypes.order).not.toContain("mt-frueh");

    // Frühstück-Meals entfernt (meal-1 und meal-3)
    expect(result.meals["meal-1"]).toBeUndefined();
    expect(result.meals["meal-3"]).toBeUndefined();

    // Mittagessen-Meals bleiben
    expect(result.meals["meal-2"]).toBeDefined();
    expect(result.meals["meal-4"]).toBeDefined();

    // Frühstück-Menüs entfernt
    expect(result.menues["menue-1"]).toBeUndefined();
    expect(result.menues["menue-3"]).toBeUndefined();

    // Kaskade: Rezept, Material, Produkt gelöscht
    expect(result.mealRecipes["mr-1"]).toBeUndefined();
    expect(result.materials["mat-1"]).toBeUndefined();
    expect(result.products["prod-1"]).toBeUndefined();
  });

  it("sollte bei leerem MealType-UID nichts ändern", () => {
    const mp = buildPopulatedMenuplan();
    const result = deleteMealType({
      mealTypeToDelete: {uid: "", name: ""},
      mealTypes: mp.mealTypes,
      meals: mp.meals,
      menues: mp.menues,
      mealRecipes: mp.mealRecipes,
      products: mp.products,
      materials: mp.materials,
    });

    expect(Object.keys(result.meals)).toHaveLength(4);
  });
});

describe("findMealOfMenu", () => {
  it("sollte die zugehörige Meal finden", () => {
    const mp = buildPopulatedMenuplan();
    const meal = findMealOfMenu({menueUid: "menue-2", meals: mp.meals});

    expect(meal.uid).toBe("meal-2");
  });

  it("sollte einen Fehler werfen, wenn kein Meal gefunden wird", () => {
    const mp = buildPopulatedMenuplan();
    expect(() =>
      findMealOfMenu({menueUid: "nonexistent", meals: mp.meals})
    ).toThrow("No Meal found for Menu nonexistent");
  });
});

describe("findMenueOfMealRecipe", () => {
  it("sollte das Menü finden, in dem das Rezept eingeplant ist", () => {
    const mp = buildPopulatedMenuplan();
    mp.menues["menue-1"].mealRecipeOrder = ["mr-1"];

    const result = findMenueOfMealRecipe({
      mealRecipeUid: "mr-1",
      menues: mp.menues,
    });
    expect(result?.uid).toBe("menue-1");
  });

  it("sollte undefined zurückgeben, wenn das Rezept nicht gefunden wird", () => {
    const mp = buildPopulatedMenuplan();
    const result = findMenueOfMealRecipe({
      mealRecipeUid: "nonexistent",
      menues: mp.menues,
    });
    expect(result).toBeUndefined();
  });
});

describe("findMenueOfMealProduct", () => {
  it("sollte das Menü finden, in dem das Produkt eingeplant ist", () => {
    const mp = buildPopulatedMenuplan();
    mp.menues["menue-3"].productOrder = ["prod-1"];

    const result = findMenueOfMealProduct({
      productUid: "prod-1",
      menues: mp.menues,
    });
    expect(result?.uid).toBe("menue-3");
  });
});

describe("findMenueOfMealMaterial", () => {
  it("sollte das Menü finden, in dem das Material eingeplant ist", () => {
    const mp = buildPopulatedMenuplan();
    mp.menues["menue-4"].materialOrder = ["mat-1"];

    const result = findMenueOfMealMaterial({
      materialUid: "mat-1",
      menues: mp.menues,
    });
    expect(result?.uid).toBe("menue-4");
  });
});

describe("getMealsOfMenues", () => {
  it("sollte die Meals zurückgeben, die zu den übergebenen Menüs gehören", () => {
    const mp = buildPopulatedMenuplan();
    const result = getMealsOfMenues({
      menuplan: mp,
      menues: ["menue-1", "menue-4"],
    });

    expect(result).toContain("meal-1");
    expect(result).toContain("meal-4");
    expect(result).toHaveLength(2);
  });

  it("sollte duplizierte Meals vermeiden, wenn mehrere Menüs zur selben Meal gehören", () => {
    const mp = buildPopulatedMenuplan();
    // Zweites Menü in meal-1
    mp.meals["meal-1"].menuOrder.push("menue-extra");
    mp.menues["menue-extra"] = {
      uid: "menue-extra",
      name: "",
      mealRecipeOrder: [],
      materialOrder: [],
      productOrder: [],
    };

    const result = getMealsOfMenues({
      menuplan: mp,
      menues: ["menue-1", "menue-extra"],
    });
    expect(result).toEqual(["meal-1"]);
  });
});

describe("getMenuesOfMeals", () => {
  it("sollte alle Menüs der übergebenen Meals zurückgeben", () => {
    const mp = buildPopulatedMenuplan();
    const result = getMenuesOfMeals({
      menuplan: mp,
      meals: ["meal-1", "meal-3"],
    });

    expect(result).toContain("menue-1");
    expect(result).toContain("menue-3");
    expect(result).toHaveLength(2);
  });
});

describe("createMealRecipe", () => {
  it("sollte ein MealRecipe mit korrektem Portionsplan erstellen", () => {
    const recipe = buildRecipeShort();
    const plan = {
      [PlanedDiet.ALL]: {
        "intol-1": {
          active: true,
          factor: "1",
          portions: 10,
          total: 10,
          diet: PlanedDiet.ALL,
        },
      },
      "diet-1": {
        "intol-2": {
          active: true,
          factor: "0.5",
          portions: 5,
          total: 2.5,
          diet: "diet-1",
        },
      },
    };

    const mr = createMealRecipe({recipe, plan});

    expect(mr.uid).toBe("uuid-1");
    expect(mr.recipe.recipeUid).toBe("recipe-1");
    expect(mr.recipe.name).toBe("Testrezept");
    expect(mr.recipe.type).toBe(RecipeType.public);
    expect(mr.plan).toHaveLength(2);
    expect(mr.totalPortions).toBe(12.5);
    expect(mr.recipe.variantName).toBeUndefined();
  });

  it("sollte bei Varianten den variantName setzen", () => {
    const recipe = buildRecipeShort({
      type: RecipeType.variant,
      variantName: "Vegetarisch",
    });
    const plan = {
      [PlanedDiet.ALL]: {
        "intol-1": {
          active: true,
          factor: "1",
          portions: 5,
          total: 5,
          diet: PlanedDiet.ALL,
        },
      },
    };

    const mr = createMealRecipe({recipe, plan});
    expect(mr.recipe.variantName).toBe("Vegetarisch");
  });
});

describe("createMaterial", () => {
  it("sollte ein leeres Material erstellen", () => {
    const mat = createMaterial();

    expect(mat.uid).toBe("uuid-1");
    expect(mat.materialName).toBe("");
    expect(mat.quantity).toBe(0);
    expect(mat.planMode).toBe(GoodsPlanMode.TOTAL);
    expect(mat.plan).toEqual([]);
    expect(mat.totalQuantity).toBe(0);
  });
});

describe("createProduct", () => {
  it("sollte ein leeres Produkt erstellen", () => {
    const prod = createProduct();

    expect(prod.uid).toBe("uuid-1");
    expect(prod.productName).toBe("");
    expect(prod.quantity).toBe(0);
    expect(prod.planMode).toBe(GoodsPlanMode.TOTAL);
    expect(prod.plan).toEqual([]);
    expect(prod.totalQuantity).toBe(0);
  });
});

describe("addPlanToGood", () => {
  it("sollte einen Portionsplan zu einem Material hinzufügen", () => {
    const mat = createMaterial();
    mat.quantity = 5;

    const plan = {
      [PlanedDiet.ALL]: {
        "intol-1": {
          active: true,
          factor: "2",
          portions: 10,
          total: 20,
          diet: PlanedDiet.ALL,
        },
      },
    };

    const result = addPlanToGood({good: mat, plan});

    expect(result.plan).toHaveLength(1);
    expect(result.plan[0].factor).toBe(2);
    expect(result.plan[0].totalPortions).toBe(20);
    expect(result.totalQuantity).toBe(20); // Summe aller totalPortions im Plan
  });

  it("sollte mit einem Produkt funktionieren", () => {
    const prod = createProduct();
    const plan = {
      "diet-1": {
        "intol-1": {
          active: true,
          factor: "1",
          portions: 5,
          total: 5,
          diet: "diet-1",
        },
      },
      "diet-2": {
        "intol-2": {
          active: true,
          factor: "1",
          portions: 3,
          total: 3,
          diet: "diet-2",
        },
      },
    };

    const result = addPlanToGood({good: prod, plan});
    expect(result.plan).toHaveLength(2);
    expect(result.totalQuantity).toBe(8);
  });
});

describe("recalculatePortions", () => {
  it("sollte Portionen für MealRecipes neu berechnen (ALL/ALL)", () => {
    const mp = buildPopulatedMenuplan();
    const gc = buildGroupConfig();

    mp.mealRecipes["mr-1"] = {
      uid: "mr-1",
      recipe: {
        recipeUid: "r1",
        name: "Test",
        type: RecipeType.public,
        createdFromUid: "u1",
      },
      plan: [
        {
          diet: PlanedDiet.ALL,
          intolerance: PlanedIntolerances.ALL,
          factor: 1,
          totalPortions: 0, // Wird neu berechnet
        },
      ],
      totalPortions: 0,
    };

    const result = recalculatePortions({menuplan: mp, groupConfig: gc});

    // ALL/ALL × factor 1 = totalPortions (15)
    expect(result.mealRecipes["mr-1"].plan[0].totalPortions).toBe(15);
    expect(result.mealRecipes["mr-1"].totalPortions).toBe(15);
  });

  it("sollte FIX-Einträge unverändert lassen", () => {
    const mp = buildPopulatedMenuplan();
    const gc = buildGroupConfig();

    mp.mealRecipes["mr-1"] = {
      uid: "mr-1",
      recipe: {
        recipeUid: "r1",
        name: "Test",
        type: RecipeType.public,
        createdFromUid: "u1",
      },
      plan: [
        {
          diet: PlanedDiet.FIX,
          intolerance: PlanedIntolerances.FIX,
          factor: 1,
          totalPortions: 42,
        },
      ],
      totalPortions: 42,
    };

    const result = recalculatePortions({menuplan: mp, groupConfig: gc});

    // FIX-Eintrag bleibt unverändert
    expect(result.mealRecipes["mr-1"].plan[0].totalPortions).toBe(42);
  });

  it("sollte gelöschte Diäten/Intoleranzen entfernen", () => {
    const mp = buildPopulatedMenuplan();
    const gc = buildGroupConfig();

    mp.mealRecipes["mr-1"] = {
      uid: "mr-1",
      recipe: {
        recipeUid: "r1",
        name: "Test",
        type: RecipeType.public,
        createdFromUid: "u1",
      },
      plan: [
        {
          diet: "deleted-diet",
          intolerance: "intol-1",
          factor: 1,
          totalPortions: 10,
        },
      ],
      totalPortions: 10,
    };

    const result = recalculatePortions({menuplan: mp, groupConfig: gc});

    // Gelöschte Diät → Eintrag wird entfernt (gefiltert)
    expect(result.mealRecipes["mr-1"].plan).toHaveLength(0);
    expect(result.mealRecipes["mr-1"].totalPortions).toBe(0);
  });

  it("sollte spezifische Diät×Intoleranz-Kombination korrekt berechnen", () => {
    const mp = buildPopulatedMenuplan();
    const gc = buildGroupConfig();

    mp.mealRecipes["mr-1"] = {
      uid: "mr-1",
      recipe: {
        recipeUid: "r1",
        name: "Test",
        type: RecipeType.public,
        createdFromUid: "u1",
      },
      plan: [
        {
          diet: "diet-1",
          intolerance: "intol-2",
          factor: 2,
          totalPortions: 0,
        },
      ],
      totalPortions: 0,
    };

    const result = recalculatePortions({menuplan: mp, groupConfig: gc});

    // diet-1 × intol-2 = 2 Portionen, × factor 2 = 4
    expect(result.mealRecipes["mr-1"].plan[0].totalPortions).toBe(4);
  });

  it("sollte Produkte mit quantity×totalPortions berechnen", () => {
    const mp = buildPopulatedMenuplan();
    const gc = buildGroupConfig();

    mp.menues["menue-1"].productOrder = ["prod-1"];
    mp.products["prod-1"] = {
      uid: "prod-1",
      productName: "Brot",
      productUid: "p1",
      quantity: 3,
      unit: "Stk",
      planMode: GoodsPlanMode.PER_PORTION,
      plan: [
        {
          diet: PlanedDiet.ALL,
          intolerance: PlanedIntolerances.ALL,
          factor: 1,
          totalPortions: 0,
        },
      ],
      totalQuantity: 0,
    };

    const result = recalculatePortions({menuplan: mp, groupConfig: gc});

    // quantity(3) × totalPortions(15) = 45
    expect(result.products["prod-1"].totalQuantity).toBe(45);
  });

  it("sollte Materialien mit quantity×totalPortions berechnen", () => {
    const mp = buildPopulatedMenuplan();
    const gc = buildGroupConfig();

    mp.menues["menue-1"].materialOrder = ["mat-1"];
    mp.materials["mat-1"] = {
      uid: "mat-1",
      materialName: "Holz",
      materialUid: "m1",
      quantity: 2,
      unit: "kg",
      planMode: GoodsPlanMode.PER_PORTION,
      plan: [
        {
          diet: "diet-1",
          intolerance: PlanedIntolerances.ALL,
          factor: 1,
          totalPortions: 0,
        },
      ],
      totalQuantity: 0,
    };

    const result = recalculatePortions({menuplan: mp, groupConfig: gc});

    // diet-1 × ALL = 10 Portionen, quantity(2) × 10 = 20
    expect(result.materials["mat-1"].totalQuantity).toBe(20);
  });

  it("sollte ALL/spezifische Intoleranz korrekt berechnen", () => {
    const mp = buildPopulatedMenuplan();
    const gc = buildGroupConfig();

    mp.mealRecipes["mr-1"] = {
      uid: "mr-1",
      recipe: {
        recipeUid: "r1",
        name: "Test",
        type: RecipeType.public,
        createdFromUid: "u1",
      },
      plan: [
        {
          diet: PlanedDiet.ALL,
          intolerance: "intol-2",
          factor: 1,
          totalPortions: 0,
        },
      ],
      totalPortions: 0,
    };

    const result = recalculatePortions({menuplan: mp, groupConfig: gc});

    // ALL × intol-2: totalPortions der Intoleranz = 3
    expect(result.mealRecipes["mr-1"].plan[0].totalPortions).toBe(3);
  });
});

describe("getEventDateList", () => {
  it("sollte eine flache Datumsliste aus Event-Zeitscheiben generieren", () => {
    const event = buildEvent();

    const dates = getEventDateList({event});

    // 10., 11., 12. März = 3 Tage
    expect(dates).toHaveLength(3);
    expect(dates[0].getDate()).toBe(10);
    expect(dates[1].getDate()).toBe(11);
    expect(dates[2].getDate()).toBe(12);
  });

  it("sollte mehrere Zeitscheiben korrekt zusammenführen", () => {
    const event = buildEvent({
      dates: [
        {uid: "d1", pos: 1, from: new Date(2026, 2, 10), to: new Date(2026, 2, 11)},
        {uid: "d2", pos: 2, from: new Date(2026, 2, 15), to: new Date(2026, 2, 16)},
      ],
    });

    const dates = getEventDateList({event});

    // 10, 11, 15, 16 = 4 Tage
    expect(dates).toHaveLength(4);
    expect(dates[0].getDate()).toBe(10);
    expect(dates[1].getDate()).toBe(11);
    expect(dates[2].getDate()).toBe(15);
    expect(dates[3].getDate()).toBe(16);
  });

  it("sollte leere (Epoch-)Datumseinträge ignorieren", () => {
    const event = buildEvent({
      dates: [
        {uid: "d1", pos: 1, from: new Date(2026, 2, 10), to: new Date(2026, 2, 10)},
        {uid: "d2", pos: 2, from: new Date(0), to: new Date(0)},
      ],
    });

    const dates = getEventDateList({event});

    // Nur 1 Tag — der zweite Eintrag ist Epoch und wird gefiltert
    expect(dates).toHaveLength(1);
  });
});

describe("adjustMenuplanWithNewDays", () => {
  it("sollte neue Tage hinzufügen und für jeden Tag×MealType Meals+Menüs erstellen", () => {
    const mp = buildPopulatedMenuplan();
    const existingEvent = buildEvent({
      dates: [
        {uid: "d1", pos: 1, from: new Date(2026, 2, 10), to: new Date(2026, 2, 11)},
      ],
    });
    // Tag 12 kommt dazu
    const newEvent = buildEvent({
      dates: [
        {uid: "d1", pos: 1, from: new Date(2026, 2, 10), to: new Date(2026, 2, 12)},
      ],
    });

    const result = adjustMenuplanWithNewDays({
      menuplan: mp,
      existingEvent,
      newEvent,
    });

    expect(result.dates).toHaveLength(3);

    // Neue Meals für Tag 12 (2 MealTypes × 1 neuer Tag = 2 neue Meals)
    const newMeals = Object.values(result.meals).filter(
      (meal) => meal.date === "2026-03-12"
    );
    expect(newMeals).toHaveLength(2);

    // Jedes neue Meal hat ein Menü
    newMeals.forEach((meal) => {
      expect(meal.menuOrder).toHaveLength(1);
      expect(result.menues[meal.menuOrder[0]]).toBeDefined();
    });
  });

  it("sollte entfernte Tage kaskadierend löschen (Meals, Menüs, Rezepte, Produkte, Materialien)", () => {
    const mp = buildPopulatedMenuplan();

    // Rezept in menue-3 (Tag 11, Frühstück) einplanen
    mp.menues["menue-3"].mealRecipeOrder = ["mr-del"];
    mp.mealRecipes["mr-del"] = {
      uid: "mr-del",
      recipe: {
        recipeUid: "r1",
        name: "Test",
        type: RecipeType.public,
        createdFromUid: "u1",
      },
      plan: [],
      totalPortions: 0,
    };

    const existingEvent = buildEvent({
      dates: [
        {uid: "d1", pos: 1, from: new Date(2026, 2, 10), to: new Date(2026, 2, 11)},
      ],
    });
    // Tag 11 entfällt
    const newEvent = buildEvent({
      dates: [
        {uid: "d1", pos: 1, from: new Date(2026, 2, 10), to: new Date(2026, 2, 10)},
      ],
    });

    const result = adjustMenuplanWithNewDays({
      menuplan: mp,
      existingEvent,
      newEvent,
    });

    expect(result.dates).toHaveLength(1);

    // Tag-11-Meals gelöscht
    expect(result.meals["meal-3"]).toBeUndefined();
    expect(result.meals["meal-4"]).toBeUndefined();

    // Menüs gelöscht
    expect(result.menues["menue-3"]).toBeUndefined();
    expect(result.menues["menue-4"]).toBeUndefined();

    // Kaskade: Rezept gelöscht
    expect(result.mealRecipes["mr-del"]).toBeUndefined();

    // Tag-10-Daten bleiben
    expect(result.meals["meal-1"]).toBeDefined();
    expect(result.meals["meal-2"]).toBeDefined();
  });

  it("sollte das Original-Menuplan-Objekt nicht verändern", () => {
    const mp = buildPopulatedMenuplan();
    const originalMealKeys = Object.keys(mp.meals);

    const existingEvent = buildEvent({
      dates: [
        {uid: "d1", pos: 1, from: new Date(2026, 2, 10), to: new Date(2026, 2, 11)},
      ],
    });
    const newEvent = buildEvent({
      dates: [
        {uid: "d1", pos: 1, from: new Date(2026, 2, 10), to: new Date(2026, 2, 10)},
      ],
    });

    adjustMenuplanWithNewDays({menuplan: mp, existingEvent, newEvent});

    // Original-Objekt unverändert
    expect(Object.keys(mp.meals)).toEqual(originalMealKeys);
  });
});

describe("sortSelectedMenues", () => {
  it("sollte Menüs nach Datum und MealType sortieren", () => {
    const mp = buildPopulatedMenuplan();

    // Reihenfolge absichtlich durcheinander
    const result = sortSelectedMenues({
      menueList: ["menue-4", "menue-1", "menue-3"],
      menuplan: mp,
    });

    expect(result).toHaveLength(3);
    // Erwartete Reihenfolge: Tag 10/Frühstück, Tag 11/Frühstück, Tag 11/Mittagessen
    expect(result[0].menueUid).toBe("menue-1"); // Tag 10, Frühstück
    expect(result[1].menueUid).toBe("menue-3"); // Tag 11, Frühstück
    expect(result[2].menueUid).toBe("menue-4"); // Tag 11, Mittagessen
  });

  it("sollte nicht-ausgewählte Menüs ignorieren", () => {
    const mp = buildPopulatedMenuplan();
    const result = sortSelectedMenues({
      menueList: ["menue-2"],
      menuplan: mp,
    });

    expect(result).toHaveLength(1);
    expect(result[0].menueUid).toBe("menue-2");
    expect(result[0].mealType.name).toBe("Mittagessen");
  });
});

describe("fixMenuplan", () => {
  it("sollte bei konsistentem Menüplan isConsistent=true zurückgeben", () => {
    const mp = buildPopulatedMenuplan();

    // Ein Rezept korrekt einplanen
    mp.menues["menue-1"].mealRecipeOrder = ["mr-1"];
    mp.mealRecipes["mr-1"] = {
      uid: "mr-1",
      recipe: {
        recipeUid: "r1",
        name: "Test",
        type: RecipeType.public,
        createdFromUid: "u1",
      },
      plan: [],
      totalPortions: 0,
    };

    const {isConsistent, report} = fixMenuplan(mp);

    expect(isConsistent).toBe(true);
    expect(report.menues).toEqual([]);
    expect(report.mealRecipes).toEqual([]);
    expect(report.materials).toEqual([]);
    expect(report.products).toEqual([]);
  });

  it("sollte verwaiste mealRecipeOrder-Einträge entfernen", () => {
    const mp = buildPopulatedMenuplan();

    // mealRecipeOrder referenziert ein Rezept, das nicht existiert
    mp.menues["menue-1"].mealRecipeOrder = ["mr-orphan"];

    const {menuplan: fixed, isConsistent, report} = fixMenuplan(mp);

    expect(isConsistent).toBe(false);
    expect(report.mealRecipes).toContain("mr-orphan");
    expect(fixed.menues["menue-1"].mealRecipeOrder).toEqual([]);
  });

  it("sollte verwaiste materialOrder-Einträge entfernen", () => {
    const mp = buildPopulatedMenuplan();
    mp.menues["menue-2"].materialOrder = ["mat-orphan"];

    const {menuplan: fixed, isConsistent, report} = fixMenuplan(mp);

    expect(isConsistent).toBe(false);
    expect(report.materials).toContain("mat-orphan");
    expect(fixed.menues["menue-2"].materialOrder).toEqual([]);
  });

  it("sollte verwaiste productOrder-Einträge entfernen", () => {
    const mp = buildPopulatedMenuplan();
    mp.menues["menue-3"].productOrder = ["prod-orphan"];

    const {menuplan: fixed, isConsistent, report} = fixMenuplan(mp);

    expect(isConsistent).toBe(false);
    expect(report.products).toContain("prod-orphan");
    expect(fixed.menues["menue-3"].productOrder).toEqual([]);
  });

  it("sollte das Original-Menuplan-Objekt nicht verändern", () => {
    const mp = buildPopulatedMenuplan();
    mp.menues["menue-1"].mealRecipeOrder = ["mr-orphan"];

    fixMenuplan(mp);

    // Original-Order bleibt erhalten
    expect(mp.menues["menue-1"].mealRecipeOrder).toContain("mr-orphan");
  });

  it("sollte mehrere Orphan-Typen in einem einzelnen Menü entfernen", () => {
    const mp = buildPopulatedMenuplan();
    mp.menues["menue-1"].mealRecipeOrder = ["mr-orphan-1", "mr-orphan-2"];
    mp.menues["menue-1"].materialOrder = ["mat-orphan"];
    mp.menues["menue-1"].productOrder = ["prod-orphan"];

    const {menuplan: fixed, isConsistent, report} = fixMenuplan(mp);

    expect(isConsistent).toBe(false);
    expect(report.mealRecipes).toEqual(["mr-orphan-1", "mr-orphan-2"]);
    expect(report.materials).toEqual(["mat-orphan"]);
    expect(report.products).toEqual(["prod-orphan"]);
    expect(fixed.menues["menue-1"].mealRecipeOrder).toEqual([]);
    expect(fixed.menues["menue-1"].materialOrder).toEqual([]);
    expect(fixed.menues["menue-1"].productOrder).toEqual([]);
  });
});

describe("recalculatePortions (Randfälle)", () => {
  it("sollte bei leerem Menüplan (keine Rezepte/Produkte/Materialien) nichts ändern", () => {
    const mp = buildPopulatedMenuplan();
    const gc = buildGroupConfig();

    const result = recalculatePortions({menuplan: mp, groupConfig: gc});

    expect(Object.keys(result.mealRecipes)).toHaveLength(0);
    expect(Object.keys(result.products)).toHaveLength(0);
    expect(Object.keys(result.materials)).toHaveLength(0);
  });

  it("sollte FIX-Rezepte und dynamische Rezepte gemischt korrekt berechnen", () => {
    const mp = buildPopulatedMenuplan();
    const gc = buildGroupConfig();

    mp.mealRecipes["mr-fix"] = {
      uid: "mr-fix",
      recipe: {
        recipeUid: "r-fix",
        name: "Fix-Rezept",
        type: RecipeType.public,
        createdFromUid: "u1",
      },
      plan: [
        {
          diet: PlanedDiet.FIX,
          intolerance: PlanedIntolerances.FIX,
          factor: 1,
          totalPortions: 42,
        },
      ],
      totalPortions: 42,
    };
    mp.mealRecipes["mr-dyn"] = {
      uid: "mr-dyn",
      recipe: {
        recipeUid: "r-dyn",
        name: "Dynamisches-Rezept",
        type: RecipeType.public,
        createdFromUid: "u1",
      },
      plan: [
        {
          diet: PlanedDiet.ALL,
          intolerance: PlanedIntolerances.ALL,
          factor: 2,
          totalPortions: 0,
        },
      ],
      totalPortions: 0,
    };

    const result = recalculatePortions({menuplan: mp, groupConfig: gc});

    // FIX bleibt unverändert
    expect(result.mealRecipes["mr-fix"].plan[0].totalPortions).toBe(42);
    // Dynamisch: ALL/ALL × factor 2 = 30
    expect(result.mealRecipes["mr-dyn"].plan[0].totalPortions).toBe(30);
    expect(result.mealRecipes["mr-dyn"].totalPortions).toBe(30);
  });

  it("sollte Produkte mit gelöschter Intoleranz entfernen und totalQuantity=0 setzen", () => {
    const mp = buildPopulatedMenuplan();
    const gc = buildGroupConfig();

    mp.menues["menue-1"].productOrder = ["prod-del"];
    mp.products["prod-del"] = {
      uid: "prod-del",
      productName: "Milch",
      productUid: "p-del",
      quantity: 5,
      unit: "L",
      planMode: GoodsPlanMode.PER_PORTION,
      plan: [
        {
          diet: "diet-1",
          intolerance: "deleted-intolerance",
          factor: 1,
          totalPortions: 10,
        },
      ],
      totalQuantity: 50,
    };

    const result = recalculatePortions({menuplan: mp, groupConfig: gc});

    // Gelöschte Intoleranz → Plan-Eintrag gefiltert
    expect(result.products["prod-del"].plan).toHaveLength(0);
    expect(result.products["prod-del"].totalQuantity).toBe(0);
  });

  it("sollte Materialien mit spezifischer Diät/ALL-Intoleranz korrekt berechnen", () => {
    const mp = buildPopulatedMenuplan();
    const gc = buildGroupConfig();

    mp.menues["menue-2"].materialOrder = ["mat-spec"];
    mp.materials["mat-spec"] = {
      uid: "mat-spec",
      materialName: "Teller",
      materialUid: "m-spec",
      quantity: 1,
      unit: "Stk",
      planMode: GoodsPlanMode.PER_PORTION,
      plan: [
        {
          diet: "diet-2",
          intolerance: PlanedIntolerances.ALL,
          factor: 1,
          totalPortions: 0,
        },
      ],
      totalQuantity: 0,
    };

    const result = recalculatePortions({menuplan: mp, groupConfig: gc});

    // diet-2 × ALL = 5, quantity(1) × 5 = 5
    expect(result.materials["mat-spec"].totalQuantity).toBe(5);
  });
});

describe("recalculatePortions (TOTAL-Modus)", () => {
  it("sollte TOTAL-Produkte nicht neu berechnen", () => {
    const mp = buildPopulatedMenuplan();
    const gc = buildGroupConfig();

    mp.menues["menue-1"].productOrder = ["prod-total"];
    mp.products["prod-total"] = {
      uid: "prod-total",
      productName: "Sonnencreme",
      productUid: "p-total",
      quantity: 5,
      unit: "Stk",
      planMode: GoodsPlanMode.TOTAL,
      plan: [],
      totalQuantity: 5,
    };

    const result = recalculatePortions({menuplan: mp, groupConfig: gc});

    // TOTAL-Modus: totalQuantity bleibt unverändert
    expect(result.products["prod-total"].totalQuantity).toBe(5);
    expect(result.products["prod-total"].quantity).toBe(5);
  });

  it("sollte TOTAL-Materialien nicht neu berechnen", () => {
    const mp = buildPopulatedMenuplan();
    const gc = buildGroupConfig();

    mp.menues["menue-1"].materialOrder = ["mat-total"];
    mp.materials["mat-total"] = {
      uid: "mat-total",
      materialName: "Zeltplachen",
      materialUid: "m-total",
      quantity: 3,
      unit: "Stk",
      planMode: GoodsPlanMode.TOTAL,
      plan: [],
      totalQuantity: 3,
    };

    const result = recalculatePortions({menuplan: mp, groupConfig: gc});

    // TOTAL-Modus: totalQuantity bleibt unverändert
    expect(result.materials["mat-total"].totalQuantity).toBe(3);
    expect(result.materials["mat-total"].quantity).toBe(3);
  });

  it("sollte PER_PORTION-Produkte weiterhin korrekt berechnen neben TOTAL-Produkten", () => {
    const mp = buildPopulatedMenuplan();
    const gc = buildGroupConfig();

    mp.menues["menue-1"].productOrder = ["prod-total", "prod-portion"];
    mp.products["prod-total"] = {
      uid: "prod-total",
      productName: "Sonnencreme",
      productUid: "p-total",
      quantity: 5,
      unit: "Stk",
      planMode: GoodsPlanMode.TOTAL,
      plan: [],
      totalQuantity: 5,
    };
    mp.products["prod-portion"] = {
      uid: "prod-portion",
      productName: "Brot",
      productUid: "p-portion",
      quantity: 2,
      unit: "Stk",
      planMode: GoodsPlanMode.PER_PORTION,
      plan: [
        {
          diet: PlanedDiet.ALL,
          intolerance: PlanedIntolerances.ALL,
          factor: 1,
          totalPortions: 0,
        },
      ],
      totalQuantity: 0,
    };

    const result = recalculatePortions({menuplan: mp, groupConfig: gc});

    // TOTAL bleibt unverändert
    expect(result.products["prod-total"].totalQuantity).toBe(5);
    // PER_PORTION wird neu berechnet: quantity(2) × totalPortions(15) = 30
    expect(result.products["prod-portion"].totalQuantity).toBe(30);
  });
});

describe("sortSelectedMenues (Randfälle)", () => {
  it("sollte bei leerer Menüliste ein leeres Array zurückgeben", () => {
    const mp = buildPopulatedMenuplan();
    const result = sortSelectedMenues({menueList: [], menuplan: mp});

    expect(result).toEqual([]);
  });

  it("sollte nicht existierende Menü-UIDs ignorieren", () => {
    const mp = buildPopulatedMenuplan();
    const result = sortSelectedMenues({
      menueList: ["nonexistent-uid"],
      menuplan: mp,
    });

    expect(result).toEqual([]);
  });

  it("sollte gemischte existierende und nicht existierende UIDs korrekt behandeln", () => {
    const mp = buildPopulatedMenuplan();
    const result = sortSelectedMenues({
      menueList: ["nonexistent", "menue-2", "menue-1"],
      menuplan: mp,
    });

    expect(result).toHaveLength(2);
    expect(result[0].menueUid).toBe("menue-1");
    expect(result[1].menueUid).toBe("menue-2");
  });
});

describe("adjustMenuplanWithNewDays (Randfälle)", () => {
  it("sollte mehrere Zeitscheiben korrekt verarbeiten", () => {
    const mp = buildPopulatedMenuplan();
    const existingEvent = buildEvent({
      dates: [
        {uid: "d1", pos: 1, from: new Date(2026, 2, 10), to: new Date(2026, 2, 11)},
      ],
    });
    // Zweite Zeitscheibe hinzufügen
    const newEvent = buildEvent({
      dates: [
        {uid: "d1", pos: 1, from: new Date(2026, 2, 10), to: new Date(2026, 2, 11)},
        {uid: "d2", pos: 2, from: new Date(2026, 2, 15), to: new Date(2026, 2, 15)},
      ],
    });

    const result = adjustMenuplanWithNewDays({
      menuplan: mp,
      existingEvent,
      newEvent,
    });

    // 3 Tage: 10, 11, 15
    expect(result.dates).toHaveLength(3);

    // Neue Meals für Tag 15
    const newMeals = Object.values(result.meals).filter(
      (meal) => meal.date === "2026-03-15"
    );
    expect(newMeals).toHaveLength(2); // 2 MealTypes
  });

  it("sollte Notizen, die einem gelöschten Menü zugeordnet sind, entfernen", () => {
    const mp = buildPopulatedMenuplan();
    mp.notes["note-1"] = {
      uid: "note-1",
      text: "Test-Notiz",
      date: "2026-03-11",
      menueUid: "menue-3",
    };

    const existingEvent = buildEvent({
      dates: [
        {uid: "d1", pos: 1, from: new Date(2026, 2, 10), to: new Date(2026, 2, 11)},
      ],
    });
    // Tag 11 entfällt → menue-3 wird gelöscht
    const newEvent = buildEvent({
      dates: [
        {uid: "d1", pos: 1, from: new Date(2026, 2, 10), to: new Date(2026, 2, 10)},
      ],
    });

    const result = adjustMenuplanWithNewDays({
      menuplan: mp,
      existingEvent,
      newEvent,
    });

    expect(result.notes["note-1"]).toBeUndefined();
  });
});

describe("createMealRecipe (Randfälle)", () => {
  it("sollte leeren Plan korrekt verarbeiten", () => {
    const recipe = buildRecipeShort();
    const plan = {};

    const mr = createMealRecipe({recipe, plan});

    expect(mr.plan).toHaveLength(0);
    expect(mr.totalPortions).toBe(0);
  });

  it("sollte mehrere Diäten mit mehreren Intoleranzen korrekt verarbeiten", () => {
    const recipe = buildRecipeShort();
    const plan = {
      "diet-1": {
        "intol-1": {active: true, factor: "1", portions: 8, total: 8, diet: "diet-1"},
        "intol-2": {active: true, factor: "2", portions: 2, total: 4, diet: "diet-1"},
      },
      "diet-2": {
        "intol-1": {active: true, factor: "1", portions: 4, total: 4, diet: "diet-2"},
      },
    };

    const mr = createMealRecipe({recipe, plan});

    expect(mr.plan).toHaveLength(3);
    expect(mr.totalPortions).toBe(16); // 8 + 4 + 4
  });
});
