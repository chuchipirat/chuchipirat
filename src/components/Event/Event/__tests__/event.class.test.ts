/**
 * Unit-Tests für Event.defineEventDuration.
 *
 * Regressionstest für einen Bug, bei dem eine unbefüllte Platzhalter-
 * Zeitscheibe (Von/Bis = 1.1.1970) fälschlicherweise als 1 Tag mitgezählt
 * wurde.
 */
import {Event, EventDate} from "../event.class";

/**
 * Erstellt eine Zeitscheibe für Testzwecke.
 *
 * @param uid - Eindeutige ID der Zeitscheibe.
 * @param from - Startdatum.
 * @param to - Enddatum.
 * @returns Die erstellte Zeitscheibe.
 */
const createDateSlice = (uid: string, from: Date, to: Date): EventDate => ({
  uid,
  pos: 0,
  from,
  to,
});

/** Platzhalter-Datum, wie es eine noch nicht befüllte Zeitscheibe hat. */
const EPOCH_PLACEHOLDER = new Date(1970, 0, 1);

describe("Event.defineEventDuration", () => {
  test("zählt eine einzelne Zeitscheibe korrekt (inklusive Start- und Endtag)", () => {
    const dates = [
      createDateSlice("date-1", new Date(2026, 6, 1), new Date(2026, 6, 5)),
    ];

    expect(Event.defineEventDuration(dates)).toBe(5);
  });

  test("summiert mehrere echte Zeitscheiben", () => {
    const dates = [
      createDateSlice("date-1", new Date(2026, 6, 1), new Date(2026, 6, 3)),
      createDateSlice("date-2", new Date(2026, 6, 10), new Date(2026, 6, 12)),
    ];

    expect(Event.defineEventDuration(dates)).toBe(6);
  });

  test("überspringt eine Platzhalter-Zeitscheibe (Von/Bis = 1.1.1970)", () => {
    const dates = [
      createDateSlice("date-1", new Date(2026, 6, 1), new Date(2026, 6, 5)),
      createDateSlice("date-2", EPOCH_PLACEHOLDER, EPOCH_PLACEHOLDER),
    ];

    expect(Event.defineEventDuration(dates)).toBe(5);
  });

  test("gibt 0 zurück, wenn nur eine Platzhalter-Zeitscheibe vorhanden ist", () => {
    const dates = [createDateSlice("date-1", EPOCH_PLACEHOLDER, EPOCH_PLACEHOLDER)];

    expect(Event.defineEventDuration(dates)).toBe(0);
  });
});
