/**
 * UI-Textkonstanten für das Abrechnungsmodul.
 */

import {formatAmountFromCents} from "../../components/Shared/utils/currencyUtils";

/* =====================================================================
// Abrechnungsseite
// ===================================================================== */
export const EXPENSE_TRACKING = "Abrechnung";
export const EXPENSE_TRACKING_NOT_ACTIVE =
  "Abrechnung – nur eine Spende entfernt";
export const EXPENSE_TRACKING_NOT_ACTIVE_DESCRIPTION =
  "Mit der Abrechnung sammelt eure Küchencrew alle Ausgaben des Anlasses " +
  "und erstellt daraus automatisch eine fixfertige Abrechnung – ganz ohne Excel. " +
  "Dieser Bereich steht dir zur Verfügung, sobald du für diesen Anlass gespendet hast. " +
  "Mit deiner Spende unterstützt du den Betrieb und die laufenden " +
  "Kosten von chuchipirat. Mehr zur Funktion findest du im";
/**
 * Link-Beschriftung für das Helpcenter, das an
 * {@link EXPENSE_TRACKING_NOT_ACTIVE_DESCRIPTION} angehängt wird.
 */
export const EXPENSE_TRACKING_NOT_ACTIVE_DESCRIPTION_HELPCENTER_LINK =
  "Helpcenter";

export const BUDGET_TYPE_PER_PERSON_PER_DAY_AMOUNT = (
  amountInCents: number | null,
  currency: string,
) => {
  if (!amountInCents) {
    return `${currency} - / Person & Tag`;
  }
  return `${formatAmountFromCents(amountInCents, currency)} / Person & Tag`;
};

export const EDIT_BUDGET = "Budget bearbeiten";
export const BUDGET_TYPE_FIXED_AMOUNT = "Fixbetrag";
export const BUDGET_TYPE_PER_PERSON_PER_DAY = "Pro Person & Tag";
/**
 * Chip-Label fuer ein "pro Person & Tag"-Budget.
 *
 * @param rateInCents - Ansatz pro Person und Tag, in Rappen. `null`, wenn noch nicht festgelegt.
 * @param currency - ISO-4217-Waehrungscode.
 * @returns z.B. "CHF 8.50 / Person & Tag" oder Hinweistext, falls kein Ansatz gesetzt ist.
 */
export const BUDGET_PER_PERSON_PER_DAY = (
  rateInCents: number | null,
  currency: string,
): string =>
  rateInCents != null
    ? `${formatAmountFromCents(rateInCents, currency)} / Person & Tag`
    : "Budget noch nicht festgelegt";

/**
 * Anzeige des Soll-Betrags eines Fixbetrag-Budgets.
 *
 * @param amountInCents - Budgetbetrag in Rappen.
 * @param currency - ISO-4217-Waehrungscode.
 * @returns z.B. "Budget: CHF 2'000.00".
 */
export const BUDGET_TARGET_AMOUNT = (
  amountInCents: number,
  currency: string,
): string => `Budget: ${formatAmountFromCents(amountInCents, currency)}`;

/** Hinweistext, wenn fuer ein Fixbetrag-Budget noch kein Betrag hinterlegt ist. */
export const BUDGET_TARGET_AMOUNT_MISSING = "Kein Betrag festgelegt";
export const NEW_BUDGET = "Neues Budget";

export const EXPENSE_TRACKING_OVERVIEW = "Übersicht";
export const EXPENSE_TRACKING_EXPENSES = "Ausgaben";
export const BUDGET_NAME = "Name";
export const PLEASE_PROVIDE_NAME = "Bitte einen Namen angeben.";
export const BUDGET_AMOUNT = "Betrag";
export const PLEASE_PROVIDE_AMOUNT = "Bitte einen gültigen Betrag angeben";
export const BUDGET_CURRENCY = "Währung";
export const BUDGET_ICON = "Icon";
export const PLEASE_PROVIDE_ICON = "Bitte ein Icon auswählen";
export const BUDGET_TYPE = "Typ";
export const PROVIDE_BUDGET_TYPE = "Bitte Budget-Typ wählen";
export const BUDGET_SAVED = "Budget wurde gespeichert.";
export const BUDGET_ICON_INVALID = "Das gewählte Icon ist nicht gültig";

export const SPENT_AMOUNT = (amountInCents: number, currency: string): string =>
  formatAmountFromCents(amountInCents, currency);

export const OF_LIMIT = (amountInCents: number, currency: string): string =>
  `von ${formatAmountFromCents(amountInCents, currency)}`;
