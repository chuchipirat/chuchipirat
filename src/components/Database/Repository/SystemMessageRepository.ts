/**
 * SystemMessageRepository — Repository für Systemmeldungen.
 *
 * Greift auf die Multi-Row-Tabelle `system_messages` zu, die beliebig viele
 * Meldungen enthalten kann. Ersetzt den bisherigen Singleton-Ansatz.
 *
 * @example
 * const messages = await repo.getValidMessages();
 * messages.forEach(msg => console.log(msg.title));
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
 * Datenbank-Zeilentyp für die system_messages-Tabelle.
 *
 * @param id - Primärschlüssel (UUID als TEXT)
 * @param title - Titel der Meldung
 * @param text - Inhalt der Meldung (HTML)
 * @param type - Schweregrad (success, info, warning, error)
 * @param valid_to - Gültig bis (TIMESTAMPTZ)
 * @param created_at - Erstellungszeitpunkt
 * @param created_by - UID des Erstellers
 * @param updated_at - Zeitpunkt der letzten Änderung
 * @param updated_by - UID des letzten Bearbeiters
 */
export interface SystemMessageRow {
  [key: string]: unknown;
  id: string;
  title: string;
  text: string;
  type: string;
  valid_to: string;
  created_at: string;
  created_by: string | null;
  updated_at: string;
  updated_by: string | null;
}

/* =====================================================================
// Domain-Modell (camelCase, wird in der App verwendet)
// ===================================================================== */
/**
 * Domain-Modell für Systemmeldungen.
 *
 * @param uid - Eindeutige ID der Meldung (entspricht DB-Spalte id)
 * @param title - Titel der Meldung
 * @param text - Inhalt der Meldung (HTML)
 * @param type - Schweregrad (success, info, warning, error)
 * @param validTo - Gültig bis (Date)
 */
export interface SystemMessageDomain {
  uid: string;
  title: string;
  text: string;
  type: "success" | "info" | "warning" | "error";
  validTo: Date;
}

/* =====================================================================
// SystemMessageRepository
// ===================================================================== */
export class SystemMessageRepository extends BaseRepository<
  SystemMessageDomain,
  SystemMessageRow
> {
  tableName = "system_messages";

  constructor(client?: SupabaseClient) {
    super(client);
  }

  /* =====================================================================
  // Domain → DB-Zeile Mapping
  // ===================================================================== */
  /**
   * Konvertiert ein SystemMessageDomain-Objekt in eine Postgres-Zeile.
   * Die ID wird nicht mitgesendet — sie wird von der DB generiert.
   *
   * @param domain - Das Domain-Objekt (camelCase)
   * @returns Partielle DB-Zeile (snake_case)
   */
  toRow(domain: SystemMessageDomain): Partial<SystemMessageRow> {
    return {
      title: domain.title,
      text: domain.text,
      type: domain.type,
      valid_to: domain.validTo.toISOString(),
    };
  }

  /* =====================================================================
  // DB-Zeile → Domain Mapping
  // ===================================================================== */
  /**
   * Konvertiert eine Postgres-Zeile in ein SystemMessageDomain-Objekt.
   *
   * @param row - Die DB-Zeile (snake_case)
   * @returns Domain-Objekt (camelCase)
   */
  toDomain(row: SystemMessageRow): SystemMessageDomain {
    return {
      uid: row.id,
      title: row.title,
      text: row.text,
      type: row.type as SystemMessageDomain["type"],
      validTo: new Date(row.valid_to),
    };
  }

  /* =====================================================================
  // Cache-Konfiguration
  // ===================================================================== */
  /**
   * Gibt die Cache-Konfiguration zurück.
   * Multi-Row-Tabelle — Caching ist deaktiviert, da sich die Liste häufig ändert.
   */
  getCacheConfig(): StorageObjectProperty {
    return {
      ...STORAGE_OBJECT_PROPERTY.SYSTEM_MESSAGE,
      excludeFromCaching: true,
    };
  }

  /* =====================================================================
  // Convenience-Methoden
  // ===================================================================== */
  /**
   * Lädt alle Systemmeldungen, optional inkl. abgelaufener.
   *
   * @param includeExpired - Wenn true, werden auch abgelaufene Meldungen geladen (Standard: false)
   * @returns Array von Systemmeldungen, sortiert nach valid_to aufsteigend
   */
  async getMessages(includeExpired = false): Promise<SystemMessageDomain[]> {
    const filters = includeExpired
      ? []
      : [
          {
            field: "valid_to",
            operator: "gte" as const,
            value: new Date().toISOString(),
          },
        ];

    return this.findMany({
      filters,
      orderBy: {field: "valid_to", direction: "asc"},
    });
  }

  /**
   * Lädt nur die aktuell gültigen Systemmeldungen (valid_to >= jetzt).
   *
   * @returns Array von gültigen Systemmeldungen
   */
  async getValidMessages(): Promise<SystemMessageDomain[]> {
    return this.getMessages(false);
  }

  /**
   * Erstellt eine neue Systemmeldung. Normalisiert validTo auf 23:59:59.
   *
   * @param message - Die zu erstellende Meldung (uid wird ignoriert)
   * @param authUser - Der angemeldete Benutzer (für Audit-Zwecke)
   * @returns Objekt mit generierter ID und dem eingefügten Domain-Objekt
   */
  async createMessage(
    message: SystemMessageDomain,
    authUser: AuthUser
  ): Promise<{id: string; value: SystemMessageDomain}> {
    const normalizedValidTo = new Date(message.validTo);
    normalizedValidTo.setHours(23, 59, 59, 0);

    const normalized: SystemMessageDomain = {
      ...message,
      validTo: normalizedValidTo,
    };

    return this.insert({value: normalized, authUser});
  }

  /**
   * Aktualisiert eine bestehende Systemmeldung. Normalisiert validTo auf 23:59:59.
   *
   * @param uid - Die ID der zu aktualisierenden Meldung
   * @param message - Die aktualisierten Meldungsdaten
   * @param authUser - Der angemeldete Benutzer (für Audit-Zwecke)
   * @returns Das aktualisierte Domain-Objekt
   */
  async updateMessage(
    uid: string,
    message: SystemMessageDomain,
    authUser: AuthUser
  ): Promise<SystemMessageDomain> {
    const normalizedValidTo = new Date(message.validTo);
    normalizedValidTo.setHours(23, 59, 59, 0);

    const normalized: SystemMessageDomain = {
      ...message,
      validTo: normalizedValidTo,
    };

    return this.update({id: uid, value: normalized, authUser});
  }

  /**
   * Löscht eine Systemmeldung.
   *
   * @param uid - Die ID der zu löschenden Meldung
   */
  async deleteMessage(uid: string): Promise<void> {
    return this.remove(uid);
  }
}
