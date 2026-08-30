/**
 * Unit-Tests für moveItemToDepartment (useShoppingListHandlers.tsx).
 *
 * Regression CHUCHIPIRAT-GQ: Wird ein bestehender Artikel per Autocomplete
 * auf ein Produkt einer Abteilung geändert, die in `shoppingList.list` noch
 * gar nicht existiert, warf `shoppingList.list[toDepartment.pos].items.push`
 * einen TypeError. Die Zielabteilung muss vorher angelegt werden.
 */
// Polyfill für jsdom (react-router wird transitiv über event.tsx geladen)
import {TextEncoder, TextDecoder} from "util";
Object.assign(globalThis, {TextEncoder, TextDecoder});

// @react-pdf/renderer ist ESM-only und wird von Jest nicht transformiert —
// useShoppingListHandlers.tsx importiert transitiv davon.
jest.mock("@react-pdf/renderer", () => ({
  Document: () => null,
  Page: () => null,
  View: () => null,
  Text: () => null,
  Link: () => null,
  Svg: () => null,
  Path: () => null,
  Font: {register: jest.fn(), registerEmojiSource: jest.fn()},
  StyleSheet: {create: (styles: unknown) => styles},
  pdf: jest.fn(),
}));
jest.mock("@react-pdf/types", () => ({}));
jest.mock("../../../Shared/pdfFontRegistration", () => ({}));

import {moveItemToDepartment} from "../useShoppingListHandlers";
import {
  ShoppingList,
  ShoppingListItem,
  ItemType,
} from "../shoppingList.class";
import Department from "../../../Department/department.class";

/* =====================================================================
// Hilfsfunktionen
// ===================================================================== */

/** Erzeugt ein minimales ShoppingListItem mit gegebener UID. */
const createItem = (uid: string): ShoppingListItem => ({
  checked: false,
  quantity: 1,
  unit: "kg",
  item: {uid, name: `Artikel ${uid}`},
  type: ItemType.food,
});

/** Erzeugt eine Abteilung mit Position und UID. */
const createDepartment = (pos: number, uid: string, name: string): Department => {
  const department = new Department();
  department.pos = pos;
  department.uid = uid;
  department.name = name;
  return department;
};

/* =====================================================================
// Tests
// ===================================================================== */

describe("moveItemToDepartment", () => {
  test("legt eine fehlende Zielabteilung an und verschiebt den bestehenden Artikel (Regression GQ)", () => {
    const shoppingList = new ShoppingList();
    const item = createItem("a");
    shoppingList.list[0] = {
      departmentUid: "dep-0",
      departmentName: "Gemüse",
      items: [item],
    };
    const toDepartment = createDepartment(5, "dep-5", "Getränke");

    const moved = moveItemToDepartment({
      shoppingList,
      item,
      fromDepartmentPos: 0,
      toDepartment,
      isNewItem: false,
    });

    expect(moved).toBe(true);
    expect(shoppingList.list[0].items).toHaveLength(0);
    expect(shoppingList.list[5]).toEqual({
      departmentUid: "dep-5",
      departmentName: "Getränke",
      items: [item],
    });
  });

  test("verschiebt einen bestehenden Artikel in eine bereits vorhandene Abteilung", () => {
    const shoppingList = new ShoppingList();
    const item = createItem("a");
    shoppingList.list[0] = {
      departmentUid: "dep-0",
      departmentName: "Gemüse",
      items: [item],
    };
    shoppingList.list[3] = {
      departmentUid: "dep-3",
      departmentName: "Milchprodukte",
      items: [createItem("b")],
    };
    const toDepartment = createDepartment(3, "dep-3", "Milchprodukte");

    const moved = moveItemToDepartment({
      shoppingList,
      item,
      fromDepartmentPos: 0,
      toDepartment,
      isNewItem: false,
    });

    expect(moved).toBe(true);
    expect(shoppingList.list[0].items).toHaveLength(0);
    expect(shoppingList.list[3].items.map((entry) => entry.item.uid)).toEqual([
      "b",
      "a",
    ]);
  });

  test("legt eine fehlende Zielabteilung für ein neues Item an", () => {
    const shoppingList = new ShoppingList();
    const item = createItem("neu");
    const toDepartment = createDepartment(7, "dep-7", "Tiefkühl");

    const moved = moveItemToDepartment({
      shoppingList,
      item,
      fromDepartmentPos: 0,
      toDepartment,
      isNewItem: true,
    });

    expect(moved).toBe(true);
    expect(shoppingList.list[7].items).toEqual([item]);
  });

  test("gibt false zurück, wenn Ziel- und Ausgangsabteilung identisch sind (bestehendes Item)", () => {
    const shoppingList = new ShoppingList();
    const item = createItem("a");
    shoppingList.list[2] = {
      departmentUid: "dep-2",
      departmentName: "Brot",
      items: [item],
    };
    const toDepartment = createDepartment(2, "dep-2", "Brot");

    const moved = moveItemToDepartment({
      shoppingList,
      item,
      fromDepartmentPos: 2,
      toDepartment,
      isNewItem: false,
    });

    expect(moved).toBe(false);
    expect(shoppingList.list[2].items).toEqual([item]);
  });
});
