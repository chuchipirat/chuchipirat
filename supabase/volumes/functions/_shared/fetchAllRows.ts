/**
 * Gemeinsames Hilfsmodul für paginierte Supabase-Reads in Edge Functions.
 *
 * Supabase/PostgREST liefert bei `.from(table).select(...)` ohne explizite
 * Paginierung standardmässig maximal 1000 Zeilen — ein einzelner
 * unpaginierter Read auf einer grösseren Tabelle (z.B. `users`) verwirft
 * dabei still und leise alle weiteren Zeilen, ohne Fehler. Dieses Modul
 * kapselt das Umgehen dieses Limits via `.range()`-Paginierung, analog zu
 * `fetchAllRows` in `src/components/Admin/MigrationJobs/MigrationJob.interface.ts`
 * (Edge Functions laufen als separates Deno-Deployment und können dieses
 * App-Modul nicht direkt importieren).
 *
 * @example
 * import { fetchAllRows } from "../_shared/fetchAllRows.ts";
 * const users = await fetchAllRows(supabaseAdmin, "users", "id, roles");
 * const leaders = await fetchAllRows(supabaseAdmin, "users", "email, roles",
 *   (query) => query.not("email", "is", null));
 */

/** Seitengrösse pro Request — entspricht PostgREFTs Standardlimit. */
const PAGE_SIZE = 1000;

/**
 * Minimale Client-Abstraktion für Testbarkeit (analog zu `cronJobHelper.ts`).
 * Die exakte Query-Builder-Kette variiert je nach angehängten Filtern,
 * daher bewusst lose typisiert (wie im App-seitigen Vorbild).
 */
interface SupabaseQueryClient {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from(table: string): any;
}

/**
 * Lädt alle Zeilen einer Supabase-Tabelle paginiert, um das Standardlimit
 * von 1000 Zeilen pro Request zu umgehen. Optionale Filter (z.B. `.eq(...)`,
 * `.not(...)`, `.order(...)`) können über den `filter`-Callback angehängt
 * werden, bevor `.range()` für die Paginierung ergänzt wird.
 *
 * @param client - Supabase-Client (i.d.R. der Service-Role-Admin-Client).
 * @param table - Name der Tabelle oder View.
 * @param columns - Kommaseparierte Spaltenliste (z.B. "id, roles").
 * @param filter - Optionaler Callback, der den Query-Builder vor `.range()` erweitert.
 * @returns Alle Zeilen als Array.
 * @throws Error bei einem Datenbankfehler auf irgendeiner Seite.
 */
export async function fetchAllRows<T = Record<string, unknown>>(
  client: SupabaseQueryClient,
  table: string,
  columns: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  filter?: (query: any) => any,
): Promise<T[]> {
  const allRows: T[] = [];
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query: any = client.from(table).select(columns);
    if (filter) query = filter(query);
    query = query.range(offset, offset + PAGE_SIZE - 1);

    const {data, error} = await query;
    if (error) {
      throw new Error(
        `fetchAllRows(${table}) fehlgeschlagen: ${error.message ?? error}`,
      );
    }

    const rows = (data ?? []) as T[];
    allRows.push(...rows);
    hasMore = rows.length === PAGE_SIZE;
    offset += PAGE_SIZE;
  }

  return allRows;
}
