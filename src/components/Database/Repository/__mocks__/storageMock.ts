/**
 * Mock-Hilfsfunktionen für Storage-Repository-Tests.
 *
 * Erstellt einen vollständig gemockten Supabase-Storage-Client,
 * der in Tests anstelle des echten Clients injiziert wird.
 */

/** Erstellt einen Mock des Supabase Storage-Clients. */
export function createStorageMock() {
  const storageBucketMock = {
    upload: jest.fn().mockResolvedValue({
      data: {path: "users/test.jpg"},
      error: null,
    }),
    remove: jest.fn().mockResolvedValue({
      data: null,
      error: null,
    }),
    getPublicUrl: jest.fn((path: string, options?: any) => ({
      data: {
        publicUrl: options?.transform
          ? `https://mock.supabase.co/storage/v1/render/image/public/media/${path}?width=${options.transform.width}`
          : `https://mock.supabase.co/storage/v1/object/public/media/${path}`,
      },
    })),
  };

  const client = {
    storage: {
      from: jest.fn().mockReturnValue(storageBucketMock),
    },
  };

  return {client, storageBucketMock};
}
