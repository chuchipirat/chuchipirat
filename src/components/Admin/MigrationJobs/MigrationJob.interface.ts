import Firebase from "../../Firebase/firebase.class";
import DatabaseService from "../../Database/DatabaseService";
import AuthUser from "../../Firebase/Authentication/authUser.class";

/* =====================================================================
// Generische Typen für die Migration von Firebase → Postgres
// ===================================================================== */

/**
 * Ein einzelner Quelldatensatz aus Firebase.
 *
 * @typeParam T - Typ der gelesenen Firebase-Daten
 * @param id - Eindeutige ID des Datensatzes (z.B. UID)
 * @param label - Anzeigename für das Protokoll (z.B. displayName)
 * @param data - Die eigentlichen Firebase-Daten
 */
export interface SourceRecord<T> {
  id: string;
  label: string;
  data: T;
}

/**
 * Status eines einzelnen migrierten Datensatzes.
 */
export type MigrationRecordStatus = "success" | "skipped" | "failed";

/**
 * Ergebnis der Migration eines einzelnen Datensatzes.
 *
 * @param id - Eindeutige ID des Datensatzes
 * @param label - Anzeigename für das Protokoll
 * @param status - Ergebnisstatus (success, skipped, failed)
 * @param error - Optionale Fehlermeldung bei status === "failed"
 */
export interface MigrationRecordResult {
  id: string;
  label: string;
  status: MigrationRecordStatus;
  error?: string;
}

/**
 * Aggregierte Statistiken über den gesamten Migrationslauf.
 *
 * @param totalSource - Gesamtanzahl der Quell-Datensätze
 * @param alreadyMigrated - Bereits in Postgres vorhandene Datensätze
 * @param successCount - Erfolgreich migrierte Datensätze
 * @param failedCount - Fehlgeschlagene Datensätze
 * @param skippedCount - Übersprungene Datensätze (dry run oder bereits vorhanden)
 */
export interface MigrationStats {
  totalSource: number;
  alreadyMigrated: number;
  successCount: number;
  failedCount: number;
  skippedCount: number;
}

/**
 * Phase des Migrationsprozesses.
 */
export type MigrationPhase =
  | "idle"
  | "fetching"
  | "running"
  | "completed"
  | "cancelled";

/* =====================================================================
// MigrationJob — Interface für eine Migration eines Objekttyps
// ===================================================================== */

/**
 * Interface für einen Migrationsjob von Firebase nach Postgres.
 *
 * Jeder Objekttyp (Benutzer, Events, Rezepte etc.) implementiert dieses
 * Interface mit der spezifischen Logik zum Lesen, Prüfen und Schreiben.
 *
 * @typeParam T - Typ der Firebase-Quelldaten
 *
 * @example
 * const userJob: MigrationJob<FirebaseUserData> = new UserMigrationJob();
 * const records = await userJob.fetchSourceRecords(firebase);
 */
export interface MigrationJob<T = unknown> {
  /** Anzeigename des Migrationsobjekts (z.B. "Benutzer") */
  name: string;
  /** Beschreibung, die in der UI angezeigt wird */
  description: string;

  /**
   * Liest alle Datensätze aus der Firebase-Quelle.
   *
   * @param firebase - Firebase-Instanz
   * @param database - Optionale DatabaseService-Instanz (z.B. für Bild-Migration,
   *   die Quelldaten aus Postgres statt Firebase liest)
   * @returns Array aller Quelldatensätze
   */
  fetchSourceRecords(
    firebase: Firebase,
    database?: DatabaseService
  ): Promise<SourceRecord<T>[]>;

  /**
   * Prüft, ob ein Datensatz bereits in Postgres existiert.
   *
   * @param database - DatabaseService-Instanz
   * @param record - Der zu prüfende Quelldatensatz
   * @returns true, falls der Datensatz bereits migriert wurde
   */
  checkExists(
    database: DatabaseService,
    record: SourceRecord<T>
  ): Promise<boolean>;

  /**
   * Migriert einen einzelnen Datensatz nach Postgres.
   *
   * @param database - DatabaseService-Instanz
   * @param record - Der zu migrierende Quelldatensatz
   * @param authUser - Der angemeldete Admin-Benutzer (für Audit-Felder)
   */
  migrateRecord(
    database: DatabaseService,
    record: SourceRecord<T>,
    authUser: AuthUser
  ): Promise<void>;
}
