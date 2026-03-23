/**
 * UI-Textkonstanten für Authentifizierung (Anmeldung, Registrierung,
 * Passwort, E-Mail-Verifizierung, Reauthentifizierung).
 */

/* =====================================================================
// SignIn / SignUp
// ===================================================================== */
export const VERIFY_YOUR_EMAIL =
  "Kontrolliere bitte deine E-Mail: Schau in deinem Postfach nach (auch im Spam-Ordner), ob du eine Nachricht bekommen hast. Klicke auf den Link in der E-Mail, um deine E-Mail-Adresse zu bestätigen. Falls nötig, kannst du die Bestätigungs-E-Mail erneut anfordern.";
export const VERIFICATION_EMAIL_SENT =
  "Die E-Mail zur Bestätigung wurde verschickt. Schau in deinen E-Mails (auch im Spam-Ordner) nach der Bestätigungs-E-Mail. Nachdem du die E-Mail bestätigt hast, aktualisiere bitte diese Seite.";
export const SIGN_UP_SUCCESS_TITLE = "Fast geschafft!";
export const SIGN_UP_SUCCESS_TEXT =
  "Wir haben dir eine Bestätigungs-E-Mail gesendet. Bitte prüfe dein Postfach (auch den Spam-Ordner) und klicke auf den Link in der E-Mail, um deine Registrierung abzuschliessen. Danach kannst du dich anmelden.";
export const SIGN_IN_EMAIL_NOT_CONFIRMED_TITLE =
  "E-Mail-Adresse nicht bestätigt";
export const SIGN_IN_EMAIL_NOT_CONFIRMED_TEXT =
  "Deine E-Mail-Adresse wurde noch nicht bestätigt. Bitte prüfe dein Postfach (auch den Spam-Ordner) und klicke auf den Bestätigungslink.";
export const RESEND_CONFIRMATION_EMAIL = "Bestätigungs-E-Mail erneut senden";
export const RESEND_CONFIRMATION_EMAIL_SUCCESS =
  "Die Bestätigungs-E-Mail wurde erneut gesendet. Bitte prüfe dein Postfach (auch den Spam-Ordner).";
export const NO_AUTH_REDIRECT_TO_HOME =
  "Für die angeforderte Seite hast du keine Berechtigung. Du wirst automatisch umgeleitet.";
export const NOT_REGISTERED_YET_SIGN_UP = "Noch keinen Account? Melde dich an!";
export const EMAIL_HAS_BEEN_CHANGED = "Deine E-Mail-Adresse wurden geändert. ";
export const EMAIL_CHANGE_CONFIRMATION_SENT =
  "Wir haben eine Bestätigungs-E-Mail an die neue Adresse gesendet. Bitte prüfe dein Postfach (auch den Spam-Ordner) und klicke auf den Link, um die Änderung abzuschliessen.";
export const EMAIL_CHANGE_CONFIRMED_TITLE = "E-Mail-Adresse geändert";
export const EMAIL_CHANGE_CONFIRMED_TEXT =
  "Deine E-Mail-Adresse wurde erfolgreich aktualisiert.";
export const EMAIL_CHANGE_CONFIRMED_REDIRECT = (seconds: number) =>
  `Du wirst in ${seconds} Sekunden auf dein Profil weitergeleitet.`;
export const EMAIL_CHANGE_CONFIRMED_GO_TO_PROFILE = "Direkt zum Profil";
export const SIGN_IN_WHY_REAUTHENTICATE = "Bitte authentifiziere dich erneut.";
export const LOGIN_SUCCESSFULL = "Login erfolgreich";
export const SIGN_UP_NOT_ALLOWED_TITLE = "Wohin des Weges Pirat?";
export const SIGN_UP_NOT_ALLOWED_TEXT =
  "Aktuell sind keine Neuanmeldungen möglich. Danke fürs Verständnis. Wenn du schon einen Account hast, kannst du dich ganz normal einloggen.";
export const MAINTENANCE_MODE_SIGN_UP_NOT_ALLOWED =
  "chuchipirat macht Pause: Wartungsmodus aktiviert";
export const MAINTENANCE_MODE_SIGN_UP_NOT_ALLOWED_TEXT =
  "Oh-oh! Der chuchipirat macht gerade eine kleine Pause, um seine digitalen Schaltkreise zu überprüfen und ein paar virtuelle Schrauben nachzuziehen. Bitte warte einen Moment, während er seine Wartungsarbeiten durchführt und dann mit frischer Energie zurückkehrt!";
export const SIGN_UP_ACCEPT_TERMS_INTRO =
  "Indem du fortfährst, akzeptierst du:";
export const SIGN_UP_TERM_OF_USE_PREFIX = "die";
export const SIGN_UP_TERM_OF_USE_SUFFIX = "für den chuchipirat.";
export const SIGN_UP_PRIVACY_POLICY_SUFFIX = "des chuchipirats.";
export const PRIVACY_POLICY_DIALOG_TITLE =
  "Datenschutzerklärung für die Webapp chuchipirat";

/* =====================================================================
// Password
// ===================================================================== */
export const PASSWORD_RESET_EXPIRED =
  "Deine Anfrage zum Zurücksetzen des Passworts ist abgelaufen oder der Link wurde bereits verwendet. Versuche erneut das ";
export const PASSWORD_MAGIC_LINK_IN_INBOX =
  "Schau in deinem E-Mail-Postfach für den magischen Link, um das Passwort zurückzusetzen.";
export const PASSWORD_HAS_BEEN_CHANGED = "Das Passwort wurde geändert.";
export const PASSWORD_LINK_SENT =
  "Schau in deinem E-Mail-Postfach für den magischen Link um das Passwort zurückzusetzen.";
export const PASSWORD_CHANGE_ARE_YOU_READY = "Bereit für ein neues Passwort?";
export const PASSWORD_WHERE_SEND_MAGIC_LINK =
  "Wohin soll der magische Link zugestellt werden?";
export const PASSWORD_CHANGE = "Passwort ändern";
export const PASSWORD_RESET = "Passwort zurücksetzen";
export const HAVE_YOU_FORGOTEN_YOUR_PASSWORD =
  "Hast du möglicherweise dein Passwort vergessen? ";
export const PASSWORD_RESET_SUCCESS_TITLE = "Passwort geändert";
export const PASSWORD_RESET_SUCCESS_TEXT =
  "Dein Passwort wurde erfolgreich geändert. Du kannst dich jetzt mit deinem neuen Passwort anmelden.";
export const PASSWORD_RESET_SUCCESS_REDIRECT = (seconds: number) =>
  `Du wirst in ${seconds} Sekunden weitergeleitet.`;
export const PASSWORD_RESET_GO_TO_SIGN_IN = "Direkt zur Anmeldung";
export const PLEASE_WAIT = "Einen Moment...";

export const PASSWORDS_DONT_MATCH = "Passwörter stimmen nicht überein";
export const PASSWORD_REQUIREMENTS_HINT = "Mindestens 6 Zeichen";
export const CONFIRM_PASSWORD = "Passwort bestätigen";

export const PASSWORD_HOW_STRONG_IS_IT = "Die Stärke deines Passwortes ist: ";
export const PASSWORD_STRENGTH_METER = {
  WEAK: "Schwach",
  SUFFICENT: "Ausreichend",
  GOOD: "Gut",
  STRONG: "Stark",
};

/* =====================================================================
// Auth-Service-Handler
// ===================================================================== */
export const AUTH_SERVICE_HANDLER_NO_MODE =
  "Bitte prüfe, ob du die richtige URL gewählt hast. Falls du einen Link aus einer E-Mail verwendet hast, versuche den Vorgang erneut zu starten.";
export const AUTH_SERVICE_HANDLER_NO_MODE_TITLE = "Link nicht erkannt";
export const AUTH_SERVICE_HANDLER_NO_MODE_SUBTITLE =
  "Hmmm, was ist denn hier los?";
export const AUTH_SERVICE_HANDLER_EXPIRED_LINK_TITLE = "Link abgelaufen";
export const AUTH_SERVICE_HANDLER_EXPIRED_LINK_SUBTITLE = "Ups, zu spät dran!";
export const AUTH_SERVICE_HANDLER_EXPIRED_LINK_TEXT =
  "Der Link ist abgelaufen oder wurde bereits verwendet. Bitte fordere über die Anmeldeseite einen neuen Link an.";
