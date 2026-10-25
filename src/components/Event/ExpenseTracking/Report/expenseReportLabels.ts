import {
  REPORT_ALL_PAYEES as TEXT_REPORT_ALL_PAYEES,
  REPORT_MODE_PER_PERSON as TEXT_REPORT_MODE_PER_PERSON,
  REPORT_MODE_PER_PERSON_DESCRIPTION as TEXT_REPORT_MODE_PER_PERSON_DESCRIPTION,
  REPORT_MODE_PER_PERSON_AND_BUDGET as TEXT_REPORT_MODE_PER_PERSON_AND_BUDGET,
  REPORT_MODE_PER_PERSON_AND_BUDGET_DESCRIPTION as TEXT_REPORT_MODE_PER_PERSON_AND_BUDGET_DESCRIPTION,
  REPORT_TITLE as TEXT_REPORT_TITLE,
  SUFFIX_PDF as TEXT_SUFFIX_PDF,
  REPORT_RECEIPT as TEXT_REPORT_RECEIPT,
  REPORT_RECEIPT_PAGE_OF as TEXT_REPORT_RECEIPT_PAGE_OF,
} from "../../../../constants/text";
import {formatAmountFromCents} from "../../../Shared/utils/currencyUtils";
import {ReportMode, ReportReceipt} from "./expenseReport.types";

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
 * Untertitel unter «Abrechnung»: für wen und in welchem Aufbau.
 *
 * @param payeeDisplayName - Gewählte Person, `null` bei «Alle Personen».
 * @param mode - Modus der Abrechnung.
 * @returns z.B. «Anna · Pro Budget».
 */
export const getReportSubtitle = (
  payeeDisplayName: string | null,
  mode: ReportMode,
): string =>
  `${payeeDisplayName ?? TEXT_REPORT_ALL_PAYEES} · ${REPORT_MODE_LABELS[mode].label}`;

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
 * Kopfzeile einer Belegseite. Macht eine ausgedruckte Seite für sich
 * verständlich, auch wenn sie von der Tabelle getrennt wird. Hat ein
 * PDF-Beleg mehrere Seiten, steht zusätzlich die Seite dabei; bei
 * einseitigen Belegen nicht.
 *
 * @param receipt - Der Beleg.
 * @param pageNumber - Seite innerhalb des Belegs, ab 1 (Standard: 1).
 * @param pageCount - Anzahl Seiten des Belegs (Standard: 1).
 * @returns z.B. «Beleg 3 · 12.07.2026 · Migros · CHF 42.50» bzw.
 *   «Beleg 3 · 12.07.2026 · Migros · CHF 42.50 · Seite 2 von 3».
 * @example
 * getReceiptHeader(receipt) // "Beleg 3 · 12.07.2026 · Migros · CHF 42.50"
 * getReceiptHeader(receipt, 2, 3)
 * // "Beleg 3 · 12.07.2026 · Migros · CHF 42.50 · Seite 2 von 3"
 */
export const getReceiptHeader = (
  receipt: ReportReceipt,
  pageNumber = 1,
  pageCount = 1,
): string =>
  [
    TEXT_REPORT_RECEIPT(receipt.receiptNumber),
    formatReportDate(receipt.date),
    receipt.label,
    formatAmountFromCents(receipt.amountInCents, receipt.currency),
    ...(pageCount > 1
      ? [TEXT_REPORT_RECEIPT_PAGE_OF(pageNumber, pageCount)]
      : []),
  ].join(" · ");
