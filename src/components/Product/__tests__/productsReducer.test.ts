/**
 * Unit-Tests fuer den productsReducer.
 *
 * Reine Funktions-Tests ohne Rendering — prueft alle Reducer-Actions
 * auf korrekte State-Transitionen.
 */
import {TextEncoder, TextDecoder} from "util";
Object.assign(global, {TextEncoder, TextDecoder});

import {
  productsReducer,
  ReducerActions,
  initialState,
} from "../useProductsQa";
import type {State, ReducerAction} from "../useProductsQa";
import {products as mockProducts} from "../__mocks__/products.mock";
import {Diet} from "../product.types";
import type {Product} from "../product.types";

import {
  SAVE_SUCCESS as TEXT_SAVE_SUCCESS,
  PRODUCT_CONVERTED_TO_MATERIAL as TEXT_PRODUCT_CONVERTED_TO_MATERIAL,
} from "../../../constants/text";

/* ===================================================================
// ======================== Testdaten =================================
// =================================================================== */

/** Zwei Testprodukte als Basis fuer die meisten Tests. */
const productOktopus = mockProducts[0]; // uid: "okt0"
const productMozzarella = mockProducts[1]; // uid: "mozza"

/** State mit geladenen Produkten. */
const stateWithProducts: State = {
  ...initialState,
  products: [productOktopus, productMozzarella],
};

/* ===================================================================
// ======================== Tests =====================================
// =================================================================== */

describe("productsReducer", () => {
  // ---------------------------------------------------------------
  // 1. PRODUCTS_FETCH_INIT
  // ---------------------------------------------------------------
  test("PRODUCTS_FETCH_INIT setzt isLoading.overall und isLoading.products auf true", () => {
    const action: ReducerAction = {
      type: ReducerActions.PRODUCTS_FETCH_INIT,
    };

    const next = productsReducer(initialState, action);

    expect(next.isLoading.overall).toBe(true);
    expect(next.isLoading.products).toBe(true);
    // Andere Ladezustaende bleiben unveraendert
    expect(next.isLoading.units).toBe(false);
    expect(next.isLoading.departments).toBe(false);
  });

  // ---------------------------------------------------------------
  // 2. PRODUCTS_FETCH_SUCCESS
  // ---------------------------------------------------------------
  test("PRODUCTS_FETCH_SUCCESS ersetzt Produkte, leert changedUids, setzt Loading auf false", () => {
    const loadingState: State = {
      ...initialState,
      isLoading: {...initialState.isLoading, overall: true, products: true},
      changedUids: new Set(["old-uid"]),
    };

    const action: ReducerAction = {
      type: ReducerActions.PRODUCTS_FETCH_SUCCESS,
      payload: [productOktopus, productMozzarella],
    };

    const next = productsReducer(loadingState, action);

    expect(next.products).toEqual([productOktopus, productMozzarella]);
    expect(next.changedUids.size).toBe(0);
    expect(next.isLoading.products).toBe(false);
    // overall ist false wenn keine anderen Ressourcen laden
    expect(next.isLoading.overall).toBe(false);
  });

  // ---------------------------------------------------------------
  // 3. PRODUCT_UPDATED
  // ---------------------------------------------------------------
  test("PRODUCT_UPDATED ersetzt das richtige Produkt und fuegt UID zu changedUids hinzu", () => {
    const updatedProduct: Product = {
      ...productOktopus,
      name: "Pulpo",
    };

    const action: ReducerAction = {
      type: ReducerActions.PRODUCT_UPDATED,
      payload: updatedProduct,
    };

    const next = productsReducer(stateWithProducts, action);

    // Produkt wurde ersetzt
    expect(next.products.find((product) => product.uid === "okt0")?.name).toBe(
      "Pulpo",
    );
    // Andere Produkte bleiben unveraendert
    expect(
      next.products.find((product) => product.uid === "mozza")?.name,
    ).toBe("Mozzarella");
    // UID in changedUids eingetragen
    expect(next.changedUids.has("okt0")).toBe(true);
  });

  // ---------------------------------------------------------------
  // 4. PRODUCTS_SAVED
  // ---------------------------------------------------------------
  test("PRODUCTS_SAVED leert changedUids und zeigt Erfolgs-Snackbar", () => {
    const dirtyState: State = {
      ...stateWithProducts,
      changedUids: new Set(["okt0", "mozza"]),
    };

    const action: ReducerAction = {
      type: ReducerActions.PRODUCTS_SAVED,
    };

    const next = productsReducer(dirtyState, action);

    expect(next.changedUids.size).toBe(0);
    expect(next.snackbar.open).toBe(true);
    expect(next.snackbar.severity).toBe("success");
    expect(next.snackbar.message).toBe(TEXT_SAVE_SUCCESS);
  });

  // ---------------------------------------------------------------
  // 5. PRODUCTS_EDIT_CANCELLED
  // ---------------------------------------------------------------
  test("PRODUCTS_EDIT_CANCELLED stellt Snapshot wieder her und leert changedUids", () => {
    const snapshotProducts = [productOktopus]; // Nur Oktopus war im Snapshot
    const editedState: State = {
      ...stateWithProducts,
      products: [
        {...productOktopus, name: "Pulpo"},
        productMozzarella,
      ],
      changedUids: new Set(["okt0"]),
    };

    const action: ReducerAction = {
      type: ReducerActions.PRODUCTS_EDIT_CANCELLED,
      payload: snapshotProducts,
    };

    const next = productsReducer(editedState, action);

    // Produktliste wurde durch Snapshot ersetzt
    expect(next.products).toEqual(snapshotProducts);
    expect(next.changedUids.size).toBe(0);
  });

  // ---------------------------------------------------------------
  // 6. NEWEST_PRODUCTS_FETCH_SUCCESS
  // ---------------------------------------------------------------
  test("NEWEST_PRODUCTS_FETCH_SUCCESS setzt newestProductUids und Loading auf false", () => {
    const loadingState: State = {
      ...initialState,
      isLoading: {...initialState.isLoading, overall: true},
    };

    const newestUids = ["okt0", "mozza"];
    const action: ReducerAction = {
      type: ReducerActions.NEWEST_PRODUCTS_FETCH_SUCCESS,
      payload: newestUids,
    };

    const next = productsReducer(loadingState, action);

    expect(next.newestProductUids).toEqual(newestUids);
    expect(next.isLoading.overall).toBe(false);
  });

  // ---------------------------------------------------------------
  // 7. NEWEST_PRODUCTS_CLEAR
  // ---------------------------------------------------------------
  test("NEWEST_PRODUCTS_CLEAR leert newestProductUids", () => {
    const stateWithNewest: State = {
      ...initialState,
      newestProductUids: ["okt0", "mozza"],
    };

    const action: ReducerAction = {
      type: ReducerActions.NEWEST_PRODUCTS_CLEAR,
    };

    const next = productsReducer(stateWithNewest, action);

    expect(next.newestProductUids).toEqual([]);
  });

  // ---------------------------------------------------------------
  // 8. PRODUCT_CONVERTED_TO_MATERIAL
  // ---------------------------------------------------------------
  test("PRODUCT_CONVERTED_TO_MATERIAL entfernt Produkt aus Liste und zeigt Erfolgs-Snackbar", () => {
    const action: ReducerAction = {
      type: ReducerActions.PRODUCT_CONVERTED_TO_MATERIAL,
      payload: productOktopus,
    };

    const next = productsReducer(stateWithProducts, action);

    // Oktopus wurde entfernt, Mozzarella bleibt
    expect(next.products).toHaveLength(1);
    expect(next.products[0].uid).toBe("mozza");
    // Snackbar mit korrektem Text
    expect(next.snackbar.open).toBe(true);
    expect(next.snackbar.severity).toBe("success");
    expect(next.snackbar.message).toBe(
      TEXT_PRODUCT_CONVERTED_TO_MATERIAL(productOktopus.name),
    );
  });

  // ---------------------------------------------------------------
  // 9. SNACKBAR_CLOSE
  // ---------------------------------------------------------------
  test("SNACKBAR_CLOSE schliesst die Snackbar", () => {
    const openSnackbarState: State = {
      ...initialState,
      snackbar: {open: true, severity: "success", message: "Gespeichert!"},
    };

    const action: ReducerAction = {
      type: ReducerActions.SNACKBAR_CLOSE,
    };

    const next = productsReducer(openSnackbarState, action);

    expect(next.snackbar.open).toBe(false);
    expect(next.snackbar.message).toBe("");
  });

  // ---------------------------------------------------------------
  // 10. GENERIC_ERROR
  // ---------------------------------------------------------------
  test("GENERIC_ERROR setzt error und stoppt Loading", () => {
    const loadingState: State = {
      ...initialState,
      isLoading: {...initialState.isLoading, overall: true},
    };

    const testError = new Error("Netzwerkfehler");
    const action: ReducerAction = {
      type: ReducerActions.GENERIC_ERROR,
      payload: testError,
    };

    const next = productsReducer(loadingState, action);

    expect(next.error).toBe(testError);
    expect(next.isLoading.overall).toBe(false);
  });
});
