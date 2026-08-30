/**
 * Unit-Tests für dedupeByUid und die Deduplizierung in
 * MenuplanRepository.saveMenuplan.
 *
 * Regression CHUCHIPIRAT-GE: Ein In-Place-Mutation-Bug im Menuplan-Editor
 * konnte eine `uid` doppelt in `mealTypes.order` legen; saveMenuplan schickte
 * dann zwei Zeilen mit derselben id an die RPC-Funktion, was an
 * `event_meal_types_pkey` (23505) scheiterte.
 */
import {
  MenuplanRepository,
  dedupeByUid,
  MenuplanDomain,
} from "../MenuplanRepository";
import {createSupabaseMock} from "../__mocks__/supabaseMock";
import {AuthUser} from "../../../Session/authUser.class";

describe("dedupeByUid", () => {
  test("entfernt Einträge mit doppelter uid, erster gewinnt", () => {
    const items = [
      {uid: "a", name: "erste"},
      {uid: "b", name: "b"},
      {uid: "a", name: "zweite"},
    ];

    expect(dedupeByUid(items)).toEqual([
      {uid: "a", name: "erste"},
      {uid: "b", name: "b"},
    ]);
  });

  test("lässt eine Liste ohne Duplikate unverändert", () => {
    const items = [{uid: "a"}, {uid: "b"}, {uid: "c"}];
    expect(dedupeByUid(items)).toEqual(items);
  });

  test("behält die Reihenfolge bei", () => {
    const items = [{uid: "c"}, {uid: "a"}, {uid: "c"}, {uid: "b"}];
    expect(dedupeByUid(items).map((entry) => entry.uid)).toEqual([
      "c",
      "a",
      "b",
    ]);
  });
});

/* =====================================================================
// saveMenuplan — Deduplizierung
// ===================================================================== */

const emptyMenuplan = (
  overrides: Partial<MenuplanDomain> = {},
): MenuplanDomain => ({
  eventId: "event-1",
  mealTypes: [],
  meals: [],
  menues: [],
  menueRecipes: [],
  menueProducts: [],
  menueMaterials: [],
  notes: [],
  lastSavedAt: new Date(0),
  ...overrides,
});

describe("MenuplanRepository.saveMenuplan — Deduplizierung", () => {
  let repo: MenuplanRepository;
  let supabaseMock: ReturnType<typeof createSupabaseMock>;

  beforeEach(() => {
    supabaseMock = createSupabaseMock();
    repo = new MenuplanRepository();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (repo as any).client = supabaseMock.client;
  });

  test("schickt bei doppelter MealType-uid nur eine Zeile an die RPC", async () => {
    const menuplan = emptyMenuplan({
      mealTypes: [
        {uid: "mt-1", name: "Zmorge", sortOrder: 0},
        {uid: "mt-1", name: "Zmorge", sortOrder: 0},
      ],
      meals: [{uid: "meal-1", mealDate: "2026-08-01", mealTypeId: "mt-1"}],
    });

    await repo.saveMenuplan("event-1", menuplan, {} as AuthUser);

    expect(supabaseMock.client.rpc).toHaveBeenCalledTimes(1);
    const [fnName, args] = supabaseMock.client.rpc.mock.calls[0];
    expect(fnName).toBe("save_menuplan");
    expect(args.p_payload.mealTypes).toHaveLength(1);
    expect(args.p_payload.mealTypes[0].id).toBe("mt-1");
  });

  test("lässt einen sauberen Menuplan unverändert durch", async () => {
    const menuplan = emptyMenuplan({
      mealTypes: [
        {uid: "mt-1", name: "Zmorge", sortOrder: 0},
        {uid: "mt-2", name: "Zmittag", sortOrder: 1},
      ],
      meals: [
        {uid: "meal-1", mealDate: "2026-08-01", mealTypeId: "mt-1"},
        {uid: "meal-2", mealDate: "2026-08-01", mealTypeId: "mt-2"},
      ],
    });

    await repo.saveMenuplan("event-1", menuplan, {} as AuthUser);

    const [, args] = supabaseMock.client.rpc.mock.calls[0];
    expect(args.p_payload.mealTypes).toHaveLength(2);
    expect(args.p_payload.meals).toHaveLength(2);
  });
});
