/**
 * Formatiert einen Rappen-Betrag als lokalisierten Waehrungsstring.
 *
 * @param amountInCents - Betrag in Rappen (z.B. 200000 fuer CHF 2'000).
 * @param currency - ISO-4217-Waehrungscode (z.B. "CHF", "EUR").
 * @returns Formatierter Betrag, z.B. "CHF 2'000.00".
 */
export const formatAmountFromCents = (
  amountInCents: number,
  currency: string,
): string => {
  return new Intl.NumberFormat("de-CH", {
    style: "currency",
    currency,
  }).format(amountInCents / 100);
};

/**
 * Parst einen vom User eingegebenen Betrag (z.B. "8.50" oder "8,50") in Rappen.
 *
 * @param input - Roher Eingabewert aus dem Textfeld.
 * @returns Betrag in Rappen, oder null, falls die Eingabe kein gueltiger Betrag ist.
 */
export const parseAmountToCents = (input: string): number | null => {
  const normalized = input.trim().replace(",", ".");
  if (normalized.length === 0 || Number.isNaN(Number(normalized))) {
    return null;
  }
  return Math.round(Number(normalized) * 100);
};
