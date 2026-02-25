/**
 * Jest-Auto-Mock für supabaseClient.ts.
 *
 * Wird automatisch von Jest verwendet, wenn ein Modul
 * "../supabaseClient" importiert. Verhindert den Zugriff
 * auf import.meta.env (Vite-spezifisch, in Jest nicht verfügbar).
 */
export const supabase = {
  from: jest.fn(),
  rpc: jest.fn(),
  channel: jest.fn(),
  removeChannel: jest.fn(),
};
