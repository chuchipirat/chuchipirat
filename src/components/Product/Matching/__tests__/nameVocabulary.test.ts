/**
 * Unit-Tests für die Vorbereitung von Wortliste und Synonymen.
 *
 * Das Vokabular wird einmal gebaut und für jeden Namen wiederverwendet.
 * Synonyme werden zu Gruppen mit einem Vertreter zusammengefasst, damit jedes
 * Wort genau eine Form hat, unter der es verglichen wird.
 */
import {buildVocabulary, canonicalWord} from "../nameVocabulary";
import {BASE_RULES} from "../__mocks__/productMatchingCases.mock";
import {MatchingRules, SynonymPair} from "../productMatching.types";

/** Regeln nur mit Synonymen, ohne Wortliste. */
const rulesWithSynonyms = (synonyms: SynonymPair[]): MatchingRules => ({
  nameWords: [],
  synonyms,
});

/* =====================================================================
// buildVocabulary: Wortliste
// ===================================================================== */
describe("buildVocabulary: Wortliste", () => {
  const vocabulary = buildVocabulary(BASE_RULES);

  test("jeder Eintrag der Wortliste bleibt erhalten", () => {
    expect(vocabulary.entries).toHaveLength(BASE_RULES.nameWords.length);
    BASE_RULES.nameWords.forEach((nameWord) =>
      expect(
        vocabulary.entries.map((vocabularyEntry) => vocabularyEntry.entry),
      ).toContainEqual(nameWord),
    );
  });

  test("Einträge werden in normalisierte Wörter zerlegt", () => {
    const tokensOf = (word: string) =>
      vocabulary.entries.find(
        (vocabularyEntry) => vocabularyEntry.entry.word === word,
      )?.tokens;

    expect(tokensOf("für")).toEqual(["fuer"]);
    expect(tokensOf("Material")).toEqual(["material"]);
    expect(tokensOf("plant based")).toEqual(["plant", "based"]);
    expect(tokensOf("z.B.")).toEqual(["z", "b"]);
  });

  test("ein neues Vokabular hat noch nichts gemerkt", () => {
    expect(buildVocabulary(BASE_RULES).foundEntries.size).toBe(0);
  });

  test("mehrwortige Einträge stehen vorne, damit sie vor ihren Teilen greifen", () => {
    const tokenCounts = vocabulary.entries.map(
      (vocabularyEntry) => vocabularyEntry.tokens.length,
    );

    expect(tokenCounts).toEqual(
      [...tokenCounts].sort((countA, countB) => countB - countA),
    );
    expect(tokenCounts[0]).toBeGreaterThan(1);
  });
});

/* =====================================================================
// canonicalWord: ganze Wörter
// ===================================================================== */
describe("canonicalWord: ganze Wörter", () => {
  test("Wort einer Gruppe wird zum alphabetisch ersten Wort der Gruppe", () => {
    const vocabulary = buildVocabulary(BASE_RULES);

    expect(canonicalWord("rueebli", vocabulary)).toBe("karotten");
    expect(canonicalWord("karotten", vocabulary)).toBe("karotten");
  });

  test("Synonyme in Pflege-Schreibweise werden normalisiert", () => {
    const vocabulary = buildVocabulary(
      rulesWithSynonyms([{nameA: "Rüebli", nameB: "Möhren"}]),
    );

    expect(canonicalWord("rueebli", vocabulary)).toBe("moehren");
  });

  test("Wort ohne Synonym bleibt unverändert", () => {
    const vocabulary = buildVocabulary(BASE_RULES);

    expect(canonicalWord("zimt", vocabulary)).toBe("zimt");
  });

  test("ohne Synonyme bleibt jedes Wort unverändert", () => {
    const vocabulary = buildVocabulary(rulesWithSynonyms([]));

    expect(canonicalWord("rueebli", vocabulary)).toBe("rueebli");
  });

  test("Paare über ein gemeinsames Wort ergeben eine Gruppe", () => {
    // Weder «Rüebli» noch «Möhren» stehen direkt mit «Karotten» in einem Paar
    const vocabulary = buildVocabulary(
      rulesWithSynonyms([
        {nameA: "Rüebli", nameB: "Möhren"},
        {nameA: "Möhren", nameB: "Karotten"},
      ]),
    );

    expect(canonicalWord("rueebli", vocabulary)).toBe("karotten");
    expect(canonicalWord("moehren", vocabulary)).toBe("karotten");
  });

  test("zwei Gruppen werden durch ein spätes Paar zu einer", () => {
    const vocabulary = buildVocabulary(
      rulesWithSynonyms([
        {nameA: "Rüebli", nameB: "Möhren"},
        {nameA: "Karotten", nameB: "Mohrrüben"},
        {nameA: "Möhren", nameB: "Mohrrüben"},
      ]),
    );

    ["rueebli", "moehren", "mohrrueben", "karotten"].forEach((word) =>
      expect(canonicalWord(word, vocabulary)).toBe("karotten"),
    );
  });
});

/* =====================================================================
// canonicalWord: Teilwörter
// ===================================================================== */
describe("canonicalWord: Teilwörter", () => {
  const vocabulary = buildVocabulary(BASE_RULES);

  test("Synonym am Wortanfang wird durch den Vertreter ersetzt", () => {
    expect(canonicalWord("schokoladencreme", vocabulary)).toBe("schoggincreme");
    expect(canonicalWord("rueeblisalat", vocabulary)).toBe("karottensalat");
  });

  test("Synonym am Wortende wird durch den Vertreter ersetzt", () => {
    expect(canonicalWord("zartbitterschokolade", vocabulary)).toBe(
      "zartbitterschoggi",
    );
  });

  test("ein Wort, das schon den Vertreter enthält, bleibt unverändert", () => {
    expect(canonicalWord("schoggicreme", vocabulary)).toBe("schoggicreme");
  });

  test("Synonym in der Wortmitte zählt nicht", () => {
    expect(canonicalWord("bioschokoladencreme", vocabulary)).toBe(
      "bioschokoladencreme",
    );
  });

  test("kurze Synonyme ersetzen keine Teilwörter", () => {
    // «tee» steckt in zu vielen Wörtern, die nichts mit Aufguss zu tun haben
    const shortSynonyms = buildVocabulary(
      rulesWithSynonyms([{nameA: "Tee", nameB: "Aufguss"}]),
    );

    expect(canonicalWord("tee", shortSynonyms)).toBe("aufguss");
    expect(canonicalWord("teekanne", shortSynonyms)).toBe("teekanne");
    expect(canonicalWord("pfefferminztee", shortSynonyms)).toBe(
      "pfefferminztee",
    );
  });
});
