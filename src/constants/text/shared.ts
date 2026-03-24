/**
 * UI-Textkonstanten für domänenübergreifende Begriffe, Alerts,
 * Tooltips, Navigation, Statistik, FormValidation und diverse
 * allgemeine Labels/Meldungen.
 */

/* =====================================================================
// Globale Begriffe
// ===================================================================== */
export const RECIPE_OPEN = "Rezept öffnen";
export const VISIBILITY = "Sichtbarkeit";

/* =====================================================================
// Panels
// ===================================================================== */
export const PANEL_NOTES = "Hinweis";
export const PANEL_INGREDIENTS = "Zutaten";
export const PANEL_PREPARATION = "Zubereitung";
export const INTRODUCE_YOURSELF = "Stell dich vor";

/* =====================================================================
// Tooltip
// ===================================================================== */
export const TOOLTIP_ADD_POS = "Neue Position einfügen";
export const TOOLTIP_ADD_SECTION = "Neuer Abschnitt einfügen";
export const TOOLTIP_MOVE_UP = "Nach oben verschieben";
export const TOOLTIP_MOVE_DOWN = "Nach unten verschieben";
export const TOOLTIP_MOVE_OTHER_MENU = "In anderes Menü verschieben";
export const TOOLTIP_MOVE_OTHER_MEAL = "In andere Mahlzeit verschieben";
export const PRIVATE_RECIPE = "Privates Rezept";
export const VARIANT_RECIPE = "Rezeptvariante";

/* =====================================================================
// Allgemeine Speicher Meldungen
// ===================================================================== */
export const SAVE_SUCCESS = "Daten gespeichert.";

/* =====================================================================
// Alert Texte und Überschriften
// ===================================================================== */
export const ALERT_TITLE_UUPS = "Uups... da ging was schief.";
export const ALERT_TITLE_WAIT_A_MINUTE = "Warte mal kurz....";
export const ONE_TWO_TRHEE_DONE = "1, 2, 3... Erledigt.";
export const ALERT_TITLE_MUTINY_ON_THE_HIGH_SEAS = "Meuterei auf hoher See...";
export const WELCOME_ON_BOARD = "Willkommen an Bord";
export const ALERT_TATSCH_BANG_DONE = "Tätsch-Bäng-Meringue: Erledigt!";
export const BACKSPELLED = "Zurück-buchstabiert";
export const CHANGE_UNDONE = "Die Änderung wurde rückgängig gemacht.";
export const NEW_EMAIL_IDENTICAL =
  "Die E-Mail-Adresse ist mit der bestehenden identisch.";
export const EMAIL_RECOVERED =
  "Die alte E-Mail-Adresse ist wieder deine Login-Adresse. Sicherheitshalber wurdest du abgemeldet. Hier kannst du dich wieder anmelden:  ";
export const TOOLTIP_RECIPE_IMAGE_SOURCE =
  "Du kannst die Adresse kopieren, indem du auf einer beliebigen Seite einen Rechtsklick auf ein Bild machst und den Eintrag 'Bildadresse kopieren' wählst.";
export const HELPERTEXT_RECIPE_IMAGE_SOURCE =
  "Füge hier die Web-Adresse eines Bildes ein.";
export const CONFIRM_CHANGES_ARE_LOST =
  "Bist du sicher, dass du abbrechen möchtest? Allfällige Änderungen gehen verloren.";
export const CONFIRM_DELETE_PICTURE =
  "Bist du sicher, dass du das Bild löschen möchtest?";
export const DELETE_PICTURE = "Bild löschen";

/* =====================================================================
// Diverse (längere) Texte
// ===================================================================== */
export const WELCOME_ON_BOARD_REDIRECT = (seconds: number) =>
  `Schön, bist du dabei. Wir erwarten dich auf der Brücke. Bitte gedulde dich noch ${seconds} Sekunden. Wir bereiten in dieser Zeit alles für dich vor.`;

/* =====================================================================
// Navigation
// ===================================================================== */
export const NAVIGATION_UNITS = "Mengeneinheiten";
export const NAVIGATION_UNIT_CONVERSION = "Mengenumrechnungen";
export const NAVIGATION_PRODUCTS = "Produkte";
export const NAVIGATION_DEPARTMENTS = "Abteilungen (Einkauf)";
export const SIGN_OUT = "Abmelden";
export const NAVIGATION_USER_PROFILE = "Profil";
export const NAVIGATION_REQUEST_OVERVIEW = "Anträge";
export const NAVIGATION_SYSTEM = "System";

/* =====================================================================
// Statistik
// ===================================================================== */
export const STATS = "Statistik";
export const STATS_GROUP_PLATFORM = "Plattform";
export const STATS_GROUP_RECIPES = "Rezepte";
export const STATS_GROUP_EVENTS = "Anlässe";
export const STATS_GROUP_AVERAGES = "⌀ Durchschnitt pro Anlass";
export const HOME_EMPTY_EVENTS =
  "Noch keine Anlässe vorhanden. Erstelle deinen ersten Anlass!";
export const HOME_EMPTY_RECIPES = "Noch keine Rezepte publiziert.";
export const HOME_EMPTY_FEED =
  "Noch keine Aktivitäten. Erstelle einen Anlass oder publiziere ein Rezept, um loszulegen.";

/* =====================================================================
// Feed
// ===================================================================== */
export const FEED = "Feed";
export const SHOULD_FEED_ENTRY_BE_DELETED = "Feed-Eintrag löschen?";

/* =====================================================================
// Bilder
// ===================================================================== */
export const QUESTION_DELETE_IMAGE =
  "Sicher, dass du das bestehende Bild löschen möchtest?";
export const PICTURE_HAS_BEEN_DELETED = "Bild wurde gelöscht.";

/* =====================================================================
// FormValidation
// ===================================================================== */
export const GIVE_UNIT = "Bitte Einheit angeben.";
export const GIVE_PRODUCT = "Bitte Produkt wählen.";
export const GIVE_GREATE_ZERO = "Bitte Wert grösser 0 angeben.";
export const GIVE_DEPARTMENT = "Bitte Abteilung wählen";
export const GIVE_DEPARTMENT_NAME = "Bitte Abteilungsname angeben.";
export const FORM_GIVE_MATERIAL = "Bitte Materialname eingeben";
export const FORM_GIVE_MATERIAL_TYPE = "Bitte Materialtyp wählen";
export const PLEASE_GIVE_VALUE_FOR_FIELD = (fieldName: string) =>
  `Bitte ${fieldName} eingeben.`;

/* =====================================================================
// Sonstiges — allgemeine Labels und Begriffe
// ===================================================================== */
export const TYPE_UNKNOWN = "Typ unbekannt";
export const REDIRECTION_IN = "Umleitung in";
export const OR_CLICK = "oder klicke ";
export const HERE = "hier";
export const IF_YOU_ARE_IMPATIENT = "falls du ungeduldig bist";
export const ATTENTION = "Achtung";
export const VOTE = "Stimme";
export const VOTES = "Stimmen";
export const TAG = "Tag";
export const ADD = "hinzufügen";
export const SETTINGS = "Einstellungen";
export const MEAL = "Mahlzeit";
export const NOTE = "Notiz";
export const RECIPE = "Rezept";
export const RECIPES = "Rezepte";
export const RECIPETYPE = "Rezepttyp";
export const CONSIDER_INTOLERANCES = "Unverträglichkeit berücksichtigen";
export const RESTRICTIONS = "Einschränkungen";
export const NEW_RECIPE = "Neues Rezept";
export const INGREDIENTS = "Zutaten";
export const ALLERGENS = "Allergene";
export const PRODUCT = "Produkt";
export const PRODUCTS = "Produkte";
export const QUANTITY_CALCULATION = "Mengenberechnung";
export const SHOPPING_LIST = "Einkaufsliste";
export const MENUPLAN = "Menüplan";
export const MATERIAL_LIST = "Materialliste";
export const EVENT_INFO_SHORT = "Infos zum Anlass";
export const PLANED_RECIPES = "Verwendete Rezepte";
export const SUFFIX_PDF = ".pdf";
export const FOR_ACCUSATIVE = "Für";
export const PORTIONS = "Portionen";
export const PORTION = "Portion";
export const ORIGINAL = "Original";
export const SCALED = "skaliert";
export const PREPARATION = "Zubereitung";
export const MATERIAL = "Material";
export const MATERIAL_TYPE = "Materialtyp";
export const CONVERT_UNITS = "Einheiten umrechnen";
export const CONVERT_UNITS_EXPLANATION =
  "Wenn aktiviert, rechnet das System Einheiten in das metrische System um (sofern möglich), z.B. Esslöffel in Gramm oder Deziliter.";
export const ERROR_GIVE_FIELD_VALUE = (field: string) =>
  `Bitte ${field} angeben.`;
export const GENERATED_ON = "Generiert am: ";
export const GENERATED_FROM = "Generiert von: ";
export const SEARCH_STRING = "Suchbegriff";
export const DIALOG_TITLE_DELETION_CONFIRMATION = "Daten löschen?";
export const DIALOG_SUBTITLE_DELETION_CONFIRMATION =
  "Dadurch werden alle Daten endgültig gelöscht. Dieser Schritt kann nicht rückgängig gemacht werden.";
export const DIALOG_TEXT_DELETION_CONFIRMATION =
  "Bestätige, dass du diese Daten löschen möchtest. Gib dazu die folgende ID ein:";
export const DIALOG_SIGNOUT_USERS_CONFIRMATION = "Alle Users abmelden?";
export const DIALOG_SUBTITLE_SIGNOUT_USERS_CONFIRMATION =
  "Dadurch werden Benutzer*innen (ausser Admins) vom chuchipirat abgemeldet.";
export const DIALOG_TEXT_SIGNOUT_USERS_CONFIRMATION =
  "Bestätige, dass du alle abmelden möchtest. Gib dazu die folgende ID ein:";

export const REQUIRED = "Erforderlich";
export const DIALOG_DELETION_CONFIRMATION_STRING_DOES_NOT_MATCH =
  "Die angegebene ID ist nicht korrekt";
export const VERSION = "Version";
export const LOG = "Log";
export const ADVANCED_SEARCH = "Erweiterte Suche";
export const MENU_TYPE = "Menütyp";
export const RENAME = "Umbenennen";
export const DELETE = "Löschen";
export const CANCEL = "Abbrechen";
export const CREATE = "Erstellen";
export const EDIT = "anpassen";
export const NAME = "Name";
export const CLOSE = "Schliessen";
export const APPLY = "Übernehmen";
export const PER_PORTION = "pro Portion";
export const VARIANT = "Variante";
export const VARIANT_NOTE = "Varianten-Notiz";
export const OK = "OK";
export const PRINTVERSION = "Druckversion";
export const AND = "und";
export const OR = " oder";
export const SAVE = "Speichern";
export const OPEN = "Öffnen";
export const PLANED_FOR = "Geplant für";
export const FOR_DATIVE = "zum";
export const LIST = "Liste";
export const CHANGE = "Ändern";
export const MATERIALS = "Materialien";
export const PRIVACY_POLICY = "Datenschutzerklärung";
export const TERM_OF_USE = "Nutzungsbedingungen";
export const IMPRESSUM = "Impressum";
export const SMALL_PRINT = "das Kleingedruckte";
export const EVENT = "Anlass";
export const EVENTS = "Anlässe";
export const USERS = "Users";
export const PUBLIC = "Öffentlich";
export const PRIVATE = "Privat";
export const PUBLIC_RECIPE = "Öffentliches Rezept";
export const ASSOCIATION = "Verein";
export const TYPE = "Typ";
export const VALID_TO = "Gültig bis";
export const HOME_DASHBOARD = "Home-Dashboard";
export const DATE = "Datum";

/* =====================================================================
// Abkürzungen
// ===================================================================== */
export const ABBREVIATION_UNIT = "Einh.";
