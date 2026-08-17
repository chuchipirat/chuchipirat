/**
 * Unit-Tests für clampQuantity (recipe.edit.tsx).
 *
 * Prüft, dass Mengen-Eingaben für Zutaten und Materialien auf einen
 * gültigen Bereich gekappt werden: negative und nicht parsebare Eingaben
 * werden zu 0, zu grosse Werte auf den Maximalwert einer Postgres-
 * `numeric(12,4)`-Spalte (`recipe_ingredients.quantity` /
 * `recipe_materials.quantity`) gekappt.
 */
// Polyfill für jsdom (react-router benötigt TextEncoder/TextDecoder)
import {TextEncoder, TextDecoder} from "util";
Object.assign(globalThis, {TextEncoder, TextDecoder});

// @react-pdf/renderer ist ESM-only und wird von Jest nicht transformiert —
// recipe.edit.tsx importiert transitiv (via recipe.tsx → recipe.view.tsx →
// pdfUtils.ts) davon, obwohl clampQuantity selbst keine PDF-Abhängigkeit hat.
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
jest.mock("../../Shared/pdfFontRegistration", () => ({}));

import {clampQuantity} from "../recipe.edit";
import {POSTGRES_NUMERIC_12_4_MAX} from "../../../constants/defaultValues";

describe("clampQuantity", () => {
  test("uebernimmt eine gueltige positive Menge unveraendert", () => {
    expect(clampQuantity("250")).toBe(250);
    expect(clampQuantity("12.5")).toBe(12.5);
  });

  test("kappt eine negative Menge auf 0", () => {
    expect(clampQuantity("-5")).toBe(0);
  });

  test("kappt eine Menge ausserhalb des Postgres-numeric(12,4)-Bereichs auf das Maximum", () => {
    expect(clampQuantity("99999999999")).toBe(POSTGRES_NUMERIC_12_4_MAX);
  });

  test("behandelt leere/nicht parsebare Eingabe als 0", () => {
    expect(clampQuantity("")).toBe(0);
    expect(clampQuantity("abc")).toBe(0);
  });
});
