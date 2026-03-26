/**
 * UI-Textkonstanten für das Spenden-Modul.
 */

/* =====================================================================
// Spendenseite
// ===================================================================== */
export const DONATION_TRANSPARENCY_TEXT =
  "Unser Team arbeitet ehrenamtlich, um die App kostenlos anzubieten. " +
  "Wir sind auf Spenden angewiesen, um die laufenden Kosten zu decken. " +
  "Wenn dir die App gefällt und dein Anlassbudget es zulässt, unterstütze " +
  "uns gerne mit einer Spende. Dein Beitrag hilft, das Angebot weiterhin " +
  "kostenlos anbieten zu können sowie die App am Laufen zu halten und " +
  "weiter zu verbessern.";

export const DONATION_AMOUNT_LABEL = "Betrag";
export const DONATION_MESSAGE_LABEL = "Nachricht (optional)";
export const DONATION_MESSAGE_PLACEHOLDER = "Deine Nachricht an uns...";
export const DONATION_SUBMIT = "Jetzt spenden";
export const DONATION_MIN_AMOUNT = "Mindestbetrag: CHF 5.00";
export const DONATION_CUSTOM_AMOUNT = "Anderer Betrag";

/* =====================================================================
// Spendenergebnis
// ===================================================================== */
export const DONATION_RESULT_SUCCESS_TITLE = "Vielen Dank für deine Spende!";
export const DONATION_RESULT_SUCCESS_TEXT =
  "Deine Zahlung wird verarbeitet. Du erhältst in Kürze eine Bestätigung per E-Mail.";
export const DONATION_RESULT_FAILED_TITLE =
  "Zahlung konnte nicht verarbeitet werden";
export const DONATION_RESULT_FAILED_TEXT =
  "Leider ist bei der Zahlung ein Fehler aufgetreten. Bitte versuche es erneut.";
export const DONATION_RESULT_CANCEL_TITLE = "Zahlung abgebrochen";
export const DONATION_RESULT_CANCEL_TEXT =
  "Du hast die Zahlung abgebrochen. Du kannst es jederzeit erneut versuchen.";
export const DONATION_RESULT_CONTINUE = "Weiter";
export const DONATION_RESULT_RETRY = "Erneut versuchen";

/* =====================================================================
// Spendenziel-Widget
// ===================================================================== */
export const DONATION_GOAL_TITLE = "Spendenziel";
export const DONATION_GOAL_YEAR_TARGET = (year: number) => `Jahresziel ${year}`;
export const DONATION_GOAL_OF = "von";
export const DONATION_GOAL_REACHED = "Ziel erreicht!";
export const DONATION_GOAL_DONORS = (count: number) =>
  `${count} Spender*${count === 1 ? "in" : "innen"}`;

/* =====================================================================
// Admin-Übersicht
// ===================================================================== */
export const DONATIONS_OVERVIEW = "Spendenübersicht";
export const DONATIONS_OVERVIEW_DESCRIPTION =
  "Alle eingegangenen Spenden mit Status und Details.";
export const DONATION_STATUS_LABEL = "Status";
export const DONATION_PAYMENT_METHOD = "Zahlungsmethode";
export const DONATION_DONOR = "Spender*in";
export const DONATION_RECEIPT_NUMBER = "Quittungsnummer";
export const DONATION_RESEND_RECEIPT = "Quittung erneut senden";
export const DONATION_TOTAL_THIS_YEAR = "Total dieses Jahr";
export const DONATION_UNIQUE_DONORS = "Eindeutige Spender*innen";
export const DONATION_AVERAGE = "⌀ Spende";

/* =====================================================================
// Spendenziel-Verwaltung (Admin)
// ===================================================================== */
export const DONATION_GOALS_ADMIN = "Spendenziele verwalten";
export const DONATION_GOALS_ADMIN_DESCRIPTION =
  "Spendenziel-Abschnitte für das Jahres-Widget anlegen, bearbeiten und löschen.";
export const DONATION_GOAL_LABEL = "Bezeichnung";
export const DONATION_GOAL_TARGET = "Zielbetrag (CHF)";
export const DONATION_GOAL_SORT_ORDER = "Reihenfolge";
export const DONATION_GOAL_YEAR = "Jahr";
export const DONATION_GOAL_ADD = "Abschnitt hinzufügen";
export const DONATION_GOAL_DELETE_CONFIRM =
  "Soll dieser Spendenziel-Abschnitt wirklich gelöscht werden?";
export const DONATION_GOAL_SAVED = "Spendenziel gespeichert.";
export const DONATION_GOAL_DELETED = "Spendenziel gelöscht.";

/* =====================================================================
// Event-Wizard Erfolgsmeldung
// ===================================================================== */
export const DONATION_EVENT_READY = (eventName: string) =>
  `Dein Anlass «${eventName}» ist bereit!`;
export const DONATION_EVENT_READY_SUBTEXT =
  "Es geht gleich weiter — kurz noch ein Wort zu chuchipirat:";

/* =====================================================================
// Spendenappell
// ===================================================================== */
export const DONATION_APPEAL_TEXT =
  "chuchipirat wird ehrenamtlich entwickelt und ist kostenlos für alle. Um Server, Betrieb und Vereinskosten zu decken, sind wir auf Spenden angewiesen.";

/* =====================================================================
// Kostenaufschlüsselung
// ===================================================================== */
export const DONATION_COST_SERVER_LABEL = "Server & Betrieb";
export const DONATION_COST_SERVER_AMOUNT = "CHF 400 / Jahr";
export const DONATION_COST_SERVER_DETAILS =
  "Server, Domain, E-Mail Service usw.";
export const DONATION_COST_ASSOCIATION_LABEL = "Vereinskosten";
export const DONATION_COST_ASSOCIATION_AMOUNT = "CHF 200 / Jahr";
export const DONATION_COST_ASSOCIATION_DETAILS =
  "Administration, Kontoführungsgebühren, Vereinsleben usw.";

/* =====================================================================
// Fortschrittsbalken
// ===================================================================== */
export const DONATION_GOAL_REACHED_EXTENDED =
  "Jahresziel erreicht! Jede weitere Spende hilft uns, chuchipirat noch besser zu machen.";
export const DONATION_GOAL_PROGRESS = (
  current: string,
  target: string,
  year: number,
) => `${current} von ${target} — Jahresziel ${year}`;

/* =====================================================================
// Buttons
// ===================================================================== */
export const DONATION_SKIP_TO_EVENT = "Weiter zum Anlass";
export const DONATION_RECEIPT_DOWNLOAD = "Spendenquittung";

/* =====================================================================
// Fehlermeldungen
// ===================================================================== */
export const DONATION_ERROR_CREATE = "Fehler beim Erstellen der Spende";
export const DONATION_ERROR_NO_URL = "Keine Zahlungs-URL erhalten";
export const DONATION_ERROR_GENERIC = "Ein unerwarteter Fehler ist aufgetreten";

/* =====================================================================
// Spendenquittung V2 (Thank-You Card)
// ===================================================================== */
export const DONATION_RECEIPT_TITLE = "Spendenquittung";
export const DONATION_RECEIPT_URL = "chuchipirat.ch";
export const DONATION_RECEIPT_THANK_YOU_NAME = (name: string) =>
  `Herzlichen Dank, ${name}!`;
export const DONATION_RECEIPT_PERSONAL_MESSAGE =
  "Deine Spende hilft uns, chuchipirat weiterzuentwickeln und kostenlos anzubieten.";

/* =====================================================================
// Platzhalter
// ===================================================================== */
export const DONATION_CUSTOM_PLACEHOLDER = "z.B. 15";

/* =====================================================================
// Fallback (DonationResult)
// ===================================================================== */
export const DONATION_RESULT_UNKNOWN_TITLE = "Unbekannter Status";
export const DONATION_RESULT_UNKNOWN_TEXT =
  "Der Status der Zahlung konnte nicht ermittelt werden.";
