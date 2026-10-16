import {BudgetDomain} from "../Budget/budget.types";

/** Erlaubte MIME-Typen für Ausgaben-Belege (PDF oder Bild). */
export const ACCEPTED_ATTACHMENT_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
];
/**
 * Dateiendung je MIME-Typ, für den Storage-Dateinamen. Aus dem validierten
 * Typ abgeleitet statt aus dem Originalnamen geparst — robuster, da der
 * Originalname z.B. keinen Punkt oder eine ungewöhnliche Endung haben kann.
 */
export const ATTACHMENT_MIME_TO_EXTENSION: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
};

/** Maximale Dateigrösse für einen Ausgaben-Beleg (10 MB). */
export const MAX_ATTACHMENT_SIZE_BYTES = 10 * 1024 * 1024;

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
// View-Modelle -> mit Informationen für das UI
// ===================================================================== */
export type ExpenseTotalsByBudget = Record<string, Record<string, number>>; // budgetId → Währung → Rappen

export type ExpenseGroup = {
  budget: BudgetDomain;
  expenses: ExpenseDomain[]; // neueste zuerst
  totalsByCurrency: Record<string, number>; // Rappen je Währung
};
export type PayeeBalance = {
  payeeType: ExpensePayeeType.EXISTING_USER | ExpensePayeeType.NEW_PERSON;
  payeeUserId: string | null;
  payeeName: string | null;
  expenses: ExpenseDomain[];
  totalsByCurrency: Record<string, number>;
};

/**
 * Währungen, die im Einsatz sind
 *
 * @param currencies - Währungscodes mit mindestens einer Ausgabe, häufigste zuerst.
 * @param defaultCurrency - Vorausgewählte Währung. «CHF», wenn es keine Ausgaben gibt.
 */
export type CurrenciesInUse = {
  currencies: string[];
  defaultCurrency: string;
};

/**
 * Ein Stück der Verteilung nach Budget in der Auswertung (Story 6.4).
 *
 * @param id - Budget-ID oder `"others"` für das zusammengefasste Stück «Übrige».
 * @param label - Budgetname bzw. «Übrige (3 Budgets)».
 * @param amountInCents - Summe der Ausgaben dieses Stücks in Rappen.
 * @param sharePercent - Anteil an der Summe aller Stücke in ganzen Prozent.
 * @param colorIndex - Position des Budgets in `budgets`, bestimmt die Farbe
 *   (bleibt beim Ab- und Anwählen anderer Budgets gleich); `null` bei «Übrige».
 * @param groupedBudgetNames - Namen der zusammengefassten Budgets, nur bei «Übrige».
 */
export type BudgetShare = {
  id: string;
  label: string;
  amountInCents: number;
  sharePercent: number;
  colorIndex: number | null;
  groupedBudgetNames: string[];
};

/* =====================================================================
// Domain-Modelle (camelCase, werden in der App verwendet)
// ===================================================================== */

/**
 * Domain-Modell einer Ausgabe (camelCase).
 *
 * @param id - Eindeutige ID des Budgets.
 * @param eventId - Event-ID des Budgets.
 * @param budgetType - Typ des Budgets.
 * @param date - Datum der Ausgabe.
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
  date: Date;
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
