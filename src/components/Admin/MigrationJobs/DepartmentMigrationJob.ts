/**
 * Migrationsjob für Abteilungen von Firebase nach Postgres.
 *
 * Liest alle Abteilungen aus dem Firestore-Dokument `masterData/departments`
 * (eine flache Map {[uid]: {name, pos, usable}}) und schreibt sie
 * via DepartmentRepository in die Postgres-Tabelle `departments`.
 *
 * Nach dem Insert wird die `firebase_uid` per Patch gesetzt, damit
 * spätere Migrationsschritte (z.B. Produkte) die Zuordnung
 * Firebase-UID → Postgres-ID auflösen können.
 *
 * @example
 * const job = new DepartmentMigrationJob();
 * const records = await job.fetchSourceRecords(firebase);
 */
import Firebase from "../../Firebase/firebase.class";
import DatabaseService from "../../Database/DatabaseService";
import AuthUser from "../../Firebase/Authentication/authUser.class";
import {ValueObject} from "../../Firebase/Db/firebase.db.super.class";
import {MigrationJob, SourceRecord} from "./MigrationJob.interface";

/* =====================================================================
// Typ der Firebase-Quelldaten für eine Abteilung
// ===================================================================== */

/**
 * Firebase-Datenstruktur einer Abteilung.
 *
 * @param name - Name der Abteilung
 * @param pos - Sortierposition
 * @param usable - Ob die Abteilung aktiv ist
 */
interface FirebaseDepartmentData {
  name: string;
  pos: number;
  usable: boolean;
}

/* =====================================================================
// DepartmentMigrationJob — Migriert Abteilungen von Firebase nach Postgres
// ===================================================================== */

/**
 * Migrations-Job für Abteilungen (Stammdaten).
 *
 * Liest alle Abteilungen aus dem Firestore-Dokument `masterData/departments`,
 * prüft anhand der `firebase_uid`, ob der Eintrag bereits in Postgres existiert,
 * und fügt ihn bei Bedarf ein. Nach dem Insert wird die `firebase_uid`
 * nachträglich gesetzt.
 *
 * @example
 * const job = new DepartmentMigrationJob();
 * const records = await job.fetchSourceRecords(firebase);
 */
export class DepartmentMigrationJob
  implements MigrationJob<FirebaseDepartmentData>
{
  name = "Abteilungen";
  description =
    "Migriert alle Abteilungen (Departments) von Firebase nach Postgres.";

  /* =====================================================================
  // Alle Abteilungen aus Firebase lesen
  // ===================================================================== */
  /**
   * Liest alle Abteilungen aus dem Firestore-Dokument `masterData/departments`.
   * Die Daten liegen als flache Map {[uid]: {name, pos, usable}} vor.
   *
   * @param firebase - Firebase-Instanz
   * @returns Array aller Abteilungs-Quelldatensätze
   */
  async fetchSourceRecords(
    firebase: Firebase
  ): Promise<SourceRecord<FirebaseDepartmentData>[]> {
    const result =
      await firebase.masterdata.department.read<ValueObject>({uids: []});

    const records: SourceRecord<FirebaseDepartmentData>[] = [];

    for (const [uid, value] of Object.entries(result)) {
      const data = value as FirebaseDepartmentData;
      records.push({
        id: uid,
        label: data.name,
        data: {
          name: data.name,
          pos: data.pos ?? 0,
          usable: data.usable ?? true,
        },
      });
    }

    return records;
  }

  /* =====================================================================
  // Prüfen, ob eine Abteilung bereits in Postgres existiert
  // ===================================================================== */
  /**
   * Prüft anhand der `firebase_uid`, ob die Abteilung bereits migriert wurde.
   *
   * @param database - DatabaseService-Instanz
   * @param record - Der zu prüfende Quelldatensatz
   * @returns true, falls die Abteilung bereits vorhanden ist
   */
  async checkExists(
    database: DatabaseService,
    record: SourceRecord<FirebaseDepartmentData>
  ): Promise<boolean> {
    const departments = database.departments;
    const existing = await departments.findMany({
      filters: [
        {field: "firebase_uid", operator: "eq", value: record.id},
      ],
    });
    return existing.length > 0;
  }

  /* =====================================================================
  // Einzelne Abteilung nach Postgres migrieren
  // ===================================================================== */
  /**
   * Fügt eine Abteilung in die Postgres-Tabelle ein und setzt
   * anschliessend die `firebase_uid` per Patch.
   *
   * @param database - DatabaseService-Instanz
   * @param record - Der zu migrierende Quelldatensatz
   * @param authUser - Der angemeldete Admin-Benutzer
   */
  async migrateRecord(
    database: DatabaseService,
    record: SourceRecord<FirebaseDepartmentData>,
    authUser: AuthUser
  ): Promise<void> {
    const data = record.data;
    const departments = database.departments;

    // Abteilung einfügen
    const {id} = await departments.insert({
      value: {
        uid: "",
        name: data.name,
        pos: data.pos,
        usable: data.usable,
      },
      authUser,
    });

    // firebase_uid nachträglich setzen (für spätere FK-Auflösung)
    await departments.patch({
      id,
      fields: {firebase_uid: record.id},
      authUser,
    });
  }
}
