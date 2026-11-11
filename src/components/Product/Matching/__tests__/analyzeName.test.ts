/**
 * Unit-Tests für die Zerlegung eines eingegebenen Namens.
 *
 * Die Analyse trennt die Wörter, die das Produkt ausmachen (Kernwörter), von
 * Wörtern aus der Wortliste (Zubereitung, Eigenschaft, Marke, Kein-Produkt,
 * Füllwort) und erkennt, ob ein Name mehrere Produkte aufzählt. Die Fälle
 * stammen aus dem Testbestand der Abgleich-Logik.
 */
import {analyzeName} from "../analyzeName";
import {buildVocabulary} from "../nameVocabulary";
import {BASE_RULES} from "../__mocks__/productMatchingCases.mock";
import {FoundListWord, NameWord} from "../productMatching.types";

const vocabulary = buildVocabulary(BASE_RULES);

/** Sucht den Eintrag der Wortliste; ein Tippfehler im Test fällt sofort auf. */
const entryOf = (entryWord: string): NameWord => {
  const entry = BASE_RULES.nameWords.find(
    (nameWord) => nameWord.word === entryWord,
  );
  if (!entry) throw new Error(`Kein Eintrag «${entryWord}» in BASE_RULES`);
  return entry;
};

/** Erwarteter Fund: Wort wie in der Eingabe, Eintrag der Wortliste, Teilwort ja/nein. */
const found = (
  word: string,
  entryWord: string,
  isPart = false,
): FoundListWord => ({word, entry: entryOf(entryWord), isPart});

/* =====================================================================
// Kernwörter und Wortliste
// ===================================================================== */
describe("analyzeName: Kernwörter und Wortliste", () => {
  const wordCases: [
    input: string,
    coreWords: string[],
    listWords: FoundListWord[],
  ][] = [
    ["Zimt", ["zimt"], []],
    [
      "Früchte fur Fruchtsalat",
      ["fruechte", "fruchtsalat"],
      [found("fur", "fur")],
    ],
    ["Sandwiches Material", ["sandwiches"], [found("Material", "Material")]],
    // Gebeugt: nur über Tippfehler bzw. Stamm erkennbar
    ["vegane Wiernerli", ["wiernerli"], [found("vegane", "vegan")]],
    ["vegane Fischstäbchen", ["fischstaebchen"], [found("vegane", "vegan")]],
    // Marke ist kein Kernwort, der allgemeine Begriff kommt aus dem Eintrag
    [
      "Philadelphia, vegan",
      [],
      [found("Philadelphia", "Philadelphia"), found("vegan", "vegan")],
    ],
    ["Vaya Bean Salt", ["bean", "salt"], [found("Vaya", "Vaya")]],
    ["Zimt, gemahlen", ["zimt"], [found("gemahlen", "gemahlen")]],
    // Vertippt: kein gleicher Stamm, nur über den Tippfehler erkennbar
    ["Zimt, gemahlne", ["zimt"], [found("gemahlne", "gemahlen")]],
    // Weder Tippfehler noch gleicher Stamm, aber der Stamm ist das Listenwort
    ["gemahlener Zimt", ["zimt"], [found("gemahlener", "gemahlen")]],
    ["Rüebli, gerieben", ["rueebli"], [found("gerieben", "gerieben")]],
    // Teilwörter: Das Wort bleibt Kernwort, sonst fände «Haferrahm» kein «Rahm»
    ["Restengemüse", ["restengemuese"], [found("Reste", "Reste", true)]],
    ["Haferrahm", ["haferrahm"], [found("Hafer", "Hafer", true)]],
    // Das kürzere Wort im Namen ist kein Teil des längeren Eintrags «Material»
    ["Mate Tee", ["mate", "tee"], []],
    // Mehrwortiger Eintrag vor den Einzelwörtern
    [
      "Plant Based Würstchen",
      ["wuerstchen"],
      [found("Plant Based", "plant based")],
    ],
    [
      "Gemüse (z.B. Karotten, Paprika Zucchini)",
      ["gemuese", "karotten", "paprika", "zucchini"],
      [found("z B", "z.B.")],
    ],
    // Nur der Anfang eines mehrwortigen Eintrags, am Ende des Namens
    ["Würstchen Plant", ["wuerstchen", "plant"], []],
    // Eigenschaft über Synonym: «laktis» ≈ «laktosefrei»
    [
      "Fertig schoggicreme für laktis",
      ["schoggicreme"],
      [
        found("Fertig", "fertig"),
        found("für", "für"),
        found("laktis", "laktosefrei"),
      ],
    ],
    [
      "griechischer joghurt laktosefrei",
      ["griechischer", "joghurt"],
      [found("laktosefrei", "laktosefrei")],
    ],
    [
      "Burger Patties (Fleisch und Vegi)",
      ["burger", "patties", "fleisch", "vegi"],
      [found("und", "und")],
    ],
    [
      "Suppen Einlagen (Flädli, Buchstaben, Backerbesen)",
      ["suppen", "einlagen", "flaedli", "buchstaben", "backerbesen"],
      [],
    ],
    // Kernwörter bleiben ungekürzt; Stamm und Synonym bildet erst der Vergleich
    ["Chilis Tomatem", ["chilis", "tomatem"], []],
  ];

  test.each(wordCases)("«%s»", (input, coreWords, listWords) => {
    const analysis = analyzeName(input, vocabulary);

    expect(analysis.coreWords).toEqual(coreWords);
    expect(analysis.listWords).toEqual(listWords);
  });

  test("der normalisierte Name wird mitgeliefert", () => {
    expect(analyzeName("Zimt, gemahlen", vocabulary).normalized).toBe(
      "zimt gemahlen",
    );
  });

  test("ohne Wortliste ist jedes Wort ein Kernwort", () => {
    const emptyVocabulary = buildVocabulary({nameWords: [], synonyms: []});
    const analysis = analyzeName("vegane Wiernerli", emptyVocabulary);

    expect(analysis.coreWords).toEqual(["vegane", "wiernerli"]);
    expect(analysis.listWords).toEqual([]);
  });

  test("leere Eingabe ergibt eine leere Analyse", () => {
    expect(analyzeName("", vocabulary)).toEqual({
      normalized: "",
      coreWords: [],
      listWords: [],
      isCombination: false,
      combinationParts: [],
      nameWithoutDetails: "",
    });
  });
});

/* =====================================================================
// Kombination
// ===================================================================== */
describe("analyzeName: Kombination", () => {
  const combinations: [input: string, parts: string[]][] = [
    [
      "Burger Patties (Fleisch und Vegi)",
      ["Burger Patties", "Fleisch", "Vegi"],
    ],
    [
      "Suppen Einlagen (Flädli, Buchstaben, Backerbesen)",
      ["Suppen Einlagen", "Flädli", "Buchstaben", "Backerbesen"],
    ],
    [
      "Gemüse (z.B. Karotten, Paprika Zucchini)",
      ["Gemüse", "z.B. Karotten", "Paprika Zucchini"],
    ],
    ["Salz und Pfeffer", ["Salz", "Pfeffer"]],
    ["Salz oder Pfeffer", ["Salz", "Pfeffer"]],
    ["Salz & Pfeffer", ["Salz", "Pfeffer"]],
    ["Essig/Öl", ["Essig", "Öl"]],
    ["Ketchup + Senf", ["Ketchup", "Senf"]],
    ["Salz Und Pfeffer", ["Salz", "Pfeffer"]],
    // Nicht geschlossene Klammer reicht bis zum Ende
    ["Gemüse (Karotten, Lauch", ["Gemüse", "Karotten", "Lauch"]],
  ];

  test.each(combinations)("«%s» ist eine Kombination", (input, parts) => {
    const analysis = analyzeName(input, vocabulary);

    expect(analysis.isCombination).toBe(true);
    expect(analysis.combinationParts).toEqual(parts);
  });

  const singleProducts: string[] = [
    "Zimt",
    // Komma ausserhalb von Klammern trennt Zusätze, keine Produkte
    "Zimt, gemahlen",
    "Griechischer Joghurt, laktosefrei",
    // Klammer ohne Aufzählung
    "Langkornreis (z. B. Parboiled)",
    "Rahm (vegan)",
    // «und» als Teil eines Worts
    "Hundefutter",
  ];

  test.each(singleProducts)("«%s» ist keine Kombination", (input) => {
    const analysis = analyzeName(input, vocabulary);

    expect(analysis.isCombination).toBe(false);
    expect(analysis.combinationParts).toEqual([]);
  });
});

/* =====================================================================
// Name ohne Detail-Wörter
// ===================================================================== */
describe("analyzeName: Name ohne Detail-Wörter", () => {
  test.each([
    ["Zimt, gemahlen", "Zimt"],
    ["Rüebli, gerieben", "Rüebli"],
    ["gemahlener Zimt", "Zimt"],
    ["Rahm, gemahlen, vegan", "Rahm, vegan"],
    // Ein Detail als Teilwort bleibt stehen, das Wort ist Kernwort
    ["Zimtgemahlen", "Zimtgemahlen"],
    // Nur Detail-Wörter fallen weg, Eigenschaften bleiben
    ["vegane Wiernerli", "vegane Wiernerli"],
    ["Zimt", "Zimt"],
  ])("«%s» wird «%s»", (input, expected) => {
    expect(analyzeName(input, vocabulary).nameWithoutDetails).toBe(expected);
  });
});
