import {useState, useRef, useCallback} from "react";

import Firebase from "../../Firebase/firebase.class";
import DatabaseService from "../../Database/DatabaseService";
import AuthUser from "../../Firebase/Authentication/authUser.class";
import {
  MigrationJob,
  MigrationPhase,
  MigrationRecordResult,
  MigrationStats,
} from "./MigrationJob.interface";

/* =====================================================================
// Initiale Werte
// ===================================================================== */

const INITIAL_STATS: MigrationStats = {
  totalSource: 0,
  alreadyMigrated: 0,
  successCount: 0,
  failedCount: 0,
  skippedCount: 0,
};

/* =====================================================================
// Rückgabetyp des Hooks
// ===================================================================== */

/**
 * Rückgabetyp des useMigration-Hooks.
 *
 * @param phase - Aktuelle Phase des Migrationsprozesses
 * @param stats - Aggregierte Statistiken
 * @param results - Ergebnisse pro Datensatz (für das Protokoll)
 * @param currentRecord - Label des gerade verarbeiteten Datensatzes
 * @param dryRun - Ob der Dry-Run-Modus aktiv ist
 * @param setDryRun - Setter für den Dry-Run-Modus
 * @param start - Startet die Migration
 * @param cancel - Bricht die laufende Migration ab
 */
export interface UseMigrationReturn {
  phase: MigrationPhase;
  stats: MigrationStats;
  results: MigrationRecordResult[];
  currentRecord: string;
  dryRun: boolean;
  setDryRun: (value: boolean) => void;
  start: (
    job: MigrationJob,
    firebase: Firebase,
    database: DatabaseService,
    authUser: AuthUser
  ) => Promise<void>;
  cancel: () => void;
}

/* =====================================================================
// useMigration — Hook für die Steuerung eines Migrationslaufs
// ===================================================================== */

/**
 * Custom Hook, der die gesamte Migrationslogik kapselt.
 *
 * Steuert den Ablauf: Quelldaten laden → Datensätze sequentiell prüfen
 * und migrieren → Statistiken und Protokoll aktualisieren.
 *
 * Unterstützt Dry Run (nur prüfen, nicht schreiben) und Cancel
 * (Migration vorzeitig abbrechen).
 *
 * @returns Objekt mit Phase, Stats, Ergebnissen und Steuerfunktionen
 *
 * @example
 * const migration = useMigration();
 * await migration.start(job, firebase, database, authUser);
 */
export const useMigration = (): UseMigrationReturn => {
  const [phase, setPhase] = useState<MigrationPhase>("idle");
  const [stats, setStats] = useState<MigrationStats>(INITIAL_STATS);
  const [results, setResults] = useState<MigrationRecordResult[]>([]);
  const [currentRecord, setCurrentRecord] = useState<string>("");
  const [dryRun, setDryRun] = useState<boolean>(true);

  // Ref für Cancel, damit der laufende Loop sofort reagiert
  const cancelRef = useRef(false);

  /* ------------------------------------------
  // Migration abbrechen
  // ------------------------------------------ */
  const cancel = useCallback(() => {
    cancelRef.current = true;
  }, []);

  /* ------------------------------------------
  // Migration starten
  // ------------------------------------------ */
  const start = useCallback(
    async (
      job: MigrationJob,
      firebase: Firebase,
      database: DatabaseService,
      authUser: AuthUser
    ) => {
      // Zustand zurücksetzen
      cancelRef.current = false;
      setResults([]);
      setStats(INITIAL_STATS);
      setCurrentRecord("");

      // Phase 1: Quelldaten laden
      setPhase("fetching");

      let sourceRecords;
      try {
        sourceRecords = await job.fetchSourceRecords(firebase);
      } catch (error) {
        // Fehler beim Laden — direkt abbrechen
        setResults([
          {
            id: "FETCH_ERROR",
            label: "Fehler beim Laden der Quelldaten",
            status: "failed",
            error: error instanceof Error ? error.message : String(error),
          },
        ]);
        setPhase("completed");
        return;
      }

      const totalSource = sourceRecords.length;
      setStats((prev) => ({...prev, totalSource}));

      // Phase 2: Datensätze sequentiell verarbeiten
      setPhase("running");

      let alreadyMigrated = 0;
      let successCount = 0;
      let failedCount = 0;
      let skippedCount = 0;

      for (const record of sourceRecords) {
        // Abbruch prüfen
        if (cancelRef.current) {
          setPhase("cancelled");
          return;
        }

        setCurrentRecord(record.label);

        try {
          // Prüfen ob bereits vorhanden
          const exists = await job.checkExists(database, record);

          if (exists) {
            alreadyMigrated++;
            skippedCount++;
            setResults((prev) => [
              ...prev,
              {id: record.id, label: record.label, status: "skipped"},
            ]);
          } else if (dryRun) {
            // Dry Run: nur zählen, nicht schreiben
            skippedCount++;
            setResults((prev) => [
              ...prev,
              {id: record.id, label: record.label, status: "skipped"},
            ]);
          } else {
            // Tatsächlich migrieren
            await job.migrateRecord(database, record, authUser);
            successCount++;
            setResults((prev) => [
              ...prev,
              {id: record.id, label: record.label, status: "success"},
            ]);
          }
        } catch (error) {
          failedCount++;
          setResults((prev) => [
            ...prev,
            {
              id: record.id,
              label: record.label,
              status: "failed",
              error: error instanceof Error ? error.message : String(error),
            },
          ]);
        }

        // Stats laufend aktualisieren
        setStats({
          totalSource,
          alreadyMigrated,
          successCount,
          failedCount,
          skippedCount,
        });
      }

      setCurrentRecord("");
      setPhase("completed");
    },
    [dryRun]
  );

  return {
    phase,
    stats,
    results,
    currentRecord,
    dryRun,
    setDryRun,
    start,
    cancel,
  };
};
