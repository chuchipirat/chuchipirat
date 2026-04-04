/**
 * Unit-Tests für menuplan.constants.tsx.
 *
 * Testet die Hilfsfunktionen `getOrderListNameFromDragAndDropTypes` und
 * `generatePlanedPortionsText`, die von mehreren Menüplan-Komponenten
 * gemeinsam genutzt werden.
 */
import React from "react";
import {render} from "@testing-library/react";

import {
  MenuplanDragDropTypes,
  getOrderListNameFromDragAndDropTypes,
  generatePlanedPortionsText,
} from "../menuplan.constants";
import {
  MenueListOrderTypes,
  PlanedDiet,
  PlanedIntolerances,
  PortionPlan,
} from "../menuplan.types";
import {EventGroupConfiguration} from "../../GroupConfiguration/groupConfiguration.class";


/**
 * Erstellt eine EventGroupConfiguration mit vordefinierten Diäten und Intoleranzen.
 *
 * @returns Vorkonfigurierte GroupConfiguration für Tests
 */
const createGroupConfiguration = (): EventGroupConfiguration => {
  const gc = new EventGroupConfiguration();
  gc.diets = {
    entries: {
      "diet-1": {uid: "diet-1", name: "Fleisch", totalPortions: 10},
      "diet-2": {uid: "diet-2", name: "Vegetarisch", totalPortions: 5},
    },
    order: ["diet-1", "diet-2"],
  };
  gc.intolerances = {
    entries: {
      "intol-1": {uid: "intol-1", name: "Laktose", totalPortions: 3},
      "intol-2": {uid: "intol-2", name: "Gluten", totalPortions: 2},
    },
    order: ["intol-1", "intol-2"],
  };
  return gc;
};

/**
 * Rendert React-Elemente und gibt den Textinhalt zurück.
 * Hilfsfunktion, um React.Fragment-Ausgaben testbar zu machen.
 *
 * @param elements - Array von React-Elementen aus generatePlanedPortionsText
 * @returns Textinhalt des gerenderten Outputs
 */
const renderToText = (elements: React.ReactElement[]): string => {
  const {container} = render(
    React.createElement(React.Fragment, null, ...elements)
  );
  return container.textContent ?? "";
};


/** Testet die korrekte Zuordnung von DnD-Typen zu Order-Listen-Typen. */
describe("getOrderListNameFromDragAndDropTypes", () => {
  it("gibt mealRecipeOrder für MEALRECIPE zurück", () => {
    expect(
      getOrderListNameFromDragAndDropTypes(MenuplanDragDropTypes.MEALRECIPE)
    ).toBe(MenueListOrderTypes.mealRecipeOrder);
  });

  it("gibt materialOrder für MATERIAL zurück", () => {
    expect(
      getOrderListNameFromDragAndDropTypes(MenuplanDragDropTypes.MATERIAL)
    ).toBe(MenueListOrderTypes.materialOrder);
  });

  it("gibt productOrder für PRODUCT zurück", () => {
    expect(
      getOrderListNameFromDragAndDropTypes(MenuplanDragDropTypes.PRODUCT)
    ).toBe(MenueListOrderTypes.productOrder);
  });

  it("gibt mealTypeOrder ('order') für MEALTYPE zurück", () => {
    const result = getOrderListNameFromDragAndDropTypes(
      MenuplanDragDropTypes.MEALTYPE
    );
    expect(result).toBe(MenueListOrderTypes.mealTypeOrder);
    // Sicherstellen, dass der tatsächliche String-Wert "order" ist
    expect(result).toBe("order");
  });

  it("gibt menuOrder für MENU zurück", () => {
    expect(
      getOrderListNameFromDragAndDropTypes(MenuplanDragDropTypes.MENU)
    ).toBe(MenueListOrderTypes.menuOrder);
  });

  it("gibt für jeden DnD-Typ einen eindeutigen Order-Typ zurück", () => {
    const allTypes = Object.values(MenuplanDragDropTypes);
    const results = allTypes.map((type) =>
      getOrderListNameFromDragAndDropTypes(type)
    );
    // Alle Ergebnisse müssen definiert sein
    results.forEach((r) => expect(r).toBeDefined());
    // Alle Ergebnisse müssen eindeutig sein
    expect(new Set(results).size).toBe(allTypes.length);
  });
});


/** Testet die Generierung von Portionsplan-Texten für die UI-Anzeige. */
describe("generatePlanedPortionsText", () => {
  let groupConfiguration: EventGroupConfiguration;

  beforeEach(() => {
    groupConfiguration = createGroupConfiguration();
  });

  /** Leerer Portionsplan ergibt leeres Array. */
  it("gibt ein leeres Array für einen leeren Portionsplan zurück", () => {
    const result = generatePlanedPortionsText({
      uid: "test-uid",
      portionPlan: [],
      groupConfiguration,
    });
    expect(result).toHaveLength(0);
  });

  /** ALL-Diät ohne spezifische Intoleranz zeigt "Alle" an. */
  it('zeigt "Alle" für PlanedDiet.ALL und PlanedIntolerances.ALL', () => {
    const portionPlan: PortionPlan[] = [
      {
        diet: PlanedDiet.ALL,
        intolerance: PlanedIntolerances.ALL,
        factor: 1,
        totalPortions: 10,
      },
    ];

    const result = generatePlanedPortionsText({
      uid: "test-uid",
      portionPlan,
      groupConfiguration,
    });

    const text = renderToText(result);
    expect(text).toContain("Alle");
    // Kein Intoleranz-Suffix bei ALL
    expect(text).not.toContain("Laktose");
    expect(text).not.toContain("Gluten");
  });

  /** FIX-Diät zeigt "Fixe Portionen" an. */
  it('zeigt "Fixe Portionen" für PlanedDiet.FIX', () => {
    const portionPlan: PortionPlan[] = [
      {
        diet: PlanedDiet.FIX,
        intolerance: PlanedIntolerances.ALL,
        factor: 1,
        totalPortions: 5,
      },
    ];

    const result = generatePlanedPortionsText({
      uid: "test-uid",
      portionPlan,
      groupConfiguration,
    });

    const text = renderToText(result);
    expect(text).toContain("Fixe Portionen");
  });

  /** Spezifische Diät-UID zeigt den Diät-Namen aus der GroupConfiguration an. */
  it("zeigt den Diät-Namen für eine spezifische Diät-UID", () => {
    const portionPlan: PortionPlan[] = [
      {
        diet: "diet-1",
        intolerance: PlanedIntolerances.ALL,
        factor: 1,
        totalPortions: 10,
      },
    ];

    const result = generatePlanedPortionsText({
      uid: "test-uid",
      portionPlan,
      groupConfiguration,
    });

    const text = renderToText(result);
    expect(text).toContain("Fleisch");
  });

  /** Spezifische Intoleranz-UID hängt den Namen mit Komma an. */
  it("hängt den Intoleranz-Namen für eine spezifische Intoleranz-UID an", () => {
    const portionPlan: PortionPlan[] = [
      {
        diet: PlanedDiet.ALL,
        intolerance: "intol-1",
        factor: 1,
        totalPortions: 8,
      },
    ];

    const result = generatePlanedPortionsText({
      uid: "test-uid",
      portionPlan,
      groupConfiguration,
    });

    const text = renderToText(result);
    expect(text).toContain("Alle");
    expect(text).toContain("Laktose");
  });

  /** FIX-Intoleranz zeigt keinen Intoleranz-Suffix an. */
  it("zeigt keinen Intoleranz-Suffix für PlanedIntolerances.FIX", () => {
    const portionPlan: PortionPlan[] = [
      {
        diet: PlanedDiet.ALL,
        intolerance: PlanedIntolerances.FIX,
        factor: 1,
        totalPortions: 7,
      },
    ];

    const result = generatePlanedPortionsText({
      uid: "test-uid",
      portionPlan,
      groupConfiguration,
    });

    const text = renderToText(result);
    expect(text).toContain("Alle");
    expect(text).not.toContain("Laktose");
    expect(text).not.toContain("Gluten");
  });

  /** Faktor ungleich 1 wird als Prefix "factor × " angezeigt. */
  it('zeigt "factor × " als Prefix wenn der Faktor ungleich 1 ist', () => {
    const portionPlan: PortionPlan[] = [
      {
        diet: PlanedDiet.ALL,
        intolerance: PlanedIntolerances.ALL,
        factor: 3,
        totalPortions: 30,
      },
    ];

    const result = generatePlanedPortionsText({
      uid: "test-uid",
      portionPlan,
      groupConfiguration,
    });

    const text = renderToText(result);
    expect(text).toContain("3 ×");
  });

  /** Faktor gleich 1 zeigt kein Prefix an. */
  it("zeigt kein Faktor-Prefix wenn der Faktor 1 ist", () => {
    const portionPlan: PortionPlan[] = [
      {
        diet: PlanedDiet.ALL,
        intolerance: PlanedIntolerances.ALL,
        factor: 1,
        totalPortions: 10,
      },
    ];

    const result = generatePlanedPortionsText({
      uid: "test-uid",
      portionPlan,
      groupConfiguration,
    });

    const text = renderToText(result);
    expect(text).not.toContain("×");
  });

  /** Singular "Portion" bei genau 1.0 Portion. */
  it('zeigt "Portion" (Singular) bei genau 1 Portion', () => {
    const portionPlan: PortionPlan[] = [
      {
        diet: PlanedDiet.ALL,
        intolerance: PlanedIntolerances.ALL,
        factor: 1,
        totalPortions: 1,
      },
    ];

    const result = generatePlanedPortionsText({
      uid: "test-uid",
      portionPlan,
      groupConfiguration,
    });

    const text = renderToText(result);
    expect(text).toContain("1.0 Portion)");
    // Darf nicht "Portionen" enthalten (nur "Portion")
    expect(text).not.toContain("Portionen");
  });

  /** Plural "Portionen" bei mehr als 1 Portion. */
  it('zeigt "Portionen" (Plural) bei mehreren Portionen', () => {
    const portionPlan: PortionPlan[] = [
      {
        diet: PlanedDiet.ALL,
        intolerance: PlanedIntolerances.ALL,
        factor: 1,
        totalPortions: 10,
      },
    ];

    const result = generatePlanedPortionsText({
      uid: "test-uid",
      portionPlan,
      groupConfiguration,
    });

    const text = renderToText(result);
    expect(text).toContain("10.0 Portionen");
  });

  /** Dezimalportionen werden mit einer Nachkommastelle formatiert. */
  it("formatiert Portionen mit einer Nachkommastelle", () => {
    const portionPlan: PortionPlan[] = [
      {
        diet: PlanedDiet.ALL,
        intolerance: PlanedIntolerances.ALL,
        factor: 1,
        totalPortions: 7.5,
      },
    ];

    const result = generatePlanedPortionsText({
      uid: "test-uid",
      portionPlan,
      groupConfiguration,
    });

    const text = renderToText(result);
    expect(text).toContain("7.5 Portionen");
  });

  /** Kombination: spezifische Diät + spezifische Intoleranz + Faktor. */
  it("kombiniert Diät, Intoleranz und Faktor korrekt", () => {
    const portionPlan: PortionPlan[] = [
      {
        diet: "diet-2",
        intolerance: "intol-2",
        factor: 2,
        totalPortions: 10,
      },
    ];

    const result = generatePlanedPortionsText({
      uid: "test-uid",
      portionPlan,
      groupConfiguration,
    });

    const text = renderToText(result);
    expect(text).toContain("2 ×");
    expect(text).toContain("Vegetarisch");
    expect(text).toContain("Gluten");
    expect(text).toContain("10.0 Portionen");
  });

  /** Mehrere Portionsplan-Zeilen werden alle gerendert. */
  it("rendert mehrere Portionsplan-Zeilen", () => {
    const portionPlan: PortionPlan[] = [
      {
        diet: PlanedDiet.ALL,
        intolerance: PlanedIntolerances.ALL,
        factor: 1,
        totalPortions: 20,
      },
      {
        diet: "diet-1",
        intolerance: "intol-1",
        factor: 2,
        totalPortions: 6,
      },
    ];

    const result = generatePlanedPortionsText({
      uid: "test-uid",
      portionPlan,
      groupConfiguration,
    });

    // Zwei Elemente im Array
    expect(result).toHaveLength(2);

    const text = renderToText(result);
    // Erste Zeile
    expect(text).toContain("Alle");
    expect(text).toContain("20.0 Portionen");
    // Zweite Zeile
    expect(text).toContain("Fleisch");
    expect(text).toContain("Laktose");
    expect(text).toContain("2 ×");
    expect(text).toContain("6.0 Portionen");
  });

  /** Zeilenumbrüche (<br />) werden zwischen Zeilen eingefügt, aber nicht nach der letzten. */
  it("fügt <br /> zwischen Zeilen ein, aber nicht nach der letzten", () => {
    const portionPlan: PortionPlan[] = [
      {
        diet: PlanedDiet.ALL,
        intolerance: PlanedIntolerances.ALL,
        factor: 1,
        totalPortions: 10,
      },
      {
        diet: PlanedDiet.FIX,
        intolerance: PlanedIntolerances.ALL,
        factor: 1,
        totalPortions: 5,
      },
      {
        diet: "diet-1",
        intolerance: PlanedIntolerances.ALL,
        factor: 1,
        totalPortions: 8,
      },
    ];

    const result = generatePlanedPortionsText({
      uid: "test-uid",
      portionPlan,
      groupConfiguration,
    });

    expect(result).toHaveLength(3);

    // Render und prüfe, dass <br>-Elemente vorhanden sind
    const {container} = render(
      React.createElement(React.Fragment, null, ...result)
    );
    const brElements = container.querySelectorAll("br");
    // Zwei <br /> für drei Zeilen (zwischen 1-2 und 2-3, nicht nach 3)
    expect(brElements).toHaveLength(2);
  });

  /** Einzelne Zeile hat kein <br />. */
  it("fügt kein <br /> bei nur einer Zeile ein", () => {
    const portionPlan: PortionPlan[] = [
      {
        diet: PlanedDiet.ALL,
        intolerance: PlanedIntolerances.ALL,
        factor: 1,
        totalPortions: 10,
      },
    ];

    const result = generatePlanedPortionsText({
      uid: "test-uid",
      portionPlan,
      groupConfiguration,
    });

    const {container} = render(
      React.createElement(React.Fragment, null, ...result)
    );
    const brElements = container.querySelectorAll("br");
    expect(brElements).toHaveLength(0);
  });

  /** Faktor 0 wird als Prefix angezeigt (Spezialfall). */
  it("zeigt Faktor 0 als Prefix an", () => {
    const portionPlan: PortionPlan[] = [
      {
        diet: PlanedDiet.ALL,
        intolerance: PlanedIntolerances.ALL,
        factor: 0,
        totalPortions: 0,
      },
    ];

    const result = generatePlanedPortionsText({
      uid: "test-uid",
      portionPlan,
      groupConfiguration,
    });

    const text = renderToText(result);
    // Faktor 0 != 1, also wird er angezeigt
    expect(text).toContain("0 ×");
  });

  /** Portionszahl 0 zeigt Plural ("Portionen") an. */
  it('zeigt "Portionen" (Plural) bei 0 Portionen', () => {
    const portionPlan: PortionPlan[] = [
      {
        diet: PlanedDiet.ALL,
        intolerance: PlanedIntolerances.ALL,
        factor: 1,
        totalPortions: 0,
      },
    ];

    const result = generatePlanedPortionsText({
      uid: "test-uid",
      portionPlan,
      groupConfiguration,
    });

    const text = renderToText(result);
    // 0 != 1, daher Plural
    expect(text).toContain("0.0 Portionen");
  });
});
