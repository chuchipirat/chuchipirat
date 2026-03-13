/**
 * ProductRepository — Repository für Produkte/Zutaten (Stammdaten).
 *
 * Greift auf die Tabelle `products` zu und ersetzt die bisherigen
 * Firebase-Methoden in product.class.ts. Unterstützt JOIN zu
 * departments für den Abteilungsnamen.
 *
 * @example
 * const products = await repo.getAllProducts({onlyUsable: true});
 */
import {SupabaseClient} from "@supabase/supabase-js";
import {BaseRepository} from "./BaseRepository";
import {
  STORAGE_OBJECT_PROPERTY,
  StorageObjectProperty,
} from "../../Firebase/Db/sessionStorageHandler.class";
import {AuthUser} from "../../Firebase/Authentication/authUser.class";
import {
  ALLERGEN_FROM_DB,
  ALLERGEN_TO_DB,
  DIET_FROM_DB,
  DIET_TO_DB,
} from "../../../constants/enumMappings";

/* =====================================================================
// DB-Zeilenstruktur (snake_case, entspricht den Postgres-Spalten)
// ===================================================================== */
/**
 * Datenbank-Zeilentyp für die products-Tabelle.
 *
 * @param id - Primärschlüssel (UUID als TEXT)
 * @param firebase_uid - Alte Firebase-UID für Migrationszuordnung
 * @param name - Name des Produkts (Plural)
 * @param name_singular - Name des Produkts (Singular)
 * @param department_id - FK auf departments.id
 * @param shopping_unit - FK auf units.key (Einkaufseinheit)
 * @param allergens - Allergene als Postgres-ENUM-Array ('lactose' | 'gluten')
 * @param diet - Diätklassifikation als Postgres-ENUM ('meat' | 'vegetarian' | 'vegan')
 * @param usable - Ob das Produkt aktiv ist
 * @param created_at - Erstellungszeitpunkt
 * @param created_by - UID des Erstellers
 * @param updated_at - Zeitpunkt der letzten Änderung
 * @param updated_by - UID des letzten Bearbeiters
 */
export interface ProductRow {
  [key: string]: unknown;
  id: string;
  firebase_uid: string | null;
  name: string;
  name_singular: string;
  department_id: string | null;
  shopping_unit: string | null;
  allergens: string[];
  diet: string;
  usable: boolean;
  created_at: string;
  created_by: string | null;
  updated_at: string;
  updated_by: string | null;
}

/**
 * Erweiterte Zeile mit JOIN-Daten von departments.
 */
interface ProductRowWithDepartment extends ProductRow {
  departments: {name: string} | null;
}

/* =====================================================================
// Domain-Modell (camelCase, wird in der App verwendet)
// ===================================================================== */
/**
 * Domain-Modell für Produkte.
 *
 * @param uid - Eindeutige ID des Produkts (entspricht DB-Spalte id)
 * @param name - Name des Produkts (Plural)
 * @param nameSingular - Name des Produkts (Singular)
 * @param department - Abteilung mit uid und name
 * @param shoppingUnit - Einkaufseinheit (key)
 * @param dietProperties - Allergen- und Diäteigenschaften
 * @param usable - Ob das Produkt aktiv ist
 */
export interface ProductDomain {
  uid: string;
  name: string;
  nameSingular: string;
  department: {uid: string; name: string};
  shoppingUnit: string;
  dietProperties: {allergens: number[]; diet: number};
  usable: boolean;
}

/**
 * Optionen für getAllProducts().
 *
 * @param onlyUsable - Nur aktive Produkte laden
 * @param withDepartmentName - Abteilungsname per JOIN laden
 */
interface GetAllProductsOptions {
  onlyUsable?: boolean;
  withDepartmentName?: boolean;
}

/* =====================================================================
// ProductRepository
// ===================================================================== */
export class ProductRepository extends BaseRepository<
  ProductDomain,
  ProductRow
> {
  tableName = "products";

  constructor(client?: SupabaseClient) {
    super(client);
  }

  /* =====================================================================
  // Domain → DB-Zeile Mapping
  // ===================================================================== */
  /**
   * Konvertiert ein ProductDomain-Objekt in eine Postgres-Zeile.
   * Flacht department und dietProperties in einzelne Spalten ab.
   *
   * @param domain - Das Domain-Objekt (camelCase)
   * @returns Partielle DB-Zeile (snake_case)
   */
  toRow(domain: ProductDomain): Partial<ProductRow> {
    return {
      name: domain.name,
      name_singular: domain.nameSingular ?? "",
      department_id: domain.department?.uid || null,
      shopping_unit: domain.shoppingUnit || null,
      // Allergen.None (0) bedeutet kein Allergen → aus dem Array filtern,
      // dann numerische Werte in DB-ENUM-Strings übersetzen.
      allergens: (domain.dietProperties?.allergens ?? [])
        .filter((allergen) => allergen !== 0)
        .map((allergen) => ALLERGEN_TO_DB[allergen])
        .filter(Boolean),
      // Numerischen Diet-Wert in DB-ENUM-String übersetzen (z.B. 1 → 'meat')
      diet: DIET_TO_DB[domain.dietProperties?.diet ?? 1] ?? "meat",
      usable: domain.usable,
    };
  }

  /* =====================================================================
  // DB-Zeile → Domain Mapping
  // ===================================================================== */
  /**
   * Konvertiert eine Postgres-Zeile in ein ProductDomain-Objekt.
   * Baut department und dietProperties aus flachen Spalten zusammen.
   *
   * @param row - Die DB-Zeile (snake_case), optional mit departments-JOIN
   * @returns Domain-Objekt (camelCase)
   */
  toDomain(row: ProductRow): ProductDomain {
    const rowWithDept = row as ProductRowWithDepartment;
    return {
      uid: row.id,
      name: row.name,
      nameSingular: row.name_singular ?? "",
      department: {
        uid: row.department_id ?? "",
        name: rowWithDept.departments?.name ?? "",
      },
      shoppingUnit: row.shopping_unit ?? "",
      dietProperties: {
        // DB-ENUM-Strings in numerische Allergen-Werte übersetzen
        allergens: (row.allergens ?? [])
          .map((allergen) => ALLERGEN_FROM_DB[allergen])
          .filter((allergen): allergen is number => allergen !== undefined),
        // DB-ENUM-String in numerischen Diet-Wert übersetzen (z.B. 'meat' → 1)
        diet: DIET_FROM_DB[row.diet] ?? 1,
      },
      usable: row.usable,
    };
  }

  /* =====================================================================
  // Cache-Konfiguration
  // ===================================================================== */
  /**
   * Gibt die Cache-Konfiguration zurück.
   * Produkte werden 60 Minuten gecacht.
   */
  getCacheConfig(): StorageObjectProperty {
    return STORAGE_OBJECT_PROPERTY.PRODUCTS;
  }

  /* =====================================================================
  // Convenience-Methoden
  // ===================================================================== */
  /**
   * Lädt alle Produkte mit optionalem Filter und JOIN.
   * Verwendet eine Custom-Query mit departments-JOIN statt findMany(),
   * da der Abteilungsname nur per JOIN verfügbar ist.
   *
   * @param options - Optionen für Filterung und JOIN
   * @returns Array der Produkte, sortiert nach Name aufsteigend
   */
  async getAllProducts(
    options: GetAllProductsOptions = {},
  ): Promise<ProductDomain[]> {
    const {onlyUsable = false, withDepartmentName = false} = options;

    const selectClause = withDepartmentName ? "*, departments(name)" : "*";

    let query = this.client.from(this.tableName).select(selectClause);

    if (onlyUsable) {
      query = query.eq("usable", true);
    }

    query = query.order("name", {ascending: true});

    const {data, error} = await query;
    if (error) throw error;

    return (data as unknown as ProductRow[]).map((row) => this.toDomain(row));
  }

  /**
   * Fügt ein neues Produkt in die Datenbank ein.
   * Die UUID wird von der Datenbank generiert und im zurückgegebenen Domain-Objekt
   * als uid gesetzt.
   *
   * @param product - Das Domain-Objekt ohne uid (wird von Postgres vergeben)
   * @param authUser - Der angemeldete Benutzer (für Audit-Zwecke)
   * @returns Das eingefügte Domain-Objekt mit generierter uid
   */
  async insertProduct(
    product: Omit<ProductDomain, "uid">,
    authUser: AuthUser,
  ): Promise<ProductDomain> {
    // uid ist leer — toRow() ignoriert sie, die DB generiert eine UUID
    const {value} = await this.insert({
      value: {...product, uid: ""} as ProductDomain,
      authUser,
    });
    return value;
  }

  /**
   * Gibt die UIDs der Produkte zurück, die innerhalb der letzten N Tage
   * erstellt wurden. Ersetzt den bisherigen Feed-basierten Ansatz mit Firebase.
   *
   * @param daysOffset - Anzahl der Tage zurück (z.B. 10 für die letzten 10 Tage)
   * @returns Array der Produkt-UIDs (neueste Produkte)
   */
  async getRecentProductUids(daysOffset: number): Promise<string[]> {
    const cutoff = new Date(
      Date.now() - daysOffset * 24 * 60 * 60 * 1000,
    ).toISOString();

    const {data, error} = await this.client
      .from(this.tableName)
      .select("id")
      .gte("created_at", cutoff);

    if (error) throw error;

    return (data as {id: string}[]).map((row) => row.id);
  }

  /**
   * Aktualisiert ein einzelnes Produkt in der Datenbank.
   *
   * @param product - Das aktualisierte Domain-Objekt
   * @param authUser - Der angemeldete Benutzer (für Audit-Zwecke)
   * @returns Das aktualisierte Domain-Objekt nach DB-Roundtrip
   */
  async updateProduct(
    product: ProductDomain,
    authUser: AuthUser,
  ): Promise<ProductDomain> {
    return this.update({id: product.uid, value: product, authUser});
  }

  /**
   * Speichert alle Produkte per Upsert.
   *
   * @param products - Array der zu speichernden Produkte
   * @param _authUser - Der angemeldete Benutzer (für Audit-Zwecke, wird von DB-Triggern gesetzt)
   */
  async saveAllProducts(
    products: ProductDomain[],
    _authUser: AuthUser,
  ): Promise<void> {
    await this.batchUpsert(products, (p) => p.uid);
  }
}
