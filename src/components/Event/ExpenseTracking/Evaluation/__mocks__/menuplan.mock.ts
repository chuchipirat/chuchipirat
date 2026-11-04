import {MenuplanData} from "../../../Menuplan/menuplan.types";

/** Inhalt eines Menüs im Test: was darin eingeplant ist. */
export type MockMenueContent = "recipe" | "product" | "material" | "empty";

/**
 * Eine Mahlzeit im Test: Tag, Mahlzeitentyp und die Inhalte ihrer Menüs.
 *
 * @param date - Tag im Format `YYYY-MM-DD`.
 * @param mealType - UID des Mahlzeitentyps.
 * @param menues - Ein Eintrag pro Menü der Mahlzeit.
 */
export type MockMeal = {
  date: string;
  mealType: string;
  menues: MockMenueContent[];
};

/**
 * Baut einen Menüplan für Tests: pro Eintrag eine Mahlzeit mit je einem Menü
 * pro Inhalt. Mahlzeitentyp-UID und -Name sind gleich, alle IDs sprechend
 * (`2026-07-05-zmorge-menue-0`), damit Fehlermeldungen lesbar bleiben. Befüllt
 * nur, was die Auswertung braucht (Typen, Mahlzeiten, Menüs).
 *
 * @param mealTypeIds - Mahlzeitentypen in Menüplan-Reihenfolge.
 * @param meals - Mahlzeiten mit ihren Menü-Inhalten.
 * @param uid - UID des Menüplans; leer = «lädt noch» (wie `createEmptyMenuplan`).
 * @returns Vollständiger Menüplan.
 * @example
 * buildMenuplan(["zmorge"], [{date: "2026-07-05", mealType: "zmorge", menues: ["recipe"]}])
 */
export const buildMenuplan = (
  mealTypeIds: string[],
  meals: MockMeal[],
  uid = "event-id-001",
): MenuplanData => {
  const menuplan: MenuplanData = {
    uid,
    dates: [],
    mealTypes: {
      order: mealTypeIds,
      entries: Object.fromEntries(
        mealTypeIds.map((mealTypeId) => [
          mealTypeId,
          {uid: mealTypeId, name: mealTypeId},
        ]),
      ),
    },
    meals: {},
    menues: {},
    notes: {},
    mealRecipes: {},
    materials: {},
    products: {},
    created: {date: new Date(0), fromUid: "", fromDisplayName: ""},
    lastChange: {date: new Date(0), fromUid: "", fromDisplayName: ""},
  };
  meals.forEach((meal) => {
    const mealUid = `${meal.date}-${meal.mealType}`;
    const menueUids = meal.menues.map(
      (_content, menueIndex) => `${mealUid}-menue-${menueIndex}`,
    );
    menuplan.meals[mealUid] = {
      uid: mealUid,
      date: meal.date,
      mealType: meal.mealType,
      menuOrder: menueUids,
    };
    meal.menues.forEach((content, menueIndex) => {
      menuplan.menues[menueUids[menueIndex]] = {
        uid: menueUids[menueIndex],
        name: "",
        mealRecipeOrder: content === "recipe" ? ["meal-recipe"] : [],
        productOrder: content === "product" ? ["product"] : [],
        materialOrder: content === "material" ? ["material"] : [],
      };
    });
  });
  return menuplan;
};

/** Menüplan, der noch lädt (leer, `uid` leer). */
export const LOADING_MENUPLAN = buildMenuplan([], [], "");
