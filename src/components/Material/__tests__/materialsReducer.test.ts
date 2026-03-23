/**
 * Unit-Tests fuer den materialsReducer.
 *
 * Reine Funktions-Tests ohne Rendering — prüft alle Reducer-Actions
 * auf korrekte State-Transitionen.
 */
import {TextEncoder, TextDecoder} from "util";
Object.assign(global, {TextEncoder, TextDecoder});

import {
  materialsReducer,
  ReducerActions,
  initialState,
} from "../materials";
import type {State, ReducerAction} from "../materials";
import {MaterialType} from "../material.types";
import type {Material} from "../material.types";

/* ===================================================================
// ======================== Testdaten =================================
// =================================================================== */

const materialTeller: Material = {
  uid: "mat-1",
  name: "Teller",
  type: MaterialType.usage,
  usable: true,
};

const materialServietten: Material = {
  uid: "mat-2",
  name: "Servietten",
  type: MaterialType.consumable,
  usable: true,
};

const stateWithMaterials: State = {
  ...initialState,
  materials: [materialTeller, materialServietten],
};

/* ===================================================================
// ======================== Tests =====================================
// =================================================================== */

describe("materialsReducer", () => {
  test("MATERIALS_FETCH_INIT setzt isLoading und loescht error", () => {
    const stateWithError: State = {
      ...initialState,
      error: new Error("alter Fehler"),
      isLoading: false,
    };

    const result = materialsReducer(stateWithError, {
      type: ReducerActions.MATERIALS_FETCH_INIT,
    });

    expect(result.isLoading).toBe(true);
    expect(result.error).toBeNull();
  });

  test("MATERIALS_FETCH_SUCCESS ersetzt materials, loescht changedUids und isLoading", () => {
    const stateLoading: State = {
      ...initialState,
      isLoading: true,
      changedUids: new Set(["old-uid"]),
    };

    const result = materialsReducer(stateLoading, {
      type: ReducerActions.MATERIALS_FETCH_SUCCESS,
      payload: [materialTeller, materialServietten],
    });

    expect(result.materials).toHaveLength(2);
    expect(result.materials[0]).toBe(materialTeller);
    expect(result.changedUids.size).toBe(0);
    expect(result.isLoading).toBe(false);
  });

  test("MATERIAL_UPDATED ersetzt das richtige Material und fuegt uid zu changedUids hinzu", () => {
    const updatedTeller: Material = {...materialTeller, name: "Suppenteller"};

    const result = materialsReducer(stateWithMaterials, {
      type: ReducerActions.MATERIAL_UPDATED,
      payload: updatedTeller,
    });

    expect(result.materials[0].name).toBe("Suppenteller");
    expect(result.materials[1]).toBe(materialServietten);
    expect(result.changedUids.has("mat-1")).toBe(true);
  });

  test("MATERIALS_SAVED loescht changedUids und zeigt Erfolgs-Snackbar", () => {
    const stateWithChanges: State = {
      ...stateWithMaterials,
      changedUids: new Set(["mat-1"]),
    };

    const result = materialsReducer(stateWithChanges, {
      type: ReducerActions.MATERIALS_SAVED,
    });

    expect(result.changedUids.size).toBe(0);
    expect(result.snackbar.open).toBe(true);
    expect(result.snackbar.severity).toBe("success");
  });

  test("MATERIALS_EDIT_CANCELLED stellt Snapshot wieder her und loescht changedUids", () => {
    const snapshot = [materialTeller, materialServietten];
    const stateWithChanges: State = {
      ...stateWithMaterials,
      materials: [{...materialTeller, name: "Geaendert"}],
      changedUids: new Set(["mat-1"]),
    };

    const result = materialsReducer(stateWithChanges, {
      type: ReducerActions.MATERIALS_EDIT_CANCELLED,
      payload: snapshot,
    });

    expect(result.materials).toBe(snapshot);
    expect(result.changedUids.size).toBe(0);
  });

  test("SNACKBAR_CLOSE schliesst die Snackbar", () => {
    const stateWithSnackbar: State = {
      ...initialState,
      snackbar: {open: true, severity: "success", message: "Gespeichert"},
    };

    const result = materialsReducer(stateWithSnackbar, {
      type: ReducerActions.SNACKBAR_CLOSE,
    });

    expect(result.snackbar.open).toBe(false);
  });

  test("GENERIC_ERROR setzt error und loescht isLoading", () => {
    const stateLoading: State = {...initialState, isLoading: true};
    const error = new Error("DB Fehler");

    const result = materialsReducer(stateLoading, {
      type: ReducerActions.GENERIC_ERROR,
      payload: error,
    });

    expect(result.error).toBe(error);
    expect(result.isLoading).toBe(false);
  });
});
