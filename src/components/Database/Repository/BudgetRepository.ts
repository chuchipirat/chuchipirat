/**
 * BudgetRepository — Repository für Budgets .
 *
 * Greift auf die Tabelle `event_budgets` zu.
 *
 * @example
 * const budgets = await repo.getBudgetsForEvent(eventId);
 *
 */

import {SupabaseClient} from "@supabase/supabase-js";
import {
  BudgetDomain,
  BudgetRow,
} from "../../Event/ExpenseTracking/budget.types";
import {StorageObjectProperty} from "../../Shared/sessionStorageHandler.class";
import {BaseRepository} from "./BaseRepository";
import {STORAGE_OBJECT_PROPERTY} from "../../Shared/sessionStorageHandler.class";
import {AuthUser} from "../../Session/authUser.class";

/* =====================================================================
// BudgetRepository
// ===================================================================== */

/**
 * Repository für Budgets eines Events.
 *
 * Verwaltet `event_budgets`.
 */
export class BudgetRepository extends BaseRepository<BudgetDomain, BudgetRow> {
  tableName = "event_budgets";

  constructor(client?: SupabaseClient) {
    super(client);
  }

  getCacheConfig(): StorageObjectProperty {
    return STORAGE_OBJECT_PROPERTY.EVENT_BUDGETS;
  }
  /* =====================================================================
  // Domain → DB-Zeile Mapping
  // ===================================================================== */
  /**
   * Konvertiert ein BudgetDomain-Objekt in eine Postgres-Zeile.
   *
   * @param domain - Das Domain-Objekt (camelCase)
   * @returns Partielle DB-Zeile (snake_case)
   */
  toRow(domain: BudgetDomain): Partial<BudgetRow> {
    return {
      event_id: domain.eventId,
      name: domain.name,
      budget_type: domain.budgetType,
      amount_in_cents: domain.amountInCents,
      currency: domain.currency,
    };
  }
  toDomain(row: BudgetRow): BudgetDomain {
    return {
      id: row.id,
      eventId: row.event_id,
      name: row.name,
      budgetType: row.budget_type,
      amountInCents: row.amount_in_cents,
      currency: row.currency,
    };
  }
  /* =====================================================================
  // Leseoperationen 
  // ===================================================================== */
  /** Alle Budgets eines Anlasses, sortiert nach Name  */
  async getBudgetsForEvent(eventId: string): Promise<BudgetDomain[]> {
    return this.findMany({
      filters: [{field: "event_id", operator: "eq", value: eventId}],
      orderBy: {field: "name", direction: "asc"},
    });
  }

  async createBudget(
    budget: BudgetDomain,
    authUser: AuthUser,
  ): Promise<{id: string; value: BudgetDomain}> {
    return this.insert({value: budget, authUser});
  }
  async updateBudget(
    budget: BudgetDomain,
    authUser: AuthUser,
  ): Promise<BudgetDomain> {
    return this.update({id: budget.id, value: budget, authUser});
  }
  async deleteBudget(id: string): Promise<void> {
    return this.remove(id);
  }
}
