import {MigrationJob} from "./MigrationJob.interface";
import {UserMigrationJob} from "./UserMigrationJob";
import {ImageMigrationJob} from "./ImageMigrationJob";
import {DepartmentMigrationJob} from "./DepartmentMigrationJob";
import {UnitMigrationJob} from "./UnitMigrationJob";
import {MaterialMigrationJob} from "./MaterialMigrationJob";
import {ProductMigrationJob} from "./ProductMigrationJob";
import {UnitConversionBasicMigrationJob} from "./UnitConversionBasicMigrationJob";
import {UnitConversionProductMigrationJob} from "./UnitConversionProductMigrationJob";

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
};

/**
 * Gibt alle verfügbaren Job-Keys als Array zurück.
 *
 * @returns Array der Job-Schlüssel (z.B. ["users", "departments", ...])
 */
export const getMigrationJobKeys = (): string[] =>
  Object.keys(migrationJobRegistry);
