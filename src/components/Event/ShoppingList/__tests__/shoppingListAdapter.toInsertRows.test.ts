/**
 * Unit-Tests für shoppingListToInsertRows / resolveItemSource
 * (shoppingListAdapter.ts).
 *
 * Regression CHUCHIPIRAT-GH: Eine Position mit Menge, aber ohne Produkt/Name
 * (ItemType.none, leerer Name) erzeugte eine Insert-Zeile ohne product_id,
 * material_id und free_text_name → DB-Constraint chk_item_source (23514).
 */
import {
  shoppingListToInsertRows,
  resolveItemSource,
} from "../shoppingListAdapter";
import {
  ShoppingList,
  ShoppingListItem,
  ItemType,
} from "../shoppingList.class";
import Department from "../../../Department/department.class";

/* =====================================================================
// Hilfsfunktionen
// ===================================================================== */

/** Erzeugt ein ShoppingListItem mit sinnvollen Defaults. */
const createItem = (overrides: Partial<ShoppingListItem> = {}): ShoppingListItem => ({
  checked: false,
  quantity: 1,
  unit: "kg",
  item: {uid: "prod-1", name: "Äpfel"},
  type: ItemType.food,
  ...overrides,
});

/** Erzeugt eine Abteilung. */
const createDepartment = (pos: number, uid: string): Department => {
  const department = new Department();
  department.pos = pos;
  department.uid = uid;
  department.name = `Abteilung ${pos}`;
  return department;
};

/** Baut eine ShoppingList mit einer Abteilung (pos 0) und den gegebenen Items. */
const listWith = (items: ShoppingListItem[]): ShoppingList => {
  const list = new ShoppingList();
  list.list[0] = {departmentUid: "dep-0", departmentName: "Abteilung 0", items};
  return list;
};

const departments = [createDepartment(0, "dep-0")];

/* =====================================================================
// resolveItemSource
// ===================================================================== */

describe("resolveItemSource", () => {
  test("food → product_id", () => {
    expect(
      resolveItemSource(createItem({type: ItemType.food, item: {uid: "p1", name: "X"}})),
    ).toEqual({product_id: "p1"});
  });

  test("material → material_id", () => {
    expect(
      resolveItemSource(createItem({type: ItemType.material, item: {uid: "m1", name: "X"}})),
    ).toEqual({material_id: "m1"});
  });

  test("custom → free_text_name", () => {
    expect(
      resolveItemSource(createItem({type: ItemType.custom, item: {uid: "x", name: "Spezialkäse"}})),
    ).toEqual({free_text_name: "Spezialkäse"});
  });

  test("none mit Name → free_text_name", () => {
    expect(
      resolveItemSource(createItem({type: ItemType.none, item: {uid: "x", name: "Notiz"}})),
    ).toEqual({free_text_name: "Notiz"});
  });

  test("none ohne Name → null", () => {
    expect(
      resolveItemSource(createItem({type: ItemType.none, item: {uid: "x", name: ""}})),
    ).toBeNull();
  });

  test("food ohne uid → null", () => {
    expect(
      resolveItemSource(createItem({type: ItemType.food, item: {uid: "", name: "X"}})),
    ).toBeNull();
  });

  test("custom ohne Name → null", () => {
    expect(
      resolveItemSource(createItem({type: ItemType.custom, item: {uid: "x", name: ""}})),
    ).toBeNull();
  });
});

/* =====================================================================
// shoppingListToInsertRows
// ===================================================================== */

describe("shoppingListToInsertRows", () => {
  test("überspringt eine Position mit Menge, aber ohne Quelle (Regression GH)", () => {
    const list = listWith([
      createItem({type: ItemType.none, quantity: 5, unit: "", item: {uid: "tmp", name: ""}}),
    ]);

    const rows = shoppingListToInsertRows(list, "list-1", departments);

    expect(rows).toHaveLength(0);
  });

  test("erzeugt genau eine Quell-Spalte pro Zeile", () => {
    const list = listWith([
      createItem({type: ItemType.food, item: {uid: "p1", name: "Äpfel"}}),
      createItem({type: ItemType.material, item: {uid: "m1", name: "Frischhaltefolie"}}),
      createItem({type: ItemType.custom, item: {uid: "c1", name: "Hofchäs"}}),
    ]);

    const rows = shoppingListToInsertRows(list, "list-1", departments);

    expect(rows).toHaveLength(3);
    for (const row of rows) {
      const sourceCount = [row.product_id, row.material_id, row.free_text_name].filter(
        (value) => value != null,
      ).length;
      expect(sourceCount).toBe(1);
    }
    expect(rows[0]).toMatchObject({product_id: "p1"});
    expect(rows[1]).toMatchObject({material_id: "m1"});
    expect(rows[2]).toMatchObject({free_text_name: "Hofchäs"});
  });

  test("vergibt fortlaufende sort_order nur für tatsächlich erzeugte Zeilen", () => {
    const list = listWith([
      createItem({type: ItemType.food, item: {uid: "p1", name: "Äpfel"}}),
      createItem({type: ItemType.none, quantity: 3, unit: "", item: {uid: "tmp", name: ""}}),
      createItem({type: ItemType.food, item: {uid: "p2", name: "Birnen"}}),
    ]);

    const rows = shoppingListToInsertRows(list, "list-1", departments);

    expect(rows.map((row) => row.sort_order)).toEqual([0, 1]);
  });

  test("überspringt leere Platzhalter-Items unverändert", () => {
    const list = listWith([
      createItem({type: ItemType.none, quantity: 0, unit: "", item: {uid: "tmp", name: ""}}),
    ]);

    expect(shoppingListToInsertRows(list, "list-1", departments)).toHaveLength(0);
  });
});
