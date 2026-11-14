/**
 * Gemeinsame Typen der Abgleich-Logik für Produkt- und Materialnamen.
 *
 * Die Logik ist rein (keine DB, keine UI): Wortlisten, Synonyme und Bestand
 * kommen als Parameter herein. So kann dieselbe Logik mit gespeicherten und
 * mit noch nicht gespeicherten Regeln laufen (Regel-Tester).
 *
 * Alle Enums haben String-Werte, die den späteren PostgreSQL-ENUM-Labels
 * entsprechen. Darum nie umbenennen, nur ergänzen.
 */

/**
 * Version der Abgleich-Regeln, wird im Anlegen-Protokoll mitgeschrieben.
 *
 * Bei jeder Regeländerung erhöhen, damit sich alte und neue Regeln in der
 * Auswertung vergleichen lassen. 0 ist die Prüfung vor dieser Logik.
 */
export const MATCHING_RULES_VERSION = 1;

/** Art eines Eintrags der Wortliste. Alle Arten sind ohne Code pflegbar. */
export enum NameWordKind {
  /** Zubereitung oder Form, gehört ins Rezept statt ins Produkt, z.B. «gemahlen». */
  DETAIL = "detail",
  /** Eigenschaft, die ein eigenes Produkt rechtfertigt, z.B. «vegan». */
  PROPERTY = "property",
  /** Marke statt allgemeiner Begriff, z.B. «Philadelphia». */
  BRAND = "brand",
  /** Wort, das auf «kein Produkt» hinweist, z.B. «Material» oder «Reste». */
  NOT_A_PRODUCT = "not_a_product",
  /** Wort ohne Bedeutung für den Abgleich, z.B. «fertig» oder «z.B.». */
  FILLER = "filler",
}

/** Eigenschaft, die ein Eintrag der Art `property` ausdrückt. */
export enum NameProperty {
  VEGAN = "vegan",
  VEGETARIAN = "vegetarian",
  LACTOSE_FREE = "lactose_free",
  GLUTEN_FREE = "gluten_free",
}

/** Wie zwei Wörter zusammenpassen; die stärkste Regel steht zuerst. */
export enum MatchRule {
  /** Gleiche Wörter nach der Normalisierung. */
  EXACT = "exact",
  /** Gleicher Wortstamm, z.B. «Chili» und «Chilis». */
  STEM = "stem",
  /** Über die Synonymliste, z.B. «Rüebli» und «Karotten». */
  SYNONYM = "synonym",
  /** Kleiner Tippfehler, z.B. «Tomatem» und «Tomaten». */
  TYPO = "typo",
  /** Ein Wort ist Teil eines zusammengesetzten Worts, z.B. «Zitronenschale» und «Zitronen». */
  COMPOUND = "compound",
}

/** Ergebnis, wenn zwei einzelne Wörter zusammenpassen. */
export type WordComparison = {
  /** Regel, über die die Wörter zusammenpassen. */
  rule: MatchRule;
  /** Gewicht der Regel zwischen 0 und 1, siehe `WORD_WEIGHTS`. */
  weight: number;
};

/** Liste, aus der ein Eintrag stammt. */
export type MatchSource = "product" | "material";

/** Ein Eintrag der Wortliste. */
export type NameWord = {
  /** Wort in Originalschreibweise, darf aus mehreren Wörtern bestehen («plant based»). */
  word: string;
  /** Art des Eintrags. */
  kind: NameWordKind;
  /** Ausgedrückte Eigenschaft, nur bei der Art `property`. */
  property?: NameProperty;
  /** Allgemeiner Begriff zur Marke, nur bei der Art `brand`, z.B. «Frischkäse». */
  genericTerm?: string;
};

/**
 * Zwei Namen, die dasselbe meinen.
 *
 * Wie `ProductSynonymDomain`, aber eigenständig: Domain-Typen importieren
 * keine Repository-Dateien.
 */
export type SynonymPair = {
  /** Erster Name, z.B. «Rüebli». */
  nameA: string;
  /** Zweiter Name, z.B. «Karotten». */
  nameB: string;
};

/** Ein bestehendes Produkt oder Material, so wie es in den Index kommt. */
export type MatchCandidate = {
  /** ID des Produkts bzw. Materials. */
  uid: string;
  /** Name in Originalschreibweise. */
  name: string;
  /** Name in der Einzahl, nur bei Produkten und nur, wenn gepflegt. */
  nameSingular?: string;
  /** Liste, aus der der Eintrag stammt. */
  source: MatchSource;
  /** `false` bei deaktivierten Einträgen; sie blockieren den gleichen Namen. */
  usable: boolean;
};

/** Alles, was die Logik neben dem Bestand braucht; austauschbar für den Regel-Tester. */
export type MatchingRules = {
  /** Wortliste mit allen Arten. */
  nameWords: NameWord[];
  /** Synonympaare. */
  synonyms: SynonymPair[];
};

/** Zerlegung eines eingegebenen Namens in seine Bestandteile. */
export type NameAnalysis = {
  /** Normalisierter Name (klein, Umlaute ersetzt, ohne Satzzeichen). */
  normalized: string;
  /** Wörter, die das Produkt ausmachen, normalisiert; Stamm und Synonym bildet erst der Vergleich. */
  coreWords: string[];
  /** Gefundene Wörter der Wortliste, in der Reihenfolge des Namens. */
  listWords: FoundListWord[];
  /** Ob der Name mehrere Produkte zusammenfasst. */
  isCombination: boolean;
  /** Bei einer Kombination die einzelnen Teile, sonst leer. */
  combinationParts: string[];
  /** Name in Originalschreibweise ohne Detail-Wörter, für «Name ohne Detail übernehmen». */
  nameWithoutDetails: string;
};

/** Ein Wort des Namens, das in der Wortliste steht. */
export type FoundListWord = {
  /** Wort, wie es im Namen steht («vegane»); bei Teilwörtern wie im Eintrag («Hafer»). */
  word: string;
  /** Der passende Eintrag der Wortliste. */
  entry: NameWord;
  /** Ob nur ein Teil des Wortes passt («Hafer» in «Haferrahm»); das Wort bleibt dann Kernwort. */
  isPart: boolean;
};

/** Ein bestehender Eintrag, der zu einem Namen passt. */
export type ProductMatch = {
  /** Der passende Eintrag. */
  candidate: MatchCandidate;
  /** Ähnlichkeit 0..1 über die Kernwörter (Dice-Koeffizient). */
  score: number;
  /** Schwächste Regel der gepaarten Wörter: erklärt, warum die Namen nicht gleich sind. */
  rule: MatchRule;
  /** Ob alle Kernwörter des Eintrags im Namen vorkommen. */
  containsAll: boolean;
  /** Ob alle Kernwörter des Namens im Eintrag vorkommen; sonst hat der Name zusätzliche Wörter. */
  coversQuery: boolean;
};
