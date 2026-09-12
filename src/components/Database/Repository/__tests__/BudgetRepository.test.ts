/**
 * Unit-Tests für BudgetRepository.ts.
 *
 * Testet toRow/toDomain-Mapping sowie die Convenience-Methoden
 * getAllBudgets(), createBudget() und saveAllBudgets().
 */

import {BudgetRepository} from "../BudgetRepository";
import {
  BudgetDomain,
  BudgetRow,
  BudgetType,
} from "../../../Event/ExpenseTracking/budget.types";
import {STORAGE_OBJECT_PROPERTY} from "../../../Shared/sessionStorageHandler.class";
import {createSupabaseMock} from "../__mocks__/supabaseMock";
import {AuthUser} from "../../../Session/authUser.class";

// SessionStorageHandler mocken, damit Caching die Tests nicht beeinflusst
jest.mock("../../../Shared/sessionStorageHandler.class", () => {
  const actual = jest.requireActual(
    "../../../Shared/sessionStorageHandler.class",
  );
  return {
    ...actual,
    SessionStorageHandler: {
      getDocument: jest.fn().mockReturnValue(null),
      upsertDocument: jest.fn(),
      deleteDocument: jest.fn(),
      updateDocumentField: jest.fn(),
      incrementFieldValue: jest.fn(),
    },
  };
});
/* =====================================================================
// Test-Daten
// ===================================================================== */

const testRow: BudgetRow = {
  id: "budget-uuid-001",
  event_id: "event-uuid-001",
  name: "Test Budget",
  budget_type: BudgetType.FIXED_AMOUNT,
  amount_in_cents: 10000,
  currency: "CHF",
};

const testDomain: BudgetDomain = {
  id: "budget-uuid-001",
  eventId: "event-uuid-001",
  name: "Test Budget",
  budgetType: BudgetType.FIXED_AMOUNT,
  amountInCents: 10000,
  currency: "CHF",
};

const authUser = {uid: "auth-uuid-123"} as AuthUser;

/* =====================================================================
// Tests
// ===================================================================== */
describe("BudgetRepository", () => {
  let repo: BudgetRepository;
  let supabaseMock: ReturnType<typeof createSupabaseMock>;

  beforeEach(() => {
    supabaseMock = createSupabaseMock();
    repo = new BudgetRepository();
    (repo as any).client = supabaseMock.client;
  });

  /* ------------------------------------------
  // Grundlegende Properties
  // ------------------------------------------ */
  test("tableName ist 'event_budgets'", () => {
    expect(repo.tableName).toBe("event_budgets");
  });

  test("getCacheConfig() gibt EVENT_BUDGETS zurück", () => {
    expect(repo.getCacheConfig()).toBe(STORAGE_OBJECT_PROPERTY.EVENT_BUDGETS);
  });

  /* ------------------------------------------
  // toRow / toDomain
  // ------------------------------------------ */
  describe("toRow() / toDomain()", () => {
    test("toRow(): Domain → DB-Zeile (ohne id)", () => {
      const row = repo.toRow(testDomain);
      expect(row.name).toBe("Test Budget");
      expect(row.event_id).toBe("event-uuid-001");
      expect(row.budget_type).toBe(BudgetType.FIXED_AMOUNT);
      expect(row.amount_in_cents).toBe(10000);
      expect(row.currency).toBe("CHF");
      // id darf nicht mitgesendet werden
      expect(row.id).toBeUndefined();
    });

    test("toDomain(): DB-Zeile → Domain (mit uid)", () => {
      const domain = repo.toDomain(testRow);
      expect(domain.id).toBe(testRow.id);
      expect(domain.name).toBe("Test Budget");
      expect(domain.eventId).toBe("event-uuid-001");
      expect(domain.budgetType).toBe(BudgetType.FIXED_AMOUNT);
      expect(domain.amountInCents).toBe(10000);
      expect(domain.currency).toBe("CHF");
    });

    test("Roundtrip: toRow → toDomain ergibt Ursprungswerte", () => {
      const row = repo.toRow(testDomain) as BudgetRow;
      row.id = testDomain.id;
      row.created_at = "2026-01-01T00:00:00Z";
      row.created_by = "";
      row.updated_at = "2026-01-01T00:00:00Z";
      row.updated_by = "";
      const domain = repo.toDomain(row);
      expect(domain).toEqual(testDomain);
    });
  });
  /* ------------------------------------------
  // getBudgetsForEvent()
  // ------------------------------------------ */
  describe("getBudgetsForEvent()", () => {
    test("Ruft alle Budgets eines Anlasses ab", async () => {
      // findMany() endet mit order() — order() muss thenable sein
      supabaseMock.queryMock.order = jest.fn().mockResolvedValue({
        data: [testRow],
        error: null,
      });

      const result = await repo.getBudgetsForEvent("event-uuid-001");

      expect(supabaseMock.queryMock.select).toHaveBeenCalled();
      expect(supabaseMock.queryMock.eq).toHaveBeenCalledWith(
        "event_id",
        "event-uuid-001",
      );
      expect(result.length).toBe(1);
      expect(result[0].id).toBe("budget-uuid-001");
    });

    test("Fehler bei getBudgetsForEvent() werfen", async () => {
      supabaseMock.queryMock.order = jest.fn().mockResolvedValue({
        data: null,
        error: {message: "Select failed"},
      });

      await expect(repo.getBudgetsForEvent("event-uuid-001")).rejects.toEqual({
        message: "Select failed",
      });
    });
  });

  /* ------------------------------------------
  // createBudget()
  // ------------------------------------------ */
  describe("createBudget()", () => {
    test("Erstellt ein neues Budget", async () => {
      const insertedRow: BudgetRow = {
        ...testRow,
        id: "new-budget-uuid",
      };
      supabaseMock.queryMock.single.mockResolvedValue({
        data: insertedRow,
        error: null,
      });

      const result = await repo.createBudget(testDomain, authUser);

      expect(supabaseMock.queryMock.insert).toHaveBeenCalled();
      const insertArg = supabaseMock.queryMock.insert.mock.calls[0][0];
      expect(insertArg.name).toBe("Test Budget");
      expect(insertArg.event_id).toBe("event-uuid-001");
      expect(insertArg.budget_type).toBe(BudgetType.FIXED_AMOUNT);
      expect(insertArg.amount_in_cents).toBe(10000);
      expect(insertArg.currency).toBe("CHF");
      expect(result.id).toBe("new-budget-uuid");
    });

    test("Fehler bei createBudget() werfen", async () => {
      supabaseMock.queryMock.single.mockResolvedValue({
        data: null,
        error: {message: "Insert failed"},
      });

      await expect(repo.createBudget(testDomain, authUser)).rejects.toEqual({
        message: "Insert failed",
      });
    });
  });
  /* ------------------------------------------
  // updateBudget()
  // ------------------------------------------ */
  describe("updateBudget()", () => {
    test("Aktualisiert ein einzelnes Budget per update()", async () => {
      supabaseMock.queryMock.single.mockResolvedValue({
        data: testRow,
        error: null,
      });

      const result = await repo.updateBudget(testDomain, authUser);

      expect(supabaseMock.queryMock.eq).toHaveBeenCalledWith(
        "id",
        testDomain.id,
      );
      expect(result.id).toBe(testDomain.id);
      expect(result.name).toBe("Test Budget");
    });
  });
  /* ------------------------------------------
  // deleteBudget()
  // ------------------------------------------ */
  describe("deleteBudget", () => {
    it("should delete a budget by id", async () => {
      supabaseMock.queryMock.eq.mockResolvedValue({data: null, error: null});

      await repo.deleteBudget("budget-001");

      expect(supabaseMock.client.from).toHaveBeenCalledWith("event_budgets");
      expect(supabaseMock.queryMock.delete).toHaveBeenCalled();
      expect(supabaseMock.queryMock.eq).toHaveBeenCalledWith(
        "id",
        "budget-001",
      );
    });

    it("should throw on error", async () => {
      supabaseMock.queryMock.eq.mockResolvedValue({
        data: null,
        error: {message: "Delete failed"},
      });

      await expect(repo.deleteBudget("budget-001")).rejects.toEqual({
        message: "Delete failed",
      });
    });
  });
});
