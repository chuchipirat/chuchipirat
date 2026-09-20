/**
 * Unit-Tests für AdminOperationsRepository.
 *
 * Regression: `convertMaterialToProduct` gab die im Dialog gewählte Diät und
 * die Allergene nicht an die RPC weiter — konvertierte Produkte waren immer
 * `meat` ohne Allergene.
 */
import {createSupabaseMock} from "../__mocks__/supabaseMock";
import {AdminOperationsRepository} from "../AdminOperationsRepository";
import {Allergen, Diet} from "../../../Product/product.types";

describe("AdminOperationsRepository.convertMaterialToProduct", () => {
  let supabaseMock: ReturnType<typeof createSupabaseMock>;
  let repo: AdminOperationsRepository;

  beforeEach(() => {
    supabaseMock = createSupabaseMock();
    supabaseMock.client.rpc = jest
      .fn()
      .mockResolvedValue({data: {new_product_id: "p-new"}, error: null});
    repo = new AdminOperationsRepository(
      supabaseMock.client as never,
    );
  });

  test("übersetzt die gewählte Diät und Allergene in DB-ENUM-Werte", async () => {
    await repo.convertMaterialToProduct("mat-1", "dep-1", "kg", {
      diet: Diet.Vegan,
      allergens: [Allergen.Gluten],
    });

    expect(supabaseMock.client.rpc).toHaveBeenCalledWith(
      "convert_material_to_product",
      {
        material_id_param: "mat-1",
        department_id_param: "dep-1",
        shopping_unit_param: "kg",
        diet_param: "vegan",
        allergens_param: ["gluten"],
      },
    );
  });

  test("filtert Allergen.None heraus und nutzt 'meat' als Default", async () => {
    await repo.convertMaterialToProduct("mat-2", undefined, undefined, {
      diet: Diet.Meat,
      allergens: [Allergen.None],
    });

    expect(supabaseMock.client.rpc).toHaveBeenCalledWith(
      "convert_material_to_product",
      expect.objectContaining({
        diet_param: "meat",
        allergens_param: [],
      }),
    );
  });

  test("ohne dietProperties: 'meat' + keine Allergene", async () => {
    await repo.convertMaterialToProduct("mat-3");

    expect(supabaseMock.client.rpc).toHaveBeenCalledWith(
      "convert_material_to_product",
      expect.objectContaining({diet_param: "meat", allergens_param: []}),
    );
  });

  test("propagiert einen RPC-Fehler", async () => {
    supabaseMock.client.rpc = jest
      .fn()
      .mockResolvedValue({data: null, error: {message: "boom"}});

    await expect(repo.convertMaterialToProduct("mat-4")).rejects.toThrow(
      "boom",
    );
  });
});

describe("AdminOperationsRepository — Deploy-Check", () => {
  let supabaseMock: ReturnType<typeof createSupabaseMock>;
  let repo: AdminOperationsRepository;

  const mockRpc = (data: unknown, error: {message: string} | null = null) => {
    supabaseMock.client.rpc = jest.fn().mockResolvedValue({data, error});
  };

  beforeEach(() => {
    supabaseMock = createSupabaseMock();
    repo = new AdminOperationsRepository(supabaseMock.client as never);
  });

  test("getRunningEvents mappt Zeilen und parst Datum lokal (kein UTC-Versatz)", async () => {
    mockRpc([
      {
        event_id: "event-1",
        name: "SoLa 2026",
        location: "Lungern OW",
        date_from: "2026-09-15",
        date_to: "2026-09-18",
      },
    ]);

    const events = await repo.getRunningEvents();

    expect(supabaseMock.client.rpc).toHaveBeenCalledWith(
      "admin_get_running_events",
    );
    expect(events).toHaveLength(1);
    expect(events[0].eventId).toBe("event-1");
    expect(events[0].dateFrom.getDate()).toBe(15);
    expect(events[0].dateTo.getDate()).toBe(18);
  });

  test("getRunningEvents liefert bei leerem Ergebnis ein leeres Array", async () => {
    mockRpc(null);
    await expect(repo.getRunningEvents()).resolves.toEqual([]);
  });

  test("getRecentActivity übergibt das Zeitfenster und mappt Zeilen", async () => {
    mockRpc([
      {
        user_id: null,
        user_name: "System",
        area: "recipe",
        object_id: "recipe-1",
        object_name: "Spaghetti",
        last_activity_at: "2026-09-18T12:00:00Z",
      },
    ]);

    const activities = await repo.getRecentActivity(60);

    expect(supabaseMock.client.rpc).toHaveBeenCalledWith(
      "admin_get_recent_activity",
      {p_since_minutes: 60},
    );
    expect(activities[0]).toEqual({
      userId: null,
      userName: "System",
      area: "recipe",
      objectId: "recipe-1",
      objectName: "Spaghetti",
      lastActivityAt: new Date("2026-09-18T12:00:00Z"),
    });
  });

  test("getRecentActivity nutzt 24 Stunden als Standard", async () => {
    mockRpc([]);
    await repo.getRecentActivity();
    expect(supabaseMock.client.rpc).toHaveBeenCalledWith(
      "admin_get_recent_activity",
      {p_since_minutes: 1440},
    );
  });

  test("beide Methoden propagieren einen RPC-Fehler", async () => {
    mockRpc(null, {message: "boom"});
    await expect(repo.getRunningEvents()).rejects.toThrow("boom");
    await expect(repo.getRecentActivity()).rejects.toThrow("boom");
  });
});
