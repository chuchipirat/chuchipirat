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
