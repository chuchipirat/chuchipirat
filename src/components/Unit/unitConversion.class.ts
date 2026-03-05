import Utils from "../Shared/utils.class";
// import * as FIREBASE_EVENTS from "../../constants/firebaseEvents";
import Firebase from "../Firebase/firebase.class";
import Unit from "./unit.class";
import Product from "../Product/product.class";
import AuthUser from "../Firebase/Authentication/authUser.class";

interface GetAllConversionBasic {
  firebase: Firebase;
}
interface GetAllConversionProducts {
  firebase: Firebase;
}

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

interface SaveUnitConversions {
  firebase: Firebase;
  unitConversionBasic: UnitConversion[];
  unitConversionProducts: UnitConversion[];
  authUser: AuthUser;
}

export enum ConversionType {
  basic,
  product,
}

export default class UnitConversion {
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

  // =====================================================================
  /**
   * Alle Standard-Umrechnungen holen
   * @param Objekt Objekt mit Firebase-Referenz
   * @returns Objekt, mit den Stanardumrechnungen
   */
  static getAllConversionBasic = async ({firebase}: GetAllConversionBasic) => {
    let conversionData: UnitConversionBasic = {};

    await firebase.masterdata.unitConversionBasic
      .read<UnitConversionBasic>({uids: []})
      .then((result) => {
        conversionData = result;
      })
      .catch((error: Error) => {
        console.error(error);
        throw error;
      });
    return conversionData;
  };
  /* =====================================================================
  // Neue Umrechnung Basic anlegen
  // ===================================================================== */
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
  static deleteUnitConversion = ({
    unitConversion,
    unitConversionUidToDelete,
  }: DeleteUnitConversion) => {
    return unitConversion.filter(
      (unitConversion) => unitConversion.uid !== unitConversionUidToDelete
    );
  };
  /* =====================================================================
  // Umrechnungen Basic speichern
  // ===================================================================== */
  static saveUnitConversions = async ({
    firebase,
    unitConversionBasic,
    unitConversionProducts,
    authUser,
  }: SaveUnitConversions) => {
    await firebase.masterdata.unitConversionBasic
      .set({
        uids: [],
        value: Utils.convertArrayToObject({
          array: unitConversionBasic,
          keyName: "uid",
        }),
        authUser: authUser,
      })
      .then(async () => {
        await firebase.masterdata.unitConversionProducts.set({
          uids: [],
          value: Utils.convertArrayToObject({
            array: unitConversionProducts,
            keyName: "uid",
          }),
          authUser,
        });
      })
      .catch((error: Error) => {
        console.error(error);
        throw error;
      });
  };
  /* =====================================================================
  // Alle Umrechnungen Basic holen
  // ===================================================================== */
  static getAllConversionProducts = async ({
    firebase,
  }: GetAllConversionProducts) => {
    let conversionData: UnitConversionProducts = {};

    await firebase.masterdata.unitConversionProducts
      .read({uids: []})
      .then((result) => {
        conversionData = result;
      })
      .catch((error) => {
        console.error(error);
        throw error;
      });
    return conversionData;
  };
  /* =====================================================================
  // Neue Umrechnung Basic anlegen
  // ===================================================================== */
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
  static convertQuantity = ({
    quantity,
    productUid,
    fromUnit,
    toUnit,
    units,
    unitConversionBasic,
    unitConversionProducts,
  }: ConvertQuantity): {convertedQuantity: number; convertedUnit: string} => {
    let convertedUnit: Unit["key"];
    let convertedQuantity = 0;

    const toUnitDimension = Unit.getDimensionOfUnit(units, toUnit);

    if (toUnit == fromUnit) {
      // Umrechnen
      return {convertedQuantity: quantity, convertedUnit: toUnit};
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
      // Umrechnen
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
      });
    }
  };
}
