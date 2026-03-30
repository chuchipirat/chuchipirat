/**
 * Gemeinsame QA-Hilfsfunktionen für Produkte und Materialien.
 *
 * Enthält wiederverwendbare Logik zur Erkennung von Duplikaten,
 * Plural/Singular-Varianten und verdächtigen Testdaten-Namen.
 */

/* =====================================================================
// Typen
// ===================================================================== */

/**
 * Minimales Interface für Items mit Name und UID.
 * Wird von Produkten und Materialien gleichermassen erfüllt.
 *
 * @param uid - Eindeutige ID des Items
 * @param name - Name des Items
 */
export type NamedItem = {
  uid: string;
  name: string;
};

/* =====================================================================
// Konstanten
// ===================================================================== */

/** Muster für verdächtige Test-/Platzhalterdaten. */
export const TEST_PATTERNS = [
  /^test/i,
  /^xxx/i,
  /^asdf/i,
  /^foo$/i,
  /^bar$/i,
];

/* =====================================================================
// Hilfsfunktionen
// ===================================================================== */

/**
 * Entfernt gängige deutsche Plural-Suffixe vom Namen.
 * Reihenfolge ist wichtig: längste Suffixe zuerst, um
 * Teilstripping zu vermeiden (z.B. «en» vor «n»).
 *
 * @param name - Normalisierter Name (lowercase, trimmed)
 * @returns Stamm ohne Plural-Suffix
 * @example
 * stripPluralSuffix("tomaten")  // "tomat"
 * stripPluralSuffix("zwiebeln") // "zwiebel"
 * stripPluralSuffix("eier")     // "ei" (zu kurz → wird von Aufrufer gefiltert)
 */
export const stripPluralSuffix = (name: string): string => {
  // Längste Suffixe zuerst prüfen
  const suffixes = ["nen", "en", "er", "n", "s", "e"];
  for (const suffix of suffixes) {
    if (name.endsWith(suffix) && name.length > suffix.length + 2) {
      return name.slice(0, -suffix.length);
    }
  }
  return name;
};

/**
 * Baut eine Map mit normalisierten Namen auf (trim + lowercase)
 * für die Erkennung exakter Duplikate.
 *
 * @param items - Alle Items (Produkte oder Materialien)
 * @returns Map<normalisierterName, Items[]>
 */
export const buildNameDuplicateMap = <T extends NamedItem>(
  items: T[],
): Map<string, T[]> => {
  const map = new Map<string, T[]>();

  for (const item of items) {
    const normalized = item.name.trim().toLowerCase();
    if (!normalized) continue;

    const existing = map.get(normalized) ?? [];
    existing.push(item);
    map.set(normalized, existing);
  }

  return map;
};

/**
 * Baut eine Map mit Plural/Singular-Varianten auf.
 * Gruppiert Items nach ihrem gestrippten Stamm.
 *
 * @param items - Alle Items (Produkte oder Materialien)
 * @returns Map<stamm, Items[]>
 */
export const buildPluralVariantMap = <T extends NamedItem>(
  items: T[],
): Map<string, T[]> => {
  const map = new Map<string, T[]>();

  for (const item of items) {
    const nameLower = item.name.trim().toLowerCase();
    if (nameLower.length < 3) continue;

    const stem = stripPluralSuffix(nameLower);
    if (stem.length < 3) continue;

    const existing = map.get(stem) ?? [];
    existing.push(item);
    map.set(stem, existing);
  }

  return map;
};
