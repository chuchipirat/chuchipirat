import {UserPaymentDetailsDomain} from "./userPaymentDetails.types";
import {FieldValidationError} from "../Shared/fieldValidation.error.class";

import {normalizeIban, isValidIban} from "../../utils/ibanUtils";
import {
  PLEASE_PROVIDE_STREET as TEXT_PLEASE_PROVIDE_STREET,
  PLEASE_PROVIDE_POSTAL_CODE as TEXT_PLEASE_PROVIDE_POSTAL_CODE,
  PLEASE_PROVIDE_CITY as TEXT_PLEASE_PROVIDE_CITY,
  PLEASE_PROVIDE_IBAN as TEXT_PLEASE_PROVIDE_IBAN,
  PLEASE_PROVIDE_VALID_IBAN as TEXT_PLEASE_PROVIDE_VALID_IBAN,
} from "../../constants/text/userPaymentDetails";

/**
 * Domain-Logik für Zahlungsangaben: Prüfen und Normalisieren vor dem
 * Speichern (Vorbild `Expense.checkExpenseData`).
 *
 * Ablauf beim Speichern: `checkPaymentDetailsData()` → `normalize()` →
 * `UserPaymentDetailsRepository.savePaymentDetails()`.
 */
export class UserPaymentDetails {
  /**
   * Prüft, ob alle Pflichtfelder ausgefüllt sind und die IBAN gültig ist.
   * Die IBAN wird dafür normalisiert betrachtet — "ch93 0076 …" ist eine
   * gültige Eingabe.
   *
   * @param paymentDetails - Die Zahlungsangaben, wie sie eingegeben wurden.
   * @throws {FieldValidationError} Wenn ein Pflichtfeld leer ist (auch nur
   *   Leerzeichen) oder die IBAN Form/Prüfsumme verletzt.
   * @example
   * UserPaymentDetails.checkPaymentDetailsData({...details, iban: "ch93 0076 2011 6238 5295 7"}); // wirft nicht
   */
  static checkPaymentDetailsData(
    paymentDetails: UserPaymentDetailsDomain,
  ): void {
    if (!paymentDetails.street.trim()) {
      throw new FieldValidationError(TEXT_PLEASE_PROVIDE_STREET);
    }
    if (!paymentDetails.postalCode.trim()) {
      throw new FieldValidationError(TEXT_PLEASE_PROVIDE_POSTAL_CODE);
    }
    if (!paymentDetails.city.trim()) {
      throw new FieldValidationError(TEXT_PLEASE_PROVIDE_CITY);
    }
    if (!paymentDetails.iban.trim()) {
      throw new FieldValidationError(TEXT_PLEASE_PROVIDE_IBAN);
    }
    if (!isValidIban(normalizeIban(paymentDetails.iban))) {
      throw new FieldValidationError(TEXT_PLEASE_PROVIDE_VALID_IBAN);
    }
  }

  /**
   * Bringt die Zahlungsangaben in die gespeicherte Form: Textfelder
   * getrimmt, IBAN normalisiert. Nötig, weil die DB zwar `btrim(...)`
   * prüft, aber ungetrimmt speichert.
   *
   * @param paymentDetails - Die Zahlungsangaben, wie sie eingegeben wurden.
   * @returns Neues Objekt mit normalisierten Werten (Eingabe bleibt unverändert).
   * @example
   * UserPaymentDetails.normalize({...details, city: " Bern ", iban: "ch93 0076 2011 6238 5295 7"});
   * // → {...details, city: "Bern", iban: "CH9300762011623852957"}
   */
  static normalize(
    paymentDetails: UserPaymentDetailsDomain,
  ): UserPaymentDetailsDomain {
    return {
      ...paymentDetails,
      street: paymentDetails.street.trim(),
      postalCode: paymentDetails.postalCode.trim(),
      city: paymentDetails.city.trim(),
      iban: normalizeIban(paymentDetails.iban),
    };
  }
}
