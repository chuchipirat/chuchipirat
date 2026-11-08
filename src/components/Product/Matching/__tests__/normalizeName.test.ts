/**
 * Unit-Tests für die Normalisierung von Produkt- und Materialnamen.
 *
 * Zwei Schreibweisen desselben Namens müssen nach der Normalisierung gleich
 * sein. Alles Weitere der Abgleich-Logik baut darauf auf.
 */
import {normalizeName, tokenizeName} from "../normalizeName";
import {NORMALIZATION_CASES} from "../__mocks__/normalizationCases.mock";
import {EDGE_CASES} from "../__mocks__/productMatchingCases.mock";

describe("normalizeName", () => {
  test.each(NORMALIZATION_CASES)("«%s» wird «%s»", (input, expected) => {
    expect(normalizeName(input)).toBe(expected);
  });

  test("Grossschrift mit doppeltem Leerzeichen ergibt denselben Namen wie das Produkt", () => {
    const upperCaseCase = EDGE_CASES.find((matchingCase) =>
      matchingCase.name.startsWith("Gleicher Name in Grossschrift"),
    );

    expect(upperCaseCase).toBeDefined();
    expect(normalizeName(upperCaseCase?.input ?? "")).toBe(
      normalizeName(upperCaseCase?.bestSuggestion ?? "-"),
    );
  });

  test("Schreibweise ohne Umlaut-Taste trifft das Original", () => {
    expect(normalizeName("Rueebli")).toBe(normalizeName("Rüebli"));
    expect(normalizeName("Mueesli")).toBe(normalizeName("Müesli"));
  });

  test("leere Eingabe ergibt einen leeren Namen", () => {
    expect(normalizeName("")).toBe("");
  });

  test("nur Satzzeichen ergibt einen leeren Namen", () => {
    expect(normalizeName(" (),.!? - ")).toBe("");
  });

  test("ein bereits normalisierter Name bleibt gleich", () => {
    NORMALIZATION_CASES.forEach(([, expected]) =>
      expect(normalizeName(expected)).toBe(expected),
    );
  });
});

describe("tokenizeName", () => {
  test("zerlegt in normalisierte Wörter in ihrer Reihenfolge", () => {
    expect(tokenizeName("Griechischer Joghurt, laktosefrei")).toEqual([
      "griechischer",
      "joghurt",
      "laktosefrei",
    ]);
  });

  test("enthält keine leeren Wörter", () => {
    expect(tokenizeName("  Rahm  ,  vegan  ")).toEqual(["rahm", "vegan"]);
  });

  test("leere Eingabe ergibt keine Wörter", () => {
    expect(tokenizeName("")).toEqual([]);
    expect(tokenizeName(" ,. ")).toEqual([]);
  });

  test("«z.B.» und «z. B.» ergeben dieselben Wörter", () => {
    expect(tokenizeName("Gemüse (z.B. Karotten)")).toEqual(
      tokenizeName("Gemüse (z. B. Karotten)"),
    );
  });

  test("Bindestrich trennt Wörter", () => {
    expect(tokenizeName("Chili-Sauce")).toEqual(["chili", "sauce"]);
  });
});
