/**
 * Unit-Tests für parseMenuTypeSelection.
 *
 * Regression CHUCHIPIRAT-HV: Beim Browser-Autofill liefert MUIs
 * `Select multiple` den Wert als kommagetrennten String statt als Array.
 * Der String landete als `recipe.menuTypes` im State, und `renderValue`
 * crashte mit "u.map is not a function".
 */
import {parseMenuTypeSelection} from "../parseMenuTypeSelection";
import {MenuType} from "../recipe.class";

describe("parseMenuTypeSelection", () => {
  test("wandelt gemischte Zahlen/Strings in sortierte MenuTypes um", () => {
    expect(parseMenuTypeSelection([MenuType.Dessert, "1"])).toEqual([
      MenuType.MainCourse,
      MenuType.Dessert,
    ]);
  });

  test("entfernt einen abgewählten Wert (doppelt als Zahl und String)", () => {
    expect(
      parseMenuTypeSelection([MenuType.MainCourse, MenuType.Dessert, "4"]),
    ).toEqual([MenuType.MainCourse]);
  });

  test("liefert für eine leere Auswahl ein leeres Array", () => {
    expect(parseMenuTypeSelection([])).toEqual([]);
  });

  test("akzeptiert den Autofill-String mit einem Wert", () => {
    expect(parseMenuTypeSelection("2")).toEqual([MenuType.SideDish]);
  });

  test("akzeptiert den Autofill-String mit mehreren Werten", () => {
    expect(parseMenuTypeSelection("5,1")).toEqual([
      MenuType.MainCourse,
      MenuType.Breakfast,
    ]);
  });

  test("ignoriert einen leeren oder ungültigen String", () => {
    expect(parseMenuTypeSelection("")).toEqual([]);
    expect(parseMenuTypeSelection("abc")).toEqual([]);
  });
});
