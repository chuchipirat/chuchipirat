/**
 * UI-Textkonstanten für den Menüplan (Mahlzeiten, Menüs, Portionen,
 * Drag & Drop, Dialoge).
 */
export const SHOW_DETAILS = "Details anzeigen";
export const ENABLE_DRAG_AND_DROP = "Drag & Drop aktivieren";
export const ADD_MEAL = "Mahlzeit hinzufügen";
export const COMMENT = "Kommentar";
export const COMMENTS = "Kommentare";
export const COMMENT_DELETE_TITLE = "Kommentar löschen";
export const COMMENT_DELETE_TEXT =
  "Möchtest du diesen Kommentar wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.";
export const NEW_MENU = "Neues Menü";
export const ADD_RECIPE = "Rezept hinzufügen";
export const EDIT_MENUE = "Menü bearbeiten";
export const ADD_PRODUCT = "Produkt hinzufügen";
export const ADD_MATERIAL = "Material hinzufügen";
export const RECIPES_DRAWER_TITLE = "Was für ein Rezept suchst du?";
export const DIALOG_CHOOSE_MENUES_TITLE = "Wann gibt es dieses Rezept?";
export const DIALOG_CHOOSE_MEALS_TITLE = "Welche Mahlzeit soll es sein?";
export const DIALOG_PLAN_RECIPE_PORTIONS_TITLE =
  "Für wen planst du das Rezept ein?";
export const DIALOG_PLAN_GOODS_PORTIONS_TITLE =
  "Wie viele Portionen willst du planen?";
export const MENUE = "Menü";
export const ALL = "Alle";
export const FIX_PORTIONS = "Fixe Portionen";
export const ON_DATE = "Am";
export const KEEP_PLANED_PORTIONS_IN_SYNC = "Für alle Menüs gleich";
export const FACTOR = "Faktor";
export const TOTAL_PORTIONS = "Total Portionen";
export const FACTOR_TOOLTIP =
  "Mit dem Faktor kannst du die Anzahl Portionen beeinflussen. So kannst du zum Beispiel mit dem Faktor 0.5 halb so viele Portionen zubereiten oder mit dem Faktor 1.2 etwas mehr (grosser Hunger).";
export const YOUR_SELECTION_MAKES_X_SERVINGS = "Deine Auswahl ergibt:";
export const BACK = "zurück";
export const PLEASE_PROVIDE_VALID_FACTOR = "Faktor ungültig";
export const QUANTITY_MUST_BE_POSITIVE = "Die Menge muss grösser als 0 sein.";
export const QUANTITY_TOO_LARGE =
  "Die Menge darf höchstens 99\u2009999 betragen.";
export const FACTOR_TOO_LARGE = "Der Faktor darf höchstens 100 betragen.";
export const NO_MENUES_MARKED =
  "Es wurde kein Menü markiert, für welches das Rezept eingeplant werden soll.";
export const MISSING_FACTOR =
  "Es gibt ausgewählte Einträge, bei denen fehlt der Faktor. Für diese können die Portionen nicht berechnet werden. Bitte trage einen Faktor ein.";
export const NO_GROUP_SELECTED = "Es wurde keine Gruppe ausgewählt. ";
export const NO_PORTIONS_GIVEN = "Es wurde keine Anzahl Portionen angegeben";
export const DELETE_MENUE = "Menü löschen";
export const EXPLANATION_DIALOG_GOODS_TYPE_PRODUCT =
  "Hier kannst du einzelne Produkte dem Menü hinzufügen. Diese werden ebenfalls für die Einkaufsliste berücksichtigt.";
export const EXPLANATION_DIALOG_GOODS_TYPE_MATERIAL =
  "Hier kannst du einzelne Materialien dem Menü hinzufügen. Diese werden ebenfalls für die Einkaufs- resp. Materialliste berücksichtigt.";
export const EXPLANATION_DIALOG_GOODS_OPTION_TOTAL = (goodsType: string) =>
  `Mit der Option «Total» bestimmst du die Totalmenge, die zusätzlich von diesem ${goodsType} eingeplant wird. Eine Veränderung der Anzahl Portionen hat keinen Einfluss auf die von dir bestimmte Menge.`;
export const EXPLANATION_DIALOG_GOODS_OPTION_PER_PORTION =
  "Mit der Option «pro Portion» bestimmst du die Menge pro eingeplante Portion. Eine nachträgliche Veränderung der Anzahl Portionen beeinflusst auch die Menge der eingeplanten Menge. Die Bestimmung der Portionen geschieht im nächsten Schritt.";
export const ALL_MEAL_AND_VALUES_WILL_BE_DELETED =
  "Alle Menüs, Rezepte, Produkte und Materialien von dieser Mahlzeit werden gelöscht. Möchtest du fortfahren?";
export const ALL_RECIPES_AND_VALUES_WILL_BE_DELETED =
  "Alle Rezepte, Produkte und Materialien von diesem Menü werden gelöscht. Möchtest du fortfahren?";
export const DESCRIBE_YOUR_VARIANT =
  "Beschreibe, was deine Variante ausmacht. z.B. «laktosefrei», «ohne Erdnüsse» usw.";
export const UNSAVED_CHANGES = "Ungespeicherte Änderungen";
export const DISCARD_CHANGES = "Änderungen verwerfen";
export const FIXED_PORTIONS_WARNING =
  "Fixe Portionen werden unabhängig der Gruppenplanung verwendet.";
export const CONFLICT_ALLE_AND_DIETS_TITLE = "Doppelte Portionen";
export const CONFLICT_ALLE_AND_DIETS_TEXT =
  "Du hast sowohl «Alle» als auch einzelne Diäten gewählt. Das verdoppelt die Portionen. Welche Planung möchtest du behalten?";
export const KEEP_ALL = "«Alle» behalten";
export const KEEP_INDIVIDUAL_DIETS = "Einzelne Diäten behalten";
export const RECALCULATE_PORTIONS = "Portionen neu berechnen";
export const PORTIONS_RECALCULATED =
  "Portionen im Menüplan neu berechnet und die neuen Einstellungen wurden gespeichert.";
export const RECIPE_WIHOUT_PORTIONPLAN =
  "Dieses Rezept besitzt keine Einplanung";
