import React, {type Dispatch, type SetStateAction, useState} from "react";
import {Action} from "../../constants/actions";

/**
 * Navigations-Objekte für kontextabhängige Hilfeseiten.
 *
 * Wird verwendet, um in der Event-Ansicht die korrekte
 * Helpcenter-Seite zu bestimmen (z.B. Menüplan, Einkaufsliste).
 */
export enum NavigationObject {
  none = "none",
  home = "home",
  menueplan = "menueplan",
  groupConfiguration = "groupConfiguration",
  usedRecipes = "usedRecipes",
  shoppingList = "shoppingList",
  materialList = "materialList",
  eventSettings = "eventSettings",
}

/**
 * Aktuelle Navigationswerte (Objekt + Aktion).
 *
 * @param object - Das aktive Navigations-Objekt.
 * @param action - Die aktive Aktion (z.B. VIEW, EDIT).
 */
type NavigationValues = {
  object: NavigationObject;
  action: Action;
};

/**
 * Kontext-Typ für den Navigations-Context.
 *
 * @param navigationValues - Die aktuellen Navigationswerte.
 * @param setNavigationValues - Setter für die Navigationswerte.
 */
type NavigationContextType = {
  navigationValues: NavigationValues;
  setNavigationValues: Dispatch<SetStateAction<NavigationValues>>;
};

export const NavigationValuesContext =
  React.createContext<NavigationContextType | null>(null);

/**
 * Props für den NavigationContextProvider.
 *
 * @param children - Die Kindkomponenten, die den Context nutzen.
 */
type NavigationContextProviderProps = {
  children: React.ReactNode;
};

/**
 * Provider für den Navigations-Context.
 *
 * Stellt die aktuellen Navigationswerte (Objekt + Aktion)
 * im gesamten Komponentenbaum zur Verfügung.
 *
 * @param props - Siehe {@link NavigationContextProviderProps}.
 * @returns Context-Provider mit Navigationswerten.
 */
export const NavigationContextProvider = ({
  children,
}: NavigationContextProviderProps) => {
  const [navigationValues, setNavigationValues] = useState<NavigationValues>({
    object: NavigationObject.none,
    action: Action.NONE,
  });
  return (
    <NavigationValuesContext.Provider
      value={{navigationValues, setNavigationValues}}
    >
      {children}
    </NavigationValuesContext.Provider>
  );
};
