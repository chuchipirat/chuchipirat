import {trackServerEvent} from "../umamiHelper";

describe("trackServerEvent", () => {
  const originalFetch = global.fetch;
  const originalDeno = (globalThis as {Deno?: unknown}).Deno;

  const setDenoEnv = (env: Record<string, string | undefined>) => {
    (globalThis as {Deno?: unknown}).Deno = {
      env: {get: (key: string) => env[key]},
    };
  };

  afterEach(() => {
    global.fetch = originalFetch;
    (globalThis as {Deno?: unknown}).Deno = originalDeno;
    jest.restoreAllMocks();
  });

  test("sendet ein Event mit korrektem Payload und Browser-User-Agent an Umami", async () => {
    setDenoEnv({
      UMAMI_HOST: "https://umami.example.com",
      UMAMI_WEBSITE_ID: "site-123",
      APP_URL: "https://chuchipirat.ch",
    });
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve('{"cache":"..."}'),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    await trackServerEvent("donation_completed", {revenue: 20, currency: "CHF"});

    expect(fetchMock).toHaveBeenCalledWith(
      "https://umami.example.com/api/send",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "Content-Type": "application/json",
          // Muss wie ein echter Browser aussehen, sonst verwirft Umamis
          // Bot-Erkennung (isbot) das Event still (siehe Test unten)
          "User-Agent": expect.stringContaining("Mozilla"),
        }),
      }),
    );

    const [, options] = fetchMock.mock.calls[0];
    const body = JSON.parse(options.body as string);
    expect(body).toEqual({
      type: "event",
      payload: {
        website: "site-123",
        hostname: "chuchipirat.ch",
        url: "/server-events",
        name: "donation_completed",
        data: {revenue: 20, currency: "CHF"},
      },
    });
  });

  test("loggt eine Warnung, wenn Umami das Event als Bot verwirft (beep-boop-Decoy)", async () => {
    setDenoEnv({
      UMAMI_HOST: "https://umami.example.com",
      UMAMI_WEBSITE_ID: "site-123",
      APP_URL: "https://chuchipirat.ch",
    });
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve('{"beep":"boop"}'),
    }) as unknown as typeof fetch;
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    await trackServerEvent("donation_completed");

    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining("verworfen"),
    );
  });

  test("loggt eine Warnung, wenn Umami einen Fehlerstatus zurückgibt", async () => {
    setDenoEnv({
      UMAMI_HOST: "https://umami.example.com",
      UMAMI_WEBSITE_ID: "site-123",
      APP_URL: "https://chuchipirat.ch",
    });
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 400,
      text: () => Promise.resolve("Invalid payload"),
    }) as unknown as typeof fetch;
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    await trackServerEvent("donation_completed");

    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining("HTTP 400"),
    );
  });

  test("sendet nichts, wenn UMAMI_HOST fehlt", async () => {
    setDenoEnv({UMAMI_WEBSITE_ID: "site-123"});
    const fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;

    await trackServerEvent("donation_completed");

    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("sendet nichts, wenn UMAMI_WEBSITE_ID fehlt", async () => {
    setDenoEnv({UMAMI_HOST: "https://umami.example.com"});
    const fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;

    await trackServerEvent("donation_completed");

    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("wirft nicht, wenn fetch fehlschlägt", async () => {
    setDenoEnv({UMAMI_HOST: "https://umami.example.com", UMAMI_WEBSITE_ID: "site-123"});
    global.fetch = jest.fn().mockRejectedValue(new Error("network down")) as unknown as typeof fetch;
    jest.spyOn(console, "error").mockImplementation(() => {});

    await expect(trackServerEvent("donation_completed")).resolves.toBeUndefined();
  });
});
