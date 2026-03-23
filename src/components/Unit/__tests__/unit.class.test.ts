/**
 * Unit-Tests fuer die Unit-Klasse.
 *
 * Testet die statische Methode `getDimensionOfUnit`, die anhand eines
 * Einheiten-Schlüssels die physikalische Dimension bestimmt.
 */
import {Unit, UnitDimension} from "../unit.class";

/* ===================================================================
// ======================== Test-Daten ================================
// =================================================================== */

/** Beispiel-Einheiten fuer die Tests. */
const sampleUnits: Unit[] = [
  {key: "kg", name: "Kilogramm", dimension: UnitDimension.mass},
  {key: "g", name: "Gramm", dimension: UnitDimension.mass},
  {key: "l", name: "Liter", dimension: UnitDimension.volume},
  {key: "dl", name: "Deziliter", dimension: UnitDimension.volume},
  {key: "Stk", name: "Stueck", dimension: UnitDimension.dimensionless},
];

/* ===================================================================
// =================== getDimensionOfUnit ============================
// =================================================================== */

describe("Unit.getDimensionOfUnit", () => {
  it("gibt die korrekte Dimension fuer eine bekannte Einheit zurueck", () => {
    const result = Unit.getDimensionOfUnit(sampleUnits, "kg");

    expect(result).toBe(UnitDimension.mass);
  });

  it("gibt 'dimensionless' zurueck, wenn die Einheit nicht in der Liste ist", () => {
    const result = Unit.getDimensionOfUnit(sampleUnits, "unbekannt");

    expect(result).toBe(UnitDimension.dimensionless);
  });

  it("gibt 'dimensionless' zurueck, wenn die Einheitenliste leer ist", () => {
    const result = Unit.getDimensionOfUnit([], "kg");

    expect(result).toBe(UnitDimension.dimensionless);
  });
});
