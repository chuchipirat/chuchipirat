/**
 * Unit-Tests für formatShoppingList (PDF-Seitenumbruch-Logik).
 *
 * Regressionstest für einen Bug, bei dem eine sehr kurze Einkaufsliste
 * (z.B. 1 Abteilung mit 1 Artikel) die Abteilungsüberschrift auf einer
 * Seite und den zugehörigen Artikel auf der nächsten Seite platzierte.
 *
 * @react-pdf/renderer wird gemockt, da die ESM-Module nicht von Jest
 * transformiert werden (siehe menuplanPdf.test.tsx für dasselbe Muster).
 */

jest.mock("@react-pdf/renderer", () => {
  const React = jest.requireActual("react");
  const createComponent = (name: string) =>
    React.forwardRef((props: any, _ref: any) =>
      React.createElement(name, null, props.children)
    );
  return {
    Document: createComponent("Document"),
    Page: createComponent("Page"),
    View: createComponent("View"),
    Text: createComponent("Text"),
    Font: {
      register: jest.fn(),
      registerEmojiSource: jest.fn(),
    },
    StyleSheet: {
      create: <T extends Record<string, any>>(styles: T): T => styles,
    },
  };
});
jest.mock("@react-pdf/types", () => ({}));
jest.mock("../../../Shared/pdfFontRegistration", () => ({}));

import {formatShoppingList, LineType} from "../shoppingListPdf";
import {ShoppingList, ItemType} from "../shoppingList.class";

/**
 * Baut eine minimale ShoppingList mit den übergebenen Abteilungen auf.
 *
 * @param departments - Liste von Abteilungen mit Artikelanzahl.
 * @returns ShoppingList-Fixture für formatShoppingList().
 */
function buildShoppingList(
  departments: {name: string; itemCount: number}[],
): ShoppingList {
  const list: ShoppingList["list"] = {};
  departments.forEach((department, pos) => {
    list[pos] = {
      departmentUid: `dept-${pos}`,
      departmentName: department.name,
      items: Array.from({length: department.itemCount}, (_, itemIndex) => ({
        checked: false,
        quantity: itemIndex + 1,
        unit: "kg",
        item: {uid: `item-${pos}-${itemIndex}`, name: `Artikel ${pos}-${itemIndex}`},
        type: ItemType.food,
      })),
    };
  });
  return {uid: "list-1", list} as ShoppingList;
}

describe("formatShoppingList", () => {
  test("Abteilungsüberschrift und ihr einziges Item landen auf derselben Seite (1 Abteilung, 1 Artikel)", () => {
    const shoppingList = buildShoppingList([{name: "Früchte", itemCount: 1}]);

    const pages = formatShoppingList(shoppingList);

    expect(pages).toHaveLength(1);

    const entries = pages[0].list.flatMap((line) => [line.left, line.right]);
    const departmentEntry = entries.find(
      (entry) => entry?.type === LineType.DEPARTMENT,
    );
    const itemEntry = entries.find((entry) => entry?.type === LineType.ITEM);

    expect(departmentEntry).toBeDefined();
    expect(itemEntry).toBeDefined();
  });

  test("funktioniert weiterhin für mehrere Abteilungen mit mehreren Artikeln", () => {
    const shoppingList = buildShoppingList([
      {name: "Früchte", itemCount: 3},
      {name: "Gemüse", itemCount: 2},
    ]);

    const pages = formatShoppingList(shoppingList);

    const entries = pages.flatMap((page) =>
      page.list.flatMap((line) => [line.left, line.right]),
    );
    const departmentNames = entries
      .filter((entry) => entry?.type === LineType.DEPARTMENT)
      .map((entry) => (entry as {name: string}).name);
    const itemCount = entries.filter(
      (entry) => entry?.type === LineType.ITEM,
    ).length;

    expect(departmentNames).toEqual(["Früchte", "Gemüse"]);
    expect(itemCount).toBe(5);
  });

  test("eine Abteilungsüberschrift ist nie der letzte Eintrag einer Seite (Items werden immer direkt danach geschrieben)", () => {
    // Mehrere kleine Abteilungen hintereinander — prüft, dass die
    // Mindestgrösse von 2 Zeilen auch für spätere (Rest-)Seiten gilt,
    // nicht nur für die erste Seite der Liste. Da eine Abteilung immer
    // direkt gefolgt von ihrem ersten Item geschrieben wird, bedeutet eine
    // Überschrift als letzter Eintrag einer Seite, dass das Item auf die
    // nächste Seite verdrängt wurde (genau der gemeldete Bug).
    const shoppingList = buildShoppingList(
      Array.from({length: 6}, (_, index) => ({
        name: `Abteilung ${index}`,
        itemCount: 1,
      })),
    );

    const pages = formatShoppingList(shoppingList);

    pages.forEach((page) => {
      const entries = page.list
        .flatMap((line) => [line.left, line.right])
        .filter((entry) => entry !== null);
      const lastEntry = entries[entries.length - 1];
      if (lastEntry) {
        expect(lastEntry.type).not.toBe(LineType.DEPARTMENT);
      }
    });
  });
});
