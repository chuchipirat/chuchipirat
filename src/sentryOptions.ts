import * as Sentry from "@sentry/react";

import {
  CHUNK_LOAD_ERROR_PATTERNS,
  redactSupabaseErrorDetails,
} from "./utils/errorUtils";

/**
 * Werte für Sentry, die je Umgebung verschieden sind. Kommen in `index.jsx`
 * aus `import.meta.env` und `package.json`, damit dieses Modul in Jest ohne
 * Vite-Umgebung testbar bleibt.
 *
 * @property dsn - Projekt-DSN von Sentry.
 * @property environment - Name der Umgebung (DEV / TEST / PROD).
 * @property release - App-Version, verknüpft Fehler mit den Sourcemaps.
 * @property enabled - `false` schaltet den Versand ab (lokale Entwicklung).
 */
export type SentryEnvironment = {
  dsn: string | undefined;
  environment: string | undefined;
  release: string;
  enabled: boolean;
};

/**
 * Hostnamen, für die HTTP-Requests als `http.client`-Performance-Spans erfasst
 * werden sollen: unsere eigene Domain (Frontend + Supabase-API, alle
 * Subdomains — PROD/TEST) sowie `localhost` für die lokale Entwicklung.
 */
const TRACED_REQUEST_HOSTNAME_PATTERN = /(^|\.)chuchipirat\.ch$|^localhost$/;

/**
 * Was das SDK von sich aus mitschickt. Seit Sentry 11 ist ohne Angabe alles
 * an, auch HTTP-Bodies, bei uns also Supabase-Antworten mit Personendaten.
 * Das entspricht dem Stand von Sentry 10 ohne `sendDefaultPii`. Explizit
 * gesetzte Daten (`Sentry.setUser`, Feedback-Formular) betrifft es nicht.
 */
const DATA_COLLECTION: Sentry.BrowserOptions["dataCollection"] = {
  // keine IP-Adresse ableiten
  userInfo: false,
  cookies: false,
  // User-Agent liefert Browser/OS und speist Sentrys Filter für Crawler und alte Browser
  httpHeaders: {request: {allow: ["User-Agent", "Referer"]}, response: false},
  httpBodies: [],
};

/**
 * Rauschen von Drittanbietern / Browser-APIs, das nicht aus unserem Code
 * stammt und über das die App keine Kontrolle hat.
 */
const IGNORE_ERRORS: (string | RegExp)[] = [
  // Der SafeLink-/Vorschau-Crawler von Microsoft Outlook injiziert beim
  // Vorab-Scannen von E-Mail-Links (u.a. /authservicehandler) eine kaputte
  // Bridge und wirft dann diesen String als unhandled rejection. Kein
  // App-Fehler, kein Stacktrace, nur von Crawler-"Nutzern" ausgelöst.
  /Object Not Found Matching Id/,
  // @supabase/auth-js kann den Web-Locks-API-Lock für den Auth-Token nicht
  // innerhalb von 10s bekommen, wenn ein anderer Tab (oder ein gedrosselter
  // Hintergrund-Tab / Crawler) ihn hält. Transient, der Client verbindet
  // sich anschliessend selbst neu — kein App-Fehler.
  /Navigator LockManager lock .* timed out/,
  // Fehlgeschlagener Chunk-Import nach einem Deployment (alter Tab verweist
  // noch auf gelöschte JS-Dateien mit altem Content-Hash) — wird in
  // `index.jsx` per Reload selbst geheilt, kein App-Fehler.
  ...CHUNK_LOAD_ERROR_PATTERNS,
];

/**
 * Fehler, deren Stacktrace komplett aus einer Browser-Extension stammt
 * (z.B. "UnavailableError" aus der PayPal-Honey-Safari-Extension,
 * CHUCHIPIRAT-HA). Filterung per URL statt per Fehlermeldung, da jede
 * Extension eigene, generische Fehlertexte wirft — ein Abgleich der
 * Herkunfts-URL ist robuster als eine Liste aller möglichen Meldungen.
 */
const DENY_URLS: RegExp[] = [
  /^chrome-extension:\/\//i,
  /^moz-extension:\/\//i,
  /^safari-extension:\/\//i,
  /^safari-web-extension:\/\//i,
  /\.appex\//i, // native Safari App Extensions (macOS), z.B. .../Extension.appex/...
];

/**
 * Entscheidet, ob für einen ausgehenden Request ein Performance-Span erfasst
 * wird. Ohne diese Einschränkung instrumentiert `browserTracingIntegration`
 * jeden `fetch`/`XHR`-Aufruf auf der Seite — auch solche, die gar nicht aus
 * unserem Code stammen (z.B. eine Browser-Extension, die im Hintergrund eine
 * eigene Firebase-Remote-Config abruft, CHUCHIPIRAT-B6). Sentrys
 * Performance-Heuristik meldet einen fehlgeschlagenen Drittanbieter-Request
 * dann fälschlich als App-Problem.
 *
 * @param url - Die (ggf. relative) URL des ausgehenden Requests.
 * @returns `true`, wenn der Host zu unserer eigenen Infrastruktur gehört.
 * @example
 * shouldCreateSpanForRequest("https://api.test.chuchipirat.ch/rest/v1/recipes"); // true
 * shouldCreateSpanForRequest("https://example.com/"); // false
 */
export const shouldCreateSpanForRequest = (url: string): boolean => {
  try {
    return TRACED_REQUEST_HOSTNAME_PATTERN.test(
      new URL(url, window.location.origin).hostname,
    );
  } catch {
    return false;
  }
};

/**
 * Baut die Integrationen: Tracing (nur eigene Requests), Session-Replay und
 * die Weiterleitung von Konsolen-Ausgaben als Sentry-Logs.
 *
 * @returns Liste der Integrationen für `Sentry.init`.
 */
const buildIntegrations = () => [
  Sentry.browserTracingIntegration({shouldCreateSpanForRequest}),
  Sentry.replayIntegration({
    // Eingaben und Texte sichtbar lassen, damit Replays beim Debuggen
    // helfen. Passwortfelder werden per CSS-Selektor maskiert; Bereiche mit
    // sensiblen Daten (z.B. IBAN, Adresse) tragen `data-sentry-block` und
    // erscheinen im Replay nur als graue Fläche.
    maskAllInputs: false,
    maskAllText: false,
    blockAllMedia: false,
    mask: ['input[type="password"]'],
  }),
  // seit Sentry 11 ohne `enableLogs`: die Integration allein schaltet Logs ein
  Sentry.consoleLoggingIntegration({levels: ["log", "warn", "error"]}),
];

/**
 * Stellt die Optionen für `Sentry.init` zusammen. Liegt in TypeScript statt
 * in `index.jsx`, damit `tsc` bei einem SDK-Upgrade entfernte oder
 * umbenannte Optionen meldet.
 *
 * @param environment - Umgebungsabhängige Werte, siehe {@link SentryEnvironment}.
 * @returns Vollständige Optionen für `Sentry.init`.
 * @example
 * Sentry.init(
 *   buildSentryOptions({dsn, environment: "test", release: "2.1.0", enabled: true}),
 * );
 */
export const buildSentryOptions = (
  environment: SentryEnvironment,
): Sentry.BrowserOptions => ({
  ...environment,
  integrations: buildIntegrations(),
  dataCollection: DATA_COLLECTION,
  ignoreErrors: IGNORE_ERRORS,
  denyUrls: DENY_URLS,
  tracesSampleRate: 1.0,
  tracePropagationTargets: ["localhost", /^https:\/\/chuchipirat\.ch/],
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
  // Supabase-Fehler enthalten in `details` ganze Zeilen (z.B. IBAN)
  beforeSend: redactSupabaseErrorDetails,
});
