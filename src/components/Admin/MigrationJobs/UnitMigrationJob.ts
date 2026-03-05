/**
 * Migrationsjob für Einheiten von Firebase nach Postgres.
 *
 * Liest alle Einheiten aus dem Firestore-Dokument `masterData/units`
 * (eine flache Map {[key]: {name, dimension}}). In Firebase ist der Key
 * gleichzeitig die Abkürzung der Einheit (z.B. "kg", "l", "Stk").
 *
 * Nach dem Insert wird die `firebase_uid` per Patch gesetzt, damit
 * spätere Migrationsschritte die Zuordnung auflösen können.
 *
 * @example
 * const job = new UnitMigrationJob();
 * const records = await job.fetchSourceRecords(firebase);
 */
import Firebase from "../../Firebase/firebase.class";
import DatabaseService from "../../Database/DatabaseService";
import AuthUser from "../../Firebase/Authentication/authUser.class";
import {ValueObject} from "../../Firebase/Db/firebase.db.super.class";
import {MigrationJob, SourceRecord} from "./MigrationJob.interface";

/* =====================================================================
// Typ der Firebase-Quelldaten für eine Einheit
// ===================================================================== */

/**
 * Firebase-Datenstruktur einer Einheit.
 *
 * @param key - Abkürzung der Einheit (= Firebase-Key, z.B. "kg")
 * @param name - Vollständiger Name der Einheit
 * @param dimension - Dimension (z.B. "VOL", "MAS", "DLS")
 */
interface FirebaseUnitData {
  key: string;
  name: string;
  dimension: string;
}

/* =====================================================================
// UnitMigrationJob — Migriert Einheiten von Firebase nach Postgres
// ===================================================================== */

/**
 * Migrations-Job für Einheiten (Stammdaten).
 *
 * Liest alle Einheiten aus dem Firestore-Dokument `masterData/units`,
 * prüft anhand der `firebase_uid`, ob der Eintrag bereits in Postgres existiert,
 * und fügt ihn bei Bedarf ein. Der Firebase-Key wird sowohl als `key`-Spalte
 * als auch als `firebase_uid` gespeichert.
 *
 * @example
 * const job = new UnitMigrationJob();
 * const records = await job.fetchSourceRecords(firebase);
 */
export class UnitMigrationJob implements MigrationJob<FirebaseUnitData> {
  name = "Einheiten";
  description =
    "Migriert alle Einheiten (Units) von Firebase nach Postgres.";

  /* =====================================================================
  // Alle Einheiten aus Firebase lesen
  // ===================================================================== */
  /**
   * Liest alle Einheiten aus dem Firestore-Dokument `masterData/units`.
   * Die Daten liegen als flache Map {[key]: {name, dimension}} vor.
   * Der Key in Firebase ist gleichzeitig die Abkürzung der Einheit.
   *
   * @param firebase - Firebase-Instanz
   * @returns Array aller Einheiten-Quelldatensätze
   */
  async fetchSourceRecords(
    firebase: Firebase
  ): Promise<SourceRecord<FirebaseUnitData>[]> {
    const result =
      await firebase.masterdata.units.read<ValueObject>({uids: []});

    const records: SourceRecord<FirebaseUnitData>[] = [];

    for (const [key, value] of Object.entries(result)) {
      const data = value as {name: string; dimension: string};
      records.push({
        id: key,
        label: `${key} (${data.name})`,
        data: {
          key,
          name: data.name,
          dimension: data.dimension ?? "",
        },
      });
    }

    return records;
  }

  /* =====================================================================
  // Prüfen, ob eine Einheit bereits in Postgres existiert
  // ===================================================================== */
  /**
   * Prüft anhand der `firebase_uid`, ob die Einheit bereits migriert wurde.
   *
   * @param database - DatabaseService-Instanz
   * @param record - Der zu prüfende Quelldatensatz
   * @returns true, falls die Einheit bereits vorhanden ist
   */
  async checkExists(
    database: DatabaseService,
    record: SourceRecord<FirebaseUnitData>
  ): Promise<boolean> {
    const units = database.admin?.units ?? database.units;
    const existing = await units.findMany({
      filters: [
        {field: "firebase_uid", operator: "eq", value: record.id},
      ],
    });
    return existing.length > 0;
  }

  /* =====================================================================
  // Einzelne Einheit nach Postgres migrieren
  // ===================================================================== */
  /**
   * Fügt eine Einheit in die Postgres-Tabelle ein und setzt
   * anschliessend die `firebase_uid` per Patch.
   *
   * @param database - DatabaseService-Instanz
   * @param record - Der zu migrierende Quelldatensatz
   * @param authUser - Der angemeldete Admin-Benutzer
   */
  async migrateRecord(
    database: DatabaseService,
    record: SourceRecord<FirebaseUnitData>,
    authUser: AuthUser
  ): Promise<void> {
    const data = record.data;
    const units = database.admin?.units ?? database.units;

    // Einheit einfügen — key = Firebase-Key (Abkürzung)
    const {id} = await units.insert({
      value: {
        key: data.key,
        name: data.name,
        dimension: data.dimension,
      },
      authUser,
    });

    // firebase_uid nachträglich setzen (= Firebase-Key)
    await units.patch({
      id,
      fields: {firebase_uid: record.id},
      authUser,
    });
  }
}
