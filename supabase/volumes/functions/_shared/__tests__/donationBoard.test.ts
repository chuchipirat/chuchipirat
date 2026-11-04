/**
 * Unit-Tests für die Vestaboard-Nachricht bei einer neuen Spende
 * (donationBoard.ts): Dank mit Vorname, Betrag, Anlass, Jahrestotal und
 * Fortschrittsbalken zum Jahresziel.
 *
 * Die Boards werden für die Prüfung zurück in Text übersetzt. Farbkacheln
 * erscheinen als Kleinbuchstaben (r rot, o orange, y gelb, g grün, b blau,
 * v violett, w weiss), weil das Board selbst nur Grossbuchstaben zeigt.
 */
import {
  DonationBoardData,
  GOAL_SECTION_COLORS,
  buildDonationBoard,
  buildProgressBar,
} from "../donationBoard";
import {CHARACTER_CODES, VESTABOARD_COLOR} from "../vestaboard";

/** Farbcode → Kleinbuchstabe für die lesbare Darstellung. */
const COLOR_LETTERS: Record<number, string> = {
  [VESTABOARD_COLOR.red]: "r",
  [VESTABOARD_COLOR.orange]: "o",
  [VESTABOARD_COLOR.yellow]: "y",
  [VESTABOARD_COLOR.green]: "g",
  [VESTABOARD_COLOR.blue]: "b",
  [VESTABOARD_COLOR.violet]: "v",
  [VESTABOARD_COLOR.white]: "w",
};

/** Zeichencode → Zeichen, Umkehrung von CHARACTER_CODES. */
const CHARACTERS_BY_CODE: Record<number, string> = Object.fromEntries(
  Object.entries(CHARACTER_CODES).map(([character, code]) => [code, character]),
);

/** Übersetzt eine Zeile Codes in lesbaren Text. */
const renderRow = (row: number[]): string =>
  row
    .map((code) => COLOR_LETTERS[code] ?? CHARACTERS_BY_CODE[code] ?? "?")
    .join("");

/** Übersetzt ein ganzes Board in lesbare Zeilen. */
const renderBoard = (board: number[][]): string[] => board.map(renderRow);

/** CHF 50 von Anna für «Sola Bären», 2026 total CHF 1'240 von CHF 3'000. */
const BASE_DATA: DonationBoardData = {
  amountCents: 5000,
  firstName: "Anna",
  eventName: "Sola Bären",
  year: 2026,
  yearTotalCents: 124000,
  donationCount: 12,
  goalSections: [{targetCents: 300000}],
};

describe("buildDonationBoard", () => {
  it("hat 6 Zeilen mit je 22 Codes", () => {
    const board = buildDonationBoard(BASE_DATA);

    expect(board).toHaveLength(6);
    board.forEach((row) => expect(row).toHaveLength(22));
  });

  it("zeigt Dank, Betrag, Anlass, Total, Balken und Prozent", () => {
    expect(renderBoard(buildDonationBoard(BASE_DATA))).toEqual([
      "rr   MERCI ANNA!    rr",
      "      CHF 50.00       ",
      "   FUER SOLA BAEREN   ",
      "   2026: CHF 1'240    ",
      "gggggggggwwwwwwwwwwwww",
      "  41% VON CHF 3'000   ",
    ]);
  });

  it("dankt ohne Vorname mit «NEUE SPENDE!»", () => {
    const board = buildDonationBoard({...BASE_DATA, firstName: "  "});

    expect(renderRow(board[0])).toBe("rr   NEUE SPENDE!   rr");
  });

  it("schreibt Umlaute im Vornamen um", () => {
    const board = buildDonationBoard({...BASE_DATA, firstName: "Jürg"});

    expect(renderRow(board[0])).toBe("rr   MERCI JUERG!   rr");
  });

  it("kürzt den Vornamen auf 10 Zeichen", () => {
    const board = buildDonationBoard({...BASE_DATA, firstName: "Maximiliane"});

    expect(renderRow(board[0])).toBe("rrMERCI MAXIMILIAN! rr");
  });

  it("lässt die Anlass-Zeile ohne Anlass leer", () => {
    const board = buildDonationBoard({...BASE_DATA, eventName: null});

    expect(renderRow(board[2])).toBe(" ".repeat(22));
  });

  it("kürzt einen langen Anlassnamen auf die Zeile", () => {
    const board = buildDonationBoard({
      ...BASE_DATA,
      eventName: "Sommerlager Pfadi Bären Zürich",
    });

    expect(renderRow(board[2])).toBe("FUER SOMMERLAGER PFADI");
  });

  it("zeigt Rappen beim Betrag", () => {
    const board = buildDonationBoard({...BASE_DATA, amountCents: 1250});

    expect(renderRow(board[1])).toBe("      CHF 12.50       ");
  });

  it("meldet ein erreichtes Ziel mit Prozent", () => {
    const board = buildDonationBoard({...BASE_DATA, yearTotalCents: 336000});

    expect(renderRow(board[4])).toBe("g".repeat(22));
    expect(renderRow(board[5])).toBe(" ZIEL ERREICHT! 112%  ");
  });

  it("meldet genau 100 % als erreicht", () => {
    const board = buildDonationBoard({...BASE_DATA, yearTotalCents: 300000});

    expect(renderRow(board[5])).toBe(" ZIEL ERREICHT! 100%  ");
  });

  it("rundet die Prozent ab", () => {
    // 299'999 / 300'000 = 99.9997 %
    const board = buildDonationBoard({...BASE_DATA, yearTotalCents: 299999});

    expect(renderRow(board[5])).toBe("  99% VON CHF 3'000   ");
  });

  it("zeigt ohne Ziel keinen Balken, sondern die Anzahl Spenden", () => {
    const board = buildDonationBoard({...BASE_DATA, goalSections: []});

    expect(renderRow(board[4])).toBe(" ".repeat(22));
    expect(renderRow(board[5])).toBe("  12 SPENDEN IN 2026  ");
  });

  it("sagt «1 SPENDE» in der Einzahl", () => {
    const board = buildDonationBoard({
      ...BASE_DATA,
      goalSections: [],
      donationCount: 1,
    });

    expect(renderRow(board[5])).toBe("   1 SPENDE IN 2026   ");
  });
});

describe("buildProgressBar", () => {
  it("Abschnittsfarben der Reihe nach grün, blau, violett, orange, gelb", () => {
    expect(GOAL_SECTION_COLORS).toEqual([
      VESTABOARD_COLOR.green,
      VESTABOARD_COLOR.blue,
      VESTABOARD_COLOR.violet,
      VESTABOARD_COLOR.orange,
      VESTABOARD_COLOR.yellow,
    ]);
  });

  it("ist ohne Spenden ganz weiss", () => {
    const bar = buildProgressBar(0, [{targetCents: 300000}]);

    expect(renderRow(bar)).toBe("w".repeat(22));
  });

  it("zeigt schon einen Franken mit einer Kachel", () => {
    const bar = buildProgressBar(100, [{targetCents: 300000}]);

    expect(renderRow(bar)).toBe("g" + "w".repeat(21));
  });

  it("färbt jede Kachel nach dem Abschnitt, in dem ihre Mitte liegt", () => {
    const sections = [{targetCents: 100000}, {targetCents: 200000}];

    expect(renderRow(buildProgressBar(150000, sections))).toBe(
      "gggggggbbbbwwwwwwwwwww",
    );
  });

  it("beginnt nach fünf Abschnitten wieder mit Grün", () => {
    const sections = new Array(6).fill({targetCents: 50000});

    expect(renderRow(buildProgressBar(300000, sections))).toBe(
      "ggggbbbvvvvooooyyygggg",
    );
  });

  it("bleibt über 100 % voll und nach Abschnitten gefärbt", () => {
    const sections = [{targetCents: 100000}, {targetCents: 200000}];

    expect(renderRow(buildProgressBar(400000, sections))).toBe(
      "gggggggbbbbbbbbbbbbbbb",
    );
  });

  it("ist ohne Ziel leer", () => {
    expect(renderRow(buildProgressBar(124000, []))).toBe(" ".repeat(22));
  });
});
