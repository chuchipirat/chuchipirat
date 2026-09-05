/**
 * Hilfsfunktionen für die Fehlerbehandlung.
 *
 * Die Data-Access-Schicht (Supabase/PostgREST) wirft im Fehlerfall nicht immer
 * echte `Error`-Instanzen: Bei Netzwerkfehlern liefert `@supabase/postgrest-js`
 * ein einfaches Objekt der Form `{code, details, hint, message}` zurück, das
 * anschliessend unverändert weitergeworfen wird. Sentry kann solche Objekte
 * nicht sauber gruppieren ("Object captured as exception with keys ...").
 *
 * Diese Funktionen helfen, vorübergehende Netzfehler zu erkennen (und damit
 * aus dem Monitoring herauszuhalten) sowie beliebige geworfene Werte in echte
 * `Error`-Instanzen zu normalisieren.
 */

/**
 * Nachrichten-Fragmente, die auf einen vorübergehenden Netzwerk-/Offline-Fehler
 * hindeuten. Bewusst case-insensitive und als Teilstring-Match, da Browser und
 * Fetch-Implementierungen unterschiedliche Wortlaute verwenden.
 */
const TRANSIENT_NETWORK_ERROR_PATTERNS: readonly RegExp[] = [
  /failed to fetch/i,
  /networkerror/i,
  /network request failed/i,
  /load failed/i,
  /err_network/i,
  /err_internet_disconnected/i,
  /err_connection/i,
  /the internet connection appears to be offline/i,
];

/**
 * Prüft, ob ein Wert objektartig ist (nicht `null`, kein Array, kein primitiver Typ).
 *
 * @param value - Der zu prüfende Wert.
 * @returns `true`, wenn der Wert ein Objekt mit String-Schlüsseln ist.
 */
function isRecordLike(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Extrahiert alle für die Fehlerklassifikation relevanten Textfragmente aus
 * einem geworfenen Wert.
 *
 * Bei `Error`-Instanzen wird `message` verwendet. Bei objektartigen Werten
 * (z.B. Supabase-Fehlerobjekten) zusätzlich `details`, da der eigentliche
 * `TypeError`-Text dort abgelegt wird.
 *
 * @param error - Der geworfene Wert.
 * @returns Zusammengeführter Text zur Mustererkennung (ggf. leerer String).
 */
function extractErrorText(error: unknown): string {
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message;
  if (isRecordLike(error)) {
    const parts: string[] = [];
    if (typeof error.message === "string") parts.push(error.message);
    if (typeof error.details === "string") parts.push(error.details);
    return parts.join(" ");
  }
  return "";
}

/**
 * Erkennt vorübergehende Netzwerk-/Offline-Fehler.
 *
 * Solche Fehler entstehen typischerweise, wenn ein Mobilgerät im Lager kurz
 * die Verbindung verliert. Sie sind erwartbar, nicht behebbar und sollen daher
 * **nicht** an Sentry gemeldet werden (Rausch-Vermeidung).
 *
 * @param error - Der geworfene Wert (Error, Supabase-Fehlerobjekt, String, ...).
 * @returns `true`, wenn es sich um einen vorübergehenden Netzfehler handelt.
 * @example
 * try {
 *   await repo.getSettings();
 * } catch (error) {
 *   if (isTransientNetworkError(error)) return; // still schlucken
 *   Sentry.captureException(toError(error));
 * }
 */
export function isTransientNetworkError(error: unknown): boolean {
  // Gerät explizit offline → jeder Fehler in diesem Fenster ist vorübergehend.
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return true;
  }

  const text = extractErrorText(error);
  if (!text) return false;

  return TRANSIENT_NETWORK_ERROR_PATTERNS.some((pattern) => pattern.test(text));
}

/**
 * Erkennt eine Postgres-RLS-Verletzung (`42501` / "row-level security policy").
 *
 * In einer authentifizierten Client-App bedeutet das in der Praxis, dass die
 * Supabase-Sitzung fehlt oder abgelaufen ist — die betroffenen INSERT-Policies
 * (z.B. `events_insert`) prüfen lediglich `auth.uid() IS NOT NULL`. Solche
 * Fehler sind ein Nutzer-Hinweis ("bitte neu anmelden"), kein Code-Bug.
 *
 * @param error - Der geworfene Wert.
 * @returns `true`, wenn es sich um eine RLS-/Berechtigungs-Verletzung handelt.
 */
export function isRlsViolationError(error: unknown): boolean {
  if (isRecordLike(error) && error.code === "42501") return true;
  return /row-level security policy/i.test(extractErrorText(error));
}

/**
 * Erkennt einen abgelaufenen Supabase-JWT (`PGRST301` / "JWT expired").
 *
 * Tritt auf, wenn ein API-Aufruf mit einem bereits abgelaufenen Access-Token
 * ausgeführt wird — z.B. nach längerer Inaktivität (Laptop im Standby, Tab im
 * Hintergrund) kurz bevor der `auth-js`-Client automatisch neu auffrischt.
 * Erwartetes, selbstheilendes Verhalten (der nächste Aufruf nutzt ein
 * aufgefrischtes Token) — kein Code-Bug, daher kein Sentry-Report.
 *
 * @param error - Der geworfene Wert.
 * @returns `true`, wenn es sich um einen abgelaufenen JWT handelt.
 */
export function isJwtExpiredError(error: unknown): boolean {
  if (isRecordLike(error) && error.code === "PGRST301") return true;
  return /jwt expired/i.test(extractErrorText(error));
}

/**
 * Normalisiert einen beliebigen geworfenen Wert in eine echte `Error`-Instanz.
 *
 * `Error`-Instanzen werden unverändert zurückgegeben. Objektartige Werte (z.B.
 * Supabase-Fehlerobjekte) werden in einen `Error` verpackt, dessen `message`
 * übernommen wird; das Originalobjekt bleibt über `cause` erhalten (nützlich für
 * `code`/`hint`/`details` im Sentry-Kontext). Enthält das Objekt einen nicht
 * leeren `code`, wird `name` auf `"SupabaseError"` gesetzt, damit Sentry sinnvoll
 * gruppiert.
 *
 * @param value - Der zu normalisierende Wert.
 * @returns Eine `Error`-Instanz.
 * @example
 * toError({code: "23505", message: "duplicate key"}) // Error: duplicate key (name: "SupabaseError")
 * toError("kaputt") // Error: kaputt
 */
export function toError(value: unknown): Error {
  if (value instanceof Error) return value;

  if (isRecordLike(value)) {
    const message =
      typeof value.message === "string" && value.message
        ? value.message
        : "Unbekannter Fehler (Objekt ohne message)";
    const error = new Error(message, {cause: value});
    if (typeof value.code === "string" && value.code) {
      error.name = "SupabaseError";
    }
    return error;
  }

  if (typeof value === "string" && value) return new Error(value);

  return new Error("Unbekannter Fehler");
}
