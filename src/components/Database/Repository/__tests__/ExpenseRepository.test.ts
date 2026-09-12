/**
 * Unit-Tests für ExpenseRepository.ts.
 *
 * Testet toRow/toDomain-Mapping sowie die Convenience-Methoden
 * getAllExpenses(), createExpense().
 */

import {ExpenseRepository} from "../ExpenseRepository";
import {
  ExpenseDomain,
  ExpensePayeeType,
  ExpenseRow,
} from "../../../Event/ExpenseTracking/expense.types";
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
const testRow: ExpenseRow = {
  id: "expense-uuid-001",
  event_id: "event-uuid-001",
  budget_id: "budget-uuid-001",
  expense_date: "2026-01-01",
  amount_in_cents: 10000,
  currency: "CHF",
  label: "Test Expense",
  comment: "Test Comment",
  payee_type: ExpensePayeeType.EXISTING_USER,
  payee_user_id: "user-uuid-001",
  payee_name: null,
  attachment_path: "/path/to/attachment.pdf",
  attachment_original_filename: "attachment.pdf",
};

const testDomain: ExpenseDomain = {
  id: "expense-uuid-001",
  eventId: "event-uuid-001",
  budgetId: "budget-uuid-001",
  // Lokale Mitternacht (wie parseLocalDate() sie erzeugt) statt UTC-String —
  // sonst rundtrippt der exakte Zeitpunkt nicht, obwohl der Kalendertag stimmt.
  expenseDate: new Date(2026, 0, 1),
  amountInCents: 10000,
  currency: "CHF",
  label: "Test Expense",
  comment: "Test Comment",
  payeeType: ExpensePayeeType.EXISTING_USER,
  payeeUserId: "user-uuid-001",
  payeeName: null,
  attachmentPath: "/path/to/attachment.pdf",
  attachmentOriginalFilename: "attachment.pdf",
};

const authUser = {uid: "auth-uuid-123"} as AuthUser;
/* =====================================================================
// Tests
// ===================================================================== */
describe("ExpenseRepository", () => {
  let repo: ExpenseRepository;
  let supabaseMock: ReturnType<typeof createSupabaseMock>;

  beforeEach(() => {
    supabaseMock = createSupabaseMock();
    repo = new ExpenseRepository();
    (repo as any).client = supabaseMock.client;
  });

  /* ------------------------------------------
  // Grundlegende Properties
  // ------------------------------------------ */
  test("tableName ist 'event_expenses'", () => {
    expect(repo.tableName).toBe("event_expenses");
  });

  test("getCacheConfig() gibt EVENT_EXPENSES zurück", () => {
    expect(repo.getCacheConfig()).toBe(STORAGE_OBJECT_PROPERTY.EVENT_EXPENSES);
  });
  /* ------------------------------------------
    // toRow / toDomain
    // ------------------------------------------ */
  describe("toRow() / toDomain()", () => {
    test("toRow(): Domain → DB-Zeile (ohne id)", () => {
      const row = repo.toRow(testDomain);
      expect(row.label).toBe("Test Expense");
      expect(row.event_id).toBe("event-uuid-001");
      expect(row.payee_type).toBe(ExpensePayeeType.EXISTING_USER);
      expect(row.expense_date).toEqual("2026-01-01");
      expect(row.amount_in_cents).toBe(10000);
      expect(row.currency).toBe("CHF");
      // id darf nicht mitgesendet werden
      expect(row.id).toBeUndefined();
    });

    test("toDomain(): DB-Zeile → Domain (mit uid)", () => {
      const domain = repo.toDomain(testRow);
      expect(domain.id).toBe(testRow.id);
      expect(domain.label).toBe("Test Expense");
      expect(domain.eventId).toBe("event-uuid-001");
      expect(domain.payeeType).toBe(ExpensePayeeType.EXISTING_USER);
      expect(domain.amountInCents).toBe(10000);
      expect(domain.currency).toBe("CHF");
    });

    test("Roundtrip: toRow → toDomain ergibt Ursprungswerte", () => {
      const row = repo.toRow(testDomain) as ExpenseRow;
      row.id = testDomain.id;
      row.created_at = "2026-01-01";
      row.created_by = "";
      row.updated_at = "2026-01-01";
      row.updated_by = "";
      const domain = repo.toDomain(row);
      expect(domain).toEqual(testDomain);
    });
    test("Right Date Conversion: toRow → toDomain ergibt korrekte Date", () => {
      // Eigene Kopie statt testDomain zu mutieren — sonst leckt der Wert in
      // alle danach ausgeführten Tests (testDomain ist ein geteiltes Objekt).
      // Lokale Zeit kurz vor Mitternacht, nicht als UTC-String konstruiert —
      // sonst hängt der erwartete Tag vom Zeitzonen-Offset der Testumgebung ab.
      const nearMidnight: ExpenseDomain = {
        ...testDomain,
        expenseDate: new Date(2026, 8, 11, 23, 0, 0),
      };

      const row = repo.toRow(nearMidnight) as ExpenseRow;
      expect(row.expense_date).toEqual("2026-09-11");

      const domain = repo.toDomain(row);
      expect(domain.expenseDate.getFullYear()).toBe(2026);
      expect(domain.expenseDate.getMonth()).toBe(8);
      expect(domain.expenseDate.getDate()).toBe(11);
    });
  });
  /* ------------------------------------------
  // createExpense()
  // ------------------------------------------ */
  describe("createExpense()", () => {
    test("Erstellt ein neues Expense", async () => {
      const insertedRow: ExpenseRow = {
        ...testRow,
        id: "new-expense-uuid",
      };
      supabaseMock.queryMock.single.mockResolvedValue({
        data: insertedRow,
        error: null,
      });

      const result = await repo.createExpense(testDomain, authUser);

      expect(supabaseMock.queryMock.insert).toHaveBeenCalled();
      const insertArg = supabaseMock.queryMock.insert.mock.calls[0][0];
      expect(insertArg.label).toBe("Test Expense");
      expect(insertArg.expense_date).toEqual("2026-01-01");
      expect(insertArg.amount_in_cents).toBe(10000);
      expect(insertArg.currency).toBe("CHF");
      expect(insertArg.payee_type).toBe(ExpensePayeeType.EXISTING_USER);
      expect(insertArg.payee_user_id).toBe("user-uuid-001");
      expect(insertArg.payee_name).toBeNull();
      expect(insertArg.attachment_path).toBe("/path/to/attachment.pdf");
      expect(insertArg.attachment_original_filename).toBe("attachment.pdf");
      expect(result.id).toBe("new-expense-uuid");
    });

    test("Fehler bei createExpense() werfen", async () => {
      supabaseMock.queryMock.single.mockResolvedValue({
        data: null,
        error: {message: "Insert failed"},
      });

      await expect(repo.createExpense(testDomain, authUser)).rejects.toEqual({
        message: "Insert failed",
      });
    });
  });
  /* ------------------------------------------
  // updateExpense()
  // ------------------------------------------ */
  describe("updateExpense()", () => {
    test("Aktualisiert ein einzelnes Expense per update()", async () => {
      supabaseMock.queryMock.single.mockResolvedValue({
        data: testRow,
        error: null,
      });

      const result = await repo.updateExpense(testDomain, authUser);

      expect(supabaseMock.queryMock.eq).toHaveBeenCalledWith(
        "id",
        testDomain.id,
      );
      expect(result.id).toBe(testDomain.id);
      expect(result.label).toBe("Test Expense");
    });
  });
  /* ------------------------------------------
  // deleteExpense()
  // ------------------------------------------ */
  describe("deleteExpense()", () => {
    it("should delete an expense by id", async () => {
      supabaseMock.queryMock.eq.mockResolvedValue({data: null, error: null});

      await repo.deleteExpense("expense-001");

      expect(supabaseMock.client.from).toHaveBeenCalledWith("event_expenses");
      expect(supabaseMock.queryMock.delete).toHaveBeenCalled();
      expect(supabaseMock.queryMock.eq).toHaveBeenCalledWith(
        "id",
        "expense-001",
      );
    });

    it("should throw on error", async () => {
      supabaseMock.queryMock.eq.mockResolvedValue({
        data: null,
        error: {message: "Delete failed"},
      });

      await expect(repo.deleteExpense("expense-001")).rejects.toEqual({
        message: "Delete failed",
      });
    });
  });
});
