/**
 * Tests für stabile Zeilen-IDs auf MaterialListMaterial (Track A).
 */
import {MaterialList, MaterialListMaterial} from "../materialList.class";
import {MaterialType} from "../../../Material/material.types";

const material = (
  uid: string,
  id: string,
  overrides: Partial<MaterialListMaterial> = {},
): MaterialListMaterial => ({
  checked: false,
  name: `Material ${uid}`,
  uid,
  type: MaterialType.usage,
  quantity: 1,
  trace: [],
  id,
  ...overrides,
});

describe("MaterialListMaterial — stabile IDs", () => {
  test("addMaterialToList vergibt einem neuen Eintrag eine id, Merge behält sie", () => {
    const list: MaterialListMaterial[] = [];
    MaterialList.addMaterialToList({
      material: {uid: "m1", name: "Pfanne", type: MaterialType.usage} as never,
      list,
      quantity: 2,
    });
    const created = list[0];
    expect(created.id).toEqual(expect.any(String));
    expect(created.id.length).toBeGreaterThan(0);

    MaterialList.addMaterialToList({
      material: {uid: "m1", name: "Pfanne", type: MaterialType.usage} as never,
      list,
      quantity: 5,
    });
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe(created.id);
  });

  test("carryOverItemIds übernimmt die alte id bei uid-Treffer, sonst die neue", () => {
    const prev = [material("m1", "old-1"), material("m2", "old-2")];
    const next = [material("m1", "new-1"), material("m3", "new-3")];

    MaterialList.carryOverItemIds(prev, next);

    expect(next.find((entry) => entry.uid === "m1")?.id).toBe("old-1");
    expect(next.find((entry) => entry.uid === "m3")?.id).toBe("new-3");
  });
});
