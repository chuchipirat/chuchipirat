/**
 * Unit-Tests für UsedRecipes (Domain-Klasse).
 *
 * Testet die statischen Business-Logic-Methoden:
 * - factory() erstellt leere Instanz
 * - createNewListProperties() validiert und erstellt Listeneigenschaften
 * - defineSelectedRecipes() leitet Rezept-UIDs aus dem Menüplan ab
 * - _getUniqRecipes() entfernt Duplikate
 */
import UsedRecipes from "../usedRecipes.class";
import {MenuplanData, MealRecipeDeletedPrefix} from "../../Menuplan/menuplan.types";
import {RecipeType} from "../../../Recipe/recipe.class";
import {UsedRecipeListDomain} from "../../../Database/Repository/UsedRecipeListRepository";

/* =====================================================================
// Test-Daten
// ===================================================================== */

/**
 * Erzeugt eine minimale MenuplanData-Struktur für Tests.
 * Enthält 2 Menüs mit je 1 Rezept, plus ein gelöschtes Rezept.
 */
const createTestMenuplan = (): MenuplanData => {
  return {
    uid: "event-001",
    dates: [new Date("2026-03-15"), new Date("2026-03-16")],
    mealTypes: {entries: {}, order: []},
    meals: {
      "meal-001": {
        uid: "meal-001",
        mealDate: new Date("2026-03-15"),
        menuOrder: ["menue-001"],
      },
      "meal-002": {
        uid: "meal-002",
        mealDate: new Date("2026-03-16"),
        menuOrder: ["menue-002"],
      },
      "meal-003": {
        uid: "meal-003",
        mealDate: new Date("2026-03-15"),
        menuOrder: ["menue-empty"],
      },
    } as any,
    menues: {
      "menue-001": {
        uid: "menue-001",
        name: "Menü 1",
        mealRecipeOrder: ["mr-001", "mr-deleted"],
        materialOrder: [],
        productOrder: [],
      },
      "menue-002": {
        uid: "menue-002",
        name: "Menü 2",
        mealRecipeOrder: ["mr-002"],
        materialOrder: [],
        productOrder: [],
      },
      "menue-empty": {
        uid: "menue-empty",
        name: "Leeres Menü",
        mealRecipeOrder: [],
        materialOrder: [],
        productOrder: [],
      },
    },
    notes: {},
    mealRecipes: {
      "mr-001": {
        uid: "mr-001",
        recipe: {
          recipeUid: "recipe-001",
          name: "Pasta Carbonara",
          type: RecipeType.public,
          createdFromUid: "",
        },
        plan: [],
        totalPortions: 4,
      },
      "mr-002": {
        uid: "mr-002",
        recipe: {
          recipeUid: "recipe-002",
          name: "Risotto",
          type: RecipeType.public,
          createdFromUid: "",
        },
        plan: [],
        totalPortions: 6,
      },
      "mr-deleted": {
        uid: "mr-deleted",
        recipe: {
          recipeUid: `${MealRecipeDeletedPrefix} Altes Rezept`,
          name: "Altes Rezept",
          type: RecipeType.public,
          createdFromUid: "",
        },
        plan: [],
        totalPortions: 0,
      },
    },
    materials: {},
    products: {},
    created: {date: new Date(), fromUid: "", fromDisplayName: ""},
    lastChange: {date: new Date(), fromUid: "", fromDisplayName: ""},
  } as unknown as MenuplanData;
};

/* =====================================================================
// Tests
// ===================================================================== */

describe("UsedRecipes", () => {
  /* =====================================================================
  // factory
  // ===================================================================== */
  describe("factory", () => {
    it("should create an empty UsedRecipes instance with the event UID", () => {
      const event = {uid: "event-001"} as any;
      const result = UsedRecipes.factory({event});

      expect(result).toBeInstanceOf(UsedRecipes);
      expect(result.uid).toBe("event-001");
      expect(result.noOfLists).toBe(0);
      expect(result.lists).toEqual({});
    });
  });

  /* =====================================================================
  // createNewListProperties
  // ===================================================================== */
  describe("createNewListProperties", () => {
    it("should return list properties when recipes are found", () => {
      const menueplan = createTestMenuplan();

      const result = UsedRecipes.createNewListProperties({
        name: "Samstagsrezepte",
        selectedMenues: ["menue-001"],
        menueplan,
      });

      expect(result.name).toBe("Samstagsrezepte");
      expect(result.selectedMenues).toEqual(["menue-001"]);
    });

    it("should throw when no recipes are found in selected menues", () => {
      const menueplan = createTestMenuplan();

      expect(() =>
        UsedRecipes.createNewListProperties({
          name: "Leere Liste",
          selectedMenues: ["menue-empty"],
          menueplan,
        }),
      ).toThrow();
    });
  });

  /* =====================================================================
  // defineSelectedRecipes
  // ===================================================================== */
  describe("defineSelectedRecipes", () => {
    it("should return recipe identifiers from selected menues", () => {
      const menueplan = createTestMenuplan();

      const result = UsedRecipes.defineSelectedRecipes({
        menueplan,
        selectedMenues: ["menue-001"],
      });

      // Nur recipe-001 (mr-deleted hat MealRecipeDeletedPrefix)
      expect(result).toHaveLength(1);
      expect(result[0].uid).toBe("recipe-001");
    });

    it("should return recipes from multiple menues", () => {
      const menueplan = createTestMenuplan();

      const result = UsedRecipes.defineSelectedRecipes({
        menueplan,
        selectedMenues: ["menue-001", "menue-002"],
      });

      expect(result).toHaveLength(2);
      expect(result.map((r) => r.uid)).toContain("recipe-001");
      expect(result.map((r) => r.uid)).toContain("recipe-002");
    });

    it("should exclude deleted recipes", () => {
      const menueplan = createTestMenuplan();

      const result = UsedRecipes.defineSelectedRecipes({
        menueplan,
        selectedMenues: ["menue-001"],
      });

      const deletedRecipe = result.find((r) =>
        r.uid.includes(MealRecipeDeletedPrefix),
      );
      expect(deletedRecipe).toBeUndefined();
    });

    it("should return empty array for empty menue", () => {
      const menueplan = createTestMenuplan();

      const result = UsedRecipes.defineSelectedRecipes({
        menueplan,
        selectedMenues: ["menue-empty"],
      });

      expect(result).toEqual([]);
    });

    it("should deduplicate recipes appearing in multiple menues", () => {
      const menueplan = createTestMenuplan();
      // Füge dasselbe Rezept in Menü 2 hinzu
      menueplan.menues["menue-002"].mealRecipeOrder.push("mr-001-dup");
      (menueplan.mealRecipes as any)["mr-001-dup"] = {
        uid: "mr-001-dup",
        recipe: {
          recipeUid: "recipe-001", // Gleiche Recipe-UID wie in menue-001
          name: "Pasta Carbonara",
          type: RecipeType.public,
          createdFromUid: "",
        },
        plan: [],
        totalPortions: 4,
      };

      const result = UsedRecipes.defineSelectedRecipes({
        menueplan,
        selectedMenues: ["menue-001", "menue-002"],
      });

      const pastaCount = result.filter((r) => r.uid === "recipe-001").length;
      expect(pastaCount).toBe(1);
    });
  });

  /* =====================================================================
  // deleteList
  // ===================================================================== */
  describe("deleteList", () => {
    it("should remove the specified list and decrement noOfLists", () => {
      const usedRecipes = new UsedRecipes();
      usedRecipes.uid = "event-001";
      usedRecipes.noOfLists = 2;
      usedRecipes.lists = {
        "list-1": {
          properties: {uid: "list-1", name: "Liste 1", selectedMeals: [], selectedMenues: [], generated: {date: new Date(), fromUid: "", fromDisplayName: ""}},
          recipes: {},
        },
        "list-2": {
          properties: {uid: "list-2", name: "Liste 2", selectedMeals: [], selectedMenues: [], generated: {date: new Date(), fromUid: "", fromDisplayName: ""}},
          recipes: {},
        },
      };

      const authUser = {uid: "user-1", publicProfile: {displayName: "Test"}} as any;
      const result = UsedRecipes.deleteList({usedRecipes, listUidToDelete: "list-1", authUser});

      expect(result.noOfLists).toBe(1);
      expect(result.lists["list-1"]).toBeUndefined();
      expect(result.lists["list-2"]).toBeDefined();
      // Original unverändert
      expect(usedRecipes.noOfLists).toBe(2);
    });
  });

  /* =====================================================================
  // editListName
  // ===================================================================== */
  describe("editListName", () => {
    it("should change the list name without mutating the original", () => {
      const usedRecipes = new UsedRecipes();
      usedRecipes.lists = {
        "list-1": {
          properties: {uid: "list-1", name: "Alter Name", selectedMeals: [], selectedMenues: [], generated: {date: new Date(), fromUid: "", fromDisplayName: ""}},
          recipes: {},
        },
      };

      const authUser = {uid: "user-1", publicProfile: {displayName: "Test"}} as any;
      const result = UsedRecipes.editListName({usedRecipes, listUidToEdit: "list-1", newName: "Neuer Name", authUser});

      expect(result.lists["list-1"].properties.name).toBe("Neuer Name");
      expect(usedRecipes.lists["list-1"].properties.name).toBe("Alter Name");
    });
  });

  /* =====================================================================
  // detectDrift
  // ===================================================================== */
  describe("detectDrift", () => {
    it("should report no drift when meals match derived meals", () => {
      const menuplan = createTestMenuplan();

      // menue-001 gehört zu meal-001 → korrekte Zuordnung
      const result = UsedRecipes.detectDrift(
        ["meal-001"],
        ["menue-001"],
        menuplan,
      );

      expect(result.hasDrift).toBe(false);
    });

    it("should detect drift when menues moved to different meals", () => {
      const menuplan = createTestMenuplan();

      // Gespeichert: menue-001 war in meal-002
      // Aktuell: menue-001 ist in meal-001 → Meals stimmen nicht überein
      const result = UsedRecipes.detectDrift(
        ["meal-002"],
        ["menue-001"],
        menuplan,
      );

      expect(result.hasDrift).toBe(true);
      expect(result.currentMealsFromMenues).toEqual(["meal-001"]);
      expect(result.currentMenuesFromMeals).toEqual(["menue-002"]);
    });

    it("should detect drift when menue count changes after re-derivation", () => {
      const menuplan = createTestMenuplan();

      // Meal-001 hat jetzt 2 Menüs, aber wir haben nur 1 gespeichert
      (menuplan.meals as any)["meal-001"].menuOrder = [
        "menue-001",
        "menue-002",
      ];

      const result = UsedRecipes.detectDrift(
        ["meal-001"],
        ["menue-001"],
        menuplan,
      );

      // selectedMenues.length (1) !== getMenuesOfMeals(["meal-001"]).length (2)
      expect(result.hasDrift).toBe(true);
    });

    it("should report no drift for multiple menues in correct meals", () => {
      const menuplan = createTestMenuplan();

      const result = UsedRecipes.detectDrift(
        ["meal-001", "meal-002"],
        ["menue-001", "menue-002"],
        menuplan,
      );

      expect(result.hasDrift).toBe(false);
    });
  });

  /* =====================================================================
  // fromDomainLists
  // ===================================================================== */
  describe("fromDomainLists", () => {
    it("should use persisted selectedMeals when available", () => {
      const menuplan = createTestMenuplan();
      const lists: UsedRecipeListDomain[] = [
        {
          id: "list-001",
          eventId: "event-001",
          name: "Test",
          selectedMenues: ["menue-001"],
          selectedMeals: ["meal-099"], // Absichtlich abweichend
          updatedAt: new Date(),
        },
      ];

      const result = UsedRecipes.fromDomainLists({
        lists,
        eventUid: "event-001",
        menuplan,
      });

      // Persistierte Meals sollen verwendet werden (nicht abgeleitet)
      expect(result.lists["list-001"].properties.selectedMeals).toEqual([
        "meal-099",
      ]);
    });

    it("should fall back to derivation when selectedMeals is empty", () => {
      const menuplan = createTestMenuplan();
      const lists: UsedRecipeListDomain[] = [
        {
          id: "list-001",
          eventId: "event-001",
          name: "Test",
          selectedMenues: ["menue-001"],
          selectedMeals: [], // Leer → Pre-Migration-Liste
          updatedAt: new Date(),
        },
      ];

      const result = UsedRecipes.fromDomainLists({
        lists,
        eventUid: "event-001",
        menuplan,
      });

      // Meals aus Menüs abgeleitet: menue-001 → meal-001
      expect(result.lists["list-001"].properties.selectedMeals).toEqual([
        "meal-001",
      ]);
    });

    it("should set correct noOfLists and uid", () => {
      const menuplan = createTestMenuplan();
      const lists: UsedRecipeListDomain[] = [
        {
          id: "list-001",
          eventId: "event-001",
          name: "A",
          selectedMenues: [],
          selectedMeals: [],
          updatedAt: new Date(),
        },
        {
          id: "list-002",
          eventId: "event-001",
          name: "B",
          selectedMenues: [],
          selectedMeals: [],
          updatedAt: new Date(),
        },
      ];

      const result = UsedRecipes.fromDomainLists({
        lists,
        eventUid: "event-001",
        menuplan,
      });

      expect(result.uid).toBe("event-001");
      expect(result.noOfLists).toBe(2);
    });
  });

  /* =====================================================================
  // _getUniqRecipes
  // ===================================================================== */
  describe("_getUniqRecipes", () => {
    it("should remove duplicates by uid", () => {
      const recipes = [
        {uid: "r1", recipeType: RecipeType.public, createdFromUid: "", eventUid: "e1"},
        {uid: "r2", recipeType: RecipeType.public, createdFromUid: "", eventUid: "e1"},
        {uid: "r1", recipeType: RecipeType.public, createdFromUid: "", eventUid: "e1"},
      ];

      const result = UsedRecipes._getUniqRecipes(recipes);

      expect(result).toHaveLength(2);
      expect(result.map((r) => r.uid)).toEqual(["r1", "r2"]);
    });

    it("should return empty array for empty input", () => {
      const result = UsedRecipes._getUniqRecipes([]);
      expect(result).toEqual([]);
    });
  });
});
