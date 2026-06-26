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
import {fetchAllRows, MigrationJob, SourceRecord} from "./MigrationJob.interface";
import {supabaseAdmin} from "../../Database/supabaseClient";

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

  /** Bereits migrierte Materialien (firebase_uid) — für schnelle checkExists-Prüfung */
  private existingFirebaseUids: Set<string> | null = null;

  /* =====================================================================
  // Lookup-Maps einmalig aufbauen
  // ===================================================================== */
  /**
   * Lädt bereits migrierte Materialien einmalig aus Postgres.
   * Eliminiert N+1-Queries: jede checkExists-Prüfung wird danach
   * als O(1)-Set-Lookup ausgeführt.
   */
  private async buildLookupMaps(): Promise<void> {
    const existingRows = await fetchAllRows<{firebase_uid: string}>(
      supabaseAdmin!,
      "materials",
      "firebase_uid",
      (query) => query.not("firebase_uid", "is", null),
    );
    this.existingFirebaseUids = new Set(
      existingRows.map((row) => row.firebase_uid),
    );
  }

  /* =====================================================================
  // Alle Materialien aus Firebase lesen
  // ===================================================================== */
  /**
   * Liest alle Materialien aus dem Firestore-Dokument `masterData/materials`.
   * Die Daten liegen als flache Map {[uid]: {name, type, usable}} vor.
   *
   * Baut ausserdem die Existenz-Menge für schnelle checkExists-Prüfung auf.
   *
   * @param firebase - Firebase-Instanz
   * @param database - DatabaseService-Instanz (optional, für Existenz-Menge)
   * @returns Array aller Material-Quelldatensätze
   */
  async fetchSourceRecords(
    firebase: Firebase,
    database?: DatabaseService,
  ): Promise<SourceRecord<FirebaseMaterialData>[]> {
    if (database) {
      await this.buildLookupMaps();
    }
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
   * Verwendet die vorgeladene Menge für O(1)-Lookup, falls verfügbar.
   *
   * @param database - DatabaseService-Instanz
   * @param record - Der zu prüfende Quelldatensatz
   * @returns true, falls das Material bereits vorhanden ist
   */
  async checkExists(
    database: DatabaseService,
    record: SourceRecord<FirebaseMaterialData>,
  ): Promise<boolean> {
    if (this.existingFirebaseUids !== null) {
      return this.existingFirebaseUids.has(record.id);
    }
    // Fallback falls buildLookupMaps nicht aufgerufen wurde
    const existing = await database.materials.findMany({
      filters: [{field: "firebase_uid", operator: "eq", value: record.id}],
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
    authUser: AuthUser,
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
