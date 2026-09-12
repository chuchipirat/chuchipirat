import {BudgetDomain} from "./budget.types";
/* =====================================================================
// ExpenseType-Enum (entspricht public.expense_type in Postgres)
// ===================================================================== */
/**
 * ExpensePayeeType — String-Werte entsprechen dem PostgreSQL-ENUM.
 */
export enum ExpensePayeeType {
  EXISTING_USER = "existing_user",
  NEW_PERSON = "new_person",
  NO_REFUND_NEEDED = "no_refund_needed",
}
/* =====================================================================
// Domain-Modelle (camelCase, werden in der App verwendet)
// ===================================================================== */

/**
 * Domain-Modell einer Ausgabe (camelCase).
 * *
 * @param id - Eindeutige ID des Budgets.
 * @param eventId - Event-ID des Budgets.
 * @param budgetType - Typ des Budgets.
 * @param expenseDate - Datum der Ausgabe.
 * @param amountInCents - Betrag in Rappen.
 * @param currency - Währung (Standard: CHF).
 * @param label - Bezeichnung der Ausgabe.
 * @param comment - Optionaler Kommentar.
 * @param payeeType - Typ des Empfängers.
 * @param payeeUserId - Auth-UUID des Empfängers (falls vorhanden).
 * @param payeeName - Name des Empfängers (falls vorhanden).
 * @param attachmentPath - Pfad zur Beleg-Datei (falls vorhanden).
 * @param attachmentOriginalFilename - Original-Dateiname der Beleg-Datei (falls vorhanden).
 */

export type ExpenseDomain = {
  id: string;
  eventId: string;
  budgetId: BudgetDomain["id"];
  expenseDate: Date;
  amountInCents: number;
  currency: string;
  label: string;
  comment: string | null;
  payeeType: ExpensePayeeType;
  payeeUserId: string | null;
  payeeName: string | null;
  attachmentPath: string | null;
  attachmentOriginalFilename: string | null;
};
/* =====================================================================
// DB-Zeilentyp (snake_case, entspricht Postgres-Spalten)
// ===================================================================== */

/**
 * Datenbank-Zeilentyp für die event_expenses.
 */
export type ExpenseRow = {
  [key: string]: unknown;
  id: string;
  event_id: string;
  budget_id: BudgetDomain["id"];
  expense_date: string;
  amount_in_cents: number;
  currency: string;
  label: string;
  comment: string | null;
  payee_type: ExpensePayeeType;
  payee_user_id: string | null;
  payee_name: string | null;
  attachment_path: string | null;
  attachment_original_filename: string | null;
};
