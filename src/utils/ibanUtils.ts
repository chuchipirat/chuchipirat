/**
 * Form einer normalisierten IBAN: Ländercode, zwei Prüfziffern, 11–30
 * alphanumerische Zeichen (gesamt 15–34).
 *
 * Muss identisch zum CHECK `user_payment_details_iban_check` in
 * `20261009000001_add_user_payment_details.sql` bleiben — wer das Muster
 * hier ändert, braucht auch eine neue Migration.
 */
export const IBAN_FORMAT = /^[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}$/;

/**
 * Bringt eine eingegebene IBAN in die gespeicherte Form: ohne Leerzeichen, Grossbuchstaben.
 *
 * @param input - IBAN, wie sie eingegeben wurde (z.B. "ch93 0076 2011 6238 5295 7").
 * @returns Normalisierte IBAN (z.B. "CH9300762011623852957").
 * @example
 * normalizeIban(" ch93 0076 2011 6238 5295 7 ") // "CH9300762011623852957"
 */
export const normalizeIban = (input: string): string =>
  input.replace(/\s+/g, "").toUpperCase();

/**
 * Prüft Form und Prüfsumme (ISO 13616, Mod-97) einer **normalisierten** IBAN.
 *
 * Länderunabhängig: keine Längentabelle pro Land — Mod-97 erkennt
 * Tippfehler und Zahlendreher praktisch vollständig.
 *
 * @param iban - Normalisierte IBAN (siehe {@link normalizeIban}).
 * @returns `true`, wenn Form und Prüfsumme stimmen; `false` auch für nicht
 *   normalisierte Eingaben (Leerzeichen, Kleinbuchstaben).
 * @example
 * isValidIban("CH9300762011623852957") // true
 * isValidIban("CH9300762011623852958") // false (Prüfsumme)
 */
export const isValidIban = (iban: string): boolean => {
  if (!IBAN_FORMAT.test(iban)) return false;
  // Ländercode + Prüfziffern ans Ende, Buchstaben → Zahlen (A=10 … Z=35)
  const rearranged = iban.slice(4) + iban.slice(0, 4);
  const numeric = rearranged.replace(/[A-Z]/g, (letter) =>
    (letter.charCodeAt(0) - 55).toString(),
  );
  return BigInt(numeric) % 97n === 1n;
};

/**
 * Gruppiert eine IBAN für die Anzeige in Viererblöcken.
 *
 * @param iban - Normalisierte IBAN.
 * @returns IBAN mit Leerzeichen nach jedem vierten Zeichen (keins am Ende).
 * @example
 * formatIban("CH9300762011623852957") // "CH93 0076 2011 6238 5295 7"
 */
export const formatIban = (iban: string): string =>
  iban.replace(/(.{4})(?=.)/g, "$1 ");
