/**
 * Unit-Tests für die Hinweise zu einem eingegebenen Namen.
 *
 * Die Hinweise sind das, was das Anlegen-Pop-up zeigt und das Protokoll
 * speichert: gleicher Name (blockiert), ähnliche Einträge mit Vorschlägen,
 * und Wörter aus der Wortliste. Die Fälle stammen aus dem Testbestand der
 * Abgleich-Logik; ihre Spalte «Erwartete Hinweise» ist die Definition of Done.
 */
import {buildNameHints, MAX_SUGGESTIONS} from "../buildNameHints";
import {buildVocabulary} from "../nameVocabulary";
import {ProductMatchIndex} from "../productMatchIndex.class";
import {
  ALL_CASES,
  BASE_CANDIDATES,
  BASE_RULES,
  MatchingCase,
} from "../__mocks__/productMatchingCases.mock";
import {NameHint, NameHintKind} from "../nameHint.types";
import {MatchCandidate, MatchRule, MatchSource} from "../productMatching.types";

const vocabulary = buildVocabulary(BASE_RULES);

/** Aktives Produkt mit einer aus dem Namen abgeleiteten ID. */
const product = (name: string): MatchCandidate => ({
  uid: `product-${name}`,
  name,
  source: "product",
  usable: true,
});

/** Hinweise zu einem Namen gegen einen Bestand. */
const hintsFor = (
  name: string,
  candidates: MatchCandidate[] = BASE_CANDIDATES,
  target: MatchSource = "product",
  excludeUid?: string,
): NameHint[] =>
  buildNameHints(name, {
    index: new ProductMatchIndex(candidates, vocabulary),
    vocabulary,
    target,
    excludeUid,
  });

/** Hinweise eines Falls, gegen seinen eigenen oder den Grundbestand. */
const hintsOfCase = (matchingCase: MatchingCase): NameHint[] =>
  hintsFor(
    matchingCase.input,
    matchingCase.candidates ?? BASE_CANDIDATES,
    matchingCase.dialog,
  );

/** Namen der Vorschläge eines Hinweises in ihrer Reihenfolge. */
const suggestedNames = (hint: NameHint | undefined): string[] =>
  (hint?.suggestions ?? []).map((suggestion) => suggestion.candidate.name);

/** Der erste Hinweis einer Art. */
const hintOfKind = (
  hints: NameHint[],
  kind: NameHintKind,
): NameHint | undefined => hints.find((hint) => hint.kind === kind);

/** Reihenfolge der Arten; Treffer-Hinweise teilen sich einen Rang. */
const KIND_RANK: Record<NameHintKind, number> = {
  [NameHintKind.EXACT_PRODUCT]: 0,
  [NameHintKind.DEACTIVATED_PRODUCT]: 0,
  [NameHintKind.OTHER_LIST]: 1,
  [NameHintKind.CONTAINS_PRODUCT]: 2,
  [NameHintKind.SIMILAR_PRODUCT]: 2,
  [NameHintKind.BRAND]: 3,
  [NameHintKind.PROPERTY]: 4,
  [NameHintKind.DETAIL_WORD]: 5,
  [NameHintKind.NOT_A_PRODUCT]: 6,
  [NameHintKind.COMBINATION]: 7,
};

const BLOCKING_KINDS = [
  NameHintKind.EXACT_PRODUCT,
  NameHintKind.DEACTIVATED_PRODUCT,
];

/* =====================================================================
// Fälle
// ===================================================================== */
describe("buildNameHints: Fälle", () => {
  test.each(ALL_CASES)("$name: erwartete Hinweise", (matchingCase) => {
    const hints = hintsOfCase(matchingCase);

    matchingCase.expectedHints.forEach((expectedHint) =>
      expect(hints).toContainEqual(expect.objectContaining(expectedHint)),
    );
    if (matchingCase.exhaustive) {
      expect(hints).toHaveLength(matchingCase.expectedHints.length);
    }
  });

  test.each(ALL_CASES)("$name: bester Vorschlag", (matchingCase) => {
    const hints = hintsOfCase(matchingCase);
    const firstSuggestion = hints.flatMap(suggestedNames)[0] ?? null;

    expect(firstSuggestion).toBe(matchingCase.bestSuggestion);
  });

  test.each(ALL_CASES.filter((matchingCase) => matchingCase.alsoSuggested))(
    "$name: weitere Vorschläge im selben Hinweis",
    (matchingCase) => {
      const hintWithBest = hintsOfCase(matchingCase).find(
        (hint) => suggestedNames(hint)[0] === matchingCase.bestSuggestion,
      );
      const alsoSuggested = matchingCase.alsoSuggested ?? [];

      expect(
        suggestedNames(hintWithBest).slice(1, 1 + alsoSuggested.length),
      ).toEqual(alsoSuggested);
    },
  );

  test.each(ALL_CASES)(
    "$name: nur gleiche Namen blockieren, und sie stehen vorne",
    (matchingCase) => {
      const hints = hintsOfCase(matchingCase);

      hints.forEach((hint) =>
        expect([hint.kind, hint.blocking]).toEqual([
          hint.kind,
          BLOCKING_KINDS.includes(hint.kind),
        ]),
      );
      const ranks = hints.map((hint) => KIND_RANK[hint.kind]);
      expect(ranks).toEqual([...ranks].sort((rankA, rankB) => rankA - rankB));
    },
  );
});

/* =====================================================================
// Gleicher Name
// ===================================================================== */
describe("buildNameHints: gleicher Name", () => {
  test("ein aktiver und ein deaktivierter gleicher Name: nur der aktive blockiert", () => {
    const active: MatchCandidate = {...product("Zimt"), uid: "aktiv"};
    const deactivated: MatchCandidate = {
      ...product("Zimt"),
      uid: "alt",
      usable: false,
    };
    const hints = hintsFor("Zimt", [deactivated, active]);

    expect(
      suggestedNames(hintOfKind(hints, NameHintKind.EXACT_PRODUCT)),
    ).toEqual(["Zimt"]);
    expect(hintOfKind(hints, NameHintKind.EXACT_PRODUCT)?.suggestions).toEqual([
      expect.objectContaining({
        candidate: active,
        score: 1,
        rule: MatchRule.EXACT,
      }),
    ]);
    expect(hintOfKind(hints, NameHintKind.DEACTIVATED_PRODUCT)).toBeUndefined();
  });

  test("ein deaktivierter gleicher Name blockiert ohne Vorschlag", () => {
    const deactivated: MatchCandidate = {...product("Zimt"), usable: false};

    expect(hintsFor("Zimt", [deactivated])).toEqual([
      {
        kind: NameHintKind.DEACTIVATED_PRODUCT,
        suggestions: [],
        blocking: true,
      },
    ]);
  });

  test("ein deaktivierter gleicher Name steht vor ähnlichen Einträgen", () => {
    const deactivated: MatchCandidate = {...product("Zimt"), usable: false};
    const hints = hintsFor("Zimt", [deactivated, product("Zimtstangen")]);

    expect(hints.map((hint) => hint.kind)).toEqual([
      NameHintKind.DEACTIVATED_PRODUCT,
      NameHintKind.SIMILAR_PRODUCT,
    ]);
  });

  test("beim Umbenennen blockiert der eigene Name nicht", () => {
    const hints = hintsFor("Zimt", BASE_CANDIDATES, "product", "product-Zimt");

    expect(hintOfKind(hints, NameHintKind.EXACT_PRODUCT)).toBeUndefined();
    expect(
      suggestedNames(hintOfKind(hints, NameHintKind.SIMILAR_PRODUCT)),
    ).toEqual(["Zimtstangen"]);
  });

  test("der gleiche Name erscheint nicht nochmals als ähnlich", () => {
    const hints = hintsFor("Zimt");

    expect(
      suggestedNames(hintOfKind(hints, NameHintKind.SIMILAR_PRODUCT)),
    ).not.toContain("Zimt");
  });

  test("gleicher Name in der anderen Liste blockiert nicht", () => {
    const hints = hintsFor("Alufolie");

    expect(hintOfKind(hints, NameHintKind.EXACT_PRODUCT)).toBeUndefined();
    expect(hintOfKind(hints, NameHintKind.OTHER_LIST)).toEqual(
      expect.objectContaining({
        rule: MatchRule.EXACT,
        score: 1,
        blocking: false,
      }),
    );
    expect(suggestedNames(hintOfKind(hints, NameHintKind.OTHER_LIST))).toEqual([
      "Alufolie",
    ]);
  });
});

/* =====================================================================
// Treffer
// ===================================================================== */
describe("buildNameHints: Treffer", () => {
  test("höchstens fünf Vorschläge pro Hinweis, die besten", () => {
    const cinnamonVariants = [
      "Zimt Bio",
      "Zimt Ceylon",
      "Zimt Cassia",
      "Zimt Fein",
      "Zimt Grob",
      "Zimt Pulver",
      "Zimt Stange",
    ].map(product);
    const similar = hintOfKind(
      hintsFor("Zimt", cinnamonVariants),
      NameHintKind.SIMILAR_PRODUCT,
    );

    expect(MAX_SUGGESTIONS).toBe(5);
    expect(similar?.suggestions).toHaveLength(MAX_SUGGESTIONS);
    // Bei gleichem Score alphabetisch
    expect(suggestedNames(similar)[0]).toBe("Zimt Bio");
  });

  test("Regel und Score kommen vom besten Vorschlag", () => {
    const similar = hintOfKind(
      hintsFor("Zimt, gemahlen"),
      NameHintKind.SIMILAR_PRODUCT,
    );

    expect(similar).toEqual(
      expect.objectContaining({rule: MatchRule.EXACT, score: 1}),
    );
    expect(suggestedNames(similar)).toEqual(["Zimt", "Zimtstangen"]);
  });

  test("enthält, wenn der Name zusätzliche Wörter hat, sonst ähnlich", () => {
    expect(
      hintOfKind(
        hintsFor("Früchte fur Fruchtsalat"),
        NameHintKind.CONTAINS_PRODUCT,
      ),
    ).toBeDefined();
    expect(
      hintOfKind(hintsFor("Haferrahm"), NameHintKind.CONTAINS_PRODUCT),
    ).toBeUndefined();
  });

  test("die andere Liste kommt vor ähnlichen Einträgen, auch mit tieferem Score", () => {
    const hints = hintsFor("Grillzangen", [
      product("Grillzange"),
      {
        ...product("Grillzange gross"),
        uid: "material-gross",
        source: "material",
      },
    ]);

    expect(hints.map((hint) => hint.kind)).toEqual([
      NameHintKind.OTHER_LIST,
      NameHintKind.SIMILAR_PRODUCT,
    ]);
  });

  test("enthält und ähnlich stehen in der Reihenfolge ihres besten Treffers", () => {
    // «Zimt» steckt ganz im Namen (enthält, 0.67); die anderen decken den
    // ganzen Namen ab (ähnlich, 0.8 bzw. 0.57)
    const kindsFor = (otherName: string) =>
      hintsFor("Zimt Zucker", [product("Zimt"), product(otherName)]).map(
        (hint) => hint.kind,
      );

    expect(kindsFor("Zimt Zucker Bio")).toEqual([
      NameHintKind.SIMILAR_PRODUCT,
      NameHintKind.CONTAINS_PRODUCT,
    ]);
    expect(kindsFor("Zimt Zucker Bio Fein Grob")).toEqual([
      NameHintKind.CONTAINS_PRODUCT,
      NameHintKind.SIMILAR_PRODUCT,
    ]);
  });

  test("leerer Name ergibt keine Hinweise", () => {
    expect(hintsFor("")).toEqual([]);
  });
});

/* =====================================================================
// Wörter aus der Wortliste
// ===================================================================== */
describe("buildNameHints: Wörter", () => {
  test("jedes Wort bekommt einen eigenen Hinweis", () => {
    const details = hintsFor("Zimt, gemahlen, gerieben").filter(
      (hint) => hint.kind === NameHintKind.DETAIL_WORD,
    );

    expect(details.map((hint) => hint.word)).toEqual(["gemahlen", "gerieben"]);
  });

  test("Füllwörter ergeben keinen Hinweis", () => {
    expect(hintsFor("Fertig Zimt").some((hint) => hint.word === "Fertig")).toBe(
      false,
    );
  });

  test("Kein-Produkt-Wort als Teilwort nennt das Wort aus der Liste", () => {
    expect(hintsFor("Restengemüse")).toContainEqual(
      expect.objectContaining({
        kind: NameHintKind.NOT_A_PRODUCT,
        word: "Reste",
      }),
    );
  });

  test("Wort-Hinweise haben keine Vorschläge, ausser der Marke", () => {
    hintsFor("vegane Wienerli, gemahlen")
      .filter(
        (hint) => KIND_RANK[hint.kind] >= KIND_RANK[NameHintKind.PROPERTY],
      )
      .forEach((hint) => expect(hint.suggestions).toEqual([]));
  });

  test("Kombination ergibt einen Hinweis ohne Wort", () => {
    const combinations = hintsFor("Salz und Pfeffer").filter(
      (hint) => hint.kind === NameHintKind.COMBINATION,
    );

    expect(combinations).toEqual([
      {kind: NameHintKind.COMBINATION, suggestions: [], blocking: false},
    ]);
  });
});

/* =====================================================================
// Marke
// ===================================================================== */
describe("buildNameHints: Marke", () => {
  test("schlägt den allgemeinen Begriff mit derselben Eigenschaft zuerst vor", () => {
    const brand = hintOfKind(
      hintsFor("Philadelphia, vegan", [
        product("Frischkäse"),
        product("Frischkäse, vegan"),
      ]),
      NameHintKind.BRAND,
    );

    expect(brand?.word).toBe("Philadelphia");
    expect(suggestedNames(brand)).toEqual(["Frischkäse, vegan", "Frischkäse"]);
  });

  test("höchstens fünf Vorschläge zur Marke", () => {
    const creamCheeseVariants = [
      "Frischkäse Alpen",
      "Frischkäse Berg",
      "Frischkäse Doppelrahm",
      "Frischkäse Kräuter",
      "Frischkäse Knoblauch",
      "Frischkäse Pfeffer",
      "Frischkäse Tomate",
    ].map(product);
    const brand = hintOfKind(
      hintsFor("Philadelphia", creamCheeseVariants),
      NameHintKind.BRAND,
    );

    expect(brand?.suggestions).toHaveLength(MAX_SUGGESTIONS);
  });

  test("ohne allgemeinen Begriff kein Vorschlag", () => {
    expect(
      hintOfKind(hintsFor("Vaya Bean Salt"), NameHintKind.BRAND)?.suggestions,
    ).toEqual([]);
  });
});
