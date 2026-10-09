/**
 * Unit-Tests für UserPaymentDetailsRepository.ts.
 *
 * Testet toRow/toDomain-Mapping, den Cache-Ausschluss sowie
 * getPaymentDetails(), savePaymentDetails() und deletePaymentDetails() —
 * insbesondere, dass überall über `user_id` (nicht `id`) gefiltert wird.
 */

import {UserPaymentDetailsRepository} from "../UserPaymentDetailsRepository";
import {
  UserPaymentDetailsRow,
  UserPaymentDetailsDomain,
} from "../../../User/userPaymentDetails.types";
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
const testRow: UserPaymentDetailsRow = {
  user_id: "user-123",
  street: "Musterstrasse 1",
  postal_code: "1234",
  city: "Hinterpfuffikon",
  iban: "CH9300762011623852957",
  created_at: "2026-10-09T10:00:00Z",
  updated_at: "2026-10-09T10:00:00Z",
};
const testDomain: UserPaymentDetailsDomain = {
  userId: "user-123",
  street: "Musterstrasse 1",
  postalCode: "1234",
  city: "Hinterpfuffikon",
  iban: "CH9300762011623852957",
};
const authUser = {uid: "auth-uuid-123"} as AuthUser;

/* =====================================================================
// Tests
// ===================================================================== */
describe("UserPaymentDetailsRepository", () => {
  let repo: UserPaymentDetailsRepository;
  let supabaseMock: ReturnType<typeof createSupabaseMock>;

  beforeEach(() => {
    supabaseMock = createSupabaseMock();
    repo = new UserPaymentDetailsRepository();
    (repo as any).client = supabaseMock.client;
  });

  /* ------------------------------------------
  // Grundlegende Properties
  // ------------------------------------------ */
  test("tableName ist 'user_payment_details'", () => {
    expect(repo.tableName).toBe("user_payment_details");
  });

  test("getCacheConfig() gibt USER_PAYMENT_DETAILS zurück", () => {
    expect(repo.getCacheConfig()).toBe(
      STORAGE_OBJECT_PROPERTY.USER_PAYMENT_DETAILS,
    );
  });

  test("Zahlungsangaben werden nie gecacht", () => {
    // Bankdaten gehören nicht in den sessionStorage (für jedes Script lesbar)
    expect(repo.getCacheConfig().excludeFromCaching).toBe(true);
  });

  /* ------------------------------------------
  // toRow / toDomain
  // ------------------------------------------ */
  describe("toRow() / toDomain()", () => {
    test("toRow(): Domain → DB-Zeile (ohne id)", () => {
      const row = repo.toRow(testDomain);
      expect(row.user_id).toBeUndefined(); // user_id wird nicht mitgesendet, upsert setzt den PK selbst aus id
      expect(row.street).toBe("Musterstrasse 1");
      expect(row.postal_code).toBe("1234");
      expect(row.city).toBe("Hinterpfuffikon");
      expect(row.iban).toBe("CH9300762011623852957");
      // id darf nicht mitgesendet werden
      expect(row["id"]).toBeUndefined();
    });

    test("toDomain(): DB-Zeile → Domain (mit uid)", () => {
      const domain = repo.toDomain(testRow);
      expect(domain.userId).toBe(testRow.user_id);
      expect(domain.street).toBe(testRow.street);
      expect(domain.postalCode).toBe(testRow.postal_code);
      expect(domain.city).toBe(testRow.city);
      expect(domain.iban).toBe(testRow.iban);
    });

    test("Roundtrip: toRow → toDomain ergibt Ursprungswerte", () => {
      const row = repo.toRow(testDomain) as UserPaymentDetailsRow;
      const domain = repo.toDomain(row);
      expect(domain).toEqual({...testDomain, userId: undefined}); // userId ist in row nicht enthalten, daher undefined
    });
  });
  /* ------------------------------------------
  // getPaymentDetails()
  // ------------------------------------------ */
  describe("getPaymentDetails()", () => {
    test("liest die Daten eines Benutzers über user_id", async () => {
      // findById() endet mit single() — nicht mit order() wie findMany()
      supabaseMock.queryMock.single = jest.fn().mockResolvedValue({
        data: testRow,
        error: null,
      });

      const result = await repo.getPaymentDetails("user-123");

      expect(supabaseMock.client.from).toHaveBeenCalledWith(
        "user_payment_details",
      );
      // PK ist user_id, nicht id — fängt die Mutationsprobe (Override entfernt)
      expect(supabaseMock.queryMock.eq).toHaveBeenCalledWith(
        "user_id",
        "user-123",
      );
      expect(result).toEqual(testDomain);
    });

    test("liefert null, wenn keine Zahlungsangaben hinterlegt sind", async () => {
      // PGRST116 = "keine Zeile gefunden" → findById() macht daraus null
      supabaseMock.queryMock.single = jest.fn().mockResolvedValue({
        data: null,
        error: {code: "PGRST116", message: "No rows found"},
      });

      await expect(repo.getPaymentDetails("user-123")).resolves.toBeNull();
    });

    test("andere Fehler werden geworfen", async () => {
      supabaseMock.queryMock.single = jest.fn().mockResolvedValue({
        data: null,
        error: {code: "42501", message: "permission denied"},
      });

      await expect(repo.getPaymentDetails("user-123")).rejects.toEqual({
        code: "42501",
        message: "permission denied",
      });
    });
  });
  /* ------------------------------------------
  // savePaymentDetails()
  // ------------------------------------------ */
  describe("savePaymentDetails()", () => {
    test("speichert per upsert unter authUser.uid, nicht unter details.userId", async () => {
      supabaseMock.queryMock.single = jest.fn().mockResolvedValue({
        data: {...testRow, user_id: authUser.uid},
        error: null,
      });

      // details.userId zeigt bewusst auf jemand anderen
      const result = await repo.savePaymentDetails(
        {...testDomain, userId: "someone-else"},
        authUser,
      );

      expect(supabaseMock.queryMock.upsert).toHaveBeenCalledWith({
        user_id: authUser.uid,
        street: testDomain.street,
        postal_code: testDomain.postalCode,
        city: testDomain.city,
        iban: testDomain.iban,
      });
      expect(result).toEqual({...testDomain, userId: authUser.uid});
    });

    test("Fehler beim Speichern werden geworfen", async () => {
      supabaseMock.queryMock.single = jest.fn().mockResolvedValue({
        data: null,
        error: {code: "23514", message: "violates check constraint"},
      });

      await expect(
        repo.savePaymentDetails(testDomain, authUser),
      ).rejects.toEqual({code: "23514", message: "violates check constraint"});
    });
  });
  /* ------------------------------------------
  // deletePaymentDetails()
  // ------------------------------------------ */
  describe("deletePaymentDetails()", () => {
    test("löscht über user_id", async () => {
      await repo.deletePaymentDetails("user-123");

      expect(supabaseMock.client.from).toHaveBeenCalledWith(
        "user_payment_details",
      );
      expect(supabaseMock.queryMock.delete).toHaveBeenCalled();
      expect(supabaseMock.queryMock.eq).toHaveBeenCalledWith(
        "user_id",
        "user-123",
      );
    });
  });
});
