/**
 * GlobalSettingsRepository — Repository für globale Einstellungen.
 *
 * Greift auf die Singleton-Tabelle `global_settings` zu, die genau eine Zeile
 * mit der ID "default" enthält. Ersetzt den bisherigen Firestore-Zugriff
 * auf `_configuration/globalSettings`.
 *
 * @example
 * const settings = await repo.getSettings();
 * console.log(settings?.allowSignUp); // true/false
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
 * Datenbank-Zeilentyp für die global_settings-Tabelle.
 *
 * @param id - Primärschlüssel (immer "default")
 * @param allow_sign_up - Ob die Registrierung erlaubt ist
 * @param maintenance_mode - Ob der Wartungsmodus aktiv ist
 * @param created_at - Erstellungszeitpunkt
 * @param created_by - UID des Erstellers
 * @param updated_at - Zeitpunkt der letzten Änderung
 * @param updated_by - UID des letzten Bearbeiters
 */
export interface GlobalSettingsRow {
  [key: string]: unknown;
  id: string;
  allow_sign_up: boolean;
  maintenance_mode: boolean;
  email_lookup_rate_limit: number;
  created_at: string;
  created_by: string | null;
  updated_at: string;
  updated_by: string | null;
}

/* =====================================================================
// Domain-Modell (camelCase, wird in der App verwendet)
// ===================================================================== */
/**
 * Domain-Modell für globale Einstellungen.
 *
 * @param allowSignUp - Ob die Registrierung erlaubt ist
 * @param maintenanceMode - Ob der Wartungsmodus aktiv ist
 */
export interface GlobalSettingsDomain {
  allowSignUp: boolean;
  maintenanceMode: boolean;
  /** Maximale Anzahl E-Mail-Suchen pro Benutzer pro Stunde. */
  emailLookupRateLimit: number;
}

/* =====================================================================
// GlobalSettingsRepository
// ===================================================================== */
export class GlobalSettingsRepository extends BaseRepository<
  GlobalSettingsDomain,
  GlobalSettingsRow
> {
  tableName = "global_settings";

  constructor(client?: SupabaseClient) {
    super(client);
  }

  /* =====================================================================
  // Domain → DB-Zeile Mapping
  // ===================================================================== */
  /**
   * Konvertiert ein GlobalSettingsDomain-Objekt in eine Postgres-Zeile.
   *
   * @param domain - Das Domain-Objekt (camelCase)
   * @returns Partielle DB-Zeile (snake_case)
   */
  toRow(domain: GlobalSettingsDomain): Partial<GlobalSettingsRow> {
    return {
      allow_sign_up: domain.allowSignUp,
      maintenance_mode: domain.maintenanceMode,
      email_lookup_rate_limit: domain.emailLookupRateLimit,
    };
  }

  /* =====================================================================
  // DB-Zeile → Domain Mapping
  // ===================================================================== */
  /**
   * Konvertiert eine Postgres-Zeile in ein GlobalSettingsDomain-Objekt.
   *
   * @param row - Die DB-Zeile (snake_case)
   * @returns Domain-Objekt (camelCase)
   */
  toDomain(row: GlobalSettingsRow): GlobalSettingsDomain {
    return {
      allowSignUp: row.allow_sign_up,
      maintenanceMode: row.maintenance_mode,
      emailLookupRateLimit: row.email_lookup_rate_limit,
    };
  }

  /* =====================================================================
  // Cache-Konfiguration
  // ===================================================================== */
  /**
   * Gibt die Cache-Konfiguration zurück.
   * GlobalSettings werden nicht gecacht (excludeFromCaching: true),
   * damit der Wartungsmodus sofort wirksam wird.
   */
  getCacheConfig(): StorageObjectProperty {
    return STORAGE_OBJECT_PROPERTY.GLOBAL_SETTINGS;
  }

  /* =====================================================================
  // Convenience-Methoden
  // ===================================================================== */
  /**
   * Lädt die globalen Einstellungen (Singleton-Zeile "default").
   *
   * @returns Die Einstellungen oder null, falls nicht gefunden
   */
  async getSettings(): Promise<GlobalSettingsDomain | null> {
    return this.findById("default");
  }

  /**
   * Speichert die globalen Einstellungen.
   *
   * @param settings - Die zu speichernden Einstellungen
   * @param authUser - Der angemeldete Benutzer (für Audit-Zwecke)
   * @returns Das aktualisierte Domain-Objekt
   */
  async saveSettings(
    settings: GlobalSettingsDomain,
    authUser: AuthUser
  ): Promise<GlobalSettingsDomain> {
    return this.update({id: "default", value: settings, authUser});
  }
}
