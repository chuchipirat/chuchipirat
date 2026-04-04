/**
 * DepartmentRepository — Repository für Abteilungen (Stammdaten).
 *
 * Greift auf die Tabelle `departments` zu und ersetzt die bisherigen
 * Firebase-Methoden in department.class.ts.
 *
 * @example
 * const departments = await repo.getAllDepartments();
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
 * Datenbank-Zeilentyp für die departments-Tabelle.
 *
 * @param id - Primärschlüssel (UUID als TEXT)
 * @param firebase_uid - Alte Firebase-UID für Migrationszuordnung
 * @param name - Name der Abteilung
 * @param pos - Sortierposition
 * @param usable - Ob die Abteilung aktiv ist
 * @param created_at - Erstellungszeitpunkt
 * @param created_by - UID des Erstellers
 * @param updated_at - Zeitpunkt der letzten Änderung
 * @param updated_by - UID des letzten Bearbeiters
 */
export interface DepartmentRow {
  [key: string]: unknown;
  id: string;
  firebase_uid: string | null;
  name: string;
  pos: number;
  usable: boolean;
  created_at: string;
  created_by: string | null;
  updated_at: string;
  updated_by: string | null;
}

/* =====================================================================
// Domain-Modell (camelCase, wird in der App verwendet)
// ===================================================================== */
/**
 * Domain-Modell für Abteilungen.
 *
 * @param uid - Eindeutige ID der Abteilung (entspricht DB-Spalte id)
 * @param name - Name der Abteilung
 * @param pos - Sortierposition
 * @param usable - Ob die Abteilung aktiv ist
 */
export interface DepartmentDomain {
  uid: string;
  name: string;
  pos: number;
  usable: boolean;
}

/* =====================================================================
// DepartmentRepository
// ===================================================================== */
export class DepartmentRepository extends BaseRepository<
  DepartmentDomain,
  DepartmentRow
> {
  tableName = "departments";

  constructor(client?: SupabaseClient) {
    super(client);
  }

  /* =====================================================================
  // Domain → DB-Zeile Mapping
  // ===================================================================== */
  /**
   * Konvertiert ein DepartmentDomain-Objekt in eine Postgres-Zeile.
   *
   * @param domain - Das Domain-Objekt (camelCase)
   * @returns Partielle DB-Zeile (snake_case)
   */
  toRow(domain: DepartmentDomain): Partial<DepartmentRow> {
    return {
      name: domain.name,
      pos: domain.pos,
      usable: domain.usable,
    };
  }

  /* =====================================================================
  // DB-Zeile → Domain Mapping
  // ===================================================================== */
  /**
   * Konvertiert eine Postgres-Zeile in ein DepartmentDomain-Objekt.
   *
   * @param row - Die DB-Zeile (snake_case)
   * @returns Domain-Objekt (camelCase)
   */
  toDomain(row: DepartmentRow): DepartmentDomain {
    return {
      uid: row.id,
      name: row.name,
      pos: row.pos,
      usable: row.usable,
    };
  }

  /* =====================================================================
  // Cache-Konfiguration
  // ===================================================================== */
  /**
   * Gibt die Cache-Konfiguration zurück.
   * Abteilungen ändern sich selten — Caching aktiviert (24 Stunden).
   */
  getCacheConfig(): StorageObjectProperty {
    return STORAGE_OBJECT_PROPERTY.DEPARTMENTS;
  }

  /* =====================================================================
  // Convenience-Methoden
  // ===================================================================== */
  /**
   * Lädt alle Abteilungen, sortiert nach Name aufsteigend.
   *
   * @returns Array aller Abteilungen
   */
  async getAllDepartments(): Promise<DepartmentDomain[]> {
    return this.findMany({
      orderBy: {field: "name", direction: "asc"},
    });
  }

  /**
   * Erstellt eine neue Abteilung.
   *
   * @param name - Name der neuen Abteilung
   * @param pos - Sortierposition
   * @param authUser - Der angemeldete Benutzer (für Audit-Zwecke)
   * @returns Objekt mit generierter ID und dem eingefügten Domain-Objekt
   */
  async createDepartment(
    name: string,
    pos: number,
    authUser: AuthUser
  ): Promise<{id: string; value: DepartmentDomain}> {
    const department: DepartmentDomain = {
      uid: "",
      name,
      pos,
      usable: true,
    };
    return this.insert({value: department, authUser});
  }

  /**
   * Speichert alle Abteilungen per Upsert.
   *
   * @param departments - Array der zu speichernden Abteilungen
   * @param _authUser - Der angemeldete Benutzer (für Audit-Zwecke, wird von DB-Triggern gesetzt)
   */
  async saveAllDepartments(
    departments: DepartmentDomain[],
    _authUser: AuthUser
  ): Promise<void> {
    await this.batchUpsert(departments, (d) => d.uid);
  }
}
