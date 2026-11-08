/**
 * Testbestand und Fälle für die Abgleich-Logik (Definition of Done).
 *
 * Teil A sind echte Eingaben, die Admins nachträglich bereinigen mussten,
 * samt ihrem Entscheid. Teil B sind Randfälle. Jede Testdatei der Logik nimmt
 * sich daraus, was sie braucht; Testnamen nennen den Fall, nicht eine Nummer.
 *
 * Liegt in `__mocks__`, weil Jest jede Datei in `__tests__` als Testsuite
 * ausführt.
 */
import {NameHintKind} from "../nameHint.types";
import {
  MatchCandidate,
  MatchRule,
  MatchingRules,
  NameProperty,
  NameWordKind,
} from "../productMatching.types";

/* =====================================================================
// Typen der Fälle
// ===================================================================== */

/** Ein Hinweis, der zu einem Fall erscheinen muss. Nur gesetzte Felder werden geprüft. */
export type ExpectedHint = {
  /** Art des Hinweises. */
  kind: NameHintKind;
  /** Regel, die den besten Vorschlag gefunden haben muss. */
  rule?: MatchRule;
  /** Auslösendes Wort in Originalschreibweise, wie es in der Eingabe steht. */
  word?: string;
  /** Erwartete Ähnlichkeit des besten Vorschlags. */
  score?: number;
  /** Ob der Hinweis das Anlegen verhindern muss. */
  blocking?: boolean;
};

/** Ein Fall: Eingabe im Dialog und erwartete Reaktion der Logik. */
export type MatchingCase = {
  /** Kurze Bezeichnung, wird zum Testnamen. */
  name: string;
  /** Eingegebener Name, genau so, wie er im Dialog stand. */
  input: string;
  /** Dialog, in dem angelegt wird. */
  dialog: "product" | "material";
  /** Eigener Bestand, ersetzt den Grundbestand (Regeln bleiben). */
  candidates?: MatchCandidate[];
  /** Hinweise, die erscheinen müssen (Reihenfolge egal). */
  expectedHints: ExpectedHint[];
  /** Ob ausser `expectedHints` kein weiterer Hinweis erscheinen darf. */
  exhaustive?: boolean;
  /** Name des besten Vorschlags, `null` wenn keiner erwartet wird. */
  bestSuggestion: string | null;
  /** Weitere Vorschläge, die nach dem besten in dieser Reihenfolge erscheinen müssen. */
  alsoSuggested?: string[];
  /** Was die Admins tatsächlich gemacht haben (nur echte Fälle). */
  adminDecision?: string;
};

/* =====================================================================
// Grundbestand
// ===================================================================== */

/** Baut einen aktiven Produkt-Kandidaten mit einer aus dem Namen abgeleiteten ID. */
const product = (name: string): MatchCandidate => ({
  uid: `product-${name}`,
  name,
  source: "product",
  usable: true,
});

/** Baut einen aktiven Material-Kandidaten mit einer aus dem Namen abgeleiteten ID. */
const material = (name: string): MatchCandidate => ({
  uid: `material-${name}`,
  name,
  source: "material",
  usable: true,
});

/** Produkte und Materialien, gegen die alle Fälle ohne eigenen Bestand laufen. */
export const BASE_CANDIDATES: MatchCandidate[] = [
  product("Früchte"),
  product("Wienerli"),
  product("Wienerli, vegan"),
  product("Frischkäse, vegan"),
  product("Zimt"),
  product("Zimtstangen"),
  product("Gemüse"),
  product("Buger Patties"),
  product("Rahm"),
  product("Rahm, vegan"),
  product("Würste"),
  product("Würste, vegan"),
  product("Flädli"),
  product("Fischstäbchen"),
  product("Fischstäbchen, vegan"),
  product("Schokoladencreme, laktosefrei"),
  product("Griechischer Joghurt, laktosefrei"),
  product("Zitronen"),
  product("Zwiebeln"),
  product("Karotten"),
  product("Tomaten"),
  product("Chilis"),
  product("Mais"),
  material("Alufolie"),
  material("Schwingbesen"),
  material("Grillzange"),
];

/** Wortliste und Synonyme, die für alle Fälle gelten. */
export const BASE_RULES: MatchingRules = {
  nameWords: [
    {word: "für", kind: NameWordKind.NOT_A_PRODUCT},
    // Kurze Wörter bekommen keine Tippfehler-Toleranz; häufige Varianten
    // stehen darum selbst in der Liste.
    {word: "fur", kind: NameWordKind.NOT_A_PRODUCT},
    {word: "Material", kind: NameWordKind.NOT_A_PRODUCT},
    {word: "Reste", kind: NameWordKind.NOT_A_PRODUCT},
    {word: "fertig", kind: NameWordKind.FILLER},
    {word: "z.B.", kind: NameWordKind.FILLER},
    {word: "gemahlen", kind: NameWordKind.DETAIL},
    {word: "gerieben", kind: NameWordKind.DETAIL},
    {word: "vegan", kind: NameWordKind.PROPERTY, property: NameProperty.VEGAN},
    // Pflanzliche Grundzutat: «Haferrahm» soll «Rahm, vegan» vor «Rahm» zeigen.
    {word: "Hafer", kind: NameWordKind.PROPERTY, property: NameProperty.VEGAN},
    {
      word: "plant based",
      kind: NameWordKind.PROPERTY,
      property: NameProperty.VEGAN,
    },
    {
      word: "laktosefrei",
      kind: NameWordKind.PROPERTY,
      property: NameProperty.LACTOSE_FREE,
    },
    {word: "Philadelphia", kind: NameWordKind.BRAND, genericTerm: "Frischkäse"},
    {word: "Vaya", kind: NameWordKind.BRAND},
  ],
  synonyms: [
    {nameA: "schoggi", nameB: "schokolade"},
    {nameA: "laktis", nameB: "laktosefrei"},
    {nameA: "Rüebli", nameB: "Karotten"},
  ],
};

/* =====================================================================
// Teil A: echte Fälle der Admins
// ===================================================================== */

export const ADMIN_CASES: MatchingCase[] = [
  {
    name: "Kein-Produkt-Wort mit Tippfehler: Früchte fur Fruchtsalat",
    input: "Früchte fur Fruchtsalat",
    dialog: "product",
    expectedHints: [
      {kind: NameHintKind.NOT_A_PRODUCT, word: "fur"},
      {kind: NameHintKind.CONTAINS_PRODUCT},
    ],
    bestSuggestion: "Früchte",
    adminDecision: "deaktiviert, kein Produkt",
  },
  {
    name: "Kein-Produkt-Wort: Sandwiches Material",
    input: "Sandwiches Material",
    dialog: "product",
    expectedHints: [{kind: NameHintKind.NOT_A_PRODUCT, word: "Material"}],
    bestSuggestion: null,
    adminDecision: "deaktiviert, kein Produkt",
  },
  {
    name: "Gebeugte Eigenschaft und Tippfehler: vegane Wiernerli",
    input: "vegane Wiernerli",
    dialog: "product",
    expectedHints: [
      {kind: NameHintKind.PROPERTY, word: "vegane"},
      {kind: NameHintKind.SIMILAR_PRODUCT, rule: MatchRule.TYPO},
    ],
    bestSuggestion: "Wienerli, vegan",
    adminDecision: "fusioniert mit Wienerli, vegan",
  },
  {
    name: "Marke mit allgemeinem Begriff: Philadelphia, vegan",
    input: "Philadelphia, vegan",
    dialog: "product",
    // Der Vorschlag kommt aus dem allgemeinen Begriff der Marke, nicht aus
    // der Ähnlichkeit: «Philadelphia» sieht «Frischkäse» nicht ähnlich.
    expectedHints: [
      {kind: NameHintKind.BRAND, word: "Philadelphia"},
      {kind: NameHintKind.PROPERTY, word: "vegan"},
    ],
    bestSuggestion: "Frischkäse, vegan",
    adminDecision: "fusioniert mit Frischkäse, vegan",
  },
  {
    name: "Zubereitung im Namen: Zimt, gemahlen",
    input: "Zimt, gemahlen",
    dialog: "product",
    expectedHints: [
      {kind: NameHintKind.DETAIL_WORD, word: "gemahlen"},
      {kind: NameHintKind.SIMILAR_PRODUCT},
    ],
    bestSuggestion: "Zimt",
    alsoSuggested: ["Zimtstangen"],
    adminDecision: "fusioniert mit Zimt",
  },
  {
    name: "Marke ohne allgemeinen Begriff: Vaya Bean Salt",
    input: "Vaya Bean Salt",
    dialog: "product",
    expectedHints: [{kind: NameHintKind.BRAND, word: "Vaya"}],
    bestSuggestion: null,
    adminDecision: "deaktiviert (Marke)",
  },
  {
    name: "Kein-Produkt-Wort als Teilwort: Restengemüse",
    input: "Restengemüse",
    dialog: "product",
    expectedHints: [
      {kind: NameHintKind.NOT_A_PRODUCT},
      {kind: NameHintKind.SIMILAR_PRODUCT, rule: MatchRule.COMPOUND},
    ],
    bestSuggestion: "Gemüse",
    adminDecision: "deaktiviert",
  },
  {
    name: "Kombination und Tippfehler im Bestand: Burger Patties (Fleisch und Vegi)",
    input: "Burger Patties (Fleisch und Vegi)",
    dialog: "product",
    expectedHints: [
      {kind: NameHintKind.COMBINATION},
      {kind: NameHintKind.CONTAINS_PRODUCT, rule: MatchRule.TYPO},
    ],
    bestSuggestion: "Buger Patties",
    adminDecision: "fusioniert mit Buger Patties",
  },
  {
    name: "Teilwort mit Varianten: Haferrahm",
    input: "Haferrahm",
    dialog: "product",
    expectedHints: [
      {kind: NameHintKind.PROPERTY, word: "Hafer"},
      {kind: NameHintKind.SIMILAR_PRODUCT, rule: MatchRule.COMPOUND},
    ],
    bestSuggestion: "Rahm, vegan",
    alsoSuggested: ["Rahm"],
    adminDecision: "Rahm, vegan",
  },
  {
    name: "Mehrwortige Eigenschaft und Wortstamm: Plant Based Würstchen",
    input: "Plant Based Würstchen",
    dialog: "product",
    expectedHints: [
      {kind: NameHintKind.PROPERTY, word: "Plant Based"},
      {kind: NameHintKind.SIMILAR_PRODUCT, rule: MatchRule.STEM},
    ],
    bestSuggestion: "Würste, vegan",
    adminDecision: "Würste, vegan",
  },
  {
    name: "Aufzählung in Klammern: Suppen Einlagen (Flädli, Buchstaben, Backerbesen)",
    input: "Suppen Einlagen (Flädli, Buchstaben, Backerbesen)",
    dialog: "product",
    expectedHints: [
      {kind: NameHintKind.COMBINATION},
      {kind: NameHintKind.CONTAINS_PRODUCT},
    ],
    bestSuggestion: "Flädli",
    adminDecision: "Flädli",
  },
  {
    name: "Gleiche Eigenschaft zuerst: vegane Fischstäbchen",
    input: "vegane Fischstäbchen",
    dialog: "product",
    expectedHints: [
      {kind: NameHintKind.PROPERTY, word: "vegane"},
      {kind: NameHintKind.SIMILAR_PRODUCT},
    ],
    bestSuggestion: "Fischstäbchen, vegan",
    alsoSuggested: ["Fischstäbchen"],
    adminDecision: "Fischstäbchen, vegan",
  },
  {
    name: "Synonym im Teilwort und Füllwort: Fertig schoggicreme für laktis",
    input: "Fertig schoggicreme für laktis",
    dialog: "product",
    expectedHints: [
      {kind: NameHintKind.PROPERTY, word: "laktis"},
      {kind: NameHintKind.SIMILAR_PRODUCT},
    ],
    bestSuggestion: "Schokoladencreme, laktosefrei",
    adminDecision: "Schokoladencreme, laktosefrei",
  },
  {
    name: "Andere Reihenfolge und Kleinschreibung: griechischer joghurt laktosefrei",
    input: "griechischer joghurt laktosefrei",
    dialog: "product",
    // Ein Eigenschafts-Hinweis ist erlaubt, aber nicht nötig: Es gibt nur
    // eine Variante, und sie hat die Eigenschaft schon.
    expectedHints: [{kind: NameHintKind.SIMILAR_PRODUCT, score: 1}],
    bestSuggestion: "Griechischer Joghurt, laktosefrei",
    adminDecision: "dasselbe Produkt",
  },
  {
    name: "Teilwort: Zitronenschale",
    input: "Zitronenschale",
    dialog: "product",
    expectedHints: [
      {kind: NameHintKind.SIMILAR_PRODUCT, rule: MatchRule.COMPOUND},
    ],
    bestSuggestion: "Zitronen",
    adminDecision: "fusioniert mit Zitronen",
  },
  {
    name: "Material ist ein Produkt, mit Aufzählung: Gemüse (z.B. Karotten, Paprika Zucchini)",
    input: "Gemüse (z.B. Karotten, Paprika Zucchini)",
    dialog: "material",
    expectedHints: [
      {kind: NameHintKind.COMBINATION},
      {kind: NameHintKind.OTHER_LIST},
    ],
    bestSuggestion: "Gemüse",
    adminDecision: "ins Produkt überführt, fusioniert, deaktiviert",
  },
  {
    name: "Material ist exakt ein Produkt: Zwiebeln",
    input: "Zwiebeln",
    dialog: "material",
    expectedHints: [{kind: NameHintKind.OTHER_LIST, rule: MatchRule.EXACT}],
    bestSuggestion: "Zwiebeln",
    adminDecision: "ins Produkt überführt, fusioniert",
  },
];

/* =====================================================================
// Teil B: Randfälle
// ===================================================================== */

export const EDGE_CASES: MatchingCase[] = [
  {
    name: "Synonym und Zubereitung: Rüebli, gerieben",
    input: "Rüebli, gerieben",
    dialog: "product",
    expectedHints: [
      {kind: NameHintKind.DETAIL_WORD, word: "gerieben"},
      {kind: NameHintKind.SIMILAR_PRODUCT, rule: MatchRule.SYNONYM},
    ],
    bestSuggestion: "Karotten",
  },
  {
    name: "Gleicher Name in Grossschrift mit doppeltem Leerzeichen: ZIMT",
    input: "ZIMT  ",
    dialog: "product",
    expectedHints: [{kind: NameHintKind.EXACT_PRODUCT, blocking: true}],
    bestSuggestion: "Zimt",
  },
  {
    name: "Gleicher Name wie ein deaktiviertes Produkt: Zimt",
    input: "Zimt",
    dialog: "product",
    // Ohne gepflegten Ersatz gibt es nichts vorzuschlagen.
    candidates: [{...product("Zimt"), usable: false}],
    expectedHints: [{kind: NameHintKind.DEACTIVATED_PRODUCT, blocking: true}],
    bestSuggestion: null,
  },
  {
    name: "Tippfehler: Tomatem",
    input: "Tomatem",
    dialog: "product",
    expectedHints: [{kind: NameHintKind.SIMILAR_PRODUCT, rule: MatchRule.TYPO}],
    bestSuggestion: "Tomaten",
  },
  {
    name: "Wortstamm ohne Kürzen auf «chi»: Chili",
    input: "Chili",
    dialog: "product",
    expectedHints: [{kind: NameHintKind.SIMILAR_PRODUCT, rule: MatchRule.STEM}],
    bestSuggestion: "Chilis",
  },
  {
    name: "Kein Tippfehler bei vier Buchstaben: Reis",
    input: "Reis",
    dialog: "product",
    expectedHints: [],
    exhaustive: true,
    bestSuggestion: null,
  },
  {
    name: "Leerer Bestand: Zimt",
    input: "Zimt",
    dialog: "product",
    candidates: [],
    expectedHints: [],
    exhaustive: true,
    bestSuggestion: null,
  },
];

/** Alle Fälle, echte zuerst. */
export const ALL_CASES: MatchingCase[] = [...ADMIN_CASES, ...EDGE_CASES];
