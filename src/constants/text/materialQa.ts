/**
 * UI-Textkonstanten für die Material-Qualitätssicherung (QA).
 */

/* =====================================================================
// QA-Spalten
// ===================================================================== */
export const QA_CHECKED = "QA";
export const QA_ISSUES = "Probleme";

/* =====================================================================
// Filter
// ===================================================================== */
export const FILTER_MATERIAL_TYPE = "Materialtyp";
export const FILTER_QA_STATUS = "QA-Status";
export const QA_STATUS_ALL = "Alle";
export const QA_STATUS_CHECKED = "Geprüft";
export const QA_STATUS_UNCHECKED = "Ungeprüft";
export const SHOW_ISSUES_ONLY = "Nur mit Problemen";

/* =====================================================================
// Bulk-Aktionen
// ===================================================================== */
export const MATERIALS_SELECTED = (count: number) =>
  `${count} Materialien ausgewählt`;
export const BULK_QA_CHECK = "Als geprüft markieren";

/* =====================================================================
// Material löschen
// ===================================================================== */
export const DELETE_MATERIAL = "Material löschen";
export const DELETE_MATERIAL_CONFIRM = (name: string) =>
  `Material «${name}» wirklich löschen?`;
export const DELETE_MATERIAL_SUCCESS = (name: string) =>
  `Material «${name}» wurde gelöscht.`;
export const MATERIAL_IN_USE_WARNING =
  "Dieses Material wird an folgenden Stellen verwendet. Bei einer Löschung gehen diese Referenzen verloren:";
export const MATERIAL_NOT_IN_USE =
  "Dieses Material wird nirgends verwendet und kann bedenkenlos gelöscht werden.";

/* =====================================================================
// Materialien zusammenführen
// ===================================================================== */
export const MERGE_MATERIALS = "Materialien zusammenführen";
export const MERGE_MATERIAL_SOURCE = "Wird gelöscht (Quelle)";
export const MERGE_MATERIAL_TARGET = "Bleibt bestehen (Ziel)";
export const MERGE_MATERIAL_CONFIRM = "Zusammenführen";
export const MERGE_MATERIAL_SUCCESS = "Materialien erfolgreich zusammengeführt.";
export const MERGE_MATERIAL_REFERENCES_LABEL = "Referenzen";
export const SWAP_SOURCE_TARGET = "Quelle/Ziel tauschen";
export const MERGE_MATERIAL_WARNING_TEXT = (sourceName: string, targetName: string) =>
  `Das Quellmaterial «${sourceName}» wird gelöscht. Alle Referenzen werden auf das Zielmaterial «${targetName}» übertragen.`;

/* =====================================================================
// Material zu Produkt konvertieren
// ===================================================================== */
export const CONVERT_TO_PRODUCT = "Zu Produkt umwandeln";
export const MATERIAL_CONVERTED_TO_PRODUCT = (materialName: string) =>
  `Material «${materialName}» wurde in ein Produkt umgewandelt.`;

/* =====================================================================
// Auto-Detection Issues
// ===================================================================== */
export const ISSUE_MISSING_TYPE = "Kein Materialtyp zugewiesen";
export const ISSUE_SUSPICIOUS_NAME =
  "Name ist verdächtig kurz oder sieht nach Testdaten aus";
export const ISSUE_EXACT_DUPLICATE = (otherNames: string) =>
  `Exaktes Namens-Duplikat mit: ${otherNames}`;
export const ISSUE_PLURAL_SINGULAR_VARIANT = (matchNames: string) =>
  `Mögliche Plural/Singular-Variante von: ${matchNames}`;
export const ISSUE_TYPE_MISMATCH =
  "Materialtyp passt nicht zum Namen — bitte prüfen";
export const ISSUE_WHITESPACE = "Name enthält überflüssige Leerzeichen";
export const ISSUE_NOT_USABLE = "Material ist als «nicht nutzbar» markiert";
