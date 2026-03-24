/**
 * Zentraler Analytics-Service für Umami.
 *
 * Stellt `initAnalytics()` (Script-Injection) und `trackEvent()`
 * (Custom-Event-Tracking) bereit. Kein React-Context nötig — der
 * Service ist zustandslos und kann überall importiert werden.
 */
import {AnalyticsEventName} from "./analyticsEvents";

/** Umami stellt `window.umami` zur Verfügung, sobald das Script geladen ist. */
declare global {
  interface Window {
    umami?: {
      track: (
        eventName: string,
        eventData?: Record<string, string | number | boolean>,
      ) => void;
    };
  }
}

/**
 * Injiziert das Umami-Tracking-Script in den `<head>`.
 *
 * Wird einmalig beim App-Start aufgerufen (z.B. in `index.jsx`).
 * Liest Host und Website-ID aus den Vite-Umgebungsvariablen.
 * Setzt `data-domains` in PROD, damit lokale Builds nicht
 * versehentlich Events an die Produktions-Instanz senden.
 *
 * @example
 * initAnalytics(); // einmalig beim App-Start
 */
export function initAnalytics(): void {
  const host = import.meta.env.VITE_UMAMI_HOST;
  const websiteId = import.meta.env.VITE_UMAMI_WEBSITE_ID;

  if (!host || !websiteId) {
    // Ohne Konfiguration kein Tracking — z.B. in Tests oder lokaler Entwicklung ohne Umami
    return;
  }

  const script = document.createElement("script");
  script.defer = true;
  script.src = `${host}/script.js`;
  script.setAttribute("data-website-id", websiteId);

  // Core Web Vitals (LCP, INP, CLS, FCP, TTFB) automatisch erfassen
  script.setAttribute("data-performance", "true");

  // In Produktion nur auf der echten Domain tracken
  const environment = import.meta.env.VITE_ENVIRONMENT;
  if (environment === "PRD") {
    script.setAttribute("data-domains", "chuchipirat.ch");
  }

  document.head.appendChild(script);
}

/**
 * Sendet ein Custom-Event an Umami.
 *
 * Ignoriert den Aufruf stillschweigend, wenn Umami (noch) nicht
 * geladen ist — z.B. in Tests oder bei fehlendem Script.
 *
 * @param eventName Name des Events (aus `AnalyticsEvent`).
 * @param eventData Optionale Key-Value-Paare als Event-Properties.
 *
 * @example
 * trackEvent(AnalyticsEvent.PICTURE_UPLOADED, { folder: "recipe" });
 */
export function trackEvent(
  eventName: AnalyticsEventName,
  eventData?: Record<string, string | number | boolean>,
): void {
  if (!window.umami) {
    return;
  }
  window.umami.track(eventName, eventData);
}
