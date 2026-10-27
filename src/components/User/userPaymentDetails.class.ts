import {normalizeIban, isValidIban} from "../../utils/ibanUtils";
import {
  PLEASE_PROVIDE_STREET as TEXT_PLEASE_PROVIDE_STREET,
  PLEASE_PROVIDE_POSTAL_CODE as TEXT_PLEASE_PROVIDE_POSTAL_CODE,
  PLEASE_PROVIDE_CITY as TEXT_PLEASE_PROVIDE_CITY,
  PLEASE_PROVIDE_IBAN as TEXT_PLEASE_PROVIDE_IBAN,
  PLEASE_PROVIDE_VALID_IBAN as TEXT_PLEASE_PROVIDE_VALID_IBAN,
} from "../../constants/text/userPaymentDetails";
import {FormValidationFieldError} from "../Shared/fieldValidation.error.class";
import {PaymentDetailsFormValues} from "./userPaymentDetails.types";

/**
 * Domain-Logik für Zahlungsangaben: Prüfen und Normalisieren vor dem
 * Speichern (Vorbild `Expense.checkExpenseData`).
 *
 * Ablauf beim Speichern: `validatePaymentDetails()` → `normalize()` →
 * `UserPaymentDetailsRepository.savePaymentDetails()`.
 */
export class UserPaymentDetails {
  /**
   * Prüft, ob alle Pflichtfelder ausgefüllt sind und die IBAN gültig ist.
   * Die IBAN wird dafür normalisiert betrachtet — "ch93 0076 …" ist eine
   * gültige Eingabe.
   *
   * @param paymentDetails - Die Zahlungsangaben, wie sie eingegeben wurden;
   *   ohne `userId`, damit auch der Abrechnungsdialog prüfen kann (Story 7.4).
   * @returns Array mit Validierungsfehlern (leer wenn alles korrekt).
   * @example
   * UserPaymentDetails.validatePaymentDetails({...details, iban: "ch93 0076 2011 6238 5295 7"});
   */
  static validatePaymentDetails(
    paymentDetails: PaymentDetailsFormValues,
  ): FormValidationFieldError[] {
    const formValidation: FormValidationFieldError[] = [];

    if (!paymentDetails.street.trim()) {
      formValidation.push({
        priority: 1,
        fieldName: "street",
        errorMessage: TEXT_PLEASE_PROVIDE_STREET,
      });
    }
    if (!paymentDetails.postalCode.trim()) {
      formValidation.push({
        priority: 2,
        fieldName: "postalCode",
        errorMessage: TEXT_PLEASE_PROVIDE_POSTAL_CODE,
      });
    }
    if (!paymentDetails.city.trim()) {
      formValidation.push({
        priority: 3,
        fieldName: "city",
        errorMessage: TEXT_PLEASE_PROVIDE_CITY,
      });
    }
    if (!paymentDetails.iban.trim()) {
      formValidation.push({
        priority: 4,
        fieldName: "iban",
        errorMessage: TEXT_PLEASE_PROVIDE_IBAN,
      });
    }
    if (
      paymentDetails.iban.trim() &&
      !isValidIban(normalizeIban(paymentDetails.iban))
    ) {
      formValidation.push({
        priority: 5,
        fieldName: "iban",
        errorMessage: TEXT_PLEASE_PROVIDE_VALID_IBAN,
      });
    }
    return formValidation;
  }

  /**
   * Bringt die Zahlungsangaben in die gespeicherte Form: Textfelder
   * getrimmt, IBAN normalisiert. Nötig, weil die DB zwar `btrim(...)`
   * prüft, aber ungetrimmt speichert.
   *
   * @template T - Typ der Eingabe; die Rückgabe hat denselben Typ. So
   *   behält das Profil seine `userId`, Formularwerte bleiben ohne.
   * @param paymentDetails - Die Zahlungsangaben, wie sie eingegeben wurden.
   * @returns Neues Objekt mit normalisierten Werten (Eingabe bleibt
   *   unverändert), alle übrigen Felder wie übergeben.
   * @example
   * UserPaymentDetails.normalize({...details, city: " Bern ", iban: "ch93 0076 2011 6238 5295 7"});
   * // → {...details, city: "Bern", iban: "CH9300762011623852957"}
   */
  static normalize<T extends PaymentDetailsFormValues>(paymentDetails: T): T {
    return {
      ...paymentDetails,
      street: paymentDetails.street.trim(),
      postalCode: paymentDetails.postalCode.trim(),
      city: paymentDetails.city.trim(),
      iban: normalizeIban(paymentDetails.iban),
    };
  }
}
