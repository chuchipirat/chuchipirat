/**
 * Hilfsfunktionen für die automatische Erkennung von Qualitätsproblemen
 * bei Produkten.
 *
 * Reine Funktionen ohne Seiteneffekte — die UI ruft diese auf und
 * speichert die Ergebnisse im Reducer-State.
 */
import {Product, Allergen, Diet} from "./product.types";
import {ProductIssue} from "./useProductsQa";
import {
  TEST_PATTERNS,
  stripPluralSuffix,
  buildNameDuplicateMap,
  buildPluralVariantMap,
} from "../Shared/qaUtils";
import {
  ISSUE_MISSING_DEPARTMENT,
  ISSUE_MISSING_SHOPPING_UNIT,
  ISSUE_DIET_OUTLIER,
  ISSUE_LACTOSE_FREE_BUT_FLAGGED,
  ISSUE_GLUTEN_FREE_BUT_FLAGGED,
  ISSUE_DIET_CONTRADICTS_NAME_VEGAN,
  ISSUE_DIET_CONTRADICTS_NAME_VEGETARIAN,
  ISSUE_VEGAN_BUT_LACTOSE,
  ISSUE_NAME_HINTS_LACTOSE,
  ISSUE_NAME_HINTS_GLUTEN,
  ISSUE_SHOPPING_UNIT_OUTLIER,
  ISSUE_SUSPICIOUS_NAME,
  ISSUE_EXACT_DUPLICATE,
  ISSUE_PLURAL_SINGULAR_VARIANT,
} from "../../constants/text/productQa";

/* =====================================================================
// Schlüsselwörter und Muster
// ===================================================================== */

/** Milchprodukt-Schlüsselwörter für Laktose-Hinweis. */
const DAIRY_KEYWORDS = [
  "milch",
  "rahm",
  "käse",
  "butter",
  "joghurt",
  "quark",
  "mascarpone",
  "sahne",
  "crème",
  "creme",
  "ricotta",
  "mozzarella",
];

/** Getreide-Schlüsselwörter für Gluten-Hinweis. */
const GLUTEN_KEYWORDS = [
  "weizen",
  "mehl",
  "brot",
  "pasta",
  "nudeln",
  "teig",
  "paniermehl",
  "dinkel",
  "roggen",
  "gerste",
  "couscous",
  "bulgur",
];

// TEST_PATTERNS → importiert aus ../Shared/qaUtils

/* =====================================================================
// Hauptfunktion
// ===================================================================== */

/**
 * Erkennt Qualitätsprobleme bei allen übergebenen Produkten.
 *
 * Prüft auf:
 * - Fehlende Abteilung
 * - Fehlende Einkaufseinheit
 * - Diät-Ausreisser (Produkt hat andere Diät als >80% der Abteilung)
 * - Name enthält «laktosefrei», aber Laktose-Allergen ist gesetzt
 * - Name enthält «glutenfrei», aber Gluten-Allergen ist gesetzt
 * - Diät widerspricht dem Namen («vegan» / «vegetarisch»)
 * - Allergen-Diät-Widerspruch (Vegan + Laktose)
 * - Name deutet auf Milch-/Getreideprodukt hin, aber Allergen nicht gesetzt
 * - Einkaufseinheit-Ausreisser (weicht von Abteilungsmehrheit ab)
 * - Verdächtig kurzer oder Test-Name
 * - Exakte Namens-Duplikate
 * - Mögliche Plural/Singular-Varianten
 *
 * @param products - Alle Produkte zur Analyse
 * @returns Array von ProductIssue-Einträgen (nur für Produkte mit Problemen)
 * @example
 * const issues = detectProductIssues(products);
 */
export const detectProductIssues = (products: Product[]): ProductIssue[] => {
  // Vorberechnungen für abteilungsübergreifende Checks
  const departmentDietMap = buildDepartmentDietMap(products);
  const departmentUnitMap = buildDepartmentShoppingUnitMap(products);
  const nameDuplicateMap = buildNameDuplicateMap(products);
  const pluralVariantMap = buildPluralVariantMap(products);

  const issues: ProductIssue[] = [];

  for (const product of products) {
    // Bereits geprüfte Produkte überspringen — Issues sind nicht mehr relevant
    if (product.qaChecked) continue;

    const productIssues: string[] = [];
    const nameLower = product.name.trim().toLowerCase();

    // ── Fehlende Stammdaten ──────────────────────────────────────────

    // Fehlende Abteilung
    if (!product.department.uid) {
      productIssues.push(ISSUE_MISSING_DEPARTMENT);
    }

    // Fehlende Einkaufseinheit
    if (!product.shoppingUnit) {
      productIssues.push(ISSUE_MISSING_SHOPPING_UNIT);
    }

    // ── Diät- und Allergen-Konsistenz ────────────────────────────────

    // Diät-Ausreisser: Wenn >80% der Abteilung eine andere Diät haben
    if (product.department.uid) {
      const deptDiets = departmentDietMap.get(product.department.uid);
      if (deptDiets && deptDiets.total >= 5) {
        const sameCount =
          deptDiets.dietCounts.get(product.dietProperties.diet) ?? 0;
        const sameRatio = sameCount / deptDiets.total;
        if (sameRatio < 0.2) {
          productIssues.push(ISSUE_DIET_OUTLIER);
        }
      }
    }

    // Name enthält «laktosefrei», aber Laktose-Allergen ist gesetzt
    if (
      nameLower.includes("laktosefrei") &&
      product.dietProperties.allergens.includes(Allergen.Lactose)
    ) {
      productIssues.push(ISSUE_LACTOSE_FREE_BUT_FLAGGED);
    }

    // Name enthält «glutenfrei», aber Gluten-Allergen ist gesetzt
    if (
      nameLower.includes("glutenfrei") &&
      product.dietProperties.allergens.includes(Allergen.Gluten)
    ) {
      productIssues.push(ISSUE_GLUTEN_FREE_BUT_FLAGGED);
    }

    // Name enthält «vegan», aber Diät ist nicht Vegan
    // «laktosefrei» und «glutenfrei» ausschliessen, da sie "frei" im Namen tragen
    if (
      nameLower.includes("vegan") &&
      !nameLower.includes("laktosefrei") &&
      !nameLower.includes("glutenfrei") &&
      product.dietProperties.diet !== Diet.Vegan
    ) {
      productIssues.push(ISSUE_DIET_CONTRADICTS_NAME_VEGAN);
    }

    // Name enthält «vegetarisch», aber Diät ist Fleisch
    if (
      nameLower.includes("vegetarisch") &&
      product.dietProperties.diet === Diet.Meat
    ) {
      productIssues.push(ISSUE_DIET_CONTRADICTS_NAME_VEGETARIAN);
    }

    // Vegan markiert, aber Laktose-Allergen ist gesetzt — Widerspruch
    if (
      product.dietProperties.diet === Diet.Vegan &&
      product.dietProperties.allergens.includes(Allergen.Lactose)
    ) {
      productIssues.push(ISSUE_VEGAN_BUT_LACTOSE);
    }

    // Name deutet auf Milchprodukt hin, aber Laktose nicht gesetzt
    // Nur prüfen wenn Laktose nicht bereits gesetzt und Name nicht «laktosefrei» enthält
    if (
      !product.dietProperties.allergens.includes(Allergen.Lactose) &&
      !nameLower.includes("laktosefrei")
    ) {
      if (DAIRY_KEYWORDS.some((keyword) => nameLower.includes(keyword))) {
        productIssues.push(ISSUE_NAME_HINTS_LACTOSE);
      }
    }

    // Name deutet auf Getreideprodukt hin, aber Gluten nicht gesetzt
    // Nur prüfen wenn Gluten nicht bereits gesetzt und Name nicht «glutenfrei» enthält
    if (
      !product.dietProperties.allergens.includes(Allergen.Gluten) &&
      !nameLower.includes("glutenfrei")
    ) {
      if (GLUTEN_KEYWORDS.some((keyword) => nameLower.includes(keyword))) {
        productIssues.push(ISSUE_NAME_HINTS_GLUTEN);
      }
    }

    // ── Einkaufseinheit-Ausreisser ───────────────────────────────────

    if (product.department.uid && product.shoppingUnit) {
      const deptUnits = departmentUnitMap.get(product.department.uid);
      if (deptUnits && deptUnits.total >= 5) {
        const sameCount =
          deptUnits.unitCounts.get(product.shoppingUnit) ?? 0;
        const sameRatio = sameCount / deptUnits.total;
        if (sameRatio < 0.2) {
          productIssues.push(ISSUE_SHOPPING_UNIT_OUTLIER);
        }
      }
    }

    // ── Verdächtige Namen ────────────────────────────────────────────

    if (
      nameLower.length < 3 ||
      TEST_PATTERNS.some((pattern) => pattern.test(nameLower))
    ) {
      productIssues.push(ISSUE_SUSPICIOUS_NAME);
    }

    // ── Duplikate und Varianten ──────────────────────────────────────

    // Exakte Namens-Duplikate (nach trim + lowercase)
    const duplicates = nameDuplicateMap.get(nameLower);
    if (duplicates && duplicates.length > 1) {
      const otherNames = duplicates
        .filter((duplicate) => duplicate.uid !== product.uid)
        .map((duplicate) => duplicate.name)
        .join(", ");
      productIssues.push(ISSUE_EXACT_DUPLICATE(otherNames));
    }

    // Plural/Singular-Varianten (nach Suffix-Stripping)
    const stem = stripPluralSuffix(nameLower);
    if (stem.length >= 3) {
      const variants = pluralVariantMap.get(stem);
      if (variants && variants.length > 1) {
        const otherVariants = variants
          .filter((variant) => variant.uid !== product.uid)
          // Exakte Duplikate nicht doppelt melden
          .filter(
            (variant) =>
              variant.name.trim().toLowerCase() !== nameLower,
          )
          .map((variant) => variant.name);

        if (otherVariants.length > 0) {
          productIssues.push(
            ISSUE_PLURAL_SINGULAR_VARIANT(otherVariants.join(", ")),
          );
        }
      }
    }

    if (productIssues.length > 0) {
      issues.push({productUid: product.uid, issues: productIssues});
    }
  }

  return issues;
};

/* =====================================================================
// Hilfstypen und Vorberechnungen
// ===================================================================== */

/**
 * Diät-Verteilung pro Abteilung.
 */
type DepartmentDietInfo = {
  total: number;
  dietCounts: Map<Diet, number>;
};

/**
 * Baut eine Map mit der Diät-Verteilung pro Abteilung auf.
 *
 * @param products - Alle Produkte
 * @returns Map<departmentUid, DepartmentDietInfo>
 */
const buildDepartmentDietMap = (
  products: Product[],
): Map<string, DepartmentDietInfo> => {
  const map = new Map<string, DepartmentDietInfo>();

  for (const product of products) {
    if (!product.department.uid) continue;

    const existing = map.get(product.department.uid);
    if (existing) {
      existing.total++;
      existing.dietCounts.set(
        product.dietProperties.diet,
        (existing.dietCounts.get(product.dietProperties.diet) ?? 0) + 1,
      );
    } else {
      const dietCounts = new Map<Diet, number>();
      dietCounts.set(product.dietProperties.diet, 1);
      map.set(product.department.uid, {total: 1, dietCounts});
    }
  }

  return map;
};

/**
 * Einkaufseinheit-Verteilung pro Abteilung.
 */
type DepartmentShoppingUnitInfo = {
  total: number;
  unitCounts: Map<string, number>;
};

/**
 * Baut eine Map mit der Einkaufseinheit-Verteilung pro Abteilung auf.
 *
 * @param products - Alle Produkte
 * @returns Map<departmentUid, DepartmentShoppingUnitInfo>
 */
const buildDepartmentShoppingUnitMap = (
  products: Product[],
): Map<string, DepartmentShoppingUnitInfo> => {
  const map = new Map<string, DepartmentShoppingUnitInfo>();

  for (const product of products) {
    if (!product.department.uid || !product.shoppingUnit) continue;

    const existing = map.get(product.department.uid);
    if (existing) {
      existing.total++;
      existing.unitCounts.set(
        product.shoppingUnit,
        (existing.unitCounts.get(product.shoppingUnit) ?? 0) + 1,
      );
    } else {
      const unitCounts = new Map<string, number>();
      unitCounts.set(product.shoppingUnit, 1);
      map.set(product.department.uid, {total: 1, unitCounts});
    }
  }

  return map;
};

// buildNameDuplicateMap → importiert aus ../Shared/qaUtils

// stripPluralSuffix → importiert aus ../Shared/qaUtils

// buildPluralVariantMap → importiert aus ../Shared/qaUtils
