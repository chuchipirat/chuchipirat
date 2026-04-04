/**
 * Supabase Client Singletons
 *
 * Erstellt und exportiert zwei Supabase-Client-Instanzen:
 * - `supabase` (Anon Key): Für normale Benutzeroperationen, unterliegt RLS.
 * - `supabaseAdmin` (Service Role Key): Für Admin-Operationen (z.B. Migration),
 *   umgeht RLS. Nur verwenden, wenn RLS-Bypass nötig ist.
 */
import {createClient, SupabaseClient} from "@supabase/supabase-js";
import * as Sentry from "@sentry/react";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Missing Supabase environment variables. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY."
  );
}

/** Globale Supabase-Client-Instanz (Anon Key, RLS aktiv) */
export const supabase: SupabaseClient = createClient(
  supabaseUrl,
  supabaseAnonKey
);

/**
 * Supabase-Client mit Service Role Key (umgeht RLS).
 * Nur für Admin-Operationen wie Datenmigration verwenden.
 * Ist `null`, falls der Service Role Key nicht konfiguriert ist.
 *
 * TODO(post-migration): Nach Abschluss der Firebase→Supabase-Migration:
 * 1. VITE_SUPABASE_SERVICE_ROLE_KEY aus allen .env-Dateien entfernen
 * 2. Diesen `supabaseAdmin`-Export löschen
 * 3. `DatabaseService.admin`-Property in DatabaseService.ts entfernen
 * 4. Alle `database.admin?.x ?? database.x`-Aufrufe (42 Stellen) durch
 *    `database.x` ersetzen
 * 5. Verbleibende Admin-Operationen (overviewUsers, Rollenänderungen)
 *    in Edge Functions verschieben
 */
export const supabaseAdmin: SupabaseClient | null = supabaseServiceRoleKey
  ? createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {autoRefreshToken: false, persistSession: false},
    })
  : null;

// Sicherheitsnetz: Warnung, falls der Admin-Client in einer
// Nicht-DEV-Umgebung aktiv ist (z.B. nach Migration vergessen, neu zu builden).
if (supabaseAdmin && import.meta.env.VITE_ENVIRONMENT !== "DEV") {
  console.error(
    "SECURITY WARNING: supabaseAdmin client active in non-DEV environment. Rebuild without VITE_SUPABASE_SERVICE_ROLE_KEY after migration."
  );
  Sentry.captureMessage(
    "supabaseAdmin client active in non-DEV environment",
    "warning"
  );
}
