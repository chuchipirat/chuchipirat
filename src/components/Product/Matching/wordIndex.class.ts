/**
 * Suche passender Wörter für den Abgleich.
 *
 * Kennt nur Wörter, keine Produkte: Welche Produkte zu einem Wort gehören,
 * weiss der Produkt-Index.
 */
import {compareWords} from "./compareWords";
import {WordComparison} from "./productMatching.types";

/** Ein Wort des Index, das zu einem gesuchten Wort passt. */
export type WordPartner = {
  /** Das passende Wort des Index, in Vergleichsform. */
  word: string;
  /** Regel und Gewicht, über die es passt. */
  comparison: WordComparison;
};

/**
 * Index über alle bekannten Wörter, einmal gebaut und für viele Anfragen
 * verwendet.
 *
 * Geht für jede Anfrage alle Wörter durch. Das ist die gründliche Fassung;
 * eine schnelle muss genau dieselben Wörter finden.
 *
 * @example
 * const index = new WordIndex(["zimt", "zimtstangen"]);
 * index.findPartners("zimt")
 * // [{word: "zimt", …exact}, {word: "zimtstangen", …compound}]
 */
export class WordIndex {
  private words: Set<string>;

  /**
   * @param words Wörter in Vergleichsform; doppelte werden einmal geführt.
   */
  constructor(words: Iterable<string>) {
    this.words = new Set(words);
  }

  /**
   * Sucht alle Wörter des Index, die zu einem Wort passen.
   *
   * @param word Wort in Vergleichsform.
   * @returns Passende Wörter mit Regel, das Wort selbst eingeschlossen;
   * leer, wenn keins passt.
   */
  findPartners(word: string): WordPartner[] {
    const partners: WordPartner[] = [];

    this.words.forEach((indexWord) => {
      const comparison = compareWords(word, indexWord);
      if (comparison) {
        partners.push({word: indexWord, comparison});
      }
    });

    return partners;
  }
}
