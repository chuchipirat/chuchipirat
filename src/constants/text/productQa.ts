/**
 * UI-Textkonstanten für die Produkt-Qualitätssicherung (QA).
 */

/* =====================================================================
// QA-Spalten und Filter
// ===================================================================== */
export const QA_CHECKED = "QA";
export const QA_ISSUES = "Probleme";
export const QA_STATUS_ALL = "Alle";
export const QA_STATUS_CHECKED = "Geprüft";
export const QA_STATUS_UNCHECKED = "Ungeprüft";

/* =====================================================================
// Filter
// ===================================================================== */
export const FILTER_DEPARTMENT = "Abteilung filtern";
export const FILTER_QA_STATUS = "QA-Status";
export const SHOW_ISSUES_ONLY = "Nur mit Problemen";

/* =====================================================================
// Duplikaterkennung
// ===================================================================== */
export const FIND_DUPLICATES = "Duplikate suchen";
export const SIMILAR_PAIRS_FOUND = (count: number) =>
  `${count} ähnliche Paare gefunden.`;
export const SEARCHING_DUPLICATES = "Duplikate werden gesucht...";
export const SIMILARITY = "Ähnlichkeit";
export const SYNONYM_MATCH = "Synonym-Treffer";

/* =====================================================================
// Merge
// ===================================================================== */
export const MERGE_PRODUCTS = "Produkte zusammenführen";
export const MERGE_SOURCE = "Wird gelöscht (Quelle)";
export const MERGE_TARGET = "Bleibt bestehen (Ziel)";
export const MERGE_CONFIRM = "Zusammenführen";
export const MERGE_SUCCESS = "Produkte erfolgreich zusammengeführt.";
export const MERGE_REFERENCES_LABEL = "Referenzen";
export const SWAP_SOURCE_TARGET = "Quelle/Ziel tauschen";

/* =====================================================================
// Bulk-Aktionen
// ===================================================================== */
export const PRODUCTS_SELECTED = (count: number) =>
  `${count} Produkte ausgewählt`;
export const BULK_CHANGE_DEPARTMENT = "Abteilung ändern";
export const BULK_CHANGE_DIET = "Diät ändern";
export const BULK_QA_CHECK = "Als geprüft markieren";

/* =====================================================================
// Synonyme
// ===================================================================== */
export const MANAGE_SYNONYMS = "Synonyme verwalten";
export const SYNONYM_PAIRS = "Synonym-Paare";
export const ADD_SYNONYM = "Synonym hinzufügen";
export const SYNONYM_NAME_A = "Name A";
export const SYNONYM_NAME_B = "Name B";

/* =====================================================================
// Auto-Detection Issues
// ===================================================================== */
export const ISSUE_MISSING_DEPARTMENT = "Keine Abteilung zugewiesen";
export const ISSUE_MISSING_SHOPPING_UNIT = "Keine Einkaufseinheit";
export const ISSUE_DIET_OUTLIER =
  "Diät weicht von >80% der Abteilung ab";
export const ISSUE_LACTOSE_FREE_BUT_FLAGGED =
  "Name enthält «laktosefrei», aber Laktose ist markiert";
export const ISSUE_GLUTEN_FREE_BUT_FLAGGED =
  "Name enthält «glutenfrei», aber Gluten ist markiert";
export const ISSUE_DIET_CONTRADICTS_NAME_VEGAN =
  "Name enthält «vegan», aber Diät ist nicht Vegan";
export const ISSUE_DIET_CONTRADICTS_NAME_VEGETARIAN =
  "Name enthält «vegetarisch», aber Diät ist Fleisch";
export const ISSUE_VEGAN_BUT_LACTOSE =
  "Diät ist Vegan, aber Laktose-Allergen ist gesetzt";
export const ISSUE_NAME_HINTS_LACTOSE =
  "Name deutet auf Milchprodukt hin — Laktose-Allergen prüfen";
export const ISSUE_NAME_HINTS_GLUTEN =
  "Name deutet auf Getreideprodukt hin — Gluten-Allergen prüfen";
export const ISSUE_SHOPPING_UNIT_OUTLIER =
  "Einkaufseinheit weicht von >80% der Abteilung ab";
export const ISSUE_SUSPICIOUS_NAME =
  "Name ist verdächtig kurz oder sieht nach Testdaten aus";
export const ISSUE_EXACT_DUPLICATE = (otherNames: string) =>
  `Exaktes Namens-Duplikat mit: ${otherNames}`;
export const ISSUE_PLURAL_SINGULAR_VARIANT = (matchNames: string) =>
  `Mögliche Plural/Singular-Variante von: ${matchNames}`;

/* =====================================================================
// Produkt löschen
// ===================================================================== */
export const DELETE_PRODUCT = "Produkt löschen";
export const DELETE_PRODUCT_CONFIRM = (name: string) =>
  `Produkt «${name}» wirklich löschen?`;
export const DELETE_PRODUCT_SUCCESS = (name: string) =>
  `Produkt «${name}» wurde gelöscht.`;
export const PRODUCT_IN_USE_WARNING =
  "Dieses Produkt wird an folgenden Stellen verwendet. Bei einer Löschung gehen diese Referenzen verloren:";
export const PRODUCT_NOT_IN_USE =
  "Dieses Produkt wird nirgends verwendet und kann bedenkenlos gelöscht werden.";
