/**
 * Unit-Tests für paymentDetailsForm.tsx.
 *
 * Das Formular ist "dumm": Werte kommen per Props, Änderungen gehen per
 * `onFieldChange` raus. Getestet wird deshalb, was es meldet und anzeigt —
 * insbesondere die IBAN-Prüfung beim Verlassen des Feldes.
 *
 * Achtung: Das Formular ist kontrolliert. Der Spy aktualisiert die Props
 * nicht, das Eingabefeld zeigt also immer den Wert aus `values`. Blur-Tests
 * rendern den zu prüfenden Wert deshalb direkt in `values`, statt ihn zu tippen.
 */
import React from "react";
import {fireEvent, render, screen} from "@testing-library/react";
import "@testing-library/jest-dom";

import {PaymentDetailsForm} from "../paymentDetailsForm";
import {UserPaymentDetailsDomain} from "../userPaymentDetails.types";
import {FormValidationFieldError} from "../../Shared/fieldValidation.error.class";
import {
  STREET as TEXT_STREET,
  POSTAL_CODE as TEXT_POSTAL_CODE,
  CITY as TEXT_CITY,
  IBAN as TEXT_IBAN,
  IBAN_HINT as TEXT_IBAN_HINT,
  IBAN_VALID as TEXT_IBAN_VALID,
  IBAN_INVALID as TEXT_IBAN_INVALID,
  PLEASE_PROVIDE_VALID_IBAN as TEXT_PLEASE_PROVIDE_VALID_IBAN,
} from "../../../constants/text";

/* ===================================================================
// ======================== Testdaten & Helfer =========================
// =================================================================== */
const emptyValues: UserPaymentDetailsDomain = {
  userId: "",
  street: "",
  postalCode: "",
  city: "",
  iban: "",
};

/**
 * Rendert das Formular und gibt den Spy für `onFieldChange` zurück.
 *
 * @param values - Startwerte (Standard: leer).
 * @param formValidation - Feldfehler vom Speichern (Standard: keine).
 * @returns Der Spy, mit dem geprüft wird, was das Formular meldet.
 */
const renderForm = (
  values: UserPaymentDetailsDomain = emptyValues,
  formValidation: FormValidationFieldError[] = [],
) => {
  const onFieldChange = jest.fn();
  render(
    <PaymentDetailsForm
      values={values}
      formValidation={formValidation}
      onFieldChange={onFieldChange}
    />,
  );
  return {onFieldChange};
};

/**
 * Liefert das IBAN-Eingabefeld.
 *
 * @returns Das `<input>` des IBAN-Feldes.
 */
const getIbanInput = () => screen.getByLabelText(TEXT_IBAN);

/* ===================================================================
// ======================== Eingabe ====================================
// =================================================================== */
describe("PaymentDetailsForm: Eingabe", () => {
  test.each([
    [TEXT_STREET, "street", "Beispielstrasse 1"],
    [TEXT_POSTAL_CODE, "postalCode", "8000"],
    [TEXT_CITY, "city", "Zürich"],
  ])("Feld «%s» meldet die Eingabe als %s", (label, fieldName, value) => {
    const {onFieldChange} = renderForm();

    fireEvent.change(screen.getByLabelText(label), {target: {value}});

    expect(onFieldChange).toHaveBeenCalledWith(fieldName, value);
  });

  test("IBAN wird beim Tippen nicht formatiert, sondern roh gemeldet", () => {
    const {onFieldChange} = renderForm();

    // klein geschrieben, mit Leerzeichen — so tippt man eine IBAN ab
    fireEvent.change(getIbanInput(), {target: {value: "ch93 0076 2011"}});

    // genau einmal und genau der Rohwert — keine Grossbuchstaben, keine Viererblöcke
    expect(onFieldChange).toHaveBeenCalledTimes(1);
    expect(onFieldChange).toHaveBeenCalledWith("iban", "ch93 0076 2011");
  });

  test("ohne Prüfung zeigt das IBAN-Feld den Eingabehinweis, keinen Fehler", () => {
    renderForm();

    expect(screen.getByText(TEXT_IBAN_HINT)).toBeInTheDocument();
    expect(getIbanInput()).toHaveAttribute("aria-invalid", "false");
  });
});

/* ===================================================================
// ======================== IBAN beim Verlassen des Feldes =============
// =================================================================== */
describe("PaymentDetailsForm: IBAN beim Verlassen des Feldes", () => {
  test("gültige IBAN wird formatiert und als gültig markiert", () => {
    const {onFieldChange} = renderForm({
      ...emptyValues,
      iban: "ch9300762011623852957",
    });

    fireEvent.blur(getIbanInput());

    expect(onFieldChange).toHaveBeenCalledWith(
      "iban",
      "CH93 0076 2011 6238 5295 7",
    );
    expect(screen.getByText(TEXT_IBAN_VALID)).toBeInTheDocument();
    expect(getIbanInput()).toHaveAttribute("aria-invalid", "false");
  });

  test("falsche Prüfsumme: wird trotzdem formatiert, Feld zeigt den Fehler", () => {
    const {onFieldChange} = renderForm({
      ...emptyValues,
      iban: "CH9300762011623852958",
    });

    fireEvent.blur(getIbanInput());

    // auch eine ungültige IBAN wird lesbar gruppiert — erleichtert das Finden des Tippfehlers
    expect(onFieldChange).toHaveBeenCalledWith(
      "iban",
      "CH93 0076 2011 6238 5295 8",
    );
    expect(screen.getByText(TEXT_IBAN_INVALID)).toBeInTheDocument();
    expect(getIbanInput()).toHaveAttribute("aria-invalid", "true");
  });

  test("nach einem Fehler verschwindet der Fehlerzustand beim erneuten Tippen", () => {
    renderForm({...emptyValues, iban: "CH9300762011623852958"});
    fireEvent.blur(getIbanInput());
    expect(getIbanInput()).toHaveAttribute("aria-invalid", "true");

    // anderer Wert als in `values`, sonst löst React kein onChange aus
    fireEvent.change(getIbanInput(), {target: {value: "CH930076201162385295"}});

    // beim Korrigieren nicht rot bleiben — zurück zum Eingabehinweis
    expect(getIbanInput()).toHaveAttribute("aria-invalid", "false");
    expect(screen.queryByText(TEXT_IBAN_INVALID)).not.toBeInTheDocument();
    expect(screen.getByText(TEXT_IBAN_HINT)).toBeInTheDocument();
  });

  test("leeres Feld: kein onFieldChange, kein Fehler", () => {
    const {onFieldChange} = renderForm();

    fireEvent.blur(getIbanInput());

    expect(onFieldChange).not.toHaveBeenCalled();
    expect(getIbanInput()).toHaveAttribute("aria-invalid", "false");
    expect(screen.getByText(TEXT_IBAN_HINT)).toBeInTheDocument();
  });

  test("nur Leerzeichen gelten als leer", () => {
    const {onFieldChange} = renderForm({...emptyValues, iban: "   "});

    fireEvent.blur(getIbanInput());

    expect(onFieldChange).not.toHaveBeenCalled();
    expect(getIbanInput()).toHaveAttribute("aria-invalid", "false");
  });
});

/* ===================================================================
// ======================== Feldfehler vom Speichern ===================
// =================================================================== */
describe("PaymentDetailsForm: Feldfehler vom Speichern", () => {
  test("Fehler vom Speichern hat Vorrang vor dem Live-Status «gültig»", () => {
    // Live-Status sagt "gültig", der Dialog meldet trotzdem einen IBAN-Fehler
    renderForm({...emptyValues, iban: "CH9300762011623852957"}, [
      {
        priority: 5,
        fieldName: "iban",
        errorMessage: TEXT_PLEASE_PROVIDE_VALID_IBAN,
      },
    ]);
    fireEvent.blur(getIbanInput());

    expect(
      screen.getByText(TEXT_PLEASE_PROVIDE_VALID_IBAN),
    ).toBeInTheDocument();
    expect(screen.queryByText(TEXT_IBAN_VALID)).not.toBeInTheDocument();
    expect(getIbanInput()).toHaveAttribute("aria-invalid", "true");
  });

  test("Feldfehler erscheint am richtigen Feld", () => {
    renderForm(emptyValues, [
      {priority: 3, fieldName: "city", errorMessage: "Bitte Ort angeben."},
    ]);

    expect(screen.getByLabelText(TEXT_CITY)).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    expect(screen.getByLabelText(TEXT_STREET)).toHaveAttribute(
      "aria-invalid",
      "false",
    );
    expect(screen.getByText("Bitte Ort angeben.")).toBeInTheDocument();
  });
});
