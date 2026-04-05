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
  storage: {
    from: jest.fn(() => ({
      upload: jest.fn().mockResolvedValue({data: {path: "users/test.jpg"}, error: null}),
      remove: jest.fn().mockResolvedValue({data: null, error: null}),
      getPublicUrl: jest.fn((path: string) => ({
        data: {publicUrl: `https://mock.supabase.co/storage/v1/object/public/media/${path}`},
      })),
    })),
  },
};

/** Mock: Admin-Client ist in Tests immer null (kein Service Role Key) */
export const supabaseAdmin = null;
