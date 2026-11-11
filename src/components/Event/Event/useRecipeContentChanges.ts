import React from "react";
import * as Sentry from "@sentry/react";

import {useDatabase} from "../../Database/DatabaseContext";
import {MenuplanData} from "../Menuplan/menuplan.types";
import {isTransientNetworkError} from "../../../utils/errorUtils";
import {getRecipeUidsOfMenues} from "./listOutOfDate";

/**
 * Liefert einen Zähler, der hochzählt, sobald der Browser-Tab wieder
 * sichtbar wird.
 *
 * Rezepte lassen sich in einem anderen Tab bearbeiten; ohne Neuladen beim
 * Zurückkehren bliebe die Warnung der Liste aus.
 *
 * @returns Zähler, geeignet als Effekt-Abhängigkeit.
 */
const useVisibleAgainCounter = (): number => {
  const [visibleAgainCount, setVisibleAgainCount] = React.useState(0);
  React.useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        setVisibleAgainCount((count) => count + 1);
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () =>
      document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, []);
  return visibleAgainCount;
};

/**
 * Lädt für alle Rezepte im Menüplan den Zeitpunkt der letzten inhaltlichen
 * Änderung.
 *
 * Neu geladen wird beim Mounten (also bei jedem Wechsel auf den Listen-Tab),
 * wenn sich die Rezepte im Menüplan ändern und wenn der Browser-Tab wieder
 * sichtbar wird. Scheitert das Laden, bleibt die Map leer: Dann warnt die
 * Liste wie bisher nur bei Menüplan-Änderungen.
 *
 * @param menuplan - Aktueller Menüplan des Anlasses.
 * @returns Änderungszeitpunkte pro Rezept-UID.
 * @example
 * const recipeChangeDates = useRecipeContentChanges(menuplan);
 */
export const useRecipeContentChanges = (
  menuplan: MenuplanData,
): Map<string, Date> => {
  const database = useDatabase();
  const visibleAgainCount = useVisibleAgainCounter();
  const [changeDates, setChangeDates] = React.useState<Map<string, Date>>(
    () => new Map(),
  );
  // Stabiler Schlüssel: neu laden nur, wenn sich die Rezepte wirklich ändern
  const recipeUidsKey = getRecipeUidsOfMenues(
    menuplan,
    Object.keys(menuplan.menues),
  )
    .sort()
    .join(",");

  React.useEffect(() => {
    let isCurrent = true;
    const recipeUids = recipeUidsKey ? recipeUidsKey.split(",") : [];
    database.recipes
      .getContentChangeDates(recipeUids)
      .then((loadedChangeDates) => {
        if (isCurrent) setChangeDates(loadedChangeDates);
      })
      .catch((error: unknown) => {
        if (!isTransientNetworkError(error)) {
          Sentry.captureException(error, {
            extra: {context: "Rezeptänderungen laden"},
          });
        }
      });
    return () => {
      isCurrent = false;
    };
  }, [database, recipeUidsKey, visibleAgainCount]);

  return changeDates;
};
