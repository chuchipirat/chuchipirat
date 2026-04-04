/**
 * Unit-Tests fuer die FieldValidationError-Klasse und FormValidatorUtil.
 */

import {
  FieldValidationError,
  FormValidationFieldError,
  FormValidatorUtil,
} from "../fieldValidation.error.class";

/* ===================================================================
// ======================== Tests =====================================
// =================================================================== */

describe("FieldValidationError", () => {
  describe("Konstruktor", () => {
    test("Erstellt einen Fehler mit Message und formValidation-Liste", () => {
      const validationErrors: FormValidationFieldError[] = [
        {
          priority: 1,
          fieldName: "name",
          errorMessage: "Name ist erforderlich",
        },
        {
          priority: 2,
          fieldName: "email",
          errorMessage: "E-Mail ist ungueltig",
        },
      ];

      const error = new FieldValidationError(
        "Validierung fehlgeschlagen",
        validationErrors
      );

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(FieldValidationError);
      expect(error.message).toBe("Validierung fehlgeschlagen");
      expect(error.formValidation).toEqual(validationErrors);
      expect(error.formValidation).toHaveLength(2);
    });

    test("Verwendet Standardwerte wenn keine Argumente uebergeben werden", () => {
      const error = new FieldValidationError();

      expect(error).toBeInstanceOf(Error);
      expect(error.message).toBe("");
      expect(error.formValidation).toEqual([]);
    });

    test("Verwendet leere formValidation wenn nur Message uebergeben wird", () => {
      const error = new FieldValidationError("Nur eine Nachricht");

      expect(error.message).toBe("Nur eine Nachricht");
      expect(error.formValidation).toEqual([]);
    });
  });
});

describe("FormValidatorUtil", () => {
  const validationErrors: FormValidationFieldError[] = [
    {
      priority: 1,
      fieldName: "name",
      errorMessage: "Name ist erforderlich",
    },
    {
      priority: 2,
      fieldName: "email",
      errorMessage: "E-Mail ist ungueltig",
    },
  ];

  describe("isFieldErroneous", () => {
    test("Gibt true zurueck wenn das Feld in der Fehlerliste vorhanden ist", () => {
      const result = FormValidatorUtil.isFieldErroneous(
        validationErrors,
        "name"
      );

      expect(result).toBe(true);
    });

    test("Gibt false zurueck wenn das Feld nicht in der Fehlerliste vorhanden ist", () => {
      const result = FormValidatorUtil.isFieldErroneous(
        validationErrors,
        "password"
      );

      expect(result).toBe(false);
    });

    test("Gibt false zurueck bei leerer Fehlerliste", () => {
      const result = FormValidatorUtil.isFieldErroneous([], "name");

      expect(result).toBe(false);
    });
  });

  describe("getHelperText", () => {
    test("Gibt die Fehlermeldung zurueck wenn das Feld fehlerhaft ist", () => {
      const result = FormValidatorUtil.getHelperText(
        validationErrors,
        "email",
        "Bitte E-Mail eingeben"
      );

      expect(result).toBe("E-Mail ist ungueltig");
    });

    test("Gibt den Standard-Hilfetext zurueck wenn das Feld nicht fehlerhaft ist", () => {
      const result = FormValidatorUtil.getHelperText(
        validationErrors,
        "password",
        "Mindestens 8 Zeichen"
      );

      expect(result).toBe("Mindestens 8 Zeichen");
    });

    test("Gibt den Standard-Hilfetext zurueck bei leerer Fehlerliste", () => {
      const result = FormValidatorUtil.getHelperText(
        [],
        "name",
        "Name eingeben"
      );

      expect(result).toBe("Name eingeben");
    });
  });
});
