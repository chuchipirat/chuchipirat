/**
 * Auswertung eines Realtime-Echos der Einkaufsliste: Muss die Ansicht
 * aktualisiert werden, welche Positionen haben andere Köch:innen geändert,
 * und welcher DB-Stand gilt danach als Vergleichsbasis?
 */
import {ShoppingList, ShoppingListItem} from "./shoppingList.class";

/**
 * Stabiler Vergleichs-Key für ein Shopping-List-Item — die client-generierte
 * Zeilen-ID, die über Speichervorgänge und Realtime hinweg konstant bleibt.
 */
function shoppingListItemKey(item: ShoppingListItem): string {
  return item.id;
}

/**
 * Prüft, ob zwei Einkaufslisten inhaltlich gleich sind (persistierte Felder je
 * Position). Dient dazu, ein Realtime-Echo zu verwerfen, das nichts Neues
 * bringt — dann muss der State nicht ersetzt und die Liste nicht neu gerendert
 * werden.
 */
function shoppingListsAreEquivalent(
  a: ShoppingList | null,
  b: ShoppingList | null,
): boolean {
  if (!a || !b) return false;
  const signature = (list: ShoppingList): string =>
    Object.values(list.list)
      .flatMap((department) =>
        department.items.map(
          (item) =>
            `${item.id}|${item.quantity}|${item.checked ? 1 : 0}|${item.unit}|` +
            `${item.item.uid}|${item.item.name}`,
        ),
      )
      .sort()
      .join("\n");
  return signature(a) === signature(b);
}

/**
 * Vergleicht zwei ShoppingLists und liefert die IDs der Items zurück,
 * die sich geändert haben oder neu hinzugekommen sind.
 *
 * @param oldList - Bisherige Einkaufsliste (oder null)
 * @param newList - Neu geladene Einkaufsliste
 * @returns Set von geänderten Item-IDs
 */
function getChangedShoppingListItemKeys(
  oldList: ShoppingList | null,
  newList: ShoppingList,
): Set<string> {
  const changed = new Set<string>();

  // Alte Items in eine Map packen: key → {quantity, checked}
  const oldMap = new Map<string, {quantity: number; checked: boolean}>();
  if (oldList) {
    Object.values(oldList.list).forEach((dept) => {
      dept.items.forEach((item) => {
        const key = shoppingListItemKey(item);
        oldMap.set(key, {quantity: item.quantity, checked: item.checked});
      });
    });
  }

  // Neue Items durchgehen und mit alten vergleichen
  Object.values(newList.list).forEach((dept) => {
    dept.items.forEach((item) => {
      const key = shoppingListItemKey(item);
      const old = oldMap.get(key);

      if (!old) {
        // Neues Item
        changed.add(key);
      } else if (
        old.quantity !== item.quantity ||
        old.checked !== item.checked
      ) {
        // Geänderte Menge oder Checkbox
        changed.add(key);
      }
    });
  });

  return changed;
}

/**
 * Ergebnis von {@link classifyShoppingListEcho}.
 *
 * @property apply `true`, wenn die Ansicht den eingetroffenen Stand übernehmen soll.
 * @property changedKeys IDs der Positionen, die andere Köch:innen geändert oder
 *   hinzugefügt haben (zum Hervorheben); leer bei eigenen Saves.
 * @property nextReference DB-Stand, gegen den das nächste Echo verglichen wird.
 *   Der Aufrufer übernimmt ihn **immer**, auch wenn `apply` `false` ist.
 */
export type ShoppingListEchoDecision = {
  apply: boolean;
  changedKeys: Set<string>;
  nextReference: ShoppingList;
};

/**
 * Entscheidet, was mit einem Realtime-Echo der Einkaufsliste geschieht.
 *
 * Läuft ein eigener Save, bleibt die Ansicht beim optimistischen Stand, der
 * eingetroffene DB-Stand wird aber trotzdem Vergleichsbasis. Sonst vergliche
 * das nächste Echo gegen einen alten Stand, und eigene frühere Änderungen
 * leuchteten als fremde auf.
 *
 * @param params.previous Bisherige Vergleichsbasis (letzter bekannter DB-Stand) oder `null`.
 * @param params.incoming Mit dem Echo eingetroffener DB-Stand.
 * @param params.ownSaveInProgress `true`, solange ein eigener Save (samt Nachlauf) läuft.
 * @returns Ob die Ansicht aktualisiert wird, welche Positionen hervorgehoben
 *   werden und die neue Vergleichsbasis.
 * @example
 * const decision = classifyShoppingListEcho({previous, incoming, ownSaveInProgress: false});
 * shoppingListRef.current = decision.nextReference;
 * if (decision.apply) dispatch(…);
 */
export function classifyShoppingListEcho({
  previous,
  incoming,
  ownSaveInProgress,
}: {
  previous: ShoppingList | null;
  incoming: ShoppingList;
  ownSaveInProgress: boolean;
}): ShoppingListEchoDecision {
  const noChanges = new Set<string>();
  if (ownSaveInProgress || shoppingListsAreEquivalent(previous, incoming)) {
    return {apply: false, changedKeys: noChanges, nextReference: incoming};
  }

  // Ohne Vergleichsbasis oder bei leerer Liste nichts hervorheben
  const itemCount = Object.values(incoming.list).reduce(
    (sum, department) => sum + department.items.length,
    0,
  );
  const changedKeys =
    previous && itemCount > 0
      ? getChangedShoppingListItemKeys(previous, incoming)
      : noChanges;
  return {apply: true, changedKeys, nextReference: incoming};
}
