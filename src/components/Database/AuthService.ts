import {
  AuthChangeEvent,
  AuthError,
  Session,
  Subscription,
  User,
} from "@supabase/supabase-js";
import {supabase, supabaseAdmin} from "./supabaseClient";

/**
 * AuthService — Kapselt alle Supabase Auth Methoden.
 *
 * Ersetzt schrittweise die Authentifizierungs-Methoden aus firebase.class.ts.
 * Während der Migrationsphase (Phase 2) werden beide Auth-Provider parallel
 * betrieben: Supabase Auth als primärer Provider, Firebase Auth als Fallback
 * für noch nicht migrierte Benutzer.
 *
 * @example
 * const authService = new AuthService();
 * const session = await authService.signInWithPassword("user@example.com", "pw");
 */
export class AuthService {
  /* =====================================================================
  // Anmeldung mit E-Mail und Passwort
  // ===================================================================== */
  /**
   * Meldet einen Benutzer mit E-Mail und Passwort über Supabase Auth an.
   *
   * @param email - E-Mail-Adresse des Benutzers
   * @param password - Passwort des Benutzers
   * @returns Die aktive Session nach erfolgreicher Anmeldung
   * @throws {AuthError} Bei ungültigen Anmeldedaten oder Netzwerkfehler
   */
  async signInWithPassword(email: string, password: string): Promise<Session> {
    const {data, error} = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;
    if (!data.session) throw new Error("No session returned after sign-in");

    return data.session;
  }

  /* =====================================================================
  // Neuen Account registrieren
  // ===================================================================== */
  /**
   * Erstellt einen neuen Supabase Auth Account.
   *
   * Bei aktivierter E-Mail-Bestätigung wird keine Session zurückgegeben —
   * der Benutzer muss zuerst den Link in der Bestätigungs-E-Mail anklicken.
   * Supabase sendet die Bestätigungs-E-Mail automatisch.
   *
   * @param email - E-Mail-Adresse des neuen Benutzers
   * @param password - Gewähltes Passwort
   * @param options - Optionale Zusatzdaten
   * @param options.displayName - Anzeigename für das Auth-Profil (user_metadata)
   * @returns Der erstellte User (noch nicht bestätigt)
   * @throws {AuthError} Bei bereits existierender E-Mail oder ungültigem Passwort
   */
  async signUp(
    email: string,
    password: string,
    options?: {displayName?: string},
  ): Promise<User> {
    const {data, error} = await supabase.auth.signUp({
      email,
      password,
      options: {
        ...(options?.displayName
          ? {data: {display_name: options.displayName}}
          : {}),
        emailRedirectTo: `${window.location.origin}/authservicehandler`,
      },
    });

    if (error) throw error;
    if (!data.user) throw new Error("No user returned after sign-up");

    return data.user;
  }

  /* =====================================================================
  // Bestätigungs-E-Mail erneut senden
  // ===================================================================== */
  /**
   * Sendet die Bestätigungs-E-Mail erneut an eine noch nicht verifizierte
   * E-Mail-Adresse. Nutzt den Supabase `resend`-Mechanismus.
   *
   * @param email - E-Mail-Adresse des noch nicht bestätigten Benutzers
   * @throws {AuthError} Bei ungültiger E-Mail oder Netzwerkfehler
   */
  async resendConfirmationEmail(email: string): Promise<void> {
    const {error} = await supabase.auth.resend({
      type: "signup",
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/authservicehandler`,
      },
    });
    if (error) throw error;
  }

  /* =====================================================================
  // Bestätigten Benutzer erstellen (Admin, ohne E-Mail-Verifizierung)
  // ===================================================================== */
  /**
   * Erstellt einen neuen Supabase Auth Account mit bereits bestätigter
   * E-Mail-Adresse. Wird für die stille Migration von Firebase-Benutzern
   * verwendet, die ihre E-Mail bereits über Firebase verifiziert haben.
   *
   * Verwendet den Admin-Client (Service Role Key), um die E-Mail-Bestätigung
   * zu überspringen.
   *
   * @param email - E-Mail-Adresse des Benutzers
   * @param password - Passwort des Benutzers
   * @param options - Optionale Zusatzdaten
   * @param options.displayName - Anzeigename für das Auth-Profil
   * @returns Der erstellte User mit bestätigter E-Mail
   * @throws {Error} Wenn der Admin-Client nicht verfügbar ist
   * @throws {AuthError} Bei bereits existierender E-Mail oder ungültigem Passwort
   */
  async createConfirmedUser(
    email: string,
    password: string,
    options?: {displayName?: string},
  ): Promise<User> {
    if (!supabaseAdmin) {
      throw new Error("Admin client not available");
    }

    const {data, error} = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: options?.displayName
        ? {display_name: options.displayName}
        : undefined,
    });

    if (error) throw error;
    return data.user;
  }

  /* =====================================================================
  // Passwort eines Benutzers administrativ aktualisieren
  // ===================================================================== */
  /**
   * Aktualisiert das Passwort eines Benutzers über den Admin-Client.
   *
   * Wird verwendet, wenn ein bereits migrierter Benutzer sich mit dem
   * Firebase-Passwort anmeldet, das vom Supabase-Passwort abweicht.
  /* =====================================================================
  // Abmelden
  // ===================================================================== */
  /**
   * Meldet den aktuellen Benutzer von Supabase Auth ab.
   * Firebase Sign-Out muss separat aufgerufen werden, falls der Benutzer
   * noch über Firebase authentifiziert ist.
   *
   * @throws {AuthError} Bei Netzwerkfehler
   */
  async signOut(): Promise<void> {
    const {error} = await supabase.auth.signOut();
    if (error) throw error;
  }

  /* =====================================================================
  // Passwort zurücksetzen (E-Mail versenden)
  // ===================================================================== */
  /**
   * Sendet eine Passwort-Zurücksetzen-E-Mail über Supabase Auth.
   * Der Benutzer erhält einen Link mit einem Token, über den das
   * neue Passwort gesetzt werden kann.
   *
   * @param email - E-Mail-Adresse des Benutzers
   * @throws {AuthError} Bei ungültiger E-Mail oder Netzwerkfehler
   */
  async resetPassword(email: string): Promise<void> {
    const {error} = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/authservicehandler`,
    });
    if (error) throw error;
  }

  /* =====================================================================
  // Passwort aktualisieren
  // ===================================================================== */
  /**
   * Setzt ein neues Passwort für den aktuell authentifizierten Benutzer.
   * Kann sowohl nach einem Reset-Link als auch im eingeloggten Zustand
   * verwendet werden.
   *
   * @param password - Das neue Passwort
   * @throws {AuthError} Bei ungültigem Passwort oder fehlender Session
   */
  async updatePassword(password: string): Promise<void> {
    const {error} = await supabase.auth.updateUser({password});
    if (error) throw error;
  }

  /* =====================================================================
  // E-Mail-Adresse ändern
  // ===================================================================== */
  /**
   * Aktualisiert die E-Mail-Adresse des aktuell authentifizierten Benutzers.
   *
   * Supabase sendet automatisch eine Bestätigungs-E-Mail an die neue Adresse.
   * Nach Bestätigung wird der Benutzer auf `/authservicehandler` weitergeleitet,
   * wo die Änderung in `public.users` und im localStorage übernommen wird.
   *
   * @param newEmail - Die neue E-Mail-Adresse
   * @throws {AuthError} Bei ungültiger E-Mail oder fehlender Session
   */
  async updateEmail(newEmail: string): Promise<void> {
    const {error} = await supabase.auth.updateUser(
      {email: newEmail},
      {emailRedirectTo: `${window.location.origin}/authservicehandler`},
    );
    if (error) throw error;
  }

  /* =====================================================================
  // Auth-State-Listener
  // ===================================================================== */
  /**
   * Registriert einen Listener für Auth-State-Änderungen.
   * Analog zu Firebase onAuthStateChanged — wird bei Login, Logout,
   * Token-Refresh und Password-Recovery ausgelöst.
   *
   * @param callback - Wird bei jeder Auth-State-Änderung aufgerufen
   * @returns Unsubscribe-Funktion zum Entfernen des Listeners
   */
  onAuthStateChange(
    callback: (event: AuthChangeEvent, session: Session | null) => void,
  ): () => void {
    const {data} = supabase.auth.onAuthStateChange(callback);
    return () => {
      data.subscription.unsubscribe();
    };
  }

  /* =====================================================================
  // Aktuellen Benutzer holen
  // ===================================================================== */
  /**
   * Gibt den aktuell authentifizierten Supabase-Benutzer zurück.
   *
   * @returns Der aktuelle User oder null, falls nicht angemeldet
   */
  async getUser(): Promise<User | null> {
    const {data} = await supabase.auth.getUser();
    return data.user;
  }

  /* =====================================================================
  // Aktuelle Session holen
  // ===================================================================== */
  /**
   * Gibt die aktuelle Supabase-Session zurück.
   *
   * @returns Die aktive Session oder null, falls nicht angemeldet
   */
  async getSession(): Promise<Session | null> {
    const {data} = await supabase.auth.getSession();
    return data.session;
  }
}

export default AuthService;
