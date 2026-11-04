/**
 * Unit-Tests für DonationRepository.
 *
 * Aktuell abgedeckt: der UUID-Guard in getMyDonations(), der verhindert,
 * dass eine veraltete Firebase-UID an Postgres gereicht wird (Fehler 22P02),
 * sowie die Sentry-Filterung von erwarteten Sitzungs-/Netzfehlern
 * (CHUCHIPIRAT-FY).
 */
import * as Sentry from "@sentry/react";

import {DonationRepository} from "../DonationRepository";
import {ManualPaymentMethod} from "../../../Donate/donation.types";
import {createSupabaseMock} from "../__mocks__/supabaseMock";
import {AuthUser} from "../../../Session/authUser.class";

jest.mock("@sentry/react", () => ({
  captureException: jest.fn(),
}));

describe("DonationRepository.getMyDonations", () => {
  test("gibt leeres Array zurueck und stellt keine Query bei einer Firebase-UID", async () => {
    const {client, queryMock} = createSupabaseMock();
    const repo = new DonationRepository(client as any);

    const donations = await repo.getMyDonations({
      uid: "x2tJZZBSBgg1D0mrr0Rxc6EBV0v1",
    } as AuthUser);

    expect(donations).toEqual([]);
    expect(client.from).not.toHaveBeenCalled();
    expect(queryMock.select).not.toHaveBeenCalled();
  });

  test("stellt die Query bei einer gueltigen UUID", async () => {
    const {client, queryMock} = createSupabaseMock();
    queryMock.order.mockResolvedValue({data: [], error: null});
    const repo = new DonationRepository(client as any);

    await repo.getMyDonations({
      uid: "3f2504e0-4f89-41d3-9a0c-0305e82c3301",
    } as AuthUser);

    expect(client.from).toHaveBeenCalledWith("donations_view");
    expect(queryMock.eq).toHaveBeenCalledWith(
      "donor_uid",
      "3f2504e0-4f89-41d3-9a0c-0305e82c3301",
    );
  });
});

describe("DonationRepository.getEventDonations", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Das Repository wirft nur — die Aufrufer melden mit Kontext an Sentry.
  // Würde es selbst melden, entstünde pro Fehler ein doppelter Sentry-Eintrag.
  test("wirft einen abgelaufenen JWT weiter, ohne selbst an Sentry zu melden (CHUCHIPIRAT-FY)", async () => {
    const {client, queryMock} = createSupabaseMock();
    queryMock.order.mockResolvedValue({
      data: null,
      error: {code: "PGRST303", details: null, hint: null, message: "JWT expired"},
    });
    const repo = new DonationRepository(client as any);

    await expect(repo.getEventDonations("event-001")).rejects.toMatchObject({
      message: "JWT expired",
    });
    expect(Sentry.captureException).not.toHaveBeenCalled();
  });

  test("wirft einen unerwarteten Fehler weiter, ohne selbst an Sentry zu melden", async () => {
    const {client, queryMock} = createSupabaseMock();
    queryMock.order.mockResolvedValue({
      data: null,
      error: {code: "23505", details: null, hint: null, message: "duplicate key"},
    });
    const repo = new DonationRepository(client as any);

    await expect(repo.getEventDonations("event-001")).rejects.toMatchObject({
      message: "duplicate key",
    });
    expect(Sentry.captureException).not.toHaveBeenCalled();
  });
});

describe("DonationRepository.createManualDonation", () => {
  const input = {
    donorUid: "3f2504e0-4f89-41d3-9a0c-0305e82c3301",
    eventId: "event-1",
    amountInCents: 2500,
    paidAt: new Date(2026, 9, 20),
    paymentMethod: ManualPaymentMethod.bankTransfer,
    donorMessage: "Danke",
  };

  test("ruft die RPC mit allen Feldern auf und liefert die neue ID", async () => {
    const {client} = createSupabaseMock();
    client.rpc.mockResolvedValue({data: "donation-1", error: null});
    const repo = new DonationRepository(client as any);

    const donationId = await repo.createManualDonation(input);

    expect(client.rpc).toHaveBeenCalledWith("create_manual_donation", {
      p_donor_uid: input.donorUid,
      p_event_id: "event-1",
      p_amount_in_cents: 2500,
      p_paid_at: input.paidAt.toISOString(),
      p_payment_method: "manual_bank_transfer",
      p_donor_message: "Danke",
    });
    expect(donationId).toBe("donation-1");
  });

  test("ohne Anlass und Nachricht: null", async () => {
    const {client} = createSupabaseMock();
    client.rpc.mockResolvedValue({data: "donation-2", error: null});
    const repo = new DonationRepository(client as any);

    await repo.createManualDonation({
      ...input,
      eventId: null,
      donorMessage: "",
    });

    expect(client.rpc).toHaveBeenCalledWith(
      "create_manual_donation",
      expect.objectContaining({p_event_id: null, p_donor_message: null}),
    );
  });

  test("Fehler der Datenbank wird weitergegeben", async () => {
    const {client} = createSupabaseMock();
    const dbError = {message: "Nur Admins dürfen Spenden erfassen."};
    client.rpc.mockResolvedValue({data: null, error: dbError});
    const repo = new DonationRepository(client as any);

    await expect(repo.createManualDonation(input)).rejects.toBe(dbError);
  });
});
