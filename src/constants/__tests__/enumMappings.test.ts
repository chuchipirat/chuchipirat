import {
  ALLERGEN_FROM_DB,
  ALLERGEN_TO_DB,
  DIET_FROM_DB,
  DIET_TO_DB,
} from "../enumMappings";

describe("enumMappings", () => {
  describe("Allergen-Mappings", () => {
    it("ALLERGEN_FROM_DB und ALLERGEN_TO_DB sind invers", () => {
      Object.entries(ALLERGEN_FROM_DB).forEach(([dbString, numericValue]) => {
        expect(ALLERGEN_TO_DB[numericValue]).toBe(dbString);
      });
    });

    it("enthält lactose und gluten", () => {
      expect(ALLERGEN_FROM_DB).toHaveProperty("lactose");
      expect(ALLERGEN_FROM_DB).toHaveProperty("gluten");
    });
  });

  describe("Diet-Mappings", () => {
    it("DIET_FROM_DB und DIET_TO_DB sind invers", () => {
      Object.entries(DIET_FROM_DB).forEach(([dbString, numericValue]) => {
        expect(DIET_TO_DB[numericValue]).toBe(dbString);
      });
    });

    it("enthält meat, vegetarian und vegan", () => {
      expect(DIET_FROM_DB).toHaveProperty("meat");
      expect(DIET_FROM_DB).toHaveProperty("vegetarian");
      expect(DIET_FROM_DB).toHaveProperty("vegan");
    });
  });
});
