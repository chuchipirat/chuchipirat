/**
 * Supabase Client Singletons
 *
 * - `supabase` (Anon Key): Für alle normalen Operationen, unterliegt RLS.
 * - `supabaseAdmin` (Service Role Key): NUR für die Datenmigration im
 *   lokalen Dev-Server. Ist `null` in deployten Builds (Key darf dort
 *   nicht gesetzt sein — vite.config.ts blockiert den Build).
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
 * Admin-Client für die Datenmigration (Service Role Key, umgeht RLS).
 * Ist `null` wenn VITE_SUPABASE_SERVICE_ROLE_KEY nicht gesetzt ist —
 * also in allen deployten Builds (TEST/PROD).
 * Nur für MigrationJobs verwenden, NIEMALS in normalem App-Code.
 */
export const supabaseAdmin: SupabaseClient | null = supabaseServiceRoleKey
  ? createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {autoRefreshToken: false, persistSession: false},
    })
  : null;
