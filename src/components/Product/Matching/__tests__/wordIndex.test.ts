/**
 * Unit-Tests für die Suche passender Wörter im Index.
 *
 * Der Wort-Index kennt nur Wörter, keine Produkte: Er sagt, welche bekannten
 * Wörter zu einem Wort passen und über welche Regel. Welche Produkte dazu
 * gehören, entscheidet der Produkt-Index.
 *
 * Der Index schlägt in vorbereiteten Tabellen nach, statt jedes Wort zu
 * vergleichen. Er muss trotzdem genau dieselben Wörter finden wie der
 * Vergleich mit jedem Wort; das prüfen die erzeugten Abwandlungen unten.
 */
import {compareWords} from "../compareWords";
import {WordIndex, WordPartner} from "../wordIndex.class";
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

/* =====================================================================
// Einzelne Fälle, die das Nachschlagen leicht übersieht
// ===================================================================== */
describe("WordIndex: schwierige Fälle", () => {
  test("Tippfehler, der nur zwischen den Stämmen klein ist", () => {
    // Als Wörter 6 Änderungen auseinander, als Stämme «wuerst»/«wurst» nur 1
    expect(rulesOf(new WordIndex(["wurst"]), "wuerstchen")).toEqual({
      wurst: MatchRule.TYPO,
    });
  });

  test("zwei Tippfehler bei langen Wörtern", () => {
    expect(rulesOf(new WordIndex(["schwingbesen"]), "schwongbeson")).toEqual({
      schwingbesen: MatchRule.TYPO,
    });
  });

  test("vertauschte Buchstaben", () => {
    expect(rulesOf(new WordIndex(["tomaten"]), "tomtaen")).toEqual({
      tomaten: MatchRule.TYPO,
    });
  });

  test("Teilwort mit kürzester erlaubter Länge, in beide Richtungen", () => {
    // Vier Buchstaben Teilwort, drei Buchstaben Rest
    expect(rulesOf(new WordIndex(["rahm"]), "rahmeis")).toEqual({
      rahm: MatchRule.COMPOUND,
    });
    expect(rulesOf(new WordIndex(["rahmeis"]), "rahm")).toEqual({
      rahmeis: MatchRule.COMPOUND,
    });
    expect(rulesOf(new WordIndex(["eisrahm"]), "rahm")).toEqual({
      eisrahm: MatchRule.COMPOUND,
    });
  });
});

/* =====================================================================
// Gleichheit mit dem Vergleich jedes Worts
// ===================================================================== */

/** Grundwörter: echte Kernwörter aus dem Bestand, kurze und lange. */
const BASE_WORDS = [
  "zimt",
  "rahm",
  "mais",
  "reis",
  "eier",
  "burger",
  "buger",
  "patties",
  "tomaten",
  "zwiebel",
  "zwiebeln",
  "chilis",
  "wurst",
  "wuerste",
  "wuerstchen",
  "fischstaebchen",
  "schoggincreme",
  "schoggicreme",
  "zitronen",
  "gemuese",
  "karotten",
  "griechischer",
  "joghurt",
  "alufolie",
  "schwingbesen",
  "grillzange",
  "flaedli",
  "fruechte",
  "haferrahm",
  "zimtstangen",
];

/** Jede Stelle eines Worts, für die Abwandlungen. */
const positionsOf = (word: string): number[] =>
  Array.from({length: word.length}, (_unused, position) => position);

/** Alle Abwandlungen mit genau einer Änderung: löschen, ersetzen, vertauschen, einfügen. */
const withOneChange = (word: string): string[] =>
  positionsOf(word).flatMap((position) => [
    word.slice(0, position) + word.slice(position + 1),
    word.slice(0, position) + "x" + word.slice(position + 1),
    word.slice(0, position) +
      word.slice(position + 1, position + 2) +
      word.slice(position, position + 1) +
      word.slice(position + 2),
    word.slice(0, position) + "e" + word.slice(position),
  ]);

/** Eine Auswahl Abwandlungen mit zwei Änderungen; alle wären zu viele. */
const withTwoChanges = (word: string): string[] =>
  withOneChange(word)
    .filter((_changed, position) => position % 5 === 0)
    .flatMap((changed) =>
      withOneChange(changed).filter((_twice, position) => position % 7 === 0),
    );

/** Endungen und Teilwörter an der Längengrenze, vorne und hinten. */
const withAffixes = (word: string): string[] => [
  word + "chen",
  word + "li",
  word + "en",
  word + "s",
  word + "eis",
  "eis" + word,
  "hafer" + word,
  word.slice(0, 4),
  word.slice(0, 5),
  word.slice(-4),
  word.slice(-5),
];

/** Index-Wörter: Grundwörter, dazu einige mit Tippfehler oder als Teil, wie im echten Bestand. */
const EQUIVALENCE_INDEX_WORDS = [
  ...BASE_WORDS,
  ...BASE_WORDS.filter((_word, position) => position % 3 === 0).flatMap(
    (word) => withOneChange(word).slice(0, 3),
  ),
  ...BASE_WORDS.filter((_word, position) => position % 4 === 0).flatMap(
    (word) => withAffixes(word).slice(4, 7),
  ),
];

/** Gesuchte Wörter: alle Abwandlungen der Grundwörter. */
const QUERY_WORDS = [
  ...new Set(
    BASE_WORDS.flatMap((word) => [
      word,
      ...withOneChange(word),
      ...withTwoChanges(word),
      ...withAffixes(word),
    ]),
  ),
];

/** Was der Vergleich mit jedem Wort findet, nach Wort sortiert. */
const comparedWithEveryWord = (word: string): WordPartner[] =>
  [...new Set(EQUIVALENCE_INDEX_WORDS)]
    .flatMap((indexWord) => {
      const comparison = compareWords(word, indexWord);
      return comparison ? [{word: indexWord, comparison}] : [];
    })
    .sort((partnerA, partnerB) => partnerA.word.localeCompare(partnerB.word));

describe("WordIndex: gleiche Treffer wie der Vergleich mit jedem Wort", () => {
  const index = new WordIndex(EQUIVALENCE_INDEX_WORDS);
  // Einmal berechnen, der Vergleich mit jedem Wort ist langsam
  const expectedByWord = new Map(
    QUERY_WORDS.map((word) => [word, comparedWithEveryWord(word)]),
  );

  test("die Abwandlungen decken alle Regeln ab", () => {
    const rules = new Set(
      [...expectedByWord.values()].flatMap((partners) =>
        partners.map((partner) => partner.comparison.rule),
      ),
    );

    expect(QUERY_WORDS.length).toBeGreaterThan(1000);
    expect([...rules].sort()).toEqual(
      [
        MatchRule.EXACT,
        MatchRule.STEM,
        MatchRule.TYPO,
        MatchRule.COMPOUND,
      ].sort(),
    );
  });

  test("für jedes gesuchte Wort dieselben Wörter mit derselben Regel", () => {
    const differences = QUERY_WORDS.filter((word) => {
      const found = [...index.findPartners(word)].sort((partnerA, partnerB) =>
        partnerA.word.localeCompare(partnerB.word),
      );
      return JSON.stringify(found) !== JSON.stringify(expectedByWord.get(word));
    });

    // Bei einem Fehler zeigt die Liste die ersten Wörter, die abweichen
    expect(differences.slice(0, 10)).toEqual([]);
  });
});
