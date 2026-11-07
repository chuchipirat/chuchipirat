/**
 * Unit-Tests für die Sentry-Konfiguration.
 *
 * Schwerpunkt Datenschutz: Seit Sentry 11 sammelt das SDK ohne Angabe von
 * `dataCollection` u.a. alle HTTP-Bodies (bei uns Supabase-Antworten mit
 * Rezepten, Teilnehmenden, E-Mail-Adressen). Die Tests halten fest, dass das
 * ausgeschaltet bleibt, der User-Agent für Browser/OS aber durchkommt.
 */
import {redactSupabaseErrorDetails} from "../utils/errorUtils";
import {
  buildSentryOptions,
  shouldCreateSpanForRequest,
  type SentryEnvironment,
} from "../sentryOptions";

const ENVIRONMENT: SentryEnvironment = {
  dsn: "https://key@example.ingest.sentry.io/1",
  environment: "test",
  release: "9.9.9",
  enabled: true,
};

describe("buildSentryOptions()", () => {
  it("übernimmt DSN, Umgebung, Release und Schalter", () => {
    const options = buildSentryOptions(ENVIRONMENT);

    expect(options).toMatchObject(ENVIRONMENT);
  });

  it("schickt keine HTTP-Bodies, Cookies und automatischen User-Daten", () => {
    const {dataCollection} = buildSentryOptions(ENVIRONMENT);

    expect(dataCollection?.httpBodies).toEqual([]);
    expect(dataCollection?.cookies).toBe(false);
    expect(dataCollection?.userInfo).toBe(false);
  });

  it("lässt bei den Headern nur User-Agent und Referer durch", () => {
    // ohne User-Agent fehlen Browser/OS am Event und Sentrys Crawler-Filter greift nicht
    const {dataCollection} = buildSentryOptions(ENVIRONMENT);

    expect(dataCollection?.httpHeaders).toEqual({
      request: {allow: ["User-Agent", "Referer"]},
      response: false,
    });
  });

  it("schwärzt Supabase-Details vor dem Versand", () => {
    expect(buildSentryOptions(ENVIRONMENT).beforeSend).toBe(
      redactSupabaseErrorDetails,
    );
  });

  it("filtert Chunk-Ladefehler nach einem Deployment aus", () => {
    const {ignoreErrors = []} = buildSentryOptions(ENVIRONMENT);
    const chunkError = "Failed to fetch dynamically imported module";

    expect(
      ignoreErrors.some((pattern) =>
        typeof pattern === "string"
          ? chunkError.includes(pattern)
          : pattern.test(chunkError),
      ),
    ).toBe(true);
  });

  it("aktiviert Tracing, Replay und Konsolen-Logs", () => {
    const {integrations} = buildSentryOptions(ENVIRONMENT);
    const names = Array.isArray(integrations)
      ? integrations.map((integration) => integration.name)
      : [];

    expect(names).toEqual(
      expect.arrayContaining(["BrowserTracing", "Replay", "ConsoleLogs"]),
    );
  });
});

describe("shouldCreateSpanForRequest()", () => {
  it.each([
    "https://chuchipirat.ch/rezepte",
    "https://api.test.chuchipirat.ch/rest/v1/recipes",
    "http://localhost:54321/rest/v1/events",
    "/relativ/zur/seite",
  ])("erfasst eigene Requests: %s", (url) => {
    expect(shouldCreateSpanForRequest(url)).toBe(true);
  });

  it.each([
    "https://firebaseremoteconfig.googleapis.com/v1/projects",
    "https://evilchuchipirat.ch/",
  ])("ignoriert fremde Requests: %s", (url) => {
    expect(shouldCreateSpanForRequest(url)).toBe(false);
  });
});
