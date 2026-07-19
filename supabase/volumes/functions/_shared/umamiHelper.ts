/**
 * Gemeinsames Umami-Hilfsmodul für Edge Functions (Deno-kompatibel).
 *
 * Sendet Custom-Events serverseitig via Umamis HTTP-Collect-API, für
 * Ereignisse ohne Browser-Kontext (z.B. den Zahlungs-Webhook, der die
 * einzige zuverlässige Quelle für eine bestätigte Spende ist).
 * Verwendet die Umgebungsvariablen `UMAMI_HOST` und `UMAMI_WEBSITE_ID`.
 *
 * @example
 * import { trackServerEvent } from "../_shared/umamiHelper.ts";
 * await trackServerEvent("donation_completed", { revenue: 20, currency: "CHF" });
 */

/**
 * Sendet ein Custom-Event serverseitig an Umami.
 *
 * Ignoriert den Aufruf stillschweigend, wenn Umami nicht konfiguriert ist
 * (z.B. in lokaler Entwicklung ohne gesetzte Secrets). Fehler beim Senden
 * werden nur geloggt, damit die aufrufende Funktion nicht zusätzlich
 * fehlschlägt.
 *
 * @param eventName Name des Events (muss zu `AnalyticsEvent` in src/components/Analytics/analyticsEvents.ts passen).
 * @param eventData Optionale Key-Value-Paare als Event-Properties.
 */
export async function trackServerEvent(
  eventName: string,
  eventData?: Record<string, string | number | boolean>,
): Promise<void> {
  const host = Deno.env.get("UMAMI_HOST");
  const websiteId = Deno.env.get("UMAMI_WEBSITE_ID");
  if (!host || !websiteId) return;

  try {
    await fetch(`${host}/api/send`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // Umami verwirft Anfragen ohne User-Agent-Header stillschweigend
        "User-Agent": "chuchipirat-edge-function",
      },
      body: JSON.stringify({
        type: "event",
        payload: {
          website: websiteId,
          name: eventName,
          data: eventData,
        },
      }),
    });
  } catch (sendError) {
    console.error("Umami trackServerEvent fehlgeschlagen:", sendError);
  }
}
