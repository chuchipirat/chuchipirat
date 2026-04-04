/**
 * Migrationsjob für produktspezifische Einheitenumrechnungen von Firebase nach Postgres.
 *
 * Liest alle Umrechnungen aus dem Firestore-Dokument
 * `masterData/unitConversionProducts` (eine flache Map
 * {[uid]: {fromUnit, toUnit, numerator, denominator, productUid, productName}})
 * und schreibt sie via UnitConversionProductRepository in die Postgres-Tabelle
 * `unit_conversion_products`.
 *
 * Da jede Umrechnung eine FK-Beziehung zu einem Produkt hat, muss die
 * Produkt-Migration **vor** dieser Migration ausgeführt werden. Die `productUid`
 * aus Firebase wird über die `firebase_uid`-Spalte der products-Tabelle
 * in die Postgres-ID aufgelöst.
 *
 * Die Felder `fromUnit`/`toUnit` verweisen auf `units.key` und werden
 * direkt übernommen.
 *
 * @example
 * const job = new UnitConversionProductMigrationJob();
 * const records = await job.fetchSourceRecords(firebase);
 */
import Firebase from "../../Firebase/firebase.class";
import DatabaseService from "../../Database/DatabaseService";
import AuthUser from "../../Firebase/Authentication/authUser.class";
import {ValueObject} from "../../Firebase/Db/firebase.db.super.class";
import {MigrationJob, SourceRecord} from "./MigrationJob.interface";

/* =====================================================================
// Typ der Firebase-Quelldaten für eine produktspezifische Umrechnung
// ===================================================================== */

/**
 * Firebase-Datenstruktur einer produktspezifischen Einheitenumrechnung.
 *
 * @param fromUnit - Quell-Einheit (Key, z.B. "Stk")
 * @param toUnit - Ziel-Einheit (Key, z.B. "g")
 * @param numerator - Zähler des Umrechnungsfaktors
 * @param denominator - Nenner des Umrechnungsfaktors
 * @param productUid - Firebase-UID des zugehörigen Produkts
 * @param productName - Name des zugehörigen Produkts (nur zur Anzeige)
 */
interface FirebaseUnitConversionProductData {
  fromUnit: string;
  toUnit: string;
  numerator: number;
  denominator: number;
  productUid: string;
  productName: string;
}

/* =====================================================================
// UnitConversionProductMigrationJob — Migriert produktspezifische Umrechnungen
// ===================================================================== */

/**
 * Migrations-Job für produktspezifische Einheitenumrechnungen (Stammdaten).
 *
 * Liest alle Umrechnungen aus dem Firestore-Dokument
 * `masterData/unitConversionProducts`, prüft anhand der `firebase_uid`,
 * ob der Eintrag bereits in Postgres existiert, und fügt ihn bei Bedarf ein.
 * Löst die Produkt-FK über die `firebase_uid`-Spalte der products-Tabelle auf.
 *
 * Voraussetzung: Die Produkt- und Unit-Migration müssen bereits erfolgt sein.
 *
 * @example
 * const job = new UnitConversionProductMigrationJob();
 * const records = await job.fetchSourceRecords(firebase);
 */
export class UnitConversionProductMigrationJob
  implements MigrationJob<FirebaseUnitConversionProductData>
{
  name = "Einheitenumrechnungen (Produkte)";
  description =
    "Migriert alle produktspezifischen Einheitenumrechnungen von Firebase nach Postgres. " +
    "Setzt voraus, dass Produkte und Einheiten bereits migriert sind.";

  /* =====================================================================
  // Alle produktspezifischen Umrechnungen aus Firebase lesen
  // ===================================================================== */
  /**
   * Liest alle produktspezifischen Umrechnungen aus dem Firestore-Dokument
   * `masterData/unitConversionProducts`.
   * Die Daten liegen als flache Map vor.
   *
   * @param firebase - Firebase-Instanz
   * @returns Array aller Umrechnungs-Quelldatensätze
   */
  async fetchSourceRecords(
    firebase: Firebase
  ): Promise<SourceRecord<FirebaseUnitConversionProductData>[]> {
    const result =
      await firebase.masterdata.unitConversionProducts.read<ValueObject>({
        uids: [],
      });

    const records: SourceRecord<FirebaseUnitConversionProductData>[] = [];

    for (const [uid, value] of Object.entries(result)) {
      const data = value as FirebaseUnitConversionProductData;
      records.push({
        id: uid,
        label: `${data.productName}: ${data.fromUnit} → ${data.toUnit}`,
        data: {
          fromUnit: data.fromUnit,
          toUnit: data.toUnit,
          numerator: data.numerator ?? 1,
          denominator: data.denominator ?? 1,
          productUid: data.productUid ?? "",
          productName: data.productName ?? "",
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
   * @param database - DatabaseService-Instanz
   * @param record - Der zu prüfende Quelldatensatz
   * @returns true, falls die Umrechnung bereits vorhanden ist
   */
  async checkExists(
    database: DatabaseService,
    record: SourceRecord<FirebaseUnitConversionProductData>
  ): Promise<boolean> {
    const conversions =
      database.admin?.unitConversionProducts ?? database.unitConversionProducts;
    const existing = await conversions.findMany({
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
   * Fügt eine produktspezifische Umrechnung in die Postgres-Tabelle ein
   * und setzt anschliessend die `firebase_uid` per Patch.
   *
   * Löst die Produkt-FK über die `firebase_uid`-Spalte
   * der products-Tabelle auf.
   *
   * @param database - DatabaseService-Instanz
   * @param record - Der zu migrierende Quelldatensatz
   * @param authUser - Der angemeldete Admin-Benutzer
   * @throws {Error} Wenn das referenzierte Produkt nicht in Postgres gefunden wird
   */
  async migrateRecord(
    database: DatabaseService,
    record: SourceRecord<FirebaseUnitConversionProductData>,
    authUser: AuthUser
  ): Promise<void> {
    const data = record.data;
    const conversions =
      database.admin?.unitConversionProducts ?? database.unitConversionProducts;
    const products = database.admin?.products ?? database.products;

    // Produkt-FK auflösen: Firebase-UID → Postgres-ID
    let productId = "";
    if (data.productUid) {
      const productMatches = await products.findMany({
        filters: [
          {field: "firebase_uid", operator: "eq", value: data.productUid},
        ],
      });
      if (productMatches.length > 0) {
        productId = productMatches[0].uid;
      }
    }

    if (!productId) {
      throw new Error(
        `Produkt mit Firebase-UID "${data.productUid}" nicht in Postgres gefunden. ` +
          "Stelle sicher, dass die Produkt-Migration vor dieser Migration ausgeführt wurde."
      );
    }

    // Umrechnung einfügen — fromUnit/toUnit sind direkt die Unit-Keys
    const {id} = await conversions.insert({
      value: {
        uid: "",
        fromUnit: data.fromUnit,
        toUnit: data.toUnit,
        numerator: data.numerator,
        denominator: data.denominator,
        productUid: productId,
        productName: "",
      },
      authUser,
    });

    // firebase_uid nachträglich setzen
    await conversions.patch({
      id,
      fields: {firebase_uid: record.id},
      authUser,
    });
  }
}
