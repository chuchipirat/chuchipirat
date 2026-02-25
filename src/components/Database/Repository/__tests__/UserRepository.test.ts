/**
 * Unit-Tests für UserRepository.
 *
 * Testet toRow/toDomain-Mapping sowie die user-spezifischen Methoden
 * (findOverview, findByEmail, findPublicProfile, findFullProfile, registerSignIn).
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

      expect(row.id).toBe("abc12345678901234567");
      expect(row.email).toBe("test@chuchipirat.ch");
      expect(row.first_name).toBe("Test");
      expect(row.last_name).toBe("User");
      expect(row.roles).toEqual(["basic"]);
      expect(row.no_logins).toBe(5);
      expect(row.display_name).toBe("TestUser");
      expect(row.motto).toBe("Testing is caring");
    });

    test("Picture-Struktur in flache Spalten abbilden", () => {
      const row = repo.toRow(userDomain);

      expect(row.picture_src_small).toBe("https://example.com/small.jpg");
      expect(row.picture_src_normal).toBe("https://example.com/normal.jpg");
      expect(row.picture_src_full).toBe("https://example.com/full.jpg");
    });

    test("E-Mail wird lowercase gespeichert", () => {
      const user = {...userDomain, email: "UPPER@CASE.COM"};
      const row = repo.toRow(user);

      expect(row.email).toBe("upper@case.com");
    });

    test("Leere pictureSrc sicher behandeln", () => {
      const user = {
        ...userDomain,
        pictureSrc: {smallSize: "", normalSize: "", fullSize: ""},
      };
      const row = repo.toRow(user);

      expect(row.picture_src_small).toBe("");
      expect(row.picture_src_normal).toBe("");
      expect(row.picture_src_full).toBe("");
    });

    test("Datum als ISO-String serialisieren", () => {
      const row = repo.toRow(userDomain);

      expect(row.last_login).toBe("2026-02-20T10:00:00.000Z");
      expect(row.member_since).toBe("2025-01-15T00:00:00.000Z");
    });

    test("Null lastLogin korrekt behandeln", () => {
      const user = {...userDomain, lastLogin: null as unknown as Date};
      const row = repo.toRow(user);

      expect(row.last_login).toBeNull();
    });
  });

  /* ------------------------------------------
  // toDomain()
  // ------------------------------------------ */
  describe("toDomain()", () => {
    test("DB-Zeile korrekt in Domain-Objekt umwandeln", () => {
      const domain = repo.toDomain(userRow);

      expect(domain.uid).toBe("abc12345678901234567");
      expect(domain.email).toBe("test@chuchipirat.ch");
      expect(domain.firstName).toBe("Test");
      expect(domain.lastName).toBe("User");
      expect(domain.roles).toEqual([Role.basic]);
      expect(domain.noLogins).toBe(5);
      expect(domain.displayName).toBe("TestUser");
      expect(domain.memberId).toBe(42);
      expect(domain.motto).toBe("Testing is caring");
    });

    test("Flache Spalten in Picture-Struktur zusammenbauen", () => {
      const domain = repo.toDomain(userRow);

      expect(domain.pictureSrc).toEqual({
        smallSize: "https://example.com/small.jpg",
        normalSize: "https://example.com/normal.jpg",
        fullSize: "https://example.com/full.jpg",
      });
    });

    test("Datum-Strings als Date-Objekte parsen", () => {
      const domain = repo.toDomain(userRow);

      expect(domain.lastLogin).toBeInstanceOf(Date);
      expect(domain.memberSince).toBeInstanceOf(Date);
      expect(domain.lastLogin.toISOString()).toBe("2026-02-20T10:00:00.000Z");
      expect(domain.memberSince.toISOString()).toBe("2025-01-15T00:00:00.000Z");
    });

    test("Null last_login als Epoch-Datum behandeln", () => {
      const row = {...userRow, last_login: null};
      const domain = repo.toDomain(row);

      expect(domain.lastLogin).toBeInstanceOf(Date);
      expect(domain.lastLogin.getTime()).toBe(0);
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
    row.last_change_at = "2026-02-20T10:00:00.000Z";

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
          member_since: userRow.member_since,
        },
        {
          id: userRow2.id,
          first_name: userRow2.first_name,
          last_name: userRow2.last_name,
          email: userRow2.email,
          display_name: userRow2.display_name,
          member_id: userRow2.member_id,
          member_since: userRow2.member_since,
        },
      ];

      supabaseMock.queryMock.order.mockResolvedValue({
        data: overviewRows,
        error: null,
      });

      const result = await repo.findOverview();

      expect(supabaseMock.client.from).toHaveBeenCalledWith("users");
      expect(supabaseMock.queryMock.select).toHaveBeenCalledWith(
        "id, first_name, last_name, email, display_name, member_id, member_since"
      );
      expect(supabaseMock.queryMock.order).toHaveBeenCalledWith("first_name", {
        ascending: true,
      });
      expect(result).toHaveLength(2);
      expect(result[0].uid).toBe("abc12345678901234567");
      expect(result[0].firstName).toBe("Test");
      expect(result[0].displayName).toBe("TestUser");
      expect(result[1].uid).toBe("def98765432109876543");
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
    test("UID anhand E-Mail finden", async () => {
      supabaseMock.queryMock.limit.mockResolvedValue({
        data: [{id: "abc12345678901234567"}],
        error: null,
      });

      const result = await repo.findByEmail("test@chuchipirat.ch");

      expect(supabaseMock.queryMock.eq).toHaveBeenCalledWith(
        "email",
        "test@chuchipirat.ch"
      );
      expect(result).toBe("abc12345678901234567");
    });

    test("E-Mail wird lowercase und trimmed", async () => {
      supabaseMock.queryMock.limit.mockResolvedValue({
        data: [{id: "abc12345678901234567"}],
        error: null,
      });

      await repo.findByEmail("  TEST@Chuchipirat.CH  ");

      expect(supabaseMock.queryMock.eq).toHaveBeenCalledWith(
        "email",
        "test@chuchipirat.ch"
      );
    });

    test("null zurückgeben wenn E-Mail nicht gefunden", async () => {
      supabaseMock.queryMock.limit.mockResolvedValue({
        data: [],
        error: null,
      });

      const result = await repo.findByEmail("unknown@test.ch");
      expect(result).toBeNull();
    });

    test("null zurückgeben wenn mehrere User mit gleicher E-Mail", async () => {
      supabaseMock.queryMock.limit.mockResolvedValue({
        data: [{id: "id1"}, {id: "id2"}],
        error: null,
      });

      const result = await repo.findByEmail("duplicate@test.ch");
      expect(result).toBeNull();
    });

    test("Fehler bei findByEmail() werfen", async () => {
      supabaseMock.queryMock.limit.mockResolvedValue({
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
    test("Öffentliches Profil laden", async () => {
      supabaseMock.queryMock.single.mockResolvedValue({
        data: userProfileRow,
        error: null,
      });

      const result = await repo.findPublicProfile("abc12345678901234567");

      expect(supabaseMock.client.from).toHaveBeenCalledWith("user_profiles");
      expect(supabaseMock.queryMock.eq).toHaveBeenCalledWith(
        "id",
        "abc12345678901234567"
      );
      expect(result.uid).toBe("abc12345678901234567");
      expect(result.displayName).toBe("TestUser");
      expect(result.memberId).toBe(42);
      expect(result.motto).toBe("Testing is caring");
      expect(result.pictureSrc).toEqual({
        smallSize: "https://example.com/small.jpg",
        normalSize: "https://example.com/normal.jpg",
        fullSize: "https://example.com/full.jpg",
      });
    });

    test("Stats mit Standardwerten (0) zurückgeben", async () => {
      supabaseMock.queryMock.single.mockResolvedValue({
        data: userProfileRow,
        error: null,
      });

      const result = await repo.findPublicProfile("abc12345678901234567");

      expect(result.stats).toEqual({
        noComments: 0,
        noEvents: 0,
        noRecipesPublic: 0,
        noRecipesPrivate: 0,
        noFoundBugs: 0,
      });
    });

    test("Fehler bei findPublicProfile() werfen", async () => {
      supabaseMock.queryMock.single.mockResolvedValue({
        data: null,
        error: {message: "Not found"},
      });

      await expect(
        repo.findPublicProfile("nonexistent")
      ).rejects.toEqual({message: "Not found"});
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

      const result = await repo.findFullProfile("abc12345678901234567");

      expect(result.uid).toBe("abc12345678901234567");
      expect(result.email).toBe("test@chuchipirat.ch");
      expect(result.firstName).toBe("Test");
      expect(result.displayName).toBe("TestUser");
      expect(result.stats).toEqual({
        noComments: 0,
        noEvents: 0,
        noRecipesPublic: 0,
        noRecipesPrivate: 0,
        noFoundBugs: 0,
      });
    });

    test("Fehler werfen wenn User nicht gefunden", async () => {
      supabaseMock.queryMock.single.mockResolvedValue({
        data: null,
        error: {code: "PGRST116", message: "No rows found"},
      });

      await expect(repo.findFullProfile("nonexistent")).rejects.toThrow(
        "User not found: nonexistent"
      );
    });
  });

  /* ------------------------------------------
  // registerSignIn()
  // ------------------------------------------ */
  describe("registerSignIn()", () => {
    test("Login-Daten aktualisieren", async () => {
      // registerSignIn calls: from().select().eq().single() then from().update().eq()
      // We need eq() to return an object with single() for the first call
      // and a resolved promise for the second call (update)
      let eqCallCount = 0;
      supabaseMock.queryMock.eq.mockImplementation(() => {
        eqCallCount++;
        if (eqCallCount === 1) {
          // First call: select chain → needs .single()
          return {
            single: jest.fn().mockResolvedValue({
              data: {no_logins: 5},
              error: null,
            }),
          };
        }
        // Second call: update chain → resolves directly
        return Promise.resolve({data: null, error: null});
      });

      await repo.registerSignIn("abc12345678901234567");

      // Verify select was called to read current count
      expect(supabaseMock.queryMock.select).toHaveBeenCalledWith("no_logins");
      // Verify update was called with incremented count
      expect(supabaseMock.queryMock.update).toHaveBeenCalled();
      const updateCall = supabaseMock.queryMock.update.mock.calls[0][0];
      expect(updateCall.no_logins).toBe(6);
      expect(updateCall.last_login).toBeDefined();
    });

    test("Fehler beim Lesen werfen", async () => {
      supabaseMock.queryMock.eq.mockReturnValue({
        single: jest.fn().mockResolvedValue({
          data: null,
          error: {message: "Read failed"},
        }),
      });

      await expect(
        repo.registerSignIn("abc12345678901234567")
      ).rejects.toEqual({message: "Read failed"});
    });
  });
});
