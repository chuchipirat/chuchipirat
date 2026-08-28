/**
 * Hilfsfunktionen rund um UUIDs.
 *
 * Supabase Auth-IDs (`auth.users.id` = `public.users.id`) sind kanonische
 * UUIDs. Aus der Firebase-Ära können jedoch noch alte IDs (28-stellige
 * Firebase-UIDs) in Caches oder URLs auftauchen. Werden diese an eine
 * Postgres-`uuid`-Spalte gereicht, wirft Postgres `22P02`
 * ("invalid input syntax for type uuid"). Mit `isUuid()` lässt sich das
 * vorab abfangen.
 */

/**
 * Regex für kanonische UUIDs im Format `8-4-4-4-12` (Hex, case-insensitive).
 * Akzeptiert bewusst jede Version/Variante — geprüft wird nur das Format,
 * nicht die semantische Gültigkeit.
 */
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Prüft, ob ein Wert eine kanonisch formatierte UUID ist.
 *
 * @param value - Der zu prüfende Wert (beliebiger Typ).
 * @returns `true`, wenn `value` ein String im UUID-Format `8-4-4-4-12` ist.
 * @example
 * isUuid("3f2504e0-4f89-41d3-9a0c-0305e82c3301") // true
 * isUuid("e8WxnzFaEnMeo908kVxx1Qgv3hb2")         // false (Firebase-UID)
 * isUuid("")                                     // false
 */
export function isUuid(value: unknown): boolean {
  return typeof value === "string" && UUID_PATTERN.test(value);
}
