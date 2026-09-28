/**
 * Unit-Tests für ShoppingList.createNewList.
 *
 * Regression CHUCHIPIRAT-G6: "Die Auswahl beinhaltet keine Artikel." ist ein
 * Nutzer-Hinweis (leere Auswahl an Menüs/Abteilungen), wurde aber als rohe
 * Exception geworfen und in der UI unconditional an Sentry gemeldet.
 *
 * Regression CHUCHIPIRAT-HY: Verweist ein Rezept oder der Menüplan auf ein
 * Produkt/Material, das nicht in der geladenen Liste ist (z.B. inzwischen
 * deaktiviert), crashte `addTraceEntry` mit "reading 'uid'".
 */
import {ShoppingList} from "../shoppingList.class";
import {FieldValidationError} from "../../../Shared/fieldValidation.error.class";
import {createEmptyMenuplan} from "../../Menuplan/menuplanService";
import {UsedRecipes} from "../../UsedRecipes/usedRecipes.class";
import Recipe from "../../../Recipe/recipe.class";
import {Product} from "../../../Product/product.types";
import Department from "../../../Department/department.class";
import {MenuplanData} from "../../Menuplan/menuplan.types";

describe("ShoppingList.createNewList", () => {
  test("wirft FieldValidationError, wenn die Auswahl keine Artikel ergibt", () => {
    expect(() =>
      ShoppingList.createNewList({
        selectedMenues: [],
        selectedDepartments: [],
        menueplan: createEmptyMenuplan(),
        recipes: {},
        products: [],
        materials: [],
        departments: [],
        units: [],
        unitConversionBasic: {},
        unitConversionProducts: {},
      }),
    ).toThrow(FieldValidationError);
  });

  test("die geworfene FieldValidationError trägt die Nutzer-Hinweismeldung", () => {
    try {
      ShoppingList.createNewList({
        selectedMenues: [],
        selectedDepartments: [],
        menueplan: createEmptyMenuplan(),
        recipes: {},
        products: [],
        materials: [],
        departments: [],
        units: [],
        unitConversionBasic: {},
        unitConversionProducts: {},
      });
      fail("sollte werfen");
    } catch (error) {
      expect(error).toBeInstanceOf(FieldValidationError);
      expect((error as Error).message).toBe(
        "Die Auswahl beinhaltet keine Artikel.",
      );
    }
  });
});

describe("ShoppingList.createNewList — fehlende Produkte/Materialien (CHUCHIPIRAT-HY)", () => {
  const department = {uid: "dep-1", name: "Gemüse", pos: 1} as Department;
  const knownProduct = {
    uid: "prod-known",
    name: "Rüebli",
    department: {uid: "dep-1"},
  } as unknown as Product;

  /**
   * Baut einen Menüplan mit einem Menü, das ein Rezept sowie direkt
   * eingetragene Produkte enthält.
   */
  const buildMenuplan = (menuplanProductUids: string[]): MenuplanData => {
    const menuplan = createEmptyMenuplan();
    menuplan.menues = {
      "menue-1": {
        mealRecipeOrder: ["meal-recipe-1"],
        productOrder: menuplanProductUids.map((uid) => `mp-${uid}`),
        materialOrder: [],
      },
    } as never;
    menuplan.mealRecipes = {
      "meal-recipe-1": {
        recipe: {recipeUid: "recipe-1", name: "Suppe"},
        totalPortions: 10,
      },
    } as never;
    menuplan.products = Object.fromEntries(
      menuplanProductUids.map((uid) => [
        `mp-${uid}`,
        {productUid: uid, totalQuantity: 2, unit: "kg"},
      ]),
    ) as never;
    return menuplan;
  };

  /**
   * Ruft createNewList mit den Standard-Stammdaten auf.
   */
  const createList = (params: {menuplan: MenuplanData; departments?: Department[]}) =>
    ShoppingList.createNewList({
      selectedMenues: ["menue-1"],
      selectedDepartments: ["dep-1"],
      menueplan: params.menuplan,
      recipes: {"recipe-1": {uid: "recipe-1"} as unknown as Recipe},
      products: [knownProduct],
      materials: [],
      departments: params.departments ?? [department],
      units: [],
      unitConversionBasic: {},
      unitConversionProducts: {},
    });

  /**
   * Liefert alle Item-UIDs der generierten Liste.
   */
  const itemUids = (shoppingList: ShoppingList) =>
    Object.values(shoppingList.list).flatMap((listDepartment) =>
      listDepartment.items.map((listItem) => listItem.item.uid),
    );

  beforeEach(() => {
    jest
      .spyOn(UsedRecipes, "defineSelectedRecipes")
      .mockReturnValue(["recipe-1"] as never);
    jest.spyOn(Recipe, "scaleIngredients").mockReturnValue({} as never);
    jest.spyOn(Recipe, "scaleMaterials").mockReturnValue({} as never);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("überspringt eine Rezept-Zutat, deren Produkt nicht geladen ist", () => {
    jest.spyOn(Recipe, "scaleIngredients").mockReturnValue({
      "ing-1": {product: {uid: "prod-missing"}, quantity: 1, unit: "kg"},
      "ing-2": {product: {uid: "prod-known"}, quantity: 3, unit: "kg"},
    } as never);

    const {shoppingList, trace} = createList({menuplan: buildMenuplan([])});

    expect(itemUids(shoppingList)).toEqual(["prod-known"]);
    expect(Object.keys(trace)).toEqual(["prod-known"]);
  });

  test("überspringt ein Menüplan-Produkt, das nicht geladen ist", () => {
    const {shoppingList, trace} = createList({
      menuplan: buildMenuplan(["prod-missing", "prod-known"]),
    });

    expect(itemUids(shoppingList)).toEqual(["prod-known"]);
    expect(Object.keys(trace)).toEqual(["prod-known"]);
  });

  test("überspringt ein Rezept-Material, das nicht geladen ist (ohne Non-Food-Abteilung)", () => {
    jest.spyOn(Recipe, "scaleMaterials").mockReturnValue({
      "mat-pos-1": {material: {uid: "mat-missing"}, quantity: 1},
    } as never);

    const {shoppingList, trace} = createList({
      menuplan: buildMenuplan(["prod-known"]),
      departments: [department],
    });

    expect(itemUids(shoppingList)).toEqual(["prod-known"]);
    expect(trace).not.toHaveProperty("mat-missing");
  });

  test("zählt übersprungene Artikel nicht — nur fehlende ergibt den Nutzer-Hinweis", () => {
    jest.spyOn(Recipe, "scaleIngredients").mockReturnValue({
      "ing-1": {product: {uid: "prod-missing"}, quantity: 1, unit: "kg"},
    } as never);

    expect(() => createList({menuplan: buildMenuplan([])})).toThrow(
      FieldValidationError,
    );
  });
});
