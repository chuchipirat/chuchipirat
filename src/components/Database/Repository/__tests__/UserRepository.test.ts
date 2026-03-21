/**
 * Unit-Tests für UserRepository.
 *
 * Testet toRow/toDomain-Mapping sowie die user-spezifischen Methoden
 * (findOverview, findByEmail, findPublicProfile,
 * findFullProfile, registerSignIn).
 * Der Supabase-Client wird vollständig gemockt.
 */
import {UserRepository} from "../UserRepository";
import {
  userRow,
  userDomain,
  userRow2,
  userProfileRow,
} from "../__mocks__/user.mock";
import {createSupabaseMock} from "../__mocks__/supabaseMock";
import Role from "../../../../constants/roles";

describe("UserRepository", () => {
  let repo: UserRepository;
  let supabaseMock: ReturnType<typeof createSupabaseMock>;

  beforeEach(() => {
    supabaseMock = createSupabaseMock();
    repo = new UserRepository();
    (repo as any).client = supabaseMock.client;
  });

  /* ------------------------------------------
  // tableName
  // ------------------------------------------ */
  test("tableName ist 'users'", () => {
    expect(repo.tableName).toBe("users");
  });

  /* ------------------------------------------
  // toRow()
  // ------------------------------------------ */
  describe("toRow()", () => {
    test("Domain-Objekt korrekt in DB-Zeile umwandeln", () => {
      const row = repo.toRow(userDomain);

      expect(row.id).toBe("T02c6mxOWDstBdvwzjbs5Tfc2abc");
      expect(row.email).toBe("test@chuchipirat.ch");
      expect(row.first_name).toBe("Test");
      expect(row.last_name).toBe("User");
      expect(row.roles).toEqual(["basic"]);
      expect(row.no_logins).toBe(5);
      expect(row.no_found_bugs).toBe(3);
      expect(row.display_name).toBe("TestUser");
      expect(row.motto).toBe("Testing is caring");
    });

    test("pictureSrc als einzelne Spalte abbilden", () => {
      const row = repo.toRow(userDomain);

      expect(row.picture_src).toBe("https://example.com/profile.jpg");
    });

    test("E-Mail wird lowercase gespeichert", () => {
      const user = {...userDomain, email: "UPPER@CASE.COM"};
      const row = repo.toRow(user);

      expect(row.email).toBe("upper@case.com");
    });

    test("Leere pictureSrc sicher behandeln", () => {
      const user = {
        ...userDomain,
        pictureSrc: "",
      };
      const row = repo.toRow(user);

      expect(row.picture_src).toBe("");
    });

    test("created_at nur setzen wenn explizit angegeben", () => {
      const row = repo.toRow(userDomain);
      expect(row.created_at).toBeUndefined();

      const withCreatedAt = {
        ...userDomain,
        createdAt: new Date("2025-01-15T00:00:00.000Z"),
      };
      const row2 = repo.toRow(withCreatedAt);
      expect(row2.created_at).toBe("2025-01-15T00:00:00.000Z");
    });
  });

  /* ------------------------------------------
  // toDomain()
  // ------------------------------------------ */
  describe("toDomain()", () => {
    test("DB-Zeile korrekt in Domain-Objekt umwandeln", () => {
      const domain = repo.toDomain(userRow);

      expect(domain.uid).toBe("T02c6mxOWDstBdvwzjbs5Tfc2abc");
      expect(domain.email).toBe("test@chuchipirat.ch");
      expect(domain.firstName).toBe("Test");
      expect(domain.lastName).toBe("User");
      expect(domain.roles).toEqual([Role.basic]);
      expect(domain.noLogins).toBe(5);
      expect(domain.noFoundBugs).toBe(3);
      expect(domain.displayName).toBe("TestUser");
      expect(domain.memberId).toBe(42);
      expect(domain.motto).toBe("Testing is caring");
    });

    test("picture_src als String übernehmen", () => {
      const domain = repo.toDomain(userRow);

      expect(domain.pictureSrc).toBe("https://example.com/profile.jpg");
    });

    test("created_at als Date-Objekt parsen", () => {
      const domain = repo.toDomain(userRow);

      expect(domain.createdAt).toBeInstanceOf(Date);
      expect(domain.createdAt!.toISOString()).toBe("2025-01-15T00:00:00.000Z");
    });
  });

  /* ------------------------------------------
  // Roundtrip: toRow() → toDomain()
  // ------------------------------------------ */
  test("Roundtrip: toRow() → toDomain() erhält alle Werte", () => {
    const row = repo.toRow(userDomain) as any;
    // Simuliere die fehlenden DB-generierten Felder
    row.member_id = userDomain.memberId;
    row.created_at = "2025-01-15T00:00:00.000Z";
    row.updated_at = "2026-02-20T10:00:00.000Z";

    const result = repo.toDomain(row);

    expect(result.uid).toBe(userDomain.uid);
    expect(result.email).toBe(userDomain.email);
    expect(result.firstName).toBe(userDomain.firstName);
    expect(result.lastName).toBe(userDomain.lastName);
    expect(result.displayName).toBe(userDomain.displayName);
    expect(result.motto).toBe(userDomain.motto);
    expect(result.noLogins).toBe(userDomain.noLogins);
    expect(result.pictureSrc).toEqual(userDomain.pictureSrc);
  });

  /* ------------------------------------------
  // findOverview()
  // ------------------------------------------ */
  describe("findOverview()", () => {
    test("Alle User als Übersicht laden", async () => {
      const overviewRows = [
        {
          id: userRow.id,
          first_name: userRow.first_name,
          last_name: userRow.last_name,
          email: userRow.email,
          display_name: userRow.display_name,
          member_id: userRow.member_id,
          created_at: userRow.created_at,
        },
        {
          id: userRow2.id,
          first_name: userRow2.first_name,
          last_name: userRow2.last_name,
          email: userRow2.email,
          display_name: userRow2.display_name,
          member_id: userRow2.member_id,
          created_at: userRow2.created_at,
        },
      ];

      supabaseMock.queryMock.order.mockResolvedValue({
        data: overviewRows,
        error: null,
      });

      const result = await repo.findOverview();

      expect(supabaseMock.client.from).toHaveBeenCalledWith("users");
      expect(supabaseMock.queryMock.select).toHaveBeenCalledWith(
        "id, first_name, last_name, email, display_name, member_id, created_at",
      );
      expect(supabaseMock.queryMock.order).toHaveBeenCalledWith("first_name", {
        ascending: true,
      });
      expect(result).toHaveLength(2);
      expect(result[0].uid).toBe("T02c6mxOWDstBdvwzjbs5Tfc2abc");
      expect(result[0].firstName).toBe("Test");
      expect(result[0].displayName).toBe("TestUser");
      expect(result[1].uid).toBe("X8kLmN3pQrStUvWxYz1234abcde");
    });

    test("Fehler bei findOverview() werfen", async () => {
      supabaseMock.queryMock.order.mockResolvedValue({
        data: null,
        error: {message: "Query failed"},
      });

      await expect(repo.findOverview()).rejects.toEqual({
        message: "Query failed",
      });
    });
  });

  /* ------------------------------------------
  // findByEmail()
  // ------------------------------------------ */
  describe("findByEmail()", () => {
    test("UID anhand E-Mail finden (via RPC)", async () => {
      supabaseMock.client.rpc.mockResolvedValue({
        data: "T02c6mxOWDstBdvwzjbs5Tfc2abc",
        error: null,
      });

      const result = await repo.findByEmail("test@chuchipirat.ch");

      expect(supabaseMock.client.rpc).toHaveBeenCalledWith(
        "find_user_id_by_email",
        {lookup_email: "test@chuchipirat.ch"},
      );
      expect(result).toBe("T02c6mxOWDstBdvwzjbs5Tfc2abc");
    });

    test("E-Mail wird lowercase und trimmed", async () => {
      supabaseMock.client.rpc.mockResolvedValue({
        data: "T02c6mxOWDstBdvwzjbs5Tfc2abc",
        error: null,
      });

      await repo.findByEmail("  TEST@Chuchipirat.CH  ");

      expect(supabaseMock.client.rpc).toHaveBeenCalledWith(
        "find_user_id_by_email",
        {lookup_email: "test@chuchipirat.ch"},
      );
    });

    test("null zurückgeben wenn E-Mail nicht gefunden", async () => {
      supabaseMock.client.rpc.mockResolvedValue({
        data: null,
        error: null,
      });

      const result = await repo.findByEmail("unknown@test.ch");
      expect(result).toBeNull();
    });

    test("Fehler bei findByEmail() werfen", async () => {
      supabaseMock.client.rpc.mockResolvedValue({
        data: null,
        error: {message: "Query failed"},
      });

      await expect(repo.findByEmail("test@test.ch")).rejects.toEqual({
        message: "Query failed",
      });
    });
  });

  /* ------------------------------------------
  // findPublicProfile()
  // ------------------------------------------ */
  describe("findPublicProfile()", () => {
    test("Öffentliches Profil anhand ID laden", async () => {
      supabaseMock.queryMock.maybeSingle.mockResolvedValue({
        data: userProfileRow,
        error: null,
      });

      const result = await repo.findPublicProfile(
        "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      );

      expect(supabaseMock.client.from).toHaveBeenCalledWith("user_profiles");
      expect(supabaseMock.queryMock.eq).toHaveBeenCalledWith(
        "id",
        "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      );
      expect(result.uid).toBe("T02c6mxOWDstBdvwzjbs5Tfc2abc");
      expect(result.displayName).toBe("TestUser");
      expect(result.memberId).toBe(42);
      expect(result.motto).toBe("Testing is caring");
      expect(result.pictureSrc).toBe("https://example.com/profile.jpg");
    });

    test("Stats mit Standardwerten (0) zurückgeben", async () => {
      supabaseMock.queryMock.maybeSingle.mockResolvedValue({
        data: userProfileRow,
        error: null,
      });

      const result = await repo.findPublicProfile(
        "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      );

      expect(result.stats).toEqual({
        noComments: 0,
        noRatings: 0,
        noEvents: 0,
        noRecipesPublic: 0,
        noRecipesPrivate: 0,
        noRecipesVariants: 0,
        noFoundBugs: 0,
      });
    });

    test("Wirft Fehler wenn Datenbankfehler auftritt", async () => {
      supabaseMock.queryMock.maybeSingle.mockResolvedValue({
        data: null,
        error: {message: "Connection refused"},
      });

      await expect(repo.findPublicProfile("any-uid")).rejects.toEqual({
        message: "Connection refused",
      });
    });

    test("Wirft Fehler wenn Profil nicht gefunden (data ist null)", async () => {
      supabaseMock.queryMock.maybeSingle.mockResolvedValue({
        data: null,
        error: null,
      });

      await expect(repo.findPublicProfile("unknown-uid")).rejects.toThrow(
        /Benutzerprofil nicht gefunden/,
      );
    });
  });

  /* ------------------------------------------
  // findFullProfile()
  // ------------------------------------------ */
  describe("findFullProfile()", () => {
    test("Vollständiges Profil laden", async () => {
      supabaseMock.queryMock.single.mockResolvedValue({
        data: userRow,
        error: null,
      });

      const result = await repo.findFullProfile("T02c6mxOWDstBdvwzjbs5Tfc2abc");

      expect(result.uid).toBe("T02c6mxOWDstBdvwzjbs5Tfc2abc");
      expect(result.email).toBe("test@chuchipirat.ch");
      expect(result.firstName).toBe("Test");
      expect(result.displayName).toBe("TestUser");
      expect(result.stats).toEqual({
        noComments: 0,
        noRatings: 0,
        noEvents: 0,
        noRecipesPublic: 0,
        noRecipesPrivate: 0,
        noRecipesVariants: 0,
        noFoundBugs: 0,
      });
    });

    test("Fehler werfen wenn User nicht gefunden", async () => {
      supabaseMock.queryMock.single.mockResolvedValue({
        data: null,
        error: {code: "PGRST116", message: "No rows found"},
      });

      await expect(repo.findFullProfile("nonexistent")).rejects.toThrow(
        "User not found: nonexistent",
      );
    });
  });

  /* ------------------------------------------
  // registerSignIn()
  // ------------------------------------------ */
  describe("registerSignIn()", () => {
    test("RPC increment_logins mit korrekter User-ID aufrufen", async () => {
      supabaseMock.client.rpc.mockResolvedValue({data: null, error: null});

      await repo.registerSignIn("T02c6mxOWDstBdvwzjbs5Tfc2abc");

      expect(supabaseMock.client.rpc).toHaveBeenCalledWith("increment_logins", {
        user_id: "T02c6mxOWDstBdvwzjbs5Tfc2abc",
      });
    });

    test("Fehler bei RPC-Aufruf werfen", async () => {
      const rpcError = {message: "RPC failed", code: "42000"};
      supabaseMock.client.rpc.mockResolvedValue({
        data: null,
        error: rpcError,
      });

      await expect(
        repo.registerSignIn("T02c6mxOWDstBdvwzjbs5Tfc2abc"),
      ).rejects.toEqual(rpcError);
    });
  });

  /* ------------------------------------------
  // incrementFoundBugs()
  // ------------------------------------------ */
  describe("incrementFoundBugs()", () => {
    test("Ruft RPC increment_found_bugs mit userId und delta auf", async () => {
      supabaseMock.client.rpc.mockResolvedValue({data: null, error: null});

      await repo.incrementFoundBugs("T02c6mxOWDstBdvwzjbs5Tfc2abc", 1);

      expect(supabaseMock.client.rpc).toHaveBeenCalledWith(
        "increment_found_bugs",
        {
          p_user_id: "T02c6mxOWDstBdvwzjbs5Tfc2abc",
          p_delta: 1,
        },
      );
    });

    test("Übergibt negativen delta für Decrement", async () => {
      supabaseMock.client.rpc.mockResolvedValue({data: null, error: null});

      await repo.incrementFoundBugs("user-123", -1);

      expect(supabaseMock.client.rpc).toHaveBeenCalledWith(
        "increment_found_bugs",
        {p_user_id: "user-123", p_delta: -1},
      );
    });

    test("Wirft Fehler bei DB-Error", async () => {
      const rpcError = {message: "RPC failed", code: "42000"};
      supabaseMock.client.rpc.mockResolvedValue({data: null, error: rpcError});

      await expect(
        repo.incrementFoundBugs("user-123", 1),
      ).rejects.toEqual(rpcError);
    });
  });

});
