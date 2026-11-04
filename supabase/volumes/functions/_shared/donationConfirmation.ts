/**
 * Bestätigt eine bezahlte Spende im Webhook des Zahlungsanbieters.
 *
 * Bisher prüfte der Webhook weder das Erzeugen der Quittungsnummer noch das
 * Update. Zeigte die Sequenz auf eine schon vergebene Nummer, lehnte der
 * Unique-Index das Update ab und die bezahlte Spende blieb ohne Meldung
 * «pending». Hier wird jeder Fehler geworfen; der Webhook meldet ihn an
 * Sentry und antwortet mit 500, damit der Zahlungsanbieter erneut zustellt.
 */

/** Fehler aus Supabase, soweit hier gebraucht. */
type DatabaseError = {message: string; code?: string};

/**
 * Der Teil des Supabase-Clients, den das Bestätigen braucht. So lässt sich
 * die Funktion ohne Datenbank testen.
 */
export type DonationConfirmationClient = {
  rpc: (
    functionName: string,
  ) => PromiseLike<{data: unknown; error: DatabaseError | null}>;
  from: (table: string) => {
    update: (values: Record<string, unknown>) => {
      eq: (
        column: string,
        value: string,
      ) => PromiseLike<{error: DatabaseError | null}>;
    };
  };
};

/**
 * Angaben zur bestätigten Zahlung.
 *
 * @param donationId - ID der Spende.
 * @param paymentMethod - Zahlungsart laut Zahlungsanbieter.
 * @param transactionId - Transaktions-ID beim Zahlungsanbieter.
 * @param paidAt - Zeitpunkt der Bestätigung.
 */
export type DonationConfirmation = {
  donationId: string;
  paymentMethod: string;
  transactionId: string;
  paidAt: Date;
};

/** Code von Postgres für eine verletzte Eindeutigkeit. */
const UNIQUE_VIOLATION = "23505";
/** Versuche bei schon vergebener Quittungsnummer. */
const MAX_ATTEMPTS = 3;

/**
 * Setzt die Spende auf «confirmed» und vergibt eine Quittungsnummer. Ist die
 * Nummer schon vergeben (Sequenz hinter den vorhandenen Nummern), wird eine
 * neue gezogen, höchstens dreimal.
 *
 * @param client - Supabase-Client mit Service Role.
 * @param confirmation - Siehe {@link DonationConfirmation}.
 * @returns Die vergebene Quittungsnummer.
 * @throws Error, wenn keine Nummer erzeugt oder die Spende nicht gespeichert
 *   werden kann.
 * @example
 * const receiptNumber = await confirmDonation(adminClient, {
 *   donationId, paymentMethod: "twint", transactionId, paidAt: new Date(),
 * });
 */
export async function confirmDonation(
  client: DonationConfirmationClient,
  confirmation: DonationConfirmation,
): Promise<string> {
  for (let attempt = 1; ; attempt++) {
    const receiptNumber = await generateReceiptNumber(client);

    const {error} = await client
      .from("donations")
      .update({
        status: "confirmed",
        paid_at: confirmation.paidAt.toISOString(),
        payment_method: confirmation.paymentMethod,
        payment_transaction_id: confirmation.transactionId,
        receipt_number: receiptNumber,
      })
      .eq("id", confirmation.donationId);

    if (!error) return receiptNumber;
    if (error.code !== UNIQUE_VIOLATION || attempt >= MAX_ATTEMPTS) {
      throw new Error(`Spende bestätigen fehlgeschlagen: ${error.message}`);
    }
  }
}

/**
 * Zieht die nächste Quittungsnummer.
 *
 * @param client - Supabase-Client mit Service Role.
 * @returns Die Nummer, z.B. «2026-0014».
 * @throws Error, wenn keine Nummer erzeugt werden kann.
 */
async function generateReceiptNumber(
  client: DonationConfirmationClient,
): Promise<string> {
  const {data, error} = await client.rpc("generate_donation_receipt_number");
  if (error) {
    throw new Error(
      `Quittungsnummer erzeugen fehlgeschlagen: ${error.message}`,
    );
  }
  if (typeof data !== "string" || !data) {
    throw new Error("Quittungsnummer erzeugen lieferte keine Nummer");
  }
  return data;
}
