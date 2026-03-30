/**
 * Hilfsfunktionen für die automatische Erkennung von Qualitätsproblemen
 * bei Materialien.
 *
 * Reine Funktionen ohne Seiteneffekte — die UI ruft diese auf und
 * speichert die Ergebnisse im Reducer-State.
 */
import {Material, MaterialType} from "./material.types";
import {
  TEST_PATTERNS,
  stripPluralSuffix,
  buildNameDuplicateMap,
  buildPluralVariantMap,
} from "../Shared/qaUtils";
import {
  ISSUE_MISSING_TYPE,
  ISSUE_SUSPICIOUS_NAME,
  ISSUE_EXACT_DUPLICATE,
  ISSUE_PLURAL_SINGULAR_VARIANT,
  ISSUE_TYPE_MISMATCH,
  ISSUE_WHITESPACE,
  ISSUE_NOT_USABLE,
} from "../../constants/text/materialQa";

/* =====================================================================
// Typen
// ===================================================================== */

/**
 * Erkannte Probleme eines Materials (Auto-Detection).
 *
 * @param materialUid - UID des betroffenen Materials
 * @param issues - Liste der erkannten Probleme als Texte
 */
export type MaterialIssue = {
  materialUid: string;
  issues: string[];
};

/* =====================================================================
// Schlüsselwörter für Typ-Erkennung
// ===================================================================== */

/**
 * Schlüsselwörter, die typischerweise auf Verbrauchsmaterial hinweisen
 * (einmalig verwendet, dann entsorgt).
 */
const CONSUMABLE_KEYWORDS = [
  "alufolie",
  "frischhaltefolie",
  "backpapier",
  "serviette",
  "papierbecher",
  "plastikbecher",
  "zahnstocher",
  "holzspiess",
  "kerze",
  "müllsack",
  "abfallsack",
  "schwamm",
  "lappen",
  "putzlappen",
  "spülmittel",
  "abwaschmittel",
  "reinigungsmittel",
  "waschmittel",
];

/**
 * Schlüsselwörter, die typischerweise auf Gebrauchsmaterial hinweisen
 * (wiederverwendbar).
 */
const USAGE_KEYWORDS = [
  "topf",
  "pfanne",
  "bratpfanne",
  "wok",
  "backblech",
  "cakeform",
  "auflaufform",
  "teller",
  "schüssel",
  "besteck",
  "messer",
  "gabel",
  "löffel",
  "kelle",
  "schwingbesen",
  "schneidebrett",
  "rüstmesser",
  "sparschäler",
  "dosenöffner",
  "korkenzieher",
  "waffeleisen",
  "racletteofen",
  "gasgrill",
  "gaskocher",
];

/* =====================================================================
// Hauptfunktion
// ===================================================================== */

/**
 * Erkennt Qualitätsprobleme bei allen übergebenen Materialien.
 *
 * Prüft auf:
 * - Fehlender Materialtyp (type === none)
 * - Verdächtig kurzer oder Test-Name
 * - Exakte Namens-Duplikate
 * - Mögliche Plural/Singular-Varianten
 * - Materialtyp passt nicht zum Namen (Schlüsselwort-basiert)
 * - Überflüssige Leerzeichen im Namen
 * - Material als «nicht nutzbar» markiert
 *
 * @param materials - Alle Materialien zur Analyse
 * @returns Array von MaterialIssue-Einträgen (nur für Materialien mit Problemen)
 * @example
 * const issues = detectMaterialIssues(materials);
 */
export const detectMaterialIssues = (
  materials: Material[],
): MaterialIssue[] => {
  // Vorberechnungen für übergreifende Checks
  const nameDuplicateMap = buildNameDuplicateMap(materials);
  const pluralVariantMap = buildPluralVariantMap(materials);

  const issues: MaterialIssue[] = [];

  for (const material of materials) {
    // Bereits geprüfte Materialien überspringen
    if (material.qaChecked) continue;

    const materialIssues: string[] = [];
    const nameLower = material.name.trim().toLowerCase();

    // ── Fehlender Materialtyp ──────────────────────────────────────
    if (material.type === MaterialType.none) {
      materialIssues.push(ISSUE_MISSING_TYPE);
    }

    // ── Verdächtige Namen ──────────────────────────────────────────
    if (
      nameLower.length < 3 ||
      TEST_PATTERNS.some((pattern) => pattern.test(nameLower))
    ) {
      materialIssues.push(ISSUE_SUSPICIOUS_NAME);
    }

    // ── Exakte Namens-Duplikate ────────────────────────────────────
    const duplicates = nameDuplicateMap.get(nameLower);
    if (duplicates && duplicates.length > 1) {
      const otherNames = duplicates
        .filter((duplicate) => duplicate.uid !== material.uid)
        .map((duplicate) => duplicate.name)
        .join(", ");
      materialIssues.push(ISSUE_EXACT_DUPLICATE(otherNames));
    }

    // ── Plural/Singular-Varianten ──────────────────────────────────
    const stem = stripPluralSuffix(nameLower);
    if (stem.length >= 3) {
      const variants = pluralVariantMap.get(stem);
      if (variants && variants.length > 1) {
        const otherVariants = variants
          .filter((variant) => variant.uid !== material.uid)
          // Exakte Duplikate nicht doppelt melden
          .filter(
            (variant) =>
              variant.name.trim().toLowerCase() !== nameLower,
          )
          .map((variant) => variant.name);

        if (otherVariants.length > 0) {
          materialIssues.push(
            ISSUE_PLURAL_SINGULAR_VARIANT(otherVariants.join(", ")),
          );
        }
      }
    }

    // ── Typ passt nicht zum Namen ──────────────────────────────────
    if (material.type === MaterialType.consumable) {
      if (USAGE_KEYWORDS.some((keyword) => nameLower.includes(keyword))) {
        materialIssues.push(ISSUE_TYPE_MISMATCH);
      }
    } else if (material.type === MaterialType.usage) {
      if (CONSUMABLE_KEYWORDS.some((keyword) => nameLower.includes(keyword))) {
        materialIssues.push(ISSUE_TYPE_MISMATCH);
      }
    }

    // ── Überflüssige Leerzeichen ────────────────────────────────────
    if (
      material.name !== material.name.trim() ||
      material.name.includes("  ")
    ) {
      materialIssues.push(ISSUE_WHITESPACE);
    }

    // ── Nicht nutzbar ───────────────────────────────────────────────
    if (!material.usable) {
      materialIssues.push(ISSUE_NOT_USABLE);
    }

    if (materialIssues.length > 0) {
      issues.push({materialUid: material.uid, issues: materialIssues});
    }
  }

  return issues;
};
