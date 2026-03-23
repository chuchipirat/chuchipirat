/**
 * Unit-Tests fuer die UnitConversion-Klasse.
 *
 * Testet Erstellen, Loeschen und Ausfuehren von Einheitenumrechnungen,
 * inklusive rekursiver Kettenumrechnung und Tiefenbegrenzung.
 */
import {
  UnitConversion,
  UnitConversionBasic,
  UnitConversionProducts,
} from "../unitConversion.class";
import {Unit, UnitDimension} from "../unit.class";
import {Diet} from "../../Product/product.types";

/* ===================================================================
// ======================== Test-Daten ================================
// =================================================================== */

/** Einheiten fuer die Umrechnungstests. */
const units: Unit[] = [
  {key: "kg", name: "Kilogramm", dimension: UnitDimension.mass},
  {key: "g", name: "Gramm", dimension: UnitDimension.mass},
  {key: "mg", name: "Milligramm", dimension: UnitDimension.mass},
  {key: "l", name: "Liter", dimension: UnitDimension.volume},
  {key: "dl", name: "Deziliter", dimension: UnitDimension.volume},
  {key: "Stk", name: "Stueck", dimension: UnitDimension.dimensionless},
];

/** Basis-Umrechnungsregeln: kg→g, g→mg, l→dl. */
const basicRules: UnitConversionBasic = {
  rule1: {fromUnit: "kg", toUnit: "g", numerator: 1000, denominator: 1},
  rule2: {fromUnit: "g", toUnit: "mg", numerator: 1000, denominator: 1},
  rule3: {fromUnit: "l", toUnit: "dl", numerator: 10, denominator: 1},
};

/* ===================================================================
// =================== convertQuantity ===============================
// =================================================================== */

describe("UnitConversion.convertQuantity", () => {
  it("gibt die Originalmenge zurueck, wenn Quell- und Ziel-Einheit identisch sind", () => {
    const result = UnitConversion.convertQuantity({
      quantity: 5,
      fromUnit: "kg",
      toUnit: "kg",
      units,
      unitConversionBasic: basicRules,
    });

    expect(result).toEqual({convertedQuantity: 5, convertedUnit: "kg"});
  });

  it("wendet Zaehler und Nenner korrekt an (kg → g)", () => {
    const result = UnitConversion.convertQuantity({
      quantity: 1,
      fromUnit: "kg",
      toUnit: "g",
      units,
      unitConversionBasic: basicRules,
    });

    expect(result).toEqual({convertedQuantity: 1000, convertedUnit: "g"});
  });

  it("bevorzugt produktspezifische Umrechnung gegenueber Basis-Umrechnung", () => {
    const productRules: UnitConversionProducts = {
      productRule1: {
        fromUnit: "Stk",
        toUnit: "g",
        numerator: 250,
        denominator: 1,
        productUid: "butter-uid",
        productName: "Butter",
      },
    };

    const result = UnitConversion.convertQuantity({
      quantity: 2,
      productUid: "butter-uid",
      fromUnit: "Stk",
      toUnit: "g",
      units,
      unitConversionBasic: basicRules,
      unitConversionProducts: productRules,
    });

    expect(result).toEqual({convertedQuantity: 500, convertedUnit: "g"});
  });

  it("gibt die Originalmenge und Quell-Einheit zurueck, wenn keine Umrechnung gefunden wird", () => {
    const result = UnitConversion.convertQuantity({
      quantity: 3,
      fromUnit: "Stk",
      toUnit: "kg",
      units,
      unitConversionBasic: basicRules,
    });

    expect(result).toEqual({convertedQuantity: 3, convertedUnit: "Stk"});
  });

  it("verkettet rekursiv ueber Zwischeneinheiten (kg → g → mg)", () => {
    const result = UnitConversion.convertQuantity({
      quantity: 1,
      fromUnit: "kg",
      toUnit: "mg",
      units,
      unitConversionBasic: basicRules,
    });

    // 1 kg → 1000 g → 1'000'000 mg
    expect(result).toEqual({
      convertedQuantity: 1_000_000,
      convertedUnit: "mg",
    });
  });

  it("bricht bei zyklischen Regeln durch Tiefenbegrenzung ab, ohne Endlosschleife", () => {
    // Zyklische Regeln: A → B → A
    const cyclicUnits: Unit[] = [
      {key: "A", name: "Einheit A", dimension: UnitDimension.dimensionless},
      {key: "B", name: "Einheit B", dimension: UnitDimension.dimensionless},
      {key: "C", name: "Einheit C", dimension: UnitDimension.dimensionless},
    ];

    const cyclicRules: UnitConversionBasic = {
      cycleAtoB: {fromUnit: "A", toUnit: "B", numerator: 2, denominator: 1},
      cycleBtoA: {fromUnit: "B", toUnit: "A", numerator: 1, denominator: 2},
    };

    // Ziel-Einheit C ist unerreichbar — Rekursion muss durch maxDepth gestoppt werden
    const result = UnitConversion.convertQuantity({
      quantity: 10,
      fromUnit: "A",
      toUnit: "C",
      units: cyclicUnits,
      unitConversionBasic: cyclicRules,
      maxDepth: 3,
    });

    // Die Methode muss terminieren und Originalwerte zurueckgeben
    expect(result).toBeDefined();
    expect(typeof result.convertedQuantity).toBe("number");
    expect(typeof result.convertedUnit).toBe("string");
  });
});

/* ===================================================================
// ================ createUnitConversionBasic ========================
// =================================================================== */

describe("UnitConversion.createUnitConversionBasic", () => {
  it("erstellt eine Basis-Umrechnung mit korrekten Feldern und generierter UUID", () => {
    const result = UnitConversion.createUnitConversionBasic({
      fromUnit: "kg",
      toUnit: "g",
      numerator: 1000,
      denominator: 1,
    });

    expect(result.uid).toBeDefined();
    expect(result.uid.length).toBeGreaterThan(0);
    expect(result.fromUnit).toBe("kg");
    expect(result.toUnit).toBe("g");
    expect(result.numerator).toBe(1000);
    expect(result.denominator).toBe(1);
  });
});

/* ===================================================================
// =============== createUnitConversionProduct =======================
// =================================================================== */

describe("UnitConversion.createUnitConversionProduct", () => {
  it("erstellt eine produktspezifische Umrechnung mit Produktreferenz", () => {
    const result = UnitConversion.createUnitConversionProduct({
      fromUnit: "Stk",
      toUnit: "g",
      numerator: 250,
      denominator: 1,
      product: {
        uid: "butter-uid",
        name: "Butter",
        department: {uid: "dept-1", name: "Milchprodukte"},
        shoppingUnit: "Stk",
        dietProperties: {allergens: [], diet: Diet.Meat},
        usable: true,
      },
    });

    expect(result.uid).toBeDefined();
    expect(result.uid.length).toBeGreaterThan(0);
    expect(result.fromUnit).toBe("Stk");
    expect(result.toUnit).toBe("g");
    expect(result.numerator).toBe(250);
    expect(result.denominator).toBe(1);
    expect(result.productUid).toBe("butter-uid");
    expect(result.productName).toBe("Butter");
  });
});

/* ===================================================================
// ================ deleteUnitConversion =============================
// =================================================================== */

describe("UnitConversion.deleteUnitConversion", () => {
  const conversions: UnitConversion[] = [
    {
      uid: "conv-1",
      fromUnit: "kg",
      toUnit: "g",
      numerator: 1000,
      denominator: 1,
    },
    {
      uid: "conv-2",
      fromUnit: "l",
      toUnit: "dl",
      numerator: 10,
      denominator: 1,
    },
  ];

  it("entfernt die korrekte Umrechnung aus der Liste", () => {
    const result = UnitConversion.deleteUnitConversion({
      unitConversion: conversions,
      unitConversionUidToDelete: "conv-1",
    });

    expect(result).toHaveLength(1);
    expect(result[0].uid).toBe("conv-2");
  });

  it("gibt die unveraenderte Liste zurueck, wenn die UID nicht gefunden wird", () => {
    const result = UnitConversion.deleteUnitConversion({
      unitConversion: conversions,
      unitConversionUidToDelete: "nicht-vorhanden",
    });

    expect(result).toHaveLength(2);
  });
});
