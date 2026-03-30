/**
 * MaterialRepository — Repository für Materialien (Stammdaten).
 *
 * Greift auf die Tabelle `materials` zu und ersetzt die bisherigen
 * Firebase-Methoden in material.class.ts.
 *
 * @example
 * const materials = await repo.getAllMaterials();
 */
import {SupabaseClient} from "@supabase/supabase-js";
import {BaseRepository} from "./BaseRepository";
import {
  STORAGE_OBJECT_PROPERTY,
  StorageObjectProperty,
} from "../../Firebase/Db/sessionStorageHandler.class";
import {AuthUser} from "../../Firebase/Authentication/authUser.class";
import {Material, MaterialType} from "../../Material/material.types";

/* =====================================================================
// Enum-Mapping: DB-String ↔ numerischer MaterialType
// =====================================================================
// Die DB speichert den Materialtyp als Postgres-ENUM ('none', 'consumable',
// 'usage'). Die App verwendet die numerischen Werte aus MaterialType
// (0/1/2). Das Mapping findet ausschliesslich im Repository statt,
// damit weder die UI noch material.class.ts geändert werden müssen.
// ===================================================================== */

/** Zuordnung DB-ENUM-String → numerischer MaterialType-Wert. */
const MATERIAL_TYPE_FROM_DB: Record<string, number> = {
  none: 0,
  consumable: 1,
  usage: 2,
};

/** Zuordnung numerischer MaterialType-Wert → DB-ENUM-String. */
const MATERIAL_TYPE_TO_DB: Record<number, string> = {
  0: "none",
  1: "consumable",
  2: "usage",
};

/* =====================================================================
// DB-Zeilenstruktur (snake_case, entspricht den Postgres-Spalten)
// ===================================================================== */
/**
 * Datenbank-Zeilentyp für die materials-Tabelle.
 *
 * @param id - Primärschlüssel (UUID als TEXT)
 * @param firebase_uid - Alte Firebase-UID für Migrationszuordnung
 * @param name - Name des Materials
 * @param type - Materialtyp als Postgres-ENUM ('none' | 'consumable' | 'usage')
 * @param usable - Ob das Material aktiv ist
 * @param created_at - Erstellungszeitpunkt
 * @param created_by - UID des Erstellers
 * @param updated_at - Zeitpunkt der letzten Änderung
 * @param updated_by - UID des letzten Bearbeiters
 */
export interface MaterialRow {
  [key: string]: unknown;
  id: string;
  firebase_uid: string | null;
  name: string;
  type: string;
  usable: boolean;
  qa_checked: boolean;
  qa_checked_at: string | null;
  created_at: string;
  created_by: string | null;
  updated_at: string;
  updated_by: string | null;
}

/* =====================================================================
// Domain-Modell (camelCase, wird in der App verwendet)
// ===================================================================== */
/**
 * Alias für das Material-Domain-Modell aus material.types.ts.
 * Wird für Abwärtskompatibilität beibehalten — neue Imports
 * sollten direkt `Material` aus material.types.ts verwenden.
 */
export type MaterialDomain = Material;

/* =====================================================================
// MaterialRepository
// ===================================================================== */
export class MaterialRepository extends BaseRepository<
  MaterialDomain,
  MaterialRow
> {
  tableName = "materials";

  constructor(client?: SupabaseClient) {
    super(client);
  }

  /* =====================================================================
  // Domain → DB-Zeile Mapping
  // ===================================================================== */
  /**
   * Konvertiert ein MaterialDomain-Objekt in eine Postgres-Zeile.
   *
   * @param domain - Das Domain-Objekt (camelCase)
   * @returns Partielle DB-Zeile (snake_case)
   */
  toRow(domain: MaterialDomain): Partial<MaterialRow> {
    return {
      name: domain.name,
      // Numerischen Typ in DB-ENUM-String übersetzen (z.B. 1 → 'consumable')
      type: MATERIAL_TYPE_TO_DB[domain.type] ?? "none",
      usable: domain.usable,
      qa_checked: domain.qaChecked,
      qa_checked_at: domain.qaCheckedAt,
    };
  }

  /* =====================================================================
  // DB-Zeile → Domain Mapping
  // ===================================================================== */
  /**
   * Konvertiert eine Postgres-Zeile in ein MaterialDomain-Objekt.
   *
   * @param row - Die DB-Zeile (snake_case)
   * @returns Domain-Objekt (camelCase)
   */
  toDomain(row: MaterialRow): MaterialDomain {
    return {
      uid: row.id,
      name: row.name,
      // DB-ENUM-String in numerischen Typ übersetzen (z.B. 'consumable' → 1)
      type: (MATERIAL_TYPE_FROM_DB[row.type] ?? 0) as MaterialType,
      usable: row.usable,
      qaChecked: row.qa_checked,
      qaCheckedAt: row.qa_checked_at,
    };
  }

  /* =====================================================================
  // Cache-Konfiguration
  // ===================================================================== */
  /**
   * Gibt die Cache-Konfiguration zurück.
   * Materialien werden 60 Minuten gecacht.
   */
  getCacheConfig(): StorageObjectProperty {
    return STORAGE_OBJECT_PROPERTY.MATERIALS;
  }

  /* =====================================================================
  // Convenience-Methoden
  // ===================================================================== */
  /**
   * Lädt alle Materialien, optional nur die aktiven.
   *
   * @param onlyUsable - Wenn true, werden nur aktive Materialien geladen
   * @returns Array der Materialien, sortiert nach Name aufsteigend
   */
  async getAllMaterials(onlyUsable = false): Promise<MaterialDomain[]> {
    const filters = onlyUsable
      ? [{field: "usable", operator: "eq" as const, value: true}]
      : [];

    return this.findMany({
      filters,
      orderBy: {field: "name", direction: "asc"},
    });
  }

  /**
   * Legt ein neues Material in der Datenbank an.
   * Die uid wird von Postgres generiert und im zurückgegebenen Objekt gesetzt.
   *
   * @param material - Das Domain-Objekt ohne uid (wird von Postgres vergeben)
   * @param authUser - Der angemeldete Benutzer (für Audit-Zwecke)
   * @returns Das eingefügte Domain-Objekt mit generierter uid
   */
  async insertMaterial(
    material: Omit<MaterialDomain, "uid">,
    authUser: AuthUser,
  ): Promise<MaterialDomain> {
    const {value} = await this.insert({
      value: {...material, uid: ""} as MaterialDomain,
      authUser,
    });
    return value;
  }

  /**
   * Aktualisiert ein einzelnes Material in der Datenbank.
   *
   * @param material - Das aktualisierte Domain-Objekt
   * @param authUser - Der angemeldete Benutzer (für Audit-Zwecke)
   * @returns Das aktualisierte Domain-Objekt nach DB-Roundtrip
   */
  async updateMaterial(
    material: MaterialDomain,
    authUser: AuthUser
  ): Promise<MaterialDomain> {
    return this.update({id: material.uid, value: material, authUser});
  }

  /**
   * Löscht ein Material aus der Datenbank.
   *
   * @param materialId - UID des zu löschenden Materials
   */
  async deleteMaterial(materialId: string): Promise<void> {
    await this.remove(materialId);
  }

  /**
   * Speichert alle Materialien per Upsert.
   *
   * @param materials - Array der zu speichernden Materialien
   * @param _authUser - Der angemeldete Benutzer (für Audit-Zwecke, wird von DB-Triggern gesetzt)
   */
  async saveAllMaterials(
    materials: MaterialDomain[],
    _authUser: AuthUser
  ): Promise<void> {
    await this.batchUpsert(materials, (m) => m.uid);
  }
}
