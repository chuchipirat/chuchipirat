import {
  REPORT_MODE_PER_PERSON as TEXT_REPORT_MODE_PER_PERSON,
  REPORT_MODE_PER_PERSON_DESCRIPTION as TEXT_REPORT_MODE_PER_PERSON_DESCRIPTION,
  REPORT_MODE_PER_PERSON_AND_BUDGET as TEXT_REPORT_MODE_PER_PERSON_AND_BUDGET,
  REPORT_MODE_PER_PERSON_AND_BUDGET_DESCRIPTION as TEXT_REPORT_MODE_PER_PERSON_AND_BUDGET_DESCRIPTION,
  REPORT_TITLE as TEXT_REPORT_TITLE,
  SUFFIX_PDF as TEXT_SUFFIX_PDF,
  REPORT_CREATED_AT_BY as TEXT_REPORT_CREATED_AT_BY,
} from "../../../../constants/text";
import AuthUser from "../../../Session/authUser.class";
import {
  ReportMode,
  ReportPayeeSection,
  ReportReceipt,
} from "./expenseReport.types";
import {ReceiptMeta} from "./expenseReportPdfHelpers";

/**
 * Beschriftung und Erklärung eines Modus.
 *
 * @param label - Kurzer Name (Radio-Button, Untertitel im PDF).
 * @param description - Ein Satz zur Erklärung im Dialog.
 */
export type ReportModeLabel = {label: string; description: string};

/**
 * Beschriftungen aller Modi. Als `Record`, damit ein neuer Modus ohne
 * Beschriftung nicht kompiliert.
 */
export const REPORT_MODE_LABELS: Record<ReportMode, ReportModeLabel> = {
  [ReportMode.PER_PERSON]: {
    label: TEXT_REPORT_MODE_PER_PERSON,
    description: TEXT_REPORT_MODE_PER_PERSON_DESCRIPTION,
  },
  [ReportMode.PER_PERSON_AND_BUDGET]: {
    label: TEXT_REPORT_MODE_PER_PERSON_AND_BUDGET,
    description: TEXT_REPORT_MODE_PER_PERSON_AND_BUDGET_DESCRIPTION,
  },
};

/**
 * Titel der Abrechnung (PDF-Metadaten und Basis des Dateinamens):
 * «Abrechnung <Anlass> <Person>», bei «Alle Personen» ohne Person.
 *
 * @param eventName - Name des Anlasses.
 * @param payeeDisplayName - Gewählte Person, `null` bei «Alle Personen».
 * @returns z.B. «Abrechnung Sommerlager 2026 Anna».
 * @example
 * getReportTitle("Sommerlager 2026", null) // "Abrechnung Sommerlager 2026"
 */
export const getReportTitle = (
  eventName: string,
  payeeDisplayName: string | null,
): string =>
  // leere Teile weglassen, damit keine doppelten Leerzeichen entstehen
  [TEXT_REPORT_TITLE, eventName, payeeDisplayName]
    .filter((part) => part !== null && part !== "")
    .join(" ");

/**
 * Dateiname der Abrechnung, Leerzeichen wie bei den anderen PDFs.
 *
 * @param eventName - Name des Anlasses.
 * @param payeeDisplayName - Gewählte Person, `null` bei «Alle Personen».
 * @returns z.B. «Abrechnung Sommerlager 2026 Anna.pdf».
 * @example
 * getReportFileName("Sommerlager 2026", "Anna") // "Abrechnung Sommerlager 2026 Anna.pdf"
 */
export const getReportFileName = (
  eventName: string,
  payeeDisplayName: string | null,
): string => getReportTitle(eventName, payeeDisplayName) + TEXT_SUFFIX_PDF;

/**
 * Datum einer Ausgabe im PDF, Schweizer Format.
 *
 * @param date - Datum der Ausgabe.
 * @returns z.B. «09.07.2026».
 */
export const formatReportDate = (date: Date): string =>
  date.toLocaleDateString("de-CH", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

/**
 * Linke Spalte im Footer der Abrechnungsseiten (Story 7.5).
 *
 * @param generatedAt - Zeitpunkt der Erstellung.
 * @param authUser - Wer die Abrechnung erstellt (Anzeigename).
 * @returns z.B. «Erstellt am 27.10.2026, 18:21 von Gio».
 * @example
 * getCreatedAtLabel(new Date(2026, 9, 27, 18, 21), authUser)
 * // "Erstellt am 27.10.2026, 18:21 von Gio"
 */
export const getCreatedAtLabel = (
  generatedAt: Date,
  authUser: AuthUser,
): string =>
  TEXT_REPORT_CREATED_AT_BY(
    formatReportDate(generatedAt),
    generatedAt.toLocaleTimeString("de-CH", {
      hour: "2-digit",
      minute: "2-digit",
    }),
    authUser.publicProfile.displayName,
  );

/**
 * Zweite Zeile im Kopf einer Belegseite (Spez. 7): macht eine
 * ausgedruckte Seite für sich verständlich, auch getrennt von der Tabelle.
 *
 * @param receipt - Der Beleg.
 * @param meta - Budget und Person aus `getReceiptMetaByExpenseId`;
 *   fehlen sie, steht nur das Datum.
 * @returns z.B. «15.10.2026 · Küche · Gio Cettuzzi».
 * @example
 * getReceiptMetaLine(receipt, {budgetName: "Küche", payeeDisplayName: "Gio"})
 * // "15.10.2026 · Küche · Gio"
 */
export const getReceiptMetaLine = (
  receipt: ReportReceipt,
  meta: ReceiptMeta | undefined,
): string =>
  [
    formatReportDate(receipt.date),
    ...(meta ? [meta.budgetName, meta.payeeDisplayName] : []),
  ].join(" · ");

/**
 * Name der Kontoinhaber*in im Block «Rückerstattung an».
 * Für die eigene Abrechnung Vor- und Nachname aus dem Profil, weil die
 * Bank den echten Namen braucht; fehlen sie, der Anzeigename. Für andere
 * Personen (auch eingetippte, `payeeUserId: null`) ihr Anzeigename.
 *
 * @param payee - Die Person; ein ganzer `ReportPayeeSection` passt auch.
 * @param authUser - Angemeldete Person, zum Erkennen der eigenen Abrechnung.
 * @returns Name für die Zeile «Kontoinhaber*in».
 * @example
 * getAccountHolderName({displayName: "Gio", payeeUserId: authUser.uid}, authUser)
 * // "Gio Botta"
 * getAccountHolderName({displayName: "Anna", payeeUserId: null}, authUser)
 * // "Anna"
 */
export const getAccountHolderName = (
  payee: Pick<ReportPayeeSection, "displayName" | "payeeUserId">,
  authUser: AuthUser,
): string => {
  if (payee.payeeUserId !== authUser.uid) return payee.displayName;
  if (!authUser.firstName.trim() || !authUser.lastName.trim())
    return payee.displayName;

  return `${authUser.firstName.trim()} ${authUser.lastName.trim()}`;
};
