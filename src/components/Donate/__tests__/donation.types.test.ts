/**
 * Unit-Tests fuer donation.types.
 *
 * Stellt sicher, dass das DonationStatus-Enum exakt 6 Werte hat
 * und alle String-Werte den PostgreSQL-ENUM-Labels entsprechen.
 */
import {DonationStatus, COUNTABLE_DONATION_STATUSES} from "../donation.types";

/* ===================================================================
// DonationStatus-Enum
// =================================================================== */

describe("DonationStatus", () => {
  /** Alle erwarteten Enum-Werte (entsprechen public.donation_status in Postgres). */
  const expectedValues: Record<string, string> = {
    pending: "pending",
    confirmed: "confirmed",
    failed: "failed",
    cancelled: "cancelled",
    refunded: "refunded",
    migrated: "migrated",
  };

  test("hat exakt 6 Werte", () => {
    const enumKeys = Object.keys(DonationStatus);
    expect(enumKeys).toHaveLength(6);
  });

  test("enthaelt alle erwarteten Schluessel", () => {
    const enumKeys = Object.keys(DonationStatus);
    expect(enumKeys.sort()).toEqual(Object.keys(expectedValues).sort());
  });

  test.each(Object.entries(expectedValues))(
    "Schluessel '%s' hat den String-Wert '%s' (entspricht PostgreSQL-Label)",
    (key, value) => {
      expect(DonationStatus[key as keyof typeof DonationStatus]).toBe(value);
    },
  );

  test("alle Werte sind Strings (keine numerischen Enums)", () => {
    const enumValues = Object.values(DonationStatus);
    for (const enumValue of enumValues) {
      expect(typeof enumValue).toBe("string");
    }
  });
});

/* ===================================================================
// COUNTABLE_DONATION_STATUSES
// =================================================================== */

describe("COUNTABLE_DONATION_STATUSES", () => {
  test("enthaelt confirmed und migrated", () => {
    expect(COUNTABLE_DONATION_STATUSES).toEqual(
      expect.arrayContaining([DonationStatus.confirmed, DonationStatus.migrated]),
    );
  });

  test("enthaelt keine nicht-zaehlbaren Status (pending/failed/cancelled/refunded)", () => {
    expect(COUNTABLE_DONATION_STATUSES).not.toEqual(
      expect.arrayContaining([
        DonationStatus.pending,
        DonationStatus.failed,
        DonationStatus.cancelled,
        DonationStatus.refunded,
      ]),
    );
  });

  test("hat exakt 2 Werte", () => {
    expect(COUNTABLE_DONATION_STATUSES).toHaveLength(2);
  });
});
