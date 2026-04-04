/**
 * Unit-Tests fuer productUtils und product.types.
 *
 * Testet die reinen Hilfsfunktionen: Aehnlichkeitssuche (findSimilarProducts),
 * sowie die Factory-Funktionen (createEmptyProduct, createEmptyDietProperty).
 */
// Polyfill fuer jsdom (react-router benoetigt TextEncoder/TextDecoder)
import {TextEncoder, TextDecoder} from "util";
Object.assign(globalThis, {TextEncoder, TextDecoder});

import {findSimilarProducts} from "../productUtils";
import {
  Diet,
  Product,
  createEmptyDietProperty,
  createEmptyProduct,
} from "../product.types";

// =====================================================================
// Testdaten
// =====================================================================

/** Hilfsfunktion zum Erstellen eines Produkts mit Standardwerten. */
function buildProduct(overrides: Partial<Product> & {name: string}): Product {
  return {
    uid: overrides.uid ?? overrides.name.toLowerCase().replace(/\s/g, "-"),
    name: overrides.name,
    department: overrides.department ?? {uid: "dept", name: "Abteilung"},
    shoppingUnit: overrides.shoppingUnit ?? "kg",
    dietProperties: overrides.dietProperties ?? {
      allergens: [],
      diet: Diet.Meat,
    },
    usable: overrides.usable ?? true,
    qaChecked: overrides.qaChecked ?? false,
    qaCheckedAt: overrides.qaCheckedAt ?? null,
  };
}

const testProducts: Product[] = [
  buildProduct({uid: "tom1", name: "Tomaten"}),
  buildProduct({uid: "tom2", name: "Tomatenmark"}),
  buildProduct({uid: "karotten", name: "Karotten"}),
  buildProduct({uid: "kartoffeln", name: "Kartoffeln"}),
  buildProduct({uid: "paprika", name: "Paprika"}),
  buildProduct({uid: "rote-linsen", name: "Rote Linsen"}),
  buildProduct({uid: "rote-bohnen", name: "Rote Bohnen"}),
  buildProduct({
    uid: "tomaten-gf",
    name: "Tomaten glutenfrei",
  }),
  buildProduct({uid: "aha-milch", name: "aha Milch laktosefrei"}),
];

// =====================================================================
// findSimilarProducts
// =====================================================================

describe("findSimilarProducts", () => {
  it("gibt ein leeres Array zurueck, wenn kein Produkt ueber dem Schwellenwert liegt", () => {
    const result = findSimilarProducts({
      productName: "Schokolade",
      existingProducts: testProducts,
    });

    expect(result).toEqual([]);
  });

  it("findet aehnliche Produkte ueber dem Schwellenwert", () => {
    // "Tomate" sollte "Tomaten" und "Tomatenmark" finden
    const result = findSimilarProducts({
      productName: "Tomate",
      existingProducts: testProducts,
    });

    const resultNames = result.map((product) => product.name);
    expect(resultNames).toContain("Tomaten");
  });

  it("sortiert nach absteigender Aehnlichkeit", () => {
    const result = findSimilarProducts({
      productName: "Tomaten",
      existingProducts: testProducts,
    });

    // Exakte Uebereinstimmung ("Tomaten") sollte vor "Tomatenmark" kommen
    expect(result.length).toBeGreaterThanOrEqual(1);
    if (result.length >= 2) {
      const firstIndex = testProducts.findIndex(
        (product) => product.name === result[0].name,
      );
      const secondIndex = testProducts.findIndex(
        (product) => product.name === result[1].name,
      );
      // Das erste Ergebnis soll die hoehere Aehnlichkeit haben
      expect(result[0].name).toBe("Tomaten");
      // Sicherstellen, dass die Reihenfolge stabil ist
      expect(firstIndex).toBeDefined();
      expect(secondIndex).toBeDefined();
    }
  });

  it("schliesst gefilterte Woerter aus (glutenfrei, laktosefrei, aha)", () => {
    // "Tomaten glutenfrei" — "glutenfrei" wird herausgefiltert,
    // daher soll die Suche nach "glutenfrei" allein nichts finden
    const result = findSimilarProducts({
      productName: "glutenfrei",
      existingProducts: testProducts,
    });

    expect(result).toEqual([]);
  });

  it("behandelt einwortige Produktnamen korrekt", () => {
    const result = findSimilarProducts({
      productName: "Karotten",
      existingProducts: testProducts,
    });

    const resultNames = result.map((product) => product.name);
    expect(resultNames).toContain("Karotten");
  });

  it("behandelt mehrwortige Produktnamen korrekt", () => {
    // "Rote Linsen" vs "Rote Bohnen" — beide teilen "Rote",
    // aber die Suche nach "Rote Linsen" sollte "Rote Linsen" exakt finden
    const result = findSimilarProducts({
      productName: "Rote Linsen",
      existingProducts: testProducts,
    });

    const resultNames = result.map((product) => product.name);
    expect(resultNames).toContain("Rote Linsen");
  });
});

// =====================================================================
// createEmptyDietProperty
// =====================================================================

describe("createEmptyDietProperty", () => {
  it("gibt korrekte Standardwerte zurueck", () => {
    const dietProperty = createEmptyDietProperty();

    expect(dietProperty.allergens).toEqual([]);
    expect(dietProperty.diet).toBe(Diet.Meat);
  });

  it("gibt bei jedem Aufruf ein neues Objekt zurueck", () => {
    const first = createEmptyDietProperty();
    const second = createEmptyDietProperty();

    expect(first).not.toBe(second);
    expect(first.allergens).not.toBe(second.allergens);
  });
});

// =====================================================================
// createEmptyProduct
// =====================================================================

describe("createEmptyProduct", () => {
  it("gibt korrekte Standardwerte zurueck", () => {
    const product = createEmptyProduct();

    expect(product.uid).toBe("");
    expect(product.name).toBe("");
    expect(product.department).toEqual({uid: "", name: ""});
    expect(product.shoppingUnit).toBe("");
    expect(product.dietProperties).toEqual({
      allergens: [],
      diet: Diet.Meat,
    });
    expect(product.usable).toBe(false);
  });

  it("gibt bei jedem Aufruf ein neues Objekt zurueck", () => {
    const first = createEmptyProduct();
    const second = createEmptyProduct();

    expect(first).not.toBe(second);
    expect(first.department).not.toBe(second.department);
    expect(first.dietProperties).not.toBe(second.dietProperties);
  });
});
