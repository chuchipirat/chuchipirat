/**
 * Jest-Setup: Polyfills für die jsdom-Testumgebung.
 *
 * `structuredClone` ist in jsdom nicht verfügbar, wird aber im
 * Produktionscode als Ersatz für `_.cloneDeep` verwendet.
 */
if (typeof globalThis.structuredClone === "undefined") {
  globalThis.structuredClone = <T>(value: T): T =>
    JSON.parse(JSON.stringify(value));
}
