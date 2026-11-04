/**
 * Unit-Tests für die Aufbewahrungsfrist der Belege in der App
 * (receiptRetention.ts). Die Regel muss zum Löschjob passen
 * (`supabase/volumes/functions/_shared/receiptRetention.ts`): gelöscht wird
 * ab dem Tag ein Jahr nach Anlassende.
 */
import {getEventEnd, isReceiptRetentionOver} from "../receiptRetention";
import {EventDate} from "../../Event/event.class";

const eventDate = (from: Date, to: Date): EventDate => ({
  uid: `date-${to.getTime()}`,
  pos: 1,
  from,
  to,
});

describe("getEventEnd", () => {
  test("spätestes Enddatum über alle Zeitscheiben", () => {
    const end = getEventEnd([
      eventDate(new Date(2026, 6, 10), new Date(2026, 6, 12)),
      eventDate(new Date(2026, 6, 1), new Date(2026, 6, 4)),
    ]);

    expect(end).toEqual(new Date(2026, 6, 12));
  });

  test("ohne Zeitscheiben: null", () => {
    expect(getEventEnd([])).toBeNull();
  });
});

describe("isReceiptRetentionOver", () => {
  const eventEnd = new Date(2025, 6, 12);

  test("Tag vor dem Löschdatum: noch nicht", () => {
    expect(
      isReceiptRetentionOver(eventEnd, new Date(2026, 6, 11, 23, 59)),
    ).toBe(false);
  });

  test("am Löschdatum: vorbei", () => {
    expect(isReceiptRetentionOver(eventEnd, new Date(2026, 6, 12, 0, 1))).toBe(
      true,
    );
  });

  test("lange danach: vorbei", () => {
    expect(isReceiptRetentionOver(eventEnd, new Date(2027, 0, 1))).toBe(true);
  });

  test("Anlassende am 29.02.: gelöscht ab 01.03. des Folgejahrs", () => {
    const leapEnd = new Date(2024, 1, 29);

    expect(isReceiptRetentionOver(leapEnd, new Date(2025, 1, 28))).toBe(false);
    expect(isReceiptRetentionOver(leapEnd, new Date(2025, 2, 1))).toBe(true);
  });

  test("ohne Anlassende: nie vorbei", () => {
    expect(isReceiptRetentionOver(null, new Date(2030, 0, 1))).toBe(false);
  });
});
