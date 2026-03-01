import {AuthService} from "./AuthService";
import {UserRepository} from "./Repository/UserRepository";
import {UserStorageRepository} from "./Repository/UserStorageRepository";
import {GlobalSettingsRepository} from "./Repository/GlobalSettingsRepository";
import {SystemMessageRepository} from "./Repository/SystemMessageRepository";
import {supabaseAdmin} from "./supabaseClient";

/* =====================================================================
// DatabaseService — Zentraler Einstiegspunkt für Datenbankzugriff
// Ersetzt die DB-bezogenen Teile von firebase.class.ts.
// Neue Repositories werden hier als Properties ergänzt,
// sobald sie implementiert sind (z.B. EventRepository, RecipeRepository).
// ===================================================================== */

/**
 * Zentraler Service für den Zugriff auf die Supabase/Postgres-Datenbank.
 *
 * Bündelt alle Repository-Instanzen und den AuthService und wird über
 * den DatabaseContext in der App bereitgestellt. Entspricht dem
 * Firebase-Pendant `firebase.user`, `firebase.event` usw. — nur mit
 * Repository-Pattern.
 *
 * @property auth - Service für Supabase Auth Operationen
 * @property users - Repository für Benutzer-CRUD-Operationen (RLS aktiv)
 * @property globalSettings - Repository für globale Einstellungen
 * @property systemMessages - Repository für Systemmeldungen
 * @property storage - Storage-Repositories für Datei-Uploads (Bilder etc.)
 * @property admin - Admin-Repositories mit Service Role Key (umgeht RLS).
 *   Nur für Migration und Admin-Operationen verwenden. Ist `null`, falls
 *   der Service Role Key nicht konfiguriert ist.
 */
export class DatabaseService {
  auth: AuthService;
  users: UserRepository;
  globalSettings: GlobalSettingsRepository;
  systemMessages: SystemMessageRepository;
  storage: {users: UserStorageRepository};
  admin: {
    users: UserRepository;
    globalSettings: GlobalSettingsRepository;
    systemMessages: SystemMessageRepository;
    storage: {users: UserStorageRepository};
  } | null;

  constructor() {
    this.auth = new AuthService();
    this.users = new UserRepository();
    this.globalSettings = new GlobalSettingsRepository();
    this.systemMessages = new SystemMessageRepository();
    this.storage = {users: new UserStorageRepository()};
    this.admin = supabaseAdmin
      ? {
          users: new UserRepository(supabaseAdmin),
          globalSettings: new GlobalSettingsRepository(supabaseAdmin),
          systemMessages: new SystemMessageRepository(supabaseAdmin),
          storage: {users: new UserStorageRepository(supabaseAdmin)},
        }
      : null;
  }
}

export default DatabaseService;
