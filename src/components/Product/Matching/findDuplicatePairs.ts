import {analyzeName} from "./analyzeName";
import {NameVocabulary} from "./nameVocabulary";
import {ProductMatchIndex, propertyKeyOf} from "./productMatchIndex.class";
import {
  MatchCandidate,
  MatchRule,
  NameAnalysis,
  ProductMatch,
} from "./productMatching.types";

/**
 * Ein Paar, das jemand als «kein Duplikat» bestätigt hat.
 *
 * Wie die Tabelle `product_duplicate_dismissals`; die Reihenfolge der IDs
 * spielt für die Suche keine Rolle.
 */
export type DismissedPair = {
  productAId: string;
  productBId: string;
};

/**
 * Zwei aktive Produkte, die einander so ähnlich sind, dass sie vielleicht
 * dasselbe meinen.
 *
 * Produkt A hat die kleinere ID, wie in `product_duplicate_dismissals`.
 */
export type DuplicatePair = {
  productA: MatchCandidate;
  productB: MatchCandidate;
  score: number;
  rule: MatchRule;
};

/** Ein Produkt mit seinem zerlegten Namen, damit jeder Name nur einmal zerlegt wird. */
type AnalyzedProduct = {
  product: MatchCandidate;
  analysis: NameAnalysis;
};

/**
 * Ob ein Eintrag an der Duplikat-Suche teilnimmt.
 *
 * Materialien gehören in eine eigene Liste, deaktivierte Produkte schlägt
 * niemand mehr vor.
 *
 * @param candidate Eintrag aus dem Bestand oder aus einem Treffer.
 * @returns `true` für aktive Produkte.
 */
const isActiveProduct = (candidate: MatchCandidate): boolean =>
  candidate.source === "product" && candidate.usable;

/**
 * Bildet einen Schlüssel für ein Paar, der in beide Richtungen gleich ist.
 *
 * Kleinere ID zuerst, getrennt durch `|`, damit «A findet B» und «B findet A»
 * und ein bestätigtes Paar in beliebiger Reihenfolge zusammenfallen.
 *
 * @param uidA ID des einen Produkts.
 * @param uidB ID des anderen Produkts.
 * @returns Schlüssel, z.B. `"product-Zimt|product-Zimtstangen"`.
 */
const pairKey = (uidA: string, uidB: string): string =>
  uidA < uidB ? `${uidA}|${uidB}` : `${uidB}|${uidA}`;

/**
 * Macht aus einem angefragten Produkt und seinem Treffer ein Paar.
 *
 * @param product Produkt, dessen Name angefragt wurde.
 * @param match Treffer aus dem Index.
 * @returns Paar mit der kleineren ID als Produkt A, Score und Regel vom Treffer.
 */
const toPair = (
  product: MatchCandidate,
  match: ProductMatch,
): DuplicatePair => {
  const [productA, productB] =
    product.uid < match.candidate.uid
      ? [product, match.candidate]
      : [match.candidate, product];

  return {
    productA,
    productB,
    score: match.score,
    rule: match.rule,
  };
};

/**
 * Nimmt ein Paar auf, ausser es ist schon mit gleichem oder höherem Score da.
 *
 * Die beiden Richtungen können verschieden gut passen, z.B. wenn nur eine
 * Seite über ihren Namen in der Einzahl trifft; es zählt die bessere.
 *
 * @param pairs Bisher gefundene Paare nach `pairKey`; wird verändert.
 * @param pair Neu gefundenes Paar.
 */
const addPair = (
  pairs: Map<string, DuplicatePair>,
  pair: DuplicatePair,
): void => {
  const key = pairKey(pair.productA.uid, pair.productB.uid);
  const known = pairs.get(key);

  if (!known || pair.score > known.score) {
    pairs.set(key, pair);
  }
};

/**
 * Zerlegt die Namen der Produkte einmal vorab.
 *
 * @param products Produkte, die an der Suche teilnehmen.
 * @param vocabulary Dasselbe Vokabular, mit dem der Index gebaut wurde.
 * @returns Jedes Produkt mit seiner Analyse, in derselben Reihenfolge.
 */
const analyzeProducts = (
  products: MatchCandidate[],
  vocabulary: NameVocabulary,
): AnalyzedProduct[] =>
  products.map((product) => ({
    product,
    analysis: analyzeName(product.name, vocabulary),
  }));

/**
 * Fragt jedes Produkt wie beim Anlegen an und sammelt die Treffer als Paare.
 *
 * Ein Paar entsteht, sobald eine Richtung trifft, denn «enthält» gilt nur in
 * eine Richtung. Nur gleiche Eigenschaften zählen: Eine Eigenschaft
 * rechtfertigt ein eigenes Produkt («Rahm» und «Rahm, vegan»).
 *
 * @param analyzedProducts Aktive Produkte mit ihrer Analyse.
 * @param index Index über den ganzen Bestand.
 * @returns Jedes Paar einmal, mit dem besseren Score beider Richtungen.
 */
const collectPairs = (
  analyzedProducts: AnalyzedProduct[],
  index: ProductMatchIndex,
): DuplicatePair[] => {
  const pairs = new Map<string, DuplicatePair>();

  const propertyKeys = new Map(
    analyzedProducts.map(({product, analysis}) => [
      product.uid,
      propertyKeyOf(analysis),
    ]),
  );

  analyzedProducts.forEach(({product, analysis}) => {
    const productKey = propertyKeyOf(analysis);
    index
      .findMatches(analysis, {excludeUid: product.uid})
      .filter((match) => isActiveProduct(match.candidate))
      .filter((match) => propertyKeys.get(match.candidate.uid) === productKey)
      .forEach((match) => addPair(pairs, toPair(product, match)));
  });

  return [...pairs.values()];
};

/**
 * Lässt die Paare weg, die schon als «kein Duplikat» bestätigt sind.
 *
 * Verglichen wird das ganze Paar, nicht einzelne Produkte: Ein bestätigtes
 * Paar «Zimt ↔ Tomaten» blendet «Zimt ↔ Zimtstangen» nicht aus.
 *
 * @param pairs Gefundene Paare.
 * @param dismissals Bestätigte Nicht-Duplikate, IDs in beliebiger Reihenfolge.
 * @returns Die übrigen Paare in unveränderter Reihenfolge.
 */
const removeDismissed = (
  pairs: DuplicatePair[],
  dismissals: DismissedPair[],
): DuplicatePair[] => {
  const dismissedKeys = new Set(
    dismissals.map((dismissal) =>
      pairKey(dismissal.productAId, dismissal.productBId),
    ),
  );

  return pairs.filter(
    (pair) => !dismissedKeys.has(pairKey(pair.productA.uid, pair.productB.uid)),
  );
};

/**
 * Vergleicht zwei Paare für die Anzeige auf der QA-Seite, für `sort`.
 *
 * Höchster Score zuerst; bei gleichem Score alphabetisch nach Produkt A,
 * dann nach Produkt B, damit die Liste bei jeder Suche gleich aussieht.
 *
 * @param pairA Erstes Paar.
 * @param pairB Zweites Paar.
 * @returns Negativ, wenn `pairA` vor `pairB` steht.
 */
const byRelevance = (pairA: DuplicatePair, pairB: DuplicatePair): number =>
  pairB.score - pairA.score ||
  pairA.productA.name.localeCompare(pairB.productA.name, "de") ||
  pairA.productB.name.localeCompare(pairB.productB.name, "de");

/**
 * Sucht mögliche Duplikate im ganzen Produkt-Bestand.
 *
 * Jedes aktive Produkt wird wie beim Anlegen geprüft, darum gelten dieselben
 * Treffer wie in der Prüfung, ausser zwischen Produkten mit verschiedenen
 * Eigenschaften. Bestätigte Nicht-Duplikate fallen weg.
 *
 * @param products Bestand; Materialien und deaktivierte Produkte werden übersprungen.
 * @param index Index über denselben Bestand.
 * @param vocabulary Dasselbe Vokabular, mit dem der Index gebaut wurde.
 * @param dismissals Bestätigte Nicht-Duplikate.
 * @returns Jedes Paar einmal, bester Score zuerst.
 * @example
 * findDuplicatePairs(candidates, index, vocabulary, [])
 * // [{productA: Tomatem, productB: Tomaten, score: 0.8, rule: "typo"}, …]
 */
export const findDuplicatePairs = (
  products: MatchCandidate[],
  index: ProductMatchIndex,
  vocabulary: NameVocabulary,
  dismissals: DismissedPair[],
): DuplicatePair[] => {
  const analyzedProducts = analyzeProducts(
    products.filter(isActiveProduct),
    vocabulary,
  );
  const pairs = collectPairs(analyzedProducts, index);

  return [...removeDismissed(pairs, dismissals)].sort(byRelevance);
};
