/**
 * Unit-Tests für ShoppingList.deleteItem.
 *
 * Regression CHUCHIPIRAT-GS: Wurde "Löschen" im Kontextmenü für ein Item einer
 * Abteilung getippt, die in shoppingList.list nicht (mehr) existierte (z.B.
 * Doppel-Tap oder zwischenzeitliches Realtime-Update), warf
 * `updatedShoppingList.list[departmentKey].items.filter` einen TypeError.
 */
import {
  ShoppingList,
  ShoppingListItem,
  ItemType,
} from "../shoppingList.class";

/** Erzeugt ein ShoppingListItem. */
const createItem = (
  uid: string,
  unit: string,
  overrides: Partial<ShoppingListItem> = {},
): ShoppingListItem => ({
  checked: false,
  quantity: 1,
  unit,
  item: {uid, name: `Artikel ${uid}`},
  type: ItemType.food,
  ...overrides,
});

/** Baut eine ShoppingList mit den gegebenen Abteilungen. */
const buildList = (
  departments: Record<number, ShoppingListItem[]>,
): ShoppingList => {
  const list = new ShoppingList();
  list.list = {};
  for (const [pos, items] of Object.entries(departments)) {
    list.list[Number(pos)] = {
      departmentUid: `dep-${pos}`,
      departmentName: `Abteilung ${pos}`,
      items,
    };
  }
  return list;
};

describe("ShoppingList.deleteItem", () => {
  test("entfernt das passende Item aus der Abteilung", () => {
    const list = buildList({
      2: [createItem("a", "kg"), createItem("b", "kg")],
    });

    const result = ShoppingList.deleteItem({
      shoppingListReference: list,
      departmentKey: 2,
      unit: "kg",
      itemUid: "a",
    });

    expect(result.list[2].items.map((item) => item.item.uid)).toEqual(["b"]);
  });

  test("löscht die Abteilung, wenn sie danach leer ist", () => {
    const list = buildList({2: [createItem("a", "kg")]});

    const result = ShoppingList.deleteItem({
      shoppingListReference: list,
      departmentKey: 2,
      unit: "kg",
      itemUid: "a",
    });

    expect(result.list[2]).toBeUndefined();
  });

  test("unterscheidet Items nach Einheit", () => {
    const list = buildList({
      2: [createItem("a", "kg"), createItem("a", "Stk")],
    });

    const result = ShoppingList.deleteItem({
      shoppingListReference: list,
      departmentKey: 2,
      unit: "kg",
      itemUid: "a",
    });

    expect(result.list[2].items.map((item) => item.unit)).toEqual(["Stk"]);
  });

  test("gibt die Liste unverändert zurück, wenn die Abteilung nicht existiert (Regression GS)", () => {
    const list = buildList({2: [createItem("a", "kg")]});

    const result = ShoppingList.deleteItem({
      shoppingListReference: list,
      departmentKey: 7,
      unit: "kg",
      itemUid: "a",
    });

    expect(result.list[2].items.map((item) => item.item.uid)).toEqual(["a"]);
    expect(result.list[7]).toBeUndefined();
  });

  test("mutiert die übergebene Liste nicht", () => {
    const list = buildList({2: [createItem("a", "kg"), createItem("b", "kg")]});

    ShoppingList.deleteItem({
      shoppingListReference: list,
      departmentKey: 2,
      unit: "kg",
      itemUid: "a",
    });

    expect(list.list[2].items.map((item) => item.item.uid)).toEqual(["a", "b"]);
  });
});
