/**
 * Gemeinsame Enum-Mappings für DB-ENUM-Strings ↔ numerische Werte.
 *
 * Zentralisiert die Zuordnungen, die in mehreren Repositories
 * (RecipeRepository, ProductRepository) identisch verwendet werden.
 * Vermeidet Duplikate und stellt sicher, dass Änderungen an Enums
 * nur an einer Stelle vorgenommen werden müssen.
 */

/* =====================================================================
// Allergen-Mapping
// ===================================================================== */

/** Zuordnung DB-ENUM-String → numerischer Allergen-Wert. */
export const ALLERGEN_FROM_DB: Record<string, number> = {
  lactose: 1,
  gluten: 2,
};

/** Zuordnung numerischer Allergen-Wert → DB-ENUM-String. */
export const ALLERGEN_TO_DB: Record<number, string> = {
  1: "lactose",
  2: "gluten",
};

/* =====================================================================
// Diet-Mapping
// ===================================================================== */

/** Zuordnung DB-ENUM-String → numerischer Diet-Wert. */
export const DIET_FROM_DB: Record<string, number> = {
  meat: 1,
  vegetarian: 2,
  vegan: 3,
};

/** Zuordnung numerischer Diet-Wert → DB-ENUM-String. */
export const DIET_TO_DB: Record<number, string> = {
  1: "meat",
  2: "vegetarian",
  3: "vegan",
};
