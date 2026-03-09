/**
 * Unit-Tests fuer die Type Guards und Daten-Getter in menuplan.menucard.tsx.
 *
 * Getestet werden die exportierten Hilfsfunktionen fuer Drag-&-Drop-Daten:
 * Getter-Funktionen, Type Guards und die flache Objektvergleichsfunktion.
 */

// Transitive Abhängigkeiten mocken (Pfade relativ zum Test in __tests__/)
jest.mock("../menuplan.menucard.list", () => ({
  isDraggingACardListItem: jest.fn(),
  getListContainerDropTargetData: jest.fn(),
  MenueCardList: () => null,
}));
jest.mock("../menuplanService", () => ({createEmptyNote: jest.fn()}));
jest.mock("../../../Shared/customDialogContext", () => ({
  useCustomDialog: () => ({customDialog: jest.fn()}),
  DialogType: {},
}));
jest.mock("../highlightContext", () => ({
  HighlightedMenueContext: {
    Provider: ({children}: any) => children,
    Consumer: ({children}: any) => children(new Set()),
  },
}));
jest.mock("../../../../constants/styles", () => () => ({}));
jest.mock("../../../../constants/text", () =>
  new Proxy({}, {get: () => ""})
);
jest.mock("../../../../constants/actions", () => ({
  __esModule: true,
  default: {ADD: "ADD", EDIT: "EDIT", DELETE: "DELETE"},
}));
jest.mock("../../../Shared/utils.class", () => ({
  __esModule: true,
  default: {isSafari: () => false},
}));
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
  getMenueCardData,
  isMenueCardData,
  isDraggingAMenueCard,
  isMenueCardType,
  getMenueCardDropTargetData,
  isMenueCardDropTargetData,
  getMenueCardContainerDropTargetData,
  isMenueCardContainerDropTargetData,
  isShallowEqual,
  TMenueCard,
} from "../menuplan.menucard";

// Mock-DOMRect fuer alle Tests
const mockRect = {
  x: 0, y: 0, width: 100, height: 50,
  top: 0, right: 100, bottom: 50, left: 0,
  toJSON: () => {},
} as DOMRect;

// Beispiel-MenueCard
const mockMenueCard: TMenueCard = {
  id: "menue-1",
  menue: {
    uid: "menue-1",
    name: "Testmenue",
    mealRecipeOrder: [],
    materialOrder: [],
    productOrder: [],
  },
  mealUid: "meal-1",
  type: MenuplanDragDropTypes.MENU,
};

/* ===================================================================
// ========================= getMenueCardData ========================
// =================================================================== */
describe("getMenueCardData", () => {
  it("gibt ein Objekt mit den uebergebenen Feldern zurueck", () => {
    const data = getMenueCardData({
      listItem: mockMenueCard,
      rect: mockRect,
      mealUid: "meal-1",
      itemType: MenuplanDragDropTypes.MENU,
    });

    expect(data.listItem).toBe(mockMenueCard);
    expect(data.rect).toBe(mockRect);
    expect(data.mealUid).toBe("meal-1");
    expect(data.itemType).toBe(MenuplanDragDropTypes.MENU);
  });

  it("erzeugt Daten, die von isMenueCardData erkannt werden", () => {
    const data = getMenueCardData({
      listItem: mockMenueCard,
      rect: mockRect,
      mealUid: "meal-1",
      itemType: MenuplanDragDropTypes.MENU,
    });

    expect(isMenueCardData(data)).toBe(true);
  });
});

/* ===================================================================
// ========================= isMenueCardData =========================
// =================================================================== */
describe("isMenueCardData", () => {
  it("gibt true zurueck fuer gueltige Daten (via Getter erzeugt)", () => {
    const data = getMenueCardData({
      listItem: mockMenueCard,
      rect: mockRect,
      mealUid: "meal-1",
      itemType: MenuplanDragDropTypes.MENU,
    });

    expect(isMenueCardData(data)).toBe(true);
  });

  it("gibt false zurueck fuer ein leeres Objekt", () => {
    expect(isMenueCardData({})).toBe(false);
  });

  it("gibt false zurueck fuer ein Objekt ohne Symbol-Key", () => {
    const fakeData = {
      itemType: MenuplanDragDropTypes.MENU,
      listItem: mockMenueCard,
      rect: mockRect,
      mealUid: "meal-1",
    };
    expect(isMenueCardData(fakeData)).toBe(false);
  });
});

/* ===================================================================
// ====================== isDraggingAMenueCard =======================
// =================================================================== */
describe("isDraggingAMenueCard", () => {
  it("gibt true zurueck fuer gueltige Menue-Karten-Daten", () => {
    const data = getMenueCardData({
      listItem: mockMenueCard,
      rect: mockRect,
      mealUid: "meal-1",
      itemType: MenuplanDragDropTypes.MENU,
    });
    expect(isDraggingAMenueCard({source: {data}})).toBe(true);
  });

  it("gibt false zurueck fuer leere source.data", () => {
    expect(isDraggingAMenueCard({source: {data: {}}})).toBe(false);
  });
});

/* ===================================================================
// ========================= isMenueCardType =========================
// =================================================================== */
describe("isMenueCardType", () => {
  it("gibt true zurueck wenn itemType uebereinstimmt", () => {
    const data = getMenueCardData({
      listItem: mockMenueCard,
      rect: mockRect,
      mealUid: "meal-1",
      itemType: MenuplanDragDropTypes.MENU,
    });
    expect(
      isMenueCardType({source: {data}, cardType: MenuplanDragDropTypes.MENU})
    ).toBe(true);
  });

  it("gibt false zurueck wenn itemType nicht uebereinstimmt", () => {
    const data = getMenueCardData({
      listItem: mockMenueCard,
      rect: mockRect,
      mealUid: "meal-1",
      itemType: MenuplanDragDropTypes.MENU,
    });
    expect(
      isMenueCardType({source: {data}, cardType: MenuplanDragDropTypes.PRODUCT})
    ).toBe(false);
  });
});

/* ===================================================================
// =================== Drop-Target-Daten-Getter ======================
// =================================================================== */
describe("getMenueCardDropTargetData", () => {
  it("gibt ein Objekt zurueck, das isMenueCardDropTargetData erkennt", () => {
    const data = getMenueCardDropTargetData({
      listItem: mockMenueCard,
      rect: mockRect,
      mealUid: "meal-1",
    });
    expect(data.listItem).toBe(mockMenueCard);
    expect(isMenueCardDropTargetData(data)).toBe(true);
  });
});

describe("isMenueCardDropTargetData", () => {
  it("gibt false zurueck fuer leeres Objekt", () => {
    expect(isMenueCardDropTargetData({})).toBe(false);
  });
});

describe("getMenueCardContainerDropTargetData", () => {
  it("gibt ein Objekt zurueck, das isMenueCardContainerDropTargetData erkennt", () => {
    const data = getMenueCardContainerDropTargetData({
      mealUid: "meal-1",
      listType: MenuplanDragDropTypes.MENU,
      isEmpty: true,
    });
    expect(data.mealUid).toBe("meal-1");
    expect(isMenueCardContainerDropTargetData(data)).toBe(true);
  });
});

describe("isMenueCardContainerDropTargetData", () => {
  it("gibt false zurueck fuer leeres Objekt", () => {
    expect(isMenueCardContainerDropTargetData({})).toBe(false);
  });
});

/* ===================================================================
// ========================= isShallowEqual ==========================
// =================================================================== */
describe("isShallowEqual", () => {
  it("gibt true fuer gleiche Objekte", () => {
    expect(isShallowEqual({a: 1, b: "x"}, {a: 1, b: "x"})).toBe(true);
  });

  it("gibt false fuer unterschiedliche Werte", () => {
    expect(isShallowEqual({a: 1}, {a: 2})).toBe(false);
  });

  it("gibt false bei unterschiedlicher Key-Anzahl", () => {
    expect(isShallowEqual({a: 1, b: 2}, {a: 1})).toBe(false);
  });

  it("gibt true fuer leere Objekte", () => {
    expect(isShallowEqual({}, {})).toBe(true);
  });

  it("gibt true fuer NaN-Werte", () => {
    expect(isShallowEqual({a: NaN}, {a: NaN})).toBe(true);
  });
});
