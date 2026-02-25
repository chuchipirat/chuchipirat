import {UserRepository} from "./Repository/UserRepository";

/* =====================================================================
// DatabaseService — Zentraler Einstiegspunkt für Datenbankzugriff
// Ersetzt die DB-bezogenen Teile von firebase.class.ts.
// Neue Repositories werden hier als Properties ergänzt,
// sobald sie implementiert sind (z.B. EventRepository, RecipeRepository).
// ===================================================================== */

/**
 * Zentraler Service für den Zugriff auf die Supabase/Postgres-Datenbank.
 *
 * Bündelt alle Repository-Instanzen und wird über den DatabaseContext
 * in der App bereitgestellt. Entspricht dem Firebase-Pendant
 * `firebase.user`, `firebase.event` usw. — nur mit Repository-Pattern.
 *
 * @property users - Repository für Benutzer-CRUD-Operationen
 */
export class DatabaseService {
  users: UserRepository;

  constructor() {
    this.users = new UserRepository();
  }
}

export default DatabaseService;
