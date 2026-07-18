/**
 * Prüfergebnis für den Abgleich einer verifizierten Zahlungsanbieter-Transaktion
 * gegen die lokal erwartete Spende.
 *
 * @property matches - Ob Transaktion und Spende zusammenpassen.
 * @property reason - Grund der Nichtübereinstimmung (nur gesetzt wenn `matches` false ist).
 */
export interface TransactionMatchResult {
  matches: boolean;
  reason?: string;
}

/**
 * Prüft, ob eine beim Zahlungsanbieter verifizierte Transaktion tatsächlich zur
 * angefragten Spende gehört (referenceId und Betrag müssen übereinstimmen).
 *
 * Verhindert, dass eine echte, aber unabhängige Transaktions-ID zusammen mit
 * einer fremden referenceId eingereicht wird, um eine beliebige Spende als
 * bezahlt zu markieren, obwohl die Transaktion nie dafür bestimmt war.
 *
 * @param verifiedTx - Die beim Zahlungsanbieter abgerufene Transaktion (rohes Objekt aus der API-Antwort).
 * @param expectedReferenceId - Die referenceId (= Spenden-UUID), gegen die geprüft wird.
 * @param expectedAmountInCents - Der erwartete Spendenbetrag in Rappen/Cents.
 * @returns Prüfergebnis mit `matches` und optionalem `reason` bei Nichtübereinstimmung.
 * @example
 * matchTransactionToDonation({referenceId: "abc", amount: 500}, "abc", 500)
 * // { matches: true }
 */
export function matchTransactionToDonation(
  verifiedTx: Record<string, unknown>,
  expectedReferenceId: string,
  expectedAmountInCents: number,
): TransactionMatchResult {
  const verifiedReferenceId = String(
    verifiedTx.referenceId ?? verifiedTx.reference_id ?? "",
  );
  if (verifiedReferenceId !== expectedReferenceId) {
    return {
      matches: false,
      reason: `referenceId mismatch (erwartet ${expectedReferenceId}, erhalten ${verifiedReferenceId})`,
    };
  }

  const verifiedAmount = Number(verifiedTx.amount);
  if (Number.isFinite(verifiedAmount) && verifiedAmount !== expectedAmountInCents) {
    return {
      matches: false,
      reason: `amount mismatch (erwartet ${expectedAmountInCents}, erhalten ${verifiedAmount})`,
    };
  }

  return {matches: true};
}
