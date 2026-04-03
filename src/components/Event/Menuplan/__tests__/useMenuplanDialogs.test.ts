/**
 * Unit-Tests für den useMenuplanDialogs-Hook.
 *
 * Prüft, dass alle Dialog-Zustände korrekt initialisiert werden,
 * dass jeder Setter den zugehörigen Zustand aktualisiert und
 * dass die GOODS_DATA_DIALOG_INITIAL_DATA-Konstante exponiert wird.
 */

import {renderHook, act} from "@testing-library/react";

import {GoodsType} from "../menuplan.types";
import {MenuplanDragDropTypes, PlanedObject} from "../menuplan.constants";

// RecipeDrawer-Modul mocken, damit kein echter Import nötig ist
jest.mock("../../../Recipe/RecipeDrawer", () => ({
  RECIPE_DRAWER_DATA_INITIAL_VALUES: {open: false, isLoadingData: false},
}));

// Hook erst nach dem Mock importieren
import {useMenuplanDialogs} from "../useMenuplanDialogs";


/** Prüft, ob alle Dialog-Zustände korrekt initialisiert werden. */
describe("useMenuplanDialogs – Initialwerte", () => {
  it("sollte recipeSearchDrawerData korrekt initialisieren", () => {
    const {result} = renderHook(() => useMenuplanDialogs());

    expect(result.current.recipeSearchDrawerData).toEqual({
      open: false,
      isLoadingData: false,
      menue: null,
    });
  });

  it("sollte recipeSearchResetKey mit 0 initialisieren", () => {
    const {result} = renderHook(() => useMenuplanDialogs());

    expect(result.current.recipeSearchResetKey).toBe(0);
  });

  it("sollte recipeDrawerData mit gemockten RECIPE_DRAWER_DATA_INITIAL_VALUES initialisieren", () => {
    const {result} = renderHook(() => useMenuplanDialogs());

    expect(result.current.recipeDrawerData).toEqual({
      open: false,
      isLoadingData: false,
    });
  });

  it("sollte dialogSelectMenueData korrekt initialisieren", () => {
    const {result} = renderHook(() => useMenuplanDialogs());

    expect(result.current.dialogSelectMenueData).toEqual({
      open: false,
      menues: {},
      selectedRecipe: {},
      singleSelection: false,
      caller: "",
      dragAndDropHandler: {
        listElementUid: "",
        menuUid: "",
        dragAndDropListType: "",
      },
    });
  });

  it("sollte dialogSelectMealData korrekt initialisieren", () => {
    const {result} = renderHook(() => useMenuplanDialogs());

    expect(result.current.dialogSelectMealData).toEqual({
      open: false,
      dragAndDropHandler: {menuUid: "", mealUid: ""},
    });
  });

  it("sollte dialogPlanPortionsData korrekt initialisieren", () => {
    const {result} = renderHook(() => useMenuplanDialogs());

    expect(result.current.dialogPlanPortionsData).toEqual({
      open: false,
      menues: null,
      mealRecipeUid: "",
      portionPlan: [],
      planedMaterial: null,
      planedProduct: null,
      planedObject: PlanedObject.RECIPE,
    });
  });

  it("sollte dialogEditMenue korrekt initialisieren", () => {
    const {result} = renderHook(() => useMenuplanDialogs());

    expect(result.current.dialogEditMenue).toEqual({
      open: false,
      menueUid: "",
    });
  });

  it("sollte dialogGoodsData korrekt initialisieren", () => {
    const {result} = renderHook(() => useMenuplanDialogs());

    expect(result.current.dialogGoodsData).toEqual({
      open: false,
      menueUid: "",
      goodsType: GoodsType.NONE,
      product: null,
      material: null,
    });
  });

  it("sollte dialogPdfOptionsData korrekt initialisieren", () => {
    const {result} = renderHook(() => useMenuplanDialogs());

    expect(result.current.dialogPdfOptionsData).toEqual({
      open: false,
    });
  });
});


/** Prüft, ob jeder Setter seinen Dialog-Zustand korrekt aktualisiert. */
describe("useMenuplanDialogs – Setter", () => {
  it("sollte recipeSearchDrawerData über den Setter aktualisieren", () => {
    const {result} = renderHook(() => useMenuplanDialogs());

    act(() => {
      result.current.setRecipeSearchDrawerData({
        open: true,
        isLoadingData: true,
        menue: null,
      });
    });

    expect(result.current.recipeSearchDrawerData).toEqual({
      open: true,
      isLoadingData: true,
      menue: null,
    });
  });

  it("sollte recipeSearchResetKey über den Setter aktualisieren", () => {
    const {result} = renderHook(() => useMenuplanDialogs());

    act(() => {
      result.current.setRecipeSearchResetKey(42);
    });

    expect(result.current.recipeSearchResetKey).toBe(42);
  });

  it("sollte recipeSearchResetKey mit Updater-Funktion inkrementieren", () => {
    const {result} = renderHook(() => useMenuplanDialogs());

    act(() => {
      result.current.setRecipeSearchResetKey((prev) => prev + 1);
    });

    expect(result.current.recipeSearchResetKey).toBe(1);
  });

  it("sollte recipeDrawerData über den Setter aktualisieren", () => {
    const {result} = renderHook(() => useMenuplanDialogs());

    act(() => {
      result.current.setRecipeDrawerData({
        open: true,
        isLoadingData: true,
      } as any);
    });

    expect(result.current.recipeDrawerData).toEqual({
      open: true,
      isLoadingData: true,
    });
  });

  it("sollte dialogSelectMenueData über den Setter aktualisieren", () => {
    const {result} = renderHook(() => useMenuplanDialogs());

    act(() => {
      result.current.setDialogSelectMenueData({
        open: true,
        menues: {} as any,
        selectedRecipe: {} as any,
        singleSelection: true,
        caller: "test-caller",
        dragAndDropHandler: {
          listElementUid: "uid-1",
          menuUid: "menu-1",
          dragAndDropListType: MenuplanDragDropTypes.MEALRECIPE,
        },
      });
    });

    expect(result.current.dialogSelectMenueData.open).toBe(true);
    expect(result.current.dialogSelectMenueData.singleSelection).toBe(true);
    expect(result.current.dialogSelectMenueData.caller).toBe("test-caller");
    expect(
      result.current.dialogSelectMenueData.dragAndDropHandler.listElementUid
    ).toBe("uid-1");
  });

  it("sollte dialogSelectMealData über den Setter aktualisieren", () => {
    const {result} = renderHook(() => useMenuplanDialogs());

    act(() => {
      result.current.setDialogSelectMealData({
        open: true,
        dragAndDropHandler: {menuUid: "menu-99", mealUid: "meal-42"},
      });
    });

    expect(result.current.dialogSelectMealData).toEqual({
      open: true,
      dragAndDropHandler: {menuUid: "menu-99", mealUid: "meal-42"},
    });
  });

  it("sollte dialogPlanPortionsData über den Setter aktualisieren", () => {
    const {result} = renderHook(() => useMenuplanDialogs());

    act(() => {
      result.current.setDialogPlanPortionsData({
        open: true,
        menues: null,
        mealRecipeUid: "recipe-123",
        portionPlan: [],
        planedMaterial: null,
        planedProduct: null,
        planedObject: PlanedObject.GOOD,
      });
    });

    expect(result.current.dialogPlanPortionsData.open).toBe(true);
    expect(result.current.dialogPlanPortionsData.mealRecipeUid).toBe(
      "recipe-123"
    );
    expect(result.current.dialogPlanPortionsData.planedObject).toBe(
      PlanedObject.GOOD
    );
  });

  it("sollte dialogEditMenue über den Setter aktualisieren", () => {
    const {result} = renderHook(() => useMenuplanDialogs());

    act(() => {
      result.current.setDialogEditMenue({
        open: true,
        menueUid: "menue-abc",
      });
    });

    expect(result.current.dialogEditMenue).toEqual({
      open: true,
      menueUid: "menue-abc",
    });
  });

  it("sollte dialogGoodsData über den Setter aktualisieren", () => {
    const {result} = renderHook(() => useMenuplanDialogs());

    act(() => {
      result.current.setDialogGoodsData({
        open: true,
        menueUid: "menue-xyz",
        goodsType: GoodsType.PRODUCT,
        product: null,
        material: null,
      });
    });

    expect(result.current.dialogGoodsData.open).toBe(true);
    expect(result.current.dialogGoodsData.menueUid).toBe("menue-xyz");
    expect(result.current.dialogGoodsData.goodsType).toBe(GoodsType.PRODUCT);
  });

  it("sollte dialogPdfOptionsData über den Setter aktualisieren", () => {
    const {result} = renderHook(() => useMenuplanDialogs());

    act(() => {
      result.current.setDialogPdfOptionsData({open: true});
    });

    expect(result.current.dialogPdfOptionsData).toEqual({open: true});
  });
});


/** Prüft, ob die Konstante GOODS_DATA_DIALOG_INITIAL_DATA korrekt exponiert wird. */
describe("useMenuplanDialogs – GOODS_DATA_DIALOG_INITIAL_DATA", () => {
  it("sollte GOODS_DATA_DIALOG_INITIAL_DATA als Konstante zurückgeben", () => {
    const {result} = renderHook(() => useMenuplanDialogs());

    expect(result.current.GOODS_DATA_DIALOG_INITIAL_DATA).toEqual({
      open: false,
      menueUid: "",
      goodsType: GoodsType.NONE,
      product: null,
      material: null,
    });
  });

  it("sollte GOODS_DATA_DIALOG_INITIAL_DATA auch nach Setter-Aufrufen unverändert bleiben", () => {
    const {result} = renderHook(() => useMenuplanDialogs());

    // Goods-Dialog öffnen
    act(() => {
      result.current.setDialogGoodsData({
        open: true,
        menueUid: "changed",
        goodsType: GoodsType.MATERIAL,
        product: null,
        material: null,
      });
    });

    // Die Konstante darf sich nicht verändert haben
    expect(result.current.GOODS_DATA_DIALOG_INITIAL_DATA).toEqual({
      open: false,
      menueUid: "",
      goodsType: GoodsType.NONE,
      product: null,
      material: null,
    });
  });
});
