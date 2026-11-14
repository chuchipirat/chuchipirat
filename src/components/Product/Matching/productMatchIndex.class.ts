/**
 * Index über alle Produkte und Materialien für die Prüfung beim Anlegen.
 *
 * Einmal pro Seite bauen und für jede Eingabe wiederverwenden: Der Aufbau
 * zerlegt jeden Namen, eine Anfrage vergleicht nur noch Wörter.
 */
import {analyzeName} from "./analyzeName";
import {NameVocabulary} from "./nameVocabulary";
import {normalizeName} from "./normalizeName";
import {
  MatchCandidate,
  NameAnalysis,
  NameWordKind,
  ProductMatch,
} from "./productMatching.types";
import {MatchScore, MatchWord, scoreMatch, toMatchWords} from "./scoreMatch";
import {WordIndex} from "./wordIndex.class";

/** Ein Name eines Kandidaten, einmal zerlegt; mit Einzahl hat ein Kandidat zwei. */
type IndexEntry = {
  /** Kandidat, zu dem der Name gehört. */
  candidate: MatchCandidate;
  /** Kernwörter des Namens. */
  words: MatchWord[];
  /** Eigenschaften als ein Text, z.B. «vegan»; leer ohne Eigenschaft. */
  propertyKey: string;
};

/** Ab diesem Score gilt ein Kandidat als ähnlich, auch wenn er nicht ganz im Namen steckt. */
export const SIMILARITY_THRESHOLD = 0.5;

/** Ein bewerteter Eintrag; behält Eigenschaften und Position für die Sortierung. */
type ScoredEntry = {entry: IndexEntry; matchScore: MatchScore};

/**
 * Fasst die Eigenschaften eines Namens zu einem vergleichbaren Text zusammen.
 *
 * Zwei Listen sind nie gleich (`===`), zwei Texte schon. Doppelte fallen
 * weg: «Haferrahm, vegan» ist einmal vegan.
 *
 * @param analysis Zerlegter Name.
 * @returns Eigenschaften sortiert und mit Komma verbunden, leer ohne.
 * @example
 * propertyKeyOf(analyzeName("Haferrahm, vegan", vocabulary)) // "vegan"
 */
export const propertyKeyOf = (analysis: NameAnalysis): string => {
  const properties = analysis.listWords
    .filter((listWord) => listWord.entry.kind === NameWordKind.PROPERTY)
    .map((listWord) => listWord.entry.property ?? "");

  return [...new Set(properties)].sort().join(",");
};

/**
 * Namen, unter denen ein Kandidat gefunden wird.
 *
 * @param candidate Produkt oder Material.
 * @returns Name, dazu die Einzahl, wenn sie anders normalisiert ist.
 */
const namesOf = (candidate: MatchCandidate): string[] => {
  return candidate.nameSingular &&
    normalizeName(candidate.nameSingular) !== normalizeName(candidate.name)
    ? [candidate.name, candidate.nameSingular]
    : [candidate.name];
};

/**
 * Sortiert bewertete Einträge: höherer Score, dann gleiche Eigenschaften wie
 * die Anfrage, dann früheres Wort der Anfrage, dann Name.
 *
 * @param scoredEntries Bewertete Einträge.
 * @param queryPropertyKey Eigenschaften der Anfrage aus `propertyKeyOf`.
 * @returns Sortierte Kopie.
 */
const sortByRelevance = (
  scoredEntries: ScoredEntry[],
  queryPropertyKey: string,
): ScoredEntry[] => {
  return [...scoredEntries].sort(
    (scoredA, scoredB) =>
      scoredB.matchScore.score - scoredA.matchScore.score ||
      Number(scoredB.entry.propertyKey === queryPropertyKey) -
        Number(scoredA.entry.propertyKey === queryPropertyKey) ||
      scoredA.matchScore.firstQueryPosition -
        scoredB.matchScore.firstQueryPosition ||
      scoredA.entry.candidate.name.localeCompare(
        scoredB.entry.candidate.name,
        "de",
      ),
  );
};

/**
 * Findet zu einem eingegebenen Namen gleiche und ähnliche Produkte und
 * Materialien.
 *
 * @example
 * const index = new ProductMatchIndex(candidates, vocabulary);
 * index.findExact("ZIMT") // [Zimt]
 * index.findMatches(analyzeName("Zimt, gemahlen", vocabulary))
 * // [{Zimt, 1, exact}, {Zimtstangen, 0.7, compound}]
 */
export class ProductMatchIndex {
  private candidatesByName = new Map<string, MatchCandidate[]>();
  private entriesByWord = new Map<string, IndexEntry[]>();
  private wordIndex: WordIndex;
  private vocabulary: NameVocabulary;

  /**
   * @param candidates Alle Produkte und Materialien, auch deaktivierte.
   * @param vocabulary Vorbereitetes Vokabular aus `buildVocabulary`.
   */
  constructor(candidates: MatchCandidate[], vocabulary: NameVocabulary) {
    this.vocabulary = vocabulary;

    candidates.forEach((candidate) =>
      namesOf(candidate).forEach((name) => {
        this.addName(candidate, name);
      }),
    );

    this.wordIndex = new WordIndex(this.entriesByWord.keys());
  }

  /**
   * Nimmt einen Namen eines Kandidaten in alle Nachschlage-Tabellen auf.
   *
   * @param candidate Kandidat, zu dem der Name gehört.
   * @param name Name oder Einzahl.
   */
  private addName(candidate: MatchCandidate, name: string): void {
    this.addTo(this.candidatesByName, normalizeName(name), candidate);

    const analysis = analyzeName(name, this.vocabulary);
    const entry: IndexEntry = {
      candidate,
      words: toMatchWords(analysis.coreWords, this.vocabulary),
      propertyKey: propertyKeyOf(analysis),
    };
    // «Rahm Rahm» steht nur einmal unter «rahm»
    new Set(entry.words.map((word) => word.canonical)).forEach((word) =>
      this.addTo(this.entriesByWord, word, entry),
    );
  }

  /**
   * Hängt einen Wert an die Liste unter einem Schlüssel an, legt sie bei
   * Bedarf an.
   *
   * @param map Tabelle mit Listen.
   * @param key Schlüssel.
   * @param value Anzuhängender Wert.
   */
  private addTo<Value>(
    map: Map<string, Value[]>,
    key: string,
    value: Value,
  ): void {
    const values = map.get(key);
    if (values) {
      values.push(value);
    } else {
      map.set(key, [value]);
    }
  }

  /**
   * Findet Kandidaten mit gleichem Namen nach der Normalisierung, auch
   * deaktivierte: Sie blockieren den Namen.
   *
   * @param name Name, wie er eingegeben wurde.
   * @returns Kandidaten mit gleichem Namen oder gleicher Einzahl, jeder einmal.
   */
  findExact(name: string): MatchCandidate[] {
    return this.candidatesByName.get(normalizeName(name)) ?? [];
  }

  /**
   * Findet ähnliche Kandidaten, die besten zuerst.
   *
   * Ein Kandidat zählt ab `SIMILARITY_THRESHOLD` oder wenn er ganz im Namen
   * steckt. Deaktivierte werden nie vorgeschlagen.
   *
   * @param analysis Zerlegter Name aus `analyzeName`.
   * @param options `excludeUid` lässt einen Eintrag weg (z.B. beim
   * Umbenennen sich selbst), `limit` begrenzt die Anzahl.
   * @returns Treffer mit Score, Regel, `containsAll` und `coversQuery`.
   */
  findMatches(
    analysis: NameAnalysis,
    options: {excludeUid?: string; limit?: number} = {},
  ): ProductMatch[] {
    const queryWords = toMatchWords(analysis.coreWords, this.vocabulary);

    const relevant = this.scoreEntries(queryWords, options.excludeUid).filter(
      (scoredEntry) =>
        scoredEntry.matchScore.score >= SIMILARITY_THRESHOLD ||
        scoredEntry.matchScore.containsAll,
    );

    return sortByRelevance(relevant, propertyKeyOf(analysis))
      .slice(0, options.limit)
      .map(({entry, matchScore}) => ({
        candidate: entry.candidate,
        score: matchScore.score,
        rule: matchScore.rule,
        containsAll: matchScore.containsAll,
        coversQuery: matchScore.coversQuery,
      }));
  }

  /**
   * Sammelt die Einträge, die mindestens ein passendes Wort haben.
   *
   * @param queryWords Kernwörter der Anfrage.
   * @returns Jeder Eintrag einmal, auch wenn mehrere Wörter passen.
   */
  private findEntries(queryWords: MatchWord[]): Set<IndexEntry> {
    const entries = new Set<IndexEntry>();

    queryWords.forEach((queryWord) =>
      this.wordIndex
        .findPartners(queryWord.canonical)
        .forEach((partner) =>
          this.entriesByWord
            .get(partner.word)
            ?.forEach((entry) => entries.add(entry)),
        ),
    );

    return entries;
  }

  /**
   * Bewertet die gefundenen Einträge und behält pro Kandidat den besten
   * (Name oder Einzahl).
   *
   * @param queryWords Kernwörter der Anfrage.
   * @param excludeUid Kandidat, der nicht vorkommen soll.
   * @returns Bewertete Einträge nutzbarer Kandidaten, unsortiert.
   */
  private scoreEntries(
    queryWords: MatchWord[],
    excludeUid?: string,
  ): ScoredEntry[] {
    const bestByUid = new Map<string, ScoredEntry>();

    this.findEntries(queryWords).forEach((entry) => {
      if (!entry.candidate.usable || entry.candidate.uid === excludeUid) return;

      const matchScore = scoreMatch(queryWords, entry.words);
      if (!matchScore) return;

      const previous = bestByUid.get(entry.candidate.uid);
      if (!previous || previous.matchScore.score < matchScore.score) {
        bestByUid.set(entry.candidate.uid, {entry, matchScore});
      }
    });

    return [...bestByUid.values()];
  }
}
