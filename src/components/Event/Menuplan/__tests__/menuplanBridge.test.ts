/**
 * Tests für die Bridge-Funktionen zwischen Firebase-Menuplan (verschachtelte Maps)
 * und Supabase-MenuplanDomain (flache Arrays).
 *
 * Reine Funktions-Tests ohne Mocks.
 */
import {
  menuplanDomainToClass,
  menuplanClassToDomain,
} from "../menuplanBridge";
import Menuplan, {
  MealRecipeDeletedPrefix,
  PlanedDiet,
  PlanedIntolerances,
  GoodsPlanMode,
} from "../menuplan.class";
import {RecipeType} from "../../../Recipe/recipe.class";
import type {
  MenuplanDomain,
  MealTypeDomain,
  MealDomain,
  MenueDomain,
  MenueRecipeDomain,
  MenueProductDomain,
  MenueMaterialDomain,
  NoteDomain,
  ItemPlanDomain,
} from "../../../Database/Repository/MenuplanRepository";

// =====================================================================
// Hilfsfunktionen für Test-Daten
// =====================================================================

/**
 * Erzeugt ein minimales, gültiges MenuplanDomain-Objekt zum Testen.
 *
 * @param overrides - Partielle Überschreibungen für einzelne Felder.
 * @returns Ein vollständiges MenuplanDomain-Objekt.
 */
function buildDomain(
  overrides: Partial<MenuplanDomain> = {}
): MenuplanDomain {
  return {
    eventId: "event-1",
    mealTypes: [],
    meals: [],
    menues: [],
    menueRecipes: [],
    menueProducts: [],
    menueMaterials: [],
    notes: [],
    ...overrides,
  };
}

/**
 * Erzeugt ein ItemPlanDomain mit Scope ALL/ALL als Default.
 *
 * @param overrides - Partielle Überschreibungen.
 * @returns Ein vollständiges ItemPlanDomain-Objekt.
 */
function buildItemPlan(
  overrides: Partial<ItemPlanDomain> = {}
): ItemPlanDomain {
  return {
    uid: "plan-1",
    dietScope: "ALL",
    dietId: null,
    intoleranceScope: "ALL",
    intoleranceId: null,
    factor: 1,
    servings: 10,
    ...overrides,
  };
}

// =====================================================================
// menuplanDomainToClass
// =====================================================================

describe("menuplanDomainToClass", () => {
  it("konvertiert MealTypes in die entries/order-Struktur", () => {
    const mealTypes: MealTypeDomain[] = [
      {uid: "mt-2", name: "Mittagessen", sortOrder: 20},
      {uid: "mt-1", name: "Frühstück", sortOrder: 10},
    ];
    const domain = buildDomain({mealTypes});

    const result = menuplanDomainToClass(domain, "event-1");

    // Reihenfolge muss nach sortOrder sortiert sein
    expect(result.mealTypes.order).toEqual(["mt-1", "mt-2"]);
    expect(result.mealTypes.entries["mt-1"]).toEqual({
      uid: "mt-1",
      name: "Frühstück",
    });
    expect(result.mealTypes.entries["mt-2"]).toEqual({
      uid: "mt-2",
      name: "Mittagessen",
    });
  });

  it("konvertiert Meals, Menues und deren menuOrder korrekt", () => {
    const mealTypes: MealTypeDomain[] = [
      {uid: "mt-1", name: "Frühstück", sortOrder: 10},
    ];
    const meals: MealDomain[] = [
      {uid: "meal-1", mealDate: "2026-03-08", mealTypeId: "mt-1"},
    ];
    const menues: MenueDomain[] = [
      {uid: "menue-b", mealId: "meal-1", name: "Menü B", sortOrder: 20},
      {uid: "menue-a", mealId: "meal-1", name: "Menü A", sortOrder: 10},
    ];
    const domain = buildDomain({mealTypes, meals, menues});

    const result = menuplanDomainToClass(domain, "event-1");

    expect(result.meals["meal-1"].menuOrder).toEqual(["menue-a", "menue-b"]);
    expect(result.meals["meal-1"].date).toBe("2026-03-08");
    expect(result.meals["meal-1"].mealType).toBe("mt-1");
    expect(result.menues["menue-a"].name).toBe("Menü A");
    expect(result.menues["menue-b"].name).toBe("Menü B");
  });

  it("mappt recipeDomain.recipeName auf mealRecipe.recipe.name", () => {
    const meals: MealDomain[] = [
      {uid: "meal-1", mealDate: "2026-03-08", mealTypeId: "mt-1"},
    ];
    const menues: MenueDomain[] = [
      {uid: "menue-1", mealId: "meal-1", name: "Hauptgang", sortOrder: 10},
    ];
    const menueRecipes: MenueRecipeDomain[] = [
      {
        uid: "mr-1",
        menueId: "menue-1",
        recipeId: "recipe-42",
        recipeName: "Kartoffelgratin",
        deletedRecipeName: null,
        variantName: null,
        totalPortions: 20,
        sortOrder: 10,
        plans: [],
      },
    ];
    const domain = buildDomain({
      mealTypes: [{uid: "mt-1", name: "Abendessen", sortOrder: 10}],
      meals,
      menues,
      menueRecipes,
    });

    const result = menuplanDomainToClass(domain, "event-1");

    const mr = result.mealRecipes["mr-1"];
    expect(mr.recipe.name).toBe("Kartoffelgratin");
    expect(mr.recipe.recipeUid).toBe("recipe-42");
    expect(mr.recipe.type).toBe(RecipeType.public);
    expect(mr.totalPortions).toBe(20);
  });

  it("konvertiert gelöschte Rezepte (recipeId null, deletedRecipeName gesetzt)", () => {
    const meals: MealDomain[] = [
      {uid: "meal-1", mealDate: "2026-03-08", mealTypeId: "mt-1"},
    ];
    const menues: MenueDomain[] = [
      {uid: "menue-1", mealId: "meal-1", name: "Vorspeise", sortOrder: 10},
    ];
    const menueRecipes: MenueRecipeDomain[] = [
      {
        uid: "mr-del",
        menueId: "menue-1",
        recipeId: null,
        recipeName: "",
        deletedRecipeName: "[DELETED] Altes Rezept",
        variantName: null,
        totalPortions: 5,
        sortOrder: 10,
        plans: [],
      },
    ];
    const domain = buildDomain({
      mealTypes: [{uid: "mt-1", name: "Lunch", sortOrder: 10}],
      meals,
      menues,
      menueRecipes,
    });

    const result = menuplanDomainToClass(domain, "event-1");

    const mr = result.mealRecipes["mr-del"];
    // Gelöschtes Rezept: name kommt aus deletedRecipeName, recipeUid ist leer
    expect(mr.recipe.name).toBe("[DELETED] Altes Rezept");
    expect(mr.recipe.recipeUid).toBe("");
  });

  it("konvertiert Produkte und Materialien mit planMode-Mapping", () => {
    const meals: MealDomain[] = [
      {uid: "meal-1", mealDate: "2026-03-08", mealTypeId: "mt-1"},
    ];
    const menues: MenueDomain[] = [
      {uid: "menue-1", mealId: "meal-1", name: "Menü", sortOrder: 10},
    ];
    const menueProducts: MenueProductDomain[] = [
      {
        uid: "prod-1",
        menueId: "menue-1",
        productId: "p-42",
        productName: "Mehl",
        quantity: 500,
        unit: "g",
        planMode: "total",
        totalQuantity: 500,
        sortOrder: 10,
        plans: [],
      },
    ];
    const menueMaterials: MenueMaterialDomain[] = [
      {
        uid: "mat-1",
        menueId: "menue-1",
        materialId: "m-7",
        materialName: "Teller",
        quantity: 30,
        unit: "Stk",
        planMode: "per_portion",
        totalQuantity: 120,
        sortOrder: 10,
        plans: [],
      },
    ];
    const domain = buildDomain({
      mealTypes: [{uid: "mt-1", name: "Essen", sortOrder: 10}],
      meals,
      menues,
      menueProducts,
      menueMaterials,
    });

    const result = menuplanDomainToClass(domain, "event-1");

    expect(result.products["prod-1"].planMode).toBe(GoodsPlanMode.TOTAL);
    expect(result.products["prod-1"].productName).toBe("Mehl");
    expect(result.products["prod-1"].productUid).toBe("p-42");
    expect(result.materials["mat-1"].planMode).toBe(GoodsPlanMode.PER_PORTION);
    expect(result.materials["mat-1"].materialName).toBe("Teller");
    expect(result.materials["mat-1"].totalQuantity).toBe(120);
  });

  it("konvertiert Plan-Zeilen: ALL, FIX und group-Scope", () => {
    const meals: MealDomain[] = [
      {uid: "meal-1", mealDate: "2026-03-08", mealTypeId: "mt-1"},
    ];
    const menues: MenueDomain[] = [
      {uid: "menue-1", mealId: "meal-1", name: "M", sortOrder: 10},
    ];
    const plans: ItemPlanDomain[] = [
      buildItemPlan({
        uid: "p1",
        dietScope: "ALL",
        dietId: null,
        intoleranceScope: "ALL",
        intoleranceId: null,
        factor: 1,
        servings: 10,
      }),
      buildItemPlan({
        uid: "p2",
        dietScope: "FIX",
        dietId: null,
        intoleranceScope: "FIX",
        intoleranceId: null,
        factor: 2,
        servings: 5,
      }),
      buildItemPlan({
        uid: "p3",
        dietScope: "group",
        dietId: "diet-vegan",
        intoleranceScope: "group",
        intoleranceId: "intol-laktose",
        factor: 0.5,
        servings: 3,
      }),
    ];
    const menueRecipes: MenueRecipeDomain[] = [
      {
        uid: "mr-1",
        menueId: "menue-1",
        recipeId: "r-1",
        recipeName: "Rezept",
        deletedRecipeName: null,
        variantName: null,
        totalPortions: 18,
        sortOrder: 10,
        plans,
      },
    ];
    const domain = buildDomain({
      mealTypes: [{uid: "mt-1", name: "X", sortOrder: 10}],
      meals,
      menues,
      menueRecipes,
    });

    const result = menuplanDomainToClass(domain, "event-1");
    const converted = result.mealRecipes["mr-1"].plan;

    expect(converted).toHaveLength(3);

    // ALL
    expect(converted[0].diet).toBe(PlanedDiet.ALL);
    expect(converted[0].intolerance).toBe(PlanedIntolerances.ALL);
    expect(converted[0].factor).toBe(1);
    expect(converted[0].totalPortions).toBe(10);

    // FIX
    expect(converted[1].diet).toBe(PlanedDiet.FIX);
    expect(converted[1].intolerance).toBe(PlanedIntolerances.FIX);

    // group → konkrete UID
    expect(converted[2].diet).toBe("diet-vegan");
    expect(converted[2].intolerance).toBe("intol-laktose");
    expect(converted[2].factor).toBe(0.5);
    expect(converted[2].totalPortions).toBe(3);
  });

  it("konvertiert Notizen korrekt", () => {
    const notes: NoteDomain[] = [
      {uid: "n-1", menueId: "menue-1", noteDate: "2026-03-08", text: "Achtung!"},
      {uid: "n-2", menueId: null, noteDate: "2026-03-09", text: "Allgemein"},
    ];
    const domain = buildDomain({notes});

    const result = menuplanDomainToClass(domain, "event-1");

    expect(result.notes["n-1"].text).toBe("Achtung!");
    expect(result.notes["n-1"].menueUid).toBe("menue-1");
    expect(result.notes["n-2"].menueUid).toBe("");
  });

  it("leitet Dates aus den Meals ab und sortiert aufsteigend", () => {
    const meals: MealDomain[] = [
      {uid: "meal-2", mealDate: "2026-03-10", mealTypeId: "mt-1"},
      {uid: "meal-1", mealDate: "2026-03-08", mealTypeId: "mt-1"},
      {uid: "meal-3", mealDate: "2026-03-08", mealTypeId: "mt-2"}, // Duplikat
    ];
    const domain = buildDomain({meals});

    const result = menuplanDomainToClass(domain, "event-1");

    // Eindeutige Datumswerte, aufsteigend sortiert
    expect(result.dates).toHaveLength(2);
    expect(result.dates[0].getTime()).toBeLessThan(result.dates[1].getTime());
  });

  it("setzt die UID des Menuplans auf die Event-UID", () => {
    const domain = buildDomain();

    const result = menuplanDomainToClass(domain, "my-event-uid");

    expect(result.uid).toBe("my-event-uid");
  });

  it("konvertiert variantName korrekt", () => {
    const meals: MealDomain[] = [
      {uid: "meal-1", mealDate: "2026-03-08", mealTypeId: "mt-1"},
    ];
    const menues: MenueDomain[] = [
      {uid: "menue-1", mealId: "meal-1", name: "M", sortOrder: 10},
    ];
    const menueRecipes: MenueRecipeDomain[] = [
      {
        uid: "mr-1",
        menueId: "menue-1",
        recipeId: "r-1",
        recipeName: "Grundrezept",
        deletedRecipeName: null,
        variantName: "Vegane Variante",
        totalPortions: 10,
        sortOrder: 10,
        plans: [],
      },
    ];
    const domain = buildDomain({
      mealTypes: [{uid: "mt-1", name: "X", sortOrder: 10}],
      meals,
      menues,
      menueRecipes,
    });

    const result = menuplanDomainToClass(domain, "event-1");

    expect(result.mealRecipes["mr-1"].recipe.variantName).toBe(
      "Vegane Variante"
    );
  });
});

// =====================================================================
// menuplanClassToDomain
// =====================================================================

describe("menuplanClassToDomain", () => {
  /**
   * Erzeugt einen Menuplan mit einer Meal, einem Menue und einem Rezept.
   */
  function buildMenuplan(): Menuplan {
    const mp = new Menuplan();
    mp.uid = "event-1";

    mp.mealTypes.order = ["mt-1", "mt-2"];
    mp.mealTypes.entries = {
      "mt-1": {uid: "mt-1", name: "Frühstück"},
      "mt-2": {uid: "mt-2", name: "Abendessen"},
    };

    mp.meals = {
      "meal-1": {
        uid: "meal-1",
        date: "2026-03-08",
        mealType: "mt-1",
        menuOrder: ["menue-1"],
      },
    };

    mp.menues = {
      "menue-1": {
        uid: "menue-1",
        name: "Hauptgang",
        mealRecipeOrder: ["mr-1"],
        productOrder: ["prod-1"],
        materialOrder: ["mat-1"],
      },
    };

    mp.mealRecipes = {
      "mr-1": {
        uid: "mr-1",
        recipe: {
          recipeUid: "recipe-42",
          name: "Kartoffelgratin",
          type: RecipeType.public,
          createdFromUid: "",
        },
        plan: [
          {
            diet: PlanedDiet.ALL,
            intolerance: PlanedIntolerances.ALL,
            factor: 1,
            totalPortions: 10,
          },
        ],
        totalPortions: 10,
      },
    };

    mp.products = {
      "prod-1": {
        uid: "prod-1",
        quantity: 500,
        unit: "g",
        productUid: "p-42",
        productName: "Mehl",
        planMode: GoodsPlanMode.TOTAL,
        plan: [],
        totalQuantity: 500,
      },
    };

    mp.materials = {
      "mat-1": {
        uid: "mat-1",
        quantity: 30,
        unit: "Stk",
        materialUid: "m-7",
        materialName: "Teller",
        planMode: GoodsPlanMode.PER_PORTION,
        plan: [],
        totalQuantity: 120,
      },
    };

    mp.notes = {
      "n-1": {
        uid: "n-1",
        date: "2026-03-08",
        menueUid: "menue-1",
        text: "Notiz hier",
      },
    };

    return mp;
  }

  it("konvertiert MealTypes mit korrekten sortOrder-Werten", () => {
    const mp = buildMenuplan();

    const domain = menuplanClassToDomain(mp, "event-1");

    expect(domain.mealTypes).toEqual([
      {uid: "mt-1", name: "Frühstück", sortOrder: 0},
      {uid: "mt-2", name: "Abendessen", sortOrder: 10},
    ]);
  });

  it("konvertiert Meals korrekt", () => {
    const mp = buildMenuplan();

    const domain = menuplanClassToDomain(mp, "event-1");

    expect(domain.meals).toHaveLength(1);
    expect(domain.meals[0]).toEqual({
      uid: "meal-1",
      mealDate: "2026-03-08",
      mealTypeId: "mt-1",
    });
  });

  it("konvertiert Menues mit mealId und sortOrder", () => {
    const mp = buildMenuplan();

    const domain = menuplanClassToDomain(mp, "event-1");

    expect(domain.menues).toHaveLength(1);
    expect(domain.menues[0]).toEqual({
      uid: "menue-1",
      mealId: "meal-1",
      name: "Hauptgang",
      sortOrder: 0,
    });
  });

  it("konvertiert Rezepte, Produkte und Materialien", () => {
    const mp = buildMenuplan();

    const domain = menuplanClassToDomain(mp, "event-1");

    // Rezept
    expect(domain.menueRecipes).toHaveLength(1);
    expect(domain.menueRecipes[0].uid).toBe("mr-1");
    expect(domain.menueRecipes[0].recipeId).toBe("recipe-42");
    expect(domain.menueRecipes[0].recipeName).toBe("Kartoffelgratin");
    expect(domain.menueRecipes[0].deletedRecipeName).toBeNull();
    expect(domain.menueRecipes[0].sortOrder).toBe(0);

    // Produkt
    expect(domain.menueProducts).toHaveLength(1);
    expect(domain.menueProducts[0].productId).toBe("p-42");
    expect(domain.menueProducts[0].planMode).toBe("total");

    // Material
    expect(domain.menueMaterials).toHaveLength(1);
    expect(domain.menueMaterials[0].materialId).toBe("m-7");
    expect(domain.menueMaterials[0].planMode).toBe("per_portion");
  });

  it("überspringt verwaiste Menüs (nicht in einer Meal.menuOrder)", () => {
    const mp = buildMenuplan();

    // Verwaistes Menü hinzufügen (nicht in meal-1.menuOrder)
    mp.menues["orphan-menue"] = {
      uid: "orphan-menue",
      name: "Verwaist",
      mealRecipeOrder: ["orphan-mr"],
      productOrder: ["orphan-prod"],
      materialOrder: ["orphan-mat"],
    };
    mp.mealRecipes["orphan-mr"] = {
      uid: "orphan-mr",
      recipe: {
        recipeUid: "r-99",
        name: "Geist-Rezept",
        type: RecipeType.public,
        createdFromUid: "",
      },
      plan: [],
      totalPortions: 5,
    };
    mp.products["orphan-prod"] = {
      uid: "orphan-prod",
      quantity: 1,
      unit: "kg",
      productUid: "p-99",
      productName: "Geist-Produkt",
      planMode: GoodsPlanMode.TOTAL,
      plan: [],
      totalQuantity: 1,
    };
    mp.materials["orphan-mat"] = {
      uid: "orphan-mat",
      quantity: 1,
      unit: "Stk",
      materialUid: "m-99",
      materialName: "Geist-Material",
      planMode: GoodsPlanMode.TOTAL,
      plan: [],
      totalQuantity: 1,
    };

    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});

    const domain = menuplanClassToDomain(mp, "event-1");

    // Verwaistes Menü wird übersprungen
    expect(domain.menues).toHaveLength(1);
    expect(domain.menues[0].uid).toBe("menue-1");

    // Rezepte/Produkte/Materialien des verwaisten Menüs werden ebenfalls übersprungen
    expect(domain.menueRecipes.map((r) => r.uid)).not.toContain("orphan-mr");
    expect(domain.menueProducts.map((p) => p.uid)).not.toContain("orphan-prod");
    expect(domain.menueMaterials.map((m) => m.uid)).not.toContain("orphan-mat");

    // Warnung wird geloggt
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("orphan-menue")
    );

    warnSpy.mockRestore();
  });

  it("konvertiert gelöschte Rezepte (Name beginnt mit MealRecipeDeletedPrefix)", () => {
    const mp = buildMenuplan();

    mp.mealRecipes["mr-1"].recipe.recipeUid = "";
    mp.mealRecipes["mr-1"].recipe.name =
      `${MealRecipeDeletedPrefix} Altes Rezept`;

    const domain = menuplanClassToDomain(mp, "event-1");

    const recipe = domain.menueRecipes[0];
    expect(recipe.recipeId).toBeNull();
    expect(recipe.recipeName).toBe("");
    expect(recipe.deletedRecipeName).toBe(
      `${MealRecipeDeletedPrefix} Altes Rezept`
    );
  });

  it("konvertiert Plan-Zeilen zurück: ALL, FIX und group-Scope", () => {
    const mp = buildMenuplan();

    mp.mealRecipes["mr-1"].plan = [
      {
        diet: PlanedDiet.ALL,
        intolerance: PlanedIntolerances.ALL,
        factor: 1,
        totalPortions: 10,
      },
      {
        diet: PlanedDiet.FIX,
        intolerance: PlanedIntolerances.FIX,
        factor: 2,
        totalPortions: 5,
      },
      {
        diet: "diet-vegan",
        intolerance: "intol-laktose",
        factor: 0.5,
        totalPortions: 3,
      },
    ];

    const domain = menuplanClassToDomain(mp, "event-1");
    const plans = domain.menueRecipes[0].plans;

    expect(plans).toHaveLength(3);

    // ALL
    expect(plans[0].dietScope).toBe("ALL");
    expect(plans[0].dietId).toBeNull();
    expect(plans[0].intoleranceScope).toBe("ALL");
    expect(plans[0].intoleranceId).toBeNull();
    expect(plans[0].factor).toBe(1);
    expect(plans[0].servings).toBe(10);

    // FIX
    expect(plans[1].dietScope).toBe("FIX");
    expect(plans[1].dietId).toBeNull();
    expect(plans[1].intoleranceScope).toBe("FIX");
    expect(plans[1].intoleranceId).toBeNull();

    // group
    expect(plans[2].dietScope).toBe("group");
    expect(plans[2].dietId).toBe("diet-vegan");
    expect(plans[2].intoleranceScope).toBe("group");
    expect(plans[2].intoleranceId).toBe("intol-laktose");
    expect(plans[2].factor).toBe(0.5);
    expect(plans[2].servings).toBe(3);
  });

  it("konvertiert Notizen mit optionalem menueId", () => {
    const mp = buildMenuplan();
    mp.notes["n-2"] = {
      uid: "n-2",
      date: "2026-03-09",
      menueUid: "",
      text: "Allgemeine Notiz",
    };

    const domain = menuplanClassToDomain(mp, "event-1");
    const noteWithMenue = domain.notes.find((n) => n.uid === "n-1")!;
    const noteWithoutMenue = domain.notes.find((n) => n.uid === "n-2")!;

    expect(noteWithMenue.menueId).toBe("menue-1");
    expect(noteWithoutMenue.menueId).toBeNull();
  });

  it("setzt eventId korrekt", () => {
    const mp = new Menuplan();

    const domain = menuplanClassToDomain(mp, "event-xyz");

    expect(domain.eventId).toBe("event-xyz");
  });
});

// =====================================================================
// Round-Trip
// =====================================================================

describe("Round-Trip: domainToClass → classToDomain", () => {
  it("bewahrt wesentliche Daten (UIDs, Namen, Sortierungen)", () => {
    const originalDomain: MenuplanDomain = {
      eventId: "event-rt",
      mealTypes: [
        {uid: "mt-1", name: "Frühstück", sortOrder: 0},
        {uid: "mt-2", name: "Mittagessen", sortOrder: 10},
      ],
      meals: [
        {uid: "meal-1", mealDate: "2026-03-08", mealTypeId: "mt-1"},
        {uid: "meal-2", mealDate: "2026-03-08", mealTypeId: "mt-2"},
      ],
      menues: [
        {uid: "menue-1", mealId: "meal-1", name: "Gang A", sortOrder: 0},
        {uid: "menue-2", mealId: "meal-1", name: "Gang B", sortOrder: 10},
        {uid: "menue-3", mealId: "meal-2", name: "Gang C", sortOrder: 0},
      ],
      menueRecipes: [
        {
          uid: "mr-1",
          menueId: "menue-1",
          recipeId: "recipe-1",
          recipeName: "Birchermüesli",
          deletedRecipeName: null,
          variantName: null,
          totalPortions: 20,
          sortOrder: 0,
          plans: [
            {
              uid: "plan-1",
              dietScope: "ALL",
              dietId: null,
              intoleranceScope: "group",
              intoleranceId: "intol-gluten",
              factor: 1,
              servings: 20,
            },
          ],
        },
        {
          uid: "mr-2",
          menueId: "menue-1",
          recipeId: "recipe-2",
          recipeName: "Orangensaft",
          deletedRecipeName: null,
          variantName: "Ohne Zucker",
          totalPortions: 20,
          sortOrder: 10,
          plans: [],
        },
      ],
      menueProducts: [
        {
          uid: "prod-1",
          menueId: "menue-1",
          productId: "p-1",
          productName: "Butter",
          quantity: 250,
          unit: "g",
          planMode: "total",
          totalQuantity: 250,
          sortOrder: 0,
          plans: [
            {
              uid: "pp-1",
              dietScope: "FIX",
              dietId: null,
              intoleranceScope: "FIX",
              intoleranceId: null,
              factor: 1,
              servings: 250,
            },
          ],
        },
      ],
      menueMaterials: [
        {
          uid: "mat-1",
          menueId: "menue-3",
          materialId: "m-1",
          materialName: "Serviette",
          quantity: 40,
          unit: null,
          planMode: "per_portion",
          totalQuantity: 160,
          sortOrder: 0,
          plans: [],
        },
      ],
      notes: [
        {uid: "note-1", menueId: "menue-1", noteDate: "2026-03-08", text: "Tipp"},
      ],
    };

    // Hin und zurück
    const classInstance = menuplanDomainToClass(originalDomain, "event-rt");
    const roundTripped = menuplanClassToDomain(classInstance, "event-rt");

    // eventId
    expect(roundTripped.eventId).toBe(originalDomain.eventId);

    // MealTypes: gleiche UIDs und Namen in gleicher Reihenfolge
    expect(roundTripped.mealTypes.map((mt) => mt.uid)).toEqual(
      originalDomain.mealTypes.map((mt) => mt.uid)
    );
    expect(roundTripped.mealTypes.map((mt) => mt.name)).toEqual(
      originalDomain.mealTypes.map((mt) => mt.name)
    );

    // Meals: gleiche UIDs (Reihenfolge kann abweichen)
    const originalMealUids = originalDomain.meals.map((m) => m.uid).sort();
    const rtMealUids = roundTripped.meals.map((m) => m.uid).sort();
    expect(rtMealUids).toEqual(originalMealUids);

    // Menues: gleiche UIDs und Namen
    const originalMenueUids = originalDomain.menues.map((m) => m.uid).sort();
    const rtMenueUids = roundTripped.menues.map((m) => m.uid).sort();
    expect(rtMenueUids).toEqual(originalMenueUids);

    // Rezepte: UIDs und Namen erhalten
    const originalRecipeUids = originalDomain.menueRecipes
      .map((r) => r.uid)
      .sort();
    const rtRecipeUids = roundTripped.menueRecipes.map((r) => r.uid).sort();
    expect(rtRecipeUids).toEqual(originalRecipeUids);

    const rtMr1 = roundTripped.menueRecipes.find((r) => r.uid === "mr-1")!;
    expect(rtMr1.recipeId).toBe("recipe-1");
    expect(rtMr1.recipeName).toBe("Birchermüesli");
    expect(rtMr1.totalPortions).toBe(20);
    expect(rtMr1.plans).toHaveLength(1);
    expect(rtMr1.plans[0].dietScope).toBe("ALL");
    expect(rtMr1.plans[0].intoleranceScope).toBe("group");
    expect(rtMr1.plans[0].intoleranceId).toBe("intol-gluten");

    const rtMr2 = roundTripped.menueRecipes.find((r) => r.uid === "mr-2")!;
    expect(rtMr2.variantName).toBe("Ohne Zucker");

    // Produkte
    expect(roundTripped.menueProducts).toHaveLength(1);
    expect(roundTripped.menueProducts[0].productId).toBe("p-1");
    expect(roundTripped.menueProducts[0].planMode).toBe("total");
    expect(roundTripped.menueProducts[0].plans).toHaveLength(1);

    // Materialien
    expect(roundTripped.menueMaterials).toHaveLength(1);
    expect(roundTripped.menueMaterials[0].materialId).toBe("m-1");
    expect(roundTripped.menueMaterials[0].planMode).toBe("per_portion");
    expect(roundTripped.menueMaterials[0].unit).toBeNull();

    // Notizen
    expect(roundTripped.notes).toHaveLength(1);
    expect(roundTripped.notes[0].text).toBe("Tipp");
    expect(roundTripped.notes[0].menueId).toBe("menue-1");
  });
});
