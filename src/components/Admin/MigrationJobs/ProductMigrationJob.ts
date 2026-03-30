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
import {MigrationJob, SourceRecord} from "./MigrationJob.interface";

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

  /* =====================================================================
  // Alle Produkte aus Firebase lesen
  // ===================================================================== */
  /**
   * Liest alle Produkte aus dem Firestore-Dokument `masterData/products`.
   * Die Daten liegen als flache Map vor.
   *
   * @param firebase - Firebase-Instanz
   * @returns Array aller Produkt-Quelldatensätze
   */
  async fetchSourceRecords(
    firebase: Firebase
  ): Promise<SourceRecord<FirebaseProductData>[]> {
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
   *
   * @param database - DatabaseService-Instanz
   * @param record - Der zu prüfende Quelldatensatz
   * @returns true, falls das Produkt bereits vorhanden ist
   */
  async checkExists(
    database: DatabaseService,
    record: SourceRecord<FirebaseProductData>
  ): Promise<boolean> {
    const products = database.admin?.products ?? database.products;
    const existing = await products.findMany({
      filters: [
        {field: "firebase_uid", operator: "eq", value: record.id},
      ],
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
   * Löst die Abteilungs-FK über die `firebase_uid`-Spalte
   * der departments-Tabelle auf.
   *
   * @param database - DatabaseService-Instanz
   * @param record - Der zu migrierende Quelldatensatz
   * @param authUser - Der angemeldete Admin-Benutzer
   * @throws {Error} Wenn die referenzierte Abteilung nicht in Postgres gefunden wird
   */
  async migrateRecord(
    database: DatabaseService,
    record: SourceRecord<FirebaseProductData>,
    authUser: AuthUser
  ): Promise<void> {
    const data = record.data;
    const products = database.admin?.products ?? database.products;
    const departments = database.admin?.departments ?? database.departments;

    // Abteilungs-FK auflösen: Firebase-UID → Postgres-ID
    let departmentId = "";
    if (data.departmentUid) {
      const deptMatches = await departments.findMany({
        filters: [
          {field: "firebase_uid", operator: "eq", value: data.departmentUid},
        ],
      });
      if (deptMatches.length > 0) {
        departmentId = deptMatches[0].uid;
      }
    }

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
