/**
 * Unit-Tests für ShoppingListRepository.
 *
 * Schwerpunkt: `saveListItems` delegiert an die nebenläufigkeitssichere
 * Diff-RPC `save_shopping_list_items(p_list_id, p_items, p_known_ids)`.
 */
import {
  ShoppingListRepository,
  ShoppingListItemInsertRow,
} from "../ShoppingListRepository";
import {createSupabaseMock} from "../__mocks__/supabaseMock";

jest.mock("../../../Shared/sessionStorageHandler.class", () => {
  const actual = jest.requireActual(
    "../../../Shared/sessionStorageHandler.class",
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

const LIST_ID = "list-001";

const insertItem: ShoppingListItemInsertRow = {
  id: "row-1",
  list_id: LIST_ID,
  product_id: "product-001",
  quantity: 3,
  unit: "kg",
  checked: false,
  edit_source: "manual_edit",
  sort_order: 0,
};

describe("ShoppingListRepository.saveListItems", () => {
  let repo: ShoppingListRepository;
  let client: ReturnType<typeof createSupabaseMock>["client"];

  beforeEach(() => {
    ({client} = createSupabaseMock());
    repo = new ShoppingListRepository();
    (repo as unknown as {client: typeof client}).client = client;
  });

  it("ruft die Diff-RPC mit list-id, items und knownIds (ohne list_id im Payload)", async () => {
    await repo.saveListItems(LIST_ID, [insertItem], ["row-1", "row-2"]);

    expect(client.rpc).toHaveBeenCalledTimes(1);
    expect(client.rpc).toHaveBeenCalledWith("save_shopping_list_items", {
      p_list_id: LIST_ID,
      p_items: [
        {
          id: "row-1",
          product_id: "product-001",
          quantity: 3,
          unit: "kg",
          checked: false,
          edit_source: "manual_edit",
          sort_order: 0,
        },
      ],
      p_known_ids: ["row-1", "row-2"],
    });
    expect(client.from).not.toHaveBeenCalled();
  });

  it("schickt bei leerer Liste ein leeres Items-Array", async () => {
    await repo.saveListItems(LIST_ID, [], ["row-1"]);

    expect(client.rpc).toHaveBeenCalledWith("save_shopping_list_items", {
      p_list_id: LIST_ID,
      p_items: [],
      p_known_ids: ["row-1"],
    });
  });

  it("wirft, wenn die RPC scheitert", async () => {
    client.rpc.mockResolvedValueOnce({
      data: null,
      error: {message: "row-level security violation"},
    });

    await expect(repo.saveListItems(LIST_ID, [insertItem], [])).rejects.toEqual({
      message: "row-level security violation",
    });
  });
});
