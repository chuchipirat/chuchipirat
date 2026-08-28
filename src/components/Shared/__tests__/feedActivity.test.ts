/**
 * Unit-Tests für postActivityFeed (feedActivity.ts).
 *
 * Regression CHUCHIPIRAT-GR: Ein fehlgeschlagener Aktivitäts-Feed-Insert
 * (transienter Netzfehler) wurde mehrfach als rohes "[object Object]" nach
 * Sentry gemeldet.
 */
import * as Sentry from "@sentry/react";

import {postActivityFeed} from "../feedActivity";
import {FeedType} from "../feed.class";
import type {DatabaseService} from "../../Database/DatabaseService";
import type {AuthUser} from "../../Session/authUser.class";

jest.mock("@sentry/react", () => ({
  captureException: jest.fn(),
}));

/* =====================================================================
// Test-Doubles
// ===================================================================== */

const authUser = {uid: "user-1"} as AuthUser;

/** Erzeugt einen DatabaseService-Mock, dessen insertFeed steuerbar ist. */
const createDatabaseMock = (insertFeed: jest.Mock) =>
  ({feeds: {insertFeed}} as unknown as DatabaseService);

const baseFeed = {
  feedType: FeedType.shoppingListCreated,
  sourceObjectType: "event",
  sourceObjectUid: "evt-1",
} as const;

/** Wartet, bis die (Mikrotask-)Promise-Kette in postActivityFeed durch ist. */
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

beforeEach(() => {
  jest.clearAllMocks();
});

/* =====================================================================
// Tests
// ===================================================================== */

describe("postActivityFeed", () => {
  test("ruft insertFeed mit Feed und AuthUser auf", () => {
    const insertFeed = jest.fn().mockResolvedValue({});
    const database = createDatabaseMock(insertFeed);

    postActivityFeed({database, feed: baseFeed, authUser, context: "Test"});

    expect(insertFeed).toHaveBeenCalledWith(baseFeed, authUser);
  });

  test("meldet nichts an Sentry bei Erfolg", async () => {
    const insertFeed = jest.fn().mockResolvedValue({});
    const database = createDatabaseMock(insertFeed);

    postActivityFeed({database, feed: baseFeed, authUser, context: "Test"});
    await flush();

    expect(Sentry.captureException).not.toHaveBeenCalled();
  });

  test("verschluckt einen vorübergehenden Netzfehler", async () => {
    const insertFeed = jest.fn().mockRejectedValue({
      code: "",
      details: "TypeError: Failed to fetch",
      hint: "",
      message: "TypeError: Failed to fetch (api.chuchipirat.ch)",
    });
    const database = createDatabaseMock(insertFeed);

    postActivityFeed({database, feed: baseFeed, authUser, context: "Test"});
    await flush();

    expect(Sentry.captureException).not.toHaveBeenCalled();
  });

  test("meldet einen echten Fehler genau einmal, normalisiert und mit Kontext", async () => {
    const supabaseError = {
      code: "23505",
      details: null,
      hint: null,
      message: "duplicate key value violates unique constraint",
    };
    const insertFeed = jest.fn().mockRejectedValue(supabaseError);
    const database = createDatabaseMock(insertFeed);

    postActivityFeed({
      database,
      feed: baseFeed,
      authUser,
      context: "Einkaufsliste erstellt",
    });
    await flush();

    expect(Sentry.captureException).toHaveBeenCalledTimes(1);
    const [reportedError, options] = (Sentry.captureException as jest.Mock).mock
      .calls[0];
    expect(reportedError).toBeInstanceOf(Error);
    expect(reportedError.message).toBe(
      "duplicate key value violates unique constraint",
    );
    expect(options).toMatchObject({
      level: "warning",
      extra: {context: "Aktivitäts-Feed: Einkaufsliste erstellt"},
    });
  });
});
