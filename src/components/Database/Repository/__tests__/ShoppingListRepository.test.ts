/**
 * Unit-Tests für ShoppingListRepository.
 *
 * Schwerpunkt: `saveListItems` delegiert an die atomare RPC
 * `save_shopping_list_items` (statt separatem DELETE + INSERT), damit
 * konkurrierende Speichervorgänge serverseitig serialisiert werden und keine
 * Duplikat-Zeilen mehr entstehen.
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

  it("ruft die RPC save_shopping_list_items mit list-id und items auf", async () => {
    await repo.saveListItems(LIST_ID, [insertItem]);

    expect(client.rpc).toHaveBeenCalledTimes(1);
    expect(client.rpc).toHaveBeenCalledWith("save_shopping_list_items", {
      p_list_id: LIST_ID,
      p_items: [
        {
          product_id: "product-001",
          quantity: 3,
          unit: "kg",
          checked: false,
          edit_source: "manual_edit",
          sort_order: 0,
        },
      ],
    });
    // Kein direkter Tabellenzugriff mehr — alles über die RPC.
    expect(client.from).not.toHaveBeenCalled();
  });

  it("entfernt list_id aus dem Payload (wird serverseitig gesetzt)", async () => {
    await repo.saveListItems(LIST_ID, [insertItem]);

    const [, args] = client.rpc.mock.calls[0];
    expect(args.p_items[0]).not.toHaveProperty("list_id");
  });

  it("schickt bei leerer Liste ein leeres Array (löscht serverseitig alle)", async () => {
    await repo.saveListItems(LIST_ID, []);

    expect(client.rpc).toHaveBeenCalledWith("save_shopping_list_items", {
      p_list_id: LIST_ID,
      p_items: [],
    });
  });

  it("wirft den Fehler, wenn die RPC scheitert", async () => {
    client.rpc.mockResolvedValueOnce({
      data: null,
      error: {message: "row-level security violation"},
    });

    await expect(repo.saveListItems(LIST_ID, [insertItem])).rejects.toEqual({
      message: "row-level security violation",
    });
  });
});
