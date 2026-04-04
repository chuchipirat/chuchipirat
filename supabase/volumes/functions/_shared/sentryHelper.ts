/**
 * Gemeinsamer Sentry-Hilfsmodul für Edge Functions (Deno-kompatibel).
 *
 * Sendet Fehler-Events an die Sentry HTTP API ohne SDK-Abhängigkeit.
 * Verwendet die `SENTRY_DSN`-Umgebungsvariable.
 *
 * @example
 * import { sentryCaptureError } from "../_shared/sentryHelper.ts";
 * await sentryCaptureError(error, "send-mail");
 */

/**
 * Sendet ein Fehler-Event an Sentry via HTTP Store-Endpoint.
 *
 * Fehler werden als Event mit Stacktrace (sofern vorhanden) an Sentry
 * übermittelt. Fehlschläge beim Senden werden nur in die Konsole geloggt,
 * damit die aufrufende Funktion nicht zusätzlich fehlschlägt.
 *
 * @param error Der aufgetretene Fehler (Error-Objekt oder beliebiger Wert).
 * @param functionName Name der Edge Function (erscheint als Transaction in Sentry).
 */
export async function sentryCaptureError(
  error: unknown,
  functionName: string,
): Promise<void> {
  const sentryDsn = Deno.env.get("SENTRY_DSN");
  if (!sentryDsn) return;

  try {
    const dsnUrl = new URL(sentryDsn);
    const publicKey = dsnUrl.username;
    const projectId = dsnUrl.pathname.replace("/", "");
    const host = dsnUrl.hostname;

    const storeUrl = `https://${host}/api/${projectId}/store/`;

    const errorMessage =
      error instanceof Error ? error.message : String(error);
    const errorType =
      error instanceof Error ? error.constructor.name : "Error";

    // Sentry Event Payload (Envelope-kompatibel via Store API)
    const event = {
      event_id: crypto.randomUUID().replace(/-/g, ""),
      timestamp: new Date().toISOString(),
      platform: "node",
      level: "error",
      transaction: functionName,
      server_name: "supabase-edge-functions",
      exception: {
        values: [
          {
            type: errorType,
            value: errorMessage,
            ...(error instanceof Error && error.stack
              ? {stacktrace: {frames: parseStack(error.stack)}}
              : {}),
          },
        ],
      },
      tags: {
        runtime: "deno",
        function: functionName,
      },
    };

    await fetch(storeUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Sentry-Auth": [
          "Sentry sentry_version=7",
          `sentry_key=${publicKey}`,
          "sentry_client=edge-functions/1.0",
        ].join(", "),
      },
      body: JSON.stringify(event),
    });
  } catch (sendError) {
    // Sentry-Fehler dürfen die aufrufende Funktion nicht blockieren
    console.error("Sentry captureError fehlgeschlagen:", sendError);
  }
}

/**
 * Parst einen Error-Stack in das Sentry-Frames-Format.
 *
 * @param stack Roher Stack-Trace-String.
 * @returns Array von Sentry-kompatiblen Stack-Frames (ältester zuerst).
 */
function parseStack(
  stack: string,
): Array<{filename: string; function: string; lineno?: number; colno?: number}> {
  const lines = stack.split("\n").slice(1); // Erste Zeile ist die Error-Message
  const frames = lines
    .map((line) => {
      const match = line.match(/at\s+(.+?)\s+\((.+?):(\d+):(\d+)\)/);
      if (match) {
        return {
          function: match[1],
          filename: match[2],
          lineno: parseInt(match[3], 10),
          colno: parseInt(match[4], 10),
        };
      }
      // Anonyme Frames: "at file:line:col"
      const simpleMatch = line.match(/at\s+(.+?):(\d+):(\d+)/);
      if (simpleMatch) {
        return {
          function: "<anonymous>",
          filename: simpleMatch[1],
          lineno: parseInt(simpleMatch[2], 10),
          colno: parseInt(simpleMatch[3], 10),
        };
      }
      return null;
    })
    .filter(Boolean) as Array<{
    filename: string;
    function: string;
    lineno?: number;
    colno?: number;
  }>;

  // Sentry erwartet ältesten Frame zuerst
  return frames.reverse();
}
