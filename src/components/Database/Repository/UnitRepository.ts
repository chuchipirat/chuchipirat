/**
 * UnitRepository — Repository für Einheiten (Stammdaten).
 *
 * Greift auf die Tabelle `units` zu und ersetzt die bisherigen
 * Firebase-Methoden in unit.class.ts.
 *
 * @example
 * const units = await repo.getAllUnits();
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
 * Datenbank-Zeilentyp für die units-Tabelle.
 *
 * Die Tabelle verwendet `key` als natürlichen Primärschlüssel
 * (z.B. "kg", "l", "Stk") — es gibt keine synthetische UUID.
 *
 * @param key - Primärschlüssel / Abkürzung der Einheit
 * @param firebase_uid - Alte Firebase-UID für Migrationszuordnung
 * @param name - Vollständiger Name der Einheit
 * @param dimension - Dimension (VOL, MAS, DLS)
 * @param created_at - Erstellungszeitpunkt
 * @param created_by - UID des Erstellers
 * @param updated_at - Zeitpunkt der letzten Änderung
 * @param updated_by - UID des letzten Bearbeiters
 */
export interface UnitRow {
  [key: string]: unknown;
  key: string;
  firebase_uid: string | null;
  name: string;
  dimension: string;
  created_at: string;
  created_by: string | null;
  updated_at: string;
  updated_by: string | null;
}

/* =====================================================================
// Domain-Modell (camelCase, wird in der App verwendet)
// ===================================================================== */
/**
 * Domain-Modell für Einheiten.
 *
 * Einheiten verwenden `key` als natürlichen Identifier (z.B. "kg", "l").
 * Es gibt kein separates `uid`-Feld.
 *
 * @param key - Eindeutiger Schlüssel / Abkürzung (z.B. "kg")
 * @param name - Vollständiger Name
 * @param dimension - Dimension (VOL, MAS, DLS)
 */
export interface UnitDomain {
  key: string;
  name: string;
  dimension: string;
}

/* =====================================================================
// UnitRepository
// ===================================================================== */
export class UnitRepository extends BaseRepository<UnitDomain, UnitRow> {
  tableName = "units";

  /**
   * Einheiten verwenden `key` als natürlichen Primärschlüssel
   * statt einer synthetischen UUID.
   */
  protected get primaryKeyColumn(): string {
    return "key";
  }

  constructor(client?: SupabaseClient) {
    super(client);
  }

  /* =====================================================================
  // Domain → DB-Zeile Mapping
  // ===================================================================== */
  /**
   * Konvertiert ein UnitDomain-Objekt in eine Postgres-Zeile.
   *
   * @param domain - Das Domain-Objekt (camelCase)
   * @returns Partielle DB-Zeile (snake_case)
   */
  toRow(domain: UnitDomain): Partial<UnitRow> {
    return {
      key: domain.key,
      name: domain.name,
      dimension: domain.dimension,
    };
  }

  /* =====================================================================
  // DB-Zeile → Domain Mapping
  // ===================================================================== */
  /**
   * Konvertiert eine Postgres-Zeile in ein UnitDomain-Objekt.
   *
   * @param row - Die DB-Zeile (snake_case)
   * @returns Domain-Objekt (camelCase)
   */
  toDomain(row: UnitRow): UnitDomain {
    return {
      key: row.key,
      name: row.name,
      dimension: row.dimension,
    };
  }

  /* =====================================================================
  // Cache-Konfiguration
  // ===================================================================== */
  /**
   * Gibt die Cache-Konfiguration zurück.
   * Einheiten ändern sich selten — Caching aktiviert (24 Stunden).
   */
  getCacheConfig(): StorageObjectProperty {
    return STORAGE_OBJECT_PROPERTY.UNITS;
  }

  /* =====================================================================
  // Convenience-Methoden
  // ===================================================================== */
  /**
   * Lädt alle Einheiten, sortiert nach Name aufsteigend.
   *
   * @returns Array aller Einheiten
   */
  async getAllUnits(): Promise<UnitDomain[]> {
    return this.findMany({
      orderBy: {field: "name", direction: "asc"},
    });
  }

  /**
   * Erstellt eine neue Einheit.
   *
   * @param unit - Die zu erstellende Einheit (key wird als PK verwendet)
   * @param authUser - Der angemeldete Benutzer (für Audit-Zwecke)
   * @returns Objekt mit dem key als id und dem eingefügten Domain-Objekt
   */
  async createUnit(
    unit: UnitDomain,
    authUser: AuthUser
  ): Promise<{id: string; value: UnitDomain}> {
    return this.insert({value: unit, authUser});
  }

  /**
   * Speichert alle Einheiten per Upsert.
   *
   * @param units - Array der zu speichernden Einheiten
   * @param authUser - Der angemeldete Benutzer (für Audit-Zwecke)
   */
  async saveAllUnits(
    units: UnitDomain[],
    authUser: AuthUser
  ): Promise<void> {
    for (const unit of units) {
      await this.upsert({
        id: unit.key,
        value: unit,
        authUser,
      });
    }
  }

  /**
   * Aktualisiert eine bestehende Einheit (name, dimension).
   *
   * @param unit - Die zu aktualisierende Einheit
   * @param authUser - Der angemeldete Benutzer (für Audit-Zwecke)
   * @returns Das aktualisierte Domain-Objekt
   */
  async updateUnit(unit: UnitDomain, authUser: AuthUser): Promise<UnitDomain> {
    return this.update({id: unit.key, value: unit, authUser});
  }

  /**
   * Löscht eine Einheit anhand ihres Schlüssels.
   *
   * @param key - Der Schlüssel (Primärschlüssel) der zu löschenden Einheit
   * @param authUser - Der angemeldete Benutzer (für Audit-Zwecke)
   */
  async deleteUnit(key: string, authUser: AuthUser): Promise<void> {
    return this.remove(key);
  }
}
