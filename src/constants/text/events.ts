/**
 * UI-Textkonstanten für Events (Anlässe) und Gruppen-Konfiguration.
 */

/* =====================================================================
// Meldungen zum Event
// ===================================================================== */
export const CREATE_YOUR_EVENT = "Erstelle deinen Anlass";
export const WHAT_ARE_YOU_UP_TO = "Was hast du vor?";
export const EVENT_SAVE_SUCCESS = (eventName: string) =>
  `Event «${eventName}» wurde gespeichert.`;
export const EVENT_SHOW_PAST_EVENTS = (count: number) =>
  `Zeige vergangene Anlässe (${count})`;
export const EVENT_PAST_EVENTS = "Deine vergangenen Anlässe";
export const EVENT_FUTURE_EVENTS = "Deine bevorstehende Anlässe";
export const EVENT_NO_FUTURE_EVENTS =
  "Keine bevorstehenden Anlässe. Erstelle einen neuen Anlass!";
export const EVENT_NO_PAST_EVENTS = "Keine vergangenen Anlässe vorhanden.";
export const CREATE_EVENT = "Anlass erstellen";
export const EVENT_INFO = "Informationen zum Anlass";
export const DEFINE_BASIC_EVENT_DATA =
  "Definiere die wichtigsten Eckdaten zu deinem Anlass.";
export const QUANTITY_CALCULATION_INFO = "Informationen zur Mengenberechnung";
export const COMPLETION = "Abschluss";
export const EVENT_NAME = "Name";
export const EVENT_NAME_HELPERTEXT = `Gib dem Anlass einen Namen. Beispielsweise Sola ${new Date().getFullYear()}.`;
export const MOTTO = "Motto";
export const MOTTO_HELPERTEXT = "Hat dein Anlass ein Motto?";
export const LOCATION = "Ort";
export const LOCATION_HELPERTEXT = "Wo findet der Anlass statt?";
export const DATES = "Daten";
export const START_DATE = "Start-Datum";
export const END_DATE = "Ende-Datum";
export const NO_OF_DAYS = "Anzahl Tage";
export const NO_OF_COOKS = "Köche";
export const DELETE_DATES = "Daten löschen.";
export const ADD_IMAGE = "Bild hinzufügen";
export const DELETE_IMAGE = "Bild löschen";
export const COVER_PICTURES = "Titelbild";
export const ADD_LOGO_OR_CAMP_PICTURE_HERE =
  "Füge das Logo oder Lagerbild hinzu.";
export const CONTINUE = "Weiter";
export const BACK_TO_OVERVIEW = "Zurück zur Übersicht";
export const BACK_TO_GROUPCONFIG = "Zurück zur Gruppendefinition";
export const KITCHENCREW = "Küchen-Crew";
export const COOKING_IS_COMMUNITY_SPORT =
  "Weil kochen ein Gesellschaftssport ist, füge hier deine Küchen-Crew hinzu.";
export const ADD_COOK_TO_EVENT = "Person zu Anlass hinzufügen";
export const BACK_TO_EVENT_INFO = "Zurück zu Informationen";
export const ERROR_EVENT_NAME_CANT_BE_EMPTY =
  "Der Name des Anlasses darf nicht leer sein.";
export const ERROR_EVENT_MUST_HAVE_MIN_ONE_COOK =
  "Der Anlass muss mindestens eine Person in der Küchen-Crew haben.";
export const ERROR_EVENT_MUST_HAVE_MIN_ONE_DATE =
  "Der Anlass muss mindestens eine Zeitscheibe (Von-/Bis-Datum) haben.";
export const ERROR_FROM_DATE_EMPTY = "Von-Datum darf nicht leer sein";
export const ERROR_TO_DATE_EMPTY = "Bis-Datum darf nicht leer sein";
export const ERROR_FROM_DATE_BIGGER_THAN_TO_DATE =
  "Das Von-Datum ist grösser als das Bis-Datum";
export const ERROR_FORM_VALIDATION =
  "Einige Informationen können nicht verarbeitet werden. Bitte überprüfe deine Eingabe der rot markierten Felder.";
export const ERROR_OVERLAPPING_DATES = (pos: number) =>
  `Die Daten überschneiden sich mit der Position ${pos}`;
export const EVENT_IS_BEEING_CREATED = (eventName: string) =>
  `${eventName} wird erstellt.`;
export const EVENT_IS_BEEING_SAVED = "Anlass wird gespeichert.";
export const IMAGE_IS_BEEING_UPLOADED = "Bild wird hochgeladen.";
export const IMAGE_FORMAT_NOT_SUPPORTED =
  "Dieses Bildformat wird nicht unterstützt. Bitte verwende JPEG, PNG oder WebP.";
export const IMAGE_TOO_LARGE =
  "Das Bild ist zu gross. Bitte wähle ein Bild unter 10 MB.";
export const RESUME_INTRODUCTION = (eventName: string) =>
  `Herzlichen Glückwunsch! Dein Anlass «${eventName}» wurde angelegt. Es geht gleich weiter. Gerne würden wir dich noch auf Folgendes hinweisen:`;
export const DONATE = "Spenden";
export const PLEASE_DONATE = "Spende erwünscht";
export const WHY_DONATE =
  "Unser Team arbeitet ehrenamtlich, um die App kostenlos anzubieten. Wir sind auf Spenden angewiesen, um die laufenden Kosten zu decken. Wenn dir die App gefällt und dein Anlassbudget es zulässt, unterstütze uns gerne mit einer Spende. Dein Beitrag hilft, das Angebot weiterhin kostenlos anbieten zu können sowie die App am Laufen zu halten und weiter zu verbessern.";
export const NEED_A_RECEIPT =
  "Du erhältst nach der Spende automatisch eine Quittung per E-Mail.";
export const THANK_YOU_1000 = "Merci 1000";
/* =====================================================================
// Anlass kopieren
// ===================================================================== */
export const COPY_EVENT = "Anlass kopieren";
export const COPY_EVENT_DEFAULT_NAME = (eventName: string) =>
  `Kopie von ${eventName}`;
export const COPY_EVENT_TIMESLICE_LABEL = (
  index: number,
  dateFrom: string,
  dateTo: string,
  days: number,
) => `Zeitscheibe ${index}: ${dateFrom} – ${dateTo} (${days} ${days === 1 ? "Tag" : "Tage"})`;
export const COPY_EVENT_NEW_START = "Neuer Start";
export const COPY_EVENT_NEW_END = "Neues Ende";
export const COPY_EVENT_TIMESLICES = "Zeitscheiben";
export const COPY_EVENT_OPTIONS = "Optionen";
export const COPY_EVENT_MENUPLAN = "Menüplan";
export const COPY_EVENT_GROUPCONFIG = "Gruppenconfig";
export const COPY_EVENT_VARIANTS = "Rezeptvarianten kopieren";
export const COPY_EVENT_COOKS = "Kochcrew übernehmen";
export const COPY_EVENT_LISTS_INFO =
  "Einkaufs- und Materiallisten werden nicht kopiert und können nach dem Kopieren neu generiert werden.";
export const COPY_EVENT_NO_PHOTO = "Kein Foto ausgewählt";
export const COPY_EVENT_CHOOSE_PHOTO = "Foto wählen";
export const COPY_EVENT_SUBMIT = "Kopieren";
export const COPY_EVENT_SUBMITTING = "Kopiere…";
export const COPY_EVENT_ERROR =
  "Beim Kopieren ist ein Fehler aufgetreten.";

export const DELETE_EVENT = "Anlass löschen";
export const ATTENTION_ABOUT_TO_DELETE_PLANED_DAYS =
  "Achtung – Geplante Tage werden gelöscht!";
export const DELETION_AFFECTS_PLANED_DAYS =
  "Durch die vorgenommene Änderung hast du Tage entfernt, die bereits in der Planung berücksichtigt sind. Wenn du auf «Fortfahren» klickst, werden diese Tage zusammen mit den bereits eingeplanten Rezepten gelöscht.";
export const PROCEED = "Fortfahren";

/* =====================================================================
// Gruppen-Konfiguration
// ===================================================================== */
export const GROUP_CONFIGURATION_SETTINGS =
  "Einstellungen für die Mengenberechnung";
export const GROUP_CONFIGURATION_SETTINGS_DESCRIPTION =
  "Hier kannst du Gruppen und Unverträglichkeiten definieren. Diese kannst du danach mit den gewählten Rezepten verknüpfen. Dadurch kannst du an einem zentralen Ort die Portionen anpassen und die Änderungen werden für alle zugeordneten Rezepte übernommen. Keine Sorge. Die Anzahl Portionen kannst du auch noch zu einem späteren Zeitpunkt anpassen.";
export const WITHOUT_INTOLERANCES = "Ohne Unverträglichkeiten";
export const LACTOSE_INTOLERANCE = "Laktoseintoleranz";
export const GLUTEN_INTOLERANCE = "Glutenunverträglichkeit";
export const ADD_DIET = "Diät-Gruppe hinzufügen";
export const TOTAL = "Total";
export const MEAT = "Fleisch";
export const VEGETARIAN = "Vegetarisch";
export const GROUPS = "Gruppen";
export const INTOLERANCE = "Unverträglichkeit";
export const DIET_GROUP = "Diät-Gruppe";
