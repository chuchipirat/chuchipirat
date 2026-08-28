/**
 * Unit-Tests für subscribeWithRetry (realtimeSubscription.ts).
 *
 * Deckt das Reconnect-/Backoff-Verhalten ab, das bisher in den einzelnen
 * Repositories dupliziert war.
 */
import * as Sentry from "@sentry/react";
import {subscribeWithRetry} from "../realtimeSubscription";

jest.mock("@sentry/react", () => ({
  addBreadcrumb: jest.fn(),
  captureException: jest.fn(),
}));

/* =====================================================================
// Test-Doubles
// ===================================================================== */

type MockChannel = {
  on: jest.Mock;
  subscribe: jest.Mock;
};

/** Erzeugt einen chainbaren Channel-Mock (on/subscribe geben `this` zurück). */
const createMockChannel = (): MockChannel => {
  const channel: MockChannel = {
    on: jest.fn(() => channel),
    subscribe: jest.fn(() => channel),
  };
  return channel;
};

/** Erzeugt einen Supabase-Client-Mock, der bei jedem channel() einen neuen Mock liefert. */
const createClientMock = () => {
  const channels: MockChannel[] = [];
  const client = {
    channel: jest.fn(() => {
      const channel = createMockChannel();
      channels.push(channel);
      return channel;
    }),
    removeChannel: jest.fn(),
  };
  return {client, channels};
};

/** Liest den zuletzt registrierten subscribe-Status-Callback aus. */
const lastStatusCallback = (channels: MockChannel[]) => {
  const channel = channels[channels.length - 1];
  return channel.subscribe.mock.calls[0][0] as (
    status: string,
    err?: Error,
  ) => void;
};

const baseParams = (client: unknown) => ({
  client: client as never,
  channelName: "event:evt-1",
  bindings: [
    {table: "events", filter: "id=eq.evt-1"},
    {table: "event_cooks", filter: "event_id=eq.evt-1"},
  ],
  onChange: jest.fn(),
  onError: jest.fn(),
});

beforeEach(() => {
  jest.clearAllMocks();
});

/* =====================================================================
// Tests
// ===================================================================== */

describe("subscribeWithRetry", () => {
  test("erstellt den Channel mit Namen und registriert jede Binding", () => {
    const {client, channels} = createClientMock();
    const params = baseParams(client);

    subscribeWithRetry(params);

    expect(client.channel).toHaveBeenCalledWith("event:evt-1");
    expect(channels[0].on).toHaveBeenCalledTimes(2);
    expect(channels[0].on).toHaveBeenNthCalledWith(
      1,
      "postgres_changes",
      {event: "*", schema: "public", table: "events", filter: "id=eq.evt-1"},
      expect.any(Function),
    );
    expect(channels[0].on).toHaveBeenNthCalledWith(
      2,
      "postgres_changes",
      expect.objectContaining({table: "event_cooks"}),
      expect.any(Function),
    );
  });

  test("ruft onChange bei einer Datenänderung auf", () => {
    const {client, channels} = createClientMock();
    const params = baseParams(client);

    subscribeWithRetry(params);
    const changeHandler = channels[0].on.mock.calls[0][2] as () => void;
    changeHandler();

    expect(params.onChange).toHaveBeenCalledTimes(1);
  });

  test("leitet einen synchronen Fehler aus onChange an onError", () => {
    const {client, channels} = createClientMock();
    const params = {
      ...baseParams(client),
      onChange: jest.fn(() => {
        throw new Error("boom sync");
      }),
    };

    subscribeWithRetry(params);
    (channels[0].on.mock.calls[0][2] as () => void)();

    expect(params.onError).toHaveBeenCalledWith(expect.any(Error));
    expect(params.onError.mock.calls[0][0].message).toBe("boom sync");
  });

  test("leitet ein rejectetes Promise aus onChange an onError", async () => {
    const {client, channels} = createClientMock();
    const params = {
      ...baseParams(client),
      onChange: jest.fn(() => Promise.reject(new Error("boom async"))),
    };

    subscribeWithRetry(params);
    (channels[0].on.mock.calls[0][2] as () => void)();
    await Promise.resolve();

    expect(params.onError).toHaveBeenCalledWith(expect.any(Error));
    expect(params.onError.mock.calls[0][0].message).toBe("boom async");
  });

  test("meldet bei SUBSCRIBED keinen Fehler", () => {
    const {client, channels} = createClientMock();
    const params = baseParams(client);

    subscribeWithRetry(params);
    lastStatusCallback(channels)("SUBSCRIBED");

    expect(params.onError).not.toHaveBeenCalled();
    expect(Sentry.captureException).not.toHaveBeenCalled();
  });

  describe("Backoff-Reconnect", () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => jest.useRealTimers());

    test("verbindet nach CHANNEL_ERROR mit exponentiellem Backoff neu", () => {
      const {client, channels} = createClientMock();
      const params = baseParams(client);

      subscribeWithRetry(params);
      expect(channels).toHaveLength(1);

      lastStatusCallback(channels)("CHANNEL_ERROR", new Error("net"));
      expect(client.removeChannel).toHaveBeenCalledWith(channels[0]);
      expect(Sentry.addBreadcrumb).toHaveBeenCalledWith(
        expect.objectContaining({
          category: "realtime",
          message: "event:evt-1 CHANNEL_ERROR (Versuch 1/5)",
        }),
      );
      expect(channels).toHaveLength(1);

      jest.advanceTimersByTime(1000);
      expect(channels).toHaveLength(2);

      // Zweiter Fehlversuch — Backoff jetzt 2s
      lastStatusCallback(channels)("CHANNEL_ERROR", new Error("net"));
      jest.advanceTimersByTime(1999);
      expect(channels).toHaveLength(2);
      jest.advanceTimersByTime(1);
      expect(channels).toHaveLength(3);
    });

    test("behandelt TIMED_OUT wie CHANNEL_ERROR", () => {
      const {client, channels} = createClientMock();
      subscribeWithRetry(baseParams(client));

      lastStatusCallback(channels)("TIMED_OUT");
      jest.advanceTimersByTime(1000);

      expect(channels).toHaveLength(2);
    });

    test("meldet nach maxRetries einen permanenten Fehler und stoppt", () => {
      const {client, channels} = createClientMock();
      const params = baseParams(client);

      subscribeWithRetry(params);

      const delays = [1000, 2000, 4000, 8000, 16000];
      for (const delay of delays) {
        lastStatusCallback(channels)("CHANNEL_ERROR", new Error("net"));
        jest.advanceTimersByTime(delay);
      }
      // 6. Fehlschlag auf dem letzten Retry-Channel
      lastStatusCallback(channels)("CHANNEL_ERROR", new Error("net"));

      expect(channels).toHaveLength(6);
      expect(params.onError).toHaveBeenCalledTimes(1);
      expect(params.onError.mock.calls[0][0].message).toBe(
        "Realtime-Verbindung für event:evt-1 nach 5 Versuchen fehlgeschlagen",
      );
      expect(Sentry.captureException).toHaveBeenCalledTimes(1);

      // Kein weiterer Reconnect
      jest.advanceTimersByTime(60_000);
      expect(channels).toHaveLength(6);
    });

    test("Unsubscribe räumt Channel und ausstehenden Retry-Timer auf", () => {
      const {client, channels} = createClientMock();
      const unsubscribe = subscribeWithRetry(baseParams(client));

      lastStatusCallback(channels)("CHANNEL_ERROR", new Error("net"));
      unsubscribe();

      jest.advanceTimersByTime(60_000);
      expect(channels).toHaveLength(1); // kein Reconnect nach Unsubscribe
    });

    test("ignoriert Status-Callbacks nach dem Unsubscribe", () => {
      const {client, channels} = createClientMock();
      const params = baseParams(client);
      const unsubscribe = subscribeWithRetry(params);

      unsubscribe();
      lastStatusCallback(channels)("CHANNEL_ERROR", new Error("net"));
      jest.advanceTimersByTime(60_000);

      expect(params.onError).not.toHaveBeenCalled();
      expect(channels).toHaveLength(1);
    });
  });
});
