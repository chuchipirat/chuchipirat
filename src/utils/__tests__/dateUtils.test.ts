/**
 * Unit-Tests für die Datumsanzeige (dateUtils.ts).
 */
import {formatDisplayDate} from "../dateUtils";

describe("formatDisplayDate", () => {
  test("Schweizer Format mit führenden Nullen", () => {
    expect(formatDisplayDate(new Date(2026, 6, 9))).toBe("09.07.2026");
  });

  test("ohne Uhrzeit, auch kurz vor Mitternacht", () => {
    expect(formatDisplayDate(new Date(2026, 11, 31, 23, 59))).toBe(
      "31.12.2026",
    );
  });
});
