/**
 * Unit-Tests für itemsDomainToShoppingList (shoppingListAdapter.ts).
 *
 * Regression „Zeile verschwindet beim langsamen Arbeiten": In `event.tsx`
 * bekommen der Realtime-Vergleichs-Ref (`shoppingListRef`) und der optimistisch
 * mutierte Reducer-State je eine eigene Instanz aus dieser Funktion. Das
 * funktioniert nur, wenn zwei Aufrufe mit derselben Eingabe **referenz-
 * unabhängige** verschachtelte Arrays liefern — sonst leckt eine In-place-
 * Mutation (`list[pos].items.push(...)`) in die Vergleichsbasis.
 */
import {itemsDomainToShoppingList, deriveItemType} from "../shoppingListAdapter";
import {ItemType} from "../shoppingList.class";
import {ShoppingListItemDomain} from "../../../Database/Repository/ShoppingListRepository";

const domainItem = (
  overrides: Partial<ShoppingListItemDomain> = {},
): ShoppingListItemDomain =>
  ({
    id: "row-1",
    listId: "list-1",
    productId: "prod-1",
    materialId: null,
    freeTextName: null,
    itemName: "Äpfel",
    quantity: 3,
    unit: "kg",
    checked: false,
    editSource: "generated",
    departmentPos: 1,
    departmentName: "Früchte",
    departmentId: "dep-1",
    ...overrides,
  }) as ShoppingListItemDomain;

describe("itemsDomainToShoppingList", () => {
  test("gruppiert Items nach Abteilungsposition und überträgt id/supabaseId", () => {
    const list = itemsDomainToShoppingList(
      [
        domainItem({id: "a", departmentPos: 1}),
        domainItem({id: "b", departmentPos: 1}),
        domainItem({id: "c", departmentPos: 5, departmentName: "Getränke"}),
      ],
      "list-1",
    );

    expect(Object.keys(list.list).sort()).toEqual(["1", "5"]);
    expect(list.list[1].items.map((item) => item.id)).toEqual(["a", "b"]);
    expect(list.list[1].items[0].supabaseId).toBe("a");
    expect(list.list[5].items[0].id).toBe("c");
  });

  test("zwei Aufrufe mit derselben Eingabe liefern referenz-unabhängige Arrays", () => {
    const items = [domainItem({id: "a"}), domainItem({id: "b"})];

    const first = itemsDomainToShoppingList(items, "list-1");
    const second = itemsDomainToShoppingList(items, "list-1");

    // Gleicher Inhalt …
    expect(first.list[1].items.map((entry) => entry.id)).toEqual(
      second.list[1].items.map((entry) => entry.id),
    );
    // … aber keine geteilten Referenzen: eine Mutation der einen Instanz darf
    // die andere nicht berühren.
    first.list[1].items.push({
      checked: false,
      quantity: 9,
      unit: "",
      item: {uid: "phantom", name: ""},
      type: ItemType.none,
      id: "phantom",
    });
    expect(second.list[1].items).toHaveLength(2);
    expect(first.list[1].items).not.toBe(second.list[1].items);
  });

  test("deriveItemType leitet den Typ aus der gesetzten Quell-Spalte ab", () => {
    expect(deriveItemType(domainItem({productId: "p", materialId: null, freeTextName: null}))).toBe(ItemType.food);
    expect(deriveItemType(domainItem({productId: null, materialId: "m", freeTextName: null}))).toBe(ItemType.material);
    expect(deriveItemType(domainItem({productId: null, materialId: null, freeTextName: "Hofchäs"}))).toBe(ItemType.custom);
    expect(deriveItemType(domainItem({productId: null, materialId: null, freeTextName: null}))).toBe(ItemType.none);
  });
});
