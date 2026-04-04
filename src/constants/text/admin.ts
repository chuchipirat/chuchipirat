/**
 * UI-Textkonstanten für den Admin-Bereich (Einstellungen, Systemmeldungen,
 * Mail-Konsole, Migration, Übersichten, Datenoperationen).
 */

/* =====================================================================
// Systemmeldungen & Globale Einstellungen
// ===================================================================== */
export const GLOBAL_SETTINGS = "Globale Einstellungen";
export const SYSTEM_MESSAGE = "Systemmeldung";
export const SYSTEM_MESSAGES = "Systemmeldungen";
export const NEW_SYSTEM_MESSAGE = "Neue Systemmeldung";
export const EDIT_SYSTEM_MESSAGE = "Systemmeldung bearbeiten";
export const DELETE_SYSTEM_MESSAGE = "Systemmeldung löschen";
export const DELETE_SYSTEM_MESSAGE_CONFIRMATION =
  "Möchtest du diese Systemmeldung wirklich löschen?";
export const SHOW_EXPIRED_MESSAGES = "Vergangene Meldungen anzeigen";
export const SYSTEM_MESSAGE_DELETED = "Systemmeldung gelöscht";
export const SYSTEM_MESSAGE_SAVED = "Systemmeldung gespeichert";
export const ATENTION_IMPORTANT_ANNOUNCEMENT =
  "Achtung, Achtung, wichtige Durchsage!";
export const DELETE_FEED = "Feed-Einträge löschen";
export const WHERE_USED = "Verfolgungsnachweis";
export const MERGE_ITEMS_DESCRIPTION =
  "Produkte/Materialien zusammenführen in Rezepten, Menüplänen, Einkaufslisten und Stammdaten.";
export const CONVERT_PRODUCT_ITEM_DESCRIPTION =
  "Produkte zu einem Material (oder umgekeht) umwandlen und die betroffenen Rezepte anpassen";

export const WHERE_USED_DESCRIPTION =
  "Verfolgungsnachweis für Produkte und Rezepte. ";

/* =====================================================================
// Migration
// ===================================================================== */
export const MIGRATION = "Migration";
export const MIGRATION_DESCRIPTION =
  "Daten von Firebase nach Postgres migrieren.";
export const MIGRATION_SELECT_OBJECT = "Objekt auswählen";
export const MIGRATION_DRY_RUN = "Testlauf (kein Schreiben)";
export const MIGRATION_START = "Migration starten";
export const MIGRATION_CANCEL = "Abbrechen";
export const MIGRATION_STATS_TOTAL = "Total Quelldatensätze";
export const MIGRATION_STATS_ALREADY_MIGRATED = "Bereits migriert";
export const MIGRATION_STATS_SUCCESS = "Erfolgreich migriert";
export const MIGRATION_STATS_FAILED = "Fehlgeschlagen";
export const MIGRATION_STATS_CURRENT = "Aktueller Datensatz";
export const MIGRATION_PHASE_FETCHING = "Quelldaten werden geladen…";
export const MIGRATION_PHASE_RUNNING = "Migration läuft…";
export const MIGRATION_PHASE_COMPLETED = "Migration abgeschlossen";
export const MIGRATION_PHASE_CANCELLED = "Migration abgebrochen";
export const MIGRATION_LOG_TITLE = "Protokoll";
export const MIGRATION_FIREBASE_SIGN_IN_TITLE = "Firebase-Anmeldung";
export const MIGRATION_FIREBASE_SIGN_IN_DESCRIPTION =
  "Für den Zugriff auf Firebase-Daten wird eine separate Anmeldung benötigt.";
export const MIGRATION_FIREBASE_SIGN_IN_BUTTON = "Firebase anmelden";
export const MIGRATION_FIREBASE_CONNECTED = "Firebase verbunden";

/* =====================================================================
// Übersichten
// ===================================================================== */
export const OVERVIEW_RECIPES_DESCRIPTION = "Übersicht über alle Rezepte";
export const OVERVIEW_EVENTS_DESCRIPTION = "Übersicht über alle Alässe";

/* =====================================================================
// Mail-Konsole
// ===================================================================== */
export const MAIL_CONSOLE = "Mail-Konsole";
export const MAIL_CONSOLE_DESCRIPTION =
  "Versenden von E-Mail an unsere Nutzer*innen";
export const BECAUSE_NEWSLETTER_ARE_ALWAYS_LOVED =
  "Weil wir dachten, dein Posteingang könnte ein bisschen mehr Aufregung vertragen.";
export const EDITOR = "Editor";
export const SUBJECT = "Betreff";
export const TITLE = "Titel";
export const SUB_TITLE = "Untertitel";
export const MAILTEXT = "E-Mail Nachricht";
export const DIVIDE_MULTIPLE_VALUES_BY_SEMICOLON =
  "Trenne mehrere Werte mit Semmikolon.";
export const ROLES_UPDATED_SUCCSESSFULLY = "Berechtigung wurde aktualisiert";
export const YOU_CANT_UPDATE_YOUR_OWN_AUTHORIZATION =
  "Du kannst deine eigene Berechtigung nicht anpassen.";
export const PREVIEW = "Vorschau";
export const SEND_TEST_MAIL = "Test Mail senden";
export const BUTTON_TEXT = "Button-Beschriftung";
export const BUTTON_LINK = "Link für Button (Ziel)";
export const RECIPIENTS = "Empfänger";
export const NO_RECIPIENTS = "Anzahl Empfänger";
export const MAIL_TEMPLATE = "Mail-Template";
export const MAIL_SEND_CONFIRMATION_TITLE = "Mail versenden?";
export const MAIL_SEND_CONFIRMATION_TEXT = (count: number) =>
  `Du sendest diese Mail an ${count} Empfänger. Möchtest du fortfahren?`;
export const MAIL_RECIPIENTS_DETECTED = (count: number) =>
  `${count} Empfänger erkannt`;
export const MAIL_SEND_TO_N_RECIPIENTS = (count: number) =>
  `Mail an ${count} Empfänger senden`;
export const MAIL_SEND_RESULT_TITLE = "Versand-Ergebnis";
export const MAIL_SEND_RESULT_SUCCESS = (count: number) =>
  `${count} erfolgreich zugestellt`;
export const MAIL_SEND_RESULT_ERRORS = (count: number) =>
  `${count} fehlgeschlagen`;
export const MAIL_TEMPLATE_EMPTY = "Leere Vorlage";
export const MAIL_TEMPLATE_MAINTENANCE = "Wartungshinweis";
export const MAIL_TEMPLATE_FEATURE = "Feature-Ankündigung";
export const MAIL_TEMPLATE_EVENT = "Event-Erinnerung";
export const MAIL_DRAFT_RESTORED = "Entwurf wiederhergestellt";
export const MAIL_DRAFT_CLEAR = "Entwurf löschen";
export const MAIL_TRANSPORT_HELP =
  "Auto: Brevo bevorzugt, SMTP als Fallback. Erzwinge einen Kanal zum Testen.";
export const SEND = "Senden";
export const MAIL_SEND_REQUIRES_TEST =
  "Sende zuerst eine Testmail an dich selbst, um die Mail zu prüfen.";
export const TIMESTAMP = "Timestamp";
export const MAILS = "E-Mails";

/* =====================================================================
// Texte zum Admin-Bereich (Datenoperationen, Berechtigungen)
// ===================================================================== */
export const MERGE_PRODUCT_SELECTION = "Produkteauswahl";
export const MERGE_MATERIAL_SELECTION = "Materialauswahl";

export const MERGE_ITEM_EXPLANATION = (item: string) =>
  `Das ${item} A wird zu ${item} B. Alle Vorkommnisse des ${item} A (Rezepte, Menüplan, Einkaufslisten) werden angepasst. Nach erfolgreicher Änderungen der betroffenen Objekte wird das ${item} A gelöscht und steht nicht mehr zur Verfügung.`;
export const CONVERT_ITEM_EXPLANATION = (fromItem: string, toItem: string) =>
  `Das gewählte ${fromItem} wird in ein ${toItem} umgewandelt. Dabei werden alle Rezepte, Menüpläne, Einkauf- und Materiallisten angepasst.`;
export const CHANGED_DOCUMENTS = "Geänderte Dokumente";
export const FOUND_REFERENCE = "Gefundene Verweise";
export const MERGE_ERROR_SAME_ITEMS = (item: string) =>
  `${item} A und ${item} B sind identisch. Ein Zusammenführen macht daher keinen Sinn.`;
export const GLOBAL_SETTINGS_ALLOW_SIGNUP_LABEL = "Neu-Anmeldung ermöglichen";
export const GLOBAL_SETTINGS_ALLOW_SIGNUP_DESCRIPTION =
  "Personen können ein Login für den chuchipirat erstellen (Neuanmeldung/Registrierung).";
export const GLOBAL_SETTINGS_MAINTENANCE_MODE_LABEL = "Wartungsmodus";
export const GLOBAL_SETTINGS_MAINTENANCE_MODE_DESCRIPTION =
  "Im Wartungsmodus ist eine (Neu-)Anmeldung nicht möglich.";
export const ACTIVATE_SUPPORT_USER = "Support-User aktivieren";
export const ACTIVATE_SUPPORT_USER_DESCRIPTION =
  "Den Support-User für einen Anlass berechtigen.";
export const SIGN_OUT_ALL_USERS = "Alle Benutzer*innen abmelden";
export const SIGN_OUT_ALL_USERS_DESCRIPTION =
  "Für alle Benutzer*innen (ausser Admin)\nein Log-Out durchführen.";
export const SIGN_OUT_EVERYBODY = "Alle abmelden";
export const USERS_ARE_LOGGED_OUT =
  "Benutzer*innen werden abgemeldet. Die Abmeldung wird innerhalb von einer Stunde wirksam.";
export const SECTION_SETTINGS = "Einstellungen";
export const SECTION_DATA_OPERATIONS = "Datenoperationen";
export const SECTION_OVERVIEWS = "Übersichten";
export const SECTION_EXTERNAL = "Extern";
export const OVERVIEW_USERS_DESCRIPTION = "Übersicht über alle Benutzer*innen";
export const OVERVIEW_FEEDS_DESCRIPTION = "Übersicht über alle Feed-Einträge";
export const OVERVIEW_MAILBOX_DESCRIPTION =
  "Übersicht über alle versendeten E-Mails";
export const CRON_JOBS = "Cron Jobs";
export const CRON_JOBS_DESCRIPTION =
  "Übersicht und Monitoring der geplanten Jobs";
export const CRON_JOBS_FILTER_ALL = "Alle Jobs";
export const CRON_JOBS_TRIGGER_NOW = "Jetzt auslösen";
export const CRON_JOBS_TRIGGER_SUCCESS = "Job wurde ausgelöst";
export const CRON_JOBS_TRIGGER_ERROR = "Job konnte nicht ausgelöst werden";
export const CRON_JOBS_DETAILS_TITLE = "Job-Details";
export const CRON_JOBS_NO_DETAILS = "Keine Details vorhanden";
export const DATA_INTEGRITY = "Datenintegrität";
export const DATA_INTEGRITY_DESCRIPTION = "Prüfung der Datenkonsistenz";
export const SENTRY_DASHBOARD = "Sentry Dashboard";
export const SUPABASE_DASHBOARD = "Supabase Dashboard";
export const ARE_YOU_SURE_YOU_WANT_TO_CHANGE =
  "Bist du sicher, dass du dieses Objekt ändern willst?";
export const EDIT_AUTHORIZATION = "Berechtigung bearbeiten";
export const EDIT_AUTHORIZATION_DESCRIPTION =
  "Alle darunterliegenden Berechtigungen werden automatisch mit vergeben.";
export const RE_SIGN_IN_REQUIRED = "Neu-Anmeldung nötig";
export const RE_SIGN_IN_REQUIRED_AFTER_ROLES_ASSIGNMENT =
  "Die vergebenen Rechte sind erst nach einer erneuten Anmeldung aktiv.";
export const EVENT_UID = "Event-UID";
export const ACTIVATE_SUPPORT_MODE = "Support-Modus aktivieren";
export const ACTIVATE_SUPPORT_MODE_DESCRIPTION =
  "Um den Support-Modus zu aktivieren, kannst du die UID eines Anlasses hier eingeben. Danach wird der Support-User für den angegebenen Anlass bis 01:00 Uhr Morgen früh berechtigt.";
export const SUPPORT_USER_REGISTERED =
  "Support-User wurde für Anlass berechtigt.";
export const MAILBOX = "Mailbox";
export const MONITOR = "Monitor";
export const OVERVIEW = "Übersicht";
export const RECIPIENT_TO = "An";
export const RECIPIENT_BCC = "BCC";
export const MAIL_DATA = "E-Mail-Inhalt";
export const DELETE_MAIL_PROTOCOLS = "Mailprotokolle löschen";
export const DELETE_MAIL_PROTOCOLS_OLDER_THAN =
  "Mailprotokolle löschen, die älter als X Tage sind";
export const MAIL_PROTOCOLS = "Mailprotokolle";
export const MAIL_PROTOCOLS_DELETED = "Mailprotokolle gelöscht";
export const X_FEEDS_DELETED = (no_of_deleted_feeds: string) =>
  `${no_of_deleted_feeds} Feed-Einträge gelöscht.`;
export const FEEDS = "Feed-Einträge";
export const DELETE_FEEDS = "Feeds löschen";
export const DELETE_FEEDS_OLDER_THAN =
  "Feeds löschen, die älter sind als (Tage)";
export const FEED_ENTRIES = "Feed-Einträge";
export const RECEIPT = "Quittung";
export const CREATE_RECEIPT = "Quittung erstellen";
export const PAY_DATE = "Bezahlt am";
export const DONOR = "Spender*in";
export const AMOUNT = "Betrag";
export const RECEIPT_THANK_YOU =
  "Danke für deine Spende. Deine Spende ermöglicht es, den chuchipirat weiterzuentwickeln und weiterhin kostenlos anzubieten.";
