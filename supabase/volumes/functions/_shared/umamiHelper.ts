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

  // Hostname der App (nicht der Umami-Instanz) — falls die Website in Umami
  // eine Domain-Einschränkung hat, muss dieser Wert zur App-Domain passen.
  const appHostname = (() => {
    try {
      return new URL(Deno.env.get("SITE_URL") ?? "").hostname;
    } catch {
      return "chuchipirat.ch";
    }
  })();

  try {
    const response = await fetch(`${host}/api/send`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // Umami verwirft Anfragen ohne User-Agent-Header stillschweigend.
        // Ein generischer/erkennbarer Wert (z.B. "chuchipirat-edge-function")
        // wird von Umamis Bot-Erkennung (isbot) als Bot eingestuft und
        // ebenfalls verworfen — ein realistischer Browser-User-Agent ist
        // hier absichtlich nötig, nicht nur "irgendein" Wert.
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      },
      body: JSON.stringify({
        type: "event",
        payload: {
          website: websiteId,
          hostname: appHostname,
          url: "/server-events",
          name: eventName,
          data: eventData,
        },
      }),
    });

    // fetch() wirft nur bei Netzwerkfehlern — ein HTTP-Fehlerstatus
    // (z.B. abgelehntes Payload) muss explizit geprüft werden, sonst
    // schlägt das Tracking still fehl, ohne dass es je auffällt.
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      console.error(
        `Umami trackServerEvent: HTTP ${response.status} — ${body}`,
      );
      return;
    }

    // Umami antwortet bei intern verworfenen Events (z.B. Bot-Erkennung)
    // absichtlich mit HTTP 200 und einer Fake-Payload ({"beep":"boop"}),
    // damit Ad-Blocker eine Blockierung nicht erkennen können. Ohne diese
    // Prüfung würde das Tracking hier still fehlschlagen.
    const body = await response.text().catch(() => "");
    if (body.includes("beep")) {
      console.error(
        `Umami trackServerEvent: Event von Umami verworfen (Bot-Erkennung?) — Antwort: ${body}`,
      );
    }
  } catch (sendError) {
    console.error("Umami trackServerEvent fehlgeschlagen:", sendError);
  }
}
