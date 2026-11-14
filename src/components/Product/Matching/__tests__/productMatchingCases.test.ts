/**
 * Prüft die Fälle der Abgleich-Logik auf innere Stimmigkeit.
 *
 * Die Fälle sind die Definition of Done. Ein Vorschlag, der im Bestand gar
 * nicht vorkommt, oder ein Wort, das nicht in der Eingabe steht, liesse einen
 * Test später aus dem falschen Grund rot werden.
 */
import {
  ALL_CASES,
  BASE_CANDIDATES,
  BASE_RULES,
  MatchingCase,
} from "../__mocks__/productMatchingCases.mock";

/** Namen aller Kandidaten, gegen die ein Fall läuft. */
const candidateNamesOf = (matchingCase: MatchingCase): string[] =>
  (matchingCase.candidates ?? BASE_CANDIDATES).map(
    (candidate) => candidate.name,
  );

describe("Fälle der Abgleich-Logik", () => {
  test("sind 17 echte und 7 Randfälle", () => {
    expect(ALL_CASES).toHaveLength(24);
  });

  test("haben eindeutige Namen", () => {
    const caseNames = ALL_CASES.map((matchingCase) => matchingCase.name);

    expect(new Set(caseNames).size).toBe(caseNames.length);
  });

  test("der Grundbestand hat eindeutige IDs und Namen", () => {
    const uids = BASE_CANDIDATES.map((candidate) => candidate.uid);
    const names = BASE_CANDIDATES.map((candidate) => candidate.name);

    expect(new Set(uids).size).toBe(uids.length);
    expect(new Set(names).size).toBe(names.length);
  });

  test.each(ALL_CASES)(
    "$name: erwartete Vorschläge stehen im Bestand",
    (matchingCase) => {
      const expectedNames = [
        ...(matchingCase.bestSuggestion ? [matchingCase.bestSuggestion] : []),
        ...(matchingCase.alsoSuggested ?? []),
      ];

      expectedNames.forEach((expectedName) =>
        expect(candidateNamesOf(matchingCase)).toContain(expectedName),
      );
    },
  );

  test.each(ALL_CASES)(
    "$name: auslösende Wörter stehen in der Eingabe",
    (matchingCase) => {
      matchingCase.expectedHints
        .filter((hint) => hint.word !== undefined)
        .forEach((hint) => expect(matchingCase.input).toContain(hint.word));
    },
  );

  test.each(ALL_CASES)(
    "$name: ohne erwartete Hinweise auch kein Vorschlag",
    (matchingCase) => {
      if (matchingCase.expectedHints.length > 0) return;

      expect(matchingCase.bestSuggestion).toBeNull();
      expect(matchingCase.exhaustive).toBe(true);
    },
  );

  test("Synonympaare sind verschieden und nicht doppelt", () => {
    const pairKeys = BASE_RULES.synonyms.map((pair) =>
      [pair.nameA, pair.nameB].sort().join("|"),
    );

    BASE_RULES.synonyms.forEach((pair) =>
      expect(pair.nameA).not.toBe(pair.nameB),
    );
    expect(new Set(pairKeys).size).toBe(pairKeys.length);
  });
});
