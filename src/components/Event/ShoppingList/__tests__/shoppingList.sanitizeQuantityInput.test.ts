/**
 * Unit-Tests für sanitizeQuantityInput (shoppingList.tsx).
 *
 * Prüft, dass Mengen-Eingaben kein führendes Minuszeichen zulassen und
 * bei einem vollständig parsebaren Wert auf den Maximalwert einer
 * Postgres-`numeric(12,4)`-Spalte gekappt werden, ohne das Tippen von
 * Dezimalzahlen (Zwischenzustände wie "2.") zu stören.
 */
import {TextEncoder, TextDecoder} from "util";
Object.assign(globalThis, {TextEncoder, TextDecoder});

// @react-pdf/renderer ist ESM-only und wird von Jest nicht transformiert —
// shoppingList.tsx importiert transitiv davon (via pdfUtils.ts), obwohl
// sanitizeQuantityInput selbst keine PDF-Abhängigkeit hat.
jest.mock("@react-pdf/renderer", () => ({
  Document: () => null,
  Page: () => null,
  View: () => null,
  Text: () => null,
  Link: () => null,
  Svg: () => null,
  Path: () => null,
  Font: {register: jest.fn(), registerEmojiSource: jest.fn()},
  StyleSheet: {create: (styles: unknown) => styles},
  pdf: jest.fn(),
}));
jest.mock("@react-pdf/types", () => ({}));
jest.mock("../../../Shared/pdfFontRegistration", () => ({}));

import {sanitizeQuantityInput} from "../shoppingList";
import {POSTGRES_NUMERIC_12_4_MAX} from "../../../../constants/defaultValues";

describe("sanitizeQuantityInput", () => {
  test("uebernimmt eine gueltige positive Menge unveraendert", () => {
    expect(sanitizeQuantityInput("250")).toBe("250");
  });

  test("entfernt ein fuehrendes Minuszeichen", () => {
    expect(sanitizeQuantityInput("-5")).toBe("5");
  });

  test("laesst Zwischenzustaende beim Tippen von Dezimalzahlen unangetastet", () => {
    expect(sanitizeQuantityInput("2.")).toBe("2.");
    expect(sanitizeQuantityInput("")).toBe("");
  });

  test("kappt eine Menge ausserhalb des Postgres-numeric(12,4)-Bereichs auf das Maximum", () => {
    expect(sanitizeQuantityInput("99999999999")).toBe(
      String(POSTGRES_NUMERIC_12_4_MAX),
    );
  });
});
