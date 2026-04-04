/**
 * Beschreibung eines Validierungsfehlers für ein einzelnes Formularfeld.
 *
 * @param priority Priorität des Fehlers (je tiefer, desto wichtiger).
 * @param fieldName Name des betroffenen Feldes.
 * @param errorMessage Anzuzeigende Fehlermeldung.
 * @param errorObject Optionales Fehlerobjekt mit zusätzlichen Details.
 */
export interface FormValidationFieldError {
  priority: number;
  fieldName: string;
  errorMessage: string;
  errorObject?: unknown;
}

/**
 * Fehlerklasse für Formular-Validierungen. Enthält eine Liste
 * von `FormValidationFieldError`-Einträgen für alle fehlerhaften Felder.
 *
 * @example
 * throw new FieldValidationError("Validierung fehlgeschlagen", [
 *   { priority: 1, fieldName: "name", errorMessage: "Name ist erforderlich" }
 * ]);
 */
export class FieldValidationError extends Error {
  formValidation: FormValidationFieldError[];
  constructor(message?: string, formValidation?: FormValidationFieldError[]) {
    super(message);
    this.formValidation = formValidation ? formValidation : [];
  }
}

/**
 * Hilfsfunktionen für die Formularfeld-Validierung.
 */
export class FormValidatorUtil {
  /**
   * Prüft ob ein bestimmtes Feld einen Validierungsfehler hat.
   *
   * @param formValidation Liste aller Validierungsfehler.
   * @param fieldName Name des zu prüfenden Feldes.
   * @returns `true` wenn das Feld fehlerhaft ist.
   */
  static isFieldErroneous(
    formValidation: FormValidationFieldError[],
    fieldName: string
  ) {
    return Boolean(
      formValidation?.find((field) => field.fieldName === fieldName)
    );
  }
  /**
   * Gibt den Hilfetext für ein Feld zurück — entweder die Fehlermeldung
   * oder den Standard-Hilfetext.
   *
   * @param formValidation Liste aller Validierungsfehler.
   * @param fieldName Name des Feldes.
   * @param defaultHelpertext Standard-Text wenn kein Fehler vorliegt.
   * @returns Fehlermeldung oder Standard-Text.
   */
  static getHelperText(
    formValidation: FormValidationFieldError[],
    fieldName: string,
    defaultHelpertext: string
  ) {
    const formField = formValidation?.find(
      (field) => field.fieldName === fieldName
    );

    if (formField) {
      return formField.errorMessage;
    } else {
      return defaultHelpertext;
    }
  }
}
