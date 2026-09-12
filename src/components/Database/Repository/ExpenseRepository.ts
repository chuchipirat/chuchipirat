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

  constructor(client?: SupabaseClient) {
    super(client);
  }
  getCacheConfig(): StorageObjectProperty {
    return STORAGE_OBJECT_PROPERTY.EVENT_EXPENSES;
  }

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
  async createExpense(
    expense: ExpenseDomain,
    authUser: AuthUser,
  ): Promise<{id: string; value: ExpenseDomain}> {
    return this.insert({value: expense, authUser});
  }
  async updateExpense(
    expense: ExpenseDomain,
    authUser: AuthUser,
  ): Promise<ExpenseDomain> {
    return this.update({id: expense.id, value: expense, authUser});
  }
  async deleteExpense(id: string): Promise<void> {
    return this.remove(id);
  }
}
