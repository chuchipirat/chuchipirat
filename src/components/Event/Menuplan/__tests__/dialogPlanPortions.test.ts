/**
 * Tests für die exportierten Hilfsfunktionen aus dialogPlanPortions.tsx.
 *
 * Getestete Funktionen:
 * - `buildDietPlan` — Erstellt die Planungsstruktur für eine einzelne Diät
 * - `buildMenuPlan` — Erstellt die vollständige Planungsstruktur (alle Diäten)
 * - `getDietTabPortions` — Berechnet die Summe der aktiven Portionen
 * - `hasDietActiveEntries` — Prüft ob aktive Einträge vorhanden sind
 */
import {
  buildDietPlan,
  buildMenuPlan,
  getDietTabPortions,
  hasDietActiveEntries,
} from "../dialogPlanPortions";
import {PlanedDiet, PlanedIntolerances} from "../menuplan.types";
import {
  DialogPlanPortionsDietPlanning,
  DialogPlanPortionsPlanningInfo,
} from "../menuplan.page.types";
import {EventGroupConfiguration} from "../../GroupConfiguration/groupConfiguration.class";

/* =====================================================================
// Testdaten-Hilfsfunktion
// ===================================================================== */

/**
 * Erstellt eine Gruppen-Konfiguration mit zwei Diäten und zwei Intoleranzen
 * als Basis für alle Tests.
 *
 * Struktur:
 * - Diäten: Fleisch (10 Portionen), Vegi (5 Portionen)
 * - Intoleranzen: Ohne Unverträglichkeit (12 Portionen), Laktose (3 Portionen)
 * - Portionsmatrix: Fleisch/Ohne=8, Fleisch/Laktose=2, Vegi/Ohne=4, Vegi/Laktose=1
 * - Total: 15
 *
 * @returns Konfigurierte EventGroupConfiguration
 */
function buildGroupConfig(): EventGroupConfiguration {
  const gc = new EventGroupConfiguration();
  gc.diets = {
    entries: {
      "diet-1": {uid: "diet-1", name: "Fleisch", totalPortions: 10},
      "diet-2": {uid: "diet-2", name: "Vegi", totalPortions: 5},
    },
    order: ["diet-1", "diet-2"],
  };
  gc.intolerances = {
    entries: {
      "intol-1": {
        uid: "intol-1",
        name: "Ohne Unverträglichkeit",
        totalPortions: 12,
      },
      "intol-2": {uid: "intol-2", name: "Laktose", totalPortions: 3},
    },
    order: ["intol-1", "intol-2"],
  };
  gc.portions = {
    "diet-1": {"intol-1": 8, "intol-2": 2},
    "diet-2": {"intol-1": 4, "intol-2": 1},
  };
  gc.totalPortions = 15;
  return gc;
}

/**
 * Hilfsfunktion: Erstellt einen einzelnen Planungseintrag.
 *
 * @param overrides Werte, die vom Standard abweichen
 * @returns DialogPlanPortionsPlanningInfo mit Standardwerten
 */
function makePlanningInfo(
  overrides: Partial<DialogPlanPortionsPlanningInfo>
): DialogPlanPortionsPlanningInfo {
  return {
    active: false,
    factor: "1.0",
    portions: 0,
    total: 0,
    diet: "",
    ...overrides,
  };
}

/* =====================================================================
// buildDietPlan
// ===================================================================== */

/** Erstellt die Planungsstruktur für eine einzelne Diät. */
describe("buildDietPlan", () => {
  let gc: EventGroupConfiguration;

  beforeEach(() => {
    gc = buildGroupConfig();
  });

  /** Bei PlanedDiet.FIX wird nur ein einziger Eintrag mit Schlüssel FIX zurückgegeben. */
  it("gibt bei PlanedDiet.FIX einen einzelnen FIX-Eintrag zurück", () => {
    const result = buildDietPlan(PlanedDiet.FIX, gc);

    expect(Object.keys(result)).toEqual([PlanedDiet.FIX]);
    expect(result[PlanedDiet.FIX]).toEqual(
      makePlanningInfo({
        diet: PlanedDiet.FIX,
      })
    );
  });

  /** Bei PlanedDiet.ALL werden Einträge pro Intoleranz plus ALL-Zeile erstellt. */
  it("gibt bei PlanedDiet.ALL Einträge pro Intoleranz und ALL zurück", () => {
    const result = buildDietPlan(PlanedDiet.ALL, gc);

    // Alle Intoleranzen + ALL-Eintrag
    expect(Object.keys(result)).toEqual([
      "intol-1",
      "intol-2",
      PlanedIntolerances.ALL,
    ]);

    // Portionen aus gc.intolerances.entries[x].totalPortions
    expect(result["intol-1"]).toEqual(
      makePlanningInfo({portions: 12, diet: PlanedDiet.ALL})
    );
    expect(result["intol-2"]).toEqual(
      makePlanningInfo({portions: 3, diet: PlanedDiet.ALL})
    );

    // ALL-Zeile mit gc.totalPortions
    expect(result[PlanedIntolerances.ALL]).toEqual(
      makePlanningInfo({portions: 15, diet: PlanedDiet.ALL})
    );
  });

  /** Bei einer konkreten Diät werden Portionen aus der Portionsmatrix geholt. */
  it("gibt bei einer konkreten Diät Einträge mit Portionen aus der Matrix zurück", () => {
    const result = buildDietPlan("diet-1", gc);

    expect(Object.keys(result)).toEqual([
      "intol-1",
      "intol-2",
      PlanedIntolerances.ALL,
    ]);

    // Portionen aus gc.portions[dietUid][intolUid]
    expect(result["intol-1"]).toEqual(
      makePlanningInfo({portions: 8, diet: "diet-1"})
    );
    expect(result["intol-2"]).toEqual(
      makePlanningInfo({portions: 2, diet: "diet-1"})
    );

    // ALL-Zeile mit gc.diets.entries[dietUid].totalPortions
    expect(result[PlanedIntolerances.ALL]).toEqual(
      makePlanningInfo({portions: 10, diet: "diet-1"})
    );
  });

  /** Alle Einträge haben die Standardwerte active=false, factor="1.0", total=0. */
  it("setzt bei allen Einträgen active=false, factor='1.0' und total=0", () => {
    // Alle drei Varianten prüfen
    const fixResult = buildDietPlan(PlanedDiet.FIX, gc);
    const allResult = buildDietPlan(PlanedDiet.ALL, gc);
    const dietResult = buildDietPlan("diet-2", gc);

    const allEntries = [
      ...Object.values(fixResult),
      ...Object.values(allResult),
      ...Object.values(dietResult),
    ];

    allEntries.forEach((entry) => {
      expect(entry.active).toBe(false);
      expect(entry.factor).toBe("1.0");
      expect(entry.total).toBe(0);
    });
  });
});

/* =====================================================================
// buildMenuPlan
// ===================================================================== */

/** Erstellt die vollständige Planungsstruktur für ein Menü (alle Diäten × Intoleranzen). */
describe("buildMenuPlan", () => {
  let gc: EventGroupConfiguration;

  beforeEach(() => {
    gc = buildGroupConfig();
  });

  /** Gibt Einträge für ALL, jede Diät und FIX zurück. */
  it("enthält Einträge für ALL, jede Diät und FIX", () => {
    const result = buildMenuPlan(gc);

    expect(Object.keys(result)).toEqual([
      PlanedDiet.ALL,
      "diet-1",
      "diet-2",
      PlanedDiet.FIX,
    ]);
  });

  /** Der ALL-Eintrag entspricht dem Ergebnis von buildDietPlan(ALL). */
  it("verwendet buildDietPlan(ALL) für den ALL-Eintrag", () => {
    const result = buildMenuPlan(gc);
    const expected = buildDietPlan(PlanedDiet.ALL, gc);

    expect(result[PlanedDiet.ALL]).toEqual(expected);
  });

  /** Jeder Diät-Eintrag entspricht dem Ergebnis von buildDietPlan(dietUid). */
  it("verwendet buildDietPlan(dietUid) für individuelle Diäten", () => {
    const result = buildMenuPlan(gc);

    gc.diets.order.forEach((dietUid) => {
      const expected = buildDietPlan(dietUid, gc);
      expect(result[dietUid]).toEqual(expected);
    });
  });

  /** Der FIX-Eintrag entspricht dem Ergebnis von buildDietPlan(FIX). */
  it("verwendet buildDietPlan(FIX) für den FIX-Eintrag", () => {
    const result = buildMenuPlan(gc);
    const expected = buildDietPlan(PlanedDiet.FIX, gc);

    expect(result[PlanedDiet.FIX]).toEqual(expected);
  });
});

/* =====================================================================
// getDietTabPortions
// ===================================================================== */

/** Berechnet die Gesamtportionen eines Diät-Tabs (Summe der aktiven Einträge). */
describe("getDietTabPortions", () => {
  /** Gibt 0 zurück wenn undefined übergeben wird. */
  it("gibt 0 zurück bei undefined", () => {
    expect(getDietTabPortions(undefined)).toBe(0);
  });

  /** Gibt 0 zurück bei einem leeren Plan. */
  it("gibt 0 zurück bei leerem Plan", () => {
    const plan: DialogPlanPortionsDietPlanning = {};
    expect(getDietTabPortions(plan)).toBe(0);
  });

  /** Gibt 0 zurück wenn keine Einträge aktiv sind. */
  it("gibt 0 zurück wenn keine Einträge aktiv sind", () => {
    const plan: DialogPlanPortionsDietPlanning = {
      "intol-1": makePlanningInfo({total: 10, active: false, diet: "diet-1"}),
      "intol-2": makePlanningInfo({total: 5, active: false, diet: "diet-1"}),
    };
    expect(getDietTabPortions(plan)).toBe(0);
  });

  /** Summiert die Totals aller aktiven Einträge. */
  it("summiert die Totals aller aktiven Einträge", () => {
    const plan: DialogPlanPortionsDietPlanning = {
      "intol-1": makePlanningInfo({total: 10, active: true, diet: "diet-1"}),
      "intol-2": makePlanningInfo({total: 5, active: true, diet: "diet-1"}),
      ALL: makePlanningInfo({total: 3, active: true, diet: "diet-1"}),
    };
    expect(getDietTabPortions(plan)).toBe(18);
  });

  /** Berücksichtigt nur aktive Einträge bei gemischtem Status. */
  it("summiert nur aktive Einträge bei gemischtem Status", () => {
    const plan: DialogPlanPortionsDietPlanning = {
      "intol-1": makePlanningInfo({total: 10, active: true, diet: "diet-1"}),
      "intol-2": makePlanningInfo({total: 5, active: false, diet: "diet-1"}),
      ALL: makePlanningInfo({total: 7, active: true, diet: "diet-1"}),
    };
    // Nur intol-1 (10) und ALL (7) sind aktiv
    expect(getDietTabPortions(plan)).toBe(17);
  });
});

/* =====================================================================
// hasDietActiveEntries
// ===================================================================== */

/** Prüft ob eine Diät aktive Einträge hat. */
describe("hasDietActiveEntries", () => {
  /** Gibt false zurück wenn undefined übergeben wird. */
  it("gibt false zurück bei undefined", () => {
    expect(hasDietActiveEntries(undefined)).toBe(false);
  });

  /** Gibt false zurück wenn kein Eintrag aktiv ist. */
  it("gibt false zurück wenn kein Eintrag aktiv ist", () => {
    const plan: DialogPlanPortionsDietPlanning = {
      "intol-1": makePlanningInfo({active: false, diet: "diet-1"}),
      "intol-2": makePlanningInfo({active: false, diet: "diet-1"}),
    };
    expect(hasDietActiveEntries(plan)).toBe(false);
  });

  /** Gibt true zurück wenn mindestens ein Eintrag aktiv ist. */
  it("gibt true zurück wenn mindestens ein Eintrag aktiv ist", () => {
    const plan: DialogPlanPortionsDietPlanning = {
      "intol-1": makePlanningInfo({active: false, diet: "diet-1"}),
      "intol-2": makePlanningInfo({active: true, diet: "diet-1"}),
    };
    expect(hasDietActiveEntries(plan)).toBe(true);
  });
});
