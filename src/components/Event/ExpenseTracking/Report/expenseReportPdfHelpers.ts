import {
  REPORT_GRAND_TOTAL as TEXT_REPORT_GRAND_TOTAL,
  REPORT_KPI_EXPENSES as TEXT_REPORT_KPI_EXPENSES,
  REPORT_KPI_BUDGETS as TEXT_REPORT_KPI_BUDGETS,
  REPORT_KPI_MORE_BUDGETS as TEXT_REPORT_KPI_MORE_BUDGETS,
  REPORT_KPI_TO_REFUND as TEXT_REPORT_KPI_TO_REFUND,
  REPORT_NO_AMOUNT as TEXT_REPORT_NO_AMOUNT,
  REPORT_NO_REFUND_GROUP as TEXT_REPORT_NO_REFUND_GROUP,
} from "../../../../constants/text";
import {formatIban, normalizeIban} from "../../../../utils/ibanUtils";
import {formatAmountFromCents} from "../../../Shared/utils/currencyUtils";
import {PaymentDetailsFormValues} from "../../../User/userPaymentDetails.types";
import {
  CurrencyTotal,
  ExpenseReportData,
  ReceiptPageSlot,
  ReportPayeeSection,
} from "./expenseReport.types";

/**
 * Darstellungshilfen der PDF-Abrechnung (Story 7.5). Rechnen nichts neu,
 * sondern formen die fertige Aufbereitung aus `ExpenseReport.build` für das
 * Layout um.
 */

/** Anzahl Kästchen einer Schweizer IBAN (CH + 2 Prüfziffern + 17). */
export const IBAN_BOX_COUNT = 21;

/** Kästchen pro Gruppe; 21 = 5 × 4 + 1 wie in der IBAN-Schreibweise. */
export const IBAN_BOX_GROUP_SIZE = 4;

/**
 * Eine Kennzahl auf Seite 1.
 *
 * @param key - Stabiler Schlüssel für React.
 * @param label - Beschriftung der Kachel.
 * @param values - Fertige Werte untereinander, z.B. ein Betrag pro Währung
 *   oder eine Anzahl; ohne Betrag «–».
 * @param detail - Kleine Zeile unter den Werten, z.B. die Budgetnamen;
 *   `null` ohne.
 * @param isHighlighted - Teal hinterlegt («Zurückzuerstatten»).
 */
export type ReportKpi = {
  key: "grandTotal" | "toRefund" | "noRefund" | "expenseCount" | "budgetCount";
  label: string;
  values: string[];
  detail: string | null;
  isHighlighted: boolean;
};

/**
 * Ab so vielen Budgets stehen in der Kachel nur die ersten zwei Namen und
 * «+n» für den Rest, damit die Zeile kurz bleibt.
 */
const MAX_LISTED_BUDGET_NAMES = 3;

/**
 * Kennzahlen für den Kopf von Seite 1, immer drei, «Zurückzuerstatten»
 * hervorgehoben in der Mitte. Bei «Alle Personen» Gesamttotal und Ohne
 * Rückerstattung daneben; bei einer Person die Anzahl Ausgaben und die
 * Budgets mit ihren Namen (in Aufbau A sonst nirgends zusammengefasst).
 *
 * @param report - Fertige Abrechnung.
 * @returns Drei Kennzahlen in Anzeigereihenfolge.
 * @example
 * getReportKpis(report).map((kpi) => kpi.key) // ["grandTotal", "toRefund", "noRefund"]
 */
export const getReportKpis = (report: ExpenseReportData): ReportKpi[] => {
  if (report.grandTotals === null || report.refundTotals === null) {
    return getSinglePayeeKpis(report);
  }
  return [
    {
      key: "grandTotal",
      label: TEXT_REPORT_GRAND_TOTAL,
      values: toAmountValues(report.grandTotals),
      detail: null,
      isHighlighted: false,
    },
    toRefundKpi(report.refundTotals),
    {
      key: "noRefund",
      label: TEXT_REPORT_NO_REFUND_GROUP,
      values: toAmountValues(
        report.sections.find((section) => section.isNoRefund)?.totals ?? [],
      ),
      detail: null,
      isHighlighted: false,
    },
  ];
};

/**
 * Kennzahlen bei einer Person: Ausgaben, Zurückzuerstatten, Budgets.
 *
 * @param report - Fertige Abrechnung einer Person.
 * @returns Drei Kennzahlen.
 */
const getSinglePayeeKpis = (report: ExpenseReportData): ReportKpi[] => {
  const section = report.sections.find((candidate) => !candidate.isNoRefund);
  const rows = section?.groups.flatMap((group) => group.rows) ?? [];
  // alphabetisch: Aufbau A kennt die Reihenfolge der Budgetliste nicht,
  // so sieht die Kachel in A und B gleich aus
  const budgetNames = [...new Set(rows.map((row) => row.budgetName))].sort(
    (nameA, nameB) => nameA.localeCompare(nameB, "de"),
  );
  return [
    {
      key: "expenseCount",
      label: TEXT_REPORT_KPI_EXPENSES,
      values: [String(rows.length)],
      detail: null,
      isHighlighted: false,
    },
    toRefundKpi(section?.totals ?? []),
    {
      key: "budgetCount",
      label: TEXT_REPORT_KPI_BUDGETS,
      values: [String(budgetNames.length)],
      detail: formatBudgetNames(budgetNames),
      isHighlighted: false,
    },
  ];
};

/**
 * Budgetnamen für die kleine Zeile der Kachel «Budgets».
 *
 * @param budgetNames - Namen, sortiert.
 * @returns z.B. «Küche, Motto», bei mehr als drei «Küche, Motto, +2»;
 *   `null` ohne Budgets.
 * @example
 * formatBudgetNames(["Küche", "Material", "Motto", "Transport"]) // "Küche, Material, +2"
 */
export const formatBudgetNames = (budgetNames: string[]): string | null => {
  if (budgetNames.length === 0) {
    return null;
  }
  if (budgetNames.length <= MAX_LISTED_BUDGET_NAMES) {
    return budgetNames.join(", ");
  }
  return [
    ...budgetNames.slice(0, 2),
    TEXT_REPORT_KPI_MORE_BUDGETS(budgetNames.length - 2),
  ].join(", ");
};

/**
 * Hervorgehobene Kennzahl «Zurückzuerstatten».
 *
 * @param totals - Beträge pro Währung.
 * @returns Die Kennzahl.
 */
const toRefundKpi = (totals: CurrencyTotal[]): ReportKpi => ({
  key: "toRefund",
  label: TEXT_REPORT_KPI_TO_REFUND,
  values: toAmountValues(totals),
  detail: null,
  isHighlighted: true,
});

/**
 * Beträge einer Kachel: einer pro Währung, ohne Beträge «–».
 *
 * @param totals - Beträge pro Währung.
 * @returns Die Werte.
 */
const toAmountValues = (totals: CurrencyTotal[]): string[] =>
  totals.length > 0 ? formatTotals(totals) : [TEXT_REPORT_NO_AMOUNT];

/**
 * Formatiert Beträge pro Währung, einer pro Eintrag (zum Untereinander-
 * oder Nebeneinanderschreiben).
 *
 * @param totals - Beträge pro Währung, CHF zuerst.
 * @returns z.B. `["CHF 222.00", "EUR 27.61"]`; leer ohne Beträge.
 * @example
 * formatTotals([{currency: "CHF", amountInCents: 300}]) // ["CHF 3.00"]
 */
export const formatTotals = (totals: CurrencyTotal[]): string[] =>
  totals.map((total) =>
    formatAmountFromCents(total.amountInCents, total.currency),
  );

/**
 * Sind alle Zahlungsangaben da? Nur dann erscheinen sie als graue Zeile,
 * sonst als Kasten zum Ergänzen.
 *
 * @param details - Adresse und IBAN; `null` = keine Angaben.
 * @returns `true`, wenn Strasse, PLZ, Ort und IBAN ausgefüllt sind.
 * @example
 * isPaymentDetailsComplete(null) // false
 */
export const isPaymentDetailsComplete = (
  details: PaymentDetailsFormValues | null,
): details is PaymentDetailsFormValues =>
  details !== null &&
  [details.street, details.postalCode, details.city, details.iban].every(
    (value) => value.trim() !== "",
  );

/**
 * Graue Zeile unter dem Namen bei vollständigen Angaben.
 *
 * @param details - Vollständige Adresse und IBAN.
 * @returns z.B. «Beispielstrasse 12, 8000 Zürich · CH93 0076 2011 6238 5295 7».
 * @example
 * getPaymentDetailsLine({street: "Weg 1", postalCode: "8000", city: "Zürich", iban: "CH9300762011623852957"})
 * // "Weg 1, 8000 Zürich · CH93 0076 2011 6238 5295 7"
 */
export const getPaymentDetailsLine = (
  details: PaymentDetailsFormValues,
): string =>
  `${details.street.trim()}, ${details.postalCode.trim()} ${details.city.trim()} · ${formatIban(normalizeIban(details.iban))}`;

/**
 * Inhalt der IBAN-Kästchen im Kasten zum Ergänzen.
 *
 * @param iban - IBAN, wie eingegeben (auch leer).
 * @returns 21 Zeichen (leere Kästchen = `""`), in Gruppen zu 4 (letzte
 *   Gruppe 1); `null`, wenn die IBAN nicht in 21 Kästchen passt (z.B.
 *   eine ausländische): dann steht sie als Text auf der Linie.
 * @example
 * getIbanBoxGroups("").length // 6
 * getIbanBoxGroups("DE89370400440532013000") // null (22 Zeichen)
 */
export const getIbanBoxGroups = (iban: string): string[][] | null => {
  const normalizedIban = normalizeIban(iban);
  if (normalizedIban !== "" && normalizedIban.length !== IBAN_BOX_COUNT) {
    return null;
  }
  const characters = Array.from(
    {length: IBAN_BOX_COUNT},
    (_unused, index) => normalizedIban[index] ?? "",
  );
  const groups: string[][] = [];
  for (let start = 0; start < IBAN_BOX_COUNT; start += IBAN_BOX_GROUP_SIZE) {
    groups.push(characters.slice(start, start + IBAN_BOX_GROUP_SIZE));
  }
  return groups;
};

/**
 * Zusatzangaben im Kopf einer Belegseite, die `ReportReceipt` nicht trägt.
 *
 * @param budgetName - Budget der Ausgabe.
 * @param payeeDisplayName - Person, der die Ausgabe zurückerstattet wird.
 */
export type ReceiptMeta = {budgetName: string; payeeDisplayName: string};

/**
 * Sucht zu jeder Ausgabe Budget und Person aus den Sections, für die Zeile
 * «Datum · Budget · Person» der Belegseite.
 *
 * @param report - Fertige Abrechnung.
 * @returns Map `expenseId` → Budget und Person.
 * @example
 * getReceiptMetaByExpenseId(report).get("expense-1")
 * // {budgetName: "Küche", payeeDisplayName: "Anna"}
 */
export const getReceiptMetaByExpenseId = (
  report: ExpenseReportData,
): Map<string, ReceiptMeta> => {
  const metaByExpenseId = new Map<string, ReceiptMeta>();
  report.sections.forEach((section) =>
    section.groups.forEach((group) =>
      group.rows.forEach((row) =>
        metaByExpenseId.set(row.expenseId, {
          budgetName: row.budgetName,
          payeeDisplayName: section.displayName,
        }),
      ),
    ),
  );
  return metaByExpenseId;
};

/**
 * Startseite jedes Belegs im fertigen PDF, für die Spalte «Beleg». Die
 * Belegseiten folgen direkt auf die `reportPageCount` Abrechnungsseiten,
 * in der Reihenfolge der Slots (Leerseiten zählen mit, ein PDF-Beleg mit
 * k Seiten belegt k Slots).
 *
 * @param slots - Belegseiten aus `getReceiptPageSlots`.
 * @param reportPageCount - Seiten der Abrechnung ohne Belege.
 * @returns Map Belegnummer → Seite im PDF (ab 1).
 * @example
 * // 2 Abrechnungsseiten, Beleg 1 mit 2 Seiten, dann Beleg 2
 * getReceiptStartPages(slots, 2) // Map {1 => 3, 2 => 5}
 */
export const getReceiptStartPages = (
  slots: ReceiptPageSlot[],
  reportPageCount: number,
): Map<number, number> => {
  const startPages = new Map<number, number>();
  slots.forEach((slot, slotIndex) => {
    if (slot.pageNumber === 1) {
      startPages.set(
        slot.loadedReceipt.receipt.receiptNumber,
        reportPageCount + slotIndex + 1,
      );
    }
  });
  return startPages;
};

/**
 * Geschätzte Höhen (pt) der Teile einer Personenkarte, grosszügig
 * gerundet: Eine lange Bezeichnung kann umbrechen.
 */
const CARD_PART_HEIGHT = {
  frame: 34, // Rand, Innenabstand, Abstand zur nächsten Karte
  head: 22,
  paymentLine: 16,
  noRefundHint: 16,
  fillInBox: 130,
  tableHeader: 16,
  row: 20,
  comment: 12,
  budgetBar: 28,
  total: 24,
  /** Jede weitere Währung im Zwischentotal bzw. Total: eine Zeile mehr. */
  extraCurrencyLine: 13,
} as const;

/**
 * Höhe, bis zu der eine Karte als Ganzes auf eine Seite gesetzt wird. Die
 * nutzbare A4-Höhe ist rund 745 pt; die Reserve fängt umbrechende
 * Bezeichnungen und Kommentare auf.
 */
export const MAX_UNBROKEN_CARD_HEIGHT = 600;

/**
 * Soll die Karte einer Person nicht umbrechen (Spez. 9)? Nur wenn sie
 * sicher auf eine Seite passt; sonst darf sie umbrechen, statt
 * abgeschnitten zu werden.
 *
 * @param section - Block der Person.
 * @param includeComments - Kommentare werden gezeigt.
 * @param hasFillInBox - Kasten zum Ergänzen statt grauer Zeile.
 * @returns `true`, wenn die Karte `wrap={false}` bekommt.
 * @example
 * canKeepCardTogether(section, false, true) // true bei wenigen Zeilen
 */
export const canKeepCardTogether = (
  section: ReportPayeeSection,
  includeComments: boolean,
  hasFillInBox: boolean,
): boolean => {
  const rows = section.groups.flatMap((group) => group.rows);
  const commentCount = includeComments
    ? rows.filter((row) => row.comment).length
    : 0;
  const isPerBudget = section.groups.some((group) => group.budgetName !== null);
  const estimatedHeight =
    CARD_PART_HEIGHT.frame +
    CARD_PART_HEIGHT.head +
    (section.isNoRefund
      ? CARD_PART_HEIGHT.noRefundHint
      : hasFillInBox
        ? CARD_PART_HEIGHT.fillInBox
        : CARD_PART_HEIGHT.paymentLine) +
    CARD_PART_HEIGHT.tableHeader +
    rows.length * CARD_PART_HEIGHT.row +
    commentCount * CARD_PART_HEIGHT.comment +
    (isPerBudget ? getPerBudgetTotalsHeight(section) : 0);
  return estimatedHeight <= MAX_UNBROKEN_CARD_HEIGHT;
};

/**
 * Höhe der Budget-Balken und der Totalzeile in Aufbau B. Mehrere
 * Währungen stehen untereinander, jede weitere braucht eine Zeile mehr.
 *
 * @param section - Block der Person.
 * @returns Geschätzte Höhe in pt.
 */
const getPerBudgetTotalsHeight = (section: ReportPayeeSection): number => {
  const extraLines = (totals: CurrencyTotal[]) =>
    Math.max(totals.length - 1, 0) * CARD_PART_HEIGHT.extraCurrencyLine;
  const barsHeight = section.groups.reduce(
    (sum, group) => sum + CARD_PART_HEIGHT.budgetBar + extraLines(group.totals),
    0,
  );
  return barsHeight + CARD_PART_HEIGHT.total + extraLines(section.totals);
};

/**
 * Mindesthöhe (pt), die der Anfang einer Karte auf der aktuellen Seite
 * braucht: Kopf, Zahlungsangaben bzw. Hinweis, Tabellenkopf, bei Aufbau B
 * der erste Budget-Balken, und eine Zeile. Passt das nicht mehr, beginnt
 * die Karte auf der nächsten Seite (Spez. 9: kein Kopf allein am
 * Seitenende, «Ohne Rückerstattung» nicht in den letzten Zeilen).
 *
 * @param section - Block der Person.
 * @param hasFillInBox - Kasten zum Ergänzen statt grauer Zeile.
 * @returns Höhe in pt für `minPresenceAhead`.
 * @example
 * getCardStartHeight(section, true) // 254 bei Aufbau A
 */
export const getCardStartHeight = (
  section: ReportPayeeSection,
  hasFillInBox: boolean,
): number => {
  const paymentHeight = section.isNoRefund
    ? CARD_PART_HEIGHT.noRefundHint
    : hasFillInBox
      ? CARD_PART_HEIGHT.fillInBox
      : CARD_PART_HEIGHT.paymentLine;
  const isPerBudget = section.groups.some((group) => group.budgetName !== null);
  return (
    CARD_PART_HEIGHT.frame +
    CARD_PART_HEIGHT.head +
    paymentHeight +
    CARD_PART_HEIGHT.tableHeader +
    (isPerBudget ? CARD_PART_HEIGHT.budgetBar : 0) +
    CARD_PART_HEIGHT.row
  );
};
