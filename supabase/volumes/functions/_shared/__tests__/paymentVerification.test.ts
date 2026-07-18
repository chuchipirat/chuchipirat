import {matchTransactionToDonation} from "../paymentVerification";

describe("matchTransactionToDonation", () => {
  test("referenceId und Betrag stimmen überein", () => {
    const result = matchTransactionToDonation(
      {referenceId: "donation-abc", amount: 500},
      "donation-abc",
      500,
    );

    expect(result).toEqual({matches: true});
  });

  test("referenceId der Transaktion gehört zu einer anderen Spende", () => {
    const result = matchTransactionToDonation(
      {referenceId: "donation-own-cheap-one", amount: 500},
      "donation-target-expensive-one",
      500000,
    );

    expect(result.matches).toBe(false);
    expect(result.reason).toMatch(/referenceId mismatch/);
  });

  test("Betrag der Transaktion weicht vom erwarteten Spendenbetrag ab", () => {
    const result = matchTransactionToDonation(
      {referenceId: "donation-abc", amount: 100},
      "donation-abc",
      500,
    );

    expect(result.matches).toBe(false);
    expect(result.reason).toMatch(/amount mismatch/);
  });

  test("unterstützt reference_id (snake_case) als Alternative zu referenceId", () => {
    const result = matchTransactionToDonation(
      {reference_id: "donation-abc", amount: 500},
      "donation-abc",
      500,
    );

    expect(result).toEqual({matches: true});
  });

  test("fehlende referenceId in der Transaktion gilt als Mismatch", () => {
    const result = matchTransactionToDonation({amount: 500}, "donation-abc", 500);

    expect(result.matches).toBe(false);
    expect(result.reason).toMatch(/referenceId mismatch/);
  });

  test("nicht-numerischer Betrag wird nicht als Mismatch gewertet (nur referenceId zählt dann)", () => {
    const result = matchTransactionToDonation(
      {referenceId: "donation-abc", amount: "n/a"},
      "donation-abc",
      500,
    );

    expect(result).toEqual({matches: true});
  });
});
