import {
  LoggedNameHint,
  NameHintKind,
  NameHintSuggestion,
} from "../Matching/nameHint.types";

/**
 * Mindestform eines angezeigten Eintrags. Bewusst schmal gehalten, damit
 * Produkte und Materialien gleichermassen passen.
 */
type Item = {
  /** ID des Produkts bzw. Materials. */
  uid: string;
  /** Name, wie er im Dialog angezeigt wurde. */
  name: string;
};

/**
 * Baut aus den im Dialog gezeigten Einträgen einen Hinweis für das
 * Anlegen-Protokoll. Übernommen werden nur ID und Name, damit keine
 * weiteren Stammdaten im Protokoll landen.
 *
 * Regel, Score und Wort bleiben leer: die bisherige Ähnlichkeitssuche
 * liefert diese Angaben nicht.
 *
 * @param kind Art des Hinweises.
 * @param items Gezeigte Einträge in Anzeigereihenfolge.
 * @param source Ob die Einträge Produkte oder Materialien sind.
 * @returns Hinweis in der Form, wie er im Protokoll gespeichert wird.
 * @example
 * toLoggedHint(NameHintKind.SIMILAR_PRODUCT, [{uid: "p1", name: "Tomaten"}], "product")
 * // {kind: "similar_product", rule: null, score: null, word: null,
 * //  suggestions: [{id: "p1", name: "Tomaten", source: "product"}]}
 */
export const toLoggedHint = (
  kind: NameHintKind,
  items: Item[],
  source: NameHintSuggestion["source"],
): LoggedNameHint => {
  return {
    kind,
    rule: null,
    score: null,
    word: null,
    suggestions: items.map((hintItem) => ({
      id: hintItem.uid,
      name: hintItem.name,
      source,
    })),
  };
};
