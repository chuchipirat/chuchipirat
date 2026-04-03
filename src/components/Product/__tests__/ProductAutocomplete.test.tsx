/**
 * Unit-Tests fuer die ProductAutocomplete-Komponente.
 *
 * Prueft Rendering, Filterverhalten, onChange-Callback
 * und das optionale Anlegen neuer Produkte aus dem Dropdown.
 */
import {TextEncoder, TextDecoder} from "util";
Object.assign(global, {TextEncoder, TextDecoder});

import React from "react";
import {render, screen, waitFor} from "@testing-library/react";
import "@testing-library/jest-dom";
import userEvent from "@testing-library/user-event";

import {ProductAutocomplete} from "../productAutocomplete";
import {Product, Diet} from "../product.types";
import {products as mockProducts} from "../__mocks__/products.mock";

/* ===================================================================
// ======================== Mocks =====================================
// =================================================================== */

/** sortArray gibt das Array unveraendert zurueck */
jest.mock("../../Shared/utils.class", () => ({
  Utils: {
    sortArray: ({array}: {array: unknown[]}) => array,
  },
}));

/** IngredientProduct wird direkt aus recipe.class importiert — Mock genuegt */
jest.mock("../../Recipe/recipe.class", () => ({
  __esModule: true,
}));

/* ===================================================================
// ======================== Hilfsfunktionen ===========================
// =================================================================== */

/**
 * Erstellt ein minimales Produkt fuer Tests.
 *
 * @param overrides - Optionale Felder, die ueberschrieben werden sollen.
 * @returns Ein vollstaendiges Product-Objekt.
 */
function createTestProduct(overrides: Partial<Product> = {}): Product {
  return {
    uid: "test-uid",
    name: "Testprodukt",
    department: {uid: "dept-1", name: "Testdepartment"},
    shoppingUnit: "kg",
    dietProperties: {allergens: [], diet: Diet.Vegan},
    usable: true,
    ...overrides,
  };
}

/**
 * Standard-Props fuer die ProductAutocomplete-Komponente.
 *
 * @param overrides - Optionale Props, die ueberschrieben werden sollen.
 * @returns Vollstaendige Props fuer ProductAutocomplete.
 */
function defaultProps(
  overrides: Partial<React.ComponentProps<typeof ProductAutocomplete>> = {},
) {
  return {
    componentKey: "test-key",
    product: createTestProduct({uid: "okt0", name: "Oktopus"}),
    products: mockProducts,
    onChange: jest.fn(),
    ...overrides,
  };
}

/* ===================================================================
// ======================== Tests =====================================
// =================================================================== */

describe("ProductAutocomplete", () => {
  test("Zeigt den Namen des ausgewaehlten Produkts im Eingabefeld", () => {
    render(<ProductAutocomplete {...defaultProps()} />);

    const input = screen.getByRole("combobox");
    expect(input).toHaveValue("Oktopus");
  });

  test('Zeigt "hinzufuegen"-Option wenn allowCreateNewProduct=true und neuer Name eingegeben wird', async () => {
    const user = userEvent.setup();
    render(
      <ProductAutocomplete
        {...defaultProps({allowCreateNewProduct: true})}
      />,
    );

    const input = screen.getByRole("combobox");
    await user.clear(input);
    await user.type(input, "Neues Produkt");

    // Die Dropdown-Option mit "hinzufügen" sollte sichtbar sein
    await waitFor(() => {
      expect(
        screen.getByText(/"Neues Produkt" hinzufügen/),
      ).toBeInTheDocument();
    });
  });

  test('Zeigt keine "hinzufuegen"-Option wenn allowCreateNewProduct=false', async () => {
    const user = userEvent.setup();
    render(
      <ProductAutocomplete
        {...defaultProps({allowCreateNewProduct: false})}
      />,
    );

    const input = screen.getByRole("combobox");
    await user.clear(input);
    await user.type(input, "Neues Produkt");

    // Kurz warten, damit das Dropdown aktualisiert wird
    await waitFor(() => {
      expect(
        screen.queryByText(/hinzufügen/),
      ).not.toBeInTheDocument();
    });
  });

  test("Ruft onChange mit korrekten Parametern auf bei Produktauswahl", async () => {
    const handleChange = jest.fn();
    const user = userEvent.setup();

    render(
      <ProductAutocomplete
        {...defaultProps({
          product: {uid: "", name: ""},
          onChange: handleChange,
        })}
      />,
    );

    const input = screen.getByRole("combobox");
    await user.clear(input);
    await user.type(input, "Mozzarella");

    // Warten bis die Option in der Liste auftaucht und dann klicken
    const option = await screen.findByText("Mozzarella");
    await user.click(option);

    expect(handleChange).toHaveBeenCalled();
    const callArgs = handleChange.mock.calls[0];
    // Argument 2 (newValue) sollte das Mozzarella-Produkt sein
    expect(callArgs[1]).toEqual(
      expect.objectContaining({uid: "mozza", name: "Mozzarella"}),
    );
    // Argument 3 (action/reason) sollte "selectOption" sein
    expect(callArgs[2]).toBe("selectOption");
    // Argument 4 (objectId) enthaelt den componentKey
    expect(callArgs[3]).toBe("product_test-key");
  });

  test("Rendert mit benutzerdefiniertem Label", () => {
    render(
      <ProductAutocomplete
        {...defaultProps({label: "Spezialzutat"})}
      />,
    );

    expect(screen.getByLabelText("Spezialzutat")).toBeInTheDocument();
  });
});
