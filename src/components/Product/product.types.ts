/**
 * Typdefinitionen und Factory-Funktionen fuer Produkte/Zutaten (Stammdaten).
 *
 * Ersetzt die alte Firebase-basierte `product.class.ts`.
 * Die numerischen Enums bleiben aus Kompatibilitaetsgruenden erhalten —
 * eine Umstellung auf String-Enums ist als Tech-Debt geplant.
 */

// ATTENTION:
// Wird dies erweitert, muss auch im Cloud-Function File index
// die Beschreibung angepasst werden. Sonst funktioniert der
// Feed-Recap-Newsletter nicht.

/**
 * Allergen-Klassifikation fuer Produkte.
 * Numerische Werte bleiben erhalten (String-Umstellung ist Tech-Debt).
 */
export enum Allergen {
  None,
  Lactose = 1,
  Gluten,
}

/**
 * Diaet-Klassifikation fuer Produkte.
 * Numerische Werte bleiben erhalten (String-Umstellung ist Tech-Debt).
 */
export enum Diet {
  Meat = 1,
  Vegetarian,
  Vegan,
}

/**
 * Allergen- und Diaeteigenschaften eines Produkts.
 *
 * @param allergens - Liste der enthaltenen Allergene.
 * @param diet - Diaetklassifikation (Fleisch, vegetarisch, vegan).
 */
export type DietProperties = {
  allergens: Allergen[];
  diet: Diet;
};

/**
 * Abteilungszuordnung eines Produkts.
 *
 * @param uid - Eindeutige ID der Abteilung.
 * @param name - Name der Abteilung.
 */
export type ProductDepartment = {
  uid: string;
  name: string;
};

/**
 * Domain-Modell fuer ein Produkt/eine Zutat.
 *
 * @param uid - Eindeutige ID des Produkts.
 * @param name - Name des Produkts.
 * @param department - Zugehoerige Abteilung (uid + name).
 * @param shoppingUnit - Einkaufseinheit (z.B. "kg", "l").
 * @param dietProperties - Allergen- und Diaeteigenschaften.
 * @param usable - Ob das Produkt aktiv/nutzbar ist.
 */
export type Product = {
  uid: string;
  name: string;
  department: ProductDepartment;
  shoppingUnit: string;
  dietProperties: DietProperties;
  usable: boolean;
};

/**
 * Erzeugt ein leeres Produkt mit Standardwerten.
 *
 * @returns Neues Produkt mit leerer UID/Name und Standardwerten.
 * @example
 * const product = createEmptyProduct();
 */
export function createEmptyProduct(): Product {
  return {
    uid: "",
    name: "",
    department: {uid: "", name: ""},
    shoppingUnit: "",
    dietProperties: createEmptyDietProperty(),
    usable: false,
  };
}

/**
 * Erzeugt leere Diaeteigenschaften mit Standardwerten.
 *
 * @returns DietProperties mit leerer Allergen-Liste und Diet.Meat als Standard.
 * @example
 * const dietProps = createEmptyDietProperty();
 */
export function createEmptyDietProperty(): DietProperties {
  return {
    allergens: [] as Allergen[],
    diet: Diet.Meat,
  };
}
