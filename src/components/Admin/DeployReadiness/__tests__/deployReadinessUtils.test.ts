/**
 * Unit-Tests für die Hilfsfunktionen der Deploy-Check-Seite.
 */
import {RecentActivityDomain} from "../../../Database/Repository/AdminOperationsRepository";
import {
  ACTIVE_NOW_MINUTES,
  countActivePeople,
  formatMinutesAgo,
  getMinutesAgo,
  isActiveNow,
} from "../deployReadinessUtils";

const NOW = new Date("2026-09-18T12:00:00Z");

/** Erstellt eine Aktivität, die `minutesAgo` Minuten vor NOW stattfand. */
const createActivity = (
  minutesAgo: number,
  overrides: Partial<RecentActivityDomain> = {},
): RecentActivityDomain => ({
  userId: "user-1",
  userName: "Gio",
  area: "event",
  objectId: "event-1",
  objectName: "SoLa 2026",
  lastActivityAt: new Date(NOW.getTime() - minutesAgo * 60_000),
  ...overrides,
});

describe("getMinutesAgo", () => {
  test("rundet auf volle Minuten ab", () => {
    expect(getMinutesAgo(new Date("2026-09-18T11:52:31Z"), NOW)).toBe(7);
  });

  test("liefert nie einen negativen Wert bei Uhren-Abweichung", () => {
    expect(getMinutesAgo(new Date("2026-09-18T12:00:05Z"), NOW)).toBe(0);
  });
});

describe("formatMinutesAgo", () => {
  test.each([
    [0, "gerade eben"],
    [1, "vor 1 Min."],
    [59, "vor 59 Min."],
    [60, "vor 1 h"],
    [125, "vor 2 h 5 Min."],
  ])("%i Minuten → %s", (minutes, expected) => {
    expect(formatMinutesAgo(minutes)).toBe(expected);
  });
});

describe("isActiveNow", () => {
  test("Grenze: genau ACTIVE_NOW_MINUTES gilt als aktiv", () => {
    expect(isActiveNow(createActivity(ACTIVE_NOW_MINUTES), NOW)).toBe(true);
  });

  test("eine Minute darüber gilt nicht mehr als aktiv", () => {
    expect(isActiveNow(createActivity(ACTIVE_NOW_MINUTES + 1), NOW)).toBe(
      false,
    );
  });
});

describe("countActivePeople", () => {
  test("zählt eine Person nur einmal, auch bei mehreren Objekten", () => {
    const activities = [
      createActivity(2, {objectId: "event-1"}),
      createActivity(5, {objectId: "event-2"}),
      createActivity(3, {userId: "user-2", userName: "Anna"}),
    ];
    expect(countActivePeople(activities, NOW)).toBe(2);
  });

  test("Systemprozesse (ohne userId) zählen nicht als Person", () => {
    const activities = [createActivity(1, {userId: null, userName: "System"})];
    expect(countActivePeople(activities, NOW)).toBe(0);
  });

  test("ältere Aktivität zählt nicht", () => {
    expect(countActivePeople([createActivity(120)], NOW)).toBe(0);
  });

  test("leere Liste → 0", () => {
    expect(countActivePeople([], NOW)).toBe(0);
  });
});
