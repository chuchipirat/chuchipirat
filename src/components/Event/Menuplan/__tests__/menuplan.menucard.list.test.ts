/**
 * Unit-Tests fuer die Type Guards und Daten-Getter in menuplan.menucard.list.tsx.
 *
 * Getestet werden die exportierten Hilfsfunktionen fuer Drag-&-Drop-Daten
 * der Listeneintraege innerhalb einer Menue-Karte: Getter-Funktionen,
 * Type Guards und die flache Objektvergleichsfunktion.
 */

// Transitive Abhängigkeiten mocken (Pfade relativ zum Test in __tests__/)
jest.mock("../../../../constants/styles", () => () => ({}));
jest.mock("../../../../constants/text", () =>
  new Proxy({}, {get: () => ""})
);
jest.mock("../menuplan", () => ({
  MenuplanDragDropTypes: {
    MEALTYPE: "MEALTYPE",
    MENU: "MENU",
    MEALRECIPE: "RECIPE",
    PRODUCT: "PRODUCT",
    MATERIAL: "MATERIAL",
  },
  generatePlanedPortionsText: jest.fn(),
}));

import {MenuplanDragDropTypes} from "../menuplan.constants";
import {
  getCardListItemData,
  isCardListData,
  isDraggingACardListItem,
  isCardListType,
  getCardListDropTargetData,
  isCardListDropTargetData,
  getListContainerDropTargetData,
  isListContainerDropTargetData,
  isShallowEqual,
  TListItem,
} from "../menuplan.menucard.list";

// Mock-DOMRect fuer alle Tests
const mockRect = {
  x: 0,
  y: 0,
  width: 100,
  height: 50,
  top: 0,
  right: 100,
  bottom: 50,
  left: 0,
  toJSON: () => {},
} as DOMRect;

// Beispiel-ListItem fuer die Tests
const mockListItem: TListItem = {
  id: "item-1",
  primaryText: "Testprodukt",
  secondaryText: null,
  type: MenuplanDragDropTypes.PRODUCT,
};

/* ===================================================================
// ======================== getCardListItemData =======================
// =================================================================== */
/** Getter fuer Drag-Daten eines Listeneintrags */
describe("getCardListItemData", () => {
  it("gibt ein Objekt mit den uebergebenen Feldern zurueck", () => {
    const data = getCardListItemData({
      listItem: mockListItem,
      rect: mockRect,
      menueUid: "menue-1",
      itemType: MenuplanDragDropTypes.PRODUCT,
    });

    expect(data.listItem).toBe(mockListItem);
    expect(data.rect).toBe(mockRect);
    expect(data.menueUid).toBe("menue-1");
    expect(data.itemType).toBe(MenuplanDragDropTypes.PRODUCT);
  });

  it("erzeugt Daten, die von isCardListData erkannt werden", () => {
    const data = getCardListItemData({
      listItem: mockListItem,
      rect: mockRect,
      menueUid: "menue-1",
      itemType: MenuplanDragDropTypes.PRODUCT,
    });

    expect(isCardListData(data)).toBe(true);
  });
});

/* ===================================================================
// =========================== isCardListData ========================
// =================================================================== */
/** Type Guard fuer Listeneintrag-Drag-Daten */
describe("isCardListData", () => {
  it("gibt true zurueck fuer gueltige Daten (via Getter erzeugt)", () => {
    const data = getCardListItemData({
      listItem: mockListItem,
      rect: mockRect,
      menueUid: "menue-1",
      itemType: MenuplanDragDropTypes.PRODUCT,
    });

    expect(isCardListData(data)).toBe(true);
  });

  it("gibt false zurueck fuer ein leeres Objekt", () => {
    expect(isCardListData({})).toBe(false);
  });

  it("gibt false zurueck fuer ein Objekt ohne Symbol-Key", () => {
    const fakeData = {
      itemType: MenuplanDragDropTypes.PRODUCT,
      listItem: mockListItem,
      rect: mockRect,
      menueUid: "menue-1",
    };

    expect(isCardListData(fakeData)).toBe(false);
  });
});

/* ===================================================================
// ===================== isDraggingACardListItem ======================
// =================================================================== */
/** Prueft, ob eine Drag-Quelle ein Listeneintrag ist */
describe("isDraggingACardListItem", () => {
  it("gibt true zurueck, wenn source.data gueltige Listeneintrag-Daten enthaelt", () => {
    const data = getCardListItemData({
      listItem: mockListItem,
      rect: mockRect,
      menueUid: "menue-1",
      itemType: MenuplanDragDropTypes.PRODUCT,
    });

    expect(isDraggingACardListItem({source: {data}})).toBe(true);
  });

  it("gibt false zurueck, wenn source.data keine Listeneintrag-Daten enthaelt", () => {
    expect(isDraggingACardListItem({source: {data: {}}})).toBe(false);
  });
});

/* ===================================================================
// ========================== isCardListType =========================
// =================================================================== */
/** Prueft, ob der itemType einer Drag-Quelle dem gewuenschten Typ entspricht */
describe("isCardListType", () => {
  it("gibt true zurueck, wenn itemType mit cardType uebereinstimmt", () => {
    const data = getCardListItemData({
      listItem: mockListItem,
      rect: mockRect,
      menueUid: "menue-1",
      itemType: MenuplanDragDropTypes.PRODUCT,
    });

    expect(
      isCardListType({source: {data}, cardType: MenuplanDragDropTypes.PRODUCT})
    ).toBe(true);
  });

  it("gibt false zurueck, wenn itemType nicht uebereinstimmt", () => {
    const data = getCardListItemData({
      listItem: mockListItem,
      rect: mockRect,
      menueUid: "menue-1",
      itemType: MenuplanDragDropTypes.PRODUCT,
    });

    expect(
      isCardListType({
        source: {data},
        cardType: MenuplanDragDropTypes.MATERIAL,
      })
    ).toBe(false);
  });

  it("gibt false zurueck bei leerem source.data (kein itemType vorhanden)", () => {
    expect(
      isCardListType({
        source: {data: {}},
        cardType: MenuplanDragDropTypes.PRODUCT,
      })
    ).toBe(false);
  });
});

/* ===================================================================
// =================== getCardListDropTargetData =====================
// =================================================================== */
/** Getter fuer Drop-Target-Daten eines Listeneintrags */
describe("getCardListDropTargetData", () => {
  it("gibt ein Objekt mit den uebergebenen Feldern zurueck", () => {
    const data = getCardListDropTargetData({
      listItem: mockListItem,
      menueUid: "menue-1",
    });

    expect(data.listItem).toBe(mockListItem);
    expect(data.menueUid).toBe("menue-1");
  });

  it("erzeugt Daten, die von isCardListDropTargetData erkannt werden", () => {
    const data = getCardListDropTargetData({
      listItem: mockListItem,
      menueUid: "menue-1",
    });

    expect(isCardListDropTargetData(data)).toBe(true);
  });
});

/* ===================================================================
// ==================== isCardListDropTargetData ======================
// =================================================================== */
/** Type Guard fuer Listeneintrag-Drop-Target-Daten */
describe("isCardListDropTargetData", () => {
  it("gibt true zurueck fuer gueltige Daten (via Getter erzeugt)", () => {
    const data = getCardListDropTargetData({
      listItem: mockListItem,
      menueUid: "menue-1",
    });

    expect(isCardListDropTargetData(data)).toBe(true);
  });

  it("gibt false zurueck fuer ein leeres Objekt", () => {
    expect(isCardListDropTargetData({})).toBe(false);
  });

  it("gibt false zurueck fuer ein Objekt ohne Symbol-Key", () => {
    const fakeData = {
      listItem: mockListItem,
      menueUid: "menue-1",
    };

    expect(isCardListDropTargetData(fakeData)).toBe(false);
  });
});

/* ===================================================================
// ================ getListContainerDropTargetData ===================
// =================================================================== */
/** Getter fuer Container-Drop-Target-Daten einer Listencontainer */
describe("getListContainerDropTargetData", () => {
  it("gibt ein Objekt mit den uebergebenen Feldern zurueck", () => {
    const data = getListContainerDropTargetData({
      menueUid: "menue-1",
      listType: MenuplanDragDropTypes.PRODUCT,
      isEmpty: false,
    });

    expect(data.menueUid).toBe("menue-1");
    expect(data.listType).toBe(MenuplanDragDropTypes.PRODUCT);
    expect(data.isEmpty).toBe(false);
  });

  it("erzeugt Daten, die von isListContainerDropTargetData erkannt werden", () => {
    const data = getListContainerDropTargetData({
      menueUid: "menue-1",
      listType: MenuplanDragDropTypes.PRODUCT,
      isEmpty: true,
    });

    expect(isListContainerDropTargetData(data)).toBe(true);
  });
});

/* ===================================================================
// ================ isListContainerDropTargetData ====================
// =================================================================== */
/** Type Guard fuer Container-Drop-Target-Daten */
describe("isListContainerDropTargetData", () => {
  it("gibt true zurueck fuer gueltige Daten (via Getter erzeugt)", () => {
    const data = getListContainerDropTargetData({
      menueUid: "menue-1",
      listType: MenuplanDragDropTypes.PRODUCT,
      isEmpty: false,
    });

    expect(isListContainerDropTargetData(data)).toBe(true);
  });

  it("gibt false zurueck fuer ein leeres Objekt", () => {
    expect(isListContainerDropTargetData({})).toBe(false);
  });

  it("gibt false zurueck fuer ein Objekt ohne Symbol-Key", () => {
    const fakeData = {
      menueUid: "menue-1",
      listType: MenuplanDragDropTypes.PRODUCT,
      isEmpty: false,
    };

    expect(isListContainerDropTargetData(fakeData)).toBe(false);
  });
});

/* ===================================================================
// ========================= isShallowEqual ==========================
// =================================================================== */
/** Flacher Objektvergleich */
describe("isShallowEqual", () => {
  it("gibt true zurueck fuer zwei gleiche Objekte", () => {
    const obj1 = {a: 1, b: "test", c: true};
    const obj2 = {a: 1, b: "test", c: true};

    expect(isShallowEqual(obj1, obj2)).toBe(true);
  });

  it("gibt false zurueck fuer unterschiedliche Werte", () => {
    const obj1 = {a: 1, b: "test"};
    const obj2 = {a: 1, b: "anders"};

    expect(isShallowEqual(obj1, obj2)).toBe(false);
  });

  it("gibt false zurueck bei unterschiedlicher Anzahl an Keys", () => {
    const obj1 = {a: 1, b: 2};
    const obj2 = {a: 1, b: 2, c: 3};

    expect(isShallowEqual(obj1, obj2)).toBe(false);
  });

  it("gibt true zurueck fuer identische Referenzen", () => {
    const obj = {a: 1, b: 2};

    expect(isShallowEqual(obj, obj)).toBe(true);
  });

  it("gibt true zurueck fuer zwei leere Objekte", () => {
    expect(isShallowEqual({}, {})).toBe(true);
  });

  it("gibt true zurueck fuer NaN-Werte (Object.is behandelt NaN korrekt)", () => {
    const obj1 = {a: NaN};
    const obj2 = {a: NaN};

    expect(isShallowEqual(obj1, obj2)).toBe(true);
  });
});
