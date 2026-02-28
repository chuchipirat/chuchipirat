import {SUPABASE_MESSAGES as TEXT_SUPABASE_MESSAGES} from "../../constants/text";

/**
 * Übersetzt Fehlermeldungen von Supabase Auth ins Deutsche.
 *
 * Supabase-Fehler werden anhand des `error.message` übersetzt,
 * da Supabase keine einheitlichen, stabilen Fehlercodes verwendet.
 * Unbekannte Meldungen werden unverändert zurückgegeben.
 */
class SupabaseMessageHandler {
  /**
   * Übersetzt eine Supabase-Fehlermeldung ins Deutsche.
   * Gibt die originale Meldung zurück, falls keine Übersetzung existiert.
   *
   * @param error - Fehlerobjekt mit `message`
   * @returns Deutsche Fehlermeldung oder das englische Original
   * @example
   * SupabaseMessageHandler.translateMessage({message: "Invalid login credentials"})
   * // "Ungültige Anmeldedaten."
   */
  static translateMessage(error: {message: string}): string {
    return TEXT_SUPABASE_MESSAGES[error.message] ?? error.message;
  }
}

export default SupabaseMessageHandler;
