/**
 * Optionen der Admin-Mail-Konsole: Titel-Block und Abmelde-Footer.
 *
 * Eigenständiges, von Deno-spezifischen Imports freies Modul (analog zu
 * personalize.ts), damit die Regeln direkt per Jest testbar sind, ohne die
 * Edge Function `send-mail` starten zu müssen.
 *
 * @example
 * import { buildTitleBlock, resolveUnsubscribePolicy } from "../_shared/mailConsoleOptions.ts";
 * buildTitleBlock("");                              // ""
 * resolveUnsubscribePolicy(false, "uid");           // {ok: true, includeUnsubscribe: false, respectOptOut: false}
 */
import {escapeHtml} from "./escapeHtml.ts";

/**
 * Abmelde-Hinweis für den Footer. `{{unsubscribeLink}}` wird erst beim
 * Personalisieren pro Empfänger ersetzt (siehe personalize.ts), da der Link
 * die individuelle UID enthält.
 */
export const UNSUBSCRIBE_BLOCK = `<p style="margin: 16px 0 0; font-size: 12px; color: #9e9e9e; line-height: 1.5;">
                Du möchtest keine Newsletter mehr erhalten?
                <a href="{{unsubscribeLink}}" style="color: #9e9e9e;">Hier abmelden</a>.
              </p>`;

/**
 * Baut die grosse Überschrift (H1) der Mail.
 *
 * @param title - Titel aus der Mail-Konsole; darf leer oder nicht gesetzt sein.
 * @returns HTML-Überschrift oder leerer String, wenn kein Titel angegeben ist
 *   (dann beginnt die Mail direkt mit dem Text, der Betreff wird nicht wiederholt).
 * @example
 * buildTitleBlock("Hallo");   // '<h1 style="...">Hallo</h1>'
 * buildTitleBlock("   ");     // ""
 */
export function buildTitleBlock(title?: string): string {
  const trimmedTitle = title?.trim();
  if (!trimmedTitle) return "";
  return `<h1 style="margin: 0 0 8px; font-size: 22px; color: #212121;">${escapeHtml(trimmedTitle)}</h1>`;
}

/**
 * Ergebnis von {@link resolveUnsubscribePolicy}.
 *
 * @param includeUnsubscribe - `true`, wenn der Abmelde-Footer angehängt wird.
 * @param respectOptOut - `true`, wenn abgemeldete Nutzer:innen ausgefiltert werden.
 * @param error - Fehlermeldung (Deutsch), wenn die Kombination nicht erlaubt ist.
 */
export type UnsubscribePolicy =
  | {ok: true; includeUnsubscribe: boolean; respectOptOut: boolean}
  | {ok: false; error: string};

/**
 * Legt fest, ob der Abmelde-Footer angehängt und die Newsletter-Abmeldung
 * berücksichtigt wird.
 *
 * Ohne Footer gilt die Mail als Direktnachricht: Sie erreicht dann auch
 * Personen, die den Newsletter abbestellt haben. Damit ein Fehlklick nicht
 * einen Massenversand ohne Abmelde-Link auslöst, ist das nur für einzelne
 * Empfänger (E-Mail-Adresse, User-UID) erlaubt, nicht für Rollen.
 * Nur ein striktes `false` schaltet den Footer ab — fehlt der Wert (ältere
 * Clients), bleibt das bisherige Verhalten.
 *
 * @param includeUnsubscribe - Wunsch aus der Mail-Konsole; `undefined` = Footer an.
 * @param recipientType - `email`, `uid` oder `role`.
 * @returns Die geltende Regel oder ein Fehler bei «kein Footer» für eine Rolle.
 * @example
 * resolveUnsubscribePolicy(undefined, "role"); // {ok: true, includeUnsubscribe: true, respectOptOut: true}
 * resolveUnsubscribePolicy(false, "role");     // {ok: false, error: "..."}
 */
export function resolveUnsubscribePolicy(
  includeUnsubscribe: boolean | undefined,
  recipientType: string,
): UnsubscribePolicy {
  if (includeUnsubscribe !== false) {
    return {ok: true, includeUnsubscribe: true, respectOptOut: true};
  }
  if (recipientType === "role") {
    return {
      ok: false,
      error:
        "Ohne Abmelde-Footer kann nicht an eine Rolle gesendet werden — nur an einzelne E-Mail-Adressen oder User-UIDs",
    };
  }
  return {ok: true, includeUnsubscribe: false, respectOptOut: false};
}
