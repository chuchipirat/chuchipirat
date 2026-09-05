import {SUPABASE_MESSAGES as TEXT_SUPABASE_MESSAGES} from "../../constants/text";

/**
 * Übersetzt Fehlermeldungen von Supabase (Auth und Postgres/PostgREST) ins Deutsche.
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
  // Postgres-Fehler bei Überlauf einer integer/smallint/bigint-Spalte, z.B.
  // 'value "99999999999" is out of range for type integer'. Tritt auf, wenn
  // clientseitige Validierung fehlt oder umgangen wird.
  {
    pattern: /^value "(-?\d+)" is out of range for type (integer|smallint|bigint)\.?$/,
    translate: () =>
      "Die eingegebene Zahl ist zu gross oder zu klein für dieses Feld. Bitte gib einen anderen Wert ein.",
  },
  // Postgres-Fehler beim Löschen eines Datensatzes, der noch per ON DELETE
  // RESTRICT referenziert wird, z.B. 'update or delete on table "products"
  // violates foreign key constraint "event_menue_products_product_id_fkey"
  // on table "event_menue_products"'. Aktuell nur für Produkte/Materialien/
  // Rezepte relevant, die noch in einem Menüplan eingeplant sind — die
  // Where-Used-Prüfung vor dem Löschen warnt zwar bereits, verhindert die
  // Aktion aber nicht; die DB-Constraint ist die eigentliche Absicherung.
  {
    pattern: /^update or delete on table "[^"]+" violates foreign key constraint "[^"]+" on table "[^"]+"\.?$/,
    translate: () =>
      "Dieses Element kann nicht gelöscht werden, da es noch in einem Menüplan verwendet wird.",
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
