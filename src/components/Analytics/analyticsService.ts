/**
 * Zentraler Analytics-Service für Umami.
 *
 * Stellt `initAnalytics()` (Script-Injection) und `trackEvent()`
 * (Custom-Event-Tracking) bereit. Kein React-Context nötig — der
 * Service ist zustandslos und kann überall importiert werden.
 */
import {AnalyticsEventName} from "./analyticsEvents";
import AuthUser from "../Session/authUser.class";
import {Role} from "../../constants/roles";

/** UUID-Segment in einem Pfad, z.B. `/event/3fa85f64-5717-4562-b3fc-2c963f66afa6`. */
const UUID_SEGMENT_PATTERN =
  /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;

/** Name der globalen Funktion, die Umami vor dem Senden aufruft (siehe `data-before-send`). */
const BEFORE_SEND_FUNCTION_NAME = "chuchipiratUmamiBeforeSend";

/** Payload-Form, die Umami an die `data-before-send`-Funktion übergibt. */
type UmamiBeforeSendPayload = {
  url?: string;
  [key: string]: unknown;
};

/** Umami stellt `window.umami` zur Verfügung, sobald das Script geladen ist. */
declare global {
  interface Window {
    umami?: {
      track: {
        (
          eventName: string,
          eventData?: Record<string, string | number | boolean>,
        ): void;
        (
          callback: (props: Record<string, unknown>) => Record<string, unknown>,
        ): void;
      };
    };
    chuchipiratUmamiBeforeSend?: (
      type: string,
      payload: UmamiBeforeSendPayload,
    ) => UmamiBeforeSendPayload | false;
  }
}

/**
 * Ersetzt UUID-Segmente in einer URL durch `:id`.
 *
 * Die Routen der App sind UID-basiert (z.B. `/event/:id`,
 * `/recipe/:id`). Ohne Normalisierung würde Umami jedes Event, jedes
 * Rezept usw. als eigene „Seite" zählen, was den Pages-Report
 * unbrauchbar macht. Wird als eigenständige, reine Funktion
 * exportiert, damit sie ohne Mocking des Umami-Scripts testbar ist.
 *
 * @param url Die rohe URL, wie sie Umami tracken würde.
 * @returns Die URL mit UUID-Segmenten ersetzt durch `:id`.
 * @example
 * normalizeAnalyticsUrl("/event/3fa85f64-5717-4562-b3fc-2c963f66afa6/menuplan")
 * // "/event/:id/menuplan"
 */
export function normalizeAnalyticsUrl(url: string): string {
  return url.replace(UUID_SEGMENT_PATTERN, ":id");
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

  // Normalisiert UUID-Segmente in getrackten URLs, bevor sie an Umami gesendet werden
  window[BEFORE_SEND_FUNCTION_NAME] = (type, payload) => {
    if (payload?.url) {
      payload.url = normalizeAnalyticsUrl(payload.url);
    }
    return payload;
  };

  const script = document.createElement("script");
  script.defer = true;
  script.src = `${host}/script.js`;
  script.setAttribute("data-website-id", websiteId);

  // Core Web Vitals (LCP, INP, CLS, FCP, TTFB) automatisch erfassen
  script.setAttribute("data-performance", "true");

  // UUID-Segmente in getrackten URLs normalisieren (siehe normalizeAnalyticsUrl)
  script.setAttribute("data-before-send", BEFORE_SEND_FUNCTION_NAME);

  // Query-Strings nicht mittracken — reduziert URL-Kardinalität im Pages-Report
  script.setAttribute("data-exclude-search", "true");

  // In Produktion nur auf der echten Domain tracken
  const environment = import.meta.env.VITE_ENVIRONMENT;
  if (environment === "PRD") {
    script.setAttribute("data-domains", "chuchipirat.ch");
  }

  document.head.appendChild(script);
}

/**
 * Ermittelt die höchstrangige Rolle eines Benutzers für Analytics-Zwecke.
 *
 * Dient dazu, Admin-/Community-Leader-getriebene Stammdatenpflege von
 * organischer Nutzung durch Lager-Köch*innen zu unterscheiden, ohne an
 * jeder Aufrufstelle `authUser.roles.includes(...)` zu wiederholen.
 *
 * @param authUser Der angemeldete Benutzer (oder `null`/`undefined`).
 * @returns `"admin"`, `"communityLeader"` oder `"basic"` (`"anonymous"` falls kein Benutzer).
 * @example
 * trackEvent(AnalyticsEvent.PRODUCT_CREATED, {role: getAnalyticsRole(authUser)});
 */
export function getAnalyticsRole(
  authUser: AuthUser | null | undefined,
): string {
  if (!authUser) return "anonymous";
  if (authUser.roles.includes(Role.admin)) return "admin";
  if (authUser.roles.includes(Role.communityLeader)) return "communityLeader";
  return "basic";
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

/**
 * Sendet einen virtuellen Pageview an Umami, ohne die Browser-URL zu ändern.
 *
 * Für Bereiche wie den Event-Tabs, bei denen der aktive Tab nur über einen
 * Query-Parameter (`?tab=...`) abgebildet wird — Umami trackt Query-Strings
 * aber nicht (`data-exclude-search`). Über die Callback-Form von
 * `umami.track()` lässt sich stattdessen ein eigener Pageview mit
 * beliebiger `url` senden, der korrekt im Pages-/Journey-Report erscheint
 * (im Gegensatz zu `trackEvent()`, das im Events-Report landet).
 *
 * Ignoriert den Aufruf stillschweigend, wenn Umami (noch) nicht geladen ist
 * — z.B. in Tests oder bei fehlendem Script.
 *
 * @param url Virtuelle URL, die anstelle der echten Browser-URL getrackt wird.
 * @example
 * trackVirtualPageview("/event/3fa85f64-5717-4562-b3fc-2c963f66afa6/materiallist");
 * // wird dank data-before-send normalisiert zu "/event/:id/materiallist"
 */
export function trackVirtualPageview(url: string): void {
  if (!window.umami) {
    return;
  }
  window.umami.track((props) => ({...props, url}));
}
