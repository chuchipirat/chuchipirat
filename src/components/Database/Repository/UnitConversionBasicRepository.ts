/**
 * UnitConversionBasicRepository — Repository für Standard-Einheitenumrechnungen.
 *
 * Greift auf die Tabelle `unit_conversion_basic` zu und ersetzt die bisherigen
 * Firebase-Methoden in unitConversion.class.ts.
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
 * Datenbank-Zeilentyp für die unit_conversion_basic-Tabelle.
 *
 * @param id - Primärschlüssel (UUID als TEXT)
 * @param firebase_uid - Alte Firebase-UID für Migrationszuordnung
 * @param from_unit - Quell-Einheit (FK auf units.key)
 * @param to_unit - Ziel-Einheit (FK auf units.key)
 * @param numerator - Zähler des Umrechnungsfaktors
 * @param denominator - Nenner des Umrechnungsfaktors
 * @param created_at - Erstellungszeitpunkt
 * @param created_by - UID des Erstellers
 * @param updated_at - Zeitpunkt der letzten Änderung
 * @param updated_by - UID des letzten Bearbeiters
 */
export interface UnitConversionBasicRow {
  [key: string]: unknown;
  id: string;
  firebase_uid: string | null;
  from_unit: string;
  to_unit: string;
  numerator: number;
  denominator: number;
  created_at: string;
  created_by: string | null;
  updated_at: string;
  updated_by: string | null;
}

/* =====================================================================
// Domain-Modell (camelCase, wird in der App verwendet)
// ===================================================================== */
/**
 * Domain-Modell für Standard-Einheitenumrechnungen.
 *
 * @param uid - Eindeutige ID der Umrechnung (entspricht DB-Spalte id)
 * @param fromUnit - Quell-Einheit (key)
 * @param toUnit - Ziel-Einheit (key)
 * @param numerator - Zähler des Umrechnungsfaktors
 * @param denominator - Nenner des Umrechnungsfaktors
 */
export interface UnitConversionBasicDomain {
  uid: string;
  fromUnit: string;
  toUnit: string;
  numerator: number;
  denominator: number;
}

/* =====================================================================
// UnitConversionBasicRepository
// ===================================================================== */
export class UnitConversionBasicRepository extends BaseRepository<
  UnitConversionBasicDomain,
  UnitConversionBasicRow
> {
  tableName = "unit_conversion_basic";

  constructor(client?: SupabaseClient) {
    super(client);
  }

  /* =====================================================================
  // Domain → DB-Zeile Mapping
  // ===================================================================== */
  /**
   * Konvertiert ein UnitConversionBasicDomain-Objekt in eine Postgres-Zeile.
   *
   * @param domain - Das Domain-Objekt (camelCase)
   * @returns Partielle DB-Zeile (snake_case)
   */
  toRow(domain: UnitConversionBasicDomain): Partial<UnitConversionBasicRow> {
    return {
      from_unit: domain.fromUnit,
      to_unit: domain.toUnit,
      numerator: domain.numerator,
      denominator: domain.denominator,
    };
  }

  /* =====================================================================
  // DB-Zeile → Domain Mapping
  // ===================================================================== */
  /**
   * Konvertiert eine Postgres-Zeile in ein UnitConversionBasicDomain-Objekt.
   *
   * @param row - Die DB-Zeile (snake_case)
   * @returns Domain-Objekt (camelCase)
   */
  toDomain(row: UnitConversionBasicRow): UnitConversionBasicDomain {
    return {
      uid: row.id,
      fromUnit: row.from_unit,
      toUnit: row.to_unit,
      numerator: row.numerator,
      denominator: row.denominator,
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
   * Lädt alle Standard-Einheitenumrechnungen.
   *
   * @returns Array aller Umrechnungen
   */
  async getAllConversions(): Promise<UnitConversionBasicDomain[]> {
    return this.findMany({
      orderBy: {field: "from_unit", direction: "asc"},
    });
  }

  /**
   * Speichert alle Umrechnungen per Upsert und löscht entfernte Einträge.
   * Vergleicht die übergebene Liste mit dem aktuellen DB-Stand und entfernt
   * Einträge, die nicht mehr in der Liste enthalten sind.
   *
   * @param conversions - Array der zu speichernden Umrechnungen
   * @param _authUser - Der angemeldete Benutzer (für Audit-Zwecke, wird von DB-Triggern gesetzt)
   */
  async saveAllConversions(
    conversions: UnitConversionBasicDomain[],
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
   * Fügt eine einzelne Umrechnung ein oder aktualisiert sie (Upsert).
   *
   * @param conversion - Das Domain-Objekt der Umrechnung
   * @param authUser - Angemeldeter Benutzer (Audit)
   * @returns Das gespeicherte Domain-Objekt
   */
  async upsertConversion(
    conversion: UnitConversionBasicDomain,
    authUser: AuthUser
  ): Promise<UnitConversionBasicDomain> {
    return this.upsert({id: conversion.uid, value: conversion, authUser});
  }
}
