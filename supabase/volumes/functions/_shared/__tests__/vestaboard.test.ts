/**
 * Unit-Tests für die Vestaboard-Grundlagen (vestaboard.ts): Zeichencodes,
 * Farben, Umlaute, Zeilen und Beträge.
 *
 * Das Board kennt nur Grossbuchstaben, Ziffern und wenige Sonderzeichen.
 * Alles andere fällt beim Kodieren weg, darum werden Umlaute vorher
 * umgeschrieben. Jede Zeile muss genau 22 Codes haben, sonst lehnt die API
 * die Nachricht ab.
 */
import {
  CHARACTER_CODES,
  VESTABOARD_COLOR,
  VESTABOARD_COLUMNS,
  VESTABOARD_ROWS,
  centerRow,
  encodeRow,
  encodeText,
  formatChf,
  transliterate,
} from "../vestaboard";

/** Codes für einen Text aus bekannten Zeichen, ohne Auffüllen. */
const codesOf = (text: string): number[] =>
  [...text].map((character) => CHARACTER_CODES[character]);

/** `count` Leerzeichen-Codes. */
const blanks = (count: number): number[] => new Array(count).fill(0);

describe("Konstanten", () => {
  it("Board hat 6 Zeilen mit 22 Spalten", () => {
    expect(VESTABOARD_ROWS).toBe(6);
    expect(VESTABOARD_COLUMNS).toBe(22);
  });

  it("Farbcodes gemäss Vestaboard-Doku", () => {
    expect(VESTABOARD_COLOR).toEqual({
      red: 63,
      orange: 64,
      yellow: 65,
      green: 66,
      blue: 67,
      violet: 68,
      white: 69,
    });
  });

  it("Zeichencodes für Buchstaben, Ziffern und Sonderzeichen", () => {
    expect(CHARACTER_CODES[" "]).toBe(0);
    expect(CHARACTER_CODES.A).toBe(1);
    expect(CHARACTER_CODES.Z).toBe(26);
    expect(CHARACTER_CODES["1"]).toBe(27);
    expect(CHARACTER_CODES["0"]).toBe(36);
    expect(CHARACTER_CODES["!"]).toBe(37);
    expect(CHARACTER_CODES["-"]).toBe(44);
    expect(CHARACTER_CODES["+"]).toBe(46);
    expect(CHARACTER_CODES["'"]).toBe(52);
    expect(CHARACTER_CODES["%"]).toBe(54);
    expect(CHARACTER_CODES["."]).toBe(56);
    expect(CHARACTER_CODES[":"]).toBe(50);
  });
});

describe("transliterate", () => {
  it("schreibt Umlaute und ß um", () => {
    expect(transliterate("ÄÖÜ äöü ß")).toBe("AEOEUE AEOEUE SS");
  });

  it("macht Grossbuchstaben", () => {
    expect(transliterate("Anna")).toBe("ANNA");
  });

  it("entfernt Akzente", () => {
    expect(transliterate("Zoë Désirée Çelik")).toBe("ZOE DESIREE CELIK");
  });

  it("lässt Satzzeichen stehen", () => {
    expect(transliterate("Jürg Müller-Schön!")).toBe("JUERG MUELLER-SCHOEN!");
  });
});

describe("encodeText", () => {
  it("kodiert ohne aufzufüllen", () => {
    expect(encodeText("Hi!")).toEqual([8, 9, 37]);
  });

  it("lässt unbekannte Zeichen weg", () => {
    expect(encodeText("a€b")).toEqual([1, 2]);
  });

  it("schreibt Umlaute vor dem Kodieren um", () => {
    expect(encodeText("Zürich")).toEqual(codesOf("ZUERICH"));
  });
});

describe("encodeRow", () => {
  it("füllt rechts auf 22 Codes auf", () => {
    expect(encodeRow("AB")).toEqual([1, 2, ...blanks(20)]);
  });

  it("schneidet nach 22 Codes ab", () => {
    const row = encodeRow("A".repeat(30));

    expect(row).toHaveLength(22);
    expect(row.every((code) => code === 1)).toBe(true);
  });

  it("kodiert die Kopfzeile der Willkommensnachricht wie bisher", () => {
    const header = " --  chuchipirat  -- ";

    expect(encodeRow(header)).toEqual([
      ...codesOf(header.toUpperCase()),
      ...blanks(22 - header.length),
    ]);
  });
});

describe("centerRow", () => {
  it("zentriert bei geradem Rest", () => {
    expect(centerRow("AB")).toEqual([...blanks(10), 1, 2, ...blanks(10)]);
  });

  it("gibt bei ungeradem Rest rechts eine Kachel mehr", () => {
    expect(centerRow("ABC")).toEqual([...blanks(9), 1, 2, 3, ...blanks(10)]);
  });

  it("zentriert in einer kleineren Breite", () => {
    const row = centerRow("AB", 18);

    expect(row).toHaveLength(18);
    expect(row).toEqual([...blanks(8), 1, 2, ...blanks(8)]);
  });

  it("zählt umgeschriebene Umlaute mit", () => {
    expect(centerRow("Ü")).toEqual([...blanks(10), 21, 5, ...blanks(10)]);
  });

  it("schneidet zu lange Texte auf die Breite", () => {
    const row = centerRow("ABCDEFGHIJKLMNOPQRSTUVWXYZ");

    expect(row).toEqual(codesOf("ABCDEFGHIJKLMNOPQRSTUV"));
  });

  it("liefert ohne Text eine leere Zeile", () => {
    expect(centerRow("")).toEqual(blanks(22));
  });
});

describe("formatChf", () => {
  it("mit Rappen", () => {
    expect(formatChf(5000, {withCents: true})).toBe("CHF 50.00");
    expect(formatChf(1250, {withCents: true})).toBe("CHF 12.50");
    expect(formatChf(5, {withCents: true})).toBe("CHF 0.05");
  });

  it("mit Rappen und Tausender-Apostroph", () => {
    expect(formatChf(123456, {withCents: true})).toBe("CHF 1'234.56");
  });

  it("ohne Rappen mit Tausender-Apostroph", () => {
    expect(formatChf(124000, {withCents: false})).toBe("CHF 1'240");
    expect(formatChf(100000000, {withCents: false})).toBe("CHF 1'000'000");
  });

  it("ohne Rappen wird abgerundet", () => {
    expect(formatChf(123999, {withCents: false})).toBe("CHF 1'239");
  });

  it("null Franken", () => {
    expect(formatChf(0, {withCents: false})).toBe("CHF 0");
  });
});
