/**
 * Vergleich zweier einzelner, bereits normalisierter Wörter.
 *
 * Jede Regel (gleich, Wortstamm, Tippfehler, Teilwort) ist einzeln benannt,
 * damit ein Hinweis später sagen kann, welche Regel ihn ausgelöst hat.
 */
import {MatchRule, WordComparison} from "./productMatching.types";

/**
 * Endungen, die für den Wortstamm entfernt werden. Die längeren stehen vorne,
 * damit «Tomaten» zu «Tomat» wird und nicht zu «Tomate».
 */
const WORD_ENDINGS: string[] = ["chen", "li", "en", "er", "n", "e", "s"];

/** So viele Buchstaben müssen nach dem Abschneiden der Endung bleiben. */
const MINIMUM_STEM_LENGTH = 4;

/** Bis zu dieser Länge ist kein Tippfehler erlaubt, sonst passt fast alles. */
const NO_TYPO_MAX_LENGTH = 4;
/** Bis zu dieser Länge ist ein Tippfehler erlaubt, darüber zwei. */
const ONE_TYPO_MAX_LENGTH = 8;

/** Kürzere Wörter stecken in zu vielen anderen («Eis» in «Eiscreme»). */
export const MINIMUM_COMPOUND_PART_LENGTH = 4;
/** Ein kürzerer Rest ist eher eine Endung als ein eigenes Wort («Reisig»). */
export const MINIMUM_COMPOUND_REST_LENGTH = 3;

/**
 * Gewicht je Regel. Unsichere Regeln zählen weniger, damit ein Vorschlag
 * über eine sichere Regel vorne steht.
 */
export const WORD_WEIGHTS: Record<MatchRule, number> = {
  [MatchRule.EXACT]: 1,
  [MatchRule.STEM]: 1,
  [MatchRule.SYNONYM]: 1,
  [MatchRule.TYPO]: 0.8,
  [MatchRule.COMPOUND]: 0.7,
};

/**
 * Schneidet eine typische Endung ab, damit Ein- und Mehrzahl sowie
 * Verkleinerungen denselben Stamm haben.
 *
 * Entfernt wird höchstens eine Endung, und nur wenn danach noch mindestens
 * vier Buchstaben bleiben.
 *
 * @param word Bereits normalisiertes Wort.
 * @returns Der Wortstamm, oder das Wort selbst, wenn keine Endung passt.
 * @example
 * stemWord("wuerstchen") // "wuerst"
 * stemWord("chilis") // "chili"
 * stemWord("chili") // "chili" (nach «-li» blieben nur drei Buchstaben)
 */
export const stemWord = (word: string): string => {
  const ending = WORD_ENDINGS.find(
    (candidateEnding) =>
      word.endsWith(candidateEnding) &&
      word.length - candidateEnding.length >= MINIMUM_STEM_LENGTH,
  );

  if (ending) {
    return word.substring(0, word.length - ending.length);
  }

  return word;
};

/**
 * Zählt, wie viele Änderungen ein Wort in ein anderes verwandeln
 * (Damerau-Levenshtein-Abstand).
 *
 * Jede Änderung zählt 1: einen Buchstaben einfügen, löschen, ersetzen oder
 * zwei benachbarte Buchstaben vertauschen. Das Vertauschen ist ein typischer
 * Tippfehler («Zitm» statt «Zimt») und soll nicht doppelt zählen.
 *
 * Die Tabelle löst das Problem in kleinen Teilen: Die Zelle
 * `table[row][column]` enthält den Abstand zwischen den ersten `row`
 * Buchstaben von `wordA` und den ersten `column` Buchstaben von `wordB`.
 * Zeile 0 und Spalte 0 stehen für das leere Wort.
 *
 * @param wordA Erstes, bereits normalisiertes Wort.
 * @param wordB Zweites, bereits normalisiertes Wort.
 * @returns Kleinste Anzahl Änderungen; 0 bei gleichen Wörtern.
 * @example
 * editDistance("zimt", "zint") // 1 (ersetzen)
 * editDistance("zimt", "zitm") // 1 (vertauschen)
 * editDistance("kitten", "sitting") // 3
 */
export const editDistance = (wordA: string, wordB: string): number => {
  // Eine Zeile und eine Spalte mehr als Buchstaben, für das leere Wort
  const table = Array.from({length: wordA.length + 1}, () =>
    new Array(wordB.length + 1).fill(0),
  );

  // Vom leeren Wort zu den ersten `column` Buchstaben: `column`-mal einfügen
  for (let column = 0; column <= wordB.length; column++) {
    table[0][column] = column;
  }
  // Von den ersten `row` Buchstaben zum leeren Wort: `row`-mal löschen
  for (let row = 0; row <= wordA.length; row++) {
    table[row][0] = row;
  }

  // Zeile für Zeile füllen. Jede Zelle baut nur auf bereits fertigen Zellen
  // oben, links und schräg oben links auf.
  for (let row = 1; row <= wordA.length; row++) {
    for (let column = 1; column <= wordB.length; column++) {
      // Zeile und Spalte 0 sind das leere Wort, darum ist der Buchstabe
      // zur Zeile `row` an der Stelle `row - 1`
      const letterA = wordA[row - 1];
      const letterB = wordB[column - 1];

      // Gleiche Buchstaben kosten nichts, sonst zählt das Ersetzen
      const cost = letterA === letterB ? 0 : 1;

      table[row][column] = Math.min(
        table[row - 1][column] + 1, // Buchstabe aus A löschen
        table[row][column - 1] + 1, // Buchstabe aus B einfügen
        table[row - 1][column - 1] + cost, // ersetzen oder gleich
      );

      // Vertauschen: Sind die letzten zwei Buchstaben über Kreuz gleich
      // («mt» gegen «tm»), führt ein weiterer Weg hierher: der Abstand ohne
      // diese zwei Buchstaben plus ein Vertauschen. Ist er kürzer, gilt er.
      // `row > 1` und `column > 1` zuerst, sonst gibt es keinen Vorgänger.
      if (
        row > 1 &&
        column > 1 &&
        letterA === wordB[column - 2] &&
        letterB === wordA[row - 2]
      ) {
        table[row][column] = Math.min(
          table[row][column],
          table[row - 2][column - 2] + 1,
        );
      }
    }
  }

  // Die Zelle unten rechts vergleicht die ganzen Wörter
  return table[wordA.length][wordB.length];
};

/**
 * Gibt an, wie viele Tippfehler ein Wort dieser Länge haben darf.
 *
 * Bei kurzen Wörtern macht schon ein Buchstabe ein anderes Wort daraus
 * («Reis» und «Mais»), darum sind dort keine erlaubt.
 *
 * @param wordLength Länge des kürzeren der beiden verglichenen Wörter.
 * @returns 0, 1 oder 2.
 * @example
 * maxTypos(4) // 0
 * maxTypos(7) // 1
 * maxTypos(12) // 2
 */
export const maxTypos = (wordLength: number): number => {
  if (wordLength <= NO_TYPO_MAX_LENGTH) return 0;
  if (wordLength <= ONE_TYPO_MAX_LENGTH) return 1;
  return 2;
};

/**
 * Alle Wörter, die entstehen, wenn genau ein Buchstabe fehlt.
 *
 * @param word Wort, aus dem gelöscht wird.
 * @returns Ein Wort je Stelle; gleiche Ergebnisse können doppelt vorkommen.
 * @example
 * withOneLetterLess("abc") // ["bc", "ac", "ab"]
 */
const withOneLetterLess = (word: string): string[] => {
  const shorterWords: string[] = [];

  for (let position = 0; position < word.length; position++) {
    shorterWords.push(`${word.slice(0, position)}${word.slice(position + 1)}`);
  }
  return shorterWords;
};

/**
 * Alle Varianten eines Wortes mit bis zu `maxDeletions` fehlenden Buchstaben.
 *
 * Zwei Wörter mit höchstens einem Tippfehler Abstand haben immer eine
 * gemeinsame Variante mit höchstens einem gelöschten Buchstaben
 * («buger» = «burger» ohne «r»). Werden die Varianten aller Produkte einmal
 * nachschlagbar abgelegt, muss eine Eingabe nur mit den wenigen Treffern
 * genau verglichen werden statt mit jedem Produkt.
 *
 * @param word Bereits normalisiertes Wort.
 * @param maxDeletions Höchstens so viele Buchstaben werden gelöscht.
 * @returns Das Wort selbst und alle Varianten, ohne Doppelte.
 * @example
 * deletionVariants("abc", 1) // Set {"abc", "bc", "ac", "ab"}
 */
export const deletionVariants = (
  word: string,
  maxDeletions: number,
): Set<string> => {
  const variants = new Set<string>([word]);
  let currentRound: string[] = [word];

  // Jede Runde löscht einen Buchstaben mehr, aber nur aus den neuen
  // Varianten der letzten Runde; bekannte würden nur Doppelte liefern
  for (let round = 1; round <= maxDeletions; round++) {
    const nextRound: string[] = [];
    currentRound.forEach((variant) => {
      withOneLetterLess(variant).forEach((shortenedWord) => {
        if (!variants.has(shortenedWord)) {
          variants.add(shortenedWord);
          nextRound.push(shortenedWord);
        }
      });
    });
    currentRound = nextRound;
  }

  return variants;
};

/**
 * Prüft, ob sich zwei Wörter nur durch erlaubte Tippfehler unterscheiden.
 *
 * Verglichen werden die Wörter und ihre Stämme, der kleinere Abstand zählt:
 * «zwibeln»/«zwiebel» liegen erst als Stämme nah beieinander, «tomatem»/
 * «tomaten» nur als ganze Wörter.
 *
 * @param wordA Erstes, bereits normalisiertes Wort.
 * @param wordB Zweites, bereits normalisiertes Wort.
 * @returns `true`, wenn der Abstand innerhalb der Grenze des kürzeren Wortes liegt.
 */
const isTypo = (wordA: string, wordB: string): boolean => {
  const limit = maxTypos(Math.min(wordA.length, wordB.length));

  // Spart den teuren Abstand bei kurzen Wörtern
  if (limit === 0) return false;

  const distance = Math.min(
    editDistance(wordA, wordB),
    editDistance(stemWord(wordA), stemWord(wordB)),
  );

  return distance <= limit;
};

/**
 * Prüft, ob ein Wort Teil des anderen ist, wie «Rahm» in «Haferrahm».
 *
 * Nur am Anfang oder am Ende: In der Mitte wären es meist Zufälle wie «reis»
 * in «Preiselbeeren».
 *
 * @param wordA Erstes, bereits normalisiertes Wort.
 * @param wordB Zweites, bereits normalisiertes Wort.
 * @returns `true`, wenn das kürzere Wort lang genug ist und das längere damit
 * beginnt oder endet.
 */
const isCompound = (wordA: string, wordB: string): boolean => {
  const shorterWord = wordA.length < wordB.length ? wordA : wordB;
  const longerWord = shorterWord === wordA ? wordB : wordA;

  if (shorterWord.length < MINIMUM_COMPOUND_PART_LENGTH) return false;
  if (longerWord.length - shorterWord.length < MINIMUM_COMPOUND_REST_LENGTH) {
    return false;
  }

  return longerWord.endsWith(shorterWord) || longerWord.startsWith(shorterWord);
};

/**
 * Ergebnis für eine passende Regel, mit ihrem Gewicht.
 *
 * @param rule Regel, über die die Wörter zusammenpassen.
 * @returns Regel und Gewicht aus `WORD_WEIGHTS`.
 */
const matchBy = (rule: MatchRule): WordComparison => {
  return {rule, weight: WORD_WEIGHTS[rule]};
};

/**
 * Vergleicht zwei Wörter und nennt die Regel, über die sie zusammenpassen.
 *
 * Synonyme prüft diese Funktion nicht, dafür braucht es die Synonymliste.
 *
 * @param wordA Erstes, bereits normalisiertes Wort.
 * @param wordB Zweites, bereits normalisiertes Wort.
 * @returns Regel mit Gewicht, oder `null`, wenn die Wörter nicht zusammenpassen.
 * Die Reihenfolge der Wörter spielt keine Rolle.
 * @example
 * compareWords("chili", "chilis") // {rule: "stem", weight: 1}
 * compareWords("haferrahm", "rahm") // {rule: "compound", weight: 0.7}
 * compareWords("reis", "mais") // null
 */
export const compareWords = (
  wordA: string,
  wordB: string,
): WordComparison | null => {
  // Von der sichersten zur unsichersten Regel: Die erste, die passt, gilt.
  // Sonst bekäme ein gleiches Wort nur das Gewicht eines schwächeren Treffers.
  if (wordA === wordB) {
    return matchBy(MatchRule.EXACT);
  }
  if (stemWord(wordA) === stemWord(wordB)) {
    return matchBy(MatchRule.STEM);
  }
  if (isTypo(wordA, wordB)) {
    return matchBy(MatchRule.TYPO);
  }
  if (isCompound(wordA, wordB)) {
    return matchBy(MatchRule.COMPOUND);
  }

  return null;
};
