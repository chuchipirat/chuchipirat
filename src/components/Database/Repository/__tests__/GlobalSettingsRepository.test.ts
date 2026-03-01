/**
 * Unit-Tests für GlobalSettingsRepository.
 *
 * Testet toRow/toDomain-Mapping und die Convenience-Methoden
 * getSettings() und saveSettings().
 */
import {
  GlobalSettingsRepository,
  GlobalSettingsDomain,
  GlobalSettingsRow,
} from "../GlobalSettingsRepository";
import {STORAGE_OBJECT_PROPERTY} from "../../../Firebase/Db/sessionStorageHandler.class";
import {createSupabaseMock} from "../__mocks__/supabaseMock";
import {AuthUser} from "../../../Firebase/Authentication/authUser.class";

/* =====================================================================
// Test-Daten
// ===================================================================== */
const testRow: GlobalSettingsRow = {
  id: "default",
  allow_sign_up: true,
  maintenance_mode: false,
  created_at: "2026-01-01T00:00:00Z",
  created_by: "45e3ab65-7c56-4f0d-8a39-6db543c43dd7",
  updated_at: "2026-01-01T00:00:00Z",
  updated_by: "45e3ab65-7c56-4f0d-8a39-6db543c43dd7",
};

const testDomain: GlobalSettingsDomain = {
  allowSignUp: true,
  maintenanceMode: false,
};

const authUser = {uid: "user-123", authUid: "auth-uuid-123"} as AuthUser;

/* =====================================================================
// Tests
// ===================================================================== */
describe("GlobalSettingsRepository", () => {
  let repo: GlobalSettingsRepository;
  let supabaseMock: ReturnType<typeof createSupabaseMock>;

  beforeEach(() => {
    supabaseMock = createSupabaseMock();
    repo = new GlobalSettingsRepository();
    (repo as any).client = supabaseMock.client;
  });

  /* ------------------------------------------
  // Grundlegende Properties
  // ------------------------------------------ */
  test("tableName ist 'global_settings'", () => {
    expect(repo.tableName).toBe("global_settings");
  });

  test("getCacheConfig() gibt GLOBAL_SETTINGS zurück", () => {
    expect(repo.getCacheConfig()).toBe(STORAGE_OBJECT_PROPERTY.GLOBAL_SETTINGS);
  });

  /* ------------------------------------------
  // toRow / toDomain
  // ------------------------------------------ */
  describe("toRow() / toDomain()", () => {
    test("toRow(): Domain → DB-Zeile", () => {
      const row = repo.toRow(testDomain);
      expect(row.allow_sign_up).toBe(true);
      expect(row.maintenance_mode).toBe(false);
    });

    test("toDomain(): DB-Zeile → Domain", () => {
      const domain = repo.toDomain(testRow);
      expect(domain.allowSignUp).toBe(true);
      expect(domain.maintenanceMode).toBe(false);
    });

    test("Roundtrip: toRow → toDomain ergibt Ursprungswerte", () => {
      const row = repo.toRow(testDomain) as GlobalSettingsRow;
      row.id = "default";
      row.created_at = "2026-01-01T00:00:00Z";
      row.created_by = "";
      row.updated_at = "2026-01-01T00:00:00Z";
      row.updated_by = "";
      const domain = repo.toDomain(row);
      expect(domain).toEqual(testDomain);
    });
  });

  /* ------------------------------------------
  // getSettings()
  // ------------------------------------------ */
  describe("getSettings()", () => {
    test("Lädt die Einstellungen via findById('default')", async () => {
      supabaseMock.queryMock.single.mockResolvedValue({
        data: testRow,
        error: null,
      });

      const result = await repo.getSettings();

      expect(supabaseMock.client.from).toHaveBeenCalledWith("global_settings");
      expect(supabaseMock.queryMock.eq).toHaveBeenCalledWith("id", "default");
      expect(result).toEqual(testDomain);
    });

    test("Gibt null zurück wenn keine Zeile existiert", async () => {
      supabaseMock.queryMock.single.mockResolvedValue({
        data: null,
        error: {code: "PGRST116", message: "No rows found"},
      });

      const result = await repo.getSettings();
      expect(result).toBeNull();
    });
  });

  /* ------------------------------------------
  // saveSettings()
  // ------------------------------------------ */
  describe("saveSettings()", () => {
    test("Aktualisiert die Einstellungen via update()", async () => {
      supabaseMock.queryMock.single.mockResolvedValue({
        data: {...testRow, maintenance_mode: true},
        error: null,
      });

      const updatedSettings: GlobalSettingsDomain = {
        allowSignUp: true,
        maintenanceMode: true,
      };

      const result = await repo.saveSettings(updatedSettings, authUser);

      expect(supabaseMock.queryMock.update).toHaveBeenCalled();
      expect(supabaseMock.queryMock.eq).toHaveBeenCalledWith("id", "default");
      expect(result.maintenanceMode).toBe(true);
    });

    test("Fehler bei saveSettings() werfen", async () => {
      supabaseMock.queryMock.single.mockResolvedValue({
        data: null,
        error: {message: "Update failed"},
      });

      await expect(
        repo.saveSettings(testDomain, authUser)
      ).rejects.toEqual({message: "Update failed"});
    });
  });
});
