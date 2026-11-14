import {analyzeName} from "./analyzeName";
import {NameHint, NameHintKind} from "./nameHint.types";
import {NameVocabulary} from "./nameVocabulary";
import {ProductMatchIndex} from "./productMatchIndex.class";
import {
  FoundListWord,
  MatchCandidate,
  MatchRule,
  MatchSource,
  NameAnalysis,
  NameWordKind,
  ProductMatch,
} from "./productMatching.types";

/**
 * Art des Hinweises zu jeder Art der Wortliste; `null` heisst bewusst kein Hinweis.
 *
 * Als `Record` über alle Arten: Kommt eine neue Art dazu, meldet TypeScript
 * hier, dass ihr Hinweis noch fehlt. Füllwörter wie «fertig» sagen nichts
 * über das Produkt und bekommen keinen.
 */
const HINT_KIND_BY_WORD_KIND: Record<NameWordKind, NameHintKind | null> = {
  [NameWordKind.BRAND]: NameHintKind.BRAND,
  [NameWordKind.DETAIL]: NameHintKind.DETAIL_WORD,
  [NameWordKind.PROPERTY]: NameHintKind.PROPERTY,
  [NameWordKind.NOT_A_PRODUCT]: NameHintKind.NOT_A_PRODUCT,
  [NameWordKind.FILLER]: null,
};

/**
 * Rang jeder Art in der Anzeige; kleiner steht weiter oben.
 *
 * Blockierendes zuerst, dann Treffer, dann Wörter. «Enthält» und «ähnlich»
 * teilen sich einen Rang: Weil die Sortierung stabil ist, bleiben sie in der
 * Reihenfolge ihres besten Treffers, und Wörter gleicher Art in der
 * Reihenfolge des Namens.
 */
const HINT_RANK: Record<NameHintKind, number> = {
  [NameHintKind.EXACT_PRODUCT]: 0,
  [NameHintKind.DEACTIVATED_PRODUCT]: 0,
  [NameHintKind.OTHER_LIST]: 1,
  [NameHintKind.CONTAINS_PRODUCT]: 2,
  [NameHintKind.SIMILAR_PRODUCT]: 2,
  [NameHintKind.BRAND]: 3,
  [NameHintKind.PROPERTY]: 4,
  [NameHintKind.DETAIL_WORD]: 5,
  [NameHintKind.NOT_A_PRODUCT]: 6,
  [NameHintKind.COMBINATION]: 7,
};

/**
 * Alles, was die Namensprüfung neben dem Namen selbst braucht.
 *
 * Index und Vokabular werden einmal gebaut und für jede Eingabe
 * wiederverwendet; Liste und ausgeschlossener Eintrag kommen vom Dialog.
 */
export type NameCheckContext = {
  /** Index über alle Produkte und Materialien. */
  index: ProductMatchIndex;
  /** Vorbereitete Wortliste und Synonyme. */
  vocabulary: NameVocabulary;
  /** Liste, in der angelegt wird; nur dort blockiert ein gleicher Name. */
  target: MatchSource;
  /** Eintrag, der beim Umbenennen sich selbst nicht finden soll. */
  excludeUid?: string;
};

/** Höchstens so viele Vorschläge pro Hinweis, damit das Pop-up überblickbar bleibt. */
export const MAX_SUGGESTIONS = 5;

/**
 * Macht aus einem Eintrag mit gleichem Name einen Vorschlag.
 *
 * Gleicher Name heisst: jedes Wort gepaart, in beide Richtungen.
 *
 * @param candidate Eintrag mit gleichem normalisiertem Namen.
 * @returns Treffer mit Score 1 und Regel `exact`.
 */
const toExactMatch = (candidate: MatchCandidate): ProductMatch => ({
  candidate,
  score: 1,
  rule: MatchRule.EXACT,
  containsAll: true,
  coversQuery: true,
});

/**
 * Sucht Einträge mit gleichem Namen in der Liste des Dialogs.
 *
 * Deaktivierte bleiben drin, auch sie blockieren den Namen. Ein gleicher
 * Name in der anderen Liste blockiert nicht; er wird als Treffer gezeigt.
 *
 * @param name Eingegebener Name.
 * @param context Index, Liste des Dialogs und der eigene Eintrag beim Umbenennen.
 * @returns Einträge mit gleichem Namen, aktive und deaktivierte.
 */
const findSameName = (
  name: string,
  context: NameCheckContext,
): MatchCandidate[] => {
  const {index, target, excludeUid} = context;
  return index
    .findExact(name)
    .filter(
      (candidate) =>
        candidate.uid !== excludeUid && candidate.source === target,
    );
};

/**
 * Bildet den blockierenden Hinweis für einen gleichen Namen.
 *
 * Gibt es einen aktiven Eintrag, wird er vorgeschlagen, auch wenn daneben
 * ein deaktivierter gleich heisst. Ein deaktivierter allein blockiert ohne
 * Vorschlag, denn er lässt sich nicht auswählen.
 *
 * @param sameName Einträge mit gleichem Namen aus `findSameName`.
 * @returns Höchstens einen Hinweis; leer ohne gleichen Namen.
 */
const sameNameHints = (sameName: MatchCandidate[]): NameHint[] => {
  const usable = sameName.filter((candidate) => candidate.usable);

  if (usable.length > 0) {
    return [
      {
        kind: NameHintKind.EXACT_PRODUCT,
        rule: MatchRule.EXACT,
        score: 1,
        suggestions: usable.map(toExactMatch),
        blocking: true,
      },
    ];
  }

  if (sameName.length > 0) {
    return [
      {
        kind: NameHintKind.DEACTIVATED_PRODUCT,
        suggestions: [],
        blocking: true,
      },
    ];
  }
  return [];
};

/**
 * Bestimmt, unter welchem Hinweis ein Treffer erscheint.
 *
 * Die Liste geht vor: Ein Eintrag der anderen Liste ist immer `other_list`,
 * auch wenn er genau passt. «Enthält» heisst, der Eintrag steckt ganz im
 * Namen und der Name hat zusätzliche Wörter («Früchte für Fruchtsalat» →
 * «Früchte»); passt jedes Wort, ist es nur ähnlich («Haferrahm» → «Rahm»).
 *
 * @param match Treffer aus dem Index.
 * @param target Liste, in der angelegt wird.
 * @returns `other_list`, `contains_product` oder `similar_product`.
 */
const matchKindOf = (
  match: ProductMatch,
  target: MatchSource,
): NameHintKind => {
  if (match.candidate.source !== target) {
    return NameHintKind.OTHER_LIST;
  }
  if (match.containsAll && !match.coversQuery) {
    return NameHintKind.CONTAINS_PRODUCT;
  }

  return NameHintKind.SIMILAR_PRODUCT;
};

/**
 * Teilt die Treffer nach der Art ihres Hinweises auf.
 *
 * Die Map behält die Reihenfolge, in der eine Art zuerst vorkommt, und jede
 * Gruppe die Reihenfolge des Index: Der beste Treffer steht vorne.
 *
 * @param matches Treffer, nach Relevanz sortiert.
 * @param target Liste, in der angelegt wird.
 * @returns Treffer je Art; nur Arten mit mindestens einem Treffer.
 */
const groupByKind = (
  matches: ProductMatch[],
  target: MatchSource,
): Map<NameHintKind, ProductMatch[]> => {
  const groups = new Map<NameHintKind, ProductMatch[]>();

  matches.forEach((match) => {
    const kind = matchKindOf(match, target);
    const group = groups.get(kind);

    if (group) {
      group.push(match);
    } else {
      groups.set(kind, [match]);
    }
  });

  return groups;
};

/**
 * Bildet aus einer Gruppe von Treffern einen Hinweis.
 *
 * Regel und Score kommen vom besten Treffer; die Gruppe ist nie leer, weil
 * sie erst mit ihrem ersten Treffer entsteht.
 *
 * @param kind Art des Hinweises.
 * @param matches Treffer dieser Art, bester zuerst.
 * @returns Nicht blockierender Hinweis mit höchstens `MAX_SUGGESTIONS` Vorschlägen.
 */
const toMatchHint = (
  kind: NameHintKind,
  matches: ProductMatch[],
): NameHint => ({
  kind,
  suggestions: matches.slice(0, MAX_SUGGESTIONS),
  rule: matches[0].rule,
  score: matches[0].score,
  blocking: false,
});

/**
 * Bildet die Hinweise auf ähnliche Einträge und auf die andere Liste.
 *
 * Ohne Obergrenze gesucht, damit viele ähnliche Treffer keinen Treffer der
 * anderen Liste verdrängen; begrenzt wird pro Hinweis. Einträge mit gleichem
 * Namen fehlen hier, sie zeigt schon der blockierende Hinweis.
 *
 * @param analysis Zerlegter Name aus `analyzeName`.
 * @param sameName Einträge mit gleichem Namen aus `findSameName`.
 * @param context Index, Liste des Dialogs und eigener Eintrag.
 * @returns Höchstens einen Hinweis pro Art, in der Reihenfolge ihres besten Treffers.
 */
const matchHints = (
  analysis: NameAnalysis,
  sameName: MatchCandidate[],
  context: NameCheckContext,
): NameHint[] => {
  const {index, target, excludeUid} = context;
  const sameNameUids = new Set(sameName.map((candidate) => candidate.uid));

  const matches = index
    .findMatches(analysis, {excludeUid})
    .filter((match) => !sameNameUids.has(match.candidate.uid));

  return [...groupByKind(matches, target).entries()].map(([kind, group]) =>
    toMatchHint(kind, group),
  );
};

/**
 * Sucht Vorschläge für eine Marke über ihren allgemeinen Begriff.
 *
 * Die Marke selbst ist kein Kernwort und findet nichts. Ersetzt wird sie im
 * ganzen Namen, nicht allein gesucht: So bleiben Eigenschaften erhalten und
 * die passende Variante kommt zuerst («Philadelphia, vegan» →
 * «Frischkäse, vegan» vor «Frischkäse»).
 *
 * @param name Eingegebener Name, wie getippt.
 * @param listWord Gefundene Marke; ihr Wort steht so im Namen.
 * @param context Index, Vokabular und eigener Eintrag.
 * @returns Höchstens `MAX_SUGGESTIONS` Treffer; leer ohne allgemeinen Begriff.
 */
const brandSuggestions = (
  name: string,
  listWord: FoundListWord,
  context: NameCheckContext,
): ProductMatch[] => {
  if (!listWord.entry.genericTerm) {
    return [];
  }
  const genericName = name.replace(listWord.word, listWord.entry.genericTerm);
  const genericAnalysis = analyzeName(genericName, context.vocabulary);

  return context.index
    .findMatches(genericAnalysis, {excludeUid: context.excludeUid})
    .slice(0, MAX_SUGGESTIONS);
};

/**
 * Bildet je gefundenem Wort der Wortliste einen Hinweis.
 *
 * Das Wort steht so im Hinweis, wie es die Analyse geliefert hat: wie
 * getippt («vegane»), bei Teilwörtern wie im Eintrag («Reste»).
 *
 * Nur die Marke bekommt Vorschläge, nämlich Einträge zu ihrem allgemeinen
 * Begriff.
 *
 * @param name Eingegebener Name, wie getippt; für den Marken-Vorschlag.
 * @param analysis Zerlegter Name aus `analyzeName`.
 * @param context Index, Vokabular und eigener Eintrag; für den Marken-Vorschlag.
 * @returns Hinweise in der Reihenfolge der Wörter im Namen, ohne Füllwörter.
 */
const wordHints = (
  name: string,
  analysis: NameAnalysis,
  context: NameCheckContext,
): NameHint[] =>
  analysis.listWords.flatMap((listWord): NameHint[] => {
    const kind = HINT_KIND_BY_WORD_KIND[listWord.entry.kind];
    if (kind === null) {
      return [];
    }
    return [
      {
        kind,
        word: listWord.word,
        suggestions:
          kind === NameHintKind.BRAND
            ? brandSuggestions(name, listWord, context)
            : [],
        blocking: false,
      },
    ];
  });

/**
 * Bildet den Hinweis, dass der Name mehrere Produkte zusammenfasst.
 *
 * Ohne Wort, denn eine Kombination erkennt die Analyse am Aufbau des
 * Namens (Klammer, «und», «/»), nicht an einem einzelnen Wort.
 *
 * @param analysis Zerlegter Name aus `analyzeName`.
 * @returns Einen Hinweis bei einer Kombination, sonst leer.
 */
const combinationHints = (analysis: NameAnalysis): NameHint[] =>
  analysis.isCombination
    ? [{kind: NameHintKind.COMBINATION, suggestions: [], blocking: false}]
    : [];

/**
 * Vergleicht zwei Hinweise nach dem Rang ihrer Art, für `sort`.
 *
 * @param hintA Erster Hinweis.
 * @param hintB Zweiter Hinweis.
 * @returns Negativ, wenn `hintA` vor `hintB` angezeigt wird; 0 bei gleichem Rang.
 */
const byDisplayOrder = (hintA: NameHint, hintB: NameHint): number =>
  HINT_RANK[hintA.kind] - HINT_RANK[hintB.kind];

/**
 * Liefert die Hinweise, die das Anlegen-Pop-up zu einem Namen zeigt.
 *
 * Reine Daten ohne Text: Die Oberfläche übersetzt die Art in einen Satz,
 * das Protokoll speichert die Hinweise so, wie sie angezeigt wurden.
 * Gesammelt werden gleicher Name, Treffer, Wörter der Wortliste und
 * Kombination; die Reihenfolge legt allein `HINT_RANK` fest, blockierende
 * Hinweise stehen also immer vorne.
 *
 * @param name Eingegebener Name, wie getippt.
 * @param context Index, Vokabular, Liste des Dialogs und eigener Eintrag.
 * @returns Hinweise in der Reihenfolge, in der sie angezeigt werden.
 * @example
 * buildNameHints("ZIMT", {index, vocabulary, target: "product"})
 * // [{kind: "exact_product", rule: "exact", score: 1, suggestions: [Zimt], blocking: true}]
 */
export const buildNameHints = (
  name: string,
  context: NameCheckContext,
): NameHint[] => {
  const sameName = findSameName(name, context);
  const analysis = analyzeName(name, context.vocabulary);

  const hints = [
    ...sameNameHints(sameName),
    ...matchHints(analysis, sameName, context),
    ...wordHints(name, analysis, context),
    ...combinationHints(analysis),
  ];

  return [...hints].sort(byDisplayOrder);
};
