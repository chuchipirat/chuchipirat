/**
 * Einheitenumrechnungs-Klasse für Basis- und Produktspezifische Umrechnungen.
 *
 * Stellt statische Methoden bereit zum Erstellen, Löschen und Ausführen
 * von Einheitenumrechnungen (z.B. kg → g, Stk → g für ein bestimmtes Produkt).
 */
import {Unit, UnitDimension} from "./unit.class";
import {Product} from "../Product/product.types";

export interface UnitConversionBasic {
  [key: string]: SingleUnitConversionBasic;
}

export interface SingleUnitConversionBasic {
  fromUnit: Unit["key"];
  toUnit: Unit["key"];
  numerator: number;
  denominator: number;
}
export interface UnitConversionProducts {
  [key: string]: SingleUnitConversionProduct;
}
export interface SingleUnitConversionProduct extends SingleUnitConversionBasic {
  productUid: Product["uid"];
  productName: Product["name"];
}

interface ConvertQuantity {
  quantity: number;
  productUid?: Product["uid"];
  fromUnit: Unit["key"];
  toUnit: Unit["key"];
  units: Unit[];
  unitConversionBasic: UnitConversionBasic;
  unitConversionProducts?: UnitConversionProducts;
  /** Maximale Rekursionstiefe zum Schutz vor Endlosschleifen bei zyklischen Regeln. */
  maxDepth?: number;
}

interface CreateUnitConversionBasic {
  fromUnit: Unit["key"];
  toUnit: Unit["key"];
  numerator: number;
  denominator: number;
}
interface CreateUnitConversionProduct {
  fromUnit: Unit["key"];
  toUnit: Unit["key"];
  numerator: number;
  denominator: number;
  product: Product;
}

interface DeleteUnitConversion {
  unitConversion: UnitConversion[];
  unitConversionUidToDelete: UnitConversion["uid"];
}

/**
 * Art der Umrechnung: Basis (allgemeingültig) oder Produkt-spezifisch.
 */
export enum ConversionType {
  basic = "basic",
  product = "product",
}

/**
 * Repräsentiert eine einzelne Einheitenumrechnung.
 *
 * Kann sowohl eine Basis-Umrechnung (z.B. kg → g) als auch eine
 * produktspezifische Umrechnung (z.B. 1 Stk Butter = 250 g) sein.
 */
export class UnitConversion {
  uid: string;
  fromUnit: Unit["key"];
  toUnit: Unit["key"];
  numerator: number;
  denominator: number;
  productName?: Product["name"];
  productUid?: Product["uid"];
  constructor() {
    this.uid = "";
    this.fromUnit = "";
    this.toUnit = "";
    this.numerator = 0;
    this.denominator = 1;
    this.productName = "";
    this.productUid = "";
  }

  /* =====================================================================
  // Neue Umrechnung Basic anlegen
  // ===================================================================== */
  /**
   * Erstellt eine neue Basis-Umrechnung (z.B. kg → g).
   *
   * @param fromUnit - Quell-Einheit.
   * @param toUnit - Ziel-Einheit.
   * @param numerator - Zähler der Umrechnung.
   * @param denominator - Nenner der Umrechnung.
   * @returns Neues UnitConversion-Objekt mit generierter UUID.
   *
   * @example
   * UnitConversion.createUnitConversionBasic({
   *   fromUnit: "kg", toUnit: "g", numerator: 1000, denominator: 1
   * })
   */
  static createUnitConversionBasic = ({
    denominator,
    numerator,
    fromUnit,
    toUnit,
  }: CreateUnitConversionBasic): UnitConversion => {
    return {
      uid: crypto.randomUUID(),
      fromUnit: fromUnit,
      toUnit: toUnit,
      numerator: numerator,
      denominator: denominator,
    };
  };
  /* =====================================================================
  // Umrechnung löschen
  // ===================================================================== */
  /**
   * Entfernt eine Umrechnung aus der Liste anhand ihrer UID.
   *
   * @param unitConversion - Aktuelle Liste der Umrechnungen.
   * @param unitConversionUidToDelete - UID der zu löschenden Umrechnung.
   * @returns Neue Liste ohne die gelöschte Umrechnung.
   */
  static deleteUnitConversion = ({
    unitConversion,
    unitConversionUidToDelete,
  }: DeleteUnitConversion) => {
    return unitConversion.filter(
      (conversion) => conversion.uid !== unitConversionUidToDelete
    );
  };
  /* =====================================================================
  // Neue Umrechnung Produkt anlegen
  // ===================================================================== */
  /**
   * Erstellt eine neue produktspezifische Umrechnung (z.B. 1 Stk Butter = 250 g).
   *
   * @param product - Das Produkt, für das die Umrechnung gilt.
   * @param fromUnit - Quell-Einheit.
   * @param toUnit - Ziel-Einheit.
   * @param numerator - Zähler der Umrechnung.
   * @param denominator - Nenner der Umrechnung.
   * @returns Neues UnitConversion-Objekt mit Produktreferenz und generierter UUID.
   */
  static createUnitConversionProduct = ({
    product,
    fromUnit,
    toUnit,
    numerator,
    denominator,
  }: CreateUnitConversionProduct): UnitConversion => {
    return {
      uid: crypto.randomUUID(),
      productName: product.name,
      productUid: product.uid,
      fromUnit: fromUnit,
      toUnit: toUnit,
      numerator: numerator,
      denominator: denominator,
    };
  };
  /* =====================================================================
  // Menge umrechnen
  // ===================================================================== */
  /**
   * Rechnet eine Menge von einer Einheit in eine andere um.
   *
   * Sucht zuerst nach einer produktspezifischen Umrechnung, dann nach einer
   * Basis-Umrechnung. Falls keine direkte Umrechnung gefunden wird, wird
   * rekursiv über Zwischeneinheiten gesucht (z.B. EL → ml → dl).
   * Eine Tiefenbegrenzung schützt vor Endlosschleifen bei zyklischen Regeln.
   *
   * @param quantity - Umzurechnende Menge.
   * @param productUid - Optionale Produkt-UID für produktspezifische Umrechnungen.
   * @param fromUnit - Quell-Einheit.
   * @param toUnit - Ziel-Einheit.
   * @param units - Liste aller verfügbaren Einheiten.
   * @param unitConversionBasic - Basis-Umrechnungsregeln.
   * @param unitConversionProducts - Optionale produktspezifische Umrechnungsregeln.
   * @param maxDepth - Maximale Rekursionstiefe (Standard: 10).
   * @returns Objekt mit umgerechneter Menge und Ziel-Einheit.
   */
  static convertQuantity = ({
    quantity,
    productUid,
    fromUnit,
    toUnit,
    units,
    unitConversionBasic,
    unitConversionProducts,
    maxDepth = 10,
  }: ConvertQuantity): {convertedQuantity: number; convertedUnit: string} => {
    let convertedUnit: Unit["key"];
    let convertedQuantity = 0;

    const toUnitDimension = Unit.getDimensionOfUnit(units, toUnit);

    if (toUnit === fromUnit) {
      return {convertedQuantity: quantity, convertedUnit: toUnit};
    }

    // Tiefenbegrenzung erreicht — Originalwerte zurückgeben
    if (maxDepth <= 0) {
      return {convertedQuantity: quantity, convertedUnit: fromUnit};
    }

    let conversionRule:
      | SingleUnitConversionProduct
      | SingleUnitConversionBasic
      | undefined;

    if (productUid && unitConversionProducts) {
      // Zuerst Produktspezifisch schauen (sollte es nur eine geben)
      conversionRule = Object.values(unitConversionProducts).find(
        (rule) => rule.productUid === productUid && rule.fromUnit === fromUnit
      );
    }

    if (!productUid || !conversionRule) {
      // Kein Produkt oder keine Produkt-spezifische Umrechung gefunden
      // Basis Umrechnung suchen
      conversionRule = Object.values(unitConversionBasic).find((rule) => {
        // Bei der Umrechnung muss die Dimension berücksichtigt werden
        // Wir können von EL (Masse) nicht in die Einkaufseinheit Volumen umrechnen.
        const ruleDimension = Unit.getDimensionOfUnit(units, rule.fromUnit);

        if (rule.fromUnit === fromUnit && ruleDimension === toUnitDimension) {
          return true;
        }
      });
    }

    if (conversionRule) {
      convertedQuantity =
        (quantity * conversionRule.numerator) / conversionRule.denominator;
      convertedUnit = conversionRule.toUnit;
    } else {
      // Nichts gefunden...
      return {convertedQuantity: quantity, convertedUnit: fromUnit};
    }

    if (conversionRule.toUnit === toUnit) {
      return {
        convertedQuantity: convertedQuantity,
        convertedUnit: convertedUnit,
      };
    } else {
      // Die richtige Ziel-Einheit wurde noch nicht gefunden. Nun rekursiv suchen
      return UnitConversion.convertQuantity({
        quantity: convertedQuantity,
        fromUnit: conversionRule.toUnit,
        toUnit: toUnit,
        units: units,
        unitConversionBasic: unitConversionBasic,
        maxDepth: maxDepth - 1,
      });
    }
  };
}

