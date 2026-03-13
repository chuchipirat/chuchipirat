/**
 * Context für Event-Stammdaten, die von mehreren Event-Sub-Pages benötigt werden.
 *
 * Eliminiert Prop-Drilling von products, units, departments und
 * Unit-Conversions durch die Komponentenhierarchie. Wird in `event.tsx`
 * bereitgestellt und von UsedRecipes, ShoppingList und MaterialList konsumiert.
 *
 * @example
 * const {products, units} = useEventMasterData();
 */
import React from "react";

import Product from "../../Product/product.class";
import Unit from "../../Unit/unit.class";
import Department from "../../Department/department.class";
import {
  UnitConversionBasic,
  UnitConversionProducts,
} from "../../Unit/unitConversion.class";

/**
 * Stammdaten, die von mehreren Event-Sub-Pages benötigt werden.
 *
 * @param products - Alle Produkte
 * @param units - Alle Einheiten
 * @param departments - Alle Abteilungen (nur ShoppingList)
 * @param unitConversionBasic - Basis-Einheitenumrechnungen
 * @param unitConversionProducts - Produktspezifische Einheitenumrechnungen
 */
export interface EventMasterData {
  products: Product[];
  units: Unit[] | null;
  departments: Department[];
  unitConversionBasic: UnitConversionBasic | null;
  unitConversionProducts: UnitConversionProducts | null;
}

const EventMasterDataContext = React.createContext<EventMasterData | null>(null);

/**
 * Hook zum Zugriff auf Event-Stammdaten.
 *
 * @returns Event-Stammdaten aus dem nächsten Provider
 * @throws {Error} Wenn ausserhalb eines EventMasterDataProvider verwendet
 */
export function useEventMasterData(): EventMasterData {
  const ctx = React.useContext(EventMasterDataContext);
  if (!ctx) {
    throw new Error(
      "useEventMasterData muss innerhalb eines EventMasterDataContext.Provider verwendet werden",
    );
  }
  return ctx;
}

export default EventMasterDataContext;
