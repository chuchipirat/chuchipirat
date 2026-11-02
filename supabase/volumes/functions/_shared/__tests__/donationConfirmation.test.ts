/**
 * Unit-Tests für das Bestätigen einer bezahlten Spende im Webhook
 * (donationConfirmation.ts). Schlägt ein Schritt still fehl, bleibt eine
 * bezahlte Spende «pending»: keine Freischaltung, keine Mail, kein Fehler.
 */
import {
  confirmDonation,
  DonationConfirmationClient,
} from "../donationConfirmation";

type DbError = {message: string; code?: string};

/**
 * Attrappe des Supabase-Clients mit vorgegebenen Antworten.
 *
 * @param receiptResults - Antworten auf `generate_donation_receipt_number`.
 * @param updateErrors - Fehler der Updates, der Reihe nach (`null` = ok).
 */
const createClient = (
  receiptResults: {data: string | null; error: DbError | null}[],
  updateErrors: (DbError | null)[],
) => {
  const updates: Record<string, unknown>[] = [];
  const client: DonationConfirmationClient = {
    rpc: jest.fn(async () => receiptResults.shift()!),
    from: jest.fn(() => ({
      update: (values: Record<string, unknown>) => ({
        eq: async () => {
          updates.push(values);
          return {error: updateErrors.shift() ?? null};
        },
      }),
    })),
  };
  return {client, updates};
};

const INPUT = {
  donationId: "donation-1",
  paymentMethod: "twint",
  transactionId: "tx-1",
  paidAt: new Date("2026-11-02T10:00:00Z"),
};

describe("confirmDonation", () => {
  test("bestätigt mit Quittungsnummer und liefert sie", async () => {
    const {client, updates} = createClient(
      [{data: "2026-0014", error: null}],
      [null],
    );

    await expect(confirmDonation(client, INPUT)).resolves.toBe("2026-0014");
    expect(client.from).toHaveBeenCalledWith("donations");
    expect(updates).toEqual([
      {
        status: "confirmed",
        paid_at: "2026-11-02T10:00:00.000Z",
        payment_method: "twint",
        payment_transaction_id: "tx-1",
        receipt_number: "2026-0014",
      },
    ]);
  });

  test("Nummer schon vergeben: zieht eine neue", async () => {
    const {client, updates} = createClient(
      [
        {data: "2026-0007", error: null},
        {data: "2026-0008", error: null},
      ],
      [{code: "23505", message: "duplicate key"}, null],
    );

    await expect(confirmDonation(client, INPUT)).resolves.toBe("2026-0008");
    expect(updates.map((update) => update.receipt_number)).toEqual([
      "2026-0007",
      "2026-0008",
    ]);
  });

  test("Nummer bleibt vergeben: wirft nach drei Versuchen", async () => {
    const duplicate = {code: "23505", message: "duplicate key"};
    const {client} = createClient(
      [
        {data: "2026-0001", error: null},
        {data: "2026-0002", error: null},
        {data: "2026-0003", error: null},
      ],
      [duplicate, duplicate, duplicate],
    );

    await expect(confirmDonation(client, INPUT)).rejects.toThrow(
      "duplicate key",
    );
    expect(client.rpc).toHaveBeenCalledTimes(3);
  });

  test("Quittungsnummer nicht erhältlich: wirft, ohne zu bestätigen", async () => {
    const {client, updates} = createClient(
      [{data: null, error: {message: "permission denied"}}],
      [],
    );

    await expect(confirmDonation(client, INPUT)).rejects.toThrow(
      "permission denied",
    );
    expect(updates).toEqual([]);
  });

  test("leere Quittungsnummer: wirft, ohne zu bestätigen", async () => {
    const {client, updates} = createClient([{data: null, error: null}], []);

    await expect(confirmDonation(client, INPUT)).rejects.toThrow();
    expect(updates).toEqual([]);
  });

  test("anderer Fehler beim Update: wirft sofort", async () => {
    const {client} = createClient(
      [{data: "2026-0014", error: null}],
      [{code: "42501", message: "permission denied"}],
    );

    await expect(confirmDonation(client, INPUT)).rejects.toThrow(
      "permission denied",
    );
    expect(client.rpc).toHaveBeenCalledTimes(1);
  });
});
