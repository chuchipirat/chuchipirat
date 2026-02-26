/**
 * Supabase Client Singletons
 *
 * Erstellt und exportiert zwei Supabase-Client-Instanzen:
 * - `supabase` (Anon Key): Für normale Benutzeroperationen, unterliegt RLS.
 * - `supabaseAdmin` (Service Role Key): Für Admin-Operationen (z.B. Migration),
 *   umgeht RLS. Nur verwenden, wenn RLS-Bypass nötig ist.
 */
import {createClient, SupabaseClient} from "@supabase/supabase-js";

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
 */
export const supabaseAdmin: SupabaseClient | null = supabaseServiceRoleKey
  ? createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {autoRefreshToken: false, persistSession: false},
    })
  : null;
