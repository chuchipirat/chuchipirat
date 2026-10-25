/**
 * Aufbau der Abrechnung (E2). Als Enum, damit sich später weitere Modi
 * ergänzen lassen.
 *
 * - `PER_PERSON`: Modus A, eine Tabelle pro Person über alle Budgets.
 * - `PER_PERSON_AND_BUDGET`: Modus B, pro Person je Budget eine Tabelle
 *   mit Zwischensumme.
 */
export enum ReportMode {
  PER_PERSON = "per_person",
  PER_PERSON_AND_BUDGET = "per_person_and_budget",
}
/**
 * Für wen die Abrechnung ist: eine Person (Schlüssel aus
 * `Expense.getPayeeKey`) oder alle.
 */
export type ReportPayeeSelection =
  | {kind: "single"; payeeKey: string}
  | {kind: "all"};

/**
 * Im Dialog gewählte Optionen.
 *
 * @param mode - Aufbau der Abrechnung.
 * @param payeeSelection - Person oder «Alle Personen».
 * @param includeComments - Kommentare der Ausgaben in der Tabelle zeigen.
 * @param includeMissingReceiptPages - Für Ausgaben ohne Beleg eine
 *   nummerierte Leerseite «Beleg hier aufkleben» anhängen (E11).
 */
export type ReportOptions = {
  mode: ReportMode;
  payeeSelection: ReportPayeeSelection;
  includeComments: boolean;
  includeMissingReceiptPages: boolean;
};
/**
 * Summe einer Währung (keine Umrechnung, E4).
 *
 * @param currency - Währungscode (ISO 4217).
 * @param amountInCents - Summe in Rappen bzw. Cent.
 */
export type CurrencyTotal = {currency: string; amountInCents: number};

/**
 * Eine Zeile der Tabelle, entspricht einer Ausgabe.
 *
 * @param expenseId - ID der Ausgabe.
 * @param date - Datum der Ausgabe.
 * @param label - Bezeichnung.
 * @param comment - Kommentar, `null` ohne Kommentar.
 * @param budgetName - Name des Budgets oder «Unbekanntes Budget» (R6).
 * @param amountInCents - Betrag in Rappen bzw. Cent.
 * @param currency - Währungscode (ISO 4217).
 * @param receiptNumber - Belegnummer im Dokument, `null` ohne Nummer («–»).
 * @param attachmentPath - Pfad des Belegs im Storage, `null` ohne Beleg.
 */
export type ReportRow = {
  expenseId: string;
  date: Date;
  label: string;
  comment: string | null;
  budgetName: string;
  amountInCents: number;
  currency: string;
  receiptNumber: number | null;
  attachmentPath: string | null;
};
/**
 * Eine Tabelle innerhalb einer Person. Modus A: eine Gruppe ohne Titel;
 * Modus B: eine Gruppe pro Budget.
 *
 * @param budgetName - Titel der Tabelle, `null` in Modus A.
 * @param rows - Sortierte Zeilen.
 * @param totals - Summen der Tabelle pro Währung.
 */
export type ReportGroup = {
  budgetName: string | null;
  rows: ReportRow[];
  totals: CurrencyTotal[];
};
/**
 * Block einer Person in der Abrechnung.
 *
 * @param payeeKey - Schlüssel aus `Expense.getPayeeKey`.
 * @param displayName - Anzeigename aus `Expense.getPayeeDisplayName`.
 * @param isNoRefund - `true` für die Gruppe «Ohne Rückerstattung».
 * @param payeeUserId - UID bei Köch:innen, sonst `null`. Für Story 7.4
 *   (eigene Abrechnung mit Zahlungsangaben).
 * @param groups - Tabellen der Person.
 * @param totals - Personentotal pro Währung.
 */
export type ReportPayeeSection = {
  payeeKey: string;
  displayName: string;
  isNoRefund: boolean;
  payeeUserId: string | null;
  groups: ReportGroup[];
  totals: CurrencyTotal[];
};
/**
 * Eine Anhang-Seite. Die Kopfzeile (Nummer, Datum, Bezeichnung, Betrag)
 * macht eine ausgedruckte Seite für sich verständlich (E5).
 *
 * @param receiptNumber - Belegnummer, gleich wie in der Tabelle.
 * @param expenseId - ID der Ausgabe.
 * @param attachmentPath - Pfad des Belegs; `null` = Leerseite «Beleg hier
 *   aufkleben» (E11).
 * @param date - Datum der Ausgabe.
 * @param label - Bezeichnung.
 * @param amountInCents - Betrag in Rappen bzw. Cent.
 * @param currency - Währungscode (ISO 4217).
 */
export type ReportReceipt = {
  receiptNumber: number;
  expenseId: string;
  attachmentPath: string | null;
  date: Date;
  label: string;
  amountInCents: number;
  currency: string;
};
/**
 * Fertig aufbereitete Abrechnung, Ergebnis von `ExpenseReport.build`. Das
 * PDF zeichnet nur diese Struktur und rechnet selbst nichts.
 *
 * @param mode - Aufbau der Abrechnung.
 * @param includeComments - Kommentare in der Tabelle zeigen.
 * @param sections - Personen in Anzeigereihenfolge.
 * @param receipts - Anhang-Seiten in Nummernreihenfolge.
 * @param grandTotals - Gesamttotal inklusive «Ohne Rückerstattung»; nur
 *   bei «Alle Personen», sonst `null`.
 * @param refundTotals - Davon zurückzuerstatten (ohne «Ohne
 *   Rückerstattung»); nur bei «Alle Personen», sonst `null`.
 * @param payeeDisplayName - Anzeigename der gewählten Person; `null` bei
 *   «Alle Personen» (für Titel und Dateiname).
 */
export type ExpenseReportData = {
  mode: ReportMode;
  includeComments: boolean;
  sections: ReportPayeeSection[];
  receipts: ReportReceipt[];
  grandTotals: CurrencyTotal[] | null;
  refundTotals: CurrencyTotal[] | null;
  payeeDisplayName: string | null;
};
/**
 * Eine Person in der Auswahl des Dialogs.
 *
 * @param payeeKey - Schlüssel aus `Expense.getPayeeKey`.
 * @param displayName - Anzeigename.
 * @param expenseCount - Anzahl Ausgaben dieser Person.
 */
export type ReportPayeeOption = {
  payeeKey: string;
  displayName: string;
  expenseCount: number;
};
/**
 * Ein Beleg des Anhangs, fertig zum Zeichnen (Ergebnis von `loadReceipts`).
 *
 * - `image`: Bild-Beleg, verkleinert, als Data-URL für `<Image>`.
 * - `missing`: Ausgabe ohne Beleg, Leerseite «Beleg hier aufkleben».
 * - `failed`: Beleg liess sich nicht laden; `error` geht an Sentry.
 * - `pdfPending`: PDF-Beleg.
 *
 * @param receipt - Der Beleg aus `ExpenseReportData.receipts` (Nummer,
 *   Datum, Bezeichnung, Betrag für die Kopfzeile).
 */
export type LoadedReceipt =
  | {kind: "image"; receipt: ReportReceipt; dataUrl: string}
  | {kind: "missing"; receipt: ReportReceipt}
  | {kind: "failed"; receipt: ReportReceipt; error: Error}
  | {kind: "pdfPending"; receipt: ReportReceipt};

/**
 * Fortschritt beim Erstellen der Abrechnung.
 *
 * - `loading`: Belege werden geladen; `loaded` von `total` sind fertig.
 * - `rendering`: Alle Belege sind da, das PDF wird gezeichnet.
 */
export type ReportProgress =
  | {stage: "loading"; loaded: number; total: number}
  | {stage: "rendering"};

/**
 * Ergebnis von `downloadExpenseReport`.
 *
 * @param failedReceiptNumbers - Belegnummern, die nicht geladen werden
 *   konnten. Leer, wenn alles geklappt hat oder kein PDF entstand.
 */
export type ExpenseReportResult = {failedReceiptNumbers: number[]};
