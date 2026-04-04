/**
 * Unit-Tests für menuplanPdf.tsx.
 *
 * Getestet werden:
 * - Reine Hilfsfunktionen (calculateBaseFontSize, computeColumnWidth,
 *   buildMealLookup, findNoteForDate, findNoteForMenu)
 * - React-PDF-Komponentenbaum (MenuplanPdf) — Smoke-Tests via createElement
 *
 * @react-pdf/renderer wird gemockt, da die ESM-Module nicht von Jest
 * transformiert werden. Die Smoke-Tests validieren, dass der Komponentenbaum
 * ohne Laufzeitfehler aufgebaut wird (Props, Lookups, Bedingungen).
 */

jest.mock("@react-pdf/renderer", () => {
  const React = jest.requireActual("react");
  const createComponent = (name: string) =>
    React.forwardRef((props: any, _ref: any) =>
      React.createElement(name, null, props.children)
    );
  return {
    Document: createComponent("Document"),
    Page: createComponent("Page"),
    View: createComponent("View"),
    Text: createComponent("Text"),
    Svg: createComponent("Svg"),
    Path: createComponent("Path"),
    Font: {
      register: jest.fn(),
      registerEmojiSource: jest.fn(),
    },
    StyleSheet: {
      create: <T extends Record<string, any>>(styles: T): T => styles,
    },
  };
});

jest.mock("@react-pdf/types", () => ({}));

// pdfFontRegistration wird durch den Font-Mock bereits abgedeckt
jest.mock("../../../Shared/pdfFontRegistration", () => {});

// pdfComponents — minimale Stubs
jest.mock("../../../Shared/pdfComponents", () => {
  const React = jest.requireActual("react");
  return {
    Header: () => React.createElement("Header"),
    Footer: () => React.createElement("Footer"),
  };
});

import React from "react";
import {render} from "@testing-library/react";

import {
  calculateBaseFontSize,
  computeColumnWidth,
  buildMealLookup,
  findNoteForDate,
  findNoteForMenu,
  MenuplanPdf,
} from "../menuplanPdf";
import {
  MENUPLAN_PDF_OPTIONS_INITIAL,
  MenuplanPdfOptions,
} from "../dialogMenuplanPdfOptions";

import type {
  MenuplanData,
  Meal,
  Meals,
  Note,
  Notes,
  Menue,
  MealRecipe,
  MealType,
  MenuplanMaterial,
  MenuplanProduct,
} from "../menuplan.types";
import {GoodsPlanMode} from "../menuplan.types";
import {RecipeType} from "../../../Recipe/recipe.class";
import {Event} from "../../Event/event.class";
import AuthUser from "../../../Firebase/Authentication/authUser.class";

import {isTimesliceBoundary, getColumnBackground, COLUMN_TINT} from "../../../../constants/stylesMenuplanPdf";


/** Erzeugt ein Datum ohne Zeitzone-Probleme. */
function date(year: number, month: number, day: number): Date {
  return new Date(year, month - 1, day);
}

/** Formatiert ein Date als YYYY-MM-DD (gleich wie Utils.dateAsString). */
function dateStr(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dy = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${dy}`;
}

/** Erzeugt ein minimales Event. */
function buildEvent(overrides: Partial<Event> = {}): Event {
  const event = new Event();
  event.uid = "event-1";
  event.name = "Testlager";
  event.dates = [
    {uid: "d1", pos: 1, from: date(2026, 3, 10), to: date(2026, 3, 13)},
  ];
  Object.assign(event, overrides);
  return event;
}

/** Erzeugt einen minimalen AuthUser. */
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

/** Erzeugt ein minimales Meal. */
function buildMeal(overrides: Partial<Meal> = {}): Meal {
  return {
    uid: "meal-1",
    date: "2026-03-10",
    mealType: "mt-1",
    menuOrder: [],
    ...overrides,
  };
}

/** Erzeugt ein minimales Menue. */
function buildMenue(overrides: Partial<Menue> = {}): Menue {
  return {
    uid: "menue-1",
    name: "Menü 1",
    mealRecipeOrder: [],
    materialOrder: [],
    productOrder: [],
    ...overrides,
  };
}

/** Erzeugt eine minimale Note. */
function buildNote(overrides: Partial<Note> = {}): Note {
  return {
    uid: "note-1",
    date: "2026-03-10",
    menueUid: "",
    text: "Tagesnotiz",
    ...overrides,
  };
}

/** Erzeugt ein minimales MealRecipe. */
function buildMealRecipe(overrides: Partial<MealRecipe> = {}): MealRecipe {
  return {
    uid: "mr-1",
    recipe: {
      recipeUid: "recipe-1",
      name: "Testrezept",
      type: RecipeType.public,
      createdFromUid: "user-1",
    },
    plan: [],
    totalPortions: 10,
    ...overrides,
  };
}

/** Erzeugt ein minimales MenuplanProduct. */
function buildProduct(
  overrides: Partial<MenuplanProduct> = {}
): MenuplanProduct {
  return {
    uid: "prod-1",
    quantity: 2,
    unit: "kg",
    productUid: "p-1",
    productName: "Mehl",
    planMode: GoodsPlanMode.TOTAL,
    plan: [],
    totalQuantity: 2,
    ...overrides,
  };
}

/** Erzeugt ein minimales MenuplanMaterial. */
function buildMaterial(
  overrides: Partial<MenuplanMaterial> = {}
): MenuplanMaterial {
  return {
    uid: "mat-1",
    quantity: 5,
    unit: "Stk",
    materialUid: "m-1",
    materialName: "Teller",
    planMode: GoodsPlanMode.TOTAL,
    plan: [],
    totalQuantity: 5,
    ...overrides,
  };
}

/** Erzeugt ein minimales MenuplanData-Objekt. */
function buildMenuplanData(
  overrides: Partial<MenuplanData> = {}
): MenuplanData {
  const dates = [date(2026, 3, 10), date(2026, 3, 11), date(2026, 3, 12)];
  const mealType: MealType = {uid: "mt-1", name: "Mittagessen"};
  const meal = buildMeal({
    uid: "meal-1",
    date: dateStr(dates[0]),
    mealType: mealType.uid,
    menuOrder: ["menue-1"],
  });
  const mealRecipe = buildMealRecipe();
  const menue = buildMenue({
    uid: "menue-1",
    name: "Hauptgang",
    mealRecipeOrder: [mealRecipe.uid],
  });

  return {
    uid: "event-1",
    dates,
    mealTypes: {
      entries: {[mealType.uid]: mealType},
      order: [mealType.uid],
    },
    meals: {[meal.uid]: meal},
    menues: {[menue.uid]: menue},
    notes: {},
    mealRecipes: {[mealRecipe.uid]: mealRecipe},
    materials: {},
    products: {},
    created: {date: new Date(), fromUid: "user-1", fromDisplayName: "Test"},
    lastChange: {
      date: new Date(),
      fromUid: "user-1",
      fromDisplayName: "Test",
    },
    ...overrides,
  };
}


// ─── Hilfsfunktionen ─────────────────────────────────────────────

describe("calculateBaseFontSize", () => {
  it("gibt 8 zurück für ≤7 Tage", () => {
    expect(calculateBaseFontSize(1)).toBe(8);
    expect(calculateBaseFontSize(7)).toBe(8);
  });

  it("gibt 7 zurück für 8–10 Tage", () => {
    expect(calculateBaseFontSize(8)).toBe(7);
    expect(calculateBaseFontSize(10)).toBe(7);
  });

  it("gibt 6 zurück für 11–14 Tage", () => {
    expect(calculateBaseFontSize(11)).toBe(6);
    expect(calculateBaseFontSize(14)).toBe(6);
  });

  it("gibt 6 zurück für Grenzfall >14 Tage", () => {
    expect(calculateBaseFontSize(21)).toBe(6);
  });
});


describe("computeColumnWidth", () => {
  it("berechnet korrekte Breite für 7 Tage", () => {
    expect(computeColumnWidth(7)).toBe("14.29%");
  });

  it("berechnet korrekte Breite für 10 Tage", () => {
    expect(computeColumnWidth(10)).toBe("10.00%");
  });

  it("berechnet korrekte Breite für 14 Tage", () => {
    expect(computeColumnWidth(14)).toBe("7.14%");
  });

  it("berechnet korrekte Breite für 3 Tage", () => {
    expect(computeColumnWidth(3)).toBe("33.33%");
  });
});


describe("buildMealLookup", () => {
  it("gibt leere Map zurück bei leeren Meals", () => {
    const map = buildMealLookup({});
    expect(map.size).toBe(0);
  });

  it("erstellt korrekte Lookup-Keys", () => {
    const meal1 = buildMeal({
      uid: "m1",
      mealType: "mt-1",
      date: "2026-03-10",
    });
    const meal2 = buildMeal({
      uid: "m2",
      mealType: "mt-2",
      date: "2026-03-10",
    });
    const meal3 = buildMeal({
      uid: "m3",
      mealType: "mt-1",
      date: "2026-03-11",
    });

    const meals: Meals = {m1: meal1, m2: meal2, m3: meal3};
    const map = buildMealLookup(meals);

    expect(map.size).toBe(3);
    expect(map.get("mt-1_2026-03-10")).toBe(meal1);
    expect(map.get("mt-2_2026-03-10")).toBe(meal2);
    expect(map.get("mt-1_2026-03-11")).toBe(meal3);
  });

  it("gibt undefined zurück für nicht existierenden Key", () => {
    const meal = buildMeal({uid: "m1", mealType: "mt-1", date: "2026-03-10"});
    const map = buildMealLookup({m1: meal});
    expect(map.get("mt-99_2026-03-10")).toBeUndefined();
  });

  it("überschreibt bei Duplikat-Keys (letzter gewinnt)", () => {
    const meal1 = buildMeal({
      uid: "m1",
      mealType: "mt-1",
      date: "2026-03-10",
      menuOrder: ["a"],
    });
    const meal2 = buildMeal({
      uid: "m2",
      mealType: "mt-1",
      date: "2026-03-10",
      menuOrder: ["b"],
    });
    const map = buildMealLookup({m1: meal1, m2: meal2});
    expect(map.get("mt-1_2026-03-10")?.menuOrder).toEqual(["b"]);
  });
});


describe("findNoteForDate", () => {
  const day = date(2026, 3, 10);
  const dayString = dateStr(day);

  it("findet eine Tagesnotiz", () => {
    const note = buildNote({uid: "n1", date: dayString, menueUid: ""});
    const notes: Notes = {n1: note};
    expect(findNoteForDate(notes, day)).toBe(note);
  });

  it("gibt undefined zurück wenn keine Notiz vorhanden", () => {
    expect(findNoteForDate({}, day)).toBeUndefined();
  });

  it("ignoriert Menü-Notizen", () => {
    const menuNote = buildNote({
      uid: "n1",
      date: dayString,
      menueUid: "menue-1",
    });
    const notes: Notes = {n1: menuNote};
    expect(findNoteForDate(notes, day)).toBeUndefined();
  });

  it("ignoriert Notizen mit anderem Datum", () => {
    const note = buildNote({uid: "n1", date: "2026-03-11", menueUid: ""});
    const notes: Notes = {n1: note};
    expect(findNoteForDate(notes, day)).toBeUndefined();
  });

  it("findet korrekte Notiz bei mehreren Einträgen", () => {
    const wrongDate = buildNote({
      uid: "n1",
      date: "2026-03-11",
      menueUid: "",
    });
    const menuNote = buildNote({
      uid: "n2",
      date: dayString,
      menueUid: "menue-1",
    });
    const correct = buildNote({uid: "n3", date: dayString, menueUid: ""});
    const notes: Notes = {n1: wrongDate, n2: menuNote, n3: correct};
    expect(findNoteForDate(notes, day)).toBe(correct);
  });
});


describe("findNoteForMenu", () => {
  const day = date(2026, 3, 10);
  const dayString = dateStr(day);

  it("findet eine Menü-Notiz", () => {
    const note = buildNote({
      uid: "n1",
      date: dayString,
      menueUid: "menue-1",
      text: "Menü-Notiz",
    });
    const notes: Notes = {n1: note};
    expect(findNoteForMenu(notes, "menue-1", day)).toBe(note);
  });

  it("gibt undefined zurück bei nicht vorhandener Notiz", () => {
    expect(findNoteForMenu({}, "menue-1", day)).toBeUndefined();
  });

  it("ignoriert Tagesnotizen (menueUid leer)", () => {
    const dayNote = buildNote({uid: "n1", date: dayString, menueUid: ""});
    const notes: Notes = {n1: dayNote};
    expect(findNoteForMenu(notes, "menue-1", day)).toBeUndefined();
  });

  it("ignoriert Notizen mit anderem Menü", () => {
    const note = buildNote({
      uid: "n1",
      date: dayString,
      menueUid: "menue-other",
    });
    const notes: Notes = {n1: note};
    expect(findNoteForMenu(notes, "menue-1", day)).toBeUndefined();
  });

  it("ignoriert Notizen mit anderem Datum", () => {
    const note = buildNote({
      uid: "n1",
      date: "2026-03-11",
      menueUid: "menue-1",
    });
    const notes: Notes = {n1: note};
    expect(findNoteForMenu(notes, "menue-1", day)).toBeUndefined();
  });

  it("findet korrekte Notiz bei mehreren Einträgen", () => {
    const wrongMenu = buildNote({
      uid: "n1",
      date: dayString,
      menueUid: "other",
    });
    const wrongDate = buildNote({
      uid: "n2",
      date: "2026-03-11",
      menueUid: "menue-1",
    });
    const dayNote = buildNote({uid: "n3", date: dayString, menueUid: ""});
    const correct = buildNote({
      uid: "n4",
      date: dayString,
      menueUid: "menue-1",
      text: "Richtige Notiz",
    });
    const notes: Notes = {
      n1: wrongMenu,
      n2: wrongDate,
      n3: dayNote,
      n4: correct,
    };
    expect(findNoteForMenu(notes, "menue-1", day)).toBe(correct);
  });
});


describe("isTimesliceBoundary", () => {
  it("erkennt aufeinanderfolgende Tage als keine Grenze", () => {
    expect(isTimesliceBoundary(date(2026, 3, 10), date(2026, 3, 11))).toBe(false);
  });

  it("erkennt Lücke zwischen Tagen als Grenze", () => {
    // 12. März → 15. März (3 Tage Lücke)
    expect(isTimesliceBoundary(date(2026, 3, 12), date(2026, 3, 15))).toBe(true);
  });

  it("erkennt 2-Tage-Lücke als Grenze", () => {
    expect(isTimesliceBoundary(date(2026, 3, 10), date(2026, 3, 12))).toBe(true);
  });

  it("gibt false zurück wenn nextDay undefined (letzter Tag)", () => {
    expect(isTimesliceBoundary(date(2026, 3, 10), undefined)).toBe(false);
  });
});


describe("getColumnBackground", () => {
  it("gibt Tint für ungerade Spalten zurück", () => {
    expect(getColumnBackground(1)).toBe(COLUMN_TINT);
  });

  it("gibt transparent für gerade Spalten zurück", () => {
    expect(getColumnBackground(0)).toBe("transparent");
  });
});


// ─── Komponenten-Smoke-Tests ─────────────────────────────────────

describe("MenuplanPdf Komponente", () => {
  const defaultOptions: MenuplanPdfOptions = {
    ...MENUPLAN_PDF_OPTIONS_INITIAL,
  };

  it("rendert ohne Fehler mit minimalen Daten", () => {
    expect(() =>
      render(
        <MenuplanPdf
          event={buildEvent()}
          menuplan={buildMenuplanData()}
          authUser={buildAuthUser()}
          pdfOptions={defaultOptions}
        />
      )
    ).not.toThrow();
  });

  it("rendert mit allen PDF-Optionen aktiviert", () => {
    const product = buildProduct({uid: "prod-1"});
    const material = buildMaterial({uid: "mat-1"});
    const mealRecipe = buildMealRecipe({uid: "mr-1", totalPortions: 15});
    const menue = buildMenue({
      uid: "menue-1",
      name: "Hauptgang",
      mealRecipeOrder: [mealRecipe.uid],
      productOrder: [product.uid],
      materialOrder: [material.uid],
    });

    const menuplan = buildMenuplanData({
      menues: {[menue.uid]: menue},
      mealRecipes: {[mealRecipe.uid]: mealRecipe},
      products: {[product.uid]: product},
      materials: {[material.uid]: material},
    });

    const allOptions: MenuplanPdfOptions = {
      showProducts: true,
      showMaterials: true,
      showPortions: true,
    };

    expect(() =>
      render(
        <MenuplanPdf
          event={buildEvent()}
          menuplan={menuplan}
          authUser={buildAuthUser()}
          pdfOptions={allOptions}
        />
      )
    ).not.toThrow();
  });

  it("rendert mit 14 Tagen (maximale Dichte)", () => {
    const dates = Array.from({length: 14}, (_, i) => date(2026, 3, 10 + i));
    const menuplan = buildMenuplanData({dates});

    expect(() =>
      render(
        <MenuplanPdf
          event={buildEvent()}
          menuplan={menuplan}
          authUser={buildAuthUser()}
          pdfOptions={defaultOptions}
        />
      )
    ).not.toThrow();
  });

  it("rendert mit Tages- und Menü-Notizen (inline)", () => {
    const day = date(2026, 3, 10);
    const dayNote = buildNote({
      uid: "n1",
      date: dateStr(day),
      menueUid: "",
      text: "Einkaufen gehen",
    });
    const menuNote = buildNote({
      uid: "n2",
      date: dateStr(day),
      menueUid: "menue-1",
      text: "Vorbereiten am Vorabend",
    });

    const menuplan = buildMenuplanData({
      notes: {n1: dayNote, n2: menuNote},
    });

    const {queryByText} = render(
      <MenuplanPdf
        event={buildEvent()}
        menuplan={menuplan}
        authUser={buildAuthUser()}
        pdfOptions={defaultOptions}
      />
    );

    // Notizen werden inline angezeigt (Tagesnotiz im Header, Menü-Notiz in der Zelle)
    expect(queryByText(/Einkaufen gehen/)).not.toBeNull();
    expect(queryByText(/Vorbereiten am Vorabend/)).not.toBeNull();
  });

  it("rendert mit Produkten und Materialien (je eine Zeile)", () => {
    const product = buildProduct({
      uid: "prod-1",
      productName: "Mehl",
      totalQuantity: 2,
      unit: "kg",
    });
    const material = buildMaterial({
      uid: "mat-1",
      materialName: "Schüssel",
      totalQuantity: 3,
      unit: "Stk",
    });
    const menue = buildMenue({
      uid: "menue-1",
      name: "Hauptgang",
      mealRecipeOrder: [],
      productOrder: [product.uid],
      materialOrder: [material.uid],
    });

    const menuplan = buildMenuplanData({
      menues: {[menue.uid]: menue},
      mealRecipes: {},
      products: {[product.uid]: product},
      materials: {[material.uid]: material},
    });

    const optionsWithGoods: MenuplanPdfOptions = {
      showProducts: true,
      showMaterials: true,
      showPortions: false,
    };

    const {queryByText} = render(
      <MenuplanPdf
        event={buildEvent()}
        menuplan={menuplan}
        authUser={buildAuthUser()}
        pdfOptions={optionsWithGoods}
      />
    );

    expect(queryByText(/Mehl/)).not.toBeNull();
    expect(queryByText(/Schüssel/)).not.toBeNull();
  });

  it("zeigt Menüname immer an", () => {
    const menuplan = buildMenuplanData();

    const {queryByText} = render(
      <MenuplanPdf
        event={buildEvent()}
        menuplan={menuplan}
        authUser={buildAuthUser()}
        pdfOptions={defaultOptions}
      />
    );

    // Menüname "Hauptgang" sollte sichtbar sein (auch mit nur einem Menü)
    expect(queryByText("Hauptgang")).not.toBeNull();
  });

  it("rendert mit leeren Menüplan-Daten (keine Meals/Menues)", () => {
    const menuplan = buildMenuplanData({
      meals: {},
      menues: {},
      mealRecipes: {},
    });

    expect(() =>
      render(
        <MenuplanPdf
          event={buildEvent()}
          menuplan={menuplan}
          authUser={buildAuthUser()}
          pdfOptions={defaultOptions}
        />
      )
    ).not.toThrow();
  });

  it("rendert mit mehreren Mahlzeitentypen", () => {
    const mt1: MealType = {uid: "mt-1", name: "Frühstück"};
    const mt2: MealType = {uid: "mt-2", name: "Mittagessen"};
    const mt3: MealType = {uid: "mt-3", name: "Abendessen"};

    const meal1 = buildMeal({
      uid: "m1",
      mealType: mt1.uid,
      date: "2026-03-10",
      menuOrder: ["menue-1"],
    });
    const meal2 = buildMeal({
      uid: "m2",
      mealType: mt2.uid,
      date: "2026-03-10",
      menuOrder: ["menue-1"],
    });
    const meal3 = buildMeal({
      uid: "m3",
      mealType: mt3.uid,
      date: "2026-03-10",
      menuOrder: ["menue-1"],
    });

    const menuplan = buildMenuplanData({
      mealTypes: {
        entries: {[mt1.uid]: mt1, [mt2.uid]: mt2, [mt3.uid]: mt3},
        order: [mt1.uid, mt2.uid, mt3.uid],
      },
      meals: {m1: meal1, m2: meal2, m3: meal3},
    });

    expect(() =>
      render(
        <MenuplanPdf
          event={buildEvent()}
          menuplan={menuplan}
          authUser={buildAuthUser()}
          pdfOptions={defaultOptions}
        />
      )
    ).not.toThrow();
  });

  it("rendert mit Rezept-Variante", () => {
    const variantRecipe = buildMealRecipe({
      uid: "mr-v",
      recipe: {
        recipeUid: "r-v",
        name: "Pasta",
        type: RecipeType.variant,
        createdFromUid: "user-1",
        variantName: "Glutenfrei",
      },
    });
    const menue = buildMenue({
      uid: "menue-1",
      name: "Hauptgang",
      mealRecipeOrder: [variantRecipe.uid],
    });

    const menuplan = buildMenuplanData({
      menues: {[menue.uid]: menue},
      mealRecipes: {[variantRecipe.uid]: variantRecipe},
    });

    expect(() =>
      render(
        <MenuplanPdf
          event={buildEvent()}
          menuplan={menuplan}
          authUser={buildAuthUser()}
          pdfOptions={defaultOptions}
        />
      )
    ).not.toThrow();
  });

  it("rendert mit gelöschtem Rezept (mealRecipe nicht vorhanden)", () => {
    const menue = buildMenue({
      uid: "menue-1",
      name: "Hauptgang",
      mealRecipeOrder: ["deleted-recipe-uid"],
    });
    const menuplan = buildMenuplanData({
      menues: {[menue.uid]: menue},
      mealRecipes: {},
    });

    expect(() =>
      render(
        <MenuplanPdf
          event={buildEvent()}
          menuplan={menuplan}
          authUser={buildAuthUser()}
          pdfOptions={defaultOptions}
        />
      )
    ).not.toThrow();
  });

  it("zeigt Portionen nur wenn showPortions aktiviert", () => {
    const mealRecipe = buildMealRecipe({uid: "mr-1", totalPortions: 42});
    const menue = buildMenue({
      uid: "menue-1",
      name: "Hauptgang",
      mealRecipeOrder: [mealRecipe.uid],
    });
    const menuplan = buildMenuplanData({
      menues: {[menue.uid]: menue},
      mealRecipes: {[mealRecipe.uid]: mealRecipe},
    });

    const {queryByText: query1} = render(
      <MenuplanPdf
        event={buildEvent()}
        menuplan={menuplan}
        authUser={buildAuthUser()}
        pdfOptions={{...defaultOptions, showPortions: false}}
      />
    );
    expect(query1(/42 P\./)).toBeNull();

    const {queryByText: query2} = render(
      <MenuplanPdf
        event={buildEvent()}
        menuplan={menuplan}
        authUser={buildAuthUser()}
        pdfOptions={{...defaultOptions, showPortions: true}}
      />
    );
    expect(query2(/42 P\./)).not.toBeNull();
  });
});
