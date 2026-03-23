/**
 * UI-Textkonstanten für Stammdaten: Produkte, Materialien,
 * Einheiten und Abteilungen.
 */

/* =====================================================================
// Produkte
// ===================================================================== */
export const PRODUCT_CREATED = (product: string) =>
  `Produkt «${product}» wurde angelegt.`;
export const PRODUCT_ADD = "Neue Zutat erstellen";
export const PRODUCT_EDIT = "Produkt anpassen";
export const GUIDELINES_NEW_PRODUCT = {
  line1: `Bitte prüfe folgende Punkte, bevor du ein neues Produkt anlegst:`,
  line2: `Das Produkt existiert im chuchipirat bislang nicht.`,
  line3: `Das Produkt kann im Laden gekauft werden.`,
  line4: `Der Produktnamen beinhaltet keine Marken, Mengen, Einheiten oder Zubereitungsformen.`,
  line5: `Falls bei einer nachträglichen Kontrolle auffallen würde, dass das von dir angelegte Produkt nicht den Richtlinien entspricht, wird es ohne    Voranmeldung geändert/gelöscht, was zu unvollständigen/falschen privaten Rezepten führen kann.`,
};
export const SIMILAR_PRODUCTS = "Ähnliche Produkte";
export const EXISTING_PRODUCTS = "Bestehende Produkte";
export const THERE_ARE_SIMILAR_PRODUCTS =
  "Es gibt bereits Produkte, die ähnliche Namen haben. Bitte überprüfe die angezeigte Liste und prüfe, ob das von dir gewünschte Produkt nicht bereits vorhanden ist. Falls du dein Produkt findest, kannst du dieses wählen. Ansonsten klicke auf den Button «Produkt erstellen», um ein neues Produkt zu erstellen.";
export const NEW_PRODUCT = "Neues Produkt";
export const WARNING_PRODUCT_1 =
  "Die Änderungen sind global und gelten für alle! ";
export const WARNING_PRODUCT_2 =
  " Korrigiere beim Produktname allfällige Schreibfehler. ";
export const WARNING_PRODUCT_3 =
  " Aber mach aus einem Apfel keine Peperoni! Sonst schmecken die Öpfelchüechli dann doch eher ungewohnt.";
export const SHOPPING_UNIT_INFO = "Für die Einheit «Stück» Feld leer lassen";
export const ERROR_PRODUCT_UNKNOWN = (productName: string) =>
  `Produkt ${productName} ist unbekannt.`;
export const ERROR_PRODUCT_WITH_THIS_NAME_ALREADY_EXISTS =
  "Es existiert bereits ein Produkt mit diesen Namen. Bitte wähle das gewünschte Produkt aus dem Dropdown aus.";
export const ERROR_MATERIAL_WITH_THIS_NAME_ALREADY_EXISTS =
  "Es existiert bereits ein Material mit diesen Namen. Bitte wähle das gewünschte Produkt aus dem Dropdown aus.";
export const DIALOG_INFO_DIET_PROPERTIES =
  "Falls du nicht sicher bist, kann du die Checkboxen auch leer lassen. Unsere Community-Leader werden die Einstellungen gegenprüfen.";
export const SHOW_ONLY_NEWEST_PRODUCTS = "Zeige nur Neuste Produkte";
export const NO_NEWEST_PRODUCTS_FOUND =
  "Es wurden keine Produkte gefunden, die die letzten 10 Tage angelegt wurden.";
export const SHOW_ALL_PRODUCTS = "Zeige alle Produkte";

/* =====================================================================
// Einheiten
// ===================================================================== */
export const UNIT_CREATED = (unit: string) => {
  return `Einheit «${unit}» wurde angelegt.`;
};
export const UNIT_DELETED = (unit: string) =>
  `Einheit «${unit}» wurde gelöscht.`;
export const BASIC = "Basic";
export const PRODUCT_SPECIFIC = "Produktspezifisch";
export const UNIT_CREATE = "Neue Einheit anlegen";
export const UNIT_CREATE_EXPLANATION =
  "Erfasse die neue Einheit gleich mit den nötigen Infos.";
export const ERROR_UNIT_CONVERSION_TYPE_MISSING =
  "Kein Typ gewählt. Speichern nicht möglich.";
export const CREATE_NEW_UNIT_CONVERSION = "Neue Einheitenumrechnung anlegen";
export const METRIC_SYSTEM = "Metrisches System";
export const HINT_CREATE_IN_METRIC_SYSTEM =
  "Bitte erfasse die Umrechung mit einer Zieleinheit im metrischen Einheitssystem.";
export const UNIT = "Einheit";
export const UNITS = "Einheiten";
export const DIMENSION = "Dimension";
export const UNIT_ABREVIATION = "Einheit (Abkürzung)";
export const UID = "UID";
export const DENOMINATOR = "Menge von";
export const NUMERATOR = "Menge nach";
export const UNIT_FROM = "Einheit Von";
export const UNIT_TO = "Einheit Nach";

/* =====================================================================
// Abteilungen
// ===================================================================== */
export const CREATE_DEPARTMENT = "Abteilung anlegen";
export const DEPARTMENT_ALREADY_EXISTS =
  "Eine Abteilung mit diesem Namen existiert bereits.";
export const DEPARTMENT_CREATED = (department: string) => {
  return `Abteilung «${department}» wurde angelegt.`;
};

/* =====================================================================
// Material
// ===================================================================== */
export const DIALOG_TITLE_MATERIAL_ADD = "Neues Material anlegen";
export const DIALOG_TITLE_MATERIAL_EDIT = "Material anpassen";
export const DIALOG_TEXT_MATERIAL =
  "Erfasse das neue Material gleich mit den nötigen Eigenschaften.";
export const CHOOSE_MATERIAL_TYPE = "Wähle den Materialtyp aus.";
export const DIALOG_EXPLANATION_MATERIAL_TYPE_CONSUMABLE =
  "Verbrauchsmaterial: Dieses Material ist nach der Zubereitung nicht mehr nutzbar. Beispiel Alupapier, Holzspiesse usw. Dieses Material kann auf die Einkaufsliste übernommen werden. ";
export const DIALOG_EXPLANATION_MATERIAL_TYPE_USAGE =
  "Gebrauchsmaterial: Dieses Material ist üblicherweise in der Küche vorhanden oder kann von zu Hause mitgenommen werden. Diese Art von Material zeichnet sich darin aus, dass es nach einer Verwendung erneut genutzt werden kann. Beispiel Cakeform, Waffeleisen usw. Dieses Material landet auf die Materialliste.";
export const MATERIAL_CREATED = (material: string) =>
  `Material «${material}» wurde angelegt.`;
export const PRODUCT_CONVERTED_TO_MATERIAL = (productName: string) =>
  `Product «${productName}» wurde in ein Material umgewandelt.`;
export const CONVERT_TO_MATERIAL = "Zu Material umwandeln";
export const MATERIAL_TYPE_CONSUMABLE = "Verbrauchsmaterial";
export const MATERIAL_TYPE_USAGE = "Gebrauchsmaterial";
