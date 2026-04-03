/**
 * Unit-Tests fuer den materialsReducer.
 *
 * Reine Funktions-Tests ohne Rendering — prüft alle Reducer-Actions
 * auf korrekte State-Transitionen.
 */
import {TextEncoder, TextDecoder} from "util";
Object.assign(globalThis, {TextEncoder, TextDecoder});

import {
  materialsReducer,
  ReducerActions,
  initialState,
} from "../materials";
import type {State} from "../materials";
import {MaterialType} from "../material.types";
import type {Material} from "../material.types";
import type {MaterialIssue} from "../materialQaUtils";

import {
  DELETE_MATERIAL_SUCCESS,
} from "../../../constants/text/materialQa";

/* ===================================================================
// ======================== Testdaten =================================
// =================================================================== */

const materialTeller: Material = {
  uid: "mat-1",
  name: "Teller",
  type: MaterialType.usage,
  usable: true,
  qaChecked: false,
  qaCheckedAt: null,
};

const materialServietten: Material = {
  uid: "mat-2",
  name: "Servietten",
  type: MaterialType.consumable,
  usable: true,
  qaChecked: false,
  qaCheckedAt: null,
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

  // ---------------------------------------------------------------
  // MATERIAL_DELETED
  // ---------------------------------------------------------------
  test("MATERIAL_DELETED entfernt Material aus Liste und zeigt Erfolgs-Snackbar", () => {
    const result = materialsReducer(stateWithMaterials, {
      type: ReducerActions.MATERIAL_DELETED,
      payload: materialTeller,
    });

    expect(result.materials).toHaveLength(1);
    expect(result.materials[0].uid).toBe("mat-2");
    expect(result.snackbar.open).toBe(true);
    expect(result.snackbar.severity).toBe("success");
    expect(result.snackbar.message).toBe(
      DELETE_MATERIAL_SUCCESS(materialTeller.name),
    );
  });

  // ---------------------------------------------------------------
  // ISSUE_FLAGS_LOADED
  // ---------------------------------------------------------------
  test("ISSUE_FLAGS_LOADED speichert die Issue-Flags", () => {
    const issues: MaterialIssue[] = [
      {materialUid: "mat-1", issues: ["Kein Materialtyp zugewiesen"]},
    ];

    const result = materialsReducer(stateWithMaterials, {
      type: ReducerActions.ISSUE_FLAGS_LOADED,
      payload: issues,
    });

    expect(result.issueFlags).toHaveLength(1);
    expect(result.issueFlags[0].materialUid).toBe("mat-1");
  });

  // ---------------------------------------------------------------
  // QA_TOGGLE
  // ---------------------------------------------------------------
  test("QA_TOGGLE setzt qaChecked und qaCheckedAt und fuegt uid zu changedUids hinzu", () => {
    const result = materialsReducer(stateWithMaterials, {
      type: ReducerActions.QA_TOGGLE,
      payload: {uid: "mat-1", checked: true},
    });

    const updatedMaterial = result.materials.find(
      (material) => material.uid === "mat-1",
    );
    expect(updatedMaterial?.qaChecked).toBe(true);
    expect(updatedMaterial?.qaCheckedAt).toBeTruthy();
    expect(result.changedUids.has("mat-1")).toBe(true);
  });

  test("QA_TOGGLE setzt qaCheckedAt auf null wenn unchecked", () => {
    const checkedState: State = {
      ...stateWithMaterials,
      materials: [
        {...materialTeller, qaChecked: true, qaCheckedAt: "2026-01-01T00:00:00Z"},
        materialServietten,
      ],
    };

    const result = materialsReducer(checkedState, {
      type: ReducerActions.QA_TOGGLE,
      payload: {uid: "mat-1", checked: false},
    });

    const updatedMaterial = result.materials.find(
      (material) => material.uid === "mat-1",
    );
    expect(updatedMaterial?.qaChecked).toBe(false);
    expect(updatedMaterial?.qaCheckedAt).toBeNull();
  });

  // ---------------------------------------------------------------
  // MATERIAL_MERGED
  // ---------------------------------------------------------------
  test("MATERIAL_MERGED entfernt Quellmaterial und zeigt Erfolgs-Snackbar", () => {
    const result = materialsReducer(stateWithMaterials, {
      type: ReducerActions.MATERIAL_MERGED,
      payload: {
        sourceMaterialUid: "mat-1",
        result: {
          recipe_materials: 2,
          material_list_items: 1,
          menue_materials: 0,
          shopping_list_items: 3,
        },
      },
    });

    expect(result.materials).toHaveLength(1);
    expect(result.materials[0].uid).toBe("mat-2");
    expect(result.snackbar.open).toBe(true);
    expect(result.snackbar.severity).toBe("success");
    expect(result.snackbar.message).toContain("zusammengeführt");
  });

  // ---------------------------------------------------------------
  // MATERIAL_CONVERTED_TO_PRODUCT
  // ---------------------------------------------------------------
  // ---------------------------------------------------------------
  // SELECTED_MATERIALS_CHANGED
  // ---------------------------------------------------------------
  test("SELECTED_MATERIALS_CHANGED aktualisiert selectedMaterialUids", () => {
    const result = materialsReducer(stateWithMaterials, {
      type: ReducerActions.SELECTED_MATERIALS_CHANGED,
      payload: ["mat-1", "mat-2"],
    });

    expect(result.selectedMaterialUids).toEqual(["mat-1", "mat-2"]);
  });

  // ---------------------------------------------------------------
  // MATERIAL_CONVERTED_TO_PRODUCT
  // ---------------------------------------------------------------
  test("MATERIAL_CONVERTED_TO_PRODUCT entfernt Material und zeigt Erfolgs-Snackbar", () => {
    const result = materialsReducer(stateWithMaterials, {
      type: ReducerActions.MATERIAL_CONVERTED_TO_PRODUCT,
      payload: materialTeller,
    });

    expect(result.materials).toHaveLength(1);
    expect(result.materials[0].uid).toBe("mat-2");
    expect(result.snackbar.open).toBe(true);
    expect(result.snackbar.severity).toBe("success");
    expect(result.snackbar.message).toContain("Teller");
    expect(result.snackbar.message).toContain("Produkt");
  });
});
