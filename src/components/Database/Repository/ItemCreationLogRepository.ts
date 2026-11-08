import {SupabaseClient} from "@supabase/supabase-js";
import {
  ItemCreationLogDomain,
  ItemCreationLogRow,
} from "../../Product/CreationLog/creationLog.types";
import {BaseRepository} from "./BaseRepository";
import {
  STORAGE_OBJECT_PROPERTY,
  StorageObjectProperty,
} from "../../Shared/sessionStorageHandler.class";

/**
 * Repository für das Anlegen-Protokoll (`item_creation_logs`).
 *
 * Kann nur einfügen. Nur Admins dürfen die Tabelle lesen, darum liest das
 * Repository die eingefügte Zeile nie zurück und cacht nichts.
 *
 * @example
 * await Database.itemCreationLogs.logCreation(entry);
 */
export class ItemCreationLogRepository extends BaseRepository<
  ItemCreationLogDomain,
  ItemCreationLogRow
> {
  tableName = "item_creation_logs";

  constructor(client?: SupabaseClient) {
    super(client);
  }

  /**
   * Wandelt einen Vorgang in eine Tabellenzeile um.
   *
   * Lässt `id`, `created_at` und `created_by` bewusst weg: Die Datenbank setzt
   * sie, und die INSERT-Policy prüft `created_by` gegen die angemeldete Person.
   *
   * @param domain Vorgang (camelCase).
   * @returns Zeile ohne id und Audit-Spalten (snake_case).
   */
  toRow(domain: ItemCreationLogDomain): Partial<ItemCreationLogRow> {
    return {
      item_type: domain.itemType,
      origin: domain.origin,
      entered_name: domain.enteredName,
      final_name: domain.finalName,
      decision: domain.decision,
      hints: domain.hints,
      rules_version: domain.rulesVersion,
      result_product_id: domain.resultProductId,
      result_material_id: domain.resultMaterialId,
      result_name: domain.resultName,
    };
  }

  /**
   * Wandelt eine Tabellenzeile in einen Vorgang um; id und Audit-Spalten
   * fallen weg.
   *
   * @param row Zeile aus `item_creation_logs`.
   * @returns Vorgang (camelCase).
   */
  toDomain(row: ItemCreationLogRow): ItemCreationLogDomain {
    return {
      itemType: row.item_type,
      origin: row.origin,
      enteredName: row.entered_name,
      finalName: row.final_name,
      decision: row.decision,
      hints: row.hints,
      rulesVersion: row.rules_version,
      resultProductId: row.result_product_id,
      resultMaterialId: row.result_material_id,
      resultName: row.result_name,
    };
  }

  /**
   * Protokollzeilen werden nie gecacht.
   *
   * @returns `STORAGE_OBJECT_PROPERTY.NONE`.
   */
  getCacheConfig(): StorageObjectProperty {
    return STORAGE_OBJECT_PROPERTY.NONE;
  }

  /**
   * Fügt einen Anlegen-Vorgang ins Protokoll ein.
   *
   * Schreibt ohne `.select()`: Ein Zurücklesen (RETURNING) würde für alle
   * ausser Admins an der SELECT-Policy scheitern.
   *
   * @param entry Abgeschlossener Vorgang.
   * @returns Nichts.
   * @throws {PostgrestError} Wenn die Datenbank das Einfügen ablehnt (z.B. CHECK oder RLS).
   * @example
   * await repo.logCreation({...entry, decision: CreationDecision.CANCELLED});
   */
  async logCreation(entry: ItemCreationLogDomain): Promise<void> {
    const row = this.toRow(entry);

    const {error} = await this.client.from(this.tableName).insert(row);

    if (error) throw error;
  }
}
