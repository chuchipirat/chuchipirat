/**
 * Unit-Tests für den useStoredIdSet-Hook.
 *
 * Schwerpunkte: Lesen beim Mounten (leer, gültig, kaputt, falscher Typ),
 * blockierter Speicher (getItem/setItem werfen), Umschalten und Leeren
 * inkl. Speichern, getrennte Schlüssel pro Anlass.
 */
import {renderHook, act} from "@testing-library/react";

import {useStoredIdSet} from "../useStoredIdSet";

const STORAGE_KEY = "testIds_event-a";

/**
 * Liest den gespeicherten Wert zum Testschlüssel als geparstes JSON.
 *
 * @param storageKey - Schlüssel im LocalStorage.
 * @returns Geparster Wert oder null, wenn nichts gespeichert ist.
 */
const readStorage = (storageKey: string = STORAGE_KEY): unknown => {
  const storedValue = localStorage.getItem(storageKey);
  return storedValue === null ? null : JSON.parse(storedValue);
};

describe("useStoredIdSet, Lesen beim Mounten", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("nichts gespeichert → leere Liste", () => {
    const {result} = renderHook(() => useStoredIdSet(STORAGE_KEY));

    expect(result.current.ids).toEqual([]);
  });

  test("gespeichertes String-Array → diese IDs", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(["a", "b"]));

    const {result} = renderHook(() => useStoredIdSet(STORAGE_KEY));

    expect(result.current.ids).toEqual(["a", "b"]);
  });

  test("kaputtes JSON → leere Liste, kein Fehler", () => {
    localStorage.setItem(STORAGE_KEY, "{nicht json");

    const {result} = renderHook(() => useStoredIdSet(STORAGE_KEY));

    expect(result.current.ids).toEqual([]);
  });

  test.each([
    ["Objekt", JSON.stringify({a: 1})],
    ["Zahlen-Array", JSON.stringify([1, 2])],
    ["gemischtes Array", JSON.stringify(["a", 2])],
    ["String", JSON.stringify("a")],
  ])("gültiges JSON, aber kein String-Array (%s) → leere Liste", (_, value) => {
    localStorage.setItem(STORAGE_KEY, value);

    const {result} = renderHook(() => useStoredIdSet(STORAGE_KEY));

    expect(result.current.ids).toEqual([]);
  });

  test("getItem wirft (Speicher blockiert) → leere Liste, kein Fehler", () => {
    jest.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });

    const {result} = renderHook(() => useStoredIdSet(STORAGE_KEY));

    expect(result.current.ids).toEqual([]);
  });

  test("liest nur einmal beim Mounten, nicht bei jedem Render", () => {
    const getItemSpy = jest.spyOn(Storage.prototype, "getItem");

    const {rerender} = renderHook(() => useStoredIdSet(STORAGE_KEY));
    rerender();
    rerender();

    expect(getItemSpy).toHaveBeenCalledTimes(1);
  });
});

describe("useStoredIdSet, Umschalten und Leeren", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("Mounten schreibt nichts in den Speicher", () => {
    renderHook(() => useStoredIdSet(STORAGE_KEY));

    expect(readStorage()).toBeNull();
  });

  test("toggleId zweimal → zuerst drin und gespeichert, dann weg und gespeichert", () => {
    const {result} = renderHook(() => useStoredIdSet(STORAGE_KEY));

    act(() => result.current.toggleId("a"));
    expect(result.current.ids).toEqual(["a"]);
    expect(readStorage()).toEqual(["a"]);

    act(() => result.current.toggleId("a"));
    expect(result.current.ids).toEqual([]);
    expect(readStorage()).toEqual([]);
  });

  test("toggleId entfernt nur die angeklickte ID", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(["a", "b", "c"]));
    const {result} = renderHook(() => useStoredIdSet(STORAGE_KEY));

    act(() => result.current.toggleId("b"));

    expect(result.current.ids).toEqual(["a", "c"]);
    expect(readStorage()).toEqual(["a", "c"]);
  });

  test("setItem wirft → toggleId ändert den State trotzdem, kein Fehler", () => {
    jest.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("quota exceeded");
    });
    const {result} = renderHook(() => useStoredIdSet(STORAGE_KEY));

    act(() => result.current.toggleId("a"));

    expect(result.current.ids).toEqual(["a"]);
  });

  test("clearIds → State und Speicher leer", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(["a", "b"]));
    const {result} = renderHook(() => useStoredIdSet(STORAGE_KEY));

    act(() => result.current.clearIds());

    expect(result.current.ids).toEqual([]);
    expect(readStorage()).toEqual([]);
  });

  test("setItem wirft → clearIds leert den State trotzdem, kein Fehler", () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(["a", "b"]));
    const {result} = renderHook(() => useStoredIdSet(STORAGE_KEY));
    jest.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("quota exceeded");
    });

    act(() => result.current.clearIds());

    expect(result.current.ids).toEqual([]);
  });

  test("unterschiedliche Schlüssel beeinflussen sich nicht (Anlass A vs. B)", () => {
    const otherStorageKey = "testIds_event-b";
    const {result: resultEventA} = renderHook(() =>
      useStoredIdSet(STORAGE_KEY),
    );
    const {result: resultEventB} = renderHook(() =>
      useStoredIdSet(otherStorageKey),
    );

    act(() => resultEventA.current.toggleId("a"));

    expect(resultEventB.current.ids).toEqual([]);
    expect(readStorage(otherStorageKey)).toBeNull();
    expect(readStorage()).toEqual(["a"]);
  });
});
