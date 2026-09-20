/**
 * Hilfsfunktionen für die Deploy-Check-Seite.
 *
 * Reine Funktionen ohne Seiteneffekte, damit sie ohne Rendering testbar sind.
 */
import {RecentActivityDomain} from "../../Database/Repository/AdminOperationsRepository";

/** Innerhalb dieser Zeit gilt eine Person als «gerade aktiv». */
export const ACTIVE_NOW_MINUTES = 15;

/** Intervall der automatischen Aktualisierung in Millisekunden. */
export const AUTO_REFRESH_INTERVAL_MS = 30_000;

const MINUTES_PER_HOUR = 60;
const MILLISECONDS_PER_MINUTE = 60_000;

/**
 * Berechnet, wie viele volle Minuten ein Zeitpunkt zurückliegt.
 *
 * @param date Zeitpunkt in der Vergangenheit.
 * @param now Referenzzeitpunkt.
 * @returns Volle Minuten seit `date`; nie negativ (Uhren-Abweichung).
 * @example
 * getMinutesAgo(new Date("2026-09-18T10:00:00Z"), new Date("2026-09-18T10:07:30Z")) // 7
 */
export const getMinutesAgo = (date: Date, now: Date): number =>
  Math.max(
    0,
    Math.floor((now.getTime() - date.getTime()) / MILLISECONDS_PER_MINUTE),
  );

/**
 * Formatiert eine Minutenzahl als «vor …»-Text.
 *
 * @param minutes Minuten seit dem Ereignis.
 * @returns Text wie «gerade eben», «vor 7 Min.» oder «vor 2 h 5 Min.».
 * @example
 * formatMinutesAgo(125) // "vor 2 h 5 Min."
 */
export const formatMinutesAgo = (minutes: number): string => {
  if (minutes < 1) return "gerade eben";
  if (minutes < MINUTES_PER_HOUR) return `vor ${minutes} Min.`;
  const hours = Math.floor(minutes / MINUTES_PER_HOUR);
  const remainingMinutes = minutes % MINUTES_PER_HOUR;
  return remainingMinutes === 0
    ? `vor ${hours} h`
    : `vor ${hours} h ${remainingMinutes} Min.`;
};

/**
 * Prüft, ob eine Aktivität innerhalb des «gerade aktiv»-Fensters liegt.
 *
 * @param activity Aktivität aus der Datenbank.
 * @param now Referenzzeitpunkt.
 * @returns `true`, wenn die letzte Änderung höchstens {@link ACTIVE_NOW_MINUTES} Minuten zurückliegt.
 */
export const isActiveNow = (
  activity: RecentActivityDomain,
  now: Date,
): boolean => getMinutesAgo(activity.lastActivityAt, now) <= ACTIVE_NOW_MINUTES;

/**
 * Zählt die Personen, die gerade aktiv sind.
 *
 * Systemprozesse (ohne `userId`) zählen nicht als Person, jede Person wird
 * nur einmal gezählt, auch wenn sie in mehreren Objekten arbeitet.
 *
 * @param activities Aktivitäten aus der Datenbank.
 * @param now Referenzzeitpunkt.
 * @returns Anzahl unterschiedlicher, gerade aktiver Personen.
 * @example
 * countActivePeople(activities, new Date()) // 2
 */
export const countActivePeople = (
  activities: RecentActivityDomain[],
  now: Date,
): number => {
  const activeUserIds = new Set<string>();
  activities.forEach((activity) => {
    if (activity.userId && isActiveNow(activity, now)) {
      activeUserIds.add(activity.userId);
    }
  });
  return activeUserIds.size;
};
