import {SUPABASE_MESSAGES as TEXT_SUPABASE_MESSAGES} from "../../constants/text";

/**
 * Übersetzt Fehlermeldungen von Supabase Auth ins Deutsche.
 *
 * Supabase-Fehler werden anhand des `error.message` übersetzt,
 * da Supabase keine einheitlichen, stabilen Fehlercodes verwendet.
 * Unbekannte Meldungen werden unverändert zurückgegeben.
 */
/**
 * Muster für Supabase-Meldungen mit variablen Werten (z.B. Sekundenangabe).
 * Jeder Eintrag enthält ein Regex-Pattern und eine Übersetzungsfunktion,
 * die den extrahierten Wert in die deutsche Meldung einsetzt.
 */
const SUPABASE_MESSAGE_PATTERNS: {
  pattern: RegExp;
  translate: (match: RegExpMatchArray) => string;
}[] = [
  {
    pattern:
      /^For security purposes, you can only request this after (\d+) seconds?\.$/,
    translate: (match) =>
      `Aus Sicherheitsgründen kannst du dies erst nach ${match[1]} Sekunden erneut anfordern.`,
  },
];

class SupabaseMessageHandler {
  /**
   * Übersetzt eine Supabase-Fehlermeldung ins Deutsche.
   * Prüft zuerst exakte Übereinstimmungen, dann Muster mit variablen Werten.
   * Gibt die originale Meldung zurück, falls keine Übersetzung existiert.
   *
   * @param error - Fehlerobjekt mit `message`
   * @returns Deutsche Fehlermeldung oder das englische Original
   * @example
   * SupabaseMessageHandler.translateMessage({message: "Invalid login credentials"})
   * // "Ungültige Anmeldedaten."
   */
  static translateMessage(error: {message: string}): string {
    // 1. Exakte Übereinstimmung
    const exact = TEXT_SUPABASE_MESSAGES[error.message];
    if (exact) return exact;

    // 2. Pattern-basierte Übersetzung (variable Werte)
    for (const {pattern, translate} of SUPABASE_MESSAGE_PATTERNS) {
      const match = error.message.match(pattern);
      if (match) return translate(match);
    }

    return error.message;
  }
}

export default SupabaseMessageHandler;
