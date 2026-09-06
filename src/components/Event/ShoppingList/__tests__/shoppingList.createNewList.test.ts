/**
 * Unit-Tests für ShoppingList.createNewList.
 *
 * Regression CHUCHIPIRAT-G6: "Die Auswahl beinhaltet keine Artikel." ist ein
 * Nutzer-Hinweis (leere Auswahl an Menüs/Abteilungen), wurde aber als rohe
 * Exception geworfen und in der UI unconditional an Sentry gemeldet.
 */
import {ShoppingList} from "../shoppingList.class";
import {FieldValidationError} from "../../../Shared/fieldValidation.error.class";
import {createEmptyMenuplan} from "../../Menuplan/menuplanService";

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
