/**
 * UnitConversionProductRepository — Repository für produktspezifische Einheitenumrechnungen.
 *
 * Greift auf die Tabelle `unit_conversion_products` zu und ersetzt die bisherigen
 * Firebase-Methoden in unitConversion.class.ts. Unterstützt JOIN zu products
 * für den Produktnamen.
 *
 * @example
 * const conversions = await repo.getAllConversions();
 */
import {SupabaseClient} from "@supabase/supabase-js";
import {BaseRepository} from "./BaseRepository";
import {
  STORAGE_OBJECT_PROPERTY,
  StorageObjectProperty,
} from "../../Firebase/Db/sessionStorageHandler.class";
import {AuthUser} from "../../Firebase/Authentication/authUser.class";

/* =====================================================================
// DB-Zeilenstruktur (snake_case, entspricht den Postgres-Spalten)
// ===================================================================== */
/**
 * Datenbank-Zeilentyp für die unit_conversion_products-Tabelle.
 *
 * @param id - Primärschlüssel (UUID als TEXT)
 * @param firebase_uid - Alte Firebase-UID für Migrationszuordnung
 * @param from_unit - Quell-Einheit (FK auf units.key)
 * @param to_unit - Ziel-Einheit (FK auf units.key)
 * @param numerator - Zähler des Umrechnungsfaktors
 * @param denominator - Nenner des Umrechnungsfaktors
 * @param product_id - FK auf products.id
 * @param created_at - Erstellungszeitpunkt
 * @param created_by - UID des Erstellers
 * @param updated_at - Zeitpunkt der letzten Änderung
 * @param updated_by - UID des letzten Bearbeiters
 */
export interface UnitConversionProductRow {
  [key: string]: unknown;
  id: string;
  firebase_uid: string | null;
  from_unit: string;
  to_unit: string;
  numerator: number;
  denominator: number;
  product_id: string;
  created_at: string;
  created_by: string | null;
  updated_at: string;
  updated_by: string | null;
}

/**
 * Erweiterte Zeile mit JOIN-Daten von products.
 */
interface UnitConversionProductRowWithProduct
  extends UnitConversionProductRow {
  products: {name: string} | null;
}

/* =====================================================================
// Domain-Modell (camelCase, wird in der App verwendet)
// ===================================================================== */
/**
 * Domain-Modell für produktspezifische Einheitenumrechnungen.
 *
 * @param uid - Eindeutige ID der Umrechnung (entspricht DB-Spalte id)
 * @param fromUnit - Quell-Einheit (key)
 * @param toUnit - Ziel-Einheit (key)
 * @param numerator - Zähler des Umrechnungsfaktors
 * @param denominator - Nenner des Umrechnungsfaktors
 * @param productUid - ID des zugehörigen Produkts
 * @param productName - Name des zugehörigen Produkts
 */
export interface UnitConversionProductDomain {
  uid: string;
  fromUnit: string;
  toUnit: string;
  numerator: number;
  denominator: number;
  productUid: string;
  productName: string;
}

/* =====================================================================
// UnitConversionProductRepository
// ===================================================================== */
export class UnitConversionProductRepository extends BaseRepository<
  UnitConversionProductDomain,
  UnitConversionProductRow
> {
  tableName = "unit_conversion_products";

  constructor(client?: SupabaseClient) {
    super(client);
  }

  /* =====================================================================
  // Domain → DB-Zeile Mapping
  // ===================================================================== */
  /**
   * Konvertiert ein UnitConversionProductDomain-Objekt in eine Postgres-Zeile.
   *
   * @param domain - Das Domain-Objekt (camelCase)
   * @returns Partielle DB-Zeile (snake_case)
   */
  toRow(
    domain: UnitConversionProductDomain
  ): Partial<UnitConversionProductRow> {
    return {
      from_unit: domain.fromUnit,
      to_unit: domain.toUnit,
      numerator: domain.numerator,
      denominator: domain.denominator,
      product_id: domain.productUid,
    };
  }

  /* =====================================================================
  // DB-Zeile → Domain Mapping
  // ===================================================================== */
  /**
   * Konvertiert eine Postgres-Zeile in ein UnitConversionProductDomain-Objekt.
   * Berücksichtigt den optionalen products-JOIN für den Produktnamen.
   *
   * @param row - Die DB-Zeile (snake_case), optional mit products-JOIN
   * @returns Domain-Objekt (camelCase)
   */
  toDomain(row: UnitConversionProductRow): UnitConversionProductDomain {
    const rowWithProduct = row as UnitConversionProductRowWithProduct;
    return {
      uid: row.id,
      fromUnit: row.from_unit,
      toUnit: row.to_unit,
      numerator: row.numerator,
      denominator: row.denominator,
      productUid: row.product_id,
      productName: rowWithProduct.products?.name ?? "",
    };
  }

  /* =====================================================================
  // Cache-Konfiguration
  // ===================================================================== */
  /**
   * Gibt die Cache-Konfiguration zurück.
   * Umrechnungen ändern sich selten — Caching aktiviert (24 Stunden).
   */
  getCacheConfig(): StorageObjectProperty {
    return STORAGE_OBJECT_PROPERTY.UNIT_CONVERSION;
  }

  /* =====================================================================
  // Convenience-Methoden
  // ===================================================================== */
  /**
   * Lädt alle produktspezifischen Einheitenumrechnungen mit Produktnamen.
   * Verwendet Custom-Query mit products-JOIN.
   *
   * @returns Array aller Umrechnungen mit Produktnamen
   */
  async getAllConversions(): Promise<UnitConversionProductDomain[]> {
    const {data, error} = await this.client
      .from(this.tableName)
      .select("*, products(name)")
      .order("from_unit", {ascending: true});

    if (error) throw error;

    return (data as unknown as UnitConversionProductRow[]).map((row) =>
      this.toDomain(row)
    );
  }

  /**
   * Speichert alle Umrechnungen per Upsert und löscht entfernte Einträge.
   *
   * @param conversions - Array der zu speichernden Umrechnungen
   * @param _authUser - Der angemeldete Benutzer (für Audit-Zwecke, wird von DB-Triggern gesetzt)
   */
  async saveAllConversions(
    conversions: UnitConversionProductDomain[],
    _authUser: AuthUser
  ): Promise<void> {
    // Bestehende IDs laden für Diff-Berechnung
    const existing = await this.getAllConversions();
    const existingIds = new Set(existing.map((c) => c.uid));
    const newIds = new Set(conversions.map((c) => c.uid));

    // Gelöschte Einträge in einem Batch entfernen
    const idsToDelete = [...existingIds].filter((id) => !newIds.has(id));
    await this.batchRemove(idsToDelete);

    // Neue/geänderte Einträge in einem Batch upserten
    await this.batchUpsert(conversions, (c) => c.uid);
  }

  /**
   * Löscht eine einzelne Umrechnung.
   *
   * @param uid - Die ID der zu löschenden Umrechnung
   */
  async deleteConversion(uid: string): Promise<void> {
    return this.remove(uid);
  }

  /**
   * Fügt eine einzelne produktspezifische Umrechnung ein oder aktualisiert sie (Upsert).
   *
   * @param conversion - Das Domain-Objekt der Umrechnung
   * @param authUser - Angemeldeter Benutzer (Audit)
   * @returns Das gespeicherte Domain-Objekt
   */
  async upsertConversion(
    conversion: UnitConversionProductDomain,
    authUser: AuthUser
  ): Promise<UnitConversionProductDomain> {
    return this.upsert({id: conversion.uid, value: conversion, authUser});
  }
}
