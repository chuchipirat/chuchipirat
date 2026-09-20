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
import {
  RealtimeConnectionStatus,
  subscribeWithRetry,
} from "./realtimeSubscription";

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

  /**
   * @param client - Optionaler Supabase-Client (für Tests); Standard ist der globale Client.
   */
  constructor(client?: SupabaseClient) {
    super(client);
  }

  /**
   * Budgets werden nicht gecacht: Sie gehören einem Event, das mehrere
   * Köch:innen gleichzeitig bearbeiten, und werden live synchronisiert.
   *
   * @returns Cache-Konfiguration mit `excludeFromCaching`.
   */
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
      icon: domain.icon,
    };
  }
  /**
   * Konvertiert eine Postgres-Zeile in ein BudgetDomain-Objekt.
   *
   * @param row - Die DB-Zeile (snake_case)
   * @returns Domain-Objekt (camelCase)
   */
  toDomain(row: BudgetRow): BudgetDomain {
    return {
      id: row.id,
      eventId: row.event_id,
      name: row.name,
      budgetType: row.budget_type,
      amountInCents: row.amount_in_cents,
      currency: row.currency,
      icon: row.icon,
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

  /**
   * Legt ein neues Budget an.
   *
   * @param budget - Das anzulegende Budget (`id` bleibt leer, die DB vergibt sie).
   * @param authUser - Der angemeldete Benutzer.
   * @returns Vergebene ID und das gespeicherte Budget.
   */
  async createBudget(
    budget: BudgetDomain,
    authUser: AuthUser,
  ): Promise<{id: string; value: BudgetDomain}> {
    return this.insert({value: budget, authUser});
  }
  /**
   * Speichert Änderungen an einem bestehenden Budget.
   *
   * @param budget - Das geänderte Budget (identifiziert über `budget.id`).
   * @param authUser - Der angemeldete Benutzer.
   * @returns Das gespeicherte Budget.
   */
  async updateBudget(
    budget: BudgetDomain,
    authUser: AuthUser,
  ): Promise<BudgetDomain> {
    return this.update({id: budget.id, value: budget, authUser});
  }
  /**
   * Löscht ein Budget.
   *
   * @param id - ID des Budgets.
   * @throws Fremdschlüssel-Fehler, wenn dem Budget noch Ausgaben zugeordnet sind
   *   (`event_expenses.budget_id` ist `ON DELETE RESTRICT`).
   */
  async deleteBudget(id: string): Promise<void> {
    return this.remove(id);
  }
  /* =====================================================================
  // Echtzeit-Subscription: Budget von Event
  // ===================================================================== */
  /**
   * Abonniert Echtzeit-Änderungen der Budgets eines Events.
   * `onChange` wird bei jedem Einfügen, Ändern und Löschen aufgerufen, liefert
   * aber keine Daten — der Aufrufer lädt die Budgets selbst neu. Beim ersten
   * Verbindungsaufbau wird `onChange` nicht aufgerufen.
   *
   * @param eventId - Die ID des Events
   * @param onChange - Callback bei einer Änderung (darf asynchron sein)
   * @param onError - Callback bei Fehler in `onChange`
   * @param onStatusChange - Optionaler Callback bei Verbindungsstatus-Wechseln
   * @returns {@link RealtimeSubscriptionHandle} mit `unsubscribe()`/`reconnect()`
   */
  subscribeToBudgets(
    eventId: string,
    onChange: () => void | Promise<void>,
    onError: (error: Error) => void,
    onStatusChange?: (status: RealtimeConnectionStatus) => void,
  ) {
    return subscribeWithRetry({
      client: this.client,
      channelName: `budgets:${eventId}`,
      bindings: [{table: "event_budgets", filter: `event_id=eq.${eventId}`}],
      onChange,
      onError,
      onStatusChange,
    });
  }
}
