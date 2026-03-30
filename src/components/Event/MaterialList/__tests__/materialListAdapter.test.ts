/**
 * Unit-Tests für materialListAdapter.
 *
 * Testet die Konvertierungsfunktionen zwischen Supabase-Domain-Modellen
 * und dem Legacy-UI-Format (MaterialList / MaterialListMaterial).
 */
import {
  headersDomainToMaterialList,
  itemsDomainToMaterialListItems,
  deriveEditSource,
  materialListItemsToInsertRows,
} from "../materialListAdapter";
import {
  MaterialListHeaderDomain,
  MaterialListItemDomain,
} from "../../../Database/Repository/MaterialListRepository";
import {MaterialListMaterial} from "../materialList.class";
import {Material, MaterialType} from "../../../Material/material.types";
import {ItemType} from "../../ShoppingList/shoppingList.class";


const EVENT_ID = "event-001";

const header1: MaterialListHeaderDomain = {
  id: "list-001",
  eventId: EVENT_ID,
  name: "Samstag",
  selectedMenues: ["menue-001"],
  selectedMeals: ["meal-001"],
  hasManuallyAddedItems: false,
  updatedAt: new Date("2026-03-01T12:00:00Z"),
};

const header2: MaterialListHeaderDomain = {
  id: "list-002",
  eventId: EVENT_ID,
  name: "Sonntag",
  selectedMenues: ["menue-002"],
  selectedMeals: ["meal-002"],
  hasManuallyAddedItems: true,
  updatedAt: new Date("2026-03-02T18:00:00Z"),
};

const itemDomain1: MaterialListItemDomain = {
  id: "item-001",
  listId: "list-001",
  materialId: "mat-001",
  freeTextName: null,
  quantity: 5,
  checked: false,
  editSource: "generated",
  sortOrder: 0,
  itemName: "Pfanne gross",
  assignedCookId: "cook-001",
  assignedCookName: null,
  resolvedCookName: "Max Muster",
  assignedCookUserId: "user-001",
};

const itemDomain2: MaterialListItemDomain = {
  id: "item-002",
  listId: "list-001",
  materialId: null,
  freeTextName: "Holzkohle",
  quantity: 2,
  checked: true,
  editSource: "manual_add",
  sortOrder: 1,
  itemName: "Holzkohle",
  assignedCookId: null,
  assignedCookName: "Gast-Koch",
  resolvedCookName: null,
  assignedCookUserId: null,
};

const itemDomainManualEdit: MaterialListItemDomain = {
  id: "item-003",
  listId: "list-001",
  materialId: "mat-002",
  freeTextName: null,
  quantity: 10,
  checked: false,
  editSource: "manual_edit",
  sortOrder: 2,
  itemName: "Schüssel",
  assignedCookId: null,
  assignedCookName: null,
  resolvedCookName: null,
  assignedCookUserId: null,
};


describe("materialListAdapter", () => {  describe("headersDomainToMaterialList", () => {
    it("should convert headers to MaterialList with correct structure", () => {
      const result = headersDomainToMaterialList([header1, header2], EVENT_ID);

      expect(result.uid).toBe(EVENT_ID);
      expect(Object.keys(result.lists)).toHaveLength(2);

      // Erste Liste
      const list1 = result.lists["list-001"];
      expect(list1.properties.uid).toBe("list-001");
      expect(list1.properties.name).toBe("Samstag");
      expect(list1.properties.selectedMenues).toEqual(["menue-001"]);
      expect(list1.properties.selectedMeals).toEqual(["meal-001"]);
      expect(list1.items).toEqual([]);

      // Zweite Liste
      const list2 = result.lists["list-002"];
      expect(list2.properties.uid).toBe("list-002");
      expect(list2.properties.name).toBe("Sonntag");
    });

    it("should set lastChange from the latest header updatedAt", () => {
      const result = headersDomainToMaterialList([header1, header2], EVENT_ID);

      // header2 hat das spätere updatedAt
      expect(result.lastChange.date).toEqual(
        new Date("2026-03-02T18:00:00Z"),
      );
    });

    it("should initialize traces as empty arrays", () => {
      const result = headersDomainToMaterialList([header1], EVENT_ID);

      expect(result.lists["list-001"].items).toEqual([]);
    });

    it("should handle empty headers array", () => {
      const result = headersDomainToMaterialList([], EVENT_ID);

      expect(result.uid).toBe(EVENT_ID);
      expect(Object.keys(result.lists)).toHaveLength(0);
      expect(result.lastChange.date).toEqual(new Date(0));
    });
  });  describe("itemsDomainToMaterialListItems", () => {
    it("should map domain items to MaterialListMaterial with correct uid", () => {
      const result = itemsDomainToMaterialListItems([itemDomain1]);

      expect(result).toHaveLength(1);
      // uid = materialId wenn vorhanden
      expect(result[0].uid).toBe("mat-001");
      expect(result[0].supabaseId).toBe("item-001");
      expect(result[0].name).toBe("Pfanne gross");
      expect(result[0].quantity).toBe(5);
      expect(result[0].checked).toBe(false);
      expect(result[0].type).toBe(MaterialType.usage);
      expect(result[0].trace).toEqual([]);
    });

    it("should use item id as uid when materialId is null", () => {
      const result = itemsDomainToMaterialListItems([itemDomain2]);

      // uid = id da materialId null
      expect(result[0].uid).toBe("item-002");
      expect(result[0].supabaseId).toBe("item-002");
    });

    it("should set manualAdd flag for manual_add editSource", () => {
      const result = itemsDomainToMaterialListItems([itemDomain2]);

      expect(result[0].manualAdd).toBe(true);
      expect(result[0].manualEdit).toBeUndefined();
    });

    it("should set manualEdit flag for manual_edit editSource", () => {
      const result = itemsDomainToMaterialListItems([itemDomainManualEdit]);

      expect(result[0].manualEdit).toBe(true);
      expect(result[0].manualAdd).toBeUndefined();
    });

    it("should not set manual flags for generated editSource", () => {
      const result = itemsDomainToMaterialListItems([itemDomain1]);

      expect(result[0].manualAdd).toBeUndefined();
      expect(result[0].manualEdit).toBeUndefined();
    });

    it("should map cook fields correctly", () => {
      const result = itemsDomainToMaterialListItems([itemDomain1]);

      expect(result[0].assignedCookId).toBe("cook-001");
      expect(result[0].assignedCookName).toBeNull();
      expect(result[0].resolvedCookName).toBe("Max Muster");
    });
  });  describe("deriveEditSource", () => {
    it("should return 'manual_add' when manualAdd is true", () => {
      const item = {manualAdd: true} as MaterialListMaterial;
      expect(deriveEditSource(item)).toBe("manual_add");
    });

    it("should return 'manual_edit' when manualEdit is true", () => {
      const item = {manualEdit: true} as MaterialListMaterial;
      expect(deriveEditSource(item)).toBe("manual_edit");
    });

    it("should return 'generated' by default", () => {
      const item = {} as MaterialListMaterial;
      expect(deriveEditSource(item)).toBe("generated");
    });

    it("should prioritize manualAdd over manualEdit", () => {
      const item = {
        manualAdd: true,
        manualEdit: true,
      } as MaterialListMaterial;
      expect(deriveEditSource(item)).toBe("manual_add");
    });
  });  describe("materialListItemsToInsertRows", () => {
    const knownMaterial: Material = {
      uid: "mat-001",
      name: "Pfanne gross",
      type: MaterialType.usage,
      usable: true,
      qaChecked: false,
      qaCheckedAt: null,
    };

    it("should convert items to insert rows with material_id for known materials", () => {
      const items: MaterialListMaterial[] = [
        {
          checked: false,
          name: "Pfanne gross",
          uid: "mat-001",
          type: MaterialType.usage,
          quantity: 5,
          trace: [],
        },
      ];

      const rows = materialListItemsToInsertRows(items, "list-001", [
        knownMaterial,
      ]);

      expect(rows).toHaveLength(1);
      expect(rows[0].list_id).toBe("list-001");
      expect(rows[0].material_id).toBe("mat-001");
      expect(rows[0].free_text_name).toBeUndefined();
      expect(rows[0].quantity).toBe(5);
      expect(rows[0].edit_source).toBe("generated");
      expect(rows[0].sort_order).toBe(0);
    });

    it("should use free_text_name for unknown material UIDs", () => {
      const items: MaterialListMaterial[] = [
        {
          checked: false,
          name: "Holzkohle",
          uid: "unknown-uid",
          type: MaterialType.usage,
          quantity: 2,
          trace: [],
          manualAdd: true,
        },
      ];

      const rows = materialListItemsToInsertRows(items, "list-001", [
        knownMaterial,
      ]);

      expect(rows).toHaveLength(1);
      expect(rows[0].material_id).toBeUndefined();
      expect(rows[0].free_text_name).toBe("Holzkohle");
      expect(rows[0].edit_source).toBe("manual_add");
    });

    it("should skip empty placeholder items", () => {
      const items: MaterialListMaterial[] = [
        {
          checked: false,
          name: "",
          uid: "",
          type: MaterialType.usage,
          quantity: 0,
          trace: [],
        },
        {
          checked: false,
          name: "Pfanne gross",
          uid: "mat-001",
          type: MaterialType.usage,
          quantity: 5,
          trace: [],
        },
      ];

      const rows = materialListItemsToInsertRows(items, "list-001", [
        knownMaterial,
      ]);

      expect(rows).toHaveLength(1);
      expect(rows[0].sort_order).toBe(0);
    });

    it("should handle cook fields — assignedCookId takes priority", () => {
      const items: MaterialListMaterial[] = [
        {
          checked: false,
          name: "Pfanne gross",
          uid: "mat-001",
          type: MaterialType.usage,
          quantity: 5,
          trace: [],
          assignedCookId: "cook-001",
          assignedCookName: "Fallback Name",
        },
      ];

      const rows = materialListItemsToInsertRows(items, "list-001", [
        knownMaterial,
      ]);

      expect(rows[0].assigned_cook_id).toBe("cook-001");
      // assignedCookName nicht gesetzt wenn cookId vorhanden
      expect(rows[0].assigned_cook_name).toBeUndefined();
    });

    it("should set assigned_cook_name when no assignedCookId", () => {
      const items: MaterialListMaterial[] = [
        {
          checked: false,
          name: "Pfanne gross",
          uid: "mat-001",
          type: MaterialType.usage,
          quantity: 5,
          trace: [],
          assignedCookName: "Gast-Koch",
        },
      ];

      const rows = materialListItemsToInsertRows(items, "list-001", [
        knownMaterial,
      ]);

      expect(rows[0].assigned_cook_id).toBeUndefined();
      expect(rows[0].assigned_cook_name).toBe("Gast-Koch");
    });

    it("should assign incrementing sort_order", () => {
      const items: MaterialListMaterial[] = [
        {
          checked: false,
          name: "Item A",
          uid: "mat-001",
          type: MaterialType.usage,
          quantity: 1,
          trace: [],
        },
        {
          checked: false,
          name: "Item B",
          uid: "unknown",
          type: MaterialType.usage,
          quantity: 2,
          trace: [],
        },
      ];

      const rows = materialListItemsToInsertRows(items, "list-001", [
        knownMaterial,
      ]);

      expect(rows[0].sort_order).toBe(0);
      expect(rows[1].sort_order).toBe(1);
    });
  });
});
