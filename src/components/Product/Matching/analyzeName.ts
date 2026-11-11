/**
 * Zerlegung eines eingegebenen Namens für Hinweise und Abgleich.
 *
 * Trennt die Wörter, die das Produkt ausmachen (Kernwörter), von Wörtern der
 * Wortliste, erkennt Aufzählungen mehrerer Produkte und bildet den Namen ohne
 * Detail-Wörter. Arbeitet nur mit dem Vokabular, ohne Bestand.
 */
import {compareWords, stemWord} from "./compareWords";
import {canonicalWord, NameVocabulary, VocabularyEntry} from "./nameVocabulary";
import {NameToken, normalizeName, tokenizeWithOriginal} from "./normalizeName";
import {
  FoundListWord,
  MatchRule,
  NameAnalysis,
  NameWordKind,
} from "./productMatching.types";

/** Regeln, bei denen ein Wort als ganzes Wort der Wortliste gilt. */
const WHOLE_WORD_RULES = [MatchRule.EXACT, MatchRule.STEM, MatchRule.TYPO];

/** Trennt Produkte ausserhalb von Klammern; ein Komma trennt dort nur Zusätze. */
const COMBINATION_SEPARATORS = / und | oder |[/&+]/i;

/** In Klammern trennt auch ein Komma, z.B. «(Flädli, Buchstaben)». */
const BRACKET_SEPARATORS = / und | oder |[/&+,]/i;

/**
 * Prüft, ob ein Wort als ganzes Wort einem Wort der Wortliste entspricht.
 *
 * Ein Teilwort zählt hier nicht, das prüft `findPartEntry`.
 *
 * @param word Vergleichsform des Worts im Namen.
 * @param entryWord Vergleichsform des Eintrags.
 * @returns `true` bei gleichem Wort, gleichem Stamm, Tippfehler oder wenn der
 * Stamm des Worts der Eintrag ist.
 * @example
 * isWholeMatch("gemahlener", "gemahlen") // true
 * isWholeMatch("haferrahm", "hafer") // false
 */
const isWholeMatch = (word: string, entryWord: string): boolean => {
  const rule = compareWords(word, entryWord)?.rule;

  // «gemahlener» hat den Stamm «gemahlen»: weder Tippfehler noch gleicher Stamm
  return (
    (rule !== undefined && WHOLE_WORD_RULES.includes(rule)) ||
    stemWord(word) === entryWord
  );
};

/**
 * Sucht den einwortigen Eintrag, dem ein Wort als Ganzes entspricht.
 *
 * Der Eintrag wird ebenfalls in seine Vergleichsform gebracht, damit ein
 * Synonym trifft: «laktis» findet den Eintrag «laktosefrei».
 *
 * @param word Vergleichsform des Worts im Namen.
 * @param vocabulary Vorbereitetes Vokabular aus `buildVocabulary`.
 * @returns Erster passender Eintrag, oder `undefined`.
 */
const findWholeEntry = (
  word: string,
  vocabulary: NameVocabulary,
): VocabularyEntry | undefined => {
  return vocabulary.entries.find(
    (vocabularyEntry) =>
      vocabularyEntry.tokens.length === 1 &&
      isWholeMatch(word, canonicalWord(vocabularyEntry.tokens[0], vocabulary)),
  );
};

/**
 * Sucht den einwortigen Eintrag, der als Teil in einem Wort steckt, z.B.
 * «Hafer» in «Haferrahm».
 *
 * Der Eintrag muss kürzer sein als das Wort, denn `compareWords` sagt nicht,
 * welches Wort Teil des anderen ist: «Mate» steckt nicht in «Material».
 *
 * @param word Vergleichsform des Worts im Namen.
 * @param vocabulary Vorbereitetes Vokabular aus `buildVocabulary`.
 * @returns Erster passender Eintrag, oder `undefined`.
 */
const findPartEntry = (
  word: string,
  vocabulary: NameVocabulary,
): VocabularyEntry | undefined => {
  return vocabulary.entries.find((vocabularyEntry) => {
    const representative = canonicalWord(vocabularyEntry.tokens[0], vocabulary);

    return (
      vocabularyEntry.tokens.length === 1 &&
      representative.length < word.length &&
      compareWords(word, representative)?.rule === MatchRule.COMPOUND
    );
  });
};

/**
 * Sucht für ein einzelnes Wort den Fund in der Wortliste, zuerst als ganzes
 * Wort, dann als Teilwort.
 *
 * @param token Wort des Namens mit Original- und Normalform.
 * @param vocabulary Vorbereitetes Vokabular aus `buildVocabulary`.
 * @returns Fund mit dem Wort wie im Namen, bei Teilwörtern wie im Eintrag;
 * `undefined`, wenn das Wort nicht in der Wortliste steht.
 * @example
 * findListWord({original: "vegane", normalized: "vegane"}, vocabulary)
 * // {word: "vegane", entry: {word: "vegan", …}, isPart: false}
 */
const findListWord = (
  token: NameToken,
  vocabulary: NameVocabulary,
): FoundListWord | undefined => {
  const word = canonicalWord(token.normalized, vocabulary);

  const wholeEntry = findWholeEntry(word, vocabulary);
  if (wholeEntry) {
    return {word: token.original, entry: wholeEntry.entry, isPart: false};
  }

  const partEntry = findPartEntry(word, vocabulary);
  if (partEntry) {
    return {word: partEntry.entry.word, entry: partEntry.entry, isPart: true};
  }

  return undefined;
};

/**
 * Sucht einen mehrwortigen Eintrag, der an dieser Stelle des Namens beginnt.
 *
 * Die Wörter müssen genau gleich sein, ohne Tippfehler oder Stamm: solche
 * Einträge sind selten und genau, ein unscharfer Vergleich träfe öfter falsch.
 *
 * @param tokens Alle Wörter des Namens.
 * @param index Stelle, an der der Eintrag beginnen soll.
 * @param vocabulary Vorbereitetes Vokabular aus `buildVocabulary`.
 * @returns Passender Eintrag, oder `undefined`; auch, wenn der Name vor dem
 * Ende des Eintrags aufhört.
 * @example
 * // tokens von «Plant Based Würstchen»
 * findMultiWordEntry(tokens, 0, vocabulary) // Eintrag «plant based»
 */
const findMultiWordEntry = (
  tokens: NameToken[],
  index: number,
  vocabulary: NameVocabulary,
): VocabularyEntry | undefined => {
  return vocabulary.entries.find(
    (vocabularyEntry) =>
      vocabularyEntry.tokens.length > 1 &&
      vocabularyEntry.tokens.every(
        (entryToken, position) =>
          tokens[index + position]?.normalized === entryToken,
      ),
  );
};

/**
 * Teilt die Wörter eines Namens in Kernwörter und Funde der Wortliste.
 *
 * Mehrwortige Einträge gehen vor, ihre Wörter werden zusammen übersprungen.
 * Ein Teilwort ergibt einen Fund und bleibt trotzdem Kernwort.
 *
 * @param name Name, wie er eingegeben wurde.
 * @param vocabulary Vorbereitetes Vokabular aus `buildVocabulary`.
 * @returns Kernwörter (normalisiert) und Funde, beide in der Reihenfolge des Namens.
 */
const splitWords = (
  name: string,
  vocabulary: NameVocabulary,
): Pick<NameAnalysis, "coreWords" | "listWords"> => {
  const tokens = tokenizeWithOriginal(name);
  const coreWords: string[] = [];
  const listWords: FoundListWord[] = [];
  let index = 0;

  while (index < tokens.length) {
    const token = tokens[index];
    const multiWordEntry = findMultiWordEntry(tokens, index, vocabulary);

    if (multiWordEntry) {
      const tokenCount = multiWordEntry.tokens.length;
      listWords.push({
        word: tokens
          .slice(index, index + tokenCount)
          .map((nameToken) => nameToken.original)
          .join(" "),
        entry: multiWordEntry.entry,
        isPart: false,
      });
      index += tokenCount;
      continue;
    }

    const listWord = findListWord(token, vocabulary);
    if (listWord) {
      listWords.push(listWord);
    }
    // Teilwörter bleiben Kernwort, sonst fände «Haferrahm» kein «Rahm»
    if (!listWord || listWord.isPart) {
      coreWords.push(token.normalized);
    }

    index += 1;
  }

  return {coreWords, listWords};
};

/**
 * Teilt einen Text an Trennzeichen in bereinigte Teile.
 *
 * @param text Zu teilender Text.
 * @param separators Muster der Trennstellen.
 * @returns Teile ohne Leerraum am Rand, ohne leere Teile.
 * @example
 * splitAt("Rahm, , vegan", /,/) // ["Rahm", "vegan"]
 */
const splitAt = (text: string, separators: RegExp): string[] => {
  return text
    .split(separators)
    .map((part) => part.trim())
    .filter((part) => part !== "");
};

/**
 * Zerlegt einen Namen, der mehrere Produkte aufzählt, in seine Teile.
 *
 * Mit Klammer zählt nur deren Inhalt als Aufzählung, der Text davor wird der
 * erste Teil. Eine nicht geschlossene Klammer reicht bis zum Ende.
 *
 * @param name Name, wie er eingegeben wurde.
 * @returns Mindestens zwei Teile in Originalschreibweise, oder leer, wenn der
 * Name keine Aufzählung ist.
 * @example
 * findCombinationParts("Salz und Pfeffer") // ["Salz", "Pfeffer"]
 * findCombinationParts("Burger Patties (Fleisch und Vegi)")
 * // ["Burger Patties", "Fleisch", "Vegi"]
 * findCombinationParts("Rahm (vegan)") // []
 */
const findCombinationParts = (name: string): string[] => {
  const openIndex = name.indexOf("(");

  if (openIndex === -1) {
    const parts = splitAt(name, COMBINATION_SEPARATORS);
    return parts.length > 1 ? parts : [];
  }

  const closeIndex = name.indexOf(")", openIndex);
  const inside = name.slice(
    openIndex + 1,
    closeIndex === -1 ? name.length : closeIndex,
  );
  const parts = splitAt(inside, BRACKET_SEPARATORS);

  if (parts.length > 1) {
    return [name.slice(0, openIndex).trim(), ...parts];
  }
  return [];
};

/**
 * Entfernt die Detail-Wörter aus dem Namen und räumt Kommas und Leerraum auf.
 *
 * Nur ganze Wörter fallen weg: ein Teilwort steht so nicht im Namen und
 * gehört zum Kernwort. Eigenschaften bleiben, sie machen ein eigenes Produkt.
 *
 * @param name Name, wie er eingegeben wurde.
 * @param listWords Funde der Wortliste aus `splitWords`.
 * @returns Name in Originalschreibweise ohne Detail-Wörter.
 * @example
 * removeDetailWords("Rahm, gemahlen, vegan", listWords) // "Rahm, vegan"
 */
const removeDetailWords = (
  name: string,
  listWords: FoundListWord[],
): string => {
  const detailWords = listWords
    .filter(
      (listWord) =>
        listWord.entry.kind === NameWordKind.DETAIL && !listWord.isPart,
    )
    .map((listWord) => listWord.word);

  let remainingName = name;
  detailWords.forEach((word) => {
    remainingName = remainingName.replace(word, "");
  });

  return splitAt(remainingName, /,/)
    .map((part) => part.replace(/\s+/g, " "))
    .join(", ");
};

/**
 * Zerlegt einen eingegebenen Namen in seine Bestandteile.
 *
 * @param name Name, wie er eingegeben wurde.
 * @param vocabulary Vorbereitetes Vokabular aus `buildVocabulary`.
 * @returns Normalisierter Name, Kernwörter, Funde der Wortliste, Aufzählung
 * und Name ohne Detail-Wörter.
 * @example
 * analyzeName("Zimt, gemahlen", vocabulary)
 * // coreWords: ["zimt"], listWords: [gemahlen], nameWithoutDetails: "Zimt"
 */
export const analyzeName = (
  name: string,
  vocabulary: NameVocabulary,
): NameAnalysis => {
  const combinationParts = findCombinationParts(name);

  const {coreWords, listWords} = splitWords(name, vocabulary);

  return {
    normalized: normalizeName(name),
    coreWords,
    listWords,
    isCombination: combinationParts.length > 0,
    combinationParts,
    nameWithoutDetails: removeDetailWords(name, listWords),
  };
};
