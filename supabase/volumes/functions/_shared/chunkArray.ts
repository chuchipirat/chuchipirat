/**
 * Zerlegt ein Array in aufeinanderfolgende Teil-Arrays fester Grösse.
 *
 * Wird für den Batch-Versand über die Mail-Konsole verwendet (Brevos
 * `messageVersions`-Feld erlaubt nur eine begrenzte Anzahl Empfänger pro
 * API-Call, siehe emailService.ts/sendBulkEmail). Bewusst als eigenständiges,
 * von Deno-spezifischen Imports freies Modul (analog zu fetchAllRows.ts),
 * damit es direkt per Jest testbar ist — emailService.ts selbst kann das
 * wegen seines `https://deno.land/...`-Imports (denomailer) nicht.
 *
 * @example
 * import { chunkArray } from "../_shared/chunkArray.ts";
 * chunkArray([1, 2, 3, 4, 5], 2); // [[1, 2], [3, 4], [5]]
 */

/**
 * Teilt `items` in Teil-Arrays der Länge `size` auf (das letzte kann kürzer sein).
 *
 * @param items - Zu zerlegendes Array.
 * @param size - Maximale Grösse pro Teil-Array (muss > 0 sein).
 * @returns Array der Teil-Arrays; leeres Array falls `items` leer ist.
 */
export function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}
