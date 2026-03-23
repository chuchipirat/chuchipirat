/**
 * Einheiten-Klasse für Masseinheiten (kg, l, etc.).
 *
 * Definiert die Struktur einer Einheit sowie Hilfsfunktionen
 * zur Bestimmung der physikalischen Dimension.
 */

interface Constructor {
  key: Unit["key"];
  name: Unit["name"];
}

/**
 * Physikalische Dimension einer Einheit.
 *
 * Wird verwendet, um bei Umrechnungen nur kompatible Einheiten
 * (z.B. Masse → Masse) zuzulassen.
 */
export enum UnitDimension {
  volume = "VOL",
  mass = "MAS",
  dimensionless = "DLS",
}

/**
 * Repräsentiert eine Masseinheit (z.B. kg, l, Stk).
 *
 * @example
 * const kg = new Unit({ key: "kg", name: "Kilogramm" });
 */
export class Unit {
  // HINT: Änderungen müssen auch im Cloud-FX-Type nachgeführt werden
  key: string;
  name: string;
  dimension: UnitDimension;
  /* =====================================================================
  // Constructor
  // ===================================================================== */
  constructor({key, name}: Constructor) {
    this.key = key;
    this.name = name;
    this.dimension = UnitDimension.dimensionless;
  }
  /* =====================================================================
  // Dimension einer Einheit bestimmen
  // ===================================================================== */
  /**
   * Bestimmt die physikalische Dimension einer Einheit anhand ihres Schlüssels.
   *
   * Durchsucht die übergebene Einheitenliste nach dem gesuchten Schlüssel
   * und gibt dessen Dimension zurück. Falls die Einheit nicht gefunden wird,
   * wird `dimensionless` zurückgegeben.
   *
   * @param units - Liste aller verfügbaren Einheiten.
   * @param unitToFind - Schlüssel der gesuchten Einheit.
   * @returns Die Dimension der Einheit oder `dimensionless` als Fallback.
   *
   * @example
   * Unit.getDimensionOfUnit([{key: "kg", dimension: UnitDimension.mass}], "kg")
   * // UnitDimension.mass
   */
  static getDimensionOfUnit = (units: Unit[], unitToFind: Unit["key"]) => {
    const dimension = units.find(
      (unit) => unit.key === unitToFind
    )?.dimension;

    return dimension ?? UnitDimension.dimensionless;
  };
}
