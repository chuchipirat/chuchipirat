/**
 * Unit-Tests für MaterialListRepository.
 *
 * Testet alle öffentlichen Methoden: getListsForEvent, getListItems,
 * createList, saveListItems, updateListHeader, updateItemChecked,
 * updateItem, insertItem, deleteList, subscribeToLists,
 * subscribeToListItems.
 */
import {
  MaterialListRepository,
  MaterialListHeaderRow,
  MaterialListHeaderDomain,
  MaterialListItemViewRow,
  MaterialListItemInsertRow,
} from "../MaterialListRepository";
import {createSupabaseMock} from "../__mocks__/supabaseMock";

// SessionStorageHandler mocken, damit Caching die Tests nicht beeinflusst
jest.mock("../../../Firebase/Db/sessionStorageHandler.class", () => {
  const actual = jest.requireActual(
    "../../../Firebase/Db/sessionStorageHandler.class",
  );
  return {
    ...actual,
    SessionStorageHandler: {
      getDocument: jest.fn().mockReturnValue(null),
      upsertDocument: jest.fn(),
      deleteDocument: jest.fn(),
      updateDocumentField: jest.fn(),
      incrementFieldValue: jest.fn(),
    },
  };
});

jest.mock("@sentry/react", () => ({
  captureException: jest.fn(),
  addBreadcrumb: jest.fn(),
}));

/* =====================================================================
// Test-Daten
// ===================================================================== */

const EVENT_ID = "event-001";

const testHeaderRow1: MaterialListHeaderRow = {
  id: "list-001",
  event_id: EVENT_ID,
  name: "Samstag Material",
  selected_menues: ["menue-001", "menue-002"],
  selected_meals: ["meal-001"],
  has_manually_added_items: false,
  firebase_uid: null,
  created_at: "2026-03-01T00:00:00Z",
  created_by: null,
  updated_at: "2026-03-01T12:00:00Z",
  updated_by: null,
};

const testHeaderRow2: MaterialListHeaderRow = {
  id: "list-002",
  event_id: EVENT_ID,
  name: "Sonntag Material",
  selected_menues: ["menue-003"],
  selected_meals: ["meal-002"],
  has_manually_added_items: true,
  firebase_uid: null,
  created_at: "2026-03-02T00:00:00Z",
  created_by: null,
  updated_at: "2026-03-02T12:00:00Z",
  updated_by: null,
};

const testItemViewRow1: MaterialListItemViewRow = {
  id: "item-001",
  list_id: "list-001",
  material_id: "mat-001",
  free_text_name: null,
  quantity: 5,
  checked: false,
  edit_source: "generated",
  sort_order: 0,
  assigned_cook_id: "cook-001",
  assigned_cook_name: null,
  created_at: "2026-03-01T00:00:00Z",
  created_by: null,
  updated_at: "2026-03-01T00:00:00Z",
  updated_by: null,
  item_name: "Pfanne gross",
  resolved_cook_name: "Max Muster",
  assigned_cook_user_id: "user-001",
};

const testItemViewRow2: MaterialListItemViewRow = {
  id: "item-002",
  list_id: "list-001",
  material_id: null,
  free_text_name: "Holzkohle",
  quantity: 2,
  checked: true,
  edit_source: "manual_add",
  sort_order: 1,
  assigned_cook_id: null,
  assigned_cook_name: "Gast-Koch",
  created_at: "2026-03-01T00:00:00Z",
  created_by: null,
  updated_at: "2026-03-01T00:00:00Z",
  updated_by: null,
  item_name: "Holzkohle",
  resolved_cook_name: null,
  assigned_cook_user_id: null,
};

const testInsertItem: MaterialListItemInsertRow = {
  list_id: "list-001",
  material_id: "mat-001",
  quantity: 3,
  edit_source: "generated",
  sort_order: 0,
};

/* =====================================================================
// Tests
// ===================================================================== */

describe("MaterialListRepository", () => {
  let repo: MaterialListRepository;
  let client: ReturnType<typeof createSupabaseMock>["client"];
  let queryMock: ReturnType<typeof createSupabaseMock>["queryMock"];

  beforeEach(() => {
    ({client, queryMock} = createSupabaseMock());
    repo = new MaterialListRepository();
    (repo as any).client = client;
  });

  /* =====================================================================
  // getListsForEvent
  // ===================================================================== */
  describe("getListsForEvent", () => {
    it("should return mapped domain objects from header rows", async () => {
      queryMock.order.mockResolvedValue({
        data: [testHeaderRow1, testHeaderRow2],
        error: null,
      });

      const result = await repo.getListsForEvent(EVENT_ID);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        id: "list-001",
        eventId: EVENT_ID,
        name: "Samstag Material",
        selectedMenues: ["menue-001", "menue-002"],
        selectedMeals: ["meal-001"],
        hasManuallyAddedItems: false,
        updatedAt: new Date("2026-03-01T12:00:00Z"),
      });
      expect(result[1]).toEqual({
        id: "list-002",
        eventId: EVENT_ID,
        name: "Sonntag Material",
        selectedMenues: ["menue-003"],
        selectedMeals: ["meal-002"],
        hasManuallyAddedItems: true,
        updatedAt: new Date("2026-03-02T12:00:00Z"),
      });

      expect(client.from).toHaveBeenCalledWith("event_material_lists");
    });

    it("should return empty array when no lists exist", async () => {
      queryMock.order.mockResolvedValue({data: [], error: null});

      const result = await repo.getListsForEvent(EVENT_ID);

      expect(result).toEqual([]);
    });

    it("should throw on database error", async () => {
      queryMock.order.mockResolvedValue({
        data: null,
        error: {message: "DB error", code: "42P01"},
      });

      await expect(repo.getListsForEvent(EVENT_ID)).rejects.toEqual({
        message: "DB error",
        code: "42P01",
      });
    });
  });

  /* =====================================================================
  // getListItems
  // ===================================================================== */
  describe("getListItems", () => {
    it("should return mapped domain objects from VIEW rows", async () => {
      queryMock.order.mockResolvedValue({
        data: [testItemViewRow1, testItemViewRow2],
        error: null,
      });

      const result = await repo.getListItems("list-001");

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
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
      });

      expect(client.from).toHaveBeenCalledWith(
        "event_material_list_items_view",
      );
    });

    it("should return empty array when no items exist", async () => {
      queryMock.order.mockResolvedValue({data: [], error: null});

      const result = await repo.getListItems("list-001");

      expect(result).toEqual([]);
    });

    it("should throw on database error", async () => {
      queryMock.order.mockResolvedValue({
        data: null,
        error: {message: "View error"},
      });

      await expect(repo.getListItems("list-001")).rejects.toEqual({
        message: "View error",
      });
    });
  });

  /* =====================================================================
  // createList
  // ===================================================================== */
  describe("createList", () => {
    it("should insert header and items, return created header domain", async () => {
      // single() für den Header-Insert
      queryMock.single.mockResolvedValue({
        data: testHeaderRow1,
        error: null,
      });
      // insert() für die Items — zweiter from()-Aufruf
      const itemQueryMock = {
        insert: jest.fn().mockResolvedValue({data: null, error: null}),
      };
      client.from
        .mockReturnValueOnce(queryMock) // event_material_lists
        .mockReturnValueOnce(itemQueryMock); // event_material_list_items

      const header: Omit<MaterialListHeaderDomain, "id" | "eventId" | "updatedAt"> = {
        name: "Samstag Material",
        selectedMenues: ["menue-001", "menue-002"],
        selectedMeals: ["meal-001"],
        hasManuallyAddedItems: false,
      };

      const result = await repo.createList(EVENT_ID, header, [testInsertItem]);

      expect(result).toEqual({
        id: "list-001",
        eventId: EVENT_ID,
        name: "Samstag Material",
        selectedMenues: ["menue-001", "menue-002"],
        selectedMeals: ["meal-001"],
        hasManuallyAddedItems: false,
        updatedAt: new Date("2026-03-01T12:00:00Z"),
      });

      expect(queryMock.insert).toHaveBeenCalledWith({
        event_id: EVENT_ID,
        name: "Samstag Material",
        selected_menues: ["menue-001", "menue-002"],
        selected_meals: ["meal-001"],
        has_manually_added_items: false,
      });
    });

    it("should skip item insert when items array is empty", async () => {
      queryMock.single.mockResolvedValue({
        data: testHeaderRow1,
        error: null,
      });

      const header: Omit<MaterialListHeaderDomain, "id" | "eventId" | "updatedAt"> = {
        name: "Samstag Material",
        selectedMenues: [],
        selectedMeals: [],
        hasManuallyAddedItems: false,
      };

      await repo.createList(EVENT_ID, header, []);

      // Nur ein from()-Aufruf (Header), kein zweiter für Items
      expect(client.from).toHaveBeenCalledTimes(1);
    });

    it("should throw on header insert error", async () => {
      queryMock.single.mockResolvedValue({
        data: null,
        error: {message: "Insert failed"},
      });

      const header: Omit<MaterialListHeaderDomain, "id" | "eventId" | "updatedAt"> = {
        name: "Test",
        selectedMenues: [],
        selectedMeals: [],
        hasManuallyAddedItems: false,
      };

      await expect(
        repo.createList(EVENT_ID, header, []),
      ).rejects.toEqual({message: "Insert failed"});
    });
  });

  /* =====================================================================
  // saveListItems
  // ===================================================================== */
  describe("saveListItems", () => {
    it("should delete all existing items then insert new ones", async () => {
      // Erster from()-Aufruf: delete
      const deleteMock = {
        delete: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({data: null, error: null}),
        }),
      };
      // Zweiter from()-Aufruf: insert
      const insertMock = {
        insert: jest.fn().mockResolvedValue({data: null, error: null}),
      };

      client.from
        .mockReturnValueOnce(deleteMock)
        .mockReturnValueOnce(insertMock);

      await repo.saveListItems("list-001", [testInsertItem]);

      expect(client.from).toHaveBeenCalledWith("event_material_list_items");
      expect(deleteMock.delete).toHaveBeenCalled();
      expect(insertMock.insert).toHaveBeenCalledWith([
        {...testInsertItem, list_id: "list-001"},
      ]);
    });

    it("should only delete when items array is empty", async () => {
      const deleteMock = {
        delete: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({data: null, error: null}),
        }),
      };

      client.from.mockReturnValueOnce(deleteMock);

      await repo.saveListItems("list-001", []);

      expect(client.from).toHaveBeenCalledTimes(1);
    });

    it("should throw on delete error", async () => {
      const deleteMock = {
        delete: jest.fn().mockReturnValue({
          eq: jest
            .fn()
            .mockResolvedValue({
              data: null,
              error: {message: "Delete failed"},
            }),
        }),
      };

      client.from.mockReturnValueOnce(deleteMock);

      await expect(
        repo.saveListItems("list-001", [testInsertItem]),
      ).rejects.toEqual({message: "Delete failed"});
    });
  });

  /* =====================================================================
  // updateListHeader
  // ===================================================================== */
  describe("updateListHeader", () => {
    it("should update partial header fields", async () => {
      queryMock.eq.mockResolvedValue({data: null, error: null});

      await repo.updateListHeader("list-001", {
        name: "Neuer Name",
        has_manually_added_items: true,
      });

      expect(client.from).toHaveBeenCalledWith("event_material_lists");
      expect(queryMock.update).toHaveBeenCalledWith({
        name: "Neuer Name",
        has_manually_added_items: true,
      });
      expect(queryMock.eq).toHaveBeenCalledWith("id", "list-001");
    });

    it("should throw on error", async () => {
      queryMock.eq.mockResolvedValue({
        data: null,
        error: {message: "Not found"},
      });

      await expect(
        repo.updateListHeader("list-999", {name: "X"}),
      ).rejects.toEqual({message: "Not found"});
    });
  });

  /* =====================================================================
  // updateItemChecked
  // ===================================================================== */
  describe("updateItemChecked", () => {
    it("should update the checked status of a single item", async () => {
      queryMock.eq.mockResolvedValue({data: null, error: null});

      await repo.updateItemChecked("item-001", true);

      expect(client.from).toHaveBeenCalledWith("event_material_list_items");
      expect(queryMock.update).toHaveBeenCalledWith({checked: true});
      expect(queryMock.eq).toHaveBeenCalledWith("id", "item-001");
    });

    it("should throw on error", async () => {
      queryMock.eq.mockResolvedValue({
        data: null,
        error: {message: "Update failed"},
      });

      await expect(
        repo.updateItemChecked("item-001", false),
      ).rejects.toEqual({message: "Update failed"});
    });
  });

  /* =====================================================================
  // updateItem
  // ===================================================================== */
  describe("updateItem", () => {
    it("should update partial item fields including cook fields", async () => {
      queryMock.eq.mockResolvedValue({data: null, error: null});

      await repo.updateItem("item-001", {
        quantity: 10,
        assigned_cook_id: "cook-002",
        assigned_cook_name: null,
        edit_source: "manual_edit",
      });

      expect(client.from).toHaveBeenCalledWith("event_material_list_items");
      expect(queryMock.update).toHaveBeenCalledWith({
        quantity: 10,
        assigned_cook_id: "cook-002",
        assigned_cook_name: null,
        edit_source: "manual_edit",
      });
      expect(queryMock.eq).toHaveBeenCalledWith("id", "item-001");
    });

    it("should throw on error", async () => {
      queryMock.eq.mockResolvedValue({
        data: null,
        error: {message: "Update failed"},
      });

      await expect(
        repo.updateItem("item-001", {quantity: 5}),
      ).rejects.toEqual({message: "Update failed"});
    });
  });

  /* =====================================================================
  // insertItem
  // ===================================================================== */
  describe("insertItem", () => {
    it("should insert a single item with list_id", async () => {
      queryMock.insert.mockResolvedValue({data: null, error: null});

      await repo.insertItem("list-001", testInsertItem);

      expect(client.from).toHaveBeenCalledWith("event_material_list_items");
      expect(queryMock.insert).toHaveBeenCalledWith({
        ...testInsertItem,
        list_id: "list-001",
      });
    });

    it("should throw on error", async () => {
      queryMock.insert.mockResolvedValue({
        data: null,
        error: {message: "Insert failed"},
      });

      await expect(
        repo.insertItem("list-001", testInsertItem),
      ).rejects.toEqual({message: "Insert failed"});
    });
  });

  /* =====================================================================
  // deleteList
  // ===================================================================== */
  describe("deleteList", () => {
    it("should delete a list by id", async () => {
      queryMock.eq.mockResolvedValue({data: null, error: null});

      await repo.deleteList("list-001");

      expect(client.from).toHaveBeenCalledWith("event_material_lists");
      expect(queryMock.delete).toHaveBeenCalled();
      expect(queryMock.eq).toHaveBeenCalledWith("id", "list-001");
    });

    it("should throw on error", async () => {
      queryMock.eq.mockResolvedValue({
        data: null,
        error: {message: "Delete failed"},
      });

      await expect(repo.deleteList("list-001")).rejects.toEqual({
        message: "Delete failed",
      });
    });
  });

  /* =====================================================================
  // subscribeToLists
  // ===================================================================== */
  describe("subscribeToLists", () => {
    it("should create channel and return unsubscribe function", () => {
      const onData = jest.fn();
      const onError = jest.fn();
      const mockChannel = {
        on: jest.fn().mockReturnThis(),
        subscribe: jest.fn().mockReturnThis(),
      };
      client.channel.mockReturnValue(mockChannel);

      const unsubscribe = repo.subscribeToLists(EVENT_ID, onData, onError);

      expect(client.channel).toHaveBeenCalledWith(
        `materiallists:${EVENT_ID}`,
      );
      expect(mockChannel.on).toHaveBeenCalledWith(
        "postgres_changes",
        expect.objectContaining({
          event: "*",
          schema: "public",
          table: "event_material_lists",
          filter: `event_id=eq.${EVENT_ID}`,
        }),
        expect.any(Function),
      );
      expect(typeof unsubscribe).toBe("function");

      // Unsubscribe aufrufen
      unsubscribe();
      expect(client.removeChannel).toHaveBeenCalled();
    });
  });

  /* =====================================================================
  // subscribeToListItems
  // ===================================================================== */
  describe("subscribeToListItems", () => {
    it("should create channel for items and return unsubscribe function", () => {
      const onData = jest.fn();
      const onError = jest.fn();
      const mockChannel = {
        on: jest.fn().mockReturnThis(),
        subscribe: jest.fn().mockReturnThis(),
      };
      client.channel.mockReturnValue(mockChannel);

      const unsubscribe = repo.subscribeToListItems(
        "list-001",
        onData,
        onError,
      );

      expect(client.channel).toHaveBeenCalledWith(
        `materiallistitems:list-001`,
      );
      expect(mockChannel.on).toHaveBeenCalledWith(
        "postgres_changes",
        expect.objectContaining({
          event: "*",
          schema: "public",
          table: "event_material_list_items",
          filter: `list_id=eq.list-001`,
        }),
        expect.any(Function),
      );
      expect(typeof unsubscribe).toBe("function");

      // Unsubscribe aufrufen
      unsubscribe();
      expect(client.removeChannel).toHaveBeenCalled();
    });
  });
});
