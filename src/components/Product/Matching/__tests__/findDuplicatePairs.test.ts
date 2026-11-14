/**
 * Unit-Tests für die Duplikat-Suche über den Bestand.
 *
 * Jedes aktive Produkt wird einmal wie beim Anlegen geprüft; die Treffer
 * werden zu Paaren zusammengefasst. Es gelten dieselben Treffer wie bei der
 * Prüfung beim Anlegen, ausser zwischen Produkten mit verschiedenen
 * Eigenschaften: Eine Eigenschaft rechtfertigt ein eigenes Produkt.
 * Bestätigte Nicht-Duplikate fallen weg.
 */
import {analyzeName} from "../analyzeName";
import {
  DismissedPair,
  DuplicatePair,
  findDuplicatePairs,
} from "../findDuplicatePairs";
import {buildVocabulary} from "../nameVocabulary";
import {ProductMatchIndex, propertyKeyOf} from "../productMatchIndex.class";
import {
  BASE_CANDIDATES,
  BASE_RULES,
} from "../__mocks__/productMatchingCases.mock";
import {MatchCandidate, MatchRule} from "../productMatching.types";

const vocabulary = buildVocabulary(BASE_RULES);

/** Aktives Produkt mit einer aus dem Namen abgeleiteten ID. */
const product = (name: string): MatchCandidate => ({
  uid: `product-${name}`,
  name,
  source: "product",
  usable: true,
});

/** Paare über einem Bestand, wie die QA-Seite sie sucht. */
const pairsFor = (
  candidates: MatchCandidate[],
  dismissals: DismissedPair[] = [],
): DuplicatePair[] =>
  findDuplicatePairs(
    candidates,
    new ProductMatchIndex(candidates, vocabulary),
    vocabulary,
    dismissals,
  );

/** Lesbare Form eines Paars: «Name A ↔ Name B». */
const pairName = (pair: DuplicatePair): string =>
  `${pair.productA.name} ↔ ${pair.productB.name}`;

const pairNamesFor = (
  candidates: MatchCandidate[],
  dismissals: DismissedPair[] = [],
): string[] => pairsFor(candidates, dismissals).map(pairName);

/* =====================================================================
// Paare
// ===================================================================== */
describe("findDuplicatePairs: Paare", () => {
  test("jedes Paar einmal, die kleinere ID als Produkt A", () => {
    const pairs = pairsFor([product("Zimtstangen"), product("Zimt")]);

    expect(pairs).toEqual([
      {
        productA: product("Zimt"),
        productB: product("Zimtstangen"),
        score: expect.any(Number),
        rule: MatchRule.COMPOUND,
      },
    ]);
  });

  test("eine Richtung reicht: ein Name, der ein Produkt ganz enthält", () => {
    // «Flädli» findet die Aufzählung nicht (Score 0.33), umgekehrt schon
    expect(
      pairNamesFor([
        product("Flädli"),
        product("Suppen Einlagen (Flädli, Buchstaben, Backerbesen)"),
      ]),
    ).toEqual(["Flädli ↔ Suppen Einlagen (Flädli, Buchstaben, Backerbesen)"]);
  });

  test("treffen beide Richtungen verschieden, zählt der höhere Score", () => {
    // «Joghurt» findet die Einzahl des Joghurts mit 1, umgekehrt nur 0.67
    const greekYogurt: MatchCandidate = {
      ...product("Griechischer Joghurt"),
      nameSingular: "Joghurt",
    };
    const [pair] = pairsFor([greekYogurt, product("Joghurt")]);

    expect(pair.score).toBe(1);
    expect(pair.rule).toBe(MatchRule.EXACT);
  });

  test("Materialien kommen in keinem Paar vor", () => {
    const material: MatchCandidate = {
      ...product("Grillzange"),
      uid: "material-Grillzange",
      source: "material",
    };

    expect(pairNamesFor([product("Grillzangen"), material])).toEqual([]);
  });

  test("deaktivierte Produkte kommen in keinem Paar vor", () => {
    const deactivated: MatchCandidate = {
      ...product("Zimt"),
      usable: false,
    };

    expect(pairNamesFor([deactivated, product("Zimtstangen")])).toEqual([]);
  });

  test("verschiedene Eigenschaften ergeben kein Paar", () => {
    // Beim Anlegen wird «Rahm, vegan» zu «Rahm» vorgeschlagen, als Duplikat nicht
    expect(pairNamesFor([product("Rahm"), product("Rahm, vegan")])).toEqual([]);
  });

  test("gleiche Eigenschaft über verschiedene Wörter ergibt ein Paar", () => {
    // «Hafer» und «vegan» stehen beide für vegan
    expect(
      pairNamesFor([product("Haferrahm"), product("Rahm, vegan")]),
    ).toEqual(["Haferrahm ↔ Rahm, vegan"]);
  });

  test("ohne Produkte keine Paare", () => {
    expect(pairsFor([])).toEqual([]);
  });

  test("gleiche Treffer wie die Prüfung beim Anlegen, in beide Richtungen, bei gleichen Eigenschaften", () => {
    const index = new ProductMatchIndex(BASE_CANDIDATES, vocabulary);
    const activeProducts = BASE_CANDIDATES.filter(
      (candidate) => candidate.usable && candidate.source === "product",
    );
    const propertiesOf = (candidate: MatchCandidate) =>
      propertyKeyOf(analyzeName(candidate.name, vocabulary));
    const expected = new Set(
      activeProducts.flatMap((candidate) =>
        index
          .findMatches(analyzeName(candidate.name, vocabulary), {
            excludeUid: candidate.uid,
          })
          .filter(
            (match) =>
              match.candidate.source === "product" &&
              propertiesOf(match.candidate) === propertiesOf(candidate),
          )
          .map((match) =>
            [candidate.uid, match.candidate.uid].sort().join(" ↔ "),
          ),
      ),
    );

    const found = findDuplicatePairs(
      BASE_CANDIDATES,
      index,
      vocabulary,
      [],
    ).map((pair) => `${pair.productA.uid} ↔ ${pair.productB.uid}`);

    expect(expected.size).toBeGreaterThan(0);
    expect([...found].sort()).toEqual([...expected].sort());
  });
});

/* =====================================================================
// Bestätigte Nicht-Duplikate
// ===================================================================== */
describe("findDuplicatePairs: bestätigte Nicht-Duplikate", () => {
  const candidates = [
    product("Zimt"),
    product("Zimtstangen"),
    product("Tomaten"),
    product("Tomatem"),
  ];

  test("ein bestätigtes Paar fällt weg, die übrigen bleiben", () => {
    expect(
      pairNamesFor(candidates, [
        {productAId: "product-Zimt", productBId: "product-Zimtstangen"},
      ]),
    ).toEqual(["Tomatem ↔ Tomaten"]);
  });

  test("die Reihenfolge der IDs im bestätigten Paar spielt keine Rolle", () => {
    expect(
      pairNamesFor(candidates, [
        {productAId: "product-Zimtstangen", productBId: "product-Zimt"},
      ]),
    ).toEqual(["Tomatem ↔ Tomaten"]);
  });

  test("ein bestätigtes Paar mit nur einem gleichen Produkt blendet nichts aus", () => {
    expect(
      pairNamesFor(candidates, [
        {productAId: "product-Zimt", productBId: "product-Tomaten"},
      ]),
    ).toEqual(["Tomatem ↔ Tomaten", "Zimt ↔ Zimtstangen"]);
  });
});

/* =====================================================================
// Reihenfolge
// ===================================================================== */
describe("findDuplicatePairs: Reihenfolge", () => {
  test("höchster Score zuerst", () => {
    // Tippfehler 0.8 vor Teilwort 0.7, obwohl «Apfel» alphabetisch vorne steht
    expect(
      pairNamesFor([
        product("Apfel"),
        product("Apfelmus"),
        product("Tomaten"),
        product("Tomatem"),
      ]),
    ).toEqual(["Tomatem ↔ Tomaten", "Apfel ↔ Apfelmus"]);
  });

  test("bei gleichem Score nach Name A, dann nach Name B", () => {
    // Im Bestand umgekehrt, damit die Sortierung etwas zu tun hat
    const candidates = [
      "Zimt Fein",
      "Zimt Bio",
      "Zimt",
      "Rüebli",
      "Karotten",
      "Chilis",
      "Chili",
    ].map(product);

    expect(pairNamesFor(candidates)).toEqual([
      "Chili ↔ Chilis",
      "Karotten ↔ Rüebli",
      "Zimt ↔ Zimt Bio",
      "Zimt ↔ Zimt Fein",
      "Zimt Bio ↔ Zimt Fein",
    ]);
  });
});
