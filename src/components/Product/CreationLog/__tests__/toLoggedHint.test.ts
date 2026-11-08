/**
 * Unit-Tests für toLoggedHint.
 *
 * Baut aus angezeigten Produkten bzw. Materialien einen Hinweis in der Form,
 * wie er im Anlegen-Protokoll gespeichert wird.
 */
import {toLoggedHint} from "../toLoggedHint";
import {NameHintKind} from "../../Matching/nameHint.types";

describe("toLoggedHint", () => {
  test("übernimmt Art und Vorschläge in der angezeigten Reihenfolge", () => {
    const hint = toLoggedHint(
      NameHintKind.SIMILAR_PRODUCT,
      [
        {uid: "product-1", name: "Tomaten"},
        {uid: "product-2", name: "Tomatensauce"},
      ],
      "product",
    );

    expect(hint).toEqual({
      kind: NameHintKind.SIMILAR_PRODUCT,
      rule: null,
      score: null,
      word: null,
      suggestions: [
        {id: "product-1", name: "Tomaten", source: "product"},
        {id: "product-2", name: "Tomatensauce", source: "product"},
      ],
    });
  });

  test("setzt die Quelle für Materialien", () => {
    const hint = toLoggedHint(
      NameHintKind.EXACT_PRODUCT,
      [{uid: "material-1", name: "Alufolie"}],
      "material",
    );

    expect(hint.suggestions).toEqual([
      {id: "material-1", name: "Alufolie", source: "material"},
    ]);
  });

  test("nimmt nur ID und Name, keine weiteren Felder des Eintrags", () => {
    const product = {
      uid: "product-1",
      name: "Tomaten",
      usable: true,
      department: {uid: "dept-1", name: "Gemüse"},
    };

    const hint = toLoggedHint(
      NameHintKind.SIMILAR_PRODUCT,
      [product],
      "product",
    );

    expect(Object.keys(hint.suggestions[0]).sort()).toEqual([
      "id",
      "name",
      "source",
    ]);
  });

  test("ohne Einträge entsteht ein Hinweis ohne Vorschläge", () => {
    const hint = toLoggedHint(NameHintKind.SIMILAR_PRODUCT, [], "product");

    expect(hint.suggestions).toEqual([]);
  });
});
