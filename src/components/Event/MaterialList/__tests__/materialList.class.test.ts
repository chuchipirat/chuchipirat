/**
 * Unit-Tests für MaterialList (Domain-Klasse).
 *
 * Testet die statischen Methoden: createNewList, refreshList,
 * deleteList, editListName, addMaterialToList, deleteMaterialFromList,
 * computeTrace, countItems.
 */
import MaterialList, {
  MaterialListEntry,
  MaterialListMaterial,
} from "../materialList.class";
import {MaterialType} from "../../../Material/material.class";
import Material from "../../../Material/material.class";
import {ItemType} from "../../ShoppingList/shoppingList.class";
import {
  MenuplanData,
  MealRecipe,
  GoodsPlanMode,
} from "../../Menuplan/menuplan.types";
import {RecipeMaterialPosition} from "../../../Recipe/recipe.class";
import Recipe from "../../../Recipe/recipe.class";

/* =====================================================================
// Mocks
// ===================================================================== */

jest.mock("@sentry/react", () => ({
  captureException: jest.fn(),
  addBreadcrumb: jest.fn(),
}));

// UsedRecipes.defineSelectedRecipes mocken
jest.mock("../../UsedRecipes/usedRecipes.class", () => ({
  __esModule: true,
  default: {
    defineSelectedRecipes: jest.fn(),
  },
}));

// Recipe.scaleMaterials mocken
jest.mock("../../../Recipe/recipe.class", () => {
  // Originale Typen beibehalten
  const actual = jest.requireActual("../../../Recipe/recipe.class");
  return {
    ...actual,
    __esModule: true,
    default: {
      ...actual.default,
      scaleMaterials: jest.fn(),
    },
  };
});

// getMealsOfMenues und getMenuesOfMeals mocken
jest.mock("../../Menuplan/menuplanService", () => ({
  getMealsOfMenues: jest.fn(),
  getMenuesOfMeals: jest.fn(),
}));

// Utils.generateUid deterministisch machen
jest.mock("../../../Shared/utils.class", () => {
  const actual = jest.requireActual("../../../Shared/utils.class");
  return {
    ...actual,
    __esModule: true,
    default: {
      ...actual.default,
      generateUid: jest.fn().mockReturnValue("gen-uid"),
      areStringArraysEqual: actual.default?.areStringArraysEqual ??
        jest.fn((a: string[], b: string[]) => {
          if (a?.length !== b?.length) return false;
          const sortedA = [...a].sort();
          const sortedB = [...b].sort();
          return sortedA.every((v: string, i: number) => v === sortedB[i]);
        }),
    },
  };
});

import {UsedRecipes} from "../../UsedRecipes/usedRecipes.class";
import {getMealsOfMenues, getMenuesOfMeals} from "../../Menuplan/menuplanService";

const mockedDefineSelectedRecipes = UsedRecipes.defineSelectedRecipes as jest.Mock;
const mockedScaleMaterials = Recipe.scaleMaterials as jest.Mock;
const mockedGetMealsOfMenues = getMealsOfMenues as jest.Mock;
const mockedGetMenuesOfMeals = getMenuesOfMeals as jest.Mock;

/* =====================================================================
// Test-Hilfsdaten
// ===================================================================== */

const createMaterial = (
  uid: string,
  name: string,
  type: MaterialType = MaterialType.usage,
): Material => {
  const m = new Material();
  m.uid = uid;
  m.name = name;
  m.type = type;
  m.usable = true;
  return m;
};

const matPfanne = createMaterial("mat-pfanne", "Pfanne gross");
const matSchuessel = createMaterial("mat-schuessel", "Schüssel");
const matConsumable = createMaterial(
  "mat-consumable",
  "Einweghandschuhe",
  MaterialType.consumable,
);

const allMaterials = [matPfanne, matSchuessel, matConsumable];

/**
 * Minimale MenuplanData-Fixture erstellen.
 */
function createMinimalMenuplan(): MenuplanData {
  const mealRecipe1: MealRecipe = {
    uid: "mr-001",
    recipe: {
      recipeUid: "recipe-001",
      name: "Pasta",
      type: 0,
      createdFromUid: "",
    },
    plan: [],
    totalPortions: 10,
  };

  return {
    uid: "event-001",
    dates: [new Date("2026-03-15")],
    mealTypes: {entries: {mt1: {uid: "mt1", name: "Abendessen"}}, order: ["mt1"]},
    meals: {
      "meal-001": {
        uid: "meal-001",
        date: "2026-03-15",
        mealType: "mt1",
        menuOrder: ["menue-001"],
      },
    },
    menues: {
      "menue-001": {
        uid: "menue-001",
        name: "Menü 1",
        mealRecipeOrder: ["mr-001"],
        materialOrder: ["mm-001"],
        productOrder: [],
      },
    },
    notes: {},
    mealRecipes: {"mr-001": mealRecipe1},
    materials: {
      "mm-001": {
        uid: "mm-001",
        quantity: 1,
        unit: "",
        materialUid: "mat-schuessel",
        materialName: "Schüssel",
        planMode: GoodsPlanMode.TOTAL,
        plan: [],
        totalQuantity: 3,
      },
    },
    products: {},
    created: {date: new Date(), fromUid: "", fromDisplayName: ""},
    lastChange: {date: new Date(), fromUid: "", fromDisplayName: ""},
  };
}

/* =====================================================================
// Tests
// ===================================================================== */

describe("MaterialList (Domain-Klasse)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  /* =====================================================================
  // createNewList
  // ===================================================================== */
  describe("createNewList", () => {
    it("should generate items from menuplan recipes using Math.max aggregation", () => {
      const menueplan = createMinimalMenuplan();

      mockedGetMealsOfMenues.mockReturnValue(["meal-001"]);
      mockedDefineSelectedRecipes.mockReturnValue([
        {uid: "recipe-001", name: "Pasta"},
      ]);

      // scaleMaterials liefert Pfanne mit Menge 5
      const scaledMaterials: Record<string, RecipeMaterialPosition> = {
        "mat-pfanne": {
          uid: "mat-pfanne",
          quantity: 5,
          material: {uid: "mat-pfanne", name: "Pfanne gross"},
        },
      };
      mockedScaleMaterials.mockReturnValue(scaledMaterials);

      const result = MaterialList.createNewList({
        name: "Testliste",
        selectedMenues: ["menue-001"],
        menueplan,
        materials: allMaterials,
        recipes: {
          "recipe-001": {
            uid: "recipe-001",
            name: "Pasta",
            portions: 4,
            materials: {entries: {}, order: []},
          } as any,
        },
      });

      expect(result.properties.name).toBe("Testliste");
      expect(result.properties.selectedMenues).toEqual(["menue-001"]);
      // Items enthalten Pfanne (aus Rezept) und Schüssel (aus Menü-Material)
      const itemNames = result.items.map((item) => item.name);
      expect(itemNames).toContain("Pfanne gross");
      expect(itemNames).toContain("Schüssel");
    });

    it("should use Math.max for quantity aggregation (not sum)", () => {
      const menueplan = createMinimalMenuplan();
      // Zweites Rezept im selben Menü hinzufügen
      menueplan.mealRecipes["mr-002"] = {
        uid: "mr-002",
        recipe: {
          recipeUid: "recipe-002",
          name: "Suppe",
          type: 0,
          createdFromUid: "",
        },
        plan: [],
        totalPortions: 8,
      };
      menueplan.menues["menue-001"].mealRecipeOrder.push("mr-002");

      mockedGetMealsOfMenues.mockReturnValue(["meal-001"]);
      mockedDefineSelectedRecipes.mockReturnValue([
        {uid: "recipe-001"},
        {uid: "recipe-002"},
      ]);

      // Beide Rezepte brauchen Pfanne, aber unterschiedliche Mengen
      mockedScaleMaterials
        .mockReturnValueOnce({
          "mat-pfanne": {
            uid: "mat-pfanne",
            quantity: 5,
            material: {uid: "mat-pfanne", name: "Pfanne gross"},
          },
        })
        .mockReturnValueOnce({
          "mat-pfanne": {
            uid: "mat-pfanne",
            quantity: 8,
            material: {uid: "mat-pfanne", name: "Pfanne gross"},
          },
        });

      const result = MaterialList.createNewList({
        name: "Test",
        selectedMenues: ["menue-001"],
        menueplan,
        materials: allMaterials,
        recipes: {
          "recipe-001": {uid: "recipe-001", name: "Pasta", portions: 4, materials: {entries: {}, order: []}} as any,
          "recipe-002": {uid: "recipe-002", name: "Suppe", portions: 4, materials: {entries: {}, order: []}} as any,
        },
      });

      const pfanne = result.items.find((item) => item.uid === "mat-pfanne");
      // Math.max(5, 8) = 8, nicht 13
      expect(pfanne?.quantity).toBe(8);
    });

    it("should filter only MaterialType.usage items", () => {
      const menueplan = createMinimalMenuplan();

      mockedGetMealsOfMenues.mockReturnValue(["meal-001"]);
      mockedDefineSelectedRecipes.mockReturnValue([{uid: "recipe-001"}]);

      // scaleMaterials liefert consumable Material
      mockedScaleMaterials.mockReturnValue({
        "mat-consumable": {
          uid: "mat-consumable",
          quantity: 5,
          material: {uid: "mat-consumable", name: "Einweghandschuhe"},
        },
      });

      const result = MaterialList.createNewList({
        name: "Test",
        selectedMenues: ["menue-001"],
        menueplan,
        materials: allMaterials,
        recipes: {
          "recipe-001": {uid: "recipe-001", name: "Pasta", portions: 4, materials: {entries: {}, order: []}} as any,
        },
      });

      // Consumable-Material sollte nicht in der Liste sein
      const consumable = result.items.find(
        (item) => item.uid === "mat-consumable",
      );
      expect(consumable).toBeUndefined();
    });

    it("should throw on empty recipe list", () => {
      const menueplan = createMinimalMenuplan();

      mockedGetMealsOfMenues.mockReturnValue(["meal-001"]);
      mockedDefineSelectedRecipes.mockReturnValue([]);

      expect(() =>
        MaterialList.createNewList({
          name: "Test",
          selectedMenues: ["menue-001"],
          menueplan,
          materials: allMaterials,
          recipes: {},
        }),
      ).toThrow("Die Auswahl beinhaltet keine Rezepte.");
    });
  });

  /* =====================================================================
  // refreshList
  // ===================================================================== */
  describe("refreshList", () => {
    it("should detect drift when selectedMeals mismatch and recompute menues", () => {
      const menueplan = createMinimalMenuplan();
      const materialList = new MaterialList();
      materialList.uid = "event-001";
      materialList.lists["list-001"] = {
        properties: {
          uid: "list-001",
          name: "Samstag",
          selectedMeals: ["meal-001"],
          selectedMenues: ["menue-OLD"],
          generated: {date: new Date(), fromUid: "", fromDisplayName: ""},
        },
        items: [],
      };

      // getMealsOfMenues mit altem Menü liefert andere Meals -> Drift
      mockedGetMealsOfMenues.mockReturnValue(["meal-OTHER"]);
      // getMenuesOfMeals liefert das korrekte Menü für die bestehenden Meals
      mockedGetMenuesOfMeals.mockReturnValue(["menue-001"]);

      mockedDefineSelectedRecipes.mockReturnValue([{uid: "recipe-001"}]);
      mockedScaleMaterials.mockReturnValue({
        "mat-pfanne": {
          uid: "mat-pfanne",
          quantity: 3,
          material: {uid: "mat-pfanne", name: "Pfanne gross"},
        },
      });

      const result = MaterialList.refreshList({
        listUidToRefresh: "list-001",
        materialList,
        menueplan,
        materials: allMaterials,
        recipes: {
          "recipe-001": {uid: "recipe-001", name: "Pasta", portions: 4, materials: {entries: {}, order: []}} as any,
        },
      });

      // Menü wurde auf Basis der existierenden Meals korrigiert
      expect(result.lists["list-001"].properties.selectedMenues).toEqual([
        "menue-001",
      ]);
    });

    it("should preserve uid after refresh", () => {
      const menueplan = createMinimalMenuplan();
      const materialList = new MaterialList();
      materialList.uid = "event-001";
      materialList.lists["list-001"] = {
        properties: {
          uid: "list-001",
          name: "Samstag",
          selectedMeals: ["meal-001"],
          selectedMenues: ["menue-001"],
          generated: {date: new Date(), fromUid: "", fromDisplayName: ""},
        },
        items: [],
      };

      mockedGetMealsOfMenues.mockReturnValue(["meal-001"]);
      mockedGetMenuesOfMeals.mockReturnValue(["menue-001"]);
      mockedDefineSelectedRecipes.mockReturnValue([{uid: "recipe-001"}]);
      mockedScaleMaterials.mockReturnValue({});

      const result = MaterialList.refreshList({
        listUidToRefresh: "list-001",
        materialList,
        menueplan,
        materials: allMaterials,
        recipes: {
          "recipe-001": {uid: "recipe-001", name: "Pasta", portions: 4, materials: {entries: {}, order: []}} as any,
        },
      });

      expect(result.lists["list-001"].properties.uid).toBe("list-001");
    });

    it("should keep manually added items when keepManuallyAddedItems is true", () => {
      const menueplan = createMinimalMenuplan();
      const manualItem: MaterialListMaterial = {
        checked: false,
        name: "Manuell hinzugefügt",
        uid: "manual-001",
        type: MaterialType.usage,
        quantity: 1,
        trace: [],
        manualAdd: true,
      };

      const materialList = new MaterialList();
      materialList.uid = "event-001";
      materialList.lists["list-001"] = {
        properties: {
          uid: "list-001",
          name: "Samstag",
          selectedMeals: ["meal-001"],
          selectedMenues: ["menue-001"],
          generated: {date: new Date(), fromUid: "", fromDisplayName: ""},
        },
        items: [manualItem],
      };

      mockedGetMealsOfMenues.mockReturnValue(["meal-001"]);
      mockedGetMenuesOfMeals.mockReturnValue(["menue-001"]);
      mockedDefineSelectedRecipes.mockReturnValue([{uid: "recipe-001"}]);
      mockedScaleMaterials.mockReturnValue({
        "mat-pfanne": {
          uid: "mat-pfanne",
          quantity: 3,
          material: {uid: "mat-pfanne", name: "Pfanne gross"},
        },
      });

      const result = MaterialList.refreshList({
        listUidToRefresh: "list-001",
        materialList,
        keepManuallyAddedItems: true,
        menueplan,
        materials: allMaterials,
        recipes: {
          "recipe-001": {uid: "recipe-001", name: "Pasta", portions: 4, materials: {entries: {}, order: []}} as any,
        },
      });

      const itemNames = result.lists["list-001"].items.map((i) => i.name);
      expect(itemNames).toContain("Manuell hinzugefügt");
    });
  });

  /* =====================================================================
  // deleteList
  // ===================================================================== */
  describe("deleteList", () => {
    it("should remove list from deep copy without mutating original", () => {
      const materialList = new MaterialList();
      materialList.lists["list-001"] = {
        properties: {
          uid: "list-001",
          name: "Test",
          selectedMeals: [],
          selectedMenues: [],
          generated: {date: new Date(), fromUid: "", fromDisplayName: ""},
        },
        items: [],
      };
      materialList.lists["list-002"] = {
        properties: {
          uid: "list-002",
          name: "Andere",
          selectedMeals: [],
          selectedMenues: [],
          generated: {date: new Date(), fromUid: "", fromDisplayName: ""},
        },
        items: [],
      };

      const result = MaterialList.deleteList({
        materialList,
        listUidToDelete: "list-001",
      });

      expect(Object.keys(result.lists)).toEqual(["list-002"]);
      // Original bleibt unverändert
      expect(Object.keys(materialList.lists)).toEqual([
        "list-001",
        "list-002",
      ]);
    });
  });

  /* =====================================================================
  // editListName
  // ===================================================================== */
  describe("editListName", () => {
    it("should change name in deep copy without mutating original", () => {
      const materialList = new MaterialList();
      materialList.lists["list-001"] = {
        properties: {
          uid: "list-001",
          name: "Alt",
          selectedMeals: [],
          selectedMenues: [],
          generated: {date: new Date(), fromUid: "", fromDisplayName: ""},
        },
        items: [],
      };

      const result = MaterialList.editListName({
        materialList,
        listUidToEdit: "list-001",
        newName: "Neu",
      });

      expect(result.lists["list-001"].properties.name).toBe("Neu");
      // Original bleibt unverändert
      expect(materialList.lists["list-001"].properties.name).toBe("Alt");
    });
  });

  /* =====================================================================
  // addMaterialToList
  // ===================================================================== */
  describe("addMaterialToList", () => {
    it("should add a new material to an empty list", () => {
      const result = MaterialList.addMaterialToList({
        material: matPfanne,
        list: [],
        quantity: 5,
        recipeUid: "r-001",
        recipeName: "Pasta",
        menueUid: "menue-001",
      });

      expect(result).toHaveLength(1);
      expect(result[0].uid).toBe("mat-pfanne");
      expect(result[0].name).toBe("Pfanne gross");
      expect(result[0].quantity).toBe(5);
      expect(result[0].trace).toHaveLength(1);
      expect(result[0].trace[0].itemType).toBe(ItemType.material);
    });

    it("should merge existing material using Math.max (not sum)", () => {
      const existingList: MaterialListMaterial[] = [
        {
          checked: false,
          name: "Pfanne gross",
          uid: "mat-pfanne",
          type: MaterialType.usage,
          quantity: 5,
          trace: [
            {
              menueUid: "menue-001",
              recipe: {uid: "r-001", name: "Pasta"},
              planedPortions: 10,
              quantity: 5,
              unit: "",
              manualAdd: false,
              itemType: ItemType.material,
            },
          ],
        },
      ];

      const result = MaterialList.addMaterialToList({
        material: matPfanne,
        list: existingList,
        quantity: 3,
        recipeUid: "r-002",
        recipeName: "Suppe",
        menueUid: "menue-001",
      });

      // Math.max(5, 3) = 5
      expect(result[0].quantity).toBe(5);
      expect(result[0].trace).toHaveLength(2);
    });

    it("should create trace entries for each add", () => {
      const result = MaterialList.addMaterialToList({
        material: matPfanne,
        list: [],
        quantity: 5,
        planedPortions: 10,
        recipeUid: "r-001",
        recipeName: "Pasta",
        menueUid: "menue-001",
      });

      expect(result[0].trace[0]).toEqual({
        menueUid: "menue-001",
        recipe: {uid: "r-001", name: "Pasta"},
        planedPortions: 10,
        quantity: 5,
        unit: "",
        manualAdd: false,
        itemType: ItemType.material,
      });
    });
  });

  /* =====================================================================
  // deleteMaterialFromList
  // ===================================================================== */
  describe("deleteMaterialFromList", () => {
    it("should filter out material by uid", () => {
      const list: MaterialListMaterial[] = [
        {
          checked: false,
          name: "Pfanne gross",
          uid: "mat-pfanne",
          type: MaterialType.usage,
          quantity: 5,
          trace: [],
        },
        {
          checked: false,
          name: "Schüssel",
          uid: "mat-schuessel",
          type: MaterialType.usage,
          quantity: 3,
          trace: [],
        },
      ];

      const result = MaterialList.deleteMaterialFromList({
        materialUid: "mat-pfanne",
        list,
      });

      expect(result).toHaveLength(1);
      expect(result[0].uid).toBe("mat-schuessel");
    });

    it("should return empty array when deleting the only item", () => {
      const list: MaterialListMaterial[] = [
        {
          checked: false,
          name: "Pfanne gross",
          uid: "mat-pfanne",
          type: MaterialType.usage,
          quantity: 5,
          trace: [],
        },
      ];

      const result = MaterialList.deleteMaterialFromList({
        materialUid: "mat-pfanne",
        list,
      });

      expect(result).toHaveLength(0);
    });
  });

  /* =====================================================================
  // computeTrace
  // ===================================================================== */
  describe("computeTrace", () => {
    it("should find recipe materials matching materialUid", () => {
      const menueplan = createMinimalMenuplan();

      mockedScaleMaterials.mockReturnValue({
        "mat-pfanne": {
          uid: "mat-pfanne",
          quantity: 5,
          material: {uid: "mat-pfanne", name: "Pfanne gross"},
        },
      });

      const traces = MaterialList.computeTrace({
        materialUid: "mat-pfanne",
        selectedMenues: ["menue-001"],
        menueplan,
        materials: allMaterials,
        recipes: {
          "recipe-001": {uid: "recipe-001", name: "Pasta", portions: 4, materials: {entries: {}, order: []}} as any,
        },
      });

      expect(traces).toHaveLength(1);
      expect(traces[0].recipe.uid).toBe("recipe-001");
      expect(traces[0].quantity).toBe(5);
      expect(traces[0].itemType).toBe(ItemType.material);
    });

    it("should include direct menue materials", () => {
      const menueplan = createMinimalMenuplan();

      // Kein Rezept-Match
      mockedScaleMaterials.mockReturnValue({});

      const traces = MaterialList.computeTrace({
        materialUid: "mat-schuessel",
        selectedMenues: ["menue-001"],
        menueplan,
        materials: allMaterials,
        recipes: {
          "recipe-001": {uid: "recipe-001", name: "Pasta", portions: 4, materials: {entries: {}, order: []}} as any,
        },
      });

      // Schüssel ist als Menü-Material (mm-001) referenziert
      expect(traces.length).toBeGreaterThanOrEqual(1);
      const menuTrace = traces.find((t) => t.recipe.uid === "");
      expect(menuTrace).toBeDefined();
      expect(menuTrace?.quantity).toBe(3);
    });
  });

  /* =====================================================================
  // countItems
  // ===================================================================== */
  describe("countItems", () => {
    it("should sum items across all lists", () => {
      const materialList = new MaterialList();
      materialList.lists["list-001"] = {
        properties: {
          uid: "list-001",
          name: "A",
          selectedMeals: [],
          selectedMenues: [],
          generated: {date: new Date(), fromUid: "", fromDisplayName: ""},
        },
        items: [
          {checked: false, name: "X", uid: "1", type: MaterialType.usage, quantity: 1, trace: []},
          {checked: false, name: "Y", uid: "2", type: MaterialType.usage, quantity: 2, trace: []},
        ],
      };
      materialList.lists["list-002"] = {
        properties: {
          uid: "list-002",
          name: "B",
          selectedMeals: [],
          selectedMenues: [],
          generated: {date: new Date(), fromUid: "", fromDisplayName: ""},
        },
        items: [
          {checked: false, name: "Z", uid: "3", type: MaterialType.usage, quantity: 3, trace: []},
        ],
      };

      expect(MaterialList.countItems(materialList)).toBe(3);
    });

    it("should return 0 for empty material list", () => {
      const materialList = new MaterialList();
      expect(MaterialList.countItems(materialList)).toBe(0);
    });
  });
});
