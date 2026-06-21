/**
 * Hilfsfunktionen für das Kopieren von Events.
 *
 * Reine Utility-Funktionen ohne React-Abhängigkeiten — einfach testbar.
 */

/**
 * Berechnet die Dauer einer Zeitscheibe in Tagen (inklusiv).
 *
 * Start- und Enddatum zählen beide als volle Tage:
 * 15.04 – 17.04 = 3 Tage (15., 16., 17.)
 *
 * @param dateFrom Startdatum der Zeitscheibe.
 * @param dateTo Enddatum der Zeitscheibe.
 * @returns Dauer in Tagen (mindestens 1).
 *
 * @example
 * computeSliceDuration(new Date("2026-07-01"), new Date("2026-07-03")) // 3
 */
export function computeSliceDuration(dateFrom: Date, dateTo: Date): number {
  const msPerDay = 86_400_000;
  const diffMs = dateTo.getTime() - dateFrom.getTime();
  return Math.max(1, Math.round(diffMs / msPerDay) + 1);
}

/**
 * Berechnet das Enddatum basierend auf Startdatum und Dauer (inklusiv).
 *
 * Der Starttag zählt als Tag 1: Dauer 3 ab 15.04 → Enddatum 17.04.
 *
 * @param startDate Startdatum.
 * @param durationDays Dauer in Tagen (inklusiv, wie von computeSliceDuration).
 * @returns Enddatum.
 *
 * @example
 * computeEndDate(new Date("2026-08-05"), 3) // 2026-08-07
 */
export function computeEndDate(startDate: Date, durationDays: number): Date {
  const result = new Date(startDate);
  result.setDate(result.getDate() + durationDays - 1);
  return result;
}

/**
 * Berechnet Vorschläge für nachfolgende Zeitscheiben.
 *
 * Die Lücke (Gap) zwischen den From-Daten der Original-Zeitscheiben
 * wird beibehalten. Für die erste Zeitscheibe (sliceIndex === 0) wird
 * direkt newFirstSliceStart zurückgegeben.
 *
 * @param originalSlices Die ursprünglichen Zeitscheiben (sortiert nach Reihenfolge).
 * @param newFirstSliceStart Das neue Startdatum der ersten Zeitscheibe.
 * @param sliceIndex Index der Zeitscheibe, deren Startvorschlag berechnet wird.
 * @returns Vorgeschlagenes Startdatum für die Zeitscheibe am gegebenen Index.
 *
 * @example
 * const slices = [
 *   { dateFrom: new Date("2026-07-01"), dateTo: new Date("2026-07-05") },
 *   { dateFrom: new Date("2026-07-31"), dateTo: new Date("2026-08-04") },
 * ];
 * suggestNextSliceStart(slices, new Date("2026-09-01"), 1)
 * // => 2026-10-01 (30 Tage Gap beibehalten)
 */
export function suggestNextSliceStart(
  originalSlices: {dateFrom: Date; dateTo: Date}[],
  newFirstSliceStart: Date,
  sliceIndex: number,
): Date {
  if (sliceIndex <= 0 || originalSlices.length === 0) {
    return new Date(newFirstSliceStart);
  }

  // Lücke zwischen erstem und aktuellem Original-Startdatum berechnen
  const msPerDay = 86_400_000;
  const firstOriginalFrom = originalSlices[0].dateFrom;
  const currentOriginalFrom = originalSlices[Math.min(sliceIndex, originalSlices.length - 1)].dateFrom;
  const gapDays = Math.round(
    (currentOriginalFrom.getTime() - firstOriginalFrom.getTime()) / msPerDay,
  );

  const result = new Date(newFirstSliceStart);
  result.setDate(result.getDate() + gapDays);
  return result;
}
