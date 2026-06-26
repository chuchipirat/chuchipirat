/**
 * Migrationsjob für Produkte von Firebase nach Postgres.
 *
 * Liest alle Produkte aus dem Firestore-Dokument `masterData/products`
 * (eine flache Map {[uid]: {name, departmentUid, shoppingUnit, dietProperties, usable}})
 * und schreibt sie via ProductRepository in die Postgres-Tabelle `products`.
 *
 * Da Produkte eine FK-Beziehung zu Abteilungen haben, muss die Department-Migration
 * **vor** der Produkt-Migration ausgeführt werden. Die `departmentUid` aus Firebase
 * wird über die `firebase_uid`-Spalte der departments-Tabelle in die Postgres-ID
 * aufgelöst.
 *
 * Die `shoppingUnit` verweist auf `units.key` und wird direkt übernommen,
 * da der Firebase-Key identisch mit dem Postgres-Key ist.
 *
 * @example
 * const job = new ProductMigrationJob();
 * const records = await job.fetchSourceRecords(firebase);
 */
import Firebase from "../../Firebase/firebase.class";
import DatabaseService from "../../Database/DatabaseService";
import AuthUser from "../../Firebase/Authentication/authUser.class";
import {ValueObject} from "../../Firebase/Db/firebase.db.super.class";
import {fetchAllRows, MigrationJob, SourceRecord} from "./MigrationJob.interface";
import {supabaseAdmin} from "../../Database/supabaseClient";

/* =====================================================================
// Typ der Firebase-Quelldaten für ein Produkt
// ===================================================================== */

/**
 * Firebase-Datenstruktur eines Produkts.
 *
 * @param name - Name des Produkts
 * @param departmentUid - Firebase-UID der zugehörigen Abteilung
 * @param shoppingUnit - Einkaufseinheit (= Key der Einheit, z.B. "kg")
 * @param dietProperties - Allergen- und Diäteigenschaften (optional)
 * @param usable - Ob das Produkt aktiv ist
 */
interface FirebaseProductData {
  name: string;
  departmentUid: string;
  shoppingUnit: string;
  dietProperties?: {allergens: number[]; diet: number};
  usable: boolean;
}

/* =====================================================================
// ProductMigrationJob — Migriert Produkte von Firebase nach Postgres
// ===================================================================== */

/**
 * Migrations-Job für Produkte/Zutaten (Stammdaten).
 *
 * Liest alle Produkte aus dem Firestore-Dokument `masterData/products`,
 * prüft anhand der `firebase_uid`, ob der Eintrag bereits in Postgres existiert,
 * und fügt ihn bei Bedarf ein. Löst die Abteilungs-FK über die
 * `firebase_uid`-Spalte der departments-Tabelle auf.
 *
 * Voraussetzung: Die Department-Migration muss bereits erfolgt sein.
 *
 * @example
 * const job = new ProductMigrationJob();
 * const records = await job.fetchSourceRecords(firebase);
 */
export class ProductMigrationJob
  implements MigrationJob<FirebaseProductData>
{
  name = "Produkte";
  description =
    "Migriert alle Produkte/Zutaten von Firebase nach Postgres. " +
    "Setzt voraus, dass Abteilungen und Einheiten bereits migriert sind.";

  /** firebase_uid → Postgres-ID für Abteilungen */
  private departmentIdByFirebaseUid: Map<string, string> = new Map();
  /** Bereits migrierte Produkte (firebase_uid) — für schnelle checkExists-Prüfung */
  private existingFirebaseUids: Set<string> | null = null;

  /* =====================================================================
  // Lookup-Maps einmalig aufbauen
  // ===================================================================== */
  /**
   * Lädt Abteilungen und bereits migrierte Produkte einmalig aus Postgres.
   * Eliminiert N+1-Queries: jede FK-Auflösung und jede checkExists-Prüfung
   * wird danach als O(1)-Map/Set-Lookup ausgeführt.
   */
  private async buildLookupMaps(): Promise<void> {
    // Alle Abteilungen einmalig laden → Map firebase_uid → Postgres-ID
    const deptRows = await fetchAllRows<{id: string; firebase_uid: string}>(
      supabaseAdmin!,
      "departments",
      "id, firebase_uid",
      (query) => query.not("firebase_uid", "is", null),
    );
    this.departmentIdByFirebaseUid = new Map(
      deptRows.map((row) => [row.firebase_uid, row.id]),
    );

    // Bereits migrierte Produkte laden → Set firebase_uid
    const existingRows = await fetchAllRows<{firebase_uid: string}>(
      supabaseAdmin!,
      "products",
      "firebase_uid",
      (query) => query.not("firebase_uid", "is", null),
    );
    this.existingFirebaseUids = new Set(
      existingRows.map((row) => row.firebase_uid),
    );
  }

  /* =====================================================================
  // Alle Produkte aus Firebase lesen
  // ===================================================================== */
  /**
   * Liest alle Produkte aus dem Firestore-Dokument `masterData/products`.
   * Die Daten liegen als flache Map vor.
   *
   * Baut ausserdem Lookup-Maps für FK-Auflösungen auf (Abteilungen)
   * und lädt bereits migrierte Produkte für schnelle checkExists-Prüfung.
   *
   * @param firebase - Firebase-Instanz
   * @param database - DatabaseService-Instanz (optional, für FK-Maps)
   * @returns Array aller Produkt-Quelldatensätze
   */
  async fetchSourceRecords(
    firebase: Firebase,
    database?: DatabaseService,
  ): Promise<SourceRecord<FirebaseProductData>[]> {
    if (database) {
      await this.buildLookupMaps();
    }

    const result =
      await firebase.masterdata.products.read<ValueObject>({uids: []});

    const records: SourceRecord<FirebaseProductData>[] = [];

    for (const [uid, value] of Object.entries(result)) {
      const data = value as FirebaseProductData;
      records.push({
        id: uid,
        label: data.name,
        data: {
          name: data.name,
          departmentUid: data.departmentUid ?? "",
          shoppingUnit: data.shoppingUnit ?? "",
          dietProperties: data.dietProperties ?? {allergens: [], diet: 1},
          usable: data.usable ?? true,
        },
      });
    }

    return records;
  }

  /* =====================================================================
  // Prüfen, ob ein Produkt bereits in Postgres existiert
  // ===================================================================== */
  /**
   * Prüft anhand der `firebase_uid`, ob das Produkt bereits migriert wurde.
   * Verwendet die vorgeladene Menge für O(1)-Lookup, falls verfügbar.
   *
   * @param database - DatabaseService-Instanz
   * @param record - Der zu prüfende Quelldatensatz
   * @returns true, falls das Produkt bereits vorhanden ist
   */
  async checkExists(
    database: DatabaseService,
    record: SourceRecord<FirebaseProductData>,
  ): Promise<boolean> {
    if (this.existingFirebaseUids !== null) {
      return this.existingFirebaseUids.has(record.id);
    }
    // Fallback falls buildLookupMaps nicht aufgerufen wurde
    const existing = await database.products.findMany({
      filters: [{field: "firebase_uid", operator: "eq", value: record.id}],
    });
    return existing.length > 0;
  }

  /* =====================================================================
  // Einzelnes Produkt nach Postgres migrieren
  // ===================================================================== */
  /**
   * Fügt ein Produkt in die Postgres-Tabelle ein und setzt
   * anschliessend die `firebase_uid` per Patch.
   *
   * Löst die Abteilungs-FK über die vorgeladene Lookup-Map auf (O(1)).
   *
   * @param database - DatabaseService-Instanz
   * @param record - Der zu migrierende Quelldatensatz
   * @param authUser - Der angemeldete Admin-Benutzer
   */
  async migrateRecord(
    database: DatabaseService,
    record: SourceRecord<FirebaseProductData>,
    authUser: AuthUser,
  ): Promise<void> {
    const data = record.data;
    const products = database.products;

    // Abteilungs-FK auflösen: O(1)-Lookup via vorgeladener Map
    const departmentId =
      this.departmentIdByFirebaseUid.get(data.departmentUid) ?? "";

    // Produkt einfügen
    const {id} = await products.insert({
      value: {
        uid: "",
        name: data.name,
        nameSingular: "",
        department: {uid: departmentId, name: ""},
        shoppingUnit: data.shoppingUnit,
        dietProperties: data.dietProperties ?? {allergens: [], diet: 1},
        usable: data.usable,
        qaChecked: false,
        qaCheckedAt: null,
      },
      authUser,
    });

    // firebase_uid nachträglich setzen
    await products.patch({
      id,
      fields: {firebase_uid: record.id},
      authUser,
    });
  }
}
