import {MigrationJob} from "./MigrationJob.interface";
import {UserMigrationJob} from "./UserMigrationJob";

/* =====================================================================
// Registry aller verfügbaren Migrations-Jobs
// Neue Objekttypen (Events, Rezepte etc.) werden hier ergänzt.
// ===================================================================== */

/**
 * Map aller verfügbaren Migrations-Jobs.
 * Der Key dient als interner Bezeichner, der Value ist die Job-Instanz.
 *
 * @example
 * const job = migrationJobRegistry["users"];
 * const records = await job.fetchSourceRecords(firebase);
 */
export const migrationJobRegistry: Record<string, MigrationJob> = {
  users: new UserMigrationJob(),
};

/**
 * Gibt alle verfügbaren Job-Keys als Array zurück.
 *
 * @returns Array der Job-Schlüssel (z.B. ["users"])
 */
export const getMigrationJobKeys = (): string[] =>
  Object.keys(migrationJobRegistry);
