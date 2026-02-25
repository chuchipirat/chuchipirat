/**
 * Supabase Client Mock für Unit-Tests.
 *
 * Stellt ein vollständig gemocktes SupabaseClient-Objekt bereit,
 * das in Tests anstelle des echten Clients verwendet wird.
 * Jede Methode gibt standardmässig {data: null, error: null} zurück
 * und kann pro Test mit mockResolvedValue/mockReturnValue überschrieben werden.
 */

/** Erzeugt eine chainable Query-Mock (select, insert, update, etc.) */
export const createQueryMock = () => {
  const mock: Record<string, jest.Mock> = {};

  const chainable = (methodName: string) => {
    mock[methodName] = jest.fn().mockReturnValue(mock);
    return mock;
  };

  // Alle Query-Builder-Methoden sind chainable
  chainable("select");
  chainable("insert");
  chainable("update");
  chainable("upsert");
  chainable("delete");
  chainable("eq");
  chainable("neq");
  chainable("gt");
  chainable("gte");
  chainable("lt");
  chainable("lte");
  chainable("like");
  chainable("ilike");
  chainable("in");
  chainable("order");
  chainable("limit");

  // single() beendet die Kette und gibt das Ergebnis zurück
  mock.single = jest.fn().mockResolvedValue({data: null, error: null});

  // Wenn die Kette ohne single() endet, muss der Query-Mock selbst thenable sein
  // Dies wird durch den "then"-Mock auf dem Objekt simuliert
  (mock as any).then = undefined; // Mark as non-thenable by default

  return mock;
};

/** Erzeugt ein gemocktes SupabaseClient-Objekt */
export const createSupabaseMock = () => {
  const queryMock = createQueryMock();

  const client = {
    from: jest.fn().mockReturnValue(queryMock),
    rpc: jest.fn().mockResolvedValue({data: null, error: null}),
    channel: jest.fn().mockReturnValue({
      on: jest.fn().mockReturnValue({
        subscribe: jest.fn().mockReturnValue({}),
      }),
    }),
    removeChannel: jest.fn(),
  };

  return {client, queryMock};
};
