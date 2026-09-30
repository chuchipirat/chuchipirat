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
export const BUDGET = "Budget";
export const EXPENSE_TRACKING_OVERVIEW = "Übersicht";
export const EXPENSE_TRACKING_EXPENSES = "Ausgaben";
export const BUDGET_NAME = "Name";
export const PLEASE_PROVIDE_NAME = "Bitte einen Namen angeben.";
export const PLEASE_PROVIDE_AMOUNT = "Bitte einen gültigen Betrag angeben.";
export const CURRENCY = "Währung";
export const BUDGET_ICON = "Icon";
export const PLEASE_PROVIDE_ICON = "Bitte ein Icon auswählen.";
export const BUDGET_TYPE = "Typ";
export const PROVIDE_BUDGET_TYPE = "Bitte Budget-Typ wählen.";
export const BUDGET_SAVED = "Budget wurde gespeichert.";
export const BUDGET_UPDATED = "Budget wurde angepasst.";
export const BUDGET_DELETED = "Budget wurde gelöscht.";
export const BUDGET_ICON_INVALID = "Das gewählte Icon ist nicht gültig.";
export const DELETE_BUDGET_DIALOG = (budgetName: string): string =>
  `Budget «${budgetName}» löschen?`;
export const DELETE_BUDGET_SIMPLE =
  "Diese Aktion kann nicht rückgängig gemacht werden.";
export const BUDGET_CANT_BE_DELETED = "Budget kann nicht gelöscht werden.";
export const BUDGET_HAS_EXPENSES =
  "Dieses Budget hat noch Ausgaben und kann nicht gelöscht werden.";
export const SPENT_AMOUNT = (amountInCents: number, currency: string): string =>
  formatAmountFromCents(amountInCents, currency);

export const OF_LIMIT = (amountInCents: number, currency: string): string =>
  `von ${formatAmountFromCents(amountInCents, currency)}`;
export const PLEASE_CREATE_BUDGET_FIRST = "Lege zuerst ein Budget an.";
// Ausgaben
export const EXPENSE = "Ausgabe";
export const PLEASE_PROVIDE_LABEL = "Bitte eine Bezeichnung angeben.";
export const EXPENSE_AMOUNT_TOO_LARGE = "Bitte kleineren Ausgabebetrag wählen.";
export const PLEASE_PROVIDE_BUDGET = "Bitte ein Budget wählen.";
export const PLEASE_PROVIDE_DATE = "Bitte Ausgabedatum angeben.";
export const PLEASE_PROVIDE_CURRENCY = "Bitte Währung wählen.";

export const NO_EXPENSES_YET = "Noch keine Ausgaben.";
export const NEW_EXPENSE = "Neue Ausgabe";
export const LABEL = "Bezeichnung";
export const PLACEHOLDER_LABEL = "z.B. Grosseinkauf Migros";
export const OPTIONAL = "optional";
export const EXPENSE_SAVED = "Ausgabe wurde gespeichert.";
export const EXPENSE_UPDATED = "Ausgabe wurde angepasst.";
export const EXPENSE_DELETED = "Ausgabe wurde gelöscht.";
export const PAYEE = "Wer hat bezahlt?";
export const PAYEE_EXISTING_USER = "Bestehende Person";
export const PLEASE_PROVIDE_PAYEE = "Bitte eine Person wählen.";
export const PAYEE_NEW_PERSON = "Neue Person erfassen";
export const PLEASE_PROVIDE_PAYEE_NAME = "Bitte einen Namen angeben.";
export const PAYEE_NO_REFUND_NEEDED = "Keine Rückerstattung nötig";
export const FORMER_EVENT_COOK = "Ehemalige Person";
export const DELETE_EXPENSE_DIALOG = (
  label: string,
  amountInCents: number,
  currency: string,
): string =>
  `Ausgabe «${label}» (${formatAmountFromCents(amountInCents, currency)}) löschen?`;
