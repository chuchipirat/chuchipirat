/**
 * UI-Textkonstanten der Abrechnung für PDF-Abrechnung und Export (CSV, ZIP).
 */

/* =====================================================================
// PDF-Abrechnung: Dialog
// ===================================================================== */
export const CREATE_EXPENSE_REPORT = "Abrechnung erstellen (PDF)";
export const CREATE_EXPENSE_REPORT_NO_EXPENSES = "Erfasse zuerst eine Ausgabe.";
export const REPORT_PAYEE_SELECTION = "Für wen?";
export const REPORT_ALL_PAYEES = "Alle Personen";
/**
 * Eintrag einer Person in der Auswahl.
 *
 * @param displayName - Anzeigename der Person.
 * @param expenseCount - Anzahl ihrer Ausgaben.
 * @returns z.B. «Anna (3 Ausgaben)».
 */
export const REPORT_PAYEE_OPTION = (
  displayName: string,
  expenseCount: number,
): string =>
  `${displayName} (${expenseCount} ${expenseCount === 1 ? "Ausgabe" : "Ausgaben"})`;
/** Beschriftung der Modus-Auswahl. */
export const REPORT_MODE = "Aufbau";
export const REPORT_MODE_PER_PERSON = "Eine Tabelle";
export const REPORT_MODE_PER_PERSON_DESCRIPTION =
  "Alle Ausgaben in einer Tabelle, das Budget steht pro Zeile.";
export const REPORT_MODE_PER_PERSON_AND_BUDGET = "Pro Budget";
export const REPORT_MODE_PER_PERSON_AND_BUDGET_DESCRIPTION =
  "Eine Tabelle pro Budget, mit Zwischensumme.";
export const REPORT_INCLUDE_COMMENTS = "Kommentare anzeigen";
/** Schalter im Dialog (E11). */
export const REPORT_INCLUDE_MISSING_RECEIPT_PAGES =
  "Leerseiten für fehlende Belege einfügen";
/**
 * Erklärung unter dem Schalter, mit Anzahl.
 *
 * @param count - Anzahl Ausgaben ohne Beleg in der Auswahl.
 * @returns z.B. «3 Ausgaben ohne Beleg, zum Aufkleben von Papierquittungen».
 */
export const REPORT_MISSING_RECEIPTS_COUNT = (count: number): string =>
  `${count} ${count === 1 ? "Ausgabe" : "Ausgaben"} ohne Beleg, zum Aufkleben von Papierquittungen`;
/** Überschrift des Rückerstattungs-Blocks im Dialog und im PDF. */
export const REPORT_REFUND_TO = "Rückerstattung an";
/** Zeile mit dem Namen, auf den das Konto lautet. */
export const REPORT_ACCOUNT_HOLDER = "Kontoinhaber*in";
/** Zeile «PLZ Ort» im Rückerstattungs-Block des PDFs. */
export const REPORT_POSTAL_CODE_CITY = "PLZ / Ort";
/** Checkbox im Dialog, nur für die eigene Abrechnung. */
export const REPORT_SAVE_PAYMENT_DETAILS = "Angaben in meinem Profil speichern";
/** Erklärt, warum die Checkbox ausgegraut ist (nur vollständige Angaben). */
export const REPORT_SAVE_PAYMENT_DETAILS_HINT =
  "Zum Speichern Strasse, PLZ, Ort und eine gültige IBAN ausfüllen.";
/** Hinweis unter dem Formular: nichts ist Pflicht. */
export const REPORT_REFUND_OPTIONAL_HINT =
  "Leere Felder erscheinen als Linien zum Ausfüllen.";
/** Hinweis bei «Alle Personen»: das Formular gilt nur für die eigene Person. */
export const REPORT_REFUND_ALL_PAYEES_HINT =
  "Gilt für deinen Teil der Abrechnung. Bei den anderen Personen erscheinen Linien zum Ausfüllen.";
/** Ladehinweis, solange die eigenen Zahlungsangaben geladen werden. */
export const REPORT_PAYMENT_DETAILS_LOADING =
  "Zahlungsangaben werden geladen …";
/** Warn-Snackbar, wenn das Speichern ins Profil scheitert. */
export const REPORT_PAYMENT_DETAILS_SAVE_FAILED =
  "Angaben konnten nicht gespeichert werden. Die Abrechnung wurde trotzdem erstellt.";
/**
 * Fortschritt beim Laden der Belege.
 *
 * @param loaded - Bereits geladene Belege.
 * @param total - Alle zu ladenden Belege.
 * @returns z.B. «Belege werden geladen (7 von 23)».
 */
export const REPORT_PROGRESS_LOADING = (
  loaded: number,
  total: number,
): string => `Belege werden geladen (${loaded} von ${total})`;
/** Fortschritt, sobald alle Belege da sind. */
export const REPORT_PROGRESS_RENDERING = "PDF wird erstellt …";
/**
 * Hinweis nach dem Download, wenn Belege fehlten.
 *
 * @param receiptNumbers - Nummern der nicht geladenen Belege.
 * @returns z.B. «Beleg 3 konnte nicht geladen werden. …».
 */
export const REPORT_RECEIPTS_FAILED = (receiptNumbers: number[]): string =>
  receiptNumbers.length === 1
    ? `Beleg ${receiptNumbers[0]} konnte nicht geladen werden. Im PDF steht an seiner Stelle eine Leerseite.`
    : `Belege ${receiptNumbers.join(", ")} konnten nicht geladen werden. Im PDF stehen an ihrer Stelle Leerseiten.`;

/* =====================================================================
// PDF-Abrechnung: Inhalt
// ===================================================================== */
export const REPORT_TITLE = "Abrechnung";
/**
 * Linke Spalte im Footer der Abrechnungsseiten.
 *
 * @param date - Datum, z.B. «27.10.2026».
 * @param time - Zeit, z.B. «18:21».
 * @param name - Wer die Abrechnung erstellt hat.
 * @returns z.B. «Erstellt am 27.10.2026, 18:21 von Gio».
 */
export const REPORT_CREATED_AT_BY = (
  date: string,
  time: string,
  name: string,
): string => `Erstellt am ${date}, ${time} von ${name}`;
/** Kennzahl auf Seite 1: was an Personen zurückgeht. */
export const REPORT_KPI_TO_REFUND = "Zurückzuerstatten";
/** Kennzahl bei einer Person: Anzahl Ausgaben. */
export const REPORT_KPI_EXPENSES = "Ausgaben";
/** Kennzahl bei einer Person: Anzahl Budgets, darunter ihre Namen. */
export const REPORT_KPI_BUDGETS = "Budgets";
/**
 * Rest der Budgetnamen, wenn nicht alle in die Kachel passen.
 *
 * @param count - Anzahl nicht genannter Budgets.
 * @returns z.B. «+2».
 */
export const REPORT_KPI_MORE_BUDGETS = (count: number): string => `+${count}`;
export const REPORT_NO_REFUND_GROUP = "Ohne Rückerstattung";
export const REPORT_UNKNOWN_BUDGET = "Unbekanntes Budget";
export const REPORT_NO_REFUND_HINT =
  "Diese Ausgaben werden niemandem zurückerstattet.";
/** Spaltenkopf der Belegnummer. */
export const REPORT_COLUMN_NUMBER = "Nr.";
export const REPORT_COLUMN_RECEIPT = "Beleg";
export const REPORT_NO_RECEIPT_NUMBER = "–";
/** Kennzahl ohne Betrag (z.B. keine Ausgaben ohne Rückerstattung). */
export const REPORT_NO_AMOUNT = "–";
/**
 * Beschriftung einer Summenzeile.
 *
 * @param name - Person oder Budget.
 * @returns z.B. «Total Anna».
 */
export const REPORT_TOTAL_OF = (name: string): string => `Total ${name}`;
export const REPORT_GRAND_TOTAL = "Gesamttotal";
/** Leerseite für eine Ausgabe ohne Beleg. */
export const REPORT_RECEIPT_PASTE_HERE = "Beleg hier aufkleben";
/** Zweite Zeile im Klebefeld einer Leerseite. */
export const REPORT_RECEIPT_NOT_UPLOADED =
  "Zu dieser Ausgabe wurde kein Beleg hochgeladen.";
/** Seite für einen Beleg, der nicht geladen werden konnte. */
export const REPORT_RECEIPT_LOAD_FAILED = "Beleg konnte nicht geladen werden";
export const REPORT_RECEIPT_LOAD_FAILED_HINT =
  "Bitte ausdrucken und hier aufkleben oder separat einreichen.";
/**
 * Linke Spalte im Footer einer Belegseite.
 *
 * @param receiptNumber - Belegnummer.
 * @param receiptCount - Anzahl Belege im PDF.
 * @returns z.B. «Beleg 2 von 5».
 */
export const REPORT_RECEIPT_OF = (
  receiptNumber: number,
  receiptCount: number,
): string => `Beleg ${receiptNumber} von ${receiptCount}`;
/**
 * Seitenangabe: im Footer über das ganze PDF, im Kopf eines mehrseitigen
 * PDF-Belegs innerhalb des Belegs.
 *
 * @param pageNumber - Aktuelle Seite, ab 1.
 * @param pageCount - Anzahl Seiten.
 * @returns z.B. «Seite 1 von 8».
 */
export const REPORT_PAGE_OF = (pageNumber: number, pageCount: number): string =>
  `Seite ${pageNumber} von ${pageCount}`;
/**
 * Verweis in der Spalte «Beleg» auf die Startseite des Belegs.
 *
 * @param pageNumber - Seite im PDF, ab 1.
 * @returns z.B. «S. 5».
 */
export const REPORT_PAGE_REF = (pageNumber: number): string =>
  `S. ${pageNumber}`;

/* =====================================================================
// Export (CSV und ZIP)
// ===================================================================== */
export const EXPORT = "Exportieren";
export const EXPORT_CSV = "Ausgaben als CSV";
/** Menüeintrag «Exportieren»: ZIP mit CSV und Originalbelegen. */
export const EXPORT_ZIP = "Ausgaben mit Belegen (ZIP)";
export const NO_RECEIPTS_AVAILABLE = "Keine Belege vorhanden";
/** Präfix für die Export-Dateien. */
export const EXPORT_FILE_PREFIX = "Ausgaben";
/** Spaltentitel der CSV-Datei: Belegnummer. */
export const EXPORT_COLUMN_RECEIPT_NUMBER = "Belegnummer";
/** Spaltentitel der CSV-Datei: Betrag der Ausgabe. */
export const EXPORT_COLUMN_AMOUNT = "Betrag";
/** Spaltentitel der CSV-Datei: Person, die bezahlt hat, oder «Ohne Rückerstattung». */
export const EXPORT_COLUMN_PAYEE = "Zahlende Instanz";
/** Spaltentitel der CSV-Datei: Kommentar der Ausgabe. */
export const EXPORT_COLUMN_COMMENT = "Kommentar";
/** Spaltentitel der CSV-Datei: Dateiname des Belegs im ZIP. */
export const EXPORT_COLUMN_RECEIPT_FILE = "Belegdatei";
/** Ordner im ZIP für die Originalbelege. */
export const EXPORT_RECEIPT_FOLDER = "Belege";
/** CSV-Zelle «Belegdatei», wenn der Beleg nicht ins ZIP kam. */
export const EXPORT_RECEIPT_NOT_LOADED = "Beleg konnte nicht geladen werden";
/** Titel des Fortschrittsdialogs beim ZIP-Export. */
export const EXPORT_ZIP_PROGRESS_TITLE = "ZIP wird erstellt";
/**
 * Hinweis nach dem ZIP-Export, wenn Belege fehlen; Einzahl oder Mehrzahl.
 *
 * @param receiptNumbers - Belegnummern der fehlenden Belege, mindestens eine.
 * @returns Hinweistext für die Snackbar.
 * @example
 * EXPORT_RECEIPTS_FAILED([2, 5])
 * // "Belege 2, 5 konnten nicht geladen werden und fehlen im ZIP."
 */
export const EXPORT_RECEIPTS_FAILED = (receiptNumbers: number[]): string => {
  if (receiptNumbers.length === 1) {
    return `Beleg ${receiptNumbers[0]} konnte nicht geladen werden und fehlt im ZIP.`;
  }
  return `Belege ${receiptNumbers.join(", ")} konnten nicht geladen werden und fehlen im ZIP.`;
};
