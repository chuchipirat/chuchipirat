import {UserPaymentDetailsDomain} from "../userPaymentDetails.types";
import {UserPaymentDetails} from "../userPaymentDetails.class";

import {
  PLEASE_PROVIDE_STREET as TEXT_PLEASE_PROVIDE_STREET,
  PLEASE_PROVIDE_POSTAL_CODE as TEXT_PLEASE_PROVIDE_POSTAL_CODE,
  PLEASE_PROVIDE_CITY as TEXT_PLEASE_PROVIDE_CITY,
  PLEASE_PROVIDE_IBAN as TEXT_PLEASE_PROVIDE_IBAN,
  PLEASE_PROVIDE_VALID_IBAN as TEXT_PLEASE_PROVIDE_VALID_IBAN,
} from "../../../constants/text/userPaymentDetails";

const userPaymentDetails: UserPaymentDetailsDomain = {
  userId: "user-123",
  street: "Musterstrasse 1",
  postalCode: "1234",
  city: "Hinterpfuffikon",
  iban: "CH9300762011623852957",
};

describe("validatePaymentDetails: Eingabeprüfungen", () => {
  test("vollständige, gültige Angaben werfen nicht", () => {
    // ohne diesen Fall würde eine Prüfung, die immer wirft, alle Tests bestehen
    const validationErrors =
      UserPaymentDetails.validatePaymentDetails(userPaymentDetails);
    expect(validationErrors.length).toBe(0);
  });
  test("IBAN mit Leerzeichen und Kleinbuchstaben ist gültige Eingabe", () => {
    // geprüft wird die normalisierte Form — so tippen Menschen eine IBAN ab
    const validationErrors = UserPaymentDetails.validatePaymentDetails({
      ...userPaymentDetails,
      iban: "ch93 0076 2011 6238 5295 7",
    });

    expect(validationErrors.length).toBe(0);
  });
  test("keine Strasse", () => {
    const userPaymentDetailsMock = {...userPaymentDetails, street: ""};

    let validationErrors = UserPaymentDetails.validatePaymentDetails(
      userPaymentDetailsMock,
    );
    expect(validationErrors.length).toBe(1);
    expect(validationErrors[0].errorMessage).toEqual(
      TEXT_PLEASE_PROVIDE_STREET,
    );

    userPaymentDetailsMock.street = "   "; // nur Leerzeichen
    validationErrors = UserPaymentDetails.validatePaymentDetails(
      userPaymentDetailsMock,
    );
    expect(validationErrors.length).toBe(1);
    expect(validationErrors[0].errorMessage).toEqual(
      TEXT_PLEASE_PROVIDE_STREET,
    );
  });
  test("keine Postleitzahl", () => {
    const userPaymentDetailsMock = {...userPaymentDetails, postalCode: ""};

    let validationErrors = UserPaymentDetails.validatePaymentDetails(
      userPaymentDetailsMock,
    );
    expect(validationErrors.length).toBe(1);
    expect(validationErrors[0].errorMessage).toEqual(
      TEXT_PLEASE_PROVIDE_POSTAL_CODE,
    );

    userPaymentDetailsMock.postalCode = "   "; // nur Leerzeichen
    validationErrors = UserPaymentDetails.validatePaymentDetails(
      userPaymentDetailsMock,
    );

    expect(validationErrors.length).toBe(1);
    expect(validationErrors[0].errorMessage).toEqual(
      TEXT_PLEASE_PROVIDE_POSTAL_CODE,
    );
  });
  test("kein Ort", () => {
    const userPaymentDetailsMock = {...userPaymentDetails, city: ""};

    let validationErrors = UserPaymentDetails.validatePaymentDetails(
      userPaymentDetailsMock,
    );
    expect(validationErrors.length).toBe(1);
    expect(validationErrors[0].errorMessage).toEqual(TEXT_PLEASE_PROVIDE_CITY);

    userPaymentDetailsMock.city = "   "; // nur Leerzeichen
    validationErrors = UserPaymentDetails.validatePaymentDetails(
      userPaymentDetailsMock,
    );

    expect(validationErrors.length).toBe(1);
    expect(validationErrors[0].errorMessage).toEqual(TEXT_PLEASE_PROVIDE_CITY);
  });
  test("kein IBAN", () => {
    const userPaymentDetailsMock = {...userPaymentDetails, iban: ""};

    let validationErrors = UserPaymentDetails.validatePaymentDetails(
      userPaymentDetailsMock,
    );
    expect(validationErrors.length).toBe(1);
    expect(validationErrors[0].errorMessage).toEqual(TEXT_PLEASE_PROVIDE_IBAN);

    userPaymentDetailsMock.iban = "   "; // nur Leerzeichen
    validationErrors = UserPaymentDetails.validatePaymentDetails(
      userPaymentDetailsMock,
    );

    expect(validationErrors.length).toBe(1);
    expect(validationErrors[0].errorMessage).toEqual(TEXT_PLEASE_PROVIDE_IBAN);
  });
  test("falscher IBAN", () => {
    const userPaymentDetailsMock = {
      ...userPaymentDetails,
      iban: "invalid-iban",
    };

    const validationErrors = UserPaymentDetails.validatePaymentDetails(
      userPaymentDetailsMock,
    );
    expect(validationErrors.length).toBe(1);
    expect(validationErrors[0].errorMessage).toEqual(
      TEXT_PLEASE_PROVIDE_VALID_IBAN,
    );
  });
  test("IBAN mit gültiger Form, aber falscher Prüfsumme", () => {
    // Form stimmt → nur die Mod-97-Prüfung kann das abfangen
    const userPaymentDetailsMock = {
      ...userPaymentDetails,
      iban: "CH9300762011623852958",
    };

    const validationErrors = UserPaymentDetails.validatePaymentDetails(
      userPaymentDetailsMock,
    );
    expect(validationErrors.length).toBe(1);
    expect(validationErrors[0].errorMessage).toEqual(
      TEXT_PLEASE_PROVIDE_VALID_IBAN,
    );
  });
});

describe("normalize: Normalisierung der Eingabe", () => {
  test("Leerzeichen am Anfang und Ende werden entfernt", () => {
    const userPaymentDetailsMock = {
      ...userPaymentDetails,
      street: " Musterstrasse 1 ",
      postalCode: " 1234 ",
      city: " Hinterpfuffikon ",
      iban: " CH9300762011623852957 ",
    };

    const normalized = UserPaymentDetails.normalize(userPaymentDetailsMock);
    expect(normalized.street).toBe("Musterstrasse 1");
    expect(normalized.postalCode).toBe("1234");
    expect(normalized.city).toBe("Hinterpfuffikon");
    expect(normalized.iban).toBe("CH9300762011623852957");
  });
  test("IBAN wird auch innen normalisiert (Leerzeichen, Kleinbuchstaben)", () => {
    const normalized = UserPaymentDetails.normalize({
      ...userPaymentDetails,
      iban: "ch93 0076 2011 6238 5295 7",
    });
    expect(normalized.iban).toBe("CH9300762011623852957");
  });
  test("userId bleibt erhalten", () => {
    const normalized = UserPaymentDetails.normalize(userPaymentDetails);
    expect(normalized.userId).toBe("user-123");
  });
  test("Eingabeobjekt bleibt unverändert (neues Objekt)", () => {
    const input = {
      ...userPaymentDetails,
      city: " Hinterpfuffikon ",
      iban: "ch93 0076 2011 6238 5295 7",
    };

    const normalized = UserPaymentDetails.normalize(input);

    expect(normalized).not.toBe(input);
    expect(input.city).toBe(" Hinterpfuffikon ");
    expect(input.iban).toBe("ch93 0076 2011 6238 5295 7");
  });
});
