/**
 * Hilfsfunktionen für die Datumverarbeitung.
 *
 * Postgres `date`-Spalten liefern Strings im Format "YYYY-MM-DD".
 * `new Date("YYYY-MM-DD")` parst als UTC-Mitternacht, was in CET/CEST
 * zum Vortag werden kann. Diese Funktionen stellen sicher, dass Daten
 * korrekt als lokale Daten interpretiert werden.
 */

/**
 * Parst einen Datums-String aus der Datenbank als lokales Datum.
 *
 * Hängt "T00:00:00" an, damit JavaScript das Datum als lokale
 * Mitternacht interpretiert statt als UTC-Mitternacht.
 *
 * @param dateStr - Datum als "YYYY-MM-DD" String aus der Datenbank
 * @returns Date-Objekt auf lokale Mitternacht
 *
 * @example
 * // Statt: new Date("2026-05-16")    → UTC-Mitternacht (falsch in CET)
 * // Verwende: parseLocalDate("2026-05-16") → lokale Mitternacht (korrekt)
 */
export function parseLocalDate(dateStr: string): Date {
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return new Date(dateStr + "T00:00:00");
  }
  return new Date(dateStr);
}

/**
 * Formatiert ein Date-Objekt als lokales "YYYY-MM-DD".
 *
 * Verwendet `.getFullYear()`, `.getMonth()`, `.getDate()` (lokale Zeitzone)
 * statt `.toISOString()` (UTC), damit das Datum in CET/CEST nicht zum
 * Vortag verschoben wird.
 *
 * @param date - Das zu formatierende Datum
 * @returns Datumsstring im Format YYYY-MM-DD
 *
 * @example
 * // Statt: date.toISOString().split("T")[0]  → kann falschen Tag geben
 * // Verwende: formatLocalDate(date)           → immer korrekter lokaler Tag
 */
export function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
