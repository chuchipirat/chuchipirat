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

  test("meldet einen abgelaufenen JWT nicht an Sentry, wirft ihn aber weiter (CHUCHIPIRAT-FY)", async () => {
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

  test("meldet einen unerwarteten Fehler weiterhin an Sentry", async () => {
    const {client, queryMock} = createSupabaseMock();
    queryMock.order.mockResolvedValue({
      data: null,
      error: {code: "23505", details: null, hint: null, message: "duplicate key"},
    });
    const repo = new DonationRepository(client as any);

    await expect(repo.getEventDonations("event-001")).rejects.toMatchObject({
      message: "duplicate key",
    });
    expect(Sentry.captureException).toHaveBeenCalledTimes(1);
  });
});
