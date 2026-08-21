import React from "react";

/**
 * Verzögert die Übernahme eines Werts, bis er sich für `delayMs` nicht
 * mehr geändert hat. Nützlich für Sucheingaben, bei denen nicht bei
 * jedem Tastendruck reagiert werden soll (z.B. Analytics-Tracking).
 *
 * @param value - Der Ausgangswert, der sich häufig ändern kann.
 * @param delayMs - Wartezeit in Millisekunden ohne Änderung.
 * @returns Der verzögerte Wert.
 * @example
 * const debouncedSearchString = useDebouncedValue(searchString, 600);
 */
export const useDebouncedValue = <T,>(value: T, delayMs: number): T => {
  const [debouncedValue, setDebouncedValue] = React.useState(value);

  React.useEffect(() => {
    const timeoutId = setTimeout(() => setDebouncedValue(value), delayMs);
    return () => clearTimeout(timeoutId);
  }, [value, delayMs]);

  return debouncedValue;
};
