/**
 * Unit-Tests fuer DialogCreateUnitConversion.
 *
 * Prueft Rendering fuer BASIC- und PRODUCT-Typen, Validierung
 * bei leeren/ungueltigen Feldern und den handleCreate-Callback
 * mit korrektem UnitConversion-Objekt.
 */
import {TextEncoder, TextDecoder} from "util";
Object.assign(global, {TextEncoder, TextDecoder});

import React from "react";
import {render, screen, waitFor, fireEvent} from "@testing-library/react";
import "@testing-library/jest-dom";
import userEvent from "@testing-library/user-event";

import {
  DialogCreateUnitConversion,
  UnitConversionType,
} from "../dialogCreateUnitConversion";
import {Unit, UnitDimension} from "../unit.class";
import {Product} from "../../Product/product.types";

/* ===================================================================
// ======================== Mocks =====================================
// =================================================================== */

// crypto.randomUUID wird in UnitConversion.createUnitConversion* verwendet
const MOCK_UUID = "test-uuid-1234";
beforeAll(() => {
  Object.defineProperty(globalThis.crypto, "randomUUID", {
    value: jest.fn(() => MOCK_UUID),
    writable: true,
  });
});

const mockUnits: Unit[] = [
  {key: "kg", name: "Kilogramm", dimension: UnitDimension.mass},
  {key: "g", name: "Gramm", dimension: UnitDimension.mass},
  {key: "l", name: "Liter", dimension: UnitDimension.volume},
  {key: "Stk", name: "Stück", dimension: UnitDimension.dimensionless},
];

const mockProducts: Product[] = [
  {
    uid: "prod-1",
    name: "Butter",
    department: {uid: "dep-1", name: "Milchprodukte"},
    shoppingUnit: "g",
    dietProperties: {allergens: [], diet: 1},
    usable: true,
  },
  {
    uid: "prod-2",
    name: "Mehl",
    department: {uid: "dep-2", name: "Backwaren"},
    shoppingUnit: "kg",
    dietProperties: {allergens: [], diet: 1},
    usable: true,
  },
];

beforeEach(() => jest.clearAllMocks());

/* ===================================================================
// ======================== Render-Helper =============================
// =================================================================== */

interface RenderOptions {
  dialogOpen?: boolean;
  unitConversionType?: UnitConversionType;
  units?: Unit[];
  products?: Product[];
  handleCreate?: jest.Mock;
  handleClose?: jest.Mock;
}

/**
 * Rendert den DialogCreateUnitConversion mit konfigurierbaren Props.
 *
 * @param options - Optionale Konfiguration der Dialog-Props.
 * @returns Objekt mit den Mock-Callbacks.
 */
const renderDialog = (options: RenderOptions = {}) => {
  const {
    dialogOpen = true,
    unitConversionType = UnitConversionType.BASIC,
    units = mockUnits,
    products = mockProducts,
    handleCreate = jest.fn(),
    handleClose = jest.fn(),
  } = options;

  render(
    <DialogCreateUnitConversion
      dialogOpen={dialogOpen}
      unitConversionType={unitConversionType}
      units={units}
      products={products}
      handleCreate={handleCreate}
      handleClose={handleClose}
    />
  );

  return {handleCreate, handleClose};
};

/* ===================================================================
// ======================== Tests — BASIC =============================
// =================================================================== */

describe("DialogCreateUnitConversion — BASIC", () => {
  test("Rendert fuer BASIC-Typ ohne Produkt-Feld", () => {
    renderDialog({unitConversionType: UnitConversionType.BASIC});

    // Dialog-Titel sichtbar
    expect(
      screen.getByText("Neue Einheitenumrechnung anlegen")
    ).toBeInTheDocument();

    // Menge- und Einheitsfelder sichtbar
    expect(screen.getByLabelText(/Menge von/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Menge nach/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Einheit Von/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Einheit Nach/i)).toBeInTheDocument();

    // Kein Produkt-Feld
    expect(screen.queryByLabelText(/Produkt/i)).not.toBeInTheDocument();

    // Kein Info-Alert (nur bei PRODUCT-Typ)
    expect(screen.queryByText("Metrisches System")).not.toBeInTheDocument();
  });

  test("Zeigt Validierungsfehler bei leeren/ungueltigen Feldern", async () => {
    const handleCreate = jest.fn();
    renderDialog({
      unitConversionType: UnitConversionType.BASIC,
      handleCreate,
    });

    // fireEvent.submit umgeht die native required-Validierung des Browsers,
    // damit die React-eigene Validierung in isInputValid greift.
    const form = document.querySelector("form")!;
    fireEvent.submit(form);

    // Alle Validierungsfehler muessen erscheinen
    await waitFor(() => {
      const greaterZeroErrors = screen.getAllByText(
        "Bitte Wert grösser 0 angeben."
      );
      expect(greaterZeroErrors).toHaveLength(2); // denominator + numerator
    });

    const unitErrors = screen.getAllByText("Bitte Einheit angeben.");
    expect(unitErrors).toHaveLength(2); // fromUnit + toUnit

    expect(handleCreate).not.toHaveBeenCalled();
  });

  test("Ruft handleCreate mit korrektem UnitConversion-Objekt auf", async () => {
    const handleCreate = jest.fn();
    renderDialog({
      unitConversionType: UnitConversionType.BASIC,
      handleCreate,
    });

    // Menge-Felder ausfuellen
    await userEvent.type(screen.getByLabelText(/Menge von/i), "1000");
    await userEvent.type(screen.getByLabelText(/Menge nach/i), "1");

    // Einheit-Von auswaehlen (Autocomplete)
    const fromUnitInput = screen.getByLabelText(/Einheit Von/i);
    await userEvent.click(fromUnitInput);
    await userEvent.type(fromUnitInput, "g");
    // Auf die Option in der Dropdown-Liste klicken
    const fromOption = await screen.findByRole("option", {name: "g"});
    await userEvent.click(fromOption);

    // Einheit-Nach auswaehlen
    const toUnitInput = screen.getByLabelText(/Einheit Nach/i);
    await userEvent.click(toUnitInput);
    await userEvent.type(toUnitInput, "kg");
    const toOption = await screen.findByRole("option", {name: "kg"});
    await userEvent.click(toOption);

    // Erstellen klicken
    await userEvent.click(screen.getByRole("button", {name: /erstellen/i}));

    await waitFor(() => {
      expect(handleCreate).toHaveBeenCalledTimes(1);
    });

    const createdConversion = handleCreate.mock.calls[0][0];
    expect(createdConversion.uid).toBe(MOCK_UUID);
    expect(createdConversion.denominator).toBe(1000);
    expect(createdConversion.numerator).toBe(1);
    expect(createdConversion.fromUnit).toBe("g");
    expect(createdConversion.toUnit).toBe("kg");
  });
});

/* ===================================================================
// ======================== Tests — PRODUCT ===========================
// =================================================================== */

describe("DialogCreateUnitConversion — PRODUCT", () => {
  test("Rendert fuer PRODUCT-Typ mit Produkt-Autocomplete und Info-Alert", () => {
    renderDialog({unitConversionType: UnitConversionType.PRODUCT});

    // Dialog-Titel sichtbar
    expect(
      screen.getByText("Neue Einheitenumrechnung anlegen")
    ).toBeInTheDocument();

    // Produkt-Feld sichtbar
    expect(screen.getByLabelText(/Produkt/i)).toBeInTheDocument();

    // Info-Alert sichtbar
    expect(screen.getByText("Metrisches System")).toBeInTheDocument();

    // Menge- und Einheitsfelder ebenfalls sichtbar
    expect(screen.getByLabelText(/Menge von/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Menge nach/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Einheit Von/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Einheit Nach/i)).toBeInTheDocument();
  });

  test("Zeigt Produkt-Validierungsfehler bei PRODUCT-Typ", async () => {
    const handleCreate = jest.fn();
    renderDialog({
      unitConversionType: UnitConversionType.PRODUCT,
      handleCreate,
    });

    // fireEvent.submit umgeht die native required-Validierung des Browsers
    const form = document.querySelector("form")!;
    fireEvent.submit(form);

    // Produkt-Fehler muss erscheinen
    await waitFor(() => {
      expect(screen.getByText("Bitte Produkt wählen.")).toBeInTheDocument();
    });

    // Alle anderen Fehler ebenfalls
    const greaterZeroErrors = screen.getAllByText(
      "Bitte Wert grösser 0 angeben."
    );
    expect(greaterZeroErrors).toHaveLength(2);

    const unitErrors = screen.getAllByText("Bitte Einheit angeben.");
    expect(unitErrors).toHaveLength(2);

    expect(handleCreate).not.toHaveBeenCalled();
  });
});
