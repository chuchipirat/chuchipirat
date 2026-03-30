/**
 * ProductSynonymRepository — Repository für manuelle Synonym-Paare.
 *
 * Verwaltet die Tabelle `product_synonyms`, die regionale Varianten
 * (z.B. Rüebli/Karotten) für die Duplikaterkennung speichert.
 *
 * @example
 * const synonyms = await repo.getAllSynonyms();
 */
import {SupabaseClient} from "@supabase/supabase-js";
import {BaseRepository} from "./BaseRepository";
import {
  STORAGE_OBJECT_PROPERTY,
  StorageObjectProperty,
} from "../../Firebase/Db/sessionStorageHandler.class";
import {AuthUser} from "../../Firebase/Authentication/authUser.class";

/* =====================================================================
// DB-Zeilenstruktur (snake_case)
// ===================================================================== */
/**
 * Datenbank-Zeilentyp für die product_synonyms-Tabelle.
 *
 * @param id - Primärschlüssel (UUID als TEXT)
 * @param name_a - Erster Synonymname
 * @param name_b - Zweiter Synonymname
 * @param created_at - Erstellungszeitpunkt
 * @param created_by - UID des Erstellers
 * @param updated_at - Zeitpunkt der letzten Änderung
 * @param updated_by - UID des letzten Bearbeiters
 */
export interface ProductSynonymRow {
  [key: string]: unknown;
  id: string;
  name_a: string;
  name_b: string;
  created_at: string;
  created_by: string | null;
  updated_at: string;
  updated_by: string | null;
}

/* =====================================================================
// Domain-Modell (camelCase)
// ===================================================================== */
/**
 * Domain-Modell für ein Synonym-Paar.
 *
 * @param uid - Eindeutige ID des Synonym-Paars
 * @param nameA - Erster Synonymname (z.B. "Rüebli")
 * @param nameB - Zweiter Synonymname (z.B. "Karotten")
 */
export interface ProductSynonymDomain {
  uid: string;
  nameA: string;
  nameB: string;
}

/* =====================================================================
// ProductSynonymRepository
// ===================================================================== */
export class ProductSynonymRepository extends BaseRepository<
  ProductSynonymDomain,
  ProductSynonymRow
> {
  tableName = "product_synonyms";

  constructor(client?: SupabaseClient) {
    super(client);
  }

  /**
   * Konvertiert ein Domain-Objekt in eine Postgres-Zeile.
   *
   * @param domain - Das Domain-Objekt (camelCase)
   * @returns Partielle DB-Zeile (snake_case)
   */
  toRow(domain: ProductSynonymDomain): Partial<ProductSynonymRow> {
    return {
      name_a: domain.nameA,
      name_b: domain.nameB,
    };
  }

  /**
   * Konvertiert eine Postgres-Zeile in ein Domain-Objekt.
   *
   * @param row - Die DB-Zeile (snake_case)
   * @returns Domain-Objekt (camelCase)
   */
  toDomain(row: ProductSynonymRow): ProductSynonymDomain {
    return {
      uid: row.id,
      nameA: row.name_a,
      nameB: row.name_b,
    };
  }

  /**
   * Gibt die Cache-Konfiguration zurück.
   * Synonyme werden nicht gecacht (selten und klein).
   */
  getCacheConfig(): StorageObjectProperty {
    return STORAGE_OBJECT_PROPERTY.NONE;
  }

  /**
   * Lädt alle Synonym-Paare, alphabetisch sortiert nach name_a.
   *
   * @returns Array aller Synonym-Paare
   */
  async getAllSynonyms(): Promise<ProductSynonymDomain[]> {
    const result = await this.findMany({
      orderBy: {field: "name_a", direction: "asc"},
    });
    return result;
  }

  /**
   * Erstellt ein neues Synonym-Paar.
   *
   * @param synonym - Das Domain-Objekt ohne uid
   * @param authUser - Der angemeldete Benutzer
   * @returns Das erstellte Domain-Objekt mit generierter uid
   */
  async insertSynonym(
    synonym: Omit<ProductSynonymDomain, "uid">,
    authUser: AuthUser,
  ): Promise<ProductSynonymDomain> {
    const {value} = await this.insert({
      value: {...synonym, uid: ""} as ProductSynonymDomain,
      authUser,
    });
    return value;
  }

  /**
   * Löscht ein Synonym-Paar.
   *
   * @param synonymId - ID des zu löschenden Synonym-Paars
   */
  async deleteSynonym(synonymId: string): Promise<void> {
    await this.remove(synonymId);
  }
}
