import {MigrationJob} from "./MigrationJob.interface";
import {UserMigrationJob} from "./UserMigrationJob";
import {ImageMigrationJob} from "./ImageMigrationJob";
import {DepartmentMigrationJob} from "./DepartmentMigrationJob";
import {UnitMigrationJob} from "./UnitMigrationJob";
import {MaterialMigrationJob} from "./MaterialMigrationJob";
import {ProductMigrationJob} from "./ProductMigrationJob";
import {UnitConversionBasicMigrationJob} from "./UnitConversionBasicMigrationJob";
import {UnitConversionProductMigrationJob} from "./UnitConversionProductMigrationJob";
import {RecipeMigrationJob} from "./RecipeMigrationJob";
import {EventMigrationJob} from "./EventMigrationJob";
import {GroupConfigMigrationJob} from "./GroupConfigMigrationJob";
import {MenuplanMigrationJob} from "./MenuplanMigrationJob";
import {EventPictureMigrationJob} from "./EventPictureMigrationJob";
import {RecipeVariantMigrationJob} from "./RecipeVariantMigrationJob";
import {UsedRecipesMigrationJob} from "./UsedRecipesMigrationJob";
import {ShoppingListMigrationJob} from "./ShoppingListMigrationJob";
import {MaterialListMigrationJob} from "./MaterialListMigrationJob";

/* =====================================================================
// Registry aller verfügbaren Migrations-Jobs
// Neue Objekttypen (Events, Rezepte etc.) werden hier ergänzt.
// ===================================================================== */

/**
 * Map aller verfügbaren Migrations-Jobs.
 * Der Key dient als interner Bezeichner, der Value ist die Job-Instanz.
 *
 * Die Reihenfolge berücksichtigt FK-Abhängigkeiten:
 * 1. Benutzer und Bilder (unabhängig)
 * 2. Abteilungen und Einheiten (unabhängig voneinander)
 * 3. Materialien (unabhängig)
 * 4. Produkte (hängt von Abteilungen und Einheiten ab)
 * 5. Standard-Umrechnungen (hängt von Einheiten ab)
 * 6. Produkt-Umrechnungen (hängt von Produkten und Einheiten ab)
 * 7. Rezepte (hängt von Benutzern, Produkten und Materialien ab)
 * 8. Events / Köche / Zeitscheiben (hängt von Benutzern ab)
 * 9. Gruppenconfig (hängt von Events ab)
 * 10. Menupläne (hängt von Events, Gruppenconfig, Rezepten, Produkten, Materialien ab)
 * 11. Event-Bilder (hängt von Events ab)
 * 12. Varianten-Rezepte (hängt von Events, Rezepten, Benutzern, Produkten, Materialien ab)
 * 13. UsedRecipes (hängt von Events und Menuplänen ab)
 * 14. Einkaufslisten (hängt von Events, Produkten, Materialien, Departments, Units ab)
 * 15. Materiallisten (hängt von Events und Materialien ab)
 *
 * @example
 * const job = migrationJobRegistry["departments"];
 * const records = await job.fetchSourceRecords(firebase);
 */
export const migrationJobRegistry: Record<string, MigrationJob> = {
  users: new UserMigrationJob(),
  images: new ImageMigrationJob(),
  departments: new DepartmentMigrationJob(),
  units: new UnitMigrationJob(),
  materials: new MaterialMigrationJob(),
  products: new ProductMigrationJob(),
  unitConversionBasic: new UnitConversionBasicMigrationJob(),
  unitConversionProducts: new UnitConversionProductMigrationJob(),
  recipes: new RecipeMigrationJob(),
  events: new EventMigrationJob(),
  groupConfig: new GroupConfigMigrationJob(),
  menuplan: new MenuplanMigrationJob(),
  eventPictures: new EventPictureMigrationJob(),
  recipeVariants: new RecipeVariantMigrationJob(),
  usedRecipes: new UsedRecipesMigrationJob(),
  shoppingLists: new ShoppingListMigrationJob(),
  materialLists: new MaterialListMigrationJob(),
};

/**
 * Gibt alle verfügbaren Job-Keys als Array zurück.
 *
 * @returns Array der Job-Schlüssel (z.B. ["users", "departments", ...])
 */
export const getMigrationJobKeys = (): string[] =>
  Object.keys(migrationJobRegistry);
