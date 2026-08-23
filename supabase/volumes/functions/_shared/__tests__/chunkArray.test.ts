import {chunkArray} from "../chunkArray";

describe("chunkArray", () => {
  test("gibt ein leeres Array zurück, wenn items leer ist", () => {
    expect(chunkArray([], 500)).toEqual([]);
  });

  test("teilt items in gleich grosse Teil-Arrays auf, wenn size exakt aufgeht", () => {
    const items = [1, 2, 3, 4, 5, 6];
    expect(chunkArray(items, 2)).toEqual([[1, 2], [3, 4], [5, 6]]);
  });

  test("hängt einen kürzeren Rest als letztes Teil-Array an", () => {
    const items = [1, 2, 3, 4, 5];
    expect(chunkArray(items, 2)).toEqual([[1, 2], [3, 4], [5]]);
  });

  test("gibt ein einzelnes Teil-Array zurück, wenn size grösser als items ist", () => {
    const items = ["a", "b", "c"];
    expect(chunkArray(items, 10)).toEqual([["a", "b", "c"]]);
  });

  test("gibt bei size 1 jedes Element als eigenes Teil-Array zurück", () => {
    const items = ["a", "b", "c"];
    expect(chunkArray(items, 1)).toEqual([["a"], ["b"], ["c"]]);
  });

  test("teilt 1800 Empfänger korrekt in Batches von 500 auf (Mail-Konsole-Anwendungsfall)", () => {
    const recipients = Array.from({length: 1800}, (_, index) => `user${index}@example.com`);
    const chunks = chunkArray(recipients, 500);

    expect(chunks).toHaveLength(4);
    expect(chunks[0]).toHaveLength(500);
    expect(chunks[1]).toHaveLength(500);
    expect(chunks[2]).toHaveLength(500);
    expect(chunks[3]).toHaveLength(300);
    expect(chunks.flat()).toEqual(recipients);
  });
});
