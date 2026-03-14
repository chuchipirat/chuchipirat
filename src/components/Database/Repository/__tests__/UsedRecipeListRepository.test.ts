/**
 * Unit-Tests für UsedRecipeListRepository.
 *
 * Testet alle öffentlichen Methoden: getListsForEvent, createList,
 * updateListName, updateListMenues, updateListMeals,
 * updateListMenuesAndMeals, deleteList, getRecipesForList,
 * subscribeToLists.
 */
import {
  UsedRecipeListRepository,
  UsedRecipeListDomain,
  UsedRecipeListRow,
  UsedRecipeListRecipeRow,
} from "../UsedRecipeListRepository";
import {createSupabaseMock, createQueryMock} from "../__mocks__/supabaseMock";

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

/* =====================================================================
// Test-Daten
// ===================================================================== */

const EVENT_ID = "event-001";

const testListRow1: UsedRecipeListRow = {
  id: "list-001",
  event_id: EVENT_ID,
  name: "Samstagsrezepte",
  selected_menue_ids: ["menue-001", "menue-002"],
  selected_meal_ids: ["meal-001", "meal-002"],
  firebase_uid: null,
  created_at: "2026-03-01T00:00:00Z",
  created_by: null,
  updated_at: "2026-03-01T00:00:00Z",
  updated_by: null,
};

const testListRow2: UsedRecipeListRow = {
  id: "list-002",
  event_id: EVENT_ID,
  name: "Sonntagsrezepte",
  selected_menue_ids: [],
  selected_meal_ids: [],
  firebase_uid: null,
  created_at: "2026-03-02T00:00:00Z",
  created_by: null,
  updated_at: "2026-03-02T00:00:00Z",
  updated_by: null,
};

const testRecipeRow: UsedRecipeListRecipeRow = {
  recipe_id: "recipe-001",
  recipe_name: "Pasta Carbonara",
  menue_id: "menue-001",
  meal_id: "meal-001",
  meal_date: "2026-03-15",
  meal_type_name: "Abendessen",
};

/* =====================================================================
// Tests
// ===================================================================== */

describe("UsedRecipeListRepository", () => {
  let repo: UsedRecipeListRepository;
  let client: ReturnType<typeof createSupabaseMock>["client"];
  let queryMock: ReturnType<typeof createSupabaseMock>["queryMock"];

  beforeEach(() => {
    ({client, queryMock} = createSupabaseMock());
    repo = new UsedRecipeListRepository();
    (repo as any).client = client;
  });

  /* =====================================================================
  // getListsForEvent
  // ===================================================================== */
  describe("getListsForEvent", () => {
    it("should return lists with menue and meal arrays from header", async () => {
      queryMock.order.mockResolvedValue({
        data: [testListRow1, testListRow2],
        error: null,
      });

      const result = await repo.getListsForEvent(EVENT_ID);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        id: "list-001",
        eventId: EVENT_ID,
        name: "Samstagsrezepte",
        selectedMenues: ["menue-001", "menue-002"],
        selectedMeals: ["meal-001", "meal-002"],
        updatedAt: new Date("2026-03-01T00:00:00Z"),
      });
      expect(result[1]).toEqual({
        id: "list-002",
        eventId: EVENT_ID,
        name: "Sonntagsrezepte",
        selectedMenues: [],
        selectedMeals: [],
        updatedAt: new Date("2026-03-02T00:00:00Z"),
      });

      // Nur eine Tabelle abgefragt (keine Junction-Tabellen mehr)
      expect(client.from).toHaveBeenCalledWith("event_used_recipe_lists");
      expect(client.from).toHaveBeenCalledTimes(1);
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
  // createList
  // ===================================================================== */
  describe("createList", () => {
    it("should insert list with arrays in header", async () => {
      queryMock.single.mockResolvedValue({data: testListRow1, error: null});

      const result = await repo.createList(
        EVENT_ID,
        "Samstagsrezepte",
        ["menue-001", "menue-002"],
        ["meal-001", "meal-002"],
      );

      expect(result).toEqual({
        id: "list-001",
        eventId: EVENT_ID,
        name: "Samstagsrezepte",
        selectedMenues: ["menue-001", "menue-002"],
        selectedMeals: ["meal-001", "meal-002"],
        updatedAt: new Date("2026-03-01T00:00:00Z"),
      });

      expect(queryMock.insert).toHaveBeenCalledWith({
        event_id: EVENT_ID,
        name: "Samstagsrezepte",
        selected_menue_ids: ["menue-001", "menue-002"],
        selected_meal_ids: ["meal-001", "meal-002"],
      });

      // Nur eine Tabelle geschrieben (keine Junction-Inserts mehr)
      expect(client.from).toHaveBeenCalledTimes(1);
    });

    it("should create list with empty arrays if none selected", async () => {
      const emptyRow: UsedRecipeListRow = {
        ...testListRow1,
        selected_menue_ids: [],
        selected_meal_ids: [],
      };
      queryMock.single.mockResolvedValue({data: emptyRow, error: null});

      const result = await repo.createList(EVENT_ID, "Samstagsrezepte", []);

      expect(result.selectedMenues).toEqual([]);
      expect(result.selectedMeals).toEqual([]);
      expect(client.from).toHaveBeenCalledTimes(1);
    });
  });

  /* =====================================================================
  // updateListName
  // ===================================================================== */
  describe("updateListName", () => {
    it("should update the list name", async () => {
      queryMock.eq.mockResolvedValue({data: null, error: null});

      await repo.updateListName("list-001", "Neuer Name");

      expect(client.from).toHaveBeenCalledWith("event_used_recipe_lists");
      expect(queryMock.update).toHaveBeenCalledWith({name: "Neuer Name"});
      expect(queryMock.eq).toHaveBeenCalledWith("id", "list-001");
    });

    it("should throw on error", async () => {
      queryMock.eq.mockResolvedValue({
        data: null,
        error: {message: "Not found"},
      });

      await expect(
        repo.updateListName("list-999", "Name"),
      ).rejects.toEqual({message: "Not found"});
    });
  });

  /* =====================================================================
  // updateListMenues
  // ===================================================================== */
  describe("updateListMenues", () => {
    it("should update selected_menue_ids array", async () => {
      queryMock.eq.mockResolvedValue({data: null, error: null});

      await repo.updateListMenues("list-001", ["menue-003"]);

      expect(client.from).toHaveBeenCalledWith("event_used_recipe_lists");
      expect(queryMock.update).toHaveBeenCalledWith({
        selected_menue_ids: ["menue-003"],
      });
      expect(queryMock.eq).toHaveBeenCalledWith("id", "list-001");
    });
  });

  /* =====================================================================
  // updateListMeals
  // ===================================================================== */
  describe("updateListMeals", () => {
    it("should update selected_meal_ids array", async () => {
      queryMock.eq.mockResolvedValue({data: null, error: null});

      await repo.updateListMeals("list-001", ["meal-003"]);

      expect(client.from).toHaveBeenCalledWith("event_used_recipe_lists");
      expect(queryMock.update).toHaveBeenCalledWith({
        selected_meal_ids: ["meal-003"],
      });
      expect(queryMock.eq).toHaveBeenCalledWith("id", "list-001");
    });

    it("should set empty array when no meals provided", async () => {
      queryMock.eq.mockResolvedValue({data: null, error: null});

      await repo.updateListMeals("list-001", []);

      expect(queryMock.update).toHaveBeenCalledWith({
        selected_meal_ids: [],
      });
    });
  });

  /* =====================================================================
  // updateListMenuesAndMeals
  // ===================================================================== */
  describe("updateListMenuesAndMeals", () => {
    it("should update both arrays in a single UPDATE", async () => {
      queryMock.eq.mockResolvedValue({data: null, error: null});

      await repo.updateListMenuesAndMeals(
        "list-001",
        ["menue-003"],
        ["meal-002"],
      );

      expect(queryMock.update).toHaveBeenCalledWith({
        selected_menue_ids: ["menue-003"],
        selected_meal_ids: ["meal-002"],
      });
      expect(queryMock.eq).toHaveBeenCalledWith("id", "list-001");

      // Nur ein from()-Aufruf (ein UPDATE statt 2 deletes + 2 inserts + 1 touch)
      expect(client.from).toHaveBeenCalledTimes(1);
    });
  });

  /* =====================================================================
  // deleteList
  // ===================================================================== */
  describe("deleteList", () => {
    it("should delete the list", async () => {
      queryMock.eq.mockResolvedValue({data: null, error: null});

      await repo.deleteList("list-001");

      expect(client.from).toHaveBeenCalledWith("event_used_recipe_lists");
      expect(queryMock.delete).toHaveBeenCalled();
      expect(queryMock.eq).toHaveBeenCalledWith("id", "list-001");
    });
  });

  /* =====================================================================
  // getRecipesForList (RPC)
  // ===================================================================== */
  describe("getRecipesForList", () => {
    it("should call RPC and map results to domain", async () => {
      client.rpc.mockResolvedValue({data: [testRecipeRow], error: null});

      const result = await repo.getRecipesForList("list-001");

      expect(client.rpc).toHaveBeenCalledWith(
        "get_used_recipe_list_recipes",
        {p_list_id: "list-001"},
      );
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        recipeId: "recipe-001",
        recipeName: "Pasta Carbonara",
        menueId: "menue-001",
        mealId: "meal-001",
        mealDate: new Date("2026-03-15"),
        mealTypeName: "Abendessen",
      });
    });

    it("should return empty array when no recipes found", async () => {
      client.rpc.mockResolvedValue({data: [], error: null});

      const result = await repo.getRecipesForList("list-001");

      expect(result).toEqual([]);
    });

    it("should throw on RPC error", async () => {
      client.rpc.mockResolvedValue({
        data: null,
        error: {message: "RPC failed"},
      });

      await expect(repo.getRecipesForList("list-001")).rejects.toEqual({
        message: "RPC failed",
      });
    });
  });

  /* =====================================================================
  // subscribeToLists
  // ===================================================================== */
  describe("subscribeToLists", () => {
    it("should set up realtime channel and return unsubscribe function", () => {
      const onData = jest.fn();
      const onError = jest.fn();
      const mockChannel = {
        on: jest.fn().mockReturnThis(),
        subscribe: jest.fn().mockReturnThis(),
      };
      client.channel.mockReturnValue(mockChannel);

      const unsubscribe = repo.subscribeToLists(EVENT_ID, onData, onError);

      expect(client.channel).toHaveBeenCalledWith(
        `usedrecipelists:${EVENT_ID}`,
      );
      expect(mockChannel.on).toHaveBeenCalledWith(
        "postgres_changes",
        expect.objectContaining({
          event: "*",
          schema: "public",
          table: "event_used_recipe_lists",
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
});
