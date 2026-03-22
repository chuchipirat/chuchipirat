/**
 * Unit-Tests für EventGroupConfiguration (Domain-Klasse).
 *
 * Testet alle statischen Methoden der Gruppenkonfiguration:
 * - factory: Standardwerte mit Diäten und Intoleranzen
 * - addDietGroup / deleteDiet: Diätgruppen verwalten
 * - addIntolerance / deleteIntolerance: Intoleranzen verwalten
 * - calculateTotals: Portionen summieren
 * - Portionsmatrix: Konsistenz der Portions-Struktur
 */
import {EventGroupConfiguration, Diet, Intolerance, Portions} from "../groupConfiguration.class";

/**
 * Erzeugt eine minimale GroupConfig mit einer Diät und einer Intoleranz.
 *
 * @param portions - Optionale Portionszahl (Standard: 0)
 * @returns Fertige GroupConfig-Instanz
 */
const createMinimalGroupConfig = (portions = 0): EventGroupConfiguration => {
  const groupConfig = new EventGroupConfiguration();
  const dietUid = "diet-1";
  const intoleranceUid = "intol-1";

  groupConfig.diets = {
    entries: {[dietUid]: {uid: dietUid, name: "Fleisch", totalPortions: 0}},
    order: [dietUid],
  };
  groupConfig.intolerances = {
    entries: {
      [intoleranceUid]: {
        uid: intoleranceUid,
        name: "Ohne Unverträglichkeit",
        totalPortions: 0,
      },
    },
    order: [intoleranceUid],
  };
  groupConfig.portions = {[dietUid]: {[intoleranceUid]: portions}};
  groupConfig.totalPortions = portions;

  return groupConfig;
};

describe("EventGroupConfiguration", () => {
  describe("constructor", () => {
    it("should create an instance with empty defaults", () => {
      const config = new EventGroupConfiguration();

      expect(config.uid).toBe("");
      expect(config.diets.order).toEqual([]);
      expect(config.intolerances.order).toEqual([]);
      expect(config.totalPortions).toBe(0);
    });
  });

  describe("factory", () => {
    it("should create a config with default diets and intolerances", () => {
      const config = EventGroupConfiguration.factory();

      // Standard-Diäten: Fleisch, Vegetarisch
      expect(config.diets.order).toHaveLength(2);
      const dietNames = config.diets.order.map(
        (uid) => config.diets.entries[uid].name,
      );
      expect(dietNames).toContain("Fleisch");
      expect(dietNames).toContain("Vegetarisch");

      // Standard-Intoleranzen: Ohne, Laktose, Gluten
      expect(config.intolerances.order).toHaveLength(3);
      const intoleranceNames = config.intolerances.order.map(
        (uid) => config.intolerances.entries[uid].name,
      );
      expect(intoleranceNames).toContain("Ohne Unverträglichkeiten");
      expect(intoleranceNames).toContain("Laktoseintoleranz");
      expect(intoleranceNames).toContain("Glutenunverträglichkeit");
    });

    it("should initialize all portions to 0", () => {
      const config = EventGroupConfiguration.factory();

      expect(config.totalPortions).toBe(0);
      config.diets.order.forEach((dietUid) => {
        expect(config.diets.entries[dietUid].totalPortions).toBe(0);
        config.intolerances.order.forEach((intoleranceUid) => {
          expect(config.portions[dietUid][intoleranceUid]).toBe(0);
        });
      });
    });

    it("should create a complete portions matrix (every diet × every intolerance)", () => {
      const config = EventGroupConfiguration.factory();

      config.diets.order.forEach((dietUid) => {
        expect(config.portions[dietUid]).toBeDefined();
        config.intolerances.order.forEach((intoleranceUid) => {
          expect(config.portions[dietUid][intoleranceUid]).toBeDefined();
        });
      });
    });

    it("should generate unique UIDs for all entries", () => {
      const config = EventGroupConfiguration.factory();

      const allUids = [
        ...config.diets.order,
        ...config.intolerances.order,
      ];
      const uniqueUids = new Set(allUids);
      expect(uniqueUids.size).toBe(allUids.length);
    });
  });

  describe("addDietGroup", () => {
    it("should add a new diet with 0 portions for all intolerances", () => {
      const config = createMinimalGroupConfig();

      const result = EventGroupConfiguration.addDietGroup({
        groupConfig: config,
        dietGroupName: "Vegan",
      });

      expect(result.diets.order).toHaveLength(2);
      const newDietUid = result.diets.order[1];
      expect(result.diets.entries[newDietUid].name).toBe("Vegan");
      expect(result.diets.entries[newDietUid].totalPortions).toBe(0);

      // Portionsmatrix muss für neue Diät existieren
      expect(result.portions[newDietUid]).toBeDefined();
      result.intolerances.order.forEach((intoleranceUid) => {
        expect(result.portions[newDietUid][intoleranceUid]).toBe(0);
      });
    });
  });

  describe("deleteDiet", () => {
    it("should remove the diet and its portions row", () => {
      const config = createMinimalGroupConfig(5);
      const dietUid = config.diets.order[0];

      const result = EventGroupConfiguration.deleteDiet({
        groupConfig: config,
        dietUidToDelete: dietUid,
      });

      expect(result.diets.order).toHaveLength(0);
      expect(result.diets.entries[dietUid]).toBeUndefined();
      expect(result.portions[dietUid]).toBeUndefined();
      expect(result.totalPortions).toBe(0);
    });
  });

  describe("addIntolerance", () => {
    it("should add a new intolerance with 0 portions for all diets", () => {
      const config = createMinimalGroupConfig();

      const result = EventGroupConfiguration.addIntolerance({
        groupConfig: config,
        intoleranceName: "Nussallergie",
      });

      expect(result.intolerances.order).toHaveLength(2);
      const newIntoleranceUid = result.intolerances.order[1];
      expect(result.intolerances.entries[newIntoleranceUid].name).toBe(
        "Nussallergie",
      );

      // Portionsmatrix muss für neue Intoleranz in jeder Diät 0 sein
      result.diets.order.forEach((dietUid) => {
        expect(result.portions[dietUid][newIntoleranceUid]).toBe(0);
      });
    });
  });

  describe("deleteIntolerance", () => {
    it("should remove the intolerance and its portions column", () => {
      const config = createMinimalGroupConfig(3);
      const intoleranceUid = config.intolerances.order[0];

      const result = EventGroupConfiguration.deleteIntolerance({
        groupConfig: config,
        intoleranceUidToDelete: intoleranceUid,
      });

      expect(result.intolerances.order).toHaveLength(0);
      expect(result.intolerances.entries[intoleranceUid]).toBeUndefined();

      // Portionsmatrix darf die Intoleranz nicht mehr enthalten
      result.diets.order.forEach((dietUid) => {
        expect(result.portions[dietUid][intoleranceUid]).toBeUndefined();
      });
      expect(result.totalPortions).toBe(0);
    });
  });

  describe("calculateTotals", () => {
    it("should sum portions across intolerances per diet", () => {
      const config = createMinimalGroupConfig();
      // 2 Diäten, 2 Intoleranzen hinzufügen
      EventGroupConfiguration.addDietGroup({
        groupConfig: config,
        dietGroupName: "Vegan",
      });
      EventGroupConfiguration.addIntolerance({
        groupConfig: config,
        intoleranceName: "Laktose",
      });

      const diet1 = config.diets.order[0];
      const diet2 = config.diets.order[1];
      const intol1 = config.intolerances.order[0];
      const intol2 = config.intolerances.order[1];

      config.portions[diet1][intol1] = 5;
      config.portions[diet1][intol2] = 3;
      config.portions[diet2][intol1] = 2;
      config.portions[diet2][intol2] = 1;

      const result = EventGroupConfiguration.calculateTotals({
        groupConfig: config,
      });

      expect(result.diets.entries[diet1].totalPortions).toBe(8); // 5 + 3
      expect(result.diets.entries[diet2].totalPortions).toBe(3); // 2 + 1
      expect(result.intolerances.entries[intol1].totalPortions).toBe(7); // 5 + 2
      expect(result.intolerances.entries[intol2].totalPortions).toBe(4); // 3 + 1
      expect(result.totalPortions).toBe(11); // 8 + 3
    });

    it("should return 0 totals for empty config", () => {
      const config = new EventGroupConfiguration();

      const result = EventGroupConfiguration.calculateTotals({
        groupConfig: config,
      });

      expect(result.totalPortions).toBe(0);
    });
  });
});
