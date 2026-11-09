/**
 * Unit-Tests für den Vergleich zweier einzelner Wörter.
 *
 * Die Wörter sind bereits normalisiert (klein, Umlaute ausgeschrieben).
 * Jede Regel (Wortstamm, Tippfehler, Teilwort) ist einzeln benannt, damit ein
 * Hinweis später sagen kann, welche Regel ihn ausgelöst hat.
 */
import {
  WORD_WEIGHTS,
  compareWords,
  deletionVariants,
  editDistance,
  maxTypos,
  stemWord,
} from "../compareWords";
import {MatchRule} from "../productMatching.types";

/* =====================================================================
// stemWord
// ===================================================================== */
describe("stemWord", () => {
  test("Chili bleibt Chili (die Verkleinerung «-li» würde zu viel abschneiden)", () => {
    expect(stemWord("chili")).toBe("chili");
  });

  test("Chilis wird Chili: nur eine Endung wird entfernt", () => {
    expect(stemWord("chilis")).toBe("chili");
  });

  test("Würstchen und Würste haben denselben Stamm", () => {
    expect(stemWord("wuerstchen")).toBe("wuerst");
    expect(stemWord("wuerste")).toBe("wuerst");
  });

  test("Zwiebeln und Zwiebel haben denselben Stamm", () => {
    expect(stemWord("zwiebeln")).toBe("zwiebel");
    expect(stemWord("zwiebel")).toBe("zwiebel");
  });

  test("die längere Endung geht vor: Tomaten wird Tomat, nicht Tomate", () => {
    expect(stemWord("tomaten")).toBe("tomat");
  });

  test("«-li» wird entfernt, wenn genug übrig bleibt", () => {
    expect(stemWord("wienerli")).toBe("wiener");
  });

  test("kurze Wörter bleiben unverändert", () => {
    expect(stemWord("eier")).toBe("eier");
    expect(stemWord("reis")).toBe("reis");
    expect(stemWord("")).toBe("");
  });
});

/* =====================================================================
// editDistance
// ===================================================================== */
describe("editDistance", () => {
  test("gleiche Wörter haben Abstand 0", () => {
    expect(editDistance("zimt", "zimt")).toBe(0);
  });

  test("Einfügen, Löschen und Ersetzen zählen je 1", () => {
    expect(editDistance("zimt", "zimmt")).toBe(1);
    expect(editDistance("zimmt", "zimt")).toBe(1);
    expect(editDistance("zimt", "zint")).toBe(1);
  });

  test("Vertauschen zweier Nachbarn zählt 1", () => {
    expect(editDistance("zimt", "zitm")).toBe(1);
  });

  test("Vertauschen macht einen Abstand nie kleiner als möglich", () => {
    // Drei Stellen sind verschieden: weder ein Ersetzen noch ein Vertauschen reicht
    expect(editDistance("aaba", "abab")).toBe(2);
  });

  test("gegen ein leeres Wort zählt die Länge", () => {
    expect(editDistance("", "zimt")).toBe(4);
    expect(editDistance("zimt", "")).toBe(4);
  });

  test("mehrere Änderungen werden zusammengezählt", () => {
    expect(editDistance("kitten", "sitting")).toBe(3);
  });

  test("ist symmetrisch", () => {
    expect(editDistance("wiernerli", "wienerli")).toBe(
      editDistance("wienerli", "wiernerli"),
    );
  });
});

/* =====================================================================
// maxTypos
// ===================================================================== */
describe("maxTypos", () => {
  test.each([
    [0, 0],
    [4, 0],
    [5, 1],
    [8, 1],
    [9, 2],
    [14, 2],
  ])("bei %i Zeichen sind %i Tippfehler erlaubt", (wordLength, expected) => {
    expect(maxTypos(wordLength)).toBe(expected);
  });
});

/* =====================================================================
// deletionVariants
// ===================================================================== */
describe("deletionVariants", () => {
  test("ohne Löschen nur das Wort selbst", () => {
    expect(deletionVariants("abc", 0)).toEqual(new Set(["abc"]));
  });

  test("ein Zeichen weniger an jeder Stelle", () => {
    expect(deletionVariants("abc", 1)).toEqual(
      new Set(["abc", "bc", "ac", "ab"]),
    );
  });

  test("zwei Zeichen weniger enthält auch die Varianten mit einem", () => {
    expect(deletionVariants("abc", 2)).toEqual(
      new Set(["abc", "bc", "ac", "ab", "c", "b", "a"]),
    );
  });

  test("gleiche Varianten kommen nur einmal vor", () => {
    expect(deletionVariants("aab", 1)).toEqual(new Set(["aab", "ab", "aa"]));
  });
});

/* =====================================================================
// compareWords
// ===================================================================== */
describe("compareWords", () => {
  test("Gewichte der Regeln", () => {
    expect(WORD_WEIGHTS).toEqual({
      [MatchRule.EXACT]: 1,
      [MatchRule.STEM]: 1,
      [MatchRule.SYNONYM]: 1,
      [MatchRule.TYPO]: 0.8,
      [MatchRule.COMPOUND]: 0.7,
    });
  });

  /** Paare mit erwarteter Regel; jedes wird in beide Richtungen geprüft. */
  const matchingPairs: [string, string, MatchRule][] = [
    ["zimt", "zimt", MatchRule.EXACT],
    ["chilis", "chilis", MatchRule.EXACT],
    ["chili", "chilis", MatchRule.STEM],
    ["wuerstchen", "wuerste", MatchRule.STEM],
    ["tomatem", "tomaten", MatchRule.TYPO],
    ["wiernerli", "wienerli", MatchRule.TYPO],
    ["buger", "burger", MatchRule.TYPO],
    ["ruebli", "rueebli", MatchRule.TYPO],
    // Nur über die Stämme: «zwibel» gegen «zwiebel» ist ein Tippfehler,
    // die ganzen Wörter liegen zwei auseinander.
    ["zwibeln", "zwiebel", MatchRule.TYPO],
    ["restengemuese", "gemuese", MatchRule.COMPOUND],
    ["haferrahm", "rahm", MatchRule.COMPOUND],
    ["zitronenschale", "zitronen", MatchRule.COMPOUND],
  ];

  test.each(matchingPairs)(
    "«%s» und «%s» passen über %s",
    (wordA, wordB, expectedRule) => {
      expect(compareWords(wordA, wordB)).toEqual({
        rule: expectedRule,
        weight: WORD_WEIGHTS[expectedRule],
      });
    },
  );

  test.each(matchingPairs)(
    "«%s» und «%s» passen auch umgekehrt gleich",
    (wordA, wordB) => {
      expect(compareWords(wordB, wordA)).toEqual(compareWords(wordA, wordB));
    },
  );

  const unrelatedPairs: [string, string][] = [
    // Vier Buchstaben erlauben keinen Tippfehler
    ["reis", "mais"],
    // Der Rest «ig» ist zu kurz für ein Teilwort
    ["reis", "reisig"],
    // Das kürzere Wort zählt für die Tippfehler-Grenze
    ["mais", "mains"],
    // Teilwort braucht mindestens 4 Zeichen
    ["eis", "eiscreme"],
    ["zimt", "zucker"],
  ];

  test.each(unrelatedPairs)("«%s» und «%s» passen nicht", (wordA, wordB) => {
    expect(compareWords(wordA, wordB)).toBeNull();
    expect(compareWords(wordB, wordA)).toBeNull();
  });
});
