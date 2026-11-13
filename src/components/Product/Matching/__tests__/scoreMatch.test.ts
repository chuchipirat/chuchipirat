/**
 * Unit-Tests für die Ähnlichkeit zweier Namen.
 *
 * Verglichen werden nur die Kernwörter: Eigenschaften, Marken und
 * Detail-Wörter hat die Wortanalyse schon herausgenommen. Jedes Wort wird
 * höchstens einmal gepaart, damit der Score nie über 1 steigt und in beide
 * Richtungen gleich ist.
 */
import {analyzeName} from "../analyzeName";
import {buildVocabulary} from "../nameVocabulary";
import {compareMatchWords, scoreMatch, toMatchWords} from "../scoreMatch";
import {
  BASE_CANDIDATES,
  BASE_RULES,
} from "../__mocks__/productMatchingCases.mock";
import {MatchRule} from "../productMatching.types";

const vocabulary = buildVocabulary(BASE_RULES);

/** Kernwörter eines Namens in Vergleichsform, wie der Index sie bildet. */
const matchWordsOf = (name: string) =>
  toMatchWords(analyzeName(name, vocabulary).coreWords, vocabulary);

/* =====================================================================
// toMatchWords und compareMatchWords
// ===================================================================== */
describe("toMatchWords", () => {
  test("behält das normalisierte Wort und bildet die Vergleichsform", () => {
    expect(toMatchWords(["rueebli", "zimt"], vocabulary)).toEqual([
      {normalized: "rueebli", canonical: "karotten"},
      {normalized: "zimt", canonical: "zimt"},
    ]);
  });
});

describe("compareMatchWords", () => {
  const [rueebli, karotten, zimt] = toMatchWords(
    ["rueebli", "karotten", "zimt"],
    vocabulary,
  );

  test("gleiches Wort ist exakt", () => {
    expect(compareMatchWords(zimt, zimt)?.rule).toBe(MatchRule.EXACT);
  });

  test("verschiedene Wörter mit gleicher Vergleichsform sind Synonyme", () => {
    expect(compareMatchWords(rueebli, karotten)).toEqual({
      rule: MatchRule.SYNONYM,
      weight: 1,
    });
  });

  test("Synonym im Teilwort plus Fugen-n ist ein Tippfehler", () => {
    // «schoggicreme» gegen «schoggincreme» (aus «schokoladencreme»)
    const [schoggicreme] = matchWordsOf("schoggicreme");
    const [schokoladencreme] = matchWordsOf("Schokoladencreme");

    expect(compareMatchWords(schoggicreme, schokoladencreme)?.rule).toBe(
      MatchRule.TYPO,
    );
  });

  test("ohne Gemeinsamkeit kein Vergleich", () => {
    expect(compareMatchWords(zimt, karotten)).toBeNull();
  });
});

/* =====================================================================
// scoreMatch
// ===================================================================== */
describe("scoreMatch", () => {
  test("gleiche Kernwörter ergeben 1, auch in anderer Reihenfolge", () => {
    const match = scoreMatch(
      matchWordsOf("Joghurt griechischer"),
      matchWordsOf("Griechischer Joghurt, laktosefrei"),
    );

    expect(match).toEqual({
      score: 1,
      rule: MatchRule.EXACT,
      containsAll: true,
      firstQueryPosition: 0,
    });
  });

  test("Score aus beiden Wortzahlen: Burger Patties (Fleisch und Vegi)", () => {
    // 2 × (0.8 Tippfehler + 1 exakt) / (4 + 2 Wörter)
    const match = scoreMatch(
      matchWordsOf("Burger Patties (Fleisch und Vegi)"),
      matchWordsOf("Buger Patties"),
    );

    expect(match?.score).toBeCloseTo(0.6);
    expect(match?.containsAll).toBe(true);
  });

  test("Regel ist die schwächste der gepaarten Wörter", () => {
    // «patties» ist exakt, aber erklärt nicht, warum die Namen verschieden sind
    const match = scoreMatch(
      matchWordsOf("Burger Patties"),
      matchWordsOf("Buger Patties"),
    );

    expect(match?.rule).toBe(MatchRule.TYPO);
  });

  test("Synonym als Regel: Rüebli gegen Karotten", () => {
    const match = scoreMatch(matchWordsOf("Rüebli"), matchWordsOf("Karotten"));

    expect(match?.score).toBe(1);
    expect(match?.rule).toBe(MatchRule.SYNONYM);
  });

  test("jedes Wort wird höchstens einmal gepaart", () => {
    const match = scoreMatch(matchWordsOf("Rahm Rahm"), matchWordsOf("Rahm"));

    expect(match?.score).toBeCloseTo(2 / 3);
  });

  test("das stärkste Paar wird zuerst gebildet, nicht das erste Wort", () => {
    // Paart «zimtstangen» zuerst mit «zimt», bleibt für «zimt» nichts übrig
    const match = scoreMatch(
      matchWordsOf("Zimtstangen Zimt"),
      matchWordsOf("Zimt"),
    );

    expect(match?.score).toBeCloseTo(2 / 3);
    expect(match?.rule).toBe(MatchRule.EXACT);
    expect(match?.firstQueryPosition).toBe(1);
  });

  test("bei gleichem Gewicht wird das exakte Paar vor dem Stamm gebildet", () => {
    // Exakt und Stamm wiegen beide 1; die Regel soll das gleiche Wort zeigen
    const match = scoreMatch(
      matchWordsOf("Chili Chilis"),
      matchWordsOf("Chilis"),
    );

    expect(match?.rule).toBe(MatchRule.EXACT);
    expect(match?.firstQueryPosition).toBe(1);
  });

  test("containsAll nur, wenn jedes Wort des Kandidaten gepaart ist", () => {
    expect(
      scoreMatch(
        matchWordsOf("Griechischer"),
        matchWordsOf("Griechischer Joghurt"),
      )?.containsAll,
    ).toBe(false);
    expect(
      scoreMatch(matchWordsOf("Rahm"), matchWordsOf("Rahm Rahm"))?.containsAll,
    ).toBe(false);
  });

  test("Position des frühesten gepaarten Worts der Anfrage", () => {
    const match = scoreMatch(
      matchWordsOf("Gemüse (z.B. Karotten, Paprika Zucchini)"),
      matchWordsOf("Karotten"),
    );

    expect(match?.firstQueryPosition).toBe(1);
  });

  test("ohne gepaartes Wort kein Ergebnis", () => {
    expect(scoreMatch(matchWordsOf("Reis"), matchWordsOf("Mais"))).toBeNull();
    expect(scoreMatch([], matchWordsOf("Zimt"))).toBeNull();
  });

  test("Score und Regel sind in beide Richtungen gleich", () => {
    const names = [
      ...BASE_CANDIDATES.map((candidate) => candidate.name),
      "Burger Patties (Fleisch und Vegi)",
      "Gemüse (z.B. Karotten, Paprika Zucchini)",
      "Zimtstangen Zimt",
      "Rahm Rahm",
    ];

    names.forEach((nameA) =>
      names.forEach((nameB) => {
        const forward = scoreMatch(matchWordsOf(nameA), matchWordsOf(nameB));
        const backward = scoreMatch(matchWordsOf(nameB), matchWordsOf(nameA));

        expect([nameA, nameB, backward?.score]).toEqual([
          nameA,
          nameB,
          forward?.score,
        ]);
        expect(backward?.rule).toBe(forward?.rule);
      }),
    );
  });
});
