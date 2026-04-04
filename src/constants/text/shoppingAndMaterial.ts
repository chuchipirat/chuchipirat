/**
 * UI-Textkonstanten für Einkaufslisten, Materiallisten und
 * die zugehörigen Dialoge/Aktionen.
 */
export const MENUE_SELECTION = "Auswahl Menüs";
export const USED_RECIPES_MENUE_SELECTION_DESCRIPTION =
  "Hier kannst du bereits generierte Listen anzeigen lassen oder eine neue Liste erstellen. Eine Liste beinhaltet alle verwendeten Rezepte der gewählten Menüs. Bei bestehenden Listen hast du die Möglichkeit, die Liste zu aktualisieren.";
export const SHOPPING_LIST_MENUE_SELECTION_DESCRIPTION =
  "Hier kannst du bereits generierte Einkaufslisten anzeigen lassen oder eine neue Liste erstellen. Eine Liste beinhaltet alle Zutaten, Gebrauchsmaterialien der gewählten Menüs (inklusive einzelne hinzugefügte Produkte). Bei bestehenden Listen hast du die Möglichkeit, die Liste zu aktualisieren.";
export const REFRESH = "Aktualisieren";
export const WHICH_MENUES_FOR_RECIPE_GENERATION =
  "Für welche Menües sollen die Rezepte generiert werden?";
export const WHICH_MENUES_FOR_SHOPPING_LIST_GENERATION =
  "Für welche Menües soll die Einkaufsliste generiert werden?";
export const WHICH_MENUES_FOR_MATERIAL_LIST_GENERATION =
  "Für welche Menües soll die Materialliste generiert werden?";
export const SELECT_DAY = "Tag auswählen";
export const SELECT_ALL = "Alle auswählen";
export const EXISTING_LISTS = "Bestehende Listen";
export const LIST_ENTRY_MAYBE_OUT_OF_DATE = (listName: string) =>
  `Bitte beachte, dass der Menüplan in der Zwischenzeit geändert wurde. Dadurch könnten die Werte der angezeigten ${listName} möglicherweise nicht mehr korrekt sein. Bitte wähle Aktualisieren, um die Auswahl neu zu berechnen.`;
export const USED_RECIPES_OF_SHOPPINGLIST_POSSIBLE_OUT_OF_DATE =
  "Bitte beachte, dass der Menüplan in der Zwischenzeit geändert wurde. Dadurch könnten die angezeigten Mengen und Produkte möglicherweise nicht mehr korrekt sein. Bitte wähle Aktualisieren, um die Einkaufsliste neu zu generieren.";
export const SHOPPINTLIST_ITEM_MOVED_TO_RIGHT_DEPARTMENT = (
  itemName: string,
  departmentName: string,
) =>
  `Der Produkt ${itemName} wurde automatisch in den Abschnitt ${departmentName} verschoben.`;
export const NEW_LIST = "Neue Liste";
export const GIVE_THE_NEW_LIST_A_NAME = "Gib dieser Liste einen Namen.";
export const DRIFT_DETECTED_TITLE = "Menüplan-Änderung erkannt";
export const DRIFT_DETECTED_DESCRIPTION =
  "Die ausgewählten Menüs wurden im Menüplan auf andere Tage/Mahlzeiten verschoben. " +
  "Möchtest du die ursprünglichen Tage beibehalten oder die aktuellen Menüpositionen übernehmen?";
export const KEEP_ORIGINAL_DAYS = "Ursprüngliche Tage";
export const FOLLOW_CURRENT_MENUES = "Gewählte Menüs";
export const GIVE_THE_NEW_SHOPPINGLIST_A_NAME =
  "Gib dieser Einkaufsliste einen Namen.";
export const WHERE_DOES_THIS_ITEM_COME_FROM = (itemType: string) =>
  `Woher stammt ${itemType == ITEM ? "dieser" : "dieses"} ${itemType}?`;
export const ADD_ITEM = "Artikel hinzufügen";
export const ITEM = "Artikel";
export const NEW_ITEM = "Neuer Artikel";
export const WHAT_KIND_OF_ITEM_ARE_YOU_CREATING =
  "Was für eine Art von Artikel möchtest du erfassen?";
export const FOOD = "Lebensmittel";
export const ITEM_CANT_BE_CHANGED = "Artikel kann nicht geändert werden.";
export const THE_QUANTITY_HAS_BEEN_MANUALY_EDITED =
  "Die automatische berechnete Menge wurde manuell angepasst.";
export const ADDED_MANUALY = "manuell hinzugefügt";
export const ARTICLE_ALREADY_ADDED = "Artikel bereits vorhanden";
/**
 * Snackbar-Meldung, wenn ein Artikel mit Menge 0 hinzugefügt wird,
 * der bereits in der Einkaufsliste existiert.
 *
 * @param article Name des Artikels.
 * @returns Formatierter Hinweistext.
 */
export const ARTICLE_ALREADY_IN_LIST = (article: string) =>
  `«${article}» ist bereits in der Einkaufsliste vorhanden.`;
export const ADD_OR_REPLACE_ARTICLE = (
  article: string,
  unit: string,
  oldQuantity: string,
  newQuantity: string,
) =>
  `Das Produkt «${article}» ist in der Einheit «${unit}» in der Einkaufsliste bereits vorhanden. Wie soll mit der hinzufügenden Menge fortgefahren werden? Möchtest du die bestehende Menge von ${oldQuantity} ${unit} mit der neuen Menge von ${newQuantity} ${unit} überschreiben oder dazuzählen?`;
export const REPLACE = "Ersetzen";
export const SUM = "Dazuzählen";
export const MANUALLY_ADDED_PRODUCTS = "Manuell hinzugefügte Artikel";
export const KEEP_MANUALLY_ADDED_PRODUCTS = (listName: string) =>
  `Diese ${listName} beinhaltet manuell hinzugefügte Artikel. Sollen diese bei der Aktualisierung beibehalten oder sollen sie aus der Liste gelöscht werden?`;
export const MANUALLY_EDITED_PRODUCTS = "Manuell bearbeitete Artikel";
export const KEEP_MANUALLY_EDITED_PRODUCTS = (listName: string) =>
  `Diese ${listName} beinhaltet manuell bearbeitete Artikel. Sollen die Anpassungen bei der Aktualisierung beibehalten oder durch die neu berechneten Werte ersetzt werden?`;
export const KEEP = "Behalten";
export const CHECKED_ITEMS = "Abgehakte Artikel";
export const CHECKED_ITEMS_EXPLANATION = (listName: string) =>
  `Diese ${listName} beinhaltet bereits abgehakte Artikel. Sollen die Artikel auch nach der Aktualisierung abgehakt bleiben?`;
export const MATERIAL_LIST_MENUE_SELECTION_DESCRIPTION =
  " Hier kannst du bereits generierte Materiallisten anzeigen lassen oder eine neue Liste erstellen. Eine Liste beinhaltet alle Materialien vom Typ «Gebrauchsmaterial» der gewählten Menüs. Bei bestehenden Listen hast du die Möglichkeit, die Liste zu aktualisieren.";
export const DIALOG_TITLE_SELECT_DEPARTMENT = "Abteilung wählen";
export const DIALOG_SUBTITLE_SELECT_DEPARTMENT =
  "Wähle die Abteilungen, die für die Generierung der Einkaufsliste berücksichtigt werden sollen.";
export const NO_DEPARTMENTS_MARKED = "Keine Abteilungen ausgewählt";
export const QUANTITY = "Menge";
