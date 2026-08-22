import {fetchAllRows} from "../fetchAllRows";

/**
 * Baut einen Mock-Query-Builder, der eine feste Seite Zeilen für einen
 * gegebenen `.range()`-Aufruf zurückgibt. Simuliert PostgRESTs
 * Standardlimit von 1000 Zeilen pro Request.
 *
 * @param pages - Zeilen pro Seite (Index 0 = erste Seite, usw.).
 * @param error - Optionaler Fehler, der bei jedem Aufruf zurückgegeben wird.
 */
const createMockClient = (
  pages: Record<string, unknown>[][],
  error: {message: string} | null = null,
) => {
  const rangeMock = jest.fn((offset: number, _to: number) => {
    const pageIndex = Math.floor(offset / 1000);
    const data = pages[pageIndex] ?? [];
    return Promise.resolve({data: error ? null : data, error});
  });

  const selectMock = jest.fn(() => ({range: rangeMock}));
  const fromMock = jest.fn(() => ({select: selectMock}));

  return {client: {from: fromMock}, fromMock, selectMock, rangeMock};
};

describe("fetchAllRows", () => {
  test("gibt alle Zeilen einer einzelnen Seite zurück (unter 1000 Zeilen)", async () => {
    const rows = [{id: "1"}, {id: "2"}, {id: "3"}];
    const {client, fromMock, selectMock, rangeMock} = createMockClient([rows]);

    const result = await fetchAllRows(client, "users", "id");

    expect(result).toEqual(rows);
    expect(fromMock).toHaveBeenCalledWith("users");
    expect(selectMock).toHaveBeenCalledWith("id");
    expect(rangeMock).toHaveBeenCalledTimes(1);
    expect(rangeMock).toHaveBeenCalledWith(0, 999);
  });

  test("paginiert über die 1000er-Grenze hinweg und fasst alle Seiten zusammen", async () => {
    const firstPage = Array.from({length: 1000}, (_, index) => ({id: `${index}`}));
    const secondPage = [{id: "1000"}, {id: "1001"}];
    const {client, rangeMock} = createMockClient([firstPage, secondPage]);

    const result = await fetchAllRows(client, "users", "id");

    expect(result).toHaveLength(1002);
    expect(result[0]).toEqual({id: "0"});
    expect(result[1001]).toEqual({id: "1001"});
    expect(rangeMock).toHaveBeenCalledTimes(2);
    expect(rangeMock).toHaveBeenNthCalledWith(1, 0, 999);
    expect(rangeMock).toHaveBeenNthCalledWith(2, 1000, 1999);
  });

  test("stoppt nach einer exakt vollen letzten Seite erst bei der nächsten leeren Seite", async () => {
    // Exakt 1000 Zeilen auf der ersten Seite — muss noch eine zweite
    // (leere) Seite abfragen, um sicherzugehen, dass es keine weitere gibt.
    const fullPage = Array.from({length: 1000}, (_, index) => ({id: `${index}`}));
    const {client, rangeMock} = createMockClient([fullPage, []]);

    const result = await fetchAllRows(client, "users", "id");

    expect(result).toHaveLength(1000);
    expect(rangeMock).toHaveBeenCalledTimes(2);
  });

  test("wendet den filter-Callback vor der Paginierung an", async () => {
    const rows = [{email: "a@example.com"}];
    const rangeMock = jest.fn().mockResolvedValue({data: rows, error: null});
    const notMock = jest.fn(() => ({range: rangeMock}));
    const selectMock = jest.fn(() => ({not: notMock}));
    const fromMock = jest.fn(() => ({select: selectMock}));
    const client = {from: fromMock};

    const filter = jest.fn((query) => query.not("email", "is", null));
    const result = await fetchAllRows(client, "users", "email", filter);

    expect(filter).toHaveBeenCalled();
    expect(notMock).toHaveBeenCalledWith("email", "is", null);
    expect(rangeMock).toHaveBeenCalledWith(0, 999);
    expect(result).toEqual(rows);
  });

  test("wirft einen Fehler, wenn eine Seite fehlschlägt", async () => {
    const {client} = createMockClient([[]], {message: "connection refused"});

    await expect(fetchAllRows(client, "users", "id")).rejects.toThrow(
      /fetchAllRows\(users\) fehlgeschlagen: connection refused/,
    );
  });
});
