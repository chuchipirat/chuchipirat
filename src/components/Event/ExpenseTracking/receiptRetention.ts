/**
 * Aufbewahrungsfrist der Belege in der App. Muss zur Regel des Löschjobs
 * passen (`supabase/volumes/functions/_shared/receiptRetention.ts`): Belege
 * werden ab dem Tag ein Jahr nach Anlassende gelöscht.
 */
import {EventDate} from "../Event/event.class";

/**
 * Anlassende: das späteste Enddatum aller Zeitscheiben.
 *
 * @param dates - Zeitscheiben des Anlasses.
 * @returns Anlassende, `null` ohne Zeitscheiben.
 * @example
 * getEventEnd(event.dates) // Date des letzten Tages
 */
export const getEventEnd = (dates: EventDate[]): Date | null =>
  dates.reduce<Date | null>(
    (latest, date) => (latest === null || date.to > latest ? date.to : latest),
    null,
  );

/**
 * Ob die Aufbewahrungsfrist vorbei ist, die Belege also gelöscht werden.
 * Ein Anlassende am 29.02. ergibt wie im Löschjob den 01.03. des Folgejahrs.
 *
 * @param eventEnd - Anlassende, `null` wenn unbekannt.
 * @param today - Heutiges Datum.
 * @returns `true` ab dem Tag ein Jahr nach Anlassende, sonst `false`.
 * @example
 * isReceiptRetentionOver(new Date(2025, 6, 12), new Date(2026, 6, 12)) // true
 */
export const isReceiptRetentionOver = (
  eventEnd: Date | null,
  today: Date,
): boolean => {
  if (eventEnd === null) return false;

  const deletionDate = new Date(
    eventEnd.getFullYear() + 1,
    eventEnd.getMonth(),
    eventEnd.getDate(),
  );
  const todayAtMidnight = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  );
  return todayAtMidnight >= deletionDate;
};
