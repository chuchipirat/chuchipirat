/* =====================================================================
// BudgetType-Enum (entspricht public.budget_type in Postgres)
// ===================================================================== */

/**
 * BudgetType — String-Werte entsprechen dem PostgreSQL-ENUM.
 */
export enum BudgetType {
  FIXED_AMOUNT = "fixed_amount",
  PER_PERSON_PER_DAY = "per_person_per_day",
}
/* =====================================================================
// Domain-Modelle (camelCase, werden in der App verwendet)
// ===================================================================== */

/**
 * Domain-Modell eines Budgets (camelCase).
 * *
 * @param id - Eindeutige ID des Budgets.
 * @param eventId - Event-ID des Budgets.
 * @param name - Name des Budgets.
 * @param budgetType - Typ des Budgets.
 * @param amountInCents - Betrag in Rappen.
 * @param currency - Währung (Standard: CHF).
 */

export type BudgetDomain = {
  id: string;
  eventId: string;
  name: string;
  budgetType: BudgetType;
  amountInCents: number | null;
  currency: string;
};
/* =====================================================================
// DB-Zeilentyp (snake_case, entspricht Postgres-Spalten)
// ===================================================================== */

/**
 * Datenbank-Zeilentyp für die event_budgets.
 */
export type BudgetRow = {
  [key: string]: unknown;
  id: string;
  event_id: string;
  name: string;
  budget_type: BudgetType;
  amount_in_cents: number | null;
  currency: string;
};
