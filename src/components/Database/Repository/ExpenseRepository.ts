/**
 * ExpenseRepository — Repository für Ausgaben .
 *
 * Greift auf die Tabelle `event_expenses` zu.
 *
 * @example
 * const expenses = await repo.getExpensesForEvent(eventId);
 *
 */
import {SupabaseClient} from "@supabase/supabase-js";
import {
  ExpenseDomain,
  ExpenseRow,
} from "../../Event/ExpenseTracking/expense.types";
import {StorageObjectProperty} from "../../Shared/sessionStorageHandler.class";
import {BaseRepository} from "./BaseRepository";
import {STORAGE_OBJECT_PROPERTY} from "../../Shared/sessionStorageHandler.class";
import {AuthUser} from "../../Session/authUser.class";
import {formatLocalDate, parseLocalDate} from "../../../utils/dateUtils";
/* =====================================================================
// ExpenseRepository
// ===================================================================== */

/**
 * Repository für Ausgaben eines Events.
 *
 * Verwaltet `event_expenses`.
 */
export class ExpenseRepository extends BaseRepository<
  ExpenseDomain,
  ExpenseRow
> {
  tableName = "event_expenses";

  /**
   * @param client - Optionaler Supabase-Client (für Tests); Standard ist der globale Client.
   */
  constructor(client?: SupabaseClient) {
    super(client);
  }
  /**
   * Ausgaben werden nicht gecacht (Multi-User-Daten eines Events).
   *
   * @returns Cache-Konfiguration mit `excludeFromCaching`.
   */
  getCacheConfig(): StorageObjectProperty {
    return STORAGE_OBJECT_PROPERTY.EVENT_EXPENSES;
  }

  /**
   * Konvertiert ein ExpenseDomain-Objekt in eine Postgres-Zeile. Das Datum
   * wird über `formatLocalDate` geschrieben, weil `expense_date` eine
   * `date`-Spalte ist (`toISOString()` würde in CET/CEST den Tag verschieben).
   *
   * @param domain - Das Domain-Objekt (camelCase)
   * @returns Partielle DB-Zeile (snake_case)
   */
  toRow(domain: ExpenseDomain): Partial<ExpenseRow> {
    return {
      event_id: domain.eventId,
      budget_id: domain.budgetId,
      expense_date: formatLocalDate(domain.expenseDate),
      amount_in_cents: domain.amountInCents,
      currency: domain.currency,
      label: domain.label,
      comment: domain.comment,
      payee_type: domain.payeeType,
      payee_user_id: domain.payeeUserId,
      payee_name: domain.payeeName,
      attachment_path: domain.attachmentPath,
      attachment_original_filename: domain.attachmentOriginalFilename,
    };
  }

  /**
   * Konvertiert eine Postgres-Zeile in ein ExpenseDomain-Objekt. Das Datum
   * wird über `parseLocalDate` als lokale Mitternacht gelesen.
   *
   * @param row - Die DB-Zeile (snake_case)
   * @returns Domain-Objekt (camelCase)
   */
  toDomain(row: ExpenseRow): ExpenseDomain {
    return {
      id: row.id,
      eventId: row.event_id,
      budgetId: row.budget_id,
      expenseDate: parseLocalDate(row.expense_date),
      amountInCents: row.amount_in_cents,
      currency: row.currency,
      label: row.label,
      comment: row.comment,
      payeeType: row.payee_type,
      payeeUserId: row.payee_user_id,
      payeeName: row.payee_name,
      attachmentPath: row.attachment_path,
      attachmentOriginalFilename: row.attachment_original_filename,
    };
  }
  /* =====================================================================
  // Leseoperationen 
  // ===================================================================== */
  /** Alle Ausgaben eines Anlasses, sortiert nach Datum  */
  async getExpensesForEvent(eventId: string): Promise<ExpenseDomain[]> {
    return this.findMany({
      filters: [{field: "event_id", operator: "eq", value: eventId}],
      orderBy: {field: "expense_date", direction: "asc"},
    });
  }

  /* =====================================================================
  // Schreiboperationen 
  // ===================================================================== */
  /**
   * Legt eine neue Ausgabe an.
   *
   * @param expense - Die anzulegende Ausgabe (`id` bleibt leer, die DB vergibt sie).
   * @param authUser - Der angemeldete Benutzer.
   * @returns Vergebene ID und die gespeicherte Ausgabe.
   */
  async createExpense(
    expense: ExpenseDomain,
    authUser: AuthUser,
  ): Promise<{id: string; value: ExpenseDomain}> {
    return this.insert({value: expense, authUser});
  }
  /**
   * Speichert Änderungen an einer bestehenden Ausgabe.
   *
   * @param expense - Die geänderte Ausgabe (identifiziert über `expense.id`).
   * @param authUser - Der angemeldete Benutzer.
   * @returns Die gespeicherte Ausgabe.
   */
  async updateExpense(
    expense: ExpenseDomain,
    authUser: AuthUser,
  ): Promise<ExpenseDomain> {
    return this.update({id: expense.id, value: expense, authUser});
  }
  /**
   * Löscht eine Ausgabe.
   *
   * @param id - ID der Ausgabe.
   */
  async deleteExpense(id: string): Promise<void> {
    return this.remove(id);
  }
}
