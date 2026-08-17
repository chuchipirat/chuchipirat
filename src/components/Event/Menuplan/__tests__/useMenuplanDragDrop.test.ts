/**
 * Unit-Tests für useMenuplanDragDrop.ts.
 *
 * Fokus: onMoveDragAndDropElement mit direction "inOtherMenu" — stellt
 * sicher, dass der Menü-Auswahl-Dialog mit dem korrekten `caller`-Wert
 * geöffnet wird, damit onDialogSelectMenueContinue (useMenuplanHandlers.tsx)
 * den direkten Verschiebe-Pfad nimmt statt den Portionen-Dialog zu öffnen.
 */
import {TextEncoder, TextDecoder} from "util";
Object.assign(globalThis, {TextEncoder, TextDecoder});

// @react-pdf/renderer ist ESM-only und wird von Jest nicht transformiert —
// useMenuplanDragDrop.ts importiert transitiv davon (via menuplan.menucard.tsx
// → menuplan.tsx → RecipeDrawer.tsx → recipe.view.tsx → pdfUtils.ts).
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

import {renderHook, act} from "@testing-library/react";
import {useMenuplanDragDrop} from "../useMenuplanDragDrop";
import {MenuplanDragDropTypes} from "../menuplan.constants";
import type {MenuplanData} from "../menuplan.types";

function buildMenuplan(): MenuplanData {
  return {
    meals: {},
    menues: {
      "menue-1": {
        uid: "menue-1",
        name: "Menü 1",
        mealRecipeOrder: ["recipe-1"],
        materialOrder: [],
        productOrder: [],
      },
    },
    mealRecipes: {},
    products: {},
    materials: {},
    notes: {},
    mealTypes: {entries: {}, order: []},
  } as unknown as MenuplanData;
}

describe("useMenuplanDragDrop — onMoveDragAndDropElement (inOtherMenu)", () => {
  it("sollte den Menü-Auswahl-Dialog mit caller 'onMoveDragAndDropElement' öffnen (RECIPE)", () => {
    const setDialogSelectMenueData = jest.fn();
    const setDialogSelectMealData = jest.fn();
    const scrollableRef = {current: document.createElement("div")};

    const {result} = renderHook(() =>
      useMenuplanDragDrop({
        menuplan: buildMenuplan(),
        scrollableRef,
        onMenuplanUpdateSuper: jest.fn(),
        setDialogSelectMenueData,
        setDialogSelectMealData,
      }),
    );

    act(() => {
      result.current.onMoveDragAndDropElement({
        kind: MenuplanDragDropTypes.MEALRECIPE,
        direction: "inOtherMenu",
        menueUid: "menue-1",
        itemUid: "recipe-1",
      });
    });

    expect(setDialogSelectMenueData).toHaveBeenCalledWith(
      expect.objectContaining({
        open: true,
        caller: "onMoveDragAndDropElement",
        dragAndDropHandler: {
          listElementUid: "recipe-1",
          menuUid: "menue-1",
          dragAndDropListType: MenuplanDragDropTypes.MEALRECIPE,
        },
      }),
    );
    expect(setDialogSelectMealData).not.toHaveBeenCalled();
  });

  it("sollte den Menü-Auswahl-Dialog mit caller 'onMoveDragAndDropElement' öffnen (PRODUCT)", () => {
    const setDialogSelectMenueData = jest.fn();
    const scrollableRef = {current: document.createElement("div")};

    const {result} = renderHook(() =>
      useMenuplanDragDrop({
        menuplan: buildMenuplan(),
        scrollableRef,
        onMenuplanUpdateSuper: jest.fn(),
        setDialogSelectMenueData,
        setDialogSelectMealData: jest.fn(),
      }),
    );

    act(() => {
      result.current.onMoveDragAndDropElement({
        kind: MenuplanDragDropTypes.PRODUCT,
        direction: "inOtherMenu",
        menueUid: "menue-1",
        itemUid: "product-1",
      });
    });

    expect(setDialogSelectMenueData).toHaveBeenCalledWith(
      expect.objectContaining({caller: "onMoveDragAndDropElement"}),
    );
  });
});
