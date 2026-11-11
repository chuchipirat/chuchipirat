import {Menue, MenuplanData} from "../Menuplan/menuplan.types";

/**
 * Eingaben für {@link isListOutOfDate}.
 *
 * @property listGeneratedAt - Zeitpunkt, zu dem die Liste erstellt bzw. zuletzt aktualisiert wurde.
 * @property menuplanChangedAt - Letzte Änderung des Menüplans.
 * @property recipesChangedAt - Letzte inhaltliche Änderung eines Rezepts der Liste; `null`, wenn unbekannt.
 */
export type ListOutOfDateInput = {
  listGeneratedAt: Date;
  menuplanChangedAt: Date;
  recipesChangedAt: Date | null;
};

/**
 * Sammelt die Rezept-UIDs der angegebenen Menüs, ohne Duplikate.
 *
 * Menüs, die nicht mehr im Menüplan stehen, werden übersprungen: Eine Liste
 * kann auf ein inzwischen gelöschtes Menü verweisen.
 *
 * @param menuplan - Aktueller Menüplan.
 * @param menueUids - UIDs der Menüs, z.B. die `selectedMenues` einer Liste.
 * @returns Rezept-UIDs in der Reihenfolge ihres ersten Auftretens.
 * @example
 * getRecipeUidsOfMenues(menuplan, list.properties.selectedMenues); // ["recipe-1", ...]
 */
export const getRecipeUidsOfMenues = (
  menuplan: MenuplanData,
  menueUids: Menue["uid"][],
): string[] => {
  const recipeUids = menueUids
    .flatMap((menueUid) => menuplan.menues[menueUid]?.mealRecipeOrder ?? [])
    .map(
      (mealRecipeUid) => menuplan.mealRecipes[mealRecipeUid]?.recipe?.recipeUid,
    )
    .filter((recipeUid): recipeUid is string => Boolean(recipeUid));
  return Array.from(new Set(recipeUids));
};

/**
 * Ermittelt die jüngste inhaltliche Änderung unter den angegebenen Rezepten.
 *
 * @param recipeUids - UIDs der zu prüfenden Rezepte.
 * @param changeDates - Änderungszeitpunkte pro Rezept-UID.
 * @returns Jüngster Zeitpunkt oder `null`, wenn für keines ein Zeitpunkt bekannt ist.
 * @example
 * getLatestRecipeChange(["recipe-1"], new Map([["recipe-1", date]])); // date
 */
export const getLatestRecipeChange = (
  recipeUids: string[],
  changeDates: Map<string, Date>,
): Date | null =>
  recipeUids.reduce<Date | null>((latest, recipeUid) => {
    const changeDate = changeDates.get(recipeUid);
    if (!changeDate) return latest;
    return latest === null || changeDate > latest ? changeDate : latest;
  }, null);

/**
 * Prüft, ob eine Liste veraltet sein könnte, weil der Menüplan oder eines
 * ihrer Rezepte nach dem Erstellen der Liste geändert wurde.
 *
 * @param input - Siehe {@link ListOutOfDateInput}.
 * @returns `true`, wenn eine Änderung jünger ist als die Liste.
 * @example
 * isListOutOfDate({listGeneratedAt, menuplanChangedAt, recipesChangedAt: null});
 */
export const isListOutOfDate = ({
  listGeneratedAt,
  menuplanChangedAt,
  recipesChangedAt,
}: ListOutOfDateInput): boolean =>
  menuplanChangedAt > listGeneratedAt ||
  (recipesChangedAt !== null && recipesChangedAt > listGeneratedAt);
