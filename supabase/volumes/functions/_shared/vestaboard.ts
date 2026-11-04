/**
 * Gemeinsame Grundlagen für Nachrichten auf dem Vestaboard (Deno- und
 * Jest-kompatibel, ohne Deno-Imports).
 *
 * Das Board hat 6 Zeilen mit je 22 Kacheln. Jede Kachel zeigt ein Zeichen
 * oder eine Farbe, kodiert als Zahl. Die API verlangt eine 6×22-Matrix aus
 * diesen Codes.
 *
 * Dokumentation: https://docs.vestaboard.com/docs/characterCodes
 *
 * @example
 * import { centerRow, formatChf } from "../_shared/vestaboard.ts";
 * centerRow(formatChf(5000, { withCents: true })); // «CHF 50.00» zentriert
 */

/** Anzahl Zeilen des Boards. */
export const VESTABOARD_ROWS = 6;

/** Anzahl Kacheln pro Zeile. */
export const VESTABOARD_COLUMNS = 22;

/** Codes der Farbkacheln. */
export const VESTABOARD_COLOR = {
  red: 63,
  orange: 64,
  yellow: 65,
  green: 66,
  blue: 67,
  violet: 68,
  white: 69,
} as const;

/** Code einer leeren Kachel. */
const BLANK = 0;

/** Zeichen → Code. Das Board kennt nur Grossbuchstaben. */
export const CHARACTER_CODES: Record<string, number> = {
  " ": 0,
  A: 1,
  B: 2,
  C: 3,
  D: 4,
  E: 5,
  F: 6,
  G: 7,
  H: 8,
  I: 9,
  J: 10,
  K: 11,
  L: 12,
  M: 13,
  N: 14,
  O: 15,
  P: 16,
  Q: 17,
  R: 18,
  S: 19,
  T: 20,
  U: 21,
  V: 22,
  W: 23,
  X: 24,
  Y: 25,
  Z: 26,
  "1": 27,
  "2": 28,
  "3": 29,
  "4": 30,
  "5": 31,
  "6": 32,
  "7": 33,
  "8": 34,
  "9": 35,
  "0": 36,
  "!": 37,
  "@": 38,
  "#": 39,
  $: 40,
  "(": 41,
  ")": 42,
  "-": 44,
  "+": 46,
  "&": 47,
  "=": 48,
  ";": 49,
  ":": 50,
  "'": 52,
  '"': 53,
  "%": 54,
  ",": 55,
  ".": 56,
  "/": 59,
  "?": 60,
  "°": 62,
};

/** Umschreibungen für Zeichen, die das Board nicht kennt. */
const REPLACEMENTS: Record<string, string> = {
  Ä: "AE",
  Ö: "OE",
  Ü: "UE",
  ß: "SS",
};

/**
 * Schreibt einen Text so um, dass ihn das Board darstellen kann:
 * Grossbuchstaben, Umlaute und ß ausgeschrieben, Akzente entfernt.
 *
 * @param text - Beliebiger Text, z.B. ein Vorname.
 * @returns Der umgeschriebene Text.
 * @example
 * transliterate("Jürg Désirée"); // "JUERG DESIREE"
 */
export function transliterate(text: string): string {
  // Umlaute vor dem Entfernen der Akzente ersetzen, sonst würde aus «Ü»
  // ein «U» statt «UE».
  const withReplacements = [...text.toUpperCase()]
    .map((character) => REPLACEMENTS[character] ?? character)
    .join("");
  return withReplacements.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/**
 * Kodiert einen Text in Board-Codes, ohne aufzufüllen. Zeichen, die das
 * Board nicht kennt, fallen weg.
 *
 * @param text - Der Text.
 * @returns Ein Code pro darstellbarem Zeichen.
 * @example
 * encodeText("Hi!"); // [8, 9, 37]
 */
export function encodeText(text: string): number[] {
  return [...transliterate(text)]
    .map((character) => CHARACTER_CODES[character])
    .filter((code): code is number => code !== undefined);
}

/**
 * Bringt Codes auf eine feste Breite: rechts mit leeren Kacheln auffüllen
 * oder abschneiden.
 *
 * @param codes - Die Codes.
 * @param width - Gewünschte Anzahl Kacheln.
 * @returns Genau `width` Codes.
 */
function fitToWidth(codes: number[], width: number): number[] {
  const fitted = codes.slice(0, width);
  while (fitted.length < width) fitted.push(BLANK);
  return fitted;
}

/**
 * Kodiert einen Text als linksbündige Zeile mit genau 22 Kacheln.
 *
 * @param text - Der Text.
 * @returns 22 Codes.
 * @example
 * encodeRow("AB"); // [1, 2, 0, 0, …]
 */
export function encodeRow(text: string): number[] {
  return fitToWidth(encodeText(text), VESTABOARD_COLUMNS);
}

/**
 * Kodiert einen Text zentriert. Bleibt eine Kachel übrig, kommt sie rechts
 * dazu. Zu lange Texte werden auf die Breite gekürzt.
 *
 * @param text - Der Text.
 * @param width - Breite in Kacheln, Standard ist eine ganze Zeile.
 * @returns Genau `width` Codes.
 * @example
 * centerRow("AB"); // 10 leere, A, B, 10 leere
 */
export function centerRow(
  text: string,
  width: number = VESTABOARD_COLUMNS,
): number[] {
  const codes = encodeText(text).slice(0, width);
  const leftPadding = Math.floor((width - codes.length) / 2);
  return fitToWidth([...new Array(leftPadding).fill(BLANK), ...codes], width);
}

/**
 * Formatiert einen Betrag in Franken mit Schweizer Tausender-Apostroph.
 * Ohne Rappen wird abgerundet, damit nie mehr angezeigt wird als vorhanden.
 *
 * @param cents - Betrag in Rappen.
 * @param options.withCents - Ob die Rappen angezeigt werden.
 * @returns Der Betrag, z.B. «CHF 1'234.56» oder «CHF 1'234».
 * @example
 * formatChf(123456, { withCents: false }); // "CHF 1'234"
 */
export function formatChf(
  cents: number,
  {withCents}: {withCents: boolean},
): string {
  const francs = Math.floor(cents / 100);
  const groupedFrancs = String(francs).replace(/\B(?=(\d{3})+(?!\d))/g, "'");
  if (!withCents) return `CHF ${groupedFrancs}`;
  const remainingCents = String(cents % 100).padStart(2, "0");
  return `CHF ${groupedFrancs}.${remainingCents}`;
}
