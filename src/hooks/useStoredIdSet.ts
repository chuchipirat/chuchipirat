import React from "react";

/**
 * Rückgabe von {@link useStoredIdSet}.
 */
export type StoredIdSet = {
  /** Aktuell gespeicherte IDs (Reihenfolge ohne Bedeutung). */
  ids: string[];
  /** Fügt die ID hinzu bzw. entfernt sie, falls sie schon drin ist. */
  toggleId: (id: string) => void;
  /** Entfernt alle IDs (Liste und Speicher sind danach leer). */
  clearIds: () => void;
};

/**
 * Prüft, ob ein geparster Wert ein Array aus Strings ist.
 *
 * @param value Beliebiger Wert aus `JSON.parse`.
 * @returns `true`, wenn `value` ein `string[]` ist.
 */
const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((entry) => typeof entry === "string");

/**
 * Liest eine Liste von IDs aus dem LocalStorage.
 *
 * @param storageKey Schlüssel im LocalStorage.
 * @returns Gespeicherte IDs, oder eine leere Liste, wenn nichts gespeichert,
 *   der Inhalt ungültig oder der Speicher blockiert ist.
 */
const readStoredIds = (storageKey: string): string[] => {
  try {
    const storedValue = localStorage.getItem(storageKey);
    if (storedValue === null) return [];
    const parsedValue: unknown = JSON.parse(storedValue);
    return isStringArray(parsedValue) ? parsedValue : [];
  } catch {
    // Blockierter Speicher (z.B. privates Fenster) oder kaputtes JSON ist
    // kein Fehler der App, darum kein Sentry: einfach leer starten.
    return [];
  }
};

/**
 * Schreibt eine Liste von IDs in den LocalStorage.
 *
 * @param storageKey Schlüssel im LocalStorage.
 * @param ids Zu speichernde IDs.
 */
const writeStoredIds = (storageKey: string, ids: string[]): void => {
  try {
    localStorage.setItem(storageKey, JSON.stringify(ids));
  } catch {
    // Speicher voll oder blockiert: Die Auswahl gilt dann nur bis zum
    // Neuladen. Der State ist bereits gesetzt, darum nichts weiter tun.
  }
};

/**
 * Hält eine Menge von IDs, die pro Gerät im LocalStorage gespeichert wird.
 * Kennt keine Fachlogik: Was die IDs bedeuten (z.B. abgewählte Budgets),
 * entscheidet der Aufrufer.
 *
 * Bekannte Grenze: Ändert sich `storageKey` bei montierter Komponente,
 * wird nicht neu gelesen. Ein anderer Anlass montiert die Seite neu.
 *
 * @param storageKey Schlüssel im LocalStorage, z.B. inkl. Anlass-ID.
 * @returns Die IDs sowie Funktionen zum Umschalten einer ID und zum Leeren
 *   der Liste.
 * @example
 * const {ids: excludedBudgetIds, toggleId, clearIds} = useStoredIdSet(
 *   `${LocalStorageKey.EXPENSE_EVALUATION_EXCLUDED_BUDGETS}_${eventId}`,
 * );
 */
export const useStoredIdSet = (storageKey: string): StoredIdSet => {
  const [ids, setIds] = React.useState<string[]>(() =>
    readStoredIds(storageKey),
  );

  const toggleId = React.useCallback(
    (id: string) => {
      const nextIds = ids.includes(id)
        ? ids.filter((storedId) => storedId !== id)
        : [...ids, id];
      setIds(nextIds);
      writeStoredIds(storageKey, nextIds);
    },
    [ids, storageKey],
  );

  const clearIds = React.useCallback(() => {
    setIds([]);
    writeStoredIds(storageKey, []);
  }, [storageKey]);

  return {ids, toggleId, clearIds};
};
