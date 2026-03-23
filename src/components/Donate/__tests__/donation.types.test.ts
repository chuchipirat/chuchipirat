/**
 * Unit-Tests fuer donation.types.
 *
 * Stellt sicher, dass das DonationStatus-Enum exakt 6 Werte hat
 * und alle String-Werte den PostgreSQL-ENUM-Labels entsprechen.
 */
import {DonationStatus} from "../donation.types";

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
