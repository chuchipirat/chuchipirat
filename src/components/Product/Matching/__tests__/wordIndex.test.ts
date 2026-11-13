/**
 * Unit-Tests für die Suche passender Wörter im Index.
 *
 * Der Wort-Index kennt nur Wörter, keine Produkte: Er sagt, welche bekannten
 * Wörter zu einem Wort passen und über welche Regel. Welche Produkte dazu
 * gehören, entscheidet der Produkt-Index.
 */
import {WordIndex} from "../wordIndex.class";
import {MatchRule} from "../productMatching.types";

const INDEX_WORDS = [
  "zimt",
  "zimtstangen",
  "chilis",
  "tomaten",
  "mais",
  "rahm",
  "gemuese",
];

/** Regel je gefundenem Wort, damit die Reihenfolge der Treffer keine Rolle spielt. */
const rulesOf = (index: WordIndex, word: string): Record<string, MatchRule> =>
  Object.fromEntries(
    index
      .findPartners(word)
      .map((partner) => [partner.word, partner.comparison.rule]),
  );

describe("WordIndex", () => {
  const index = new WordIndex(INDEX_WORDS);

  test("findet das gleiche Wort", () => {
    expect(rulesOf(index, "tomaten")).toEqual({tomaten: MatchRule.EXACT});
  });

  test("findet ein Wort mit gleichem Stamm", () => {
    expect(rulesOf(index, "chili")).toEqual({chilis: MatchRule.STEM});
  });

  test("findet ein Wort mit Tippfehler", () => {
    expect(rulesOf(index, "tomatem")).toEqual({tomaten: MatchRule.TYPO});
  });

  test("findet längere Wörter, in denen das Wort steckt", () => {
    expect(rulesOf(index, "zimt")).toEqual({
      zimt: MatchRule.EXACT,
      zimtstangen: MatchRule.COMPOUND,
    });
  });

  test("findet kürzere Wörter, die im Wort stecken", () => {
    expect(rulesOf(index, "haferrahm")).toEqual({rahm: MatchRule.COMPOUND});
    expect(rulesOf(index, "restengemuese")).toEqual({
      gemuese: MatchRule.COMPOUND,
    });
  });

  test("liefert das Gewicht der Regel mit", () => {
    expect(index.findPartners("tomatem")).toEqual([
      {word: "tomaten", comparison: {rule: MatchRule.TYPO, weight: 0.8}},
    ]);
  });

  test("findet nichts, wenn kein Wort passt", () => {
    // Bei vier Buchstaben ist kein Tippfehler erlaubt
    expect(index.findPartners("reis")).toEqual([]);
  });

  test("gleiche Wörter im Index ergeben einen Treffer", () => {
    const indexWithDuplicates = new WordIndex(["zimt", "zimt"]);

    expect(indexWithDuplicates.findPartners("zimt")).toHaveLength(1);
  });

  test("leerer Index findet nichts", () => {
    expect(new WordIndex([]).findPartners("zimt")).toEqual([]);
  });
});
