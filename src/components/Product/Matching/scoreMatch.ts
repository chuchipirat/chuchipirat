/**
 * Ähnlichkeit zweier Namen über ihre Kernwörter.
 *
 * Jedes Wort wird höchstens einmal gepaart, die stärksten Paare zuerst. So
 * steigt der Score nie über 1 und ist in beide Richtungen gleich.
 */
import {compareWords, WORD_WEIGHTS} from "./compareWords";
import {canonicalWord, NameVocabulary} from "./nameVocabulary";
import {MatchRule, ProductMatch, WordComparison} from "./productMatching.types";

/** Ein Kernwort in den zwei Formen, die der Vergleich braucht. */
export type MatchWord = {
  /** Wie eingegeben, nur normalisiert, z.B. «rueebli». */
  normalized: string;
  /** Vergleichsform mit Synonym-Vertreter, z.B. «karotten». */
  canonical: string;
};

/**
 * Ähnlichkeit zu einem Kandidaten, noch ohne den Kandidaten selbst.
 *
 * `firstQueryPosition` ist die Stelle des frühesten gepaarten Worts der
 * Anfrage; danach wird bei gleichem Score sortiert.
 */
export type MatchScore = Omit<ProductMatch, "candidate"> & {
  firstQueryPosition: number;
};

/** Zwei Wörter, die zusammenpassen, mit ihrer Stelle im jeweiligen Namen. */
type WordPair = {
  /** Stelle des Worts in der Anfrage. */
  queryPosition: number;
  /** Stelle des Worts im Kandidaten. */
  candidatePosition: number;
  /** Regel und Gewicht des Paars. */
  comparison: WordComparison;
};

/** Regeln von der stärksten zur schwächsten, wie im Enum. */
const RULE_ORDER = Object.values(MatchRule);

/**
 * Bildet zu jedem Kernwort die Vergleichsform.
 *
 * Einmal pro Name aufrufen, nicht pro Vergleich: `canonicalWord` geht bei
 * Teilwörtern alle Synonyme durch.
 *
 * @param coreWords Kernwörter aus `analyzeName`.
 * @param vocabulary Vorbereitetes Vokabular aus `buildVocabulary`.
 * @returns Wörter mit normalisierter Form und Vergleichsform.
 * @example
 * toMatchWords(["rueebli"], vocabulary)
 * // [{normalized: "rueebli", canonical: "karotten"}]
 */
export const toMatchWords = (
  coreWords: string[],
  vocabulary: NameVocabulary,
): MatchWord[] => {
  return coreWords.map((word) => ({
    normalized: word,
    canonical: canonicalWord(word, vocabulary),
  }));
};

/**
 * Vergleicht zwei Kernwörter über ihre Vergleichsform.
 *
 * Sind die Vergleichsformen gleich, die Wörter aber verschieden, passen sie
 * über ein Synonym.
 *
 * @param wordA Erstes Wort.
 * @param wordB Zweites Wort.
 * @returns Regel mit Gewicht, oder `null`, wenn die Wörter nicht passen.
 * @example
 * compareMatchWords(rueebli, karotten) // {rule: "synonym", weight: 1}
 */
export const compareMatchWords = (
  wordA: MatchWord,
  wordB: MatchWord,
): WordComparison | null => {
  const comparison = compareWords(wordA.canonical, wordB.canonical);

  if (
    comparison?.rule === MatchRule.EXACT &&
    wordA.normalized !== wordB.normalized
  ) {
    return {rule: MatchRule.SYNONYM, weight: WORD_WEIGHTS[MatchRule.SYNONYM]};
  }

  return comparison;
};

/**
 * Sucht alle Paare aus einem Wort der Anfrage und einem des Kandidaten,
 * die zusammenpassen.
 *
 * @param queryWords Kernwörter der Anfrage.
 * @param candidateWords Kernwörter des Kandidaten.
 * @returns Alle passenden Paare; ein Wort kann in mehreren vorkommen.
 */
const findWordPairs = (
  queryWords: MatchWord[],
  candidateWords: MatchWord[],
): WordPair[] => {
  const pairs: WordPair[] = [];

  queryWords.forEach((queryWord, queryPosition) =>
    candidateWords.forEach((candidateWord, candidatePosition) => {
      const comparison = compareMatchWords(queryWord, candidateWord);
      if (comparison) {
        pairs.push({queryPosition, candidatePosition, comparison});
      }
    }),
  );

  return pairs;
};

/**
 * Wählt die Paare aus, die zusammen am meisten wiegen: stärkste zuerst,
 * jedes Wort höchstens einmal.
 *
 * Bei gleichem Gewicht geht die stärkere Regel vor, damit «Chili Chilis»
 * gegen «Chilis» das gleiche Wort paart, nicht den Stamm.
 *
 * @param pairs Alle passenden Paare aus `findWordPairs`.
 * @returns Ausgewählte Paare, stärkste zuerst.
 */
const pickBestPairs = (pairs: WordPair[]): WordPair[] => {
  const strongestFirst = [...pairs].sort(
    (pairA, pairB) =>
      pairB.comparison.weight - pairA.comparison.weight ||
      RULE_ORDER.indexOf(pairA.comparison.rule) -
        RULE_ORDER.indexOf(pairB.comparison.rule),
  );

  const usedQueryPositions = new Set<number>();
  const usedCandidatePositions = new Set<number>();
  const bestPairs: WordPair[] = [];

  strongestFirst.forEach((pair) => {
    if (
      usedQueryPositions.has(pair.queryPosition) ||
      usedCandidatePositions.has(pair.candidatePosition)
    ) {
      return;
    }
    usedQueryPositions.add(pair.queryPosition);
    usedCandidatePositions.add(pair.candidatePosition);
    bestPairs.push(pair);
  });
  return bestPairs;
};

/**
 * Berechnet, wie ähnlich ein Kandidat der Anfrage ist.
 *
 * Score = 2 × Summe der Gewichte / (Wörter Anfrage + Wörter Kandidat). Die
 * Regel ist die schwächste der Paare, weil sie erklärt, warum die Namen
 * nicht gleich sind.
 *
 * @param queryWords Kernwörter der Anfrage.
 * @param candidateWords Kernwörter des Kandidaten.
 * @returns Score, Regel, ob der Kandidat ganz in der Anfrage steckt
 * (`containsAll`), ob die Anfrage ganz im Kandidaten steckt (`coversQuery`),
 * und die Stelle des frühesten gepaarten Worts; `null` ohne passendes Wort.
 * @example
 * scoreMatch(burgerPattiesFleischVegi, bugerPatties)
 * // {score: 0.6, rule: "typo", containsAll: true, coversQuery: false,
 * //  firstQueryPosition: 0}
 */
export const scoreMatch = (
  queryWords: MatchWord[],
  candidateWords: MatchWord[],
): MatchScore | null => {
  const pairs = pickBestPairs(findWordPairs(queryWords, candidateWords));

  if (pairs.length === 0) return null;

  const weightSum = pairs.reduce(
    (sum, pair) => sum + pair.comparison.weight,
    0,
  );
  const weakestPosition = Math.max(
    ...pairs.map((pair) => RULE_ORDER.indexOf(pair.comparison.rule)),
  );

  return {
    score: (2 * weightSum) / (queryWords.length + candidateWords.length),
    rule: RULE_ORDER[weakestPosition],
    containsAll: pairs.length === candidateWords.length,
    coversQuery: pairs.length === queryWords.length,
    firstQueryPosition: Math.min(...pairs.map((pair) => pair.queryPosition)),
  };
};
