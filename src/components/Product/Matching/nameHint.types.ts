/**
 * Art eines Hinweises, den die Namensprüfung beim Anlegen eines Produkts
 * oder Materials zeigt.
 *
 * Die Werte landen unverändert in der jsonb-Spalte `item_creation_logs.hints`
 * und werden dort per SQL ausgewertet. Darum nie umbenennen, nur ergänzen.
 */
export enum NameHintKind {
  /** Der Name existiert bereits (nach Normalisierung); blockiert das Anlegen. */
  EXACT_PRODUCT = "exact_product",
  /** Ein deaktivierter Eintrag hat denselben Namen; blockiert das Anlegen. */
  DEACTIVATED_PRODUCT = "deactivated_product",
  /** Ein bestehender Name ist ähnlich (Wortstamm, Tippfehler, Synonym, Teilwort). */
  SIMILAR_PRODUCT = "similar_product",
  /** Der Name enthält einen bestehenden Namen vollständig, z.B. «Früchte für Fruchtsalat». */
  CONTAINS_PRODUCT = "contains_product",
  /** Der Name existiert in der anderen Liste (Material statt Produkt oder umgekehrt). */
  OTHER_LIST = "other_list",
  /** Der Name enthält ein Detail-Wort wie «gemahlen», das ins Rezept gehört, nicht ins Produkt. */
  DETAIL_WORD = "detail_word",
  /** Der Name enthält eine Eigenschaft wie «vegan» oder «laktosefrei». */
  PROPERTY = "property",
  /** Der Name fasst mehrere Produkte zusammen, z.B. eine Aufzählung in Klammern. */
  COMBINATION = "combination",
  /** Der Name enthält eine Marke statt des allgemeinen Begriffs. */
  BRAND = "brand",
  /** Der Name enthält ein Wort, das auf «kein Produkt» hinweist, z.B. «Material» oder «Reste». */
  NOT_A_PRODUCT = "not_a_product",
}

/**
 * Ein Vorschlag, der zu einem Hinweis angezeigt wurde.
 *
 * Name und Herkunft werden mitgespeichert, damit das Protokoll lesbar bleibt,
 * auch wenn der Eintrag später umbenannt oder zusammengeführt wird.
 */
export type NameHintSuggestion = {
  /** ID des vorgeschlagenen Produkts bzw. Materials. */
  id: string;
  /** Name zum Zeitpunkt des Vorschlags. */
  name: string;
  /** Liste, aus der der Vorschlag stammt. */
  source: "product" | "material";
};

/**
 * Ein angezeigter Hinweis, so wie er im Anlegen-Protokoll gespeichert wird.
 *
 * Felder ohne Wert sind `null` statt weggelassen, damit jeder gespeicherte
 * Hinweis dieselbe Form hat und sich per SQL einheitlich auswerten lässt.
 */
export type LoggedNameHint = {
  /** Art des Hinweises. */
  kind: NameHintKind;
  /** Regel, die gegriffen hat (z.B. «typo»), oder `null`, wenn keine Regel beteiligt war. */
  rule: string | null;
  /** Ähnlichkeit 0..1 des besten Vorschlags, oder `null` ohne Vergleich. */
  score: number | null;
  /** Wort im Namen, das den Hinweis ausgelöst hat, oder `null`. */
  word: string | null;
  /** Angezeigte Vorschläge, bester zuerst; leer, wenn es keine gab. */
  suggestions: NameHintSuggestion[];
};
