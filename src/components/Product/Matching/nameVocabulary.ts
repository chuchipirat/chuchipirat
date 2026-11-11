/**
 * Vorbereitung von Wortliste und Synonymen für die Wortanalyse.
 *
 * Wird einmal pro Seite gebaut und für jeden Namen wiederverwendet. Die
 * Listen kommen als Parameter, damit der Regel-Tester gespeicherte und noch
 * nicht gespeicherte Regeln vergleichen kann.
 */
import {normalizeName, tokenizeName} from "./normalizeName";
import {MatchingRules, NameWord, SynonymPair} from "./productMatching.types";

/** Kürzere Synonyme ersetzen keine Teilwörter, sie stecken in zu vielen Wörtern. */
const MINIMUM_SYNONYM_PART_LENGTH = 4;

/** Ein Eintrag der Wortliste, in normalisierte Wörter zerlegt. */
export type VocabularyEntry = {
  /** Der Eintrag, wie er gepflegt ist. */
  entry: NameWord;
  /** Normalisierte Wörter des Eintrags, z.B. `["plant", "based"]`. */
  tokens: string[];
};

/** Wortliste und Synonyme, bereit für die Analyse vieler Namen. */
export type NameVocabulary = {
  /** Einträge der Wortliste, mehrwortige zuerst. */
  entries: VocabularyEntry[];
  /** Normalisiertes Synonym → Vertreter seiner Gruppe, z.B. «rueebli» → «karotten». */
  synonymOf: Map<string, string>;
};

/**
 * Verbindet Synonympaare zu Gruppen von Wörtern, die dasselbe meinen.
 *
 * Paare mit einem gemeinsamen Wort landen in derselben Gruppe, auch wenn
 * zuerst zwei getrennte Gruppen entstanden sind: Rüebli ≈ Möhren und
 * Karotten ≈ Mohrrüben werden durch Möhren ≈ Mohrrüben eine Gruppe.
 *
 * @param synonyms Synonympaare in Pflege-Schreibweise.
 * @returns Gruppen mit normalisierten Wörtern.
 */
const synonymGroups = (synonyms: SynonymPair[]): Set<string>[] => {
  let groups: Set<string>[] = [];

  synonyms.forEach((pair) => {
    const words = [normalizeName(pair.nameA), normalizeName(pair.nameB)];

    // Gruppen, die schon eines der beiden Wörter enthalten
    const touched = groups.filter((group) =>
      words.some((word) => group.has(word)),
    );

    // Das Paar und alle berührten Gruppen werden eine Gruppe
    const merged = new Set<string>(words);
    touched.forEach((group) => group.forEach((word) => merged.add(word)));

    groups = [...groups.filter((group) => !touched.includes(group)), merged];
  });

  return groups;
};

/**
 * Bereitet Wortliste und Synonyme einmal für die Analyse vieler Namen vor.
 *
 * @param rules Wortliste und Synonympaare, wie sie gepflegt sind.
 * @returns Vokabular mit zerlegten Einträgen und dem Vertreter jedes Synonyms
 * (alphabetisch erstes Wort seiner Gruppe).
 * @example
 * const vocabulary = buildVocabulary(rules);
 * canonicalWord("rueebli", vocabulary) // "karotten"
 */
export const buildVocabulary = (rules: MatchingRules): NameVocabulary => {
  const entries = rules.nameWords
    .map((entry) => ({entry, tokens: tokenizeName(entry.word)}))
    // Mehrwortige Einträge zuerst, damit «plant based» vor «plant» greift
    .sort((entryA, entryB) => entryB.tokens.length - entryA.tokens.length);

  const synonymOf = new Map<string, string>();

  synonymGroups(rules.synonyms).forEach((group) => {
    const representative = [...group].sort()[0];
    group.forEach((word) => synonymOf.set(word, representative));
  });

  return {entries, synonymOf};
};

/**
 * Ersetzt ein Synonym am Anfang oder Ende eines Wortes durch den Vertreter
 * seiner Gruppe, z.B. «schokoladencreme» → «schoggincreme».
 *
 * In der Wortmitte wird nichts ersetzt: «bioschokoladencreme» bleibt, weil
 * Zufallstreffer mitten im Wort häufiger sind als echte Teilwörter.
 *
 * @param word Bereits normalisiertes Wort, das selbst kein Synonym ist.
 * @param vocabulary Vorbereitetes Vokabular mit den Synonym-Gruppen.
 * @returns Wort mit ersetztem Teil, oder das Wort selbst.
 */
const replaceSynonymPart = (
  word: string,
  vocabulary: NameVocabulary,
): string => {
  // Kurze Synonyme stecken in zu vielen Wörtern («tee» in «teekanne»)
  const synonyms = [...vocabulary.synonymOf.keys()].filter(
    (synonym) => synonym.length >= MINIMUM_SYNONYM_PART_LENGTH,
  );

  // Synonym am Anfang: Vertreter + Rest nach dem Synonym
  //
  //   word:     s c h o k o l a d e n c r e m e
  //             └── synonym (10) ─┘ └── rest ─┘
  //                                 slice(10) = "ncreme"
  //
  //   Ergebnis: "schoggi" + "ncreme" = "schoggincreme"
  const start = synonyms.find((synonym) => word.startsWith(synonym));
  if (start) {
    const representative = vocabulary.synonymOf.get(start) ?? start;
    return representative + word.slice(start.length);
  }

  // Synonym am Ende: Teil vor dem Synonym + Vertreter
  //
  //   word:     z a r t b i t t e r s c h o k o l a d e
  //             └───── vorne ─────┘ └── synonym (10) ─┘
  //             slice(0, 20 - 10) = "zartbitter"
  //
  //   Ergebnis: "zartbitter" + "schoggi" = "zartbitterschoggi"
  const end = synonyms.find((synonym) => word.endsWith(synonym));
  if (end) {
    const representative = vocabulary.synonymOf.get(end) ?? end;
    return word.slice(0, word.length - end.length) + representative;
  }

  return word;
};

/**
 * Gibt die Form zurück, unter der ein Wort verglichen wird: den Vertreter
 * seiner Synonym-Gruppe, auch wenn das Synonym nur Teil des Wortes ist.
 *
 * @param word Bereits normalisiertes Wort.
 * @param vocabulary Vorbereitetes Vokabular aus `buildVocabulary`.
 * @returns Vertreter, Wort mit ersetztem Teil, oder das Wort selbst.
 * @example
 * canonicalWord("rueebli", vocabulary) // "karotten"
 * canonicalWord("schokoladencreme", vocabulary) // "schoggincreme"
 * canonicalWord("zimt", vocabulary) // "zimt"
 */
export const canonicalWord = (
  word: string,
  vocabulary: NameVocabulary,
): string =>
  vocabulary.synonymOf.get(word) ?? replaceSynonymPart(word, vocabulary);
