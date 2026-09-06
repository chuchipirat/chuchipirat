/**
 * Tests für stabile Zeilen-IDs auf ShoppingListItem (Track A).
 *
 * - `createEmptyListItem` und `addItem` (neuer Eintrag) minten eine `id`.
 * - `carryOverItemIds` überträgt die ID unveränderter Positionen von einer
 *   bisherigen Liste auf eine frisch generierte, damit eine Neuberechnung ein
 *   Diff bleibt statt alle Zeilen auszutauschen.
 */
import {ShoppingList, ShoppingListItem, ItemType} from "../shoppingList.class";

const item = (
  uid: string,
  unit: string,
  id: string,
  overrides: Partial<ShoppingListItem> = {},
): ShoppingListItem => ({
  checked: false,
  quantity: 1,
  unit,
  item: {uid, name: `Artikel ${uid}`},
  type: ItemType.custom,
  id,
  ...overrides,
});

const listWith = (items: ShoppingListItem[]): ShoppingList => {
  const shoppingList = new ShoppingList();
  shoppingList.uid = "list-1";
  shoppingList.list = {
    0: {departmentUid: "d0", departmentName: "Abteilung 0", items},
  };
  return shoppingList;
};

describe("ShoppingListItem — stabile IDs", () => {
  test("createEmptyListItem mintet eine nicht-leere id", () => {
    const a = ShoppingList.createEmptyListItem();
    const b = ShoppingList.createEmptyListItem();
    expect(a.id).toEqual(expect.any(String));
    expect(a.id.length).toBeGreaterThan(0);
    expect(a.id).not.toEqual(b.id);
  });

  test("addItem vergibt einem neuen Eintrag eine id, Merge-Branch behält die vorhandene", () => {
    const shoppingList = new ShoppingList();
    const department = {pos: 0, uid: "d0", name: "Abteilung 0"} as never;

    ShoppingList.addItem({
      shoppingListReference: shoppingList,
      item: {uid: "p1", name: "Apfel"} as never,
      quantity: 2,
      unit: "kg",
      department,
      itemType: ItemType.food,
    });
    const created = shoppingList.list[0].items[0];
    expect(created.id).toEqual(expect.any(String));
    expect(created.id.length).toBeGreaterThan(0);

    // Erneutes addItem mit gleichem (uid, unit) → Merge, gleiche id
    ShoppingList.addItem({
      shoppingListReference: shoppingList,
      item: {uid: "p1", name: "Apfel"} as never,
      quantity: 3,
      unit: "kg",
      department,
      itemType: ItemType.food,
    });
    expect(shoppingList.list[0].items).toHaveLength(1);
    expect(shoppingList.list[0].items[0].id).toBe(created.id);
    expect(shoppingList.list[0].items[0].quantity).toBe(5);
  });
});

describe("ShoppingList.carryOverItemIds", () => {
  test("übernimmt bei (uid, unit, pos)-Treffer die alte id, sonst die neue", () => {
    const prev = listWith([
      item("p1", "kg", "old-1"),
      item("p2", "kg", "old-2"),
    ]);
    const next = listWith([
      item("p1", "kg", "new-1"), // Treffer → old-1
      item("p2", "Stk", "new-2"), // andere Einheit → bleibt new-2
      item("p3", "kg", "new-3"), // neu → bleibt new-3
    ]);

    ShoppingList.carryOverItemIds(prev.list, next);

    const byUidUnit = Object.fromEntries(
      next.list[0].items.map((entry) => [`${entry.item.uid}_${entry.unit}`, entry.id]),
    );
    expect(byUidUnit["p1_kg"]).toBe("old-1");
    expect(byUidUnit["p2_Stk"]).toBe("new-2");
    expect(byUidUnit["p3_kg"]).toBe("new-3");
  });

  test("gleicht nur innerhalb derselben Abteilungsposition ab", () => {
    const prev = new ShoppingList();
    prev.list = {
      0: {departmentUid: "d0", departmentName: "A", items: [item("p1", "kg", "old-1")]},
    };
    const next = new ShoppingList();
    next.list = {
      1: {departmentUid: "d1", departmentName: "B", items: [item("p1", "kg", "new-1")]},
    };

    ShoppingList.carryOverItemIds(prev.list, next);

    expect(next.list[1].items[0].id).toBe("new-1");
  });
});
