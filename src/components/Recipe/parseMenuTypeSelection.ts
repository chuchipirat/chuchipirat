import {MenuType} from "./recipe.class";

/**
 * Wandelt den Wert einer Menüart-Mehrfachauswahl (MUI `Select multiple`) in
 * eine sortierte Liste von {@link MenuType}-Werten um.
 *
 * MUI liefert die Auswahl normalerweise als Array, dessen Einträge gemischt
 * Zahlen (bisher gespeichert) und Strings (Wert des angeklickten `MenuItem`)
 * sein können. Beim Autofill des Browsers feuert jedoch das versteckte native
 * Input — dann kommt ein kommagetrennter String (z.B. `"2"` oder `"1,3"`).
 *
 * Taucht der zuletzt gewählte Wert doppelt auf (einmal als Zahl, einmal als
 * String), wurde die Checkbox abgewählt — dann werden beide Einträge entfernt.
 *
 * @param rawValue Wert aus `event.target.value` des Select.
 * @returns Sortierte Menüarten ohne ungültige Einträge.
 * @example
 * parseMenuTypeSelection([1, "3"]) // [1, 3]
 * parseMenuTypeSelection([1, 3, "3"]) // [1] (3 abgewählt)
 * parseMenuTypeSelection("2") // [2] (Autofill)
 */
export function parseMenuTypeSelection(
  rawValue: string | ReadonlyArray<string | number>,
): MenuType[] {
  const rawValues =
    typeof rawValue === "string" ? rawValue.split(",") : rawValue;
  let selectedMenuTypes = rawValues
    .map((value) => parseInt(String(value)))
    .filter((menuType) => !Number.isNaN(menuType)) as MenuType[];

  // Der neuste Wert steht immer am Ende — doppelt vorhanden heisst: abgewählt
  const newestValue = selectedMenuTypes[selectedMenuTypes.length - 1];
  const occurrences = selectedMenuTypes.filter(
    (menuType) => menuType === newestValue,
  ).length;
  if (occurrences > 1) {
    selectedMenuTypes = selectedMenuTypes.filter(
      (menuType) => menuType !== newestValue,
    );
  }

  return selectedMenuTypes.sort((first, second) => first - second);
}
