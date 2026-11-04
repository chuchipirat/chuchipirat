/**
 * Vestaboard-Nachricht bei einer neuen Spende (Deno- und Jest-kompatibel,
 * ohne Deno-Imports).
 *
 * Layout (6 × 22):
 *   rr   MERCI ANNA!    rr   Dank mit Vorname, rote Kacheln aussen
 *         CHF 50.00          Betrag
 *      FUER SOLA BAEREN      Anlass, leer ohne Anlass
 *      2026: CHF 1'240       Jahrestotal
 *   gggggggggwwwwwwwwwwwww   Balken zum Jahresziel
 *     41% VON CHF 3'000      Anteil am Ziel
 *
 * @example
 * import { buildDonationBoard } from "../_shared/donationBoard.ts";
 * const board = buildDonationBoard(data); // 6×22-Matrix für die API
 */
import {
  VESTABOARD_COLOR,
  VESTABOARD_COLUMNS,
  centerRow,
  formatChf,
  transliterate,
} from "./vestaboard.ts";

/**
 * Angaben für die Nachricht.
 *
 * @property amountCents - Betrag der neuen Spende in Rappen.
 * @property firstName - Vorname der spendenden Person, leer wenn unbekannt.
 * @property eventName - Name des Anlasses, `null` bei einer Spende ohne Anlass.
 * @property year - Jahr des Spendenziels.
 * @property yearTotalCents - Summe aller Spenden des Jahres in Rappen.
 * @property donationCount - Anzahl Spenden des Jahres.
 * @property goalSections - Abschnitte des Jahresziels in ihrer Reihenfolge.
 */
export type DonationBoardData = {
  amountCents: number;
  firstName: string;
  eventName: string | null;
  year: number;
  yearTotalCents: number;
  donationCount: number;
  goalSections: {targetCents: number}[];
};

/** Farben der Ziel-Abschnitte im Balken, danach beginnt es von vorn. */
export const GOAL_SECTION_COLORS: number[] = [
  VESTABOARD_COLOR.green,
  VESTABOARD_COLOR.blue,
  VESTABOARD_COLOR.violet,
  VESTABOARD_COLOR.orange,
  VESTABOARD_COLOR.yellow,
];

/** Breite des Dankestexts zwischen den je zwei roten Kacheln. */
const THANKS_WIDTH = VESTABOARD_COLUMNS - 4;
/** Länge des Vornamens, damit «MERCI …!» zwischen die Kacheln passt. */
const MAX_FIRST_NAME_LENGTH = 10;

/**
 * Summiert die Abschnitte zum Jahresziel.
 *
 * @param goalSections - Abschnitte des Ziels.
 * @returns Jahresziel in Rappen, 0 ohne Abschnitte.
 */
function sumGoal(goalSections: {targetCents: number}[]): number {
  return goalSections.reduce((sum, section) => sum + section.targetCents, 0);
}

/**
 * Bestimmt die Farbe einer gefüllten Kachel: die des Abschnitts, in dem die
 * Mitte der Kachel liegt.
 *
 * @param tileIndex - Position der Kachel, 0 bis 21.
 * @param goalSections - Abschnitte des Ziels.
 * @param goalCents - Jahresziel in Rappen.
 * @returns Farbcode der Kachel.
 */
function sectionColor(
  tileIndex: number,
  goalSections: {targetCents: number}[],
  goalCents: number,
): number {
  const tileMiddle = ((tileIndex + 0.5) / VESTABOARD_COLUMNS) * goalCents;
  let sectionEnd = 0;
  const sectionIndex = goalSections.findIndex((section) => {
    sectionEnd += section.targetCents;
    return sectionEnd > tileMiddle;
  });
  // Die Mitte einer Kachel liegt immer unter dem Ziel. Der Rückfall auf den
  // letzten Abschnitt sichert nur gegen Rundungsfehler bei Kommazahlen ab.
  const index = sectionIndex === -1 ? goalSections.length - 1 : sectionIndex;
  return GOAL_SECTION_COLORS[index % GOAL_SECTION_COLORS.length];
}

/**
 * Baut den Balken zum Jahresziel: gefüllte Kacheln in der Farbe ihres
 * Abschnitts, offene weiss. Ab dem ersten Franken ist mindestens eine
 * Kachel gefüllt, damit jede Spende sichtbar ist.
 *
 * @param yearTotalCents - Summe des Jahres in Rappen.
 * @param goalSections - Abschnitte des Ziels.
 * @returns 22 Codes; ohne Ziel eine leere Zeile.
 * @example
 * buildProgressBar(150000, [{ targetCents: 300000 }]); // 11 grün, 11 weiss
 */
export function buildProgressBar(
  yearTotalCents: number,
  goalSections: {targetCents: number}[],
): number[] {
  const goalCents = sumGoal(goalSections);
  if (goalCents <= 0) return centerRow("");

  const filledTiles = Math.min(
    VESTABOARD_COLUMNS,
    Math.max(
      yearTotalCents > 0 ? 1 : 0,
      Math.floor((yearTotalCents / goalCents) * VESTABOARD_COLUMNS),
    ),
  );
  return Array.from({length: VESTABOARD_COLUMNS}, (_tile, tileIndex) =>
    tileIndex < filledTiles
      ? sectionColor(tileIndex, goalSections, goalCents)
      : VESTABOARD_COLOR.white,
  );
}

/**
 * Baut die Dankeszeile: zwei rote Kacheln, zentrierter Text, zwei rote.
 *
 * @param firstName - Vorname, leer wenn unbekannt.
 * @returns 22 Codes.
 */
function buildThanksRow(firstName: string): number[] {
  const name = transliterate(firstName.trim()).slice(0, MAX_FIRST_NAME_LENGTH);
  const thanks = name ? `MERCI ${name}!` : "NEUE SPENDE!";
  const red = VESTABOARD_COLOR.red;
  return [red, red, ...centerRow(thanks, THANKS_WIDTH), red, red];
}

/**
 * Text der letzten Zeile: Anteil am Ziel, «ZIEL ERREICHT!» ab 100 % oder
 * ohne Ziel die Anzahl Spenden des Jahres.
 *
 * @param data - Angaben zur Nachricht.
 * @returns Der Text, z.B. «41% VON CHF 3'000».
 */
function buildGoalText(data: DonationBoardData): string {
  const goalCents = sumGoal(data.goalSections);
  if (goalCents <= 0) {
    const noun = data.donationCount === 1 ? "SPENDE" : "SPENDEN";
    return `${data.donationCount} ${noun} IN ${data.year}`;
  }
  const percent = Math.floor((data.yearTotalCents / goalCents) * 100);
  if (percent >= 100) return `ZIEL ERREICHT! ${percent}%`;
  return `${percent}% VON ${formatChf(goalCents, {withCents: false})}`;
}

/**
 * Baut die ganze Nachricht für das Board.
 *
 * @param data - Angaben zur Nachricht, siehe {@link DonationBoardData}.
 * @returns 6×22-Matrix aus Board-Codes.
 * @example
 * buildDonationBoard({
 *   amountCents: 5000, firstName: "Anna", eventName: "Sola Bären",
 *   year: 2026, yearTotalCents: 124000, donationCount: 12,
 *   goalSections: [{ targetCents: 300000 }],
 * });
 */
export function buildDonationBoard(data: DonationBoardData): number[][] {
  const yearTotal = formatChf(data.yearTotalCents, {withCents: false});
  return [
    buildThanksRow(data.firstName),
    centerRow(formatChf(data.amountCents, {withCents: true})),
    centerRow(data.eventName ? `FUER ${data.eventName}` : ""),
    centerRow(`${data.year}: ${yearTotal}`),
    buildProgressBar(data.yearTotalCents, data.goalSections),
    centerRow(buildGoalText(data)),
  ];
}
