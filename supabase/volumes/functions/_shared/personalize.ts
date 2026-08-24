/**
 * Personalisierung von E-Mail-Inhalten mit Empfänger-Variablen.
 *
 * Ersetzt `{{firstName}}`, `{{lastName}}`, `{{displayName}}` und
 * `{{unsubscribeLink}}` im admin-editierten Mail-Konsole-Inhalt
 * (Betreff/Titel/Untertitel/Mailtext/Footer) durch die jeweiligen Werte —
 * pro Empfänger, damit ein einzelner Massenversand trotzdem individuell
 * angesprochen wirkt (z.B. "Hallo {{displayName}}") und jede E-Mail einen
 * auf den Empfänger zugeschnittenen Newsletter-Abmelde-Link enthält.
 *
 * Eigenständiges, von Deno-spezifischen Imports freies Modul (analog zu
 * chunkArray.ts/fetchAllRows.ts), damit es direkt per Jest testbar ist.
 *
 * @example
 * import { personalize } from "../_shared/personalize.ts";
 * personalize("Hallo {{displayName}},", {firstName: "Gio", lastName: "Cettuzzi", displayName: "Gio", unsubscribeLink: ""});
 * // "Hallo Gio,"
 */
import {escapeHtml} from "./escapeHtml.ts";

/**
 * Empfänger-Werte für die Personalisierungs-Tokens.
 *
 * @param firstName - Vorname (public.users.first_name)
 * @param lastName - Nachname (public.users.last_name)
 * @param displayName - Anzeigename (public.users.display_name)
 * @param unsubscribeLink - Personalisierter Newsletter-Abmelde-Link (enthält die Nutzer-UID)
 */
export interface PersonalizationVariables {
  firstName: string;
  lastName: string;
  displayName: string;
  unsubscribeLink: string;
}

/** Matcht {{firstName}}, {{lastName}}, {{displayName}}, {{unsubscribeLink}} (mit optionalem Whitespace). */
const TOKEN_PATTERN = /\{\{\s*(firstName|lastName|displayName|unsubscribeLink)\s*\}\}/g;

/**
 * Ersetzt Personalisierungs-Tokens in `text` durch die Werte aus `variables`.
 * Werte werden HTML-escaped (Token-Ersetzung erfolgt in bereits gerenderten
 * HTML-Inhalt). Unbekannte/andere `{{...}}`-Muster bleiben unverändert.
 *
 * @param text - Text mit ggf. enthaltenen Tokens.
 * @param variables - Werte, mit denen die Tokens ersetzt werden.
 * @returns Text mit ersetzten Tokens.
 */
export function personalize(
  text: string,
  variables: PersonalizationVariables,
): string {
  return text.replace(TOKEN_PATTERN, (_match, key: keyof PersonalizationVariables) =>
    escapeHtml(variables[key] ?? ""),
  );
}
