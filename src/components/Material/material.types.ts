/**
 * Typdefinitionen und Factory-Funktion für Materialien (Stammdaten).
 *
 * Ersetzt die alte Firebase-basierte `material.class.ts`.
 * Der numerische Enum bleibt aus Kompatibilitätsgründen erhalten —
 * eine Umstellung auf String-Enums ist als Tech-Debt geplant.
 */

// HINT💡:
// wird dies erweitert, muss auch im Cloud-Function File index
// die Beschreibung angepasst werden. Sonst funktioniert der
// Feed-Recap-Newsletter nicht.
export enum MaterialType {
  none = 0,
  consumable = 1,
  usage = 2,
}

/**
 * Domain-Modell für ein Material (Küchenmaterial wie Töpfe, Teller, Servietten).
 *
 * @param uid - Eindeutige ID des Materials.
 * @param name - Name des Materials.
 * @param type - Materialtyp (Verbrauchs- oder Gebrauchsmaterial).
 * @param usable - Ob das Material aktiv/nutzbar ist.
 */
export type Material = {
  uid: string;
  name: string;
  type: MaterialType;
  usable: boolean;
};

/**
 * Erzeugt ein leeres Material mit Standardwerten.
 *
 * @returns Neues Material mit leerer UID/Name, Typ `consumable` und `usable = false`.
 * @example
 * const material = createEmptyMaterial();
 */
export function createEmptyMaterial(): Material {
  return {
    uid: "",
    name: "",
    type: MaterialType.consumable,
    usable: false,
  };
}
