/**
 * Migrationsjob für Standard-Einheitenumrechnungen von Firebase nach Postgres.
 *
 * Liest alle Umrechnungen aus dem Firestore-Dokument
 * `masterData/unitConversionBasic` (eine flache Map
 * {[uid]: {fromUnit, toUnit, numerator, denominator}}) und schreibt sie
 * via UnitConversionBasicRepository in die Postgres-Tabelle
 * `unit_conversion_basic`.
 *
 * Die Felder `fromUnit`/`toUnit` verweisen auf `units.key` und werden
 * direkt übernommen, da der Firebase-Key identisch mit dem Postgres-Key ist.
 *
 * @example
 * const job = new UnitConversionBasicMigrationJob();
 * const records = await job.fetchSourceRecords(firebase);
 */
import Firebase from "../../Firebase/firebase.class";
import DatabaseService from "../../Database/DatabaseService";
import AuthUser from "../../Firebase/Authentication/authUser.class";
import {ValueObject} from "../../Firebase/Db/firebase.db.super.class";
import {MigrationJob, SourceRecord} from "./MigrationJob.interface";
import {supabaseAdmin} from "../../Database/supabaseClient";
import {UnitConversionBasicRepository} from "../../Database/Repository/UnitConversionBasicRepository";

/* =====================================================================
// Typ der Firebase-Quelldaten für eine Standard-Einheitenumrechnung
// ===================================================================== */

/**
 * Firebase-Datenstruktur einer Standard-Einheitenumrechnung.
 *
 * @param fromUnit - Quell-Einheit (Key, z.B. "kg")
 * @param toUnit - Ziel-Einheit (Key, z.B. "g")
 * @param numerator - Zähler des Umrechnungsfaktors
 * @param denominator - Nenner des Umrechnungsfaktors
 */
interface FirebaseUnitConversionBasicData {
  fromUnit: string;
  toUnit: string;
  numerator: number;
  denominator: number;
}

/* =====================================================================
// UnitConversionBasicMigrationJob — Migriert Standard-Umrechnungen
// ===================================================================== */

/**
 * Migrations-Job für Standard-Einheitenumrechnungen (Stammdaten).
 *
 * Liest alle Umrechnungen aus dem Firestore-Dokument
 * `masterData/unitConversionBasic`, prüft anhand der `firebase_uid`,
 * ob der Eintrag bereits in Postgres existiert, und fügt ihn bei Bedarf ein.
 *
 * Voraussetzung: Die Unit-Migration muss bereits erfolgt sein.
 *
 * @example
 * const job = new UnitConversionBasicMigrationJob();
 * const records = await job.fetchSourceRecords(firebase);
 */
export class UnitConversionBasicMigrationJob
  implements MigrationJob<FirebaseUnitConversionBasicData>
{
  name = "Einheitenumrechnungen (Standard)";
  description =
    "Migriert alle Standard-Einheitenumrechnungen von Firebase nach Postgres. " +
    "Setzt voraus, dass Einheiten bereits migriert sind.";

  /**
   * UnitConversionBasicRepository mit Service-Role-Client. RLS würde
   * Lese-/Schreibzugriff sonst auf die Berechtigungen des eingeloggten
   * Admin-Users beschränken.
   */
  private readonly adminConversions = new UnitConversionBasicRepository(
    supabaseAdmin!,
  );

  /* =====================================================================
  // Alle Standard-Umrechnungen aus Firebase lesen
  // ===================================================================== */
  /**
   * Liest alle Standard-Umrechnungen aus dem Firestore-Dokument
   * `masterData/unitConversionBasic`.
   * Die Daten liegen als flache Map vor.
   *
   * @param firebase - Firebase-Instanz
   * @returns Array aller Umrechnungs-Quelldatensätze
   */
  async fetchSourceRecords(
    firebase: Firebase
  ): Promise<SourceRecord<FirebaseUnitConversionBasicData>[]> {
    const result =
      await firebase.masterdata.unitConversionBasic.read<ValueObject>({
        uids: [],
      });

    const records: SourceRecord<FirebaseUnitConversionBasicData>[] = [];

    for (const [uid, value] of Object.entries(result)) {
      const data = value as FirebaseUnitConversionBasicData;
      records.push({
        id: uid,
        label: `${data.fromUnit} → ${data.toUnit}`,
        data: {
          fromUnit: data.fromUnit,
          toUnit: data.toUnit,
          numerator: data.numerator ?? 1,
          denominator: data.denominator ?? 1,
        },
      });
    }

    return records;
  }

  /* =====================================================================
  // Prüfen, ob eine Umrechnung bereits in Postgres existiert
  // ===================================================================== */
  /**
   * Prüft anhand der `firebase_uid`, ob die Umrechnung bereits migriert wurde.
   *
   * @param record - Der zu prüfende Quelldatensatz
   * @returns true, falls die Umrechnung bereits vorhanden ist
   */
  async checkExists(
    _database: DatabaseService,
    record: SourceRecord<FirebaseUnitConversionBasicData>
  ): Promise<boolean> {
    const existing = await this.adminConversions.findMany({
      filters: [
        {field: "firebase_uid", operator: "eq", value: record.id},
      ],
    });
    return existing.length > 0;
  }

  /* =====================================================================
  // Einzelne Umrechnung nach Postgres migrieren
  // ===================================================================== */
  /**
   * Fügt eine Standard-Umrechnung in die Postgres-Tabelle ein und setzt
   * anschliessend die `firebase_uid` per Patch.
   *
   * @param record - Der zu migrierende Quelldatensatz
   * @param authUser - Der angemeldete Admin-Benutzer
   */
  async migrateRecord(
    _database: DatabaseService,
    record: SourceRecord<FirebaseUnitConversionBasicData>,
    authUser: AuthUser
  ): Promise<void> {
    const data = record.data;

    // Umrechnung einfügen — fromUnit/toUnit sind direkt die Unit-Keys
    const {id} = await this.adminConversions.insert({
      value: {
        uid: "",
        fromUnit: data.fromUnit,
        toUnit: data.toUnit,
        numerator: data.numerator,
        denominator: data.denominator,
      },
      authUser,
    });

    // firebase_uid nachträglich setzen
    await this.adminConversions.patch({
      id,
      fields: {firebase_uid: record.id},
      authUser,
    });
  }
}
