/**
 * Migrationsjob für Materialien von Firebase nach Postgres.
 *
 * Liest alle Materialien aus dem Firestore-Dokument `masterData/materials`
 * (eine flache Map {[uid]: {name, type, usable}}) und schreibt sie
 * via MaterialRepository in die Postgres-Tabelle `materials`.
 *
 * Einfache 1:1-Zuordnung ohne FK-Auflösung.
 *
 * @example
 * const job = new MaterialMigrationJob();
 * const records = await job.fetchSourceRecords(firebase);
 */
import Firebase from "../../Firebase/firebase.class";
import DatabaseService from "../../Database/DatabaseService";
import AuthUser from "../../Firebase/Authentication/authUser.class";
import {ValueObject} from "../../Firebase/Db/firebase.db.super.class";
import {MigrationJob, SourceRecord} from "./MigrationJob.interface";

/* =====================================================================
// Typ der Firebase-Quelldaten für ein Material
// ===================================================================== */

/**
 * Firebase-Datenstruktur eines Materials.
 *
 * @param name - Name des Materials
 * @param type - Materialtyp (0=none, 1=consumable, 2=usage)
 * @param usable - Ob das Material aktiv ist
 */
interface FirebaseMaterialData {
  name: string;
  type: number;
  usable: boolean;
}

/* =====================================================================
// MaterialMigrationJob — Migriert Materialien von Firebase nach Postgres
// ===================================================================== */

/**
 * Migrations-Job für Materialien (Stammdaten).
 *
 * Liest alle Materialien aus dem Firestore-Dokument `masterData/materials`,
 * prüft anhand der `firebase_uid`, ob der Eintrag bereits in Postgres existiert,
 * und fügt ihn bei Bedarf ein. Nach dem Insert wird die `firebase_uid`
 * nachträglich gesetzt.
 *
 * @example
 * const job = new MaterialMigrationJob();
 * const records = await job.fetchSourceRecords(firebase);
 */
export class MaterialMigrationJob
  implements MigrationJob<FirebaseMaterialData>
{
  name = "Materialien";
  description =
    "Migriert alle Materialien von Firebase nach Postgres.";

  /* =====================================================================
  // Alle Materialien aus Firebase lesen
  // ===================================================================== */
  /**
   * Liest alle Materialien aus dem Firestore-Dokument `masterData/materials`.
   * Die Daten liegen als flache Map {[uid]: {name, type, usable}} vor.
   *
   * @param firebase - Firebase-Instanz
   * @returns Array aller Material-Quelldatensätze
   */
  async fetchSourceRecords(
    firebase: Firebase
  ): Promise<SourceRecord<FirebaseMaterialData>[]> {
    const result =
      await firebase.masterdata.materials.read<ValueObject>({uids: []});

    const records: SourceRecord<FirebaseMaterialData>[] = [];

    for (const [uid, value] of Object.entries(result)) {
      const data = value as FirebaseMaterialData;
      records.push({
        id: uid,
        label: data.name,
        data: {
          name: data.name,
          type: data.type ?? 0,
          usable: data.usable ?? true,
        },
      });
    }

    return records;
  }

  /* =====================================================================
  // Prüfen, ob ein Material bereits in Postgres existiert
  // ===================================================================== */
  /**
   * Prüft anhand der `firebase_uid`, ob das Material bereits migriert wurde.
   *
   * @param database - DatabaseService-Instanz
   * @param record - Der zu prüfende Quelldatensatz
   * @returns true, falls das Material bereits vorhanden ist
   */
  async checkExists(
    database: DatabaseService,
    record: SourceRecord<FirebaseMaterialData>
  ): Promise<boolean> {
    const materials = database.materials;
    const existing = await materials.findMany({
      filters: [
        {field: "firebase_uid", operator: "eq", value: record.id},
      ],
    });
    return existing.length > 0;
  }

  /* =====================================================================
  // Einzelnes Material nach Postgres migrieren
  // ===================================================================== */
  /**
   * Fügt ein Material in die Postgres-Tabelle ein und setzt
   * anschliessend die `firebase_uid` per Patch.
   *
   * @param database - DatabaseService-Instanz
   * @param record - Der zu migrierende Quelldatensatz
   * @param authUser - Der angemeldete Admin-Benutzer
   */
  async migrateRecord(
    database: DatabaseService,
    record: SourceRecord<FirebaseMaterialData>,
    authUser: AuthUser
  ): Promise<void> {
    const data = record.data;
    const materials = database.materials;

    // Material einfügen
    const {id} = await materials.insert({
      value: {
        uid: "",
        name: data.name,
        type: data.type,
        usable: data.usable,
        qaChecked: false,
        qaCheckedAt: null,
      },
      authUser,
    });

    // firebase_uid nachträglich setzen
    await materials.patch({
      id,
      fields: {firebase_uid: record.id},
      authUser,
    });
  }
}
