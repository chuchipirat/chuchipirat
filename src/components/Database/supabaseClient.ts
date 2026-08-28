/**
 * Supabase Client Singleton (Anon Key, RLS aktiv) für alle normalen
 * Operationen.
 */
import {createClient, SupabaseClient} from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Missing Supabase environment variables. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY."
  );
}

/**
 * Schnappschuss von Hash/Query der URL, BEVOR der Client unten erstellt wird.
 *
 * Grund: Der Client verarbeitet bei aktivem `detectSessionInUrl` (Default)
 * Auth-Callback-URLs (z.B. `#access_token=...&type=email_change` nach einem
 * Klick auf einen Bestätigungslink) bereits während seiner asynchronen
 * Initialisierung und entfernt den Hash danach aus der Adressleiste
 * (`window.history.replaceState`). Da dieser Vorgang beim Implicit Flow
 * ohne Server-Roundtrip auskommt, kann er schneller abgeschlossen sein als
 * React bis zum Mount von `AuthServiceHandlerPage` braucht — eine dortige
 * Auswertung von `location.hash` käme dann zu spät ("Link nicht erkannt",
 * obwohl die Session bereits korrekt etabliert wurde). Da JS-Module streng
 * von oben nach unten ausgewertet werden, läuft dieser Schnappschuss
 * garantiert vor dem `createClient(...)`-Aufruf unten.
 */
export const initialAuthCallbackHash =
  typeof window !== "undefined" ? window.location.hash : "";
export const initialAuthCallbackSearch =
  typeof window !== "undefined" ? window.location.search : "";

export const supabase: SupabaseClient = createClient(
  supabaseUrl,
  supabaseAnonKey
);
