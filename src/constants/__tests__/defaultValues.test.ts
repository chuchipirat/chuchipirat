import {
  getSupportUserUid,
  MENUPLAN_MEALS,
  INTOLERANCES,
  DIETS,
  TextFieldSize,
  FEEDS_DISPLAY,
  RECIPE_DISPLAY,
  COMMENT_DISPLAY,
  RECIPES_SEARCH,
} from "../defaultValues";

describe("defaultValues", () => {
  describe("getSupportUserUid", () => {
    it("gibt einen nicht-leeren String zurück", () => {
      const uid = getSupportUserUid();
      expect(typeof uid).toBe("string");
      expect(uid!.length).toBeGreaterThan(0);
    });
  });

  describe("MENUPLAN_MEALS", () => {
    it("enthält genau 3 Mahlzeiten", () => {
      expect(MENUPLAN_MEALS).toHaveLength(3);
    });

    it("jede Mahlzeit hat name und uid", () => {
      MENUPLAN_MEALS.forEach((meal) => {
        expect(meal).toHaveProperty("name");
        expect(meal).toHaveProperty("uid");
        expect(typeof meal.name).toBe("string");
        expect(meal.name.length).toBeGreaterThan(0);
      });
    });
  });

  describe("INTOLERANCES", () => {
    it("ist ein nicht-leeres Array", () => {
      expect(INTOLERANCES.length).toBeGreaterThan(0);
    });
  });

  describe("DIETS", () => {
    it("ist ein nicht-leeres Array", () => {
      expect(DIETS.length).toBeGreaterThan(0);
    });
  });

  describe("TextFieldSize", () => {
    it("hat small und medium Werte", () => {
      expect(TextFieldSize.small).toBe("small");
      expect(TextFieldSize.medium).toBe("medium");
    });
  });

  describe("Display-Konstanten", () => {
    it("sind positive Zahlen", () => {
      expect(FEEDS_DISPLAY).toBeGreaterThan(0);
      expect(RECIPE_DISPLAY).toBeGreaterThan(0);
      expect(COMMENT_DISPLAY).toBeGreaterThan(0);
      expect(RECIPES_SEARCH).toBeGreaterThan(0);
    });
  });
});
