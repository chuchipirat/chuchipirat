/**
 * Drag-&-Drop-Kontext und Hilfsfunktionen für die Mahlzeitentyp-Reihen.
 *
 * Stellt den React-Context für MealTypeRows/MealTypeRow bereit und
 * enthält generische DnD-Utilities (Item-Registry, getItemData, isItemData).
 */
import {createContext, useContext} from "react";
import invariant from "tiny-invariant";
import {ListContextValue, ItemEntry} from "../../../constants/dragAndDrop";


/**
 * Kontext für die Drag-&-Drop-Logik der Mahlzeitentyp-Reihen.
 * Wird von MealTypeRows als Provider und von MealTypeRow als Consumer genutzt.
 */
export const MealTypesRowContext = createContext<ListContextValue | null>(null);

/**
 * Hook zum Zugriff auf den MealTypesRow-DnD-Kontext.
 * Wirft einen Fehler, wenn der Kontext nicht verfügbar ist.
 *
 * @returns Der aktuelle DnD-Kontext
 * @throws Wenn außerhalb des MealTypesRowContext.Provider verwendet
 */
export function useMealTypeRowContext() {
  const rowContext = useContext(MealTypesRowContext);
  invariant(rowContext !== null);
  return rowContext;
}


/**
 * Symbol-Key zum Identifizieren von DnD-Item-Daten.
 */
export const itemKey = Symbol("item");

/**
 * Typisierte Daten für ein DnD-Item.
 *
 * @param T - Typ des Items
 * @param item - Das Item selbst
 * @param index - Position in der Liste
 * @param instanceId - Symbol-ID der Listen-Instanz
 */
export type ItemData<Item> = {
  [itemKey]: true;
  item: Item;
  index: number;
  instanceId: symbol;
};

/**
 * Erstellt typisierte DnD-Item-Daten.
 *
 * @param item - Das Item
 * @param index - Position in der Liste
 * @param instanceId - Symbol-ID der Listen-Instanz
 * @returns ItemData-Objekt mit dem Symbol-Key
 */
export function getItemData<Item>({
  item,
  index,
  instanceId,
}: {
  item: Item;
  index: number;
  instanceId: symbol;
}): ItemData<Item> {
  return {
    [itemKey]: true,
    item,
    index,
    instanceId,
  };
}

/**
 * Type-Guard: Prüft ob die Daten ein ItemData-Objekt sind.
 *
 * @param data - Die zu prüfenden Daten
 * @returns true wenn die Daten den itemKey-Symbol enthalten
 */
export function isItemData<T>(
  data: Record<string | symbol, unknown>,
): data is ItemData<T> {
  return data[itemKey] === true;
}


/**
 * Erstellt eine Registry für DnD-Items, um DOM-Elemente per UID nachzuschlagen.
 * Wird für das Post-Move-Flash-Highlighting verwendet.
 *
 * @returns Objekt mit `register` und `getElement` Methoden
 */
export function getItemRegistry() {
  const registry = new Map<string, HTMLElement>();

  function register({itemUiId, element}: ItemEntry) {
    registry.set(itemUiId, element);

    return function unregister() {
      registry.delete(itemUiId);
    };
  }

  function getElement(itemId: string): HTMLElement | null {
    return registry.get(itemId) ?? null;
  }

  return {register, getElement};
}
