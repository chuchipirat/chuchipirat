/**
 * Unit-Tests für den Produkt-Index.
 *
 * Der Index wird einmal über alle Produkte und Materialien gebaut und
 * beantwortet danach jede Anfrage: gleicher Name (`findExact`) und ähnliche
 * Namen mit Score und Regel (`findMatches`). Die Fälle stammen aus dem
 * Testbestand der Abgleich-Logik; Hinweise baut erst der nächste Schritt.
 */
import {analyzeName} from "../analyzeName";
import {buildVocabulary} from "../nameVocabulary";
import {ProductMatchIndex} from "../productMatchIndex.class";
import {
  ALL_CASES,
  BASE_CANDIDATES,
  BASE_RULES,
  MatchingCase,
} from "../__mocks__/productMatchingCases.mock";
import {NameHintKind} from "../nameHint.types";
import {MatchCandidate, MatchRule} from "../productMatching.types";

const vocabulary = buildVocabulary(BASE_RULES);

/** Index über den Bestand eines Falls. */
const indexFor = (candidates: MatchCandidate[]) =>
  new ProductMatchIndex(candidates, vocabulary);

/** Namen der Treffer in ihrer Reihenfolge. */
const matchedNames = (
  index: ProductMatchIndex,
  input: string,
  options?: {excludeUid?: string; limit?: number},
): string[] =>
  index
    .findMatches(analyzeName(input, vocabulary), options)
    .map((match) => match.candidate.name);

/** Hinweise, die aus einem Treffer entstehen; die übrigen kommen aus der Wortliste. */
const MATCH_HINT_KINDS = [
  NameHintKind.SIMILAR_PRODUCT,
  NameHintKind.CONTAINS_PRODUCT,
  NameHintKind.OTHER_LIST,
];

/** Fälle, deren Vorschlag aus dem Index kommt. Eine Marke sucht ihren allgemeinen Begriff erst beim Bilden der Hinweise. */
const indexCases = ALL_CASES.filter(
  (matchingCase) => !matchingCase.input.startsWith("Philadelphia"),
);

const candidatesOf = (matchingCase: MatchingCase) =>
  matchingCase.candidates ?? BASE_CANDIDATES;

/* =====================================================================
// findExact
// ===================================================================== */
describe("ProductMatchIndex: findExact", () => {
  const index = indexFor(BASE_CANDIDATES);

  test("findet den gleichen Namen trotz Grossschrift und Leerzeichen", () => {
    expect(
      index.findExact("ZIMT  ").map((candidate) => candidate.name),
    ).toEqual(["Zimt"]);
  });

  test("findet keinen ähnlichen, nur den gleichen Namen", () => {
    expect(index.findExact("Zimtstange")).toEqual([]);
    expect(index.findExact("Tomatem")).toEqual([]);
  });

  test("findet auch Materialien", () => {
    expect(index.findExact("alufolie")).toEqual([
      expect.objectContaining({name: "Alufolie", source: "material"}),
    ]);
  });

  test("findet deaktivierte Einträge, sie blockieren den Namen", () => {
    const deactivated: MatchCandidate = {
      uid: "zimt-alt",
      name: "Zimt",
      source: "product",
      usable: false,
    };

    expect(indexFor([deactivated]).findExact("Zimt")).toEqual([deactivated]);
  });

  test("findet über den Namen in der Einzahl, jeden Eintrag einmal", () => {
    const eggs: MatchCandidate = {
      uid: "eier",
      name: "Eier",
      nameSingular: "Ei",
      source: "product",
      usable: true,
    };
    const rice: MatchCandidate = {
      uid: "reis",
      name: "Reis",
      nameSingular: "Reis",
      source: "product",
      usable: true,
    };
    const index = indexFor([eggs, rice]);

    expect(index.findExact("Ei")).toEqual([eggs]);
    expect(index.findExact("Reis")).toEqual([rice]);
  });
});

/* =====================================================================
// findMatches: Fälle
// ===================================================================== */
describe("ProductMatchIndex: findMatches, Fälle", () => {
  test.each(indexCases)("$name: bester Vorschlag", (matchingCase) => {
    const names = matchedNames(
      indexFor(candidatesOf(matchingCase)),
      matchingCase.input,
    );

    if (matchingCase.bestSuggestion === null) {
      expect(names).toEqual([]);
    } else {
      expect(names[0]).toBe(matchingCase.bestSuggestion);
    }
  });

  test.each(indexCases.filter((matchingCase) => matchingCase.alsoSuggested))(
    "$name: weitere Vorschläge in dieser Reihenfolge",
    (matchingCase) => {
      const names = matchedNames(
        indexFor(candidatesOf(matchingCase)),
        matchingCase.input,
      );
      const alsoSuggested = matchingCase.alsoSuggested ?? [];

      expect(names.slice(1, 1 + alsoSuggested.length)).toEqual(alsoSuggested);
    },
  );

  const casesWithRule = indexCases.filter((matchingCase) =>
    matchingCase.expectedHints.some(
      (hint) => MATCH_HINT_KINDS.includes(hint.kind) && hint.rule,
    ),
  );

  test.each(casesWithRule)(
    "$name: Regel des besten Treffers",
    (matchingCase) => {
      const expectedHint = matchingCase.expectedHints.find(
        (hint) => MATCH_HINT_KINDS.includes(hint.kind) && hint.rule,
      );
      const [bestMatch] = indexFor(candidatesOf(matchingCase)).findMatches(
        analyzeName(matchingCase.input, vocabulary),
      );

      expect(bestMatch?.rule).toBe(expectedHint?.rule);
    },
  );

  test("gleiche Kernwörter in anderer Reihenfolge ergeben Score 1", () => {
    const [bestMatch] = indexFor(BASE_CANDIDATES).findMatches(
      analyzeName("griechischer joghurt laktosefrei", vocabulary),
    );

    expect(bestMatch?.score).toBe(1);
  });
});

/* =====================================================================
// findMatches: Auswahl und Reihenfolge
// ===================================================================== */
describe("ProductMatchIndex: findMatches, Auswahl und Reihenfolge", () => {
  const index = indexFor(BASE_CANDIDATES);

  test("jeder Treffer hat Score, Regel und containsAll", () => {
    expect(index.findMatches(analyzeName("Tomatem", vocabulary))).toEqual([
      {
        candidate: expect.objectContaining({name: "Tomaten"}),
        score: 0.8,
        rule: MatchRule.TYPO,
        containsAll: true,
      },
    ]);
  });

  test("ein Kandidat, der ganz im Namen steckt, kommt trotz tiefem Score", () => {
    // 2 × 1 / (5 + 1 Wörter) = 0.33, unter der Schwelle
    expect(
      matchedNames(index, "Suppen Einlagen (Flädli, Buchstaben, Backerbesen)"),
    ).toContain("Flädli");
  });

  test("unter der Schwelle und nicht ganz enthalten fällt weg", () => {
    // «Zimt» gegen «Zimt Tomaten Mais Rahm Chilis»: 2 × 1 / (1 + 5) = 0.33
    const lowScoreIndex = indexFor([
      {
        uid: "lang",
        name: "Zimt Tomaten Mais Rahm Chilis",
        source: "product",
        usable: true,
      },
    ]);
    expect(matchedNames(lowScoreIndex, "Zimt")).toEqual([]);
  });

  test("ab der Schwelle zählt ein Kandidat, auch wenn er nicht ganz enthalten ist", () => {
    // 2 × 1 / (1 + 2) = 0.67 und 2 × 1 / (1 + 3) = 0.5, genau auf der Schwelle
    const partialIndex = indexFor([
      {uid: "zwei", name: "Zimt Bio", source: "product", usable: true},
      {uid: "drei", name: "Zimt Bio Fein", source: "product", usable: true},
    ]);

    expect(matchedNames(partialIndex, "Zimt")).toEqual([
      "Zimt Bio",
      "Zimt Bio Fein",
    ]);
  });

  test("bei gleichem Score kommt das früheste Wort des Namens zuerst", () => {
    expect(
      matchedNames(index, "Gemüse (z.B. Karotten, Paprika Zucchini)").slice(
        0,
        2,
      ),
    ).toEqual(["Gemüse", "Karotten"]);
    // Alphabetisch käme «Chilis» zuerst
    expect(matchedNames(index, "Tomaten Chilis").slice(0, 2)).toEqual([
      "Tomaten",
      "Chilis",
    ]);
  });

  test("ohne Eigenschaft im Namen kommt die Variante ohne Eigenschaft zuerst", () => {
    expect(matchedNames(index, "Rahm").slice(0, 2)).toEqual([
      "Rahm",
      "Rahm, vegan",
    ]);
  });

  test("dieselbe Eigenschaft zweimal im Namen zählt wie einmal", () => {
    // «Hafer» und «vegan» stehen beide für vegan
    expect(matchedNames(index, "Haferrahm, vegan").slice(0, 2)).toEqual([
      "Rahm, vegan",
      "Rahm",
    ]);
  });

  test("bei sonst gleichen Treffern alphabetisch", () => {
    const sameWords = indexFor([
      {uid: "b", name: "Zimt Bio", source: "product", usable: true},
      {uid: "a", name: "Bio Zimt", source: "product", usable: true},
    ]);

    expect(matchedNames(sameWords, "Zimt Bio")).toEqual([
      "Bio Zimt",
      "Zimt Bio",
    ]);
  });

  test("deaktivierte Einträge werden nicht vorgeschlagen", () => {
    const withDeactivated = indexFor([
      {uid: "alt", name: "Zimt", source: "product", usable: false},
      {uid: "neu", name: "Zimtstangen", source: "product", usable: true},
    ]);

    expect(matchedNames(withDeactivated, "Zimt")).toEqual(["Zimtstangen"]);
  });

  test("Materialien werden mit ihrer Herkunft gefunden", () => {
    expect(index.findMatches(analyzeName("Alufolien", vocabulary))).toEqual([
      expect.objectContaining({
        candidate: expect.objectContaining({
          name: "Alufolie",
          source: "material",
        }),
      }),
    ]);
  });

  test("findet über den Namen in der Einzahl, jeden Eintrag einmal", () => {
    const singularIndex = indexFor([
      {
        uid: "eier",
        name: "Eier",
        nameSingular: "Ei",
        source: "product",
        usable: true,
      },
      {
        uid: "tomaten",
        name: "Tomaten",
        nameSingular: "Tomate",
        source: "product",
        usable: true,
      },
    ]);

    expect(matchedNames(singularIndex, "Ei")).toEqual(["Eier"]);
    expect(matchedNames(singularIndex, "Tomaten")).toEqual(["Tomaten"]);
  });

  test("passen Name und Einzahl verschieden gut, zählt der bessere", () => {
    const yogurt: MatchCandidate = {
      uid: "joghurt",
      name: "Griechischer Joghurt",
      nameSingular: "Joghurt",
      source: "product",
      usable: true,
    };
    const [bestMatch] = indexFor([yogurt]).findMatches(
      analyzeName("Griechischer Joghurt", vocabulary),
    );

    expect(bestMatch?.score).toBe(1);
  });

  test("excludeUid schliesst den Eintrag selbst aus", () => {
    expect(matchedNames(index, "Zimt", {excludeUid: "product-Zimt"})).toEqual([
      "Zimtstangen",
    ]);
  });

  test("limit begrenzt die Anzahl Treffer, die besten bleiben", () => {
    expect(matchedNames(index, "Zimt", {limit: 1})).toEqual(["Zimt"]);
    // Erst sortieren, dann kürzen: «Fischstäbchen» steht im Bestand vorne
    expect(matchedNames(index, "vegane Fischstäbchen", {limit: 1})).toEqual([
      "Fischstäbchen, vegan",
    ]);
  });

  test("ohne Kernwörter keine Treffer", () => {
    expect(matchedNames(index, "Vaya")).toEqual([]);
    expect(matchedNames(index, "")).toEqual([]);
  });
});
