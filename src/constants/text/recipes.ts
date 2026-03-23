/**
 * UI-Textkonstanten für Rezepte (Erstellen, Bearbeiten, Publizieren,
 * Bewerten, Fehler melden, Diät-Eigenschaften).
 */

/* =====================================================================
// Meldungen zum Rezept
// ===================================================================== */
export const RECIPE_SAVE_SUCCESS = "Arrr..... Rezept wurde gespeichert";
export const THIS_FIELD_CANT_BE_EMPTY =
  "Dieses Feld darf nicht leer gelassen werden.";
export const RECIPE_NAME_CANT_BE_EMPTY =
  "Der Name des Rezept darf nicht leer sein.";
export const RECIPE_VARIANT_NAME_CANT_BE_EMPTY =
  "Der Name der Rezeptvariante darf nicht leer sein.";
export const NO_RECIPE_FOUND = "Kein passendes Rezept gefunden";
export const CREATE_A_NEW_ONE = "Erfasse ein neues!";
export const ERROR_POS_WITHOUT_PRODUCT = (pos: number) =>
  `Das Produkt in der Position ${pos} ist unbekannt.`;
export const ERROR_POS_WITHOUT_MATERIAL = (pos: number) =>
  `Das Material in der Position ${pos} ist unbekannt.`;
export const DIALOG_TITLE_SCALE_RECIPE = "Rezept skalieren";
export const PORTIONS_TO_SCALE = "zu skalierende Portionen";
export const INFO_PANEL_TITLE_SCALE = "2*2 ist nicht immer 4";
export const INFO_PANEL_TEXT_SCALE =
  "Beachte das eine Skalierung einige Tücken mit sich bringt. So können die Zubereitungstexte allenfalls nicht mehr stimmen (enthaltene Mengen) und auch die Koch-/Backzeit kann allenfalls variieren.";
export const PUBLIC_RECIPES = "öffentliche Rezepte";
export const ALL_RECIPES = "alle Rezepte";
export const PRIVATE_RECIPES = "private Rezepte";
export const MESSAGE_TO_REVIEW = "Nachricht für Review-Person";
export const THANK_YOU_FOR_YOUR_RATING = "Danke für deine Bewertung";
export const NEWEST_RECIPES = "Die neusten Rezepte";
export const START_TRACE = "Trace starten";

/* =====================================================================
// Rezept (Details, Publizieren, Diät, Tags)
// ===================================================================== */
export const UNIT_MIN = "Min";
export const ERROR_PORTIONS_NEGATIV =
  "Die Anzahl Portionen muss grösser sein als 0.";
export const ERROR_PORTIONS_NOT_NUMERIC =
  "Gib einen numerischen Wert für Portionen an.";
export const ERROR_NO_INGREDIENTS_GIVEN =
  "Keine Zutaten. Bitte gib die nötigen Zutaten an.";
export const DELETE_RECIPE = "Rezept löschen";
export const PUBLISH_RECIPE = "Rezept für die Community veröffentlichen";
export const REPORT_ERROR = "Fehler melden";
export const REPORT_ERROR_DESCIRPTION =
  "Hast du einen Fehler im Rezept gefunden? Wir würden uns freuen, wenn du uns dabei hilfst, es zu verbessern! Bitte beschreibe den Fehler so genau wie möglich, damit wir ihn schnell beheben können. Deine Rückmeldung ist uns wichtig. Vielen Dank!";
export const ERROR_DESCRIPTION = "Beschreibung des Fehlers im Rezept:";

export const SHOW_OPEN_REQUESTS = "Zeige offene Anträge";
export const SEND_RECIPE_TO_REVIEW = "Rezept für Review einreichen";
export const IMAGE_SOURCE = "Bildquelle: ";
export const IMAGE_MAY_BE_SUBJECT_OF_COPYRIGHT =
  "Das Bild ist eventuell urheberrechtlich geschützt.";
export const PUBLISH_RECIPE_RULES_PART1 =
  "Merci, dass du dein Rezept der Community zur Verfügung stellen willst. " +
  "Damit das Rezept öffentlich geschaltet werden kann, wird es von den Community-Leader*innen geprüft. Mit dieser Prüfung wird sichergestellt, dass Rezepte einem gewissen Standard entsprechen, sodass sich die anderen Anwender*mit gutem Gewissen von der Rezeptdatenbank bedienen können. " +
  "Damit ein Rezept veröffentlicht wird, müssen diese Punkte erfüllt sein:";
export const PUBLISH_RECIPE_RULES_BULLET_LIST =
  "Quellenangabe erforderlich: Das Rezept muss eine genaue Quellenangabe haben, vorzugsweise von bekannten Plattformen wie Betty Bossi, Swissmilk usw. oder aus einem Kochbuch." +
  "•Klare Zubereitungsschritte: Die Anleitung muss logisch strukturiert und einfach verständlich sein." +
  "•Flexible Mengenangaben: Die Zubereitungsschritte sollten keine festen Mengenangaben enthalten, um eine problemlose Anpassung der Portionen zu ermöglichen." +
  "•Gepflegte Rezeptattribute: Alle relevanten Attribute wie Menütyp und Dauer müssen sorgfältig gepflegt sein." +
  "•Einzigartiges Rezept: Das Rezept sollte bisher nicht in der öffentlichen Sammlung vorhanden sein.";
export const PUBLISH_RECIPE_RULES_PART2 =
  "Falls bei der Prüfung Fragen aufkommen, würde sich die entsprechende Person bei dir per Mail melden. Falls du willst, kannst du der prüfenden Person eine Nachricht mit dem Rezept zukommen lassen. ";
export const PUBLISH_RECIPE_RULES_PART3 = "Bitte beachte:";
export const PUBLISH_RECIPE_RULES_PART4 =
  "Sobald das Rezept öffentlich ist, wirst du dieses nicht mehr ändern können. ";
export const PUBLISH_RECIPE_RULES_PART5 =
  "Danke für dein Engagement. Beste Grüsse";
export const PUBLISH_RECIPE_RULES_PART6 = "Dein chuchipirat";
export const PUBLISH_RECIPE_REQUEST_CREATED = (requestNo: number) =>
  `Der Antrag ${requestNo} wurde erfolgreich erzeugt.`;
export const REPORT_ERROR_RECIPE_REQUEST_CREATED = (requestNo: number) =>
  `Die Meldung ${requestNo} wurde erfolgreich erzeugt.`;

export const IS_LACTOSEFREE = "Laktosefrei";
export const HAS_LACTOSE = "mit Laktose";
export const LACTOSE = "Laktose";
export const IS_GLUTENFREE = "Glutenfrei";
export const HAS_GLUTEN = "mit Gluten";
export const GLUTEN = "Gluten";
export const DIET_PROPERTIES = "Diät Info";
export const IS_VEGETARIAN = "Vegetarisch";
export const IS_VEGAN = "Vegan";
export const HAS_MEAT = "mit Fleisch";
export const IS_MEAT = "ist Fleisch";
export const TIPS_AND_TAGS = "Tipps & Tags";
export const DIET = "Diät";
export const NONE_RESTRICTION = "Keine";
export const INTOLERANCES = "Unverträglichkeiten";
export const PRODUCT_PROPERTY = "Produkteigenschaft";
export const HELPTER_TEXT_RECIPE_SOURCE =
  "Woher hast du das Rezept? URL, Buch, Zeitschrift usw.";
export const CONSISTENCY_CHECK = "Konsistenzcheck";
export const MENUPLAN_CONSISTENCY_CHECK_FIXES_APPLIED =
  "Konsistenzcheck erfolgreich durchgeführt. Korrekturen wurden angewendet.";
export const MENUPLAN_CONSISTENCY_CHECK_NO_ISSUES =
  "Konsistenzcheck erfolgreich durchgeführt. Keine Probleme gefunden.";
export const MENUPLAN_PDF_OPTIONS_TITLE = "PDF-Exportoptionen";
export const MENUPLAN_PDF_SHOW_PRODUCTS = "Produkte anzeigen";
export const MENUPLAN_PDF_SHOW_MATERIALS = "Materialien anzeigen";
export const MENUPLAN_PDF_SHOW_PORTIONS = "Portionen pro Rezept anzeigen";
export const POSSIBLE_DUPLICATE_FOUND =
  "Bevor wir's zweimal kochen: Wir haben ähnliche Rezepte in der Sammlung:";
export const PRO_TIP = "💡 Pro-Tipp ";
export const PRO_TIP_ADD_ITEM_TO_MENUPLAN =
  "Für «nur eine Zutat» musst du kein ganzes Rezept bauen. Füge Produkte und Materialien direkt im Menüplan hinzu. Details: ";
export const OUTDOOR_KITCHEN_SUITABLE = "Geeignet für Outdoor-Küche";
export const SHOW_ONLY_MY_RECIPES = "Nur meine Rezepte anzeigen";
export const THIS_RECIPE_IS_PLANNED_FOR = "Dieses Rezept ist geplant für:";
