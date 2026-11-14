/**
 * Suche passender Wörter für den Abgleich.
 *
 * Kennt nur Wörter, keine Produkte: Welche Produkte zu einem Wort gehören,
 * weiss der Produkt-Index.
 */
import {
  compareWords,
  deletionVariants,
  maxTypos,
  MINIMUM_COMPOUND_PART_LENGTH,
  MINIMUM_COMPOUND_REST_LENGTH,
  stemWord,
} from "./compareWords";
import {WordComparison} from "./productMatching.types";

/** Ein Wort des Index, das zu einem gesuchten Wort passt. */
export type WordPartner = {
  /** Das passende Wort des Index, in Vergleichsform. */
  word: string;
  /** Regel und Gewicht, über die es passt. */
  comparison: WordComparison;
};

/**
 * Alle Schlüssel, unter denen ein Wort für gleich, Stamm und Tippfehler
 * nachgeschlagen wird.
 *
 * Zwei Wörter mit höchstens k Tippfehlern Abstand haben eine gemeinsame
 * Variante mit je höchstens k gelöschten Buchstaben. Die Stämme zählen mit,
 * weil `compareWords` auch deren Abstand nimmt («wuerstchen»/«wurst»). Die
 * Tiefe richtet sich nach dem Wort, nicht nach dem Stamm, wie die Grenze dort.
 *
 * @param word Wort in Vergleichsform.
 * @returns Wort, Stamm und ihre Löschvarianten, ohne Doppelte.
 * @example
 * typoVariants("burger") // Set {"burger", "urger", …, "burg", "urg", …}
 */
const typoVariants = (word: string): Set<string> => {
  const depth = maxTypos(word.length);

  const variants = deletionVariants(word, depth);
  const stem = stemWord(word);

  if (stem !== word) {
    deletionVariants(stem, depth).forEach((variant) => variants.add(variant));
  }

  return variants;
};

/**
 * Alle Anfänge und Enden eines Worts, die nach der Teilwort-Regel ein
 * eigenes Wort sein können.
 *
 * @param word Wort in Vergleichsform.
 * @returns Anfänge und Enden ab der Mindestlänge, mit genug Rest; leer bei
 * kurzen Wörtern.
 * @example
 * compoundParts("haferrahm") // ["hafe", "rahm", "hafer", "rrahm", "haferr", "errahm"]
 */
const compoundParts = (word: string): string[] => {
  const parts: string[] = [];

  for (
    let length = MINIMUM_COMPOUND_PART_LENGTH;
    length <= word.length - MINIMUM_COMPOUND_REST_LENGTH;
    length++
  ) {
    parts.push(word.slice(0, length), word.slice(word.length - length));
  }

  return parts;
};

/**
 * Legt ein Wort unter einem Schlüssel ab; die Menge entsteht bei Bedarf.
 *
 * @param map Nachschlage-Tabelle.
 * @param key Schlüssel, z.B. eine Variante.
 * @param word Wort des Index.
 */
const addTo = (
  map: Map<string, Set<string>>,
  key: string,
  word: string,
): void => {
  const words = map.get(key);
  if (words) {
    words.add(word);
  } else {
    map.set(key, new Set([word]));
  }
};

/**
 * Index über alle bekannten Wörter, einmal gebaut und für viele Anfragen
 * verwendet.
 *
 * Der Konstruktor legt Tabellen an, eine Anfrage schlägt dort nur wenige
 * Kandidaten nach und bestätigt sie mit `compareWords`. Die Tabellen finden
 * eher zu viel als zu wenig, darum findet der Index genau dieselben Wörter
 * wie ein Vergleich mit jedem Wort.
 *
 * @example
 * const index = new WordIndex(["zimt", "zimtstangen"]);
 * index.findPartners("zimt")
 * // [{word: "zimt", …exact}, {word: "zimtstangen", …compound}]
 */
export class WordIndex {
  private words: Set<string>;
  private wordsByVariant = new Map<string, Set<string>>();
  private wordsByPart = new Map<string, Set<string>>();
  /** Gemerkte Treffer pro gesuchtem Wort; der Index ändert sich nach dem Aufbau nicht. */
  private partnersByWord = new Map<string, WordPartner[]>();

  /**
   * @param words Wörter in Vergleichsform; doppelte werden einmal geführt.
   */
  constructor(words: Iterable<string>) {
    this.words = new Set(words);

    this.words.forEach((word) => {
      typoVariants(word).forEach((typoVariant) =>
        addTo(this.wordsByVariant, typoVariant, word),
      );
      compoundParts(word).forEach((compoundPart) =>
        addTo(this.wordsByPart, compoundPart, word),
      );
    });
  }

  /**
   * Sucht alle Wörter des Index, die zu einem Wort passen.
   *
   * Das Ergebnis wird gemerkt: Dasselbe Wort liefert beim nächsten Mal
   * dieselbe Liste. Sie darf darum nicht verändert werden (kein `push`,
   * kein `sort`).
   *
   * @param word Wort in Vergleichsform.
   * @returns Passende Wörter mit Regel, das Wort selbst eingeschlossen;
   * leer, wenn keins passt.
   */
  findPartners(word: string): WordPartner[] {
    const known = this.partnersByWord.get(word);
    if (known) return known;

    const partners: WordPartner[] = [];

    this.findCandidates(word).forEach((indexWord) => {
      const comparison = compareWords(word, indexWord);
      if (comparison) {
        partners.push({word: indexWord, comparison});
      }
    });

    this.partnersByWord.set(word, partners);

    return partners;
  }

  /**
   * Sammelt die Wörter des Index, die zum Wort passen könnten.
   *
   * @param word Wort in Vergleichsform.
   * @returns Kandidaten, jeder einmal; können zu viele sein, nie zu wenige.
   */
  private findCandidates(word: string): Set<string> {
    const candidates = new Set<string>();

    // gleich, Stamm und Tippfehler
    typoVariants(word).forEach((typoVariant) => {
      this.wordsByVariant
        .get(typoVariant)
        ?.forEach((indexWord) => candidates.add(indexWord));
    });

    // ein Wort des Index steckt im gesuchten Wort («rahm» in «haferrahm»)
    compoundParts(word).forEach((part) => {
      if (this.words.has(part)) {
        candidates.add(part);
      }
    });

    // das gesuchte Wort steckt in einem Wort des Index («zimt» in «zimtstangen»)
    this.wordsByPart
      .get(word)
      ?.forEach((indexWord) => candidates.add(indexWord));

    return candidates;
  }
}
