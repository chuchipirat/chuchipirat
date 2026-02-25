/**
 * Supabase Client Singleton
 *
 * Erstellt und exportiert eine einzelne Supabase-Client-Instanz,
 * die in der gesamten App verwendet wird. Liest die Verbindungsdaten
 * aus den Umgebungsvariablen VITE_SUPABASE_URL und VITE_SUPABASE_ANON_KEY.
 */
import {createClient, SupabaseClient} from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Missing Supabase environment variables. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY."
  );
}

/** Globale Supabase-Client-Instanz (Singleton) */
export const supabase: SupabaseClient = createClient(
  supabaseUrl,
  supabaseAnonKey
);
