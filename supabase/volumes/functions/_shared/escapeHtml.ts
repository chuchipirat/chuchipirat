/**
 * Maskiert HTML-Sonderzeichen, um XSS zu verhindern.
 *
 * Eigenständiges, von Deno-spezifischen Imports freies Modul (analog zu
 * chunkArray.ts/fetchAllRows.ts), damit es direkt per Jest testbar ist und
 * von anderen testbaren Modulen (z.B. personalize.ts) importiert werden
 * kann, ohne den nicht-testbaren `denomailer`-Import aus emailService.ts
 * mitzuschleppen. emailService.ts re-exportiert diese Funktion unverändert,
 * bestehende Importe aus "../_shared/emailService.ts" bleiben gültig.
 *
 * @example
 * import { escapeHtml } from "../_shared/escapeHtml.ts";
 * escapeHtml('<script>alert("x")</script>');
 */

/**
 * Maskiert `& < > " '` durch ihre HTML-Entities.
 *
 * @param text - Der zu maskierende Text.
 * @returns Maskierter Text.
 */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
